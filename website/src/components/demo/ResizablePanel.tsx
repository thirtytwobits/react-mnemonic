// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { useRef, useCallback } from "react";
import { useMnemonicKey } from "react-mnemonic";

const MIN_WIDTH = 150;
const MAX_WIDTH = 600;

export function ResizablePanel() {
    const {
        value: width,
        set,
        reset,
    } = useMnemonicKey<number>("panel-width", {
        defaultValue: 300,
        listenCrossTab: true,
    });

    const dragging = useRef(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            dragging.current = true;

            const onMove = (ev: MouseEvent) => {
                if (!dragging.current || !wrapperRef.current) return;
                const rect = wrapperRef.current.getBoundingClientRect();
                const next = Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ev.clientX - rect.left)));
                set(next);
            };

            const onUp = () => {
                dragging.current = false;
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
            };

            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
        },
        [set],
    );

    return (
        <div>
            <div className="demo-resizable-wrapper" ref={wrapperRef} style={{ width }}>
                <div className="demo-resizable-panel">
                    <span className="demo-width-label">{width}</span>
                    <span className="demo-muted">px wide</span>
                </div>
                <div
                    className={`demo-drag-handle${dragging.current ? " dragging" : ""}`}
                    onMouseDown={handleMouseDown}
                />
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button className="button button--sm button--outline button--secondary" onClick={() => set(MIN_WIDTH)}>
                    Min ({MIN_WIDTH}px)
                </button>
                <button className="button button--sm button--outline button--secondary" onClick={() => reset()}>
                    Reset (300px)
                </button>
                <button className="button button--sm button--outline button--secondary" onClick={() => set(MAX_WIDTH)}>
                    Max ({MAX_WIDTH}px)
                </button>
            </div>
        </div>
    );
}
