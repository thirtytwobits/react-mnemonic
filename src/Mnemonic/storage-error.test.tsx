// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * Coverage for `MnemonicProvider`'s `onStorageError` callback (#102).
 *
 * The point of the callback is that a dropped write stops being invisible, so
 * these tests care about two things: that every way a write can be dropped
 * produces exactly one classified event, and that a write which is actually
 * durable produces none.
 */

import React from "react";
import { render, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { MnemonicProvider, useMnemonic } from "./provider";
import { useMnemonicKey } from "./use";
import { useMnemonicKeyOptional } from "./use-key-optional";
import { CodecError } from "./codecs";
import type { Codec, MnemonicStorageErrorEvent, StorageLike } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type QuotaStorage = StorageLike & {
    store: Map<string, string>;
    /** When true, every setItem throws QuotaExceededError. */
    full: boolean;
    /** When set, every setItem and removeItem throws this instead. */
    failWith: DOMException | Error | null;
};

function createQuotaStorage(): QuotaStorage {
    const store = new Map<string, string>();
    const storage: QuotaStorage = {
        store,
        full: false,
        failWith: null,
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            if (storage.failWith) throw storage.failWith;
            if (storage.full) throw new DOMException("quota exceeded", "QuotaExceededError");
            store.set(key, value);
        },
        removeItem: (key: string) => {
            if (storage.failWith) throw storage.failWith;
            store.delete(key);
        },
        get length() {
            return store.size;
        },
        key: (index: number) => Array.from(store.keys())[index] ?? null,
    };
    return storage;
}

function StoreConsumer({ onStore }: { onStore: (store: ReturnType<typeof useMnemonic>) => void }) {
    const store = useMnemonic();
    React.useEffect(() => {
        onStore(store);
    }, [store, onStore]);
    return null;
}

function renderStore(
    storage: StorageLike | undefined,
    onStorageError?: (event: MnemonicStorageErrorEvent) => void,
): ReturnType<typeof useMnemonic> {
    let store: ReturnType<typeof useMnemonic> | undefined;
    render(
        <MnemonicProvider
            namespace="ns"
            {...(storage ? { storage } : {})}
            {...(onStorageError ? { onStorageError } : {})}
        >
            <StoreConsumer
                onStore={(s) => {
                    store = s;
                }}
            />
        </MnemonicProvider>,
    );
    return store!;
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    errorSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

describe("onStorageError – classification", () => {
    it("reports a quota rejection as a set with the value's size", () => {
        const storage = createQuotaStorage();
        const onStorageError = vi.fn();
        const store = renderStore(storage, onStorageError);
        storage.full = true;

        store.setRaw("draft", "hello");

        expect(onStorageError).toHaveBeenCalledTimes(1);
        const event = onStorageError.mock.calls[0]![0] as MnemonicStorageErrorEvent;
        expect(event.key).toBe("draft");
        expect(event.operation).toBe("set");
        expect(event.reason).toBe("quota");
        expect(event.error).toBeInstanceOf(DOMException);
        expect(event.bytes).toBe("hello".length * 2);
    });

    it("reports a non-quota DOMException as an access failure", () => {
        const storage = createQuotaStorage();
        const onStorageError = vi.fn();
        const store = renderStore(storage, onStorageError);
        storage.failWith = new DOMException("blocked", "SecurityError");

        store.setRaw("k", "v");

        const event = onStorageError.mock.calls[0]![0] as MnemonicStorageErrorEvent;
        expect(event.reason).toBe("access");
        expect((event.error as DOMException).name).toBe("SecurityError");
    });

    it("reports a plain Error from a custom backend as an access failure", () => {
        const storage = createQuotaStorage();
        const onStorageError = vi.fn();
        const store = renderStore(storage, onStorageError);
        storage.failWith = new Error("disk on fire");

        store.setRaw("k", "v");

        const event = onStorageError.mock.calls[0]![0] as MnemonicStorageErrorEvent;
        expect(event.reason).toBe("access");
        expect((event.error as Error).message).toBe("disk on fire");
    });

    it("reports a removal as an operation with no size", () => {
        const storage = createQuotaStorage();
        const onStorageError = vi.fn();
        const store = renderStore(storage, onStorageError);
        storage.store.set("ns.k", "stored");
        storage.failWith = new DOMException("blocked", "SecurityError");

        store.removeRaw("k");

        const event = onStorageError.mock.calls[0]![0] as MnemonicStorageErrorEvent;
        expect(event.operation).toBe("remove");
        expect(event.bytes).toBeUndefined();
    });

    it("reports writes made when the browser has no usable storage backend", () => {
        const originalDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
        Object.defineProperty(window, "localStorage", {
            configurable: true,
            get() {
                throw new DOMException("blocked", "SecurityError");
            },
        });

        try {
            const onStorageError = vi.fn();
            const store = renderStore(undefined, onStorageError);

            store.setRaw("k", "v");

            const event = onStorageError.mock.calls[0]![0] as MnemonicStorageErrorEvent;
            expect(event.reason).toBe("access");
            // Nothing was thrown — there was simply nowhere to write.
            expect(event.error).toBeUndefined();
            expect(event.bytes).toBe("v".length * 2);
        } finally {
            if (originalDescriptor) {
                Object.defineProperty(window, "localStorage", originalDescriptor);
            }
        }
    });

    it("reports a backend that breaks the synchronous contract, and every write after it", () => {
        const storage = createQuotaStorage();
        const onStorageError = vi.fn();
        storage.setItem = () => Promise.resolve() as unknown as void;
        const store = renderStore(storage, onStorageError);

        store.setRaw("first", "a");
        store.setRaw("second", "b");

        expect(onStorageError).toHaveBeenCalledTimes(2);
        const reasons = onStorageError.mock.calls.map((c) => (c[0] as MnemonicStorageErrorEvent).reason);
        expect(reasons).toEqual(["contract", "contract"]);
        expect((onStorageError.mock.calls[0]![0] as MnemonicStorageErrorEvent).error).toBeUndefined();
    });

    it("reports the unprefixed key, not the namespaced storage key", () => {
        const storage = createQuotaStorage();
        const onStorageError = vi.fn();
        const store = renderStore(storage, onStorageError);
        storage.full = true;

        store.setRaw("nested.key", "v");

        expect((onStorageError.mock.calls[0]![0] as MnemonicStorageErrorEvent).key).toBe("nested.key");
    });
});

// ---------------------------------------------------------------------------
// Failures that never reach storage
// ---------------------------------------------------------------------------

describe("onStorageError – pre-storage failures", () => {
    function renderKey(
        storage: StorageLike,
        onStorageError: (event: MnemonicStorageErrorEvent) => void,
        codec: Codec<string>,
    ) {
        let api: ReturnType<typeof useMnemonicKey<string>> | undefined;
        function Probe() {
            api = useMnemonicKey("k", { defaultValue: "x", codec });
            return null;
        }
        render(
            <MnemonicProvider namespace="ns" storage={storage} onStorageError={onStorageError}>
                <Probe />
            </MnemonicProvider>,
        );
        return () => api!;
    }

    it("reports a codec encode failure that never reached the backend", () => {
        const storage = createQuotaStorage();
        const onStorageError = vi.fn();
        const badCodec: Codec<string> = {
            encode: () => {
                throw new CodecError("encode fail");
            },
            decode: (s) => s,
        };
        const api = renderKey(storage, onStorageError, badCodec);

        act(() => {
            api().set("anything");
        });

        expect(onStorageError).toHaveBeenCalledTimes(1);
        const event = onStorageError.mock.calls[0]![0] as MnemonicStorageErrorEvent;
        expect(event.reason).toBe("codec");
        expect(event.operation).toBe("set");
        expect(event.error).toBeInstanceOf(CodecError);
        // Nothing was encoded, so there is no size to report.
        expect(event.bytes).toBeUndefined();
    });

    it("reports a reset that cannot be encoded", () => {
        const storage = createQuotaStorage();
        const onStorageError = vi.fn();
        const badCodec: Codec<string> = {
            encode: () => {
                throw new CodecError("encode fail");
            },
            decode: (s) => s,
        };
        const api = renderKey(storage, onStorageError, badCodec);

        act(() => {
            api().reset();
        });

        const event = onStorageError.mock.calls[0]![0] as MnemonicStorageErrorEvent;
        expect(event.reason).toBe("codec");
        expect(event.operation).toBe("set");
    });

    it("reports an unclassified encode failure as unknown", () => {
        const storage = createQuotaStorage();
        const onStorageError = vi.fn();
        const badCodec: Codec<string> = {
            encode: () => {
                throw new TypeError("something else entirely");
            },
            decode: (s) => s,
        };
        const api = renderKey(storage, onStorageError, badCodec);

        act(() => {
            api().set("anything");
        });

        const event = onStorageError.mock.calls[0]![0] as MnemonicStorageErrorEvent;
        expect(event.reason).toBe("unknown");
        expect(event.error).toBeInstanceOf(TypeError);
    });

    it("logs an unclassified reset failure so it stays diagnosable without a handler", () => {
        const storage = createQuotaStorage();
        const onStorageError = vi.fn();
        const badCodec: Codec<string> = {
            encode: () => {
                throw new TypeError("something else entirely");
            },
            decode: (s) => s,
        };
        const api = renderKey(storage, onStorageError, badCodec);

        act(() => {
            api().reset();
        });

        expect((onStorageError.mock.calls[0]![0] as MnemonicStorageErrorEvent).reason).toBe("unknown");
        const logs = errorSpy.mock.calls.filter((c: unknown[]) => String(c[0]).includes("Failed to persist key"));
        expect(logs).toHaveLength(1);
    });

    it("leaves the cache and the retry queue untouched when a value never reaches storage", () => {
        const storage = createQuotaStorage();
        const onStorageError = vi.fn();
        let store: ReturnType<typeof useMnemonic> | undefined;
        let api: ReturnType<typeof useMnemonicKey<string>> | undefined;
        const badCodec: Codec<string> = {
            encode: (v) => {
                if (v === "bad") throw new CodecError("encode fail");
                return v;
            },
            decode: (s) => s,
        };
        function Probe() {
            store = useMnemonic();
            api = useMnemonicKey("k", { defaultValue: "x", codec: badCodec });
            return null;
        }
        render(
            <MnemonicProvider namespace="ns" storage={storage} onStorageError={onStorageError}>
                <Probe />
            </MnemonicProvider>,
        );

        act(() => {
            api!.set("good");
        });
        const rawBefore = store!.getRawSnapshot("k");
        const storedBefore = storage.store.get("ns.k");

        act(() => {
            api!.set("bad");
        });

        // The report fired, but a pre-storage rejection is not a dropped write:
        // the previous value still stands and there is nothing to flush.
        expect((onStorageError.mock.calls[0]![0] as MnemonicStorageErrorEvent).reason).toBe("codec");
        expect(api!.value).toBe("good");
        expect(store!.getRawSnapshot("k")).toBe(rawBefore);
        expect(storage.store.get("ns.k")).toBe(storedBefore);
        expect(store!.unpersistedKeys()).toEqual([]);
        expect(store!.flush()).toEqual({ persisted: [], failed: [] });
    });
});

// ---------------------------------------------------------------------------
// The optional hook reaches storage through the provider's store
// ---------------------------------------------------------------------------

describe("onStorageError – optional hooks under a provider", () => {
    function renderOptionalKey(codec: Codec<string>, onStorageError: (event: MnemonicStorageErrorEvent) => void) {
        const storage = createQuotaStorage();
        let api: ReturnType<typeof useMnemonicKeyOptional<string>> | undefined;
        function Probe() {
            api = useMnemonicKeyOptional("k", { defaultValue: "x", codec });
            return null;
        }
        render(
            <MnemonicProvider namespace="ns" storage={storage} onStorageError={onStorageError}>
                <Probe />
            </MnemonicProvider>,
        );
        return { storage, api: () => api! };
    }

    it("reports a codec failure rather than letting it escape set()", () => {
        const onStorageError = vi.fn();
        const { api } = renderOptionalKey(
            {
                encode: () => {
                    throw new CodecError("encode fail");
                },
                decode: (s) => s,
            },
            onStorageError,
        );

        expect(() =>
            act(() => {
                api().set("anything");
            }),
        ).not.toThrow();

        expect((onStorageError.mock.calls[0]![0] as MnemonicStorageErrorEvent).reason).toBe("codec");
    });

    it("reports an unclassified failure instead of throwing out of set()", () => {
        const onStorageError = vi.fn();
        const { api } = renderOptionalKey(
            {
                encode: () => {
                    throw new TypeError("something else entirely");
                },
                decode: (s) => s,
            },
            onStorageError,
        );

        // This used to rethrow, escaping through a set() that does not catch.
        expect(() =>
            act(() => {
                api().set("anything");
            }),
        ).not.toThrow();

        const event = onStorageError.mock.calls[0]![0] as MnemonicStorageErrorEvent;
        expect(event.reason).toBe("unknown");
        expect(event.error).toBeInstanceOf(TypeError);
    });

    it("reports a quota drop through the shared store", () => {
        const onStorageError = vi.fn();
        const { storage, api } = renderOptionalKey({ encode: (v) => v, decode: (s) => s }, onStorageError);
        storage.full = true;

        act(() => {
            api().set("v");
        });

        expect((onStorageError.mock.calls[0]![0] as MnemonicStorageErrorEvent).reason).toBe("quota");
    });
});

// ---------------------------------------------------------------------------
// When it must stay silent
// ---------------------------------------------------------------------------

describe("onStorageError – silence", () => {
    it("says nothing when writes land", () => {
        const storage = createQuotaStorage();
        const onStorageError = vi.fn();
        const store = renderStore(storage, onStorageError);

        store.setRaw("k", "v");
        store.removeRaw("k");

        expect(onStorageError).not.toHaveBeenCalled();
    });

    it("says nothing when a rejected write is one storage already satisfies", () => {
        const storage = createQuotaStorage();
        const onStorageError = vi.fn();
        const store = renderStore(storage, onStorageError);

        // Another writer already stored this exact value; the backend then
        // refuses the echo. The key is durable, so reporting it as dropped
        // would be a false alarm.
        storage.store.set("ns.k", "same");
        storage.full = true;
        store.setRaw("k", "same");

        expect(onStorageError).not.toHaveBeenCalled();
        expect(store.unpersistedKeys()).toEqual([]);
    });

    it("does not crash a write when no handler is supplied", () => {
        const storage = createQuotaStorage();
        const store = renderStore(storage);
        storage.full = true;

        expect(() => store.setRaw("k", "v")).not.toThrow();
        expect(store.unpersistedKeys()).toEqual(["k"]);
    });
});

// ---------------------------------------------------------------------------
// Delivery semantics
// ---------------------------------------------------------------------------

describe("onStorageError – delivery", () => {
    it("fires on every dropped write rather than squelching like the console", () => {
        const storage = createQuotaStorage();
        const onStorageError = vi.fn();
        const store = renderStore(storage, onStorageError);
        storage.full = true;

        store.setRaw("a", "1");
        store.setRaw("a", "2");
        store.setRaw("b", "3");

        expect(onStorageError).toHaveBeenCalledTimes(3);
        // The console message for the same three failures is logged once.
        const quotaLogs = errorSpy.mock.calls.filter((c: unknown[]) => String(c[0]).includes("Storage quota exceeded"));
        expect(quotaLogs).toHaveLength(1);
    });

    it("reports a failed flush retry", () => {
        const storage = createQuotaStorage();
        const onStorageError = vi.fn();
        const store = renderStore(storage, onStorageError);
        storage.full = true;
        store.setRaw("k", "v");
        onStorageError.mockClear();

        expect(store.flush()).toEqual({ persisted: [], failed: ["k"] });

        expect(onStorageError).toHaveBeenCalledTimes(1);
        expect((onStorageError.mock.calls[0]![0] as MnemonicStorageErrorEvent).reason).toBe("quota");
    });

    it("says nothing when a flush retry succeeds", () => {
        const storage = createQuotaStorage();
        const onStorageError = vi.fn();
        const store = renderStore(storage, onStorageError);
        storage.full = true;
        store.setRaw("k", "v");
        onStorageError.mockClear();

        storage.full = false;
        expect(store.flush()).toEqual({ persisted: ["k"], failed: [] });

        expect(onStorageError).not.toHaveBeenCalled();
    });

    it("hands the handler a fully applied mutation", () => {
        const storage = createQuotaStorage();
        let seen: { cached: string | null; unpersisted: string[] } | undefined;
        let store: ReturnType<typeof useMnemonic>;
        const onStorageError = vi.fn(() => {
            seen = {
                cached: store.getRawSnapshot("k"),
                unpersisted: store.unpersistedKeys(),
            };
        });
        store = renderStore(storage, onStorageError);
        storage.full = true;

        store.setRaw("k", "v");

        // The cache already serves the new value and the key is already queued
        // by the time the handler runs, so it can report and retry immediately.
        expect(seen).toEqual({ cached: "v", unpersisted: ["k"] });
    });

    it("picks up a handler supplied on a later render", () => {
        const storage = createQuotaStorage();
        const first = vi.fn();
        const second = vi.fn();
        let store: ReturnType<typeof useMnemonic> | undefined;

        function Tree({ handler }: { handler: (event: MnemonicStorageErrorEvent) => void }) {
            return (
                <MnemonicProvider namespace="ns" storage={storage} onStorageError={handler}>
                    <StoreConsumer
                        onStore={(s) => {
                            store = s;
                        }}
                    />
                </MnemonicProvider>
            );
        }

        const { rerender } = render(<Tree handler={first} />);
        rerender(<Tree handler={second} />);
        storage.full = true;

        store!.setRaw("k", "v");

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// Containing a misbehaving handler
// ---------------------------------------------------------------------------

describe("onStorageError – handler misbehaviour", () => {
    it("completes the mutation when the handler throws, and complains once", () => {
        const storage = createQuotaStorage();
        const onStorageError = vi.fn(() => {
            throw new Error("handler blew up");
        });
        const store = renderStore(storage, onStorageError);
        storage.full = true;

        expect(() => store.setRaw("k", "v")).not.toThrow();
        store.setRaw("k2", "v2");

        // The write still applied and is still recoverable.
        expect(store.getRawSnapshot("k")).toBe("v");
        expect(store.unpersistedKeys()).toEqual(["k", "k2"]);
        expect(onStorageError).toHaveBeenCalledTimes(2);

        const handlerLogs = errorSpy.mock.calls.filter((c: unknown[]) => String(c[0]).includes("onStorageError threw"));
        expect(handlerLogs).toHaveLength(1);
    });

    it("does not recurse when the handler writes to the store", () => {
        const storage = createQuotaStorage();
        let depth = 0;
        let maxDepth = 0;
        let store: ReturnType<typeof useMnemonic>;
        const onStorageError = vi.fn(() => {
            depth += 1;
            maxDepth = Math.max(maxDepth, depth);
            // This write is dropped too; reporting it would recurse forever.
            store.setRaw("audit", "failed");
            depth -= 1;
        });
        store = renderStore(storage, onStorageError);
        storage.full = true;

        expect(() => store.setRaw("k", "v")).not.toThrow();

        expect(maxDepth).toBe(1);
        expect(onStorageError).toHaveBeenCalledTimes(1);
        // The nested write was still applied and queued, so it is not lost.
        expect(store.unpersistedKeys()).toEqual(["k", "audit"]);
    });
});
