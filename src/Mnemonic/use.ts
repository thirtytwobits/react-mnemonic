// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * @fileoverview React hook for type-safe, persistent state management.
 *
 * This module exports the `useMnemonicKey` hook, which provides a React-friendly
 * API for reading and writing persistent state with automatic synchronization,
 * encoding/decoding, and JSON Schema validation.
 */

import { useSyncExternalStore, useMemo, useEffect, useRef, useCallback, useState } from "react";
import { useMnemonic } from "./provider";
import { JSONCodec, CodecError } from "./codecs";
import { SchemaError, type MnemonicEnvelope } from "./schema";
import { validateJsonSchema, inferJsonSchema } from "./json-schema";
import { getRuntimeNodeEnv } from "./runtime";
import type { JsonSchema } from "./json-schema";
import type {
    UseMnemonicKeyOptions,
    KeySchema,
    MigrationPath,
    ReconcileContext,
    MnemonicKeyState,
    MnemonicKeyDescriptor,
} from "./types";

const SSR_SNAPSHOT_TOKEN = Symbol("mnemonic:ssr-snapshot");
const diagnosticContractRegistry = new WeakMap<object, Map<string, string>>();
const diagnosticWarningRegistry = new WeakMap<object, Set<string>>();
const diagnosticObjectIds = new WeakMap<object, number>();
let nextDiagnosticObjectId = 1;

type ReadResult<T> = {
    value: T;
    rewriteRaw?: string;
    pendingSchema?: KeySchema;
};

function serializeEnvelope(version: number, payload: unknown): string {
    return JSON.stringify({
        version,
        payload,
    } satisfies MnemonicEnvelope);
}

function withReadMetadata<T>(value: T, rewriteRaw?: string, pendingSchema?: KeySchema): ReadResult<T> {
    const result: ReadResult<T> = { value };
    if (rewriteRaw !== undefined) result.rewriteRaw = rewriteRaw;
    if (pendingSchema !== undefined) result.pendingSchema = pendingSchema;
    return result;
}

function isDevelopmentRuntime(): boolean {
    return getRuntimeNodeEnv() === "development";
}

function getDiagnosticWarnings(api: object): Set<string> {
    let warnings = diagnosticWarningRegistry.get(api);
    if (!warnings) {
        warnings = new Set<string>();
        diagnosticWarningRegistry.set(api, warnings);
    }
    return warnings;
}

function warnOnce(api: object, id: string, message: string): void {
    const warnings = getDiagnosticWarnings(api);
    if (warnings.has(id)) return;
    warnings.add(id);
    console.warn(message);
}

function stableDiagnosticValue(value: unknown): string {
    if (typeof value === "function") {
        const source = Function.prototype.toString.call(value).split(/\s+/).join(" ").trim();
        const name = value.name || "anonymous";
        return `[factory:${name}/${value.length}:${source}]`;
    }
    if (typeof value === "bigint") return `${value.toString()}n`;
    if (typeof value === "symbol") return value.toString();
    if (value === undefined) return "undefined";
    try {
        return JSON.stringify(value);
    } catch {
        const tag = Object.prototype.toString.call(value);
        if (value !== null && (typeof value === "object" || typeof value === "function")) {
            return `${tag}#${getDiagnosticObjectId(value)}`;
        }
        return tag;
    }
}

function isObjectLike(value: unknown): value is object {
    return value !== null && (typeof value === "object" || typeof value === "function");
}

function objectHasOwn(value: object, property: PropertyKey): boolean {
    const hasOwn = (Object as typeof Object & { hasOwn?: (target: object, key: PropertyKey) => boolean }).hasOwn;
    if (typeof hasOwn === "function") {
        return hasOwn(value, property);
    }
    return Object.getOwnPropertyDescriptor(value, property) !== undefined;
}

function getDiagnosticObjectId(value: object): number {
    const existing = diagnosticObjectIds.get(value);
    if (existing !== undefined) return existing;
    const id = nextDiagnosticObjectId++;
    diagnosticObjectIds.set(value, id);
    return id;
}

function buildContractFingerprint<T>({
    api,
    key,
    defaultValue,
    codecOpt,
    schema,
    reconcile,
    listenCrossTab,
    ssrOptions,
}: {
    api: object;
    key: string;
    defaultValue: UseMnemonicKeyOptions<T>["defaultValue"];
    codecOpt: UseMnemonicKeyOptions<T>["codec"];
    schema: UseMnemonicKeyOptions<T>["schema"];
    reconcile: UseMnemonicKeyOptions<T>["reconcile"];
    listenCrossTab: UseMnemonicKeyOptions<T>["listenCrossTab"];
    ssrOptions: UseMnemonicKeyOptions<T>["ssr"];
}): string {
    const codecSignature =
        codecOpt == null || !isObjectLike(codecOpt)
            ? "default-json-codec"
            : `codec:${stableDiagnosticValue((codecOpt as { encode?: unknown }).encode)}:${stableDiagnosticValue((codecOpt as { decode?: unknown }).decode)}`;
    const reconcileSignature =
        reconcile == null || !isObjectLike(reconcile)
            ? "no-reconcile"
            : `reconcile:${stableDiagnosticValue(reconcile)}`;

    return JSON.stringify({
        key,
        defaultValue: stableDiagnosticValue(defaultValue),
        codec: codecSignature,
        schemaVersion: schema?.version ?? null,
        listenCrossTab: Boolean(listenCrossTab),
        reconcile: reconcileSignature,
        ssrHydration: ssrOptions?.hydration ?? null,
        hasServerValue: ssrOptions?.serverValue !== undefined,
        providerHydration: (api as { ssrHydration?: string }).ssrHydration ?? null,
    });
}

function resolveMnemonicKeyArgs<T>(
    keyOrDescriptor: string | MnemonicKeyDescriptor<T, string>,
    options?: UseMnemonicKeyOptions<T>,
): MnemonicKeyDescriptor<T, string> {
    if (typeof keyOrDescriptor !== "string") {
        return keyOrDescriptor;
    }
    if (!options) {
        throw new Error("useMnemonicKey requires options when called with a string key");
    }
    return {
        key: keyOrDescriptor,
        options,
    };
}

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
 * Read lifecycle, in order:
 * 1. Load the raw stored envelope for `key`
 * 2. Decode the payload (codec or schema-managed JSON)
 * 3. Validate and migrate when schemas are registered
 * 4. Run `reconcile(...)` if provided
 * 5. Fall back to `defaultValue` when the key is absent or invalid
 *
 * Write semantics:
 * - `set(...)` persists a new value
 * - `reset()` persists `defaultValue`
 * - `remove()` deletes the key entirely so future reads fall back to `defaultValue`
 *
 * For guide-level background, see the
 * [Schema Migration guide](https://thirtytwobits.github.io/react-mnemonic/docs/guides/schema-migration)
 * and the
 * [Clearable Persisted Values guide](https://thirtytwobits.github.io/react-mnemonic/docs/guides/clearable-persisted-values).
 *
 * @template T - The TypeScript type of the stored value
 *
 * @returns Persistent state handle with the current value and mutation helpers
 *
 * @see {@link UseMnemonicKeyOptions} - Hook configuration and lifecycle details
 *
 * @throws {Error} If used outside of a MnemonicProvider
 */
export function useMnemonicKey<T, K extends string>(descriptor: MnemonicKeyDescriptor<T, K>): MnemonicKeyState<T>;
export function useMnemonicKey<T>(key: string, options: UseMnemonicKeyOptions<T>): MnemonicKeyState<T>;
export function useMnemonicKey<T>(
    keyOrDescriptor: string | MnemonicKeyDescriptor<T, string>,
    options?: UseMnemonicKeyOptions<T>,
): MnemonicKeyState<T> {
    const descriptor = resolveMnemonicKeyArgs(keyOrDescriptor, options);
    const key = descriptor.key;
    const resolvedOptions = descriptor.options;
    const api = useMnemonic();

    const {
        defaultValue,
        onMount,
        onChange,
        listenCrossTab,
        codec: codecOpt,
        schema,
        reconcile,
        ssr: ssrOptions,
    } = resolvedOptions;
    const codec = codecOpt ?? JSONCodec;
    const schemaMode = api.schemaMode;
    const schemaRegistry = api.schemaRegistry;
    const hydrationMode = ssrOptions?.hydration ?? api.ssrHydration;
    const [hasMounted, setHasMounted] = useState(hydrationMode !== "client-only");
    const developmentRuntime = isDevelopmentRuntime();
    const contractFingerprint = useMemo(
        () =>
            developmentRuntime
                ? buildContractFingerprint({
                      api,
                      key,
                      defaultValue,
                      codecOpt,
                      schema,
                      reconcile,
                      listenCrossTab,
                      ssrOptions,
                  })
                : null,
        [
            developmentRuntime,
            api,
            key,
            defaultValue,
            codecOpt,
            schema?.version,
            reconcile,
            listenCrossTab,
            ssrOptions?.hydration,
            ssrOptions?.serverValue,
        ],
    );

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

    const getServerValue = useCallback(() => {
        const serverValue = ssrOptions?.serverValue;
        if (serverValue === undefined) {
            return getFallback();
        }
        return typeof serverValue === "function" ? (serverValue as () => T)() : serverValue;
    }, [getFallback, ssrOptions?.serverValue]);

    const parseEnvelope = useCallback(
        (rawText: string): { ok: true; envelope: MnemonicEnvelope } | { ok: false; error: SchemaError } => {
            try {
                const parsed = JSON.parse(rawText) as MnemonicEnvelope;
                if (
                    typeof parsed !== "object" ||
                    parsed == null ||
                    !Number.isInteger(parsed.version) ||
                    parsed.version < 0 ||
                    !objectHasOwn(parsed, "payload")
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
        <V>(payload: string, activeCodec: { decode: (encoded: string) => V }) => {
            try {
                return activeCodec.decode(payload);
            } catch (err) {
                throw err instanceof CodecError ? err : new CodecError(`Codec decode failed for key "${key}"`, err);
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

    const buildFallbackResult = useCallback(
        (error?: CodecError | SchemaError): ReadResult<T> => ({
            value: getFallback(error),
        }),
        [getFallback],
    );

    const buildSchemaManagedResult = useCallback(
        (version: number, value: unknown): string => serializeEnvelope(version, value),
        [],
    );

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
                // No schema: codec-only path. Encode with hook codec, version 0.
                return serializeEnvelope(0, codec.encode(nextValue));
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

    const applyReconcile = useCallback(
        ({
            value,
            rewriteRaw,
            pendingSchema,
            persistedVersion,
            latestVersion,
            serializeForPersist,
            derivePendingSchema,
        }: {
            value: T;
            rewriteRaw?: string;
            pendingSchema?: KeySchema;
            persistedVersion: number;
            latestVersion?: number;
            serializeForPersist: (value: T) => string;
            derivePendingSchema?: (value: T) => KeySchema;
        }): ReadResult<T> => {
            if (!reconcile) {
                return withReadMetadata(value, rewriteRaw, pendingSchema);
            }

            const context: ReconcileContext = {
                key,
                persistedVersion,
                ...(latestVersion === undefined ? {} : { latestVersion }),
            };

            const baselineSerialized = (() => {
                try {
                    return serializeForPersist(value);
                } catch {
                    return rewriteRaw;
                }
            })();

            try {
                const reconciled = reconcile(value, context);
                const nextPendingSchema = derivePendingSchema ? derivePendingSchema(reconciled) : pendingSchema;
                const nextSerialized = serializeForPersist(reconciled);
                const nextRewriteRaw =
                    baselineSerialized === undefined || nextSerialized !== baselineSerialized
                        ? nextSerialized
                        : rewriteRaw;
                return withReadMetadata(reconciled, nextRewriteRaw, nextPendingSchema);
            } catch (err) {
                const typedErr =
                    err instanceof SchemaError
                        ? err
                        : new SchemaError("RECONCILE_FAILED", `Reconciliation failed for key "${key}"`, err);
                return buildFallbackResult(typedErr);
            }
        },
        [buildFallbackResult, key, reconcile],
    );

    const decodeAutoschemaEnvelope = useCallback(
        (envelope: MnemonicEnvelope, latestSchema: KeySchema | undefined): ReadResult<T> => {
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
                    pendingSchema: inferred,
                    rewriteRaw: buildSchemaManagedResult(inferred.version, decoded),
                    persistedVersion: envelope.version,
                    serializeForPersist: (value) => buildSchemaManagedResult(inferred.version, value),
                    derivePendingSchema: inferSchemaForValue,
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
        (envelope: MnemonicEnvelope, latestSchema: KeySchema | undefined): ReadResult<T> => {
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
                return buildFallbackResult(err as SchemaError | CodecError);
            }
        },
        [applyReconcile, buildFallbackResult, codec, decodeStringPayload, encodeForWrite],
    );

    const decodeSchemaManagedEnvelope = useCallback(
        (
            envelope: MnemonicEnvelope,
            schemaForVersion: KeySchema,
            latestSchema: KeySchema | undefined,
        ): ReadResult<T> => {
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
        (rawText: string | null): ReadResult<T> => {
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
        ],
    );

    /**
     * Subscribe to raw storage changes using React's useSyncExternalStore.
     * This ensures efficient, tearing-free updates when storage changes.
     */
    const getServerRawSnapshot = useCallback(
        (): string | typeof SSR_SNAPSHOT_TOKEN | null =>
            ssrOptions?.serverValue === undefined ? null : SSR_SNAPSHOT_TOKEN,
        [ssrOptions?.serverValue],
    );

    const deferStorageRead = hydrationMode === "client-only" && !hasMounted;
    const subscribe = useCallback(
        (listener: () => void) => {
            if (deferStorageRead) {
                return () => undefined;
            }
            return api.subscribeRaw(key, listener);
        },
        [api, deferStorageRead, key],
    );

    const raw = useSyncExternalStore(
        subscribe,
        () => (deferStorageRead ? getServerRawSnapshot() : api.getRawSnapshot(key)),
        getServerRawSnapshot,
    );

    const decoded = useMemo(() => {
        if (raw === SSR_SNAPSHOT_TOKEN) {
            return {
                value: getServerValue(),
                rewriteRaw: undefined,
                pendingSchema: undefined,
            };
        }
        return decodeForRead(raw);
    }, [decodeForRead, getServerValue, raw]);
    const value = decoded.value;

    useEffect(() => {
        if (!developmentRuntime) return;

        if (listenCrossTab && (api.crossTabSyncMode ?? "none") === "none" && globalThis.window !== undefined) {
            warnOnce(
                api,
                `listenCrossTab:${key}`,
                `[Mnemonic] useMnemonicKey("${key}") enabled listenCrossTab, but the active storage backend may not be able to notify external changes. If you're using a custom Storage-like wrapper around localStorage, ensure it forwards browser "storage" events or implements storage.onExternalChange(...); otherwise, use localStorage or implement storage.onExternalChange(...) on your custom backend.`,
            );
        }

        if (codecOpt && schema?.version !== undefined && api.schemaRegistry) {
            warnOnce(
                api,
                `codec+schema:${key}`,
                `[Mnemonic] useMnemonicKey("${key}") received both a custom codec and schema.version. Schema-managed reads/writes do not use the codec path. Remove the codec for schema-managed storage, or remove schema.version if you intended codec-only persistence.`,
            );
        }

        let keyContracts = diagnosticContractRegistry.get(api);
        if (!keyContracts) {
            keyContracts = new Map<string, string>();
            diagnosticContractRegistry.set(api, keyContracts);
        }

        if (contractFingerprint === null) {
            return;
        }
        const previousContract = keyContracts.get(key);
        if (previousContract === undefined) {
            keyContracts.set(key, contractFingerprint);
            return;
        }
        if (previousContract === contractFingerprint) {
            return;
        }

        warnOnce(
            api,
            `contract-conflict:${key}`,
            `[Mnemonic] Conflicting useMnemonicKey contracts detected for key "${key}" in namespace "${api.prefix.slice(0, -1)}". Reuse a shared descriptor with defineMnemonicKey(...) or align defaultValue/codec/schema/reconcile options so every consumer describes the same persisted contract.`,
        );
    }, [
        api,
        key,
        developmentRuntime,
        contractFingerprint,
        listenCrossTab,
        codecOpt,
        schema?.version,
        api.schemaRegistry,
        api.crossTabSyncMode,
    ]);

    useEffect(() => {
        if (hasMounted) return;
        setHasMounted(true);
    }, [hasMounted]);

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
        const globalWindow = globalThis.window;
        if (globalWindow === undefined) return;

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

        globalWindow.addEventListener("storage", handler);
        return () => globalWindow.removeEventListener("storage", handler);
    }, [listenCrossTab, api, key]);

    /**
     * Update function - supports both direct values and updater functions.
     */
    const set = useMemo(() => {
        return (next: T | ((cur: T) => T)) => {
            const nextVal =
                typeof next === "function" ? (next as (c: T) => T)(decodeForRead(api.getRawSnapshot(key)).value) : next;
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

    return useMemo<MnemonicKeyState<T>>(
        () =>
            /** @see {@link UseMnemonicKeyOptions} for configuration details */
            ({
                /** Current decoded value, or the default when the key is absent or invalid. */
                value,
                /** Persist a new value (direct or updater function). */
                set,
                /** Reset to `defaultValue` and persist it. */
                reset,
                /** Delete the key from storage entirely. */
                remove,
            }),
        [value, set, reset, remove],
    );
}
