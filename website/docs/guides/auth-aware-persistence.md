---
sidebar_position: 8
title: Auth-Aware Persistence
description: Persist safe user data conditionally, and clean it up automatically when authentication expires.
---

# Auth-Aware Persistence

Authentication-sensitive flows need a stricter persistence contract than normal
preferences or drafts. The goal is not "persist everything until logout." The
goal is:

- persist only the user state that is safe and useful to restore
- keep secrets and server-authoritative session material out of durable storage
- clean up auth-scoped persisted data when logout, expiration, idle timeout, or
  invalidation happens
- prevent one user's persisted state from leaking into another user's session

## Never Persist These Values

Do not store these as normal durable UI state with `react-mnemonic`:

- access tokens
- refresh tokens
- raw session IDs
- OTP codes, recovery codes, or MFA challenge material
- secrets that grant API access on their own
- server-authoritative entitlements that must be revalidated on every session

Keep those in your auth provider, httpOnly cookies, or another security boundary
designed for credential material.

## Values That Can Persist Conditionally

These are often reasonable to persist **only while tied to an authenticated
user identity**:

- saved filters for a private dashboard
- user-authored drafts for authenticated workflows
- dismissed authenticated-only UI such as onboarding or notices
- last selected account, workspace, or durable navigation context

The litmus test is simple:

- if restoring the value for the same user is helpful, it may be a persistence candidate
- if restoring it for a different user would be wrong, scope it to that user and clean it up on auth loss
- if the value itself is sensitive enough to behave like a credential, do not persist it here

## Namespace Strategy

The safest baseline is a namespace that includes the authenticated user ID:

```tsx
import { MnemonicProvider } from "react-mnemonic";

type Session = { status: "anonymous" } | { status: "authenticated"; userId: string };

function AppPersistenceBoundary({ session, children }: { session: Session; children: React.ReactNode }) {
    const namespace = session.status === "authenticated" ? `my-app.user.${session.userId}` : "my-app.anonymous";

    return <MnemonicProvider namespace={namespace}>{children}</MnemonicProvider>;
}
```

This gives you two important guarantees:

- user A and user B do not share the same persisted key prefix
- switching identities naturally points the app at a different persisted scope

Do not keep authenticated data in one global namespace like `"my-app"` if
multiple users can sign in on the same browser profile.

## `remove()` vs `reset()` vs `set(null)` In Auth Flows

| Situation                                                       | Action                               | Why                                                                 |
| --------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------- |
| Logout or session expiry should forget private state entirely   | `remove()` or `clearKeys([...])`     | The next session should not inherit the previous user's value       |
| A safe value should return to a known default for the same user | `reset()`                            | You want the default persisted again                                |
| "Cleared" is itself the durable state                           | `set(null)`                          | The same authenticated user should keep the explicit cleared intent |
| Tokens, secrets, or credential material                         | Do not persist with `react-mnemonic` | This is not durable UI state                                        |

For auth expiry and logout, default to `remove()` unless you explicitly want the
stored default to remain part of the user's durable state.

## Cleanup Triggers To Wire Up

Run the same cleanup routine when any of these happen:

- explicit logout
- token or session expiration
- idle-timeout logout
- auth provider invalidation or forced sign-out
- cross-tab logout notification

If your auth provider exposes lifecycle callbacks, call your persistence cleanup
from those callbacks instead of scattering one-off storage logic across screens.

`useMnemonicRecovery()` is namespace-scoped. That means logout cleanup must
target the authenticated namespace that owned the data. If your provider has
already switched to an anonymous namespace, clearing "the current namespace"
will not remove the previous user's persisted keys.

## End-To-End Example

This example shows four layers working together:

1. a user-scoped namespace
2. event-based cleanup when auth ends
3. a temporary recovery boundary that can still clear the last authenticated namespace after auth flips
4. `reconcile(...)` as a read-time backstop so stale values do not reappear

```tsx
import { useEffect, useRef, useState } from "react";
import { MnemonicProvider, useMnemonicKey, useMnemonicRecovery } from "react-mnemonic";

type Session = { status: "anonymous" } | { status: "authenticated"; userId: string };

type SavedSearch = {
    query: string;
    tags: string[];
};

const AUTH_SCOPED_KEYS = ["saved-search", "private-draft"] as const;
const DEFAULT_SEARCH: SavedSearch = { query: "", tags: [] };
const ANONYMOUS_NAMESPACE = "my-app.anonymous";

function namespaceForSession(session: Session): string {
    return session.status === "authenticated" ? `my-app.user.${session.userId}` : ANONYMOUS_NAMESPACE;
}

function NamespaceCleanupBridge({ namespace, onComplete }: { namespace: string; onComplete: () => void }) {
    return (
        <MnemonicProvider namespace={namespace}>
            <NamespaceCleanupRunner onComplete={onComplete} />
        </MnemonicProvider>
    );
}

function NamespaceCleanupRunner({ onComplete }: { onComplete: () => void }) {
    const recovery = useMnemonicRecovery();

    useEffect(() => {
        recovery.clearKeys([...AUTH_SCOPED_KEYS]);
        onComplete();
    }, [onComplete, recovery]);

    return null;
}

function AuthScopedWorkspace({ isAuthenticated }: { isAuthenticated: boolean }) {
    const savedSearch = useMnemonicKey<SavedSearch>("saved-search", {
        defaultValue: DEFAULT_SEARCH,
        listenCrossTab: true,
        reconcile: (persisted) => (isAuthenticated ? persisted : DEFAULT_SEARCH),
    });

    const draft = useMnemonicKey<string>("private-draft", {
        defaultValue: "",
        listenCrossTab: true,
        reconcile: (persisted) => (isAuthenticated ? persisted : ""),
    });

    return (
        <>
            <input
                value={savedSearch.value.query}
                onChange={(event) =>
                    savedSearch.set((prev) => ({
                        ...prev,
                        query: event.target.value,
                    }))
                }
            />

            <textarea value={draft.value} onChange={(event) => draft.set(event.target.value)} />

            <button onClick={() => draft.remove()}>Discard private draft</button>
        </>
    );
}

export function AuthAwareApp({
    session,
    authEvents,
}: {
    session: Session;
    authEvents: {
        onExpired: (callback: () => void) => () => void;
        onLogout: (callback: () => void) => () => void;
    };
}) {
    const isAuthenticated = session.status === "authenticated";
    const lastAuthenticatedNamespace = useRef<string | null>(null);
    const [namespacePendingCleanup, setNamespacePendingCleanup] = useState<string | null>(null);
    const currentNamespace = namespaceForSession(session);

    useEffect(() => {
        if (session.status === "authenticated") {
            lastAuthenticatedNamespace.current = namespaceForSession(session);
        }
    }, [session]);

    useEffect(() => {
        const scheduleCleanup = () => {
            if (lastAuthenticatedNamespace.current) {
                setNamespacePendingCleanup(lastAuthenticatedNamespace.current);
            }
        };

        const unsubscribeExpired = authEvents.onExpired(scheduleCleanup);
        const unsubscribeLogout = authEvents.onLogout(scheduleCleanup);

        return () => {
            unsubscribeExpired();
            unsubscribeLogout();
        };
    }, [authEvents]);

    return (
        <>
            {namespacePendingCleanup ? (
                <NamespaceCleanupBridge
                    namespace={namespacePendingCleanup}
                    onComplete={() => {
                        lastAuthenticatedNamespace.current = null;
                        setNamespacePendingCleanup(null);
                    }}
                />
            ) : null}

            <MnemonicProvider namespace={currentNamespace}>
                <AuthScopedWorkspace isAuthenticated={isAuthenticated} />
            </MnemonicProvider>
        </>
    );
}
```

### Why this pattern is safe

- The namespace changes with the authenticated user ID.
- `NamespaceCleanupBridge` can still clear the previous authenticated namespace after auth flips.
- `reconcile(...)` prevents stale values from surviving a reload after auth loss.
- `listenCrossTab: true` helps other tabs observe the removal when using
  `localStorage`.

If your auth provider lets you run cleanup before the session object flips, that
is even simpler: clear the current authenticated namespace immediately, then
switch auth state. The bridge pattern above is the safer fallback for expiry,
forced invalidation, and cross-tab logout where state may already have changed
by the time React renders the next screen.

## Cross-Tab Logout

If one tab logs out, the other tabs need the same cleanup.

For `localStorage`:

- use `listenCrossTab: true` on the auth-scoped keys
- clear those keys from the tab that receives the logout event
- let the browser `storage` event fan that removal out to the other tabs

For custom storage:

- implement `storage.onExternalChange(...)`
- make your logout event or broadcast channel trigger the same key cleanup

If you intentionally use `sessionStorage`, remember that session storage is per
tab and does not naturally synchronize logout state across tabs.

## `reconcile(...)` As Policy Enforcement

`reconcile(...)` is a good fit when the stored shape is still valid but current
auth policy says the value should be normalized or discarded.

Good examples:

- clearing a saved search when the session is no longer authenticated
- resetting a workspace selection when the new session no longer has access
- dropping a previously persisted draft when a session is expired at read time

Bad examples:

- transforming tokens or session secrets into another stored form
- using `reconcile(...)` to fake a real schema migration
- waiting until the provider namespace is anonymous and then clearing "the current namespace"

## Recommended Mental Model

Split auth-related data into three buckets:

- never persist: credentials, secrets, and raw session material
- persist conditionally: safe user-owned drafts and preferences tied to a user-scoped namespace
- keep ephemeral: current auth status, in-flight refresh state, and transient access checks

That separation is what keeps `react-mnemonic` useful in authenticated apps
without turning it into a place where credentials or stale user state linger.
