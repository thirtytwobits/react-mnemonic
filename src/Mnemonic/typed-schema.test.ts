// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, expect, it } from "vitest";
import { validateJsonSchema } from "./json-schema";
import type { TypedJsonSchema } from "./typed-schema";
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

    it("treats optional wrappers as non-mutating so the original schema remains required elsewhere", () => {
        const nameSchema = mnemonicSchema.string({ minLength: 1 });
        const optionalNameSchema = mnemonicSchema.optional(nameSchema);

        const requiredObject = mnemonicSchema.object({
            name: nameSchema,
        });
        const optionalObject = mnemonicSchema.object({
            name: optionalNameSchema,
        });

        expect(requiredObject).toEqual({
            type: "object",
            properties: {
                name: { type: "string", minLength: 1 },
            },
            required: ["name"],
        });

        expect(optionalObject).toEqual({
            type: "object",
            properties: {
                name: { type: "string", minLength: 1 },
            },
        });

        expect(validateJsonSchema({}, requiredObject)).not.toEqual([]);
        expect(validateJsonSchema({}, optionalObject)).toEqual([]);
    });

    it("allows already-optional schemas to be wrapped again without leaking metadata or throwing", () => {
        const optionalTheme = mnemonicSchema.optional(mnemonicSchema.enum(["light", "dark"] as const));

        expect(() => mnemonicSchema.optional(optionalTheme)).not.toThrow();

        const schema = mnemonicSchema.object({
            theme: mnemonicSchema.optional(optionalTheme),
        });

        expect(schema).toEqual({
            type: "object",
            properties: {
                theme: {
                    enum: ["light", "dark"],
                },
            },
        });

        expect(validateJsonSchema({}, schema)).toEqual([]);
        expect(validateJsonSchema({ theme: "light" }, schema)).toEqual([]);
        expect(validateJsonSchema({ theme: "sepia" }, schema)).not.toEqual([]);
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

    it("widens existing type constraints for enum-backed nullable schemas", () => {
        const stringEnumSchema = mnemonicSchema.nullable({
            type: "string",
            enum: ["light", "dark"],
        } as TypedJsonSchema<"light" | "dark">);

        expect(stringEnumSchema).toEqual({
            type: ["string", "null"],
            enum: ["light", "dark", null],
        });

        expect(validateJsonSchema(null, stringEnumSchema)).toEqual([]);
    });

    it("preserves already-null enum schemas without duplicating null in type or enum", () => {
        const alreadyNullableEnumSchema = mnemonicSchema.nullable({
            type: ["string", "null"],
            enum: ["light", null],
        } as TypedJsonSchema<"light" | null>);

        expect(alreadyNullableEnumSchema).toEqual({
            type: ["string", "null"],
            enum: ["light", null],
        });

        expect(validateJsonSchema("light", alreadyNullableEnumSchema)).toEqual([]);
        expect(validateJsonSchema(null, alreadyNullableEnumSchema)).toEqual([]);
        expect(validateJsonSchema("dark", alreadyNullableEnumSchema)).not.toEqual([]);
    });

    it("preserves nullable const schemas without duplicating null", () => {
        const nullOnlySchema = mnemonicSchema.nullable(mnemonicSchema.literal(null));

        expect(nullOnlySchema).toEqual({
            const: null,
        });

        expect(validateJsonSchema(null, nullOnlySchema)).toEqual([]);
        expect(validateJsonSchema("nope", nullOnlySchema)).not.toEqual([]);
    });

    it("widens existing type constraints for const-backed nullable schemas", () => {
        const stringConstSchema = mnemonicSchema.nullable({
            type: "string",
            const: "light",
        } as TypedJsonSchema<"light">);

        expect(stringConstSchema).toEqual({
            type: ["string", "null"],
            enum: ["light", null],
        });

        expect(validateJsonSchema(null, stringConstSchema)).toEqual([]);
    });

    it("preserves explicit const-null schemas that already carry nullable type information", () => {
        const typedNullConstSchema = mnemonicSchema.nullable({
            type: ["string", "null"],
            const: null,
        } as TypedJsonSchema<null>);

        expect(typedNullConstSchema).toEqual({
            type: ["string", "null"],
            const: null,
        });

        expect(validateJsonSchema(null, typedNullConstSchema)).toEqual([]);
        expect(validateJsonSchema("light", typedNullConstSchema)).not.toEqual([]);
    });

    it("widens literal schemas without explicit type into nullable enums", () => {
        const nullableLiteralSchema = mnemonicSchema.nullable(mnemonicSchema.literal("light"));

        expect(nullableLiteralSchema).toEqual({
            enum: ["light", null],
        });

        expect(validateJsonSchema("light", nullableLiteralSchema)).toEqual([]);
        expect(validateJsonSchema(null, nullableLiteralSchema)).toEqual([]);
        expect(validateJsonSchema("dark", nullableLiteralSchema)).not.toEqual([]);
    });

    it("widens ordinary typed schemas to include null while preserving their existing constraints", () => {
        const displayNameSchema = mnemonicSchema.nullable(mnemonicSchema.string({ minLength: 2, maxLength: 20 }));

        expect(displayNameSchema).toEqual({
            type: ["string", "null"],
            minLength: 2,
            maxLength: 20,
        });

        expect(validateJsonSchema("Ada", displayNameSchema)).toEqual([]);
        expect(validateJsonSchema(null, displayNameSchema)).toEqual([]);
        expect(validateJsonSchema("A", displayNameSchema)).not.toEqual([]);
        expect(validateJsonSchema(42, displayNameSchema)).not.toEqual([]);
    });

    it("does not duplicate null when an ordinary typed schema is already nullable", () => {
        const existingNullableSchema = mnemonicSchema.nullable({
            type: ["string", "null"],
            minLength: 2,
        } as TypedJsonSchema<string | null>);

        expect(existingNullableSchema).toEqual({
            type: ["string", "null"],
            minLength: 2,
        });

        expect(validateJsonSchema("Ada", existingNullableSchema)).toEqual([]);
        expect(validateJsonSchema(null, existingNullableSchema)).toEqual([]);
        expect(validateJsonSchema("A", existingNullableSchema)).not.toEqual([]);
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

    it("builds number, boolean, and null schemas that validate their intended values", () => {
        const telemetrySchema = mnemonicSchema.object({
            score: mnemonicSchema.number({ minimum: 0, maximum: 100 }),
            enabled: mnemonicSchema.boolean(),
            resetAt: mnemonicSchema.nullValue(),
        });

        expect(telemetrySchema).toEqual({
            type: "object",
            properties: {
                score: { type: "number", minimum: 0, maximum: 100 },
                enabled: { type: "boolean" },
                resetAt: { type: "null" },
            },
            required: ["score", "enabled", "resetAt"],
        });

        expect(validateJsonSchema({ score: 42.5, enabled: true, resetAt: null }, telemetrySchema)).toEqual([]);
        expect(validateJsonSchema({ score: -1, enabled: true, resetAt: null }, telemetrySchema)).not.toEqual([]);
        expect(validateJsonSchema({ score: 42.5, enabled: "yes", resetAt: null }, telemetrySchema)).not.toEqual([]);
        expect(validateJsonSchema({ score: 42.5, enabled: true, resetAt: "later" }, telemetrySchema)).not.toEqual([]);
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
