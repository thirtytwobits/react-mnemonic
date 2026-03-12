// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, expect, it } from "vitest";
import * as optionalExports from "./optional";
import type { OptionalMnemonicKeyDescriptor, OptionalMnemonicKeyOptions } from "./optional";

describe("Optional public API exports", () => {
    it("exports only the lean optional runtime surface", () => {
        expect(optionalExports.useMnemonicKeyOptional).toBeDefined();
        expect(optionalExports.useMnemonicOptional).toBeDefined();
        expect(optionalExports.defineMnemonicKey).toBeDefined();
        expect("useMnemonicOrMemoryStore" in optionalExports).toBe(false);
        expect("useMnemonicRecoveryOptional" in optionalExports).toBe(false);
        expect("createCodec" in optionalExports).toBe(false);
        expect("JSONCodec" in optionalExports).toBe(false);
    });

    it("type exports are usable", () => {
        const descriptor: OptionalMnemonicKeyDescriptor<number, "count"> = optionalExports.defineMnemonicKey("count", {
            defaultValue: 0,
        });
        const options: OptionalMnemonicKeyOptions<string> = {
            defaultValue: "draft",
            ssr: {
                serverValue: "server-draft",
            },
        };

        expect(descriptor.key).toBe("count");
        expect(options.ssr?.serverValue).toBe("server-draft");
    });
});
