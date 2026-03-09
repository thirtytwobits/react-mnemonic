import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts", "src/core.ts", "src/schema.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
    external: ["react", "react-dom"],
});
