import assert from "node:assert/strict";
import React from "react";
import { hydrateRoot } from "react-dom/client";
import { act as domAct } from "react-dom/test-utils";
import { renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";
import { MnemonicProvider, useMnemonicKey } from "react-mnemonic/core";

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
