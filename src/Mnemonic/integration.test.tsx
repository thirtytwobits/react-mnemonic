// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MnemonicProvider, useMnemonic } from "./provider";
import { useMnemonicKey } from "./use";
import type { StorageLike } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function env(payload: string, version = 0): string {
    return JSON.stringify({ version, payload });
}

/**
 * Renders a hook inside a MnemonicProvider and captures both the hook result
 * and the underlying store API for direct manipulation.
 */
function renderHookWithStore<T>(
    storage: ReturnType<typeof createMockStorage>,
    namespace: string,
    hook: () => T,
): {
    result: { current: T };
    store: { current: ReturnType<typeof useMnemonic> };
    unmount: () => void;
} {
    const resultRef = { current: undefined as T };
    const storeRef = { current: undefined as unknown as ReturnType<typeof useMnemonic> };

    function TestComponent() {
        const api = useMnemonic();
        storeRef.current = api;
        resultRef.current = hook();
        return null;
    }

    const { unmount } = render(
        <MnemonicProvider namespace={namespace} storage={storage}>
            <TestComponent />
        </MnemonicProvider>,
    );

    return { result: resultRef, store: storeRef, unmount };
}

// ============================================================================
// useSyncExternalStore – Snapshot Stability
// ============================================================================

describe("useSyncExternalStore – snapshot stability", () => {
    let storage: ReturnType<typeof createMockStorage>;

    beforeEach(() => {
        storage = createMockStorage();
    });

    it("getRawSnapshot returns same value on repeated calls without mutation", () => {
        const { store } = renderHookWithStore(storage, "ns", () => useMnemonicKey("key", { defaultValue: "x" }));
        const snap1 = store.current.getRawSnapshot("key");
        const snap2 = store.current.getRawSnapshot("key");
        const snap3 = store.current.getRawSnapshot("key");
        expect(snap1).toBe(snap2);
        expect(snap2).toBe(snap3);
    });

    it("getRawSnapshot returns different value after mutation", () => {
        const { store } = renderHookWithStore(storage, "ns", () => useMnemonicKey("key", { defaultValue: "x" }));
        const snap1 = store.current.getRawSnapshot("key");
        store.current.setRaw("key", env("changed"));
        const snap2 = store.current.getRawSnapshot("key");
        expect(snap1).not.toBe(snap2);
        expect(snap2).toBe(env("changed"));
    });

    it("decoded value is referentially stable when raw does not change", () => {
        const values: unknown[] = [];
        function Capturer() {
            const { value } = useMnemonicKey("obj", {
                defaultValue: { n: 1 },
            });
            values.push(value);
            return null;
        }
        const { unmount } = render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <Capturer />
            </MnemonicProvider>,
        );
        // React may render more than once (StrictMode double-render, etc.)
        // but all renders without a mutation should yield the same reference.
        const unique = new Set(values.map((v) => v));
        expect(unique.size).toBe(1);
        unmount();
    });
});

// ============================================================================
// useSyncExternalStore – External Mutations
// ============================================================================

describe("useSyncExternalStore – external mutations", () => {
    let storage: ReturnType<typeof createMockStorage>;

    beforeEach(() => {
        storage = createMockStorage();
    });

    it("component re-renders when store.setRaw is called directly", () => {
        let renderCount = 0;
        function Counter() {
            const { value } = useMnemonicKey("count", { defaultValue: 0 });
            renderCount++;
            return <div data-testid="count">{value}</div>;
        }
        let storeApi: ReturnType<typeof useMnemonic>;
        function StoreCapture() {
            storeApi = useMnemonic();
            return null;
        }
        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <StoreCapture />
                <Counter />
            </MnemonicProvider>,
        );
        const initialRenders = renderCount;

        act(() => {
            storeApi.setRaw("count", env(JSON.stringify(42)));
        });

        expect(renderCount).toBeGreaterThan(initialRenders);
    });

    it("component shows new value after direct setRaw", () => {
        const { result, store } = renderHookWithStore(storage, "ns", () =>
            useMnemonicKey("val", { defaultValue: "init" }),
        );
        expect(result.current.value).toBe("init");

        act(() => {
            store.current.setRaw("val", env(JSON.stringify("external")));
        });

        expect(result.current.value).toBe("external");
    });

    it("component falls back to default after direct removeRaw", () => {
        storage.store.set("ns.val", env(JSON.stringify("stored")));
        const { result, store } = renderHookWithStore(storage, "ns", () =>
            useMnemonicKey("val", { defaultValue: "default" }),
        );
        expect(result.current.value).toBe("stored");

        act(() => {
            store.current.removeRaw("val");
        });

        expect(result.current.value).toBe("default");
    });

    it("onChange fires from direct external mutation", () => {
        const onChange = vi.fn();
        const { store } = renderHookWithStore(storage, "ns", () =>
            useMnemonicKey("val", { defaultValue: "a", onChange }),
        );

        act(() => {
            store.current.setRaw("val", env(JSON.stringify("b")));
        });

        expect(onChange).toHaveBeenCalledWith("b", "a");
    });

    it("onMount does NOT re-fire after external mutation", () => {
        const onMount = vi.fn();
        const { store } = renderHookWithStore(storage, "ns", () =>
            useMnemonicKey("val", { defaultValue: "init", onMount }),
        );
        expect(onMount).toHaveBeenCalledTimes(1);

        act(() => {
            store.current.setRaw("val", env(JSON.stringify("new")));
        });

        // onMount should still have been called only once
        expect(onMount).toHaveBeenCalledTimes(1);
    });
});

// ============================================================================
// useSyncExternalStore – Tearing Prevention
// ============================================================================

describe("useSyncExternalStore – tearing prevention", () => {
    let storage: ReturnType<typeof createMockStorage>;

    beforeEach(() => {
        storage = createMockStorage();
    });

    it("two components reading the same key see consistent values during render", () => {
        storage.store.set("ns.shared", env(JSON.stringify(42)));
        let v1: number | undefined;
        let v2: number | undefined;

        function C1() {
            const { value } = useMnemonicKey("shared", { defaultValue: 0 });
            v1 = value;
            return null;
        }
        function C2() {
            const { value } = useMnemonicKey("shared", { defaultValue: 0 });
            v2 = value;
            return null;
        }

        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <C1 />
                <C2 />
            </MnemonicProvider>,
        );

        expect(v1).toBe(42);
        expect(v2).toBe(42);
        expect(v1).toBe(v2);
    });

    it("after mutation, both components converge to the new value", () => {
        let v1: number | undefined;
        let v2: number | undefined;
        let storeApi: ReturnType<typeof useMnemonic>;

        function C1() {
            const { value } = useMnemonicKey("shared", { defaultValue: 0 });
            v1 = value;
            return null;
        }
        function C2() {
            const { value } = useMnemonicKey("shared", { defaultValue: 0 });
            v2 = value;
            return null;
        }
        function Capture() {
            storeApi = useMnemonic();
            return null;
        }

        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <Capture />
                <C1 />
                <C2 />
            </MnemonicProvider>,
        );

        expect(v1).toBe(0);
        expect(v2).toBe(0);

        act(() => {
            storeApi.setRaw("shared", env(JSON.stringify(99)));
        });

        expect(v1).toBe(99);
        expect(v2).toBe(99);
    });
});

// ============================================================================
// useSyncExternalStore – Rapid Mutations
// ============================================================================

describe("useSyncExternalStore – rapid mutations", () => {
    let storage: ReturnType<typeof createMockStorage>;

    beforeEach(() => {
        storage = createMockStorage();
    });

    it("rapid sequential setRaw calls settle to the final value", () => {
        const { result, store } = renderHookWithStore(storage, "ns", () =>
            useMnemonicKey("count", { defaultValue: 0 }),
        );

        act(() => {
            for (let i = 1; i <= 100; i++) {
                store.current.setRaw("count", env(JSON.stringify(i)));
            }
        });

        expect(result.current.value).toBe(100);
    });

    it("rapid set() via hook settle to the final value", () => {
        const { result } = renderHookWithStore(storage, "ns", () => useMnemonicKey("count", { defaultValue: 0 }));

        act(() => {
            for (let i = 1; i <= 50; i++) {
                result.current.set(i);
            }
        });

        expect(result.current.value).toBe(50);
    });

    it("rapid updater functions accumulate correctly", () => {
        const { result } = renderHookWithStore(storage, "ns", () => useMnemonicKey("count", { defaultValue: 0 }));

        act(() => {
            for (let i = 0; i < 10; i++) {
                result.current.set((c) => c + 1);
            }
        });

        expect(result.current.value).toBe(10);
    });
});

// ============================================================================
// Cross-Tab Sync – Listener Lifecycle
// ============================================================================

describe("cross-tab sync – listener lifecycle", () => {
    let storage: ReturnType<typeof createMockStorage>;
    let addSpy: ReturnType<typeof vi.spyOn>;
    let removeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        storage = createMockStorage();
        addSpy = vi.spyOn(window, "addEventListener");
        removeSpy = vi.spyOn(window, "removeEventListener");
    });

    afterEach(() => {
        addSpy.mockRestore();
        removeSpy.mockRestore();
    });

    it("addEventListener is called on mount when listenCrossTab is true", () => {
        renderHookWithStore(storage, "ns", () =>
            useMnemonicKey("key", {
                defaultValue: "x",
                listenCrossTab: true,
            }),
        );

        expect(addSpy).toHaveBeenCalledWith("storage", expect.any(Function));
    });

    it("addEventListener is NOT called when listenCrossTab is false", () => {
        renderHookWithStore(storage, "ns", () =>
            useMnemonicKey("key", {
                defaultValue: "x",
                listenCrossTab: false,
            }),
        );

        const storageCalls = addSpy.mock.calls.filter((c) => c[0] === "storage");
        expect(storageCalls).toHaveLength(0);
    });

    it("removeEventListener is called on unmount", () => {
        const { unmount } = renderHookWithStore(storage, "ns", () =>
            useMnemonicKey("key", {
                defaultValue: "x",
                listenCrossTab: true,
            }),
        );

        unmount();

        expect(removeSpy).toHaveBeenCalledWith("storage", expect.any(Function));
    });

    it("the same handler reference is used for add and remove", () => {
        const { unmount } = renderHookWithStore(storage, "ns", () =>
            useMnemonicKey("key", {
                defaultValue: "x",
                listenCrossTab: true,
            }),
        );

        const addCall = addSpy.mock.calls.find((c) => c[0] === "storage");
        const addedHandler = addCall?.[1];

        unmount();

        const removeCall = removeSpy.mock.calls.find((c) => c[0] === "storage");
        const removedHandler = removeCall?.[1];

        expect(addedHandler).toBe(removedHandler);
    });
});

// ============================================================================
// Cross-Tab Sync – Data Flow Integration
// ============================================================================

describe("cross-tab sync – data flow integration", () => {
    let storage: ReturnType<typeof createMockStorage>;

    beforeEach(() => {
        storage = createMockStorage();
    });

    it("onChange fires when a storage event updates the value", () => {
        const onChange = vi.fn();
        renderHookWithStore(storage, "ns", () =>
            useMnemonicKey("theme", {
                defaultValue: "light",
                listenCrossTab: true,
                onChange,
            }),
        );

        act(() => {
            window.dispatchEvent(
                new StorageEvent("storage", { key: "ns.theme", newValue: env(JSON.stringify("dark")) }),
            );
        });

        expect(onChange).toHaveBeenCalledWith("dark", "light");
    });

    it("codec decoding applies to incoming cross-tab raw values", () => {
        const { result } = renderHookWithStore(storage, "ns", () =>
            useMnemonicKey("count", {
                defaultValue: 0,
                listenCrossTab: true,
            }),
        );

        act(() => {
            window.dispatchEvent(new StorageEvent("storage", { key: "ns.count", newValue: env("42") }));
        });

        // JSONCodec decodes "42" → 42
        expect(result.current.value).toBe(42);
        expect(typeof result.current.value).toBe("number");
    });

    it("corrupt incoming value falls back to default", () => {
        const { result } = renderHookWithStore(storage, "ns", () =>
            useMnemonicKey("count", {
                defaultValue: 0,
                listenCrossTab: true,
            }),
        );

        act(() => {
            window.dispatchEvent(new StorageEvent("storage", { key: "ns.count", newValue: env("not-a-number") }));
        });

        // JSONCodec throws for "not-a-number", fallback to default
        expect(result.current.value).toBe(0);
    });

    it("wrong namespace prefix is ignored", () => {
        const { result } = renderHookWithStore(storage, "ns", () =>
            useMnemonicKey("theme", {
                defaultValue: "light",
                listenCrossTab: true,
            }),
        );

        act(() => {
            window.dispatchEvent(
                new StorageEvent("storage", {
                    key: "other-ns.theme",
                    newValue: env(JSON.stringify("dark")),
                }),
            );
        });

        expect(result.current.value).toBe("light");
    });

    it("rapid sequential storage events settle to the final value", () => {
        const onChange = vi.fn();
        const { result } = renderHookWithStore(storage, "ns", () =>
            useMnemonicKey("count", {
                defaultValue: 0,
                listenCrossTab: true,
                onChange,
            }),
        );

        act(() => {
            for (let i = 1; i <= 10; i++) {
                window.dispatchEvent(
                    new StorageEvent("storage", {
                        key: "ns.count",
                        newValue: env(String(i)),
                    }),
                );
            }
        });

        expect(result.current.value).toBe(10);
    });

    it("multiple components sync when a storage event arrives", () => {
        let v1: string | undefined;
        let v2: string | undefined;

        function C1() {
            const { value } = useMnemonicKey("shared", {
                defaultValue: "a",
                listenCrossTab: true,
            });
            v1 = value;
            return null;
        }
        function C2() {
            const { value } = useMnemonicKey("shared", {
                defaultValue: "a",
                listenCrossTab: true,
            });
            v2 = value;
            return null;
        }

        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <C1 />
                <C2 />
            </MnemonicProvider>,
        );

        expect(v1).toBe("a");
        expect(v2).toBe("a");

        act(() => {
            window.dispatchEvent(new StorageEvent("storage", { key: "ns.shared", newValue: env(JSON.stringify("b")) }));
        });

        expect(v1).toBe("b");
        expect(v2).toBe("b");
    });

    it("storage event after unmount does not cause errors", () => {
        const { unmount } = renderHookWithStore(storage, "ns", () =>
            useMnemonicKey("theme", {
                defaultValue: "light",
                listenCrossTab: true,
            }),
        );

        unmount();

        // Should not throw after the component is unmounted
        expect(() => {
            window.dispatchEvent(
                new StorageEvent("storage", { key: "ns.theme", newValue: env(JSON.stringify("dark")) }),
            );
        }).not.toThrow();
    });

    it("simulates full Tab A write → Tab B read flow", () => {
        // Tab B: component listening for cross-tab updates
        const onChangeTabB = vi.fn();
        const { result: tabBResult } = renderHookWithStore(storage, "ns", () =>
            useMnemonicKey("data", {
                defaultValue: "initial",
                listenCrossTab: true,
                onChange: onChangeTabB,
            }),
        );
        expect(tabBResult.current.value).toBe("initial");

        // Tab A: writes "updated" to storage (simulated by direct storage write + event)
        act(() => {
            storage.store.set("ns.data", env(JSON.stringify("updated")));
            window.dispatchEvent(
                new StorageEvent("storage", {
                    key: "ns.data",
                    oldValue: null,
                    newValue: env(JSON.stringify("updated")),
                }),
            );
        });

        // Tab B: receives the update
        expect(tabBResult.current.value).toBe("updated");
        expect(onChangeTabB).toHaveBeenCalledWith("updated", "initial");
    });
});
