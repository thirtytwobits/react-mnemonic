// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { SchemaError } from "./schema";
import type { CreateSchemaRegistryOptions, KeySchema, MigrationRule, MigrationPath, SchemaRegistry } from "./types";

function schemaVersionKey(key: string, version: number): string {
    return `${key}:${version}`;
}

function migrationVersionKey(key: string, fromVersion: number): string {
    return `${key}:${fromVersion}`;
}

function validateVersion(value: number, label: string): void {
    if (!Number.isInteger(value) || value < 0) {
        throw new SchemaError("MIGRATION_GRAPH_INVALID", `${label} must be a non-negative integer`);
    }
}

/**
 * Create an immutable schema registry for common default/strict-mode setups.
 *
 * The helper indexes schemas and migrations up front, validates duplicate and
 * ambiguous definitions, and returns a {@link SchemaRegistry} ready to pass to
 * `MnemonicProvider`.
 *
 * Most applications should prefer this helper over manually implementing
 * {@link SchemaRegistry}.
 *
 * See the
 * [Schema Migration guide](https://thirtytwobits.github.io/react-mnemonic/docs/guides/schema-migration)
 * for end-to-end registry and migration patterns.
 *
 * @param options - Initial schema and migration definitions
 * @returns An indexed immutable schema registry
 *
 * @throws {SchemaError} With `SCHEMA_REGISTRATION_CONFLICT` for duplicate
 *   schemas, or `MIGRATION_GRAPH_INVALID` for invalid migration graphs
 */
export function createSchemaRegistry(options: CreateSchemaRegistryOptions = {}): SchemaRegistry {
    const { schemas = [], migrations = [] } = options;

    const schemasByKeyAndVersion = new Map<string, KeySchema>();
    const latestSchemaByKey = new Map<string, KeySchema>();
    const writeMigrationsByKeyAndVersion = new Map<string, MigrationRule>();
    const migrationsByKeyAndFromVersion = new Map<string, MigrationRule>();

    for (const schema of schemas) {
        validateVersion(schema.version, `Schema version for key "${schema.key}"`);

        const id = schemaVersionKey(schema.key, schema.version);
        if (schemasByKeyAndVersion.has(id)) {
            throw new SchemaError(
                "SCHEMA_REGISTRATION_CONFLICT",
                `Duplicate schema registered for key "${schema.key}" version ${schema.version}`,
            );
        }

        schemasByKeyAndVersion.set(id, schema);

        const currentLatest = latestSchemaByKey.get(schema.key);
        if (!currentLatest || schema.version > currentLatest.version) {
            latestSchemaByKey.set(schema.key, schema);
        }
    }

    for (const migration of migrations) {
        validateVersion(migration.fromVersion, `Migration fromVersion for key "${migration.key}"`);
        validateVersion(migration.toVersion, `Migration toVersion for key "${migration.key}"`);

        if (migration.toVersion < migration.fromVersion) {
            throw new SchemaError(
                "MIGRATION_GRAPH_INVALID",
                `Backward migration "${migration.key}" ${migration.fromVersion} -> ${migration.toVersion} is not supported`,
            );
        }

        if (migration.fromVersion === migration.toVersion) {
            const id = schemaVersionKey(migration.key, migration.fromVersion);
            if (writeMigrationsByKeyAndVersion.has(id)) {
                throw new SchemaError(
                    "MIGRATION_GRAPH_INVALID",
                    `Duplicate write migration registered for key "${migration.key}" version ${migration.fromVersion}`,
                );
            }
            writeMigrationsByKeyAndVersion.set(id, migration);
            continue;
        }

        const edgeKey = migrationVersionKey(migration.key, migration.fromVersion);
        if (migrationsByKeyAndFromVersion.has(edgeKey)) {
            const existing = migrationsByKeyAndFromVersion.get(edgeKey)!;
            throw new SchemaError(
                "MIGRATION_GRAPH_INVALID",
                `Ambiguous migration graph for key "${migration.key}" at version ${migration.fromVersion}: ` +
                    `${existing.fromVersion} -> ${existing.toVersion} conflicts with ` +
                    `${migration.fromVersion} -> ${migration.toVersion}`,
            );
        }

        migrationsByKeyAndFromVersion.set(edgeKey, migration);
    }
    return {
        getSchema(key, version) {
            return schemasByKeyAndVersion.get(schemaVersionKey(key, version));
        },
        getLatestSchema(key) {
            return latestSchemaByKey.get(key);
        },
        getMigrationPath(key, fromVersion, toVersion): MigrationPath | null {
            if (fromVersion === toVersion) return [];
            if (toVersion < fromVersion) return null;

            const path: MigrationRule[] = [];
            let currentVersion = fromVersion;

            while (currentVersion < toVersion) {
                const next = migrationsByKeyAndFromVersion.get(migrationVersionKey(key, currentVersion));
                if (!next) return null;

                path.push(next);
                currentVersion = next.toVersion;
            }

            return currentVersion === toVersion ? path : null;
        },
        getWriteMigration(key, version) {
            return writeMigrationsByKeyAndVersion.get(schemaVersionKey(key, version));
        },
    };
}
