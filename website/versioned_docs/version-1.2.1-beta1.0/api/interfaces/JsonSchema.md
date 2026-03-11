# Interface: JsonSchema

Defined in: [src/Mnemonic/json-schema.ts:38](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/json-schema.ts#L38)

A subset of JSON Schema sufficient for localStorage state management.

Supported keywords:
type, enum, const,
minimum, maximum, exclusiveMinimum, exclusiveMaximum,
minLength, maxLength,
properties, required, additionalProperties,
items, minItems, maxItems

Deliberately omitted: $ref, $id, $schema, $defs, allOf, anyOf,
oneOf, not, pattern, format, patternProperties, if/then/else,
dependencies, uniqueItems, multipleOf, propertyNames.

An empty schema `{}` accepts any value.

## Properties

### additionalProperties?

> `optional` **additionalProperties**: `boolean` \| `JsonSchema`

Defined in: [src/Mnemonic/json-schema.ts:77](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/json-schema.ts#L77)

Controls extra properties not listed in `properties`.
`false` disallows them. A schema validates their values.
`true` (or omitted) allows anything.

---

### const?

> `optional` **const**: `unknown`

Defined in: [src/Mnemonic/json-schema.ts:46](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/json-schema.ts#L46)

The value must be deeply equal to this exact value.

---

### enum?

> `optional` **enum**: readonly `unknown`[]

Defined in: [src/Mnemonic/json-schema.ts:43](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/json-schema.ts#L43)

The value must be deeply equal to one of these entries.

---

### exclusiveMaximum?

> `optional` **exclusiveMaximum**: `number`

Defined in: [src/Mnemonic/json-schema.ts:58](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/json-schema.ts#L58)

Exclusive upper bound for numbers.

---

### exclusiveMinimum?

> `optional` **exclusiveMinimum**: `number`

Defined in: [src/Mnemonic/json-schema.ts:55](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/json-schema.ts#L55)

Exclusive lower bound for numbers.

---

### items?

> `optional` **items**: `JsonSchema`

Defined in: [src/Mnemonic/json-schema.ts:80](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/json-schema.ts#L80)

Schema applied to every element of an array.

---

### maximum?

> `optional` **maximum**: `number`

Defined in: [src/Mnemonic/json-schema.ts:52](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/json-schema.ts#L52)

Inclusive upper bound for numbers.

---

### maxItems?

> `optional` **maxItems**: `number`

Defined in: [src/Mnemonic/json-schema.ts:86](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/json-schema.ts#L86)

Maximum array length (inclusive).

---

### maxLength?

> `optional` **maxLength**: `number`

Defined in: [src/Mnemonic/json-schema.ts:64](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/json-schema.ts#L64)

Maximum string length (inclusive).

---

### minimum?

> `optional` **minimum**: `number`

Defined in: [src/Mnemonic/json-schema.ts:49](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/json-schema.ts#L49)

Inclusive lower bound for numbers.

---

### minItems?

> `optional` **minItems**: `number`

Defined in: [src/Mnemonic/json-schema.ts:83](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/json-schema.ts#L83)

Minimum array length (inclusive).

---

### minLength?

> `optional` **minLength**: `number`

Defined in: [src/Mnemonic/json-schema.ts:61](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/json-schema.ts#L61)

Minimum string length (inclusive).

---

### properties?

> `optional` **properties**: `Record`\<`string`, `JsonSchema`\>

Defined in: [src/Mnemonic/json-schema.ts:67](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/json-schema.ts#L67)

Property name to sub-schema mapping for objects.

---

### required?

> `optional` **required**: readonly `string`[]

Defined in: [src/Mnemonic/json-schema.ts:70](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/json-schema.ts#L70)

Properties that must be present on the object.

---

### type?

> `optional` **type**: [`JsonSchemaType`](../type-aliases/JsonSchemaType.md) \| [`JsonSchemaType`](../type-aliases/JsonSchemaType.md)[]

Defined in: [src/Mnemonic/json-schema.ts:40](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/json-schema.ts#L40)

The expected JSON type(s). An array form like `["string", "null"]` accepts either type.
