import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const MIN_HAIR_ASSET=Object.freeze({id:'min-soft-curls',version:1,actor:'min',source:'original local procedural geometry',meshes:2,textures:0});

// Static, head-local geometry. No physics, extra render loop or per-frame work.
export function createMinHair(){
 const root=new T.Group();root.name='PracticeMinHair';root.userData={...MIN_HAIR_ASSET};
 const base=[],detail=[];
 const cap=new T.SphereGeometry(1,20,12);cap.scale(.173,.164,.145);cap.translate(0,.011,-.025);base.push(cap);
 // Close the crown/fringe roots above the forehead, without covering eyebrows.
 const roots=new T.SphereGeometry(1,20,10,0,Math.PI*2,0,.96);roots.scale(.154,.175,.14);roots.translate(0,.012,.024);base.push(roots);
 function lock(points,radius,accent=false){
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),steps=accent?12:16,sides=accent?5:10;
  const g=new T.TubeGeometry(curve,steps,radius,sides,false),pos=g.attributes.position,frames=curve.computeFrenetFrames(steps,false);
  // Taper both ends into adjacent locks/scalp; avoid bead-like spheres.
  for(let i=0;i<=steps;i++){
   const u=i/steps,center=curve.getPointAt(u),r=radius*(.20+.80*Math.sin(Math.PI*u)**.45);
   for(let j=0;j<=sides;j++){
    const a=j/sides*Math.PI*2,offset=frames.normals[i].clone().multiplyScalar(-Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r);
    pos.setXYZ(i*(sides+1)+j,center.x+offset.x,center.y+offset.y,center.z+offset.z);
   }
  }
  g.computeVertexNormals();(accent?detail:base).push(g);
 }
 // Connected asymmetric fringe, clear of brow line and round glasses.
 for(let i=0;i<6;i++){
  const x=-.125+i*.049,y=.163+.020*Math.sin((i+1)/7*Math.PI);
  lock([[x-.018,y,.030],[x-.026,y+.007,.077],[x+.008,y-.028,.119],[x+.016,.094+(i%2)*.007,.112]],.031);
  lock([[x-.018,y+.023,.05],[x-.019,y+.019,.081],[x+.007,y-.018,.144],[x+.017,.112+(i%2)*.007,.134]],.0017,true);
 }
 // Crown flows into the fringe instead of isolated curls with exposed gaps.
 for(const z of[-.070,-.015])for(let i=0;i<5;i++){
  const x=-.116+i*.057,y=.128+.047*Math.sqrt(Math.max(0,1-(x/.16)**2));
  lock([[x-.023,y-.006,z-.038],[x-.029,y+.020,z-.008],[x+.012,y+.020,z+.025],[x+.025,y-.012,z+.043]],.028);
 }
 for(const side of[-1,1]){
  lock([[side*.132,.120,-.012],[side*.164,.083,.018],[side*.163,.036,.039],[side*.147,.006,.029]],.022);
  lock([[side*.115,.107,-.100],[side*.157,.066,-.077],[side*.161,.012,-.065],[side*.137,-.051,-.061]],.024);
 }
 const materials=[new T.MeshStandardMaterial({color:0x3e302b,roughness:.78}),new T.MeshStandardMaterial({color:0x514037,roughness:.8})];
 for(const [i,pieces]of [base,detail].entries()){
  const geometry=mergeGeometries(pieces);for(const g of pieces)g.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,materials[i]);mesh.name=i?'MinHairCurlRidges':'MinHairConnectedVolume';mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
 }
 return root;
}

// Canonical GLB may contain individual curls or a pure curl InstancedMesh.
// Never hide a mixed batch: silently hiding skin/eyes would be a quality loss.
export function installMinHair(model){
 const head=model.getObjectByName('MinHead');if(!head)throw Error('MinHead missing');
 if(head.getObjectByName('PracticeMinHair'))throw Error('Min hair already installed');
 const isHair=name=>/^Min_(?:HairBack|Curl\d+)$/.test(name),hidden=[];
 for(const child of head.children){
  const parts=child.userData.parts;
  if(parts?.some(isHair)&&!parts.every(isHair))throw Error('Mixed Min hair batch');
  if(isHair(child.name)||parts?.length&&parts.every(isHair))hidden.push([child,child.visible]);
 }
 if(!hidden.length)throw Error('Original Min hair missing');
 const asset=createMinHair();for(const [node]of hidden)node.visible=false;head.add(asset);
 let disposed=false;
 return {asset,diagnostics:()=>({...MIN_HAIR_ASSET,parent:asset.parent?.name,hidden: hidden.map(([n])=>n.name),triangles:asset.children.reduce((n,m)=>n+m.geometry.index.count/3,0)}),dispose(){
  if(disposed)return;disposed=true;asset.removeFromParent();for(const [node,visible]of hidden)node.visible=visible;
  for(const mesh of asset.children){mesh.geometry.dispose();mesh.material.dispose();}
 }};
}
