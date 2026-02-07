// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * @fileoverview Codec implementations for encoding and decoding values to/from storage.
 *
 * This module provides the built-in codecs (JSON, String, Number, Boolean) and
 * utilities for creating custom codecs. Codecs handle the bidirectional transformation
 * between typed JavaScript values and their string representations for storage.
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
 *   const value = NumberCodec.decode('not-a-number');
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
 * @see {@link StringCodec} - For plain string values without JSON serialization
 * @see {@link NumberCodec} - For numeric values
 * @see {@link createCodec} - For custom encoding schemes
 */
export const JSONCodec: Codec<any> = {
    encode: (value) => JSON.stringify(value),
    decode: (encoded) => JSON.parse(encoded),
};

/**
 * String codec for storing plain string values without JSON serialization.
 *
 * This codec performs no transformation - it stores strings directly as-is.
 * Use this when you're working with plain strings and want to avoid the overhead
 * and escaping of JSON encoding.
 *
 * @remarks
 * Unlike JSONCodec, this codec does not add quotes or escape characters.
 * The raw string in storage will be identical to the JavaScript string value.
 *
 * @example
 * ```typescript
 * const { value, set } = useMnemonicKey('username', {
 *   defaultValue: 'guest',
 *   codec: StringCodec
 * });
 *
 * set('alice'); // Stored as: "alice" (not "\"alice\"")
 * ```
 *
 * @example
 * ```typescript
 * // Good use case: plain text content
 * const { value, set } = useMnemonicKey('notes', {
 *   defaultValue: '',
 *   codec: StringCodec
 * });
 * ```
 *
 * @see {@link JSONCodec} - For objects and arrays
 * @see {@link NumberCodec} - For numeric values
 */
export const StringCodec: Codec<string> = {
    encode: (value) => value,
    decode: (encoded) => encoded,
};

/**
 * Number codec for storing numeric values as strings.
 *
 * Converts numbers to strings using `String(value)` and parses them back
 * using `Number(encoded)`. Throws a CodecError if the stored value cannot
 * be parsed as a valid number (including NaN).
 *
 * @remarks
 * - Preserves integer and floating-point precision
 * - Supports special values: Infinity, -Infinity (but stores as strings)
 * - Does not support NaN (decoding NaN throws CodecError)
 * - More efficient than JSONCodec for simple numeric values
 *
 * @throws {CodecError} When decoding a string that cannot be parsed as a number
 *
 * @example
 * ```typescript
 * const { value, set } = useMnemonicKey('count', {
 *   defaultValue: 0,
 *   codec: NumberCodec
 * });
 *
 * set(42);      // Stored as: "42"
 * set(3.14159); // Stored as: "3.14159"
 * ```
 *
 * @example
 * ```typescript
 * // Good use case: numeric settings or counters
 * const { value, set } = useMnemonicKey('volume', {
 *   defaultValue: 50,
 *   codec: NumberCodec
 * });
 * ```
 *
 * @see {@link JSONCodec} - Can also handle numbers within objects
 * @see {@link BooleanCodec} - For boolean values
 */
export const NumberCodec: Codec<number> = {
    encode: (value) => String(value),
    decode: (encoded) => {
        const num = Number(encoded);
        if (Number.isNaN(num)) {
            throw new CodecError(`Cannot decode "${encoded}" as a number`);
        }
        return num;
    },
};

/**
 * Boolean codec for storing boolean values as strings.
 *
 * Encodes booleans as the strings "true" or "false". Decodes by comparing
 * the stored string to "true" (strict equality). Any value other than "true"
 * is decoded as false.
 *
 * @remarks
 * - Encoding: `true` → `"true"`, `false` → `"false"`
 * - Decoding: Only `"true"` decodes to `true`, all other values decode to `false`
 * - More compact than JSONCodec for simple boolean flags
 * - Decoding is lenient: corrupted or modified values default to false
 *
 * @example
 * ```typescript
 * const { value, set } = useMnemonicKey('darkMode', {
 *   defaultValue: false,
 *   codec: BooleanCodec
 * });
 *
 * set(true);  // Stored as: "true"
 * set(false); // Stored as: "false"
 * ```
 *
 * @example
 * ```typescript
 * // Good use case: feature flags and toggles
 * const { value, set } = useMnemonicKey('notificationsEnabled', {
 *   defaultValue: true,
 *   codec: BooleanCodec
 * });
 * ```
 *
 * @see {@link JSONCodec} - Can also handle booleans within objects
 * @see {@link NumberCodec} - For numeric values
 */
export const BooleanCodec: Codec<boolean> = {
    encode: (value) => String(value),
    decode: (encoded) => encoded === "true",
};

/**
 * Factory function for creating custom codecs.
 *
 * Creates a Codec<T> from separate encode and decode functions. This is
 * useful for implementing custom serialization strategies for types that
 * aren't supported by the built-in codecs.
 *
 * @template T - The TypeScript type of values to encode/decode
 *
 * @param encode - Function that converts a typed value to a string
 * @param decode - Function that converts a string back to a typed value
 * @returns A Codec<T> object compatible with useMnemonicKey
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
 * @example
 * ```typescript
 * // Codec for compressed data
 * const CompressedCodec = createCodec<string>(
 *   (value) => btoa(value), // Base64 encode
 *   (encoded) => atob(encoded) // Base64 decode
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Codec with validation
 * interface User {
 *   id: string;
 *   name: string;
 * }
 *
 * const UserCodec = createCodec<User>(
 *   (user) => JSON.stringify(user),
 *   (str) => {
 *     const parsed = JSON.parse(str);
 *     if (!parsed.id || !parsed.name) {
 *       throw new CodecError('Invalid user data');
 *     }
 *     return parsed as User;
 *   }
 * );
 * ```
 *
 * @see {@link Codec} - The codec interface
 * @see {@link CodecError} - Error to throw when encoding/decoding fails
 * @see {@link JSONCodec} - Built-in codec for JSON values
 */
export function createCodec<T>(encode: (value: T) => string, decode: (encoded: string) => T): Codec<T> {
    return { encode, decode };
}
