// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { useEffect } from "react";
import { MnemonicProvider, useMnemonicKey, StringCodec } from "react-mnemonic";
import { ThemeToggle } from "./components/ThemeToggle";
import { ResizablePanel } from "./components/ResizablePanel";
import { PersistedForm } from "./components/PersistedForm";
import { ShoppingCart } from "./components/ShoppingCart";

function ThemeRoot({ children }: { children: React.ReactNode }) {
    const { value: mode } = useMnemonicKey<string>("theme-mode", {
        defaultValue: "system",
        codec: StringCodec,
        listenCrossTab: true,
    });

    useEffect(() => {
        if (mode === "system") {
            // Remove the attribute so CSS @media (prefers-color-scheme) takes over.
            document.documentElement.removeAttribute("data-theme");
        } else {
            document.documentElement.setAttribute("data-theme", mode);
        }
    }, [mode]);

    return <>{children}</>;
}

export function App() {
    return (
        <MnemonicProvider namespace="demo" enableDevTools>
            <ThemeRoot>
                <header className="app-header">
                    <img src="/thinking.png" alt="react-mnemonic logo" className="app-logo" />
                    <div>
                        <h1 className="app-title">react-mnemonic</h1>
                        <p className="app-subtitle">Persistent state management for React</p>
                    </div>
                </header>
                <main className="app-main">
                    <section className="demo-section">
                        <h2 className="section-title">Theme</h2>
                        <p className="section-desc">
                            Persisted with <code>StringCodec</code> and synced across tabs via{" "}
                            <code>listenCrossTab</code>.
                        </p>
                        <ThemeToggle />
                    </section>
                    <section className="demo-section">
                        <h2 className="section-title">Resizable Panel</h2>
                        <p className="section-desc">
                            Drag the right edge to resize. Width persisted with <code>NumberCodec</code>.
                        </p>
                        <ResizablePanel />
                    </section>
                    <section className="demo-section">
                        <h2 className="section-title">Persisted Form</h2>
                        <p className="section-desc">
                            All field values persisted with <code>JSONCodec</code>. Try refreshing the page.
                        </p>
                        <PersistedForm />
                    </section>
                    <section className="demo-section">
                        <h2 className="section-title">Shopping Cart</h2>
                        <p className="section-desc">
                            Uses a custom <code>StorageLike</code> adapter backed by IndexedDB via{" "}
                            <code>idb-keyval</code>, running in its own <code>MnemonicProvider</code>.
                        </p>
                        <ShoppingCart />
                    </section>
                </main>
            </ThemeRoot>
        </MnemonicProvider>
    );
}
