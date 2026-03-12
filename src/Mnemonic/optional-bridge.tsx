// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { createContext, useContext } from "react";
import type { KeySchema, Listener, MnemonicOptionalBridge, OptionalMnemonicKeyOptions, Unsubscribe } from "./types";

export type OptionalReadResult<T> = {
    value: T;
    rewriteRaw?: string;
    pendingSchema?: KeySchema;
};

export interface MnemonicOptionalBridgeInternal extends MnemonicOptionalBridge {
    subscribeRaw(key: string, listener: Listener): Unsubscribe;
    getRawSnapshot(key: string): string | null;
    decodeSnapshot<T>(key: string, raw: string | null, options: OptionalMnemonicKeyOptions<T>): OptionalReadResult<T>;
    setValue<T>(key: string, nextValue: T, options: OptionalMnemonicKeyOptions<T>): void;
    removeValue(key: string): void;
    commitSnapshot<T>(key: string, raw: string | null, snapshot: OptionalReadResult<T>): void;
}

export const MnemonicOptionalBridgeContext = createContext<MnemonicOptionalBridgeInternal | null>(null);

export function useMnemonicOptionalBridge(): MnemonicOptionalBridgeInternal | null {
    return useContext(MnemonicOptionalBridgeContext);
}

export function toPublicMnemonicOptionalBridge(
    bridge: MnemonicOptionalBridgeInternal | null,
): MnemonicOptionalBridge | null {
    if (!bridge) {
        return null;
    }
    return {
        namespace: bridge.namespace,
        capabilities: bridge.capabilities,
    };
}
