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
 * A pre-compiled validation function generated by {@link compileSchema}.
 *
 * Accepts a value and an optional JSON Pointer path for error reporting.
 * Returns an array of validation errors (empty = valid).
 */
export type CompiledValidator = (value: unknown, path?: string) => JsonSchemaValidationError[];

/** Module-level cache: schema object identity → compiled validator. */
const compiledCache = new WeakMap<JsonSchema, CompiledValidator>();

/**
 * Pre-compiles a {@link JsonSchema} into a reusable validation function.
 *
 * Inspects the schema once and builds a specialized closure that
 * eliminates runtime branching for unused keywords, pre-converts
 * `required` arrays to `Set`s, recursively pre-compiles nested property
 * and item schemas, and pre-builds primitive `Set`s for O(1) enum
 * lookups when possible.
 *
 * Results are cached by schema object identity in a `WeakMap`, so
 * calling `compileSchema` with the same schema reference is free
 * after the first call.
 *
 * @param schema - The JSON Schema to compile
 * @returns A compiled validation function
 */
export function compileSchema(schema: JsonSchema): CompiledValidator {
    const cached = compiledCache.get(schema);
    if (cached) return cached;

    const compiled = buildValidator(schema);
    compiledCache.set(schema, compiled);
    return compiled;
}

/** Determines whether a value is a JSON primitive (not object/array). */
function isJsonPrimitive(value: unknown): boolean {
    return value === null || typeof value !== "object";
}

/**
 * Internal: builds a compiled validator closure for a single schema.
 * All keyword-specific logic is resolved at build time so the returned
 * function contains only the checks that are relevant.
 */
function buildValidator(schema: JsonSchema): CompiledValidator {
    // --- Pre-compute: type ---
    const resolvedTypes: readonly JsonSchemaType[] | null =
        schema.type !== undefined
            ? Array.isArray(schema.type)
                ? schema.type
                : [schema.type]
            : null;
    const typeLabel = resolvedTypes !== null ? JSON.stringify(schema.type) : "";

    // --- Pre-compute: enum ---
    const enumMembers = schema.enum;
    let enumPrimitiveSet: Set<unknown> | null = null;
    let enumComplexMembers: readonly unknown[] | null = null;
    if (enumMembers !== undefined) {
        const primitives: unknown[] = [];
        const complex: unknown[] = [];
        for (const member of enumMembers) {
            if (isJsonPrimitive(member)) {
                primitives.push(member);
            } else {
                complex.push(member);
            }
        }
        if (primitives.length > 0) enumPrimitiveSet = new Set(primitives);
        if (complex.length > 0) enumComplexMembers = complex;
    }

    // --- Pre-compute: const ---
    const hasConst = "const" in schema;
    const constValue = schema.const;

    // --- Pre-compute: number constraints ---
    const hasMinimum = schema.minimum !== undefined;
    const minimum = schema.minimum!;
    const hasMaximum = schema.maximum !== undefined;
    const maximum = schema.maximum!;
    const hasExMin = schema.exclusiveMinimum !== undefined;
    const exMin = schema.exclusiveMinimum!;
    const hasExMax = schema.exclusiveMaximum !== undefined;
    const exMax = schema.exclusiveMaximum!;
    const hasNumberConstraints = hasMinimum || hasMaximum || hasExMin || hasExMax;

    // --- Pre-compute: string constraints ---
    const hasMinLength = schema.minLength !== undefined;
    const minLen = schema.minLength!;
    const hasMaxLength = schema.maxLength !== undefined;
    const maxLen = schema.maxLength!;
    const hasStringConstraints = hasMinLength || hasMaxLength;

    // --- Pre-compute: object constraints ---
    const requiredKeys = schema.required;
    const hasRequired = requiredKeys !== undefined && requiredKeys.length > 0;
    const hasProperties = schema.properties !== undefined;
    const propertyValidators: [string, CompiledValidator][] | null = hasProperties
        ? Object.entries(schema.properties!).map(
              ([name, propSchema]) =>
                  [name, compileSchema(propSchema)] as [string, CompiledValidator],
          )
        : null;
    const checkAdditional =
        schema.additionalProperties !== undefined && schema.additionalProperties !== true;
    const additionalIsFalse = schema.additionalProperties === false;
    const additionalValidator: CompiledValidator | null =
        checkAdditional && !additionalIsFalse
            ? compileSchema(schema.additionalProperties as JsonSchema)
            : null;
    const definedPropKeys: Set<string> | null = checkAdditional
        ? new Set(schema.properties ? Object.keys(schema.properties) : [])
        : null;
    const hasObjectConstraints = hasRequired || hasProperties || checkAdditional;

    // --- Pre-compute: array constraints ---
    const hasMinItems = schema.minItems !== undefined;
    const minItems = schema.minItems!;
    const hasMaxItems = schema.maxItems !== undefined;
    const maxItems = schema.maxItems!;
    const itemsValidator: CompiledValidator | null =
        schema.items !== undefined ? compileSchema(schema.items) : null;
    const hasArrayConstraints = hasMinItems || hasMaxItems || itemsValidator !== null;

    // --- Empty schema fast path ---
    if (
        resolvedTypes === null &&
        enumMembers === undefined &&
        !hasConst &&
        !hasNumberConstraints &&
        !hasStringConstraints &&
        !hasObjectConstraints &&
        !hasArrayConstraints
    ) {
        return (_value: unknown, _path?: string) => [];
    }

    // --- Compiled validator ---
    return (value: unknown, path: string = ""): JsonSchemaValidationError[] => {
        const errors: JsonSchemaValidationError[] = [];

        // --- type ---
        if (resolvedTypes !== null) {
            const matched = resolvedTypes.some((t) => matchesType(value, t));
            if (!matched) {
                errors.push({
                    path,
                    message: `Expected type ${typeLabel}, got ${jsonTypeLabel(value)}`,
                    keyword: "type",
                });
                return errors; // short-circuit
            }
        }

        // --- enum ---
        if (enumMembers !== undefined) {
            let matched = false;
            if (enumPrimitiveSet !== null && isJsonPrimitive(value)) {
                matched = enumPrimitiveSet.has(value);
            }
            if (!matched && enumComplexMembers !== null) {
                matched = enumComplexMembers.some((entry) => jsonDeepEqual(value, entry));
            }
            if (!matched) {
                errors.push({
                    path,
                    message: `Value does not match any enum member`,
                    keyword: "enum",
                });
            }
        }

        // --- const ---
        if (hasConst) {
            if (!jsonDeepEqual(value, constValue)) {
                errors.push({
                    path,
                    message: `Value does not match const`,
                    keyword: "const",
                });
            }
        }

        // --- number constraints ---
        if (hasNumberConstraints && typeof value === "number") {
            if (hasMinimum && value < minimum) {
                errors.push({
                    path,
                    message: `Value ${value} is less than minimum ${minimum}`,
                    keyword: "minimum",
                });
            }
            if (hasMaximum && value > maximum) {
                errors.push({
                    path,
                    message: `Value ${value} is greater than maximum ${maximum}`,
                    keyword: "maximum",
                });
            }
            if (hasExMin && value <= exMin) {
                errors.push({
                    path,
                    message: `Value ${value} is not greater than exclusiveMinimum ${exMin}`,
                    keyword: "exclusiveMinimum",
                });
            }
            if (hasExMax && value >= exMax) {
                errors.push({
                    path,
                    message: `Value ${value} is not less than exclusiveMaximum ${exMax}`,
                    keyword: "exclusiveMaximum",
                });
            }
        }

        // --- string constraints ---
        if (hasStringConstraints && typeof value === "string") {
            if (hasMinLength && value.length < minLen) {
                errors.push({
                    path,
                    message: `String length ${value.length} is less than minLength ${minLen}`,
                    keyword: "minLength",
                });
            }
            if (hasMaxLength && value.length > maxLen) {
                errors.push({
                    path,
                    message: `String length ${value.length} is greater than maxLength ${maxLen}`,
                    keyword: "maxLength",
                });
            }
        }

        // --- object constraints ---
        if (
            hasObjectConstraints &&
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value)
        ) {
            const obj = value as Record<string, unknown>;

            if (hasRequired) {
                for (const reqKey of requiredKeys!) {
                    if (!Object.prototype.hasOwnProperty.call(obj, reqKey)) {
                        errors.push({
                            path,
                            message: `Missing required property "${reqKey}"`,
                            keyword: "required",
                        });
                    }
                }
            }

            if (propertyValidators !== null) {
                for (const [propName, propValidator] of propertyValidators) {
                    if (Object.prototype.hasOwnProperty.call(obj, propName)) {
                        const propErrors = propValidator(obj[propName], `${path}/${propName}`);
                        errors.push(...propErrors);
                    }
                }
            }

            if (checkAdditional) {
                for (const objKey of Object.keys(obj)) {
                    if (!definedPropKeys!.has(objKey)) {
                        if (additionalIsFalse) {
                            errors.push({
                                path,
                                message: `Additional property "${objKey}" is not allowed`,
                                keyword: "additionalProperties",
                            });
                        } else {
                            const propErrors = additionalValidator!(
                                obj[objKey],
                                `${path}/${objKey}`,
                            );
                            errors.push(...propErrors);
                        }
                    }
                }
            }
        }

        // --- array constraints ---
        if (hasArrayConstraints && Array.isArray(value)) {
            if (hasMinItems && value.length < minItems) {
                errors.push({
                    path,
                    message: `Array length ${value.length} is less than minItems ${minItems}`,
                    keyword: "minItems",
                });
            }
            if (hasMaxItems && value.length > maxItems) {
                errors.push({
                    path,
                    message: `Array length ${value.length} is greater than maxItems ${maxItems}`,
                    keyword: "maxItems",
                });
            }
            if (itemsValidator !== null) {
                for (let i = 0; i < value.length; i++) {
                    const itemErrors = itemsValidator(value[i], `${path}/${i}`);
                    errors.push(...itemErrors);
                }
            }
        }

        return errors;
    };
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
    const compiled = compileSchema(schema);
    return compiled(value, path);
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
