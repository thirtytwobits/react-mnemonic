import { MnemonicProvider, useMnemonicKey } from "react-mnemonic";

function Preferences() {
    const preference = useMnemonicKey("theme", {
        defaultValue: "light" as "light" | "dark",
    });

    return (
        <>
            <p>Theme: {preference.value}</p>
            <button onClick={() => preference.reset()}>Reset to defaults</button>
            <button onClick={() => preference.remove()}>Remove saved preference</button>
        </>
    );
}

export function App() {
    return (
        <MnemonicProvider namespace="prefs">
            <Preferences />
        </MnemonicProvider>
    );
}
