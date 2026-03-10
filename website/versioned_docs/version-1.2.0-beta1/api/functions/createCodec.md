# Function: createCodec()

> **createCodec**\<`T`\>(`encode`, `decode`): [`Codec`](../interfaces/Codec.md)\<`T`\>

Defined in: [src/Mnemonic/codecs.ts:142](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/codecs.ts#L142)

Factory function for creating custom codecs.

Creates a `Codec<T>` from separate encode and decode functions. This is
useful for implementing custom serialization strategies for types that
aren't supported by JSONCodec. Using a custom codec on a key opts out
of JSON Schema validation for that key.

## Type Parameters

| Type Parameter | Description                                    |
| -------------- | ---------------------------------------------- |
| `T`            | The TypeScript type of values to encode/decode |

## Parameters

| Parameter | Type                  | Description                                           |
| --------- | --------------------- | ----------------------------------------------------- |
| `encode`  | (`value`) => `string` | Function that converts a typed value to a string      |
| `decode`  | (`encoded`) => `T`    | Function that converts a string back to a typed value |

## Returns

[`Codec`](../interfaces/Codec.md)\<`T`\>

A `Codec<T>` object compatible with useMnemonicKey

## Examples

```typescript
// Codec for Date objects
const DateCodec = createCodec<Date>(
    (date) => date.toISOString(),
    (str) => new Date(str),
);

const { value, set } = useMnemonicKey("lastLogin", {
    defaultValue: new Date(),
    codec: DateCodec,
});
```

```typescript
// Codec for Set<string>
const StringSetCodec = createCodec<Set<string>>(
    (set) => JSON.stringify(Array.from(set)),
    (str) => new Set(JSON.parse(str)),
);

const { value, set } = useMnemonicKey("tags", {
    defaultValue: new Set<string>(),
    codec: StringSetCodec,
});
```

## See

- [Codec](../interfaces/Codec.md) - The codec interface
- [CodecError](../classes/CodecError.md) - Error to throw when encoding/decoding fails
- [JSONCodec](../variables/JSONCodec.md) - Built-in codec for JSON values
