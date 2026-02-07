// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect } from "vitest";
import {
    MnemonicProvider,
    useMnemonicKey,
    JSONCodec,
    StringCodec,
    NumberCodec,
    BooleanCodec,
    createCodec,
} from "./index";
import type { Codec, MnemonicProviderOptions, UseMnemonicKeyOptions } from "./index";

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

    it("exports StringCodec", () => {
        expect(StringCodec).toBeDefined();
        expect(typeof StringCodec.encode).toBe("function");
        expect(typeof StringCodec.decode).toBe("function");
    });

    it("exports NumberCodec", () => {
        expect(NumberCodec).toBeDefined();
        expect(typeof NumberCodec.encode).toBe("function");
        expect(typeof NumberCodec.decode).toBe("function");
    });

    it("exports BooleanCodec", () => {
        expect(BooleanCodec).toBeDefined();
        expect(typeof BooleanCodec.encode).toBe("function");
        expect(typeof BooleanCodec.decode).toBe("function");
    });

    it("exports createCodec", () => {
        expect(createCodec).toBeDefined();
        expect(typeof createCodec).toBe("function");
    });

    it("type exports are usable (Codec)", () => {
        // This verifies the type export compiles correctly
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
});
