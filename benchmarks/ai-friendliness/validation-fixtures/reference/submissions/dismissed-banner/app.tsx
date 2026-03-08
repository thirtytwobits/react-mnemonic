import { MnemonicProvider, useMnemonicKey } from "react-mnemonic";

function AnnouncementBanner() {
    const { value: dismissed, set } = useMnemonicKey("announcementDismissed", {
        defaultValue: false,
    });

    if (dismissed) {
        return null;
    }

    return <button onClick={() => set(true)}>Dismiss</button>;
}

export function App() {
    return (
        <MnemonicProvider namespace="dashboard">
            <AnnouncementBanner />
        </MnemonicProvider>
    );
}
