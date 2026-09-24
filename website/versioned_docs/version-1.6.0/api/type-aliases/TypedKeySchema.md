# Type Alias: TypedKeySchema\<TSchema, K\>

> **TypedKeySchema**\<`TSchema`, `K`\> = [`KeySchema`](KeySchema.md)\<[`InferJsonSchemaValue`](InferJsonSchemaValue.md)\<`TSchema`\>, `K`, `TSchema`\>

Defined in: [src/Mnemonic/types.ts:1592](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1592)

Typed key schema shape inferred from a schema helper or branded JSON Schema.

Useful when you want a versioned schema object to carry its decoded
TypeScript value through registries, descriptors, and migration helpers.

## Type Parameters

| Type Parameter                                                  | Default type |
| --------------------------------------------------------------- | ------------ |
| `TSchema` _extends_ [`JsonSchema`](../interfaces/JsonSchema.md) | -            |
| `K` _extends_ `string`                                          | `string`     |
