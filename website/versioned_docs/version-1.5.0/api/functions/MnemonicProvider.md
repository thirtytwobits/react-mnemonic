# Function: MnemonicProvider()

> **MnemonicProvider**(`props`): `Element`

Defined in: [src/Mnemonic/provider.tsx:761](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/provider.tsx#L761)

React Context provider for namespace-isolated persistent state.

Creates a scoped storage environment where all keys are automatically prefixed
with the namespace to prevent collisions. Implements an in-memory cache with
read-through behavior to the underlying storage backend (localStorage by default).

This provider must wrap any components that use `useMnemonicKey`. Multiple
providers with different namespaces can coexist in the same application.

## Parameters

| Parameter | Type                                                              | Description                         |
| --------- | ----------------------------------------------------------------- | ----------------------------------- |
| `props`   | [`MnemonicProviderProps`](../interfaces/MnemonicProviderProps.md) | Provider configuration and children |

## Returns

`Element`

## Examples

```tsx
// Basic usage with default settings
function App() {
    return (
        <MnemonicProvider namespace="myApp">
            <MyComponents />
        </MnemonicProvider>
    );
}
```

```tsx
// With a synchronous custom storage backend
function App() {
    return (
        <MnemonicProvider namespace="myApp" storage={window.sessionStorage}>
            <MyComponents />
        </MnemonicProvider>
    );
}
```

```tsx
// With DevTools enabled (development only)
function App() {
    return (
        <MnemonicProvider namespace="myApp" enableDevTools={process.env.NODE_ENV === "development"}>
            <MyComponents />
        </MnemonicProvider>
    );
}

// Then in browser console:
const dt = window.__REACT_MNEMONIC_DEVTOOLS__.resolve("myApp");
dt?.dump();
dt?.get("user");
dt?.set("theme", "dark");
```

```tsx
// Multiple providers with different namespaces
function App() {
    return (
        <MnemonicProvider namespace="user-prefs">
            <UserSettings />
            <MnemonicProvider namespace="app-state">
                <Dashboard />
            </MnemonicProvider>
        </MnemonicProvider>
    );
}
```

```tsx
// Delay persisted storage reads until after client mount
function App() {
    return (
        <MnemonicProvider namespace="myApp" ssr={{ hydration: "client-only" }}>
            <MyComponents />
        </MnemonicProvider>
    );
}
```

## Remarks

- Creates a stable store instance that only recreates when namespace, storage, or enableDevTools change
- All storage operations are cached in memory for fast reads
- Storage failures are handled gracefully (logged but not thrown)
- `StorageLike` is intentionally synchronous for v1; async persistence must sit behind a sync facade
- In SSR environments, the provider is safe by default: hooks render
  `defaultValue` unless configured with an explicit `ssr.serverValue`
- The store implements React's useSyncExternalStore contract for efficient updates

## See

- [useMnemonicKey](useMnemonicKey.md) - Hook for using persistent state
- [MnemonicProviderOptions](../interfaces/MnemonicProviderOptions.md) - Configuration options
