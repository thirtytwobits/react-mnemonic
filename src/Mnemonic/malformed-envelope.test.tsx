// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MnemonicProvider } from "./provider";
import { useMnemonicKey } from "./use";
import { SchemaError } from "./schema";
import type { StorageLike } from "./types";

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

function renderHook<T>(storage: StorageLike, namespace: string, hook: () => T): { current: T } {
    const resultRef = { current: undefined as T };

    function TestComponent() {
        resultRef.current = hook();
        return null;
    }

    render(
        <MnemonicProvider namespace={namespace} storage={storage}>
            <TestComponent />
        </MnemonicProvider>,
    );

    return resultRef;
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

const malformedEnvelopeCorpus = [
    "undefined",
    JSON.stringify({ version: Number.NaN, payload: "x" }),
    JSON.stringify({ version: Number.POSITIVE_INFINITY, payload: "x" }),
    JSON.stringify({ version: {}, payload: "x" }),
    JSON.stringify({ version: 0, payload: undefined }),
    JSON.stringify({ version: 0, payload: Symbol("x") }),
];

function expectInvalidEnvelopeFallback(raw: string, namespace: string): void {
    const storage = createMockStorage();
    let receivedError: SchemaError | undefined;
    storage.store.set(`${namespace}.corrupt`, raw);

    const result = renderHook(storage, namespace, () =>
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

describe("malformed envelope handling", () => {
    it("falls back for a representative malformed-envelope corpus", () => {
        for (const [index, raw] of malformedEnvelopeCorpus.entries()) {
            expectInvalidEnvelopeFallback(raw, `corpus-${index}`);
        }
    });

    it("fuzzes malformed persisted envelopes and always falls back with INVALID_ENVELOPE", () => {
        const invalidRawValues = buildInvalidEnvelopeFuzzCases(32);

        for (const [index, raw] of invalidRawValues.entries()) {
            expectInvalidEnvelopeFallback(raw, `fuzz-${index}`);
        }
    });
});
