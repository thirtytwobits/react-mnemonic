# Type Alias: Mnemonic

> **Mnemonic** = `object`

Defined in: [src/Mnemonic/types.ts:1114](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1114)

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

Defined in: [src/Mnemonic/types.ts:1129](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1129)

Whether the active storage backend can enumerate keys in this namespace.

This is `true` for `localStorage`-like backends that implement both
`length` and `key(index)`. Namespace-wide recovery helpers rely on this
capability unless the caller supplies an explicit key list.

---

### crossTabSyncMode?

> `optional` **crossTabSyncMode**: `"browser-storage-event"` \| `"custom-external-change"` \| `"none"`

Defined in: [src/Mnemonic/types.ts:1263](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1263)

How this provider can observe external changes from other tabs/processes.

Hooks use this for development diagnostics when callers opt into
cross-tab synchronization on a backend that cannot actually deliver it.

When omitted, consumers should treat this as equivalent to `"none"`.

---

### dump()

> **dump**: () => `Record`\<`string`, `string`\>

Defined in: [src/Mnemonic/types.ts:1198](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1198)

Dump all key-value pairs in this namespace.

Useful for debugging and DevTools integration.

#### Returns

`Record`\<`string`, `string`\>

Object mapping unprefixed keys to raw string values

---

### flush()

> **flush**: (`keys?`) => [`MnemonicFlushResult`](../interfaces/MnemonicFlushResult.md)

Defined in: [src/Mnemonic/types.ts:1238](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1238)

Re-attempt writes that never reached the storage backend.

This is the recovery half of [Mnemonic.unpersistedKeys](#unpersistedkeys): once space
frees up, something has to rewrite the values that were dropped, and
nothing else in the library does.

#### Parameters

| Parameter | Type                | Description                                                                                                              |
| --------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `keys?`   | readonly `string`[] | Unprefixed keys to retry. Defaults to every unpersisted key. Keys with nothing queued are ignored rather than rewritten. |

#### Returns

[`MnemonicFlushResult`](../interfaces/MnemonicFlushResult.md)

Which keys reached storage and which are still unpersisted

---

### getRawSnapshot()

> **getRawSnapshot**: (`key`) => `string` \| `null`

Defined in: [src/Mnemonic/types.ts:1159](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1159)

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

Defined in: [src/Mnemonic/types.ts:1189](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1189)

Enumerate all keys in this namespace.

Returns unprefixed keys that belong to this store's namespace.

#### Returns

`string`[]

Array of unprefixed key names

---

### prefix

> **prefix**: `string`

Defined in: [src/Mnemonic/types.ts:1120](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1120)

The namespace prefix applied to all keys in storage.

Keys are stored as `${prefix}${key}` in the underlying storage backend.

---

### removeRaw()

> **removeRaw**: (`key`) => `void`

Defined in: [src/Mnemonic/types.ts:1180](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1180)

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

Defined in: [src/Mnemonic/types.ts:1248](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1248)

The active schema enforcement mode for this provider.

Propagated from the `schemaMode` provider option. Hooks read this
to determine how to handle versioned envelopes.

#### See

[SchemaMode](SchemaMode.md)

---

### schemaRegistry?

> `optional` **schemaRegistry**: [`SchemaRegistry`](../interfaces/SchemaRegistry.md)

Defined in: [src/Mnemonic/types.ts:1273](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1273)

The schema registry for this provider, if one was supplied.

Hooks use this to look up schemas, resolve migration paths, and
(in autoschema mode) register inferred schemas.

#### See

[SchemaRegistry](../interfaces/SchemaRegistry.md)

---

### setRaw()

> **setRaw**: (`key`, `raw`) => `void`

Defined in: [src/Mnemonic/types.ts:1170](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1170)

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

Defined in: [src/Mnemonic/types.ts:1253](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1253)

Default hydration strategy inherited by descendant hooks.

---

### subscribeRaw()

> **subscribeRaw**: (`key`, `listener`) => [`Unsubscribe`](Unsubscribe.md)

Defined in: [src/Mnemonic/types.ts:1148](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1148)

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

---

### unpersistedKeys()

> **unpersistedKeys**: () => `string`[]

Defined in: [src/Mnemonic/types.ts:1225](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1225)

List unprefixed keys whose cached value is not known to be in storage.

A key is queued here when `setRaw` or `removeRaw` updated the cache but
the storage backend rejected the mutation — a quota error, a blocked
origin, a backend that broke the synchronous `StorageLike` contract, or
no backend at all. The provider keeps serving the cached value, so this
is the only way to tell a durable write from an in-memory one.

A key is only queued when storage is observed to disagree with the
cache. A rejected write of a value storage already holds — a reset to
the value on disk, for example — is not reported, so a durable key is
never shown as unsaved.

Entries clear when the same key is written again successfully, when
[Mnemonic.flush](#flush) persists them, or when an external change reloads
the key from storage. The queue holds one entry per distinct key, not per
write.

#### Returns

`string`[]

Unprefixed keys in the order they entered the queue. Because
the queue holds one entry per key, a key that is already queued keeps
its original position when a later mutation to it is also rejected —
only its pending value is replaced. Treat this as first-failure order,
not most-recently-written order.
