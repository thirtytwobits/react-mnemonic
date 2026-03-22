// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * Schema-light public entrypoint.
 *
 * `react-mnemonic/core` exposes the provider and hooks without the schema
 * registry helpers used by the schema-aware entrypoints.
 */

export { MnemonicProvider, type MnemonicProviderOptions, type MnemonicProviderProps } from "./Mnemonic/provider-core";
export { useMnemonicKey } from "./Mnemonic/use-core";
export { useMnemonicRecovery } from "./Mnemonic/recovery";
export { defineMnemonicKey } from "./Mnemonic/key";
export { JSONCodec, createCodec, CodecError } from "./Mnemonic/codecs";
export { SchemaError } from "./Mnemonic/schema";
export type {
    Codec,
    MnemonicKeyDescriptor,
    Listener,
    Mnemonic,
    MnemonicKeyState,
    MnemonicRecoveryAction,
    MnemonicRecoveryEvent,
    MnemonicRecoveryHook,
    UseMnemonicKeyOptions,
    UseMnemonicRecoveryOptions,
    ReconcileContext,
    StorageLike,
    SchemaMode,
    MnemonicDevToolsWeakRef,
    MnemonicDevToolsProviderApi,
    MnemonicDevToolsProviderEntry,
    MnemonicDevToolsProviderDescriptor,
    MnemonicDevToolsCapabilities,
    MnemonicDevToolsMeta,
    MnemonicDevToolsRegistry,
    MnemonicHydrationMode,
    MnemonicBootstrapSeed,
    MnemonicBootstrapSnapshot,
    MnemonicProviderSSRConfig,
    MnemonicKeySSRConfig,
    Unsubscribe,
} from "./Mnemonic/types";
