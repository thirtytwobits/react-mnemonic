# Function: defineMnemonicKey()

## Call Signature

> **defineMnemonicKey**\<`K`, `T`\>(`key`, `options`): [`MnemonicKeyDescriptor`](../interfaces/MnemonicKeyDescriptor.md)\<`T`, `K`\>

Defined in: [src/Mnemonic/key.ts:31](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/key.ts#L31)

Define a reusable, importable contract for a persisted key.

This packages the storage key and the canonical `useMnemonicKey(...)`
options into a single object that can be shared across components, docs,
and generated code.

### Type Parameters

| Type Parameter         | Description                        |
| ---------------------- | ---------------------------------- |
| `K` _extends_ `string` | The literal storage key name       |
| `T`                    | The decoded value type for the key |

### Parameters

| Parameter | Type                                                                       | Description                        |
| --------- | -------------------------------------------------------------------------- | ---------------------------------- |
| `key`     | `K`                                                                        | The unprefixed storage key         |
| `options` | [`UseMnemonicKeyOptions`](../type-aliases/UseMnemonicKeyOptions.md)\<`T`\> | Canonical hook options for the key |

### Returns

[`MnemonicKeyDescriptor`](../interfaces/MnemonicKeyDescriptor.md)\<`T`, `K`\>

A descriptor that can be passed directly to `useMnemonicKey(...)`

### Example

```typescript
const themeKey = defineMnemonicKey("theme", {
    defaultValue: "light" as "light" | "dark",
    listenCrossTab: true,
});

const { value, set } = useMnemonicKey(themeKey);
```

## Call Signature

> **defineMnemonicKey**\<`K`, `TSchema`\>(`keySchema`, `options`): [`MnemonicKeyDescriptor`](../interfaces/MnemonicKeyDescriptor.md)\<`TSchema` _extends_ [`KeySchema`](../type-aliases/KeySchema.md)\<`TValue`, `string`, [`JsonSchema`](../interfaces/JsonSchema.md)\> ? `TValue` : `never`, `TSchema`\[`"key"`\]\>

Defined in: [src/Mnemonic/key.ts:35](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/key.ts#L35)

Define a reusable, importable contract for a persisted key.

This packages the storage key and the canonical `useMnemonicKey(...)`
options into a single object that can be shared across components, docs,
and generated code.

### Type Parameters

| Type Parameter                                                                                                                 | Description                  |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| `K` _extends_ `string`                                                                                                         | The literal storage key name |
| `TSchema` _extends_ [`KeySchema`](../type-aliases/KeySchema.md)\<`unknown`, `K`, [`JsonSchema`](../interfaces/JsonSchema.md)\> | -                            |

### Parameters

| Parameter   | Type                                                                                                                                                                                                                               | Description                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `keySchema` | `TSchema`                                                                                                                                                                                                                          | -                                  |
| `options`   | [`SchemaBoundKeyOptions`](../type-aliases/SchemaBoundKeyOptions.md)\<`TSchema` _extends_ [`KeySchema`](../type-aliases/KeySchema.md)\<infer TValue, `string`, [`JsonSchema`](../interfaces/JsonSchema.md)\> ? `TValue` : `never`\> | Canonical hook options for the key |

### Returns

[`MnemonicKeyDescriptor`](../interfaces/MnemonicKeyDescriptor.md)\<`TSchema` _extends_ [`KeySchema`](../type-aliases/KeySchema.md)\<`TValue`, `string`, [`JsonSchema`](../interfaces/JsonSchema.md)\> ? `TValue` : `never`, `TSchema`\[`"key"`\]\>

A descriptor that can be passed directly to `useMnemonicKey(...)`

### Example

```typescript
const themeKey = defineMnemonicKey("theme", {
    defaultValue: "light" as "light" | "dark",
    listenCrossTab: true,
});

const { value, set } = useMnemonicKey(themeKey);
```
