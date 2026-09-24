# Interface: MnemonicDevToolsRegistry

Defined in: [src/Mnemonic/types.ts:533](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L533)

Global devtools registry contract available on window.

This is an advanced public API used by the browser console integration and
extension tooling. Direct namespace access
(`window.__REACT_MNEMONIC_DEVTOOLS__.myNamespace`) is not part of the
public API.

## Properties

### \_\_meta

> **\_\_meta**: [`MnemonicDevToolsMeta`](MnemonicDevToolsMeta.md)

Defined in: [src/Mnemonic/types.ts:543](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L543)

Versioning metadata used by polling devtools integrations.

---

### capabilities

> **capabilities**: [`MnemonicDevToolsCapabilities`](MnemonicDevToolsCapabilities.md)

Defined in: [src/Mnemonic/types.ts:541](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L541)

Runtime capabilities relevant to the registry implementation.

---

### list()

> **list**: () => [`MnemonicDevToolsProviderDescriptor`](MnemonicDevToolsProviderDescriptor.md)[]

Defined in: [src/Mnemonic/types.ts:539](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L539)

List provider availability without strengthening weak references manually.

#### Returns

[`MnemonicDevToolsProviderDescriptor`](MnemonicDevToolsProviderDescriptor.md)[]

---

### providers

> **providers**: `Record`\<`string`, [`MnemonicDevToolsProviderEntry`](MnemonicDevToolsProviderEntry.md)\>

Defined in: [src/Mnemonic/types.ts:535](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L535)

Provider entries keyed by namespace.

---

### resolve()

> **resolve**: (`namespace`) => [`MnemonicDevToolsProviderApi`](MnemonicDevToolsProviderApi.md) \| `null`

Defined in: [src/Mnemonic/types.ts:537](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L537)

Resolve a namespace to a live provider API when one is available.

#### Parameters

| Parameter   | Type     |
| ----------- | -------- |
| `namespace` | `string` |

#### Returns

[`MnemonicDevToolsProviderApi`](MnemonicDevToolsProviderApi.md) \| `null`
