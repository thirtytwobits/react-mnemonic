// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * Public bootstrap entrypoint for first-paint recall helpers.
 *
 * Import from `react-mnemonic/bootstrap` when you need to synchronously read
 * persisted mnemonic values before React mounts and then seed a
 * `MnemonicProvider` with the same raw snapshot.
 */

export { recallMnemonic, applyMnemonicBootstrap } from "./Mnemonic/bootstrap";
export { JSONCodec, createCodec, CodecError } from "./Mnemonic/codecs";
export { SchemaError } from "./Mnemonic/schema";
export type {
    MnemonicBootstrapKeyDefinition,
    MnemonicBootstrapKeyInput,
    RecallMnemonicOptions,
} from "./Mnemonic/bootstrap";
export type {
    Codec,
    MnemonicBootstrapSeed,
    MnemonicBootstrapSnapshot,
    MnemonicKeyDescriptor,
    ReconcileContext,
    SchemaMode,
    SchemaRegistry,
    StorageLike,
    UseMnemonicKeyOptions,
} from "./Mnemonic/types";
