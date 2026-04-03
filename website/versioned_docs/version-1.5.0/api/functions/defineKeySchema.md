# Function: defineKeySchema()

> **defineKeySchema**\<`K`, `TSchema`\>(`key`, `version`, `schema`): [`KeySchema`](../type-aliases/KeySchema.md)\<[`InferJsonSchemaValue`](../type-aliases/InferJsonSchemaValue.md)\<`TSchema`\>, `K`, `TSchema`\>

Defined in: [src/Mnemonic/schema-helpers.ts:13](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/schema-helpers.ts#L13)

Create a versioned key schema that preserves the decoded value type inferred
from a typed schema helper.

## Type Parameters

| Type Parameter                                                  |
| --------------------------------------------------------------- |
| `K` _extends_ `string`                                          |
| `TSchema` _extends_ [`JsonSchema`](../interfaces/JsonSchema.md) |

## Parameters

| Parameter | Type      |
| --------- | --------- |
| `key`     | `K`       |
| `version` | `number`  |
| `schema`  | `TSchema` |

## Returns

[`KeySchema`](../type-aliases/KeySchema.md)\<[`InferJsonSchemaValue`](../type-aliases/InferJsonSchemaValue.md)\<`TSchema`\>, `K`, `TSchema`\>
