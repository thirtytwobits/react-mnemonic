# Variable: JSONCodec

> `const` **JSONCodec**: [`Codec`](../interfaces/Codec.md)\<`any`\>

Defined in: [src/Mnemonic/codecs.ts:91](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/codecs.ts#L91)

JSON codec for encoding and decoding JSON-serializable values.

This is the default codec used by `useMnemonicKey` when no codec is specified.
It uses `JSON.stringify` for encoding and `JSON.parse` for decoding, making it
suitable for objects, arrays, and primitive values.

## Remarks

- Supports any JSON-serializable type: objects, arrays, strings, numbers, booleans, null
- Does not preserve JavaScript-specific types like Date, Map, Set, or undefined
- Throws standard JSON parsing errors for malformed JSON strings

## Example

```typescript
// Used automatically as the default
const { value, set } = useMnemonicKey("userProfile", {
    defaultValue: { name: "Guest", preferences: { theme: "dark" } },
    // codec: JSONCodec is implicit
});

// Can be specified explicitly
const { value, set } = useMnemonicKey("settings", {
    defaultValue: { notifications: true },
    codec: JSONCodec,
});
```

## See

[createCodec](../functions/createCodec.md) - For custom encoding schemes
