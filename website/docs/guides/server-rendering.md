---
sidebar_position: 9
title: Server Rendering
description: Control server placeholders and hydration timing in Next.js, Remix, and other SSR apps.
---

# Server Rendering

`react-mnemonic` is SSR-safe by default, and now exposes explicit controls for
the server value and hydration timing.

## Default contract

Without extra configuration, `useMnemonicKey(...)` behaves like this:

1. The server snapshot is empty.
2. The hook renders `defaultValue` on the server.
3. The client hydrates that same value first.
4. After hydration, the hook reads persisted storage and updates if needed.

That means a post-hydration transition from `defaultValue` to the persisted
value is expected behavior, not a React hydration mismatch.

```tsx
const { value } = useMnemonicKey("theme", {
    defaultValue: "light" as "light" | "dark",
});
```

If storage already contains `"dark"`, the server still renders `"light"`, then
the client updates to `"dark"` after hydration completes.

## Render an explicit server placeholder

Use `ssr.serverValue` when the server should render a different placeholder than
`defaultValue`.

```tsx
const { value } = useMnemonicKey("theme", {
    defaultValue: "light" as "light" | "dark" | "system",
    ssr: {
        serverValue: "system",
    },
});
```

This value is only used for SSR and hydration. It is not persisted
automatically. After hydration, the hook transitions to the stored value if one
exists, or falls back to `defaultValue` if storage is empty.

## Delay storage reads until after mount

Use `hydration: "client-only"` when you want the server placeholder to remain
stable until the component has mounted on the client.

You can set it per key:

```tsx
const { value } = useMnemonicKey("sidebar", {
    defaultValue: "closed" as "open" | "closed",
    ssr: {
        hydration: "client-only",
    },
});
```

Or set it once at the provider level:

```tsx
<MnemonicProvider namespace="app" ssr={{ hydration: "client-only" }}>
    <App />
</MnemonicProvider>
```

In `client-only` mode, the hook does not read or subscribe to persisted storage
until after mount.

## Next.js

`MnemonicProvider` and `useMnemonicKey(...)` belong in a client component.

```tsx title="app/providers.tsx"
"use client";

import { MnemonicProvider } from "react-mnemonic";

export function Providers({ children }: { children: React.ReactNode }) {
    return <MnemonicProvider namespace="app">{children}</MnemonicProvider>;
}
```

If your server already knows a placeholder value from cookies, headers, or
database data, pass that value into a client component and feed it to
`ssr.serverValue`:

```tsx title="app/theme-toggle.tsx"
"use client";

import { useMnemonicKey } from "react-mnemonic";

export function ThemeToggle({ serverTheme }: { serverTheme: "light" | "dark" | "system" }) {
    const { value, set } = useMnemonicKey("theme", {
        defaultValue: "light",
        ssr: {
            serverValue: serverTheme,
        },
    });

    return <button onClick={() => set(value === "dark" ? "light" : "dark")}>{value}</button>;
}
```

Choose `client-only` when local persisted state should win only after hydration,
even if the server had no matching value available.

## Remix

In Remix, loader data can provide the same deterministic server placeholder:

```tsx
export async function loader() {
    return json({ serverTheme: "system" as const });
}

export default function SettingsRoute() {
    const { serverTheme } = useLoaderData<typeof loader>();
    const { value } = useMnemonicKey("theme", {
        defaultValue: "light" as "light" | "dark" | "system",
        ssr: {
            serverValue: serverTheme,
        },
    });

    return <div>{value}</div>;
}
```

If you prefer not to touch local persisted state until the route is mounted in
the browser, add `hydration: "client-only"` either on the key or the provider.

## Mismatch expectations

React hydration warnings happen when the server markup and the initial client
hydration render do not match. `react-mnemonic` avoids that by reusing the same
SSR snapshot during hydration.

Mismatch risk comes from non-deterministic `serverValue` factories such as
`Date.now()` or `Math.random()`. If you need dynamic server values, compute them
once on the server and pass them through serialized props so the client
hydrates the same value.
