import { MnemonicProvider, useMnemonicKey } from "../../../dist/index.js";

type Theme = "light" | "dark";

function ThemeButtonInner() {
    const { value: theme, set } = useMnemonicKey<Theme>("theme", {
        defaultValue: "light",
    });

    return <button onClick={() => set(theme === "light" ? "dark" : "light")}>Theme: {theme}</button>;
}

export function ThemeButton() {
    return (
        <MnemonicProvider namespace="bench">
            <ThemeButtonInner />
        </MnemonicProvider>
    );
}
