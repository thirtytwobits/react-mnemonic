# Type Alias: KeySchema\<TValue, K, TSchema\>

> **KeySchema**\<`TValue`, `K`, `TSchema`\> = `object`

Defined in: [src/Mnemonic/types.ts:432](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L432)

Schema definition for a single key at a specific version.

Each registered schema binds a storage key + version number to a
JSON Schema that validates the payload. Schemas are fully serializable
(no functions).

When the provider reads a value whose envelope version matches a
registered schema, the payload is validated against the schema's
JSON Schema definition.

## Example

```typescript
const userSchemaV1: KeySchema = {
    key: "user",
    version: 1,
    schema: {
        type: "object",
        properties: {
            name: { type: "string" },
        },
        required: ["name"],
    },
};
```

## See

- [SchemaRegistry](../interfaces/SchemaRegistry.md) - Where schemas are registered and looked up
- [MigrationRule](MigrationRule.md) - How values migrate between schema versions
- [JsonSchema](../interfaces/JsonSchema.md) - The JSON Schema subset used for validation

## Type Parameters

| Type Parameter                                                  | Default type                                |
| --------------------------------------------------------------- | ------------------------------------------- |
| `TValue`                                                        | `unknown`                                   |
| `K` _extends_ `string`                                          | `string`                                    |
| `TSchema` _extends_ [`JsonSchema`](../interfaces/JsonSchema.md) | [`JsonSchema`](../interfaces/JsonSchema.md) |

## Properties

### \[keySchemaValueBrand\]?

> `readonly` `optional` **\[keySchemaValueBrand\]**: `TValue`

Defined in: [src/Mnemonic/types.ts:460](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L460)

Phantom type linking this runtime schema to its decoded TypeScript value.

This field is never set at runtime. It exists only so helpers such as
`defineKeySchema(...)`, `defineMnemonicKey(...)`, and `defineMigration(...)`
can preserve a single source of truth between schema shape and value type.

---

### key

> **key**: `K`

Defined in: [src/Mnemonic/types.ts:436](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L436)

The unprefixed storage key this schema applies to.

---

### schema

> **schema**: `TSchema`

Defined in: [src/Mnemonic/types.ts:451](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L451)

JSON Schema that validates the payload at this version.

Only the subset of JSON Schema keywords defined in [JsonSchema](../interfaces/JsonSchema.md)
are supported. An empty schema `{}` accepts any value.

---

### version

> **version**: `number`

Defined in: [src/Mnemonic/types.ts:443](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L443)

The version number for this schema.

Must be a non-negative integer. Any version (including `0`) is valid.
