// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { SchemaError } from "./schema";
import type { JsonSchema } from "./json-schema";
import type { InferJsonSchemaValue } from "./typed-schema";
import type { KeySchema, MigrationRule } from "./types";

/**
 * Create a versioned key schema that preserves the decoded value type inferred
 * from a typed schema helper.
 */
export function defineKeySchema<const K extends string, TSchema extends JsonSchema>(
    key: K,
    version: number,
    schema: TSchema,
): KeySchema<InferJsonSchemaValue<TSchema>, K, TSchema> {
    return Object.freeze({
        key,
        version,
        schema,
    });
}

/**
 * Create a typed migration rule between two key schema versions.
 *
 * The `migrate(...)` callback is inferred from the source and target schemas,
 * which keeps migration logic aligned with the registered runtime schemas.
 */
export function defineMigration<const K extends string, TFrom, TTo>(
    fromSchema: KeySchema<TFrom, K>,
    toSchema: KeySchema<TTo, K>,
    migrate: (value: TFrom) => TTo,
): MigrationRule<TFrom, TTo, K> {
    if (fromSchema.key !== toSchema.key) {
        throw new SchemaError(
            "MIGRATION_GRAPH_INVALID",
            `Migration schemas must target the same key: "${fromSchema.key}" !== "${toSchema.key}"`,
        );
    }

    return Object.freeze({
        key: fromSchema.key,
        fromVersion: fromSchema.version,
        toVersion: toSchema.version,
        migrate,
    });
}

/**
 * Create a typed write-time normalization rule for a single key schema.
 */
export function defineWriteMigration<const K extends string, TValue>(
    schema: KeySchema<TValue, K>,
    migrate: (value: TValue) => TValue,
): MigrationRule<TValue, TValue, K> {
    return Object.freeze({
        key: schema.key,
        fromVersion: schema.version,
        toVersion: schema.version,
        migrate,
    });
}
