import { MnemonicProvider, useMnemonicKey } from "react-mnemonic";

function ThemeBadge() {
    const { value } = useMnemonicKey("theme", {
        defaultValue: "light" as "light" | "dark",
        ssr: {
            serverValue: "system",
            hydration: "client-only",
        },
    });

    return <span>{value}</span>;
}

export function App() {
    return (
        <MnemonicProvider namespace="header">
            <ThemeBadge />
        </MnemonicProvider>
    );
}
