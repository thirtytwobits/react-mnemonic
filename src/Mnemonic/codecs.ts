// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * @fileoverview Codec implementations for encoding and decoding values to/from storage.
 *
 * This module provides the built-in JSON codec and a factory for creating custom
 * codecs. Codecs handle the bidirectional transformation between typed JavaScript
 * values and their string representations for storage.
 *
 * Codecs are a low-level mechanism for keys that opt out of the JSON Schema
 * validation system. When a schema is registered for a key, the schema's
 * JSON Schema is used for validation and the payload is stored as a JSON value
 * directly (no codec encoding needed).
 */

import type { Codec } from "./types";

/**
 * Custom error class for codec encoding and decoding failures.
 *
 * Thrown when a codec cannot successfully encode a value to a string or
 * decode a string back to its typed representation. This allows callers
 * to distinguish codec errors from other types of errors.
 *
 * @example
 * ```typescript
 * try {
 *   const value = JSONCodec.decode('not-valid-json');
 * } catch (error) {
 *   if (error instanceof CodecError) {
 *     console.error('Failed to decode:', error.message);
 *   }
 * }
 * ```
 */
export class CodecError extends Error {
    /**
     * The underlying error that caused the codec failure, if any.
     *
     * Useful for debugging when wrapping errors from JSON.parse or
     * other parsing operations.
     */
    readonly cause?: unknown;

    /**
     * Creates a new CodecError.
     *
     * @param message - Human-readable error description
     * @param cause - Optional underlying error that caused this failure
     */
    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = "CodecError";
        this.cause = cause;

        // Required for proper instanceof behavior when targeting ES5
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * JSON codec for encoding and decoding JSON-serializable values.
 *
 * This is the default codec used by `useMnemonicKey` when no codec is specified.
 * It uses `JSON.stringify` for encoding and `JSON.parse` for decoding, making it
 * suitable for objects, arrays, and primitive values.
 *
 * @remarks
 * - Supports any JSON-serializable type: objects, arrays, strings, numbers, booleans, null
 * - Does not preserve JavaScript-specific types like Date, Map, Set, or undefined
 * - Throws standard JSON parsing errors for malformed JSON strings
 *
 * @example
 * ```typescript
 * // Used automatically as the default
 * const { value, set } = useMnemonicKey('userProfile', {
 *   defaultValue: { name: 'Guest', preferences: { theme: 'dark' } }
 *   // codec: JSONCodec is implicit
 * });
 *
 * // Can be specified explicitly
 * const { value, set } = useMnemonicKey('settings', {
 *   defaultValue: { notifications: true },
 *   codec: JSONCodec
 * });
 * ```
 *
 * @see {@link createCodec} - For custom encoding schemes
 */
export const JSONCodec: Codec<any> = {
    encode: (value) => JSON.stringify(value),
    decode: (encoded) => JSON.parse(encoded),
};

/**
 * Factory function for creating custom codecs.
 *
 * Creates a `Codec<T>` from separate encode and decode functions. This is
 * useful for implementing custom serialization strategies for types that
 * aren't supported by JSONCodec. Using a custom codec on a key opts out
 * of JSON Schema validation for that key.
 *
 * @template T - The TypeScript type of values to encode/decode
 *
 * @param encode - Function that converts a typed value to a string
 * @param decode - Function that converts a string back to a typed value
 * @returns A `Codec<T>` object compatible with useMnemonicKey
 *
 * @example
 * ```typescript
 * // Codec for Date objects
 * const DateCodec = createCodec<Date>(
 *   (date) => date.toISOString(),
 *   (str) => new Date(str)
 * );
 *
 * const { value, set } = useMnemonicKey('lastLogin', {
 *   defaultValue: new Date(),
 *   codec: DateCodec
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Codec for Set<string>
 * const StringSetCodec = createCodec<Set<string>>(
 *   (set) => JSON.stringify(Array.from(set)),
 *   (str) => new Set(JSON.parse(str))
 * );
 *
 * const { value, set } = useMnemonicKey('tags', {
 *   defaultValue: new Set<string>(),
 *   codec: StringSetCodec
 * });
 * ```
 *
 * @see {@link Codec} - The codec interface
 * @see {@link CodecError} - Error to throw when encoding/decoding fails
 * @see {@link JSONCodec} - Built-in codec for JSON values
 */
export function createCodec<T>(encode: (value: T) => string, decode: (encoded: string) => T): Codec<T> {
    return { encode, decode };
}
