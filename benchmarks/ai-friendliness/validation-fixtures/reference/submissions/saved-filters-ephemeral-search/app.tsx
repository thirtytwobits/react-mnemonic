import { useState } from "react";
import { MnemonicProvider, useMnemonicKey } from "react-mnemonic";

function SearchPage() {
    const [draftSearch, setDraftSearch] = useState("");
    const { value: filters, set } = useMnemonicKey("savedFilters", {
        defaultValue: {
            category: "all",
            inStockOnly: false,
        },
    });

    return (
        <>
            <input value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} />
            <button onClick={() => set({ ...filters, inStockOnly: !filters.inStockOnly })}>Toggle stock filter</button>
        </>
    );
}

export function App() {
    return (
        <MnemonicProvider namespace="catalog">
            <SearchPage />
        </MnemonicProvider>
    );
}
