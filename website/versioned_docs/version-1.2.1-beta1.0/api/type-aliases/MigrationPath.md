# Type Alias: MigrationPath\<K\>

> **MigrationPath**\<`K`\> = [`MigrationRule`](MigrationRule.md)\<`unknown`, `unknown`, `K`\>[]

Defined in: [src/Mnemonic/types.ts:550](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L550)

An ordered sequence of [MigrationRule](MigrationRule.md) steps that upgrades stored
data from an older schema version to a newer one.

The rules are applied in array order. Each step's output becomes the
next step's input. After the final step the result is validated against
the target schema and persisted back to storage so the migration only
runs once per key.

## Type Parameters

| Type Parameter         | Default type |
| ---------------------- | ------------ |
| `K` _extends_ `string` | `string`     |

## See

- [MigrationRule](MigrationRule.md) - Individual migration step
- [SchemaRegistry.getMigrationPath](../interfaces/SchemaRegistry.md#getmigrationpath) - Resolves a path between versions
