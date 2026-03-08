import { useState } from "react";

export function App() {
    const [category, setCategory] = useState("all");
    const [draftSearch, setDraftSearch] = useState("");

    return (
        <section>
            <h1>Catalog</h1>
            <input value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} />
            <button onClick={() => setCategory(category === "all" ? "hardware" : "all")}>Category: {category}</button>
        </section>
    );
}
