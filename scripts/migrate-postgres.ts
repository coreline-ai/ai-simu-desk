import {getConfig} from "../server/config.js";
import {openPostgres} from "../server/db/postgres.js";
const config=getConfig({...process.env,APP_MODE:"vercel"});
if(!config.databaseUrl)throw new Error("DATABASE_URL is required");
try {
  const database=await openPostgres(config.databaseUrl,{migrate:true,ssl:config.databaseSsl===false?false:{rejectUnauthorized:true,...(config.databaseCa?{ca:config.databaseCa}:{})}});
  await database.close();console.log("PostgreSQL checksum migrations applied.");
} catch {console.error("PostgreSQL migration failed. Check the private connection/TLS settings and migration checksums.");process.exitCode=1;}
