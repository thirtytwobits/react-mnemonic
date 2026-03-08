declare module "react-mnemonic" {
    export type MnemonicKeyState<T> = {
        value: T;
        set(next: T | ((current: T) => T)): void;
    };

    export function MnemonicProvider(props: { namespace: string; children: React.ReactNode }): React.ReactElement;

    export function defineMnemonicKey<T>(
        key: string,
        options: {
            defaultValue: T;
            listenCrossTab?: boolean;
        },
    ): unknown;

    export function useMnemonicKey<T>(key: unknown): MnemonicKeyState<T>;
}
