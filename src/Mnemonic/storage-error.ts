// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * @fileoverview Internal channel carrying dropped-write reports from wherever a
 * mutation fails to the provider's `onStorageError` callback.
 *
 * Storage-level failures are detected inside the provider, but schema and codec
 * failures happen in hook code that only holds a {@link Mnemonic} store. Rather
 * than widen the public store type with a reporting method, the provider
 * registers its reporter here, keyed by store identity, and every failure site
 * calls {@link reportStorageError} without knowing whether a provider opted in.
 *
 * A WeakMap keeps this from retaining stores past their provider's lifetime.
 */

import type { MnemonicStorageErrorEvent } from "./types";

type StorageErrorReporter = (event: MnemonicStorageErrorEvent) => void;

const reporters = new WeakMap<object, StorageErrorReporter>();
const reportersThatThrew = new WeakSet<object>();
const reportingNow = new WeakSet<object>();

/**
 * Points a store at the callback that should receive its dropped writes.
 *
 * Called once per store, by the provider that created it. A store with no
 * registered reporter — one whose provider did not pass `onStorageError` —
 * makes {@link reportStorageError} a no-op.
 */
export function registerStorageErrorReporter(store: object, reporter: StorageErrorReporter): void {
    reporters.set(store, reporter);
}

/**
 * Delivers a dropped-write report to the store's provider, if it wants one.
 *
 * Two things a consumer handler must not be able to do are contained here, so
 * every failure site gets the same protection:
 *
 * - **Throw.** The mutation has already been applied to the cache and queued
 *   for retry by the time this runs, so an exception from the handler must not
 *   unwind into it. It is swallowed and reported once per store, so a handler
 *   that throws on every write does not bury the console.
 * - **Recurse.** A handler that writes to the store can drop that write too.
 *   A report raised while one is already in flight for the same store is
 *   dropped rather than delivered; the mutation still completes and is still
 *   listed by `unpersistedKeys()`, so nothing becomes invisible.
 *
 * @param store - Store the mutation belonged to, or `undefined` when there is
 *   no provider at all (an optional hook running standalone)
 * @param event - The mutation that was dropped
 */
export function reportStorageError(store: object | undefined, event: MnemonicStorageErrorEvent): void {
    if (!store) return;
    const reporter = reporters.get(store);
    if (!reporter) return;
    if (reportingNow.has(store)) return;

    reportingNow.add(store);
    try {
        reporter(event);
    } catch (error) {
        if (reportersThatThrew.has(store)) return;
        reportersThatThrew.add(store);
        console.error(
            "[Mnemonic] onStorageError threw while reporting a dropped write. " +
                "The mutation completed and the key is still queued for flush(). " +
                "Further throws from this handler are suppressed.",
            error,
        );
    } finally {
        reportingNow.delete(store);
    }
}
