import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {randomUUID,createHash} from "node:crypto";
const origin="http://127.0.0.1:4180",accounts=JSON.parse(await readFile(".data/qa-credentials.json","utf8")),id=(await readFile(".data/collaboration-workspace.txt","utf8")).trim();
async function call(path,cookie,body) {
  const response=await fetch(origin+path,{method:body===undefined?"GET":"POST",headers:{...(cookie?{cookie}:{}),origin,"content-type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,data:await response.json(),cookie:response.headers.get("set-cookie")?.split(";")[0]};
}
async function login(account) {const r=await call("/api/auth/sign-in/email",undefined,{email:account.email,password:account.password});assert.equal(r.status,200);return r.cookie;}
const a=await login(accounts.primary),b=await login(accounts.secondary),base=`/api/workspaces/${id}`;
const first={clientId:randomUUID()},second={clientId:randomUUID()},observer={clientId:randomUUID()};
const hash=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
try {
  const before=(await call(base+"/snapshot",a)).data;
  assert.equal((await call(base+"/presence",undefined,first)).status,401);
  assert.equal((await call(base+"/presence",a,{clientId:"invalid"})).status,400);
  assert.equal((await call(base+"/presence",a,first)).status,200);
  const initial=(await call(base+"/presence",b,observer)).data;
  const same=(await call(base+"/presence",a,second)).data;
  assert.equal(same.version,initial.version);assert.equal(same.members.filter(p=>p.online).length,2);
  await call(base+"/presence/leave",a,first);
  const remaining=(await call(base+"/presence",b,observer)).data;assert.equal(remaining.version,same.version);
  assert.equal((await call(base+"/presence",a,first)).status,409);
  await call(base+"/presence/leave",a,second);
  const after=(await call(base+"/snapshot",a)).data;
  assert.equal(before.workspace.revision,after.workspace.revision);assert.equal(before.cursor,after.cursor);assert.equal(hash(before.runs),hash(after.runs));
  const report={checkedAt:new Date().toISOString(),independentSessions:true,twoUsersOnline:true,duplicateTabNoJoin:true,oneTabLeaveNoDeparture:true,closedTabHeartbeatStatus:409,anonymousStatus:401,invalidIdStatus:400,workspaceRevisionUnchanged:true,durableEventCursorUnchanged:true,runSnapshotsUnchanged:true,runs:after.runs.length,runSha256:hash(after.runs),noClientOrSessionIdentifiersInResponse:!JSON.stringify(same).includes(first.clientId)&&!JSON.stringify(same).includes('"sessionId"')};
  assert.equal(report.noClientOrSessionIdentifiersInResponse,true);
  await writeFile("product/evidence/presence/live-smoke.json",JSON.stringify(report,null,2)+"\n");
  console.log("Presence live smoke passed: two sessions, tab aggregation, closed-tab rejection and durable data preservation.");
} finally {
  for(const [cookie,body] of [[a,first],[a,second],[b,observer]])await call(base+"/presence/leave",cookie,body);
  for(const cookie of [a,b])await call("/api/auth/sign-out",cookie,{});
}
