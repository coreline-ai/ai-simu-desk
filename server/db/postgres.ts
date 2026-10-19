import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import * as schema from "./schema.js";
import type { StudioDatabase } from "./types.js";

// The small collaboration edition serializes transactions across all Function instances.
// No session-scoped locks: compatible with transaction-mode pooled PostgreSQL URLs.
export const STUDIO_TRANSACTION_LOCK = 20261020;
export function postgresOptions(connectionString: string, ssl: false | {rejectUnauthorized:true;ca?:string} = {rejectUnauthorized:true}) {
  let url: URL;
  try {url=new URL(connectionString);} catch {throw new Error("Invalid PostgreSQL configuration");}
  if(!["postgres:","postgresql:"].includes(url.protocol)||!url.hostname||url.pathname.length<2) throw new Error("Invalid PostgreSQL configuration");
  if(!ssl&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error("Unencrypted PostgreSQL is restricted to loopback tests");
  // pg connection-string ssl parameters otherwise override the explicit verification object.
  for(const key of [...url.searchParams.keys()]) if(key.startsWith("ssl"))url.searchParams.delete(key);
  return {connectionString:url.toString(),ssl,max:2,idleTimeoutMillis:3000,connectionTimeoutMillis:5000,statement_timeout:8000,allowExitOnIdle:true};
}
export async function openPostgres(connectionString: string, options: {ssl?:false|{rejectUnauthorized:true;ca?:string};migrate?:boolean} = {}) {
  const pool=new Pool(postgresOptions(connectionString,options.ssl));
  pool.on("error",()=>{});
  pool.on("connect",client=>client.on("error",()=>{}));
  try {
    if(options.migrate) {
      const client=await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1)",[STUDIO_TRANSACTION_LOCK]);
        await client.query("CREATE TABLE IF NOT EXISTS studio_migrations (name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())");
        for(const file of (await readdir(resolve("server/db/migrations"))).filter(n=>n.endsWith(".sql")).sort()) {
          const source=await readFile(resolve("server/db/migrations",file),"utf8"),checksum=createHash("sha256").update(source).digest("hex");
          const old=await client.query("SELECT checksum FROM studio_migrations WHERE name=$1",[file]);
          if(old.rows.length){if(old.rows[0].checksum!==checksum)throw new Error(`Applied migration checksum mismatch: ${file}`);continue;}
          await client.query(source);await client.query("INSERT INTO studio_migrations(name,checksum) VALUES($1,$2)",[file,checksum]);
        }
        await client.query("COMMIT");
      } catch(error){await client.query("ROLLBACK").catch(()=>{});throw error;}
      finally {client.release();}
    } else await pool.query("SELECT 1 FROM studio_migrations LIMIT 1");
    const db=drizzle(pool,{schema}),transaction=db.transaction.bind(db);
    db.transaction=(fn,config)=>transaction(async tx=>{await tx.execute(sql`SELECT pg_advisory_xact_lock(${STUDIO_TRANSACTION_LOCK})`);return fn(tx);},config);
    const result: StudioDatabase & {pool:Pool;close:()=>Promise<void>}={db,pool,close:()=>pool.end()};
    return result;
  } catch(error){await pool.end();throw error;}
}
