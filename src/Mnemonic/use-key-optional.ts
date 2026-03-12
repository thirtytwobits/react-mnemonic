// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toPublicMnemonicOptionalBridge, useMnemonicOptionalBridge } from "./optional-bridge";
import type {
    MnemonicKeyState,
    MnemonicOptionalBridge,
    OptionalMnemonicKeyDescriptor,
    OptionalMnemonicKeyOptions,
} from "./types";

const SSR_SNAPSHOT_TOKEN = Symbol("mnemonic:optional-ssr-snapshot");

function resolveOptionalDescriptor<T>(
    keyOrDescriptor: string | OptionalMnemonicKeyDescriptor<T, string>,
    options?: OptionalMnemonicKeyOptions<T>,
): OptionalMnemonicKeyDescriptor<T, string> {
    if (typeof keyOrDescriptor !== "string") {
        return keyOrDescriptor;
    }
    if (!options) {
        throw new Error("useMnemonicKeyOptional requires options when called with a string key");
    }
    return {
        key: keyOrDescriptor,
        options,
    };
}

function resolveOptionalDefaultValue<T>(defaultValue: OptionalMnemonicKeyOptions<T>["defaultValue"]): T {
    return typeof defaultValue === "function" ? (defaultValue as () => T)() : defaultValue;
}

function resolveOptionalServerValue<T>(options: OptionalMnemonicKeyOptions<T>): T {
    const serverValue = options.ssr?.serverValue;
    if (serverValue !== undefined) {
        return typeof serverValue === "function" ? (serverValue as () => T)() : serverValue;
    }
    return resolveOptionalDefaultValue(options.defaultValue);
}

export function useMnemonicOptional(): MnemonicOptionalBridge | null {
    const bridge = useMnemonicOptionalBridge();
    return useMemo(() => toPublicMnemonicOptionalBridge(bridge), [bridge]);
}

export function useMnemonicKeyOptional<T, K extends string>(
    descriptor: OptionalMnemonicKeyDescriptor<T, K>,
): MnemonicKeyState<T>;
export function useMnemonicKeyOptional<T>(key: string, options: OptionalMnemonicKeyOptions<T>): MnemonicKeyState<T>;
export function useMnemonicKeyOptional<T>(
    keyOrDescriptor: string | OptionalMnemonicKeyDescriptor<T, string>,
    options?: OptionalMnemonicKeyOptions<T>,
): MnemonicKeyState<T> {
    const bridge = useMnemonicOptionalBridge();
    const descriptor = resolveOptionalDescriptor(keyOrDescriptor, options);
    const key = descriptor.key;
    const resolvedOptions = descriptor.options;
    const { defaultValue, onMount, onChange } = resolvedOptions;
    const hasBridge = bridge !== null;

    const getFallback = useCallback(() => resolveOptionalDefaultValue(defaultValue), [defaultValue]);
    const getServerValue = useCallback(() => resolveOptionalServerValue(resolvedOptions), [resolvedOptions]);

    const [memoryValue, setMemoryValue] = useState<T>(() => getServerValue());
    const raw = useSyncExternalStore<string | null | typeof SSR_SNAPSHOT_TOKEN>(
        useCallback(
            (listener: () => void) => {
                if (!bridge) {
                    return () => undefined;
                }
                return bridge.subscribeRaw(key, listener);
            },
            [bridge, key],
        ),
        useCallback(() => (bridge ? bridge.getRawSnapshot(key) : null), [bridge, key]),
        useCallback(
            () => (resolvedOptions.ssr?.serverValue === undefined ? null : SSR_SNAPSHOT_TOKEN),
            [resolvedOptions.ssr?.serverValue],
        ),
    );

    const bridgeSnapshot = useMemo(() => {
        if (!bridge) {
            return null;
        }
        if (raw === SSR_SNAPSHOT_TOKEN) {
            return {
                value: getServerValue(),
            };
        }
        return bridge.decodeSnapshot(key, raw, resolvedOptions);
    }, [bridge, getServerValue, key, raw, resolvedOptions]);

    useEffect(() => {
        if (!bridge || !bridgeSnapshot || raw === SSR_SNAPSHOT_TOKEN) {
            return;
        }
        bridge.commitSnapshot(key, raw, bridgeSnapshot);
    }, [bridge, bridgeSnapshot, key, raw]);

    const value = hasBridge ? (bridgeSnapshot?.value ?? memoryValue) : memoryValue;

    const mountedRef = useRef(false);
    const previousRef = useRef(value);

    useEffect(() => {
        if (mountedRef.current) {
            return;
        }
        mountedRef.current = true;
        onMount?.(value);
        previousRef.current = value;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const previous = previousRef.current;
        if (Object.is(previous, value)) {
            return;
        }
        previousRef.current = value;
        onChange?.(value, previous);
    }, [onChange, value]);

    const set = useMemo<MnemonicKeyState<T>["set"]>(
        () => (next) => {
            if (bridge) {
                const nextValue =
                    typeof next === "function"
                        ? (next as (current: T) => T)(
                              bridge.decodeSnapshot(key, bridge.getRawSnapshot(key), resolvedOptions).value,
                          )
                        : next;
                bridge.setValue(key, nextValue, resolvedOptions);
                return;
            }

            setMemoryValue((current) => (typeof next === "function" ? (next as (current: T) => T)(current) : next));
        },
        [bridge, key, resolvedOptions],
    );

    const reset = useMemo<MnemonicKeyState<T>["reset"]>(
        () => () => {
            if (bridge) {
                bridge.setValue(key, getFallback(), resolvedOptions);
                return;
            }
            setMemoryValue(getFallback());
        },
        [bridge, getFallback, key, resolvedOptions],
    );

    const remove = useMemo<MnemonicKeyState<T>["remove"]>(
        () => () => {
            if (bridge) {
                bridge.removeValue(key);
                return;
            }
            setMemoryValue(getFallback());
        },
        [bridge, getFallback, key],
    );

    return useMemo(
        () => ({
            value,
            set,
            reset,
            remove,
        }),
        [remove, reset, set, value],
    );
}
