import {RendererResources} from './renderer-resources.mjs';
import * as T from 'three';
import{studioLighting,qualitySettings}from'./lighting.mjs';
import {GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import {OrbitControls}from'three/addons/controls/OrbitControls.js';
import {applyPose}from'./character-rig.mjs';
import {MotionClock,LABELS}from'./motion.mjs';
import {fitOrthographic}from'../src/framing.mjs';
import {releaseModel}from'../src/scene.mjs';
const $=s=>document.querySelector(s),host=$('#viewport'),stage=$('.stage'),clock=new MotionClock(),abort=new AbortController();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');clock.paused=reduced.matches;
let resources,renderer,actor,chair,oldMixer,disposed=false,frame=0,last=0,uiLast=0,view=innerWidth<700?'new':'split',loaded=false,models=[],finishedHold=0,benchmark=null,contextLost=false;
const scenes=[new T.Scene(),new T.Scene()];for(const s of scenes)s.background=new T.Color('#e9e9df');
const camera=new T.OrthographicCamera(-2,2,2,-2,.05,35);camera.position.set(-3.4,3.05,4.7);camera.lookAt(-.50,.77,-.35);
let quality='auto',lightRigs=[];let controls;const target=new T.Vector3(-.50,.77,-.35);
function cancelBenchmark(reason){if(benchmark){benchmark=null;$('#benchmark').disabled=false;$('#benchmark-result').textContent='측정 취소: '+reason;}}
function setView(next){cancelBenchmark('비교 모드 변경');view=next;stage.dataset.view=view;document.querySelectorAll('button[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));resize();}
function resize(){if(!renderer)return;const w=host.clientWidth,h=host.clientHeight;const q=qualitySettings(quality,w);renderer.setPixelRatio(Math.min(devicePixelRatio,q.dpr));for(const rig of lightRigs)rig.setQuality(Object.entries({low:512,balanced:1024,high:2048}).find(([,size])=>size===q.shadow)?.[0]);renderer.setSize(w,h,false);const aspect=(view==='split'?w/2:w)/h,size=camera.userData.close?1.18:1.95;camera.left=-size*aspect;camera.right=size*aspect;camera.top=size;camera.bottom=-size;if(!camera.userData.close){fitOrthographic(camera,new T.Box3(new T.Vector3(-2.48,0,-2.03),new T.Vector3(1.38,2.26,1.43)),aspect,1.03);}else camera.updateProjectionMatrix();}
function setCamera(kind){cancelBenchmark('카메라 변경');camera.userData.close=kind==='close';target.set(kind==='close'?-.03:-.50,kind==='close'?.95:.77,kind==='close'?-.22:-.35);controls.target.copy(target);if(kind==='front')camera.position.copy(target).add(new T.Vector3(0,1.05,5.5));else camera.position.copy(target).add(new T.Vector3(-3.1,2.4,4.8));camera.zoom=1;controls.update();resize();}
function selectTime(t){clock.returnPlan=null;clock.mode='tour';clock.time=t;clock.paused=true;$('#pause').textContent='재생';renderPose();updateUI();}
function renderPose(){if(!actor)return;const p=clock.pose();applyPose(actor,p);if(chair)chair.position.z=-.60-p.chair*.75;}
function updateUI(){if(!loaded)return;const p=clock.pose();$('#action').textContent=LABELS[p.action]??p.action;$('#position').textContent=`x ${p.x.toFixed(2)}m · 발 ${p.contact.map(c=>c?'접지':'들기').join(' / ')}`;$('#timeline').value=String(clock.time);$('#time').textContent=`${clock.time.toFixed(1)} / 22초`;$('#pause').textContent=clock.paused?'재생':'일시정지';$('#render-info').textContent=`${view} · ${host.clientWidth}×${host.clientHeight} CSS px · DPR ${renderer.getPixelRatio()} · ${renderer.info.render.calls} draw calls · ${renderer.info.render.triangles.toLocaleString()} triangles · texture ${renderer.info.memory.textures} · ${clock.returnPlan?'업무 복귀 중':'로컬 시연'}`;}
function benchmarkTick(now,dt){if(!benchmark)return;const elapsed=(now-benchmark.started)/1000;if(document.hidden||clock.paused){$('#benchmark-result').textContent='측정 취소: 숨김 또는 일시정지';benchmark=null;$('#benchmark').disabled=false;return;}
 if(elapsed<5){$('#benchmark-result').textContent=`준비 ${elapsed.toFixed(1)} / 5초`;return;}const run=Math.floor((elapsed-5)/30);if(run>=3){const percentile=(values,p)=>values.toSorted((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))];const result=benchmark.samples.map((values,i)=>({run:i+1,frames:values.length,p50:percentile(values,.5),p95:percentile(values,.95)}));$('#benchmark-result').textContent=`${benchmark.conditions}\n`+result.map(r=>`${r.run}회 · ${r.frames} frames · p50 ${r.p50.toFixed(2)}ms · p95 ${r.p95.toFixed(2)}ms`).join('\n');benchmark=null;$('#benchmark').disabled=false;return;}benchmark.samples[run].push(dt*1000);$('#benchmark-result').textContent=`${benchmark.conditions}\n${run+1} / 3회 · ${((elapsed-5)%30).toFixed(1)} / 30초`;}
function tick(now){if(disposed)return;frame=requestAnimationFrame(tick);const realDt=last?(now-last)/1000:0;last=now;if(document.hidden||contextLost)return;
 if(loaded){clock.tick(realDt);if(clock.mode==='tour'&&clock.time>=22&&!clock.paused){finishedHold+=Math.min(.06,realDt);if(finishedHold>1.5&&$('#repeat').checked){clock.play('tour');finishedHold=0;}}else finishedHold=0;renderPose();if(!clock.paused)oldMixer?.update(Math.min(.06,realDt));}
 controls.update();renderer.info.reset();renderer.setScissorTest(true);const w=host.clientWidth,h=host.clientHeight;
 if(view==='split'){renderer.setViewport(0,0,w/2,h);renderer.setScissor(0,0,w/2,h);renderer.render(scenes[0],camera);renderer.setViewport(w/2,0,w/2,h);renderer.setScissor(w/2,0,w/2,h);renderer.render(scenes[1],camera);}else{renderer.setViewport(0,0,w,h);renderer.setScissor(0,0,w,h);renderer.render(scenes[view==='old'?0:1],camera);}for(const scene of scenes)resources.capture(scene);
 benchmarkTick(now,realDt);if(now-uiLast>120){updateUI();uiLast=now;}
}
async function init(){
 try{
 renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});resources=new RendererResources(renderer);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.info.autoReset=false;host.append(renderer.domElement);
 controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(target);controls.enablePan=false;controls.enableDamping=true;controls.minZoom=.65;controls.maxZoom=2.7;controls.maxPolarAngle=Math.PI*.48;controls.update();controls.addEventListener('start',()=>cancelBenchmark('카메라 조작'));lightRigs=scenes.map(s=>studioLighting(s));
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();resources.release();for(const scene of scenes)releaseModel(scene,{contextLost:true});for(const lights of lightRigs)lights.release();contextLost=true;$('#load-status').textContent='3D 화면이 중단되었습니다. 새로고침하면 에셋을 다시 불러옵니다.';},{signal:abort.signal});
 setView(view);const loader=new GLTFLoader();
 // TextureLoader decodes embedded blob images through img-src; keep the existing strict connect-src unchanged.
 loader.register(parser=>({name:'LocalEmbeddedPNG',loadTexture(index){return parser.loadTextureImage(index,parser.json.textures[index].source,new T.TextureLoader(parser.options.manager));}}));
 const results=await Promise.allSettled([loader.loadAsync('/assets/studio-team-v4.glb'),loader.loadAsync('./nara-workspace-sample.glb')]);
 if(disposed){for(const r of results)if(r.status==='fulfilled')releaseModel(r.value.scene);return;}
 if(results[0].status!=='fulfilled')throw new Error('기존 v4 GLB를 불러오지 못했습니다.');
 const old=results[0].value;old.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});models.push(old.scene);const workspace=old.scene.getObjectByName('Workspace');if(!workspace)throw new Error('v4 나라 자리가 없습니다.');workspace.removeFromParent();workspace.position.set(0,0,0);scenes[0].add(workspace);models.push(workspace);
 const floor=old.scene.getObjectByName('Floor').clone();scenes[0].add(floor);oldMixer=new T.AnimationMixer(workspace);const clip=T.AnimationClip.findByName(old.animations,'nara_typing');if(clip)oldMixer.clipAction(clip).play();
 if(results[1].status!=='fulfilled'){setView('old');throw new Error('새 샘플을 불러오지 못해 기존 v4를 표시합니다. 새로고침해 다시 시도하세요.');}
 const fresh=results[1].value,model=fresh.scene.getObjectByName('NaraQualitySample');models.push(fresh.scene);actor=fresh.scene.getObjectByName('NaraActorRoot');
 if(model?.userData.schemaVersion!==1||!actor||!fresh.animations.some(c=>c.name==='nara_walk'))throw new Error('새 에셋의 리그·클립 계약이 일치하지 않습니다.');
 for(const name of model.userData.anchors)if(!fresh.scene.getObjectByName(name))throw new Error('필수 anchor 누락: '+name);
 let maps=0;fresh.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material.userData.textureKind&&!o.material.map)throw new Error('필수 재질 텍스처 누락: '+o.material.name);if(o.material.map){if(!o.material.map.image?.width)throw new Error('텍스처 디코딩 실패');maps++;}}});
 if(!maps)throw new Error('내장 PNG가 디코딩되지 않았습니다.');
 scenes[1].add(fresh.scene);chair=fresh.scene.getObjectByName('SampleChair');loaded=true;clock.play('tour');clock.paused=reduced.matches;$('#pause').disabled=false;$('#load-status').textContent='GLB 재수입 완료 · 실제 3D 모델';$('#asset-info').textContent=`${fresh.animations.length}개 실제 클립 · ${maps}개 메시의 내장 PNG 디코딩 확인 · metre / +Y / floor 0 · v4 원본 유지`;renderPose();
 }catch(error){if(models.length)setView('old');$('#load-status').textContent=error.message;$('#asset-info').textContent='불러오기 실패 · '+error.message;}
 if(renderer&&!disposed){last=performance.now();frame=requestAnimationFrame(tick);}
}
for(const b of document.querySelectorAll('button[data-view]'))b.addEventListener('click',()=>setView(b.dataset.view),{signal:abort.signal});
for(const b of document.querySelectorAll('[data-seek]'))b.addEventListener('click',()=>{selectTime(Number(b.dataset.seek));clock.paused=false;},{signal:abort.signal});
$('#checkpoint').addEventListener('change',e=>{if(e.target.value!=='')selectTime(Number(e.target.value));},{signal:abort.signal});
$('#timeline').addEventListener('input',e=>selectTime(Number(e.target.value)),{signal:abort.signal});
$('#pause').addEventListener('click',()=>{clock.paused=!clock.paused;updateUI();},{signal:abort.signal});
$('#tour').addEventListener('click',()=>{clock.play('tour');clock.paused=false;updateUI();},{signal:abort.signal});
$('#work').addEventListener('click',()=>{if(loaded){clock.requestWork();clock.paused=false;updateUI();}},{signal:abort.signal});
$('#quality').addEventListener('change',e=>{cancelBenchmark('화질 변경');quality=e.target.value;resize();},{signal:abort.signal});
$('#lighting').addEventListener('change',e=>{cancelBenchmark('조명 변경');lightRigs.forEach(r=>r.setTime(e.target.value));},{signal:abort.signal});
for(const id of ['wide','close','front'])$('#'+id).addEventListener('click',()=>setCamera(id),{signal:abort.signal});
$('#benchmark').addEventListener('click',()=>{if(!loaded)return;clock.play('tour');clock.paused=false;$('#repeat').checked=true;benchmark={started:performance.now(),samples:[[],[],[]],conditions:`${view} · ${host.clientWidth}×${host.clientHeight} · DPR ${renderer.getPixelRatio()} · ACES 1.03 · warmup 5s / 30s × 3`};$('#benchmark').disabled=true;stage.scrollIntoView({block:'center',behavior:'instant'});},{signal:abort.signal});
reduced.addEventListener('change',()=>{if(reduced.matches){clock.paused=true;updateUI();}},{signal:abort.signal});
document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden&&benchmark){$('#benchmark-result').textContent='측정 취소: 페이지 숨김';benchmark=null;$('#benchmark').disabled=false;}},{signal:abort.signal});
const observer=new ResizeObserver(resize);observer.observe(host);
function dispose(){if(disposed)return;disposed=true;abort.abort();observer.disconnect();cancelAnimationFrame(frame);controls?.dispose();oldMixer?.stopAllAction();resources?.dispose();for(const model of models){model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});releaseModel(model);}for(const s of scenes)s.traverse(o=>{if(o.isLight)o.shadow?.dispose();});renderer?.dispose();renderer?.forceContextLoss();}
window.addEventListener('pagehide',dispose,{once:true});
init();
