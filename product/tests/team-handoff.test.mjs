import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandoffTracker,publicHandoff} from '../src/team-handoff.mjs';
import {teamProgress,teamSceneState,motionPolicy} from '../src/scene-state.mjs';
const stages=['nara','sora','jun','min','leo'].map((agentId,i)=>({agentId,title:agentId,start:i*100,end:(i+1)*100}));
const run=(length,status='running',version=length)=>({id:'a',agentId:'nara',team:true,status,version,phase:'compose',output:'x'.repeat(length),answerMeta:{team:{stages}}});
test('only observed public boundaries emit once; skipped stages collapse to newest and stale responses cannot rewind',()=>{
 const t=createHandoffTracker();assert.equal(t.observe('w',run(0)),null);
 for(let i=1;i<=4;i++){
  assert.equal(t.observe('w',run(i*100-1)),null);
  const event=t.observe('w',run(i*100));assert.equal(event.from,stages[i-1].agentId);assert.equal(event.to,stages[i].agentId);
  assert.equal(t.observe('w',run(i*100)),null);assert.equal(t.observe('w',run(i*100+1)),null);
 }
 t.reset();t.observe('w',run(5));assert.equal(t.observe('w',run(350)).to,'min');assert.equal(t.observe('w',run(99)),null);assert.equal(t.observe('w',run(351)),null);
});
test('initial history, resume, pause, cancellation, retry and workspace switching do not replay old handoffs',()=>{
 const t=createHandoffTracker();assert.equal(t.observe('w',run(500,'succeeded')),null);
 t.observe('w',run(0));assert.equal(t.observe('w',run(120),{animate:false}),null);assert.equal(t.observe('w',run(121)),null);
 assert.equal(t.observe('w',run(240),{continuous:false}),null);assert.equal(t.observe('w',run(241)),null);
 assert.equal(t.observe('other',run(350)),null);assert.equal(t.observe('other',run(400,'cancelled')),null);
 assert.equal(t.observe('other',{...run(350),id:'retry'}),null);assert.equal(t.observe('other',null),null);
});
test('preparation, writing, reviewing and missing team metadata have truthful distinct poses and labels',()=>{
 const r=run(250),p=teamProgress(r);assert.equal(p.nara.pose,'reviewing');assert.equal(p.jun.pose,'typing');assert.equal(p.leo.pose,'preparing');
 assert.match(teamProgress({...r,phase:'review'}).jun.label,/검토/);
 assert.ok(Object.values(teamProgress({...r,status:'awaiting_approval'})).every(x=>x.pose==='waiting'));
 assert.equal(teamSceneState([{...r,answerMeta:null}]).actors[0].pose,'typing');assert.ok(teamSceneState([{...r,answerMeta:null}]).actors.slice(1).every(a=>a.pose==='idle'));
});
test('summary uses only fully public previous section and never metadata or future text',()=>{
 const r=run(101);r.output='1. 나라\n• 공개된 요약\n'.padEnd(100,' ')+'미';r.answerMeta.team.secret='미공개 내용';
 assert.equal(publicHandoff(r).summary,'공개된 요약');assert.equal(publicHandoff({...r,status:'awaiting_approval'}),null);
 assert.equal(publicHandoff(run(99)),null);assert.equal(publicHandoff({...r,answerMeta:null}),null);
});

test('reduced motion overrides play; hidden tabs suppress reactions and stay compatible with manual pause',()=>{
 for(const paused of [false,true])for(const reduced of [false,true])for(const hidden of [false,true]){
  const policy=motionPolicy(paused,reduced,hidden);assert.equal(policy.paused,paused||reduced);assert.equal(policy.animate,!paused&&!reduced&&!hidden);
 }
 const tracker=createHandoffTracker();tracker.observe('w',run(0));
 assert.equal(tracker.observe('w',run(110),{animate:motionPolicy(false,true,false).animate}),null);assert.equal(tracker.observe('w',run(111)),null);
});
