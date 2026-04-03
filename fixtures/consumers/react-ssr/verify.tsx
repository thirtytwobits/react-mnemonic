import assert from "node:assert/strict";
import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { act as domAct } from "react-dom/test-utils";
import { renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";
import { MnemonicProvider as RootMnemonicProvider } from "react-mnemonic";
import { MnemonicProvider, useMnemonicKey } from "react-mnemonic/core";
import { useMnemonicKeyOptional, useMnemonicOptional } from "react-mnemonic/optional";

type StorageLike = {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
    length?: number;
    key?: (index: number) => string | null;
};

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

function env(payload: string, version = 0): string {
    return JSON.stringify({ version, payload });
}

const storage = createMockStorage();
storage.store.set("fixture.theme", env(JSON.stringify("dark")));

function Theme() {
    const { value } = useMnemonicKey("theme", {
        defaultValue: "light",
    });
    return <span id="theme">{value}</span>;
}

const app = (
    <MnemonicProvider namespace="fixture" storage={storage}>
        <Theme />
    </MnemonicProvider>
);

const html = renderToString(app);
assert.match(html, /light/);

const dom = new JSDOM(`<div id="root">${html}</div>`, {
    url: "http://localhost",
});

Object.defineProperties(globalThis, {
    window: {
        configurable: true,
        value: dom.window,
    },
    document: {
        configurable: true,
        value: dom.window.document,
    },
    navigator: {
        configurable: true,
        value: dom.window.navigator,
    },
    HTMLElement: {
        configurable: true,
        value: dom.window.HTMLElement,
    },
    Node: {
        configurable: true,
        value: dom.window.Node,
    },
});
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
});

const container = dom.window.document.getElementById("root");
assert.ok(container);
const act = React.act ?? domAct;

await act(async () => {
    hydrateRoot(container, app);
    await Promise.resolve();
});

assert.equal(container.textContent, "dark");

const mixedStorage = createMockStorage();

function MixedEntrypointCounter() {
    const bridge = useMnemonicOptional();
    const counter = useMnemonicKeyOptional("count", {
        defaultValue: 0,
    });

    return (
        <>
            <span id="bridge">{bridge?.namespace ?? "missing"}</span>
            <button id="counter" onClick={() => counter.set((value) => value + 1)}>
                {counter.value}
            </button>
        </>
    );
}

const mixedApp = (
    <RootMnemonicProvider namespace="mixed" storage={mixedStorage}>
        <MixedEntrypointCounter />
    </RootMnemonicProvider>
);

const mixedRoot = dom.window.document.createElement("div");
dom.window.document.body.appendChild(mixedRoot);
const mixedAct = React.act ?? domAct;

await mixedAct(async () => {
    createRoot(mixedRoot).render(mixedApp);
    await Promise.resolve();
});

const bridge = mixedRoot.querySelector("#bridge");
const counter = mixedRoot.querySelector("#counter");

assert.ok(bridge);
assert.ok(counter instanceof dom.window.HTMLButtonElement);
assert.equal(bridge.textContent, "mixed");
assert.equal(counter.textContent, "0");

await mixedAct(async () => {
    counter.click();
    await Promise.resolve();
});

assert.equal(counter.textContent, "1");
assert.equal(mixedStorage.store.get("mixed.count"), env(JSON.stringify(1)));
