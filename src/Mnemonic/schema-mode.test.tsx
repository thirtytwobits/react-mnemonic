// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect, vi } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MnemonicProvider } from "./provider";
import { useMnemonicKey } from "./use";
import { StringCodec, NumberCodec } from "./codecs";
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

function env(payload: string, version = 0): string {
    return JSON.stringify({ version, payload });
}

function createRegistry(schemas: KeySchema<any>[] = [], rules: MigrationRule[] = []): SchemaRegistry {
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
                const next = byKey.find((r) => r.fromVersion === cur);
                if (!next) return null;
                path.push(next);
                cur = next.toVersion;
            }
            return path;
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
                    codec: NumberCodec,
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
        expect(storage.store.get("ns.count")).toBe(env("7", 0));
    });

    it("strict mode reads and writes with registered schema version", () => {
        const storage = createMockStorage();
        const registry = createRegistry([
            { key: "count", version: 2, codec: NumberCodec, validate: (v): v is number => typeof v === "number" },
        ]);
        storage.store.set("ns.count", env("5", 2));

        const result = renderHook(
            () =>
                useMnemonicKey("count", {
                    defaultValue: 0,
                    codec: NumberCodec,
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
        expect(storage.store.get("ns.count")).toBe(env("9", 2));
    });

    it("strict mode discards value when migration path is missing", () => {
        const storage = createMockStorage();
        const registry = createRegistry([
            { key: "profile", version: 1, codec: StringCodec, validate: (v): v is string => typeof v === "string" },
            { key: "profile", version: 2, codec: StringCodec, validate: (v): v is string => typeof v === "string" },
        ]);
        storage.store.set("ns.profile", env("legacy", 1));

        const result = renderHook(
            () =>
                useMnemonicKey("profile", {
                    defaultValue: "fallback",
                    codec: StringCodec,
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
                { key: "name", version: 1, codec: StringCodec, validate: (v): v is string => typeof v === "string" },
                { key: "name", version: 2, codec: StringCodec, validate: (v): v is string => typeof v === "string" },
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
        storage.store.set("ns.name", env("alice", 1));

        const result = renderHook(
            () =>
                useMnemonicKey("name", {
                    defaultValue: "fallback",
                    codec: StringCodec,
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
            expect(storage.store.get("ns.name")).toBe(env("v2:alice", 2));
        });
    });

    it("autoschema: first read wins and incompatible subsequent writes are rejected", async () => {
        const storage = createMockStorage();
        const registry = createRegistry();
        storage.store.set("ns.foo", env("123", 0));

        const numberReader = renderHook(
            () =>
                useMnemonicKey("foo", {
                    defaultValue: 0,
                    codec: NumberCodec,
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
                    codec: StringCodec,
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
        expect(storage.store.get("ns.foo")).toBe(env("123", 1));
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });
});
