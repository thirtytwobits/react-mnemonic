// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { render, act } from "@testing-library/react";
import { MnemonicProvider } from "./provider";
import { useMnemonicKey } from "./use";
import { createSchemaRegistry } from "./schema-registry";
import type { KeySchema, MigrationRule, StorageLike } from "./types";

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
        key: (index: number) => Array.from(store.keys())[index] ?? null,
    };
}

function renderHook<T>(
    storage: StorageLike,
    namespace: string,
    hook: () => T,
): { result: { current: T }; unmount: () => void } {
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

    return {
        result: resultRef,
        unmount,
    };
}

describe("property-based persistence invariants", () => {
    it("round-trips arbitrary JSON-compatible values through the default envelope", () => {
        fc.assert(
            fc.property(fc.jsonValue(), (value) => {
                const storage = createMockStorage();
                const first = renderHook(storage, "prop-envelope", () =>
                    useMnemonicKey<unknown>("value", {
                        defaultValue: null,
                    }),
                );

                act(() => {
                    first.result.current.set(value);
                });

                expect(storage.store.get("prop-envelope.value")).toBe(
                    JSON.stringify({
                        version: 0,
                        payload: JSON.stringify(value),
                    }),
                );

                first.unmount();

                const second = renderHook(storage, "prop-envelope", () =>
                    useMnemonicKey<unknown>("value", {
                        defaultValue: null,
                    }),
                );

                expect(second.result.current.value).toEqual(value);
                second.unmount();
            }),
            { numRuns: 50 },
        );
    });

    it("resolves contiguous migration chains and preserves deterministic outcomes", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 6 }),
                fc.integer({ min: 0, max: 50 }),
                fc.integer({ min: 0, max: 100 }),
                (latestVersion, startSeed, initialCount) => {
                    const startVersion = startSeed % latestVersion;

                    const schemas: KeySchema[] = Array.from({ length: latestVersion + 1 }, (_, version) => ({
                        key: "counter",
                        version,
                        schema: {
                            type: "object",
                            properties: {
                                count: { type: "number" },
                                visited: {
                                    type: "array",
                                    items: { type: "number" },
                                },
                            },
                            required: ["count", "visited"],
                        },
                    }));

                    const migrations: MigrationRule[] = Array.from({ length: latestVersion }, (_, fromVersion) => ({
                        key: "counter",
                        fromVersion,
                        toVersion: fromVersion + 1,
                        migrate: (value) => {
                            const current = value as { count: number; visited: number[] };
                            return {
                                count: current.count + 1,
                                visited: [...current.visited, fromVersion + 1],
                            };
                        },
                    }));

                    const registry = createSchemaRegistry({
                        schemas,
                        migrations,
                    });

                    expect(registry.getLatestSchema("counter")?.version).toBe(latestVersion);

                    const path = registry.getMigrationPath("counter", startVersion, latestVersion);
                    expect(path).not.toBeNull();
                    expect(path).toHaveLength(latestVersion - startVersion);

                    const startingValue = {
                        count: initialCount,
                        visited: [startVersion],
                    };
                    const migrated = path!.reduce(
                        (value, step) => step.migrate(value) as { count: number; visited: number[] },
                        startingValue,
                    );

                    expect(migrated.count).toBe(initialCount + (latestVersion - startVersion));
                    expect(migrated.visited).toEqual(
                        Array.from({ length: latestVersion - startVersion + 1 }, (_, index) => startVersion + index),
                    );
                },
            ),
            { numRuns: 75 },
        );
    });
});
