import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { getConfig } from "./config.js";
import { openDatabase } from "./db/database.js";
import { openPostgres } from "./db/postgres.js";
import { createRuntime } from "./runtime.js";

const config = getConfig();
if(config.deployment==="vercel")throw new Error("Use the Vercel API entrypoint for remote mode");
const database = config.databaseUrl ? await openPostgres(config.databaseUrl,{migrate:true,ssl:config.databaseSsl===false?false:{rejectUnauthorized:true,...(config.databaseCa?{ca:config.databaseCa}:{})}}) : await openDatabase(config.dataDir);
const app = createRuntime(database,config);
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
  await new Promise<void>(resolve => server.close(() => resolve()));
  await database.close();
}
server.on("error", (error: NodeJS.ErrnoException) => { console.error("Local server startup failed:", error.code ?? "UNKNOWN"); void shutdown().then(() => { process.exitCode = 1; }); });
process.on("SIGINT", () => { void shutdown(); }); process.on("SIGTERM", () => { void shutdown(); });
