import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { mkdir, readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import * as schema from "./schema.js";

async function acquireLock(path?: string) {
  if (!path) return async () => {};
  const file = `${path}.lock`, token = randomUUID(), body = JSON.stringify({ pid: process.pid, token });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await writeFile(file, body, { flag: "wx", mode: 0o600 });
      return async () => { if (await readFile(file, "utf8").catch(() => "") === body) await unlink(file); };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const old = JSON.parse(await readFile(file, "utf8")) as { pid: number };
      if (!Number.isSafeInteger(old.pid) || old.pid < 1) throw new Error("DATABASE_LOCK_INVALID");
      let live = true;
      try { process.kill(old.pid, 0); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ESRCH") live = false; }
      if (live) throw new Error("DATABASE_ALREADY_OPEN: stop the server before backup or a second launch");
      await unlink(file);
    }
  }
  throw new Error("DATABASE_LOCK_UNAVAILABLE");
}
export async function openDatabase(path?: string, restore?: Blob) {
  if (path) await mkdir(path, { recursive: true, mode: 0o700 });
  if (restore && path && (await readdir(path)).length) throw new Error("Restore target must be a new empty directory");
  const unlock = await acquireLock(path);
  const client = new PGlite(path, { ...(restore ? { loadDataDir: restore } : {}) });
  try {
  await client.waitReady;
  await client.exec("CREATE TABLE IF NOT EXISTS studio_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
  for (const file of (await readdir(resolve("server/db/migrations"))).filter(n => n.endsWith(".sql")).sort()) {
    const sql = await readFile(resolve("server/db/migrations", file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const old = await client.query<{ checksum: string }>("SELECT checksum FROM studio_migrations WHERE name = $1", [file]);
    if (old.rows.length) { if (old.rows[0].checksum !== checksum) throw new Error(`Applied migration checksum mismatch: ${file}`); continue; }
    await client.transaction(async tx => { await tx.exec(sql); await tx.query("INSERT INTO studio_migrations(name,checksum) VALUES($1,$2)", [file, checksum]); });
  }
  const db = drizzle(client, { schema });
  let closed = false;
  return { client, db, close: async () => { if (closed) return; closed = true; try { await client.close(); } finally { await unlock(); } } };
  } catch (error) { await client.close().catch(() => {}); await unlock(); throw error; }
}
export type Database = Awaited<ReturnType<typeof openDatabase>>;
