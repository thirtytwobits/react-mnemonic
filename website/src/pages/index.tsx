import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import CodeBlock from "@theme/CodeBlock";

import styles from "./index.module.css";

const quickExample = `import { MnemonicProvider, useMnemonicKey } from "react-mnemonic";

function Counter() {
  const { value: count, set } = useMnemonicKey("count", {
    defaultValue: 0,
  });

  return (
    <button onClick={() => set((c) => c + 1)}>
      Count: {count}
    </button>
  );
}

export default function App() {
  return (
    <MnemonicProvider namespace="my-app">
      <Counter />
    </MnemonicProvider>
  );
}`;

type FeatureItem = {
    title: string;
    description: string;
};

const features: FeatureItem[] = [
    {
        title: "useState-like API",
        description:
            "useMnemonicKey returns { value, set, reset, remove } — the same mental model as useState, with persistence built in.",
    },
    {
        title: "JSON Schema Validation",
        description:
            "Optional schema-based validation using a built-in JSON Schema subset. Versioned schemas with automatic migration paths.",
    },
    {
        title: "Cross-Tab Sync",
        description:
            "Opt-in listenCrossTab uses the browser storage event. Custom backends can use BroadcastChannel via onExternalChange.",
    },
    {
        title: "Pluggable Storage",
        description:
            "Bring your own backend via the StorageLike interface — IndexedDB, sessionStorage, or anything with get/set/remove.",
    },
    {
        title: "Schema Migration",
        description:
            "Upgrade stored data with versioned schemas and migration rules. Write-time normalizers keep data clean on every write.",
    },
    {
        title: "Zero Dependencies",
        description:
            "Tree-shakeable, ships ESM + CJS with full TypeScript declarations. SSR-safe — returns defaults when window is unavailable.",
    },
];

function HomepageHeader() {
    const { siteConfig } = useDocusaurusContext();
    return (
        <header className={clsx("hero hero--primary", styles.heroBanner)}>
            <div className="container">
                <h1 className="hero__title">{siteConfig.title}</h1>
                <p className="hero__subtitle">{siteConfig.tagline}</p>
                <div className={styles.buttons}>
                    <Link className="button button--secondary button--lg" to="/docs/getting-started/installation">
                        Get Started
                    </Link>
                    <Link
                        className="button button--outline button--secondary button--lg"
                        to="/docs/api"
                        style={{ marginLeft: "1rem" }}
                    >
                        API Reference
                    </Link>
                </div>
                <div className={styles.installSnippet}>
                    <code>npm install react-mnemonic</code>
                </div>
            </div>
        </header>
    );
}

function Feature({ title, description }: FeatureItem) {
    return (
        <div className={clsx("col col--4")}>
            <div className="feature-card" style={{ height: "100%", marginBottom: "1rem" }}>
                <h3>{title}</h3>
                <p>{description}</p>
            </div>
        </div>
    );
}

function HomepageFeatures() {
    return (
        <section className={styles.features}>
            <div className="container">
                <div className="row">
                    {features.map((props, idx) => (
                        <Feature key={idx} {...props} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function HomepageExample() {
    return (
        <section className={styles.example}>
            <div className="container">
                <h2 style={{ textAlign: "center", marginBottom: "2rem" }}>Simple as useState</h2>
                <div className="row">
                    <div className="col col--8 col--offset-2">
                        <CodeBlock language="tsx" title="App.tsx">
                            {quickExample}
                        </CodeBlock>
                        <p style={{ textAlign: "center", marginTop: "1rem", opacity: 0.8 }}>
                            The counter value persists in <code>localStorage</code> under <code>my-app.count</code> and
                            survives full page reloads.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function Home(): React.JSX.Element {
    const { siteConfig } = useDocusaurusContext();
    return (
        <Layout title={siteConfig.title} description={siteConfig.tagline}>
            <HomepageHeader />
            <main>
                <HomepageFeatures />
                <HomepageExample />
            </main>
        </Layout>
    );
}
