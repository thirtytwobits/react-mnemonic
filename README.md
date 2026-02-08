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
- **Type-safe codecs** -- built-in `JSONCodec`, `StringCodec`, `NumberCodec`, `BooleanCodec`, plus `createCodec` for custom types
- **Namespace isolation** -- `MnemonicProvider` prefixes every key to prevent collisions
- **Cross-tab sync** -- opt-in `listenCrossTab` uses the browser `storage` event
- **Pluggable storage** -- bring your own backend via the `StorageLike` interface (IndexedDB, sessionStorage, etc.)
- **Validation** -- optional type-guard with error-aware default factories
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
import { MnemonicProvider, useMnemonicKey, NumberCodec } from "react-mnemonic";

function Counter() {
  const { value: count, set } = useMnemonicKey("count", {
    defaultValue: 0,
    codec: NumberCodec,
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
| `defaultValue`   | `T \| ((error?: CodecError \| ValidationError) => T)` | *required* | Fallback value or error-aware factory        |
| `codec`          | `Codec<T>`                                        | `JSONCodec` | Encode/decode strategy                       |
| `validate`       | `(value: unknown) => value is T`                  | --          | Type-guard run after decoding                |
| `onMount`        | `(value: T) => void`                              | --          | Called once with the initial value            |
| `onChange`       | `(value: T, prev: T) => void`                     | --          | Called on every value change                  |
| `listenCrossTab` | `boolean`                                         | `false`     | Sync via the browser `storage` event         |

### Built-in codecs

| Codec          | Stored as            | Notes                                      |
| -------------- | -------------------- | ------------------------------------------ |
| `JSONCodec`    | `JSON.stringify`     | Default. Handles objects, arrays, primitives. |
| `StringCodec`  | raw string           | No JSON wrapping.                          |
| `NumberCodec`  | `String(n)`          | Throws `CodecError` on `NaN`.             |
| `BooleanCodec` | `"true"` / `"false"` | Decodes anything other than `"true"` as `false`. |

### `createCodec<T>(encode, decode)`

Build a custom codec from a pair of functions.

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

### Error classes

| Class             | Thrown when                           |
| ----------------- | ------------------------------------ |
| `CodecError`      | Encoding or decoding fails           |
| `ValidationError` | The `validate` type-guard rejects    |

Both are passed to `defaultValue` factories so you can inspect or log the
failure reason.

## Usage examples

### Cross-tab theme sync

```tsx
const { value: theme, set } = useMnemonicKey<"light" | "dark">("theme", {
  defaultValue: "light",
  codec: StringCodec,
  listenCrossTab: true,
  onChange: (t) => {
    document.documentElement.setAttribute("data-theme", t);
  },
});
```

### Validated form data

```tsx
interface FormData {
  name: string;
  email: string;
}

const isFormData = (v: unknown): v is FormData =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as any).name === "string" &&
  typeof (v as any).email === "string";

const { value, set, remove } = useMnemonicKey<FormData>("form", {
  defaultValue: { name: "", email: "" },
  validate: isFormData,
  listenCrossTab: true,
});
```

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

### Error-aware defaults

```tsx
import { useMnemonicKey, CodecError, ValidationError } from "react-mnemonic";

const getDefault = (error?: CodecError | ValidationError) => {
  if (error instanceof CodecError) {
    console.warn("Corrupt stored data:", error.message);
  }
  if (error instanceof ValidationError) {
    console.warn("Invalid stored data:", error.message);
  }
  return { count: 0 };
};

const { value } = useMnemonicKey("counter", { defaultValue: getDefault });
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
  UseMnemonicKeyOptions,
} from "react-mnemonic";
```

## License

[MIT](./LICENSE.md) -- Copyright Scott Dixon
