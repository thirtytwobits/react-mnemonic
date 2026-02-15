// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect } from "vitest";
import {
    MnemonicProvider,
    useMnemonicKey,
    JSONCodec,
    createCodec,
    CodecError,
    SchemaError,
    validateJsonSchema,
    compileSchema,
} from "./index";
import type { Codec, MnemonicProviderOptions, UseMnemonicKeyOptions, JsonSchema, CompiledValidator } from "./index";

describe("Public API exports", () => {
    it("exports MnemonicProvider", () => {
        expect(MnemonicProvider).toBeDefined();
        expect(typeof MnemonicProvider).toBe("function");
    });

    it("exports useMnemonicKey", () => {
        expect(useMnemonicKey).toBeDefined();
        expect(typeof useMnemonicKey).toBe("function");
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

    it("type exports are usable (JsonSchema)", () => {
        const schema: JsonSchema = {
            type: "object",
            properties: { name: { type: "string" } },
            required: ["name"],
        };
        expect(schema.type).toBe("object");
    });
});
