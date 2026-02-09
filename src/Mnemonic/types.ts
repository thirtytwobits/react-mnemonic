// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * @fileoverview Type definitions for the Mnemonic library.
 *
 * This module defines the core types and interfaces used throughout the Mnemonic
 * library for type-safe, persistent state management in React applications.
 */

import type { CodecError, ValidationError } from "./codecs";
import type { SchemaError } from "./schema";

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
    namespace: string;

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
    storage?: StorageLike;

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

    /**
     * Versioning and schema enforcement mode.
     *
     * Controls whether stored values require a registered schema, and how
     * missing schemas are handled. See {@link SchemaMode} for the behaviour
     * of each mode.
     *
     * @default "default"
     *
     * @see {@link SchemaMode} - Detailed description of each mode
     * @see {@link SchemaRegistry} - Registry supplied via `schemaRegistry`
     */
    schemaMode?: SchemaMode;

    /**
     * Schema registry used for version lookup and migration resolution.
     *
     * When provided, the library uses the registry to find the correct
     * codec and validator for each stored version, and to resolve
     * migration paths when upgrading old data to the latest schema.
     *
     * Required when `schemaMode` is `"strict"` or `"autoschema"`.
     * Optional (but recommended) in `"default"` mode.
     *
     * @see {@link SchemaRegistry} - Interface the registry must implement
     * @see {@link KeySchema} - Schema definition stored in the registry
     */
    schemaRegistry?: SchemaRegistry;
}

/**
 * Controls how the provider enforces versioned schemas on stored values.
 *
 * - `"default"` — Schemas are optional. When a schema exists for the stored
 *   version it is used for decoding; otherwise the hook's `codec` option is
 *   used directly. This is the recommended starting mode.
 *
 * - `"strict"` — Every read and write **must** have a registered schema for
 *   the stored version. If no matching schema is found the value falls back
 *   to `defaultValue` with a `SchemaError` (`SCHEMA_NOT_FOUND` on reads,
 *   `WRITE_SCHEMA_REQUIRED` on writes).
 *
 * - `"autoschema"` — Like `"default"`, but when a key has **no** schema
 *   registered at all, the library infers a schema at version 1 from the
 *   first successfully decoded value and registers it via
 *   `SchemaRegistry.registerSchema`. Subsequent reads/writes for that key
 *   then behave as if the schema had been registered manually.
 *
 * @default "default"
 *
 * @see {@link SchemaRegistry} - Registry that stores schemas and migrations
 * @see {@link KeySchema} - Individual schema definition
 */
export type SchemaMode = "strict" | "default" | "autoschema";

/**
 * Schema definition for a single key at a specific version.
 *
 * Each registered schema binds a storage key + version number to a codec
 * and an optional validator. When the provider reads a value whose envelope
 * version matches, it uses the schema's codec and validator instead of the
 * hook-level `codec` and `validate` options.
 *
 * @template T - The TypeScript type of the decoded value at this version
 *
 * @example
 * ```typescript
 * const userSchemaV1: KeySchema<{ name: string }> = {
 *   key: "user",
 *   version: 1,
 *   codec: JSONCodec,
 *   validate: (v): v is { name: string } =>
 *     typeof v === "object" && v !== null && typeof (v as any).name === "string",
 * };
 * ```
 *
 * @see {@link SchemaRegistry} - Where schemas are registered and looked up
 * @see {@link MigrationRule} - How values migrate between schema versions
 */
export type KeySchema<T = unknown> = {
    /**
     * The unprefixed storage key this schema applies to.
     */
    key: string;

    /**
     * The version number for this schema.
     *
     * Must be a non-negative integer. Version `0` is reserved for the
     * default (unversioned) envelope written when no schema is active.
     * User-defined schemas should start at version `1`.
     */
    version: number;

    /**
     * Codec used to encode and decode the payload at this version.
     *
     * This overrides the hook-level `codec` option when the stored
     * envelope's version matches.
     */
    codec: Codec<T>;

    /**
     * Optional type-guard that validates the decoded payload.
     *
     * If provided and the guard returns `false` or throws, the value
     * falls back to `defaultValue` with a `SchemaError` of code
     * `TYPE_MISMATCH`.
     *
     * @param value - The decoded payload to validate
     * @returns `true` if the value is valid
     */
    validate?: (value: unknown) => value is T;
};

/**
 * A single migration step that transforms data from one schema version to
 * the next.
 *
 * Migration rules are composed into a {@link MigrationPath} by the
 * {@link SchemaRegistry} to upgrade stored data across multiple versions in
 * sequence (e.g. v1 → v2 → v3).
 *
 * @example
 * ```typescript
 * const userV1ToV2: MigrationRule = {
 *   key: "user",
 *   fromVersion: 1,
 *   toVersion: 2,
 *   migrate: (v1) => {
 *     const old = v1 as { name: string };
 *     return { firstName: old.name, lastName: "" };
 *   },
 * };
 * ```
 *
 * @see {@link MigrationPath} - Ordered list of rules applied in sequence
 * @see {@link SchemaRegistry.getMigrationPath} - How the path is resolved
 */
export type MigrationRule = {
    /**
     * The unprefixed storage key this rule applies to.
     */
    key: string;

    /**
     * The version the stored data is migrating **from**.
     */
    fromVersion: number;

    /**
     * The version the stored data is migrating **to**.
     *
     * Must be strictly greater than `fromVersion`.
     */
    toVersion: number;

    /**
     * Transformation function that converts data from `fromVersion`
     * to `toVersion`.
     *
     * Receives the decoded value at `fromVersion` and must return
     * the value in the shape expected by `toVersion`.
     *
     * @param value - The decoded value at `fromVersion`
     * @returns The transformed value for `toVersion`
     */
    migrate: (value: unknown) => unknown;
};

/**
 * An ordered sequence of {@link MigrationRule} steps that upgrades stored
 * data from an older schema version to a newer one.
 *
 * The rules are applied in array order. Each step's output becomes the
 * next step's input. After the final step the result is validated against
 * the target schema, re-encoded, and persisted back to storage so the
 * migration only runs once per key.
 *
 * @see {@link MigrationRule} - Individual migration step
 * @see {@link SchemaRegistry.getMigrationPath} - Resolves a path between versions
 */
export type MigrationPath = MigrationRule[];

/**
 * Lookup and registration API for key schemas and migration paths.
 *
 * Implementations of this interface are passed to `MnemonicProvider` via the
 * `schemaRegistry` option. The provider calls these methods at read and write
 * time to resolve the correct codec, validator, and migration chain for each
 * stored value.
 *
 * @example
 * ```typescript
 * const registry: SchemaRegistry = {
 *   getSchema: (key, version) => schemas.get(`${key}@${version}`),
 *   getLatestSchema: (key) => latestByKey.get(key),
 *   getMigrationPath: (key, from, to) => buildPath(key, from, to),
 *   registerSchema: (schema) => { schemas.set(`${schema.key}@${schema.version}`, schema); },
 * };
 *
 * <MnemonicProvider namespace="app" schemaRegistry={registry} schemaMode="strict">
 *   <App />
 * </MnemonicProvider>
 * ```
 *
 * @see {@link KeySchema} - Schema definition
 * @see {@link MigrationPath} - Migration chain returned by `getMigrationPath`
 * @see {@link SchemaMode} - How the provider uses the registry
 */
export interface SchemaRegistry {
    /**
     * Look up the schema registered for a specific key and version.
     *
     * @param key - The unprefixed storage key
     * @param version - The version number to look up
     * @returns The matching schema, or `undefined` if none is registered
     */
    getSchema(key: string, version: number): KeySchema | undefined;

    /**
     * Look up the highest-version schema registered for a key.
     *
     * Used by the write path to determine which version to stamp on new
     * values, and by the read path to detect when a migration is needed.
     *
     * @param key - The unprefixed storage key
     * @returns The latest schema, or `undefined` if none is registered
     */
    getLatestSchema(key: string): KeySchema | undefined;

    /**
     * Resolve an ordered migration path between two versions of a key.
     *
     * Returns `null` when no contiguous path exists. The returned rules
     * are applied in order to transform data from `fromVersion` to
     * `toVersion`.
     *
     * @param key - The unprefixed storage key
     * @param fromVersion - The stored data's current version
     * @param toVersion - The target version to migrate to
     * @returns An ordered array of migration rules, or `null`
     */
    getMigrationPath(key: string, fromVersion: number, toVersion: number): MigrationPath | null;

    /**
     * Register a new schema.
     *
     * Optional. Required when `schemaMode` is `"autoschema"` so the
     * library can persist inferred schemas. Implementations should throw
     * if a schema already exists for the same key + version with a
     * conflicting definition.
     *
     * @param schema - The schema to register
     */
    registerSchema?(schema: KeySchema): void;
}

/**
 * Storage interface compatible with localStorage and custom storage implementations.
 *
 * Defines the minimum contract required for a storage backend. Compatible with
 * browser Storage API (localStorage, sessionStorage) and custom implementations
 * for testing or alternative storage solutions.
 *
 * @remarks
 * **Error handling contract**
 *
 * The library wraps every storage call in a try/catch. Errors are handled as
 * follows:
 *
 * - **`DOMException` with `name === "QuotaExceededError"`** — Logged once via
 *   `console.error` with the prefix `[Mnemonic] Storage quota exceeded`.
 *   Squelched until a write succeeds, then the flag resets.
 *
 * - **Other `DOMException` errors (including `SecurityError`)** — Logged once
 *   via `console.error` with the prefix `[Mnemonic] Storage access error`.
 *   Squelched until any storage operation succeeds, then the flag resets.
 *
 * - **All other error types** — Silently suppressed.
 *
 * Custom `StorageLike` implementations are encouraged to throw `DOMException`
 * for storage access failures so the library can surface diagnostics. Throwing
 * non-`DOMException` errors is safe but results in silent suppression.
 *
 * In all error cases the library falls back to its in-memory cache, so
 * components continue to function when the storage backend is unavailable.
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

    /**
     * Subscribe to notifications when data changes externally.
     *
     * localStorage has built-in cross-tab notification via the browser's
     * native `storage` event (used by the `listenCrossTab` hook option).
     * Non-localStorage backends (IndexedDB, custom stores, etc.) lack this
     * built-in mechanism. Implementing `onExternalChange` allows those
     * adapters to provide equivalent cross-tab synchronization through
     * their own transport (e.g., BroadcastChannel).
     *
     * The callback accepts an optional `changedKeys` parameter:
     * - `callback()` or `callback(undefined)` triggers a blanket reload
     *   of all actively subscribed keys.
     * - `callback(["ns.key1", "ns.key2"])` reloads only the specified
     *   fully-qualified keys, which is more efficient when the adapter
     *   knows exactly which keys changed.
     * - `callback([])` is a no-op.
     *
     * On a blanket reload the provider re-reads all actively subscribed
     * keys from the storage backend and emits change notifications for
     * any whose values differ from the cache.
     *
     * @param callback - Invoked when external data changes
     * @returns An unsubscribe function that removes the callback
     */
    onExternalChange?: (callback: (changedKeys?: string[]) => void) => (() => void);
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

    /**
     * The active schema enforcement mode for this provider.
     *
     * Propagated from the `schemaMode` provider option. Hooks read this
     * to determine how to handle versioned envelopes.
     *
     * @see {@link SchemaMode}
     */
    schemaMode: SchemaMode;

    /**
     * The schema registry for this provider, if one was supplied.
     *
     * Hooks use this to look up schemas, resolve migration paths, and
     * (in autoschema mode) register inferred schemas.
     *
     * @see {@link SchemaRegistry}
     */
    schemaRegistry?: SchemaRegistry;
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
     * Default value to use when no stored value exists, or when decoding/validation fails.
     *
     * Can be a literal value or a factory function that returns the default.
     * Factory functions receive an optional error argument describing why the
     * fallback is being used:
     *
     * - `undefined` — Nominal path: no value exists in storage for this key.
     * - `CodecError` — The stored value could not be decoded by the codec.
     * - `ValidationError` — The decoded value failed the `validate` check.
     * - `SchemaError` — A schema or migration issue occurred (e.g. missing
     *   schema, failed migration, invalid envelope).
     *
     * Static (non-function) default values ignore the error entirely.
     *
     * @remarks
     * If a factory function is defined inline, it creates a new reference on
     * every render, which forces internal memoization to recompute. For best
     * performance, define the factory at module level or wrap it in `useCallback`:
     *
     * ```typescript
     * // Module-level (stable reference, preferred)
     * const getDefault = (error?: CodecError | ValidationError) => {
     *     if (error) console.warn('Fallback:', error.message);
     *     return { count: 0 };
     * };
     *
     * // Or with useCallback inside a component
     * const getDefault = useCallback(
     *     (error?: CodecError | ValidationError) => ({ count: 0 }),
     *     [],
     * );
     * ```
     *
     * @example
     * ```typescript
     * // Static default
     * defaultValue: { count: 0 }
     *
     * // Factory with no error handling (works the same as before)
     * defaultValue: () => ({ timestamp: Date.now() })
     *
     * // Error-aware factory
     * defaultValue: (error) => {
     *     if (error instanceof CodecError) {
     *         console.error('Corrupt data:', error.message);
     *     }
     *     if (error instanceof ValidationError) {
     *         console.warn('Invalid data:', error.message);
     *     }
     *     return { count: 0 };
     * }
     * ```
     */
    defaultValue: T | ((error?: CodecError | ValidationError | SchemaError) => T);

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
     * it's returned to the component. If validation fails (returns `false`
     * or throws), the default value is used instead.
     *
     * There are two ways to signal a validation failure:
     *
     * 1. **Return `false`** — The library synthesizes a `ValidationError`
     *    with a generic message and passes it to the `defaultValue` factory.
     *
     * 2. **Throw a `ValidationError`** — Provides richer error details
     *    (custom message, cause). The thrown error is passed directly to the
     *    `defaultValue` factory.
     *
     * If validate throws a non-`ValidationError`, the library wraps it in a
     * `ValidationError` with the original error as `cause`.
     *
     * @param value - The value decoded from storage
     * @returns True if the value is valid and has type T
     *
     * @example
     * ```typescript
     * // Simple boolean validation (return false for invalid)
     * validate: (val): val is UserProfile => {
     *   return (
     *     typeof val === 'object' &&
     *     val !== null &&
     *     typeof val.id === 'string' &&
     *     typeof val.name === 'string'
     *   );
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Rich validation with thrown ValidationError
     * validate: (val): val is UserProfile => {
     *   if (typeof val !== 'object' || val === null) {
     *     throw new ValidationError('Expected an object');
     *   }
     *   if (typeof (val as any).name !== 'string') {
     *     throw new ValidationError('Missing or invalid "name" field');
     *   }
     *   return true;
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

    /**
     * Optional schema controls for this key.
     *
     * Allows overriding the version written by the `set` function. When
     * omitted, the library writes using the latest registered schema for
     * this key (or version `0` when no schema exists).
     *
     * @example
     * ```typescript
     * // Pin writes to schema version 2 even if version 3 exists
     * const { value, set } = useMnemonicKey("user", {
     *   defaultValue: { name: "" },
     *   schema: { version: 2 },
     * });
     * ```
     */
    schema?: {
        /**
         * Explicit schema version to use when writing values.
         *
         * When set, the `set` and `reset` functions encode using the
         * schema registered at this version instead of the latest. Useful
         * during gradual rollouts where not all consumers have been
         * updated yet.
         *
         * Must reference a version that exists in the `SchemaRegistry`.
         * If not found the write falls back to the latest schema (default
         * mode) or fails with a `SchemaError` (strict mode).
         */
        version?: number;
    };
};
