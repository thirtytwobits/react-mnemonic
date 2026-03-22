// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import type { StorageLike } from "./types";

type RuntimeProcess = { env?: { NODE_ENV?: string } };

function getGlobalProcess(): RuntimeProcess | undefined {
    return (globalThis as { process?: RuntimeProcess }).process;
}

/**
 * Reads `process.env.NODE_ENV` when it is available in the current runtime.
 *
 * This stays tolerant of browser-only and edge runtimes where `process` may
 * be absent entirely.
 */
export function getRuntimeNodeEnv(): string | undefined {
    const runtimeProcess = getGlobalProcess();
    if (runtimeProcess?.env?.NODE_ENV !== undefined) {
        return runtimeProcess.env.NODE_ENV;
    }
    return undefined;
}

/**
 * Returns the browser's default persistent storage backend when it is
 * synchronously accessible.
 *
 * Access can fail in restricted browsing modes or server environments, so the
 * helper returns `undefined` instead of throwing.
 */
export function getDefaultBrowserStorage(): StorageLike | undefined {
    const globalWindow = (globalThis as { window?: Window }).window;
    if (globalWindow === undefined) return undefined;
    try {
        return globalWindow.localStorage;
    } catch {
        return undefined;
    }
}

/**
 * Returns the native browser storage backends that are currently accessible.
 *
 * This is used for cross-tab sync detection and DevTools integration, so
 * blocked storages are ignored rather than surfaced as runtime errors.
 */
export function getNativeBrowserStorages(): StorageLike[] {
    const globalWindow = (globalThis as { window?: Window }).window;
    if (!globalWindow) return [];

    const storages: StorageLike[] = [];
    const addStorage = (getter: () => StorageLike) => {
        try {
            storages.push(getter());
        } catch {
            // Ignore blocked browser storage access and continue probing others.
        }
    };

    addStorage(() => globalWindow.localStorage);
    addStorage(() => globalWindow.sessionStorage);
    return storages;
}
