import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const AUTO_REFRESH_STORAGE_KEY = "react-mnemonic:auto-refresh";

function createPanelDom() {
    document.body.innerHTML = `
        <main class="panel" role="main">
            <header class="panel-header">
                <div class="controls">
                    <label class="auto-refresh-control" for="auto-refresh-toggle">
                        <input id="auto-refresh-toggle" type="checkbox" />
                        Auto-refresh
                    </label>
                    <button id="refresh-button" type="button">Refresh</button>
                </div>
            </header>
            <p id="status" class="status" aria-live="polite">Loading Mnemonic DevTools...</p>
            <section class="table-wrap" aria-label="mnemonic storage table">
                <table class="storage-table">
                    <thead>
                        <tr>
                            <th scope="col">Key</th>
                            <th scope="col">Value</th>
                            <th scope="col">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="storage-table-body"></tbody>
                </table>
            </section>
        </main>
    `;
}

function createNamespace(namespace, available, rows, version = 1) {
    return {
        namespace,
        available,
        rows,
        registeredAt: version,
        lastSeenAt: version,
        staleSince: available ? null : version,
    };
}

function installPanelChromeMock(queue) {
    const evalMock = vi.fn((script, callback) => {
        const next = queue.shift();
        if (!next) {
            throw new Error(`Unexpected inspectedWindow.eval call: ${script.slice(0, 80)}`);
        }

        next.assertScript?.(script);
        callback(next.result, next.exceptionInfo);
    });

    globalThis.chrome = {
        devtools: {
            inspectedWindow: {
                eval: evalMock,
            },
        },
    };

    return { evalMock };
}

async function loadPanelScript() {
    vi.resetModules();
    await import("./panel.js");
}

function click(element) {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("devtools extension panel", () => {
    beforeEach(() => {
        createPanelDom();
        localStorage.clear();
        localStorage.setItem(AUTO_REFRESH_STORAGE_KEY, "false");
    });

    afterEach(() => {
        window.dispatchEvent(new Event("beforeunload"));
        document.body.innerHTML = "";
        localStorage.clear();
        vi.restoreAllMocks();
        vi.resetModules();
        vi.useRealTimers();
        delete globalThis.chrome;
    });

    it("renders provider rows after a successful registry fetch", async () => {
        installPanelChromeMock([
            {
                result: {
                    ok: true,
                    hasMetaVersion: true,
                    version: 1,
                    namespaces: [createNamespace("app", true, [{ key: "theme", value: "dark" }])],
                    livenessSignature: "app:1",
                },
            },
        ]);

        await loadPanelScript();

        expect(document.getElementById("status")?.textContent).toContain("Loaded 1 entry across 1 provider");
        expect(document.getElementById("status")?.textContent).toContain("Auto-refresh off");
        expect(document.getElementById("storage-table-body")?.textContent).toContain("app (1)");
        expect(document.getElementById("storage-table-body")?.textContent).toContain("theme");
        expect(document.getElementById("storage-table-body")?.textContent).toContain("dark");
    });

    it("renders the missing-registry empty state", async () => {
        installPanelChromeMock([
            {
                result: {
                    ok: false,
                    reason: "MISSING_REGISTRY",
                },
            },
        ]);

        await loadPanelScript();

        expect(document.getElementById("status")?.textContent).toContain(
            "Mnemonic DevTools registry is not exposed on this page.",
        );
        expect(document.getElementById("status")?.classList.contains("error")).toBe(true);
        expect(document.getElementById("storage-table-body")?.textContent).toContain(
            "This site is not using react-mnemonic",
        );
    });

    it("retains the last snapshot when a provider becomes unavailable", async () => {
        installPanelChromeMock([
            {
                result: {
                    ok: true,
                    hasMetaVersion: true,
                    version: 1,
                    namespaces: [createNamespace("app", true, [{ key: "theme", value: "dark" }])],
                    livenessSignature: "app:1",
                },
            },
            {
                result: {
                    ok: true,
                    hasMetaVersion: true,
                    version: 2,
                    namespaces: [createNamespace("app", false, [])],
                    livenessSignature: "app:0",
                },
            },
        ]);

        await loadPanelScript();
        click(document.getElementById("refresh-button"));

        expect(document.getElementById("storage-table-body")?.textContent).toContain(
            "Provider no longer available. Showing last captured snapshot.",
        );
        expect(document.getElementById("storage-table-body")?.textContent).toContain("app (provider unavailable)");
        expect(document.getElementById("storage-table-body")?.textContent).toContain("theme");
        expect(document.getElementById("storage-table-body")?.textContent).toContain("dark");
    });

    it("disables auto-refresh when __meta.version is unavailable", async () => {
        installPanelChromeMock([
            {
                result: {
                    ok: true,
                    hasMetaVersion: false,
                    version: 0,
                    namespaces: [],
                    livenessSignature: "",
                },
            },
        ]);

        await loadPanelScript();

        const toggle = document.getElementById("auto-refresh-toggle");
        expect(toggle?.disabled).toBe(true);
        expect(toggle?.title).toContain("__meta.version");
        expect(document.getElementById("status")?.textContent).toContain("Auto-refresh unavailable");
    });

    it("runs a remove mutation and refreshes the rendered rows", async () => {
        const { evalMock } = installPanelChromeMock([
            {
                result: {
                    ok: true,
                    hasMetaVersion: true,
                    version: 1,
                    namespaces: [createNamespace("app", true, [{ key: "theme", value: "dark" }])],
                    livenessSignature: "app:1",
                },
            },
            {
                assertScript(script) {
                    expect(script).toContain('"remove"');
                    expect(script).toContain('"app"');
                    expect(script).toContain('"theme"');
                },
                result: {
                    ok: true,
                },
            },
            {
                result: {
                    ok: true,
                    hasMetaVersion: true,
                    version: 2,
                    namespaces: [createNamespace("app", true, [])],
                    livenessSignature: "app:1",
                },
            },
        ]);

        await loadPanelScript();
        const removeButton = Array.from(document.querySelectorAll("button")).find(
            (button) => button.textContent === "Remove",
        );
        click(removeButton);

        expect(evalMock).toHaveBeenCalledTimes(3);
        expect(document.getElementById("storage-table-body")?.textContent).toContain("(no keys)");
    });

    it("reports provider-unavailable mutation failures and refreshes stale snapshots", async () => {
        const { evalMock } = installPanelChromeMock([
            {
                result: {
                    ok: true,
                    hasMetaVersion: true,
                    version: 1,
                    namespaces: [createNamespace("app", true, [{ key: "theme", value: "dark" }])],
                    livenessSignature: "app:1",
                },
            },
            {
                result: {
                    ok: false,
                    reason: "PROVIDER_UNAVAILABLE",
                },
            },
            {
                result: {
                    ok: true,
                    hasMetaVersion: true,
                    version: 2,
                    namespaces: [createNamespace("app", false, [])],
                    livenessSignature: "app:0",
                },
            },
        ]);

        await loadPanelScript();
        const removeButton = Array.from(document.querySelectorAll("button")).find(
            (button) => button.textContent === "Remove",
        );
        click(removeButton);

        expect(evalMock).toHaveBeenCalledTimes(3);
        expect(document.getElementById("storage-table-body")?.textContent).toContain(
            "Provider no longer available. Showing last captured snapshot.",
        );
    });

    it("polls for version changes and performs a silent refresh", async () => {
        vi.useFakeTimers();
        localStorage.removeItem(AUTO_REFRESH_STORAGE_KEY);

        const { evalMock } = installPanelChromeMock([
            {
                result: {
                    ok: true,
                    hasMetaVersion: true,
                    version: 1,
                    namespaces: [createNamespace("app", true, [{ key: "theme", value: "dark" }])],
                    livenessSignature: "app:1",
                },
            },
            {
                result: {
                    ok: true,
                    version: 2,
                    livenessSignature: "app:1",
                },
            },
            {
                result: {
                    ok: true,
                    hasMetaVersion: true,
                    version: 2,
                    namespaces: [createNamespace("app", true, [{ key: "theme", value: "light" }])],
                    livenessSignature: "app:1",
                },
            },
        ]);

        await loadPanelScript();
        await vi.advanceTimersByTimeAsync(500);

        expect(evalMock).toHaveBeenCalledTimes(3);
        expect(document.getElementById("storage-table-body")?.textContent).toContain("light");
    });
});
