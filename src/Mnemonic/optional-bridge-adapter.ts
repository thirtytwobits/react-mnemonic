// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { CodecError, JSONCodec } from "./codecs";
import { inferJsonSchema } from "./json-schema";
import { SchemaError, type MnemonicEnvelope } from "./schema";
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
import type { KeySchema, Mnemonic, OptionalMnemonicKeyOptions, SchemaRegistry } from "./types";
import type { MnemonicOptionalBridgeInternal, OptionalReadResult } from "./optional-bridge";

type OptionalBridgeConfig = {
    api: Mnemonic;
    schemaRegistry?: SchemaRegistry;
};

function resolveOptionalDefaultValue<T>(defaultValue: OptionalMnemonicKeyOptions<T>["defaultValue"]): T {
    return typeof defaultValue === "function" ? (defaultValue as () => T)() : defaultValue;
}

function getSchemaCapabilities(schemaRegistry?: SchemaRegistry): boolean {
    return schemaRegistry !== undefined;
}

function buildFallbackResult<T>(options: OptionalMnemonicKeyOptions<T>): OptionalReadResult<T> {
    return {
        value: resolveOptionalDefaultValue(options.defaultValue),
    };
}

function encodeValueForWrite<T>(
    key: string,
    nextValue: T,
    options: OptionalMnemonicKeyOptions<T>,
    schemaRegistry?: SchemaRegistry,
): string {
    return encodePersistedValueForWrite({
        key,
        nextValue,
        codec: options.codec ?? JSONCodec,
        explicitVersion: options.schema?.version,
        schemaMode: "default",
        schemaRegistry,
    });
}

function decodeCodecManagedEnvelope<T>(
    key: string,
    envelope: MnemonicEnvelope,
    options: OptionalMnemonicKeyOptions<T>,
): OptionalReadResult<T> {
    if (typeof envelope.payload !== "string") {
        return {
            value: envelope.payload as T,
        };
    }

    return {
        value: decodeStringPayload(key, envelope.payload, options.codec ?? JSONCodec),
    };
}

function decodeAutoschemaEnvelope<T>(
    key: string,
    envelope: MnemonicEnvelope,
    options: OptionalMnemonicKeyOptions<T>,
    schemaRegistry: SchemaRegistry | undefined,
): OptionalReadResult<T> {
    if (!schemaRegistry?.registerSchema) {
        throw new SchemaError(
            "MODE_CONFIGURATION_INVALID",
            `Autoschema mode requires schema registry registration for key "${key}"`,
        );
    }

    const decoded =
        typeof envelope.payload === "string"
            ? decodeStringPayload(key, envelope.payload, options.codec ?? JSONCodec)
            : (envelope.payload as T);
    const pendingSchema: KeySchema = {
        key,
        version: 1,
        schema: inferJsonSchema(decoded),
    };

    return {
        value: decoded,
        rewriteRaw: serializeEnvelope(pendingSchema.version, decoded),
        pendingSchema,
    };
}

function decodeSchemaManagedEnvelope<T>(
    key: string,
    envelope: MnemonicEnvelope,
    schemaForVersion: KeySchema,
    latestSchema: KeySchema | undefined,
    schemaRegistry: SchemaRegistry | undefined,
): OptionalReadResult<T> {
    let current: unknown = envelope.payload;
    validateAgainstSchema(key, current, schemaForVersion.schema);

    if (!latestSchema || envelope.version >= latestSchema.version) {
        return {
            value: current as T,
        };
    }

    const path = getMigrationPath(schemaRegistry, key, envelope.version, latestSchema.version);
    if (!path) {
        throw new SchemaError(
            "MIGRATION_PATH_NOT_FOUND",
            `No migration path for key "${key}" from v${envelope.version} to v${latestSchema.version}`,
        );
    }

    for (const step of path) {
        current = step.migrate(current);
    }

    validateAgainstSchema(key, current, latestSchema.schema);
    return {
        value: current as T,
        rewriteRaw: serializeEnvelope(latestSchema.version, current),
    };
}

function decodePersistedValue<T>(
    key: string,
    raw: string | null,
    options: OptionalMnemonicKeyOptions<T>,
    api: Mnemonic,
    schemaRegistry?: SchemaRegistry,
): OptionalReadResult<T> {
    if (raw == null) {
        return buildFallbackResult(options);
    }

    const envelope = parseEnvelope(key, raw);
    const latestSchema = getLatestSchema(schemaRegistry, key);
    const schemaForVersion = getSchemaForVersion(schemaRegistry, key, envelope.version);

    if (api.schemaMode === "strict" && !schemaForVersion) {
        throw new SchemaError("SCHEMA_NOT_FOUND", `No schema for key "${key}" v${envelope.version}`);
    }

    if (api.schemaMode === "autoschema" && !schemaForVersion) {
        return decodeAutoschemaEnvelope(key, envelope, options, schemaRegistry);
    }

    if (!schemaForVersion) {
        return decodeCodecManagedEnvelope(key, envelope, options);
    }

    return decodeSchemaManagedEnvelope(key, envelope, schemaForVersion, latestSchema, schemaRegistry);
}

export function createMnemonicOptionalBridge({
    api,
    schemaRegistry,
}: OptionalBridgeConfig): MnemonicOptionalBridgeInternal {
    return {
        namespace: api.prefix.endsWith(".") ? api.prefix.slice(0, -1) : api.prefix,
        capabilities: {
            persistence: true,
            schema: getSchemaCapabilities(schemaRegistry),
        },
        subscribeRaw: (key, listener) => api.subscribeRaw(key, listener),
        getRawSnapshot: (key) => api.getRawSnapshot(key),
        decodeSnapshot: (key, raw, options) => {
            try {
                return decodePersistedValue(key, raw, options, api, schemaRegistry);
            } catch {
                return buildFallbackResult(options);
            }
        },
        setValue: (key, nextValue, options) => {
            try {
                api.setRaw(key, encodeValueForWrite(key, nextValue, options, schemaRegistry));
            } catch (error) {
                if (error instanceof SchemaError) {
                    console.error(`[Mnemonic] Schema error for key "${key}" (${error.code}):`, error.message);
                    return;
                }
                if (error instanceof CodecError) {
                    console.error(`[Mnemonic] Codec error for key "${key}":`, error.message);
                    return;
                }
                throw error;
            }
        },
        removeValue: (key) => {
            api.removeRaw(key);
        },
        commitSnapshot: (key, raw, snapshot) => {
            if (snapshot.pendingSchema && schemaRegistry?.registerSchema) {
                if (!schemaRegistry.getSchema(snapshot.pendingSchema.key, snapshot.pendingSchema.version)) {
                    try {
                        schemaRegistry.registerSchema(snapshot.pendingSchema);
                    } catch {
                        // Ignore registration races; the next read/write enforces schema validity.
                    }
                }
            }
            if (snapshot.rewriteRaw !== undefined && snapshot.rewriteRaw !== raw) {
                api.setRaw(key, snapshot.rewriteRaw);
            }
        },
    };
}
