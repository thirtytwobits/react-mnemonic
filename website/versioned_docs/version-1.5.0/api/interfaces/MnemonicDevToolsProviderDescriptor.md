# Interface: MnemonicDevToolsProviderDescriptor

Defined in: [src/Mnemonic/types.ts:422](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L422)

Lightweight provider status returned by `list()`.

## Properties

### available

> **available**: `boolean`

Defined in: [src/Mnemonic/types.ts:426](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L426)

Whether the provider can currently be resolved to a live API instance.

---

### lastSeenAt

> **lastSeenAt**: `number`

Defined in: [src/Mnemonic/types.ts:430](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L430)

Timestamp when the provider was last observed as live.

---

### namespace

> **namespace**: `string`

Defined in: [src/Mnemonic/types.ts:424](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L424)

Namespace registered by the provider.

---

### registeredAt

> **registeredAt**: `number`

Defined in: [src/Mnemonic/types.ts:428](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L428)

Timestamp when the provider namespace was first registered.

---

### staleSince

> **staleSince**: `number` \| `null`

Defined in: [src/Mnemonic/types.ts:432](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L432)

Timestamp when the provider first became unavailable, or `null` when live.
