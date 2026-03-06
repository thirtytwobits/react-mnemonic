// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect } from "vitest";
import { createSchemaRegistry } from "./schema-registry";
import { SchemaError } from "./schema";
import type { KeySchema, MigrationRule } from "./types";

const profileV1: KeySchema = {
    key: "profile",
    version: 1,
    schema: {
        type: "object",
        properties: {
            name: { type: "string" },
        },
        required: ["name"],
    },
};

const profileV2: KeySchema = {
    key: "profile",
    version: 2,
    schema: {
        type: "object",
        properties: {
            name: { type: "string" },
            email: { type: "string" },
        },
        required: ["name", "email"],
    },
};

const profileV4: KeySchema = {
    key: "profile",
    version: 4,
    schema: {
        type: "object",
        properties: {
            name: { type: "string" },
            email: { type: "string" },
            migratedAt: { type: "string" },
        },
        required: ["name", "email", "migratedAt"],
    },
};

describe("createSchemaRegistry", () => {
    it("indexes schemas and returns the latest schema for a key", () => {
        const registry = createSchemaRegistry({
            schemas: [profileV1, profileV2],
        });

        expect(registry.getSchema("profile", 1)).toEqual(profileV1);
        expect(registry.getSchema("profile", 2)).toEqual(profileV2);
        expect(registry.getSchema("profile", 3)).toBeUndefined();
        expect(registry.getLatestSchema("profile")).toEqual(profileV2);
    });

    it("resolves migration paths and write-time normalizers", () => {
        const v1To2: MigrationRule = {
            key: "profile",
            fromVersion: 1,
            toVersion: 2,
            migrate: (value) => ({
                ...(value as { name: string }),
                email: "",
            }),
        };
        const v2Normalize: MigrationRule = {
            key: "profile",
            fromVersion: 2,
            toVersion: 2,
            migrate: (value) => ({
                ...(value as { name: string; email: string }),
                email: (value as { email: string }).email.trim().toLowerCase(),
            }),
        };
        const v2To4: MigrationRule = {
            key: "profile",
            fromVersion: 2,
            toVersion: 4,
            migrate: (value) => ({
                ...(value as { name: string; email: string }),
                migratedAt: "2026-03-06T00:00:00.000Z",
            }),
        };

        const registry = createSchemaRegistry({
            schemas: [profileV1, profileV2, profileV4],
            migrations: [v1To2, v2Normalize, v2To4],
        });

        expect(registry.getMigrationPath("profile", 1, 4)).toEqual([v1To2, v2To4]);
        expect(registry.getMigrationPath("profile", 2, 2)).toEqual([]);
        expect(registry.getMigrationPath("profile", 4, 2)).toBeNull();
        expect(registry.getWriteMigration?.("profile", 2)).toEqual(v2Normalize);
        expect(registry.getWriteMigration?.("profile", 1)).toBeUndefined();
    });

    it("returns null when no contiguous migration path exists", () => {
        const registry = createSchemaRegistry({
            schemas: [profileV1, profileV4],
            migrations: [
                {
                    key: "profile",
                    fromVersion: 1,
                    toVersion: 4,
                    migrate: (value) => value,
                },
            ],
        });

        expect(registry.getMigrationPath("profile", 1, 2)).toBeNull();
        expect(registry.getMigrationPath("profile", 2, 4)).toBeNull();
    });

    it("throws SCHEMA_REGISTRATION_CONFLICT for duplicate schemas", () => {
        expect(() =>
            createSchemaRegistry({
                schemas: [profileV1, profileV1],
            }),
        ).toThrowError(
            new SchemaError("SCHEMA_REGISTRATION_CONFLICT", 'Duplicate schema registered for key "profile" version 1'),
        );
    });

    it("throws MIGRATION_GRAPH_INVALID for ambiguous outgoing migration edges", () => {
        expect(() =>
            createSchemaRegistry({
                schemas: [profileV1, profileV2, profileV4],
                migrations: [
                    {
                        key: "profile",
                        fromVersion: 1,
                        toVersion: 2,
                        migrate: (value) => value,
                    },
                    {
                        key: "profile",
                        fromVersion: 1,
                        toVersion: 4,
                        migrate: (value) => value,
                    },
                ],
            }),
        ).toThrowError(
            new SchemaError(
                "MIGRATION_GRAPH_INVALID",
                'Ambiguous migration graph for key "profile" at version 1: 1 -> 2 conflicts with 1 -> 4',
            ),
        );
    });

    it("throws MIGRATION_GRAPH_INVALID for duplicate write normalizers", () => {
        expect(() =>
            createSchemaRegistry({
                schemas: [profileV2],
                migrations: [
                    {
                        key: "profile",
                        fromVersion: 2,
                        toVersion: 2,
                        migrate: (value) => value,
                    },
                    {
                        key: "profile",
                        fromVersion: 2,
                        toVersion: 2,
                        migrate: (value) => value,
                    },
                ],
            }),
        ).toThrowError(
            new SchemaError(
                "MIGRATION_GRAPH_INVALID",
                'Duplicate write migration registered for key "profile" version 2',
            ),
        );
    });

    it("throws MIGRATION_GRAPH_INVALID for backward migrations", () => {
        expect(() =>
            createSchemaRegistry({
                schemas: [profileV1, profileV2, profileV4],
                migrations: [
                    {
                        key: "profile",
                        fromVersion: 1,
                        toVersion: 2,
                        migrate: (value) => value,
                    },
                    {
                        key: "profile",
                        fromVersion: 2,
                        toVersion: 1,
                        migrate: (value) => value,
                    },
                ],
            }),
        ).toThrowError(
            new SchemaError("MIGRATION_GRAPH_INVALID", 'Backward migration "profile" 2 -> 1 is not supported'),
        );
    });
});
