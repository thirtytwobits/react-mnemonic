// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MnemonicProvider, useMnemonicKey, JSONCodec, CodecError, SchemaError } from "./core";

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
});

function SchemaConsumer() {
    useMnemonicKey("theme", {
        defaultValue: "light",
        schema: { version: 1 },
    });
    return null;
}
