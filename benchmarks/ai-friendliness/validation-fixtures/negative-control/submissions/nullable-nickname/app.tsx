import { useEffect, useState } from "react";

export function App() {
    const [nickname, setNickname] = useState("");

    useEffect(() => {
        const saved = window.localStorage.getItem("nickname");
        if (saved) {
            setNickname(saved);
        }
    }, []);

    return (
        <>
            <input
                value={nickname}
                onChange={(event) => {
                    setNickname(event.target.value);
                    if (event.target.value === "") {
                        window.localStorage.removeItem("nickname");
                    } else {
                        window.localStorage.setItem("nickname", event.target.value);
                    }
                }}
            />
            <button
                onClick={() => {
                    setNickname("");
                    window.localStorage.removeItem("nickname");
                }}
            >
                Clear nickname
            </button>
        </>
    );
}
