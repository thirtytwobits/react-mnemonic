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
    const { isAuthenticated, onAuthEnded } = auth;
    const recovery = useMnemonicRecovery();
    const draft = useMnemonicKey("private-draft", {
        defaultValue: "",
        reconcile: (persisted) => (isAuthenticated ? persisted : ""),
    });

    useEffect(() => {
        if (!isAuthenticated) return;

        return onAuthEnded(() => {
            recovery.clearKeys([...AUTH_KEYS]);
        });
    }, [isAuthenticated, onAuthEnded, recovery]);

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

## 8. Multi-Step Wizard With Durable Draft And Ephemeral Navigation

```tsx
import { useEffect, useState } from "react";
import { useMnemonicKey } from "react-mnemonic";

type StepId = "account" | "business" | "profile" | "review";

type WizardDraft = {
    accountType: "personal" | "business";
    companyName: string | null;
    fullName: string;
    email: string;
    acceptedTerms: boolean;
};

const defaultDraft: WizardDraft = {
    accountType: "personal",
    companyName: null,
    fullName: "",
    email: "",
    acceptedTerms: false,
};

function getSteps(draft: WizardDraft): StepId[] {
    return draft.accountType === "business"
        ? ["account", "business", "profile", "review"]
        : ["account", "profile", "review"];
}

function validateStep(stepId: StepId, draft: WizardDraft): string[] {
    switch (stepId) {
        case "account":
            return [];
        case "business":
            return draft.accountType === "business" && !draft.companyName?.trim() ? ["Company name is required."] : [];
        case "profile":
            return !draft.fullName.trim() || !draft.email.includes("@") ? ["Complete your profile fields."] : [];
        case "review":
            return draft.acceptedTerms ? [] : ["Accept the terms before submitting."];
    }
}

async function saveWizard(draft: WizardDraft) {
    const response = await fetch("/api/signup-wizard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
    });

    if (!response.ok) {
        throw new Error(`Wizard save failed: ${response.status} ${response.statusText}`);
    }
}

export function SignupWizard() {
    const {
        value: draft,
        set: setDraft,
        remove,
    } = useMnemonicKey("signup-wizard", {
        defaultValue: defaultDraft,
    });
    const steps = getSteps(draft);
    const [activeStepId, setActiveStepId] = useState<StepId>("account");
    const [stepErrors, setStepErrors] = useState<Partial<Record<StepId, string[]>>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!steps.includes(activeStepId)) {
            setActiveStepId("account");
        }
    }, [activeStepId, draft.accountType]);

    const activeIndex = steps.indexOf(activeStepId);

    const goNext = () => {
        const errors = validateStep(activeStepId, draft);
        if (errors.length > 0) {
            setStepErrors((prev) => ({ ...prev, [activeStepId]: errors }));
            return;
        }

        const nextStepId = steps[activeIndex + 1];
        if (nextStepId) {
            setActiveStepId(nextStepId);
        }
    };

    const goBack = () => {
        const previousStepId = steps[activeIndex - 1];
        if (previousStepId) {
            setActiveStepId(previousStepId);
        }
    };

    const updateDraft = <K extends keyof WizardDraft>(field: K, value: WizardDraft[K]) => {
        setDraft((prev) => ({ ...prev, [field]: value }));
        setStepErrors((prev) => ({ ...prev, [activeStepId]: [] }));
    };

    const updateAccountType = (accountType: WizardDraft["accountType"]) => {
        setDraft((prev) => ({
            ...prev,
            accountType,
            companyName: accountType === "business" ? prev.companyName : null,
        }));
        setStepErrors((prev) => ({ ...prev, account: [], business: [] }));
    };

    const handleSubmit = async () => {
        const invalidStep = steps.find((stepId) => validateStep(stepId, draft).length > 0);
        if (invalidStep) {
            setActiveStepId(invalidStep);
            setStepErrors((prev) => ({ ...prev, [invalidStep]: validateStep(invalidStep, draft) }));
            return;
        }

        setIsSubmitting(true);
        try {
            await saveWizard(draft);
            remove();
            setActiveStepId("account");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {activeStepId === "account" ? (
                <fieldset>
                    <label>
                        <input
                            type="radio"
                            checked={draft.accountType === "personal"}
                            onChange={() => updateAccountType("personal")}
                        />
                        Personal
                    </label>
                    <label>
                        <input
                            type="radio"
                            checked={draft.accountType === "business"}
                            onChange={() => updateAccountType("business")}
                        />
                        Business
                    </label>
                </fieldset>
            ) : null}

            {activeStepId === "business" ? (
                <input
                    value={draft.companyName ?? ""}
                    onChange={(event) => updateDraft("companyName", event.target.value || null)}
                />
            ) : null}

            {activeStepId === "profile" ? (
                <>
                    <input value={draft.fullName} onChange={(event) => updateDraft("fullName", event.target.value)} />
                    <input value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} />
                </>
            ) : null}

            {activeStepId === "review" ? (
                <label>
                    <input
                        type="checkbox"
                        checked={draft.acceptedTerms}
                        onChange={(event) => updateDraft("acceptedTerms", event.target.checked)}
                    />
                    Accept terms
                </label>
            ) : null}

            <button onClick={goBack} disabled={activeIndex <= 0 || isSubmitting}>
                Back
            </button>

            {activeStepId === "review" ? (
                <button onClick={handleSubmit} disabled={isSubmitting}>
                    Submit
                </button>
            ) : (
                <button onClick={goNext} disabled={isSubmitting}>
                    Next
                </button>
            )}
        </>
    );
}
```

Use when:

- users expect cross-step draft values to survive reload
- step navigation should be guarded by step-local validation
- conditional steps are derived from persisted draft values
- completion is derived instead of stored separately

Keep `activeStepId`, `stepErrors`, and `isSubmitting` ephemeral by default.
Persist a resume position only when reopening on the same step after reload is a
real product requirement. For the full pattern, see
[Multi-Step Form Wizards](/docs/guides/multi-step-form-wizards).

## 9. Shopping Cart With Canonical Line Items And Derived Totals

```tsx
import { JSONCodec, MnemonicProvider, defineMnemonicKey, useMnemonicKey } from "react-mnemonic";

type Product = {
    sku: string;
    title: string;
    unitPriceCents: number;
};

type CartLine = {
    sku: string;
    title: string;
    unitPriceCents: number;
    quantity: number;
};

type CartState = {
    currencyCode: "USD";
    items: CartLine[];
};

const cartKey = defineMnemonicKey("shopping-cart", {
    defaultValue: {
        currencyCode: "USD" as const,
        items: [],
    },
    codec: JSONCodec,
    listenCrossTab: true,
});

function normalizeQuantity(quantity: number): number {
    return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
}

function addProduct(cart: CartState, product: Product): CartState {
    const existing = cart.items.find((item) => item.sku === product.sku);
    if (!existing) {
        return {
            ...cart,
            items: [
                ...cart.items,
                {
                    sku: product.sku,
                    title: product.title,
                    unitPriceCents: product.unitPriceCents,
                    quantity: 1,
                },
            ],
        };
    }

    return {
        ...cart,
        items: cart.items.map((item) =>
            item.sku === product.sku
                ? {
                      ...item,
                      title: product.title,
                      unitPriceCents: product.unitPriceCents,
                      quantity: item.quantity + 1,
                  }
                : item,
        ),
    };
}

function updateProductQuantity(cart: CartState, sku: string, quantity: number): CartState {
    const nextQuantity = normalizeQuantity(quantity);
    if (nextQuantity === 0) {
        return {
            ...cart,
            items: cart.items.filter((item) => item.sku !== sku),
        };
    }

    return {
        ...cart,
        items: cart.items.map((item) => (item.sku === sku ? { ...item, quantity: nextQuantity } : item)),
    };
}

function Storefront() {
    const { value: cart, set, remove } = useMnemonicKey(cartKey);

    const subtotalCents = cart.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <>
            <button
                onClick={() =>
                    set((current) =>
                        addProduct(current, {
                            sku: "widget",
                            title: "Widget",
                            unitPriceCents: 999,
                        }),
                    )
                }
            >
                Add widget
            </button>

            <button onClick={() => set((current) => updateProductQuantity(current, "widget", 3))}>
                Set widget qty to 3
            </button>

            <button onClick={() => set({ currencyCode: "USD", items: [] })}>Empty cart</button>
            <button onClick={() => remove()}>Forget cart</button>

            <p>Items: {itemCount}</p>
            <p>Subtotal: ${(subtotalCents / 100).toFixed(2)}</p>
        </>
    );
}

export function App() {
    return (
        <MnemonicProvider namespace="storefront.cart">
            <Storefront />
        </MnemonicProvider>
    );
}
```

Use when:

- the cart should survive reload or cross-tab browsing
- duplicate adds should merge into one line item
- subtotal and item count can be derived from canonical stored lines
- an empty active cart is different from forgetting cart persistence entirely

Persist the canonical line items. Derive totals and counts. Use `items: []` for
an active empty cart, and reserve `remove()` for flows like checkout success,
logout, or recovery. For fuller setup and edge cases, see
[Shopping Cart Persistence](/docs/guides/shopping-cart-persistence).
