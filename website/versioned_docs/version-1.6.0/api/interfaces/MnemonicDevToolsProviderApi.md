# Interface: MnemonicDevToolsProviderApi

Defined in: [src/Mnemonic/types.ts:454](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L454)

Provider inspection API exposed through devtools registry resolution.

Resolve a provider from the registry, then invoke these methods for manual
inspection/mutation from the browser console.

## Properties

### clear()

> **clear**: () => `void`

Defined in: [src/Mnemonic/types.ts:466](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L466)

Remove all keys in this provider namespace.

#### Returns

`void`

---

### dump()

> **dump**: () => `Record`\<`string`, `string`\>

Defined in: [src/Mnemonic/types.ts:458](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L458)

Dump all raw key-value pairs for the provider namespace.

#### Returns

`Record`\<`string`, `string`\>

---

### get()

> **get**: (`key`) => `unknown`

Defined in: [src/Mnemonic/types.ts:460](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L460)

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

Defined in: [src/Mnemonic/types.ts:456](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L456)

Access the underlying store instance.

#### Returns

[`Mnemonic`](../type-aliases/Mnemonic.md)

---

### keys()

> **keys**: () => `string`[]

Defined in: [src/Mnemonic/types.ts:468](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L468)

List all unprefixed keys in this provider namespace.

#### Returns

`string`[]

---

### remove()

> **remove**: (`key`) => `void`

Defined in: [src/Mnemonic/types.ts:464](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L464)

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

Defined in: [src/Mnemonic/types.ts:462](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L462)

Write value for an unprefixed key (JSON-encoded).

#### Parameters

| Parameter | Type      |
| --------- | --------- |
| `key`     | `string`  |
| `value`   | `unknown` |

#### Returns

`void`
