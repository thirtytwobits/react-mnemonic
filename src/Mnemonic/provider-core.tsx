// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import type { ReactNode } from "react";
import { MnemonicProvider as SchemaMnemonicProvider } from "./provider";
import type { MnemonicProviderOptions, SchemaRegistry, SchemaMode } from "./types";

type CoreMnemonicProviderOptions = Omit<MnemonicProviderOptions, "schemaMode" | "schemaRegistry">;
export type { CoreMnemonicProviderOptions as MnemonicProviderOptions };

function throwCoreProviderSchemaImportError(propName: "schemaMode" | "schemaRegistry"): never {
    throw new Error(
        `[Mnemonic] MnemonicProvider from react-mnemonic/core does not support ${propName}. Import MnemonicProvider from "react-mnemonic/schema" or "react-mnemonic" for schema validation, autoschema, and migration support.`,
    );
}

function assertNoSchemaProps(props: { schemaMode?: SchemaMode; schemaRegistry?: SchemaRegistry }): void {
    if (props.schemaMode !== undefined) {
        throwCoreProviderSchemaImportError("schemaMode");
    }
    if (props.schemaRegistry !== undefined) {
        throwCoreProviderSchemaImportError("schemaRegistry");
    }
}

export interface MnemonicProviderProps extends Readonly<CoreMnemonicProviderOptions> {
    readonly children: ReactNode;
}

export function MnemonicProvider(props: Readonly<MnemonicProviderProps>): ReactNode {
    assertNoSchemaProps(props as MnemonicProviderProps & { schemaMode?: SchemaMode; schemaRegistry?: SchemaRegistry });
    return <SchemaMnemonicProvider {...props} />;
}
