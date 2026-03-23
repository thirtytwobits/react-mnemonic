# Interface: CreateSchemaRegistryOptions

Defined in: [src/Mnemonic/types.ts:639](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L639)

Input options for [createSchemaRegistry](../functions/createSchemaRegistry.md).

Use this helper when your registry contents are known up front and do not
need runtime mutation. The returned registry is immutable and optimized for
the common `"default"` / `"strict"` setup.

For most apps, this should be your default entry point for schema-managed
persistence. Implement [SchemaRegistry](SchemaRegistry.md) manually only when you need
custom lookup behavior or runtime schema registration beyond autoschema mode.

## Properties

### migrations?

> `optional` **migrations**: readonly [`MigrationRule`](../type-aliases/MigrationRule.md)\<`unknown`, `unknown`, `string`\>[]

Defined in: [src/Mnemonic/types.ts:656](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L656)

Migration rules to index by key and version edge.

Write-time normalizers (`fromVersion === toVersion`) are indexed
separately from read-time migration edges. Ambiguous outgoing edges,
backward migrations, and duplicate write normalizers are rejected up
front with `SchemaError("MIGRATION_GRAPH_INVALID")`.

---

### schemas?

> `optional` **schemas**: readonly [`KeySchema`](../type-aliases/KeySchema.md)\<`unknown`, `string`, [`JsonSchema`](JsonSchema.md)\>[]

Defined in: [src/Mnemonic/types.ts:646](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L646)

Versioned schemas to index by key and version.

Duplicate `key + version` pairs are rejected up front with
`SchemaError("SCHEMA_REGISTRATION_CONFLICT")`.
