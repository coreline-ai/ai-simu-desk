import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
// Keep the old preview URLs while exposing only their public folders.
const app = new Hono();
for (const folder of ["demo", "pilot-3d", "docs"]) app.use(`/${folder}/*`, serveStatic({ root: `./${folder}`, rewriteRequestPath: path => path.replace(new RegExp(`^/${folder}`), "") }));
app.notFound(c => c.text("Not found", 404));
const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 4173 }, () => console.log("Public demo folders only: http://127.0.0.1:4173/demo/preview.html"));
process.on("SIGINT", () => server.close()); process.on("SIGTERM", () => server.close());
