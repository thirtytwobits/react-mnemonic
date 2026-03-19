// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

const originalProcess = (globalThis as any).process;

function setNodeEnv(value: string) {
    const currentProcess = (globalThis as any).process ?? {};
    const currentEnv = currentProcess.env ?? {};
    (globalThis as any).process = {
        ...currentProcess,
        env: {
            ...currentEnv,
            NODE_ENV: value,
        },
    };
}

function restoreProcess() {
    (globalThis as any).process = originalProcess;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MnemonicProvider", () => {
    afterEach(() => {
        restoreProcess();
    });

    it("renders children", () => {
        render(
            <MnemonicProvider namespace="test" storage={createMockStorage()}>
                <div data-testid="child">hello</div>
            </MnemonicProvider>,
        );
        expect(screen.getByTestId("child").textContent).toBe("hello");
    });

    it("warns once in development for nested providers with the same namespace", () => {
        setNodeEnv("development");
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const outerStorage = createMockStorage();
        const innerStorage = createMockStorage();

        const tree = (
            <MnemonicProvider namespace="nested-dev-warning" storage={outerStorage}>
                <MnemonicProvider namespace="nested-dev-warning" storage={innerStorage}>
                    <div data-testid="child">hello</div>
                </MnemonicProvider>
            </MnemonicProvider>
        );

        const { rerender } = render(tree);
        rerender(tree);

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0]?.[0]).toContain('namespace "nested-dev-warning"');

        warnSpy.mockRestore();
    });

    it("does not warn in development for nested providers with different namespaces", () => {
        setNodeEnv("development");
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        render(
            <MnemonicProvider namespace="outer-scope" storage={createMockStorage()}>
                <MnemonicProvider namespace="inner-scope" storage={createMockStorage()}>
                    <div data-testid="child">hello</div>
                </MnemonicProvider>
            </MnemonicProvider>,
        );

        expect(warnSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
    });

    it("does not warn in production for nested providers with the same namespace", () => {
        setNodeEnv("production");
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        render(
            <MnemonicProvider namespace="nested-prod-warning" storage={createMockStorage()}>
                <MnemonicProvider namespace="nested-prod-warning" storage={createMockStorage()}>
                    <div data-testid="child">hello</div>
                </MnemonicProvider>
            </MnemonicProvider>,
        );

        expect(warnSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
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

    it("rejects promise-returning getItem implementations and falls back to memory", () => {
        const getItem = vi.fn(() => Promise.resolve("later"));
        const badStorage = {
            getItem,
            setItem: () => {},
            removeItem: () => {},
        } as unknown as StorageLike;

        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});

        render(
            <MnemonicProvider namespace="async-read" storage={badStorage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        expect(store!.getRawSnapshot("k")).toBeNull();
        expect(store!.getRawSnapshot("k")).toBeNull();
        expect(getItem).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(expect.stringContaining("StorageLike.getItem returned a Promise"));

        spy.mockRestore();
    });

    it("treats throwing enumeration capability getters as non-enumerable during initialization", () => {
        const badStorage = {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
            get length() {
                throw new DOMException("blocked", "SecurityError");
            },
            key: () => null,
        } as unknown as StorageLike;

        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });

        expect(() =>
            render(
                <MnemonicProvider namespace="ns" storage={badStorage}>
                    <StoreConsumer onStore={onStore} />
                </MnemonicProvider>,
            ),
        ).not.toThrow();

        expect(store!.canEnumerateKeys).toBe(false);
        expect(store!.keys()).toEqual([]);
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

    it("rejects promise-returning write methods, logs once, and keeps working from memory", () => {
        const setItem = vi.fn(() => Promise.resolve());
        const removeItem = vi.fn(() => Promise.resolve());
        const badStorage = {
            getItem: () => null,
            setItem,
            removeItem,
        } as unknown as StorageLike;

        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});

        render(
            <MnemonicProvider namespace="async-write" storage={badStorage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        store!.setRaw("k", "v");
        expect(store!.getRawSnapshot("k")).toBe("v");
        expect(setItem).toHaveBeenCalledTimes(1);

        store!.removeRaw("k");
        expect(store!.getRawSnapshot("k")).toBeNull();
        expect(removeItem).not.toHaveBeenCalled();

        expect(spy).toHaveBeenCalledWith(expect.stringContaining("StorageLike.setItem returned a Promise"));
        expect(spy).toHaveBeenCalledTimes(1);

        spy.mockRestore();
    });

    it("logs QuotaExceededError once then squelches until a write succeeds", () => {
        const storage = createMockStorage();
        let shouldThrow = true;
        const origSetItem = storage.setItem.bind(storage);
        storage.setItem = (key: string, value: string) => {
            if (shouldThrow) {
                const err = new DOMException("quota exceeded", "QuotaExceededError");
                throw err;
            }
            origSetItem(key, value);
        };
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        // First write: should log
        store!.setRaw("k", "v1");
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]![0]).toContain("Storage quota exceeded");

        // Second write while still failing: squelched
        store!.setRaw("k", "v2");
        expect(spy).toHaveBeenCalledTimes(1);

        // Third write while still failing: still squelched
        store!.setRaw("k", "v3");
        expect(spy).toHaveBeenCalledTimes(1);

        // Successful write resets the flag
        shouldThrow = false;
        store!.setRaw("k", "v4");
        expect(spy).toHaveBeenCalledTimes(1); // no error on success

        // Back to failing: should log again
        shouldThrow = true;
        store!.setRaw("k", "v5");
        expect(spy).toHaveBeenCalledTimes(2);

        // Squelched again
        store!.setRaw("k", "v6");
        expect(spy).toHaveBeenCalledTimes(2);

        spy.mockRestore();
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

    it("falls back to in-memory behavior when the default browser storage is unavailable", () => {
        const originalDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
        Object.defineProperty(window, "localStorage", {
            configurable: true,
            get() {
                throw new DOMException("blocked", "SecurityError");
            },
        });

        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });

        try {
            expect(() =>
                render(
                    <MnemonicProvider namespace="browser-defaults">
                        <StoreConsumer onStore={onStore} />
                    </MnemonicProvider>,
                ),
            ).not.toThrow();

            expect(store!.getRawSnapshot("k")).toBeNull();
            store!.setRaw("k", "memory-only");
            expect(store!.getRawSnapshot("k")).toBe("memory-only");
        } finally {
            if (originalDescriptor) {
                Object.defineProperty(window, "localStorage", originalDescriptor);
            }
        }
    });

    it("treats an explicitly supplied native localStorage backend as browser storage sync", () => {
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });

        render(
            <MnemonicProvider namespace="explicit-localstorage" storage={window.localStorage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        expect(store!.crossTabSyncMode).toBe("browser-storage-event");
    });
});

describe("MnemonicProvider – DOMException/SecurityError logging", () => {
    it("logs SecurityError once from getItem, squelches repeats", () => {
        const storage = createMockStorage();
        storage.getItem = () => {
            throw new DOMException("access denied", "SecurityError");
        };
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        // First read: should log
        store!.getRawSnapshot("a");
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]![0]).toContain("Storage access error (SecurityError)");

        // Second read: squelched
        store!.getRawSnapshot("b");
        expect(spy).toHaveBeenCalledTimes(1);

        spy.mockRestore();
    });

    it("successful storage access resets the access error flag", () => {
        const storage = createMockStorage();
        let shouldThrow = true;
        const origGetItem = storage.getItem.bind(storage);
        const origSetItem = storage.setItem.bind(storage);
        storage.getItem = (key: string) => {
            if (shouldThrow) {
                throw new DOMException("access denied", "SecurityError");
            }
            return origGetItem(key);
        };
        storage.setItem = (key: string, value: string) => {
            if (shouldThrow) {
                throw new DOMException("access denied", "SecurityError");
            }
            origSetItem(key, value);
        };
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        // First failure: logs
        store!.getRawSnapshot("a");
        expect(spy).toHaveBeenCalledTimes(1);

        // Successful write resets the flag
        shouldThrow = false;
        store!.setRaw("b", "val");

        // Back to failing: should log again (flag was reset)
        shouldThrow = true;
        store!.getRawSnapshot("c");
        expect(spy).toHaveBeenCalledTimes(2);

        spy.mockRestore();
    });

    it("non-DOMException errors are silently suppressed", () => {
        const storage = createMockStorage();
        storage.getItem = () => {
            throw new TypeError("some internal error");
        };
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        store!.getRawSnapshot("a");
        store!.getRawSnapshot("b");
        expect(spy).not.toHaveBeenCalled();

        spy.mockRestore();
    });

    it("accessErrorLogged and quotaErrorLogged are independent flags", () => {
        const storage = createMockStorage();
        storage.getItem = () => {
            throw new DOMException("blocked", "SecurityError");
        };
        storage.setItem = () => {
            throw new DOMException("full", "QuotaExceededError");
        };
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        // Trigger SecurityError via read
        store!.getRawSnapshot("a");
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]![0]).toContain("Storage access error (SecurityError)");

        // Trigger QuotaExceededError via write
        store!.setRaw("b", "val");
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[1]![0]).toContain("Storage quota exceeded");

        // Both are now squelched
        store!.getRawSnapshot("c");
        store!.setRaw("d", "val2");
        expect(spy).toHaveBeenCalledTimes(2);

        spy.mockRestore();
    });

    it("logs DOMException from removeItem once", () => {
        const storage = createMockStorage();
        storage.removeItem = () => {
            throw new DOMException("blocked", "SecurityError");
        };
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        store!.removeRaw("a");
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]![0]).toContain("Storage access error (SecurityError)");

        // Squelched
        store!.removeRaw("b");
        expect(spy).toHaveBeenCalledTimes(1);

        spy.mockRestore();
    });

    it("logs DOMException from keys() enumeration once", () => {
        const storage = createMockStorage();
        storage.store.set("ns.a", "1"); // Ensure length > 0
        storage.key = () => {
            throw new DOMException("blocked", "SecurityError");
        };
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        store!.keys();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]![0]).toContain("Storage access error (SecurityError)");

        // Squelched
        store!.keys();
        expect(spy).toHaveBeenCalledTimes(1);

        spy.mockRestore();
    });

    it("logs DOMException when enumeration getters fail after initialization", () => {
        const storage = createMockStorage();
        storage.store.set("ns.a", "1");

        let keyAccessCount = 0;
        Object.defineProperty(storage, "key", {
            configurable: true,
            get() {
                keyAccessCount += 1;
                if (keyAccessCount === 1) {
                    return (index: number) => Array.from(storage.store.keys())[index] ?? null;
                }
                throw new DOMException("blocked", "SecurityError");
            },
        });

        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});

        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        expect(store!.canEnumerateKeys).toBe(true);
        expect(store!.keys()).toEqual([]);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]![0]).toContain("Storage access error (SecurityError)");

        spy.mockRestore();
    });

    it("writeRaw logs non-quota DOMException via accessError path", () => {
        const storage = createMockStorage();
        storage.setItem = () => {
            throw new DOMException("not allowed", "NotAllowedError");
        };
        let store: ReturnType<typeof useMnemonic>;
        const onStore = vi.fn((s) => {
            store = s;
        });
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        store!.setRaw("k", "v");
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]![0]).toContain("Storage access error (NotAllowedError)");

        // Squelched
        store!.setRaw("k2", "v2");
        expect(spy).toHaveBeenCalledTimes(1);

        spy.mockRestore();
    });
});

describe("MnemonicProvider – DevTools", () => {
    const originalWeakRef = (globalThis as any).WeakRef;
    const originalWeakRefDescriptor = Object.getOwnPropertyDescriptor(globalThis, "WeakRef");
    const originalFinalizationRegistryDescriptor = Object.getOwnPropertyDescriptor(globalThis, "FinalizationRegistry");

    const restoreGlobalConstructor = (
        name: "WeakRef" | "FinalizationRegistry",
        descriptor: PropertyDescriptor | undefined,
    ) => {
        if (descriptor) {
            Object.defineProperty(globalThis, name, descriptor);
            return;
        }
        delete (globalThis as any)[name];
    };

    beforeEach(() => {
        delete (window as any).__REACT_MNEMONIC_DEVTOOLS__;
        restoreGlobalConstructor("WeakRef", originalWeakRefDescriptor);
        restoreGlobalConstructor("FinalizationRegistry", originalFinalizationRegistryDescriptor);
        restoreProcess();
    });

    afterEach(() => {
        restoreGlobalConstructor("WeakRef", originalWeakRefDescriptor);
        restoreGlobalConstructor("FinalizationRegistry", originalFinalizationRegistryDescriptor);
        restoreProcess();
    });

    function getRegistry() {
        return (window as any).__REACT_MNEMONIC_DEVTOOLS__;
    }

    it("registers devtools registry root when enableDevTools is true", () => {
        const storage = createMockStorage();
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const registry = getRegistry();
        expect(registry).toBeDefined();
        expect(registry.providers).toBeDefined();
        expect(typeof registry.resolve).toBe("function");
        expect(typeof registry.list).toBe("function");
        expect(typeof registry.capabilities).toBe("object");
        expect(typeof registry.__meta).toBe("object");
    });

    it("does not register devtools registry when enableDevTools is false", () => {
        render(
            <MnemonicProvider namespace="dt" storage={createMockStorage()}>
                <div />
            </MnemonicProvider>,
        );
        expect(getRegistry()).toBeUndefined();
    });

    it("does not attach provider API hold when enableDevTools is false", () => {
        let capturedStore: ReturnType<typeof useMnemonic> | undefined;
        const onStore = vi.fn((s) => {
            capturedStore = s;
        });

        render(
            <MnemonicProvider namespace="dt" storage={createMockStorage()}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        expect(capturedStore).toBeDefined();
        expect((capturedStore as any).__devToolsProviderApiHold).toBeUndefined();
        expect(getRegistry()).toBeUndefined();
    });

    it("resolve(namespace) returns provider API", () => {
        const storage = createMockStorage();
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const registry = getRegistry();
        const provider = registry.resolve("dt");
        expect(provider).toBeDefined();
        expect(typeof provider.get).toBe("function");
        expect(typeof provider.set).toBe("function");
        expect(typeof provider.dump).toBe("function");
    });

    it("registry provider entries contain weak refs and metadata only", () => {
        let capturedStore: ReturnType<typeof useMnemonic> | undefined;
        const onStore = vi.fn((s) => {
            capturedStore = s;
        });

        render(
            <MnemonicProvider namespace="dt" storage={createMockStorage()} enableDevTools={true}>
                <StoreConsumer onStore={onStore} />
            </MnemonicProvider>,
        );

        const registry = getRegistry();
        const entry = registry.providers.dt;
        expect(entry).toBeDefined();
        expect(Object.keys(entry).sort()).toEqual(["lastSeenAt", "namespace", "registeredAt", "staleSince", "weakRef"]);
        expect("provider" in entry).toBe(false);
        expect("api" in entry).toBe(false);

        const provider = registry.resolve("dt");
        expect(entry.weakRef.deref()).toBe(provider);
        expect(capturedStore).toBeDefined();
        expect((capturedStore as any).__devToolsProviderApiHold).toBe(provider);
    });

    it("list() reports provider descriptor and availability", () => {
        const storage = createMockStorage();
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const registry = getRegistry();
        const list = registry.list();
        expect(list).toHaveLength(1);
        expect(list[0]!.namespace).toBe("dt");
        expect(list[0]!.available).toBe(true);
        expect(typeof list[0]!.registeredAt).toBe("number");
    });

    it("list() marks malformed or stale entries unavailable and stamps staleSince once", () => {
        const staleSinceBefore = null;
        (window as any).__REACT_MNEMONIC_DEVTOOLS__ = {
            providers: {
                malformed: {
                    namespace: "malformed",
                    weakRef: {},
                    registeredAt: 1,
                    lastSeenAt: 2,
                    staleSince: staleSinceBefore,
                },
            },
            capabilities: { weakRef: true, finalizationRegistry: true },
            __meta: { version: 0, lastUpdated: 0, lastChange: "" },
        };

        render(
            <MnemonicProvider namespace="dt" storage={createMockStorage()} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );

        const registry = getRegistry();
        const list = registry.list();
        const malformed = list.find((entry: any) => entry.namespace === "malformed");

        expect(malformed).toBeDefined();
        expect(malformed.available).toBe(false);
        expect(typeof malformed.staleSince).toBe("number");

        const stamped = malformed.staleSince;
        const listAgain = registry.list();
        const malformedAgain = listAgain.find((entry: any) => entry.namespace === "malformed");

        expect(malformedAgain.staleSince).toBe(stamped);
    });

    it("resolved devtools get returns decoded value", () => {
        const storage = createMockStorage();
        storage.store.set("dt.user", JSON.stringify({ name: "Alice" }));
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const devtools = getRegistry().resolve("dt");
        expect(devtools.get("user")).toEqual({ name: "Alice" });
    });

    it("resolved devtools get returns undefined for missing key", () => {
        render(
            <MnemonicProvider namespace="dt" storage={createMockStorage()} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const devtools = getRegistry().resolve("dt");
        expect(devtools.get("missing")).toBeUndefined();
    });

    it("resolved devtools get returns raw string for non-JSON values", () => {
        const storage = createMockStorage();
        storage.store.set("dt.plain", "not json");
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const devtools = getRegistry().resolve("dt");
        expect(devtools.get("plain")).toBe("not json");
    });

    it("resolved devtools set writes JSON-encoded value", () => {
        const storage = createMockStorage();
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const devtools = getRegistry().resolve("dt");
        devtools.set("theme", "dark");
        expect(storage.store.get("dt.theme")).toBe(JSON.stringify("dark"));
    });

    it("resolved devtools remove removes the key", () => {
        const storage = createMockStorage();
        storage.store.set("dt.k", "v");
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const devtools = getRegistry().resolve("dt");
        devtools.remove("k");
        expect(storage.store.has("dt.k")).toBe(false);
    });

    it("resolved devtools keys lists namespace keys", () => {
        const storage = createMockStorage();
        storage.store.set("dt.a", "1");
        storage.store.set("dt.b", "2");
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const devtools = getRegistry().resolve("dt");
        expect(devtools.keys()).toEqual(expect.arrayContaining(["a", "b"]));
    });

    it("resolved devtools clear removes all namespace keys", () => {
        const storage = createMockStorage();
        storage.store.set("dt.a", "1");
        storage.store.set("dt.b", "2");
        storage.store.set("other.c", "3");
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const devtools = getRegistry().resolve("dt");
        devtools.clear();
        expect(storage.store.has("dt.a")).toBe(false);
        expect(storage.store.has("dt.b")).toBe(false);
        // Other namespace untouched
        expect(storage.store.has("other.c")).toBe(true);
    });

    it("resolved devtools dump returns all key-value pairs", () => {
        const storage = createMockStorage();
        storage.store.set("dt.x", "10");
        storage.store.set("dt.y", "20");
        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const devtools = getRegistry().resolve("dt");
        const spy = vi.spyOn(console, "table").mockImplementation(() => {});
        const result = devtools.dump();
        expect(result).toEqual({ x: "10", y: "20" });
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it("resolved devtools dump falls back to the raw string when a value is not valid JSON", () => {
        const storage = createMockStorage();
        storage.store.set("dt.plain", "not json");

        render(
            <MnemonicProvider namespace="dt" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );

        const devtools = getRegistry().resolve("dt");
        const spy = vi.spyOn(console, "table").mockImplementation(() => {});

        const result = devtools.dump();

        expect(result).toEqual({ plain: "not json" });
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]?.[0]).toEqual([{ key: "plain", value: "not json", decoded: "not json" }]);

        spy.mockRestore();
    });

    it("resolved devtools getStore returns the store instance", () => {
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
        const devtools = getRegistry().resolve("dt");
        expect(devtools.getStore()).toBe(capturedStore!);
    });

    it("throws in non-production when duplicate namespace is registered and live", () => {
        setNodeEnv("development");
        const storageA = createMockStorage();
        const storageB = createMockStorage();
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const renderDuplicate = () =>
            render(
                <>
                    <MnemonicProvider namespace="dupe" storage={storageA} enableDevTools={true}>
                        <div />
                    </MnemonicProvider>
                    <MnemonicProvider namespace="dupe" storage={storageB} enableDevTools={true}>
                        <div />
                    </MnemonicProvider>
                </>,
            );
        expect(renderDuplicate).toThrow(/Duplicate provider namespace "dupe"/);
        errorSpy.mockRestore();
    });

    it("keeps first provider in production when duplicate namespace is registered", () => {
        setNodeEnv("production");
        const storageA = createMockStorage();
        const storageB = createMockStorage();
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        render(
            <>
                <MnemonicProvider namespace="dupe" storage={storageA} enableDevTools={true}>
                    <div />
                </MnemonicProvider>
                <MnemonicProvider namespace="dupe" storage={storageB} enableDevTools={true}>
                    <div />
                </MnemonicProvider>
            </>,
        );

        const provider = getRegistry().resolve("dupe");
        provider.set("k", "v");
        expect(storageA.store.get("dupe.k")).toBe(JSON.stringify("v"));
        expect(storageB.store.get("dupe.k")).toBeUndefined();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("treats missing NODE_ENV as production-safe for duplicate namespaces", () => {
        (globalThis as any).process = undefined;
        const storageA = createMockStorage();
        const storageB = createMockStorage();
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        expect(() =>
            render(
                <>
                    <MnemonicProvider namespace="dupe" storage={storageA} enableDevTools={true}>
                        <div />
                    </MnemonicProvider>
                    <MnemonicProvider namespace="dupe" storage={storageB} enableDevTools={true}>
                        <div />
                    </MnemonicProvider>
                </>,
            ),
        ).not.toThrow();

        const provider = getRegistry().resolve("dupe");
        provider.set("k", "v");
        expect(storageA.store.get("dupe.k")).toBe(JSON.stringify("v"));
        expect(storageB.store.get("dupe.k")).toBeUndefined();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("replaces stale namespace entries", () => {
        const fakeStaleEntry = {
            namespace: "stale",
            weakRef: { deref: () => undefined },
            registeredAt: 1,
            lastSeenAt: 1,
            staleSince: 1,
        };

        (window as any).__REACT_MNEMONIC_DEVTOOLS__ = {
            providers: { stale: fakeStaleEntry },
            capabilities: { weakRef: true, finalizationRegistry: true },
            __meta: { version: 0, lastUpdated: 0, lastChange: "" },
            resolve: (ns: string) => {
                const entry = (window as any).__REACT_MNEMONIC_DEVTOOLS__.providers[ns];
                return entry?.weakRef?.deref?.() ?? null;
            },
            list: () => [],
        };

        const storage = createMockStorage();
        render(
            <MnemonicProvider namespace="stale" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );

        const resolved = getRegistry().resolve("stale");
        expect(resolved).toBeTruthy();
        expect(getRegistry().providers.stale).not.toBe(fakeStaleEntry);
    });

    it("resolve(namespace) stamps staleSince when a previously registered weak ref no longer dereferences", () => {
        const staleEntry = {
            namespace: "stale",
            weakRef: { deref: () => undefined },
            registeredAt: 1,
            lastSeenAt: 2,
            staleSince: null,
        };

        (window as any).__REACT_MNEMONIC_DEVTOOLS__ = {
            providers: { stale: staleEntry },
            capabilities: { weakRef: true, finalizationRegistry: true },
            __meta: { version: 0, lastUpdated: 0, lastChange: "" },
        };

        render(
            <MnemonicProvider namespace="dt" storage={createMockStorage()} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );

        const registry = getRegistry();
        expect(registry.resolve("stale")).toBeNull();
        expect(typeof registry.providers.stale.staleSince).toBe("number");
    });

    it("cleans legacy direct namespace fields from existing registry object", () => {
        const legacyProvider = { get: () => "legacy" };
        (window as any).__REACT_MNEMONIC_DEVTOOLS__ = {
            demo: legacyProvider,
        };

        render(
            <MnemonicProvider namespace="dt" storage={createMockStorage()} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );

        const registry = getRegistry();
        expect(registry.demo).toBeUndefined();
        expect(registry.providers.dt).toBeDefined();
    });

    it("ignores undeletable legacy namespace fields when initializing the registry", () => {
        const root: Record<string, unknown> = {};
        Object.defineProperty(root, "demo", {
            configurable: false,
            enumerable: true,
            value: { get: () => "legacy" },
        });
        (window as any).__REACT_MNEMONIC_DEVTOOLS__ = root;

        expect(() =>
            render(
                <MnemonicProvider namespace="dt" storage={createMockStorage()} enableDevTools={true}>
                    <div />
                </MnemonicProvider>,
            ),
        ).not.toThrow();

        const registry = getRegistry();
        expect(registry.demo).toBeDefined();
        expect(registry.providers.dt).toBeDefined();
    });

    it("ignores delete failures for hostile legacy properties during devtools initialization", () => {
        const target: Record<string, unknown> = {
            demo: { get: () => "legacy" },
        };

        const hostileRoot = new Proxy(target, {
            getOwnPropertyDescriptor(obj, prop) {
                if (prop === "demo") {
                    return {
                        configurable: true,
                        enumerable: true,
                        value: obj.demo,
                        writable: true,
                    };
                }
                return Object.getOwnPropertyDescriptor(obj, prop);
            },
            deleteProperty(_obj, prop) {
                if (prop === "demo") {
                    throw new Error("delete blocked");
                }
                return true;
            },
        });

        (window as any).__REACT_MNEMONIC_DEVTOOLS__ = hostileRoot;

        expect(() =>
            render(
                <MnemonicProvider namespace="dt" storage={createMockStorage()} enableDevTools={true}>
                    <div />
                </MnemonicProvider>,
            ),
        ).not.toThrow();

        const registry = getRegistry();
        expect(registry.demo).toBeDefined();
        expect(registry.providers.dt).toBeDefined();
    });

    it("normalizes malformed __meta fields on an existing registry root", () => {
        (window as any).__REACT_MNEMONIC_DEVTOOLS__ = {
            providers: {},
            capabilities: {},
            __meta: {
                version: Number.NaN,
                lastUpdated: Number.POSITIVE_INFINITY,
                lastChange: 42,
            },
        };

        render(
            <MnemonicProvider namespace="dt" storage={createMockStorage()} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );

        const registry = getRegistry();
        expect(Number.isFinite(registry.__meta.version)).toBe(true);
        expect(registry.__meta.version).toBeGreaterThanOrEqual(1);
        expect(Number.isFinite(registry.__meta.lastUpdated)).toBe(true);
        expect(registry.__meta.lastChange).toBe("dt.registry:namespace-registered");
    });

    it("marks capabilities and skips provider registration when WeakRef is unavailable", () => {
        (globalThis as any).WeakRef = undefined;
        const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

        render(
            <MnemonicProvider namespace="no-weak" storage={createMockStorage()} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );

        const registry = getRegistry();
        expect(registry.capabilities.weakRef).toBe(false);
        expect(registry.resolve("no-weak")).toBeNull();
        expect(registry.list()).toEqual([]);
        expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('registry provider "no-weak" was not registered'));
        infoSpy.mockRestore();
    });

    it("skips provider registration if WeakRef becomes unavailable between root creation and registration", () => {
        let weakRefReads = 0;
        Object.defineProperty(globalThis, "WeakRef", {
            configurable: true,
            get() {
                weakRefReads += 1;
                return weakRefReads === 1 ? originalWeakRef : undefined;
            },
        });

        const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

        render(
            <MnemonicProvider namespace="weak-race" storage={createMockStorage()} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );

        const registry = getRegistry();
        expect(registry.capabilities.weakRef).toBe(true);
        expect(registry.resolve("weak-race")).toBeNull();
        expect(registry.providers["weak-race"]).toBeUndefined();
        expect(infoSpy).toHaveBeenCalledWith(
            expect.stringContaining('WeakRef became unavailable while registering "weak-race"'),
        );

        infoSpy.mockRestore();
    });

    it("bumps __meta.version for register and mutation events", () => {
        const storage = createMockStorage();
        render(
            <MnemonicProvider namespace="versioned" storage={storage} enableDevTools={true}>
                <div />
            </MnemonicProvider>,
        );
        const registry = getRegistry();
        const initial = registry.__meta.version;
        const provider = registry.resolve("versioned");
        provider.set("alpha", "1");
        provider.remove("alpha");
        expect(registry.__meta.version).toBeGreaterThan(initial + 1);
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

    it("granular reload treats storage read errors as a null snapshot and notifies listeners of the change", () => {
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
        expect(store!.getRawSnapshot("a")).toBe("1");

        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        storage.getItem = () => {
            throw new DOMException("blocked", "SecurityError");
        };

        storage.triggerExternalChange(["ns.a"]);

        expect(listenerA).toHaveBeenCalledTimes(1);
        expect(store!.getRawSnapshot("a")).toBeNull();
        expect(spy).toHaveBeenCalledWith(expect.stringContaining("Storage access error (SecurityError)"));

        spy.mockRestore();
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

    it("blanket reload treats storage access errors as a null snapshot and notifies listeners of the change", () => {
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
        expect(store!.getRawSnapshot("a")).toBe("1");

        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        storage.getItem = () => {
            throw new DOMException("blocked", "SecurityError");
        };

        storage.triggerExternalChange(undefined);

        expect(listenerA).toHaveBeenCalledTimes(1);
        expect(store!.getRawSnapshot("a")).toBeNull();
        expect(spy).toHaveBeenCalledWith(expect.stringContaining("Storage access error (SecurityError)"));

        spy.mockRestore();
    });
});
