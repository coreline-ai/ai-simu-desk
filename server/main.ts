import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { getConfig } from "./config.js";
import { openDatabase } from "./db/database.js";
import { createStudio } from "./db/studio-store.js";
import { createAuth } from "./adapters/auth.js";
import { FakeAgent } from "./adapters/fake-ai.js";
import { createRunner } from "./application/runner.js";
import { createHttp } from "./http.js";

const config = getConfig();
if(config.deployment==="vercel")throw new Error("Use the Vercel API entrypoint for remote mode");
const database = await openDatabase(config.dataDir);
const studio = createStudio(database), auth = createAuth(database, config);
const runner = createRunner(studio, new FakeAgent(config.fakeDelayMs));
await runner.start();
const app = createHttp(auth, config, studio, id => runner.cancel(id));
app.get("/api/worker-health", c => c.json({ status: runner.status().failed ? "unavailable" : "ok", provider: "fake" }));
app.use("/assets/*", serveStatic({ root: "./product/dist" }));
app.get("/start", serveStatic({ path: "./product/dist/start.html" }));
app.use("/demos/*", serveStatic({ root: "./product/dist" }));
app.use("/library/*", serveStatic({ root: "./product/dist" }));
app.get("/", serveStatic({ path: "./product/dist/index.html" }));
app.notFound(c => c.json({ error: "페이지를 찾을 수 없습니다." }, 404));
const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: config.port }, () => console.log(`AI Simu Desk Local ready: ${config.origin} (persistent login/DB, Fake AI)`));
let closing = false;
async function shutdown() {
  if (closing) return; closing = true;
  await runner.stop();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await database.close();
}
server.on("error", (error: NodeJS.ErrnoException) => { console.error("Local server startup failed:", error.code ?? "UNKNOWN"); void shutdown().then(() => { process.exitCode = 1; }); });
process.on("SIGINT", () => { void shutdown(); }); process.on("SIGTERM", () => { void shutdown(); });
