// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSchemaRegistry } from "./schema-registry";
import { defineKeySchema, defineMigration } from "./schema-helpers";
import { mnemonicSchema } from "./typed-schema";
import { MnemonicProvider } from "./provider";
import { useMnemonicKeyOptional, useMnemonicOptional } from "./use-key-optional";
import type { Codec, MnemonicOptionalBridge, StorageLike } from "./types";

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

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("useMnemonicOptional", () => {
    it("returns null outside a provider", () => {
        function Consumer() {
            const bridge = useMnemonicOptional();
            return <div data-testid="status">{bridge ? "connected" : "missing"}</div>;
        }

        render(<Consumer />);
        expect(screen.getByTestId("status").textContent).toBe("missing");
    });

    it("exposes namespace and capabilities from a provider-backed bridge", () => {
        let bridge: MnemonicOptionalBridge | null = null;

        function Consumer() {
            bridge = useMnemonicOptional();
            return <div data-testid="status">{bridge?.namespace ?? "missing"}</div>;
        }

        render(
            <MnemonicProvider namespace="prefs">
                <Consumer />
            </MnemonicProvider>,
        );

        expect(screen.getByTestId("status").textContent).toBe("prefs");
        expect(bridge).toEqual({
            namespace: "prefs",
            capabilities: {
                persistence: true,
                schema: false,
            },
        });
    });
});

describe("useMnemonicKeyOptional without a provider", () => {
    it("falls back to in-memory state and ignores provider-only metadata", () => {
        const getItemSpy = vi.spyOn(Storage.prototype, "getItem");
        const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
        const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem");
        const onMount = vi.fn();
        const onChange = vi.fn();
        const codec: Codec<number> = {
            encode: (value) => `n:${value}`,
            decode: (encoded) => Number(encoded.slice(2)),
        };

        function Counter() {
            const { value, set, reset, remove } = useMnemonicKeyOptional("count", {
                defaultValue: 1,
                onMount,
                onChange,
                codec,
                schema: { version: 99 },
            });

            return (
                <div>
                    <span data-testid="value">{value}</span>
                    <button onClick={() => set((current) => current + 1)}>inc</button>
                    <button onClick={reset}>reset</button>
                    <button onClick={remove}>remove</button>
                </div>
            );
        }

        render(<Counter />);

        expect(screen.getByTestId("value").textContent).toBe("1");
        expect(onMount).toHaveBeenCalledWith(1);

        fireEvent.click(screen.getByText("inc"));
        fireEvent.click(screen.getByText("remove"));
        fireEvent.click(screen.getByText("inc"));
        fireEvent.click(screen.getByText("reset"));

        expect(screen.getByTestId("value").textContent).toBe("1");
        expect(onChange.mock.calls).toEqual([
            [2, 1],
            [1, 2],
            [2, 1],
            [1, 2],
        ]);
        expect(getItemSpy).not.toHaveBeenCalled();
        expect(setItemSpy).not.toHaveBeenCalled();
        expect(removeItemSpy).not.toHaveBeenCalled();
    });

    it("uses ssr.serverValue as the initial in-memory value", () => {
        function Consumer() {
            const { value } = useMnemonicKeyOptional("theme", {
                defaultValue: "light",
                ssr: { serverValue: "dark" },
            });

            return <div data-testid="value">{value}</div>;
        }

        render(<Consumer />);
        expect(screen.getByTestId("value").textContent).toBe("dark");
    });
});

describe("useMnemonicKeyOptional with a core-style provider bridge", () => {
    it("persists through the provider bridge and honors codec metadata", () => {
        const storage = createMockStorage();
        const codec: Codec<number> = {
            encode: (value) => `n:${value}`,
            decode: (encoded) => Number(encoded.slice(2)),
        };

        function Counter() {
            const { value, set } = useMnemonicKeyOptional("count", {
                defaultValue: 0,
                codec,
            });

            return <button onClick={() => set((current) => current + 1)}>{value}</button>;
        }

        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <Counter />
            </MnemonicProvider>,
        );

        fireEvent.click(screen.getByRole("button"));

        expect(screen.getByRole("button").textContent).toBe("1");
        expect(storage.store.get("ns.count")).toBe('{"version":0,"payload":"n:1"}');
    });
});

describe("useMnemonicKeyOptional with a schema-capable provider bridge", () => {
    it("reads and rewrites migrated schema-managed values", () => {
        const storage = createMockStorage();
        storage.store.set("schema.settings", '{"version":1,"payload":{"density":"compact"}}');

        const v1 = defineKeySchema(
            "settings",
            1,
            mnemonicSchema.object({
                density: mnemonicSchema.enum(["compact", "comfortable"] as const),
            }),
        );
        const v2 = defineKeySchema(
            "settings",
            2,
            mnemonicSchema.object({
                density: mnemonicSchema.enum(["compact", "comfortable"] as const),
                sidebar: mnemonicSchema.boolean(),
            }),
        );
        const registry = createSchemaRegistry({
            schemas: [v1, v2],
            migrations: [
                defineMigration(v1, v2, (value) => ({
                    ...value,
                    sidebar: true,
                })),
            ],
        });

        function Consumer() {
            const bridge = useMnemonicOptional();
            const { value, set } = useMnemonicKeyOptional("settings", {
                defaultValue: { density: "comfortable" as const, sidebar: false },
                schema: { version: 2 },
            });

            return (
                <div>
                    <span data-testid="value">{JSON.stringify(value)}</span>
                    <span data-testid="schema-capability">{String(bridge?.capabilities.schema ?? false)}</span>
                    <button
                        onClick={() =>
                            set({
                                density: "comfortable",
                                sidebar: false,
                            })
                        }
                    >
                        write
                    </button>
                </div>
            );
        }

        render(
            <MnemonicProvider namespace="schema" storage={storage} schemaMode="default" schemaRegistry={registry}>
                <Consumer />
            </MnemonicProvider>,
        );

        expect(screen.getByTestId("value").textContent).toBe('{"density":"compact","sidebar":true}');
        expect(screen.getByTestId("schema-capability").textContent).toBe("true");
        expect(storage.store.get("schema.settings")).toBe(
            '{"version":2,"payload":{"density":"compact","sidebar":true}}',
        );

        fireEvent.click(screen.getByText("write"));
        expect(storage.store.get("schema.settings")).toBe(
            '{"version":2,"payload":{"density":"comfortable","sidebar":false}}',
        );
    });

    it("honors strict schema mode for writes", () => {
        const storage = createMockStorage();
        const registry = createSchemaRegistry();
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        function Consumer() {
            const { value, set } = useMnemonicKeyOptional("settings", {
                defaultValue: { density: "comfortable" as "comfortable" | "compact" },
                schema: { version: 1 },
            });

            return (
                <button onClick={() => set({ density: "compact" })} data-testid="strict-write">
                    {value.density}
                </button>
            );
        }

        render(
            <MnemonicProvider namespace="schema" storage={storage} schemaMode="strict" schemaRegistry={registry}>
                <Consumer />
            </MnemonicProvider>,
        );

        fireEvent.click(screen.getByTestId("strict-write"));

        expect(storage.store.has("schema.settings")).toBe(false);
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[Mnemonic] Schema error for key "settings" (WRITE_SCHEMA_REQUIRED):'),
            'Write requires schema for key "settings" in strict mode',
        );
    });
});
