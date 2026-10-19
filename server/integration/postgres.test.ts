import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {openPostgres} from "../db/postgres.js";
import {createStudio} from "../db/studio-store.js";
import {user} from "../db/schema.js";
const url=process.env.TEST_DATABASE_URL;
if(!url||!new URL(url).pathname.startsWith('/studio_qa'))throw new Error("Use a disposable PostgreSQL database named studio_qa* in TEST_DATABASE_URL");
const ssl={rejectUnauthorized:true as const,...(process.env.TEST_DATABASE_CA_FILE?{ca:await readFile(process.env.TEST_DATABASE_CA_FILE,'utf8')}:{})};
test("real TLS PostgreSQL: concurrent migrations, separate app connections, shared permissions and idempotency",async()=>{
  if(process.env.TEST_DATABASE_CA_FILE)await assert.rejects(()=>openPostgres(url,{ssl:{rejectUnauthorized:true}})); // Private test CA is not a public root.
  const [a,b]=await Promise.all([openPostgres(url,{ssl,migrate:true}),openPostgres(url,{ssl,migrate:true})]);
  try{
    const owner=randomUUID(),viewer=randomUUID(),outsider=randomUUID();
    await a.db.insert(user).values([owner,viewer,outsider].map(id=>({id,name:id,email:`${id}@remote.test`})));
    const sa=createStudio(a),sb=createStudio(b);
    const attempts=await Promise.all(Array.from({length:6},(_,i)=>(i%2?sa:sb).createWorkspace(owner,"원격 경합 검증","remote-create-key")));
    const space=attempts[0];assert.ok(attempts.every(w=>w.id===space.id));
    const invite=await sa.issueInvite(owner,space.id,"viewer",space.revision);
    const joined=await Promise.allSettled([sa.joinWorkspace(viewer,invite.code),sb.joinWorkspace(outsider,invite.code)]);
    assert.equal(joined.filter(x=>x.status==='fulfilled').length,1);
    const peer=joined[0].status==='fulfilled'?viewer:outsider;
    assert.equal((await sb.snapshot(peer,space.id)).role,'viewer');
    const version=(await sa.snapshot(owner,space.id)).workspace.revision;await sa.updateMember(owner,space.id,peer,'member',version);
    const input={prompt:'원격 공동 업무를 검증해 줘',agentId:'jun',approvalRequired:false,scenario:'normal'};
    const runs=await Promise.allSettled([sa.startRun(owner,space.id,input,'remote-run-key-a'),sb.startRun(peer,space.id,input,'remote-run-key-b')]);
    assert.equal(runs.filter(x=>x.status==='fulfilled').length,1);
    assert.deepEqual((await sa.snapshot(owner,space.id)).runs,(await sb.snapshot(peer,space.id)).runs);
    assert.equal((await a.pool.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0].ssl,true);
    const migrations=await b.pool.query('SELECT name FROM studio_migrations');assert.ok(migrations.rows.length>=3);
  }finally{await a.close();await b.close();}
});
