---
sidebar_position: 5
title: Anti-Patterns
description: Common mistakes that produce incorrect persistence semantics even when the app appears to work.
---

# Anti-Patterns

These patterns often "work" at runtime but still encode the wrong persistence
contract.

## Persisting Runtime-Only UI State

Avoid persisting values when rehydration would be surprising or incorrect:

- hover, focus, drag, selection, or expansion state
- loading flags, optimistic mutation state, and retry counters
- validation errors, dirty flags, and submit-in-progress markers
- transient search text that should disappear on reload
- server cache metadata unless the app explicitly wants to restore it

Prefer splitting state into:

- a persisted durable slice handled by `useMnemonicKey(...)`
- an ephemeral runtime slice handled by `useState(...)`

## Persisting Wizard Navigation And Validation State

Wizard drafts should not become a dumping ground for runtime-only UI state.

Wrong:

- persisting `activeStep`, `stepErrors`, `isSubmitting`, or `submissionError` inside the durable wizard draft
- persisting "completed steps" as a second source of truth instead of deriving them from the draft and validation rules

Prefer:

- persisting only user-authored cross-step draft values
- deriving completion from the persisted draft
- keeping navigation, error UI, and submit lifecycle state in plain React state

Persist a resume position only when resuming on that exact step after reload is
an explicit feature.

## Hard-Coding Numeric Step Indexes For Conditional Wizards

Conditional steps make stored numeric indexes brittle.

Wrong:

- persisting `currentStepIndex: 2` and assuming the third step still exists after the user changes an earlier answer
- storing a fixed array of enabled steps separately from the persisted draft

Prefer:

- deriving the step list from the persisted draft on every render
- storing step ids rather than numeric indexes when resume behavior really matters
- redirecting to a valid step when a conditional step disappears

## Persisting Derived Cart Totals And Badge Counts

Shopping cart persistence should store canonical lines, not duplicated summary
fields.

Wrong:

- persisting `subtotalCents`, `itemCount`, or per-line subtotals alongside the stored cart lines
- storing duplicate lines for the same SKU when the intended behavior is quantity aggregation

Prefer:

- persisting line items and quantities only
- deriving subtotal, badge count, and line subtotal from the stored lines
- normalizing duplicate adds into one line unless business rules explicitly require separate entries

## Allowing Invalid Cart Quantities Into Durable State

Cart quantities should not drift into invalid numbers.

Wrong:

- persisting `0`, negative quantities, or `NaN`
- trusting `Number(event.target.value)` without validation in quantity controls

Prefer:

- clamp or normalize quantities before writing
- treat non-positive quantities as removal when that matches the UX contract

## Using `remove()` To Mean "Cleared"

If "cleared" is a durable state, do not delete the key.

Wrong:

- `remove()` for a nullable preference, optional form field, or saved filter that should remain explicitly cleared after reload

Prefer:

- `set(null)` or a nullable field inside the persisted object

## Using `reconcile(...)` For Structural Version Jumps

Do not use `reconcile(...)` to paper over a real schema upgrade.

Wrong:

- adding or renaming persistent fields in place with `reconcile(...)`

Prefer:

- a versioned schema plus migration for structural compatibility
- `reconcile(...)` only for conditional policy refresh inside an already valid shape

## Returning Promises From `StorageLike`

`StorageLike` is synchronous in beta 1.

Wrong:

- `getItem: async (...) => ...`
- direct IndexedDB calls from `getItem`, `setItem`, or `removeItem`

Prefer:

- a synchronous facade backed by an in-memory cache
- `onExternalChange(...)` when the real backend can notify out-of-band updates

## Inventing Local Package Shims

Do not "fix" missing type information by shadowing the package.

Wrong:

- `react-mnemonic.d.ts`
- `declare module "react-mnemonic"`
- importing from unpublished internal paths

Prefer:

- `import` and `import type` from `react-mnemonic`
- checking `src/index.ts`, `package.json`, and the API docs before assuming a surface is missing

## Reintroducing Raw `localStorage` In Examples

If `react-mnemonic` is the intended abstraction, do not bypass it in templates,
scaffolds, or user-facing examples.

Wrong:

- direct `localStorage.getItem(...)` or `localStorage.setItem(...)` in example app code that should model durable UI state through the hook

Prefer:

- `useMnemonicKey(...)` for durable app or UI state
- raw storage only in storage adapter implementations, tests, or low-level library internals

## Persisting Credentials Or Session Secrets

Do not use `react-mnemonic` as a credential store.

Wrong:

- access tokens in persisted keys
- refresh tokens in persisted keys
- raw session IDs, OTP material, or recovery codes in durable storage

Prefer:

- your auth provider's storage model
- httpOnly cookies or another dedicated credential boundary
- persisting only safe user-owned state such as drafts or filters

## Reusing One Namespace Across Authenticated Users

Authenticated durable state should not live under one anonymous global prefix.

Wrong:

- `namespace="my-app"` for every signed-in user on a shared browser profile
- keeping user A's saved draft under the same keys that user B will read next

Prefer:

- a namespace that includes the authenticated user identity
- clearing auth-scoped keys on logout, expiry, or invalidation
- `reconcile(...)` as a backstop when auth policy changes between reads

## Clearing The Wrong Namespace After Logout

`useMnemonicRecovery()` clears the current provider namespace, not whichever
namespace used to be active one render ago.

Wrong:

- switching from `app.user.123` to `app.anonymous`
- then calling `useMnemonicRecovery().clearKeys([...])` from the anonymous provider

Prefer:

- clearing the authenticated namespace before swapping auth state
- or mounting a temporary recovery boundary for the last authenticated namespace
- keeping `reconcile(...)` as a read-time backstop, not the only cleanup mechanism

## Treating A Returned `set(...)` As Proof The Value Is Saved

`set(...)` updates the in-memory cache and notifies subscribers whether or not
the storage backend accepted the write. A full quota, a blocked origin, or a
browser with no usable storage all produce a normal-looking `set(...)` and a
component that shows the new value while storage still holds the old one.

Wrong:

- clearing a "you have unsaved changes" flag as soon as `set(...)` returns
- reporting "saved" in the UI on the strength of the re-render alone
- assuming a dropped write will be retried later on its own

Prefer:

- reading `useMnemonicRecovery().unpersistedKeys()` after writes that must be durable
- calling `flush(...)` once the app or the user has freed space
- keeping the unsaved-changes indicator until the key is no longer reported as unpersisted

## Treating The Provider As Optional

`useMnemonicKey(...)` is not a global singleton hook.

Wrong:

- calling it outside a `MnemonicProvider`
- treating the namespace as irrelevant

Prefer:

- one explicit provider per persisted storage scope
- intentional namespace selection so keys cannot collide silently
