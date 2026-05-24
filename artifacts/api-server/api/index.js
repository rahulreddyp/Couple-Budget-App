// Plain JS entrypoint — Vercel runs this directly without TypeScript transpilation.
// esbuild (build.mjs) compiles the full source + all @workspace/* packages into dist/app.mjs.
export { default } from "../dist/app.mjs";
