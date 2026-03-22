// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { CodecError, JSONCodec } from "./codecs";
import { inferJsonSchema } from "./json-schema";
import {
    decodeStringPayload,
    encodePersistedValueForWrite,
    getLatestSchema,
    getMigrationPath,
    getSchemaForVersion,
    parseEnvelope,
    serializeEnvelope,
    validateAgainstSchema,
} from "./persistence-shared";
import { getDefaultBrowserStorage } from "./runtime";
import { SchemaError, type MnemonicEnvelope } from "./schema";
import type {
    KeySchema,
    MnemonicBootstrapSnapshot,
    MnemonicKeyDescriptor,
    SchemaMode,
    SchemaRegistry,
    StorageLike,
    UseMnemonicKeyOptions,
} from "./types";

type BootstrapReadResult<T> = {
    value: T;
    rewriteRaw?: string;
};

export type MnemonicBootstrapKeyDefinition<T, K extends string = string> = Readonly<
    {
        key: K;
    } & UseMnemonicKeyOptions<T>
>;

export type MnemonicBootstrapKeyInput<T, K extends string = string> =
    | MnemonicKeyDescriptor<T, K>
    | MnemonicBootstrapKeyDefinition<T, K>;

type InferMnemonicBootstrapKey<TInput> =
    TInput extends MnemonicKeyDescriptor<unknown, infer K extends string>
        ? K
        : TInput extends { key: infer K extends string }
          ? K
          : never;

type InferMnemonicBootstrapValue<TInput> =
    TInput extends MnemonicKeyDescriptor<infer TValue, string>
        ? TValue
        : TInput extends MnemonicBootstrapKeyDefinition<infer TValue, string>
          ? TValue
          : never;

type MnemonicBootstrapValues<TKeys extends readonly MnemonicBootstrapKeyInput<any, string>[]> = {
    [TKey in TKeys[number] as InferMnemonicBootstrapKey<TKey>]: InferMnemonicBootstrapValue<TKey>;
};

export interface RecallMnemonicOptions<TKeys extends readonly MnemonicBootstrapKeyInput<any, string>[]> {
    /**
     * Namespace prefix used by the target provider.
     */
    namespace: string;

    /**
     * Storage backend to read from.
     *
     * Defaults to `window.localStorage` in browser environments.
     */
    storage?: StorageLike;

    /**
     * Schema enforcement mode to emulate during bootstrap reads.
     *
     * @default "default"
     */
    schemaMode?: SchemaMode;

    /**
     * Optional schema registry used for validation and migrations.
     */
    schemaRegistry?: SchemaRegistry;

    /**
     * Keys to recall synchronously before React renders.
     *
     * Each entry may be either a `defineMnemonicKey(...)` descriptor or an
     * inline `{ key, ...options }` object using the same option contract as
     * `useMnemonicKey(...)`.
     */
    keys: TKeys;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    if (value == null) return false;
    if (typeof value !== "object" && typeof value !== "function") return false;
    return typeof (value as { then?: unknown }).then === "function";
}

function resolveBootstrapInput<T>(input: MnemonicBootstrapKeyInput<T, string>): MnemonicKeyDescriptor<T, string> {
    if ("options" in input) {
        return input;
    }

    const { key, ...options } = input;
    return {
        key,
        options,
    };
}

function resolveFallback<T>(
    defaultValue: UseMnemonicKeyOptions<T>["defaultValue"],
    error?: CodecError | SchemaError,
): T {
    return typeof defaultValue === "function"
        ? (defaultValue as (error?: CodecError | SchemaError) => T)(error)
        : defaultValue;
}

function encodeForWrite<T>(
    key: string,
    nextValue: T,
    options: UseMnemonicKeyOptions<T>,
    schemaMode: SchemaMode,
    schemaRegistry: SchemaRegistry | undefined,
): string {
    return encodePersistedValueForWrite({
        key,
        nextValue,
        codec: options.codec ?? JSONCodec,
        explicitVersion: options.schema?.version,
        schemaMode,
        schemaRegistry,
    });
}

function applyReconcile<T>({
    key,
    value,
    options,
    persistedVersion,
    latestVersion,
    rewriteRaw,
    schemaMode,
    schemaRegistry,
    serializeForPersist,
}: {
    key: string;
    value: T;
    options: UseMnemonicKeyOptions<T>;
    persistedVersion: number;
    latestVersion?: number;
    rewriteRaw?: string;
    schemaMode: SchemaMode;
    schemaRegistry: SchemaRegistry | undefined;
    serializeForPersist?: (value: T) => string;
}): BootstrapReadResult<T> {
    const reconcile = options.reconcile;
    if (!reconcile) {
        return { value, ...(rewriteRaw === undefined ? {} : { rewriteRaw }) };
    }

    const persist =
        serializeForPersist ?? ((nextValue: T) => encodeForWrite(key, nextValue, options, schemaMode, schemaRegistry));
    const baselineSerialized = (() => {
        try {
            return persist(value);
        } catch {
            return rewriteRaw;
        }
    })();

    try {
        const reconciled = reconcile(value, {
            key,
            persistedVersion,
            ...(latestVersion === undefined ? {} : { latestVersion }),
        });
        const nextSerialized = persist(reconciled);
        const nextRewriteRaw =
            baselineSerialized === undefined || nextSerialized !== baselineSerialized ? nextSerialized : rewriteRaw;

        return {
            value: reconciled,
            ...(nextRewriteRaw === undefined ? {} : { rewriteRaw: nextRewriteRaw }),
        };
    } catch (error) {
        const typedError =
            error instanceof SchemaError
                ? error
                : new SchemaError("RECONCILE_FAILED", `Reconciliation failed for key "${key}"`, error);
        return {
            value: resolveFallback(options.defaultValue, typedError),
        };
    }
}

function buildFallbackResult<T>(
    options: UseMnemonicKeyOptions<T>,
    error?: CodecError | SchemaError,
): BootstrapReadResult<T> {
    return {
        value: resolveFallback(options.defaultValue, error),
    };
}

function decodeCodecManagedEnvelope<T>({
    key,
    envelope,
    options,
    latestSchema,
    schemaMode,
    schemaRegistry,
}: {
    key: string;
    envelope: MnemonicEnvelope;
    options: UseMnemonicKeyOptions<T>;
    latestSchema: KeySchema | undefined;
    schemaMode: SchemaMode;
    schemaRegistry: SchemaRegistry | undefined;
}): BootstrapReadResult<T> {
    if (typeof envelope.payload !== "string") {
        return applyReconcile({
            key,
            value: envelope.payload as T,
            options,
            persistedVersion: envelope.version,
            ...(latestSchema ? { latestVersion: latestSchema.version } : {}),
            schemaMode,
            schemaRegistry,
        });
    }

    try {
        const decoded = decodeStringPayload(key, envelope.payload, options.codec ?? JSONCodec);
        return applyReconcile({
            key,
            value: decoded,
            options,
            persistedVersion: envelope.version,
            ...(latestSchema ? { latestVersion: latestSchema.version } : {}),
            schemaMode,
            schemaRegistry,
        });
    } catch (error) {
        return buildFallbackResult(options, error as CodecError | SchemaError);
    }
}

function decodeAutoschemaEnvelope<T>({
    key,
    envelope,
    options,
    latestSchema,
    schemaRegistry,
    schemaMode,
}: {
    key: string;
    envelope: MnemonicEnvelope;
    options: UseMnemonicKeyOptions<T>;
    latestSchema: KeySchema | undefined;
    schemaRegistry: SchemaRegistry | undefined;
    schemaMode: SchemaMode;
}): BootstrapReadResult<T> {
    if (latestSchema) {
        return buildFallbackResult(
            options,
            new SchemaError("SCHEMA_NOT_FOUND", `No schema for key "${key}" v${envelope.version}`),
        );
    }
    if (!schemaRegistry?.registerSchema) {
        return buildFallbackResult(
            options,
            new SchemaError(
                "MODE_CONFIGURATION_INVALID",
                `Autoschema mode requires schema registry registration for key "${key}"`,
            ),
        );
    }

    try {
        const decoded =
            typeof envelope.payload === "string"
                ? decodeStringPayload(key, envelope.payload, options.codec ?? JSONCodec)
                : (envelope.payload as T);
        const inferredVersion = 1;
        inferJsonSchema(decoded);
        return applyReconcile({
            key,
            value: decoded,
            options,
            persistedVersion: envelope.version,
            rewriteRaw: serializeEnvelope(inferredVersion, decoded),
            schemaMode,
            schemaRegistry,
            serializeForPersist: (value) => serializeEnvelope(inferredVersion, value),
        });
    } catch (error) {
        const typedError =
            error instanceof SchemaError || error instanceof CodecError
                ? error
                : new SchemaError("TYPE_MISMATCH", `Autoschema inference failed for key "${key}"`, error);
        return buildFallbackResult(options, typedError);
    }
}

function decodeSchemaManagedEnvelope<T>({
    key,
    envelope,
    options,
    schemaForVersion,
    latestSchema,
    schemaMode,
    schemaRegistry,
}: {
    key: string;
    envelope: MnemonicEnvelope;
    options: UseMnemonicKeyOptions<T>;
    schemaForVersion: KeySchema;
    latestSchema: KeySchema | undefined;
    schemaMode: SchemaMode;
    schemaRegistry: SchemaRegistry | undefined;
}): BootstrapReadResult<T> {
    let current: unknown;
    try {
        current = envelope.payload;
        validateAgainstSchema(key, current, schemaForVersion.schema);
    } catch (error) {
        const typedError =
            error instanceof SchemaError || error instanceof CodecError
                ? error
                : new SchemaError("TYPE_MISMATCH", `Schema decode failed for key "${key}"`, error);
        return buildFallbackResult(options, typedError);
    }

    if (!latestSchema || envelope.version >= latestSchema.version) {
        return applyReconcile({
            key,
            value: current as T,
            options,
            persistedVersion: envelope.version,
            ...(latestSchema ? { latestVersion: latestSchema.version } : {}),
            schemaMode,
            schemaRegistry,
        });
    }

    const path = getMigrationPath(schemaRegistry, key, envelope.version, latestSchema.version);
    if (!path) {
        return buildFallbackResult(
            options,
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
        validateAgainstSchema(key, migrated, latestSchema.schema);
        return applyReconcile({
            key,
            value: migrated as T,
            options,
            persistedVersion: envelope.version,
            latestVersion: latestSchema.version,
            rewriteRaw: serializeEnvelope(latestSchema.version, migrated),
            schemaMode,
            schemaRegistry,
        });
    } catch (error) {
        const typedError =
            error instanceof SchemaError || error instanceof CodecError
                ? error
                : new SchemaError("MIGRATION_FAILED", `Migration failed for key "${key}"`, error);
        return buildFallbackResult(options, typedError);
    }
}

function decodeForRead<T>({
    key,
    raw,
    options,
    schemaMode,
    schemaRegistry,
}: {
    key: string;
    raw: string | null;
    options: UseMnemonicKeyOptions<T>;
    schemaMode: SchemaMode;
    schemaRegistry: SchemaRegistry | undefined;
}): BootstrapReadResult<T> {
    if (raw == null) {
        return buildFallbackResult(options);
    }

    try {
        const envelope = parseEnvelope(key, raw);
        const latestSchema = getLatestSchema(schemaRegistry, key);
        const schemaForVersion = getSchemaForVersion(schemaRegistry, key, envelope.version);

        if (schemaMode === "strict" && !schemaForVersion) {
            return buildFallbackResult(
                options,
                new SchemaError("SCHEMA_NOT_FOUND", `No schema for key "${key}" v${envelope.version}`),
            );
        }

        if (schemaMode === "autoschema" && !schemaForVersion) {
            return decodeAutoschemaEnvelope({
                key,
                envelope,
                options,
                latestSchema,
                schemaRegistry,
                schemaMode,
            });
        }

        if (!schemaForVersion) {
            return decodeCodecManagedEnvelope({
                key,
                envelope,
                options,
                latestSchema,
                schemaMode,
                schemaRegistry,
            });
        }

        return decodeSchemaManagedEnvelope({
            key,
            envelope,
            options,
            schemaForVersion,
            latestSchema,
            schemaMode,
            schemaRegistry,
        });
    } catch (error) {
        return buildFallbackResult(options, error as CodecError | SchemaError);
    }
}

function readStorageRaw(
    storage: StorageLike | undefined,
    storageKey: string,
): {
    readable: boolean;
    raw: string | null;
} {
    if (!storage) {
        return {
            readable: false,
            raw: null,
        };
    }

    try {
        const raw = storage.getItem(storageKey);
        if (isPromiseLike(raw)) {
            return {
                readable: false,
                raw: null,
            };
        }
        return {
            readable: true,
            raw: typeof raw === "string" ? raw : null,
        };
    } catch {
        return {
            readable: false,
            raw: null,
        };
    }
}

function assertRecallSchemaConfiguration(schemaMode: SchemaMode, schemaRegistry: SchemaRegistry | undefined): void {
    if (schemaMode === "strict" && !schemaRegistry) {
        throw new Error("recallMnemonic strict mode requires schemaRegistry");
    }
    if (schemaMode === "autoschema" && typeof schemaRegistry?.registerSchema !== "function") {
        throw new Error("recallMnemonic autoschema mode requires schemaRegistry.registerSchema");
    }
}

export function recallMnemonic<TKeys extends readonly MnemonicBootstrapKeyInput<any, string>[]>(
    options: Readonly<RecallMnemonicOptions<TKeys>>,
): MnemonicBootstrapSnapshot<MnemonicBootstrapValues<TKeys>> {
    const storage = options.storage ?? getDefaultBrowserStorage();
    const schemaMode = options.schemaMode ?? "default";
    assertRecallSchemaConfiguration(schemaMode, options.schemaRegistry);
    const prefix = `${options.namespace}.`;
    const values = {} as MnemonicBootstrapValues<TKeys>;
    const raw = {} as Record<string, string | null>;

    for (const entry of options.keys) {
        const resolved = resolveBootstrapInput(entry);
        const snapshot = readStorageRaw(storage, `${prefix}${resolved.key}`);
        if (snapshot.readable) {
            raw[resolved.key] = snapshot.raw;
        }
        values[resolved.key as keyof MnemonicBootstrapValues<TKeys>] = decodeForRead({
            key: resolved.key,
            raw: snapshot.raw,
            options: resolved.options,
            schemaMode,
            schemaRegistry: options.schemaRegistry,
        }).value as MnemonicBootstrapValues<TKeys>[keyof MnemonicBootstrapValues<TKeys>];
    }

    return {
        raw,
        values,
    };
}

export function applyMnemonicBootstrap<TValues extends Record<string, unknown>>({
    snapshot,
    apply,
}: Readonly<{
    snapshot: MnemonicBootstrapSnapshot<TValues>;
    apply: (values: TValues) => void;
}>): TValues {
    apply(snapshot.values);
    return snapshot.values;
}
