// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { createStore, entries } from "idb-keyval";
import type { StorageLike } from "react-mnemonic";

/**
 * Reserved IDB key for the monotonic revision counter.
 * Stored in the same object store as user data.
 */
const REV_KEY = "__idb_storage_rev__";

/**
 * Creates a StorageLike adapter backed by IndexedDB via idb-keyval.
 *
 * All IDB entries are pre-loaded into an in-memory Map on init so that
 * getItem (which the MnemonicProvider calls synchronously) returns instantly.
 *
 * **Write path** — setItem/removeItem update the in-memory map immediately
 * (preserving the synchronous StorageLike contract), then queue the write for
 * an asynchronous CAS (compare-and-swap) flush.
 *
 * **Receive path** — When a BroadcastChannel message arrives with a newer
 * revision, the adapter re-reads all entries from IDB, rebuilds the in-memory
 * map, and notifies external-change listeners.
 */
export async function createIdbStorage(
    dbName: string = "react-mnemonic",
    storeName: string = "kv",
): Promise<StorageLike> {
    const idbStore = createStore(dbName, storeName);

    const map = new Map<string, string>();
    let localRev = 0;
    let pending = new Map<string, string | null>();
    let flushScheduled = false;
    const externalListeners = new Set<() => void>();

    const all = await entries<string, string>(idbStore);
    let revFound = false;
    for (const [k, v] of all) {
        if (k === REV_KEY) {
            localRev = Number(v) || 0;
            revFound = true;
        } else {
            map.set(k as string, v);
        }
    }

    if (!revFound) {
        await idbStore("readwrite", (os) => {
            os.put(String(0), REV_KEY);
            return new Promise<void>((resolve, reject) => {
                os.transaction.oncomplete = () => resolve();
                os.transaction.onerror = () => reject(os.transaction.error);
            });
        });
    }

    const channelName = `idb-storage:${dbName}:${storeName}`;
    const bc =
        typeof BroadcastChannel !== "undefined"
            ? new BroadcastChannel(channelName)
            : null;

    const notifyExternal = () => {
        for (const fn of externalListeners) {
            try {
                fn();
            } catch {
                // subscriber errors must not break the adapter
            }
        }
    };

    const resyncFromIdb = async () => {
        const fresh = await entries<string, string>(idbStore);
        map.clear();
        for (const [k, v] of fresh) {
            if (k === REV_KEY) {
                localRev = Number(v) || 0;
            } else {
                map.set(k as string, v);
            }
        }
    };

    const flush = async () => {
        flushScheduled = false;
        if (pending.size === 0) return;

        const batch = pending;
        pending = new Map();

        try {
            const committed: boolean = await idbStore(
                "readwrite",
                (os: IDBObjectStore) => {
                    return new Promise<boolean>((resolve, reject) => {
                        const revReq = os.get(REV_KEY);
                        revReq.onsuccess = () => {
                            const currentRev = Number(revReq.result) || 0;
                            if (currentRev !== localRev) {
                                os.transaction.oncomplete = () => resolve(false);
                                os.transaction.onerror = () => reject(os.transaction.error);
                                return;
                            }
                            for (const [key, value] of batch) {
                                if (value === null) {
                                    os.delete(key);
                                } else {
                                    os.put(value, key);
                                }
                            }
                            os.put(String(currentRev + 1), REV_KEY);
                            os.transaction.oncomplete = () => resolve(true);
                            os.transaction.onerror = () => reject(os.transaction.error);
                        };
                        revReq.onerror = () => reject(revReq.error);
                    });
                },
            );

            if (committed) {
                localRev += 1;
                bc?.postMessage({ rev: localRev });
            } else {
                await resyncFromIdb();
                notifyExternal();
            }
        } catch (err) {
            console.warn("[idb-storage] CAS flush failed, resyncing:", err);
            await resyncFromIdb();
            notifyExternal();
        }
    };

    const scheduleFlush = () => {
        if (flushScheduled) return;
        flushScheduled = true;
        queueMicrotask(flush);
    };

    if (bc) {
        bc.onmessage = async (e: MessageEvent<{ rev: number }>) => {
            const { rev } = e.data;
            if (rev <= localRev) return;
            await resyncFromIdb();
            notifyExternal();
        };
    }

    const storage: StorageLike = {
        getItem(key: string): string | null {
            return map.get(key) ?? null;
        },
        setItem(key: string, value: string): void {
            map.set(key, value);
            pending.set(key, value);
            scheduleFlush();
        },
        removeItem(key: string): void {
            map.delete(key);
            pending.set(key, null);
            scheduleFlush();
        },
        get length(): number {
            return map.size;
        },
        key(index: number): string | null {
            return Array.from(map.keys())[index] ?? null;
        },
        onExternalChange(callback: () => void): () => void {
            externalListeners.add(callback);
            return () => {
                externalListeners.delete(callback);
            };
        },
    };

    return storage;
}
