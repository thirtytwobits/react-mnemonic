# Type Alias: UseMnemonicKeyOptions\<T\>

> **UseMnemonicKeyOptions**\<`T`\> = `object`

Defined in: [src/Mnemonic/types.ts:1280](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1280)

Configuration options for the useMnemonicKey hook.

These options control how a value is persisted, decoded, and
synchronized across the application.

## Example

```typescript
const { value, set } = useMnemonicKey<User>("currentUser", {
    defaultValue: { name: "Guest", id: null },
    onMount: (user) => console.log("Loaded user:", user),
    onChange: (current, previous) => {
        console.log("User changed from", previous, "to", current);
    },
    listenCrossTab: true,
});
```

## Type Parameters

| Type Parameter | Description                             |
| -------------- | --------------------------------------- |
| `T`            | The TypeScript type of the stored value |

## Properties

### codec?

> `optional` **codec**: [`Codec`](../interfaces/Codec.md)\<`T`\>

Defined in: [src/Mnemonic/types.ts:1357](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1357)

Codec for encoding and decoding values to/from storage.

Determines how the typed value is serialized to a string and
deserialized back. Defaults to JSONCodec if not specified.

Using a codec is a low-level option that bypasses JSON Schema
validation. Schema-managed keys store JSON values directly and
are validated against their registered JSON Schema.

#### Default

```ts
JSONCodec;
```

#### Example

```typescript
// Custom codec for dates
codec: createCodec(
    (date) => date.toISOString(),
    (str) => new Date(str),
);
```

---

### defaultValue

> **defaultValue**: `T` \| (`error?`) => `T`

Defined in: [src/Mnemonic/types.ts:1334](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1334)

Default value to use when no stored value exists, or when decoding/validation fails.

Can be a literal value or a factory function that returns the default.
Factory functions receive an optional error argument describing why the
fallback is being used:

- `undefined` — Nominal path: no value exists in storage for this key.
- `CodecError` — The stored value could not be decoded by the codec.
- `SchemaError` — A schema, migration, or validation issue occurred
  (e.g. missing schema, failed migration, JSON Schema validation failure).

Static (non-function) default values ignore the error entirely.

#### Remarks

If a factory function is defined inline, it creates a new reference on
every render, which forces internal memoization to recompute. For best
performance, define the factory at module level or wrap it in `useCallback`:

```typescript
// Module-level (stable reference, preferred)
const getDefault = (error?: CodecError | SchemaError) => {
    if (error) console.warn("Fallback:", error.message);
    return { count: 0 };
};

// Or with useCallback inside a component
const getDefault = useCallback((error?: CodecError | SchemaError) => ({ count: 0 }), []);
```

#### Example

```typescript
// Static default
defaultValue: {
    count: 0;
}

// Factory with no error handling
defaultValue: () => ({ timestamp: Date.now() });

// Error-aware factory
defaultValue: (error) => {
    if (error instanceof CodecError) {
        console.error("Corrupt data:", error.message);
    }
    if (error instanceof SchemaError) {
        console.warn("Schema issue:", error.code, error.message);
    }
    return { count: 0 };
};
```

---

### listenCrossTab?

> `optional` **listenCrossTab**: `boolean`

Defined in: [src/Mnemonic/types.ts:1455](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1455)

Enable listening for changes from other browser tabs.

When true, uses the browser's `storage` event to detect changes
made to localStorage in other tabs and synchronizes them to this component.

Only effective when using localStorage as the storage backend.

#### Default

```ts
false;
```

#### Example

```typescript
// Enable cross-tab sync for shared state
listenCrossTab: true;
```

#### Remarks

The `storage` event only fires for changes made in _other_ tabs,
not the current tab. Changes within the same tab are synchronized
automatically via React's state management.

---

### onChange()?

> `optional` **onChange**: (`value`, `prev`) => `void`

Defined in: [src/Mnemonic/types.ts:1432](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1432)

Callback invoked whenever the value changes.

Receives both the new value and the previous value. This is called
for all changes, including those triggered by other components or tabs.

#### Parameters

| Parameter | Type | Description           |
| --------- | ---- | --------------------- |
| `value`   | `T`  | The new current value |
| `prev`    | `T`  | The previous value    |

#### Returns

`void`

#### Example

```typescript
onChange: (newTheme, oldTheme) => {
    document.body.classList.remove(oldTheme);
    document.body.classList.add(newTheme);
    console.log(`Theme changed: ${oldTheme} -> ${newTheme}`);
};
```

---

### onMount()?

> `optional` **onMount**: (`value`) => `void`

Defined in: [src/Mnemonic/types.ts:1412](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1412)

Callback invoked once when the hook is first mounted.

Receives the initial value (either from storage or the default).
Useful for triggering side effects based on the loaded state.

#### Parameters

| Parameter | Type | Description                       |
| --------- | ---- | --------------------------------- |
| `value`   | `T`  | The initial value loaded on mount |

#### Returns

`void`

#### Example

```typescript
onMount: (theme) => {
    document.body.className = theme;
    console.log("Theme loaded:", theme);
};
```

---

### reconcile()?

> `optional` **reconcile**: (`value`, `context`) => `T`

Defined in: [src/Mnemonic/types.ts:1394](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1394)

Optional read-time reconciliation hook for persisted values.

Runs after a stored value has been decoded and any read-time migrations
have completed, but before the hook exposes the value to React. This is
useful for selectively enforcing newly shipped defaults or normalizing
legacy persisted values without discarding the whole key.

If the reconciled value would persist differently from the pre-reconcile
value, the hook rewrites storage once using the normal write path.

#### Parameters

| Parameter | Type                                      | Description                                          |
| --------- | ----------------------------------------- | ---------------------------------------------------- |
| `value`   | `T`                                       | The decoded persisted value                          |
| `context` | [`ReconcileContext`](ReconcileContext.md) | Metadata about the stored and latest schema versions |

#### Returns

`T`

#### Remarks

Prefer schema migrations for structural changes that must always happen
between explicit versions. Use `reconcile` for conditional, field-level
adjustments that depend on application policy rather than a strict schema
upgrade step.

See the Schema Migration guide for migration-vs-reconciliation guidance:
https://thirtytwobits.github.io/react-mnemonic/docs/guides/schema-migration

If `reconcile` throws a `SchemaError`, that error is preserved and passed
to `defaultValue`. Any other thrown error is wrapped as
`SchemaError("RECONCILE_FAILED")`.

#### Example

```typescript
reconcile: (value, { persistedVersion }) => ({
    ...value,
    theme: persistedVersion < 2 ? "dark" : value.theme,
});
```

---

### schema?

> `optional` **schema**: `object`

Defined in: [src/Mnemonic/types.ts:1490](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1490)

Optional schema controls for this key.

Allows overriding the version written by the `set` function. When
omitted, the library writes using the highest registered schema for
this key, or version `0` when no schemas are registered.

#### version?

> `optional` **version**: `number`

Explicit schema version to use when writing values.

When set, the `set` and `reset` functions encode using the
schema registered at this version instead of the latest. Useful
during gradual rollouts where not all consumers have been
updated yet.

Must reference a version that exists in the `SchemaRegistry`.
If not found the write falls back to the latest schema (default
mode) or fails with a `SchemaError` (strict mode).

#### Example

```typescript
// Pin writes to schema version 2 even if version 3 exists
const { value, set } = useMnemonicKey("user", {
    defaultValue: { name: "" },
    schema: { version: 2 },
});
```

---

### ssr?

> `optional` **ssr**: [`MnemonicKeySSRConfig`](../interfaces/MnemonicKeySSRConfig.md)\<`T`\>

Defined in: [src/Mnemonic/types.ts:1472](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1472)

Server-rendering controls for this key.

Use this when the server should render a value other than
`defaultValue`, or when persisted storage should only be read after the
component has mounted on the client.

#### Example

```typescript
ssr: {
  serverValue: { theme: "system" },
  hydration: "client-only",
}
```
