// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * Schema-aware public entrypoint.
 *
 * `react-mnemonic/schema` includes the provider, hooks, schema registry
 * helpers, and migration utilities needed for strict schema enforcement and
 * structural upgrades.
 */

export { MnemonicProvider, MnemonicProviderProps } from "./Mnemonic/provider";
export { useMnemonicKey } from "./Mnemonic/use";
export { useMnemonicRecovery } from "./Mnemonic/recovery";
export { defineMnemonicKey } from "./Mnemonic/key";
export { createSchemaRegistry } from "./Mnemonic/schema-registry";
export { defineKeySchema, defineMigration, defineWriteMigration } from "./Mnemonic/schema-helpers";
export { JSONCodec, createCodec, CodecError } from "./Mnemonic/codecs";
export { SchemaError } from "./Mnemonic/schema";
export { validateJsonSchema, compileSchema } from "./Mnemonic/json-schema";
export { mnemonicSchema } from "./Mnemonic/typed-schema";
export { findNodeById, insertChildIfMissing, renameNode, dedupeChildrenBy } from "./Mnemonic/structural-migrations";
export type { JsonSchema, JsonSchemaType, JsonSchemaValidationError, CompiledValidator } from "./Mnemonic/json-schema";
export type { TypedJsonSchema, InferJsonSchemaValue } from "./Mnemonic/typed-schema";
export type { StructuralNode, StructuralTreeHelpers } from "./Mnemonic/structural-migrations";
export type {
    Codec,
    MnemonicKeyDescriptor,
    Listener,
    Mnemonic,
    MnemonicFlushResult,
    MnemonicKeyState,
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
    TypedKeySchema,
    MigrationRule,
    MigrationPath,
    SchemaRegistry,
    SchemaBoundKeyOptions,
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
