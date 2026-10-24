import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createHairFillGeometry,hairlineAngle,installHairFill,HAIR_FILL_ASSETS} from '../src/assets/hair-fill.mjs';
import {createLivingOffice} from '../../pilot-3d/living-office/model.mjs';
import {releaseStudioAsset} from '../../pilot-3d/sample/asset-loader.mjs';

function fixture(){const model=new T.Group();for(const prefix of ['Nara','Sora','Leo']){const h=new T.Group();h.name=prefix+'Head';const m=new T.Mesh(new T.SphereGeometry(1,8,8),new T.MeshStandardMaterial({color:0x38271f}));m.name=prefix+'_HairBack';h.add(m);model.add(h);}return model;}

test('each fill is one connected disk: no internal holes or duplicate seam; only intentional hairline is open',()=>{
 for(const {actor}of HAIR_FILL_ASSETS){const g=createHairFillGeometry(actor),edges=new Map(),tri=g.index.array,positions=g.attributes.position;assert.equal(tri.length/3,736);assert.equal(positions.count,385);
  for(let i=0;i<tri.length;i+=3)for(const [a,b]of [[tri[i],tri[i+1]],[tri[i+1],tri[i+2]],[tri[i+2],tri[i]]]){const key=[a,b].sort((a,b)=>a-b).join(':');edges.set(key,(edges.get(key)??0)+1);}
  const open=[...edges].filter(([,count])=>count===1);assert.equal(open.length,32);for(const [key]of open)assert.ok(key.split(':').every(v=>Number(v)>=353),'only bottom ring may be open');for(const count of edges.values())assert.ok(count===1||count===2);
  for(const v of positions.array)assert.ok(Number.isFinite(v));for(const v of g.attributes.normal.array)assert.ok(Number.isFinite(v));assert.ok(g.boundingBox.min.y>-.13);assert.ok(g.boundingBox.max.y<.20);g.dispose();
 }
});

test('dense scalp rays hit continuous outward-facing hair above the face; eyes and brows stay uncovered',()=>{
 for(const {actor}of HAIR_FILL_ASSETS){const g=createHairFillGeometry(actor),m=new T.Mesh(g,new T.MeshBasicMaterial()),center=new T.Vector3(0,.008,.023);m.updateMatrixWorld(true);let hits=0;
  for(let col=0;col<96;col++)for(let row=1;row<=20;row++){const phi=(col+.37)/96*Math.PI*2,theta=(hairlineAngle(phi)-.055)*row/20,dir=new T.Vector3(.155*Math.sin(theta)*Math.cos(phi),.181*Math.cos(theta),.146*Math.sin(theta)*Math.sin(phi)).normalize();const ray=new T.Raycaster(center.clone().addScaledVector(dir,.5),dir.clone().negate());assert.ok(ray.intersectObject(m).length>0,actor+': scalp gap '+col+':'+row);hits++;}
  assert.equal(hits,1920);for(const [x,y,z]of [[-.057,.02,.143],[.057,.02,.143],[-.055,.063,.149],[.055,.063,.149]]){const ray=new T.Raycaster(new T.Vector3(x,y,.4),new T.Vector3(0,0,-1),0,.4-z);assert.equal(ray.intersectObject(m).length,0,actor+': front face covered');}g.dispose();m.material.dispose();
 }
});

test('full model: all original nodes including Min/Jun unchanged; same hair materials; inherited head motion and safe cleanup',()=>{
 const {root}=createLivingOffice(),original=[];root.traverse(node=>original.push({node,parent:node.parent,visible:node.visible,p:node.position.toArray(),q:node.quaternion.toArray(),s:node.scale.toArray(),geometry:node.geometry,material:node.material}));
 const patch=installHairFill(root);try{
  assert.deepEqual(patch.diagnostics().map(d=>d.actor),['nara','sora','leo']);for(const d of patch.diagnostics()){const mesh=root.getObjectByName('Practice'+d.head.replace('Head','')+'HairFill');assert.equal(mesh.parent.name,d.head);assert.ok(original.some(n=>n.material===mesh.material));assert.equal(mesh.material.map,null);assert.equal(d.triangles,736);const head=mesh.parent,previous=head.quaternion.clone();head.rotation.set(.18,-.2,.05);root.updateMatrixWorld(true);assert.ok(1-Math.abs(mesh.getWorldQuaternion(new T.Quaternion()).dot(head.getWorldQuaternion(new T.Quaternion())))<1e-10);head.quaternion.copy(previous);}
  for(const r of original){const n=r.node;assert.equal(n.parent,r.parent);assert.equal(n.visible,r.visible);assert.deepEqual(n.position.toArray(),r.p);assert.deepEqual(n.quaternion.toArray(),r.q);assert.deepEqual(n.scale.toArray(),r.s);assert.equal(n.geometry,r.geometry);assert.equal(n.material,r.material);}
  let geometries=0,materials=0;for(const d of patch.diagnostics()){const head=root.getObjectByName(d.head),mesh=head.getObjectByName('Practice'+d.head.replace('Head','')+'HairFill');mesh.geometry.addEventListener('dispose',()=>geometries++);mesh.material.addEventListener('dispose',()=>materials++);}patch.dispose();patch.dispose();assert.equal(geometries,3);assert.equal(materials,0);const again=installHairFill(root);again.dispose();
 }finally{patch.dispose();releaseStudioAsset(root);}
});

test('missing head/material and duplicate installation are atomic; unsupported actors rejected',()=>{
 assert.throws(()=>createHairFillGeometry('min'),/Unsupported/);const root=fixture();root.getObjectByName('SoraHead').removeFromParent();assert.throws(()=>installHairFill(root),/SoraHead/);assert.equal(root.getObjectByName('PracticeNaraHairFill'),undefined);releaseStudioAsset(root);
 const valid=fixture(),patch=installHairFill(valid);assert.throws(()=>installHairFill(valid),/already/);patch.dispose();valid.getObjectByName('Leo_HairBack').removeFromParent();assert.throws(()=>installHairFill(valid),/material/);assert.equal(valid.getObjectByName('PracticeNaraHairFill'),undefined);releaseStudioAsset(valid);
});
