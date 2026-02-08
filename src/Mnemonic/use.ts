// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * @fileoverview React hook for type-safe, persistent state management.
 *
 * This module exports the `useMnemonicKey` hook, which provides a React-friendly
 * API for reading and writing persistent state with automatic synchronization,
 * encoding/decoding, and validation.
 */

import { useSyncExternalStore, useMemo, useEffect, useRef, useCallback } from "react";
import { useMnemonic } from "./provider";
import { JSONCodec, CodecError, ValidationError } from "./codecs";
import type { UseMnemonicKeyOptions } from "./types";

/**
 * React hook for persistent, type-safe state management.
 *
 * Creates a stateful value that persists to storage and synchronizes across
 * components. Works like `useState` but with persistent storage, automatic
 * encoding/decoding, validation, and optional cross-tab synchronization.
 *
 * Must be used within a `MnemonicProvider`. Uses React's `useSyncExternalStore`
 * internally for efficient, tearing-free state synchronization.
 *
 * @template T - The TypeScript type of the stored value
 *
 * @param key - The storage key (unprefixed, namespace is applied automatically)
 * @param options - Configuration options controlling persistence, encoding, and behavior
 *
 * @returns Object with the current value and methods to update it
 * @returns {T} value - The current decoded value from storage, or the default if not present
 * @returns {function} set - Update the stored value (supports both direct values and updater functions)
 * @returns {function} reset - Reset the value to the default and persist it
 * @returns {function} remove - Remove the key from storage entirely (future reads return default)
 *
 * @example
 * ```tsx
 * // Simple counter with persistence
 * function Counter() {
 *   const { value, set } = useMnemonicKey('count', {
 *     defaultValue: 0,
 *     codec: NumberCodec
 *   });
 *
 *   return (
 *     <div>
 *       <p>Count: {value}</p>
 *       <button onClick={() => set(value + 1)}>Increment</button>
 *       <button onClick={() => set(c => c + 1)}>Increment (updater)</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // User profile with validation and callbacks
 * interface UserProfile {
 *   name: string;
 *   email: string;
 * }
 *
 * function ProfileEditor() {
 *   const { value, set, reset } = useMnemonicKey<UserProfile>('profile', {
 *     defaultValue: { name: '', email: '' },
 *     validate: (val): val is UserProfile => {
 *       return typeof val === 'object' &&
 *              typeof val.name === 'string' &&
 *              typeof val.email === 'string';
 *     },
 *     onMount: (profile) => {
 *       console.log('Loaded profile:', profile);
 *       analytics.track('profile_loaded', profile);
 *     },
 *     onChange: (newProfile, oldProfile) => {
 *       console.log('Profile updated:', { old: oldProfile, new: newProfile });
 *     }
 *   });
 *
 *   return (
 *     <form>
 *       <input
 *         value={value.name}
 *         onChange={e => set({ ...value, name: e.target.value })}
 *       />
 *       <button onClick={() => reset()}>Reset</button>
 *     </form>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Theme switcher with cross-tab sync
 * function ThemeSwitcher() {
 *   const { value, set } = useMnemonicKey<'light' | 'dark'>('theme', {
 *     defaultValue: 'light',
 *     codec: StringCodec,
 *     listenCrossTab: true,
 *     onChange: (theme) => {
 *       document.body.className = theme;
 *     }
 *   });
 *
 *   return (
 *     <button onClick={() => set(value === 'light' ? 'dark' : 'light')}>
 *       Toggle Theme ({value})
 *     </button>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Shopping cart with custom codec
 * interface CartItem {
 *   id: string;
 *   quantity: number;
 * }
 *
 * function ShoppingCart() {
 *   const { value: cart, set, remove } = useMnemonicKey<CartItem[]>('cart', {
 *     defaultValue: [],
 *     codec: JSONCodec
 *   });
 *
 *   const addItem = (item: CartItem) => {
 *     set(currentCart => [...currentCart, item]);
 *   };
 *
 *   const clearCart = () => {
 *     remove(); // Completely remove from storage
 *   };
 *
 *   return (
 *     <div>
 *       <p>Items: {cart.length}</p>
 *       <button onClick={clearCart}>Clear Cart</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @remarks
 * - The hook automatically subscribes to storage changes and re-renders on updates
 * - Encoding/decoding errors are caught and logged; the default value is used as fallback
 * - The `set` function supports both direct values and updater functions like `useState`
 * - When using updater functions, the current value is read fresh to avoid stale closures
 * - Cross-tab synchronization requires `listenCrossTab: true` and only works with localStorage
 * - Server-side rendering returns the default value (no storage access)
 *
 * @see {@link UseMnemonicKeyOptions} - Configuration options
 * @see {@link MnemonicProvider} - Required provider component
 * @see {@link Codec} - Type for custom encoding/decoding strategies
 *
 * @throws {Error} If used outside of a MnemonicProvider
 */
export function useMnemonicKey<T>(key: string, options: UseMnemonicKeyOptions<T>) {
    const api = useMnemonic();

    const { defaultValue, validate, onMount, onChange, listenCrossTab, codec: codecOpt } = options;
    const codec = codecOpt ?? JSONCodec;

    /**
     * Helper to get the fallback/default value.
     * Handles both static values and factory functions.
     * Factory functions receive an optional error describing why the fallback
     * is being used (CodecError, ValidationError, or undefined for nominal).
     */
    const getFallback = useCallback(
        (error?: CodecError | ValidationError) =>
            typeof defaultValue === "function"
                ? (defaultValue as (error?: CodecError | ValidationError) => T)(error)
                : defaultValue,
        [defaultValue],
    );

    /**
     * Subscribe to raw storage changes using React's useSyncExternalStore.
     * This ensures efficient, tearing-free updates when storage changes.
     */
    const raw = useSyncExternalStore(
        (listener) => api.subscribeRaw(key, listener),
        () => api.getRawSnapshot(key),
        () => null, // SSR snapshot - no storage in server environment
    );

    /**
     * Decode the raw string into a typed value.
     * Falls back to default if:
     * - No value exists in storage (nominal, error=undefined)
     * - Decoding fails (error=CodecError)
     * - Validation fails (error=ValidationError)
     */
    const value: T = useMemo(() => {
        if (raw == null) return getFallback();

        // --- Decode ---
        let decoded: T;
        try {
            decoded = codec.decode(raw);
        } catch (err) {
            const codecErr =
                err instanceof CodecError
                    ? err
                    : new CodecError(`Codec decode failed for key "${key}"`, err);
            return getFallback(codecErr);
        }

        // --- Validate ---
        if (validate) {
            try {
                if (!validate(decoded)) {
                    return getFallback(new ValidationError(`Validation failed for key "${key}"`));
                }
            } catch (err) {
                const valErr =
                    err instanceof ValidationError
                        ? err
                        : new ValidationError(`Validation threw for key "${key}"`, err);
                return getFallback(valErr);
            }
        }

        return decoded;
        // validate/codec/getFallback/key affect decoding semantics
    }, [raw, codec, validate, getFallback, key]);

    /**
     * Track previous value for onChange callback.
     */
    const prevRef = useRef<T>(value);

    /**
     * Call onMount callback once when the hook first mounts.
     * Receives the initial value loaded from storage.
     */
    const mounted = useRef(false);
    useEffect(() => {
        if (mounted.current) return;
        mounted.current = true;
        onMount?.(value);
        prevRef.current = value;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Call onChange callback whenever the decoded value changes.
     * Provides both the new value and the previous value.
     */
    useEffect(() => {
        const prev = prevRef.current;
        if (Object.is(prev, value)) return;
        prevRef.current = value;
        onChange?.(value, prev);
    }, [value, onChange]);

    /**
     * Optional cross-tab synchronization.
     * Listens for storage events from other tabs and syncs changes
     * into this tab's store cache.
     */
    useEffect(() => {
        if (!listenCrossTab) return;
        if (typeof window === "undefined") return;

        const storageKey = api.prefix + key;

        const handler = (e: StorageEvent) => {
            // localStorage.clear() in another tab emits `key === null`.
            if (e.key === null) {
                api.removeRaw(key);
                return;
            }
            if (e.key !== storageKey) return;
            // Another tab removed the key:
            if (e.newValue == null) {
                api.removeRaw(key);
                return;
            }
            api.setRaw(key, e.newValue);
        };

        window.addEventListener("storage", handler);
        return () => window.removeEventListener("storage", handler);
    }, [listenCrossTab, api, key]);

    /**
     * Update function - supports both direct values and updater functions.
     *
     * @param next - Either a new value, or a function that receives the current value and returns the next value
     *
     * @example
     * ```typescript
     * // Direct value
     * set(42);
     *
     * // Updater function
     * set(count => count + 1);
     * ```
     */
    const set = useMemo(() => {
        return (next: T | ((cur: T) => T)) => {
            // For function updates, read the current value fresh to avoid stale closures
            let currentValue: T;
            if (typeof next === "function") {
                const rawCurrent = api.getRawSnapshot(key);
                if (rawCurrent == null) {
                    currentValue = getFallback();
                } else {
                    // --- Decode ---
                    let decoded: T | undefined;
                    let decodeError: CodecError | undefined;
                    try {
                        decoded = codec.decode(rawCurrent);
                    } catch (err) {
                        decodeError =
                            err instanceof CodecError
                                ? err
                                : new CodecError(`Codec decode failed for key "${key}"`, err);
                    }

                    if (decodeError) {
                        currentValue = getFallback(decodeError);
                    } else if (validate) {
                        // --- Validate ---
                        try {
                            if (!validate(decoded!)) {
                                currentValue = getFallback(
                                    new ValidationError(`Validation failed for key "${key}"`),
                                );
                            } else {
                                currentValue = decoded!;
                            }
                        } catch (err) {
                            const valErr =
                                err instanceof ValidationError
                                    ? err
                                    : new ValidationError(`Validation threw for key "${key}"`, err);
                            currentValue = getFallback(valErr);
                        }
                    } else {
                        currentValue = decoded!;
                    }
                }
            }

            const nextVal = typeof next === "function" ? (next as (c: T) => T)(currentValue!) : next;

            let encoded: string;
            try {
                encoded = codec.encode(nextVal);
            } catch (err) {
                if (err instanceof CodecError) {
                    console.error(`[Mnemonic] Codec encode error for key "${key}":`, err.message);
                }
                return;
            }

            api.setRaw(key, encoded);
        };
        // Note: does not depend on `value` to avoid stale closures
    }, [api, key, codec, validate, getFallback]);

    /**
     * Reset function - sets the value back to the default and persists it.
     *
     * @example
     * ```typescript
     * reset(); // Restores the defaultValue and writes it to storage
     * ```
     */
    const reset = useMemo(() => {
        return () => {
            const v = getFallback();
            let encoded: string;
            try {
                encoded = codec.encode(v);
            } catch (err) {
                if (err instanceof CodecError) {
                    console.error(`[Mnemonic] Codec encode error for key "${key}":`, err.message);
                }
                return;
            }
            api.setRaw(key, encoded);
        };
    }, [api, key, codec, getFallback]);

    /**
     * Remove function - completely removes the key from storage.
     * Future reads will return the default value.
     *
     * @example
     * ```typescript
     * remove(); // Deletes the key from storage
     * ```
     */
    const remove = useMemo(() => {
        return () => api.removeRaw(key);
    }, [api, key]);

    return useMemo(() => ({ value, set, reset, remove }), [value, set, reset, remove]);
}
