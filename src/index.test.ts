// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect } from "vitest";
import {
    MnemonicProvider,
    useMnemonicKey,
    useMnemonicRecovery,
    defineMnemonicKey,
    createSchemaRegistry,
    defineKeySchema,
    defineMigration,
    defineWriteMigration,
    mnemonicSchema,
    JSONCodec,
    createCodec,
    CodecError,
    SchemaError,
    validateJsonSchema,
    compileSchema,
} from "./index";
import type {
    Codec,
    CreateSchemaRegistryOptions,
    MnemonicKeyDescriptor,
    MnemonicProviderOptions,
    UseMnemonicKeyOptions,
    UseMnemonicRecoveryOptions,
    MnemonicRecoveryEvent,
    JsonSchema,
    CompiledValidator,
    TypedJsonSchema,
    InferJsonSchemaValue,
    MigrationRule,
} from "./index";

describe("Public API exports", () => {
    it("exports MnemonicProvider", () => {
        expect(MnemonicProvider).toBeDefined();
        expect(typeof MnemonicProvider).toBe("function");
    });

    it("exports useMnemonicKey", () => {
        expect(useMnemonicKey).toBeDefined();
        expect(typeof useMnemonicKey).toBe("function");
    });

    it("exports useMnemonicRecovery", () => {
        expect(useMnemonicRecovery).toBeDefined();
        expect(typeof useMnemonicRecovery).toBe("function");
    });

    it("exports defineMnemonicKey", () => {
        expect(defineMnemonicKey).toBeDefined();
        expect(typeof defineMnemonicKey).toBe("function");
    });

    it("exports createSchemaRegistry", () => {
        expect(createSchemaRegistry).toBeDefined();
        expect(typeof createSchemaRegistry).toBe("function");
    });

    it("exports typed schema helpers", () => {
        expect(defineKeySchema).toBeDefined();
        expect(typeof defineKeySchema).toBe("function");
        expect(defineMigration).toBeDefined();
        expect(typeof defineMigration).toBe("function");
        expect(defineWriteMigration).toBeDefined();
        expect(typeof defineWriteMigration).toBe("function");
        expect(mnemonicSchema).toBeDefined();
        expect(typeof mnemonicSchema.object).toBe("function");
    });

    it("exports JSONCodec", () => {
        expect(JSONCodec).toBeDefined();
        expect(typeof JSONCodec.encode).toBe("function");
        expect(typeof JSONCodec.decode).toBe("function");
    });

    it("exports createCodec", () => {
        expect(createCodec).toBeDefined();
        expect(typeof createCodec).toBe("function");
    });

    it("exports CodecError", () => {
        expect(CodecError).toBeDefined();
        expect(typeof CodecError).toBe("function");
        expect(new CodecError("test")).toBeInstanceOf(Error);
    });

    it("exports SchemaError", () => {
        expect(SchemaError).toBeDefined();
        expect(typeof SchemaError).toBe("function");
        expect(new SchemaError("TYPE_MISMATCH", "test")).toBeInstanceOf(Error);
    });

    it("exports validateJsonSchema", () => {
        expect(validateJsonSchema).toBeDefined();
        expect(typeof validateJsonSchema).toBe("function");
        // Quick smoke test
        expect(validateJsonSchema(42, { type: "number" })).toEqual([]);
        expect(validateJsonSchema("x", { type: "number" })).toHaveLength(1);
    });

    it("exports compileSchema", () => {
        expect(compileSchema).toBeDefined();
        expect(typeof compileSchema).toBe("function");
        const validate = compileSchema({ type: "number" });
        expect(validate(42)).toEqual([]);
        expect(validate("x")).toHaveLength(1);
    });

    it("type exports are usable (CompiledValidator)", () => {
        const validator: CompiledValidator = compileSchema({ type: "string" });
        expect(validator("hello")).toEqual([]);
    });

    it("type exports are usable (Codec)", () => {
        const myCodec: Codec<number> = {
            encode: (v) => String(v),
            decode: (s) => Number(s),
        };
        expect(myCodec.encode(42)).toBe("42");
    });

    it("type exports are usable (MnemonicProviderOptions)", () => {
        const opts: MnemonicProviderOptions = {
            namespace: "test",
        };
        expect(opts.namespace).toBe("test");
    });

    it("type exports are usable (UseMnemonicKeyOptions)", () => {
        const opts: UseMnemonicKeyOptions<string> = {
            defaultValue: "hello",
        };
        expect(opts.defaultValue).toBe("hello");
    });

    it("type exports are usable (MnemonicKeyDescriptor)", () => {
        const descriptor: MnemonicKeyDescriptor<number, "count"> = defineMnemonicKey("count", {
            defaultValue: 0,
        });
        expect(descriptor.key).toBe("count");
        expect(descriptor.options.defaultValue).toBe(0);
    });

    it("descriptor usage preserves value inference for useMnemonicKey", () => {
        const themeKey = defineMnemonicKey("theme", {
            defaultValue: "light" as "light" | "dark",
        });

        function TypecheckComponent() {
            const state = useMnemonicKey(themeKey);
            const theme: "light" | "dark" = state.value;
            expect(theme).toBe("light");
            return null;
        }

        expect(TypecheckComponent).toBeDefined();
    });

    it("schema-bound descriptors preserve inference for defaults and reconcile hooks", () => {
        const themeKeySchema = defineKeySchema("theme", 1, mnemonicSchema.enum(["light", "dark"] as const));
        const themeKey = defineMnemonicKey(themeKeySchema, {
            defaultValue: "light",
            reconcile: (value, context) => {
                const themed: "light" | "dark" = value;
                const version: number | undefined = context.latestVersion;
                expect(version).toBeUndefined();
                return themed;
            },
        });

        const descriptor: MnemonicKeyDescriptor<"light" | "dark", "theme"> = themeKey;
        expect(descriptor.options.schema).toEqual({ version: 1 });
    });

    it("typed schema exports are usable", () => {
        const profileSchema: TypedJsonSchema<{
            name: string;
            email?: string;
        }> = mnemonicSchema.object({
            name: mnemonicSchema.string(),
            email: mnemonicSchema.optional(mnemonicSchema.string()),
        });
        const schemaValue: InferJsonSchemaValue<typeof profileSchema> = {
            name: "Scott",
            email: "scott@example.com",
        };

        expect(profileSchema.type).toBe("object");
        expect(schemaValue.name).toBe("Scott");
    });

    it("typed migration helpers are usable", () => {
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

        const migration: MigrationRule<{ name: string }, { name: string; email: string }, "profile"> = defineMigration(
            profileV1,
            profileV2,
            (value) => ({
                ...value,
                email: "",
            }),
        );

        const writeMigration = defineWriteMigration(profileV2, (value) => ({
            ...value,
            email: value.email.trim(),
        }));

        expect(migration.migrate({ name: "Scott" })).toEqual({ name: "Scott", email: "" });
        expect(writeMigration.migrate({ name: "Scott", email: "  hi@example.com  " })).toEqual({
            name: "Scott",
            email: "hi@example.com",
        });
    });

    it("type exports are usable (UseMnemonicRecoveryOptions)", () => {
        const options: UseMnemonicRecoveryOptions = {
            onRecover: (event: MnemonicRecoveryEvent) => {
                expect(event.namespace).toBe("test");
            },
        };

        options.onRecover?.({
            action: "clear-all",
            namespace: "test",
            clearedKeys: ["theme"],
        });
    });

    it("type exports are usable (CreateSchemaRegistryOptions)", () => {
        const options: CreateSchemaRegistryOptions = {
            schemas: [],
            migrations: [],
        };
        expect(options.schemas).toEqual([]);
        expect(options.migrations).toEqual([]);
    });

    it("type exports are usable (JsonSchema)", () => {
        const schema: JsonSchema = {
            type: "object",
            properties: { name: { type: "string" } },
            required: ["name"],
        };
        expect(schema.type).toBe("object");
    });

    it("flags schema/default mismatches at compile time", () => {
        const counterSchema = defineKeySchema("count", 1, mnemonicSchema.integer());

        defineMnemonicKey(counterSchema, {
            defaultValue: 0,
            reconcile: (value) => value + 1,
        });

        // @ts-expect-error schema-bound keys infer number, not string
        defineMnemonicKey(counterSchema, {
            defaultValue: "0",
        });

        // @ts-expect-error typed migrations must return the target schema shape
        defineMigration(counterSchema, counterSchema, (_value) => "nope");

        expect(counterSchema.version).toBe(1);
    });
});
