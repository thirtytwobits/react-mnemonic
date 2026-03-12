// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MnemonicProvider, useMnemonicKey, JSONCodec, CodecError, SchemaError } from "./core";
import { MnemonicProvider as SchemaMnemonicProvider } from "./schema";
import { createSchemaRegistry } from "./Mnemonic/schema-registry";
import { defineKeySchema } from "./Mnemonic/schema-helpers";
import { mnemonicSchema } from "./Mnemonic/typed-schema";

type StorageRecord = Map<string, string>;

function createMockStorage() {
    const store: StorageRecord = new Map<string, string>();
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

const originalProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
const originalNodeEnv = originalProcess?.env?.NODE_ENV;

function setNodeEnv(value: string) {
    const globalWithProcess = globalThis as { process?: { env?: Record<string, string | undefined> } };
    if (!globalWithProcess.process) {
        globalWithProcess.process = { env: { NODE_ENV: value } };
        return;
    }
    if (!globalWithProcess.process.env) {
        globalWithProcess.process.env = {};
    }
    globalWithProcess.process.env.NODE_ENV = value;
}

afterEach(() => {
    const globalWithProcess = globalThis as { process?: { env?: Record<string, string | undefined> } };
    if (originalProcess === undefined) {
        delete (globalWithProcess as { process?: unknown }).process;
    } else if (originalNodeEnv === undefined) {
        if (globalWithProcess.process?.env) {
            delete globalWithProcess.process.env.NODE_ENV;
        }
    } else if (globalWithProcess.process?.env) {
        globalWithProcess.process.env.NODE_ENV = originalNodeEnv;
    }
    vi.restoreAllMocks();
});

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

describe("react-mnemonic/core", () => {
    it("exports the lean runtime surface", () => {
        expect(MnemonicProvider).toBeDefined();
        expect(useMnemonicKey).toBeDefined();
        expect(JSONCodec).toBeDefined();
        expect(CodecError).toBeDefined();
        expect(SchemaError).toBeDefined();
    });

    it("persists basic state without schema machinery", () => {
        const storage = createMockStorage();
        const result = renderHook(
            () =>
                useMnemonicKey("theme", {
                    defaultValue: "light" as "light" | "dark",
                }),
            {
                namespace: "core",
                storage,
            },
        );

        act(() => {
            result.current.set("dark");
        });

        expect(storage.store.get("core.theme")).toBe(JSON.stringify({ version: 0, payload: JSON.stringify("dark") }));
    });

    it("throws when schema features are requested from the core entrypoint", () => {
        const storage = createMockStorage();
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});

        expect(() =>
            render(
                <MnemonicProvider namespace="core" storage={storage}>
                    <SchemaConsumer />
                </MnemonicProvider>,
            ),
        ).toThrow(/react-mnemonic\/core/);

        spy.mockRestore();
    });

    it("rejects schema provider props from the core entrypoint", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        const unsafeProps = {
            namespace: "core",
            schemaMode: "strict",
        } as unknown as ComponentProps<typeof MnemonicProvider>;

        expect(() =>
            render(
                <MnemonicProvider {...unsafeProps}>
                    <div />
                </MnemonicProvider>,
            ),
        ).toThrow(/react-mnemonic\/core/);

        spy.mockRestore();
    });

    it("also rejects schemaRegistry on the core provider entrypoint", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        const unsafeProps = {
            namespace: "core",
            schemaRegistry: createSchemaRegistry(),
        } as unknown as ComponentProps<typeof MnemonicProvider>;

        expect(() =>
            render(
                <MnemonicProvider {...unsafeProps}>
                    <div />
                </MnemonicProvider>,
            ),
        ).toThrow(/schemaRegistry/);

        spy.mockRestore();
    });

    it("reads legacy non-string envelope payloads without crashing and rewrites future updates with codec encoding", () => {
        const storage = createMockStorage();
        storage.store.set("core.count", JSON.stringify({ version: 0, payload: 41 }));

        const result = renderHook(
            () =>
                useMnemonicKey("count", {
                    defaultValue: 0,
                }),
            {
                namespace: "core",
                storage,
            },
        );

        expect(result.current.value).toBe(41);

        act(() => {
            result.current.set((current) => current + 1);
        });

        expect(result.current.value).toBe(42);
        expect(storage.store.get("core.count")).toBe(JSON.stringify({ version: 0, payload: JSON.stringify(42) }));
    });

    it("falls back when codec decode fails and passes a CodecError to the default factory", () => {
        const storage = createMockStorage();
        storage.store.set("core.count", JSON.stringify({ version: 0, payload: "not-a-number" }));

        const defaultValue = vi.fn((_error?: CodecError | SchemaError) => 7);
        const strictNumberCodec = {
            encode: (value: number) => String(value),
            decode: (raw: string) => {
                const parsed = Number(raw);
                if (Number.isNaN(parsed)) {
                    throw new Error("bad number");
                }
                return parsed;
            },
        };

        const result = renderHook(
            () =>
                useMnemonicKey("count", {
                    defaultValue,
                    codec: strictNumberCodec,
                }),
            {
                namespace: "core",
                storage,
            },
        );

        expect(result.current.value).toBe(7);
        expect(defaultValue).toHaveBeenCalledWith(expect.any(CodecError));
    });

    it("warns when the core hook is used inside a schema-aware provider because schemas are ignored", () => {
        setNodeEnv("development");

        const storage = createMockStorage();
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const registry = createSchemaRegistry({
            schemas: [defineKeySchema("theme", 1, mnemonicSchema.string())],
        });

        function TestComponent() {
            useMnemonicKey("theme", {
                defaultValue: "light",
            });
            return null;
        }

        render(
            <SchemaMnemonicProvider
                namespace="core-warning"
                storage={storage}
                schemaMode="default"
                schemaRegistry={registry}
            >
                <TestComponent />
            </SchemaMnemonicProvider>,
        );

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('useMnemonicKey("theme") is running from react-mnemonic/core'),
        );
    });
});

function SchemaConsumer() {
    useMnemonicKey("theme", {
        defaultValue: "light",
        schema: { version: 1 },
    });
    return null;
}
