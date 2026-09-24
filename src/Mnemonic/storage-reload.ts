// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * @fileoverview Internal channel from wherever an external change is observed
 * to the provider that can re-read keys from its storage backend.
 *
 * A custom backend reports changes to the provider through `onExternalChange`,
 * but the browser's `storage` event is heard by hooks that opted into
 * `listenCrossTab`, and those only hold a {@link Mnemonic} store. Rather than
 * widen the public store type with a reload method, the provider registers its
 * reload here, keyed by store identity.
 *
 * A WeakMap keeps this from retaining stores past their provider's lifetime.
 */

import type { Mnemonic } from "./types";

/**
 * Re-reads keys from storage into the cache and notifies subscribers of the
 * ones that changed.
 *
 * @param changedKeys - Fully-qualified storage keys to re-read. When
 *   undefined, every subscribed key is re-read.
 */
export type StorageReload = (changedKeys?: string[]) => void;

const reloads = new WeakMap<Mnemonic, StorageReload>();

/**
 * Points a store at the reload of the provider that created it.
 *
 * Called once per store, by that provider.
 */
export function registerStorageReload(store: Mnemonic, reload: StorageReload): void {
    reloads.set(store, reload);
}

/**
 * Brings a store's cache back in line with its storage backend after a change
 * made elsewhere.
 *
 * Reads storage and never writes it: the backend already holds the change, and
 * writing back what was observed would overwrite anything stored since.
 *
 * @param store - Store whose keys changed outside this document
 * @param changedKeys - Fully-qualified storage keys that changed, or undefined
 *   when the backend cannot say which
 */
export function reloadFromStorage(store: Mnemonic, changedKeys?: string[]): void {
    reloads.get(store)?.(changedKeys);
}
