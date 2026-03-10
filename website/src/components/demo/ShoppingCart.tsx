// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { useState, useEffect } from "react";
import {
    MnemonicProvider,
    useMnemonicKey,
    JSONCodec,
    CodecError,
    SchemaError,
    defineMnemonicKey,
} from "react-mnemonic";
import type { StorageLike } from "react-mnemonic";
import { createIdbStorage } from "./idb-storage";
import { enableDemoDevTools } from "./devtools";

interface CatalogProduct {
    sku: string;
    title: string;
    unitPriceCents: number;
}

interface CartLine {
    sku: string;
    title: string;
    unitPriceCents: number;
    quantity: number;
}

interface CartState {
    currencyCode: "USD";
    items: CartLine[];
}

const catalog: CatalogProduct[] = [
    { sku: "widget", title: "Widget", unitPriceCents: 999 },
    { sku: "gadget", title: "Gadget", unitPriceCents: 2499 },
    { sku: "doohickey", title: "Doohickey", unitPriceCents: 1450 },
    { sku: "thingamajig", title: "Thingamajig", unitPriceCents: 3999 },
];

const emptyCart = (): CartState => ({
    currencyCode: "USD",
    items: [],
});

const cartKey = defineMnemonicKey("cart-state", {
    defaultValue: (error?: CodecError | SchemaError): CartState => {
        if (error) {
            console.warn("[ShoppingCart] Falling back to an empty cart:", error.message);
        }

        return emptyCart();
    },
    codec: JSONCodec,
    listenCrossTab: true,
});

function formatMoney(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
}

function normalizeQuantity(quantity: number): number {
    return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
}

function addProduct(cart: CartState, product: CatalogProduct, quantity: number = 1): CartState {
    const nextQuantity = normalizeQuantity(quantity);
    if (nextQuantity === 0) {
        return cart;
    }

    const existingLine = cart.items.find((item) => item.sku === product.sku);
    if (!existingLine) {
        return {
            ...cart,
            items: [
                ...cart.items,
                {
                    sku: product.sku,
                    title: product.title,
                    unitPriceCents: product.unitPriceCents,
                    quantity: nextQuantity,
                },
            ],
        };
    }

    return {
        ...cart,
        items: cart.items.map((item) =>
            item.sku === product.sku
                ? {
                      ...item,
                      title: product.title,
                      unitPriceCents: product.unitPriceCents,
                      quantity: item.quantity + nextQuantity,
                  }
                : item,
        ),
    };
}

function updateProductQuantity(cart: CartState, sku: string, quantity: number): CartState {
    const nextQuantity = normalizeQuantity(quantity);
    if (nextQuantity === 0) {
        return {
            ...cart,
            items: cart.items.filter((item) => item.sku !== sku),
        };
    }

    return {
        ...cart,
        items: cart.items.map((item) => (item.sku === sku ? { ...item, quantity: nextQuantity } : item)),
    };
}

function removeProduct(cart: CartState, sku: string): CartState {
    return {
        ...cart,
        items: cart.items.filter((item) => item.sku !== sku),
    };
}

function CartContents() {
    const { value: cart, set, remove } = useMnemonicKey(cartKey);

    const addItem = (product: CatalogProduct) => {
        set((prev) => addProduct(prev, product));
    };

    const updateQty = (sku: string, quantity: number) => {
        set((prev) => updateProductQuantity(prev, sku, quantity));
    };

    const removeItem = (sku: string) => {
        set((prev) => removeProduct(prev, sku));
    };

    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotalCents = cart.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);

    return (
        <div>
            <div className="demo-cart-catalog">
                {catalog.map((p) => (
                    <div key={p.sku} className="demo-catalog-item">
                        <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{p.title}</span>
                        <span className="demo-muted">{formatMoney(p.unitPriceCents)}</span>
                        <button className="button button--sm button--primary" onClick={() => addItem(p)}>
                            Add to Cart
                        </button>
                    </div>
                ))}
            </div>

            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    marginTop: 16,
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "var(--ifm-color-emphasis-100)",
                    fontSize: "0.95rem",
                }}
            >
                <span>
                    <strong>{itemCount}</strong> item{itemCount === 1 ? "" : "s"}
                </span>
                <span>
                    Subtotal: <strong>{formatMoney(subtotalCents)}</strong>
                </span>
            </div>

            {cart.items.length === 0 ? (
                <p className="demo-muted" style={{ textAlign: "center", padding: 24 }}>
                    Your cart is empty. In this demo, an empty cart is persisted as <code>{`{ items: [] }`}</code>.
                </p>
            ) : (
                <>
                    <table className="demo-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Price</th>
                                <th>Qty</th>
                                <th>Subtotal</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {cart.items.map((item) => (
                                <tr key={item.sku}>
                                    <td>{item.title}</td>
                                    <td>{formatMoney(item.unitPriceCents)}</td>
                                    <td>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <button
                                                className="button button--sm button--outline button--secondary"
                                                onClick={() => updateQty(item.sku, item.quantity - 1)}
                                            >
                                                &minus;
                                            </button>
                                            <span style={{ minWidth: 24, textAlign: "center", fontWeight: 600 }}>
                                                {item.quantity}
                                            </span>
                                            <button
                                                className="button button--sm button--outline button--secondary"
                                                onClick={() => updateQty(item.sku, item.quantity + 1)}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </td>
                                    <td>{formatMoney(item.unitPriceCents * item.quantity)}</td>
                                    <td>
                                        <button
                                            className="button button--sm button--danger"
                                            onClick={() => removeItem(item.sku)}
                                        >
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop: "2px solid var(--ifm-color-emphasis-200)",
                            fontWeight: 700,
                        }}
                    >
                        <span>Total</span>
                        <span>{formatMoney(subtotalCents)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        <button
                            className="button button--sm button--outline button--secondary"
                            onClick={() => set(emptyCart())}
                        >
                            Empty Cart
                        </button>
                        <button className="button button--sm button--danger" onClick={() => remove()}>
                            Forget Persisted Cart
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

export function ShoppingCart() {
    const [storage, setStorage] = useState<StorageLike | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        createIdbStorage("react-mnemonic-demo", "cart")
            .then(setStorage)
            .catch((err) => setError(String(err)));
    }, []);

    if (error) {
        return (
            <p style={{ color: "var(--ifm-color-danger)", textAlign: "center", padding: 24 }}>
                Failed to load IndexedDB: {error}
            </p>
        );
    }

    if (!storage) {
        return (
            <p className="demo-muted" style={{ textAlign: "center", padding: 24 }}>
                Loading cart from IndexedDB…
            </p>
        );
    }

    return (
        <MnemonicProvider namespace="cart" storage={storage} enableDevTools={enableDemoDevTools}>
            <CartContents />
        </MnemonicProvider>
    );
}
