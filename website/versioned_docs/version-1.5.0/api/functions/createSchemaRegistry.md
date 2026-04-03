# Function: createSchemaRegistry()

> **createSchemaRegistry**(`options?`): [`SchemaRegistry`](../interfaces/SchemaRegistry.md)

Defined in: [src/Mnemonic/schema-registry.ts:41](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/schema-registry.ts#L41)

Create an immutable schema registry for common default/strict-mode setups.

The helper indexes schemas and migrations up front, validates duplicate and
ambiguous definitions, and returns a [SchemaRegistry](../interfaces/SchemaRegistry.md) ready to pass to
`MnemonicProvider`.

Most applications should prefer this helper over manually implementing
[SchemaRegistry](../interfaces/SchemaRegistry.md).

See the
[Schema Migration guide](https://thirtytwobits.github.io/react-mnemonic/docs/guides/schema-migration)
for end-to-end registry and migration patterns.

## Parameters

| Parameter | Type                                                                          | Description                              |
| --------- | ----------------------------------------------------------------------------- | ---------------------------------------- |
| `options` | [`CreateSchemaRegistryOptions`](../interfaces/CreateSchemaRegistryOptions.md) | Initial schema and migration definitions |

## Returns

[`SchemaRegistry`](../interfaces/SchemaRegistry.md)

An indexed immutable schema registry

## Throws

With `SCHEMA_REGISTRATION_CONFLICT` for duplicate
schemas, or `MIGRATION_GRAPH_INVALID` for invalid migration graphs
