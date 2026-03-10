# Type Alias: TypedKeySchema\<TSchema, K\>

> **TypedKeySchema**\<`TSchema`, `K`\> = [`KeySchema`](KeySchema.md)\<[`InferJsonSchemaValue`](InferJsonSchemaValue.md)\<`TSchema`\>, `K`, `TSchema`\>

Defined in: [src/Mnemonic/types.ts:1156](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L1156)

Typed key schema shape inferred from a schema helper or branded JSON Schema.

Useful when you want a versioned schema object to carry its decoded
TypeScript value through registries, descriptors, and migration helpers.

## Type Parameters

| Type Parameter                                                  | Default type |
| --------------------------------------------------------------- | ------------ |
| `TSchema` _extends_ [`JsonSchema`](../interfaces/JsonSchema.md) | -            |
| `K` _extends_ `string`                                          | `string`     |
