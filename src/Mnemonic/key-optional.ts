// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import type { OptionalMnemonicKeyDescriptor, OptionalMnemonicKeyOptions } from "./types";

/**
 * Define a reusable, importable contract for a lean optionally persistent key.
 */
export function defineMnemonicKey<const K extends string, T>(
    key: K,
    options: OptionalMnemonicKeyOptions<T>,
): OptionalMnemonicKeyDescriptor<T, K> {
    return Object.freeze({
        key,
        options,
    });
}
