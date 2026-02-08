// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * @fileoverview React Context provider for persistent state management.
 *
 * This module exports the MnemonicProvider component and useMnemonic hook,
 * which together provide a namespace-scoped storage API to child components.
 * The provider creates an in-memory cache with read-through behavior to localStorage
 * (or a custom storage backend) and implements the React external store contract.
 */

import { createContext, useContext, useMemo, useEffect, ReactNode } from "react";
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
    children: React.ReactNode;
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
 * @param props.storage - Optional custom storage backend (defaults to localStorage)
 * @param props.enableDevTools - Enable DevTools debugging interface (defaults to false)
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
 * // With custom storage backend
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
 * window.__REACT_MNEMONIC_DEVTOOLS__.myApp.dump()
 * window.__REACT_MNEMONIC_DEVTOOLS__.myApp.get('user')
 * window.__REACT_MNEMONIC_DEVTOOLS__.myApp.set('theme', 'dark')
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
 * @remarks
 * - Creates a stable store instance that only recreates when namespace, storage, or enableDevTools change
 * - All storage operations are cached in memory for fast reads
 * - Storage failures are handled gracefully (logged but not thrown)
 * - In SSR environments, the provider works but no storage persistence occurs
 * - The store implements React's useSyncExternalStore contract for efficient updates
 *
 * @see {@link useMnemonicKey} - Hook for using persistent state
 * @see {@link MnemonicProviderOptions} - Configuration options
 * @see {@link useMnemonic} - Low-level hook for accessing the store
 */

/** Internal store type with reload capability, not exposed to consumers. */
type MnemonicInternal = Mnemonic & {
    reloadFromStorage: (changedKeys?: string[]) => void;
};

export function MnemonicProvider({
    children,
    namespace,
    storage,
    enableDevTools = false,
}: {
    children: ReactNode;
    namespace: string;
    storage?: StorageLike;
    enableDevTools?: boolean;
}) {
    const store = useMemo<MnemonicInternal>(() => {
        const prefix = `${namespace}.`;
        const st = storage ?? defaultBrowserStorage();

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
         * Read-through cache accessor.
         * Returns cached value if available, otherwise reads from storage and caches.
         *
         * @param key - Unprefixed key to read
         * @returns Raw string value, or null if not present
         */
        const readThrough = (key: string): string | null => {
            if (cache.has(key)) return cache.get(key) ?? null;
            if (!st) {
                cache.set(key, null);
                return null;
            }
            try {
                const raw = st.getItem(fullKey(key));
                cache.set(key, raw);
                return raw;
            } catch {
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
            if (st) {
                try {
                    st.setItem(fullKey(key), raw);
                } catch {
                    // ignore storage failures (quota exceeded, etc.)
                }
            }
            emit(key);
        };

        /**
         * Removes a key from both cache and storage.
         * Notifies listeners after the removal completes.
         *
         * @param key - Unprefixed key to remove
         */
        const removeRaw = (key: string) => {
            cache.set(key, null);
            if (st) {
                try {
                    st.removeItem(fullKey(key));
                } catch {}
            }
            emit(key);
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
            if (!st || typeof st.length !== "number" || typeof st.key !== "function") return [];
            const out: string[] = [];
            try {
                for (let i = 0; i < st.length; i++) {
                    const k = st.key(i);
                    if (!k) continue;
                    if (k.startsWith(prefix)) out.push(k.slice(prefix.length));
                }
            } catch {}
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
            if (!st) return;

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
                            fresh = st.getItem(fk);
                        } catch {
                            fresh = null;
                        }
                        const cached = cache.get(key) ?? null;
                        if (fresh !== cached) {
                            cache.set(key, fresh);
                            emit(key);
                        }
                    } else if (cache.has(key)) {
                        // Cached but not subscribed: evict so next read is fresh
                        cache.delete(key);
                    }
                }
                return;
            }

            // Blanket path: re-read all subscribed keys
            for (const [key, listenerSet] of listeners) {
                if (listenerSet.size === 0) continue;
                let fresh: string | null;
                try {
                    fresh = st.getItem(fullKey(key));
                } catch {
                    fresh = null;
                }
                const cached = cache.get(key) ?? null;
                if (fresh !== cached) {
                    cache.set(key, fresh);
                    emit(key);
                }
            }

            // Evict unsubscribed cache entries so next readThrough re-reads
            for (const key of cache.keys()) {
                if (!listeners.has(key) || listeners.get(key)!.size === 0) {
                    cache.delete(key);
                }
            }
        };

        /**
         * The Mnemonic store API object.
         * Implements the contract expected by useSyncExternalStore.
         */
        const store = {
            prefix,
            subscribeRaw,
            getRawSnapshot,
            setRaw: writeRaw,
            removeRaw,
            keys,
            dump,
            reloadFromStorage,
        };

        /**
         * DevTools integration.
         * Exposes a debugging interface on the window object when enabled.
         */
        if (enableDevTools && typeof window !== "undefined") {
            (window as any).__REACT_MNEMONIC_DEVTOOLS__ = (window as any).__REACT_MNEMONIC_DEVTOOLS__ || {};
            (window as any).__REACT_MNEMONIC_DEVTOOLS__[namespace] = {
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
            console.info(
                `[Mnemonic DevTools] Namespace "${namespace}" available at window.__REACT_MNEMONIC_DEVTOOLS__.${namespace}`,
            );
        }

        return store;
    }, [namespace, storage, enableDevTools]);

    // Subscribe to external storage changes (e.g., cross-tab BroadcastChannel)
    useEffect(() => {
        if (!storage?.onExternalChange) return;
        return storage.onExternalChange((changedKeys) => store.reloadFromStorage(changedKeys));
    }, [storage, store]);

    return <MnemonicContext.Provider value={store}>{children}</MnemonicContext.Provider>;
}
