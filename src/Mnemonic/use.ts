// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * @fileoverview React hook for type-safe, persistent state management.
 *
 * This module exports the `useMnemonicKey` hook, which provides a React-friendly
 * API for reading and writing persistent state with automatic synchronization,
 * encoding/decoding, and validation.
 */

import { useSyncExternalStore, useMemo, useEffect, useRef, useCallback } from "react";
import { useMnemonic } from "./provider";
import { JSONCodec, CodecError, ValidationError } from "./codecs";
import { SchemaError, type MnemonicEnvelope } from "./schema";
import type { UseMnemonicKeyOptions, KeySchema, MigrationPath } from "./types";

/**
 * React hook for persistent, type-safe state management.
 *
 * Creates a stateful value that persists to storage and synchronizes across
 * components. Works like `useState` but with persistent storage, automatic
 * encoding/decoding, validation, and optional cross-tab synchronization.
 *
 * Must be used within a `MnemonicProvider`. Uses React's `useSyncExternalStore`
 * internally for efficient, tearing-free state synchronization.
 *
 * @template T - The TypeScript type of the stored value
 *
 * @param key - The storage key (unprefixed, namespace is applied automatically)
 * @param options - Configuration options controlling persistence, encoding, and behavior
 *
 * @returns Object with the current value and methods to update it
 * @returns {T} value - The current decoded value from storage, or the default if not present
 * @returns {function} set - Update the stored value (supports both direct values and updater functions)
 * @returns {function} reset - Reset the value to the default and persist it
 * @returns {function} remove - Remove the key from storage entirely (future reads return default)
 *
 * @example
 * ```tsx
 * // Simple counter with persistence
 * function Counter() {
 *   const { value, set } = useMnemonicKey('count', {
 *     defaultValue: 0,
 *     codec: NumberCodec
 *   });
 *
 *   return (
 *     <div>
 *       <p>Count: {value}</p>
 *       <button onClick={() => set(value + 1)}>Increment</button>
 *       <button onClick={() => set(c => c + 1)}>Increment (updater)</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // User profile with validation and callbacks
 * interface UserProfile {
 *   name: string;
 *   email: string;
 * }
 *
 * function ProfileEditor() {
 *   const { value, set, reset } = useMnemonicKey<UserProfile>('profile', {
 *     defaultValue: { name: '', email: '' },
 *     validate: (val): val is UserProfile => {
 *       return typeof val === 'object' &&
 *              typeof val.name === 'string' &&
 *              typeof val.email === 'string';
 *     },
 *     onMount: (profile) => {
 *       console.log('Loaded profile:', profile);
 *       analytics.track('profile_loaded', profile);
 *     },
 *     onChange: (newProfile, oldProfile) => {
 *       console.log('Profile updated:', { old: oldProfile, new: newProfile });
 *     }
 *   });
 *
 *   return (
 *     <form>
 *       <input
 *         value={value.name}
 *         onChange={e => set({ ...value, name: e.target.value })}
 *       />
 *       <button onClick={() => reset()}>Reset</button>
 *     </form>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Theme switcher with cross-tab sync
 * function ThemeSwitcher() {
 *   const { value, set } = useMnemonicKey<'light' | 'dark'>('theme', {
 *     defaultValue: 'light',
 *     codec: StringCodec,
 *     listenCrossTab: true,
 *     onChange: (theme) => {
 *       document.body.className = theme;
 *     }
 *   });
 *
 *   return (
 *     <button onClick={() => set(value === 'light' ? 'dark' : 'light')}>
 *       Toggle Theme ({value})
 *     </button>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Shopping cart with custom codec
 * interface CartItem {
 *   id: string;
 *   quantity: number;
 * }
 *
 * function ShoppingCart() {
 *   const { value: cart, set, remove } = useMnemonicKey<CartItem[]>('cart', {
 *     defaultValue: [],
 *     codec: JSONCodec
 *   });
 *
 *   const addItem = (item: CartItem) => {
 *     set(currentCart => [...currentCart, item]);
 *   };
 *
 *   const clearCart = () => {
 *     remove(); // Completely remove from storage
 *   };
 *
 *   return (
 *     <div>
 *       <p>Items: {cart.length}</p>
 *       <button onClick={clearCart}>Clear Cart</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @remarks
 * - The hook automatically subscribes to storage changes and re-renders on updates
 * - Encoding/decoding errors are caught and logged; the default value is used as fallback
 * - The `set` function supports both direct values and updater functions like `useState`
 * - When using updater functions, the current value is read fresh to avoid stale closures
 * - Cross-tab synchronization requires `listenCrossTab: true` and only works with localStorage
 * - Server-side rendering returns the default value (no storage access)
 *
 * @see {@link UseMnemonicKeyOptions} - Configuration options
 * @see {@link MnemonicProvider} - Required provider component
 * @see {@link Codec} - Type for custom encoding/decoding strategies
 *
 * @throws {Error} If used outside of a MnemonicProvider
 */
export function useMnemonicKey<T>(key: string, options: UseMnemonicKeyOptions<T>) {
    const api = useMnemonic();

    const { defaultValue, validate, onMount, onChange, listenCrossTab, codec: codecOpt, schema } = options;
    const codec = codecOpt ?? JSONCodec;
    const schemaMode = api.schemaMode;
    const schemaRegistry = api.schemaRegistry;

    /**
     * Helper to get the fallback/default value.
     * Handles both static values and factory functions.
     * Factory functions receive an optional error describing why the fallback
     * is being used (CodecError, ValidationError, or undefined for nominal).
     */
    const getFallback = useCallback(
        (error?: CodecError | ValidationError | SchemaError) =>
            typeof defaultValue === "function"
                ? (defaultValue as (error?: CodecError | ValidationError | SchemaError) => T)(error)
                : defaultValue,
        [defaultValue],
    );

    const inferValidator = useCallback((sample: unknown): ((value: unknown) => boolean) => {
        if (sample === null) return (value) => value === null;
        if (Array.isArray(sample)) return (value) => Array.isArray(value);
        switch (typeof sample) {
            case "string":
                return (value) => typeof value === "string";
            case "number":
                return (value) => typeof value === "number" && Number.isFinite(value);
            case "boolean":
                return (value) => typeof value === "boolean";
            case "undefined":
                return (value) => typeof value === "undefined";
            case "object":
                return (value) => typeof value === "object" && value !== null && !Array.isArray(value);
            default:
                return (_value) => true;
        }
    }, []);

    const parseEnvelope = useCallback(
        (rawText: string): { ok: true; envelope: MnemonicEnvelope } | { ok: false; error: SchemaError } => {
            try {
                const parsed = JSON.parse(rawText) as MnemonicEnvelope;
                if (
                    typeof parsed !== "object" ||
                    parsed == null ||
                    !Number.isInteger(parsed.version) ||
                    parsed.version < 0 ||
                    !Object.prototype.hasOwnProperty.call(parsed, "payload")
                ) {
                    return {
                        ok: false,
                        error: new SchemaError("INVALID_ENVELOPE", `Invalid envelope for key "${key}"`),
                    };
                }
                return { ok: true, envelope: parsed };
            } catch (err) {
                return {
                    ok: false,
                    error: new SchemaError("INVALID_ENVELOPE", `Invalid envelope for key "${key}"`, err),
                };
            }
        },
        [key],
    );

    const decodePayloadWithCodec = useCallback(
        <V,>(payload: unknown, activeCodec: { decode: (encoded: string) => V }) => {
            if (typeof payload !== "string") {
                throw new SchemaError(
                    "INVALID_ENVELOPE",
                    `Envelope payload must be a string for key "${key}"`,
                );
            }
            try {
                return activeCodec.decode(payload);
            } catch (err) {
                throw err instanceof CodecError
                    ? err
                    : new CodecError(`Codec decode failed for key "${key}"`, err);
            }
        },
        [key],
    );

    const validateValue = useCallback(
        (value: unknown, schemaValidate?: ((v: unknown) => boolean)): value is T => {
            if (schemaValidate) {
                let valid: boolean;
                try {
                    valid = schemaValidate(value);
                } catch (err) {
                    throw new SchemaError("TYPE_MISMATCH", `Schema validation threw for key "${key}"`, err);
                }
                if (!valid) {
                    throw new SchemaError("TYPE_MISMATCH", `Schema validation failed for key "${key}"`);
                }
            }
            if (validate) {
                try {
                    if (!validate(value)) {
                        throw new ValidationError(`Validation failed for key "${key}"`);
                    }
                } catch (err) {
                    throw err instanceof ValidationError
                        ? err
                        : new ValidationError(`Validation threw for key "${key}"`, err);
                }
            }
            return true;
        },
        [validate, key],
    );

    const registryCache = useMemo(() => {
        if (!schemaRegistry || schemaMode === "autoschema") return null;
        return {
            latestSchema: undefined as KeySchema | undefined,
            latestSchemaSet: false,
            schemaByVersion: new Map<number, KeySchema | undefined>(),
            migrationPaths: new Map<string, MigrationPath | null>(),
        };
    }, [schemaRegistry, schemaMode, key]);

    const getSchemaForVersion = useCallback(
        (version: number): KeySchema | undefined => {
            if (!schemaRegistry) return undefined;
            if (!registryCache) return schemaRegistry.getSchema(key, version);
            if (registryCache.schemaByVersion.has(version)) {
                return registryCache.schemaByVersion.get(version);
            }
            const schema = schemaRegistry.getSchema(key, version);
            registryCache.schemaByVersion.set(version, schema);
            return schema;
        },
        [schemaRegistry, registryCache, key],
    );

    const getLatestSchemaForKey = useCallback((): KeySchema | undefined => {
        if (!schemaRegistry) return undefined;
        if (!registryCache) return schemaRegistry.getLatestSchema(key);
        if (registryCache.latestSchemaSet) return registryCache.latestSchema;
        const schema = schemaRegistry.getLatestSchema(key);
        registryCache.latestSchema = schema;
        registryCache.latestSchemaSet = true;
        return schema;
    }, [schemaRegistry, registryCache, key]);

    const getMigrationPathForKey = useCallback(
        (fromVersion: number, toVersion: number): MigrationPath | null => {
            if (!schemaRegistry) return null;
            if (!registryCache) return schemaRegistry.getMigrationPath(key, fromVersion, toVersion) ?? null;
            const cacheKey = `${fromVersion}->${toVersion}`;
            if (registryCache.migrationPaths.has(cacheKey)) {
                return registryCache.migrationPaths.get(cacheKey) ?? null;
            }
            const path = schemaRegistry.getMigrationPath(key, fromVersion, toVersion) ?? null;
            registryCache.migrationPaths.set(cacheKey, path);
            return path;
        },
        [schemaRegistry, registryCache, key],
    );

    const isReservedSchema = useCallback((schema?: KeySchema): boolean => {
        return schema?.version === 0;
    }, []);

    const decodeForRead = useCallback(
        (
            rawText: string | null,
        ): { value: T; rewriteRaw?: string; pendingSchema?: KeySchema } => {
            if (rawText == null) return { value: getFallback() };

            const parsed = parseEnvelope(rawText);
            if (!parsed.ok) return { value: getFallback(parsed.error) };
            const envelope = parsed.envelope;

            const schemaForVersion = getSchemaForVersion(envelope.version);
            const latestSchema = getLatestSchemaForKey();

            if (isReservedSchema(schemaForVersion) || isReservedSchema(latestSchema)) {
                return {
                    value: getFallback(
                        new SchemaError(
                            "SCHEMA_VERSION_RESERVED",
                            `Schema registry returned reserved version 0 for key "${key}"`,
                        ),
                    ),
                };
            }

            // Strict mode always requires schema for the stored version.
            if (schemaMode === "strict" && !schemaForVersion) {
                return {
                    value: getFallback(
                        new SchemaError("SCHEMA_NOT_FOUND", `No schema for key "${key}" v${envelope.version}`),
                    ),
                };
            }

            // Autoschema only infers when no schema exists yet for this key.
            if (schemaMode === "autoschema" && !schemaForVersion) {
                if (latestSchema) {
                    return {
                        value: getFallback(
                            new SchemaError("SCHEMA_NOT_FOUND", `No schema for key "${key}" v${envelope.version}`),
                        ),
                    };
                }
                if (!schemaRegistry || typeof schemaRegistry.registerSchema !== "function") {
                    return {
                        value: getFallback(
                            new SchemaError(
                                "MODE_CONFIGURATION_INVALID",
                                `Autoschema mode requires schema registry registration for key "${key}"`,
                            ),
                        ),
                    };
                }
                try {
                    const decoded = decodePayloadWithCodec<T>(envelope.payload, codec);
                    validateValue(decoded);
                    const inferred: KeySchema = {
                        key,
                        version: 1,
                        codec: codec as any,
                        validate: (value: unknown): value is unknown => inferValidator(decoded)(value),
                    };
                    const rewriteEnvelope: MnemonicEnvelope = {
                        version: inferred.version,
                        payload: inferred.codec.encode(decoded as any),
                    };
                    return {
                        value: decoded,
                        pendingSchema: inferred,
                        rewriteRaw: JSON.stringify(rewriteEnvelope),
                    };
                } catch (err) {
                    const typedErr =
                        err instanceof SchemaError || err instanceof ValidationError || err instanceof CodecError
                            ? err
                            : new SchemaError("TYPE_MISMATCH", `Autoschema inference failed for key "${key}"`, err);
                    return { value: getFallback(typedErr) };
                }
            }

            // No schema found: default mode ignores version and uses hook codec.
            if (!schemaForVersion) {
                try {
                    const decoded = decodePayloadWithCodec<T>(envelope.payload, codec);
                    validateValue(decoded);
                    return { value: decoded };
                } catch (err) {
                    const typedErr =
                        err instanceof SchemaError || err instanceof ValidationError || err instanceof CodecError
                            ? err
                            : new CodecError(`Codec decode failed for key "${key}"`, err);
                    return { value: getFallback(typedErr) };
                }
            }

            // Schema exists for stored version.
            let current: unknown;
            try {
                current = decodePayloadWithCodec(envelope.payload, schemaForVersion.codec);
                validateValue(current, schemaForVersion.validate);
            } catch (err) {
                const typedErr =
                    err instanceof SchemaError || err instanceof ValidationError || err instanceof CodecError
                        ? err
                        : new SchemaError("TYPE_MISMATCH", `Schema decode failed for key "${key}"`, err);
                return { value: getFallback(typedErr) };
            }

            // No migration needed.
            if (!latestSchema || envelope.version >= latestSchema.version) {
                return { value: current as T };
            }

            const path = getMigrationPathForKey(envelope.version, latestSchema.version);
            if (!path) {
                return {
                    value: getFallback(
                        new SchemaError(
                            "MIGRATION_PATH_NOT_FOUND",
                            `No migration path for key "${key}" from v${envelope.version} to v${latestSchema.version}`,
                        ),
                    ),
                };
            }

            try {
                let migrated = current;
                for (const step of path) {
                    migrated = step.migrate(migrated);
                }
                validateValue(migrated, latestSchema.validate);
                const payload = latestSchema.codec.encode(migrated as any);
                const rewriteEnvelope: MnemonicEnvelope = {
                    version: latestSchema.version,
                    payload,
                };
                return {
                    value: migrated as T,
                    rewriteRaw: JSON.stringify(rewriteEnvelope),
                };
            } catch (err) {
                const typedErr =
                    err instanceof SchemaError || err instanceof ValidationError || err instanceof CodecError
                        ? err
                        : new SchemaError("MIGRATION_FAILED", `Migration failed for key "${key}"`, err);
                return { value: getFallback(typedErr) };
            }
        },
        [
            codec,
            decodePayloadWithCodec,
            getFallback,
            inferValidator,
            key,
            parseEnvelope,
            schemaMode,
            schemaRegistry,
            getSchemaForVersion,
            getLatestSchemaForKey,
            getMigrationPathForKey,
            isReservedSchema,
            validateValue,
        ],
    );

    const encodeForWrite = useCallback(
        (nextValue: T): string => {
            const explicitVersion = schema?.version;
            if (explicitVersion === 0) {
                throw new SchemaError(
                    "SCHEMA_VERSION_RESERVED",
                    `Schema version 0 is reserved for key "${key}"`,
                );
            }
            const latestSchema = getLatestSchemaForKey();
            const explicitSchema = explicitVersion !== undefined ? getSchemaForVersion(explicitVersion) : undefined;
            if (isReservedSchema(explicitSchema) || isReservedSchema(latestSchema)) {
                throw new SchemaError(
                    "SCHEMA_VERSION_RESERVED",
                    `Schema registry returned reserved version 0 for key "${key}"`,
                );
            }
            let targetSchema = explicitSchema;

            if (!targetSchema) {
                if (explicitVersion !== undefined) {
                    if (schemaMode !== "strict") {
                        targetSchema = latestSchema;
                    }
                } else {
                    targetSchema = latestSchema;
                }
            }

            if (!targetSchema) {
                if (explicitVersion !== undefined && schemaMode === "strict") {
                    throw new SchemaError(
                        "WRITE_SCHEMA_REQUIRED",
                        `Write requires schema for key "${key}" in strict mode`,
                    );
                }
                // No schema specified/registered. Default to version 0 envelope.
                validateValue(nextValue);
                const envelope: MnemonicEnvelope = {
                    version: 0,
                    payload: codec.encode(nextValue),
                };
                return JSON.stringify(envelope);
            }

            validateValue(nextValue, targetSchema.validate);
            const envelope: MnemonicEnvelope = {
                version: targetSchema.version,
                payload: targetSchema.codec.encode(nextValue as any),
            };
            return JSON.stringify(envelope);
        },
        [
            schema?.version,
            key,
            schemaMode,
            codec,
            validateValue,
            getLatestSchemaForKey,
            getSchemaForVersion,
            isReservedSchema,
        ],
    );

    /**
     * Subscribe to raw storage changes using React's useSyncExternalStore.
     * This ensures efficient, tearing-free updates when storage changes.
     */
    const raw = useSyncExternalStore(
        (listener) => api.subscribeRaw(key, listener),
        () => api.getRawSnapshot(key),
        () => null, // SSR snapshot - no storage in server environment
    );

    const decoded = useMemo(() => decodeForRead(raw), [decodeForRead, raw]);
    const value = decoded.value;

    // Persist opportunistic read-time upgrades (migrations, autoschema rewrite).
    useEffect(() => {
        if (decoded.rewriteRaw && decoded.rewriteRaw !== raw) {
            api.setRaw(key, decoded.rewriteRaw);
        }
    }, [api, decoded.rewriteRaw, key, raw]);

    // Register inferred schema for autoschema mode once read succeeds.
    useEffect(() => {
        if (!decoded.pendingSchema || !schemaRegistry?.registerSchema) return;
        if (schemaRegistry.getSchema(decoded.pendingSchema.key, decoded.pendingSchema.version)) return;
        try {
            schemaRegistry.registerSchema(decoded.pendingSchema);
        } catch {
            // Ignore registration races; write/read paths will enforce schema validity.
        }
    }, [decoded.pendingSchema, schemaRegistry]);

    /**
     * Track previous value for onChange callback.
     */
    const prevRef = useRef<T>(value);

    /**
     * Call onMount callback once when the hook first mounts.
     * Receives the initial value loaded from storage.
     */
    const mounted = useRef(false);
    useEffect(() => {
        if (mounted.current) return;
        mounted.current = true;
        onMount?.(value);
        prevRef.current = value;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Call onChange callback whenever the decoded value changes.
     * Provides both the new value and the previous value.
     */
    useEffect(() => {
        const prev = prevRef.current;
        if (Object.is(prev, value)) return;
        prevRef.current = value;
        onChange?.(value, prev);
    }, [value, onChange]);

    /**
     * Optional cross-tab synchronization.
     * Listens for storage events from other tabs and syncs changes
     * into this tab's store cache.
     */
    useEffect(() => {
        if (!listenCrossTab) return;
        if (typeof window === "undefined") return;

        const storageKey = api.prefix + key;

        const handler = (e: StorageEvent) => {
            // localStorage.clear() in another tab emits `key === null`.
            if (e.key === null) {
                api.removeRaw(key);
                return;
            }
            if (e.key !== storageKey) return;
            // Another tab removed the key:
            if (e.newValue == null) {
                api.removeRaw(key);
                return;
            }
            api.setRaw(key, e.newValue);
        };

        window.addEventListener("storage", handler);
        return () => window.removeEventListener("storage", handler);
    }, [listenCrossTab, api, key]);

    /**
     * Update function - supports both direct values and updater functions.
     *
     * @param next - Either a new value, or a function that receives the current value and returns the next value
     *
     * @example
     * ```typescript
     * // Direct value
     * set(42);
     *
     * // Updater function
     * set(count => count + 1);
     * ```
     */
    const set = useMemo(() => {
        return (next: T | ((cur: T) => T)) => {
            const nextVal =
                typeof next === "function"
                    ? (next as (c: T) => T)(decodeForRead(api.getRawSnapshot(key)).value)
                    : next;
            try {
                const encoded = encodeForWrite(nextVal);
                api.setRaw(key, encoded);
            } catch (err) {
                if (err instanceof SchemaError) {
                    console.error(`[Mnemonic] Schema error for key "${key}" (${err.code}):`, err.message);
                    return;
                }
                if (err instanceof CodecError) {
                    console.error(`[Mnemonic] Codec encode error for key "${key}":`, err.message);
                    return;
                }
                console.error(`[Mnemonic] Failed to persist key "${key}":`, err);
            }
        };
        // Note: does not depend on `value` to avoid stale closures
    }, [api, key, decodeForRead, encodeForWrite]);

    /**
     * Reset function - sets the value back to the default and persists it.
     *
     * @example
     * ```typescript
     * reset(); // Restores the defaultValue and writes it to storage
     * ```
     */
    const reset = useMemo(() => {
        return () => {
            const v = getFallback();
            try {
                const encoded = encodeForWrite(v);
                api.setRaw(key, encoded);
            } catch (err) {
                if (err instanceof SchemaError) {
                    console.error(`[Mnemonic] Schema error for key "${key}" (${err.code}):`, err.message);
                    return;
                }
                if (err instanceof CodecError) {
                    console.error(`[Mnemonic] Codec encode error for key "${key}":`, err.message);
                }
                return;
            }
        };
    }, [api, key, getFallback, encodeForWrite]);

    /**
     * Remove function - completely removes the key from storage.
     * Future reads will return the default value.
     *
     * @example
     * ```typescript
     * remove(); // Deletes the key from storage
     * ```
     */
    const remove = useMemo(() => {
        return () => api.removeRaw(key);
    }, [api, key]);

    return useMemo(() => ({ value, set, reset, remove }), [value, set, reset, remove]);
}
