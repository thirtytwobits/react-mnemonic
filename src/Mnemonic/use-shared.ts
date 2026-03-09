// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { useSyncExternalStore, useMemo, useEffect, useRef, useCallback, useState } from "react";
import { useMnemonic } from "./provider";
import { JSONCodec, CodecError } from "./codecs";
import { SchemaError, type MnemonicEnvelope } from "./schema";
import { getRuntimeNodeEnv } from "./runtime";
import type { Mnemonic, MnemonicKeyDescriptor, MnemonicKeyState, UseMnemonicKeyOptions } from "./types";

export type ReadResult<T, Extra extends object = {}> = {
    value: T;
    rewriteRaw?: string;
} & Extra;

type SharedMnemonicKeyContext<T> = {
    api: Mnemonic;
    key: string;
    codec: NonNullable<UseMnemonicKeyOptions<T>["codec"]>;
    codecOpt: UseMnemonicKeyOptions<T>["codec"];
    schema: UseMnemonicKeyOptions<T>["schema"];
    reconcile: UseMnemonicKeyOptions<T>["reconcile"];
    onMount: UseMnemonicKeyOptions<T>["onMount"];
    onChange: UseMnemonicKeyOptions<T>["onChange"];
    listenCrossTab: UseMnemonicKeyOptions<T>["listenCrossTab"];
    getFallback: (error?: CodecError | SchemaError) => T;
    getServerValue: () => T;
    parseEnvelope: (rawText: string) =>
        | {
              ok: true;
              envelope: MnemonicEnvelope;
          }
        | {
              ok: false;
              error: SchemaError;
          };
    decodeStringPayload: <V>(payload: string, activeCodec: { decode: (encoded: string) => V }) => V;
    buildFallbackResult: <Extra extends object = {}>(
        error?: CodecError | SchemaError,
        extra?: Extra,
    ) => ReadResult<T, Extra>;
    developmentRuntime: boolean;
    contractFingerprint: string | null;
    hasMounted: boolean;
    setHasMounted: (value: boolean) => void;
    hydrationMode: NonNullable<UseMnemonicKeyOptions<T>["ssr"]>["hydration"] | undefined;
    ssrOptions: UseMnemonicKeyOptions<T>["ssr"];
};

type UseMnemonicKeyStateConfig<T, Extra extends object> = {
    decodeForRead: (rawText: string | null) => ReadResult<T, Extra>;
    encodeForWrite: (nextValue: T) => string;
    additionalDevWarnings?: (args: {
        api: Mnemonic;
        key: string;
        listenCrossTab: UseMnemonicKeyOptions<T>["listenCrossTab"];
        codecOpt: UseMnemonicKeyOptions<T>["codec"];
        schema: UseMnemonicKeyOptions<T>["schema"];
        warnOnce: (id: string, message: string) => void;
    }) => void;
    onDecodedEffect?: (decoded: ReadResult<T, Extra>) => void;
};

type ApplyReconcileArgs<T, Extra extends object> = {
    value: T;
    rewriteRaw?: string;
    extra?: Extra;
    persistedVersion: number;
    latestVersion?: number;
    serializeForPersist: (value: T) => string;
    deriveExtra?: (value: T, extra?: Extra) => Extra | undefined;
};

const SSR_SNAPSHOT_TOKEN = Symbol("mnemonic:ssr-snapshot");
const diagnosticContractRegistry = new WeakMap<object, Map<string, string>>();
const diagnosticWarningRegistry = new WeakMap<object, Set<string>>();
const diagnosticObjectIds = new WeakMap<object, number>();
let nextDiagnosticObjectId = 1;

export function serializeEnvelope(version: number, payload: unknown): string {
    return JSON.stringify({
        version,
        payload,
    } satisfies MnemonicEnvelope);
}

export function withReadMetadata<T, Extra extends object = {}>(
    value: T,
    rewriteRaw?: string,
    extra?: Extra,
): ReadResult<T, Extra> {
    const result = {
        value,
        ...(extra ?? {}),
    } as ReadResult<T, Extra>;
    if (rewriteRaw !== undefined) result.rewriteRaw = rewriteRaw;
    return result;
}

function isDevelopmentRuntime(): boolean {
    return getRuntimeNodeEnv() === "development";
}

function getDiagnosticWarnings(api: object): Set<string> {
    let warnings = diagnosticWarningRegistry.get(api);
    if (!warnings) {
        warnings = new Set<string>();
        diagnosticWarningRegistry.set(api, warnings);
    }
    return warnings;
}

function warnOnce(api: object, id: string, message: string): void {
    const warnings = getDiagnosticWarnings(api);
    if (warnings.has(id)) return;
    warnings.add(id);
    console.warn(message);
}

function stableDiagnosticValue(value: unknown): string {
    if (typeof value === "function") {
        const source = Function.prototype.toString.call(value).split(/\s+/).join(" ").trim();
        const name = value.name || "anonymous";
        return `[factory:${name}/${value.length}:${source}]`;
    }
    if (typeof value === "bigint") return `${value.toString()}n`;
    if (typeof value === "symbol") return value.toString();
    if (value === undefined) return "undefined";
    try {
        return JSON.stringify(value);
    } catch {
        const tag = Object.prototype.toString.call(value);
        if (value !== null && (typeof value === "object" || typeof value === "function")) {
            return `${tag}#${getDiagnosticObjectId(value)}`;
        }
        return tag;
    }
}

function isObjectLike(value: unknown): value is object {
    return value !== null && (typeof value === "object" || typeof value === "function");
}

function objectHasOwn(value: object, property: PropertyKey): boolean {
    const hasOwn = (Object as typeof Object & { hasOwn?: (target: object, key: PropertyKey) => boolean }).hasOwn;
    if (typeof hasOwn === "function") {
        return hasOwn(value, property);
    }
    return Object.getOwnPropertyDescriptor(value, property) !== undefined;
}

function getDiagnosticObjectId(value: object): number {
    const existing = diagnosticObjectIds.get(value);
    if (existing !== undefined) return existing;
    const id = nextDiagnosticObjectId++;
    diagnosticObjectIds.set(value, id);
    return id;
}

function buildContractFingerprint<T>({
    api,
    key,
    defaultValue,
    codecOpt,
    schemaVersion,
    reconcile,
    listenCrossTab,
    ssrOptions,
}: {
    api: object;
    key: string;
    defaultValue: UseMnemonicKeyOptions<T>["defaultValue"];
    codecOpt: UseMnemonicKeyOptions<T>["codec"];
    schemaVersion?: number;
    reconcile: UseMnemonicKeyOptions<T>["reconcile"];
    listenCrossTab: UseMnemonicKeyOptions<T>["listenCrossTab"];
    ssrOptions: UseMnemonicKeyOptions<T>["ssr"];
}): string {
    const codecSignature =
        codecOpt == null || !isObjectLike(codecOpt)
            ? "default-json-codec"
            : `codec:${stableDiagnosticValue((codecOpt as { encode?: unknown }).encode)}:${stableDiagnosticValue((codecOpt as { decode?: unknown }).decode)}`;
    const reconcileSignature =
        reconcile == null || !isObjectLike(reconcile)
            ? "no-reconcile"
            : `reconcile:${stableDiagnosticValue(reconcile)}`;

    return JSON.stringify({
        key,
        defaultValue: stableDiagnosticValue(defaultValue),
        codec: codecSignature,
        schemaVersion: schemaVersion ?? null,
        listenCrossTab: Boolean(listenCrossTab),
        reconcile: reconcileSignature,
        ssrHydration: ssrOptions?.hydration ?? null,
        hasServerValue: ssrOptions?.serverValue !== undefined,
        providerHydration: (api as { ssrHydration?: string }).ssrHydration ?? null,
    });
}

export function resolveMnemonicKeyArgs<T>(
    keyOrDescriptor: string | MnemonicKeyDescriptor<T, string>,
    options?: UseMnemonicKeyOptions<T>,
): MnemonicKeyDescriptor<T, string> {
    if (typeof keyOrDescriptor !== "string") {
        return keyOrDescriptor;
    }
    if (!options) {
        throw new Error("useMnemonicKey requires options when called with a string key");
    }
    return {
        key: keyOrDescriptor,
        options,
    };
}

export function useMnemonicKeyShared<T>(
    keyOrDescriptor: string | MnemonicKeyDescriptor<T, string>,
    options: UseMnemonicKeyOptions<T> | undefined,
    schemaVersion?: number,
): SharedMnemonicKeyContext<T> {
    const descriptor = resolveMnemonicKeyArgs(keyOrDescriptor, options);
    const key = descriptor.key;
    const resolvedOptions = descriptor.options;
    const api = useMnemonic();

    const {
        defaultValue,
        onMount,
        onChange,
        listenCrossTab,
        codec: codecOpt,
        schema,
        reconcile,
        ssr: ssrOptions,
    } = resolvedOptions;

    const codec = codecOpt ?? JSONCodec;
    const hydrationMode = ssrOptions?.hydration ?? api.ssrHydration;
    const [hasMounted, setHasMounted] = useState(hydrationMode !== "client-only");
    const developmentRuntime = isDevelopmentRuntime();
    const contractFingerprint = useMemo(
        () =>
            developmentRuntime
                ? buildContractFingerprint({
                      api,
                      key,
                      defaultValue,
                      codecOpt,
                      ...(schemaVersion === undefined ? {} : { schemaVersion }),
                      reconcile,
                      listenCrossTab,
                      ssrOptions,
                  })
                : null,
        [
            developmentRuntime,
            api,
            key,
            defaultValue,
            codecOpt,
            schemaVersion,
            reconcile,
            listenCrossTab,
            ssrOptions?.hydration,
            ssrOptions?.serverValue,
        ],
    );

    const getFallback = useCallback(
        (error?: CodecError | SchemaError) =>
            typeof defaultValue === "function"
                ? (defaultValue as (error?: CodecError | SchemaError) => T)(error)
                : defaultValue,
        [defaultValue],
    );

    const getServerValue = useCallback(() => {
        const serverValue = ssrOptions?.serverValue;
        if (serverValue === undefined) {
            return getFallback();
        }
        return typeof serverValue === "function" ? (serverValue as () => T)() : serverValue;
    }, [getFallback, ssrOptions?.serverValue]);

    const parseEnvelope = useCallback(
        (rawText: string): { ok: true; envelope: MnemonicEnvelope } | { ok: false; error: SchemaError } => {
            try {
                const parsed = JSON.parse(rawText) as MnemonicEnvelope;
                if (
                    typeof parsed !== "object" ||
                    parsed == null ||
                    !Number.isInteger(parsed.version) ||
                    parsed.version < 0 ||
                    !objectHasOwn(parsed, "payload")
                ) {
                    return {
                        ok: false,
                        error: new SchemaError("INVALID_ENVELOPE", `Invalid envelope for key "${key}"`),
                    };
                }
                return { ok: true, envelope: parsed };
            } catch (err) {
                return {
                    ok: false,
                    error: new SchemaError("INVALID_ENVELOPE", `Invalid envelope for key "${key}"`, err),
                };
            }
        },
        [key],
    );

    const decodeStringPayload = useCallback(
        <V>(payload: string, activeCodec: { decode: (encoded: string) => V }) => {
            try {
                return activeCodec.decode(payload);
            } catch (err) {
                throw err instanceof CodecError ? err : new CodecError(`Codec decode failed for key "${key}"`, err);
            }
        },
        [key],
    );

    const buildFallbackResult = useCallback(
        <Extra extends object = {}>(error?: CodecError | SchemaError, extra?: Extra): ReadResult<T, Extra> => {
            return withReadMetadata(getFallback(error), undefined, extra);
        },
        [getFallback],
    );

    return {
        api,
        key,
        codec,
        codecOpt,
        schema,
        reconcile,
        onMount,
        onChange,
        listenCrossTab,
        getFallback,
        getServerValue,
        parseEnvelope,
        decodeStringPayload,
        buildFallbackResult,
        developmentRuntime,
        contractFingerprint,
        hasMounted,
        setHasMounted,
        hydrationMode,
        ssrOptions,
    };
}

export function useApplyReconcile<T, Extra extends object = {}>({
    key,
    reconcile,
    buildFallbackResult,
}: {
    key: string;
    reconcile: UseMnemonicKeyOptions<T>["reconcile"];
    buildFallbackResult: <ResultExtra extends object = {}>(
        error?: CodecError | SchemaError,
        extra?: ResultExtra,
    ) => ReadResult<T, ResultExtra>;
}) {
    return useCallback(
        ({
            value,
            rewriteRaw,
            extra,
            persistedVersion,
            latestVersion,
            serializeForPersist,
            deriveExtra,
        }: ApplyReconcileArgs<T, Extra>): ReadResult<T, Extra> => {
            if (!reconcile) {
                return withReadMetadata(value, rewriteRaw, extra);
            }

            const context: { key: string; persistedVersion: number; latestVersion?: number } = {
                key,
                persistedVersion,
            };
            if (latestVersion !== undefined) {
                context.latestVersion = latestVersion;
            }

            const baselineSerialized = (() => {
                try {
                    return serializeForPersist(value);
                } catch {
                    return rewriteRaw;
                }
            })();

            try {
                const reconciled = reconcile(value, context);
                const nextExtra = deriveExtra ? deriveExtra(reconciled, extra) : extra;
                const nextSerialized = serializeForPersist(reconciled);
                const nextRewriteRaw =
                    baselineSerialized === undefined || nextSerialized !== baselineSerialized
                        ? nextSerialized
                        : rewriteRaw;
                return withReadMetadata(reconciled, nextRewriteRaw, nextExtra);
            } catch (err) {
                const typedErr =
                    err instanceof SchemaError
                        ? err
                        : new SchemaError("RECONCILE_FAILED", `Reconciliation failed for key "${key}"`, err);
                return buildFallbackResult(typedErr, extra);
            }
        },
        [buildFallbackResult, key, reconcile],
    );
}

export function useMnemonicKeyState<T, Extra extends object>(
    shared: SharedMnemonicKeyContext<T>,
    config: UseMnemonicKeyStateConfig<T, Extra>,
): MnemonicKeyState<T> {
    const {
        api,
        key,
        codecOpt,
        schema,
        onMount,
        onChange,
        listenCrossTab,
        getFallback,
        getServerValue,
        developmentRuntime,
        contractFingerprint,
        hasMounted,
        setHasMounted,
        hydrationMode,
        ssrOptions,
    } = shared;
    const { decodeForRead, encodeForWrite, additionalDevWarnings, onDecodedEffect } = config;

    const getServerRawSnapshot = useCallback(
        (): string | typeof SSR_SNAPSHOT_TOKEN | null =>
            ssrOptions?.serverValue === undefined ? null : SSR_SNAPSHOT_TOKEN,
        [ssrOptions?.serverValue],
    );

    const deferStorageRead = hydrationMode === "client-only" && !hasMounted;
    const subscribe = useCallback(
        (listener: () => void) => {
            if (deferStorageRead) {
                return () => undefined;
            }
            return api.subscribeRaw(key, listener);
        },
        [api, deferStorageRead, key],
    );

    const raw = useSyncExternalStore(
        subscribe,
        () => (deferStorageRead ? getServerRawSnapshot() : api.getRawSnapshot(key)),
        getServerRawSnapshot,
    );

    const decoded = useMemo(() => {
        if (raw === SSR_SNAPSHOT_TOKEN) {
            return withReadMetadata<T, Extra>(getServerValue());
        }
        return decodeForRead(raw);
    }, [decodeForRead, getServerValue, raw]);
    const value = decoded.value;

    useEffect(() => {
        if (!developmentRuntime) return;

        const globalWindow = (globalThis as { window?: Window }).window;

        if (listenCrossTab && (api.crossTabSyncMode ?? "none") === "none" && globalWindow !== undefined) {
            warnOnce(
                api,
                `listenCrossTab:${key}`,
                `[Mnemonic] useMnemonicKey("${key}") enabled listenCrossTab, but the active storage backend may not be able to notify external changes. If you're using a custom Storage-like wrapper around localStorage, ensure it forwards browser "storage" events or implements storage.onExternalChange(...); otherwise, use localStorage or implement storage.onExternalChange(...) on your custom backend.`,
            );
        }

        additionalDevWarnings?.({
            api,
            key,
            listenCrossTab,
            codecOpt,
            schema,
            warnOnce: (id, message) => warnOnce(api, id, message),
        });

        let keyContracts = diagnosticContractRegistry.get(api);
        if (!keyContracts) {
            keyContracts = new Map<string, string>();
            diagnosticContractRegistry.set(api, keyContracts);
        }

        if (contractFingerprint === null) {
            return;
        }
        const previousContract = keyContracts.get(key);
        if (previousContract === undefined) {
            keyContracts.set(key, contractFingerprint);
            return;
        }
        if (previousContract === contractFingerprint) {
            return;
        }

        warnOnce(
            api,
            `contract-conflict:${key}`,
            `[Mnemonic] Conflicting useMnemonicKey contracts detected for key "${key}" in namespace "${api.prefix.slice(0, -1)}". Reuse a shared descriptor with defineMnemonicKey(...) or align defaultValue/codec/schema/reconcile options so every consumer describes the same persisted contract.`,
        );
    }, [
        additionalDevWarnings,
        api,
        key,
        developmentRuntime,
        contractFingerprint,
        listenCrossTab,
        codecOpt,
        schema,
        api.crossTabSyncMode,
    ]);

    useEffect(() => {
        if (hasMounted) return;
        setHasMounted(true);
    }, [hasMounted, setHasMounted]);

    useEffect(() => {
        if (decoded.rewriteRaw && decoded.rewriteRaw !== raw) {
            api.setRaw(key, decoded.rewriteRaw);
        }
    }, [api, decoded.rewriteRaw, key, raw]);

    useEffect(() => {
        onDecodedEffect?.(decoded);
    }, [decoded, onDecodedEffect]);

    const prevRef = useRef<T>(value);

    const mounted = useRef(false);
    useEffect(() => {
        if (mounted.current) return;
        mounted.current = true;
        onMount?.(value);
        prevRef.current = value;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const prev = prevRef.current;
        if (Object.is(prev, value)) return;
        prevRef.current = value;
        onChange?.(value, prev);
    }, [value, onChange]);

    useEffect(() => {
        if (!listenCrossTab) return;
        const globalWindow = (globalThis as { window?: Window }).window;
        if (globalWindow === undefined) return;

        const storageKey = api.prefix + key;

        const handler = (e: StorageEvent) => {
            if (e.key === null) {
                api.removeRaw(key);
                return;
            }
            if (e.key !== storageKey) return;
            if (e.newValue == null) {
                api.removeRaw(key);
                return;
            }
            api.setRaw(key, e.newValue);
        };

        globalWindow.addEventListener("storage", handler);
        return () => globalWindow.removeEventListener("storage", handler);
    }, [listenCrossTab, api, key]);

    const set = useMemo(() => {
        return (next: T | ((cur: T) => T)) => {
            const nextVal =
                typeof next === "function" ? (next as (c: T) => T)(decodeForRead(api.getRawSnapshot(key)).value) : next;
            try {
                const encoded = encodeForWrite(nextVal);
                api.setRaw(key, encoded);
            } catch (err) {
                if (err instanceof SchemaError) {
                    console.error(`[Mnemonic] Schema error for key "${key}" (${err.code}):`, err.message);
                    return;
                }
                if (err instanceof CodecError) {
                    console.error(`[Mnemonic] Codec encode error for key "${key}":`, err.message);
                    return;
                }
                console.error(`[Mnemonic] Failed to persist key "${key}":`, err);
            }
        };
    }, [api, key, decodeForRead, encodeForWrite]);

    const reset = useMemo(() => {
        return () => {
            const v = getFallback();
            try {
                const encoded = encodeForWrite(v);
                api.setRaw(key, encoded);
            } catch (err) {
                if (err instanceof SchemaError) {
                    console.error(`[Mnemonic] Schema error for key "${key}" (${err.code}):`, err.message);
                    return;
                }
                if (err instanceof CodecError) {
                    console.error(`[Mnemonic] Codec encode error for key "${key}":`, err.message);
                }
                return;
            }
        };
    }, [api, key, getFallback, encodeForWrite]);

    const remove = useMemo(() => {
        return () => api.removeRaw(key);
    }, [api, key]);

    return useMemo<MnemonicKeyState<T>>(
        () => ({
            value,
            set,
            reset,
            remove,
        }),
        [value, set, reset, remove],
    );
}
