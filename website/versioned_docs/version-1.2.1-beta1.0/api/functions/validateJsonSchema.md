# Function: validateJsonSchema()

> **validateJsonSchema**(`value`, `schema`, `path?`): [`JsonSchemaValidationError`](../type-aliases/JsonSchemaValidationError.md)[]

Defined in: [src/Mnemonic/json-schema.ts:541](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/json-schema.ts#L541)

Validates a value against a [JsonSchema](../interfaces/JsonSchema.md).

Returns an empty array when the value is valid.
Returns one or more [JsonSchemaValidationError](../type-aliases/JsonSchemaValidationError.md) entries on failure.
Short-circuits on type mismatch (does not report downstream keyword errors).

## Parameters

| Parameter | Type                                        | Default value | Description                                                     |
| --------- | ------------------------------------------- | ------------- | --------------------------------------------------------------- |
| `value`   | `unknown`                                   | `undefined`   | The value to validate                                           |
| `schema`  | [`JsonSchema`](../interfaces/JsonSchema.md) | `undefined`   | The JSON Schema to validate against                             |
| `path`    | `string`                                    | `""`          | Internal: JSON Pointer path for error reporting (default: `""`) |

## Returns

[`JsonSchemaValidationError`](../type-aliases/JsonSchemaValidationError.md)[]

Array of validation errors (empty = valid)
