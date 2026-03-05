// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import type { KeySchema, MigrationPath, SchemaMode, SchemaRegistry } from "./types";

type Listener = () => void;

type MockMnemonicApi = {
    prefix: string;
    schemaMode: SchemaMode;
    schemaRegistry?: SchemaRegistry;
    subscribeRaw: (key: string, listener: Listener) => () => void;
    getRawSnapshot: (key: string) => string | null;
    setRaw: (key: string, raw: string) => void;
    removeRaw: (key: string) => void;
};

function createMockApi(options?: {
    raw?: string | null;
    schemaMode?: SchemaMode;
    schemaRegistry?: SchemaRegistry;
    setRawImpl?: (key: string, raw: string) => void;
}): { api: MockMnemonicApi; getRaw: () => string | null } {
    const listeners = new Set<Listener>();
    let raw = options?.raw ?? null;

    const emit = () => {
        for (const listener of listeners) {
            listener();
        }
    };

    return {
        api: {
            prefix: "ns.",
            schemaMode: options?.schemaMode ?? "default",
            ...(options?.schemaRegistry ? { schemaRegistry: options.schemaRegistry } : {}),
            subscribeRaw: (_key, listener) => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
            getRawSnapshot: () => raw,
            setRaw: (key, nextRaw) => {
                if (options?.setRawImpl) {
                    options.setRawImpl(key, nextRaw);
                    return;
                }
                raw = nextRaw;
                emit();
            },
            removeRaw: () => {
                raw = null;
                emit();
            },
        },
        getRaw: () => raw,
    };
}

function renderHook<T>(hook: () => T): { result: { current: T } } {
    const resultRef: { current: T } = { current: undefined as T };

    function TestComponent() {
        resultRef.current = hook();
        return null;
    }

    render(<TestComponent />);
    return { result: resultRef };
}

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock("./provider");
    vi.doUnmock("./json-schema");
});

describe("useMnemonicKey – mocked defensive branches", () => {
    it("logs unexpected store failures from set()", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const { api } = createMockApi({
            setRawImpl: () => {
                throw new Error("store unavailable");
            },
        });

        vi.doMock("./provider", () => ({
            useMnemonic: () => api,
        }));

        const { useMnemonicKey } = await import("./use");
        const { result } = renderHook(() => useMnemonicKey("count", { defaultValue: 0 }));

        act(() => {
            result.current.set(1);
        });

        expect(result.current.value).toBe(0);
        expect(errorSpy).toHaveBeenCalledWith('[Mnemonic] Failed to persist key "count":', expect.any(Error));
    });

    it("falls back when autoschema inference throws an unexpected error", async () => {
        const registry: SchemaRegistry = {
            getSchema: () => undefined,
            getLatestSchema: () => undefined,
            getMigrationPath: (): MigrationPath | null => null,
            registerSchema: vi.fn(),
        };
        const { api } = createMockApi({
            raw: JSON.stringify({ version: 0, payload: "123" }),
            schemaMode: "autoschema",
            schemaRegistry: registry,
        });

        vi.doMock("./provider", () => ({
            useMnemonic: () => api,
        }));
        vi.doMock("./json-schema", async () => {
            const actual = await vi.importActual<typeof import("./json-schema")>("./json-schema");
            return {
                ...actual,
                inferJsonSchema: vi.fn(() => {
                    throw new Error("inference crashed");
                }),
            };
        });

        const { useMnemonicKey } = await import("./use");
        let receivedError: unknown;
        const { result } = renderHook(() =>
            useMnemonicKey("count", {
                defaultValue: (error) => {
                    receivedError = error;
                    return 0;
                },
            }),
        );

        expect(result.current.value).toBe(0);
        expect((receivedError as { code?: string } | undefined)?.code).toBe("TYPE_MISMATCH");
    });

    it("falls back when schema validation infrastructure throws unexpectedly", async () => {
        const schema: KeySchema = {
            key: "count",
            version: 1,
            schema: { type: "number" },
        };
        const registry: SchemaRegistry = {
            getSchema: () => schema,
            getLatestSchema: () => schema,
            getMigrationPath: (): MigrationPath | null => null,
        };
        const { api } = createMockApi({
            raw: JSON.stringify({ version: 1, payload: 5 }),
            schemaMode: "strict",
            schemaRegistry: registry,
        });

        vi.doMock("./provider", () => ({
            useMnemonic: () => api,
        }));
        vi.doMock("./json-schema", async () => {
            const actual = await vi.importActual<typeof import("./json-schema")>("./json-schema");
            return {
                ...actual,
                validateJsonSchema: vi.fn(() => {
                    throw new Error("validator crashed");
                }),
            };
        });

        const { useMnemonicKey } = await import("./use");
        let receivedError: unknown;
        const { result } = renderHook(() =>
            useMnemonicKey("count", {
                defaultValue: (error) => {
                    receivedError = error;
                    return 0;
                },
            }),
        );

        expect(result.current.value).toBe(0);
        expect((receivedError as { code?: string } | undefined)?.code).toBe("TYPE_MISMATCH");
    });
});
