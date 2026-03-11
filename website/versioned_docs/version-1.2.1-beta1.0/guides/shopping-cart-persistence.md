---
sidebar_position: 9
title: Shopping Cart Persistence
description: Persist canonical cart line items while deriving totals and keeping cart semantics explicit.
---

# Shopping Cart Persistence

Shopping carts usually need durable state, but they also need a clearer data
model than a generic persisted array. Persist the canonical cart lines and the
small amount of user-owned cart metadata that should survive reload. Derive
totals, item counts, and UI summaries at render time instead of storing them.

## Recommended cart shape

The safest baseline is a persisted object, not a top-level number or derived
summary:

```ts
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
    couponCode: string | null;
};
```

That gives you:

- stable persisted line items and quantities
- room for safe cart-owned metadata like `couponCode`
- one canonical persisted currency for the whole cart
- derived totals computed from one source of truth instead of being stored separately

## Canonical example

The canonical cart implementation for both this guide and the demo playground
lives in [`website/src/components/demo/ShoppingCart.tsx`](https://github.com/thirtytwobits/react-mnemonic/blob/main/website/src/components/demo/ShoppingCart.tsx).

The shared example shows:

- `MnemonicProvider` setup around the cart
- a reusable cart key descriptor
- add, remove, update quantity, and clear-cart helpers
- derived subtotal and item count
- fallback behavior when persisted cart data is malformed

## Release snapshot note

The current docs site and playground share one live `ShoppingCart` component,
but this frozen `1.2.1-beta1.0` snapshot intentionally does not import
`@site/src` demo code.

That keeps this release snapshot self-contained even if the current playground
component evolves later. For the matching implementation shape, use the shared
cart source linked above and the guidance in this document.

## Derived totals should stay derived

Persist the line items and quantities. Derive these values instead:

- subtotal
- item count
- line subtotal
- “free shipping” threshold progress
- badge counts in the header

Wrong:

```ts
type CartState = {
    items: CartLine[];
    subtotalCents: number;
    itemCount: number;
};
```

Prefer:

```ts
const subtotalCents = cart.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
```

That keeps the persisted cart canonical and avoids drift when one write path
forgets to update the derived fields.

## `items: []` vs `set(null)` vs `remove()` vs `reset()`

Shopping carts often need all four concepts, but not for the same reason.

| Need                                                                   | Recommended shape or action              | Why                                                |
| ---------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------- |
| Keep an active cart that just happens to be empty                      | `items: []` inside a `CartState` object  | The cart still exists as normal app state          |
| Record an explicit “no cart” or “cart intentionally unavailable” state | `set(null)` on a `CartState \| null` key | Only use this when `null` has real product meaning |
| Forget the cart entirely after checkout, logout, or recovery           | `remove()`                               | The next read falls back to `defaultValue`         |
| Re-seed the cart with a known default shape                            | `reset()`                                | Persists the default cart object again             |

For most storefront carts, an empty cart object is the right baseline. Reach
for `null` only when the app truly distinguishes “no cart exists” from “cart
exists but has zero items.”

## Cart edge cases to handle explicitly

### Duplicate products

Do not append a second line for the same SKU unless that is a deliberate
business rule. The baseline should merge duplicates into one line and increase
its quantity.

### Zero or negative quantities

Treat non-positive quantities as removal, or clamp them before writing. Do not
persist `0`, negative values, or `NaN` quantities into the cart.

### Stale product data

Persist only the product snapshot the cart actually needs for display or
checkout, such as `title` and `unitPriceCents`.

Then decide explicitly whether your app should:

- refresh those snapshots when a product is added again
- reconcile them from the latest catalog on read
- keep the original snapshot and revalidate only at checkout

The right choice is product-specific. Do not silently assume old cart snapshots
are always safe to charge.

### Invalid persisted payloads

Use a `defaultValue(error)` fallback when malformed storage should recover to a
known empty cart instead of crashing the UI. The example above logs the decode
or schema error and returns a fresh empty cart.

## Practical rule of thumb

- Persist canonical cart lines and safe cart metadata.
- Derive totals and counts from the persisted lines.
- Empty the cart with an empty cart object, not `remove()`, when the app should still remember “this is the active cart.”
- Use `remove()` when the cart should be forgotten entirely.
- Use `set(null)` only when the product semantics truly need an explicit no-cart state.
