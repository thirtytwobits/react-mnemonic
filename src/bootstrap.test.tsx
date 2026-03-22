// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { applyMnemonicBootstrap, recallMnemonic, type SchemaRegistry } from "./bootstrap";
import { CodecError, MnemonicProvider, defineMnemonicKey, useMnemonicKey, type StorageLike } from "./core";

function createMockStorage(): StorageLike & {
    store: Map<string, string>;
    getItem: ReturnType<typeof vi.fn>;
} {
    const store = new Map<string, string>();
    const getItem = vi.fn((key: string) => store.get(key) ?? null);

    return {
        store,
        getItem,
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

function env(payload: string, version = 0): string {
    return JSON.stringify({ version, payload });
}

describe("bootstrap recall", () => {
    it("recalls shared descriptors and applies the decoded snapshot", () => {
        const storage = createMockStorage();
        const themeKey = defineMnemonicKey("theme", {
            defaultValue: "light" as "light" | "dark",
        });

        storage.store.set("app.theme", env(JSON.stringify("dark")));

        const snapshot = recallMnemonic({
            namespace: "app",
            storage,
            keys: [themeKey] as const,
        });

        expect(snapshot.values.theme).toBe("dark");
        expect(snapshot.raw.theme).toBe(env(JSON.stringify("dark")));

        applyMnemonicBootstrap({
            snapshot,
            apply: ({ theme }) => {
                document.documentElement.dataset.theme = theme;
            },
        });

        expect(document.documentElement.dataset.theme).toBe("dark");
    });

    it("uses the error-aware fallback when codec decoding fails", () => {
        const storage = createMockStorage();
        const fallback = vi.fn((error?: CodecError) => (error ? "fallback" : "default"));

        storage.store.set("app.value", env("bad-payload"));

        const snapshot = recallMnemonic({
            namespace: "app",
            storage,
            keys: [
                {
                    key: "value",
                    defaultValue: fallback,
                    codec: {
                        encode: (value: string) => value,
                        decode: () => {
                            throw new Error("decode failed");
                        },
                    },
                },
            ] as const,
        });

        expect(snapshot.values.value).toBe("fallback");
        expect(fallback).toHaveBeenCalledTimes(1);
        expect(fallback.mock.calls[0]?.[0]).toBeInstanceOf(CodecError);
    });

    it("reconciles decoded values but preserves the original raw snapshot", () => {
        const storage = createMockStorage();
        const reconcile = vi.fn((value: "light" | "dark" | "system") => (value === "system" ? "dark" : value));

        storage.store.set("app.theme", env(JSON.stringify("system")));

        const snapshot = recallMnemonic({
            namespace: "app",
            storage,
            keys: [
                {
                    key: "theme",
                    defaultValue: "light" as "light" | "dark" | "system",
                    reconcile,
                },
            ] as const,
        });

        expect(snapshot.values.theme).toBe("dark");
        expect(snapshot.raw.theme).toBe(env(JSON.stringify("system")));
        expect(reconcile).toHaveBeenCalledWith("system", {
            key: "theme",
            persistedVersion: 0,
        });
    });

    it("does not register autoschema results during the bootstrap read", () => {
        const storage = createMockStorage();
        const registerSchema = vi.fn();
        const registry: SchemaRegistry = {
            getSchema: () => undefined,
            getLatestSchema: () => undefined,
            getMigrationPath: () => null,
            getWriteMigration: () => undefined,
            registerSchema,
        };

        storage.store.set("app.prefs", env(JSON.stringify({ theme: "dark" })));

        const snapshot = recallMnemonic({
            namespace: "app",
            storage,
            schemaMode: "autoschema",
            schemaRegistry: registry,
            keys: [
                {
                    key: "prefs",
                    defaultValue: { theme: "light" },
                },
            ] as const,
        });

        expect(snapshot.values.prefs).toEqual({ theme: "dark" });
        expect(registerSchema).not.toHaveBeenCalled();
    });

    it("throws for strict mode without a schema registry", () => {
        expect(() =>
            recallMnemonic({
                namespace: "app",
                schemaMode: "strict",
                keys: [
                    {
                        key: "theme",
                        defaultValue: "light" as "light" | "dark",
                    },
                ] as const,
            }),
        ).toThrow("recallMnemonic strict mode requires schemaRegistry");
    });
});

describe("provider bootstrap seeding", () => {
    it("seeds the provider cache so the first render does not re-read storage", () => {
        const storage = createMockStorage();
        const themeKey = defineMnemonicKey("theme", {
            defaultValue: "light" as "light" | "dark",
        });

        storage.store.set("app.theme", env(JSON.stringify("dark")));

        const snapshot = recallMnemonic({
            namespace: "app",
            storage,
            keys: [themeKey] as const,
        });

        expect(storage.getItem).toHaveBeenCalledTimes(1);

        function Theme() {
            const { value } = useMnemonicKey(themeKey);
            return <div data-testid="theme">{value}</div>;
        }

        render(
            <MnemonicProvider namespace="app" storage={storage} bootstrap={snapshot}>
                <Theme />
            </MnemonicProvider>,
        );

        expect(screen.getByTestId("theme").textContent).toBe("dark");
        expect(storage.getItem).toHaveBeenCalledTimes(1);
    });

    it("omits unreadable raw seeds so the provider can retry storage later", () => {
        const store = new Map<string, string>([["app.theme", env(JSON.stringify("dark"))]]);
        let blocked = true;
        const getItem = vi.fn((key: string) => {
            if (blocked) {
                throw new DOMException("Blocked", "SecurityError");
            }
            return store.get(key) ?? null;
        });
        const storage: StorageLike = {
            getItem,
            setItem: (key, value) => {
                store.set(key, value);
            },
            removeItem: (key) => {
                store.delete(key);
            },
        };
        const themeKey = defineMnemonicKey("theme", {
            defaultValue: "light" as "light" | "dark",
        });

        const snapshot = recallMnemonic({
            namespace: "app",
            storage,
            keys: [themeKey] as const,
        });

        expect(snapshot.values.theme).toBe("light");
        expect("theme" in snapshot.raw).toBe(false);

        blocked = false;

        function Theme() {
            const { value } = useMnemonicKey(themeKey);
            return <div data-testid="recovered-theme">{value}</div>;
        }

        render(
            <MnemonicProvider namespace="app" storage={storage} bootstrap={snapshot}>
                <Theme />
            </MnemonicProvider>,
        );

        expect(screen.getByTestId("recovered-theme").textContent).toBe("dark");
        expect(getItem).toHaveBeenCalledTimes(2);
    });
});
