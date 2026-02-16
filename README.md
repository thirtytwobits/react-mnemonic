# react-mnemonic

Persistent, type-safe state management for React.

[![npm version](https://img.shields.io/npm/v/react-mnemonic.svg)](https://www.npmjs.com/package/react-mnemonic)
[![bundle size](https://img.shields.io/bundlephobia/minzip/react-mnemonic)](https://bundlephobia.com/package/react-mnemonic)
[![license](https://img.shields.io/npm/l/react-mnemonic.svg)](./LICENSE.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

---

**react-mnemonic** gives your React components persistent memory. Values survive
page refreshes, synchronize across tabs, and stay type-safe end-to-end -- all
through a single hook that works like `useState`.

## Features

- **`useState`-like API** -- `useMnemonicKey` returns `{ value, set, reset, remove }`
- **JSON Schema validation** -- optional schema-based validation using a built-in JSON Schema subset
- **Namespace isolation** -- `MnemonicProvider` prefixes every key to prevent collisions
- **Cross-tab sync** -- opt-in `listenCrossTab` uses the browser `storage` event
- **Pluggable storage** -- bring your own backend via the `StorageLike` interface (IndexedDB, sessionStorage, etc.)
- **Schema versioning and migration** -- upgrade stored data with versioned schemas and migration rules
- **Write-time normalization** -- migrations where `fromVersion === toVersion` run on every write
- **Lifecycle callbacks** -- `onMount` and `onChange` hooks
- **DevTools** -- inspect and mutate state from the browser console
- **SSR-safe** -- returns defaults when `window` is unavailable
- **Tree-shakeable, zero dependencies** -- ships ESM + CJS with full TypeScript declarations

## Installation

```bash
npm install react-mnemonic
```

```bash
yarn add react-mnemonic
```

```bash
pnpm add react-mnemonic
```

### Peer dependencies

React 18 or later is required.

```json
{
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  }
}
```

## Quick start

Wrap your app in a `MnemonicProvider`, then call `useMnemonicKey` anywhere inside it.

```tsx
import { MnemonicProvider, useMnemonicKey } from "react-mnemonic";

function Counter() {
  const { value: count, set } = useMnemonicKey("count", {
    defaultValue: 0,
  });

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => set((c) => c + 1)}>Increment</button>
    </div>
  );
}

export default function App() {
  return (
    <MnemonicProvider namespace="my-app">
      <Counter />
    </MnemonicProvider>
  );
}
```

The counter value persists in `localStorage` under the key `my-app.count` and
survives full page reloads.

## API

### `<MnemonicProvider>`

Context provider that scopes storage keys under a namespace.

```tsx
<MnemonicProvider
  namespace="my-app"       // key prefix (required)
  storage={localStorage}   // StorageLike backend (default: localStorage)
  schemaMode="default"     // "default" | "strict" | "autoschema" (default: "default")
  schemaRegistry={registry} // optional SchemaRegistry for versioned schemas
  enableDevTools={false}   // expose console helpers (default: false)
>
  {children}
</MnemonicProvider>
```

Multiple providers with different namespaces can coexist in the same app.

### `useMnemonicKey<T>(key, options)`

Hook for reading and writing a single persistent value.

```ts
const { value, set, reset, remove } = useMnemonicKey<T>(key, options);
```

| Return   | Type                           | Description                                      |
| -------- | ------------------------------ | ------------------------------------------------ |
| `value`  | `T`                            | Current decoded value (or default)               |
| `set`    | `(next: T \| (cur: T) => T) => void` | Update the value (direct or updater function) |
| `reset`  | `() => void`                   | Reset to `defaultValue` and persist it           |
| `remove` | `() => void`                   | Delete the key from storage entirely             |

#### Options

| Option           | Type                                              | Default     | Description                                  |
| ---------------- | ------------------------------------------------- | ----------- | -------------------------------------------- |
| `defaultValue`   | `T \| ((error?: CodecError \| SchemaError) => T)` | *required* | Fallback value or error-aware factory        |
| `codec`          | `Codec<T>`                                        | `JSONCodec` | Encode/decode strategy (bypasses schema validation) |
| `onMount`        | `(value: T) => void`                              | --          | Called once with the initial value            |
| `onChange`       | `(value: T, prev: T) => void`                     | --          | Called on every value change                  |
| `listenCrossTab` | `boolean`                                         | `false`     | Sync via the browser `storage` event         |
| `schema`         | `{ version?: number }`                            | --          | Pin writes to a specific schema version      |

### Codecs

The default codec is `JSONCodec`, which handles all JSON-serializable values.
You can create custom codecs using `createCodec` for types that need special
serialization (e.g., `Date`, `Set`, `Map`).

Using a custom codec bypasses JSON Schema validation -- the codec is a low-level
escape hatch for when you need full control over serialization.

```ts
import { createCodec } from "react-mnemonic";

const DateCodec = createCodec<Date>(
  (date) => date.toISOString(),
  (str) => new Date(str),
);
```

### `StorageLike`

The interface your custom storage backend must satisfy.

```ts
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key?(index: number): string | null;
  readonly length?: number;
  onExternalChange?: (callback: (changedKeys?: string[]) => void) => () => void;
}
```

`onExternalChange` enables cross-tab sync for non-localStorage backends (e.g.
IndexedDB over `BroadcastChannel`). The library handles all error cases
internally -- see the `StorageLike` JSDoc for the full error-handling contract.

### `validateJsonSchema(schema, value)`

Validate an arbitrary value against a JSON Schema (the same subset used by the
hook). Returns an array of validation errors, empty when the value is valid.

```ts
import { validateJsonSchema } from "react-mnemonic";

const errors = validateJsonSchema(
  { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  { name: 42 },
);
// [{ path: ".name", message: 'Expected type "string"' }]
```

### `compileSchema(schema)`

Pre-compile a JSON Schema into a reusable validator function. The compiled
validator is cached by schema reference (via `WeakMap`), so calling
`compileSchema` twice with the same object returns the identical function.

```ts
import { compileSchema } from "react-mnemonic";
import type { CompiledValidator } from "react-mnemonic";

const validate: CompiledValidator = compileSchema({
  type: "object",
  properties: {
    name: { type: "string", minLength: 1 },
    age: { type: "number", minimum: 0 },
  },
  required: ["name"],
});

validate({ name: "Alice", age: 30 }); // []
validate({ age: -1 });                // [{ path: "", … }, { path: ".age", … }]
```

This is useful when you validate the same schema frequently outside of the hook
(e.g. in form validation or server responses).

### Error classes

| Class             | Thrown when                           |
| ----------------- | ------------------------------------ |
| `CodecError`      | Encoding or decoding fails           |
| `SchemaError`     | Schema validation or migration fails |

Both are passed to `defaultValue` factories so you can inspect or log the
failure reason.

## Usage examples

### Cross-tab theme sync

```tsx
const { value: theme, set } = useMnemonicKey<"light" | "dark">("theme", {
  defaultValue: "light",
  listenCrossTab: true,
  onChange: (t) => {
    document.documentElement.setAttribute("data-theme", t);
  },
});
```

### Error-aware defaults

```tsx
import { useMnemonicKey, CodecError, SchemaError } from "react-mnemonic";

const getDefault = (error?: CodecError | SchemaError) => {
  if (error instanceof CodecError) {
    console.warn("Corrupt stored data:", error.message);
  }
  if (error instanceof SchemaError) {
    console.warn("Schema validation failed:", error.message);
  }
  return { count: 0 };
};

const { value } = useMnemonicKey("counter", { defaultValue: getDefault });
```

## Schema modes and versioning

Mnemonic supports optional schema versioning through `schemaMode` and an
optional `schemaRegistry`.

- `default`: Schemas are optional. Reads use a schema when one exists for the
  stored version, otherwise the hook codec. Writes use the highest registered
  schema for the key; if no schemas are registered, writes use an unversioned
  (v0) envelope.
- `strict`: Every stored version must have a registered schema. Reads without a
  matching schema fall back to `defaultValue` with a `SchemaError`.
  Writes require a registered schema when any schemas exist, but fall back to
  a v0 envelope when the registry has none.
- `autoschema`: Like `default`, but if no schema exists for a key, the first
  successful read infers and registers a v1 schema. Subsequent reads/writes use
  that schema.

Version `0` is valid for schemas and migrations. Schemas at version `0` are
treated like any other version.

### JSON Schema validation

Schemas use a subset of JSON Schema for validation. The supported keywords are:

- `type` (including array form for nullable types, e.g., `["string", "null"]`)
- `enum`, `const`
- `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`
- `minLength`, `maxLength`
- `properties`, `required`, `additionalProperties`
- `items`, `minItems`, `maxItems`

```ts
// Schema definition -- fully serializable JSON, no functions
const schema: KeySchema = {
  key: "profile",
  version: 1,
  schema: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1 },
      email: { type: "string" },
      age: { type: "number", minimum: 0 },
    },
    required: ["name", "email"],
  },
};
```

### Write-time migrations (normalizers)

A migration where `fromVersion === toVersion` runs on every write, acting as a
normalizer. This is useful for trimming whitespace, lowercasing strings, etc.

```ts
const normalizer: MigrationRule = {
  key: "name",
  fromVersion: 1,
  toVersion: 1,
  migrate: (value) => String(value).trim().toLowerCase(),
};
```

### Example schema registry

A schema registry stores versioned schemas for each key, and resolves migration
paths to upgrade stored data. Schemas are plain JSON (serializable); migrations
are procedural functions.

```tsx
import {
  MnemonicProvider,
  useMnemonicKey,
  type SchemaRegistry,
  type KeySchema,
  type MigrationRule,
} from "react-mnemonic";

const schemas = new Map<string, KeySchema>();
const migrations: MigrationRule[] = [];

const registry: SchemaRegistry = {
  getSchema: (key, version) => schemas.get(`${key}:${version}`),
  getLatestSchema: (key) =>
    Array.from(schemas.values())
      .filter((schema) => schema.key === key)
      .sort((a, b) => b.version - a.version)[0],
  getMigrationPath: (key, fromVersion, toVersion) => {
    const byKey = migrations.filter((rule) => rule.key === key);
    const path: MigrationRule[] = [];
    let cur = fromVersion;
    while (cur < toVersion) {
      const next = byKey.find((rule) => rule.fromVersion === cur);
      if (!next) return null;
      path.push(next);
      cur = next.toVersion;
    }
    return path;
  },
  getWriteMigration: (key, version) => {
    return migrations.find(
      (r) => r.key === key && r.fromVersion === version && r.toVersion === version,
    );
  },
  registerSchema: (schema) => {
    const id = `${schema.key}:${schema.version}`;
    if (schemas.has(id)) throw new Error(`Schema already registered for ${id}`);
    schemas.set(id, schema);
  },
};

registry.registerSchema({
  key: "profile",
  version: 1,
  schema: {
    type: "object",
    properties: { name: { type: "string" }, email: { type: "string" } },
    required: ["name", "email"],
  },
});

migrations.push({
  key: "profile",
  fromVersion: 1,
  toVersion: 2,
  migrate: (value) => {
    const v1 = value as { name: string; email: string };
    return { ...v1, migratedAt: new Date().toISOString() };
  },
});

registry.registerSchema({
  key: "profile",
  version: 2,
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string" },
      migratedAt: { type: "string" },
    },
    required: ["name", "email", "migratedAt"],
  },
});

function ProfileEditor() {
  const { value, set } = useMnemonicKey<{ name: string; email: string; migratedAt: string }>("profile", {
    defaultValue: { name: "", email: "", migratedAt: "" },
  });
  return (
    <input
      value={value.name}
      onChange={(e) => set({ ...value, name: e.target.value })}
    />
  );
}

<MnemonicProvider namespace="app" schemaMode="default" schemaRegistry={registry}>
  <ProfileEditor />
</MnemonicProvider>;
```

### Registry immutability

In `default` and `strict` modes, the schema registry is treated as immutable for
the lifetime of the provider. The hook caches registry lookups to keep read and
write hot paths fast. To ship new schemas or migrations, publish a new app
version and remount the provider.

`autoschema` remains mutable because inferred schemas are registered at runtime.

### Custom storage backend

```tsx
import { MnemonicProvider } from "react-mnemonic";
import type { StorageLike } from "react-mnemonic";

const idbStorage: StorageLike = {
  getItem: (key) => /* read from IndexedDB */,
  setItem: (key, value) => /* write to IndexedDB */,
  removeItem: (key) => /* delete from IndexedDB */,
  onExternalChange: (cb) => {
    const bc = new BroadcastChannel("my-app-sync");
    bc.onmessage = (e) => cb(e.data.keys);
    return () => bc.close();
  },
};

<MnemonicProvider namespace="my-app" storage={idbStorage}>
  <App />
</MnemonicProvider>
```

### DevTools

Enable the console inspector in development:

```tsx
<MnemonicProvider namespace="app" enableDevTools={process.env.NODE_ENV === "development"}>
```

Then in the browser console:

```js
__REACT_MNEMONIC_DEVTOOLS__.app.dump();       // table of all keys
__REACT_MNEMONIC_DEVTOOLS__.app.get("theme"); // read a decoded value
__REACT_MNEMONIC_DEVTOOLS__.app.set("theme", "dark"); // write
__REACT_MNEMONIC_DEVTOOLS__.app.remove("theme");      // delete
__REACT_MNEMONIC_DEVTOOLS__.app.keys();       // list all keys
__REACT_MNEMONIC_DEVTOOLS__.app.clear();      // remove all keys
```

## TypeScript

The library is written in strict TypeScript and ships its own declarations.
All public types are re-exported from the package root:

```ts
import type {
  Codec,
  StorageLike,
  MnemonicProviderOptions,
  MnemonicProviderProps,
  UseMnemonicKeyOptions,
  KeySchema,
  MigrationRule,
  MigrationPath,
  SchemaRegistry,
  SchemaMode,
  JsonSchema,
  JsonSchemaValidationError,
  CompiledValidator,
} from "react-mnemonic";
```

## License

[MIT](./LICENSE.md) -- Copyright Scott Dixon
