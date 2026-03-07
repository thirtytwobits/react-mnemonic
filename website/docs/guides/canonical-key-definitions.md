---
sidebar_position: 5
title: Canonical Key Definitions
description: Define persisted key contracts once and reuse them across components.
---

# Canonical Key Definitions

When the same persisted key appears in multiple components, define it once and
reuse the descriptor everywhere instead of repeating `useMnemonicKey("...", { ... })`
at each call site.

```tsx title="theme-key.ts"
import { defineMnemonicKey } from "react-mnemonic";

export const themeKey = defineMnemonicKey("theme", {
    defaultValue: "light" as "light" | "dark",
    listenCrossTab: true,
});
```

Then consume the descriptor anywhere inside your provider:

```tsx title="ThemeControls.tsx"
import { useMnemonicKey } from "react-mnemonic";
import { themeKey } from "./theme-key";

export function ThemeToggle() {
    const { value: theme, set } = useMnemonicKey(themeKey);

    return <button onClick={() => set(theme === "light" ? "dark" : "light")}>Theme: {theme}</button>;
}

export function ThemePreview() {
    const { value: theme } = useMnemonicKey(themeKey);
    return <p>Current theme: {theme}</p>;
}
```

## Why use descriptors

- Keep one canonical contract for `defaultValue`, `schema`, `codec`, and `reconcile`.
- Reuse the same persisted key safely across multiple components.
- Make refactors less error-prone because the key name and options live together.
- Reduce ambiguity for AI-assisted code generation and code review.

The lightweight form still works and is still recommended for one-off keys:

```tsx
const { value, set } = useMnemonicKey("sidebarOpen", {
    defaultValue: false,
});
```

## Descriptors with nullable clear intent

Descriptors preserve the same semantics as the plain hook call:

```tsx
import { defineMnemonicKey, useMnemonicKey } from "react-mnemonic";

const displayNameKey = defineMnemonicKey("displayName", {
    defaultValue: "Anonymous" as string | null,
});

function ProfileName() {
    const { value, set, remove, reset } = useMnemonicKey(displayNameKey);

    // Persist a durable cleared intent.
    const clear = () => set(null);

    // Remove the key entirely so reads fall back to the default.
    const forget = () => remove();

    // Persist the default value again.
    const restore = () => reset();

    return (
        <>
            <p>{value ?? "(cleared)"}</p>
            <button onClick={clear}>Clear</button>
            <button onClick={forget}>Forget</button>
            <button onClick={restore}>Restore default</button>
        </>
    );
}
```

See [Clearable Persisted Values](/docs/guides/clearable-persisted-values) for
the semantic differences between `set(null)`, `remove()`, and `reset()`.

## Descriptors with schema-managed keys

Descriptors work with the full schema/migration stack:

```tsx
import { createSchemaRegistry, defineMnemonicKey, useMnemonicKey } from "react-mnemonic";

const registry = createSchemaRegistry({
    schemas: [
        {
            key: "profile",
            version: 1,
            schema: {
                type: "object",
                properties: {
                    name: { type: "string" },
                },
                required: ["name"],
                additionalProperties: false,
            },
        },
    ],
    migrations: [],
});

export const profileKey = defineMnemonicKey("profile", {
    defaultValue: { name: "" },
});

function ProfileEditor() {
    const { value, set } = useMnemonicKey(profileKey);
    return <input value={value.name} onChange={(e) => set({ name: e.target.value })} />;
}
```

Descriptors do not change persistence behavior. They simply make the contract
importable and easier to reuse consistently.

## AI-assisted workflows

If you want coding agents to use `react-mnemonic` correctly, descriptors are a
good default because they:

- expose one authoritative place to inspect a key's semantics
- avoid repeated inline option objects with slightly different behavior
- make generated code easier to align with existing application conventions

That makes descriptor-based keys a strong default for shared durable state such
as theme preferences, saved filters, onboarding progress, and other reusable
UI contracts.
