// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

export { MnemonicProvider, MnemonicProviderProps } from "./Mnemonic/provider";
export { useMnemonicKey } from "./Mnemonic/use";
export { useMnemonicRecovery } from "./Mnemonic/recovery";
export { createSchemaRegistry } from "./Mnemonic/schema-registry";
export { JSONCodec, createCodec, CodecError } from "./Mnemonic/codecs";
export { SchemaError } from "./Mnemonic/schema";
export { validateJsonSchema, compileSchema } from "./Mnemonic/json-schema";
export { findNodeById, insertChildIfMissing, renameNode, dedupeChildrenBy } from "./Mnemonic/structural-migrations";
export type { JsonSchema, JsonSchemaType, JsonSchemaValidationError, CompiledValidator } from "./Mnemonic/json-schema";
export type { StructuralNode, StructuralTreeHelpers } from "./Mnemonic/structural-migrations";
export type {
    Codec,
    Listener,
    Mnemonic,
    MnemonicRecoveryAction,
    MnemonicRecoveryEvent,
    MnemonicRecoveryHook,
    MnemonicProviderOptions,
    UseMnemonicKeyOptions,
    UseMnemonicRecoveryOptions,
    ReconcileContext,
    StorageLike,
    SchemaMode,
    CreateSchemaRegistryOptions,
    KeySchema,
    MigrationRule,
    MigrationPath,
    SchemaRegistry,
    MnemonicDevToolsWeakRef,
    MnemonicDevToolsProviderApi,
    MnemonicDevToolsProviderEntry,
    MnemonicDevToolsProviderDescriptor,
    MnemonicDevToolsCapabilities,
    MnemonicDevToolsMeta,
    MnemonicDevToolsRegistry,
    Unsubscribe,
} from "./Mnemonic/types";
