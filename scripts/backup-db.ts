import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getConfig } from "../server/config.js";
import { openDatabase } from "../server/db/database.js";

const mode = process.argv[2] ?? "backup";
if (mode === "backup") {
  const config = getConfig(), database = await openDatabase(config.dataDir);
  try {
    await mkdir(".data/backups", { recursive: true, mode: 0o700 });
    const file = `.data/backups/studio-${new Date().toISOString().replace(/[:.]/g, "-")}.tar.gz`;
    const blob = await database.client.dumpDataDir("gzip");
    await writeFile(file, Buffer.from(await blob.arrayBuffer()), { mode: 0o600, flag: "wx" });
    console.log(`Backup saved: ${file}. Keep this file private.`);
  } finally { await database.close(); }
} else if (mode === "restore" && process.argv[3] && process.argv[4]) {
  const buffer = await readFile(resolve(process.argv[3]));
  const target = resolve(process.argv[4]);
  const database = await openDatabase(target, new Blob([buffer]));
  await database.close(); console.log("Backup restored into the new target directory. Existing DB was not overwritten.");
} else { throw new Error("Usage: backup-db.ts backup | restore <archive> <new-empty-directory>"); }
