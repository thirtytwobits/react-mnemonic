// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MnemonicProvider } from "./provider";
import { useMnemonicKey } from "./use";
import { StringCodec, NumberCodec, BooleanCodec, createCodec, CodecError, ValidationError } from "./codecs";
import type { StorageLike, Codec } from "./types";

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
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("count", { defaultValue: 42 }),
        );
        expect(result.current.value).toBe(42);
    });

    it("returns the stored value when it exists", () => {
        storage.store.set("ns.count", env(JSON.stringify(99)));
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("count", { defaultValue: 0 }),
        );
        expect(result.current.value).toBe(99);
    });

    it("set() updates the value", () => {
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("count", { defaultValue: 0 }),
        );
        act(() => {
            result.current.set(10);
        });
        expect(result.current.value).toBe(10);
        expect(storage.store.get("ns.count")).toBe(env(JSON.stringify(10)));
    });

    it("set() with updater function", () => {
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("count", { defaultValue: 5 }),
        );
        act(() => {
            result.current.set((c) => c + 1);
        });
        expect(result.current.value).toBe(6);
    });

    it("reset() restores the default value", () => {
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("count", { defaultValue: 0 }),
        );
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
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("count", { defaultValue: 0 }),
        );
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

    it("uses StringCodec", () => {
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("name", { defaultValue: "guest", codec: StringCodec }),
        );
        act(() => {
            result.current.set("alice");
        });
        expect(result.current.value).toBe("alice");
        // StringCodec does not JSON-wrap
        expect(storage.store.get("ns.name")).toBe(env("alice"));
    });

    it("uses NumberCodec", () => {
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("vol", { defaultValue: 50, codec: NumberCodec }),
        );
        act(() => {
            result.current.set(75);
        });
        expect(result.current.value).toBe(75);
        expect(storage.store.get("ns.vol")).toBe(env("75"));
    });

    it("uses BooleanCodec", () => {
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("dark", { defaultValue: false, codec: BooleanCodec }),
        );
        act(() => {
            result.current.set(true);
        });
        expect(result.current.value).toBe(true);
        expect(storage.store.get("ns.dark")).toBe(env("true"));
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
        storage.store.set("ns.count", env("not-a-number"));
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("count", { defaultValue: 0, codec: NumberCodec }),
        );
        // NumberCodec throws CodecError for "not-a-number", so fallback
        expect(result.current.value).toBe(0);
    });

    it("handles encode failure gracefully", () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const BadCodec: Codec<string> = {
            encode: () => {
                throw new CodecError("encode fail");
            },
            decode: (s) => s,
        };
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("k", { defaultValue: "x", codec: BadCodec }),
        );
        act(() => {
            result.current.set("anything");
        });
        // Value should not have changed since encode failed
        expect(result.current.value).toBe("x");
        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});

describe("useMnemonicKey – validation", () => {
    let storage: ReturnType<typeof createMockStorage>;

    beforeEach(() => {
        storage = createMockStorage();
    });

    it("returns default when validation fails", () => {
        storage.store.set("ns.num", env(JSON.stringify(-5)));
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey<number>("num", {
                defaultValue: 0,
                validate: (v): v is number => typeof v === "number" && v >= 0,
            }),
        );
        expect(result.current.value).toBe(0);
    });

    it("returns stored value when validation passes", () => {
        storage.store.set("ns.num", env(JSON.stringify(10)));
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey<number>("num", {
                defaultValue: 0,
                validate: (v): v is number => typeof v === "number" && v >= 0,
            }),
        );
        expect(result.current.value).toBe(10);
    });

    it("updater function uses validated current value", () => {
        storage.store.set("ns.num", env(JSON.stringify(5)));
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey<number>("num", {
                defaultValue: 0,
                validate: (v): v is number => typeof v === "number" && v >= 0,
            }),
        );
        act(() => {
            result.current.set((cur) => cur + 10);
        });
        expect(result.current.value).toBe(15);
    });

    it("updater function falls back to default when validation fails for current value", () => {
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey<number>("num", {
                defaultValue: 0,
                validate: (v): v is number => typeof v === "number" && v >= 0,
            }),
        );
        // Set a value that will fail validation when read during updater
        storage.store.set("ns.num", env(JSON.stringify(-1)));
        act(() => {
            // Force cache invalidation by removing and resetting
            result.current.set((cur) => cur + 100);
        });
        // The updater reads the current raw value which is -1, fails validation,
        // falls back to 0, then adds 100
        expect(result.current.value).toBe(100);
    });
});

describe("useMnemonicKey – defaultValue factory", () => {
    let storage: ReturnType<typeof createMockStorage>;

    beforeEach(() => {
        storage = createMockStorage();
    });

    it("calls factory function for the default value", () => {
        const factory = vi.fn(() => ({ items: [] as string[] }));
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("cart", { defaultValue: factory }),
        );
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
        renderHook(storage, "ns", () =>
            useMnemonicKey("greeting", { defaultValue: "default", onMount }),
        );
        expect(onMount).toHaveBeenCalledTimes(1);
        expect(onMount).toHaveBeenCalledWith("hello");
    });

    it("calls onMount with default when no stored value", () => {
        const onMount = vi.fn();
        renderHook(storage, "ns", () =>
            useMnemonicKey("greeting", { defaultValue: "fallback", onMount }),
        );
        expect(onMount).toHaveBeenCalledWith("fallback");
    });

    it("calls onChange when value changes", () => {
        const onChange = vi.fn();
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("count", { defaultValue: 0, onChange }),
        );
        act(() => {
            result.current.set(5);
        });
        expect(onChange).toHaveBeenCalledWith(5, 0);
    });

    it("does not call onChange if value is the same", () => {
        const onChange = vi.fn();
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("count", { defaultValue: 0, onChange }),
        );
        act(() => {
            result.current.set(0);
        });
        // Value didn't actually change semantically (0 -> 0), but it was set.
        // The write still hits storage; onChange behavior depends on decoded value identity.
        // JSONCodec decode will produce a new 0 but Object.is(0, 0) === true
        // so onChange should NOT fire.
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
                codec: StringCodec,
                listenCrossTab: true,
            }),
        );
        expect(result.current.value).toBe("light");

        act(() => {
            window.dispatchEvent(
                new StorageEvent("storage", {
                    key: "ns.theme",
                    newValue: env("dark"),
                }),
            );
        });
        expect(result.current.value).toBe("dark");
    });

    it("removes value when a storage event fires with null", () => {
        storage.store.set("ns.theme", env("dark"));
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("theme", {
                defaultValue: "light",
                codec: StringCodec,
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
        storage.store.set("ns.theme", env("dark"));
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("theme", {
                defaultValue: "light",
                codec: StringCodec,
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
                codec: StringCodec,
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
                codec: StringCodec,
                listenCrossTab: false,
            }),
        );
        act(() => {
            window.dispatchEvent(
                new StorageEvent("storage", {
                    key: "ns.theme",
                    newValue: env("dark"),
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
        const factory = vi.fn((_error?: CodecError | ValidationError) => 42);
        renderHook(storage, "ns", () =>
            useMnemonicKey("count", { defaultValue: factory }),
        );
        expect(factory).toHaveBeenCalledWith(undefined);
    });

    it("factory receives CodecError when decode fails", () => {
        const factory = vi.fn((_error?: CodecError | ValidationError) => 0);
        storage.store.set("ns.count", env("not-a-number"));
        renderHook(storage, "ns", () =>
            useMnemonicKey("count", { defaultValue: factory, codec: NumberCodec }),
        );
        expect(factory).toHaveBeenCalledWith(expect.any(CodecError));
    });

    it("factory receives ValidationError when validation returns false", () => {
        const factory = vi.fn((_error?: CodecError | ValidationError) => 0);
        storage.store.set("ns.num", env(JSON.stringify(-5)));
        renderHook(storage, "ns", () =>
            useMnemonicKey<number>("num", {
                defaultValue: factory,
                validate: (v): v is number => typeof v === "number" && v >= 0,
            }),
        );
        expect(factory).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it("non-CodecError from codec.decode is wrapped in CodecError", () => {
        const factory = vi.fn((_error?: CodecError | ValidationError) => "default");
        const BadJsonCodec: Codec<string> = {
            encode: (v) => JSON.stringify(v),
            decode: () => {
                throw new SyntaxError("bad json");
            },
        };
        storage.store.set("ns.val", env("corrupt"));
        renderHook(storage, "ns", () =>
            useMnemonicKey("val", { defaultValue: factory, codec: BadJsonCodec }),
        );
        expect(factory).toHaveBeenCalledWith(expect.any(CodecError));
        const passedError = factory.mock.calls[0]![0] as CodecError;
        expect(passedError.cause).toBeInstanceOf(SyntaxError);
    });

    it("validate throwing ValidationError passes it through to factory", () => {
        const factory = vi.fn((_error?: CodecError | ValidationError) => 0);
        const customError = new ValidationError("age must be positive");
        storage.store.set("ns.num", env(JSON.stringify(-5)));
        renderHook(storage, "ns", () =>
            useMnemonicKey<number>("num", {
                defaultValue: factory,
                validate: (v): v is number => {
                    if (typeof v !== "number" || v < 0) throw customError;
                    return true;
                },
            }),
        );
        expect(factory).toHaveBeenCalledWith(customError);
    });

    it("validate throwing non-ValidationError wraps in ValidationError", () => {
        const factory = vi.fn((_error?: CodecError | ValidationError) => 0);
        storage.store.set("ns.num", env(JSON.stringify(42)));
        renderHook(storage, "ns", () =>
            useMnemonicKey<number>("num", {
                defaultValue: factory,
                validate: (_v): _v is number => {
                    throw new TypeError("unexpected");
                },
            }),
        );
        expect(factory).toHaveBeenCalledWith(expect.any(ValidationError));
        const passedError = factory.mock.calls[0]![0] as ValidationError;
        expect(passedError.cause).toBeInstanceOf(TypeError);
    });

    it("updater passes CodecError to factory when decode fails", () => {
        const factory = vi.fn((_error?: CodecError | ValidationError) => 10);
        storage.store.set("ns.val", env("corrupt"));
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey<number>("val", { defaultValue: factory, codec: NumberCodec }),
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
        const factory = vi.fn((_error?: CodecError | ValidationError) => "default");
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("val", { defaultValue: factory, codec: StringCodec }),
        );
        factory.mockClear();
        act(() => {
            result.current.reset();
        });
        expect(factory).toHaveBeenCalledWith(undefined);
    });

    it("static defaultValue ignores errors and returns value regardless", () => {
        storage.store.set("ns.count", env("not-a-number"));
        const { result } = renderHook(storage, "ns", () =>
            useMnemonicKey("count", { defaultValue: 99, codec: NumberCodec }),
        );
        expect(result.current.value).toBe(99);
    });

    it("decode errors do not trigger console.error", () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        storage.store.set("ns.count", env("not-a-number"));
        renderHook(storage, "ns", () =>
            useMnemonicKey("count", { defaultValue: 0, codec: NumberCodec }),
        );
        expect(errorSpy).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});
