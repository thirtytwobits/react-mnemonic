// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, expect, it } from "vitest";
import { validateJsonSchema } from "./json-schema";
import { mnemonicSchema } from "./typed-schema";
import { defineKeySchema, defineMigration, defineWriteMigration } from "./schema-helpers";
import { SchemaError } from "./schema";

describe("mnemonicSchema", () => {
    it("builds object schemas with inferred required and optional properties", () => {
        const profileSchema = mnemonicSchema.object({
            name: mnemonicSchema.string({ minLength: 1 }),
            email: mnemonicSchema.optional(mnemonicSchema.string()),
            tags: mnemonicSchema.array(mnemonicSchema.string()),
        });

        expect(profileSchema).toEqual({
            type: "object",
            properties: {
                name: { type: "string", minLength: 1 },
                email: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
            },
            required: ["name", "tags"],
        });

        expect(
            validateJsonSchema({ name: "Scott", email: "scott@example.com", tags: ["maintainer"] }, profileSchema),
        ).toEqual([]);
        expect(validateJsonSchema({ email: "missing-required@example.com" }, profileSchema)).not.toEqual([]);
    });

    it("supports nullable schemas for enum-backed values", () => {
        const themeSchema = mnemonicSchema.nullable(mnemonicSchema.enum(["light", "dark"] as const));

        expect(themeSchema).toEqual({
            enum: ["light", "dark", null],
        });

        expect(validateJsonSchema("dark", themeSchema)).toEqual([]);
        expect(validateJsonSchema(null, themeSchema)).toEqual([]);
        expect(validateJsonSchema("sepia", themeSchema)).not.toEqual([]);
    });

    it("preserves nullable const schemas without duplicating null", () => {
        const nullOnlySchema = mnemonicSchema.nullable(mnemonicSchema.literal(null));

        expect(nullOnlySchema).toEqual({
            const: null,
        });

        expect(validateJsonSchema(null, nullOnlySchema)).toEqual([]);
        expect(validateJsonSchema("nope", nullOnlySchema)).not.toEqual([]);
    });

    it("builds record schemas using additionalProperties", () => {
        const counterMapSchema = mnemonicSchema.record(mnemonicSchema.integer({ minimum: 0 }));

        expect(counterMapSchema).toEqual({
            type: "object",
            additionalProperties: {
                type: "integer",
                minimum: 0,
            },
        });
    });

    it("throws when nullable is used with a schema the JSON subset cannot represent", () => {
        expect(() => mnemonicSchema.nullable({ minLength: 1 })).toThrowError(
            new SchemaError(
                "MODE_CONFIGURATION_INVALID",
                "mnemonicSchema.nullable(...) requires a schema with type, enum, or const",
            ),
        );
    });
});

describe("typed schema helpers", () => {
    it("defines typed key schemas and migrations", () => {
        const profileV1 = defineKeySchema(
            "profile",
            1,
            mnemonicSchema.object({
                name: mnemonicSchema.string(),
            }),
        );
        const profileV2 = defineKeySchema(
            "profile",
            2,
            mnemonicSchema.object({
                name: mnemonicSchema.string(),
                email: mnemonicSchema.string(),
            }),
        );

        const migration = defineMigration(profileV1, profileV2, (value) => ({
            ...value,
            email: "",
        }));
        const writeMigration = defineWriteMigration(profileV2, (value) => ({
            ...value,
            email: value.email.trim().toLowerCase(),
        }));

        expect(profileV1.schema).toEqual({
            type: "object",
            properties: {
                name: { type: "string" },
            },
            required: ["name"],
        });
        expect(migration).toMatchObject({
            key: "profile",
            fromVersion: 1,
            toVersion: 2,
        });
        expect(migration.migrate({ name: "Scott" })).toEqual({ name: "Scott", email: "" });
        expect(writeMigration.migrate({ name: "Scott", email: " SCOTT@EXAMPLE.COM " })).toEqual({
            name: "Scott",
            email: "scott@example.com",
        });
    });

    it("rejects migrations between different keys", () => {
        const profileSchema = defineKeySchema("profile", 1, mnemonicSchema.object({ name: mnemonicSchema.string() }));
        const settingsSchema = defineKeySchema(
            "settings",
            2,
            mnemonicSchema.object({ theme: mnemonicSchema.enum(["light", "dark"] as const) }),
        );

        expect(() =>
            defineMigration(profileSchema, settingsSchema, (value) => ({
                theme: value.name as "light" | "dark",
            })),
        ).toThrowError(
            new SchemaError(
                "MIGRATION_GRAPH_INVALID",
                'Migration schemas must target the same key: "profile" !== "settings"',
            ),
        );
    });
});
