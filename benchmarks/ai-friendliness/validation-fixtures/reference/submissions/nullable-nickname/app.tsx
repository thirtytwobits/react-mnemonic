import { MnemonicProvider, useMnemonicKey } from "react-mnemonic";

function NicknameEditor() {
    const { value: nickname, set } = useMnemonicKey<string | null>("nickname", {
        defaultValue: null,
    });

    return (
        <>
            <input
                value={nickname ?? ""}
                onChange={(event) => set(event.target.value === "" ? null : event.target.value)}
            />
            <button onClick={() => set(null)}>Clear nickname</button>
        </>
    );
}

export function App() {
    return (
        <MnemonicProvider namespace="profile">
            <NicknameEditor />
        </MnemonicProvider>
    );
}
