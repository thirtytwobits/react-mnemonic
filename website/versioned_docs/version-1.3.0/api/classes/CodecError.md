# Class: CodecError

Defined in: [src/Mnemonic/codecs.ts:37](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/codecs.ts#L37)

Custom error class for codec encoding and decoding failures.

Thrown when a codec cannot successfully encode a value to a string or
decode a string back to its typed representation. This allows callers
to distinguish codec errors from other types of errors.

## Example

```typescript
try {
    const value = JSONCodec.decode("not-valid-json");
} catch (error) {
    if (error instanceof CodecError) {
        console.error("Failed to decode:", error.message);
    }
}
```

## Extends

- `Error`

## Constructors

### Constructor

> **new CodecError**(`message`, `cause?`): `CodecError`

Defined in: [src/Mnemonic/codecs.ts:52](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/codecs.ts#L52)

Creates a new CodecError.

#### Parameters

| Parameter | Type      | Description                                        |
| --------- | --------- | -------------------------------------------------- |
| `message` | `string`  | Human-readable error description                   |
| `cause?`  | `unknown` | Optional underlying error that caused this failure |

#### Returns

`CodecError`

#### Overrides

`Error.constructor`

## Properties

### cause?

> `readonly` `optional` **cause**: `unknown`

Defined in: [src/Mnemonic/codecs.ts:44](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/codecs.ts#L44)

The underlying error that caused the codec failure, if any.

Useful for debugging when wrapping errors from JSON.parse or
other parsing operations.

---

### message

> **message**: `string`

Defined in: website/node_modules/typescript/lib/lib.es5.d.ts:1077

#### Inherited from

`Error.message`

---

### name

> **name**: `string`

Defined in: website/node_modules/typescript/lib/lib.es5.d.ts:1076

#### Inherited from

`Error.name`

---

### stack?

> `optional` **stack**: `string`

Defined in: website/node_modules/typescript/lib/lib.es5.d.ts:1078

#### Inherited from

`Error.stack`
