import { afterEach, describe, expect, it, vi } from "vitest";

async function loadDevtoolsScript() {
    vi.resetModules();
    await import("./devtools.js");
}

describe("devtools extension bootstrap", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
        delete globalThis.chrome;
    });

    it("creates the react-mnemonic devtools panel", async () => {
        const create = vi.fn((title, icon, page, callback) => {
            expect(title).toBe("react-mnemonic");
            expect(icon).toBe("assets/logo.svg");
            expect(page).toBe("panel.html");
            callback();
        });

        globalThis.chrome = {
            devtools: {
                panels: {
                    create,
                },
            },
            runtime: {},
        };

        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await loadDevtoolsScript();

        expect(create).toHaveBeenCalledTimes(1);
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it("logs chrome.runtime.lastError when panel creation reports a browser error", async () => {
        const create = vi.fn((_, __, ___, callback) => {
            globalThis.chrome.runtime.lastError = { message: "panel failed" };
            callback();
        });

        globalThis.chrome = {
            devtools: {
                panels: {
                    create,
                },
            },
            runtime: {
                lastError: null,
            },
        };

        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await loadDevtoolsScript();

        expect(errorSpy).toHaveBeenCalledWith("[react-mnemonic devtools] Failed to create panel:", "panel failed");
    });

    it("logs unexpected create-panel exceptions", async () => {
        globalThis.chrome = {
            devtools: {
                panels: {
                    create: vi.fn(() => {
                        throw new Error("boom");
                    }),
                },
            },
            runtime: {},
        };

        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await loadDevtoolsScript();

        expect(errorSpy).toHaveBeenCalledWith(
            "[react-mnemonic devtools] Unexpected error creating panel:",
            expect.any(Error),
        );
    });
});
