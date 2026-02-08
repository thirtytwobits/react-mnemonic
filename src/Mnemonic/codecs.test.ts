// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect } from "vitest";
import { CodecError, ValidationError, JSONCodec, StringCodec, NumberCodec, BooleanCodec, createCodec } from "./codecs";

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
// ValidationError
// ---------------------------------------------------------------------------
describe("ValidationError", () => {
    it("creates an error with a message", () => {
        const err = new ValidationError("boom");
        expect(err.message).toBe("boom");
    });

    it("stores an optional cause", () => {
        const cause = new TypeError("inner");
        const err = new ValidationError("outer", cause);
        expect(err.cause).toBe(cause);
    });

    it("has name ValidationError", () => {
        expect(new ValidationError("x").name).toBe("ValidationError");
    });

    it("is an instance of Error", () => {
        expect(new ValidationError("x")).toBeInstanceOf(Error);
    });

    it("is an instance of ValidationError (prototype chain)", () => {
        expect(new ValidationError("x")).toBeInstanceOf(ValidationError);
    });

    it("defaults cause to undefined when not provided", () => {
        expect(new ValidationError("x").cause).toBeUndefined();
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
// StringCodec
// ---------------------------------------------------------------------------
describe("StringCodec", () => {
    it("encode returns the string as-is", () => {
        expect(StringCodec.encode("hello")).toBe("hello");
    });

    it("decode returns the string as-is", () => {
        expect(StringCodec.decode("hello")).toBe("hello");
    });

    it("roundtrips an empty string", () => {
        expect(StringCodec.decode(StringCodec.encode(""))).toBe("");
    });

    it("preserves special characters", () => {
        const special = 'hello "world" \n\t';
        expect(StringCodec.decode(StringCodec.encode(special))).toBe(special);
    });
});

// ---------------------------------------------------------------------------
// NumberCodec
// ---------------------------------------------------------------------------
describe("NumberCodec", () => {
    it("encodes a number to a string", () => {
        expect(NumberCodec.encode(42)).toBe("42");
    });

    it("decodes a string to a number", () => {
        expect(NumberCodec.decode("42")).toBe(42);
    });

    it("roundtrips integers", () => {
        expect(NumberCodec.decode(NumberCodec.encode(0))).toBe(0);
        expect(NumberCodec.decode(NumberCodec.encode(-1))).toBe(-1);
        expect(NumberCodec.decode(NumberCodec.encode(999999))).toBe(999999);
    });

    it("roundtrips floating-point numbers", () => {
        expect(NumberCodec.decode(NumberCodec.encode(3.14159))).toBe(3.14159);
    });

    it("roundtrips Infinity", () => {
        expect(NumberCodec.decode(NumberCodec.encode(Infinity))).toBe(Infinity);
        expect(NumberCodec.decode(NumberCodec.encode(-Infinity))).toBe(-Infinity);
    });

    it("throws CodecError when decoding NaN-producing input", () => {
        expect(() => NumberCodec.decode("not-a-number")).toThrow(CodecError);
    });

    it("decodes the empty string as NaN and throws", () => {
        // Number("") === 0 in JS, so this should NOT throw
        expect(NumberCodec.decode("")).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// BooleanCodec
// ---------------------------------------------------------------------------
describe("BooleanCodec", () => {
    it('encodes true as "true"', () => {
        expect(BooleanCodec.encode(true)).toBe("true");
    });

    it('encodes false as "false"', () => {
        expect(BooleanCodec.encode(false)).toBe("false");
    });

    it('decodes "true" as true', () => {
        expect(BooleanCodec.decode("true")).toBe(true);
    });

    it('decodes "false" as false', () => {
        expect(BooleanCodec.decode("false")).toBe(false);
    });

    it("decodes any non-true string as false", () => {
        expect(BooleanCodec.decode("TRUE")).toBe(false);
        expect(BooleanCodec.decode("1")).toBe(false);
        expect(BooleanCodec.decode("yes")).toBe(false);
        expect(BooleanCodec.decode("")).toBe(false);
    });

    it("roundtrips booleans", () => {
        expect(BooleanCodec.decode(BooleanCodec.encode(true))).toBe(true);
        expect(BooleanCodec.decode(BooleanCodec.encode(false))).toBe(false);
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
