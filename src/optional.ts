// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

export { useMnemonicKeyOptional, useMnemonicOptional } from "./Mnemonic/use-key-optional";
export { defineMnemonicKey } from "./Mnemonic/key-optional";
export type {
    Codec,
    MnemonicOptionalBridge,
    OptionalMnemonicKeyDescriptor,
    OptionalMnemonicKeyOptions,
    OptionalMnemonicKeySSRConfig,
} from "./Mnemonic/types";
export type {
    MnemonicKeyState,
    OptionalMnemonicKeyDescriptor as MnemonicKeyDescriptor,
    OptionalMnemonicKeyOptions as UseMnemonicKeyOptions,
} from "./Mnemonic/types";
