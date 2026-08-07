// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * Coverage for the unpersisted-write registry.
 *
 * A write that the storage backend rejects still updates the in-memory cache
 * and notifies subscribers, so without this tracking a dropped write is
 * indistinguishable from a durable one and nothing ever retries it.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MnemonicProvider, useMnemonic } from "./provider";
import { useMnemonicKey } from "./use";
import { useMnemonicRecovery } from "./recovery";
import type { StorageLike } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type QuotaStorage = StorageLike & {
    store: Map<string, string>;
    /** When true, every setItem throws QuotaExceededError. */
    full: boolean;
};

/** An enumerable StorageLike whose quota can be exhausted on demand. */
function createQuotaStorage(): QuotaStorage {
    const store = new Map<string, string>();
    const storage: QuotaStorage = {
        store,
        full: false,
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            if (storage.full) {
                throw new DOMException("quota exceeded", "QuotaExceededError");
            }
            store.set(key, value);
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
        get length() {
            return store.size;
        },
        key: (index: number) => Array.from(store.keys())[index] ?? null,
    };
    return storage;
}

/** A component that hands the low-level store back to the test. */
function StoreConsumer({ onStore }: { onStore: (store: ReturnType<typeof useMnemonic>) => void }) {
    const store = useMnemonic();
    React.useEffect(() => {
        onStore(store);
    }, [store, onStore]);
    return null;
}

function renderStore(storage: StorageLike | undefined, namespace = "ns"): ReturnType<typeof useMnemonic> {
    let store: ReturnType<typeof useMnemonic> | undefined;
    render(
        <MnemonicProvider namespace={namespace} {...(storage ? { storage } : {})}>
            <StoreConsumer
                onStore={(s) => {
                    store = s;
                }}
            />
        </MnemonicProvider>,
    );
    return store!;
}

function env<T>(payload: T, version = 0): string {
    return JSON.stringify({ version, payload: JSON.stringify(payload) });
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    errorSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Store-level behaviour
// ---------------------------------------------------------------------------

describe("Mnemonic.unpersistedKeys", () => {
    it("reports nothing when writes land", () => {
        const storage = createQuotaStorage();
        const store = renderStore(storage);

        store.setRaw("k", "v");

        expect(storage.store.get("ns.k")).toBe("v");
        expect(store.unpersistedKeys()).toEqual([]);
    });

    it("reports a key whose write was rejected for quota", () => {
        const storage = createQuotaStorage();
        const store = renderStore(storage);
        storage.full = true;

        store.setRaw("draft", "new");

        // The cache still serves the new value — that is the divergence.
        expect(store.getRawSnapshot("draft")).toBe("new");
        expect(storage.store.has("ns.draft")).toBe(false);
        expect(store.unpersistedKeys()).toEqual(["draft"]);
    });

    it("reports a key whose write was rejected for a non-quota DOMException", () => {
        const storage = createQuotaStorage();
        storage.setItem = () => {
            throw new DOMException("not allowed", "NotAllowedError");
        };
        const store = renderStore(storage);

        store.setRaw("k", "v");

        expect(store.unpersistedKeys()).toEqual(["k"]);
    });

    it("clears the entry when a later write to the same key succeeds", () => {
        const storage = createQuotaStorage();
        const store = renderStore(storage);
        storage.full = true;
        store.setRaw("draft", "v1");
        expect(store.unpersistedKeys()).toEqual(["draft"]);

        storage.full = false;
        store.setRaw("draft", "v2");

        expect(store.unpersistedKeys()).toEqual([]);
        expect(storage.store.get("ns.draft")).toBe("v2");
    });

    it("keeps other keys queued when only one of them succeeds", () => {
        const storage = createQuotaStorage();
        const store = renderStore(storage);
        storage.full = true;
        store.setRaw("a", "1");
        store.setRaw("b", "2");
        expect(store.unpersistedKeys()).toEqual(["a", "b"]);

        storage.full = false;
        store.setRaw("a", "1b");

        expect(store.unpersistedKeys()).toEqual(["b"]);
    });

    it("queues a removal the backend rejected", () => {
        const storage = createQuotaStorage();
        storage.store.set("ns.k", "v");
        storage.removeItem = () => {
            throw new DOMException("blocked", "SecurityError");
        };
        const store = renderStore(storage);

        store.removeRaw("k");

        expect(store.getRawSnapshot("k")).toBeNull();
        expect(storage.store.get("ns.k")).toBe("v");
        expect(store.unpersistedKeys()).toEqual(["k"]);
    });

    it("clears a queued write when the key is subsequently removed", () => {
        const storage = createQuotaStorage();
        const store = renderStore(storage);
        storage.full = true;
        store.setRaw("k", "v");
        expect(store.unpersistedKeys()).toEqual(["k"]);

        store.removeRaw("k");

        expect(store.unpersistedKeys()).toEqual([]);
        expect(storage.store.has("ns.k")).toBe(false);
    });

    it("reports writes made when the browser has no usable storage backend", () => {
        const originalDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
        Object.defineProperty(window, "localStorage", {
            configurable: true,
            get() {
                throw new DOMException("blocked", "SecurityError");
            },
        });

        try {
            const store = renderStore(undefined, "memory-only");

            store.setRaw("k", "v");

            expect(store.getRawSnapshot("k")).toBe("v");
            expect(store.unpersistedKeys()).toEqual(["k"]);
            expect(store.flush()).toEqual({ persisted: [], failed: ["k"] });
        } finally {
            if (originalDescriptor) {
                Object.defineProperty(window, "localStorage", originalDescriptor);
            }
        }
    });

    it("reports writes dropped because the backend broke the synchronous contract", () => {
        const storage = createQuotaStorage();
        storage.setItem = (() => Promise.resolve()) as unknown as StorageLike["setItem"];
        const store = renderStore(storage);

        store.setRaw("k", "v");

        expect(store.unpersistedKeys()).toEqual(["k"]);
    });

    it("does not queue a rejected write that storage already satisfies", () => {
        // The cross-tab handler echoes another tab's value back through
        // setRaw. If the backend rejects that no-op write, the key is still
        // durable — queueing it would report unsaved changes forever.
        const storage = createQuotaStorage();
        storage.store.set("ns.k", "theirs");
        const store = renderStore(storage);
        storage.full = true;

        store.setRaw("k", "theirs");

        expect(store.unpersistedKeys()).toEqual([]);
        expect(store.flush()).toEqual({ persisted: [], failed: [] });
    });

    it("does not queue a rejected removal for a key storage no longer has", () => {
        const storage = createQuotaStorage();
        storage.removeItem = () => {
            throw new DOMException("blocked", "SecurityError");
        };
        const store = renderStore(storage);

        store.removeRaw("absent");

        expect(store.unpersistedKeys()).toEqual([]);
    });

    it("still queues a rejected write when storage holds something different", () => {
        const storage = createQuotaStorage();
        storage.store.set("ns.k", "theirs");
        const store = renderStore(storage);
        storage.full = true;

        store.setRaw("k", "mine");

        expect(store.unpersistedKeys()).toEqual(["k"]);
    });

    it("keeps one queue entry per key regardless of how many writes fail", () => {
        const storage = createQuotaStorage();
        const store = renderStore(storage);
        storage.full = true;

        for (let i = 0; i < 500; i++) {
            store.setRaw("draft", `revision-${i}`);
        }

        // The queue is bounded by distinct keys, not by write volume, and only
        // the latest value is retained.
        expect(store.unpersistedKeys()).toEqual(["draft"]);
        storage.full = false;
        expect(store.flush()).toEqual({ persisted: ["draft"], failed: [] });
        expect(storage.store.get("ns.draft")).toBe("revision-499");
    });

    it("does not require an enumerable backend", () => {
        const storage = createQuotaStorage();
        delete (storage as Partial<StorageLike>).key;
        const store = renderStore(storage);
        storage.full = true;

        store.setRaw("k", "v");

        expect(store.canEnumerateKeys).toBe(false);
        expect(store.keys()).toEqual([]);
        expect(store.unpersistedKeys()).toEqual(["k"]);
    });
});

describe("Mnemonic.flush", () => {
    it("rewrites queued values once space frees up", () => {
        const storage = createQuotaStorage();
        const store = renderStore(storage);
        storage.full = true;
        store.setRaw("a", "1");
        store.setRaw("b", "2");

        storage.full = false;
        const result = store.flush();

        expect(result).toEqual({ persisted: ["a", "b"], failed: [] });
        expect(storage.store.get("ns.a")).toBe("1");
        expect(storage.store.get("ns.b")).toBe("2");
        expect(store.unpersistedKeys()).toEqual([]);
    });

    it("keeps keys queued when the retry fails again", () => {
        const storage = createQuotaStorage();
        const store = renderStore(storage);
        storage.full = true;
        store.setRaw("a", "1");

        const result = store.flush();

        expect(result).toEqual({ persisted: [], failed: ["a"] });
        expect(store.unpersistedKeys()).toEqual(["a"]);

        // ...and a later flush still recovers it.
        storage.full = false;
        expect(store.flush()).toEqual({ persisted: ["a"], failed: [] });
        expect(storage.store.get("ns.a")).toBe("1");
    });

    it("flushes only the requested keys", () => {
        const storage = createQuotaStorage();
        const store = renderStore(storage);
        storage.full = true;
        store.setRaw("a", "1");
        store.setRaw("b", "2");

        storage.full = false;
        const result = store.flush(["a"]);

        expect(result).toEqual({ persisted: ["a"], failed: [] });
        expect(storage.store.has("ns.b")).toBe(false);
        expect(store.unpersistedKeys()).toEqual(["b"]);
    });

    it("ignores keys that have nothing queued", () => {
        const storage = createQuotaStorage();
        const store = renderStore(storage);
        store.setRaw("persisted", "v");

        expect(store.flush(["persisted", "never-written"])).toEqual({ persisted: [], failed: [] });
        expect(store.flush()).toEqual({ persisted: [], failed: [] });
    });

    it("deduplicates repeated keys in the request", () => {
        const storage = createQuotaStorage();
        const store = renderStore(storage);
        storage.full = true;
        store.setRaw("a", "1");

        storage.full = false;
        expect(store.flush(["a", "a"])).toEqual({ persisted: ["a"], failed: [] });
    });

    it("replays a queued removal", () => {
        const storage = createQuotaStorage();
        storage.store.set("ns.k", "v");
        let blocked = true;
        storage.removeItem = (key: string) => {
            if (blocked) {
                throw new DOMException("blocked", "SecurityError");
            }
            storage.store.delete(key);
        };
        const store = renderStore(storage);
        store.removeRaw("k");
        expect(store.unpersistedKeys()).toEqual(["k"]);

        blocked = false;
        expect(store.flush()).toEqual({ persisted: ["k"], failed: [] });
        expect(storage.store.has("ns.k")).toBe(false);
        expect(store.unpersistedKeys()).toEqual([]);
    });

    it("notifies subscribers only when the flush changes what the cache serves", () => {
        const storage = createQuotaStorage();
        const store = renderStore(storage);
        const listener = vi.fn();
        store.subscribeRaw("a", listener);

        storage.full = true;
        store.setRaw("a", "1");
        expect(listener).toHaveBeenCalledTimes(1);

        storage.full = false;
        store.flush();

        // The cache already served "1"; the flush only moved it into storage.
        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe("unpersisted writes and external changes", () => {
    it("drops a queued write when an external change reloads the key", () => {
        const storage = createQuotaStorage();
        let notify: ((changedKeys?: string[]) => void) | undefined;
        storage.onExternalChange = (callback) => {
            notify = callback;
            return () => {
                notify = undefined;
            };
        };
        const store = renderStore(storage);
        store.subscribeRaw("k", () => {});

        storage.full = true;
        store.setRaw("k", "mine");
        expect(store.unpersistedKeys()).toEqual(["k"]);

        // Another writer wins the key.
        storage.store.set("ns.k", "theirs");
        act(() => {
            notify?.(["ns.k"]);
        });

        expect(store.getRawSnapshot("k")).toBe("theirs");
        expect(store.unpersistedKeys()).toEqual([]);
        expect(store.flush()).toEqual({ persisted: [], failed: [] });
    });

    it("keeps a queued write for a key the reload only evicted from the cache", () => {
        const storage = createQuotaStorage();
        let notify: ((changedKeys?: string[]) => void) | undefined;
        storage.onExternalChange = (callback) => {
            notify = callback;
            return () => {
                notify = undefined;
            };
        };
        const store = renderStore(storage);

        storage.full = true;
        store.setRaw("unsubscribed", "mine");

        // A blanket reload evicts cache entries nobody is subscribed to.
        act(() => {
            notify?.();
        });
        expect(store.unpersistedKeys()).toEqual(["unsubscribed"]);

        storage.full = false;
        expect(store.flush()).toEqual({ persisted: ["unsubscribed"], failed: [] });
        expect(storage.store.get("ns.unsubscribed")).toBe("mine");
        expect(store.getRawSnapshot("unsubscribed")).toBe("mine");
    });

    it("keeps a queued write when the reload cannot read the key back", () => {
        const storage = createQuotaStorage();
        let notify: ((changedKeys?: string[]) => void) | undefined;
        storage.onExternalChange = (callback) => {
            notify = callback;
            return () => {
                notify = undefined;
            };
        };
        const readStore = storage.getItem;
        let readsThrow = false;
        storage.getItem = (key: string) => {
            if (readsThrow) throw new DOMException("read blocked", "SecurityError");
            return readStore(key);
        };

        const store = renderStore(storage);
        store.subscribeRaw("k", () => {});

        storage.full = true;
        store.setRaw("k", "mine");
        expect(store.unpersistedKeys()).toEqual(["k"]);

        // The backend refuses the read, which reports the same null as an
        // absent key. The reload still drops the key to a null snapshot, but
        // nothing has been *observed* to supersede the queued write, so it must
        // survive rather than be discarded on the strength of an error.
        readsThrow = true;
        act(() => {
            notify?.(["ns.k"]);
        });

        expect(store.unpersistedKeys()).toEqual(["k"]);

        // Still recoverable once the backend comes back, which re-seats the
        // cache the failed reload had emptied.
        readsThrow = false;
        storage.full = false;
        expect(store.flush()).toEqual({ persisted: ["k"], failed: [] });
        expect(storage.store.get("ns.k")).toBe("mine");
        expect(store.getRawSnapshot("k")).toBe("mine");
    });

    it("keeps a queued write when the reload's read breaks the synchronous contract", () => {
        const storage = createQuotaStorage();
        let notify: ((changedKeys?: string[]) => void) | undefined;
        storage.onExternalChange = (callback) => {
            notify = callback;
            return () => {
                notify = undefined;
            };
        };
        const readStore = storage.getItem;
        let readsAsync = false;
        storage.getItem = (key: string) =>
            readsAsync ? (Promise.resolve(null) as unknown as string | null) : readStore(key);

        const store = renderStore(storage);
        store.subscribeRaw("k", () => {});

        storage.full = true;
        store.setRaw("k", "mine");
        expect(store.unpersistedKeys()).toEqual(["k"]);

        // A getItem that returns a thenable is a contract violation, not an
        // answer about what storage holds, so the queued write stands.
        readsAsync = true;
        act(() => {
            notify?.(["ns.k"]);
        });

        expect(store.unpersistedKeys()).toEqual(["k"]);
    });
});

// ---------------------------------------------------------------------------
// Hook-level behaviour — the reproduction from the issue
// ---------------------------------------------------------------------------

describe("useMnemonicRecovery – unpersisted writes", () => {
    it("surfaces a dropped set() and recovers it once space frees up", () => {
        const storage = createQuotaStorage();
        storage.store.set("app.draft", env("saved"));

        const result = {
            current: undefined as unknown as {
                draft: ReturnType<typeof useMnemonicKey<string>>;
                recovery: ReturnType<typeof useMnemonicRecovery>;
            },
        };

        function TestComponent() {
            result.current = {
                draft: useMnemonicKey<string>("draft", { defaultValue: "" }),
                recovery: useMnemonicRecovery(),
            };
            return null;
        }

        render(
            <MnemonicProvider namespace="app" storage={storage}>
                <TestComponent />
            </MnemonicProvider>,
        );

        expect(result.current.draft.value).toBe("saved");
        expect(result.current.recovery.unpersistedKeys()).toEqual([]);

        // The origin hits its quota.
        storage.full = true;
        act(() => {
            result.current.draft.set("edited");
        });

        // set() returned normally and the component shows the new value...
        expect(result.current.draft.value).toBe("edited");
        // ...but storage still holds the old one, and now the app can tell.
        expect(storage.store.get("app.draft")).toBe(env("saved"));
        expect(result.current.recovery.unpersistedKeys()).toEqual(["draft"]);

        // The app evicts something else and retries.
        storage.full = false;
        let flushed: ReturnType<typeof result.current.recovery.flush> | undefined;
        act(() => {
            flushed = result.current.recovery.flush();
        });

        expect(flushed).toEqual({ persisted: ["draft"], failed: [] });
        expect(storage.store.get("app.draft")).toBe(env("edited"));
        expect(result.current.recovery.unpersistedKeys()).toEqual([]);
    });

    it("survives a reload with the flushed value", () => {
        const storage = createQuotaStorage();

        const first = {
            current: undefined as unknown as {
                draft: ReturnType<typeof useMnemonicKey<string>>;
                recovery: ReturnType<typeof useMnemonicRecovery>;
            },
        };

        function TestComponent({
            sink,
        }: {
            sink: { current: { draft: ReturnType<typeof useMnemonicKey<string>>; recovery: unknown } };
        }) {
            sink.current = {
                draft: useMnemonicKey<string>("draft", { defaultValue: "" }),
                recovery: useMnemonicRecovery(),
            };
            return null;
        }

        const mounted = render(
            <MnemonicProvider namespace="app" storage={storage}>
                <TestComponent sink={first} />
            </MnemonicProvider>,
        );

        storage.full = true;
        act(() => {
            first.current.draft.set("edited");
        });
        storage.full = false;
        act(() => {
            (first.current.recovery as ReturnType<typeof useMnemonicRecovery>).flush();
        });
        mounted.unmount();

        // Fresh provider over the same backend stands in for a page reload.
        const second = {
            current: undefined as unknown as {
                draft: ReturnType<typeof useMnemonicKey<string>>;
                recovery: ReturnType<typeof useMnemonicRecovery>;
            },
        };
        render(
            <MnemonicProvider namespace="app" storage={storage}>
                <TestComponent sink={second} />
            </MnemonicProvider>,
        );

        expect(second.current.draft.value).toBe("edited");
    });

    it("clearAll() also clears keys that only exist as unpersisted writes", () => {
        const storage = createQuotaStorage();
        storage.store.set("app.stored", env("kept"));
        const result = { current: undefined as unknown as ReturnType<typeof useMnemonicRecovery> };

        function TestComponent() {
            result.current = useMnemonicRecovery();
            return null;
        }

        const store = (() => {
            let captured: ReturnType<typeof useMnemonic> | undefined;
            render(
                <MnemonicProvider namespace="app" storage={storage}>
                    <StoreConsumer
                        onStore={(s) => {
                            captured = s;
                        }}
                    />
                    <TestComponent />
                </MnemonicProvider>,
            );
            return captured!;
        })();

        storage.full = true;
        store.setRaw("memory-only", "v");
        expect(result.current.listKeys()).toEqual(["stored"]);
        expect(result.current.unpersistedKeys()).toEqual(["memory-only"]);

        let cleared: string[] = [];
        act(() => {
            cleared = result.current.clearAll();
        });

        // Without the union, "memory-only" would stay queued and a later
        // flush() would write it back after a reset.
        expect(cleared.sort()).toEqual(["memory-only", "stored"]);
        expect(result.current.unpersistedKeys()).toEqual([]);
        expect(store.flush()).toEqual({ persisted: [], failed: [] });
    });

    it("clearMatching() reaches unpersisted keys too", () => {
        const storage = createQuotaStorage();
        const result = { current: undefined as unknown as ReturnType<typeof useMnemonicRecovery> };

        function TestComponent() {
            result.current = useMnemonicRecovery();
            return null;
        }

        let store: ReturnType<typeof useMnemonic> | undefined;
        render(
            <MnemonicProvider namespace="app" storage={storage}>
                <StoreConsumer
                    onStore={(s) => {
                        store = s;
                    }}
                />
                <TestComponent />
            </MnemonicProvider>,
        );

        storage.full = true;
        store!.setRaw("filters.query", "react");
        store!.setRaw("theme", "dark");

        let cleared: string[] = [];
        act(() => {
            cleared = result.current.clearMatching((key) => key.startsWith("filters."));
        });

        expect(cleared).toEqual(["filters.query"]);
        expect(result.current.unpersistedKeys()).toEqual(["theme"]);
    });

    it("reports nothing to flush on a healthy backend", () => {
        const storage = createQuotaStorage();
        const result = { current: undefined as unknown as ReturnType<typeof useMnemonicRecovery> };

        function TestComponent() {
            useMnemonicKey<string>("draft", { defaultValue: "" });
            result.current = useMnemonicRecovery();
            return null;
        }

        render(
            <MnemonicProvider namespace="app" storage={storage}>
                <TestComponent />
            </MnemonicProvider>,
        );

        expect(result.current.unpersistedKeys()).toEqual([]);
        expect(result.current.flush()).toEqual({ persisted: [], failed: [] });
    });
});
