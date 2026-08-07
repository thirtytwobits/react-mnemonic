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

import { createContext, useContext, useMemo, useEffect, useRef, ReactNode } from "react";
import { createMnemonicOptionalBridge } from "./optional-bridge-adapter";
import { MnemonicOptionalBridgeProvider } from "./optional-bridge-provider";
import { getDefaultBrowserStorage, getNativeBrowserStorages, getRuntimeNodeEnv } from "./runtime";
import { registerStorageErrorReporter, reportStorageError } from "./storage-error";
import type {
    Mnemonic,
    MnemonicFlushResult,
    MnemonicProviderOptions,
    MnemonicStorageErrorReason,
    StorageLike,
    Listener,
    Unsubscribe,
} from "./types";

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

/**
 * Why a single storage mutation did not land, paired with whatever was thrown.
 *
 * `error` is `undefined` for failures with nothing to throw: no backend at all,
 * or writes disabled after a synchronous-contract violation.
 */
type PersistFailure = {
    reason: MnemonicStorageErrorReason;
    error: unknown;
};

/**
 * Outcome of applying the storage half of a mutation.
 *
 * Modelled as a discriminated union rather than a boolean so the reason a write
 * was dropped survives the trip back to the caller that has to report it.
 */
type PersistResult = { landed: true } | { landed: false; failure: PersistFailure };

const PERSIST_LANDED: PersistResult = { landed: true };

/**
 * Distinguishes a full backend from one that refused for another reason.
 *
 * Anything that is not a `QuotaExceededError` — including non-`DOMException`
 * throws from custom backends — is reported as an access failure, which is what
 * it looks like from the caller's side: storage would not take the write.
 */
function classifyStorageThrow(error: unknown): MnemonicStorageErrorReason {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
        return "quota";
    }
    return "access";
}

/**
 * Approximate stored size of a raw value, in bytes.
 *
 * Counted as UTF-16 code units times two, matching how browsers account
 * `localStorage` quota. Backends that store UTF-8 will use a different amount;
 * this is a diagnostic aid for quota reporting, not an exact measure.
 */
function approximateStoredBytes(raw: string): number {
    return raw.length * 2;
}

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

/**
 * Outcome of a single raw storage read.
 *
 * A read that failed and a key that is genuinely absent both yield a `null`
 * value, so callers that must tell those apart — anything deciding whether
 * storage has authoritatively spoken for a key — read `ok` rather than
 * inferring from the value.
 */
type StorageReadResult = { ok: true; raw: string | null } | { ok: false; raw: null };

const STORAGE_READ_FAILED: StorageReadResult = { ok: false, raw: null };

function readStorageRaw(
    storage: StorageLike | undefined,
    storageKey: string,
    callbacks: StorageAccessCallbacks,
): StorageReadResult {
    if (!storage) return STORAGE_READ_FAILED;

    try {
        const raw = storage.getItem(storageKey);
        if (isPromiseLike(raw)) {
            callbacks.onAsyncViolation("getItem", raw);
            return STORAGE_READ_FAILED;
        }
        callbacks.onAccessSuccess();
        return { ok: true, raw };
    } catch (error) {
        callbacks.onAccessError(error);
        return STORAGE_READ_FAILED;
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
    onCacheSyncedFromStorage,
}: {
    key: string;
    storageKey: string;
    storage: StorageLike | undefined;
    cache: Map<string, string | null>;
    emit: (key: string) => void;
    callbacks: StorageAccessCallbacks;
    onCacheSyncedFromStorage: (key: string) => void;
}): boolean {
    const fresh = readStorageRaw(storage, storageKey, callbacks);
    if (fresh.ok) {
        // Storage just won this key back, so any write we were still holding
        // for it is superseded rather than pending.
        //
        // Only a read that actually succeeded can supersede a queued write. A
        // failed read reports the same null as an absent key, so forgetting the
        // write here would discard it on the strength of an error and leave
        // flush() with nothing to retry. The unreadable case keeps its queue
        // entry and reaches storage on the next flush.
        onCacheSyncedFromStorage(key);
    }
    const cached = cache.get(key) ?? null;
    if (fresh.raw === cached) {
        return false;
    }
    cache.set(key, fresh.raw);
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
    onCacheSyncedFromStorage,
}: {
    changedKeys: string[];
    prefix: string;
    storage: StorageLike | undefined;
    listeners: Map<string, Set<Listener>>;
    cache: Map<string, string | null>;
    emit: (key: string) => void;
    callbacks: StorageAccessCallbacks;
    onCacheSyncedFromStorage: (key: string) => void;
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
                    onCacheSyncedFromStorage,
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
    onCacheSyncedFromStorage,
}: {
    prefix: string;
    storage: StorageLike | undefined;
    listeners: Map<string, Set<Listener>>;
    cache: Map<string, string | null>;
    emit: (key: string) => void;
    callbacks: StorageAccessCallbacks;
    onCacheSyncedFromStorage: (key: string) => void;
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
                onCacheSyncedFromStorage,
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
            // Storage enumeration misses keys that only exist as unpersisted
            // writes, and those would survive the clear.
            for (const key of new Set([...keys(), ...store.unpersistedKeys()])) {
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
    onCacheSyncedFromStorage,
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
    onCacheSyncedFromStorage: (key: string) => void;
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
                  onCacheSyncedFromStorage,
              })
            : reloadNamedKeysFromStorage({
                  changedKeys,
                  prefix,
                  storage,
                  listeners,
                  cache,
                  emit,
                  callbacks,
                  onCacheSyncedFromStorage,
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
    onStorageError,
}: MnemonicProviderProps) {
    if (schemaMode === "strict" && !schemaRegistry) {
        throw new Error("MnemonicProvider strict mode requires schemaRegistry");
    }
    if (schemaMode === "autoschema" && typeof schemaRegistry?.registerSchema !== "function") {
        throw new Error("MnemonicProvider autoschema mode requires schemaRegistry.registerSchema");
    }

    const prefix = `${namespace}.`;
    const parentStore = useMnemonicOptional();
    const bootstrapRawSeed = useRef(bootstrap?.raw).current;

    /**
     * Latest `onStorageError`, read through a ref so the handler can be an
     * inline arrow without recreating the store on every render.
     *
     * Seeded with the first value rather than left empty, so a write that fails
     * during the initial commit — a child effect writing before this provider's
     * own effect runs — still reaches the handler.
     */
    const onStorageErrorRef = useRef(onStorageError);
    useEffect(() => {
        onStorageErrorRef.current = onStorageError;
    }, [onStorageError]);

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
         *
         * Bootstrap seeds only populate confirmed raw strings. Confirmed
         * absences (`null`) are allowed in bootstrap snapshots, but the
         * provider revalidates them on first access so a value written between
         * bootstrap and mount is not missed.
         */
        const cache = new Map<string, string | null>();
        if (bootstrapRawSeed) {
            for (const [key, raw] of Object.entries(bootstrapRawSeed)) {
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

        /**
         * Mutations that updated the cache but never reached the storage backend.
         *
         * Maps unprefixed keys to the raw value that still needs to be written,
         * or to `null` when the pending mutation is a removal. Entries are added
         * when a write or removal fails (or when there is no usable backend to
         * write to) and removed as soon as the same value reaches storage,
         * either through a later mutation or through {@link flush}.
         *
         * The pending raw value is held here rather than read back from the
         * cache so a pending write survives cache eviction during an external
         * reload.
         *
         * Memory: one entry per distinct key, not per write — repeated failures
         * on the same key replace the entry and release the superseded string.
         * The retained string is normally the same one the cache already holds,
         * so a queued write costs a map entry rather than a copy of the payload.
         * The exception is a key an external reload evicted from the cache,
         * where this map becomes the only retainer; that is deliberate, since
         * dropping it would discard the write it exists to recover.
         */
        const pendingWrites = new Map<string, string | null>();

        /** Whether a QuotaExceededError has already been logged since the last successful write. */
        let quotaErrorLogged = false;

        /** Whether a non-quota DOMException has already been logged since the last successful storage access. */
        let accessErrorLogged = false;

        /** Whether the storage backend has violated the synchronous StorageLike contract. */
        let asyncContractViolationDetected = false;

        /**
         * Reports a dropped mutation to the provider's `onStorageError`.
         *
         * Called after the cache, the pending-write queue, and subscribers have
         * all been updated, so a handler that reads the store — or writes to it
         * — sees a consistent snapshot rather than a half-applied mutation.
         * Throw containment and recursion guarding live in `reportStorageError`
         * so hook-side schema and codec reports get the same treatment.
         *
         * The early return keeps the no-handler case free: without a handler,
         * every write in a storage-less environment would otherwise allocate an
         * event nobody reads.
         *
         * `bytes` is attached only when there was an encoded value to size.
         * Removals carry none, and schema or codec failures never got far
         * enough to produce one.
         */
        const emitStorageError = (key: string, raw: string | null, failure: PersistFailure): void => {
            if (!onStorageErrorRef.current) return;
            reportStorageError(store, {
                key,
                operation: raw === null ? "remove" : "set",
                reason: failure.reason,
                error: failure.error,
                ...(raw === null ? {} : { bytes: approximateStoredBytes(raw) }),
            });
        };
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
            // A read that fails caches null, same as an absent key: the caller
            // gets defaultValue either way, and the access callbacks have
            // already reported the failure.
            const { raw } = readStorageRaw(st, fullKey(key), storageAccessCallbacks);
            cache.set(key, raw);
            return raw;
        };

        /**
         * Logs a QuotaExceededError once, squelching repeats until the next
         * successful write resets the flag.
         */
        const logQuotaError = (key: string, err: unknown): void => {
            if (!quotaErrorLogged && err instanceof DOMException && err.name === "QuotaExceededError") {
                console.error(
                    `[Mnemonic] Storage quota exceeded writing key "${key}". ` +
                        "Data is cached in memory but will not persist. " +
                        "Call flush() after freeing space to retry.",
                );
                quotaErrorLogged = true;
            }
        };

        /**
         * Reports whether storage already holds what a failed mutation intended.
         *
         * A backend can reject a write that would not have changed anything:
         * the cross-tab handler echoing a value another tab already stored, or
         * a reset to the value on disk. A thrown quota error says the write was
         * refused, not that the cache and storage disagree. Reading back keeps
         * the queue a record of observed divergence instead of thrown
         * exceptions, so a durable key is never reported as unsaved.
         *
         * Deliberately bypasses the shared access callbacks: this is a
         * diagnostic read on an already-failed path and must not reset the
         * error-logging squelches.
         */
        const storageAlreadyHolds = (key: string, raw: string | null): boolean => {
            if (!st) return false;
            try {
                const current = st.getItem(fullKey(key));
                if (isPromiseLike(current)) return false;
                return current === raw;
            } catch {
                return false;
            }
        };

        /**
         * Applies the storage half of a mutation and reports whether the value
         * ended up in storage.
         *
         * @param key - Unprefixed key being mutated
         * @param raw - Raw value to store, or null to remove the key
         * @returns `landed` when storage holds the intended value afterwards,
         *   otherwise the classified reason the value stayed in memory only
         */
        const persistToStorage = (key: string, raw: string | null): PersistResult => {
            // No backend at all is an access failure with nothing thrown: the
            // write is just as dropped as one a backend refused.
            if (!st) return { landed: false, failure: { reason: "access", error: undefined } };
            // Writes stay disabled for the rest of this provider's life once a
            // backend has broken the synchronous contract.
            if (asyncContractViolationDetected) {
                return { landed: false, failure: { reason: "contract", error: undefined } };
            }

            const isRemoval = raw === null;
            try {
                const result = isRemoval ? st.removeItem(fullKey(key)) : st.setItem(fullKey(key), raw);
                if (isPromiseLike(result)) {
                    handleAsyncStorageContractViolation(isRemoval ? "removeItem" : "setItem", result);
                    return { landed: false, failure: { reason: "contract", error: undefined } };
                }
                if (!isRemoval) {
                    quotaErrorLogged = false;
                }
                accessErrorLogged = false;
                return PERSIST_LANDED;
            } catch (err) {
                if (!isRemoval) {
                    logQuotaError(key, err);
                }
                logAccessError(err);
                // A refused write that storage already satisfies is durable
                // after all, so it is neither queued nor reported as dropped.
                if (storageAlreadyHolds(key, raw)) return PERSIST_LANDED;
                return { landed: false, failure: { reason: classifyStorageThrow(err), error: err } };
            }
        };

        /**
         * Records whether the cached value for a key is known to be in storage.
         *
         * A mutation that never reached the backend stays queued here so
         * {@link unpersistedKeys} can report it and {@link flush} can retry it.
         */
        const recordPersistence = (key: string, raw: string | null, landed: boolean): void => {
            if (landed) {
                pendingWrites.delete(key);
                return;
            }
            pendingWrites.set(key, raw);
        };

        /**
         * Drops any pending mutation for a key that storage has just won back.
         *
         * Called when an external change reloads the key, at which point the
         * cache mirrors storage again and retrying the old value would
         * resurrect state the provider no longer serves.
         */
        const forgetPendingWrite = (key: string): void => {
            pendingWrites.delete(key);
        };

        /**
         * Writes a raw string value to both cache and storage.
         * Notifies listeners after the write completes.
         *
         * The cache is updated even when the backend rejects the write, so the
         * key is queued as unpersisted rather than silently reported as saved.
         *
         * @param key - Unprefixed key to write
         * @param raw - Raw string value to store
         */
        const writeRaw = (key: string, raw: string) => {
            cache.set(key, raw);
            const result = persistToStorage(key, raw);
            recordPersistence(key, raw, result.landed);
            emit(key);
            bumpDevToolsVersion(devToolsRoot, namespace, `set:${key}`);
            // Reported last so a handler that reads or writes the store sees a
            // fully applied mutation.
            if (!result.landed) emitStorageError(key, raw, result.failure);
        };

        /**
         * Removes a key from both cache and storage.
         * Notifies listeners after the removal completes.
         *
         * A removal that the backend rejects is queued the same way a rejected
         * write is, so the stale stored value can be cleared by a later flush.
         *
         * @param key - Unprefixed key to remove
         */
        const removeRaw = (key: string) => {
            cache.set(key, null);
            const result = persistToStorage(key, null);
            recordPersistence(key, null, result.landed);
            emit(key);
            bumpDevToolsVersion(devToolsRoot, namespace, `remove:${key}`);
            if (!result.landed) emitStorageError(key, null, result.failure);
        };

        /**
         * Lists keys whose cached value is not known to be in storage.
         *
         * @returns Unprefixed keys in the order they entered the queue. A key
         *   already queued keeps its position when a later mutation to it also
         *   fails, so this is not the order values were last written.
         */
        const unpersistedKeys = (): string[] => Array.from(pendingWrites.keys());

        /**
         * Re-attempts queued mutations that never reached storage.
         *
         * @param keysToFlush - Unprefixed keys to retry. Defaults to every
         *   unpersisted key. Keys with nothing queued are ignored.
         * @returns Which keys reached storage and which are still pending
         */
        const flush = (keysToFlush?: readonly string[]): MnemonicFlushResult => {
            const targets =
                keysToFlush === undefined ? Array.from(pendingWrites.keys()) : Array.from(new Set(keysToFlush));
            const persisted: string[] = [];
            const failed: string[] = [];

            for (const key of targets) {
                if (!pendingWrites.has(key)) continue;
                const raw = pendingWrites.get(key) ?? null;
                const result = persistToStorage(key, raw);
                if (!result.landed) {
                    failed.push(key);
                    // A retry that fails is another dropped write. The caller
                    // also sees it in `failed`, but a provider-level handler
                    // should not have to reconcile two channels to learn that
                    // a key is still not saved.
                    emitStorageError(key, raw, result.failure);
                    continue;
                }

                pendingWrites.delete(key);
                persisted.push(key);

                // A pending write can outlive its cache entry when an external
                // reload evicts an unsubscribed key. Re-seat the cache so reads
                // agree with what was just written.
                const cached = cache.has(key) ? (cache.get(key) ?? null) : undefined;
                if (cached !== raw) {
                    cache.set(key, raw);
                    emit(key);
                }
            }

            if (persisted.length > 0) {
                bumpDevToolsVersion(devToolsRoot, namespace, "flush");
            }

            return { persisted, failed };
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
            onCacheSyncedFromStorage: forgetPendingWrite,
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
            unpersistedKeys,
            flush,
            reloadFromStorage,
            schemaMode,
            ssrHydration,
            crossTabSyncMode,
            ...(schemaRegistry ? { schemaRegistry } : {}),
        };

        // Registered unconditionally rather than only when a handler exists:
        // `onStorageError` can arrive on a later render, and the store outlives
        // any single value of that prop. The reporter reads the ref each time,
        // so a handler added after mount still receives reports.
        registerStorageErrorReporter(store, (event) => onStorageErrorRef.current?.(event));

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
    }, [namespace, storage, enableDevTools, schemaMode, schemaRegistry, ssr?.hydration, bootstrapRawSeed]);

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
