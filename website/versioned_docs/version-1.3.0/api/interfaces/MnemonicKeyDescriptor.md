# Interface: MnemonicKeyDescriptor\<T, K\>

Defined in: [src/Mnemonic/types.ts:1130](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1130)

Reusable, importable contract for a single persisted key.

Descriptors package the key name and its `useMnemonicKey(...)` options into
a stable object that can be defined once at module scope and reused across
components. This helps keep persistence behavior explicit and consistent,
especially when the same key appears in multiple parts of an application.

## Example

```typescript
const themeKey = defineMnemonicKey("theme", {
    defaultValue: "light" as "light" | "dark",
    listenCrossTab: true,
});

const { value, set } = useMnemonicKey(themeKey);
```

## See

- [defineMnemonicKey](../functions/defineMnemonicKey.md) - Helper for creating descriptors
- [useMnemonicKey](../functions/useMnemonicKey.md) - Hook that consumes descriptors

## Type Parameters

| Type Parameter         | Default type | Description                        |
| ---------------------- | ------------ | ---------------------------------- |
| `T`                    | -            | The decoded value type for the key |
| `K` _extends_ `string` | `string`     | The literal key name               |

## Properties

### key

> `readonly` **key**: `K`

Defined in: [src/Mnemonic/types.ts:1134](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1134)

Unprefixed storage key name.

---

### options

> `readonly` **options**: [`UseMnemonicKeyOptions`](../type-aliases/UseMnemonicKeyOptions.md)\<`T`\>

Defined in: [src/Mnemonic/types.ts:1139](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1139)

Canonical options for this key.
