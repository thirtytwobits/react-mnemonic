import { defineMnemonicKey, MnemonicProvider, useMnemonicKey } from "react-mnemonic";

const themeKey = defineMnemonicKey("theme", {
    defaultValue: "light" as "light" | "dark",
    listenCrossTab: true,
});

function ThemePanel() {
    const { value: theme, set } = useMnemonicKey(themeKey);
    return <button onClick={() => set(theme === "light" ? "dark" : "light")}>{theme}</button>;
}

export function App() {
    return (
        <MnemonicProvider namespace="settings">
            <ThemePanel />
        </MnemonicProvider>
    );
}
