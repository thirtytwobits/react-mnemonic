// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

// Keep hosted demos production-safe; DevTools stay enabled for local development.
export const enableDemoDevTools = process.env.NODE_ENV !== "production";
