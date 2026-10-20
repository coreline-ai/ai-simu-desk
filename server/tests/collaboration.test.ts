import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { openDatabase } from "../db/database.js";
import { createStudio } from "../db/studio-store.js";
import { user, members, workspaceInvites } from "../db/schema.js";

const input = { prompt:"공동 업무 상태를 검토해 줘",agentId:"jun",approvalRequired:true,scenario:"normal" };
test("shared members observe the same durable state while role, actor, invitation and revocation boundaries hold", async () => {
  const d = await openDatabase();
  try {
    await d.db.insert(user).values(["owner","viewer","c","d"].map(id => ({ id,name:id,email:`${id}@example.test` })));
    const s = createStudio(d), personal = await s.personalWorkspace("owner","Owner");
    await s.personalWorkspace("viewer","Viewer");
    const created = await Promise.all(Array.from({length:8},()=>s.createWorkspace("owner","함께 만드는 공간","space-create-key")));
    const space = created[0]; assert.ok(created.every(x=>x.id===space.id));
    assert.equal((await s.listWorkspaces("owner")).length,2);
    assert.equal((await s.listWorkspaces("viewer")).length,1);
    await assert.rejects(async()=>s.createWorkspace("owner","다른 이름","space-create-key"),{status:409});
    const rev = async () => (await s.snapshot("owner",space.id)).workspace.revision;
    const invite = await s.issueInvite("owner",space.id,"viewer",await rev());
    const stored = (await d.db.select().from(workspaceInvites))[0]; assert.notEqual(stored.tokenHash,invite.code); assert.ok(!JSON.stringify(stored).includes(invite.code));
    await s.joinWorkspace("viewer",invite.code);
    const v = await s.snapshot("viewer",space.id); assert.equal(v.role,"viewer"); assert.equal(v.members.length,2);
    const upgrade = await s.issueInvite("owner",space.id,"member",await rev());
    await s.joinWorkspace("viewer",upgrade.code); assert.equal((await s.snapshot("viewer",space.id)).role,"viewer");
    const consumption = await Promise.allSettled(["c","d"].map(id=>s.joinWorkspace(id,upgrade.code)));
    assert.equal(consumption.filter(x=>x.status==="fulfilled").length,1);
    const collaborator = consumption[0].status==="fulfilled" ? "c" : "d", outsider = collaborator==="c" ? "d" : "c";
    assert.equal((await s.joinWorkspace(collaborator,upgrade.code)).id,space.id); // lost response replay
    assert.equal((await s.snapshot(collaborator,space.id)).role,"member");
    await assert.rejects(async()=>s.snapshot(outsider,space.id),{status:404});
    await assert.rejects(async()=>s.startRun("viewer",space.id,input,"viewer-request-key"),{status:403});
    const simultaneous = await Promise.allSettled([s.startRun("owner",space.id,input,"owner-request-key"),s.startRun(collaborator,space.id,input,"member-race-key")]);
    assert.equal(simultaneous.filter(x=>x.status==="fulfilled").length,1);
    const success = simultaneous.find(x=>x.status==="fulfilled"); assert.ok(success?.status==="fulfilled");
    const run = success.value;
    await assert.rejects(async()=>s.approve("viewer",run.id,run.version,true),{status:403});
    await assert.rejects(async()=>s.approve(collaborator,run.id,run.version,true),{status:403});
    const approved = await Promise.allSettled([s.approve("owner",run.id,run.version,true),s.approve("owner",run.id,run.version,true)]);
    assert.equal(approved.filter(x=>x.status==="fulfilled").length,1);
    await s.claim(); await s.progress(run.id,"공동으로 보이는 중간 답변");
    const a = await s.snapshot("owner",space.id), b = await s.snapshot("viewer",space.id);
    assert.deepEqual(a.runs,b.runs); assert.equal(a.cursor,b.cursor); assert.ok(b.runs[0].requestedByName);
    await assert.rejects(async()=>s.cancel("viewer",run.id),{status:403});
    await s.cancel("owner",run.id); await s.finish(run.id,"cancelled");
    if (run.requestedBy==="owner") await assert.rejects(async()=>s.retry(collaborator,run.id,"foreign-retry-key"),{status:403});
    const ownerRun = await s.startRun("owner",space.id,input,"actor-bound-key"); await s.cancel("owner",ownerRun.id);
    await assert.rejects(async()=>s.startRun(collaborator,space.id,input,"actor-bound-key"),{status:409,code:"KEY_CONFLICT"});
    const memberRun = await s.startRun(collaborator,space.id,input,"member-own-key");
    await s.approve("owner",memberRun.id,memberRun.version,true); await s.claim();
    assert.equal((await s.cancel(collaborator,memberRun.id)).status,"cancel_requested"); await s.finish(memberRun.id,"cancelled");
    const continuing=await s.startRun(collaborator,space.id,{...input,approvalRequired:false},"continuing-job-key");await s.claim();
    const stale = await rev(); await s.updateMember("owner",space.id,collaborator,"viewer",stale);
    await assert.rejects(async()=>s.cancel(collaborator,continuing.id),{status:403});
    assert.equal(await s.progress(continuing.id,"공간 소유 작업은 멤버 권한과 분리"),true);
    await s.cancel("owner",continuing.id);await s.finish(continuing.id,"cancelled");
    await assert.rejects(async()=>s.updateMember("owner",space.id,"viewer","member",stale),{status:409});
    await assert.rejects(async()=>s.startRun(collaborator,space.id,input,"demoted-run-key"),{status:403});
    await assert.rejects(async()=>s.updateMember("viewer",space.id,"viewer","member",await rev()),{status:403});
    await assert.rejects(async()=>s.updateMember("owner",space.id,"owner",null,await rev()),{status:403});
    const cursor = (await s.snapshot("viewer",space.id)).cursor;
    await s.updateMember("owner",space.id,"viewer",null,await rev());
    await assert.rejects(async()=>s.events("viewer",space.id,cursor),{status:404});
    await assert.rejects(async()=>s.snapshot("viewer",space.id),{status:404});
    await assert.rejects(async()=>s.joinWorkspace("viewer",invite.code),{code:"INVITE_INVALID"});
    assert.ok(!(await s.listWorkspaces("viewer")).some(w=>w.id===space.id));
    assert.equal((await s.personalWorkspace("owner","Owner")).id,personal.id);
    const events = await s.events("owner",space.id,0);
    assert.ok(events.events.some(e=>e.runId===null && e.kind==="members_changed"));
    for (const code of [invite.code,upgrade.code]) assert.ok(!JSON.stringify(events).includes(code));
  } finally { await d.close(); }
});

test("invite expiry, replacement, revocation, owner guards and space/member limits are enforced", async () => {
  const d = await openDatabase();
  try {
    const ids = Array.from({length:22},(_,i)=>`user-${i}`);
    await d.db.insert(user).values(ids.map(id=>({id,name:id,email:`${id}@example.test`})));
    const s=createStudio(d), personal=await s.personalWorkspace(ids[0],"Owner");
    const space=await s.createWorkspace(ids[0],"제한 검증 공간","limits-space-key");
    const rev=async()=>(await s.snapshot(ids[0],space.id)).workspace.revision;
    await assert.rejects(async()=>s.issueInvite(ids[0],personal.id,"viewer",1),{status:403});
    await assert.rejects(async()=>s.issueInvite(ids[0],space.id,"owner",await rev()),{status:400});
    const expired=await s.issueInvite(ids[0],space.id,"viewer",await rev());
    await d.db.update(workspaceInvites).set({expiresAt:new Date(0)});
    await assert.rejects(async()=>s.joinWorkspace(ids[1],expired.code),{code:"INVITE_INVALID"});
    const old=await s.issueInvite(ids[0],space.id,"viewer",await rev());
    const current=await s.issueInvite(ids[0],space.id,"viewer",await rev());
    await assert.rejects(async()=>s.joinWorkspace(ids[1],old.code),{code:"INVITE_INVALID"});
    await s.revokeInvites(ids[0],space.id,await rev());
    await assert.rejects(async()=>s.joinWorkspace(ids[1],current.code),{code:"INVITE_INVALID"});
    await d.db.insert(members).values(ids.slice(1,20).map(userId=>({workspaceId:space.id,userId})));
    const full=await s.issueInvite(ids[0],space.id,"viewer",await rev());
    await assert.rejects(async()=>s.joinWorkspace(ids[20],full.code),{code:"MEMBER_LIMIT"});
    for(let i=1;i<5;i++) await s.createWorkspace(ids[0],`추가 공간 ${i}`,`additional-space-${i}`);
    await assert.rejects(async()=>s.createWorkspace(ids[0],"여섯 번째 공간","additional-space-6"),{code:"SPACE_LIMIT"});
    assert.equal((await s.createWorkspace(ids[0],"제한 검증 공간","limits-space-key")).id,space.id);
  } finally { await d.close(); }
});

test("v2 disk DB upgrades in place without changing existing personal workspace, result, session or idempotency", async () => {
  const root=await mkdtemp(join(tmpdir(),"simu-collab-upgrade-")), path=join(root,"db");
  try {
    const old=new PGlite(path); await old.waitReady;
    try {
      await old.exec("CREATE TABLE studio_migrations (name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())");
      for(const name of ["001_auth.sql","002_work.sql"]) {
        const sql=await readFile(new URL(`../db/migrations/${name}`,import.meta.url),"utf8"); await old.exec(sql);
        await old.query("INSERT INTO studio_migrations(name,checksum) VALUES($1,$2)",[name,createHash("sha256").update(sql).digest("hex")]);
      }
      await old.exec("INSERT INTO auth_user(id,name,email) VALUES('legacy','Legacy','legacy@example.test'); INSERT INTO auth_session(id,user_id,token,expires_at) VALUES('legacy-session','legacy','synthetic-session-token',now()+interval '1 day'); INSERT INTO workspaces(id,owner_id,name) VALUES('old-space','legacy','기존 개인 공간'); INSERT INTO members(workspace_id,user_id,role) VALUES('old-space','legacy','owner'); INSERT INTO tasks(id,workspace_id,author_id,prompt,agent_id,approval_required) VALUES('old-task','old-space','legacy','공동 업무 상태를 검토해 줘','jun',true)");
      const hash=createHash("sha256").update(JSON.stringify({...input,retryTask:null})).digest("hex");
      await old.query("INSERT INTO runs(id,workspace_id,task_id,requested_by,request_key,request_hash,status,scenario,output) VALUES('old-run','old-space','old-task','legacy','old-idempotency-key',$1,'succeeded','normal','보존할 기존 결과')",[hash]);
    } finally { await old.close(); }
    const d=await openDatabase(path);
    try {
      const s=createStudio(d), snapshot=await s.snapshot("legacy","old-space");
      assert.equal(snapshot.workspace.kind,"personal"); assert.equal(snapshot.role,"owner"); assert.equal(snapshot.runs[0].output,"보존할 기존 결과");
      assert.equal((await s.personalWorkspace("legacy","Legacy")).id,"old-space");
      assert.equal((await s.startRun("legacy","old-space",input,"old-idempotency-key")).id,"old-run");
      assert.equal((await d.client.query("SELECT id FROM auth_session")).rows.length,1);
      assert.equal((await d.client.query("SELECT name FROM studio_migrations")).rows.length,10);
      const shared=await s.createWorkspace("legacy","새 공동 공간","upgraded-space-key");assert.equal(shared.kind,"shared");
      await d.db.insert(user).values({id:"restored-member",name:"Restore",email:"restore@example.test"});
      const invite=await s.issueInvite("legacy",shared.id,"viewer",shared.revision);
      const restored=await openDatabase(join(root,"shared-restore"),await d.client.dumpDataDir("gzip"));
      try {
        const rs=createStudio(restored);await rs.joinWorkspace("restored-member",invite.code);
        const joined=await rs.snapshot("restored-member",shared.id);assert.equal(joined.role,"viewer");assert.equal(joined.members.length,2);
        assert.equal((await s.snapshot("legacy",shared.id)).members.length,1);
      } finally {await restored.close();}
    } finally { await d.close(); }
  } finally { await rm(root,{recursive:true,force:true}); }
});
