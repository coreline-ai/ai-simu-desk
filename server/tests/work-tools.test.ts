import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../db/database.js';
import {user} from '../db/schema.js';
import {createStudio} from '../db/studio-store.js';
test('project settings persist, protect owner/version and isolate workspaces',async()=>{
 const d=await openDatabase();try{
 await d.db.insert(user).values([{id:'owner',name:'Owner',email:'owner@tools.test'},{id:'peer',name:'Peer',email:'peer@tools.test'}]);
 const s=createStudio(d),a=await s.personalWorkspace('owner','Owner'),b=await s.personalWorkspace('peer','Peer');
 assert.equal((await s.project('owner',a.id)).version,0);
 const input={version:0,goal:'팀 기획',audience:'학생',technology:'PostgreSQL',exclusions:'유료 도구'};
 assert.equal((await s.saveProject('owner',a.id,input)).version,1);
 assert.equal((await s.project('owner',a.id)).technology,'PostgreSQL');
 assert.equal((await s.project('peer',b.id)).goal,'');
 await assert.rejects(()=>s.project('peer',a.id),{status:404});
 await assert.rejects(()=>s.saveProject('owner',a.id,input),{status:409});
 await assert.rejects(()=>s.saveProject('owner',a.id,{...input,version:1,goal:'x'.repeat(301)}),{status:400});
 const shared=await s.createWorkspace('owner','Project room','create-tools-room'),invite=await s.issueInvite('owner',shared.id,'viewer',shared.revision);
 await s.joinWorkspace('peer',invite.code);
 await assert.rejects(()=>s.saveProject('peer',shared.id,input),{status:403});
 assert.ok((await s.events('owner',a.id,0)).events.some(e=>e.kind==='project_updated'));
 }finally{await d.close();}
});

test('literal search paginates tied timestamps, hides generated text and compares frozen source',async()=>{
 const d=await openDatabase();try{
 const {tasks,runs}=await import('../db/schema.js');
 await d.db.insert(user).values([{id:'owner',name:'Owner',email:'owner@search.test'},{id:'peer',name:'Peer',email:'peer@search.test'}]);
 const s=createStudio(d),w=await s.personalWorkspace('owner','Owner');
 const {randomUUID}=await import('node:crypto');const at=new Date('2026-10-20T00:00:00.123Z');
 for(let i=0;i<25;i++){const taskId=randomUUID();await d.db.insert(tasks).values({id:taskId,workspaceId:w.id,authorId:'owner',prompt:`기획 100% _ 항목 ${i}`,agentId:'nara',approvalRequired:false});await d.db.insert(runs).values({id:randomUUID(),taskId,workspaceId:w.id,requestedBy:'owner',requestKey:randomUUID(),requestHash:'test',status:'succeeded',output:'저장된 답변',scenario:'normal',createdAt:at});}
 const first=await s.findRuns('owner',w.id,{q:'100%',agent:'nara',status:'succeeded'});assert.equal(first.items.length,20);assert.ok(first.next);
 const second=await s.findRuns('owner',w.id,{q:'100%',before:first.next!});assert.equal(second.items.length,5);assert.equal(new Set([...first.items,...second.items].map(r=>r.id)).size,25);assert.equal(second.next,null);
 assert.equal((await s.findRuns('owner',w.id,{q:'%fake%'})).items.length,0);
 await assert.rejects(()=>s.findRuns('peer',w.id,{}),{status:404});
 await assert.rejects(()=>s.findRuns('owner',w.id,{before:'invalid'}),{status:400});
 await assert.rejects(()=>s.findRuns('owner',w.id,{status:'invalid'}),{status:400});
 const parent=first.items[0];
 const revised=await s.startRun('owner',w.id,{prompt:'3줄로 줄여줘',agentId:'nara',approvalRequired:true,scenario:'normal',sourceRunId:parent.id,mode:'revise'},randomUUID());
 const rows=await s.findRuns('owner',w.id,{status:'awaiting_approval'});assert.equal(rows.items[0].output,'');assert.equal('generatedAnswer' in rows.items[0],false);
 const {eq}=await import('drizzle-orm');await d.db.update(runs).set({output:'이후 변경된 원본'}).where(eq(runs.id,parent.id));
 const comparison=await s.compareRun('owner',w.id,revised.id);assert.equal(comparison.before.output,'저장된 답변');assert.equal(comparison.after.output,'');
 await assert.rejects(()=>s.readRun('peer',w.id,parent.id),{status:404});
 }finally{await d.close();}
});

test('comments are idempotent, role scoped; inbox isolates readers and records approval/completion',async()=>{
 const d=await openDatabase();try{
 await d.db.insert(user).values([{id:'owner',name:'Owner',email:'owner@discuss.test'},{id:'peer',name:'Peer',email:'peer@discuss.test'},{id:'viewer',name:'Viewer',email:'viewer@discuss.test'}]);
 const s=createStudio(d),w=await s.createWorkspace('owner','Discussion','create-discussion');
 let view=await s.snapshot('owner',w.id);let invite=await s.issueInvite('owner',w.id,'member',view.workspace.revision);await s.joinWorkspace('peer',invite.code);
 view=await s.snapshot('owner',w.id);invite=await s.issueInvite('owner',w.id,'viewer',view.workspace.revision);await s.joinWorkspace('viewer',invite.code);
 const run=await s.startRun('peer',w.id,{prompt:'로그인 기획',agentId:'nara',approvalRequired:true,scenario:'normal'},'create-discussion-run');
 assert.equal((await s.inbox('owner',w.id)).unread,1);assert.equal((await s.inbox('peer',w.id)).unread,0);
 await s.addComment('peer',w.id,run.id,{body:'<img src=x onerror=alert(1)>'},'comment-one-key');
 await s.addComment('peer',w.id,run.id,{body:'<img src=x onerror=alert(1)>'},'comment-one-key');
 assert.equal((await s.comments('viewer',w.id,run.id)).items.length,1);
 assert.equal((await s.inbox('owner',w.id)).unread,2);assert.equal((await s.inbox('viewer',w.id)).unread,1);
 await s.readNotifications('viewer',w.id);assert.equal((await s.inbox('viewer',w.id)).unread,0);assert.equal((await s.inbox('owner',w.id)).unread,2);
 await assert.rejects(()=>s.addComment('peer',w.id,run.id,{body:'different'},'comment-one-key'),{status:409});
 await assert.rejects(()=>s.addComment('viewer',w.id,run.id,{body:'no'},'comment-two-key'),{status:403});
 await assert.rejects(()=>s.addComment('peer',w.id,run.id,{body:'x'.repeat(1001)},'comment-two-key'),{status:400});
 await s.approve('owner',run.id,run.version,true);await s.claim();await s.progress(run.id,'completed');await s.finish(run.id,'succeeded');await s.finish(run.id,'succeeded');
 assert.equal((await s.inbox('peer',w.id)).items.filter(n=>n.kind==='completed').length,1);
 view=await s.snapshot('owner',w.id);await s.updateMember('owner',w.id,'viewer',null,view.workspace.revision);
 await assert.rejects(()=>s.inbox('viewer',w.id),{status:404});
 await assert.rejects(()=>s.comments('viewer',w.id,run.id),{status:404});
 }finally{await d.close();}
});
