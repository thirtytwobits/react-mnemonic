# Interface: MnemonicProviderOptions

Defined in: [src/Mnemonic/types.ts:78](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L78)

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

### enableDevTools?

> `optional` **enableDevTools**: `boolean`

Defined in: [src/Mnemonic/types.ts:143](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L143)

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

Defined in: [src/Mnemonic/types.ts:92](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L92)

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

### schemaMode?

> `optional` **schemaMode**: [`SchemaMode`](../type-aliases/SchemaMode.md)

Defined in: [src/Mnemonic/types.ts:157](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L157)

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

Defined in: [src/Mnemonic/types.ts:179](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L179)

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

Defined in: [src/Mnemonic/types.ts:198](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L198)

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

Defined in: [src/Mnemonic/types.ts:116](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L116)

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
