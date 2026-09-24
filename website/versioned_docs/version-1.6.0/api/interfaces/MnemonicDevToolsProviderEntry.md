# Interface: MnemonicDevToolsProviderEntry

Defined in: [src/Mnemonic/types.ts:474](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L474)

Registry entry for a single provider namespace.

## Properties

### lastSeenAt

> **lastSeenAt**: `number`

Defined in: [src/Mnemonic/types.ts:482](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L482)

Timestamp when provider was last confirmed live.

---

### namespace

> **namespace**: `string`

Defined in: [src/Mnemonic/types.ts:476](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L476)

Namespace key for this provider entry.

---

### registeredAt

> **registeredAt**: `number`

Defined in: [src/Mnemonic/types.ts:480](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L480)

Timestamp when this namespace was registered.

---

### staleSince

> **staleSince**: `number` \| `null`

Defined in: [src/Mnemonic/types.ts:484](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L484)

Timestamp when provider was first observed unavailable, or null when live.

---

### weakRef

> **weakRef**: [`MnemonicDevToolsWeakRef`](MnemonicDevToolsWeakRef.md)\<[`MnemonicDevToolsProviderApi`](MnemonicDevToolsProviderApi.md)\>

Defined in: [src/Mnemonic/types.ts:478](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L478)

Weak reference to the provider inspection API.
