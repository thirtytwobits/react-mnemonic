# Interface: MnemonicDevToolsProviderApi

Defined in: [src/Mnemonic/types.ts:310](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L310)

Provider inspection API exposed through devtools registry resolution.

Resolve a provider from the registry, then invoke these methods for manual
inspection/mutation from the browser console.

## Properties

### clear()

> **clear**: () => `void`

Defined in: [src/Mnemonic/types.ts:322](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L322)

Remove all keys in this provider namespace.

#### Returns

`void`

---

### dump()

> **dump**: () => `Record`\<`string`, `string`\>

Defined in: [src/Mnemonic/types.ts:314](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L314)

Dump all raw key-value pairs for the provider namespace.

#### Returns

`Record`\<`string`, `string`\>

---

### get()

> **get**: (`key`) => `unknown`

Defined in: [src/Mnemonic/types.ts:316](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L316)

Read decoded value for an unprefixed key.

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `key`     | `string` |

#### Returns

`unknown`

---

### getStore()

> **getStore**: () => [`Mnemonic`](../type-aliases/Mnemonic.md)

Defined in: [src/Mnemonic/types.ts:312](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L312)

Access the underlying store instance.

#### Returns

[`Mnemonic`](../type-aliases/Mnemonic.md)

---

### keys()

> **keys**: () => `string`[]

Defined in: [src/Mnemonic/types.ts:324](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L324)

List all unprefixed keys in this provider namespace.

#### Returns

`string`[]

---

### remove()

> **remove**: (`key`) => `void`

Defined in: [src/Mnemonic/types.ts:320](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L320)

Remove a single unprefixed key.

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `key`     | `string` |

#### Returns

`void`

---

### set()

> **set**: (`key`, `value`) => `void`

Defined in: [src/Mnemonic/types.ts:318](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L318)

Write value for an unprefixed key (JSON-encoded).

#### Parameters

| Parameter | Type      |
| --------- | --------- |
| `key`     | `string`  |
| `value`   | `unknown` |

#### Returns

`void`
