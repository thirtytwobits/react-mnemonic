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
            <div className="resizable-wrapper" ref={wrapperRef} style={{ width }}>
                <div className="resizable-panel">
                    <span className="width-label">{width}</span>
                    <span className="width-unit">px wide</span>
                </div>
                <div className={`drag-handle${dragging.current ? " dragging" : ""}`} onMouseDown={handleMouseDown} />
            </div>
            <div className="resizable-buttons">
                <button className="btn btn-ghost btn-sm" onClick={() => set(MIN_WIDTH)}>
                    Min ({MIN_WIDTH}px)
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => reset()}>
                    Reset (300px)
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => set(MAX_WIDTH)}>
                    Max ({MAX_WIDTH}px)
                </button>
            </div>
        </div>
    );
}
