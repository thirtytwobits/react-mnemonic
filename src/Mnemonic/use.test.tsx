// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { MnemonicProvider } from "./provider";
import { useMnemonicKey } from "./use";
import { createCodec, CodecError } from "./codecs";
import { SchemaError } from "./schema";
import type { StorageLike, Codec, ReconcileContext } from "./types";

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

function env(payload: string, version = 0): string {
    return JSON.stringify({ version, payload });
}

function createSeededRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function buildInvalidEnvelopeFuzzCases(count: number): string[] {
    const random = createSeededRandom(0xc0ffee);
    const cases = new Set<string>([
        "",
        "not-json",
        "{",
        JSON.stringify(null),
        JSON.stringify([]),
        JSON.stringify({}),
        JSON.stringify({ version: -1, payload: "x" }),
        JSON.stringify({ version: 1.5, payload: "x" }),
        JSON.stringify({ version: "1", payload: "x" }),
        JSON.stringify({ version: 1 }),
        JSON.stringify({ payload: "x" }),
    ]);

    const alphabet = 'abcdefghijklmnopqrstuvwxyz{}[]:,"';
    while (cases.size < count) {
        const mode = Math.floor(random() * 4);
        if (mode === 0) {
            const length = 1 + Math.floor(random() * 12);
            let raw = "";
            for (let index = 0; index < length; index++) {
                raw += alphabet[Math.floor(random() * alphabet.length)] ?? "x";
            }
            cases.add(raw);
            continue;
        }

        const candidate =
            mode === 1
                ? { version: Math.floor(random() * 5) + 0.25, payload: Math.floor(random() * 10) }
                : mode === 2
                  ? { version: -1 - Math.floor(random() * 5), payload: { nested: true } }
                  : { version: Math.floor(random() * 5), extra: "missing-payload" };
        cases.add(JSON.stringify(candidate));
    }

    return Array.from(cases);
}

/** Renders a hook within MnemonicProvider and returns accessor for the result. */
function renderHook<T>(
    storage: ReturnType<typeof createMockStorage>,
    namespace: string,
    hook: () => T,
): { result: { current: T }; rerender: () => void } {
    const resultRef: { current: T } = { current: undefined as T };
    function TestComponent() {
        resultRef.current = hook();
        return null;
    }
    const { rerender: rrFn } = render(
        <MnemonicProvider namespace={namespace} storage={storage}>
            <TestComponent />
        </MnemonicProvider>,
    );
    return {
        result: resultRef,
        rerender: () =>
            rrFn(
                <MnemonicProvider namespace={namespace} storage={storage}>
                    <TestComponent />
                </MnemonicProvider>,
            ),
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useMnemonicKey – basic read/write", () => {
    let storage: ReturnType<typeof createMockStorage>;

    beforeEach(() => {
        storage = createMockStorage();
    });

    it("returns the default value when no stored value exists", () => {
        const { result } = renderHook(storage, "ns", () => useMnemonicKey("count", { defaultValue: 42 }));
        expect(result.current.value).toBe(42);
    });

    it("returns the stored value when it exists", () => {
        storage.store.set("ns.count", env(JSON.stringify(99)));
        const { result } = renderHook(storage, "ns", () => useMnemonicKey("count", { defaultValue: 0 }));
        expect(result.current.value).toBe(99);
    });

    it("set() updates the value", () => {
        const { result } = renderHook(storage, "ns", () => useMnemonicKey("count", { defaultValue: 0 }));
        act(() => {
            result.current.set(10);
        });
        expect(result.current.value).toBe(10);
        expect(storage.store.get("ns.count")).toBe(env(JSON.stringify(10)));
    });

    it("set() with updater function", () => {
        const { result } = renderHook(storage, "ns", () => useMnemonicKey("count", { defaultValue: 5 }));
        act(() => {
            result.current.set((c) => c + 1);
        });
        expect(result.current.value).toBe(6);
    });

    it("reset() restores the default value", () => {
        const { result } = renderHook(storage, "ns", () => useMnemonicKey("count", { defaultValue: 0 }));
        act(() => {
            result.current.set(100);
        });
        expect(result.current.value).toBe(100);
        act(() => {
            result.current.reset();
        });
        expect(result.current.value).toBe(0);
        expect(storage.store.get("ns.count")).toBe(env(JSON.stringify(0)));
    });

    it("remove() clears the value and returns default", () => {
        const { result } = renderHook(storage, "ns", () => useMnemonicKey("count", { defaultValue: 0 }));
        act(() => {
            result.current.set(50);
        });
        expect(result.current.value).toBe(50);
        act(() => {
            result.current.remove();
        });
        expect(result.current.value).toBe(0);
        expect(storage.store.has("ns.count")).toBe(false);
    });
});

describe("useMnemonicKey – codecs", () => {
    let storage: ReturnType<typeof createMockStorage>;

    beforeEach(() => {
        storage = createMockStorage();
    });

    it("uses a custom codec", () => {
        const DateCodec = createCodec<Date>(
            (d) => d.toISOString(),
            (s) => new Date(s),
        );
        const defaultDate = new Date("2024-01-01T00:00:00.000Z");
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("date", { defaultValue: defaultDate, codec: DateCodec }),
        );
        const newDate = new Date("2024-06-15T00:00:00.000Z");
        act(() => {
            result.current.set(newDate);
        });
        expect(result.current.value.getTime()).toBe(newDate.getTime());
        expect(storage.store.get("ns.date")).toBe(env("2024-06-15T00:00:00.000Z"));
    });

    it("falls back to default when decode fails", () => {
        // JSONCodec (default) cannot parse "not-valid-json{"
        storage.store.set("ns.count", env("not-valid-json{"));
        const { result } = renderHook(storage, "ns", () => useMnemonicKey("count", { defaultValue: 0 }));
        expect(result.current.value).toBe(0);
    });

    it("reads seeded non-string payloads directly when no schema is available", () => {
        const decode = vi.fn(() => {
            throw new Error("decode should not run");
        });
        storage.store.set("ns.legacy", JSON.stringify({ version: 0, payload: { enabled: true, retries: 3 } }));

        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("legacy", {
                defaultValue: { enabled: false, retries: 0 },
                codec: {
                    encode: JSON.stringify,
                    decode,
                },
            }),
        );

        expect(result.current.value).toEqual({ enabled: true, retries: 3 });
        expect(decode).not.toHaveBeenCalled();
    });

    it("reconciles codec-managed persisted values and rewrites once when changed", async () => {
        storage.store.set(
            "ns.preferences",
            env(
                JSON.stringify({
                    theme: "light",
                    density: "comfortable",
                }),
            ),
        );

        const reconcile = vi.fn(
            (value: { theme: string; density: string; accents?: boolean }, context: { persistedVersion: number }) => ({
                ...value,
                accents: context.persistedVersion === 0 ? true : (value.accents ?? true),
            }),
        );

        const { result, rerender } = renderHook(storage, "ns", () =>
            useMnemonicKey("preferences", {
                defaultValue: { theme: "dark", density: "comfortable", accents: true },
                reconcile,
            }),
        );

        expect(result.current.value).toEqual({
            theme: "light",
            density: "comfortable",
            accents: true,
        });

        await waitFor(() => {
            expect(storage.store.get("ns.preferences")).toBe(
                env(
                    JSON.stringify({
                        theme: "light",
                        density: "comfortable",
                        accents: true,
                    }),
                ),
            );
        });

        const callsAfterInitialRewrite = reconcile.mock.calls.length;
        rerender();
        expect(reconcile).toHaveBeenCalledTimes(callsAfterInitialRewrite + 1);
        expect(storage.store.get("ns.preferences")).toBe(
            env(
                JSON.stringify({
                    theme: "light",
                    density: "comfortable",
                    accents: true,
                }),
            ),
        );
    });

    it("handles encode failure gracefully", () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const BadCodec: Codec<string> = {
            encode: () => {
                throw new CodecError("encode fail");
            },
            decode: (s) => s,
        };
        const { result } = renderHook(storage, "ns", () => useMnemonicKey("k", { defaultValue: "x", codec: BadCodec }));
        act(() => {
            result.current.set("anything");
        });
        // Value should not have changed since encode failed
        expect(result.current.value).toBe("x");
        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it("passes persisted version context into reconcile for codec-managed values", () => {
        storage.store.set("ns.counter", env(JSON.stringify({ value: 5 }), 0));
        const reconcile = vi.fn((value: { value: number }, context: ReconcileContext) => {
            expect(context).toEqual({ persistedVersion: 0, key: "counter" });
            return value;
        });

        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("counter", {
                defaultValue: { value: 0 },
                reconcile,
            }),
        );

        expect(result.current.value).toEqual({ value: 5 });
        expect(reconcile).toHaveBeenCalledTimes(1);
    });
});

describe("useMnemonicKey – defaultValue factory", () => {
    let storage: ReturnType<typeof createMockStorage>;

    beforeEach(() => {
        storage = createMockStorage();
    });

    it("calls factory function for the default value", () => {
        const factory = vi.fn(() => ({ items: [] as string[] }));
        const { result } = renderHook(storage, "ns", () => useMnemonicKey("cart", { defaultValue: factory }));
        expect(result.current.value).toEqual({ items: [] });
        expect(factory).toHaveBeenCalled();
    });
});

describe("useMnemonicKey – callbacks", () => {
    let storage: ReturnType<typeof createMockStorage>;

    beforeEach(() => {
        storage = createMockStorage();
    });

    it("calls onMount once with the initial value", () => {
        const onMount = vi.fn();
        storage.store.set("ns.greeting", env(JSON.stringify("hello")));
        renderHook(storage, "ns", () => useMnemonicKey("greeting", { defaultValue: "default", onMount }));
        expect(onMount).toHaveBeenCalledTimes(1);
        expect(onMount).toHaveBeenCalledWith("hello");
    });

    it("calls onMount with default when no stored value", () => {
        const onMount = vi.fn();
        renderHook(storage, "ns", () => useMnemonicKey("greeting", { defaultValue: "fallback", onMount }));
        expect(onMount).toHaveBeenCalledWith("fallback");
    });

    it("calls onChange when value changes", () => {
        const onChange = vi.fn();
        const { result } = renderHook(storage, "ns", () => useMnemonicKey("count", { defaultValue: 0, onChange }));
        act(() => {
            result.current.set(5);
        });
        expect(onChange).toHaveBeenCalledWith(5, 0);
    });

    it("does not call onChange if value is the same", () => {
        const onChange = vi.fn();
        const { result } = renderHook(storage, "ns", () => useMnemonicKey("count", { defaultValue: 0, onChange }));
        act(() => {
            result.current.set(0);
        });
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe("useMnemonicKey – cross-tab sync", () => {
    let storage: ReturnType<typeof createMockStorage>;

    beforeEach(() => {
        storage = createMockStorage();
    });

    it("updates when a storage event fires with a new value", () => {
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("theme", {
                defaultValue: "light",
                listenCrossTab: true,
            }),
        );
        expect(result.current.value).toBe("light");

        act(() => {
            window.dispatchEvent(
                new StorageEvent("storage", {
                    key: "ns.theme",
                    newValue: env(JSON.stringify("dark")),
                }),
            );
        });
        expect(result.current.value).toBe("dark");
    });

    it("removes value when a storage event fires with null", () => {
        storage.store.set("ns.theme", env(JSON.stringify("dark")));
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("theme", {
                defaultValue: "light",
                listenCrossTab: true,
            }),
        );
        expect(result.current.value).toBe("dark");

        act(() => {
            window.dispatchEvent(
                new StorageEvent("storage", {
                    key: "ns.theme",
                    newValue: null,
                }),
            );
        });
        expect(result.current.value).toBe("light"); // falls back to default
    });

    it("handles localStorage.clear() events (key is null)", () => {
        storage.store.set("ns.theme", env(JSON.stringify("dark")));
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("theme", {
                defaultValue: "light",
                listenCrossTab: true,
            }),
        );
        expect(result.current.value).toBe("dark");

        act(() => {
            window.dispatchEvent(
                new StorageEvent("storage", {
                    key: null,
                    newValue: null,
                }),
            );
        });

        expect(result.current.value).toBe("light");
    });

    it("ignores storage events for different keys", () => {
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("theme", {
                defaultValue: "light",
                listenCrossTab: true,
            }),
        );
        act(() => {
            window.dispatchEvent(
                new StorageEvent("storage", {
                    key: "ns.other",
                    newValue: "irrelevant",
                }),
            );
        });
        expect(result.current.value).toBe("light");
    });

    it("does not listen when listenCrossTab is false", () => {
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("theme", {
                defaultValue: "light",
                listenCrossTab: false,
            }),
        );
        act(() => {
            window.dispatchEvent(
                new StorageEvent("storage", {
                    key: "ns.theme",
                    newValue: env(JSON.stringify("dark")),
                }),
            );
        });
        expect(result.current.value).toBe("light"); // unchanged
    });
});

describe("useMnemonicKey – multiple components sharing same key", () => {
    let storage: ReturnType<typeof createMockStorage>;

    beforeEach(() => {
        storage = createMockStorage();
    });

    it("both components see the same value after one sets it", () => {
        const results: { current: ReturnType<typeof useMnemonicKey<number>> }[] = [];

        function Component({ idx }: { idx: number }) {
            const hook = useMnemonicKey("shared", { defaultValue: 0 });
            results[idx] = { current: hook };
            return <div data-testid={`c${idx}`}>{hook.value}</div>;
        }

        render(
            <MnemonicProvider namespace="ns" storage={storage}>
                <Component idx={0} />
                <Component idx={1} />
            </MnemonicProvider>,
        );

        expect(results[0]!.current.value).toBe(0);
        expect(results[1]!.current.value).toBe(0);

        act(() => {
            results[0]!.current.set(42);
        });

        expect(results[0]!.current.value).toBe(42);
        expect(results[1]!.current.value).toBe(42);
    });
});

describe("useMnemonicKey – updater with decode failure", () => {
    let storage: ReturnType<typeof createMockStorage>;

    beforeEach(() => {
        storage = createMockStorage();
    });

    it("updater falls back to default when current raw value cannot be decoded", () => {
        const StrictCodec: Codec<number> = {
            encode: (v) => String(v),
            decode: (s) => {
                const n = Number(s);
                if (Number.isNaN(n)) throw new Error("bad decode");
                return n;
            },
        };
        // Pre-populate storage with a corrupt raw value
        storage.store.set("ns.val", env("not-a-number"));
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey<number>("val", { defaultValue: 10, codec: StrictCodec }),
        );
        // Initial value falls back to default because decode throws
        expect(result.current.value).toBe(10);

        // Now call set with an updater – it reads getRawSnapshot (corrupt),
        // tries to decode, throws, falls back to default (10), then applies updater
        act(() => {
            result.current.set((cur) => cur + 5);
        });
        expect(result.current.value).toBe(15);
    });
});

describe("useMnemonicKey – reset encode failure", () => {
    let storage: ReturnType<typeof createMockStorage>;

    beforeEach(() => {
        storage = createMockStorage();
    });

    it("handles encode failure during reset gracefully", () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const BadCodec: Codec<string> = {
            encode: () => {
                throw new CodecError("encode fail");
            },
            decode: (s) => s,
        };
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("k", { defaultValue: "default", codec: BadCodec }),
        );
        act(() => {
            result.current.reset();
        });
        // Should log error but not throw
        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// Error-aware defaultValue factory
// ---------------------------------------------------------------------------

describe("useMnemonicKey – error-aware defaultValue factory", () => {
    let storage: ReturnType<typeof createMockStorage>;

    beforeEach(() => {
        storage = createMockStorage();
    });

    it("factory receives undefined on nominal path (no stored value)", () => {
        const factory = vi.fn((_error?: CodecError | SchemaError) => 42);
        renderHook(storage, "ns", () => useMnemonicKey("count", { defaultValue: factory }));
        expect(factory).toHaveBeenCalledWith(undefined);
    });

    it("factory receives CodecError when decode fails", () => {
        const factory = vi.fn((_error?: CodecError | SchemaError) => 0);
        // Use a codec that throws on decode
        const StrictCodec: Codec<number> = {
            encode: (v) => String(v),
            decode: (s) => {
                const n = Number(s);
                if (Number.isNaN(n)) throw new CodecError("not a number");
                return n;
            },
        };
        storage.store.set("ns.count", env("not-a-number"));
        renderHook(storage, "ns", () => useMnemonicKey("count", { defaultValue: factory, codec: StrictCodec }));
        expect(factory).toHaveBeenCalledWith(expect.any(CodecError));
    });

    it("non-CodecError from codec.decode is wrapped in CodecError", () => {
        const factory = vi.fn((_error?: CodecError | SchemaError) => "default");
        const BadJsonCodec: Codec<string> = {
            encode: (v) => JSON.stringify(v),
            decode: () => {
                throw new SyntaxError("bad json");
            },
        };
        storage.store.set("ns.val", env("corrupt"));
        renderHook(storage, "ns", () => useMnemonicKey("val", { defaultValue: factory, codec: BadJsonCodec }));
        expect(factory).toHaveBeenCalledWith(expect.any(CodecError));
        const passedError = factory.mock.calls[0]![0] as CodecError;
        expect(passedError.cause).toBeInstanceOf(SyntaxError);
    });

    it("updater passes CodecError to factory when decode fails", () => {
        const StrictCodec: Codec<number> = {
            encode: (v) => String(v),
            decode: (s) => {
                const n = Number(s);
                if (Number.isNaN(n)) throw new CodecError("not a number");
                return n;
            },
        };
        const factory = vi.fn((_error?: CodecError | SchemaError) => 10);
        storage.store.set("ns.val", env("corrupt"));
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey<number>("val", { defaultValue: factory, codec: StrictCodec }),
        );
        // Initial render calls factory with CodecError; clear to isolate updater call
        factory.mockClear();
        act(() => {
            result.current.set((cur) => cur + 5);
        });
        // The updater reads corrupt raw, decode fails, factory called with CodecError
        expect(factory).toHaveBeenCalledWith(expect.any(CodecError));
        expect(result.current.value).toBe(15);
    });

    it("reset calls factory with no error argument (nominal)", () => {
        const factory = vi.fn((_error?: CodecError | SchemaError) => "default");
        const { result } = renderHook(storage, "ns", () => useMnemonicKey("val", { defaultValue: factory }));
        factory.mockClear();
        act(() => {
            result.current.reset();
        });
        expect(factory).toHaveBeenCalledWith(undefined);
    });

    it("static defaultValue ignores errors and returns value regardless", () => {
        // JSONCodec cannot parse "not-valid-json{"
        storage.store.set("ns.count", env("not-valid-json{"));
        const { result } = renderHook(storage, "ns", () => useMnemonicKey("count", { defaultValue: 99 }));
        expect(result.current.value).toBe(99);
    });

    it("decode errors do not trigger console.error", () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        storage.store.set("ns.count", env("not-valid-json{"));
        renderHook(storage, "ns", () => useMnemonicKey("count", { defaultValue: 0 }));
        expect(errorSpy).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it("passes RECONCILE_FAILED to the fallback factory when reconcile throws", () => {
        const factory = vi.fn((_error?: CodecError | SchemaError) => ({ theme: "dark" }));
        storage.store.set("ns.preferences", env(JSON.stringify({ theme: "light" })));

        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("preferences", {
                defaultValue: factory,
                reconcile: () => {
                    throw new Error("cannot reconcile");
                },
            }),
        );

        expect(result.current.value).toEqual({ theme: "dark" });
        expect(factory).toHaveBeenCalledWith(expect.any(SchemaError));
        const receivedError = factory.mock.calls[factory.mock.calls.length - 1]?.[0];
        expect(receivedError).toBeInstanceOf(SchemaError);
        expect((receivedError as SchemaError).code).toBe("RECONCILE_FAILED");
    });

    it("wraps CodecError instances thrown by reconcile as RECONCILE_FAILED", () => {
        const factory = vi.fn((_error?: CodecError | SchemaError) => "fallback");
        storage.store.set("ns.name", env(JSON.stringify("alice")));

        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("name", {
                defaultValue: factory,
                reconcile: () => {
                    throw new CodecError("codec-shaped error");
                },
            }),
        );

        expect(result.current.value).toBe("fallback");
        const receivedError = factory.mock.calls[factory.mock.calls.length - 1]?.[0];
        expect(receivedError).toBeInstanceOf(SchemaError);
        expect((receivedError as SchemaError).code).toBe("RECONCILE_FAILED");
    });

    it("passes through SchemaError instances thrown by reconcile", () => {
        const factory = vi.fn((_error?: CodecError | SchemaError) => "fallback");
        storage.store.set("ns.name", env(JSON.stringify("alice")));

        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("name", {
                defaultValue: factory,
                reconcile: () => {
                    throw new SchemaError("TYPE_MISMATCH", "schema mismatch");
                },
            }),
        );

        expect(result.current.value).toBe("fallback");
        expect(factory).toHaveBeenCalledWith(expect.any(SchemaError));
        const receivedError = factory.mock.calls[factory.mock.calls.length - 1]?.[0] as SchemaError;
        expect(receivedError.code).toBe("TYPE_MISMATCH");
    });

    it("fuzzes malformed persisted envelopes and always falls back with INVALID_ENVELOPE", () => {
        const invalidRawValues = buildInvalidEnvelopeFuzzCases(24);

        for (const [index, raw] of invalidRawValues.entries()) {
            const localStorage = createMockStorage();
            let receivedError: SchemaError | undefined;
            localStorage.store.set(`ns${index}.corrupt`, raw);

            const { result } = renderHook(localStorage, `ns${index}`, () =>
                useMnemonicKey("corrupt", {
                    defaultValue: (error) => {
                        if (error instanceof SchemaError) {
                            receivedError = error;
                        }
                        return "fallback";
                    },
                }),
            );

            expect(result.current.value).toBe("fallback");
            expect(receivedError).toBeInstanceOf(SchemaError);
            expect(receivedError?.code).toBe("INVALID_ENVELOPE");
        }
    });
});
