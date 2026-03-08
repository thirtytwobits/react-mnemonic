import clsx from "clsx";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
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
        title: "Receipts Included",
        description:
            "The docs publish a comparison guide with reproducible bundle numbers and controlled SSR/API tradeoffs against common alternatives.",
    },
    {
        title: "SSR-safe by default",
        description:
            "Server renders use defaultValue by default, with opt-in serverValue and client-only hydration controls when you need them.",
    },
];

function HomepageHeader() {
    const { siteConfig } = useDocusaurusContext();
    const backgroundVideoUrl = useBaseUrl("/img/ink.mp4");

    return (
        <header className={clsx("hero hero--primary", styles.heroBanner)}>
            <video
                aria-hidden="true"
                className={styles.heroVideo}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                tabIndex={-1}
            >
                <source src={backgroundVideoUrl} type="video/mp4" />
            </video>
            <div className={styles.heroOverlay} />
            <div className={clsx("container", styles.heroContent)}>
                <h1 className="hero__title">{siteConfig.title}</h1>
                <p className="hero__subtitle">{siteConfig.tagline}</p>
                <div className={styles.buttons}>
                    <Link className="button button--secondary button--lg" to="/docs/getting-started/installation">
                        Get Started
                    </Link>
                    <Link
                        className={clsx("button button--outline button--lg", styles.heroOutlineButton)}
                        to="/docs/api"
                        style={{ marginLeft: "1rem" }}
                    >
                        API Reference
                    </Link>
                    <Link
                        className={clsx("button button--outline button--lg", styles.heroOutlineButton)}
                        to="/docs/guides/ai-contract-guide"
                        style={{ marginLeft: "1rem" }}
                    >
                        AI Contract Guide
                    </Link>
                    <Link
                        className={clsx("button button--outline button--lg", styles.heroOutlineButton)}
                        to="/docs/guides/comparisons-and-benchmarks"
                        style={{ marginLeft: "1rem" }}
                    >
                        Compare Approaches
                    </Link>
                </div>
                <div className={styles.installSnippet}>
                    <code>npm install react-mnemonic</code>
                </div>
                <p style={{ marginTop: "1rem", maxWidth: "44rem" }}>
                    Evaluating alternatives? The comparison guide publishes reproducible bundle measurements plus SSR
                    and API tradeoff notes for <code>react-mnemonic</code>, Zustand persist, Jotai{" "}
                    <code>atomWithStorage</code>, <code>use-local-storage-state</code>, and <code>usehooks-ts</code>.
                </p>
            </div>
        </header>
    );
}

function Feature({ title, description }: Readonly<FeatureItem>) {
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
                    {features.map((props) => (
                        <Feature key={props.title} {...props} />
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
                        <p style={{ textAlign: "center", marginTop: "0.75rem" }}>
                            Need the deterministic implementation contract?{" "}
                            <Link to="/docs/guides/ai-contract-guide">Read the AI Contract Guide</Link>.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}

function HomepageAttribution() {
    return (
        <section className={styles.attribution}>
            <div className="container">
                <p>
                    background video by{" "}
                    <a href="https://www.pexels.com/video/clouds-of-black-and-orange-paint-underwater-7565824/">
                        MART PRODUCTION
                    </a>
                </p>
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
                <HomepageAttribution />
            </main>
        </Layout>
    );
}
