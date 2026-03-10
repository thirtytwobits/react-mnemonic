# Type Alias: SchemaMode

> **SchemaMode** = `"strict"` \| `"default"` \| `"autoschema"`

Defined in: [src/Mnemonic/types.ts:232](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L232)

Controls how the provider enforces versioned schemas on stored values.

- `"default"` — Schemas are optional. When a schema exists for the stored
  version it is used for validation; otherwise the hook's `codec` option is
  used directly with no validation. This is the recommended starting mode.

- `"strict"` — Every read and write **must** have a registered schema for
  the stored version. If no matching schema is found the value falls back
  to `defaultValue` with a `SchemaError` (`SCHEMA_NOT_FOUND` on reads,
  `WRITE_SCHEMA_REQUIRED` on writes).
  When no schemas are registered and no explicit schema is provided, writes
  fall back to a codec-encoded (v0) envelope.

- `"autoschema"` — Like `"default"`, but when a key has **no** schema
  registered at all, the library infers a JSON Schema at version 1 from the
  first successfully decoded value and registers it via
  `SchemaRegistry.registerSchema`. Subsequent reads/writes for that key
  then behave as if the schema had been registered manually.

## Remarks

In `"default"` and `"strict"` modes, registry lookups are cached under the
assumption that the schema registry is immutable for the lifetime of the
provider. If you need to update schemas, publish a new app version and
remount the provider. `"autoschema"` does not assume immutability.

## Default

```ts
"default";
```

## See

- [SchemaRegistry](../interfaces/SchemaRegistry.md) - Registry that stores schemas and migrations
- [KeySchema](KeySchema.md) - Individual schema definition
