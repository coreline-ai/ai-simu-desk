import { resolve } from "node:path";
export interface Config {
  origin:string;port:number;secret:string;dataDir:string;fakeDelayMs:number;
  deployment?:"local"|"vercel";databaseUrl?:string;databaseCa?:string;databaseSsl?:boolean;
}
export function getConfig(env:NodeJS.ProcessEnv=process.env):Config {
  const remote=env.APP_MODE==="vercel"||env.VERCEL==="1";
  if(env.APP_MODE&&!['local','vercel'].includes(env.APP_MODE))throw new Error("APP_MODE must be local or vercel");
  const port=Number(env.PORT??4180);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error("PORT must be 1024..65535");
  const host=env.VERCEL_ENV==="preview"?env.VERCEL_URL:env.VERCEL_PROJECT_PRODUCTION_URL;
  let origin:URL;
  try{origin=new URL(env.APP_ORIGIN??(remote&&host?`https://${host}`:`http://127.0.0.1:${port}`));}catch{throw new Error("Invalid APP_ORIGIN");}
  if(origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error("APP_ORIGIN must be an origin without a path or credentials");
  const loopback=['127.0.0.1','localhost','[::1]'].includes(origin.hostname);
  if(remote?origin.protocol!=='https:':!loopback||origin.protocol!=='http:')throw new Error(remote?"Vercel requires an explicit HTTPS APP_ORIGIN or deployment domain":"Local mode requires a loopback HTTP origin");
  const secret=env.BETTER_AUTH_SECRET??"";
  if(secret.length<32||secret.startsWith("replace-with"))throw new Error("Set a server-only BETTER_AUTH_SECRET with at least 32 random characters");
  if(env.AI_PROVIDER&&env.AI_PROVIDER!=="fake")throw new Error("Only the explicitly selected Fake AI is supported");
  const delay=Number(env.FAKE_AI_DELAY_MS??65);
  if(!Number.isFinite(delay)||delay<0||delay>1000)throw new Error("Invalid Fake AI delay");
  if(remote&&!env.DATABASE_URL)throw new Error("Vercel requires DATABASE_URL for PostgreSQL");
  if(env.DATABASE_SSL&&!['verify-full','disable'].includes(env.DATABASE_SSL))throw new Error("DATABASE_SSL must be verify-full or loopback-only disable");
  if(remote&&env.DATABASE_SSL==='disable'&&!loopback)throw new Error("Remote HTTPS requires verified PostgreSQL TLS");
  return {origin:origin.origin,port,secret,dataDir:resolve(env.STUDIO_DATA_DIR??".data/studio"),fakeDelayMs:delay,deployment:remote?'vercel':'local',databaseUrl:env.DATABASE_URL||undefined,databaseSsl:env.DATABASE_SSL!=='disable',databaseCa:env.DATABASE_CA};
}
