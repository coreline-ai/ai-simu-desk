import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {definitions,pose,fk,FRAME,POSES} from '../../pilot-3d/hand-v14/kinematics.mjs';
import {fixture,step,until} from './living-fixture.mjs';
import {tripod} from '../../pilot-3d/hand-v14/tripod.mjs';
import {segmentDistance} from '../../pilot-3d/activities/body-contact.mjs';
import {SceneFrames} from '../../pilot-3d/living-office/frames.mjs';
const options={personalMotion:true,personalities:true,anatomicalActors:['sora']};
test('v14 has mirrored full digits, different phalanx lengths and a palm-down keyboard frame',()=>{
 const R=definitions('R'),L=definitions('L');assert(new Set(R.slice(1).map(d=>d.lengths.reduce((a,b)=>a+b,0))).size===4);
 for(const mode of POSES)for(let i=0;i<5;i++){
  const a=fk(R[i],pose(mode)[i]),b=fk(L[i],pose(mode)[i]);for(let j=0;j<4;j++){assert(Math.abs(a.points[j].x+b.points[j].x)<1e-10);assert(Math.abs(a.points[j].y-b.points[j].y)<1e-10);assert(Math.abs(a.points[j].z-b.points[j].z)<1e-10);if(j)assert(Math.abs(a.points[j].distanceTo(a.points[j-1])-R[i].lengths[j-1])<1e-10);}
 }
 assert(Math.abs(R[0].base[0]-R[1].base[0])<Math.abs(R[0].base[0]-R[4].base[0]));
 const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2);assert(new T.Vector3(...FRAME.palm).applyQuaternion(q).y<-.999);assert(new T.Vector3(...FRAME.dorsal).applyQuaternion(q).y>.999);
});
test('six authored poses keep distal fingers separated; tripod includes the thumb metacarpal',()=>{const d=definitions('R'),t=tripod(.0052);assert(d[0].lengths[0]>.03);for(const mode of POSES){const p=d.map((f,i)=>fk(f,mode==='tripod-write'&&i<3?t.solved[i].angles:pose(mode)[i],mode==='tripod-write'&&i<3?t.solved[i].spread:f.spread,mode==='tripod-write'&&i<3?t.solved[i].opposition:f.opposition).points);for(let i=0;i<5;i++)for(let k=i+1;k<5;k++)for(let j=1;j<3;j++)for(let l=1;l<3;l++){const r=d[i].radius*(.85-j*.1)+d[k].radius*(.85-l*.1);assert(r-segmentDistance(p[i][j],p[i][j+1],p[k][l],p[k][l+1])<.0025,mode+' '+d[i].name+'/'+d[k].name);}}});
test('v14 Sora skin has real joint hierarchy, connected finite skin weights and initialized paused first frame',()=>{
 const f=fixture(options);try{f.runtime.setViewModel({...f.vm,motionPaused:true});step(f,1);assert.equal(f.s.time,0);
 for(const side of ['L','R']){const h=f.s.handGrips.rows.get('sora')[side],skin=h.skin;assert.equal(h.diagnostics().surfaceVersion,4);for(let i=0;i<5;i++){assert.equal(skin.bones[2+i*3].parent,skin.bones[1+i*3]);assert.equal(skin.bones[3+i*3].parent,skin.bones[2+i*3]);}
 for(const level of ['room','close']){skin.setDetail(level);const g=skin.mesh.geometry;assert([...g.attributes.position.array,...g.attributes.normal.array].every(Number.isFinite));for(let i=0;i<g.attributes.skinWeight.count;i++){const w=g.attributes.skinWeight;assert(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-6);}assert(g.index.count/3<12000);
 const parents=Array.from({length:g.attributes.position.count},(_,i)=>i),find=i=>parents[i]===i?i:parents[i]=find(parents[i]);for(let i=0;i<g.index.count;i+=3){const a=find(g.index.getX(i));parents[find(g.index.getX(i+1))]=a;parents[find(g.index.getX(i+2))]=a;}assert.equal(new Set(parents.map((_,i)=>find(i))).size,1);
 skin.mesh.computeBoundingBox();assert(skin.mesh.boundingBox.getSize(new T.Vector3()).length()<.3);}
 }for(const id of ['nara','jun','min','leo'])assert.equal(f.s.handGrips.rows.get(id).R.diagnostics().surfaceVersion,3);
 }finally{f.close();}
});
test('three Sora writing variants use only three support pads and return the actual pen safely',()=>{
 const f=fixture(options);try{for(let variant=0;variant<3;variant++){assert(f.s.startRole('sora',{variant}));let samples=0;until(f,()=>!f.s.desks.sora.busy,20,()=>{const d=f.s.desks.sora,h=f.s.handGrips.rows.get('sora').R;if(d.stage==='use'&&d.time>1.1){samples++;assert(!h.fallback);assert(h.error<.003);assert(d.handError<.001);assert(d.tipError<.001);assert.deepEqual(h.contactRows.map(r=>r.finger),['thumb','index','middle']);}});assert(samples>200);assert.equal(f.s.desks.sora.owner,'desk');}assert.deepEqual(f.s.violations,[]);}finally{f.close();}
});
test('keyboard presses track real named keycaps, not a wrist bounce; task arrival cancels review',()=>{
 const f=fixture(options);try{assert(f.runtime.setHandReview('key-press'));const h=f.s.handGrips.rows.get('sora').R;assert.equal(h.keys.length,30);let samples=0,max=0;for(let i=0;i<180;i++){f.runtime.update(1/30);for(const row of h.pressRows){samples++;max=Math.max(max,row.error);assert(row.key.startsWith('SoraKeyboardKey'));const i=h.defs.findIndex(d=>d.name===row.finger);assert(h.pads[i].pad.getWorldPosition(new T.Vector3()).sub(new T.Vector3(0,.004,0)).distanceTo(new T.Vector3(...row.target))<.004);}}assert(samples>5);assert(max<.004,'real key press error '+max);f.vm.actors.find(a=>a.agentId==='sora').pose='typing';f.runtime.setViewModel(f.vm);step(f,.1);assert.equal(f.s.handReviewPose,null);}finally{f.close();}
});
test('owned cups and cancellation retain legacy contacts explicitly; new hand resources dispose',()=>{
 const f=fixture(options),roots=['L','R'].map(side=>f.s.handGrips.rows.get('sora')[side].root);try{f.s.startCup('sora');until(f,()=>f.s.cups.sora.state==='sip',15);step(f,.5);const h=f.s.handGrips.rows.get('sora').L;assert(h.fallback);assert(h.legacy.error<.003);f.s.cancelAll();until(f,()=>f.s.cups.sora.state==='idle',20);assert.equal(f.s.cups.sora.owner,'desk');}finally{f.close();}for(const root of roots)assert.equal(root.parent,null);
});
test('v14 shared schema is stable, serializes hierarchical bones and rejects v13',()=>{
 const a=fixture(options),b=fixture(options),old=fixture({personalMotion:true,personalities:true});try{const one=new SceneFrames(a.root),two=new SceneFrames(b.root),legacy=new SceneFrames(old.root);assert.equal(one.schema,two.schema);assert.notEqual(one.schema,legacy.schema);a.s.startRole('sora');step(a,4);two.receive(one.capture({time:a.s.time}));two.apply(1);const ba=a.s.handGrips.rows.get('sora').R.skin.bones[2],bb=b.s.handGrips.rows.get('sora').R.skin.bones[2];assert(ba.quaternion.angleTo(bb.quaternion)<.001);assert.deepEqual([...a.s.handGrips.rows.get('sora').R.skin.nails.instanceMatrix.array],[...b.s.handGrips.rows.get('sora').R.skin.nails.instanceMatrix.array]);assert.throws(()=>two.receive(legacy.capture({})),/버전/);}finally{a.close();b.close();old.close();}
});
