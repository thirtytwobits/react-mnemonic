# Interface: MnemonicDevToolsRegistry

Defined in: [src/Mnemonic/types.ts:389](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L389)

Global devtools registry contract available on window.

This is an advanced public API used by the browser console integration and
extension tooling. Direct namespace access
(`window.__REACT_MNEMONIC_DEVTOOLS__.myNamespace`) is not part of the
public API.

## Properties

### \_\_meta

> **\_\_meta**: [`MnemonicDevToolsMeta`](MnemonicDevToolsMeta.md)

Defined in: [src/Mnemonic/types.ts:399](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L399)

Versioning metadata used by polling devtools integrations.

---

### capabilities

> **capabilities**: [`MnemonicDevToolsCapabilities`](MnemonicDevToolsCapabilities.md)

Defined in: [src/Mnemonic/types.ts:397](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L397)

Runtime capabilities relevant to the registry implementation.

---

### list()

> **list**: () => [`MnemonicDevToolsProviderDescriptor`](MnemonicDevToolsProviderDescriptor.md)[]

Defined in: [src/Mnemonic/types.ts:395](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L395)

List provider availability without strengthening weak references manually.

#### Returns

[`MnemonicDevToolsProviderDescriptor`](MnemonicDevToolsProviderDescriptor.md)[]

---

### providers

> **providers**: `Record`\<`string`, [`MnemonicDevToolsProviderEntry`](MnemonicDevToolsProviderEntry.md)\>

Defined in: [src/Mnemonic/types.ts:391](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L391)

Provider entries keyed by namespace.

---

### resolve()

> **resolve**: (`namespace`) => [`MnemonicDevToolsProviderApi`](MnemonicDevToolsProviderApi.md) \| `null`

Defined in: [src/Mnemonic/types.ts:393](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L393)

Resolve a namespace to a live provider API when one is available.

#### Parameters

| Parameter   | Type     |
| ----------- | -------- |
| `namespace` | `string` |

#### Returns

[`MnemonicDevToolsProviderApi`](MnemonicDevToolsProviderApi.md) \| `null`
