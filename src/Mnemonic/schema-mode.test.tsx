// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect, vi } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MnemonicProvider } from "./provider";
import { useMnemonicKey } from "./use";
import { SchemaError } from "./schema";
import type { StorageLike, KeySchema, MigrationRule, SchemaRegistry } from "./types";

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
    };
}

/** Codec-managed envelope: payload is a string (codec-encoded). */
function env(payload: string, version = 0): string {
    return JSON.stringify({ version, payload });
}

/** Schema-managed envelope: payload is a JSON value directly. */
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
        const key = rule.key;
        const existing = ruleMap.get(key) ?? [];
        existing.push(rule);
        ruleMap.set(key, existing);
    }
    return {
        getSchema(key, version) {
            return schemaMap.get(`${key}:${version}`);
        },
        getLatestSchema(key) {
            const candidates = Array.from(schemaMap.values()).filter((s) => s.key === key);
            if (candidates.length === 0) return undefined;
            return candidates.sort((a, b) => b.version - a.version)[0];
        },
        getMigrationPath(key, fromVersion, toVersion) {
            const byKey = ruleMap.get(key) ?? [];
            const path: MigrationRule[] = [];
            let cur = fromVersion;
            while (cur < toVersion) {
                const next = byKey.find((r) => r.fromVersion === cur && r.toVersion > cur);
                if (!next) return null;
                path.push(next);
                cur = next.toVersion;
            }
            return path;
        },
        getWriteMigration(key, version) {
            const byKey = ruleMap.get(key) ?? [];
            return byKey.find((r) => r.fromVersion === version && r.toVersion === version);
        },
        registerSchema(schema) {
            const id = `${schema.key}:${schema.version}`;
            if (schemaMap.has(id)) {
                throw new Error("schema already exists");
            }
            schemaMap.set(id, schema);
        },
    };
}

function renderHook<T>(ui: () => T, providerProps: Omit<ComponentProps<typeof MnemonicProvider>, "children">) {
    const resultRef: { current: T } = { current: undefined as T };
    function TestComponent() {
        resultRef.current = ui();
        return null;
    }
    render(
        <MnemonicProvider {...providerProps}>
            <TestComponent />
        </MnemonicProvider>,
    );
    return resultRef;
}

describe("schema mode behavior", () => {
    it("strict mode requires schemaRegistry", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() =>
            render(
                <MnemonicProvider namespace="ns" schemaMode="strict">
                    <div />
                </MnemonicProvider>,
            ),
        ).toThrow("strict mode requires schemaRegistry");
        spy.mockRestore();
    });

    it("default mode without schema writes version 0 envelope", () => {
        const storage = createMockStorage();
        const result = renderHook(
            () =>
                useMnemonicKey("count", {
                    defaultValue: 0,
                }),
            {
                namespace: "ns",
                storage,
                schemaMode: "default",
            },
        );
        act(() => {
            result.current.set(7);
        });
        // No schema → codec path → payload is JSON.stringify(7) = "7"
        expect(storage.store.get("ns.count")).toBe(env("7", 0));
    });

    it("default mode uses latest schema when registered", () => {
        const storage = createMockStorage();
        const registry = createRegistry([
            { key: "count", version: 1, schema: { type: "number" } },
            { key: "count", version: 3, schema: { type: "number" } },
        ]);
        const result = renderHook(
            () =>
                useMnemonicKey("count", {
                    defaultValue: 0,
                }),
            {
                namespace: "ns",
                storage,
                schemaMode: "default",
                schemaRegistry: registry,
            },
        );
        act(() => {
            result.current.set(7);
        });
        // Schema-managed → payload is JSON value directly
        expect(storage.store.get("ns.count")).toBe(schemaEnv(7, 3));
    });

    it("strict mode writes version 0 when no schemas are registered", () => {
        const storage = createMockStorage();
        const registry = createRegistry();
        const result = renderHook(
            () =>
                useMnemonicKey("count", {
                    defaultValue: 0,
                }),
            {
                namespace: "ns",
                storage,
                schemaMode: "strict",
                schemaRegistry: registry,
            },
        );
        act(() => {
            result.current.set(11);
        });
        // No schema → codec path → version 0
        expect(storage.store.get("ns.count")).toBe(env("11", 0));
    });

    it("strict mode reads and writes with registered schema version", () => {
        const storage = createMockStorage();
        const registry = createRegistry([{ key: "count", version: 2, schema: { type: "number" } }]);
        // Schema-managed envelope: payload is JSON value
        storage.store.set("ns.count", schemaEnv(5, 2));

        const result = renderHook(
            () =>
                useMnemonicKey("count", {
                    defaultValue: 0,
                }),
            {
                namespace: "ns",
                storage,
                schemaMode: "strict",
                schemaRegistry: registry,
            },
        );

        expect(result.current.value).toBe(5);
        act(() => {
            result.current.set(9);
        });
        expect(storage.store.get("ns.count")).toBe(schemaEnv(9, 2));
    });

    it("v0 schema is accepted on read", () => {
        const storage = createMockStorage();
        const registry = createRegistry([{ key: "count", version: 0, schema: { type: "number" } }]);
        storage.store.set("ns.count", schemaEnv(5, 0));

        const result = renderHook(
            () =>
                useMnemonicKey("count", {
                    defaultValue: 0,
                }),
            {
                namespace: "ns",
                storage,
                schemaMode: "default",
                schemaRegistry: registry,
            },
        );

        expect(result.current.value).toBe(5);
    });

    it("v0 schema is accepted on write", () => {
        const storage = createMockStorage();
        const registry = createRegistry([{ key: "count", version: 0, schema: { type: "number" } }]);

        const result = renderHook(
            () =>
                useMnemonicKey("count", {
                    defaultValue: 0,
                }),
            {
                namespace: "ns",
                storage,
                schemaMode: "default",
                schemaRegistry: registry,
            },
        );
        act(() => {
            result.current.set(4);
        });
        expect(storage.store.get("ns.count")).toBe(schemaEnv(4, 0));
    });

    it("strict mode discards value when migration path is missing", () => {
        const storage = createMockStorage();
        const registry = createRegistry([
            { key: "profile", version: 1, schema: { type: "string" } },
            { key: "profile", version: 2, schema: { type: "string" } },
        ]);
        storage.store.set("ns.profile", schemaEnv("legacy", 1));

        const result = renderHook(
            () =>
                useMnemonicKey("profile", {
                    defaultValue: "fallback",
                }),
            {
                namespace: "ns",
                storage,
                schemaMode: "strict",
                schemaRegistry: registry,
            },
        );

        expect(result.current.value).toBe("fallback");
    });

    it("strict mode migrates and rewrites to latest schema", async () => {
        const storage = createMockStorage();
        const registry = createRegistry(
            [
                { key: "name", version: 1, schema: { type: "string" } },
                { key: "name", version: 2, schema: { type: "string" } },
            ],
            [
                {
                    key: "name",
                    fromVersion: 1,
                    toVersion: 2,
                    migrate: (v) => `v2:${String(v)}`,
                },
            ],
        );
        storage.store.set("ns.name", schemaEnv("alice", 1));

        const result = renderHook(
            () =>
                useMnemonicKey("name", {
                    defaultValue: "fallback",
                }),
            {
                namespace: "ns",
                storage,
                schemaMode: "strict",
                schemaRegistry: registry,
            },
        );

        expect(result.current.value).toBe("v2:alice");
        await waitFor(() => {
            expect(storage.store.get("ns.name")).toBe(schemaEnv("v2:alice", 2));
        });
    });

    it("write-time migration normalizes value on write", () => {
        const storage = createMockStorage();
        const registry = createRegistry(
            [{ key: "name", version: 1, schema: { type: "string" } }],
            [
                {
                    key: "name",
                    fromVersion: 1,
                    toVersion: 1,
                    migrate: (v) => String(v).trim().toLowerCase(),
                },
            ],
        );

        const result = renderHook(
            () =>
                useMnemonicKey("name", {
                    defaultValue: "",
                }),
            {
                namespace: "ns",
                storage,
                schemaMode: "default",
                schemaRegistry: registry,
            },
        );
        act(() => {
            result.current.set("  Hello World  ");
        });
        expect(result.current.value).toBe("hello world");
        expect(storage.store.get("ns.name")).toBe(schemaEnv("hello world", 1));
    });

    it("autoschema: first read wins and incompatible subsequent writes are rejected", async () => {
        const storage = createMockStorage();
        const registry = createRegistry();
        // Seed with a codec-managed envelope (version 0, string payload)
        storage.store.set("ns.foo", env("123", 0));

        const numberReader = renderHook(
            () =>
                useMnemonicKey("foo", {
                    defaultValue: 0,
                }),
            {
                namespace: "ns",
                storage,
                schemaMode: "autoschema",
                schemaRegistry: registry,
            },
        );

        expect(numberReader.current.value).toBe(123);
        await waitFor(() => {
            expect(registry.getSchema("foo", 1)).toBeDefined();
        });

        const writer = renderHook(
            () =>
                useMnemonicKey("foo", {
                    defaultValue: "none",
                }),
            {
                namespace: "ns",
                storage,
                schemaMode: "autoschema",
                schemaRegistry: registry,
            },
        );

        const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        act(() => {
            writer.current.set("hello");
        });
        // After autoschema rewrite, storage has schema-managed envelope
        expect(storage.store.get("ns.foo")).toBe(schemaEnv(123, 1));
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });

    it("schema validation rejects values that do not match the schema", () => {
        const storage = createMockStorage();
        const registry = createRegistry([
            {
                key: "count",
                version: 1,
                schema: { type: "number", minimum: 0, maximum: 100 },
            },
        ]);

        const result = renderHook(
            () =>
                useMnemonicKey("count", {
                    defaultValue: 50,
                }),
            {
                namespace: "ns",
                storage,
                schemaMode: "default",
                schemaRegistry: registry,
            },
        );

        // Valid value
        act(() => {
            result.current.set(75);
        });
        expect(result.current.value).toBe(75);
        expect(storage.store.get("ns.count")).toBe(schemaEnv(75, 1));

        // Invalid value (> 100) — should be rejected
        const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        act(() => {
            result.current.set(999);
        });
        // Value should not have changed
        expect(result.current.value).toBe(75);
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });

    it("schema validation rejects mistyped values on read", () => {
        const storage = createMockStorage();
        const registry = createRegistry([{ key: "count", version: 1, schema: { type: "number" } }]);
        // Store a string where a number is expected
        storage.store.set("ns.count", schemaEnv("not-a-number", 1));

        let receivedError: SchemaError | undefined;
        const result = renderHook(
            () =>
                useMnemonicKey("count", {
                    defaultValue: (err) => {
                        if (err instanceof SchemaError) receivedError = err;
                        return 0;
                    },
                }),
            {
                namespace: "ns",
                storage,
                schemaMode: "strict",
                schemaRegistry: registry,
            },
        );

        expect(result.current.value).toBe(0);
        expect(receivedError).toBeInstanceOf(SchemaError);
        expect(receivedError?.code).toBe("TYPE_MISMATCH");
    });
});
