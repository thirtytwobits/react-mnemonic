# Function: defineMigration()

> **defineMigration**\<`K`, `TFrom`, `TTo`\>(`fromSchema`, `toSchema`, `migrate`): [`MigrationRule`](../type-aliases/MigrationRule.md)\<`TFrom`, `TTo`, `K`\>

Defined in: [src/Mnemonic/schema-helpers.ts:31](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/schema-helpers.ts#L31)

Create a typed migration rule between two key schema versions.

The `migrate(...)` callback is inferred from the source and target schemas,
which keeps migration logic aligned with the registered runtime schemas.

## Type Parameters

| Type Parameter         |
| ---------------------- |
| `K` _extends_ `string` |
| `TFrom`                |
| `TTo`                  |

## Parameters

| Parameter    | Type                                                        |
| ------------ | ----------------------------------------------------------- |
| `fromSchema` | [`KeySchema`](../type-aliases/KeySchema.md)\<`TFrom`, `K`\> |
| `toSchema`   | [`KeySchema`](../type-aliases/KeySchema.md)\<`TTo`, `K`\>   |
| `migrate`    | (`value`) => `TTo`                                          |

## Returns

[`MigrationRule`](../type-aliases/MigrationRule.md)\<`TFrom`, `TTo`, `K`\>
