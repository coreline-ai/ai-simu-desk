import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { getConfig } from "../config.js";
import { postgresOptions } from "../db/postgres.js";
import { openDatabase } from "../db/database.js";
import { createAuth } from "../adapters/auth.js";
import { createHttp } from "../http.js";
const secret=randomBytes(48).toString("base64url");
test("local remains loopback-only and Vercel requires HTTPS, secret, PostgreSQL and verified remote TLS",()=>{
  assert.equal(getConfig({BETTER_AUTH_SECRET:secret}).deployment,"local");
  assert.throws(()=>getConfig({BETTER_AUTH_SECRET:secret,APP_ORIGIN:"http://example.test"}),/loopback/);
  const env={APP_MODE:"vercel",APP_ORIGIN:"https://studio.example.test",BETTER_AUTH_SECRET:secret,DATABASE_URL:"postgresql://qa:synthetic@db.example.test/studio?sslmode=require"};
  assert.equal(getConfig(env).origin,env.APP_ORIGIN);
  for(const APP_ORIGIN of ["http://studio.example.test","https://user:password@studio.example.test","https://studio.example.test/path","https://studio.example.test?x=1"])assert.throws(()=>getConfig({...env,APP_ORIGIN}));
  assert.throws(()=>getConfig({...env,DATABASE_URL:""}),/DATABASE_URL/);
  assert.throws(()=>getConfig({...env,DATABASE_SSL:"disable"}),/verified/);
  assert.throws(()=>getConfig({...env,BETTER_AUTH_SECRET:"replace-with-secret"}),/SECRET/);
  const {APP_ORIGIN,...automatic}=env;
  assert.equal(getConfig({...automatic,VERCEL_PROJECT_PRODUCTION_URL:"studio.vercel.app"}).origin,"https://studio.vercel.app");
  assert.equal(getConfig({...automatic,VERCEL_ENV:"preview",VERCEL_URL:"preview.vercel.app"}).origin,"https://preview.vercel.app");
  const db=postgresOptions(env.DATABASE_URL);assert.deepEqual(db.ssl,{rejectUnauthorized:true});assert.ok(!db.connectionString.includes("sslmode"));
  assert.throws(()=>postgresOptions("postgresql://qa:synthetic@db.example.test/studio",false),/loopback/);
  assert.throws(()=>postgresOptions("https://db.example.test"),/configuration/);
});
test("HTTPS auth sets Secure HttpOnly cookies and rejects foreign Host/Origin without trusting forwarded origin",async()=>{
  const d=await openDatabase();
  try{
    const config=getConfig({APP_MODE:"vercel",APP_ORIGIN:"https://studio.example.test",BETTER_AUTH_SECRET:secret,DATABASE_URL:"postgresql://qa@localhost/test"});
    const app=createHttp(createAuth(d,config),config);
    const sign=()=>app.request(config.origin+"/api/auth/sign-up/email",{method:"POST",headers:{origin:config.origin,"content-type":"application/json","x-vercel-forwarded-for":"192.0.2.7","x-forwarded-host":"evil.test","x-forwarded-proto":"http"},body:JSON.stringify({name:"Remote QA",email:"remote@example.test",password:"Remote-synthetic-password-1294"})});
    const response=await sign();assert.equal(response.status,200);const header=response.headers.get("set-cookie")??"";assert.match(header,/Secure/);assert.match(header,/HttpOnly/);assert.match(header,/SameSite=Lax/);
    const cookie=header.split(";")[0];assert.equal((await app.request(config.origin+"/api/me",{headers:{cookie}})).status,200);
    assert.equal((await app.request("https://evil.test/api/me",{headers:{cookie,"x-forwarded-host":"studio.example.test"}})).status,403);
    assert.equal((await app.request(config.origin+"/api/auth/sign-out",{method:"POST",headers:{cookie,origin:"https://evil.test","content-type":"application/json"},body:"{}"})).status,403);
  }finally{await d.close();}
});
