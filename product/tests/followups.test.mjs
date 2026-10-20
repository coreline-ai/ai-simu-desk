import test from "node:test";
import assert from "node:assert/strict";
import {followupDraft} from "../src/followups.mjs";
test("followup explicitly selects a completed source and handoff changes colleague with approval",()=>{
  const run={id:"source",version:8,prompt:"기획",output:"완료된 기획",status:"succeeded",agentId:"nara"};
  const draft=followupDraft(run,"handoff");
  assert.equal(draft.sourceRunId,run.id);assert.equal(draft.sourceVersion,8);assert.equal(draft.agentId,"jun");assert.equal(draft.approvalRequired,true);
  assert.equal(followupDraft({...run,agentId:"jun"},"handoff").agentId,"nara");
  assert.equal(followupDraft(run,"lines").agentId,"nara");
  assert.match(followupDraft(run,"table").prompt,/표/);
  assert.equal(followupDraft({...run,status:"running"},"handoff"),null);
  assert.equal(followupDraft(null,"lines"),null);
});
