// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { useCallback } from "react";
import { CodecError } from "./codecs";
import { SchemaError, type MnemonicEnvelope } from "./schema";
import { serializeEnvelope, useApplyReconcile, useMnemonicKeyShared, useMnemonicKeyState } from "./use-shared";
import type { MnemonicKeyDescriptor, MnemonicKeyState, UseMnemonicKeyOptions } from "./types";

function throwCoreSchemaImportError(key: string): never {
    throw new Error(
        `[Mnemonic] useMnemonicKey("${key}") requested schema features from react-mnemonic/core. Import useMnemonicKey from "react-mnemonic/schema" or "react-mnemonic" for schema validation, autoschema, and migration support.`,
    );
}

function useCoreRuntime<T>(
    keyOrDescriptor: string | MnemonicKeyDescriptor<T, string>,
    options?: UseMnemonicKeyOptions<T>,
): MnemonicKeyState<T> {
    const shared = useMnemonicKeyShared(keyOrDescriptor, options);
    const { api, key, codec, schema, reconcile, parseEnvelope, decodeStringPayload, buildFallbackResult } = shared;

    if (schema?.version !== undefined || api.schemaMode !== "default") {
        throwCoreSchemaImportError(key);
    }

    const applyReconcile = useApplyReconcile<T>({
        key,
        reconcile,
        buildFallbackResult,
    });

    const encodeForWrite = useCallback(
        (nextValue: T): string => {
            return serializeEnvelope(0, codec.encode(nextValue));
        },
        [codec],
    );

    const decodeForRead = useCallback(
        (rawText: string | null) => {
            if (rawText == null) return buildFallbackResult();

            const parsed = parseEnvelope(rawText);
            if (!parsed.ok) return buildFallbackResult(parsed.error);

            const envelope: MnemonicEnvelope = parsed.envelope;
            if (typeof envelope.payload !== "string") {
                return applyReconcile({
                    value: envelope.payload as T,
                    persistedVersion: envelope.version,
                    serializeForPersist: encodeForWrite,
                });
            }

            try {
                const decoded = decodeStringPayload<T>(envelope.payload, codec);
                return applyReconcile({
                    value: decoded,
                    persistedVersion: envelope.version,
                    serializeForPersist: encodeForWrite,
                });
            } catch (err) {
                return buildFallbackResult(err as CodecError | SchemaError);
            }
        },
        [applyReconcile, buildFallbackResult, codec, decodeStringPayload, encodeForWrite, parseEnvelope],
    );

    const additionalDevWarnings = useCallback(
        ({ warnOnce }: { warnOnce: (id: string, message: string) => void }) => {
            if (!api.schemaRegistry) return;
            warnOnce(
                `core-schema-registry:${key}`,
                `[Mnemonic] useMnemonicKey("${key}") is running from react-mnemonic/core, so registered schemas are ignored for this key. Import useMnemonicKey from "react-mnemonic/schema" or "react-mnemonic" to enable schema validation and migrations.`,
            );
        },
        [api.schemaRegistry, key],
    );

    return useMnemonicKeyState(shared, {
        decodeForRead,
        encodeForWrite,
        additionalDevWarnings,
    });
}

export function useMnemonicKey<T, K extends string>(descriptor: MnemonicKeyDescriptor<T, K>): MnemonicKeyState<T>;
export function useMnemonicKey<T>(key: string, options: UseMnemonicKeyOptions<T>): MnemonicKeyState<T>;
export function useMnemonicKey<T>(
    keyOrDescriptor: string | MnemonicKeyDescriptor<T, string>,
    options?: UseMnemonicKeyOptions<T>,
): MnemonicKeyState<T> {
    return useCoreRuntime(keyOrDescriptor, options);
}
