// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { createElement, type ReactNode } from "react";
import { MnemonicOptionalBridgeContext } from "./optional-bridge";
import type { MnemonicOptionalBridgeInternal } from "./optional-bridge";

export interface MnemonicOptionalBridgeProviderProps {
    readonly bridge: MnemonicOptionalBridgeInternal;
    readonly children: ReactNode;
}

export function MnemonicOptionalBridgeProvider({
    bridge,
    children,
}: Readonly<MnemonicOptionalBridgeProviderProps>): ReactNode {
    return createElement(MnemonicOptionalBridgeContext.Provider, { value: bridge }, children);
}
