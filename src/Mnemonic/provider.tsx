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
import type {
    Mnemonic,
    MnemonicProviderOptions,
    StorageLike,
    Listener,
    Unsubscribe,
    SchemaMode,
    SchemaRegistry,
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
    const context = useContext(MnemonicContext);
    if (!context) {
        throw new Error("useMnemonic must be used within a MnemonicProvider");
    }
    return context;
}

/**
 * Props for the MnemonicProvider component.
 *
 * Extends MnemonicProviderOptions with required children prop.
 *
 * @see {@link MnemonicProviderOptions} - Configuration options
 * @see {@link MnemonicProvider} - Provider component
 */
export interface MnemonicProviderProps extends MnemonicProviderOptions {
    /**
     * React children to render within the provider.
     */
    children: ReactNode;
}

/**
 * Helper function to safely access window.localStorage in browser environments.
 *
 * Returns undefined in non-browser environments (SSR) or when localStorage
 * is unavailable (e.g., in private browsing mode with strict settings).
 *
 * @returns localStorage if available, undefined otherwise
 *
 * @internal
 */
function defaultBrowserStorage(): StorageLike | undefined {
    if (typeof window === "undefined") return undefined;
    try {
        return window.localStorage;
    } catch {
        return undefined;
    }
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
}: MnemonicProviderProps) {
    if (schemaMode === "strict" && !schemaRegistry) {
        throw new Error("MnemonicProvider strict mode requires schemaRegistry");
    }
    if (schemaMode === "autoschema" && typeof schemaRegistry?.registerSchema !== "function") {
        throw new Error("MnemonicProvider autoschema mode requires schemaRegistry.registerSchema");
    }

    const store = useMemo<MnemonicInternal>(() => {
        const prefix = `${namespace}.`;
        const browserLocalStorage = defaultBrowserStorage();
        const st = storage ?? browserLocalStorage;
        const ssrHydration = ssr?.hydration ?? "immediate";

        /**
         * In-memory cache of raw string values.
         * Maps unprefixed keys to their raw string values (or null if not present).
         * Provides fast reads without hitting storage on every access.
         */
        const cache = new Map<string, string | null>();

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

        const detectEnumerableStorage = () => {
            if (!st) return false;
            try {
                return typeof st.length === "number" && typeof st.key === "function";
            } catch {
                return false;
            }
        };

        const canEnumerateKeys = detectEnumerableStorage();
        let crossTabSyncMode: NonNullable<Mnemonic["crossTabSyncMode"]> = "none";
        if (browserLocalStorage !== undefined && st === browserLocalStorage) {
            crossTabSyncMode = "browser-storage-event";
        } else if (typeof st?.onExternalChange === "function") {
            crossTabSyncMode = "custom-external-change";
        }

        const isProductionRuntime = () => {
            const env = (globalThis as any)?.process?.env?.NODE_ENV;
            if (typeof env !== "string") {
                return true;
            }
            return env === "production";
        };

        const weakRefConstructor = (): WeakRefConstructorLike | null => {
            const ctor = (globalThis as any)?.WeakRef;
            return typeof ctor === "function" ? (ctor as WeakRefConstructorLike) : null;
        };

        const hasFinalizationRegistry = () => typeof (globalThis as any)?.FinalizationRegistry === "function";

        const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => {
            if (value == null) return false;
            if (typeof value !== "object" && typeof value !== "function") return false;
            return typeof (value as { then?: unknown }).then === "function";
        };

        /**
         * Returns the global Mnemonic DevTools registry root when devtools are enabled.
         * Lazily initializes registry methods and metadata.
         */
        const ensureDevToolsRoot = (): DevToolsRegistryRoot | null => {
            if (!enableDevTools || typeof window === "undefined") return null;

            const weakRefSupported = weakRefConstructor() !== null;
            const finalizationRegistrySupported = hasFinalizationRegistry();
            const globalWindow = window as any;
            const rawExisting = globalWindow.__REACT_MNEMONIC_DEVTOOLS__;
            const root: Record<string, any> = rawExisting && typeof rawExisting === "object" ? rawExisting : {};

            const reserved = new Set(["providers", "resolve", "list", "capabilities", "__meta"]);
            for (const key of Object.keys(root)) {
                if (!reserved.has(key)) {
                    const descriptor = Object.getOwnPropertyDescriptor(root, key);
                    if (!descriptor || descriptor.configurable) {
                        try {
                            delete root[key];
                        } catch {
                            // Ignore hostile legacy properties so devtools init stays fail-safe.
                        }
                    }
                }
            }

            if (!root.providers || typeof root.providers !== "object") {
                root.providers = {};
            }

            if (!root.capabilities || typeof root.capabilities !== "object") {
                root.capabilities = {};
            }
            root.capabilities.weakRef = weakRefSupported;
            root.capabilities.finalizationRegistry = finalizationRegistrySupported;

            if (!root.__meta || typeof root.__meta !== "object") {
                root.__meta = {
                    version: 0,
                    lastUpdated: Date.now(),
                    lastChange: "",
                };
            }
            if (typeof root.__meta.version !== "number" || !Number.isFinite(root.__meta.version)) {
                root.__meta.version = 0;
            }
            if (typeof root.__meta.lastUpdated !== "number" || !Number.isFinite(root.__meta.lastUpdated)) {
                root.__meta.lastUpdated = Date.now();
            }
            if (typeof root.__meta.lastChange !== "string") {
                root.__meta.lastChange = "";
            }

            if (typeof root.resolve !== "function") {
                root.resolve = (ns: string): DevToolsProviderApi | null => {
                    const entry = (root.providers as Record<string, DevToolsProviderEntry>)[ns];
                    if (!entry || !entry.weakRef || typeof entry.weakRef.deref !== "function") return null;

                    const live = entry.weakRef.deref();
                    if (live) {
                        entry.lastSeenAt = Date.now();
                        entry.staleSince = null;
                        return live;
                    }

                    if (entry.staleSince === null) {
                        entry.staleSince = Date.now();
                    }
                    return null;
                };
            }

            if (typeof root.list !== "function") {
                root.list = (): DevToolsProviderDescriptor[] => {
                    const entries = root.providers as Record<string, DevToolsProviderEntry>;
                    const out: DevToolsProviderDescriptor[] = [];
                    for (const [ns, entry] of Object.entries(entries)) {
                        const live =
                            entry && entry.weakRef && typeof entry.weakRef.deref === "function"
                                ? entry.weakRef.deref()
                                : undefined;
                        const available = Boolean(live);
                        if (available) {
                            entry.lastSeenAt = Date.now();
                            entry.staleSince = null;
                        } else if (entry.staleSince === null) {
                            entry.staleSince = Date.now();
                        }
                        out.push({
                            namespace: ns,
                            available,
                            registeredAt: entry.registeredAt,
                            lastSeenAt: entry.lastSeenAt,
                            staleSince: entry.staleSince,
                        });
                    }
                    out.sort((a, b) => a.namespace.localeCompare(b.namespace));
                    return out;
                };
            }

            globalWindow.__REACT_MNEMONIC_DEVTOOLS__ = root;
            return root as DevToolsRegistryRoot;
        };

        /**
         * Bumps the global devtools registry revision counter.
         * Consumers can poll this for lightweight change detection.
         */
        const bumpDevToolsVersion = (reason: string) => {
            const root = ensureDevToolsRoot();
            if (!root) return;

            root.__meta.version += 1;
            root.__meta.lastUpdated = Date.now();
            root.__meta.lastChange = `${namespace}.${reason}`;
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
            try {
                const raw = st.getItem(fullKey(key));
                if (isPromiseLike(raw)) {
                    handleAsyncStorageContractViolation("getItem", raw);
                    cache.set(key, null);
                    return null;
                }
                cache.set(key, raw);
                accessErrorLogged = false;
                return raw;
            } catch (err) {
                logAccessError(err);
                cache.set(key, null);
                return null;
            }
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
            bumpDevToolsVersion(`set:${key}`);
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
            bumpDevToolsVersion(`remove:${key}`);
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
            if (!canEnumerateKeys || !st) return [];
            const out: string[] = [];
            try {
                const storageLength = st.length;
                const getStorageKey = st.key;
                if (typeof storageLength !== "number" || typeof getStorageKey !== "function") return [];
                for (let i = 0; i < storageLength; i++) {
                    const k = getStorageKey.call(st, i);
                    if (!k) continue;
                    if (k.startsWith(prefix)) out.push(k.slice(prefix.length));
                }
                accessErrorLogged = false;
            } catch (err) {
                logAccessError(err);
            }
            return out;
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
        const reloadFromStorage = (changedKeys?: string[]) => {
            if (!st || asyncContractViolationDetected) return;
            let changed = false;

            // Empty array → explicit no-op
            if (changedKeys !== undefined && changedKeys.length === 0) return;

            if (changedKeys !== undefined) {
                // Granular path: only reload the specified keys
                for (const fk of changedKeys) {
                    // Skip keys outside our namespace
                    if (!fk.startsWith(prefix)) continue;
                    const key = fk.slice(prefix.length);

                    const listenerSet = listeners.get(key);
                    if (listenerSet && listenerSet.size > 0) {
                        // Subscribed: re-read and diff
                        let fresh: string | null;
                        try {
                            const raw = st.getItem(fk);
                            if (isPromiseLike(raw)) {
                                handleAsyncStorageContractViolation("getItem", raw);
                                fresh = null;
                            } else {
                                fresh = raw;
                                accessErrorLogged = false;
                            }
                        } catch (err) {
                            logAccessError(err);
                            fresh = null;
                        }
                        const cached = cache.get(key) ?? null;
                        if (fresh !== cached) {
                            cache.set(key, fresh);
                            emit(key);
                            changed = true;
                        }
                    } else if (cache.has(key)) {
                        // Cached but not subscribed: evict so next read is fresh
                        cache.delete(key);
                    }
                }
                if (changed) {
                    bumpDevToolsVersion("reload:granular");
                }
                return;
            }

            // Blanket path: re-read all subscribed keys
            for (const [key, listenerSet] of listeners) {
                if (listenerSet.size === 0) continue;
                let fresh: string | null;
                try {
                    const raw = st.getItem(fullKey(key));
                    if (isPromiseLike(raw)) {
                        handleAsyncStorageContractViolation("getItem", raw);
                        fresh = null;
                    } else {
                        fresh = raw;
                        accessErrorLogged = false;
                    }
                } catch (err) {
                    logAccessError(err);
                    fresh = null;
                }
                const cached = cache.get(key) ?? null;
                if (fresh !== cached) {
                    cache.set(key, fresh);
                    emit(key);
                    changed = true;
                }
            }

            // Evict unsubscribed cache entries so next readThrough re-reads
            for (const key of cache.keys()) {
                if (!listeners.has(key) || listeners.get(key)!.size === 0) {
                    cache.delete(key);
                }
            }

            if (changed) {
                bumpDevToolsVersion("reload:full");
            }
        };

        /**
         * The Mnemonic store API object.
         * Implements the contract expected by useSyncExternalStore.
         */
        const store = {
            prefix,
            canEnumerateKeys,
            subscribeRaw,
            getRawSnapshot,
            setRaw: writeRaw,
            removeRaw,
            keys,
            dump,
            reloadFromStorage,
            schemaMode: schemaMode as SchemaMode,
            ssrHydration,
            crossTabSyncMode,
            ...(schemaRegistry ? { schemaRegistry: schemaRegistry as SchemaRegistry } : {}),
        };

        /**
         * DevTools integration.
         * Exposes a weak-provider registry on the window object when enabled.
         */
        if (enableDevTools && typeof window !== "undefined") {
            const root = ensureDevToolsRoot();
            let infoMessage = `[Mnemonic DevTools] Namespace "${namespace}" available via window.__REACT_MNEMONIC_DEVTOOLS__.resolve("${namespace}")`;
            if (root) {
                if (!root.capabilities.weakRef) {
                    infoMessage = `[Mnemonic DevTools] WeakRef is not available; registry provider "${namespace}" was not registered.`;
                } else {
                    const existingLive = root.resolve(namespace);
                    if (existingLive) {
                        const duplicateMessage = `[Mnemonic DevTools] Duplicate provider namespace "${namespace}" detected. Each window must have at most one live MnemonicProvider per namespace.`;
                        if (!isProductionRuntime()) {
                            throw new Error(duplicateMessage);
                        }
                        console.warn(`${duplicateMessage} Keeping the first provider and ignoring the duplicate.`);
                        infoMessage = `[Mnemonic DevTools] Namespace "${namespace}" already registered. Keeping existing provider reference.`;
                    } else {
                        const providerApi: DevToolsProviderApi = {
                            /** Access the underlying store instance */
                            getStore: () => store,

                            /** Dump all key-value pairs and display as a console table */
                            dump: () => {
                                const data = dump();
                                console.table(
                                    Object.entries(data).map(([key, value]) => ({
                                        key,
                                        value,
                                        decoded: (() => {
                                            try {
                                                return JSON.parse(value);
                                            } catch {
                                                return value;
                                            }
                                        })(),
                                    })),
                                );
                                return data;
                            },

                            /** Get a decoded value by key */
                            get: (key: string) => {
                                const raw = readThrough(key);
                                if (raw == null) return undefined;
                                try {
                                    return JSON.parse(raw);
                                } catch {
                                    return raw;
                                }
                            },

                            /** Set a value by key (automatically JSON-encoded) */
                            set: (key: string, value: any) => {
                                writeRaw(key, JSON.stringify(value));
                            },

                            /** Remove a key from storage */
                            remove: (key: string) => removeRaw(key),

                            /** Clear all keys in this namespace */
                            clear: () => {
                                for (const k of keys()) {
                                    removeRaw(k);
                                }
                            },

                            /** List all keys in this namespace */
                            keys,
                        };

                        const WeakRefCtor = weakRefConstructor();
                        if (!WeakRefCtor) {
                            infoMessage = `[Mnemonic DevTools] WeakRef became unavailable while registering "${namespace}".`;
                        } else {
                            // Keep a strong reference for the mounted provider lifetime.
                            // The global registry still only exposes a WeakRef, but this
                            // prevents premature collection while the provider is active.
                            (store as MnemonicInternalWithDevToolsHold).__devToolsProviderApiHold = providerApi;

                            root.providers[namespace] = {
                                namespace,
                                weakRef: new WeakRefCtor(providerApi),
                                registeredAt: Date.now(),
                                lastSeenAt: Date.now(),
                                staleSince: null,
                            };
                            bumpDevToolsVersion("registry:namespace-registered");
                            infoMessage = `[Mnemonic DevTools] Namespace "${namespace}" available via window.__REACT_MNEMONIC_DEVTOOLS__.resolve("${namespace}")`;
                        }
                    }
                }
            }
            console.info(infoMessage);
        }

        return store;
    }, [namespace, storage, enableDevTools, schemaMode, schemaRegistry, ssr?.hydration]);

    // Subscribe to external storage changes (e.g., cross-tab BroadcastChannel)
    useEffect(() => {
        if (!storage?.onExternalChange) return;
        return storage.onExternalChange((changedKeys) => store.reloadFromStorage(changedKeys));
    }, [storage, store]);

    return <MnemonicContext.Provider value={store}>{children}</MnemonicContext.Provider>;
}
