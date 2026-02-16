// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

export { MnemonicProvider, MnemonicProviderProps } from "./Mnemonic/provider";
export { useMnemonicKey } from "./Mnemonic/use";
export {
  JSONCodec,
  createCodec,
  CodecError,
} from "./Mnemonic/codecs";
export { SchemaError } from "./Mnemonic/schema";
export { validateJsonSchema, compileSchema } from "./Mnemonic/json-schema";
export type { JsonSchema, JsonSchemaType, JsonSchemaValidationError, CompiledValidator } from "./Mnemonic/json-schema";
export type {
  Codec,
  MnemonicProviderOptions,
  UseMnemonicKeyOptions,
  StorageLike,
  SchemaMode,
  KeySchema,
  MigrationRule,
  MigrationPath,
  SchemaRegistry,
} from "./Mnemonic/types";
