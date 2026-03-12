// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * @fileoverview React hook for type-safe, persistent state management.
 *
 * This module exports the `useMnemonicKey` hook, which provides a React-friendly
 * API for reading and writing persistent state with automatic synchronization,
 * encoding/decoding, and JSON Schema validation.
 */

import { useMemo, useCallback } from "react";
import { CodecError } from "./codecs";
import { useMnemonic } from "./provider";
import { SchemaError, type MnemonicEnvelope } from "./schema";
import { inferJsonSchema, validateJsonSchema } from "./json-schema";
import {
    resolveMnemonicKeyArgs,
    serializeEnvelope,
    useApplyReconcile,
    useMnemonicKeySharedFromApi,
    useMnemonicKeyState,
} from "./use-shared";
import type { JsonSchema } from "./json-schema";
import type {
    KeySchema,
    MigrationPath,
    Mnemonic,
    MnemonicKeyDescriptor,
    MnemonicKeyState,
    UseMnemonicKeyOptions,
} from "./types";

type SchemaReadExtra = {
    pendingSchema?: KeySchema;
};

export function useSchemaMnemonicKeyFromApi<T>(
    store: Mnemonic,
    descriptor: MnemonicKeyDescriptor<T, string>,
    active = true,
): MnemonicKeyState<T> {
    const shared = useMnemonicKeySharedFromApi(store, descriptor, undefined, descriptor.options.schema?.version);
    const { api, key, codec, codecOpt, schema, reconcile, parseEnvelope, decodeStringPayload, buildFallbackResult } =
        shared;
    const schemaMode = api.schemaMode;
    const schemaRegistry = api.schemaRegistry;

    const validateAgainstSchema = useCallback(
        (value: unknown, jsonSchema: JsonSchema): void => {
            const errors = validateJsonSchema(value, jsonSchema);
            if (errors.length > 0) {
                const message = errors.map((e) => `${e.path || "/"}: ${e.message}`).join("; ");
                throw new SchemaError("TYPE_MISMATCH", `Schema validation failed for key "${key}": ${message}`);
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
            const nextSchema = schemaRegistry.getSchema(key, version);
            registryCache.schemaByVersion.set(version, nextSchema);
            return nextSchema;
        },
        [schemaRegistry, registryCache, key],
    );

    const getLatestSchemaForKey = useCallback((): KeySchema | undefined => {
        if (!schemaRegistry) return undefined;
        if (!registryCache) return schemaRegistry.getLatestSchema(key);
        if (registryCache.latestSchemaSet) return registryCache.latestSchema;
        const nextSchema = schemaRegistry.getLatestSchema(key);
        registryCache.latestSchema = nextSchema;
        registryCache.latestSchemaSet = true;
        return nextSchema;
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

    const buildSchemaManagedResult = useCallback((version: number, value: unknown): string => {
        return serializeEnvelope(version, value);
    }, []);

    const applyReconcile = useApplyReconcile<T, SchemaReadExtra>({
        key,
        reconcile,
        buildFallbackResult,
    });

    const resolveTargetWriteSchema = useCallback((): KeySchema | undefined => {
        const explicitVersion = schema?.version;
        const latestSchema = getLatestSchemaForKey();
        if (explicitVersion === undefined) return latestSchema;

        const explicitSchema = getSchemaForVersion(explicitVersion);
        if (explicitSchema) return explicitSchema;

        return schemaMode === "strict" ? undefined : latestSchema;
    }, [getLatestSchemaForKey, getSchemaForVersion, schema?.version, schemaMode]);

    const encodeForWrite = useCallback(
        (nextValue: T): string => {
            const explicitVersion = schema?.version;
            const targetSchema = resolveTargetWriteSchema();

            if (!targetSchema) {
                if (explicitVersion !== undefined && schemaMode === "strict") {
                    throw new SchemaError(
                        "WRITE_SCHEMA_REQUIRED",
                        `Write requires schema for key "${key}" in strict mode`,
                    );
                }
                return serializeEnvelope(0, codec.encode(nextValue));
            }

            let valueToStore: unknown = nextValue;
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
            return buildSchemaManagedResult(targetSchema.version, valueToStore);
        },
        [
            schema?.version,
            key,
            schemaMode,
            codec,
            schemaRegistry,
            validateAgainstSchema,
            resolveTargetWriteSchema,
            buildSchemaManagedResult,
        ],
    );

    const decodeAutoschemaEnvelope = useCallback(
        (envelope: MnemonicEnvelope, latestSchema: KeySchema | undefined) => {
            if (latestSchema) {
                return buildFallbackResult(
                    new SchemaError("SCHEMA_NOT_FOUND", `No schema for key "${key}" v${envelope.version}`),
                );
            }
            if (!schemaRegistry || typeof schemaRegistry.registerSchema !== "function") {
                return buildFallbackResult(
                    new SchemaError(
                        "MODE_CONFIGURATION_INVALID",
                        `Autoschema mode requires schema registry registration for key "${key}"`,
                    ),
                );
            }
            try {
                const decoded =
                    typeof envelope.payload === "string"
                        ? decodeStringPayload<T>(envelope.payload, codec)
                        : (envelope.payload as T);
                const inferSchemaForValue = (value: T): KeySchema => ({
                    key,
                    version: 1,
                    schema: inferJsonSchema(value),
                });
                const inferred = inferSchemaForValue(decoded);
                return applyReconcile({
                    value: decoded,
                    extra: { pendingSchema: inferred },
                    rewriteRaw: buildSchemaManagedResult(inferred.version, decoded),
                    persistedVersion: envelope.version,
                    serializeForPersist: (value) => buildSchemaManagedResult(inferred.version, value),
                    deriveExtra: (value) => ({
                        pendingSchema: inferSchemaForValue(value),
                    }),
                });
            } catch (err) {
                const typedErr =
                    err instanceof SchemaError || err instanceof CodecError
                        ? err
                        : new SchemaError("TYPE_MISMATCH", `Autoschema inference failed for key "${key}"`, err);
                return buildFallbackResult(typedErr);
            }
        },
        [
            applyReconcile,
            buildFallbackResult,
            buildSchemaManagedResult,
            codec,
            decodeStringPayload,
            key,
            schemaRegistry,
        ],
    );

    const decodeCodecManagedEnvelope = useCallback(
        (envelope: MnemonicEnvelope, latestSchema: KeySchema | undefined) => {
            if (typeof envelope.payload !== "string") {
                return applyReconcile({
                    value: envelope.payload as T,
                    persistedVersion: envelope.version,
                    ...(latestSchema ? { latestVersion: latestSchema.version } : {}),
                    serializeForPersist: encodeForWrite,
                });
            }
            try {
                const decoded = decodeStringPayload<T>(envelope.payload, codec);
                return applyReconcile({
                    value: decoded,
                    persistedVersion: envelope.version,
                    ...(latestSchema ? { latestVersion: latestSchema.version } : {}),
                    serializeForPersist: encodeForWrite,
                });
            } catch (err) {
                return buildFallbackResult(err as CodecError | SchemaError);
            }
        },
        [applyReconcile, buildFallbackResult, codec, decodeStringPayload, encodeForWrite],
    );

    const decodeSchemaManagedEnvelope = useCallback(
        (envelope: MnemonicEnvelope, schemaForVersion: KeySchema, latestSchema: KeySchema | undefined) => {
            let current: unknown;
            try {
                current = envelope.payload;
                validateAgainstSchema(current, schemaForVersion.schema);
            } catch (err) {
                const typedErr =
                    err instanceof SchemaError || err instanceof CodecError
                        ? err
                        : new SchemaError("TYPE_MISMATCH", `Schema decode failed for key "${key}"`, err);
                return buildFallbackResult(typedErr);
            }

            if (!latestSchema || envelope.version >= latestSchema.version) {
                return applyReconcile({
                    value: current as T,
                    persistedVersion: envelope.version,
                    ...(latestSchema ? { latestVersion: latestSchema.version } : {}),
                    serializeForPersist: encodeForWrite,
                });
            }

            const path = getMigrationPathForKey(envelope.version, latestSchema.version);
            if (!path) {
                return buildFallbackResult(
                    new SchemaError(
                        "MIGRATION_PATH_NOT_FOUND",
                        `No migration path for key "${key}" from v${envelope.version} to v${latestSchema.version}`,
                    ),
                );
            }

            try {
                let migrated = current;
                for (const step of path) {
                    migrated = step.migrate(migrated);
                }
                validateAgainstSchema(migrated, latestSchema.schema);
                return applyReconcile({
                    value: migrated as T,
                    rewriteRaw: buildSchemaManagedResult(latestSchema.version, migrated),
                    persistedVersion: envelope.version,
                    latestVersion: latestSchema.version,
                    serializeForPersist: encodeForWrite,
                });
            } catch (err) {
                const typedErr =
                    err instanceof SchemaError || err instanceof CodecError
                        ? err
                        : new SchemaError("MIGRATION_FAILED", `Migration failed for key "${key}"`, err);
                return buildFallbackResult(typedErr);
            }
        },
        [
            applyReconcile,
            buildFallbackResult,
            buildSchemaManagedResult,
            encodeForWrite,
            getMigrationPathForKey,
            key,
            validateAgainstSchema,
        ],
    );

    const decodeForRead = useCallback(
        (rawText: string | null) => {
            if (rawText == null) return buildFallbackResult();

            const parsed = parseEnvelope(rawText);
            if (!parsed.ok) return buildFallbackResult(parsed.error);
            const envelope = parsed.envelope;

            const schemaForVersion = getSchemaForVersion(envelope.version);
            const latestSchema = getLatestSchemaForKey();

            if (schemaMode === "strict" && !schemaForVersion) {
                return buildFallbackResult(
                    new SchemaError("SCHEMA_NOT_FOUND", `No schema for key "${key}" v${envelope.version}`),
                );
            }

            if (schemaMode === "autoschema" && !schemaForVersion) {
                return decodeAutoschemaEnvelope(envelope, latestSchema);
            }

            if (!schemaForVersion) {
                return decodeCodecManagedEnvelope(envelope, latestSchema);
            }

            return decodeSchemaManagedEnvelope(envelope, schemaForVersion, latestSchema);
        },
        [
            buildFallbackResult,
            decodeAutoschemaEnvelope,
            decodeCodecManagedEnvelope,
            decodeSchemaManagedEnvelope,
            parseEnvelope,
            schemaMode,
            getSchemaForVersion,
            getLatestSchemaForKey,
            key,
        ],
    );

    const additionalDevWarnings = useCallback(
        ({ warnOnce }: { warnOnce: (id: string, message: string) => void }) => {
            if (!codecOpt || schema?.version === undefined || !api.schemaRegistry) return;
            warnOnce(
                `codec+schema:${key}`,
                `[Mnemonic] useMnemonicKey("${key}") received both a custom codec and schema.version. Schema-managed reads/writes do not use the codec path. Remove the codec for schema-managed storage, or remove schema.version if you intended codec-only persistence.`,
            );
        },
        [api.schemaRegistry, codecOpt, key, schema?.version],
    );

    const onDecodedEffect = useCallback(
        (decoded: { pendingSchema?: KeySchema }) => {
            if (!decoded.pendingSchema || !schemaRegistry?.registerSchema) return;
            if (schemaRegistry.getSchema(decoded.pendingSchema.key, decoded.pendingSchema.version)) return;
            try {
                schemaRegistry.registerSchema(decoded.pendingSchema);
            } catch {
                // Ignore registration races; write/read paths will enforce schema validity.
            }
        },
        [schemaRegistry],
    );

    return useMnemonicKeyState(shared, {
        active,
        decodeForRead,
        encodeForWrite,
        additionalDevWarnings,
        onDecodedEffect,
    });
}

function useSchemaMnemonicKey<T>(descriptor: MnemonicKeyDescriptor<T, string>): MnemonicKeyState<T> {
    return useSchemaMnemonicKeyFromApi(useMnemonic(), descriptor);
}

/**
 * React hook for persistent, type-safe state management.
 */
export function useMnemonicKey<T, K extends string>(descriptor: MnemonicKeyDescriptor<T, K>): MnemonicKeyState<T>;
export function useMnemonicKey<T>(key: string, options: UseMnemonicKeyOptions<T>): MnemonicKeyState<T>;
export function useMnemonicKey<T>(
    keyOrDescriptor: string | MnemonicKeyDescriptor<T, string>,
    options?: UseMnemonicKeyOptions<T>,
): MnemonicKeyState<T> {
    return useSchemaMnemonicKey(resolveMnemonicKeyArgs(keyOrDescriptor, options));
}
