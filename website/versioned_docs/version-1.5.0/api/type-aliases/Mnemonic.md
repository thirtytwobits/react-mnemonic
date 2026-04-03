# Type Alias: Mnemonic

> **Mnemonic** = `object`

Defined in: [src/Mnemonic/types.ts:926](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L926)

Low-level Mnemonic store API provided via React Context.

This interface powers `MnemonicProvider` internally and is also exposed to
advanced consumers through `MnemonicDevToolsProviderApi.getStore()`. Typical
application code should still prefer `useMnemonicKey`.

All keys passed to these methods should be **unprefixed**. The store
automatically applies the namespace prefix internally.

## Remarks

This implements the React `useSyncExternalStore` contract for efficient,
tearing-free state synchronization. Most application code should still
prefer `useMnemonicKey`; this type mainly appears in the DevTools API via
`MnemonicDevToolsProviderApi.getStore()`.

## Properties

### canEnumerateKeys

> **canEnumerateKeys**: `boolean`

Defined in: [src/Mnemonic/types.ts:941](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L941)

Whether the active storage backend can enumerate keys in this namespace.

This is `true` for `localStorage`-like backends that implement both
`length` and `key(index)`. Namespace-wide recovery helpers rely on this
capability unless the caller supplies an explicit key list.

---

### crossTabSyncMode?

> `optional` **crossTabSyncMode**: `"browser-storage-event"` \| `"custom-external-change"` \| `"none"`

Defined in: [src/Mnemonic/types.ts:1035](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1035)

How this provider can observe external changes from other tabs/processes.

Hooks use this for development diagnostics when callers opt into
cross-tab synchronization on a backend that cannot actually deliver it.

When omitted, consumers should treat this as equivalent to `"none"`.

---

### dump()

> **dump**: () => `Record`\<`string`, `string`\>

Defined in: [src/Mnemonic/types.ts:1010](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1010)

Dump all key-value pairs in this namespace.

Useful for debugging and DevTools integration.

#### Returns

`Record`\<`string`, `string`\>

Object mapping unprefixed keys to raw string values

---

### getRawSnapshot()

> **getRawSnapshot**: (`key`) => `string` \| `null`

Defined in: [src/Mnemonic/types.ts:971](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L971)

Get the current raw string value for a key.

This is part of the external store snapshot contract. Values are
cached in memory for stable snapshots.

#### Parameters

| Parameter | Type     | Description                |
| --------- | -------- | -------------------------- |
| `key`     | `string` | The unprefixed storage key |

#### Returns

`string` \| `null`

The raw string value, or null if not present

---

### keys()

> **keys**: () => `string`[]

Defined in: [src/Mnemonic/types.ts:1001](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1001)

Enumerate all keys in this namespace.

Returns unprefixed keys that belong to this store's namespace.

#### Returns

`string`[]

Array of unprefixed key names

---

### prefix

> **prefix**: `string`

Defined in: [src/Mnemonic/types.ts:932](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L932)

The namespace prefix applied to all keys in storage.

Keys are stored as `${prefix}${key}` in the underlying storage backend.

---

### removeRaw()

> **removeRaw**: (`key`) => `void`

Defined in: [src/Mnemonic/types.ts:992](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L992)

Remove a key from storage.

Clears the value from both the cache and the underlying storage,
then notifies all subscribers.

#### Parameters

| Parameter | Type     | Description                          |
| --------- | -------- | ------------------------------------ |
| `key`     | `string` | The unprefixed storage key to remove |

#### Returns

`void`

---

### schemaMode

> **schemaMode**: [`SchemaMode`](SchemaMode.md)

Defined in: [src/Mnemonic/types.ts:1020](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1020)

The active schema enforcement mode for this provider.

Propagated from the `schemaMode` provider option. Hooks read this
to determine how to handle versioned envelopes.

#### See

[SchemaMode](SchemaMode.md)

---

### schemaRegistry?

> `optional` **schemaRegistry**: [`SchemaRegistry`](../interfaces/SchemaRegistry.md)

Defined in: [src/Mnemonic/types.ts:1045](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1045)

The schema registry for this provider, if one was supplied.

Hooks use this to look up schemas, resolve migration paths, and
(in autoschema mode) register inferred schemas.

#### See

[SchemaRegistry](../interfaces/SchemaRegistry.md)

---

### setRaw()

> **setRaw**: (`key`, `raw`) => `void`

Defined in: [src/Mnemonic/types.ts:982](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L982)

Write a raw string value to storage.

Updates both the in-memory cache and the underlying storage backend,
then notifies all subscribers for this key.

#### Parameters

| Parameter | Type     | Description                   |
| --------- | -------- | ----------------------------- |
| `key`     | `string` | The unprefixed storage key    |
| `raw`     | `string` | The raw string value to store |

#### Returns

`void`

---

### ssrHydration

> **ssrHydration**: [`MnemonicHydrationMode`](MnemonicHydrationMode.md)

Defined in: [src/Mnemonic/types.ts:1025](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1025)

Default hydration strategy inherited by descendant hooks.

---

### subscribeRaw()

> **subscribeRaw**: (`key`, `listener`) => [`Unsubscribe`](Unsubscribe.md)

Defined in: [src/Mnemonic/types.ts:960](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L960)

Subscribe to changes for a specific key.

Follows the React external store subscription contract. The listener
will be called whenever the value for this key changes.

#### Parameters

| Parameter  | Type                      | Description                                |
| ---------- | ------------------------- | ------------------------------------------ |
| `key`      | `string`                  | The unprefixed storage key to subscribe to |
| `listener` | [`Listener`](Listener.md) | Callback invoked when the value changes    |

#### Returns

[`Unsubscribe`](Unsubscribe.md)

Unsubscribe function to stop listening

#### Example

```typescript
const unsubscribe = store.subscribeRaw("user", () => {
    console.log("User changed:", store.getRawSnapshot("user"));
});
```
