// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { useCallback, useMemo } from "react";
import { useMnemonic } from "./provider";
import { getRuntimeNodeEnv } from "./runtime";
import type {
    MnemonicRecoveryAction,
    MnemonicRecoveryEvent,
    MnemonicRecoveryHook,
    UseMnemonicRecoveryOptions,
} from "./types";

function uniqueKeys(keys: readonly string[]): string[] {
    return [...new Set(keys)];
}

function isDevelopmentRuntime(): boolean {
    return getRuntimeNodeEnv() === "development";
}

const recoveryDiagnosticWarnings = new WeakMap<object, Set<string>>();

function warnRecoveryOnce(api: object, id: string, message: string): void {
    let warnings = recoveryDiagnosticWarnings.get(api);
    if (!warnings) {
        warnings = new Set<string>();
        recoveryDiagnosticWarnings.set(api, warnings);
    }
    if (warnings.has(id)) return;
    warnings.add(id);
    console.warn(message);
}

/**
 * Hook for namespace-scoped recovery actions such as hard reset and selective clear.
 *
 * Applications can use this to offer self-service recovery UX for corrupt or
 * legacy persisted state. The hook operates on the current provider namespace.
 *
 * See the
 * [Reset and Recovery guide](https://thirtytwobits.github.io/react-mnemonic/docs/guides/reset-and-recovery)
 * for soft-reset and hard-reset patterns.
 *
 * @param options - Optional recovery callback for telemetry/auditing
 * @returns Namespace recovery helpers
 *
 * @throws {Error} If used outside of a MnemonicProvider
 */
export function useMnemonicRecovery(options: UseMnemonicRecoveryOptions = {}): MnemonicRecoveryHook {
    const api = useMnemonic();
    const { onRecover } = options;

    const namespace = useMemo(() => (api.prefix.endsWith(".") ? api.prefix.slice(0, -1) : api.prefix), [api.prefix]);

    const emitRecovery = useCallback(
        (action: MnemonicRecoveryAction, clearedKeys: string[]) => {
            const event: MnemonicRecoveryEvent = {
                action,
                namespace,
                clearedKeys,
            };
            onRecover?.(event);
        },
        [namespace, onRecover],
    );

    const listKeys = useCallback(() => api.keys(), [api]);

    const clearResolvedKeys = useCallback(
        (action: MnemonicRecoveryAction, keys: readonly string[]) => {
            const clearedKeys = uniqueKeys(keys);
            for (const key of clearedKeys) {
                api.removeRaw(key);
            }
            emitRecovery(action, clearedKeys);
            return clearedKeys;
        },
        [api, emitRecovery],
    );

    const clearKeys = useCallback(
        (keys: readonly string[]) => clearResolvedKeys("clear-keys", keys),
        [clearResolvedKeys],
    );

    const clearAll = useCallback(() => {
        if (!api.canEnumerateKeys) {
            if (isDevelopmentRuntime()) {
                warnRecoveryOnce(
                    api,
                    "recovery-clear-all-non-enumerable",
                    `[Mnemonic] clearAll() requires an enumerable storage backend in namespace "${namespace}". Use clearKeys([...]) with an explicit durable-key list, or supply a storage backend that implements length and key(index).`,
                );
            }
            throw new Error(
                "clearAll requires an enumerable storage backend. Use clearKeys([...]) with an explicit key list instead.",
            );
        }
        return clearResolvedKeys("clear-all", api.keys());
    }, [api, clearResolvedKeys, namespace]);

    const clearMatching = useCallback(
        (predicate: (key: string) => boolean) => {
            if (!api.canEnumerateKeys) {
                if (isDevelopmentRuntime()) {
                    warnRecoveryOnce(
                        api,
                        "recovery-clear-matching-non-enumerable",
                        `[Mnemonic] clearMatching() requires an enumerable storage backend in namespace "${namespace}". Use clearKeys([...]) with an explicit durable-key list, or supply a storage backend that implements length and key(index).`,
                    );
                }
                throw new Error(
                    "clearMatching requires an enumerable storage backend. Use clearKeys([...]) with an explicit key list instead.",
                );
            }
            return clearResolvedKeys(
                "clear-matching",
                api.keys().filter((key) => predicate(key)),
            );
        },
        [api, clearResolvedKeys, namespace],
    );

    return useMemo(
        () => ({
            namespace,
            canEnumerateKeys: api.canEnumerateKeys,
            listKeys,
            clearAll,
            clearKeys,
            clearMatching,
        }),
        [namespace, api.canEnumerateKeys, listKeys, clearAll, clearKeys, clearMatching],
    );
}
