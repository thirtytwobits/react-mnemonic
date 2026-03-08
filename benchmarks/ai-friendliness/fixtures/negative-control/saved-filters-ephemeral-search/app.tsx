import { useEffect, useState } from "react";

export function App() {
    const [category, setCategory] = useState("all");
    const [draftSearch, setDraftSearch] = useState("");

    useEffect(() => {
        const savedCategory = window.localStorage.getItem("category");
        const savedDraft = window.localStorage.getItem("draftSearch");

        if (savedCategory) {
            setCategory(savedCategory);
        }
        if (savedDraft) {
            setDraftSearch(savedDraft);
        }
    }, []);

    return (
        <>
            <input
                value={draftSearch}
                onChange={(event) => {
                    setDraftSearch(event.target.value);
                    window.localStorage.setItem("draftSearch", event.target.value);
                }}
            />
            <button
                onClick={() => {
                    const next = category === "all" ? "hardware" : "all";
                    setCategory(next);
                    window.localStorage.setItem("category", next);
                }}
            >
                {category}
            </button>
        </>
    );
}
