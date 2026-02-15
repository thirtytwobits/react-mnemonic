// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect } from "vitest";
import { CodecError, JSONCodec, createCodec } from "./codecs";

// ---------------------------------------------------------------------------
// CodecError
// ---------------------------------------------------------------------------
describe("CodecError", () => {
    it("creates an error with a message", () => {
        const err = new CodecError("boom");
        expect(err.message).toBe("boom");
    });

    it("stores an optional cause", () => {
        const cause = new TypeError("inner");
        const err = new CodecError("outer", cause);
        expect(err.cause).toBe(cause);
    });

    it("has name CodecError", () => {
        expect(new CodecError("x").name).toBe("CodecError");
    });

    it("is an instance of Error", () => {
        expect(new CodecError("x")).toBeInstanceOf(Error);
    });

    it("is an instance of CodecError (prototype chain)", () => {
        expect(new CodecError("x")).toBeInstanceOf(CodecError);
    });

    it("defaults cause to undefined when not provided", () => {
        expect(new CodecError("x").cause).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// JSONCodec
// ---------------------------------------------------------------------------
describe("JSONCodec", () => {
    it("encodes and decodes an object", () => {
        const obj = { a: 1, b: "two", c: [3] };
        expect(JSONCodec.decode(JSONCodec.encode(obj))).toEqual(obj);
    });

    it("encodes and decodes an array", () => {
        const arr = [1, "two", null, true];
        expect(JSONCodec.decode(JSONCodec.encode(arr))).toEqual(arr);
    });

    it("encodes and decodes a string", () => {
        expect(JSONCodec.decode(JSONCodec.encode("hello"))).toBe("hello");
    });

    it("encodes and decodes a number", () => {
        expect(JSONCodec.decode(JSONCodec.encode(42))).toBe(42);
    });

    it("encodes and decodes a boolean", () => {
        expect(JSONCodec.decode(JSONCodec.encode(true))).toBe(true);
        expect(JSONCodec.decode(JSONCodec.encode(false))).toBe(false);
    });

    it("encodes and decodes null", () => {
        expect(JSONCodec.decode(JSONCodec.encode(null))).toBeNull();
    });

    it("throws on invalid JSON during decode", () => {
        expect(() => JSONCodec.decode("{bad json}")).toThrow();
    });
});

// ---------------------------------------------------------------------------
// createCodec
// ---------------------------------------------------------------------------
describe("createCodec", () => {
    it("creates a codec from encode and decode functions", () => {
        const DateCodec = createCodec<Date>(
            (d) => d.toISOString(),
            (s) => new Date(s),
        );

        const now = new Date("2024-01-15T12:00:00.000Z");
        const encoded = DateCodec.encode(now);
        expect(encoded).toBe("2024-01-15T12:00:00.000Z");

        const decoded = DateCodec.decode(encoded);
        expect(decoded.getTime()).toBe(now.getTime());
    });

    it("creates a codec for Set<string>", () => {
        const SetCodec = createCodec<Set<string>>(
            (s) => JSON.stringify(Array.from(s)),
            (raw) => new Set(JSON.parse(raw)),
        );

        const original = new Set(["a", "b", "c"]);
        const roundtripped = SetCodec.decode(SetCodec.encode(original));
        expect(roundtripped).toEqual(original);
    });

    it("propagates errors from encode/decode functions", () => {
        const ThrowCodec = createCodec<string>(
            () => {
                throw new CodecError("encode failed");
            },
            () => {
                throw new CodecError("decode failed");
            },
        );

        expect(() => ThrowCodec.encode("x")).toThrow(CodecError);
        expect(() => ThrowCodec.decode("x")).toThrow(CodecError);
    });
});
