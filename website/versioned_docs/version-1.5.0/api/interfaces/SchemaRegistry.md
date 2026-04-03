# Interface: SchemaRegistry

Defined in: [src/Mnemonic/types.ts:695](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L695)

Lookup and registration API for key schemas and migration paths.

Implementations of this interface are passed to `MnemonicProvider` via the
`schemaRegistry` option. The provider calls these methods at read and write
time to resolve the correct JSON Schema and migration chain for each
stored value.

In `"default"` and `"strict"` modes, callers should treat registry contents
as immutable after provider initialization. The hook caches lookups to keep
read/write hot paths fast. `"autoschema"` remains mutable to support
inferred schema registration.

Most applications should prefer [createSchemaRegistry](../functions/createSchemaRegistry.md) instead of
implementing this interface manually. Manual implementations are mainly for
advanced cases such as custom backing stores, dynamic schema discovery, or
adapter layers around an existing registry system.

## Example

```typescript
const registry = createSchemaRegistry({
  schemas: [
    { key: "settings", version: 1, schema: { type: "object", required: ["theme"] } },
  ],
  migrations: [],
});

<MnemonicProvider namespace="app" schemaRegistry={registry} schemaMode="strict">
  <App />
</MnemonicProvider>
```

## See

- [KeySchema](../type-aliases/KeySchema.md) - Schema definition
- [MigrationPath](../type-aliases/MigrationPath.md) - Migration chain returned by `getMigrationPath`
- [SchemaMode](../type-aliases/SchemaMode.md) - How the provider uses the registry

## Methods

### getLatestSchema()

> **getLatestSchema**(`key`): [`KeySchema`](../type-aliases/KeySchema.md)\<`unknown`, `string`, [`JsonSchema`](JsonSchema.md)\> \| `undefined`

Defined in: [src/Mnemonic/types.ts:714](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L714)

Look up the highest-version schema registered for a key.

Used by the write path to determine which version to stamp on new
values, and by the read path to detect when a migration is needed.

#### Parameters

| Parameter | Type     | Description                |
| --------- | -------- | -------------------------- |
| `key`     | `string` | The unprefixed storage key |

#### Returns

[`KeySchema`](../type-aliases/KeySchema.md)\<`unknown`, `string`, [`JsonSchema`](JsonSchema.md)\> \| `undefined`

The latest schema, or `undefined` if none is registered

---

### getMigrationPath()

> **getMigrationPath**(`key`, `fromVersion`, `toVersion`): [`MigrationPath`](../type-aliases/MigrationPath.md)\<`string`\> \| `null`

Defined in: [src/Mnemonic/types.ts:728](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L728)

Resolve an ordered migration path between two versions of a key.

Returns `null` when no contiguous path exists. The returned rules
are applied in order to transform data from `fromVersion` to
`toVersion`.

#### Parameters

| Parameter     | Type     | Description                       |
| ------------- | -------- | --------------------------------- |
| `key`         | `string` | The unprefixed storage key        |
| `fromVersion` | `number` | The stored data's current version |
| `toVersion`   | `number` | The target version to migrate to  |

#### Returns

[`MigrationPath`](../type-aliases/MigrationPath.md)\<`string`\> \| `null`

An ordered array of migration rules, or `null`

---

### getSchema()

> **getSchema**(`key`, `version`): [`KeySchema`](../type-aliases/KeySchema.md)\<`unknown`, `string`, [`JsonSchema`](JsonSchema.md)\> \| `undefined`

Defined in: [src/Mnemonic/types.ts:703](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L703)

Look up the schema registered for a specific key and version.

#### Parameters

| Parameter | Type     | Description                   |
| --------- | -------- | ----------------------------- |
| `key`     | `string` | The unprefixed storage key    |
| `version` | `number` | The version number to look up |

#### Returns

[`KeySchema`](../type-aliases/KeySchema.md)\<`unknown`, `string`, [`JsonSchema`](JsonSchema.md)\> \| `undefined`

The matching schema, or `undefined` if none is registered

---

### getWriteMigration()?

> `optional` **getWriteMigration**(`key`, `version`): [`MigrationRule`](../type-aliases/MigrationRule.md)\<`unknown`, `unknown`, `string`\> \| `undefined`

Defined in: [src/Mnemonic/types.ts:745](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L745)

Look up a write-time normalizer for a specific key and version.

A write-time normalizer is a [MigrationRule](../type-aliases/MigrationRule.md) where
`fromVersion === toVersion`. It runs on every write to that version,
transforming the value before storage. The normalized value is
re-validated against the schema after transformation.

Optional. When not implemented or returns `undefined`, no write-time
normalization is applied.

#### Parameters

| Parameter | Type     | Description                |
| --------- | -------- | -------------------------- |
| `key`     | `string` | The unprefixed storage key |
| `version` | `number` | The target schema version  |

#### Returns

[`MigrationRule`](../type-aliases/MigrationRule.md)\<`unknown`, `unknown`, `string`\> \| `undefined`

The normalizer rule, or `undefined` if none is registered

---

### registerSchema()?

> `optional` **registerSchema**(`schema`): `void`

Defined in: [src/Mnemonic/types.ts:757](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L757)

Register a new schema.

Optional. Required when `schemaMode` is `"autoschema"` so the
library can persist inferred schemas. Implementations should throw
if a schema already exists for the same key + version with a
conflicting definition.

#### Parameters

| Parameter | Type                                        | Description            |
| --------- | ------------------------------------------- | ---------------------- |
| `schema`  | [`KeySchema`](../type-aliases/KeySchema.md) | The schema to register |

#### Returns

`void`
