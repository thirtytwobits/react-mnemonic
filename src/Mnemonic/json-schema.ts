// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * @fileoverview JSON Schema subset validator for Mnemonic.
 *
 * This module implements a minimal JSON Schema validator sufficient for
 * validating localStorage state. Only a subset of JSON Schema keywords
 * are supported; see {@link JsonSchema} for the full list.
 *
 * JSON Schema documents are plain JSON objects (inherently serializable),
 * making them suitable for storage alongside the data they describe.
 */

/**
 * Supported JSON Schema type keywords.
 *
 * `"integer"` is a JSON Schema keyword meaning "a number that is a whole number."
 */
export type JsonSchemaType =
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "null"
    | "object"
    | "array";

/**
 * A subset of JSON Schema sufficient for localStorage state management.
 *
 * Supported keywords:
 *   type, enum, const,
 *   minimum, maximum, exclusiveMinimum, exclusiveMaximum,
 *   minLength, maxLength,
 *   properties, required, additionalProperties,
 *   items, minItems, maxItems
 *
 * Deliberately omitted: $ref, $id, $schema, $defs, allOf, anyOf,
 * oneOf, not, pattern, format, patternProperties, if/then/else,
 * dependencies, uniqueItems, multipleOf, propertyNames.
 *
 * An empty schema `{}` accepts any value.
 */
export interface JsonSchema {
    /** The expected JSON type(s). An array form like `["string", "null"]` accepts either type. */
    type?: JsonSchemaType | JsonSchemaType[];

    /** The value must be deeply equal to one of these entries. */
    enum?: readonly unknown[];

    /** The value must be deeply equal to this exact value. */
    const?: unknown;

    /** Inclusive lower bound for numbers. */
    minimum?: number;

    /** Inclusive upper bound for numbers. */
    maximum?: number;

    /** Exclusive lower bound for numbers. */
    exclusiveMinimum?: number;

    /** Exclusive upper bound for numbers. */
    exclusiveMaximum?: number;

    /** Minimum string length (inclusive). */
    minLength?: number;

    /** Maximum string length (inclusive). */
    maxLength?: number;

    /** Property name to sub-schema mapping for objects. */
    properties?: Record<string, JsonSchema>;

    /** Properties that must be present on the object. */
    required?: readonly string[];

    /**
     * Controls extra properties not listed in `properties`.
     * `false` disallows them. A schema validates their values.
     * `true` (or omitted) allows anything.
     */
    additionalProperties?: boolean | JsonSchema;

    /** Schema applied to every element of an array. */
    items?: JsonSchema;

    /** Minimum array length (inclusive). */
    minItems?: number;

    /** Maximum array length (inclusive). */
    maxItems?: number;
}

/**
 * A single validation error produced by {@link validateJsonSchema}.
 */
export type JsonSchemaValidationError = {
    /** JSON Pointer path to the failing value (e.g., "/foo/bar/0"). Empty string for root. */
    path: string;
    /** Human-readable error description. */
    message: string;
    /** The JSON Schema keyword that failed. */
    keyword: string;
};

/**
 * Tests whether a value matches a single JSON Schema type keyword.
 */
function matchesType(value: unknown, type: JsonSchemaType): boolean {
    switch (type) {
        case "string":
            return typeof value === "string";
        case "number":
            return typeof value === "number" && Number.isFinite(value);
        case "integer":
            return typeof value === "number" && Number.isInteger(value);
        case "boolean":
            return typeof value === "boolean";
        case "null":
            return value === null;
        case "object":
            return typeof value === "object" && value !== null && !Array.isArray(value);
        case "array":
            return Array.isArray(value);
        default:
            return false;
    }
}

/**
 * Structural deep equality for JSON values (null, booleans, numbers, strings,
 * arrays, and plain objects). Used by `enum` and `const` keywords.
 */
export function jsonDeepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;

    if (Array.isArray(a)) {
        if (!Array.isArray(b)) return false;
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!jsonDeepEqual(a[i], b[i])) return false;
        }
        return true;
    }

    if (typeof a === "object") {
        if (Array.isArray(b)) return false;
        const aObj = a as Record<string, unknown>;
        const bObj = b as Record<string, unknown>;
        const aKeys = Object.keys(aObj);
        const bKeys = Object.keys(bObj);
        if (aKeys.length !== bKeys.length) return false;
        for (const key of aKeys) {
            if (!Object.prototype.hasOwnProperty.call(bObj, key)) return false;
            if (!jsonDeepEqual(aObj[key], bObj[key])) return false;
        }
        return true;
    }

    return false;
}

/**
 * Validates a value against a {@link JsonSchema}.
 *
 * Returns an empty array when the value is valid.
 * Returns one or more {@link JsonSchemaValidationError} entries on failure.
 * Short-circuits on type mismatch (does not report downstream keyword errors).
 *
 * @param value - The value to validate
 * @param schema - The JSON Schema to validate against
 * @param path - Internal: JSON Pointer path for error reporting (default: `""`)
 * @returns Array of validation errors (empty = valid)
 */
export function validateJsonSchema(
    value: unknown,
    schema: JsonSchema,
    path: string = "",
): JsonSchemaValidationError[] {
    const errors: JsonSchemaValidationError[] = [];

    // --- type ---
    if (schema.type !== undefined) {
        const types = Array.isArray(schema.type) ? schema.type : [schema.type];
        const matched = types.some((t) => matchesType(value, t));
        if (!matched) {
            errors.push({
                path,
                message: `Expected type ${JSON.stringify(schema.type)}, got ${jsonTypeLabel(value)}`,
                keyword: "type",
            });
            return errors; // short-circuit
        }
    }

    // --- enum ---
    if (schema.enum !== undefined) {
        const matched = schema.enum.some((entry) => jsonDeepEqual(value, entry));
        if (!matched) {
            errors.push({
                path,
                message: `Value does not match any enum member`,
                keyword: "enum",
            });
        }
    }

    // --- const ---
    if (schema.const !== undefined) {
        if (!jsonDeepEqual(value, schema.const)) {
            errors.push({
                path,
                message: `Value does not match const`,
                keyword: "const",
            });
        }
    }

    // --- number constraints ---
    if (typeof value === "number") {
        if (schema.minimum !== undefined && value < schema.minimum) {
            errors.push({ path, message: `Value ${value} is less than minimum ${schema.minimum}`, keyword: "minimum" });
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
            errors.push({
                path,
                message: `Value ${value} is greater than maximum ${schema.maximum}`,
                keyword: "maximum",
            });
        }
        if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
            errors.push({
                path,
                message: `Value ${value} is not greater than exclusiveMinimum ${schema.exclusiveMinimum}`,
                keyword: "exclusiveMinimum",
            });
        }
        if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
            errors.push({
                path,
                message: `Value ${value} is not less than exclusiveMaximum ${schema.exclusiveMaximum}`,
                keyword: "exclusiveMaximum",
            });
        }
    }

    // --- string constraints ---
    if (typeof value === "string") {
        if (schema.minLength !== undefined && value.length < schema.minLength) {
            errors.push({
                path,
                message: `String length ${value.length} is less than minLength ${schema.minLength}`,
                keyword: "minLength",
            });
        }
        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
            errors.push({
                path,
                message: `String length ${value.length} is greater than maxLength ${schema.maxLength}`,
                keyword: "maxLength",
            });
        }
    }

    // --- object constraints ---
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>;

        if (schema.required) {
            for (const reqKey of schema.required) {
                if (!Object.prototype.hasOwnProperty.call(obj, reqKey)) {
                    errors.push({
                        path,
                        message: `Missing required property "${reqKey}"`,
                        keyword: "required",
                    });
                }
            }
        }

        if (schema.properties) {
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
                if (Object.prototype.hasOwnProperty.call(obj, propName)) {
                    const propErrors = validateJsonSchema(obj[propName], propSchema, `${path}/${propName}`);
                    errors.push(...propErrors);
                }
            }
        }

        if (schema.additionalProperties !== undefined && schema.additionalProperties !== true) {
            const definedProps = new Set(schema.properties ? Object.keys(schema.properties) : []);
            for (const objKey of Object.keys(obj)) {
                if (!definedProps.has(objKey)) {
                    if (schema.additionalProperties === false) {
                        errors.push({
                            path,
                            message: `Additional property "${objKey}" is not allowed`,
                            keyword: "additionalProperties",
                        });
                    } else {
                        // additionalProperties is a schema
                        const propErrors = validateJsonSchema(
                            obj[objKey],
                            schema.additionalProperties,
                            `${path}/${objKey}`,
                        );
                        errors.push(...propErrors);
                    }
                }
            }
        }
    }

    // --- array constraints ---
    if (Array.isArray(value)) {
        if (schema.minItems !== undefined && value.length < schema.minItems) {
            errors.push({
                path,
                message: `Array length ${value.length} is less than minItems ${schema.minItems}`,
                keyword: "minItems",
            });
        }
        if (schema.maxItems !== undefined && value.length > schema.maxItems) {
            errors.push({
                path,
                message: `Array length ${value.length} is greater than maxItems ${schema.maxItems}`,
                keyword: "maxItems",
            });
        }
        if (schema.items) {
            for (let i = 0; i < value.length; i++) {
                const itemErrors = validateJsonSchema(value[i], schema.items, `${path}/${i}`);
                errors.push(...itemErrors);
            }
        }
    }

    return errors;
}

/**
 * Returns a human-readable label for the JSON type of a value.
 */
function jsonTypeLabel(value: unknown): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
}

/**
 * Infers a minimal {@link JsonSchema} from a sample value.
 *
 * Used by autoschema mode to register a schema from the first
 * successfully decoded value. The inferred schema only constrains
 * the top-level type.
 *
 * @param sample - A decoded value to infer a schema from
 * @returns A minimal JsonSchema that accepts values of the same top-level type
 */
export function inferJsonSchema(sample: unknown): JsonSchema {
    if (sample === null) return { type: "null" };
    if (Array.isArray(sample)) return { type: "array" };
    switch (typeof sample) {
        case "string":
            return { type: "string" };
        case "number":
            return Number.isInteger(sample) ? { type: "number" } : { type: "number" };
        case "boolean":
            return { type: "boolean" };
        case "object":
            return { type: "object" };
        default:
            return {};
    }
}
