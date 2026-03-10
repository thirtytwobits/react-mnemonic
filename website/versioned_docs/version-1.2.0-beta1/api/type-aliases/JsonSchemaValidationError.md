# Type Alias: JsonSchemaValidationError

> **JsonSchemaValidationError** = `object`

Defined in: [src/Mnemonic/json-schema.ts:92](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/json-schema.ts#L92)

A single validation error produced by [validateJsonSchema](../functions/validateJsonSchema.md).

## Properties

### keyword

> **keyword**: `string`

Defined in: [src/Mnemonic/json-schema.ts:98](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/json-schema.ts#L98)

The JSON Schema keyword that failed.

---

### message

> **message**: `string`

Defined in: [src/Mnemonic/json-schema.ts:96](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/json-schema.ts#L96)

Human-readable error description.

---

### path

> **path**: `string`

Defined in: [src/Mnemonic/json-schema.ts:94](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/json-schema.ts#L94)

JSON Pointer path to the failing value (e.g., "/foo/bar/0"). Empty string for root.
