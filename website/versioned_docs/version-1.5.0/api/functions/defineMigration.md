# Function: defineMigration()

> **defineMigration**\<`K`, `TFrom`, `TTo`\>(`fromSchema`, `toSchema`, `migrate`): [`MigrationRule`](../type-aliases/MigrationRule.md)\<`TFrom`, `TTo`, `K`\>

Defined in: [src/Mnemonic/schema-helpers.ts:31](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/schema-helpers.ts#L31)

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
