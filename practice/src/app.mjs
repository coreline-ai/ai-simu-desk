import {installHairFill} from './assets/hair-fill.mjs';
import {installMinHair} from './assets/min-hair.mjs';
import {createSession,TEAM} from './session.mjs';
import {SCENARIOS,CATEGORIES,SPEEDS,ScenarioPlayer} from './scenarios.mjs';
import {createQualityView} from '../../pilot-3d/sample/quality-view.mjs';
import {createTeamRuntime} from '../../pilot-3d/activities/team-runtime.mjs';
const $=id=>document.getElementById(id),ids=TEAM.map(p=>p.id),names=Object.fromEntries(TEAM.map(p=>[p.id,p.name]));
let selected='nara',paused=false,ready=false,view,engine,player,disposed=false,motionOptIn=true,speed=1,filter='all';
const reviewMode=['127.0.0.1','localhost'].includes(location.hostname)&&new URL(location.href).searchParams.get('review')==='1';
const pref=matchMedia('(prefers-reduced-motion: reduce)');
const session=createSession(renderSession);
const phases={idle:'업무를 맡기면 분석 → 작성 → 확인 순서로 이어집니다.',analyze:'01 / 요청을 살펴보고 있어요…',compose:'02 / 역할에 맞는 예시 결과를 작성하고 있어요…',review:'03 / 작성한 내용을 확인하고 있어요…',done:'완료 · 아래 내용은 규칙 기반 예시입니다.',cancelled:'실습을 중단했습니다. 새 업무를 맡겨보세요.'};
const busy=()=>['analyze','compose','review'].includes(session.state.phase);
function renderSession(state){
 $('progress').textContent=phases[state.phase];$('result').textContent=state.result;$('result').hidden=!state.result;
 $('submit').disabled=busy();$('request').disabled=busy();$('example').disabled=busy();
 for(const b of $('team').children)b.disabled=busy();
 $('submit').textContent=busy()?'예시 결과 만드는 중…':names[selected]+'에게 업무 맡기기 ↗';
}
function syncMotion(){
 const stopped=paused||pref.matches&&!motionOptIn;
 view?.setViewModel({actors:ids.map(agentId=>({agentId,pose:'idle'})),selectedAgent:selected,motionPaused:stopped});
 if(ready)$('scene-status').textContent=stopped?'잠시 쉬는 작업실':'다섯 동료가 함께하는 작업실';
 $('pause').textContent=stopped?'다시 재생':'일시정지';$('pause').setAttribute('aria-pressed',String(stopped));
 $('motion-note').textContent=stopped?'장면 일시정지 중':`${speed}배 · 새로고침해도 자동으로 움직여요`;
 if(player)renderScenario(player.snapshot());
}
function select(id){
 if(!ids.includes(id)||busy())return;
 selected=id;for(const b of $('team').children)b.setAttribute('aria-pressed',String(b.dataset.actor===id));
 if($('peer').value===selected)$('peer').value=ids.find(id=>id!==selected);
 for(const option of $('peer').options)option.disabled=option.value===selected;
 renderSession(session.state);syncMotion();
}
for(const person of TEAM){
 const button=document.createElement('button');button.type='button';button.dataset.actor=person.id;button.setAttribute('aria-label',`${person.name} · ${person.role}`);button.setAttribute('aria-pressed',String(selected===person.id));
 const avatar=document.createElement('span');avatar.className='avatar';avatar.style.setProperty('--avatar',person.color);avatar.textContent=person.name[0];avatar.setAttribute('aria-hidden','true');
 const name=document.createElement('span');name.textContent=person.name;const role=document.createElement('small');role.textContent=person.role;button.append(avatar,name,role);button.onclick=()=>select(person.id);$('team').append(button);
}
for(const person of TEAM){const option=document.createElement('option');option.value=person.id;option.textContent=person.name+' · '+person.role;option.disabled=person.id===selected;$('peer').append(option);}$('peer').value='jun';
function renderScenario(state){
 const entry=SCENARIOS.find(s=>s.id===(state.pending??state.id)),people=state.participants.map(id=>names[id]).join('·');
 $('scenario-current').textContent=state.phase==='returning'?(entry?'다음 장면 · '+entry.label:'업무 자리로 돌아가는 중'):state.label+(people?' · '+people:'');
 $('scenario-progress').textContent=state.error||({idle:'모든 동료가 업무 자리로 복귀했습니다. 새 장면을 골라보세요.',returning:'손에 든 소품을 정리하고 자리로 복귀한 뒤 시작합니다.',complete:'장면을 마치고 복귀했습니다. 다시 시작하거나 다른 장면을 골라보세요.',error:'활동을 시작하지 못했습니다.'}[state.phase]??(state.step?`${state.step}/${state.total} · ${state.stage}`:state.id==='daily'?'각자의 개성을 유지하며 업무·이동·휴식을 자율적으로 이어갑니다.':'이동·동작·소품 정리·복귀까지 이어집니다.'))+(state.phase==='returning'&&(paused||pref.matches&&!motionOptIn)?' 일시정지 중입니다. 다시 재생하면 복귀를 이어갑니다.':'');
 $('scenario-restart').disabled=!ready||!state.canRestart;
 $('scenario-stop').disabled=!ready||['idle','complete','error'].includes(state.phase);
 for(const button of document.querySelectorAll('[data-scenario]'))button.setAttribute('aria-pressed',String(button.dataset.scenario===(state.pending??state.id)&&['playing','returning'].includes(state.phase)));
}
function sceneAction(kind){
 if(!ready||!player)return false;
 try{player.request(kind,selected,$('peer').value);if(kind==='glasses'){select('jun');view?.resetCamera('hands:jun');}return true;}catch(error){$('scenario-progress').textContent=error.message;return false;}
}
for(const [id,label]of Object.entries(CATEGORIES)){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.filter=id;button.setAttribute('aria-pressed',String(id===filter));button.onclick=()=>{filter=id;for(const b of $('scenario-filters').children)b.setAttribute('aria-pressed',String(b.dataset.filter===filter));for(const card of $('scenario-cards').children)card.hidden=filter!=='all'&&card.dataset.group!==filter;};$('scenario-filters').append(button);}
for(const entry of SCENARIOS.filter(s=>!s.quick)){const button=document.createElement('button');button.type='button';button.className='scenario-card';button.dataset.scenario=entry.id;button.dataset.group=entry.group;button.dataset.scene='';button.disabled=true;button.setAttribute('aria-pressed','false');const category=document.createElement('span');category.className='category';category.textContent=CATEGORIES[entry.group]+(entry.peer?' · 두 동료':entry.fixed?' · 준 전용':entry.sequence?' · 연속 재생':'');const title=document.createElement('strong');title.textContent=entry.label;const summary=document.createElement('span');summary.className='description';summary.textContent=entry.summary;button.append(category,title,summary);button.onclick=()=>sceneAction(entry.id);$('scenario-cards').append(button);}
for(const button of document.querySelectorAll('[data-speed]'))button.onclick=()=>{const rate=Number(button.dataset.speed);if(!ready||!SPEEDS.includes(rate))return;speed=view.setMotionSpeed(rate);for(const b of document.querySelectorAll('[data-speed]'))b.setAttribute('aria-pressed',String(Number(b.dataset.speed)===speed));syncMotion();};
$('scenario-restart').onclick=()=>player?.restart();$('scenario-stop').onclick=()=>player?.stop();
$('request').oninput=()=>{$('count').textContent=$('request').value.length+' / 1,200';$('form-error').textContent='';};
$('example').onclick=()=>{$('request').value='독서 모임 모집 페이지를 '+{nara:'기획해줘',sora:'디자인해줘',jun:'구현할 순서로 정리해줘',min:'검수할 체크리스트를 만들어줘',leo:'한눈에 보기 좋게 요약해줘'}[selected];$('request').dispatchEvent(new Event('input'));$('request').focus();};
$('request-form').onsubmit=event=>{event.preventDefault();$('form-error').textContent='';try{session.start($('request').value,selected);sceneAction('role');}catch(error){$('form-error').textContent=error.message;}};
$('reset').onclick=()=>{session.reset();$('request').value='';$('request').dispatchEvent(new Event('input'));sceneAction('daily');};
$('pause').onclick=()=>{if(paused||pref.matches&&!motionOptIn){motionOptIn=true;paused=false;}else paused=true;syncMotion();};
for(const [button,target]of [['room','room'],['close',()=>selected],['hands',()=>`hands:${selected}`]])$(button).onclick=()=>{view?.setAutoCamera(false);view?.resetCamera(typeof target==='function'?target():target);};
for(const kind of ['roles','cup','daily']){$(kind).dataset.scenario=kind;$(kind).setAttribute('aria-pressed','false');$(kind).onclick=()=>sceneAction(kind);}
for(const [button,preset]of [['day','day'],['evening','evening']])$(button).onclick=()=>{view?.setLighting(preset);$('day').setAttribute('aria-pressed',String(preset==='day'));$('evening').setAttribute('aria-pressed',String(preset==='evening'));};
function failure(){
 ready=false;player?.dispose();player=undefined;$('scenario-current').textContent='3D 장면을 표시할 수 없어요';$('scenario-progress').textContent='새로고침 후 다시 시도해 주세요. 오른쪽 2D 실습은 계속 사용할 수 있습니다.';$('stage').hidden=true;$('poster').hidden=false;$('loading').hidden=true;$('fallback').hidden=false;$('scene-status').textContent='작업실 미리보기';
 for(const b of document.querySelectorAll('[data-scene],#day,#evening'))b.disabled=true;
 // Release a failed renderer instead of leaving its RAF/GPU resources alive.
 queueMicrotask(()=>{view?.dispose();view=undefined;engine=undefined;});
}
function mountRuntime(model,meta){
 const hair=installMinHair(model);
 let fill,runtime;
 try{fill=installHairFill(model);runtime=createTeamRuntime(model,meta,{auto:false,natural:true,enriched:true,expressive:true,interaction:true,refined:true,grounded:true,personalMotion:true,personalities:true,anatomicalActors:ids,sharedLegacyHandTexture:true});}
 catch(error){fill?.dispose();hair.dispose();throw error;}
 const dispose=runtime.dispose.bind(runtime);
 runtime.dispose=()=>{try{dispose();}finally{fill.dispose();hair.dispose();}};
 const diagnostics=runtime.diagnostics.bind(runtime);
 runtime.diagnostics=()=>{const d=diagnostics();d.teamActivities.practiceMinHair=hair.diagnostics();d.teamActivities.practiceHairFill=fill.diagnostics();return d;};
 engine=runtime.scheduler;player=new ScenarioPlayer(engine,renderScenario);
 const update=runtime.update.bind(runtime);runtime.update=dt=>{update(dt);player.tick();};
 return runtime;
}
async function mount(){
 try{
  view=createQualityView($('stage'),{onSelect:select,onStatus(kind){if(disposed)return;if(kind==='error'||kind==='lost')failure();}},
  {motionReview:reviewMode,allowSlowMotion:true,roomQuality:true,modelVersion:9,modelUrl:__OFFICE_MODEL__,actorLabels:names,runtimeFactory:mountRuntime});
  // Explicit balanced matches desktop production quality, including on narrow
  // screens: no automatic low-quality downgrade or FPS cap in the Lite shell.
  view.setQuality('balanced');view.setLighting('day');view.setMotionSpeed(speed);syncMotion();
  const loaded=await view.ready;if(disposed)return;if(!loaded||!view){failure();return;}
  ready=true;$('poster').hidden=true;$('loading').hidden=true;syncMotion();
  for(const b of document.querySelectorAll('[data-scene]'))b.disabled=false;
  sceneAction('daily');
 }catch{failure();}
}
function mediaChange(){motionOptIn=false;syncMotion();}pref.addEventListener('change',mediaChange);
window.addEventListener('pagehide',()=>{disposed=true;session.dispose();player?.dispose();pref.removeEventListener('change',mediaChange);view?.dispose();},{once:true});
// A read-only, localhost-only QA seam. No app internals exposed on public sites.
if(['127.0.0.1','localhost'].includes(location.hostname))Object.defineProperty(window,'__practiceQA',{value:{diagnostics:()=>view?.diagnostics(),captureScene:()=>view?.captureScene(),session:()=>session.state,scenario:()=>player?.snapshot(),...(reviewMode?{reviewFrames:count=>view?.reviewFrames(count)}:{})}});
renderSession(session.state);void mount();
