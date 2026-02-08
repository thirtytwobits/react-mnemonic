// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { useState, useEffect } from "react";
import { MnemonicProvider, useMnemonicKey, JSONCodec } from "react-mnemonic";
import type { StorageLike } from "react-mnemonic";
import { createIdbStorage } from "../storage/idb-storage";

interface CartItem {
    id: string;
    name: string;
    price: number;
    qty: number;
}

const catalog = [
    { id: "widget", name: "Widget", price: 9.99 },
    { id: "gadget", name: "Gadget", price: 24.99 },
    { id: "doohickey", name: "Doohickey", price: 14.5 },
    { id: "thingamajig", name: "Thingamajig", price: 39.99 },
];

function CartContents() {
    const {
        value: items,
        set,
        remove,
    } = useMnemonicKey<CartItem[]>("items", {
        defaultValue: [],
        codec: JSONCodec,
    });

    const addItem = (product: (typeof catalog)[number]) => {
        set((prev) => {
            const existing = prev.find((i) => i.id === product.id);
            if (existing) {
                return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
            }
            return [...prev, { ...product, qty: 1 }];
        });
    };

    const updateQty = (id: string, delta: number) => {
        set((prev) => prev.map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0));
    };

    const removeItem = (id: string) => {
        set((prev) => prev.filter((i) => i.id !== id));
    };

    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

    return (
        <div>
            <div className="cart-catalog">
                {catalog.map((p) => (
                    <div key={p.id} className="catalog-item">
                        <span className="item-name">{p.name}</span>
                        <span className="item-price">${p.price.toFixed(2)}</span>
                        <button className="btn btn-primary btn-sm" onClick={() => addItem(p)}>
                            Add to Cart
                        </button>
                    </div>
                ))}
            </div>

            {items.length === 0 ? (
                <p className="cart-empty">Your cart is empty.</p>
            ) : (
                <>
                    <table className="cart-table">
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
                            {items.map((item) => (
                                <tr key={item.id}>
                                    <td>{item.name}</td>
                                    <td>${item.price.toFixed(2)}</td>
                                    <td>
                                        <div className="qty-controls">
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => updateQty(item.id, -1)}
                                            >
                                                &minus;
                                            </button>
                                            <span>{item.qty}</span>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => updateQty(item.id, 1)}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </td>
                                    <td>${(item.price * item.qty).toFixed(2)}</td>
                                    <td>
                                        <button className="btn btn-danger btn-sm" onClick={() => removeItem(item.id)}>
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="cart-total">
                        <span>Total</span>
                        <span>${total.toFixed(2)}</span>
                    </div>
                    <div style={{ marginTop: 8 }}>
                        <button className="btn btn-danger btn-sm" onClick={() => remove()}>
                            Clear Cart
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
        return <p className="cart-error">Failed to load IndexedDB: {error}</p>;
    }

    if (!storage) {
        return <p className="cart-loading">Loading cart from IndexedDB…</p>;
    }

    return (
        <MnemonicProvider namespace="cart" storage={storage}>
            <CartContents />
        </MnemonicProvider>
    );
}
