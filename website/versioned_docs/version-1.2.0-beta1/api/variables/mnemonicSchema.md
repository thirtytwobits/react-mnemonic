# Variable: mnemonicSchema

> `const` **mnemonicSchema**: `object`

Defined in: [src/Mnemonic/typed-schema.ts:148](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/typed-schema.ts#L148)

Builder helpers for strongly typed schemas backed by Mnemonic's built-in
JSON Schema subset.

The returned schemas are plain `JsonSchema` objects at runtime, so they can
be registered directly in `createSchemaRegistry(...)` while also carrying a
phantom TypeScript type for inference.

## Type Declaration

| Name          | Type                                                                                                                                                                                    | Defined in                                                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `array()`     | (`itemSchema`, `options?`) => [`TypedJsonSchema`](../type-aliases/TypedJsonSchema.md)\<[`InferJsonSchemaValue`](../type-aliases/InferJsonSchemaValue.md)\<`TItemSchema`\>[]\>           | [src/Mnemonic/typed-schema.ts:191](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/typed-schema.ts#L191) |
| `boolean()`   | () => [`TypedJsonSchema`](../type-aliases/TypedJsonSchema.md)\<`boolean`\>                                                                                                              | [src/Mnemonic/typed-schema.ts:161](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/typed-schema.ts#L161) |
| `enum()`      | (`values`) => [`TypedJsonSchema`](../type-aliases/TypedJsonSchema.md)\<`TValues`\[`number`\]\>                                                                                          | [src/Mnemonic/typed-schema.ts:175](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/typed-schema.ts#L175) |
| `integer()`   | (`options?`) => [`TypedJsonSchema`](../type-aliases/TypedJsonSchema.md)\<`number`\>                                                                                                     | [src/Mnemonic/typed-schema.ts:157](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/typed-schema.ts#L157) |
| `literal()`   | (`value`) => [`TypedJsonSchema`](../type-aliases/TypedJsonSchema.md)\<`TValue`\>                                                                                                        | [src/Mnemonic/typed-schema.ts:169](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/typed-schema.ts#L169) |
| `nullable()`  | (`schema`) => [`TypedJsonSchema`](../type-aliases/TypedJsonSchema.md)\<`T` \| `null`\>                                                                                                  | [src/Mnemonic/typed-schema.ts:187](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/typed-schema.ts#L187) |
| `nullValue()` | () => [`TypedJsonSchema`](../type-aliases/TypedJsonSchema.md)\<`null`\>                                                                                                                 | [src/Mnemonic/typed-schema.ts:165](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/typed-schema.ts#L165) |
| `number()`    | (`options?`) => [`TypedJsonSchema`](../type-aliases/TypedJsonSchema.md)\<`number`\>                                                                                                     | [src/Mnemonic/typed-schema.ts:153](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/typed-schema.ts#L153) |
| `object()`    | (`shape`, `options?`) => [`TypedJsonSchema`](../type-aliases/TypedJsonSchema.md)\<`ObjectValueFromSchemas`\<`TShape`\>\>                                                                | [src/Mnemonic/typed-schema.ts:201](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/typed-schema.ts#L201) |
| `optional()`  | (`schema`) => `OptionalTypedJsonSchema`\<`T`\>                                                                                                                                          | [src/Mnemonic/typed-schema.ts:183](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/typed-schema.ts#L183) |
| `record()`    | (`valueSchema`) => [`TypedJsonSchema`](../type-aliases/TypedJsonSchema.md)\<`Record`\<`string`, [`InferJsonSchemaValue`](../type-aliases/InferJsonSchemaValue.md)\<`TValueSchema`\>\>\> | [src/Mnemonic/typed-schema.ts:228](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/typed-schema.ts#L228) |
| `string()`    | (`options?`) => [`TypedJsonSchema`](../type-aliases/TypedJsonSchema.md)\<`string`\>                                                                                                     | [src/Mnemonic/typed-schema.ts:149](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/typed-schema.ts#L149) |
