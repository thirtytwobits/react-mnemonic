// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MnemonicProvider, useMnemonic } from "./provider";
import type { StorageLike } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates an in-memory StorageLike for testing. */
function createMockStorage(): StorageLike & { store: Map<string, string> } {
    const store = new Map<string, string>();
    return {
        store,
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
        get length() {
            return store.size;
        },
        key: (index: number) => {
            return Array.from(store.keys())[index] ?? null;
        },
    };
}

/** A component that calls useMnemonic() and exposes the store via test-ids. */
function StoreConsumer({ onStore }: { onStore: (store: ReturnType<typeof useMnemonic>) => void }) {
    const store = useMnemonic();
    React.useEffect(() => {
        onStore(store);
    }, [store, onStore]);
    return <div data-testid="consumer">connected</div>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MnemonicProvider", () => {
    it("renders children", () => {
        render(
            <MnemonicProvider namespace="test" storage={createMockStorage()}>
                <div data-testid="child">hello</div>
            </MnemonicProvider>,
        );
        expect(screen.getByTestId("child").textContent).toBe("hello");
    });
});

describe("useMnemonic", () => {
    it("throws when used outside MnemonicProvider", () => {
        // Suppress the React error boundary console output
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        function Bad() {
            useMnemonic();
            return null;
        }
        expect(() => render(<Bad />)).toThrow("useMnemonic must be used within a MnemonicProvider");
        spy.mockRestore();
    });
});

describe("Mnemonic store API", () => {
    let storage: ReturnType<typeof createMockStorage>;
    let store: ReturnType<typeof useMnemonic>;

    beforeEach(() => {
        storage = createMockStorage();
        store = undefined as any;
    });

    function renderWithStore(namespace = "ns") {
        const onStore = vi.fn((s) => {
            store = s;
        });
        render(
            <MnemonicProvider namespace={namespace} storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );
        // store is set synchronously in the first render cycle
        expect(store).toBeDefined();
        return store;
    }

    it("getRawSnapshot returns null for unknown keys", () => {
        renderWithStore();
        expect(store.getRawSnapshot("unknown")).toBeNull();
    });

    it("setRaw + getRawSnapshot roundtrip", () => {
        renderWithStore();
        store.setRaw("key1", "value1");
        expect(store.getRawSnapshot("key1")).toBe("value1");
    });

    it("persists to the underlying storage with namespace prefix", () => {
        renderWithStore("myns");
        store.setRaw("foo", "bar");
        expect(storage.store.get("myns.foo")).toBe("bar");
    });

    it("removeRaw removes the value", () => {
        renderWithStore();
        store.setRaw("k", "v");
        expect(store.getRawSnapshot("k")).toBe("v");
        store.removeRaw("k");
        expect(store.getRawSnapshot("k")).toBeNull();
    });

    it("removeRaw removes from underlying storage", () => {
        renderWithStore("ns");
        store.setRaw("k", "v");
        expect(storage.store.has("ns.k")).toBe(true);
        store.removeRaw("k");
        expect(storage.store.has("ns.k")).toBe(false);
    });

    it("subscribeRaw notifies listeners on setRaw", () => {
        renderWithStore();
        const listener = vi.fn();
        store.subscribeRaw("k", listener);
        store.setRaw("k", "v");
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("subscribeRaw notifies listeners on removeRaw", () => {
        renderWithStore();
        store.setRaw("k", "v");
        const listener = vi.fn();
        store.subscribeRaw("k", listener);
        store.removeRaw("k");
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("unsubscribe stops notifications", () => {
        renderWithStore();
        const listener = vi.fn();
        const unsub = store.subscribeRaw("k", listener);
        store.setRaw("k", "v1");
        expect(listener).toHaveBeenCalledTimes(1);

        unsub();
        store.setRaw("k", "v2");
        expect(listener).toHaveBeenCalledTimes(1); // not called again
    });

    it("multiple listeners for the same key", () => {
        renderWithStore();
        const l1 = vi.fn();
        const l2 = vi.fn();
        store.subscribeRaw("k", l1);
        store.subscribeRaw("k", l2);
        store.setRaw("k", "v");
        expect(l1).toHaveBeenCalledTimes(1);
        expect(l2).toHaveBeenCalledTimes(1);
    });

    it("listeners for different keys are independent", () => {
        renderWithStore();
        const l1 = vi.fn();
        const l2 = vi.fn();
        store.subscribeRaw("a", l1);
        store.subscribeRaw("b", l2);
        store.setRaw("a", "1");
        expect(l1).toHaveBeenCalledTimes(1);
        expect(l2).toHaveBeenCalledTimes(0);
    });

    it("keys() returns all namespaced keys", () => {
        renderWithStore("ns");
        storage.store.set("ns.alpha", "1");
        storage.store.set("ns.beta", "2");
        storage.store.set("other.gamma", "3");
        const result = store.keys();
        expect(result).toContain("alpha");
        expect(result).toContain("beta");
        expect(result).not.toContain("gamma");
    });

    it("dump() returns all key-value pairs", () => {
        renderWithStore("ns");
        storage.store.set("ns.x", "10");
        storage.store.set("ns.y", "20");
        const result = store.dump();
        expect(result).toEqual({ x: "10", y: "20" });
    });

    it("prefix matches the namespace", () => {
        renderWithStore("myprefix");
        expect(store.prefix).toBe("myprefix.");
    });

    it("read-through: loads value from storage on first access", () => {
        storage.store.set("ns.preexist", "hello");
        renderWithStore("ns");
        expect(store.getRawSnapshot("preexist")).toBe("hello");
    });
});

describe("MnemonicProvider – storage edge cases", () => {
    it("works when storage is undefined (SSR-like)", () => {
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        render(
            <MnemonicProvider namespace="ssr" storage={undefined as unknown as StorageLike}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );
        // Should not throw, values default to null
        expect(store!.getRawSnapshot("any")).toBeNull();
        // Setting still works (cached in memory)
        store!.setRaw("any", "val");
        expect(store!.getRawSnapshot("any")).toBe("val");
    });

    it("handles storage.getItem throwing", () => {
        const badStorage: StorageLike = {
            getItem: () => {
                throw new Error("read error");
            },
            setItem: () => {},
            removeItem: () => {},
        };
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        render(
            <MnemonicProvider namespace="err" storage={badStorage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );
        expect(store!.getRawSnapshot("k")).toBeNull();
    });

    it("handles storage.setItem throwing (quota exceeded)", () => {
        const storage = createMockStorage();
        storage.setItem = () => {
            throw new Error("quota exceeded");
        };
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );
        // Should not throw, value is still cached in memory
        store!.setRaw("k", "v");
        expect(store!.getRawSnapshot("k")).toBe("v");
        // But not in underlying storage
        expect(storage.store.has("ns.k")).toBe(false);
    });

    it("handles storage.removeItem throwing", () => {
        const storage = createMockStorage();
        storage.store.set("ns.k", "v");
        storage.removeItem = () => {
            throw new Error("remove error");
        };
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );
        // Should not throw; cache is updated even though storage removal fails
        store!.removeRaw("k");
        expect(store!.getRawSnapshot("k")).toBeNull();
    });
});

describe("MnemonicProvider – DevTools", () => {
    beforeEach(() => {
        delete (window as any).__REACT_MNEMONIC_DEVTOOLS__;
    });

    it("registers DevTools on window when enableDevTools is true", () => {
        const storage = createMockStorage();
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        expect((window as any).__REACT_MNEMONIC_DEVTOOLS__).toBeDefined();
        expect((window as any).__REACT_MNEMONIC_DEVTOOLS__.dt).toBeDefined();
    });

    it("does not register DevTools when enableDevTools is false", () => {
        render(
            <MnemonicProvider namespace="dt" storage={createMockStorage()}>
                <div />
            </MnemonicProvider>,
        );
        expect((window as any).__REACT_MNEMONIC_DEVTOOLS__).toBeUndefined();
    });

    it("DevTools.get returns decoded value", () => {
        const storage = createMockStorage();
        storage.store.set("dt.user", JSON.stringify({ name: "Alice" }));
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const devtools = (window as any).__REACT_MNEMONIC_DEVTOOLS__.dt;
        expect(devtools.get("user")).toEqual({ name: "Alice" });
    });

    it("DevTools.get returns undefined for missing key", () => {
        render(
            <MnemonicProvider namespace="dt" storage={createMockStorage()} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const devtools = (window as any).__REACT_MNEMONIC_DEVTOOLS__.dt;
        expect(devtools.get("missing")).toBeUndefined();
    });

    it("DevTools.get returns raw string for non-JSON values", () => {
        const storage = createMockStorage();
        storage.store.set("dt.plain", "not json");
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const devtools = (window as any).__REACT_MNEMONIC_DEVTOOLS__.dt;
        expect(devtools.get("plain")).toBe("not json");
    });

    it("DevTools.set writes JSON-encoded value", () => {
        const storage = createMockStorage();
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const devtools = (window as any).__REACT_MNEMONIC_DEVTOOLS__.dt;
        devtools.set("theme", "dark");
        expect(storage.store.get("dt.theme")).toBe(JSON.stringify("dark"));
    });

    it("DevTools.remove removes the key", () => {
        const storage = createMockStorage();
        storage.store.set("dt.k", "v");
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const devtools = (window as any).__REACT_MNEMONIC_DEVTOOLS__.dt;
        devtools.remove("k");
        expect(storage.store.has("dt.k")).toBe(false);
    });

    it("DevTools.keys lists namespace keys", () => {
        const storage = createMockStorage();
        storage.store.set("dt.a", "1");
        storage.store.set("dt.b", "2");
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const devtools = (window as any).__REACT_MNEMONIC_DEVTOOLS__.dt;
        expect(devtools.keys()).toEqual(expect.arrayContaining(["a", "b"]));
    });

    it("DevTools.clear removes all namespace keys", () => {
        const storage = createMockStorage();
        storage.store.set("dt.a", "1");
        storage.store.set("dt.b", "2");
        storage.store.set("other.c", "3");
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const devtools = (window as any).__REACT_MNEMONIC_DEVTOOLS__.dt;
        devtools.clear();
        expect(storage.store.has("dt.a")).toBe(false);
        expect(storage.store.has("dt.b")).toBe(false);
        // Other namespace untouched
        expect(storage.store.has("other.c")).toBe(true);
    });

    it("DevTools.dump returns all key-value pairs", () => {
        const storage = createMockStorage();
        storage.store.set("dt.x", "10");
        storage.store.set("dt.y", "20");
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const devtools = (window as any).__REACT_MNEMONIC_DEVTOOLS__.dt;
        const spy = vi.spyOn(console, "table").mockImplementation(() => {});
        const result = devtools.dump();
        expect(result).toEqual({ x: "10", y: "20" });
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it("DevTools.getStore returns the store instance", () => {
        const storage = createMockStorage();
        let capturedStore: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            capturedStore = s;
        });
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );
        const devtools = (window as any).__REACT_MNEMONIC_DEVTOOLS__.dt;
        expect(devtools.getStore()).toBe(capturedStore!);
    });
});

// ---------------------------------------------------------------------------
// onExternalChange / reloadFromStorage
// ---------------------------------------------------------------------------

/** Creates a mock storage that implements onExternalChange. */
function createMockStorageWithExternalChange(): StorageLike & {
    store: Map<string, string>;
    triggerExternalChange: (changedKeys?: string[]) => void;
} {
    const store = new Map<string, string>();
    const listeners = new Set<(changedKeys?: string[]) => void>();
    return {
        store,
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
        get length() {
            return store.size;
        },
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        onExternalChange(callback: (changedKeys?: string[]) => void) {
            listeners.add(callback);
            return () => {
                listeners.delete(callback);
            };
        },
        triggerExternalChange(changedKeys?: string[]) {
            for (const fn of listeners) fn(changedKeys);
        },
    };
}

describe("reloadFromStorage via onExternalChange", () => {
    it("detects a value added externally", () => {
        const storage = createMockStorageWithExternalChange();
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        // Subscribe a listener to a key
        const listener = vi.fn();
        store!.subscribeRaw("key1", listener);
        expect(store!.getRawSnapshot("key1")).toBeNull();

        // Externally add a value to the underlying store
        storage.store.set("ns.key1", "external-value");
        storage.triggerExternalChange();

        expect(listener).toHaveBeenCalled();
        expect(store!.getRawSnapshot("key1")).toBe("external-value");
    });

    it("detects a value removed externally", () => {
        const storage = createMockStorageWithExternalChange();
        storage.store.set("ns.key1", "original");
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        const listener = vi.fn();
        store!.subscribeRaw("key1", listener);
        expect(store!.getRawSnapshot("key1")).toBe("original");

        // Externally remove the value
        storage.store.delete("ns.key1");
        storage.triggerExternalChange();

        expect(listener).toHaveBeenCalled();
        expect(store!.getRawSnapshot("key1")).toBeNull();
    });

    it("does not emit for unchanged keys", () => {
        const storage = createMockStorageWithExternalChange();
        storage.store.set("ns.key1", "stable");
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        const listener = vi.fn();
        store!.subscribeRaw("key1", listener);
        // Prime the cache
        store!.getRawSnapshot("key1");

        // Trigger without changing the underlying value
        storage.triggerExternalChange();

        expect(listener).not.toHaveBeenCalled();
    });

    it("handles multiple keys with mixed changes", () => {
        const storage = createMockStorageWithExternalChange();
        storage.store.set("ns.a", "1");
        storage.store.set("ns.b", "2");
        storage.store.set("ns.c", "3");
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        const listenerA = vi.fn();
        const listenerB = vi.fn();
        const listenerC = vi.fn();
        store!.subscribeRaw("a", listenerA);
        store!.subscribeRaw("b", listenerB);
        store!.subscribeRaw("c", listenerC);
        // Prime cache
        store!.getRawSnapshot("a");
        store!.getRawSnapshot("b");
        store!.getRawSnapshot("c");

        // Change a and c, leave b unchanged
        storage.store.set("ns.a", "100");
        storage.store.set("ns.c", "300");
        storage.triggerExternalChange();

        expect(listenerA).toHaveBeenCalled();
        expect(listenerB).not.toHaveBeenCalled();
        expect(listenerC).toHaveBeenCalled();
        expect(store!.getRawSnapshot("a")).toBe("100");
        expect(store!.getRawSnapshot("b")).toBe("2");
        expect(store!.getRawSnapshot("c")).toBe("300");
    });

    it("evicts unsubscribed cached keys so next read is fresh", () => {
        const storage = createMockStorageWithExternalChange();
        storage.store.set("ns.cached", "old");
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        // Prime the cache for "cached" key but do NOT subscribe a listener
        expect(store!.getRawSnapshot("cached")).toBe("old");

        // Mutate the underlying storage and trigger
        storage.store.set("ns.cached", "new");
        storage.triggerExternalChange();

        // The cache was evicted, so readThrough picks up the new value
        expect(store!.getRawSnapshot("cached")).toBe("new");
    });

    it("provider works normally when storage has no onExternalChange", () => {
        const storage = createMockStorage();
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );
        store!.setRaw("k", "v");
        expect(store!.getRawSnapshot("k")).toBe("v");
    });

    it("unsubscribes onExternalChange on unmount", () => {
        const storage = createMockStorageWithExternalChange();
        const onStore = vi.fn();
        const { unmount } = render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        // After unmount, triggerExternalChange should not throw
        unmount();
        expect(() => storage.triggerExternalChange()).not.toThrow();
    });

    it("granular: only specified keys are refreshed", () => {
        const storage = createMockStorageWithExternalChange();
        storage.store.set("ns.a", "1");
        storage.store.set("ns.b", "2");
        storage.store.set("ns.c", "3");
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        const listenerA = vi.fn();
        const listenerB = vi.fn();
        const listenerC = vi.fn();
        store!.subscribeRaw("a", listenerA);
        store!.subscribeRaw("b", listenerB);
        store!.subscribeRaw("c", listenerC);
        // Prime cache
        store!.getRawSnapshot("a");
        store!.getRawSnapshot("b");
        store!.getRawSnapshot("c");

        // Change a and c, leave b unchanged
        storage.store.set("ns.a", "100");
        storage.store.set("ns.c", "300");
        storage.triggerExternalChange(["ns.a", "ns.c"]);

        expect(listenerA).toHaveBeenCalled();
        expect(listenerB).not.toHaveBeenCalled();
        expect(listenerC).toHaveBeenCalled();
        expect(store!.getRawSnapshot("a")).toBe("100");
        expect(store!.getRawSnapshot("b")).toBe("2");
        expect(store!.getRawSnapshot("c")).toBe("300");
    });

    it("granular: keys outside namespace are ignored", () => {
        const storage = createMockStorageWithExternalChange();
        storage.store.set("ns.a", "1");
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        const listenerA = vi.fn();
        store!.subscribeRaw("a", listenerA);
        store!.getRawSnapshot("a");

        // Trigger with key outside our namespace
        storage.triggerExternalChange(["other.x"]);

        expect(listenerA).not.toHaveBeenCalled();
    });

    it("granular: cached-but-unsubscribed key is evicted", () => {
        const storage = createMockStorageWithExternalChange();
        storage.store.set("ns.cached", "old");
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        // Prime the cache without subscribing
        expect(store!.getRawSnapshot("cached")).toBe("old");

        // Mutate underlying storage and trigger granular
        storage.store.set("ns.cached", "new");
        storage.triggerExternalChange(["ns.cached"]);

        // Cache was evicted, so readThrough picks up fresh value
        expect(store!.getRawSnapshot("cached")).toBe("new");
    });

    it("granular: empty array is a no-op", () => {
        const storage = createMockStorageWithExternalChange();
        storage.store.set("ns.a", "1");
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        const listenerA = vi.fn();
        store!.subscribeRaw("a", listenerA);
        store!.getRawSnapshot("a");

        // Change the underlying value but trigger with empty array
        storage.store.set("ns.a", "999");
        storage.triggerExternalChange([]);

        expect(listenerA).not.toHaveBeenCalled();
        // Cache still has old value because nothing was reloaded
        expect(store!.getRawSnapshot("a")).toBe("1");
    });

    it("blanket reload via explicit undefined", () => {
        const storage = createMockStorageWithExternalChange();
        storage.store.set("ns.a", "1");
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        const listenerA = vi.fn();
        store!.subscribeRaw("a", listenerA);
        store!.getRawSnapshot("a");

        storage.store.set("ns.a", "updated");
        storage.triggerExternalChange(undefined);

        expect(listenerA).toHaveBeenCalled();
        expect(store!.getRawSnapshot("a")).toBe("updated");
    });
});
