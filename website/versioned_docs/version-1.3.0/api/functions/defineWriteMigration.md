# Function: defineWriteMigration()

> **defineWriteMigration**\<`K`, `TValue`\>(`schema`, `migrate`): [`MigrationRule`](../type-aliases/MigrationRule.md)\<`TValue`, `TValue`, `K`\>

Defined in: [src/Mnemonic/schema-helpers.ts:54](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/schema-helpers.ts#L54)

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
