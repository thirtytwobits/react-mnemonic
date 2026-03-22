// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * Shared persistence primitives used by hook reads, optional
 * bridge decoding, and bootstrap recall.
 *
 * Keeping envelope parsing, schema lookup, and write encoding here ensures the
 * different entrypoints stay behaviorally aligned over time.
 */

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

/**
 * Wraps a stored payload in the versioned mnemonic envelope format.
 */
export function serializeEnvelope(version: number, payload: unknown): string {
    return JSON.stringify({
        version,
        payload,
    } satisfies MnemonicEnvelope);
}

/**
 * Parses and validates a raw storage string as a mnemonic envelope.
 *
 * @throws {SchemaError} When the stored value is not valid JSON or does not
 * match the `{ version, payload }` envelope contract.
 */
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

/**
 * Decodes a string payload using the active codec while normalizing thrown
 * errors to `CodecError`.
 */
export function decodeStringPayload<T>(key: string, payload: string, codec: Pick<Codec<T>, "decode">): T {
    try {
        return codec.decode(payload);
    } catch (error) {
        throw error instanceof CodecError ? error : new CodecError(`Codec decode failed for key "${key}"`, error);
    }
}

/**
 * Validates a decoded value against a JSON Schema and throws a typed
 * `SchemaError` when validation fails.
 */
export function validateAgainstSchema(key: string, value: unknown, jsonSchema: JsonSchema): void {
    const errors = validateJsonSchema(value, jsonSchema);
    if (errors.length === 0) {
        return;
    }
    const message = errors.map((entry) => `${entry.path || "/"}: ${entry.message}`).join("; ");
    throw new SchemaError("TYPE_MISMATCH", `Schema validation failed for key "${key}": ${message}`);
}

/**
 * Looks up the latest registered schema for a key, if one exists.
 */
export function getLatestSchema(schemaRegistry: SchemaRegistry | undefined, key: string): KeySchema | undefined {
    return schemaRegistry?.getLatestSchema(key);
}

/**
 * Looks up the schema registered for a specific persisted version.
 */
export function getSchemaForVersion(
    schemaRegistry: SchemaRegistry | undefined,
    key: string,
    version: number,
): KeySchema | undefined {
    return schemaRegistry?.getSchema(key, version);
}

/**
 * Resolves the migration path between two schema versions.
 */
export function getMigrationPath(
    schemaRegistry: SchemaRegistry | undefined,
    key: string,
    fromVersion: number,
    toVersion: number,
): MigrationPath | null {
    return schemaRegistry?.getMigrationPath(key, fromVersion, toVersion) ?? null;
}

/**
 * Chooses the schema version that should govern an outgoing write.
 *
 * Explicit schema versions win when available. In non-strict modes the latest
 * known schema may be used as a fallback when the explicit version is missing.
 */
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

/**
 * Encodes an outgoing value into its persisted envelope, applying optional
 * write-time migrations and schema validation first.
 */
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
