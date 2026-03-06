// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { MnemonicProvider } from "./provider";
import { useMnemonicKey } from "./use";
import { useMnemonicRecovery } from "./recovery";
import type { StorageLike } from "./types";

function createEnumerableStorage(): StorageLike & { store: Map<string, string> } {
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
        key: (index: number) => Array.from(store.keys())[index] ?? null,
    };
}

function createNonEnumerableStorage(): StorageLike & { store: Map<string, string> } {
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
    };
}

function env<T>(payload: T, version = 0): string {
    return JSON.stringify({ version, payload: JSON.stringify(payload) });
}

function renderHook<T>(
    storage: StorageLike,
    namespace: string,
    hook: () => T,
): {
    result: { current: T };
    unmount: () => void;
} {
    const resultRef = { current: undefined as T };

    function TestComponent() {
        resultRef.current = hook();
        return null;
    }

    const { unmount } = render(
        <MnemonicProvider namespace={namespace} storage={storage}>
            <TestComponent />
        </MnemonicProvider>,
    );

    return { result: resultRef, unmount };
}

describe("useMnemonicRecovery", () => {
    it("clears all keys in the current namespace and leaves other namespaces alone", () => {
        const storage = createEnumerableStorage();
        storage.store.set("app.theme", env("dark"));
        storage.store.set("app.count", env(3));
        storage.store.set("other.theme", env("blue"));

        const { result } = renderHook(storage, "app", () => ({
            theme: useMnemonicKey("theme", { defaultValue: "light" }),
            count: useMnemonicKey("count", { defaultValue: 0 }),
            recovery: useMnemonicRecovery(),
        }));

        expect(result.current.recovery.canEnumerateKeys).toBe(true);
        expect(result.current.recovery.listKeys().sort()).toEqual(["count", "theme"]);
        expect(result.current.theme.value).toBe("dark");
        expect(result.current.count.value).toBe(3);

        let cleared: string[] = [];
        act(() => {
            cleared = result.current.recovery.clearAll();
        });

        expect(cleared.sort()).toEqual(["count", "theme"]);
        expect(result.current.theme.value).toBe("light");
        expect(result.current.count.value).toBe(0);
        expect(storage.store.has("app.theme")).toBe(false);
        expect(storage.store.has("app.count")).toBe(false);
        expect(storage.store.has("other.theme")).toBe(true);
    });

    it("clears only matching keys when using a predicate", () => {
        const storage = createEnumerableStorage();
        storage.store.set("app.filters.query", env("react"));
        storage.store.set("app.filters.sort", env("alpha"));
        storage.store.set("app.theme", env("dark"));

        const { result } = renderHook(storage, "app", () => ({
            query: useMnemonicKey("filters.query", { defaultValue: "" }),
            sort: useMnemonicKey("filters.sort", { defaultValue: "recent" }),
            theme: useMnemonicKey("theme", { defaultValue: "light" }),
            recovery: useMnemonicRecovery(),
        }));

        let cleared: string[] = [];
        act(() => {
            cleared = result.current.recovery.clearMatching((key) => key.startsWith("filters."));
        });

        expect(cleared.sort()).toEqual(["filters.query", "filters.sort"]);
        expect(result.current.query.value).toBe("");
        expect(result.current.sort.value).toBe("recent");
        expect(result.current.theme.value).toBe("dark");
        expect(storage.store.has("app.theme")).toBe(true);
    });

    it("supports explicit key clearing for non-enumerable storage backends", () => {
        const storage = createNonEnumerableStorage();
        storage.store.set("app.theme", env("dark"));
        storage.store.set("app.sidebar", env(true));

        const { result } = renderHook(storage, "app", () => ({
            theme: useMnemonicKey("theme", { defaultValue: "light" }),
            sidebar: useMnemonicKey("sidebar", { defaultValue: false }),
            recovery: useMnemonicRecovery(),
        }));

        expect(result.current.recovery.canEnumerateKeys).toBe(false);
        expect(result.current.recovery.listKeys()).toEqual([]);
        expect(() => result.current.recovery.clearAll()).toThrow(/enumerable storage backend/);
        expect(() => result.current.recovery.clearMatching(() => true)).toThrow(/enumerable storage backend/);

        let cleared: string[] = [];
        act(() => {
            cleared = result.current.recovery.clearKeys(["theme", "sidebar", "theme"]);
        });

        expect(cleared.sort()).toEqual(["sidebar", "theme"]);
        expect(result.current.theme.value).toBe("light");
        expect(result.current.sidebar.value).toBe(false);
    });

    it("emits recovery events after successful actions", () => {
        const storage = createEnumerableStorage();
        storage.store.set("app.theme", env("dark"));
        storage.store.set("app.count", env(3));
        const onRecover = vi.fn();

        const { result } = renderHook(storage, "app", () =>
            useMnemonicRecovery({
                onRecover,
            }),
        );

        act(() => {
            result.current.clearMatching((key) => key === "theme");
        });

        expect(onRecover).toHaveBeenCalledWith({
            action: "clear-matching",
            namespace: "app",
            clearedKeys: ["theme"],
        });
    });
});
