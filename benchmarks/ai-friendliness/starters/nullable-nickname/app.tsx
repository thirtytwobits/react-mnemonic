import { useState } from "react";

export function App() {
    const [nickname, setNickname] = useState("scott");

    return (
        <section>
            <h1>Profile</h1>
            <input value={nickname} onChange={(event) => setNickname(event.target.value)} />
            <button onClick={() => setNickname("")}>Clear nickname</button>
        </section>
    );
}
