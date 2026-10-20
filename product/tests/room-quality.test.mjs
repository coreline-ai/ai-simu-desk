import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createRoomV6} from '../../pilot-3d/room-quality/model.mjs';
import {contactAO,staticContacts} from '../../pilot-3d/room-quality/contact-ao.mjs';
import {roomLighting} from '../../pilot-3d/room-quality/lighting.mjs';
import {validateOfficeAsset} from '../../pilot-3d/sample/asset-contract.mjs';
test('room contact bake contains immutable furniture only and leaves actor/chair routes unpainted',()=>{
 const contacts=staticContacts();assert.equal(contacts.length,30);assert.ok(contactAO(-3.11,-.52)<.9);assert.ok(contactAO(-2.5,-.95)>.99);assert.ok(contactAO(-3.85,-.83)>.99);
 assert.ok(contactAO(-3.11,-.52)>=.48);assert.ok(contacts.every(p=>p.every(Number.isFinite)));
});
test('window sample preserves all five actors and 105 bindings while adding separate normalized floor AO UVs',()=>{
 const {root,animations}=createRoomV6({stage:1});assert.equal(validateOfficeAsset({scene:root,animations}).modelVersion,6);assert.equal(root.userData.cost.triangles,406450);
 const floor=root.getObjectByName('RoomFloor');assert.ok(floor.material.userData.floorAO);const uv=floor.geometry.attributes.uv1;for(let i=0;i<uv.count;i++){assert.ok(uv.getX(i)>=0&&uv.getX(i)<=1);assert.ok(uv.getY(i)>=0&&uv.getY(i)<=1);}
 root.traverse(o=>{if(o.userData.translationOwner||/Chair/.test(o.name))assert.ok(!o.userData.staticAO);});
});
test('room lighting uses one shadow light and repeated day-quality changes own no extra lights',()=>{
 const scene=new T.Scene(),lights=roomLighting(scene);for(let i=0;i<20;i++){lights.setTime(i%2?'day':'evening');lights.setQuality(i%3===0?'low':i%3===1?'balanced':'high');}
 assert.equal(scene.children.filter(o=>o.isLight).length,4);assert.equal(scene.children.filter(o=>o.castShadow).length,1);assert.ok(lights.sun.position.z<0);assert.equal(lights.sun.shadow.mapSize.x,1024);lights.dispose();assert.equal(scene.children.length,0);
});
import {SURFACES,surfaceSample,surfacePixels} from '../../pilot-3d/room-quality/surfaces.mjs';
test('room surface maps are deterministic, seamless and use glTF ORM channel meanings',()=>{
 for(const kind of Object.keys(SURFACES)){const a=surfaceSample(kind,0,.37),b=surfaceSample(kind,1,.37);assert.ok(Math.abs(a.height-b.height)<1e-8,kind);assert.ok(Math.abs(a.roughness-b.roughness)<1e-8,kind);assert.ok(a.roughness>.5&&a.roughness<1);}
 const normal=surfacePixels('plaster','normal'),orm=surfacePixels('plaster','orm');for(let i=0;i<normal.bytes.length;i+=4){assert.ok(normal.bytes[i+2]>200);assert.equal(normal.bytes[i+3],255);assert.equal(orm.bytes[i],255);assert.equal(orm.bytes[i+2],0);}
});
test('surface expansion retains rig/triangle contract and stays below the proposed texture budget',()=>{
 const {root,animations}=createRoomV6({stage:2});validateOfficeAsset({scene:root,animations});assert.equal(root.userData.cost.triangles,406450);assert.ok(root.userData.surfaceBudget.rgbaEstimate<16*1024*1024);
 let wall=false;root.traverse(node=>{if(node.material?.userData.roomSurface==='plaster')wall=true;});assert.ok(wall);assert.ok(!root.getObjectByName('Nara_SweaterBody').material.userData.roomSurface);
});
import {STATIONS} from '../../pilot-3d/sample/room.mjs';
import {cyclePose,BODY_RADIUS} from '../../pilot-3d/sample/motion.mjs';
test('new room zones preserve every lateral route and stay within geometry budget',()=>{
 const {root}=createRoomV6({stage:3});for(const name of['WorkWoolRug','MeetingWovenRug','WallArt0','ReadingLamp','OchreLooseCushion'])assert.ok(root.getObjectByName(name),name);assert.ok(root.userData.cost.triangles<406450*1.1);
 for(const p of Object.values(STATIONS))for(let t=4;t<=7;t+=.025){const pose=cyclePose(t),x=p[0]+pose.x,z=p[2]+pose.z;for(const collider of root.userData.colliders){const dx=Math.max(collider.min[0]-x,0,x-collider.max[0]),dz=Math.max(collider.min[1]-z,0,z-collider.max[1]);assert.ok(Math.hypot(dx,dz)>=BODY_RADIUS,collider.id);}}
 assert.equal(root.getObjectByName('WorkWoolRug').material.userData.floorAO,true);
});
import {createRoomAppearance} from '../../pilot-3d/room-quality/appearance.mjs';
test('layered exterior and reading lamp change together without reallocating sky attributes or lights',()=>{
 const {root}=createRoomV6({stage:4}),scene=new T.Scene(),appearance=createRoomAppearance(root,scene),sky=root.getObjectByName('SkyBackdrop'),color=sky.geometry.attributes.color;
 assert.equal(sky.material.vertexColors,true);assert.equal(root.getObjectsByProperty('isMesh',true).filter(n=>n.userData.windowPortal).length,4);root.getObjectByName('LayeredOutdoors').traverse(n=>{if(n.isMesh)assert.equal(n.userData.noShadow,true);});const day=Array.from(color.array),bulb=root.getObjectByName('LampDiffuser');appearance.setTime('evening');assert.ok(bulb.material.emissiveIntensity>1);assert.notDeepEqual(Array.from(color.array),day);
 for(let i=0;i<20;i++)appearance.setTime(i%2?'day':'evening');assert.equal(sky.geometry.attributes.color,color);assert.equal(scene.children.length,1);assert.equal(scene.children[0].castShadow,false);assert.deepEqual(root.userData.exteriorLayers,['sky-hills','mid-trees','near-shrubs']);assert.ok(!root.getObjectByName('SkyPane0'));appearance.dispose();assert.equal(scene.children.length,0);
 const fixed=createRoomAppearance(root,scene,{fixedLighting:true});assert.equal(scene.children.length,0);fixed.dispose();
});
import {layoutLabels,createRoomPresentation} from '../../pilot-3d/room-quality/presentation.mjs';
import {screenPixels} from '../../pilot-3d/room-quality/workstations.mjs';
import {createHash} from 'node:crypto';
test('role screens differ and room cutaway/status presentation never moves actors or changes task data',()=>{
 const ids=Object.keys(STATIONS),hashes=ids.map(id=>createHash('sha256').update(screenPixels(id).pixels).digest('hex'));assert.equal(new Set(hashes).size,5);
 const {root}=createRoomV6({stage:5}),p=createRoomPresentation(root),camera=new T.PerspectiveCamera(),actor=root.getObjectByName('NaraActorRoot'),before=actor.position.clone(),states={nara:{action:'walk',returning:true,basePose:'typing'}};camera.position.set(-7,8,-9);p.update(camera,states);assert.deepEqual(p.diagnostics(),{left:true,back:true});assert.equal(root.getObjectByName('LeftWall').visible,false);assert.equal(root.getObjectByName('LayeredOutdoors').visible,false);assert.ok(actor.position.equals(before));assert.equal(root.getObjectByName('NaraScreen').material.emissiveIntensity,.52);
 camera.position.set(7,8,12);p.update(camera,{});assert.equal(root.getObjectByName('LeftWall').visible,true);assert.equal(root.getObjectByName('NaraScreen').material.emissiveIntensity,.12);assert.equal(states.nara.action,'walk');
});
test('small-screen label placement keeps the selected actor and avoids overlapping rectangles',()=>{
 const input=Object.keys(STATIONS).map((id,i)=>({id,x:100+i*22,y:80+(i%2)*8,w:48,h:19,selected:id==='nara'})),placed=layoutLabels(input,280,360);assert.ok(placed.some(p=>p.id==='nara'));
 for(let i=0;i<placed.length;i++){const a=placed[i];assert.ok(a.left>=0&&a.right<=280&&a.top>=0&&a.bottom<=360);for(const b of placed.slice(i+1))assert.ok(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom);}
});
import {SoakRecorder,mixedStates} from '../../pilot-3d/room-quality/soak.mjs';
import {returnStatus} from '../../pilot-3d/room-quality/presentation.mjs';
test('soak validation rejects pauses, hidden/restarted clocks and multiple movers without inventing a pass',()=>{
 const s=new SoakRecorder('idle',0),actors=Object.fromEntries(Object.keys(STATIONS).map(id=>[id,{action:'idle',restCount:1,microCount:1,interruptions:0}]));for(let t=0;t<=600;t++)s.observe({modelVersion:6,animationTime:t,paused:false,textures:48,geometries:190,activities:actors},t*1000,1);assert.equal(s.report(600000).passed,true);s.observe({modelVersion:6,animationTime:0,paused:true,activities:{nara:{...actors.nara,cycle:1},jun:{...actors.jun,cycle:1}}},601000,2);assert.equal(s.report(601000).passed,false);assert.ok(s.errors.length);assert.equal(s.restarts,1);
 const working=mixedStates(20,Object.keys(STATIONS));assert.equal(working.filter(a=>a.pose==='typing').length,1);assert.equal(mixedStates(36,Object.keys(STATIONS))[0].pose,'success');assert.equal(mixedStates(40,Object.keys(STATIONS))[0].pose,'idle');
 assert.equal(returnStatus('나라',{returning:true,basePose:'typing'}),'나라 · 업무 진행 · 자리 복귀 중');assert.equal(returnStatus('나라',{returning:true,basePose:'success'}),'나라 · 자리 복귀 중');assert.equal(returnStatus('나라',{returning:false}),null);assert.equal(returnStatus('나라',{returning:true,basePose:'typing'},{paused:true}),'나라 · 동작 정지 · 자리 복귀 대기');
});
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {validateRoomAsset} from '../../pilot-3d/room-quality/asset-contract.mjs';
test('actual v6 GLB preserves surface color spaces, screen emission, AO channel and portal contracts',async()=>{
 const bytes=await readFile('product/assets/studio-room-v6.glb');globalThis.self??=globalThis;const loader=new GLTFLoader();loader.register(parser=>{parser.textureLoader={load(url,done){const t=new T.Texture();queueMicrotask(()=>done(t));return t;}};return{name:'TestImageDecoder'};});const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');validateRoomAsset(gltf);
 let surfaces=0,roles=new Set(),skins=0;gltf.scene.traverse(node=>{if(node.isSkinnedMesh)skins++;for(const mat of[node.material].flat().filter(Boolean)){if(mat.userData.roomSurface){surfaces++;assert.ok(mat.normalMap);assert.equal(mat.normalMap.colorSpace,T.NoColorSpace);assert.equal(mat.roughnessMap.colorSpace,T.NoColorSpace);assert.equal(mat.map.colorSpace,T.SRGBColorSpace);}if(mat.userData.floorAO){assert.equal(mat.aoMap.channel,1);assert.ok(node.geometry.attributes.uv1);}if(mat.userData.roomScreen){roles.add(mat.userData.roomScreen);assert.equal(mat.map.colorSpace,T.SRGBColorSpace);assert.equal(mat.emissiveMap.colorSpace,T.SRGBColorSpace);}}});assert.equal(roles.size,5);assert.equal(skins,20);assert.ok(surfaces>30);
 const root=gltf.scene.getObjectByName('AfternoonStudio'),saved=root.userData.qualityStage;root.userData.qualityStage=1;assert.throws(()=>validateRoomAsset(gltf));root.userData.qualityStage=saved;
});
test('mixed soak cannot pass with idle-only activity even when time and rest counters look valid',()=>{
 const recorder=new SoakRecorder('mixed',0),actors=Object.fromEntries(Object.keys(STATIONS).map(id=>[id,{action:'idle',restCount:1,microCount:1,interruptions:0}]));for(const t of[0,1800])recorder.observe({modelVersion:6,animationTime:t,paused:false,textures:48,geometries:190,activities:actors},t*1000,1);assert.equal(recorder.report(1800000).passed,false);
 for(const[id,a]of Object.entries(actors))a.action='typing';recorder.observe({modelVersion:6,animationTime:1801,activities:actors},1801000,1);for(const a of Object.values(actors))a.action='success';recorder.observe({modelVersion:6,animationTime:1802,activities:actors},1802000,1);assert.equal(recorder.report(1802000).passed,true);
});
