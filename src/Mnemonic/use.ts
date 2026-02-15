// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * @fileoverview React hook for type-safe, persistent state management.
 *
 * This module exports the `useMnemonicKey` hook, which provides a React-friendly
 * API for reading and writing persistent state with automatic synchronization,
 * encoding/decoding, and JSON Schema validation.
 */

import { useSyncExternalStore, useMemo, useEffect, useRef, useCallback } from "react";
import { useMnemonic } from "./provider";
import { JSONCodec, CodecError } from "./codecs";
import { SchemaError, type MnemonicEnvelope } from "./schema";
import { validateJsonSchema, inferJsonSchema } from "./json-schema";
import type { JsonSchema } from "./json-schema";
import type { UseMnemonicKeyOptions, KeySchema, MigrationPath } from "./types";

/**
 * React hook for persistent, type-safe state management.
 *
 * Creates a stateful value that persists to storage and synchronizes across
 * components. Works like `useState` but with persistent storage, automatic
 * encoding/decoding, JSON Schema validation, and optional cross-tab synchronization.
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
 *
 * @throws {Error} If used outside of a MnemonicProvider
 */
export function useMnemonicKey<T>(key: string, options: UseMnemonicKeyOptions<T>) {
    const api = useMnemonic();

    const { defaultValue, onMount, onChange, listenCrossTab, codec: codecOpt, schema } = options;
    const codec = codecOpt ?? JSONCodec;
    const schemaMode = api.schemaMode;
    const schemaRegistry = api.schemaRegistry;

    /**
     * Helper to get the fallback/default value.
     * Factory functions receive an optional error describing why the fallback is used.
     */
    const getFallback = useCallback(
        (error?: CodecError | SchemaError) =>
            typeof defaultValue === "function"
                ? (defaultValue as (error?: CodecError | SchemaError) => T)(error)
                : defaultValue,
        [defaultValue],
    );

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

    /**
     * Decode a string payload using a codec (for codec-managed / no-schema keys).
     */
    const decodeStringPayload = useCallback(
        <V,>(payload: unknown, activeCodec: { decode: (encoded: string) => V }) => {
            if (typeof payload !== "string") {
                throw new SchemaError(
                    "INVALID_ENVELOPE",
                    `Envelope payload must be a string for codec-managed key "${key}"`,
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

    /**
     * Validate a value against a JSON Schema, throwing SchemaError on failure.
     */
    const validateAgainstSchema = useCallback(
        (value: unknown, jsonSchema: JsonSchema): void => {
            const errors = validateJsonSchema(value, jsonSchema);
            if (errors.length > 0) {
                const message = errors.map((e) => `${e.path || "/"}: ${e.message}`).join("; ");
                throw new SchemaError(
                    "TYPE_MISMATCH",
                    `Schema validation failed for key "${key}": ${message}`,
                );
            }
        },
        [key],
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
            const s = schemaRegistry.getSchema(key, version);
            registryCache.schemaByVersion.set(version, s);
            return s;
        },
        [schemaRegistry, registryCache, key],
    );

    const getLatestSchemaForKey = useCallback((): KeySchema | undefined => {
        if (!schemaRegistry) return undefined;
        if (!registryCache) return schemaRegistry.getLatestSchema(key);
        if (registryCache.latestSchemaSet) return registryCache.latestSchema;
        const s = schemaRegistry.getLatestSchema(key);
        registryCache.latestSchema = s;
        registryCache.latestSchemaSet = true;
        return s;
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
                    // Payload may be a codec string or already a JSON value (seeded data).
                    const decoded = typeof envelope.payload === "string"
                        ? decodeStringPayload<T>(envelope.payload, codec)
                        : envelope.payload as T;
                    const inferredJsonSchema = inferJsonSchema(decoded);
                    const inferred: KeySchema = {
                        key,
                        version: 1,
                        schema: inferredJsonSchema,
                    };
                    // Rewrite as a schema-managed envelope (payload is JSON value directly)
                    const rewriteEnvelope: MnemonicEnvelope = {
                        version: inferred.version,
                        payload: decoded,
                    };
                    return {
                        value: decoded,
                        pendingSchema: inferred,
                        rewriteRaw: JSON.stringify(rewriteEnvelope),
                    };
                } catch (err) {
                    const typedErr =
                        err instanceof SchemaError || err instanceof CodecError
                            ? err
                            : new SchemaError("TYPE_MISMATCH", `Autoschema inference failed for key "${key}"`, err);
                    return { value: getFallback(typedErr) };
                }
            }

            // No schema found: default mode ignores version and uses hook codec.
            if (!schemaForVersion) {
                // If payload is already a non-string JSON value (e.g. seeded data,
                // or previously schema-managed data whose schema was removed),
                // return it directly without codec decoding.
                if (typeof envelope.payload !== "string") {
                    return { value: envelope.payload as T };
                }
                try {
                    const decoded = decodeStringPayload<T>(envelope.payload, codec);
                    return { value: decoded };
                } catch (err) {
                    const typedErr =
                        err instanceof SchemaError || err instanceof CodecError
                            ? err
                            : new CodecError(`Codec decode failed for key "${key}"`, err);
                    return { value: getFallback(typedErr) };
                }
            }

            // Schema exists for stored version.
            // Payload is a JSON value directly (no codec decoding needed).
            let current: unknown;
            try {
                current = envelope.payload;
                validateAgainstSchema(current, schemaForVersion.schema);
            } catch (err) {
                const typedErr =
                    err instanceof SchemaError || err instanceof CodecError
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
                validateAgainstSchema(migrated, latestSchema.schema);
                // Rewrite as schema-managed envelope (payload is JSON value)
                const rewriteEnvelope: MnemonicEnvelope = {
                    version: latestSchema.version,
                    payload: migrated,
                };
                return {
                    value: migrated as T,
                    rewriteRaw: JSON.stringify(rewriteEnvelope),
                };
            } catch (err) {
                const typedErr =
                    err instanceof SchemaError || err instanceof CodecError
                        ? err
                        : new SchemaError("MIGRATION_FAILED", `Migration failed for key "${key}"`, err);
                return { value: getFallback(typedErr) };
            }
        },
        [
            codec,
            decodeStringPayload,
            getFallback,
            key,
            parseEnvelope,
            schemaMode,
            schemaRegistry,
            getSchemaForVersion,
            getLatestSchemaForKey,
            getMigrationPathForKey,
            validateAgainstSchema,
        ],
    );

    const encodeForWrite = useCallback(
        (nextValue: T): string => {
            const explicitVersion = schema?.version;
            const latestSchema = getLatestSchemaForKey();
            const explicitSchema = explicitVersion !== undefined ? getSchemaForVersion(explicitVersion) : undefined;

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
                // No schema: codec-only path. Encode with hook codec, version 0.
                const envelope: MnemonicEnvelope = {
                    version: 0,
                    payload: codec.encode(nextValue),
                };
                return JSON.stringify(envelope);
            }

            // Schema exists: validate and apply write-time migration if available.
            let valueToStore: unknown = nextValue;

            // Check for write-time normalizer (fromVersion === toVersion)
            const writeMigration = schemaRegistry?.getWriteMigration?.(key, targetSchema.version);
            if (writeMigration) {
                try {
                    valueToStore = writeMigration.migrate(valueToStore);
                } catch (err) {
                    throw err instanceof SchemaError
                        ? err
                        : new SchemaError("MIGRATION_FAILED", `Write-time migration failed for key "${key}"`, err);
                }
            }

            validateAgainstSchema(valueToStore, targetSchema.schema);

            // Schema-managed envelope: payload is JSON value directly
            const envelope: MnemonicEnvelope = {
                version: targetSchema.version,
                payload: valueToStore,
            };
            return JSON.stringify(envelope);
        },
        [
            schema?.version,
            key,
            schemaMode,
            codec,
            schemaRegistry,
            validateAgainstSchema,
            getLatestSchemaForKey,
            getSchemaForVersion,
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
     */
    const remove = useMemo(() => {
        return () => api.removeRaw(key);
    }, [api, key]);

    return useMemo(() => ({ value, set, reset, remove }), [value, set, reset, remove]);
}
