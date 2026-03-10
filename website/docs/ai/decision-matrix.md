---
sidebar_position: 3
title: Decision Matrix
description: Decision tables for null vs remove, migration vs reconcile, persistence boundaries, and SSR mode choice.
---

# Decision Matrix

Use these tables when the code is "almost obvious" but one wrong persistence
choice would change user behavior after reload.

## `set(null)` vs `remove()` vs `reset()`

| Need                                  | Action      | Result after reload          |
| ------------------------------------- | ----------- | ---------------------------- |
| Keep an explicit "cleared" state      | `set(null)` | Still cleared                |
| Forget the key entirely               | `remove()`  | Falls back to `defaultValue` |
| Restore the default as a stored value | `reset()`   | Rehydrates `defaultValue`    |

Rule of thumb:

- Use `set(null)` for durable clear intent.
- Use `remove()` for absence.
- Use `reset()` when the default itself should become the new persisted value.

## Migration vs `reconcile(...)`

| Situation                                                     | Use                                                | Why                                                           |
| ------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| Stored shape changed between explicit versions                | Schema migration                                   | Structural compatibility belongs to version transitions       |
| Every write should normalize the value                        | Write-time migration (`fromVersion === toVersion`) | Keeps writes canonical                                        |
| Existing shape is fine, but defaults or policy should refresh | `reconcile(...)`                                   | Conditional read-time rewrite without inventing a new version |
| Invalid or stale data should be discarded                     | Recovery or reset flow                             | Safer than forcing a questionable transform                   |

## Should This State Persist?

| State shape                                    | Persist?      | Why                                                              |
| ---------------------------------------------- | ------------- | ---------------------------------------------------------------- |
| Theme, density, durable layout preference      | Yes           | Users expect it after reload                                     |
| Saved filters users intentionally restore      | Yes           | This is durable preference state                                 |
| User-authored draft content                    | Usually yes   | Lost work is expensive                                           |
| Hover, focus, drag, loading, optimistic flags  | No            | Rehydrating runtime-only UI feels wrong                          |
| Temporary dirtiness and validation errors      | No            | These describe a session, not durable intent                     |
| Server response cache timestamps               | Usually no    | Prefer cache logic over UI persistence                           |
| Access tokens, refresh tokens, session secrets | No            | These are credentials, not durable UI state                      |
| Safe per-user drafts or saved filters          | Conditionally | Scope them to the authenticated user and clear them on auth loss |

## SSR Mode Choice

| Need                                     | Config                                                |
| ---------------------------------------- | ----------------------------------------------------- |
| Default SSR behavior                     | No SSR config                                         |
| Deterministic server placeholder         | `ssr.serverValue`                                     |
| Delay persisted read until after mount   | `ssr.hydration: "client-only"`                        |
| Make every key inherit delayed hydration | `MnemonicProvider ssr={{ hydration: "client-only" }}` |

## Storage Adapter Choice

| Need                                                | Recommended path                          |
| --------------------------------------------------- | ----------------------------------------- |
| Standard browser persistence                        | Default provider storage (`localStorage`) |
| Per-tab persistence                                 | `storage={window.sessionStorage}`         |
| Custom backend with synchronous facade              | Provide a `StorageLike` wrapper           |
| Cross-tab sync on a custom backend                  | Implement `storage.onExternalChange(...)` |
| Direct async reads or writes from the hook contract | Not supported in beta 1                   |

## Auth Cleanup Choice

| Need                                                           | Recommended path                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Forget auth-scoped private state on logout or expiry           | Clear the authenticated namespace before swap, or use a temporary recovery boundary for the last user namespace |
| Keep an explicit cleared value for the same authenticated user | `set(null)`                                                                                                     |
| Restore a known default for the same authenticated user        | `reset()`                                                                                                       |
| Prevent user A data from appearing for user B                  | user-aware namespace such as `app.user.${userId}`                                                               |
| Enforce auth policy when stale data is read back               | `reconcile(...)` plus event-based cleanup                                                                       |

See [Auth-Aware Persistence](/docs/guides/auth-aware-persistence) for the full
logout, expiry, and cross-tab cleanup pattern.
