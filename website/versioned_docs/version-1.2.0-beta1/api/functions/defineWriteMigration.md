# Function: defineWriteMigration()

> **defineWriteMigration**\<`K`, `TValue`\>(`schema`, `migrate`): [`MigrationRule`](../type-aliases/MigrationRule.md)\<`TValue`, `TValue`, `K`\>

Defined in: [src/Mnemonic/schema-helpers.ts:54](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/schema-helpers.ts#L54)

Create a typed write-time normalization rule for a single key schema.

## Type Parameters

| Type Parameter         |
| ---------------------- |
| `K` _extends_ `string` |
| `TValue`               |

## Parameters

| Parameter | Type                                                         |
| --------- | ------------------------------------------------------------ |
| `schema`  | [`KeySchema`](../type-aliases/KeySchema.md)\<`TValue`, `K`\> |
| `migrate` | (`value`) => `TValue`                                        |

## Returns

[`MigrationRule`](../type-aliases/MigrationRule.md)\<`TValue`, `TValue`, `K`\>
