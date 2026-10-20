import test from "node:test";
import assert from "node:assert/strict";
import { teamSceneState } from "../src/scene-state.mjs";

test("server run owner controls each actor independently of selected colleague and old history", () => {
  const runs = [{ agentId: "nara", status: "succeeded" }, { agentId: "jun", status: "running" }];
  const before = JSON.stringify(runs);
  for (const selected of ["nara", "jun"]) {
    const vm = teamSceneState(runs, selected);
    assert.equal(vm.selectedAgent, selected);
    assert.deepEqual(vm.actors.map(a => a.pose), ["idle","idle","typing","idle","idle"]);
    assert.equal(vm.actors[2].label, "답변 작성 중");
  }
  assert.equal(JSON.stringify(runs), before);
  assert.deepEqual(teamSceneState([{ agentId: "nara", status: "running" }], "jun").actors.map(a => a.pose), ["typing","idle","idle","idle","idle"]);
});

test("approval, queued, cancel request and terminal states do not type; reduced motion changes no run", () => {
  for (const status of ["awaiting_approval", "queued", "cancel_requested", "succeeded", "failed", "cancelled"]) {
    assert.deepEqual(teamSceneState([{ agentId: "jun", status }]).actors.map(a => a.pose), ["idle","idle", status==="queued"?"thinking":status==="awaiting_approval"?"waiting":"idle","idle","idle"]);
  }
  const run = { agentId: "jun", status: "running" };
  const paused = teamSceneState([run], "unknown", true);
  assert.equal(paused.motionPaused, true); assert.equal(paused.selectedAgent, "nara");
  assert.equal(paused.actors[2].pose, "typing"); assert.equal(run.status, "running");
  assert.deepEqual(teamSceneState().actors.map(a => a.pose), ["idle","idle","idle","idle","idle"]);
});


test("analysis and review phases think, composition types, and a terminal cue belongs to its actor",()=>{
  for(const phase of ["analyze","review"])assert.equal(teamSceneState([{agentId:"nara",status:"running",phase}]).actors[0].pose,"thinking");
  assert.equal(teamSceneState([{agentId:"nara",status:"running",phase:"compose"}]).actors[0].pose,"typing");
  const vm=teamSceneState([],"jun",false,{nara:{pose:"success",cue:"run:success"}});
  assert.equal(vm.actors[0].pose,"success");assert.equal(vm.actors[0].cue,"run:success");
});

test('team composition shows five independent tasks; handoff completion moves the current writer and fans out completion cues',async()=>{
 const {createCueTracker}=await import('../../pilot-3d/src/animation.mjs');
 const stages=['nara','sora','jun','min','leo'].map((agentId,i)=>({agentId,title:agentId,start:i*100,end:(i+1)*100}));
 const run={id:'team-run',team:true,agentId:'nara',status:'running',phase:'compose',output:'x'.repeat(250),answerMeta:{team:{members:stages.map(s=>s.agentId),stages,total:500}}};
 const vm=teamSceneState([run],'leo');assert.equal(vm.actors.length,5);assert.equal(vm.actors[2].label,'jun 작성');assert.equal(vm.actors[0].pose,'thinking');assert.equal(vm.actors[4].pose,'typing');
 const tracker=createCueTracker();tracker.observe([run]);const finished={...run,status:'succeeded',output:'x'.repeat(500)},cues=tracker.observe([finished]);assert.equal(Object.keys(cues).length,5);
 assert.ok(teamSceneState([finished],'sora',false,cues).actors.every(a=>a.pose==='success'));
 assert.ok(teamSceneState([{...run,status:'awaiting_approval'}]).actors.every(a=>a.pose==='waiting'));
});
