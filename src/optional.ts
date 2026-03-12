// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

export { useMnemonicKeyOptional, useMnemonicOptional } from "./Mnemonic/use-key-optional";
export { defineMnemonicKey } from "./Mnemonic/key-optional";
export type {
    Codec,
    MnemonicKeyState,
    MnemonicOptionalBridge,
    OptionalMnemonicKeyDescriptor as MnemonicKeyDescriptor,
    OptionalMnemonicKeyDescriptor,
    OptionalMnemonicKeyOptions as UseMnemonicKeyOptions,
    OptionalMnemonicKeyOptions,
    OptionalMnemonicKeySSRConfig,
} from "./Mnemonic/types";
