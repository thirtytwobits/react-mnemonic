# Interface: MnemonicDevToolsProviderEntry

Defined in: [src/Mnemonic/types.ts:406](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L406)

Registry entry for a single provider namespace.

## Properties

### lastSeenAt

> **lastSeenAt**: `number`

Defined in: [src/Mnemonic/types.ts:414](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L414)

Timestamp when provider was last confirmed live.

---

### namespace

> **namespace**: `string`

Defined in: [src/Mnemonic/types.ts:408](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L408)

Namespace key for this provider entry.

---

### registeredAt

> **registeredAt**: `number`

Defined in: [src/Mnemonic/types.ts:412](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L412)

Timestamp when this namespace was registered.

---

### staleSince

> **staleSince**: `number` \| `null`

Defined in: [src/Mnemonic/types.ts:416](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L416)

Timestamp when provider was first observed unavailable, or null when live.

---

### weakRef

> **weakRef**: [`MnemonicDevToolsWeakRef`](MnemonicDevToolsWeakRef.md)\<[`MnemonicDevToolsProviderApi`](MnemonicDevToolsProviderApi.md)\>

Defined in: [src/Mnemonic/types.ts:410](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L410)

Weak reference to the provider inspection API.
