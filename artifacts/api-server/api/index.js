// Vercel serverless entrypoint.
// Uses a dynamic import so Vercel's static bundler does NOT re-trace
// dist/app.mjs and accidentally pull in raw @workspace/* TypeScript sources.
// The compiled bundle (dist/app.mjs) is included at runtime via includeFiles in vercel.json.
const { default: app } = await import("../dist/app.mjs");
export default app;
