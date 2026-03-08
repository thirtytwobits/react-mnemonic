# Comparison Benchmarks

This directory pins the third-party dependencies used by
`npm run benchmarks:compare`.

The benchmark runner bundles small, equivalent "persisted theme toggle"
examples for each library with esbuild and records the minified and gzipped
bundle sizes in `website/static/benchmarks/comparison-results.json`.

To refresh the data:

```bash
npm --prefix benchmarks/comparison ci
npm run build
npm run benchmarks:compare
```
