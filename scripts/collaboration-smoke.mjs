import { readFile,writeFile,mkdir } from "node:fs/promises";
import { createHash,randomUUID } from "node:crypto";
const origin="http://127.0.0.1:4180";
const accounts=JSON.parse(await readFile(".data/qa-credentials.json","utf8"));
const id=(await readFile(".data/collaboration-workspace.txt","utf8")).trim();
async function login(account) {
  const response=await fetch(`${origin}/api/auth/sign-in/email`,{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({email:account.email,password:account.password})});
  if(!response.ok)throw new Error(`Synthetic QA login failed (${response.status})`);
  return response.headers.get("set-cookie").split(";")[0];
}
async function get(path,cookie) {
  const response=await fetch(origin+path,{headers:{cookie}});
  if(!response.ok)throw new Error(`Shared read failed (${response.status})`);
  return response.json();
}
const a=await login(accounts.primary),b=await login(accounts.secondary);
if(process.argv.includes("--revoked")) {
  const owner=await get(`/api/workspaces/${id}/snapshot`,a);
  const statuses=await Promise.all(["snapshot","events?after=0"].map(async path=>(await fetch(`${origin}/api/workspaces/${id}/${path}`,{headers:{cookie:b}})).status));
  const listed=await get("/api/workspaces",b);
  if(statuses.some(status=>status!==404)||listed.workspaces.some(space=>space.id===id))throw new Error("Revoked membership still has access");
  const me=await get("/api/me",b);await get(`/api/workspaces/${me.workspace.id}/snapshot`,b);
  const report={independentSessions:true,ownerMembers:owner.members.length,revokedSnapshotStatus:statuses[0],revokedEventsStatus:statuses[1],sharedSpaceRemovedFromList:true,personalWorkspacePreserved:true};
  await writeFile("product/evidence/collaboration/revocation-smoke.json",JSON.stringify(report,null,2)+"\n");
  console.log("Revoked live session: snapshot/events denied, shared space removed, personal space preserved.");
} else {
const [owner,viewer]=await Promise.all([get(`/api/workspaces/${id}/snapshot`,a),get(`/api/workspaces/${id}/snapshot`,b)]);
if(owner.role!=="owner" || viewer.role!=="viewer")throw new Error("Run this check while the secondary QA member is a viewer");
if(owner.runs.some(run=>["queued","running","cancel_requested","awaiting_approval"].includes(run.status)))throw new Error("Finish the UI scenario before comparing final snapshots");
const digest=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
if(digest(owner.runs)!==digest(viewer.runs) || owner.cursor!==viewer.cursor)throw new Error("Shared snapshots did not converge");
const blocked=await fetch(`${origin}/api/workspaces/${id}/runs`,{method:"POST",headers:{cookie:b,origin,"content-type":"application/json","idempotency-key":randomUUID()},body:JSON.stringify({prompt:"직접 API 권한 검사",agentId:"nara",approvalRequired:false,scenario:"normal"})});
if(blocked.status!==403)throw new Error("Viewer command was not rejected");
const [ea,eb]=await Promise.all([get(`/api/workspaces/${id}/events?after=0`,a),get(`/api/workspaces/${id}/events?after=0`,b)]);
if(digest(ea)!==digest(eb))throw new Error("Shared event pages differ");
const report={independentSessions:true,ownerRole:owner.role,viewerRole:viewer.role,members:owner.members.length,runs:owner.runs.length,sameRunSnapshots:true,sameEventPages:true,viewerWriteStatus:blocked.status,latestRunId:owner.runs[0]?.id,latestOutputSha256:digest(owner.runs[0]?.output??"")};
await mkdir("product/evidence/collaboration",{recursive:true});
await writeFile("product/evidence/collaboration/live-smoke.json",JSON.stringify(report,null,2)+"\n");
console.log("Independent live sessions: same persisted runs/events, viewer write rejected, no credentials included in proof.");

}
