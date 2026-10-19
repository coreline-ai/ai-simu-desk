import {getConfig,type Config} from "./config.js";
import {openPostgres} from "./db/postgres.js";
import {createStudio} from "./db/studio-store.js";
import {createSharedPresence} from "./db/shared-presence.js";
import {createAuth} from "./adapters/auth.js";
import {composeFakeAnswer} from "./adapters/fake-ai.js";
import {createHttp} from "./http.js";

export async function createRemote(config:Config=getConfig({...process.env,APP_MODE:"vercel"})) {
  if(!config.databaseUrl||config.deployment!=="vercel")throw new Error("Remote mode requires PostgreSQL and HTTPS configuration");
  const database=await openPostgres(config.databaseUrl,{ssl:config.databaseSsl===false?false:{rejectUnauthorized:true,...(config.databaseCa?{ca:config.databaseCa}:{})}});
  const studio=createStudio(database,{answer:composeFakeAnswer,delayMs:config.fakeDelayMs});
  const app=createHttp(createAuth(database,config),config,studio,()=>{},createSharedPresence(database));
  app.get("/api/worker-health",c=>c.json({status:"ok",provider:"fake",execution:"request-driven"}));
  return {app,close:database.close};
}
