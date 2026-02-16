// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import Layout from "@theme/Layout";
import BrowserOnly from "@docusaurus/BrowserOnly";
import { MnemonicProvider } from "react-mnemonic";

import "../css/demo.css";

// Lazy-load demo components that use browser APIs (localStorage, IndexedDB)
function DemoContent() {
    const { ResizablePanel } = require("../components/demo/ResizablePanel");
    const { PersistedForm } = require("../components/demo/PersistedForm");
    const { ShoppingCart } = require("../components/demo/ShoppingCart");
    const { SchemaPlayground } = require("../components/demo/SchemaPlayground");

    return (
        <MnemonicProvider namespace="demo" enableDevTools>
            <section className="demo-section">
                <h2>Resizable Panel</h2>
                <p>
                    Drag the right edge to resize. Width persisted with the
                    default <code>JSONCodec</code>.
                </p>
                <ResizablePanel />
            </section>

            <section className="demo-section">
                <h2>Persisted Form</h2>
                <p>
                    All field values persisted with <code>JSONCodec</code>. Try
                    refreshing the page.
                </p>
                <PersistedForm />
            </section>

            <section className="demo-section">
                <h2>Shopping Cart</h2>
                <p>
                    Uses a custom <code>StorageLike</code> adapter backed by
                    IndexedDB via <code>idb-keyval</code>, running in its own{" "}
                    <code>MnemonicProvider</code>.
                </p>
                <ShoppingCart />
            </section>

            <section className="demo-section">
                <h2>Schema Playground</h2>
                <p>
                    Explore schema versioning and data migration. Define schemas,
                    add migration rules, seed versioned data, and watch{" "}
                    <code>useMnemonicKey</code> decode, validate, and migrate in
                    real time.
                </p>
                <SchemaPlayground />
            </section>
        </MnemonicProvider>
    );
}

export default function DemoPage(): React.JSX.Element {
    return (
        <Layout title="Demo" description="Interactive react-mnemonic demos">
            <div className="demo-page">
                <h1>Interactive Demo</h1>
                <p className="demo-subtitle">
                    Try each demo below — all state persists across page reloads.
                    {" "}
                    <a
                        href="demo"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Open this page in a new tab
                    </a>
                    {" "}to test cross-tab sync.
                </p>
                <BrowserOnly fallback={<p>Loading demos…</p>}>
                    {() => <DemoContent />}
                </BrowserOnly>
            </div>
        </Layout>
    );
}
