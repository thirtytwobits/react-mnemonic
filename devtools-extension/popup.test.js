import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function createPopupDom() {
    document.body.innerHTML = `
        <main class="popup">
            <section id="message-card" class="card" role="status" aria-live="polite">
                <h1 id="message-title">Checking page access...</h1>
                <p id="message-body"></p>
            </section>
            <p id="page-url" class="url"></p>
        </main>
    `;
}

function flushMicrotasks() {
    return Promise.resolve().then(() => Promise.resolve());
}

function installChromePopupMock({ queryResult, queryError, executeResult, executeError }) {
    const tabsQuery = vi.fn();
    const executeScript = vi.fn();

    if (queryError) {
        tabsQuery.mockRejectedValue(queryError);
    } else {
        tabsQuery.mockResolvedValue(queryResult ?? []);
    }

    if (executeError) {
        executeScript.mockRejectedValue(executeError);
    } else {
        executeScript.mockResolvedValue(executeResult ?? []);
    }

    globalThis.chrome = {
        tabs: {
            query: tabsQuery,
        },
        scripting: {
            executeScript,
        },
    };

    return { tabsQuery, executeScript };
}

async function loadPopupScript() {
    vi.resetModules();
    await import("./popup.js");
    await flushMicrotasks();
}

describe("devtools extension popup", () => {
    beforeEach(() => {
        createPopupDom();
    });

    afterEach(() => {
        document.body.innerHTML = "";
        vi.restoreAllMocks();
        vi.resetModules();
        delete globalThis.chrome;
    });

    it("shows a restricted-page message without probing the page", async () => {
        const { executeScript } = installChromePopupMock({
            queryResult: [{ id: 7, url: "chrome://settings" }],
        });

        await loadPopupScript();

        expect(document.getElementById("message-title")?.textContent).toBe("This is a restricted browser page.");
        expect(document.getElementById("message-body")?.textContent).toContain("cannot access this page");
        expect(document.getElementById("page-url")?.textContent).toContain("chrome://settings");
        expect(document.getElementById("message-card")?.classList.contains("restricted")).toBe(true);
        expect(executeScript).not.toHaveBeenCalled();
    });

    it("shows a missing-registry message when the inspected page does not expose devtools", async () => {
        const { executeScript } = installChromePopupMock({
            queryResult: [{ id: 8, url: "https://example.com/app" }],
            executeResult: [{ result: { ok: false, reason: "MISSING_REGISTRY" } }],
        });

        await loadPopupScript();

        expect(document.getElementById("message-title")?.textContent).toBe(
            "This site is not exposing Mnemonic DevTools.",
        );
        expect(document.getElementById("message-body")?.textContent).toContain("enableDevTools disabled");
        expect(document.getElementById("message-card")?.classList.contains("restricted")).toBe(true);
        expect(executeScript).toHaveBeenCalledTimes(1);
    });

    it("shows an incompatible-registry message for older devtools shapes", async () => {
        installChromePopupMock({
            queryResult: [{ id: 9, url: "https://example.com/app" }],
            executeResult: [{ result: { ok: false, reason: "INCOMPATIBLE_REGISTRY" } }],
        });

        await loadPopupScript();

        expect(document.getElementById("message-title")?.textContent).toBe(
            "Mnemonic DevTools registry is incompatible.",
        );
        expect(document.getElementById("message-body")?.textContent).toContain("older devtools shape");
    });

    it("reports live and stale providers when devtools are available", async () => {
        installChromePopupMock({
            queryResult: [{ id: 10, url: "https://example.com/app" }],
            executeResult: [
                {
                    result: {
                        ok: true,
                        weakRefSupported: true,
                        finalizationRegistrySupported: true,
                        providerStatuses: [
                            { namespace: "app", available: true },
                            { namespace: "stale", available: false },
                        ],
                    },
                },
            ],
        });

        await loadPopupScript();

        expect(document.getElementById("message-title")?.textContent).toBe("Mnemonic providers detected.");
        expect(document.getElementById("message-body")?.textContent).toContain("Live: app.");
        expect(document.getElementById("message-body")?.textContent).toContain("Stale: stale.");
        expect(document.getElementById("message-card")?.classList.contains("restricted")).toBe(false);
    });

    it("shows a WeakRef diagnostic when registry inspection is unavailable", async () => {
        installChromePopupMock({
            queryResult: [{ id: 11, url: "https://example.com/app" }],
            executeResult: [
                {
                    result: {
                        ok: true,
                        weakRefSupported: false,
                        finalizationRegistrySupported: true,
                        providerStatuses: [],
                    },
                },
            ],
        });

        await loadPopupScript();

        expect(document.getElementById("message-title")?.textContent).toBe("Weak registry support is unavailable.");
        expect(document.getElementById("message-body")?.textContent).toContain("does not support WeakRef");
        expect(document.getElementById("message-card")?.classList.contains("restricted")).toBe(true);
    });

    it("surfaces popup probe failures as a diagnostic message", async () => {
        installChromePopupMock({
            queryError: new Error("tabs query failed"),
        });

        await loadPopupScript();

        expect(document.getElementById("message-title")?.textContent).toBe("Unable to determine page access.");
        expect(document.getElementById("message-body")?.textContent).toContain("tabs query failed");
        expect(document.getElementById("message-card")?.classList.contains("restricted")).toBe(true);
    });
});
