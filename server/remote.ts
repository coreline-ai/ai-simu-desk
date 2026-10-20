import {getConfig,type Config} from "./config.js";
import {openPostgres} from "./db/postgres.js";
import {createRuntime} from "./runtime.js";

export async function createRemote(config:Config=getConfig({...process.env,APP_MODE:"vercel"})) {
  if(!config.databaseUrl||config.deployment!=="vercel")throw new Error("Remote mode requires PostgreSQL and HTTPS configuration");
  const database=await openPostgres(config.databaseUrl,{ssl:config.databaseSsl===false?false:{rejectUnauthorized:true,...(config.databaseCa?{ca:config.databaseCa}:{})}});
  const app=createRuntime(database,config);
  return {app,close:database.close};
}
