# Interface: MnemonicKeyDescriptor\<T, K\>

Defined in: [src/Mnemonic/types.ts:1206](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1206)

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

Defined in: [src/Mnemonic/types.ts:1210](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1210)

Unprefixed storage key name.

---

### options

> `readonly` **options**: [`UseMnemonicKeyOptions`](../type-aliases/UseMnemonicKeyOptions.md)\<`T`\>

Defined in: [src/Mnemonic/types.ts:1215](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1215)

Canonical options for this key.
