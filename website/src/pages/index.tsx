import clsx from "clsx";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import CodeBlock from "@theme/CodeBlock";

import styles from "./index.module.css";

const quickExample = `import { MnemonicProvider, useMnemonicKey } from "react-mnemonic/core";

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

type ResourceItem = {
    title: string;
    href: string;
    description: string;
    external?: boolean;
};

const features: FeatureItem[] = [
    {
        title: "AI-friendly by design",
        description:
            "The project is designed so coding assistants can choose durable state, SSR behavior, nullability, and migrations correctly without inventing storage semantics.",
    },
    {
        title: "useState-like API",
        description:
            "useMnemonicKey returns { value, set, reset, remove } — the same mental model as useState, with persistence built in.",
    },
    {
        title: "SSR-safe by default",
        description:
            "Server renders use defaultValue by default, with opt-in serverValue and client-only hydration controls when you need them.",
    },
];

const aiResources: ResourceItem[] = [
    {
        title: "AI Docs",
        href: "/docs/ai",
        description: "Canonical invariants, decision matrix, recipes, anti-patterns, and setup guidance.",
    },
    {
        title: "llms.txt",
        href: "https://thirtytwobits.github.io/react-mnemonic/llms.txt",
        description: "Compact retrieval index for tight context windows and first-pass tool loading.",
        external: true,
    },
    {
        title: "llms-full.txt",
        href: "https://thirtytwobits.github.io/react-mnemonic/llms-full.txt",
        description: "Long-form export for indexing, retrieval, and larger prompt contexts.",
        external: true,
    },
    {
        title: "ai-contract.json",
        href: "https://thirtytwobits.github.io/react-mnemonic/ai-contract.json",
        description: "Machine-readable persistence contract for tooling and agent integrations.",
        external: true,
    },
    {
        title: "DeepWiki Priorities",
        href: "https://github.com/thirtytwobits/react-mnemonic/blob/main/.devin/wiki.json",
        description: "DeepWiki steering file that points retrieval toward the highest-signal sources.",
        external: true,
    },
    {
        title: "Assistant Setup",
        href: "/docs/ai/assistant-setup",
        description: "Generated instruction packs plus the documented MCP-friendly retrieval path.",
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
                <p className={styles.heroLead}>
                    Built for humans and coding assistants alike, with first-party AI docs and retrieval surfaces that
                    help agents use persistence correctly instead of falling back to raw storage hacks.
                </p>
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
                        to="/docs/ai"
                        style={{ marginLeft: "1rem" }}
                    >
                        AI Docs
                    </Link>
                </div>
                <div className={styles.installSnippet}>
                    <code>npm install react-mnemonic</code>
                </div>
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
                            Need the deterministic implementation contract? <Link to="/docs/ai">Read the AI docs</Link>.
                        </p>
                        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
                            <p style={{ marginBottom: "0.75rem" }}>
                                Evaluating alternatives? See the comparison guide for reproducible bundle measurements
                                and SSR/API tradeoff notes.
                            </p>
                            <Link
                                className="button button--outline button--secondary button--md"
                                to="/docs/guides/comparisons-and-benchmarks"
                            >
                                Compare Approaches
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function HomepageAiResources() {
    return (
        <section className={styles.resources}>
            <div className="container">
                <h2 style={{ textAlign: "center", marginBottom: "0.75rem" }}>AI Resources</h2>
                <p className={styles.resourcesLead}>
                    <code>react-mnemonic</code> ships dedicated retrieval surfaces for coding assistants, benchmarking,
                    DeepWiki, and local MCP-style documentation setups.
                </p>
                <div className="row">
                    {aiResources.map((resource) => (
                        <div key={resource.title} className="col col--4">
                            <div className="feature-card" style={{ height: "100%", marginBottom: "1rem" }}>
                                <h3>{resource.title}</h3>
                                <p>{resource.description}</p>
                                {resource.external ? (
                                    <a href={resource.href} aria-label={`Open ${resource.title}`}>
                                        Open {resource.title}
                                    </a>
                                ) : (
                                    <Link to={resource.href} aria-label={`Open ${resource.title}`}>
                                        Open {resource.title}
                                    </Link>
                                )}
                            </div>
                        </div>
                    ))}
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
                <HomepageAiResources />
                <HomepageAttribution />
            </main>
        </Layout>
    );
}
