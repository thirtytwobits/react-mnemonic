// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

// @vitest-environment node

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MnemonicProvider } from "./provider";
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

/** Helper to render MnemonicProvider with children via createElement. */
function ssrRender(props: { namespace: string; storage?: StorageLike }, child: React.ReactElement): string {
    return renderToString(React.createElement(MnemonicProvider, { ...props, children: child }));
}

// ---------------------------------------------------------------------------
// SSR Integration Tests
// ---------------------------------------------------------------------------

describe("SSR integration (node environment)", () => {
    it("window is undefined in this environment", () => {
        expect(typeof window).toBe("undefined");
    });

    it("renderToString produces HTML with the default value", () => {
        function Counter() {
            const { value } = useMnemonicKey("count", { defaultValue: 42 });
            return React.createElement("span", { "data-testid": "count" }, String(value));
        }

        const html = ssrRender({ namespace: "ssr" }, React.createElement(Counter));
        expect(html).toContain("42");
    });

    it("renderToString uses default even when storage has a value", () => {
        const storage = createMockStorage();
        storage.store.set("ssr.theme", JSON.stringify({ version: 0, payload: JSON.stringify("dark") }));

        function Theme() {
            const { value } = useMnemonicKey("theme", {
                defaultValue: "light",
            });
            return React.createElement("span", null, value);
        }

        const html = ssrRender({ namespace: "ssr", storage }, React.createElement(Theme));

        // Server snapshot is always null, so the default is used
        // even though storage has "dark". This is the SSR contract:
        // the server renders with the default, client hydrates and
        // may update once storage is read.
        expect(html).toContain("light");
    });

    it("renderToString does not throw with listenCrossTab enabled", () => {
        function Theme() {
            const { value } = useMnemonicKey("theme", {
                defaultValue: "light",
                listenCrossTab: true,
            });
            return React.createElement("span", null, value);
        }

        expect(() => ssrRender({ namespace: "ssr" }, React.createElement(Theme))).not.toThrow();
    });

    it("MnemonicProvider without explicit storage defaults gracefully in SSR", () => {
        function Display() {
            const { value } = useMnemonicKey("key", { defaultValue: "fallback" });
            return React.createElement("div", null, value);
        }

        // No storage prop — defaultBrowserStorage() returns undefined in node
        const html = ssrRender({ namespace: "ssr-no-storage" }, React.createElement(Display));

        expect(html).toContain("fallback");
    });

    it("renderToString with multiple keys all use defaults", () => {
        const storage = createMockStorage();
        storage.store.set("ssr.a", JSON.stringify("A-stored"));
        storage.store.set("ssr.b", JSON.stringify("B-stored"));

        function Multi() {
            const a = useMnemonicKey("a", { defaultValue: "A-default" });
            const b = useMnemonicKey("b", { defaultValue: "B-default" });
            return React.createElement(
                "div",
                null,
                React.createElement("span", { id: "a" }, a.value),
                React.createElement("span", { id: "b" }, b.value),
            );
        }

        const html = ssrRender({ namespace: "ssr", storage }, React.createElement(Multi));

        expect(html).toContain("A-default");
        expect(html).toContain("B-default");
        expect(html).not.toContain("A-stored");
        expect(html).not.toContain("B-stored");
    });

    it("renderToString with factory defaultValue calls the factory", () => {
        let factoryCalled = false;
        function FactoryComp() {
            const { value } = useMnemonicKey("dynamic", {
                defaultValue: () => {
                    factoryCalled = true;
                    return { ts: 0 };
                },
            });
            return React.createElement("span", null, JSON.stringify(value));
        }

        const html = ssrRender({ namespace: "ssr" }, React.createElement(FactoryComp));

        expect(factoryCalled).toBe(true);
        // renderToString HTML-encodes quotes: {"ts":0} → {&quot;ts&quot;:0}
        expect(html).toContain("{&quot;ts&quot;:0}");
    });
});
