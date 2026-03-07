// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import type { JsonSchema } from "./json-schema";
import type { KeySchema, MnemonicKeyDescriptor, SchemaBoundKeyOptions, UseMnemonicKeyOptions } from "./types";

/**
 * Define a reusable, importable contract for a persisted key.
 *
 * This packages the storage key and the canonical `useMnemonicKey(...)`
 * options into a single object that can be shared across components, docs,
 * and generated code.
 *
 * @template K - The literal storage key name
 * @template T - The decoded value type for the key
 *
 * @param key - The unprefixed storage key
 * @param options - Canonical hook options for the key
 * @returns A descriptor that can be passed directly to `useMnemonicKey(...)`
 *
 * @example
 * ```typescript
 * const themeKey = defineMnemonicKey("theme", {
 *   defaultValue: "light" as "light" | "dark",
 *   listenCrossTab: true,
 * });
 *
 * const { value, set } = useMnemonicKey(themeKey);
 * ```
 */
export function defineMnemonicKey<const K extends string, T>(
    key: K,
    options: UseMnemonicKeyOptions<T>,
): MnemonicKeyDescriptor<T, K>;
export function defineMnemonicKey<const K extends string, TSchema extends KeySchema<unknown, K, JsonSchema>>(
    keySchema: TSchema,
    options: SchemaBoundKeyOptions<TSchema extends KeySchema<infer TValue, string, JsonSchema> ? TValue : never>,
): MnemonicKeyDescriptor<TSchema extends KeySchema<infer TValue, string, JsonSchema> ? TValue : never, TSchema["key"]>;
export function defineMnemonicKey(
    keyOrSchema: string | KeySchema<unknown, string, JsonSchema>,
    options: UseMnemonicKeyOptions<unknown> | SchemaBoundKeyOptions<unknown>,
): MnemonicKeyDescriptor<unknown, string> {
    if (typeof keyOrSchema !== "string") {
        return Object.freeze({
            key: keyOrSchema.key,
            options: {
                ...options,
                schema: { version: keyOrSchema.version },
            },
        });
    }

    return Object.freeze({
        key: keyOrSchema,
        options,
    });
}
