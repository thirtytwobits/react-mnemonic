# Type Alias: TypedKeySchema\<TSchema, K\>

> **TypedKeySchema**\<`TSchema`, `K`\> = [`KeySchema`](KeySchema.md)\<[`InferJsonSchemaValue`](InferJsonSchemaValue.md)\<`TSchema`\>, `K`, `TSchema`\>

Defined in: [src/Mnemonic/types.ts:1254](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1254)

Typed key schema shape inferred from a schema helper or branded JSON Schema.

Useful when you want a versioned schema object to carry its decoded
TypeScript value through registries, descriptors, and migration helpers.

## Type Parameters

| Type Parameter                                                  | Default type |
| --------------------------------------------------------------- | ------------ |
| `TSchema` _extends_ [`JsonSchema`](../interfaces/JsonSchema.md) | -            |
| `K` _extends_ `string`                                          | `string`     |
