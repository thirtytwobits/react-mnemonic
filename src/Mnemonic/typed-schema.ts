// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import type { JsonSchema, JsonSchemaType } from "./json-schema";
import { SchemaError } from "./schema";

declare const typedSchemaBrand: unique symbol;
declare const optionalSchemaBrand: unique symbol;

const optionalSchemaMarker = Symbol("mnemonicOptionalSchema");

type JsonPrimitive = string | number | boolean | null;
type JsonConstValue = JsonPrimitive | readonly JsonConstValue[] | { readonly [key: string]: JsonConstValue };

export type TypedJsonSchema<T> = JsonSchema & {
    readonly [typedSchemaBrand]?: T;
};

type OptionalTypedJsonSchema<T> = TypedJsonSchema<T> & {
    readonly [optionalSchemaBrand]: true;
};

export type InferJsonSchemaValue<TSchema> = TSchema extends TypedJsonSchema<infer TValue> ? TValue : unknown;

type ObjectValueFromSchemas<
    TShape extends Record<string, TypedJsonSchema<unknown> | OptionalTypedJsonSchema<unknown>>,
> = {
    [K in keyof TShape as TShape[K] extends OptionalTypedJsonSchema<unknown> ? never : K]: InferJsonSchemaValue<
        TShape[K]
    >;
} & {
    [K in keyof TShape as TShape[K] extends OptionalTypedJsonSchema<unknown> ? K : never]?: InferJsonSchemaValue<
        TShape[K]
    >;
};

type StringSchemaOptions = Pick<JsonSchema, "minLength" | "maxLength">;
type NumberSchemaOptions = Pick<JsonSchema, "minimum" | "maximum" | "exclusiveMinimum" | "exclusiveMaximum">;
type ArraySchemaOptions = Pick<JsonSchema, "minItems" | "maxItems">;
type ObjectSchemaOptions = Pick<JsonSchema, "additionalProperties">;

function cloneSchema<T>(schema: TypedJsonSchema<T>): TypedJsonSchema<T> {
    const clone = { ...schema } as TypedJsonSchema<T>;
    if ((schema as Record<PropertyKey, unknown>)[optionalSchemaMarker]) {
        Object.defineProperty(clone, optionalSchemaMarker, {
            value: true,
            enumerable: false,
            configurable: false,
        });
    }
    return clone;
}

function isOptionalSchema(schema: JsonSchema): boolean {
    return Boolean((schema as Record<PropertyKey, unknown>)[optionalSchemaMarker]);
}

function markOptional<T>(schema: TypedJsonSchema<T>): OptionalTypedJsonSchema<T> {
    const clone = cloneSchema(schema) as OptionalTypedJsonSchema<T>;
    Object.defineProperty(clone, optionalSchemaMarker, {
        value: true,
        enumerable: false,
        configurable: false,
    });
    return clone;
}

function withoutOptionalMarker<T>(schema: TypedJsonSchema<T> | OptionalTypedJsonSchema<T>): TypedJsonSchema<T> {
    const clone = { ...schema } as TypedJsonSchema<T>;
    delete (clone as Record<PropertyKey, unknown>)[optionalSchemaMarker];
    return clone;
}

function withType<T>(
    type: JsonSchemaType | JsonSchemaType[],
    extra: Omit<JsonSchema, "type"> = {},
): TypedJsonSchema<T> {
    return {
        type,
        ...extra,
    } as TypedJsonSchema<T>;
}

function toTypeArray(type: JsonSchemaType | JsonSchemaType[] | undefined): JsonSchemaType[] | null {
    if (type === undefined) return null;
    return Array.isArray(type) ? [...type] : [type];
}

function nullableSchema<T>(schema: TypedJsonSchema<T>): TypedJsonSchema<T | null> {
    if (schema.enum) {
        return {
            ...schema,
            enum: schema.enum.includes(null) ? schema.enum : [...schema.enum, null],
        } as TypedJsonSchema<T | null>;
    }

    if ("const" in schema) {
        return {
            enum: [schema.const ?? null, null],
        } as TypedJsonSchema<T | null>;
    }

    const types = toTypeArray(schema.type);
    if (types === null) {
        throw new SchemaError(
            "MODE_CONFIGURATION_INVALID",
            "mnemonicSchema.nullable(...) requires a schema with type, enum, or const",
        );
    }

    return {
        ...schema,
        type: types.includes("null") ? types : [...types, "null"],
    } as TypedJsonSchema<T | null>;
}

/**
 * Builder helpers for strongly typed schemas backed by Mnemonic's built-in
 * JSON Schema subset.
 *
 * The returned schemas are plain `JsonSchema` objects at runtime, so they can
 * be registered directly in `createSchemaRegistry(...)` while also carrying a
 * phantom TypeScript type for inference.
 */
export const mnemonicSchema = {
    string(options: StringSchemaOptions = {}): TypedJsonSchema<string> {
        return withType<string>("string", options);
    },

    number(options: NumberSchemaOptions = {}): TypedJsonSchema<number> {
        return withType<number>("number", options);
    },

    integer(options: NumberSchemaOptions = {}): TypedJsonSchema<number> {
        return withType<number>("integer", options);
    },

    boolean(): TypedJsonSchema<boolean> {
        return withType<boolean>("boolean");
    },

    nullValue(): TypedJsonSchema<null> {
        return withType<null>("null");
    },

    literal<const TValue extends JsonConstValue>(value: TValue): TypedJsonSchema<TValue> {
        return {
            const: value,
        } as TypedJsonSchema<TValue>;
    },

    enum<const TValues extends readonly [JsonPrimitive, ...JsonPrimitive[]]>(
        values: TValues,
    ): TypedJsonSchema<TValues[number]> {
        return {
            enum: values,
        } as TypedJsonSchema<TValues[number]>;
    },

    optional<T>(schema: TypedJsonSchema<T>): OptionalTypedJsonSchema<T> {
        return markOptional(schema);
    },

    nullable<T>(schema: TypedJsonSchema<T>): TypedJsonSchema<T | null> {
        return nullableSchema(schema);
    },

    array<TItemSchema extends TypedJsonSchema<unknown>>(
        itemSchema: TItemSchema,
        options: ArraySchemaOptions = {},
    ): TypedJsonSchema<InferJsonSchemaValue<TItemSchema>[]> {
        return withType<InferJsonSchemaValue<TItemSchema>[]>("array", {
            items: withoutOptionalMarker(itemSchema),
            ...options,
        });
    },

    object<TShape extends Record<string, TypedJsonSchema<unknown> | OptionalTypedJsonSchema<unknown>>>(
        shape: TShape,
        options: ObjectSchemaOptions = {},
    ): TypedJsonSchema<ObjectValueFromSchemas<TShape>> {
        const properties: Record<string, JsonSchema> = {};
        const required: string[] = [];

        for (const [name, schema] of Object.entries(shape)) {
            properties[name] = withoutOptionalMarker(schema);
            if (!isOptionalSchema(schema)) {
                required.push(name);
            }
        }

        const result: JsonSchema = {
            type: "object",
            properties,
            ...options,
        };

        if (required.length > 0) {
            result.required = required;
        }

        return result as TypedJsonSchema<ObjectValueFromSchemas<TShape>>;
    },

    record<TValueSchema extends TypedJsonSchema<unknown>>(
        valueSchema: TValueSchema,
    ): TypedJsonSchema<Record<string, InferJsonSchemaValue<TValueSchema>>> {
        return withType<Record<string, InferJsonSchemaValue<TValueSchema>>>("object", {
            additionalProperties: withoutOptionalMarker(valueSchema),
        });
    },
};
