// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import type { StorageLike } from "./types";

declare const process: { env?: { NODE_ENV?: string } } | undefined;

type RuntimeProcess = { env?: { NODE_ENV?: string } };

function getGlobalProcess(): RuntimeProcess | undefined {
    return (globalThis as { process?: RuntimeProcess }).process;
}

export function getRuntimeNodeEnv(): string | undefined {
    const runtimeProcess = getGlobalProcess();
    if (runtimeProcess?.env?.NODE_ENV !== undefined) {
        return runtimeProcess.env.NODE_ENV;
    }
    return undefined;
}

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
