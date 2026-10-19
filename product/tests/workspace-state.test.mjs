import test from "node:test";
import assert from "node:assert/strict";
import { workspacePresentation, acceptsWorkspaceSnapshot } from "../src/workspace-state.mjs";
const snapshot={workspace:{id:"shared",kind:"shared"},role:"viewer",runs:[{id:"live",agentId:"jun",status:"running",requestedBy:"bob"},{id:"old",agentId:"nara",status:"succeeded",requestedBy:"alice"}]};
test("shared viewer follows another user's live run without command capabilities",()=>{
  const p=workspacePresentation(snapshot,"alice","old");
  assert.equal(p.run.id,"live"); assert.equal(p.active.agentId,"jun");
  assert.equal(p.canStart,false);assert.equal(p.canApprove,false);assert.equal(p.canControl,false);
  assert.equal(workspacePresentation(snapshot,"alice","old",false).run.id,"old");
});
test("member controls own attempts only, owner manages approvals, and a downgrade removes controls",()=>{
  const member={...snapshot,role:"member"};
  assert.equal(workspacePresentation(member,"bob").canControl,true);
  assert.equal(workspacePresentation(member,"alice").canControl,false);
  assert.equal(workspacePresentation(member,"bob").canApprove,false);
  assert.equal(workspacePresentation({...snapshot,role:"owner"},"alice").canApprove,true);
  assert.equal(workspacePresentation(snapshot,"bob").canControl,false);
  const empty=workspacePresentation({...snapshot,runs:[]},"alice"); assert.equal(empty.run,null);assert.equal(empty.active,null);
});
test("late A and B responses cannot overwrite a new A visit, even with a larger old cursor",()=>{
  const current={epoch:3,workspaceId:"A",cursor:0},applied=[];
  const arrivals=[
    {request:{epoch:1,workspaceId:"A"},cursor:900,text:"old A private result"},
    {request:{epoch:2,workspaceId:"B"},cursor:950,text:"other workspace result"},
    {request:{epoch:3,workspaceId:"A"},cursor:12,text:"current A result"},
    {request:{epoch:3,workspaceId:"A"},cursor:11,text:"out of order A result"},
  ];
  for(const response of arrivals)if(acceptsWorkspaceSnapshot(response.request,current,response.cursor)){current.cursor=response.cursor;applied.push(response.text);}
  assert.deepEqual(applied,["current A result"]);assert.equal(current.cursor,12);
});
