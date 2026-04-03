# Interface: MnemonicDevToolsRegistry

Defined in: [src/Mnemonic/types.ts:465](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L465)

Global devtools registry contract available on window.

This is an advanced public API used by the browser console integration and
extension tooling. Direct namespace access
(`window.__REACT_MNEMONIC_DEVTOOLS__.myNamespace`) is not part of the
public API.

## Properties

### \_\_meta

> **\_\_meta**: [`MnemonicDevToolsMeta`](MnemonicDevToolsMeta.md)

Defined in: [src/Mnemonic/types.ts:475](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L475)

Versioning metadata used by polling devtools integrations.

---

### capabilities

> **capabilities**: [`MnemonicDevToolsCapabilities`](MnemonicDevToolsCapabilities.md)

Defined in: [src/Mnemonic/types.ts:473](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L473)

Runtime capabilities relevant to the registry implementation.

---

### list()

> **list**: () => [`MnemonicDevToolsProviderDescriptor`](MnemonicDevToolsProviderDescriptor.md)[]

Defined in: [src/Mnemonic/types.ts:471](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L471)

List provider availability without strengthening weak references manually.

#### Returns

[`MnemonicDevToolsProviderDescriptor`](MnemonicDevToolsProviderDescriptor.md)[]

---

### providers

> **providers**: `Record`\<`string`, [`MnemonicDevToolsProviderEntry`](MnemonicDevToolsProviderEntry.md)\>

Defined in: [src/Mnemonic/types.ts:467](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L467)

Provider entries keyed by namespace.

---

### resolve()

> **resolve**: (`namespace`) => [`MnemonicDevToolsProviderApi`](MnemonicDevToolsProviderApi.md) \| `null`

Defined in: [src/Mnemonic/types.ts:469](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L469)

Resolve a namespace to a live provider API when one is available.

#### Parameters

| Parameter   | Type     |
| ----------- | -------- |
| `namespace` | `string` |

#### Returns

[`MnemonicDevToolsProviderApi`](MnemonicDevToolsProviderApi.md) \| `null`
