// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

// @vitest-environment node

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MnemonicProvider } from "./provider";
import { useMnemonicKey } from "./use";
import { defineMnemonicKey } from "./key";
import type { StorageLike, KeySchema, MigrationRule, SchemaRegistry } from "./types";

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
function ssrRender(
    props: {
        namespace: string;
        storage?: StorageLike;
        schemaMode?: "default" | "strict" | "autoschema";
        schemaRegistry?: SchemaRegistry;
        enableDevTools?: boolean;
        ssr?: {
            hydration?: "immediate" | "client-only";
        };
    },
    child: React.ReactElement,
): string {
    return renderToString(React.createElement(MnemonicProvider, { ...props, children: child }));
}

function env(payload: string, version = 0): string {
    return JSON.stringify({ version, payload });
}

function schemaEnv(payload: unknown, version: number): string {
    return JSON.stringify({ version, payload });
}

function createRegistry(schemas: KeySchema[] = [], rules: MigrationRule[] = []): SchemaRegistry {
    const schemaMap = new Map<string, KeySchema>();
    for (const schema of schemas) {
        schemaMap.set(`${schema.key}:${schema.version}`, schema);
    }
    const ruleMap = new Map<string, MigrationRule[]>();
    for (const rule of rules) {
        const existing = ruleMap.get(rule.key) ?? [];
        existing.push(rule);
        ruleMap.set(rule.key, existing);
    }
    return {
        getSchema(key, version) {
            return schemaMap.get(`${key}:${version}`);
        },
        getLatestSchema(key) {
            const candidates = Array.from(schemaMap.values()).filter((schema) => schema.key === key);
            if (candidates.length === 0) return undefined;
            return candidates.sort((a, b) => b.version - a.version)[0];
        },
        getMigrationPath(key, fromVersion, toVersion) {
            const byKey = ruleMap.get(key) ?? [];
            const path: MigrationRule[] = [];
            let current = fromVersion;
            while (current < toVersion) {
                const next = byKey.find((rule) => rule.fromVersion === current && rule.toVersion > current);
                if (!next) return null;
                path.push(next);
                current = next.toVersion;
            }
            return path;
        },
    };
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

        // Default SSR snapshot is null, so the default is used
        // even though storage has "dark". This is the SSR contract:
        // the server renders with the default, client hydrates and
        // may update once storage is read.
        expect(html).toContain("light");
    });

    it("renderToString can use an explicit serverValue", () => {
        const storage = createMockStorage();
        storage.store.set("ssr.theme", JSON.stringify({ version: 0, payload: JSON.stringify("dark") }));

        function Theme() {
            const { value } = useMnemonicKey("theme", {
                defaultValue: "light" as "light" | "dark" | "system",
                ssr: {
                    serverValue: "system",
                },
            });
            return React.createElement("span", null, value);
        }

        const html = ssrRender({ namespace: "ssr", storage }, React.createElement(Theme));

        expect(html).toContain("system");
        expect(html).not.toContain("dark");
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

    it("renderToString supports descriptor-based keys", () => {
        const themeKey = defineMnemonicKey("theme", {
            defaultValue: "light" as "light" | "dark",
        });

        function Theme() {
            const { value } = useMnemonicKey(themeKey);
            return React.createElement("span", null, value);
        }

        const html = ssrRender({ namespace: "ssr" }, React.createElement(Theme));
        expect(html).toContain("light");
    });

    it("renderToString ignores schema-managed stored values and renders defaults on the server", () => {
        const storage = createMockStorage();
        const registry = createRegistry([
            {
                key: "profile",
                version: 1,
                schema: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                    },
                    required: ["name"],
                    additionalProperties: false,
                },
            },
        ]);

        storage.store.set("ssr.profile", schemaEnv({ name: "Ada" }, 1));

        function Profile() {
            const { value } = useMnemonicKey("profile", {
                defaultValue: { name: "Guest" },
            });
            return React.createElement("span", null, value.name);
        }

        const html = ssrRender(
            {
                namespace: "ssr",
                storage,
                schemaMode: "default",
                schemaRegistry: registry,
            },
            React.createElement(Profile),
        );

        expect(html).toContain("Guest");
        expect(html).not.toContain("Ada");
    });

    it("renderToString does not run reconcile on the server", () => {
        const storage = createMockStorage();
        storage.store.set("ssr.preferences", env(JSON.stringify({ theme: "dark" })));

        let reconcileCalled = false;

        function Preferences() {
            const { value } = useMnemonicKey("preferences", {
                defaultValue: { theme: "light" },
                reconcile: () => {
                    reconcileCalled = true;
                    return { theme: "dark" };
                },
            });
            return React.createElement("span", null, value.theme);
        }

        const html = ssrRender({ namespace: "ssr", storage }, React.createElement(Preferences));

        expect(html).toContain("light");
        expect(reconcileCalled).toBe(false);
    });

    it("renderToString ignores invalid stored envelopes and calls defaultValue factory without an error", () => {
        const storage = createMockStorage();
        storage.store.set("ssr.counter", "{ definitely-not-json");

        let receivedError: unknown = Symbol("unassigned");

        function Counter() {
            const { value } = useMnemonicKey("counter", {
                defaultValue: (error) => {
                    receivedError = error;
                    return 0;
                },
            });
            return React.createElement("span", null, String(value));
        }

        const html = ssrRender({ namespace: "ssr", storage }, React.createElement(Counter));

        expect(html).toContain("0");
        expect(receivedError).toBeUndefined();
    });

    it("renderToString does not touch window when enableDevTools is true", () => {
        function Display() {
            const { value } = useMnemonicKey("key", { defaultValue: "fallback" });
            return React.createElement("div", null, value);
        }

        expect(() =>
            ssrRender(
                {
                    namespace: "ssr-devtools",
                    enableDevTools: true,
                },
                React.createElement(Display),
            ),
        ).not.toThrow();
    });
});
