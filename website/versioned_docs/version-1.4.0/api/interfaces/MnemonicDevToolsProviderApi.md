# Interface: MnemonicDevToolsProviderApi

Defined in: [src/Mnemonic/types.ts:386](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L386)

Provider inspection API exposed through devtools registry resolution.

Resolve a provider from the registry, then invoke these methods for manual
inspection/mutation from the browser console.

## Properties

### clear()

> **clear**: () => `void`

Defined in: [src/Mnemonic/types.ts:398](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L398)

Remove all keys in this provider namespace.

#### Returns

`void`

---

### dump()

> **dump**: () => `Record`\<`string`, `string`\>

Defined in: [src/Mnemonic/types.ts:390](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L390)

Dump all raw key-value pairs for the provider namespace.

#### Returns

`Record`\<`string`, `string`\>

---

### get()

> **get**: (`key`) => `unknown`

Defined in: [src/Mnemonic/types.ts:392](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L392)

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

Defined in: [src/Mnemonic/types.ts:388](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L388)

Access the underlying store instance.

#### Returns

[`Mnemonic`](../type-aliases/Mnemonic.md)

---

### keys()

> **keys**: () => `string`[]

Defined in: [src/Mnemonic/types.ts:400](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L400)

List all unprefixed keys in this provider namespace.

#### Returns

`string`[]

---

### remove()

> **remove**: (`key`) => `void`

Defined in: [src/Mnemonic/types.ts:396](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L396)

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

Defined in: [src/Mnemonic/types.ts:394](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L394)

Write value for an unprefixed key (JSON-encoded).

#### Parameters

| Parameter | Type      |
| --------- | --------- |
| `key`     | `string`  |
| `value`   | `unknown` |

#### Returns

`void`
