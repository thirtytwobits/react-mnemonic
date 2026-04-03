# Interface: Codec\<T\>

Defined in: [src/Mnemonic/types.ts:40](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L40)

Codec for encoding and decoding values to and from storage.

Codecs provide bidirectional transformations between typed values and their
string representations suitable for storage in localStorage or similar backends.

Using a codec on a key opts out of JSON Schema validation. Schema-managed
keys store JSON values directly and are validated against their JSON Schema.

## Example

```typescript
const DateCodec: Codec<Date> = {
    encode: (date) => date.toISOString(),
    decode: (str) => new Date(str),
};
```

## See

- [JSONCodec](../variables/JSONCodec.md) - Default codec for JSON-serializable values
- [createCodec](../functions/createCodec.md) - Helper function to create custom codecs

## Type Parameters

| Type Parameter | Description                                       |
| -------------- | ------------------------------------------------- |
| `T`            | The TypeScript type of the value to encode/decode |

## Properties

### decode()

> **decode**: (`encoded`) => `T`

Defined in: [src/Mnemonic/types.ts:57](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L57)

Transforms a stored string back into a typed value.

#### Parameters

| Parameter | Type     | Description                            |
| --------- | -------- | -------------------------------------- |
| `encoded` | `string` | The string representation from storage |

#### Returns

`T`

The decoded typed value

#### Throws

If the string cannot be decoded

---

### encode()

> **encode**: (`value`) => `string`

Defined in: [src/Mnemonic/types.ts:48](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L48)

Transforms a typed value into a string suitable for storage.

#### Parameters

| Parameter | Type | Description               |
| --------- | ---- | ------------------------- |
| `value`   | `T`  | The typed value to encode |

#### Returns

`string`

A string representation of the value

#### Throws

If the value cannot be encoded
