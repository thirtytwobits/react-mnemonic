// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { createContext, useContext, type Context } from "react";
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

const OPTIONAL_BRIDGE_CONTEXT_KEY = Symbol.for("react-mnemonic.optional-bridge-context");

function getMnemonicOptionalBridgeContext(): Context<MnemonicOptionalBridgeInternal | null> {
    const globalStore = globalThis as typeof globalThis & {
        [key: symbol]: unknown;
    };
    const existing = globalStore[OPTIONAL_BRIDGE_CONTEXT_KEY];

    if (existing) {
        return existing as Context<MnemonicOptionalBridgeInternal | null>;
    }

    const context = createContext<MnemonicOptionalBridgeInternal | null>(null);
    globalStore[OPTIONAL_BRIDGE_CONTEXT_KEY] = context;
    return context;
}

export const MnemonicOptionalBridgeContext = getMnemonicOptionalBridgeContext();

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
