// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * @fileoverview Type definitions for the Mnemonic library.
 *
 * This module defines the core types and interfaces used throughout the Mnemonic
 * library for type-safe, persistent state management in React applications.
 */

/**
 * Codec for encoding and decoding values to and from storage.
 *
 * Codecs provide bidirectional transformations between typed values and their
 * string representations suitable for storage in localStorage or similar backends.
 *
 * @template T - The TypeScript type of the value to encode/decode
 *
 * @example
 * ```typescript
 * const DateCodec: Codec<Date> = {
 *   encode: (date) => date.toISOString(),
 *   decode: (str) => new Date(str)
 * };
 * ```
 *
 * @see {@link JSONCodec} - Default codec for JSON-serializable values
 * @see {@link StringCodec} - Codec for plain strings
 * @see {@link NumberCodec} - Codec for numeric values
 * @see {@link BooleanCodec} - Codec for boolean values
 * @see {@link createCodec} - Helper function to create custom codecs
 */
export interface Codec<T> {
    /**
     * Transforms a typed value into a string suitable for storage.
     *
     * @param value - The typed value to encode
     * @returns A string representation of the value
     * @throws {CodecError} If the value cannot be encoded
     */
    encode: (value: T) => string;

    /**
     * Transforms a stored string back into a typed value.
     *
     * @param encoded - The string representation from storage
     * @returns The decoded typed value
     * @throws {CodecError} If the string cannot be decoded
     */
    decode: (encoded: string) => T;
}

/**
 * Configuration options for MnemonicProvider.
 *
 * These options configure the behavior of the storage provider, including
 * namespace isolation, storage backend selection, cross-tab synchronization,
 * and developer tools integration.
 *
 * @example
 * ```tsx
 * <MnemonicProvider
 *   namespace="myApp"
 *   storage={localStorage}
 *   enableSync={true}
 *   enableDevTools={process.env.NODE_ENV === 'development'}
 * >
 *   <App />
 * </MnemonicProvider>
 * ```
 */
export interface MnemonicProviderOptions {
    /**
     * Namespace prefix for all storage keys.
     *
     * All keys stored by this provider will be prefixed with `${namespace}.`
     * to avoid collisions between different parts of your application or
     * different applications sharing the same storage backend.
     *
     * @example
     * ```typescript
     * // With namespace="myApp", a key "user" becomes "myApp.user" in storage
     * namespace: "myApp"
     * ```
     */
    namespace?: string;

    /**
     * Storage backend to use for persistence.
     *
     * Defaults to `window.localStorage` in browser environments. You can provide
     * a custom implementation (e.g., sessionStorage, AsyncStorage, or a mock for testing).
     *
     * @default window.localStorage
     *
     * @example
     * ```typescript
     * // Use sessionStorage instead of localStorage
     * storage: window.sessionStorage
     *
     * // Use a custom storage implementation
     * storage: {
     *   getItem: (key) => myCustomStore.get(key),
     *   setItem: (key, value) => myCustomStore.set(key, value),
     *   removeItem: (key) => myCustomStore.delete(key)
     * }
     * ```
     */
    storage?: Storage;

    /**
     * Enable cross-tab synchronization via storage events.
     *
     * When enabled, changes made in one browser tab will automatically
     * propagate to other tabs with the same origin. This uses the browser's
     * `storage` event for localStorage changes.
     *
     * @default true
     *
     * @remarks
     * Only applicable when using localStorage. SessionStorage does not
     * support cross-tab communication.
     */
    enableSync?: boolean;

    /**
     * Enable DevTools debugging interface.
     *
     * When enabled, exposes the store on `window.__REACT_MNEMONIC_DEVTOOLS__[namespace]`
     * with methods to inspect, modify, and dump storage state from the console.
     *
     * @default false
     *
     * @example
     * ```typescript
     * // Enable in development only
     * enableDevTools: process.env.NODE_ENV === 'development'
     *
     * // Then in browser console:
     * window.__REACT_MNEMONIC_DEVTOOLS__.myApp.dump()
     * window.__REACT_MNEMONIC_DEVTOOLS__.myApp.get('user')
     * window.__REACT_MNEMONIC_DEVTOOLS__.myApp.set('user', { name: 'Test' })
     * ```
     */
    enableDevTools?: boolean;
}

/**
 * Storage interface compatible with localStorage and custom storage implementations.
 *
 * Defines the minimum contract required for a storage backend. Compatible with
 * browser Storage API (localStorage, sessionStorage) and custom implementations
 * for testing or alternative storage solutions.
 *
 * @example
 * ```typescript
 * // In-memory storage for testing
 * const mockStorage: StorageLike = {
 *   items: new Map<string, string>(),
 *   getItem(key) { return this.items.get(key) ?? null; },
 *   setItem(key, value) { this.items.set(key, value); },
 *   removeItem(key) { this.items.delete(key); },
 *   get length() { return this.items.size; },
 *   key(index) {
 *     return Array.from(this.items.keys())[index] ?? null;
 *   }
 * };
 * ```
 */
export type StorageLike = {
    /**
     * Retrieves the value associated with a key.
     *
     * @param key - The storage key to retrieve
     * @returns The stored value as a string, or null if not found
     */
    getItem(key: string): string | null;

    /**
     * Stores a key-value pair.
     *
     * @param key - The storage key
     * @param value - The string value to store
     */
    setItem(key: string, value: string): void;

    /**
     * Removes a key-value pair from storage.
     *
     * @param key - The storage key to remove
     */
    removeItem(key: string): void;

    /**
     * Returns the key at the specified index in storage.
     *
     * Optional method for enumeration support.
     *
     * @param index - The numeric index
     * @returns The key at the given index, or null if out of bounds
     */
    key?(index: number): string | null;

    /**
     * The number of items currently stored.
     *
     * Optional property for enumeration support.
     */
    readonly length?: number;
};

/**
 * Function type for unsubscribing from event listeners.
 *
 * Call this function to remove a subscription and stop receiving updates.
 *
 * @example
 * ```typescript
 * const unsubscribe = store.subscribeRaw('user', () => console.log('Updated!'));
 * // Later...
 * unsubscribe(); // Stop listening
 * ```
 */
export type Unsubscribe = () => void;

/**
 * Callback function invoked when a subscribed value changes.
 *
 * Used by the external store contract to notify React when state updates.
 */
export type Listener = () => void;

/**
 * Internal Mnemonic store API provided via React Context.
 *
 * This is the low-level storage interface that powers the MnemonicProvider.
 * Consumer code typically uses `useMnemonicKey` instead of calling these
 * methods directly.
 *
 * All keys passed to these methods should be **unprefixed**. The store
 * automatically applies the namespace prefix internally.
 *
 * @remarks
 * This implements the React `useSyncExternalStore` contract for efficient,
 * tearing-free state synchronization.
 *
 * @internal
 */
export type Mnemonic = {
    /**
     * The namespace prefix applied to all keys in storage.
     *
     * Keys are stored as `${prefix}${key}` in the underlying storage backend.
     */
    prefix: string;

    /**
     * Subscribe to changes for a specific key.
     *
     * Follows the React external store subscription contract. The listener
     * will be called whenever the value for this key changes.
     *
     * @param key - The unprefixed storage key to subscribe to
     * @param listener - Callback invoked when the value changes
     * @returns Unsubscribe function to stop listening
     *
     * @example
     * ```typescript
     * const unsubscribe = store.subscribeRaw('user', () => {
     *   console.log('User changed:', store.getRawSnapshot('user'));
     * });
     * ```
     */
    subscribeRaw: (key: string, listener: Listener) => Unsubscribe;

    /**
     * Get the current raw string value for a key.
     *
     * This is part of the external store snapshot contract. Values are
     * cached in memory for stable snapshots.
     *
     * @param key - The unprefixed storage key
     * @returns The raw string value, or null if not present
     */
    getRawSnapshot: (key: string) => string | null;

    /**
     * Write a raw string value to storage.
     *
     * Updates both the in-memory cache and the underlying storage backend,
     * then notifies all subscribers for this key.
     *
     * @param key - The unprefixed storage key
     * @param raw - The raw string value to store
     */
    setRaw: (key: string, raw: string) => void;

    /**
     * Remove a key from storage.
     *
     * Clears the value from both the cache and the underlying storage,
     * then notifies all subscribers.
     *
     * @param key - The unprefixed storage key to remove
     */
    removeRaw: (key: string) => void;

    /**
     * Enumerate all keys in this namespace.
     *
     * Returns unprefixed keys that belong to this store's namespace.
     *
     * @returns Array of unprefixed key names
     */
    keys: () => string[];

    /**
     * Dump all key-value pairs in this namespace.
     *
     * Useful for debugging and DevTools integration.
     *
     * @returns Object mapping unprefixed keys to raw string values
     */
    dump: () => Record<string, string>;
};

/**
 * Configuration options for the useMnemonicKey hook.
 *
 * These options control how a value is persisted, decoded, validated,
 * and synchronized across the application.
 *
 * @template T - The TypeScript type of the stored value
 *
 * @example
 * ```typescript
 * const { value, set } = useMnemonicKey<User>('currentUser', {
 *   defaultValue: { name: 'Guest', id: null },
 *   codec: JSONCodec,
 *   validate: (val): val is User => {
 *     return typeof val === 'object' && 'name' in val && 'id' in val;
 *   },
 *   onMount: (user) => console.log('Loaded user:', user),
 *   onChange: (current, previous) => {
 *     console.log('User changed from', previous, 'to', current);
 *   },
 *   listenCrossTab: true
 * });
 * ```
 */
export type UseMnemonicKeyOptions<T> = {
    /**
     * Default value to use when no stored value exists.
     *
     * Can be a literal value or a factory function that returns the default.
     * The factory function is called each time a default is needed.
     *
     * @example
     * ```typescript
     * // Static default
     * defaultValue: { count: 0 }
     *
     * // Dynamic default with factory function
     * defaultValue: () => ({ timestamp: Date.now() })
     * ```
     */
    defaultValue: T | (() => T);

    /**
     * Codec for encoding and decoding values to/from storage.
     *
     * Determines how the typed value is serialized to a string and
     * deserialized back. Defaults to JSONCodec if not specified.
     *
     * @default JSONCodec
     *
     * @example
     * ```typescript
     * // For plain strings
     * codec: StringCodec
     *
     * // For numbers
     * codec: NumberCodec
     *
     * // For dates
     * codec: createCodec(
     *   (date) => date.toISOString(),
     *   (str) => new Date(str)
     * )
     * ```
     */
    codec?: Codec<T>;

    /**
     * Optional validation function for decoded values.
     *
     * If provided, this type guard validates the decoded value before
     * it's returned to the component. If validation fails, the default
     * value is used instead.
     *
     * This is useful for ensuring runtime type safety when storage
     * might contain stale or corrupted data.
     *
     * @param value - The value decoded from storage
     * @returns True if the value is valid and has type T
     *
     * @example
     * ```typescript
     * validate: (val): val is UserProfile => {
     *   return (
     *     typeof val === 'object' &&
     *     val !== null &&
     *     typeof val.id === 'string' &&
     *     typeof val.name === 'string' &&
     *     typeof val.email === 'string'
     *   );
     * }
     * ```
     */
    validate?: (value: unknown) => value is T;

    /**
     * Callback invoked once when the hook is first mounted.
     *
     * Receives the initial value (either from storage or the default).
     * Useful for triggering side effects based on the loaded state.
     *
     * @param value - The initial value loaded on mount
     *
     * @example
     * ```typescript
     * onMount: (theme) => {
     *   document.body.className = theme;
     *   console.log('Theme loaded:', theme);
     * }
     * ```
     */
    onMount?: (value: T) => void;

    /**
     * Callback invoked whenever the value changes.
     *
     * Receives both the new value and the previous value. This is called
     * for all changes, including those triggered by other components or tabs.
     *
     * @param value - The new current value
     * @param prev - The previous value
     *
     * @example
     * ```typescript
     * onChange: (newTheme, oldTheme) => {
     *   document.body.classList.remove(oldTheme);
     *   document.body.classList.add(newTheme);
     *   console.log(`Theme changed: ${oldTheme} → ${newTheme}`);
     * }
     * ```
     */
    onChange?: (value: T, prev: T) => void;

    /**
     * Enable listening for changes from other browser tabs.
     *
     * When true, uses the browser's `storage` event to detect changes
     * made to localStorage in other tabs and synchronizes them to this component.
     *
     * Only effective when using localStorage as the storage backend.
     *
     * @default false
     *
     * @example
     * ```typescript
     * // Enable cross-tab sync for shared state
     * listenCrossTab: true
     * ```
     *
     * @remarks
     * The `storage` event only fires for changes made in *other* tabs,
     * not the current tab. Changes within the same tab are synchronized
     * automatically via React's state management.
     */
    listenCrossTab?: boolean;
};
