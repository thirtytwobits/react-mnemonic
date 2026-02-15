// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect } from "vitest";
import { validateJsonSchema, inferJsonSchema, jsonDeepEqual } from "./json-schema";
import type { JsonSchema } from "./json-schema";

describe("jsonDeepEqual", () => {
    it("compares primitives", () => {
        expect(jsonDeepEqual(1, 1)).toBe(true);
        expect(jsonDeepEqual(1, 2)).toBe(false);
        expect(jsonDeepEqual("a", "a")).toBe(true);
        expect(jsonDeepEqual("a", "b")).toBe(false);
        expect(jsonDeepEqual(true, true)).toBe(true);
        expect(jsonDeepEqual(true, false)).toBe(false);
        expect(jsonDeepEqual(null, null)).toBe(true);
        expect(jsonDeepEqual(null, 0)).toBe(false);
        expect(jsonDeepEqual(0, null)).toBe(false);
    });

    it("compares arrays", () => {
        expect(jsonDeepEqual([1, 2], [1, 2])).toBe(true);
        expect(jsonDeepEqual([1, 2], [1, 3])).toBe(false);
        expect(jsonDeepEqual([1], [1, 2])).toBe(false);
        expect(jsonDeepEqual([], [])).toBe(true);
    });

    it("compares objects", () => {
        expect(jsonDeepEqual({ a: 1 }, { a: 1 })).toBe(true);
        expect(jsonDeepEqual({ a: 1 }, { a: 2 })).toBe(false);
        expect(jsonDeepEqual({ a: 1 }, { b: 1 })).toBe(false);
        expect(jsonDeepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it("compares nested structures", () => {
        expect(jsonDeepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
        expect(jsonDeepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
    });

    it("distinguishes arrays from objects", () => {
        expect(jsonDeepEqual([], {})).toBe(false);
        expect(jsonDeepEqual({}, [])).toBe(false);
    });
});

describe("validateJsonSchema", () => {
    describe("type keyword", () => {
        it("accepts strings for type: string", () => {
            const schema: JsonSchema = { type: "string" };
            expect(validateJsonSchema("hello", schema)).toEqual([]);
            expect(validateJsonSchema("", schema)).toEqual([]);
        });

        it("rejects non-strings for type: string", () => {
            const schema: JsonSchema = { type: "string" };
            expect(validateJsonSchema(42, schema)).toHaveLength(1);
            expect(validateJsonSchema(null, schema)).toHaveLength(1);
            expect(validateJsonSchema(true, schema)).toHaveLength(1);
            expect(validateJsonSchema({}, schema)).toHaveLength(1);
            expect(validateJsonSchema([], schema)).toHaveLength(1);
        });

        it("accepts finite numbers for type: number", () => {
            const schema: JsonSchema = { type: "number" };
            expect(validateJsonSchema(42, schema)).toEqual([]);
            expect(validateJsonSchema(3.14, schema)).toEqual([]);
            expect(validateJsonSchema(-1, schema)).toEqual([]);
            expect(validateJsonSchema(0, schema)).toEqual([]);
        });

        it("rejects NaN and Infinity for type: number", () => {
            const schema: JsonSchema = { type: "number" };
            expect(validateJsonSchema(NaN, schema)).toHaveLength(1);
            expect(validateJsonSchema(Infinity, schema)).toHaveLength(1);
            expect(validateJsonSchema(-Infinity, schema)).toHaveLength(1);
        });

        it("accepts integers for type: integer", () => {
            const schema: JsonSchema = { type: "integer" };
            expect(validateJsonSchema(42, schema)).toEqual([]);
            expect(validateJsonSchema(0, schema)).toEqual([]);
            expect(validateJsonSchema(-5, schema)).toEqual([]);
        });

        it("rejects non-integers for type: integer", () => {
            const schema: JsonSchema = { type: "integer" };
            expect(validateJsonSchema(3.14, schema)).toHaveLength(1);
            expect(validateJsonSchema("42", schema)).toHaveLength(1);
        });

        it("accepts booleans for type: boolean", () => {
            const schema: JsonSchema = { type: "boolean" };
            expect(validateJsonSchema(true, schema)).toEqual([]);
            expect(validateJsonSchema(false, schema)).toEqual([]);
        });

        it("rejects non-booleans for type: boolean", () => {
            const schema: JsonSchema = { type: "boolean" };
            expect(validateJsonSchema(0, schema)).toHaveLength(1);
            expect(validateJsonSchema("true", schema)).toHaveLength(1);
        });

        it("accepts null for type: null", () => {
            const schema: JsonSchema = { type: "null" };
            expect(validateJsonSchema(null, schema)).toEqual([]);
        });

        it("rejects non-null for type: null", () => {
            const schema: JsonSchema = { type: "null" };
            expect(validateJsonSchema(undefined, schema)).toHaveLength(1);
            expect(validateJsonSchema(0, schema)).toHaveLength(1);
            expect(validateJsonSchema("", schema)).toHaveLength(1);
            expect(validateJsonSchema(false, schema)).toHaveLength(1);
        });

        it("accepts plain objects for type: object", () => {
            const schema: JsonSchema = { type: "object" };
            expect(validateJsonSchema({}, schema)).toEqual([]);
            expect(validateJsonSchema({ a: 1 }, schema)).toEqual([]);
        });

        it("rejects arrays and null for type: object", () => {
            const schema: JsonSchema = { type: "object" };
            expect(validateJsonSchema([], schema)).toHaveLength(1);
            expect(validateJsonSchema(null, schema)).toHaveLength(1);
        });

        it("accepts arrays for type: array", () => {
            const schema: JsonSchema = { type: "array" };
            expect(validateJsonSchema([], schema)).toEqual([]);
            expect(validateJsonSchema([1, 2, 3], schema)).toEqual([]);
        });

        it("rejects objects for type: array", () => {
            const schema: JsonSchema = { type: "array" };
            expect(validateJsonSchema({}, schema)).toHaveLength(1);
        });

        it("accepts union types via type array", () => {
            const schema: JsonSchema = { type: ["string", "null"] };
            expect(validateJsonSchema("hello", schema)).toEqual([]);
            expect(validateJsonSchema(null, schema)).toEqual([]);
        });

        it("rejects non-matching union types", () => {
            const schema: JsonSchema = { type: ["string", "null"] };
            expect(validateJsonSchema(42, schema)).toHaveLength(1);
        });

        it("short-circuits on type mismatch", () => {
            const schema: JsonSchema = { type: "string", minLength: 5 };
            const errors = validateJsonSchema(42, schema);
            expect(errors).toHaveLength(1);
            expect(errors[0]!.keyword).toBe("type");
        });
    });

    describe("empty schema", () => {
        it("accepts any value", () => {
            const schema: JsonSchema = {};
            expect(validateJsonSchema("hello", schema)).toEqual([]);
            expect(validateJsonSchema(42, schema)).toEqual([]);
            expect(validateJsonSchema(null, schema)).toEqual([]);
            expect(validateJsonSchema({}, schema)).toEqual([]);
            expect(validateJsonSchema([], schema)).toEqual([]);
            expect(validateJsonSchema(true, schema)).toEqual([]);
        });
    });

    describe("enum keyword", () => {
        it("accepts values in the enum", () => {
            const schema: JsonSchema = { enum: [1, 2, 3] };
            expect(validateJsonSchema(1, schema)).toEqual([]);
            expect(validateJsonSchema(3, schema)).toEqual([]);
        });

        it("rejects values not in the enum", () => {
            const schema: JsonSchema = { enum: [1, 2, 3] };
            expect(validateJsonSchema(4, schema)).toHaveLength(1);
            expect(validateJsonSchema("1", schema)).toHaveLength(1);
        });

        it("supports mixed-type enums", () => {
            const schema: JsonSchema = { enum: ["a", null, 42] };
            expect(validateJsonSchema("a", schema)).toEqual([]);
            expect(validateJsonSchema(null, schema)).toEqual([]);
            expect(validateJsonSchema(42, schema)).toEqual([]);
            expect(validateJsonSchema("b", schema)).toHaveLength(1);
        });

        it("uses deep equality for object enum members", () => {
            const schema: JsonSchema = { enum: [{ x: 1 }] };
            expect(validateJsonSchema({ x: 1 }, schema)).toEqual([]);
            expect(validateJsonSchema({ x: 2 }, schema)).toHaveLength(1);
        });
    });

    describe("const keyword", () => {
        it("accepts the exact value", () => {
            expect(validateJsonSchema(42, { const: 42 })).toEqual([]);
            expect(validateJsonSchema("hello", { const: "hello" })).toEqual([]);
        });

        it("rejects different values", () => {
            expect(validateJsonSchema(43, { const: 42 })).toHaveLength(1);
        });

        it("uses deep equality for objects", () => {
            expect(validateJsonSchema({ x: 1 }, { const: { x: 1 } })).toEqual([]);
            expect(validateJsonSchema({ x: 2 }, { const: { x: 1 } })).toHaveLength(1);
        });
    });

    describe("number constraints", () => {
        it("validates minimum", () => {
            const schema: JsonSchema = { type: "number", minimum: 0 };
            expect(validateJsonSchema(0, schema)).toEqual([]);
            expect(validateJsonSchema(5, schema)).toEqual([]);
            expect(validateJsonSchema(-1, schema)).toHaveLength(1);
        });

        it("validates maximum", () => {
            const schema: JsonSchema = { type: "number", maximum: 100 };
            expect(validateJsonSchema(100, schema)).toEqual([]);
            expect(validateJsonSchema(50, schema)).toEqual([]);
            expect(validateJsonSchema(101, schema)).toHaveLength(1);
        });

        it("validates exclusiveMinimum", () => {
            const schema: JsonSchema = { type: "number", exclusiveMinimum: 0 };
            expect(validateJsonSchema(1, schema)).toEqual([]);
            expect(validateJsonSchema(0, schema)).toHaveLength(1);
            expect(validateJsonSchema(-1, schema)).toHaveLength(1);
        });

        it("validates exclusiveMaximum", () => {
            const schema: JsonSchema = { type: "number", exclusiveMaximum: 100 };
            expect(validateJsonSchema(99, schema)).toEqual([]);
            expect(validateJsonSchema(100, schema)).toHaveLength(1);
        });

        it("combines minimum and maximum", () => {
            const schema: JsonSchema = { type: "number", minimum: 0, maximum: 100 };
            expect(validateJsonSchema(50, schema)).toEqual([]);
            expect(validateJsonSchema(-1, schema)).toHaveLength(1);
            expect(validateJsonSchema(101, schema)).toHaveLength(1);
        });
    });

    describe("string constraints", () => {
        it("validates minLength", () => {
            const schema: JsonSchema = { type: "string", minLength: 1 };
            expect(validateJsonSchema("a", schema)).toEqual([]);
            expect(validateJsonSchema("", schema)).toHaveLength(1);
        });

        it("validates maxLength", () => {
            const schema: JsonSchema = { type: "string", maxLength: 5 };
            expect(validateJsonSchema("hello", schema)).toEqual([]);
            expect(validateJsonSchema("hello!", schema)).toHaveLength(1);
        });
    });

    describe("object constraints", () => {
        it("validates required properties", () => {
            const schema: JsonSchema = {
                type: "object",
                required: ["name", "email"],
            };
            expect(validateJsonSchema({ name: "Alice", email: "a@b.c" }, schema)).toEqual([]);
            expect(validateJsonSchema({ name: "Alice" }, schema)).toHaveLength(1);
            expect(validateJsonSchema({}, schema)).toHaveLength(2);
        });

        it("validates property schemas", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    name: { type: "string" },
                    age: { type: "number" },
                },
            };
            expect(validateJsonSchema({ name: "Alice", age: 30 }, schema)).toEqual([]);
            expect(validateJsonSchema({ name: "Alice", age: "thirty" }, schema)).toHaveLength(1);
        });

        it("allows missing optional properties", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    name: { type: "string" },
                    age: { type: "number" },
                },
                required: ["name"],
            };
            expect(validateJsonSchema({ name: "Alice" }, schema)).toEqual([]);
        });

        it("rejects additional properties when false", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    name: { type: "string" },
                },
                additionalProperties: false,
            };
            expect(validateJsonSchema({ name: "Alice" }, schema)).toEqual([]);
            expect(validateJsonSchema({ name: "Alice", extra: true }, schema)).toHaveLength(1);
        });

        it("validates additional properties against a schema", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    name: { type: "string" },
                },
                additionalProperties: { type: "number" },
            };
            expect(validateJsonSchema({ name: "Alice", score: 42 }, schema)).toEqual([]);
            expect(validateJsonSchema({ name: "Alice", score: "high" }, schema)).toHaveLength(1);
        });

        it("validates nested objects", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    address: {
                        type: "object",
                        properties: {
                            city: { type: "string" },
                        },
                        required: ["city"],
                    },
                },
            };
            expect(validateJsonSchema({ address: { city: "NYC" } }, schema)).toEqual([]);
            expect(validateJsonSchema({ address: {} }, schema)).toHaveLength(1);
        });
    });

    describe("array constraints", () => {
        it("validates minItems", () => {
            const schema: JsonSchema = { type: "array", minItems: 1 };
            expect(validateJsonSchema([1], schema)).toEqual([]);
            expect(validateJsonSchema([], schema)).toHaveLength(1);
        });

        it("validates maxItems", () => {
            const schema: JsonSchema = { type: "array", maxItems: 2 };
            expect(validateJsonSchema([1, 2], schema)).toEqual([]);
            expect(validateJsonSchema([1, 2, 3], schema)).toHaveLength(1);
        });

        it("validates item schemas", () => {
            const schema: JsonSchema = {
                type: "array",
                items: { type: "number" },
            };
            expect(validateJsonSchema([1, 2, 3], schema)).toEqual([]);
            expect(validateJsonSchema([1, "two", 3], schema)).toHaveLength(1);
        });

        it("validates nested arrays", () => {
            const schema: JsonSchema = {
                type: "array",
                items: { type: "array", items: { type: "number" } },
            };
            expect(validateJsonSchema([[1, 2], [3]], schema)).toEqual([]);
            expect(validateJsonSchema([[1, "x"]], schema)).toHaveLength(1);
        });
    });

    describe("path reporting", () => {
        it("reports root path as empty string", () => {
            const errors = validateJsonSchema(42, { type: "string" });
            expect(errors[0]!.path).toBe("");
        });

        it("reports object property paths", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    name: { type: "string" },
                },
            };
            const errors = validateJsonSchema({ name: 42 }, schema);
            expect(errors[0]!.path).toBe("/name");
        });

        it("reports array element paths", () => {
            const schema: JsonSchema = {
                type: "array",
                items: { type: "number" },
            };
            const errors = validateJsonSchema([1, "two"], schema);
            expect(errors[0]!.path).toBe("/1");
        });

        it("reports nested paths", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: { id: { type: "number" } },
                        },
                    },
                },
            };
            const errors = validateJsonSchema({ items: [{ id: "bad" }] }, schema);
            expect(errors[0]!.path).toBe("/items/0/id");
        });

        it("includes keyword in error", () => {
            const errors = validateJsonSchema(42, { type: "string" });
            expect(errors[0]!.keyword).toBe("type");
        });
    });
});

describe("inferJsonSchema", () => {
    it("infers string type", () => {
        expect(inferJsonSchema("hello")).toEqual({ type: "string" });
    });

    it("infers number type", () => {
        expect(inferJsonSchema(42)).toEqual({ type: "number" });
        expect(inferJsonSchema(3.14)).toEqual({ type: "number" });
    });

    it("infers boolean type", () => {
        expect(inferJsonSchema(true)).toEqual({ type: "boolean" });
    });

    it("infers null type", () => {
        expect(inferJsonSchema(null)).toEqual({ type: "null" });
    });

    it("infers object type", () => {
        expect(inferJsonSchema({ a: 1 })).toEqual({ type: "object" });
    });

    it("infers array type", () => {
        expect(inferJsonSchema([1, 2])).toEqual({ type: "array" });
    });

    it("returns empty schema for undefined", () => {
        expect(inferJsonSchema(undefined)).toEqual({});
    });
});
