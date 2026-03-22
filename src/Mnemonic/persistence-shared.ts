// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { CodecError } from "./codecs";
import { validateJsonSchema } from "./json-schema";
import { SchemaError, type MnemonicEnvelope } from "./schema";
import type { JsonSchema } from "./json-schema";
import type { Codec, KeySchema, MigrationPath, SchemaMode, SchemaRegistry } from "./types";

function objectHasOwn(value: object, property: PropertyKey): boolean {
    const hasOwn = (Object as typeof Object & { hasOwn?: (target: object, key: PropertyKey) => boolean }).hasOwn;
    if (typeof hasOwn === "function") {
        return hasOwn(value, property);
    }
    return Object.getOwnPropertyDescriptor(value, property) !== undefined;
}

export function serializeEnvelope(version: number, payload: unknown): string {
    return JSON.stringify({
        version,
        payload,
    } satisfies MnemonicEnvelope);
}

export function parseEnvelope(key: string, rawText: string): MnemonicEnvelope {
    try {
        const parsed = JSON.parse(rawText) as MnemonicEnvelope;
        if (
            typeof parsed !== "object" ||
            parsed == null ||
            !Number.isInteger(parsed.version) ||
            parsed.version < 0 ||
            !objectHasOwn(parsed, "payload")
        ) {
            throw new SchemaError("INVALID_ENVELOPE", `Invalid envelope for key "${key}"`);
        }
        return parsed;
    } catch (error) {
        if (error instanceof SchemaError) {
            throw error;
        }
        throw new SchemaError("INVALID_ENVELOPE", `Invalid envelope for key "${key}"`, error);
    }
}

export function decodeStringPayload<T>(key: string, payload: string, codec: Pick<Codec<T>, "decode">): T {
    try {
        return codec.decode(payload);
    } catch (error) {
        throw error instanceof CodecError ? error : new CodecError(`Codec decode failed for key "${key}"`, error);
    }
}

export function validateAgainstSchema(key: string, value: unknown, jsonSchema: JsonSchema): void {
    const errors = validateJsonSchema(value, jsonSchema);
    if (errors.length === 0) {
        return;
    }
    const message = errors.map((entry) => `${entry.path || "/"}: ${entry.message}`).join("; ");
    throw new SchemaError("TYPE_MISMATCH", `Schema validation failed for key "${key}": ${message}`);
}

export function getLatestSchema(schemaRegistry: SchemaRegistry | undefined, key: string): KeySchema | undefined {
    return schemaRegistry?.getLatestSchema(key);
}

export function getSchemaForVersion(
    schemaRegistry: SchemaRegistry | undefined,
    key: string,
    version: number,
): KeySchema | undefined {
    return schemaRegistry?.getSchema(key, version);
}

export function getMigrationPath(
    schemaRegistry: SchemaRegistry | undefined,
    key: string,
    fromVersion: number,
    toVersion: number,
): MigrationPath | null {
    return schemaRegistry?.getMigrationPath(key, fromVersion, toVersion) ?? null;
}

export function resolveTargetWriteSchema({
    key,
    explicitVersion,
    schemaMode,
    schemaRegistry,
}: {
    key: string;
    explicitVersion: number | undefined;
    schemaMode: SchemaMode;
    schemaRegistry: SchemaRegistry | undefined;
}): KeySchema | undefined {
    const latestSchema = getLatestSchema(schemaRegistry, key);
    if (explicitVersion === undefined) {
        return latestSchema;
    }

    const explicitSchema = getSchemaForVersion(schemaRegistry, key, explicitVersion);
    if (explicitSchema) {
        return explicitSchema;
    }

    return schemaMode === "strict" ? undefined : latestSchema;
}

export function encodePersistedValueForWrite<T>({
    key,
    nextValue,
    codec,
    explicitVersion,
    schemaMode,
    schemaRegistry,
}: {
    key: string;
    nextValue: T;
    codec: Codec<T>;
    explicitVersion: number | undefined;
    schemaMode: SchemaMode;
    schemaRegistry: SchemaRegistry | undefined;
}): string {
    const targetSchema = resolveTargetWriteSchema({
        key,
        explicitVersion,
        schemaMode,
        schemaRegistry,
    });

    if (!targetSchema) {
        if (explicitVersion !== undefined && schemaMode === "strict") {
            throw new SchemaError("WRITE_SCHEMA_REQUIRED", `Write requires schema for key "${key}" in strict mode`);
        }
        return serializeEnvelope(0, codec.encode(nextValue));
    }

    let valueToStore: unknown = nextValue;
    const writeMigration = schemaRegistry?.getWriteMigration?.(key, targetSchema.version);
    if (writeMigration) {
        try {
            valueToStore = writeMigration.migrate(valueToStore);
        } catch (error) {
            throw error instanceof SchemaError
                ? error
                : new SchemaError("MIGRATION_FAILED", `Write-time migration failed for key "${key}"`, error);
        }
    }

    validateAgainstSchema(key, valueToStore, targetSchema.schema);
    return serializeEnvelope(targetSchema.version, valueToStore);
}
