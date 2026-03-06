// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { useCallback, useMemo } from "react";
import { useMnemonic } from "./provider";
import type {
    MnemonicRecoveryAction,
    MnemonicRecoveryEvent,
    MnemonicRecoveryHook,
    UseMnemonicRecoveryOptions,
} from "./types";

function uniqueKeys(keys: readonly string[]): string[] {
    return [...new Set(keys)];
}

/**
 * Hook for namespace-scoped recovery actions such as hard reset and selective clear.
 *
 * Applications can use this to offer self-service recovery UX for corrupt or
 * legacy persisted state. The hook operates on the current provider namespace.
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
            throw new Error(
                "clearAll requires an enumerable storage backend. Use clearKeys([...]) with an explicit key list instead.",
            );
        }
        return clearResolvedKeys("clear-all", api.keys());
    }, [api, clearResolvedKeys]);

    const clearMatching = useCallback(
        (predicate: (key: string) => boolean) => {
            if (!api.canEnumerateKeys) {
                throw new Error(
                    "clearMatching requires an enumerable storage backend. Use clearKeys([...]) with an explicit key list instead.",
                );
            }
            return clearResolvedKeys(
                "clear-matching",
                api.keys().filter((key) => predicate(key)),
            );
        },
        [api, clearResolvedKeys],
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
