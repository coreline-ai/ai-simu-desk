import * as T from 'three';
import {bone,clothLimb}from'./cloth.mjs';
import {group,material,box,sphere,rod,tube} from './geometry.mjs';
export const LEG={upper:.37,lower:.405};
export function solveKnee(hip,ankle,pole=new T.Vector3(0,0,1)){
 const delta=ankle.clone().sub(hip),distance=delta.length();
 if(distance>LEG.upper+LEG.lower+.0001)throw new Error('Leg target exceeds reach');
 const axis=delta.normalize(),along=(LEG.upper**2-LEG.lower**2+distance**2)/(2*distance);
 const bend=pole.clone().addScaledVector(axis,-pole.dot(axis)).normalize();
 return hip.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,LEG.upper**2-along**2)));
}
export function createNara(parent){
 const actor=group(parent,'NaraActorRoot'),rig=group(actor,'NaraRigRoot');actor.userData={actorId:'nara',translationOwner:'runtime'};
 const skin=material('Nara_Skin',0xe7b997,.86),blush=material('Nara_Blush',0xd99680),hair=material('Nara_Hair',0x38271f,.63),hairLight=material('Nara_HairRibbon',0x594032,.64),sweater=material('Nara_Fabric',0xa9b49a,.92),rib=material('Nara_Rib',0x8e9d7d),pants=material('Nara_Trousers',0xeee4d1),sole=material('Nara_Rubber',0xb69b7a),shoe=material('Nara_Leather',0xf6eddb,.64),dark=material('Nara_Eyes',0x2b2925,.38),white=material('Nara_EyeWhite',0xfff7e8),gold=material('Nara_Brass',0xc59a54,.32,.6);
 sweater.userData.textureKind='fabric';pants.userData.textureKind='linen';
 const pelvis=group(rig,'NaraPelvis',[0,.53,0]);
 sphere(pelvis,'TrousersHip',[.175,.105,.115],[0,0,0],pants);
 const torso=group(pelvis,'NaraTorso',[0,.19,0]);
 sphere(torso,'SweaterBody',[.20,.235,.125],[0,0,0],sweater);
 box(torso,'SweaterHem',[.32,.042,.225],[0,-.156,0],rib,.018);
 for(let i=-7;i<=7;i++)rod(torso,'HemRib'+i,[i*.020,-.174,.108],[i*.020,-.139,.112],.002,sweater);
 sphere(torso,'Collar',[.085,.045,.073],[0,.197,0],rib);
 rod(torso,'Neck',[0,.20,0],[0,.29,0],.055,skin);
 const head=group(torso,'NaraHead',[0,.45,0]);head.userData.anchor='head';
 sphere(head,'HairBack',[.173,.187,.139],[0,.006,-.025],hair);
 sphere(head,'Face',[.146,.171,.132],[0,0,.023],skin);
 for(const sign of [-1,1]){
  sphere(head,'Ear'+sign,[.027,.041,.025],[sign*.148,-.015,.016],skin);
  sphere(head,'Earring'+sign,[.008,.013,.006],[sign*.155,-.052,.034],gold);
  sphere(head,'Cheek'+sign,[.032,.014,.003],[sign*.082,-.042,.141],blush);
  sphere(head,'EyeWhite'+sign,[.025,.019,.008],[sign*.057,.020,.143],white);
  sphere(head,'Iris'+sign,[.013,.016,.008],[sign*.056,.018,.151],dark);
  sphere(head,'EyeGlint'+sign,[.004,.005,.002],[sign*.052,.024,.158],white);
  tube(head,'Brow'+sign,[[sign*.032,.055,.144],[sign*.055,.063,.149],[sign*.082,.054,.134]],.006,hair);
  sphere(head,'BobSide'+sign,[.047,.143,.090],[sign*.143,-.008,-.001],hair);
  for(let j=0;j<5;j++)tube(head,'HairStrand'+sign+'_'+j,[[sign*(.10+j*.012),.12,-.07+j*.015],[sign*(.152+j*.003),.025,-.04+j*.02],[sign*(.139+j*.005),-.122,-.02+j*.018]],.0015,hairLight);
 }
 sphere(head,'Nose',[.014,.023,.018],[0,-.016,.153],skin);
 tube(head,'Smile',[[-.025,-.064,.143],[0,-.069,.151],[.025,-.064,.143]],.0035,hair);
 for(let i=0;i<6;i++){const bang=sphere(head,'Fringe'+i,[.047,.080,.050],[-.118+i*.045,.114+Math.sin(i)*.008,.091],hair);bang.rotation.z=-.36;}
 // Overlapping spherical shoulder/cuff volumes keep a continuous clothed silhouette at raised poses.
 for(const side of ['L','R']){
  const sign=side==='L'?-1:1;
  const shoulder=bone(torso,'NaraShoulder'+side,[sign*.172,.102,0]);
  sphere(shoulder,'ShoulderCap'+side,[.086,.088,.084],[0,0,0],sweater);

  const elbow=bone(shoulder,'NaraElbow'+side,[0,-.235,0]);

  clothLimb(torso,'ContinuousSleeve'+side,[shoulder,elbow],[sign*.172,.102,0],.214+.235,.235,[.073,.051],sweater);
  box(elbow,'Cuff'+side,[.095,.038,.09],[0,-.204,0],rib,.015);
  const hand=group(elbow,'NaraHand'+side,[0,-.251,.005]);
  sphere(hand,'Palm'+side,[.043,.053,.027],[0,0,0],skin);
  for(let j=0;j<4;j++)rod(hand,'Finger'+side+j,[-.028+j*.018,-.023,.007],[-.028+j*.018,-.065+(j===0||j===3?.008:0),.01],.008,skin);
  rod(hand,'Thumb'+side,[sign*.032,.005,.005],[sign*.057,-.028,.024],.012,skin);
  const hip=bone(pelvis,'NaraHip'+side,[sign*.10,0,0]);
  sphere(hip,'HipCover'+side,[.082,.085,.083],[0,0,0],pants);

  const knee=bone(hip,'NaraKnee'+side,[0,-LEG.upper,0]);

  clothLimb(pelvis,'ContinuousTrousers'+side,[hip,knee],[sign*.10,0,0],LEG.upper+LEG.lower,.37,[.079,.054],pants);
  const foot=group(rig,'NaraFoot'+side);foot.userData.anchor='foot';
  box(foot,'Sole'+side,[.135,.034,.237],[0,-.067,.045],sole,.016);
  box(foot,'Shoe'+side,[.127,.081,.216],[0,-.029,.044],shoe,.034);
  for(let j=0;j<3;j++)rod(foot,'Lace'+side+j,[-.032,.010,.038+j*.021],[.032,.010,.038+j*.021],.003,white);
 }
 group(rig,'NaraSeatAnchor',[0,.45,0]).userData.anchor='seat';
 actor.userData.rig='articulated-nodes-with-two-bone-cloth-v1';return actor;
}
const bindings=new WeakMap();
export function part(actor,name){let cache=bindings.get(actor);if(!cache){cache=new Map();bindings.set(actor,cache);}if(!cache.has(name)){const prefix=actor.userData.prefix??'Nara',mapped=name.startsWith('Nara')?prefix+name.slice(4):prefix+'_'+name;cache.set(name,actor.getObjectByName(mapped)??actor.getObjectByName(name));}return cache.get(name);}
export function applyPose(actor,p){
 const node=name=>part(actor,name);
 actor.position.set(p.x,0,p.z);actor.rotation.y=p.yaw;
 const pelvis=node('NaraPelvis');pelvis.position.y=p.hip;
 const torso=node('NaraTorso');torso.rotation.x=.035*(1-p.stand);torso.position.z=(1-p.stand)*.10;
 actor.updateMatrixWorld(true);
 for(const [i,side] of ['L','R'].entries()){
  const sign=i===0?-1:1;
  const hip=node('NaraHip'+side),knee=node('NaraKnee'+side),foot=node('NaraFoot'+side);
  const ankle=p.feet?actor.worldToLocal(actor.parent.localToWorld(new T.Vector3(...p.feet[i].position))):new T.Vector3(sign*.10,.085,(1-p.stand)*.40);
  const start=new T.Vector3(sign*.10,p.hip,0),mid=solveKnee(start,ankle);
  hip.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),mid.clone().sub(start).normalize());
  const worldLower=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,-1,0),ankle.clone().sub(mid).normalize());
  knee.quaternion.copy(hip.quaternion).invert().multiply(worldLower);
  foot.position.copy(ankle);foot.rotation.x=p.feet&&!p.feet[i].planted?-.10:0;
  const shoulder=node('NaraShoulder'+side),elbow=node('NaraElbow'+side);
  const walk=p.action==='walk'?Math.sin((p.gaitTime??p.time)*2*Math.PI/1+i*Math.PI)*.30*(p.gaitFade??1):0;
  shoulder.rotation.set(-1.05*(1-p.stand)+walk*p.stand,0,sign*p.arms*2.72);
  elbow.rotation.set(-.93*(1-p.stand)+(-.15-p.arms*.12)*p.stand,0,0);
  if(p.action==='typing')elbow.rotation.x+=Math.sin(p.time*7+i)*.04;
 }
 actor.updateMatrixWorld(true);
}
