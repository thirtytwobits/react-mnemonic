// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * @fileoverview Schema versioning primitives for Mnemonic.
 *
 * This module defines the envelope format used to wrap every persisted value
 * and the error class thrown when schema-related operations fail.
 */

/**
 * Error thrown for schema registry, versioning, and migration failures.
 *
 * Each instance carries a machine-readable {@link code} that categorises
 * the failure. When a `defaultValue` factory is provided to
 * `useMnemonicKey`, the `SchemaError` is passed as the `error` argument
 * so the factory can inspect the failure reason.
 *
 * Error codes:
 *
 * | Code                            | Meaning                                                         |
 * | ------------------------------- | --------------------------------------------------------------- |
 * | `INVALID_ENVELOPE`              | The raw stored value is not a valid `MnemonicEnvelope`.         |
 * | `SCHEMA_NOT_FOUND`              | No schema registered for the stored key + version.              |
 * | `WRITE_SCHEMA_REQUIRED`         | Strict mode requires a schema to write, but none was found.     |
 * | `MIGRATION_PATH_NOT_FOUND`      | No contiguous migration path between the stored and latest version. |
 * | `MIGRATION_FAILED`              | A migration step threw during execution.                        |
 * | `SCHEMA_REGISTRATION_CONFLICT`  | `registerSchema` was called with a conflicting definition.      |
 * | `SCHEMA_VERSION_RESERVED`       | Version `0` was supplied by a schema registry.                  |
 * | `TYPE_MISMATCH`                 | A schema or inferred validator rejected the decoded value.      |
 * | `MODE_CONFIGURATION_INVALID`    | The schema mode requires a capability the registry doesn't provide. |
 *
 * @example
 * ```typescript
 * defaultValue: (error) => {
 *   if (error instanceof SchemaError) {
 *     console.warn(`Schema issue [${error.code}]:`, error.message);
 *   }
 *   return { name: "Guest" };
 * }
 * ```
 *
 * @see {@link SchemaMode} - How the provider uses schemas
 * @see {@link SchemaRegistry} - Where schemas and migrations are registered
 */
export class SchemaError extends Error {
    /**
     * Machine-readable code identifying the category of schema failure.
     */
    readonly code:
        | "INVALID_ENVELOPE"
        | "SCHEMA_NOT_FOUND"
        | "WRITE_SCHEMA_REQUIRED"
        | "MIGRATION_PATH_NOT_FOUND"
        | "MIGRATION_FAILED"
        | "SCHEMA_REGISTRATION_CONFLICT"
        | "SCHEMA_VERSION_RESERVED"
        | "TYPE_MISMATCH"
        | "MODE_CONFIGURATION_INVALID";

    /**
     * The underlying error that caused this failure, if any.
     */
    readonly cause?: unknown;

    /**
     * Creates a new SchemaError.
     *
     * @param code - Machine-readable failure category
     * @param message - Human-readable error description
     * @param cause - Optional underlying error
     */
    constructor(
        code: SchemaError["code"],
        message: string,
        cause?: unknown,
    ) {
        super(message);
        this.name = "SchemaError";
        this.code = code;
        this.cause = cause;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * The JSON envelope that wraps every value persisted by the library.
 *
 * All values are stored as `JSON.stringify({ version, payload })`. The
 * `version` field tells the read path which schema (and therefore which
 * codec + validator) to use for decoding the `payload`.
 *
 * - `version 0` is used when no schema is active (default mode, no
 *   registry). The payload is the codec-encoded string. Registries must
 *   never define a schema at version `0`.
 * - `version >= 1` corresponds to a user-defined {@link KeySchema}.
 *
 * @internal
 */
export type MnemonicEnvelope = {
    /**
     * Schema version number.
     *
     * Non-negative integer. `0` means unversioned; `>= 1` maps to a
     * registered {@link KeySchema}.
     */
    version: number;

    /**
     * The codec-encoded value.
     *
     * Typically a string produced by `Codec.encode`, but typed as
     * `unknown` to accommodate envelope parsing before the codec is
     * resolved.
     */
    payload: unknown;
};
