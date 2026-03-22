// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * @fileoverview React Context provider for persistent state management.
 *
 * This module exports the MnemonicProvider component and useMnemonic hook,
 * which together provide a namespace-scoped storage API to child components.
 * The provider creates an in-memory cache with read-through behavior to localStorage
 * (or a synchronous custom storage backend) and implements the React external
 * store contract.
 */

import { createContext, useContext, useMemo, useEffect, ReactNode } from "react";
import { createMnemonicOptionalBridge } from "./optional-bridge-adapter";
import { MnemonicOptionalBridgeProvider } from "./optional-bridge-provider";
import { getDefaultBrowserStorage, getNativeBrowserStorages, getRuntimeNodeEnv } from "./runtime";
import type { Mnemonic, MnemonicProviderOptions, StorageLike, Listener, Unsubscribe } from "./types";

/**
 * React Context for the Mnemonic store.
 *
 * Provides access to the low-level storage API. Consumer code should use
 * `useMnemonicKey` instead of accessing this context directly.
 *
 * @internal
 */
const MnemonicContext = createContext<Mnemonic | null>(null);
const warnedNestedProviderStores = new WeakSet<Mnemonic>();

/**
 * Hook to access the Mnemonic store from context.
 *
 * This is a low-level hook used internally by `useMnemonicKey`. Most applications
 * should use `useMnemonicKey` instead, which provides a higher-level, type-safe API.
 *
 * @returns The Mnemonic store instance
 *
 * @throws {Error} If called outside of a MnemonicProvider
 *
 * @example
 * ```tsx
 * // Internal usage (prefer useMnemonicKey for application code)
 * function MyComponent() {
 *   const store = useMnemonic();
 *   const raw = store.getRawSnapshot('myKey');
 *   // ...
 * }
 * ```
 *
 * @see {@link useMnemonicKey} - Higher-level hook for application code
 * @see {@link MnemonicProvider} - Required provider component
 */
export function useMnemonic(): Mnemonic {
    const context = useMnemonicOptional();
    if (!context) {
        throw new Error("useMnemonic must be used within a MnemonicProvider");
    }
    return context;
}

/**
 * Hook to access the Mnemonic store when one is available.
 *
 * Unlike {@link useMnemonic}, this hook never throws. It returns `null`
 * when no provider is mounted above the caller.
 */
export function useMnemonicOptional(): Mnemonic | null {
    return useContext(MnemonicContext);
}

/**
 * Props for the MnemonicProvider component.
 *
 * Extends MnemonicProviderOptions with required children prop.
 *
 * @see {@link MnemonicProviderOptions} - Configuration options
 * @see {@link MnemonicProvider} - Provider component
 */
export interface MnemonicProviderProps extends Readonly<MnemonicProviderOptions> {
    /**
     * React children to render within the provider.
     */
    readonly children: ReactNode;
}

/** Internal store type with reload capability, not exposed to consumers. */
type MnemonicInternal = Mnemonic & {
    reloadFromStorage: (changedKeys?: string[]) => void;
};

/** Internal store extension to retain a strong provider API reference while mounted. */
type MnemonicInternalWithDevToolsHold = MnemonicInternal & {
    __devToolsProviderApiHold?: DevToolsProviderApi;
};

/** Minimal WeakRef shape so we can compile against ES2020 libs. */
type WeakRefLike<T extends object> = {
    deref: () => T | undefined;
};

type WeakRefConstructorLike = new <T extends object>(target: T) => WeakRefLike<T>;

type DevToolsProviderApi = {
    getStore: () => MnemonicInternal;
    dump: () => Record<string, string>;
    get: (key: string) => unknown;
    set: (key: string, value: unknown) => void;
    remove: (key: string) => void;
    clear: () => void;
    keys: () => string[];
};

type DevToolsProviderEntry = {
    namespace: string;
    weakRef: WeakRefLike<DevToolsProviderApi>;
    registeredAt: number;
    lastSeenAt: number;
    staleSince: number | null;
};

type DevToolsProviderDescriptor = {
    namespace: string;
    available: boolean;
    registeredAt: number;
    lastSeenAt: number;
    staleSince: number | null;
};

type DevToolsRegistryRoot = {
    providers: Record<string, DevToolsProviderEntry>;
    resolve: (namespace: string) => DevToolsProviderApi | null;
    list: () => DevToolsProviderDescriptor[];
    capabilities: {
        weakRef: boolean;
        finalizationRegistry: boolean;
    };
    __meta: {
        version: number;
        lastUpdated: number;
        lastChange: string;
    };
};

type DevToolsGlobalWindow = Window & {
    __REACT_MNEMONIC_DEVTOOLS__?: unknown;
};

type StorageAccessCallbacks = {
    onAccessError: (error: unknown) => void;
    onAccessSuccess: () => void;
    onAsyncViolation: (method: "getItem" | "setItem" | "removeItem", thenable: PromiseLike<unknown>) => void;
};

function detectEnumerableStorage(storage: StorageLike | undefined): boolean {
    if (!storage) return false;
    try {
        return typeof storage.length === "number" && typeof storage.key === "function";
    } catch {
        return false;
    }
}

function isProductionRuntime(): boolean {
    const env = getRuntimeNodeEnv();
    if (env === undefined) {
        return true;
    }
    return env === "production";
}

function weakRefConstructor(): WeakRefConstructorLike | null {
    const ctor = (globalThis as { WeakRef?: unknown }).WeakRef;
    return typeof ctor === "function" ? (ctor as WeakRefConstructorLike) : null;
}

function hasFinalizationRegistry(): boolean {
    return typeof (globalThis as { FinalizationRegistry?: unknown }).FinalizationRegistry === "function";
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    if (value == null) return false;
    if (typeof value !== "object" && typeof value !== "function") return false;
    return typeof (value as { then?: unknown }).then === "function";
}

function getCrossTabSyncMode(
    requestedStorage: StorageLike | undefined,
    activeStorage: StorageLike | undefined,
): NonNullable<Mnemonic["crossTabSyncMode"]> {
    const isExplicitNativeBrowserStorage =
        activeStorage !== undefined &&
        requestedStorage !== undefined &&
        getNativeBrowserStorages().includes(activeStorage);
    if ((requestedStorage === undefined && activeStorage !== undefined) || isExplicitNativeBrowserStorage) {
        return "browser-storage-event";
    }
    if (typeof activeStorage?.onExternalChange === "function") {
        return "custom-external-change";
    }
    return "none";
}

function getDevToolsWindow(): DevToolsGlobalWindow | undefined {
    return (globalThis as { window?: DevToolsGlobalWindow }).window;
}

function sanitizeDevToolsRoot(root: Record<string, unknown>): void {
    const reserved = new Set(["providers", "resolve", "list", "capabilities", "__meta"]);
    for (const key of Object.keys(root)) {
        if (reserved.has(key)) continue;
        const descriptor = Object.getOwnPropertyDescriptor(root, key);
        if (descriptor && !descriptor.configurable) continue;
        try {
            delete root[key];
        } catch {
            // Ignore hostile legacy properties so devtools init stays fail-safe.
        }
    }
}

function ensureDevToolsRoot(enableDevTools: boolean): DevToolsRegistryRoot | null {
    if (!enableDevTools) return null;

    const globalWindow = getDevToolsWindow();
    if (!globalWindow) return null;

    const weakRefSupported = weakRefConstructor() !== null;
    const finalizationRegistrySupported = hasFinalizationRegistry();
    const existing = globalWindow.__REACT_MNEMONIC_DEVTOOLS__;
    const root: Record<string, unknown> =
        existing && typeof existing === "object" ? (existing as Record<string, unknown>) : {};

    sanitizeDevToolsRoot(root);

    if (!root.providers || typeof root.providers !== "object") {
        root.providers = {};
    }

    if (!root.capabilities || typeof root.capabilities !== "object") {
        root.capabilities = {};
    }

    const capabilities = root.capabilities as DevToolsRegistryRoot["capabilities"];
    capabilities.weakRef = weakRefSupported;
    capabilities.finalizationRegistry = finalizationRegistrySupported;

    if (!root.__meta || typeof root.__meta !== "object") {
        root.__meta = {
            version: 0,
            lastUpdated: Date.now(),
            lastChange: "",
        };
    }

    const meta = root.__meta as DevToolsRegistryRoot["__meta"];
    if (typeof meta.version !== "number" || !Number.isFinite(meta.version)) {
        meta.version = 0;
    }
    if (typeof meta.lastUpdated !== "number" || !Number.isFinite(meta.lastUpdated)) {
        meta.lastUpdated = Date.now();
    }
    if (typeof meta.lastChange !== "string") {
        meta.lastChange = "";
    }

    const providers = root.providers as Record<string, DevToolsProviderEntry>;
    if (typeof root.resolve !== "function") {
        root.resolve = (namespace: string): DevToolsProviderApi | null => {
            const entry = providers[namespace];
            if (!entry || typeof entry.weakRef?.deref !== "function") return null;

            const live = entry.weakRef.deref();
            if (live) {
                entry.lastSeenAt = Date.now();
                entry.staleSince = null;
                return live;
            }

            entry.staleSince ??= Date.now();
            return null;
        };
    }

    if (typeof root.list !== "function") {
        root.list = (): DevToolsProviderDescriptor[] =>
            Object.entries(providers)
                .map(([namespace, entry]) => {
                    const live = typeof entry.weakRef?.deref === "function" ? entry.weakRef.deref() : undefined;
                    const available = Boolean(live);
                    if (available) {
                        entry.lastSeenAt = Date.now();
                        entry.staleSince = null;
                    } else {
                        entry.staleSince ??= Date.now();
                    }
                    return {
                        namespace,
                        available,
                        registeredAt: entry.registeredAt,
                        lastSeenAt: entry.lastSeenAt,
                        staleSince: entry.staleSince,
                    };
                })
                .sort((left, right) => left.namespace.localeCompare(right.namespace));
    }

    globalWindow.__REACT_MNEMONIC_DEVTOOLS__ = root;
    return root as DevToolsRegistryRoot;
}

function bumpDevToolsVersion(root: DevToolsRegistryRoot | null, namespace: string, reason: string): void {
    if (!root) return;
    root.__meta.version += 1;
    root.__meta.lastUpdated = Date.now();
    root.__meta.lastChange = `${namespace}.${reason}`;
}

function decodeDevToolsValue(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
}

function readStorageRaw(
    storage: StorageLike | undefined,
    storageKey: string,
    callbacks: StorageAccessCallbacks,
): string | null {
    if (!storage) return null;

    try {
        const raw = storage.getItem(storageKey);
        if (isPromiseLike(raw)) {
            callbacks.onAsyncViolation("getItem", raw);
            return null;
        }
        callbacks.onAccessSuccess();
        return raw;
    } catch (error) {
        callbacks.onAccessError(error);
        return null;
    }
}

function enumerateNamespaceKeys(
    storage: StorageLike | undefined,
    prefix: string,
    callbacks: Pick<StorageAccessCallbacks, "onAccessError" | "onAccessSuccess">,
): string[] {
    if (!storage) {
        return [];
    }

    const keys: string[] = [];
    try {
        const storageLength = storage.length;
        const getStorageKey = storage.key;
        if (typeof storageLength !== "number" || typeof getStorageKey !== "function") {
            return [];
        }
        for (let index = 0; index < storageLength; index++) {
            const fullKey = getStorageKey.call(storage, index);
            if (!fullKey?.startsWith(prefix)) continue;
            keys.push(fullKey.slice(prefix.length));
        }
        callbacks.onAccessSuccess();
    } catch (error) {
        callbacks.onAccessError(error);
    }
    return keys;
}

function syncCacheEntryFromStorage({
    key,
    storageKey,
    storage,
    cache,
    emit,
    callbacks,
}: {
    key: string;
    storageKey: string;
    storage: StorageLike | undefined;
    cache: Map<string, string | null>;
    emit: (key: string) => void;
    callbacks: StorageAccessCallbacks;
}): boolean {
    const fresh = readStorageRaw(storage, storageKey, callbacks);
    const cached = cache.get(key) ?? null;
    if (fresh === cached) {
        return false;
    }
    cache.set(key, fresh);
    emit(key);
    return true;
}

function reloadNamedKeysFromStorage({
    changedKeys,
    prefix,
    storage,
    listeners,
    cache,
    emit,
    callbacks,
}: {
    changedKeys: string[];
    prefix: string;
    storage: StorageLike | undefined;
    listeners: Map<string, Set<Listener>>;
    cache: Map<string, string | null>;
    emit: (key: string) => void;
    callbacks: StorageAccessCallbacks;
}): boolean {
    let changed = false;

    for (const fullStorageKey of changedKeys) {
        if (!fullStorageKey.startsWith(prefix)) continue;
        const key = fullStorageKey.slice(prefix.length);
        const listenerSet = listeners.get(key);
        if (listenerSet && listenerSet.size > 0) {
            changed =
                syncCacheEntryFromStorage({
                    key,
                    storageKey: fullStorageKey,
                    storage,
                    cache,
                    emit,
                    callbacks,
                }) || changed;
            continue;
        }
        if (cache.has(key)) {
            cache.delete(key);
        }
    }

    return changed;
}

function reloadSubscribedKeysFromStorage({
    prefix,
    storage,
    listeners,
    cache,
    emit,
    callbacks,
}: {
    prefix: string;
    storage: StorageLike | undefined;
    listeners: Map<string, Set<Listener>>;
    cache: Map<string, string | null>;
    emit: (key: string) => void;
    callbacks: StorageAccessCallbacks;
}): boolean {
    let changed = false;

    for (const [key, listenerSet] of listeners) {
        if (listenerSet.size === 0) continue;
        changed =
            syncCacheEntryFromStorage({
                key,
                storageKey: `${prefix}${key}`,
                storage,
                cache,
                emit,
                callbacks,
            }) || changed;
    }

    for (const key of cache.keys()) {
        const listenerSet = listeners.get(key);
        if (listenerSet && listenerSet.size > 0) continue;
        cache.delete(key);
    }

    return changed;
}

function createDevToolsProviderApi({
    store,
    dump,
    keys,
    readThrough,
    writeRaw,
    removeRaw,
}: {
    store: MnemonicInternal;
    dump: () => Record<string, string>;
    keys: () => string[];
    readThrough: (key: string) => string | null;
    writeRaw: (key: string, raw: string) => void;
    removeRaw: (key: string) => void;
}): DevToolsProviderApi {
    return {
        getStore: () => store,
        dump: () => {
            const data = dump();
            console.table(
                Object.entries(data).map(([key, value]) => ({
                    key,
                    value,
                    decoded: decodeDevToolsValue(value),
                })),
            );
            return data;
        },
        get: (key: string) => {
            const raw = readThrough(key);
            if (raw == null) return undefined;
            return decodeDevToolsValue(raw);
        },
        set: (key: string, value: unknown) => {
            writeRaw(key, JSON.stringify(value));
        },
        remove: (key: string) => removeRaw(key),
        clear: () => {
            for (const key of keys()) {
                removeRaw(key);
            }
        },
        keys,
    };
}

function createReloadFromStorage({
    storage,
    hasAsyncContractViolation,
    prefix,
    listeners,
    cache,
    emit,
    callbacks,
    devToolsRoot,
    namespace,
}: {
    storage: StorageLike | undefined;
    hasAsyncContractViolation: () => boolean;
    prefix: string;
    listeners: Map<string, Set<Listener>>;
    cache: Map<string, string | null>;
    emit: (key: string) => void;
    callbacks: StorageAccessCallbacks;
    devToolsRoot: DevToolsRegistryRoot | null;
    namespace: string;
}): (changedKeys?: string[]) => void {
    return (changedKeys?: string[]) => {
        if (!storage || hasAsyncContractViolation()) return;
        if (changedKeys?.length === 0) return;

        const isFullReload = changedKeys === undefined;
        const changed = isFullReload
            ? reloadSubscribedKeysFromStorage({
                  prefix,
                  storage,
                  listeners,
                  cache,
                  emit,
                  callbacks,
              })
            : reloadNamedKeysFromStorage({
                  changedKeys,
                  prefix,
                  storage,
                  listeners,
                  cache,
                  emit,
                  callbacks,
              });

        if (changed) {
            bumpDevToolsVersion(devToolsRoot, namespace, isFullReload ? "reload:full" : "reload:granular");
        }
    };
}

function registerDevToolsProvider({
    devToolsRoot,
    namespace,
    store,
    dump,
    keys,
    readThrough,
    writeRaw,
    removeRaw,
}: {
    devToolsRoot: DevToolsRegistryRoot;
    namespace: string;
    store: MnemonicInternalWithDevToolsHold;
    dump: () => Record<string, string>;
    keys: () => string[];
    readThrough: (key: string) => string | null;
    writeRaw: (key: string, raw: string) => void;
    removeRaw: (key: string) => void;
}): void {
    let infoMessage = `[Mnemonic DevTools] Namespace "${namespace}" available via window.__REACT_MNEMONIC_DEVTOOLS__.resolve("${namespace}")`;

    if (!devToolsRoot.capabilities.weakRef) {
        console.info(
            `[Mnemonic DevTools] WeakRef is not available; registry provider "${namespace}" was not registered.`,
        );
        return;
    }

    const existingLive = devToolsRoot.resolve(namespace);
    if (existingLive) {
        const duplicateMessage = `[Mnemonic DevTools] Duplicate provider namespace "${namespace}" detected. Each window must have at most one live MnemonicProvider per namespace.`;
        if (!isProductionRuntime()) {
            throw new Error(duplicateMessage);
        }
        console.warn(`${duplicateMessage} Keeping the first provider and ignoring the duplicate.`);
        console.info(
            `[Mnemonic DevTools] Namespace "${namespace}" already registered. Keeping existing provider reference.`,
        );
        return;
    }

    const providerApi = createDevToolsProviderApi({
        store,
        dump,
        keys,
        readThrough,
        writeRaw,
        removeRaw,
    });
    const WeakRefCtor = weakRefConstructor();
    if (!WeakRefCtor) {
        console.info(`[Mnemonic DevTools] WeakRef became unavailable while registering "${namespace}".`);
        return;
    }

    // Keep a strong reference for the mounted provider lifetime.
    // The global registry still only exposes a WeakRef, but this
    // prevents premature collection while the provider is active.
    store.__devToolsProviderApiHold = providerApi;

    const now = Date.now();
    devToolsRoot.providers[namespace] = {
        namespace,
        weakRef: new WeakRefCtor(providerApi),
        registeredAt: now,
        lastSeenAt: now,
        staleSince: null,
    };
    bumpDevToolsVersion(devToolsRoot, namespace, "registry:namespace-registered");
    console.info(infoMessage);
}

/**
 * React Context provider for namespace-isolated persistent state.
 *
 * Creates a scoped storage environment where all keys are automatically prefixed
 * with the namespace to prevent collisions. Implements an in-memory cache with
 * read-through behavior to the underlying storage backend (localStorage by default).
 *
 * This provider must wrap any components that use `useMnemonicKey`. Multiple
 * providers with different namespaces can coexist in the same application.
 *
 * @param props - Provider configuration and children
 * @param props.children - React children to render within the provider
 * @param props.namespace - Unique namespace for isolating storage keys
 * @param props.storage - Optional synchronous custom storage backend (defaults to localStorage)
 * @param props.enableDevTools - Enable DevTools debugging interface (defaults to false)
 * @param props.schemaMode - Schema enforcement mode (default: "default")
 * @param props.schemaRegistry - Optional schema registry for storing schemas and migrations
 * @param props.ssr - Optional SSR defaults for descendant hooks
 *
 * @example
 * ```tsx
 * // Basic usage with default settings
 * function App() {
 *   return (
 *     <MnemonicProvider namespace="myApp">
 *       <MyComponents />
 *     </MnemonicProvider>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With a synchronous custom storage backend
 * function App() {
 *   return (
 *     <MnemonicProvider
 *       namespace="myApp"
 *       storage={window.sessionStorage}
 *     >
 *       <MyComponents />
 *     </MnemonicProvider>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With DevTools enabled (development only)
 * function App() {
 *   return (
 *     <MnemonicProvider
 *       namespace="myApp"
 *       enableDevTools={process.env.NODE_ENV === 'development'}
 *     >
 *       <MyComponents />
 *     </MnemonicProvider>
 *   );
 * }
 *
 * // Then in browser console:
 * const dt = window.__REACT_MNEMONIC_DEVTOOLS__.resolve('myApp')
 * dt?.dump()
 * dt?.get('user')
 * dt?.set('theme', 'dark')
 * ```
 *
 * @example
 * ```tsx
 * // Multiple providers with different namespaces
 * function App() {
 *   return (
 *     <MnemonicProvider namespace="user-prefs">
 *       <UserSettings />
 *       <MnemonicProvider namespace="app-state">
 *         <Dashboard />
 *       </MnemonicProvider>
 *     </MnemonicProvider>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Delay persisted storage reads until after client mount
 * function App() {
 *   return (
 *     <MnemonicProvider
 *       namespace="myApp"
 *       ssr={{ hydration: "client-only" }}
 *     >
 *       <MyComponents />
 *     </MnemonicProvider>
 *   );
 * }
 * ```
 *
 * @remarks
 * - Creates a stable store instance that only recreates when namespace, storage, or enableDevTools change
 * - All storage operations are cached in memory for fast reads
 * - Storage failures are handled gracefully (logged but not thrown)
 * - `StorageLike` is intentionally synchronous for v1; async persistence must sit behind a sync facade
 * - In SSR environments, the provider is safe by default: hooks render
 *   `defaultValue` unless configured with an explicit `ssr.serverValue`
 * - The store implements React's useSyncExternalStore contract for efficient updates
 *
 * @see {@link useMnemonicKey} - Hook for using persistent state
 * @see {@link MnemonicProviderOptions} - Configuration options
 */
export function MnemonicProvider({
    children,
    namespace,
    storage,
    enableDevTools = false,
    schemaMode = "default",
    schemaRegistry,
    ssr,
    bootstrap,
}: MnemonicProviderProps) {
    if (schemaMode === "strict" && !schemaRegistry) {
        throw new Error("MnemonicProvider strict mode requires schemaRegistry");
    }
    if (schemaMode === "autoschema" && typeof schemaRegistry?.registerSchema !== "function") {
        throw new Error("MnemonicProvider autoschema mode requires schemaRegistry.registerSchema");
    }

    const prefix = `${namespace}.`;
    const parentStore = useMnemonicOptional();

    useEffect(() => {
        if (isProductionRuntime()) return;
        if (parentStore?.prefix !== prefix) return;
        if (warnedNestedProviderStores.has(parentStore)) return;

        warnedNestedProviderStores.add(parentStore);
        console.warn(
            `[Mnemonic] Nested MnemonicProvider detected for namespace "${namespace}". ` +
                "The nearest provider wins, so the inner provider creates a separate store " +
                "and cache even though the namespace matches. Prefer a single provider per " +
                "namespace, or use distinct namespaces for intentionally separate scopes.",
        );
    }, [namespace, parentStore, prefix]);

    const store = useMemo<MnemonicInternal>(() => {
        const st = storage ?? getDefaultBrowserStorage();
        const ssrHydration = ssr?.hydration ?? "immediate";
        const devToolsRoot = ensureDevToolsRoot(enableDevTools);
        const canEnumerateKeys = detectEnumerableStorage(st);
        const crossTabSyncMode = getCrossTabSyncMode(storage, st);

        /**
         * In-memory cache of raw string values.
         * Maps unprefixed keys to their raw string values (or null if not present).
         * Provides fast reads without hitting storage on every access.
         */
        const cache = new Map<string, string | null>();
        if (bootstrap?.raw) {
            for (const [key, raw] of Object.entries(bootstrap.raw)) {
                if (raw != null) {
                    cache.set(key, raw);
                }
            }
        }

        /**
         * Per-key listener registry.
         * Maps unprefixed keys to sets of listener functions.
         * Used to notify React components when values change.
         */
        const listeners = new Map<string, Set<Listener>>();

        /** Whether a QuotaExceededError has already been logged since the last successful write. */
        let quotaErrorLogged = false;

        /** Whether a non-quota DOMException has already been logged since the last successful storage access. */
        let accessErrorLogged = false;

        /** Whether the storage backend has violated the synchronous StorageLike contract. */
        let asyncContractViolationDetected = false;
        const storageAccessCallbacks: StorageAccessCallbacks = {
            onAccessError: (err) => logAccessError(err),
            onAccessSuccess: () => {
                accessErrorLogged = false;
            },
            onAsyncViolation: (method, thenable) => handleAsyncStorageContractViolation(method, thenable),
        };

        /**
         * Converts an unprefixed key to a fully-qualified storage key.
         *
         * @param key - Unprefixed key
         * @returns Prefixed key with namespace
         */
        const fullKey = (key: string) => prefix + key;

        /**
         * Notifies all listeners subscribed to a specific key.
         * Called after mutations (set/remove) to trigger React re-renders.
         *
         * @param key - Unprefixed key that changed
         */
        const emit = (key: string) => {
            const set = listeners.get(key);
            if (!set) return;
            for (const fn of set) fn();
        };

        /**
         * Logs a storage-access DOMException once, squelching repeats until
         * a successful storage operation resets the flag. Ignores
         * QuotaExceededError (handled separately in writeRaw) and silently
         * swallows all non-DOMException errors.
         */
        const logAccessError = (err: unknown): void => {
            if (!accessErrorLogged && err instanceof DOMException && err.name !== "QuotaExceededError") {
                console.error(
                    `[Mnemonic] Storage access error (${err.name}): ${err.message}. ` +
                        "Data is cached in memory but may not persist.",
                );
                accessErrorLogged = true;
            }
        };

        /**
         * Marks the storage backend as incompatible with the synchronous
         * StorageLike contract, consumes the offending thenable to avoid
         * unhandled rejections, and logs the problem once.
         */
        const handleAsyncStorageContractViolation = (
            method: "getItem" | "setItem" | "removeItem",
            thenable: PromiseLike<unknown>,
        ): void => {
            asyncContractViolationDetected = true;
            void Promise.resolve(thenable).catch(() => undefined);
            if (accessErrorLogged) return;
            console.error(
                `[Mnemonic] StorageLike.${method} returned a Promise. ` +
                    "StorageLike must remain synchronous for react-mnemonic v1. " +
                    "Wrap async persistence behind a synchronous cache facade instead.",
            );
            accessErrorLogged = true;
        };

        /**
         * Read-through cache accessor.
         * Returns cached value if available, otherwise reads from storage and caches.
         *
         * @param key - Unprefixed key to read
         * @returns Raw string value, or null if not present
         */
        const readThrough = (key: string): string | null => {
            if (cache.has(key)) return cache.get(key) ?? null;
            if (!st || asyncContractViolationDetected) {
                cache.set(key, null);
                return null;
            }
            const raw = readStorageRaw(st, fullKey(key), storageAccessCallbacks);
            cache.set(key, raw);
            return raw;
        };

        /**
         * Writes a raw string value to both cache and storage.
         * Notifies listeners after the write completes.
         *
         * @param key - Unprefixed key to write
         * @param raw - Raw string value to store
         */
        const writeRaw = (key: string, raw: string) => {
            cache.set(key, raw);
            if (st && !asyncContractViolationDetected) {
                try {
                    const result = st.setItem(fullKey(key), raw);
                    if (isPromiseLike(result)) {
                        handleAsyncStorageContractViolation("setItem", result);
                    } else {
                        quotaErrorLogged = false;
                        accessErrorLogged = false;
                    }
                } catch (err) {
                    if (!quotaErrorLogged && err instanceof DOMException && err.name === "QuotaExceededError") {
                        console.error(
                            `[Mnemonic] Storage quota exceeded writing key "${key}". ` +
                                "Data is cached in memory but will not persist.",
                        );
                        quotaErrorLogged = true;
                    }
                    logAccessError(err);
                }
            }
            emit(key);
            bumpDevToolsVersion(devToolsRoot, namespace, `set:${key}`);
        };

        /**
         * Removes a key from both cache and storage.
         * Notifies listeners after the removal completes.
         *
         * @param key - Unprefixed key to remove
         */
        const removeRaw = (key: string) => {
            cache.set(key, null);
            if (st && !asyncContractViolationDetected) {
                try {
                    const result = st.removeItem(fullKey(key));
                    if (isPromiseLike(result)) {
                        handleAsyncStorageContractViolation("removeItem", result);
                    } else {
                        accessErrorLogged = false;
                    }
                } catch (err) {
                    logAccessError(err);
                }
            }
            emit(key);
            bumpDevToolsVersion(devToolsRoot, namespace, `remove:${key}`);
        };

        /**
         * Subscribes a listener to changes for a specific key.
         * Implements the React external store subscription contract.
         *
         * @param key - Unprefixed key to subscribe to
         * @param listener - Callback invoked when the value changes
         * @returns Unsubscribe function
         */
        const subscribeRaw = (key: string, listener: Listener): Unsubscribe => {
            let set = listeners.get(key);
            if (!set) {
                set = new Set();
                listeners.set(key, set);
            }
            set.add(listener);

            // Ensure cache is primed so snapshots are stable.
            readThrough(key);

            return () => {
                const s = listeners.get(key);
                if (!s) return;
                s.delete(listener);
                if (s.size === 0) listeners.delete(key);
            };
        };

        /**
         * Gets the current snapshot of a key's raw value.
         * Implements the React external store snapshot contract.
         *
         * @param key - Unprefixed key to read
         * @returns Raw string value, or null if not present
         */
        const getRawSnapshot = (key: string) => readThrough(key);

        /**
         * Enumerates all keys in this namespace.
         * Iterates through storage and filters keys by namespace prefix.
         *
         * @returns Array of unprefixed key names
         */
        const keys = () => {
            if (asyncContractViolationDetected) {
                return Array.from(cache.entries())
                    .filter(([, value]) => value != null)
                    .map(([key]) => key);
            }
            if (!canEnumerateKeys) return [];
            return enumerateNamespaceKeys(st, prefix, storageAccessCallbacks);
        };

        /**
         * Dumps all key-value pairs in this namespace.
         * Useful for debugging and DevTools integration.
         *
         * @returns Object mapping unprefixed keys to raw string values
         */
        const dump = () => {
            const out: Record<string, string> = {};
            for (const k of keys()) {
                const raw = readThrough(k);
                if (raw != null) out[k] = raw;
            }
            return out;
        };

        /**
         * Re-reads keys from the underlying storage, updating the cache and
         * emitting change notifications for any keys whose values differ.
         *
         * @param changedKeys - Optional array of fully-qualified storage keys
         *   that changed. When undefined, performs a blanket reload of all
         *   actively subscribed keys. When an empty array, does nothing.
         *
         * Called by the onExternalChange subscription when the storage adapter
         * signals that data has changed externally (e.g., from another tab).
         */
        const reloadFromStorage = createReloadFromStorage({
            storage: st,
            hasAsyncContractViolation: () => asyncContractViolationDetected,
            prefix,
            listeners,
            cache,
            emit,
            callbacks: storageAccessCallbacks,
            devToolsRoot,
            namespace,
        });

        /**
         * The Mnemonic store API object.
         * Implements the contract expected by useSyncExternalStore.
         */
        const store: MnemonicInternalWithDevToolsHold = {
            prefix,
            canEnumerateKeys,
            subscribeRaw,
            getRawSnapshot,
            setRaw: writeRaw,
            removeRaw,
            keys,
            dump,
            reloadFromStorage,
            schemaMode,
            ssrHydration,
            crossTabSyncMode,
            ...(schemaRegistry ? { schemaRegistry } : {}),
        };

        /**
         * DevTools integration.
         * Exposes a weak-provider registry on the window object when enabled.
         */
        if (devToolsRoot) {
            registerDevToolsProvider({
                devToolsRoot,
                namespace,
                store,
                dump,
                keys,
                readThrough,
                writeRaw,
                removeRaw,
            });
        }

        return store;
    }, [namespace, storage, enableDevTools, schemaMode, schemaRegistry, ssr?.hydration, bootstrap?.raw]);

    const optionalBridge = useMemo(
        () =>
            createMnemonicOptionalBridge({
                api: store,
                ...(schemaRegistry ? { schemaRegistry } : {}),
            }),
        [schemaRegistry, store],
    );

    // Subscribe to external storage changes (e.g., cross-tab BroadcastChannel)
    useEffect(() => {
        if (!storage?.onExternalChange) return;
        return storage.onExternalChange((changedKeys) => store.reloadFromStorage(changedKeys));
    }, [storage, store]);

    return (
        <MnemonicContext.Provider value={store}>
            <MnemonicOptionalBridgeProvider bridge={optionalBridge}>{children}</MnemonicOptionalBridgeProvider>
        </MnemonicContext.Provider>
    );
}
