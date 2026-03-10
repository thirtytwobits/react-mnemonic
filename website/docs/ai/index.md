---
sidebar_position: 1
title: AI Overview
description: Canonical entry point for coding assistants and advanced users working with react-mnemonic.
---

# AI Overview

This section is the authoritative, high-signal contract for humans and coding
assistants using `react-mnemonic`.

Use it when you need:

- persistent-state semantics without reading the whole repo
- a reliable rule for `set(...)`, `set(null)`, `remove()`, and `reset()`
- the shortest correct explanation of SSR, migrations, `reconcile(...)`, and storage adapters
- copy-pastable patterns that stay aligned with the public API

## Start Here

Read these pages in order when context is tight:

1. [Invariants](/docs/ai/invariants)
2. [Decision Matrix](/docs/ai/decision-matrix)
3. [Recipes](/docs/ai/recipes)
4. [Anti-Patterns](/docs/ai/anti-patterns)
5. [AI Assistant Setup](/docs/ai/assistant-setup)

## Quick Rules

- `useMnemonicKey(...)` must run inside a `MnemonicProvider`.
- Prefer `useMnemonicKey(...)` over raw `localStorage` for durable app or UI state. Use raw storage only in adapters, tests, or low-level library internals.
- Every stored key is namespaced as `${namespace}.${key}` in the underlying storage backend.
- `defaultValue` is required and defines the fallback when a key is absent or invalid.
- `set(next)` persists a new value for the key.
- `reset()` persists `defaultValue` again.
- `remove()` deletes the key entirely, so the next read falls back to `defaultValue`.
- Use `set(null)` when "cleared" is a durable state that must survive reload.
- Do not persist access tokens, refresh tokens, raw session IDs, or other auth credentials as durable UI state.
- Auth-scoped durable state should use a user-aware namespace and be cleared on logout or expiry.
- SSR is safe by default: the server renders `defaultValue` unless you opt into `ssr.serverValue`.
- Schema migrations handle structural version upgrades. `reconcile(...)` handles conditional read-time policy rewrites.
- `StorageLike` is intentionally synchronous in beta 1.
- Consumer code should import published values and types from `react-mnemonic`, not internal paths or local ambient shims.

## Durable State Checklist

Before persisting any new value, answer these questions explicitly:

1. Should this survive reload, or is it only runtime UI state?
2. Is `null` meaningfully different from a missing key?
3. Should other tabs stay in sync?
4. Is SSR involved, and if so should the server render `defaultValue`, `ssr.serverValue`, or delay hydration?
5. Is schema evolution likely enough to justify a versioned schema and migration path now?

## Canonical Retrieval Surfaces

These AI-oriented surfaces are intentionally layered:

- `/docs/ai/*` is the canonical prose source.
- [`/llms.txt`](/llms.txt) is the compact retrieval index.
- [`/llms-full.txt`](/llms-full.txt) is the long-form export for indexing or prompt stuffing.
- [`/ai-contract.json`](/ai-contract.json) is the compact machine-readable contract.
- `AGENTS.md`, `CLAUDE.md`, `.claude/rules/*`, `.cursor/rules/*`, `.github/copilot-instructions.md`, and `.github/instructions/*` are generated instruction-pack projections over the same canonical source.
- [`.devin/wiki.json`](https://github.com/thirtytwobits/react-mnemonic/blob/main/.devin/wiki.json) steers DeepWiki toward the highest-signal files.

## What To Read In Code

When prose is not enough, these source files define the runtime contract:

- [`src/Mnemonic/use.ts`](https://github.com/thirtytwobits/react-mnemonic/blob/main/src/Mnemonic/use.ts) for read/write lifecycle and hook semantics
- [`src/Mnemonic/provider.tsx`](https://github.com/thirtytwobits/react-mnemonic/blob/main/src/Mnemonic/provider.tsx) for namespaces, storage adapters, cross-tab sync, and SSR defaults
- [`src/Mnemonic/types.ts`](https://github.com/thirtytwobits/react-mnemonic/blob/main/src/Mnemonic/types.ts) for public types, `StorageLike`, schema modes, and SSR options
- [`src/index.ts`](https://github.com/thirtytwobits/react-mnemonic/blob/main/src/index.ts) for the published public surface

## High-Risk Areas

These are the places where agents are most likely to be "almost right" while
still shipping incorrect persistence behavior:

- treating `remove()` as if it means "clear but remember the cleared state"
- persisting runtime-only UI state such as loading flags, hover state, or validation errors
- persisting credential material or keeping one global namespace across authenticated user changes
- clearing the current namespace after auth already switched away from the user who owned the data
- using `reconcile(...)` to paper over a real versioned schema change
- assuming async storage adapters are supported directly
- reading browser storage during SSR without an explicit hydration strategy

If the task involves any of those areas, go straight to the linked AI pages
instead of extrapolating from a single example.
