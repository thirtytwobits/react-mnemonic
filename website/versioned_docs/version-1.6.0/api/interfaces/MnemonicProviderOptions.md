# Interface: MnemonicProviderOptions

Defined in: [src/Mnemonic/types.ts:78](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L78)

Configuration options for MnemonicProvider.

These options configure the behavior of the storage provider, including
namespace isolation, storage backend selection, cross-tab synchronization,
and developer tools integration.

## Example

```tsx
<MnemonicProvider namespace="myApp" storage={localStorage} enableDevTools={process.env.NODE_ENV === "development"}>
    <App />
</MnemonicProvider>
```

## Properties

### bootstrap?

> `optional` **bootstrap**: [`MnemonicBootstrapSeed`](../type-aliases/MnemonicBootstrapSeed.md)\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/Mnemonic/types.ts:212](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L212)

Optional bootstrap snapshot used to seed the provider cache before the
first hook subscribes.

Pass the object returned by `recallMnemonic(...)` when you synchronously
read values before React renders, for example to apply a theme attribute
before first paint and then ensure the first `useMnemonicKey(...)` read
sees the same raw storage snapshot without re-reading storage.

This seed is consumed only during the provider's initial mount. Later
prop changes are ignored so rerenders do not recreate the internal store.

---

### enableDevTools?

> `optional` **enableDevTools**: `boolean`

Defined in: [src/Mnemonic/types.ts:143](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L143)

Enable DevTools debugging interface.

When enabled, registers this provider in the global
`window.__REACT_MNEMONIC_DEVTOOLS__` registry.

The registry stores providers as weak references and exposes:

- `resolve(namespace)` to strengthen a provider reference and access
  inspection methods.
- `list()` to enumerate provider availability.

#### Default

```ts
false;
```

#### Example

```typescript
// Enable in development only
enableDevTools: process.env.NODE_ENV === "development";

// Then in browser console:
const provider = window.__REACT_MNEMONIC_DEVTOOLS__?.resolve("myApp");
provider?.dump();
provider?.get("user");
provider?.set("user", { name: "Test" });
```

---

### namespace

> **namespace**: `string`

Defined in: [src/Mnemonic/types.ts:92](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L92)

Namespace prefix for all storage keys.

All keys stored by this provider will be prefixed with `${namespace}.`
to avoid collisions between different parts of your application or
different applications sharing the same storage backend.

#### Example

```typescript
// With namespace="myApp", a key "user" becomes "myApp.user" in storage
namespace: "myApp";
```

---

### onStorageError()?

> `optional` **onStorageError**: (`event`) => `void`

Defined in: [src/Mnemonic/types.ts:280](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L280)

Called when a mutation did not reach storage.

Without this, a dropped write produces only a `console.error`, which is
invisible to the people using the application. This is the programmatic
channel: it lets an app tell the user their changes are not being saved
while they can still do something about it.

Fires for every classified failure — quota, blocked access, schema
rejection, encode failure, and synchronous-contract violations — whether
the mutation came from `set()`, `reset()`, `remove()`, or a `flush()`
retry.

#### Parameters

| Parameter | Type                                                        |
| --------- | ----------------------------------------------------------- |
| `event`   | [`MnemonicStorageErrorEvent`](MnemonicStorageErrorEvent.md) |

#### Returns

`void`

#### Remarks

**Not every event is queued for retry.** The callback is strictly wider
than [Mnemonic.unpersistedKeys](../type-aliases/Mnemonic.md#unpersistedkeys), and
[MnemonicStorageErrorEvent.reason](MnemonicStorageErrorEvent.md#reason) says which kind you have:

- `"quota"`, `"access"`, `"contract"` are storage-layer drops. The cache
  holds the new value, the key is queued, and `flush()` can retry it.
  For these the two channels agree exactly — this says a write was
  dropped, `unpersistedKeys()` says it is still outstanding.
- `"schema"`, `"codec"`, `"unknown"` are rejected before storage is
  called. The cache is unchanged and nothing is queued, so these events
  have no matching `unpersistedKeys()` entry and `flush()` will not
  retry them. Do not promise the user a retry for these.

**It reports drops, not throws.** A write the backend rejects that turns
out to leave storage holding the intended value already — a reset to the
value on disk, for example — is not reported at all, matching the fact
that it is not queued either.

**It is not squelched.** The matching console messages are logged once
and then suppressed until the next success; this callback fires on every
dropped mutation, so a caller can count failures or track them per key.
Debounce in the handler if you are driving a notification from it.

**Keep the handler cheap and side-effect-light.** It runs synchronously
inside the mutation, after the cache is updated and subscribers are
notified. Writing to the store from inside it is not recommended; a
nested failure is dropped rather than reported, to avoid unbounded
recursion. Throwing is contained — the mutation still completes — and is
reported once per store.

#### Example

```tsx
<MnemonicProvider
    namespace="app"
    onStorageError={(event) => {
        if (event.reason === "quota") {
            toast.error("Out of space — your changes are not being saved.");
        }
        telemetry.record("mnemonic_write_dropped", {
            key: event.key,
            reason: event.reason,
        });
    }}
>
    <App />
</MnemonicProvider>
```

#### See

- [MnemonicStorageErrorEvent](MnemonicStorageErrorEvent.md) - Shape of the reported event
- [Mnemonic.unpersistedKeys](../type-aliases/Mnemonic.md#unpersistedkeys) - Which keys are still outstanding
- [Mnemonic.flush](../type-aliases/Mnemonic.md#flush) - Re-attempt the dropped writes

---

### schemaMode?

> `optional` **schemaMode**: [`SchemaMode`](../type-aliases/SchemaMode.md)

Defined in: [src/Mnemonic/types.ts:157](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L157)

Versioning and schema enforcement mode.

Controls whether stored values require a registered schema, and how
missing schemas are handled. See [SchemaMode](../type-aliases/SchemaMode.md) for the behaviour
of each mode.

#### Default

```ts
"default";
```

#### See

- [SchemaMode](../type-aliases/SchemaMode.md) - Detailed description of each mode
- [SchemaRegistry](SchemaRegistry.md) - Registry supplied via `schemaRegistry`

---

### schemaRegistry?

> `optional` **schemaRegistry**: [`SchemaRegistry`](SchemaRegistry.md)

Defined in: [src/Mnemonic/types.ts:179](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L179)

Schema registry used for version lookup and migration resolution.

When provided, the library uses the registry to find the correct
JSON Schema for each stored version, and to resolve migration paths
when upgrading old data to the latest schema.

Required when `schemaMode` is `"strict"` or `"autoschema"`.
Optional (but recommended) in `"default"` mode.

#### Remarks

In `"default"` and `"strict"` modes, the registry is treated as
immutable after the provider initializes. Updates should be shipped
as part of a new app version and applied by remounting the provider.
`"autoschema"` remains mutable so inferred schemas can be registered
at runtime.

#### See

- [SchemaRegistry](SchemaRegistry.md) - Interface the registry must implement
- [KeySchema](../type-aliases/KeySchema.md) - Schema definition stored in the registry

---

### ssr?

> `optional` **ssr**: [`MnemonicProviderSSRConfig`](MnemonicProviderSSRConfig.md)

Defined in: [src/Mnemonic/types.ts:198](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L198)

Server-rendering and hydration defaults for descendant hooks.

Provider-level SSR settings establish the default hydration strategy for
all `useMnemonicKey(...)` calls in this namespace. Individual hooks may
still override the strategy when a specific key needs different behavior.

#### Example

```tsx
<MnemonicProvider namespace="app" ssr={{ hydration: "client-only" }}>
    <App />
</MnemonicProvider>
```

---

### storage?

> `optional` **storage**: [`StorageLike`](../type-aliases/StorageLike.md)

Defined in: [src/Mnemonic/types.ts:116](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L116)

Storage backend to use for persistence.

Defaults to `window.localStorage` in browser environments. You can provide
a synchronous custom implementation (e.g., sessionStorage, an in-memory
cache facade over IndexedDB, or a mock for testing).

#### Default

```ts
window.localStorage;
```

#### Example

```typescript
// Use sessionStorage instead of localStorage
storage: window.sessionStorage

// Use a custom storage implementation
storage: {
  getItem: (key) => myCustomStore.get(key),
  setItem: (key, value) => myCustomStore.set(key, value),
  removeItem: (key) => myCustomStore.delete(key)
}
```
