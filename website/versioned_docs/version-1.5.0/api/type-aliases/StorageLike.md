# Type Alias: StorageLike

> **StorageLike** = `object`

Defined in: [src/Mnemonic/types.ts:814](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L814)

Storage interface compatible with localStorage and synchronous custom storage implementations.

Defines the minimum contract required for a storage backend. Compatible with
browser Storage API (localStorage, sessionStorage) and custom implementations
for testing or alternative storage solutions.

All methods in this contract are intentionally synchronous. Promise-returning
adapters such as React Native `AsyncStorage` are not directly supported by
`StorageLike`; instead, keep a synchronous in-memory cache and flush to async
persistence outside the hook contract.

## Remarks

**Error handling contract**

The library wraps every storage call in a try/catch. Errors are handled as
follows:

- **`DOMException` with `name === "QuotaExceededError"`** — Logged once via
  `console.error` with the prefix `[Mnemonic] Storage quota exceeded`.
  Squelched until a write succeeds, then the flag resets.

- **Other `DOMException` errors (including `SecurityError`)** — Logged once
  via `console.error` with the prefix `[Mnemonic] Storage access error`.
  Squelched until any storage operation succeeds, then the flag resets.

- **All other error types** — Silently suppressed.

Custom `StorageLike` implementations are encouraged to throw `DOMException`
for storage access failures so the library can surface diagnostics. Throwing
non-`DOMException` errors is safe but results in silent suppression.

In all error cases the library falls back to its in-memory cache, so
components continue to function when the storage backend is unavailable.

Promise-returning `getItem`, `setItem`, or `removeItem` implementations are
treated as an invalid contract at runtime. Mnemonic logs the misuse once and
falls back to its in-memory cache for safety.

## Example

```typescript
// In-memory storage for testing
const mockStorage: StorageLike = {
    items: new Map<string, string>(),
    getItem(key) {
        return this.items.get(key) ?? null;
    },
    setItem(key, value) {
        this.items.set(key, value);
    },
    removeItem(key) {
        this.items.delete(key);
    },
    get length() {
        return this.items.size;
    },
    key(index) {
        return Array.from(this.items.keys())[index] ?? null;
    },
};
```

## Properties

### length?

> `readonly` `optional` **length**: `number`

Defined in: [src/Mnemonic/types.ts:859](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L859)

The number of items currently stored.

Optional property for enumeration support.

---

### onExternalChange()?

> `optional` **onExternalChange**: (`callback`) => () => `void`

Defined in: [src/Mnemonic/types.ts:886](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L886)

Subscribe to notifications when data changes externally.

localStorage has built-in cross-tab notification via the browser's
native `storage` event (used by the `listenCrossTab` hook option).
Non-localStorage backends (IndexedDB, custom stores, etc.) lack this
built-in mechanism. Implementing `onExternalChange` allows those
adapters to provide equivalent cross-tab synchronization through
their own transport (e.g., BroadcastChannel).

The callback accepts an optional `changedKeys` parameter:

- `callback()` or `callback(undefined)` triggers a blanket reload
  of all actively subscribed keys.
- `callback(["ns.key1", "ns.key2"])` reloads only the specified
  fully-qualified keys, which is more efficient when the adapter
  knows exactly which keys changed.
- `callback([])` is a no-op.

On a blanket reload the provider re-reads all actively subscribed
keys from the storage backend and emits change notifications for
any whose values differ from the cache.

#### Parameters

| Parameter  | Type                       | Description                        |
| ---------- | -------------------------- | ---------------------------------- |
| `callback` | (`changedKeys?`) => `void` | Invoked when external data changes |

#### Returns

An unsubscribe function that removes the callback

> (): `void`

##### Returns

`void`

## Methods

### getItem()

> **getItem**(`key`): `string` \| `null`

Defined in: [src/Mnemonic/types.ts:823](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L823)

Retrieves the value associated with a key.

#### Parameters

| Parameter | Type     | Description                 |
| --------- | -------- | --------------------------- |
| `key`     | `string` | The storage key to retrieve |

#### Returns

`string` \| `null`

The stored value as a string, or null if not found

#### Remarks

Must return synchronously. Returning a Promise is unsupported.

---

### key()?

> `optional` **key**(`index`): `string` \| `null`

Defined in: [src/Mnemonic/types.ts:852](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L852)

Returns the key at the specified index in storage.

Optional method for enumeration support.

#### Parameters

| Parameter | Type     | Description       |
| --------- | -------- | ----------------- |
| `index`   | `number` | The numeric index |

#### Returns

`string` \| `null`

The key at the given index, or null if out of bounds

---

### removeItem()

> **removeItem**(`key`): `void`

Defined in: [src/Mnemonic/types.ts:842](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L842)

Removes a key-value pair from storage.

#### Parameters

| Parameter | Type     | Description               |
| --------- | -------- | ------------------------- |
| `key`     | `string` | The storage key to remove |

#### Returns

`void`

#### Remarks

Must complete synchronously. Returning a Promise is unsupported.

---

### setItem()

> **setItem**(`key`, `value`): `void`

Defined in: [src/Mnemonic/types.ts:833](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L833)

Stores a key-value pair.

#### Parameters

| Parameter | Type     | Description               |
| --------- | -------- | ------------------------- |
| `key`     | `string` | The storage key           |
| `value`   | `string` | The string value to store |

#### Returns

`void`

#### Remarks

Must complete synchronously. Returning a Promise is unsupported.
