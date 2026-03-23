# Function: compileSchema()

> **compileSchema**(`schema`): [`CompiledValidator`](../type-aliases/CompiledValidator.md)

Defined in: [src/Mnemonic/json-schema.ts:197](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/json-schema.ts#L197)

Pre-compiles a [JsonSchema](../interfaces/JsonSchema.md) into a reusable validation function.

Inspects the schema once and builds a specialized closure that
eliminates runtime branching for unused keywords, pre-converts
`required` arrays to `Set`s, recursively pre-compiles nested property
and item schemas, and pre-builds primitive `Set`s for O(1) enum
lookups when possible.

Results are cached by schema object identity in a `WeakMap`, so
calling `compileSchema` with the same schema reference is free
after the first call.

## Parameters

| Parameter | Type                                        | Description                |
| --------- | ------------------------------------------- | -------------------------- |
| `schema`  | [`JsonSchema`](../interfaces/JsonSchema.md) | The JSON Schema to compile |

## Returns

[`CompiledValidator`](../type-aliases/CompiledValidator.md)

A compiled validation function
