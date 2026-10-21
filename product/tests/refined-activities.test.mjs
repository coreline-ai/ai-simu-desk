import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createRoomV6} from '../../pilot-3d/room-quality/model.mjs';
import {createTeamRuntime} from '../../pilot-3d/activities/team-runtime.mjs';
import {releaseStudioAsset} from '../../pilot-3d/sample/asset-loader.mjs';
import {describeVisit,visitCaption} from '../../pilot-3d/activities/visit-presentation.mjs';
import {activityCaption} from '../../pilot-3d/activities/presentation.mjs';
import {part} from '../../pilot-3d/sample/character-rig.mjs';
import {ActivitySoak,activityCleanup} from '../../pilot-3d/activities/team-soak.mjs';

function fixture(refined=true){const {root}=createRoomV6(),runtime=createTeamRuntime(root,root.userData,{auto:false,natural:true,enriched:true,expressive:true,interaction:true,refined}),scheduler=runtime.scheduler,vm={actors:scheduler.ids.map(agentId=>({agentId,pose:'idle'}))};runtime.setViewModel(vm);runtime.update(0);return {root,runtime,scheduler,vm,close(){runtime.dispose();releaseStudioAsset(root);}};}
function until(f,condition,limit=10000){for(let i=0;i<limit&&!condition();i++)f.runtime.update(.05);assert(condition(),'required stage reached');}

test('visit captions distinguish a seated host from travelling and returning visitors in every phase',()=>{
  for(const phase of ['inviting','arriving','discussion','transfer'])for(const tripStage of ['queued','stand','out','align','rest','home','deskTurn','deskSit'])for(const ending of [false,true]){
    const host=describeVisit({role:'host',phase,tripStage,ending});assert.equal(host.moving,false);assert.equal(host.returning,false);assert.equal(host.stage,'hosting');assert(!/移|이동|복귀/.test(host.label));
    const visitor=describeVisit({role:'visitor',phase,tripStage,ending});assert.equal(visitor.returning,ending);assert.equal(visitor.stage,tripStage);
  }
  for(const paperStage of ['pickup','grasp','present','receive','accept','read','giveback','regrasp','return','release','carry','dock','cancelPlace']){
    const host=describeVisit({role:'host',phase:'transfer',tripStage:'home',ending:true,paperStage,paperControlled:true});assert(!/복귀/.test(host.label));
  }
  const team={actors:{jun:{visitPresentation:describeVisit({role:'host',phase:'arriving',tripStage:'out'})}}};assert.equal(visitCaption(team,'jun'),'내 자리에서 동료 기다리기');assert.equal(visitCaption(team,'nara'),null);
});

test('twenty refined paper visits keep host coordinates and captions consistent through handover and cleanup',()=>{
  const f=fixture();try{for(const {visitor,host} of f.scheduler.visits.availability){
    const actor=f.root.getObjectByName(f.root.userData.bindings[host].actor),origin=actor.getWorldPosition(new T.Vector3());assert(f.scheduler.startVisit(visitor,host,{transfer:true}));let shown=0,transfer=0;
    for(let i=0;i<6000&&f.scheduler.visit;i++){f.runtime.update(.05);if(i%10)continue;const d=f.runtime.diagnostics(),h=d.teamActivities.actors[host];assert(actor.getWorldPosition(new T.Vector3()).distanceTo(origin)<.0001);if(h.visitPresentation){shown++;assert.equal(h.visitPresentation.role,'host');assert(!h.returning&&!h.visitPresentation.moving);assert(!/복귀|로 이동/.test(h.visitPresentation.label));assert(activityCaption(d,{[host]:'상대'}).includes(h.visitPresentation.label));}if(f.scheduler.transfer.active)transfer++;for(const id of [visitor,host])for(const hand of Object.values(d.teamActivities.hands[id]))for(const contact of hand.contacts??[]){assert(contact.reachable);assert(contact.error<.003,id+' '+contact.finger+' paper contact');}}
    assert(shown>10&&transfer>5);assert(!f.scheduler.visit&&!f.scheduler.transfer.active);assert.deepEqual(f.scheduler.book.snapshot(),{});
  }assert.deepEqual(f.scheduler.violations,[]);}finally{f.close();}
});

test('all five refined fingers reach real pen shaft, cup and page supports without changing wrist, tip or finger lengths',()=>{
  const f=fixture();try{for(const id of f.scheduler.ids){for(const mode of ['role-0','role-1','role-2','cup']){
    const cup=mode==='cup',hand=f.scheduler.handGrips.rows.get(id)[cup?'L':'R'],lengths=hand.fingers.map(f=>[...f.lengths]);let samples=0;
    assert(cup?f.scheduler.startCup(id):f.scheduler.startRole(id,{variant:Number(mode.at(-1))}));
    for(let n=0;n<480;n++){f.runtime.update(.025);const d=hand.diagnostics();if(d.contacts.length){samples++;assert.equal(d.contacts.length,5);for(const c of d.contacts){assert(c.reachable,id+' '+mode+' '+c.finger);assert(c.error<.003,id+' '+mode+' '+c.finger+' '+c.error);if(!cup&&id!=='leo'){const p=f.scheduler.desks[id].prop,point=p.worldToLocal(hand.hand.localToWorld(new T.Vector3(...c.target))),box=p.geometry.boundingBox;assert(point.y>=box.min.y+.0119&&point.y<=box.max.y-.0119);assert(Math.abs(Math.hypot(point.x,point.z)-Math.max(Math.abs(box.min.x),Math.abs(box.max.x))-.001)<.0001,'target remains on shaft surface');}}}assert(f.scheduler.desks[id].handError<.001);assert(f.scheduler.desks[id].tipError<.001);assert(f.scheduler.cups[id].reachError<.001);}
    assert(id==='jun'&&!cup?samples===0:samples>100);assert.deepEqual(hand.fingers.map(f=>f.lengths),lengths);assert.equal(hand.blend,0);
  }}assert.deepEqual(f.scheduler.violations,[]);}finally{f.close();}
});

test('refined diagnostics report unreachable supports honestly and preserve original v6 pen targets',()=>{
  for(const refined of [false,true]){const f=fixture(refined);try{assert(f.scheduler.startRole('nara'));const h=f.scheduler.handGrips.rows.get('nara').R,p=f.scheduler.desks.nara.prop;let ring=0;for(let i=0;i<480;i++){f.runtime.update(.025);if(h.blend>.995)ring=Math.max(ring,h.fingers[3].pad.position.distanceTo(h.contacts(p,'pen')[3]));}if(!refined){assert(ring>.005);assert(!h.diagnostics().contacts);}else{assert(ring<.003);const far=new T.Mesh(p.geometry,p.material);far.position.set(10,10,10);f.root.add(far);h.apply(.25,1,far,'pen');const d=h.diagnostics();assert(d.padError>1);assert(d.contacts.some(c=>!c.reachable));far.removeFromParent();}}finally{f.close();}}
});

test('refined captions release hosts immediately for new work and preserve the old v6 comparison profile',()=>{
  for(const refined of [false,true]){const f=fixture(refined);try{assert(f.scheduler.startVisit());until(f,()=>f.scheduler.visit?.trip.stage==='out');const d=f.runtime.diagnostics();assert.equal(d.teamActivities.version,refined?7:6);if(refined)assert.equal(d.teamActivities.actors.jun.stage,'hosting');else{assert.equal(d.teamActivities.actors.jun.stage,'out');assert(!d.teamActivities.actors.jun.visitPresentation);}f.runtime.setViewModel({...f.vm,actors:f.vm.actors.map(a=>a.agentId==='jun'?{...a,pose:'typing'}:a)});f.runtime.update(.05);assert.equal(f.scheduler.rawIncoming('jun').pose,'typing');assert.notEqual(f.scheduler.state('jun').activity,'visit');assert(!f.runtime.diagnostics().teamActivities.actors.jun.visitPresentation);until(f,()=>!f.scheduler.visit);assert.deepEqual(f.scheduler.book.snapshot(),{});}finally{f.close();}}
});

test('twenty refined sofa seat orders support outer palms and vary one inner hand with continuous transitions',()=>{
  const f=fixture();try{const ids=f.scheduler.ids;for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++)for(const pair of [[ids[a],ids[b]],[ids[b],ids[a]]]){
    assert(f.scheduler.startSofaPair(pair));let samples=0;const previous=new Map();
    for(let i=0;i<10000&&f.scheduler.sofaPair;i++){f.runtime.update(.025);const rows=f.scheduler.sofaSupport.diagnostics();for(const id of pair){const row=rows[id];for(const side of ['L','R'])for(const joint of ['NaraHand','NaraElbow']){const point=part(f.scheduler.desks[id].actor,joint+side).getWorldPosition(new T.Vector3()),key=id+side+joint,before=previous.get(key);if(before&&(row||before.supported))assert(point.distanceTo(before.point)<.035,id+' '+joint+side+' support jump '+point.distanceTo(before.point));previous.set(key,{point,supported:!!row});}if(!row)continue;for(const [side,hand]of Object.entries(row.hands)){assert(hand.error<.001);if(hand.planted){samples++;assert(Math.abs(hand.palmGap-.0015)<.0002);assert.equal(hand.lift,0);}if(side!==row.gestureHand)assert.equal(hand.lift,0);}
      const p=f.scheduler.state(id).pose;if(p?.seatBlend===1)assert(p.feet.every(foot=>foot.planted));assert.equal(f.scheduler.cups[id].owner,'desk');}
    }assert(samples>100);assert(!f.scheduler.records.size&&!f.scheduler.sofaPair);assert.deepEqual(f.scheduler.sofaSupport.diagnostics(),{});assert.deepEqual(f.scheduler.book.snapshot(),{});
  }assert.deepEqual(f.scheduler.violations,[]);}finally{f.close();}
});

test('refined sofa support pauses without drift and yields both arms for all five work returns',()=>{
  for(const id of ['nara','sora','jun','min','leo']){const f=fixture();try{const peer=f.scheduler.ids.find(p=>p!==id);assert(f.scheduler.startSofaPair([id,peer]));until(f,()=>f.scheduler.sofaSupport.rows.get(id)?.time>1);f.runtime.setViewModel({...f.vm,motionPaused:true});const before=JSON.stringify(f.scheduler.sofaSupport.diagnostics());for(let i=0;i<40;i++)f.runtime.update(.025);assert.equal(JSON.stringify(f.scheduler.sofaSupport.diagnostics()),before);f.runtime.setViewModel({...f.vm,actors:f.vm.actors.map(a=>a.agentId===id?{...a,pose:'typing'}:a)});f.scheduler.workReady.set(id,Infinity);until(f,()=>!f.scheduler.sofaPair);assert.equal(f.scheduler.state(id).action,'typing');assert.deepEqual(f.scheduler.sofaSupport.diagnostics(),{});assert.deepEqual(f.scheduler.book.snapshot(),{});assert.deepEqual(f.scheduler.violations,[]);}finally{f.close();}}
  const old=fixture(false);try{assert(!old.scheduler.sofaSupport);assert(old.scheduler.startSofaPair());until(old,()=>old.scheduler.sofaPair?.phase==='discussion');assert(!old.runtime.diagnostics().teamActivities.sofaSupport);}finally{old.close();}
});

test('v7 soak gates require the requested version, five-finger diagnostics and complete sofa support release',()=>{
  const f=fixture();try{const data={...f.runtime.diagnostics(),animationTime:0,textures:0,geometries:0,resetTimes:0,paused:false};const observe=(d,refined=true)=>{const recorder=new ActivitySoak('continuous',0,{roles:true,expressive:true,interaction:true,refined});recorder.observe(d,0,1);return recorder.errors;};assert.deepEqual(observe(data),[]);assert(observe(data,false).includes('requested activity runtime missing'));const missing=structuredClone(data);delete missing.teamActivities.hands.nara.R.contacts;assert(observe(missing).includes('missing refined contacts'));const distant=structuredClone(data);distant.teamActivities.hands.nara.R.contacts=[{error:.01,reachable:false}];assert(observe(distant).includes('refined support contact'));assert(activityCleanup(data).passed);data.teamActivities.sofaSupport={nara:{}};assert(!activityCleanup(data).passed);}finally{f.close();}
});
