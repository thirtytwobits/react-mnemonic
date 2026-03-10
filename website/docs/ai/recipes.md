---
sidebar_position: 4
title: Recipes
description: Canonical copy-pastable patterns for the most common durable state behaviors.
---

# Recipes

These recipes are intentionally compact and focus on durable state choices that
agents often get wrong under time pressure.

## 1. Theme Preference With Cross-Tab Sync

```tsx
import { defineMnemonicKey, useMnemonicKey } from "react-mnemonic";

export const themeKey = defineMnemonicKey("theme", {
    defaultValue: "light" as "light" | "dark",
    listenCrossTab: true,
});

export function ThemeToggle() {
    const { value: theme, set } = useMnemonicKey(themeKey);

    return <button onClick={() => set(theme === "light" ? "dark" : "light")}>Theme: {theme}</button>;
}
```

Use when:

- the value should survive reload
- multiple components should share one contract
- other tabs should stay in sync

## 2. Saved Filters With Durable Clear Intent

```tsx
import { useMnemonicKey } from "react-mnemonic";

type Filters = {
    status: "all" | "open" | "closed";
    assignee: string | null;
};

export function FilterBar() {
    const {
        value: filters,
        set,
        reset,
        remove,
    } = useMnemonicKey<Filters>("issue-filters", {
        defaultValue: {
            status: "all",
            assignee: null,
        },
    });

    return (
        <>
            <button onClick={() => set((prev) => ({ ...prev, status: "open" }))}>Open only</button>
            <button onClick={() => set((prev) => ({ ...prev, assignee: null }))}>Clear assignee</button>
            <button onClick={() => reset()}>Restore default filters</button>
            <button onClick={() => remove()}>Forget filter history</button>
            <pre>{JSON.stringify(filters, null, 2)}</pre>
        </>
    );
}
```

Use `null` inside the persisted object when "cleared" should survive reload.

## 3. Dismissible Announcement UI

```tsx
import { useMnemonicKey } from "react-mnemonic";

export function ReleaseBanner() {
    const {
        value: dismissed,
        set,
        remove,
    } = useMnemonicKey("release-banner-dismissed", {
        defaultValue: false,
    });

    if (dismissed) {
        return <button onClick={() => remove()}>Show banner again</button>;
    }

    return (
        <div>
            <p>We shipped a new migration helper.</p>
            <button onClick={() => set(true)}>Dismiss</button>
        </div>
    );
}
```

Use `set(true)` when the dismissal itself is the durable user preference. Use
`remove()` only when you want to forget that dismissal and return to first-load
defaults.

## 4. Durable Draft Content With Ephemeral Form Metadata

```tsx
import { useState } from "react";
import { useMnemonicKey } from "react-mnemonic";

export function DraftEditor() {
    const {
        value: body,
        set,
        remove,
    } = useMnemonicKey("compose-draft", {
        defaultValue: "",
    });
    const [isDirty, setIsDirty] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    return (
        <>
            <textarea
                value={body}
                onChange={(event) => {
                    const next = event.target.value;
                    set(next);
                    setIsDirty(true);
                    setValidationError(next.length > 500 ? "Draft is too long" : null);
                }}
            />
            <button onClick={() => remove()}>Discard draft</button>
            <p>Dirty: {String(isDirty)}</p>
            <p>Error: {validationError ?? "none"}</p>
        </>
    );
}
```

Persist the authored draft. Keep runtime metadata like `isDirty` and
`validationError` in plain React state.

## 5. Schema Upgrade With Migration Plus Reconciliation

```tsx
import {
    MnemonicProvider,
    createSchemaRegistry,
    defineKeySchema,
    defineMigration,
    mnemonicSchema,
    useMnemonicKey,
} from "react-mnemonic";

const profileV1 = defineKeySchema(
    "profile",
    1,
    mnemonicSchema.object({
        name: mnemonicSchema.string(),
    }),
);

const profileV2 = defineKeySchema(
    "profile",
    2,
    mnemonicSchema.object({
        name: mnemonicSchema.string(),
        email: mnemonicSchema.string(),
        marketingOptIn: mnemonicSchema.boolean(),
    }),
);

const registry = createSchemaRegistry({
    schemas: [profileV1, profileV2],
    migrations: [
        defineMigration(profileV1, profileV2, (value) => ({
            ...(value as { name: string }),
            email: "",
            marketingOptIn: false,
        })),
    ],
});

function ProfileEditor() {
    const { value, set } = useMnemonicKey("profile", {
        defaultValue: {
            name: "",
            email: "",
            marketingOptIn: true,
        },
        reconcile: (persisted, { persistedVersion, latestVersion }) => ({
            ...persisted,
            marketingOptIn: persistedVersion < (latestVersion ?? persistedVersion) ? true : persisted.marketingOptIn,
        }),
    });

    return <button onClick={() => set({ ...value, email: "hello@example.com" })}>Save</button>;
}

export function App() {
    return (
        <MnemonicProvider namespace="app" schemaMode="default" schemaRegistry={registry}>
            <ProfileEditor />
        </MnemonicProvider>
    );
}
```

Migration handles the structural version change. `reconcile(...)` handles the
conditional policy decision.

## 6. SSR Placeholder For Theme

```tsx
import { useMnemonicKey } from "react-mnemonic";

export function ThemeLabel({ serverTheme }: { serverTheme: "light" | "dark" | "system" }) {
    const { value } = useMnemonicKey("theme", {
        defaultValue: "light" as "light" | "dark" | "system",
        ssr: {
            serverValue: serverTheme,
            hydration: "client-only",
        },
    });

    return <span>{value}</span>;
}
```

Use this when:

- the server already knows a placeholder value
- you want the server markup and hydration markup to match
- local persisted storage should not win until after mount

## 7. Auth-Aware Durable State With Automatic Cleanup

```tsx
import { useEffect } from "react";
import { useMnemonicKey, useMnemonicRecovery } from "react-mnemonic";

const AUTH_KEYS = ["private-draft", "saved-search"] as const;

export function AuthScopedScreen({
    auth,
}: {
    auth: {
        isAuthenticated: boolean;
        onAuthEnded: (callback: () => void) => () => void;
    };
}) {
    const recovery = useMnemonicRecovery();
    const draft = useMnemonicKey("private-draft", {
        defaultValue: "",
        reconcile: (persisted) => (auth.isAuthenticated ? persisted : ""),
    });

    useEffect(() => {
        if (!auth.isAuthenticated) return;

        return auth.onAuthEnded(() => {
            recovery.clearKeys([...AUTH_KEYS]);
        });
    }, [auth, recovery]);

    return <textarea value={draft.value} onChange={(event) => draft.set(event.target.value)} />;
}
```

Use when:

- the value is safe to restore for the same authenticated user
- the namespace is scoped to that user
- logout or expiry should remove the persisted value automatically

Because `useMnemonicRecovery()` is namespace-scoped, run cleanup before
switching to an anonymous namespace. If auth has already flipped, clear the last
authenticated namespace from a temporary recovery boundary instead. See
[Auth-Aware Persistence](/docs/guides/auth-aware-persistence) for the full
pattern.

Do not store tokens, refresh tokens, or raw session secrets this way. See
[Auth-Aware Persistence](/docs/guides/auth-aware-persistence) for the full
pattern.
