import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ActivityReplay} from '../../pilot-3d/personal-office/replay.mjs';

const ids=['nara','sora','jun','min','leo'];
function scheduler(failed=new Set()){
 const s={calls:[],variants:new Map(ids.map(id=>[id,0])),desks:Object.fromEntries(ids.map((id,i)=>[id,{variant:(i+1)%3}]))};
 for(const method of ['startRole','startDemo','startScenario','startCup','startCoffee','startVisit','startMeeting','startSofa','startSofaPair','startWindow','startReview'])s[method]=(...args)=>{s.calls.push([method,...structuredClone(args)]);if(failed.has(method))return false;if(method==='startRole'&&args[1]?.variant!==undefined)s.desks[args[0]].variant=args[1].variant;return true;};
 s.personalMotion={glasses:{start:()=>{s.calls.push(['glasses']);return !failed.has('glasses');}}};
 s.setAuto=()=>{};s.cancelAll=()=>{};
 return s;
}

test('replay preserves the last successful command and its resolved automatic role variants',()=>{
 const replay=new ActivityReplay({kind:'team',ids}),s=scheduler();
 assert(replay.start(s,{kind:'cup',actor:'sora'}));
 const failed=scheduler(new Set(['startCoffee']));
 assert(!replay.start(failed,{kind:'coffee',actor:'leo'}));
 const fresh=scheduler();assert(replay.start(fresh));assert.deepEqual(fresh.calls,[['startCup','sora']]);
 assert(replay.start(s,{kind:'roles',ids}));
 const selected=Object.fromEntries(ids.map(id=>[id,s.desks[id].variant]));
 const second=scheduler();for(const id of ids)second.desks[id].variant=2;
 assert(replay.start(second));assert.deepEqual(second.calls,ids.map(id=>['startRole',id,{variant:selected[id]}]));
 assert.throws(()=>replay.selection.ids.push('other'),TypeError);
 const single=new ActivityReplay({kind:'role',actor:'nara'});assert(single.start(s));const exact=s.desks.nara.variant;
 const third=scheduler();third.desks.nara.variant=(exact+1)%3;assert(single.start(third));assert.deepEqual(third.calls,[['startRole','nara',{variant:exact}]]);
});

// Execute the actual page module with injected view/runtime imports and a small
// DOM. No WebGL, browser, database or motion simulation is created. This verifies
// button wiring as well as the replay dispatcher, so the former launch(team)
// closure fails the cup and three-person-meeting assertions below.
async function page(search='?play=1',{reducedMotion=false}={}){
 const nodes=new Map(),failed=new Set(),views=[],engines=[],window={addEventListener(){}};
 const node=()=>({value:'',options:[],dataset:{},checked:false,disabled:false,textContent:'',children:[],listeners:{},setAttribute(){},append(...n){this.children.push(...n);},replaceChildren(...n){this.children=n;},addEventListener(kind,fn){this.listeners[kind]=fn;}});
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node};
 const get=id=>document.getElementById(id);
 const defaults={actor:'nara',peer:'jun',scenario:'focus',variant:'auto',size:'5',speed:'1.5',quality:'balanced',lighting:'day','loop-from':'0','loop-to':'12'};
 for(const [id,value]of Object.entries(defaults))get(id).value=value;
 for(const id of ['actor','peer'])get(id).options=ids.map(value=>({value}));
 get('speed').options=[.25,.5,1,1.5,2,3].map(value=>({value:String(value)}));
 const mediaListeners=new Set();
 const pref={matches:reducedMotion,addEventListener(kind,fn){if(kind==='change')mediaListeners.add(fn);},removeEventListener(kind,fn){if(kind==='change')mediaListeners.delete(fn);},change(matches){this.matches=matches;for(const fn of mediaListeners)fn({matches});}};
 const createTeamRuntime=()=>{const s=scheduler(failed);engines.push(s);return{scheduler:s};};
 const createProductionView=(_host,callbacks,options)=>{
  let engine=options.runtimeFactory({},{}).scheduler;
  const d=()=>({modelVersion:9,inspection:{range:{enabled:false,reason:''}},teamActivities:{actors:{}},activities:{}});
  const view={ready:Promise.resolve(true),callbacks,cancelled:[],vm:null,speed:1.5,quality:'balanced',lighting:'day',cameraState:()=>({focus:'room'}),restoreCamera(){},setViewModel(vm){view.vm=vm;},setMotionSpeed(value){view.speed=Number(value);},setQuality(value){view.quality=value;},setLighting(value){view.lighting=value;},resetCamera(){},setAutoCamera(){},dispose(){},diagnostics:d,cancelInspection(reason){view.cancelled.push(reason);},setInspection(config){if(config.loop){engine=options.runtimeFactory({},{}).scheduler;return options.inspectionStart(engine);}return true;}};
  views.push(view);return view;
 };
 const source=(await readFile(new URL('../../pilot-3d/personal-office/app.mjs',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 await new AsyncFunction('createProductionView','createTeamRuntime','ActivityReplay','document','matchMedia','location','window',source)(createProductionView,createTeamRuntime,ActivityReplay,document,()=>pref,{href:'http://local/demos/activities/personal/'+search},window);
 return{get,pref,failed,views,engines,window,latest:()=>views.at(-1),engine:()=>window.__personalStudio.engine,flush:()=>new Promise(resolve=>setImmediate(resolve))};
}

test('actual page: team → manual cup → actor change → range replays the cup actor',async()=>{
 const p=await page('?play=1&demo=team');assert.deepEqual(p.engine().calls,[['startMeeting',ids]]);
 p.get('actor').value='sora';p.get('actor').onchange();p.get('cup').onclick();
 p.get('actor').value='leo';p.get('actor').onchange();p.get('loop-start').onclick();
 assert.deepEqual(p.engine().calls,[['startCup','sora']]);
 assert.equal(p.latest().speed,1.5);assert.equal(p.latest().quality,'balanced');assert.equal(p.latest().lighting,'day');
 p.get('coffee').onclick();p.failed.add('startVisit');p.get('visit').onclick();p.get('loop-start').onclick();
 assert.deepEqual(p.engine().calls,[['startCoffee','leo']]);
});

test('actual page: manual three-person meeting survives comparison remount and exact replay',async()=>{
 const p=await page();p.get('actor').value='min';p.get('actor').onchange();p.get('size').value='3';p.get('meeting').onclick();
 const chosen=['min','nara','sora'];assert.deepEqual(p.engine().calls.at(-1),['startMeeting',chosen]);
 p.get('size').value='5';p.get('actor').value='leo';p.get('actor').onchange();p.get('baseline').onclick();await p.flush();
 assert.deepEqual(p.engine().calls,[['startMeeting',chosen]]);p.get('loop-start').onclick();assert.deepEqual(p.engine().calls,[['startMeeting',chosen]]);
});

test('actual page: each direct action replaces the old team replay, and label selection cancels inspection',async()=>{
 const p=await page();
 for(const [button,method]of [['window','startWindow'],['review','startReview'],['role','startRole'],['coffee','startCoffee'],['visit','startVisit'],['glasses','glasses']]){
  p.get('actor').value='sora';p.get('actor').onchange();p.get('peer').value='min';p.get('variant').value='2';p.get(button).onclick();
  p.get('actor').value='leo';p.get('peer').value='nara';p.get('variant').value='0';p.get('loop-start').onclick();
  const call=p.engine().calls[0];assert.equal(call[0],method,button);
  if(['window','role','coffee','visit'].includes(button))assert.equal(call[1],'sora',button);
  if(button==='role')assert.deepEqual(call[2],{variant:2});
  if(button==='visit')assert.deepEqual(call,['startVisit','sora','min',{transfer:true}]);
 }
 const before=p.latest().cancelled.length;p.latest().callbacks.onSelect('nara');assert.equal(p.get('actor').value,'nara');assert.equal(p.latest().cancelled.length,before+1);assert.equal(p.latest().cancelled.at(-1),'동료 변경');
});

test('initial visit query normalizes the peer before saving its rehearsal',async()=>{
 const p=await page('?play=1&demo=visit&actor=jun');assert.deepEqual(p.engine().calls,[['startVisit','jun','nara',{transfer:true}]]);
 p.get('loop-start').onclick();assert.deepEqual(p.engine().calls,[['startVisit','jun','nara',{transfer:true}]]);
});

test('actual page: fresh loads automatically start the continuous day without a button, including reduced motion',async()=>{
 for(const reducedMotion of [false,true])for(const search of ['', '?play=1', '?demo=daily', '?demo=unknown']){
  const p=await page(search,{reducedMotion});
  assert.deepEqual(p.engine().calls,[['startDemo']]);
  assert.equal(p.latest().vm.motionPaused,false);
  assert.equal(p.get('motion-consent').hidden,true);
  assert.equal(p.get('pause').disabled,false);
  assert.equal(p.get('pause').textContent,'일시정지');
  assert.equal(p.get('loop-start').disabled,false);
  p.get('pause').onclick();assert.equal(p.latest().vm.motionPaused,true);
  p.get('baseline').onclick();await p.flush();
  assert.equal(p.latest().vm.motionPaused,true,'a manual pause survives same-page remount');
  p.get('pause').onclick();assert.equal(p.latest().vm.motionPaused,false);
  const fresh=await page(search,{reducedMotion});
  assert.equal(fresh.latest().vm.motionPaused,false,'refresh starts playback without another consent click');
 }
});

test('actual page: autoplay preserves targeted demo links and explicit play=0 opt-out',async()=>{
 const roles=await page('?play=1&demo=roles',{reducedMotion:true});
 assert.deepEqual(roles.engine().calls,ids.map(id=>['startRole',id,{}]));
 assert.equal(roles.latest().vm.motionPaused,false);
 const stopped=await page('?play=0',{reducedMotion:true});
 assert.deepEqual(stopped.engine().calls,[]);
});

test('actual page: media changes revoke playback consent, cancel repetition and restore the safe default',async()=>{
 const p=await page('?play=1',{reducedMotion:true});
 assert.equal(p.latest().vm.motionPaused,false);
 p.pref.change(false);assert.equal(p.latest().vm.motionPaused,false);
 p.pref.change(true);
 assert.equal(p.latest().vm.motionPaused,true);
 assert.equal(p.get('motion-consent').hidden,false);
 assert.equal(p.get('pause').disabled,true);
 assert.equal(p.get('loop-start').disabled,true);
 assert.equal(p.latest().cancelled.at(-1),'동작 줄이기');
 p.get('motion-play').onclick();assert.equal(p.latest().vm.motionPaused,false);
 const fresh=await page('?play=1',{reducedMotion:true});
 assert.equal(fresh.latest().vm.motionPaused,false,'the default automatic playback is restored on refresh');
});

test('actual page: disabling reduced motion resumes unless the user explicitly paused',async()=>{
 const p=await page('?play=1',{reducedMotion:true});
 p.pref.change(false);
 assert.equal(p.latest().vm.motionPaused,false);
 assert.equal(p.get('motion-consent').hidden,true);
 p.get('pause').onclick();
 p.pref.change(true);p.pref.change(false);
 assert.equal(p.latest().vm.motionPaused,true,'a manual pause is not overwritten by media changes');
});

test('the real page contains the separate, initially hidden motion-consent control',async()=>{
 const html=await readFile(new URL('../../pilot-3d/personal-office/index.html',import.meta.url),'utf8');
 assert.match(html,/<div[^>]*id="motion-consent"[^>]*hidden>/);
 assert.match(html,/<button[^>]*id="motion-play"[^>]*>이 화면에서 동작 재생<\/button>/);
});


test('Sora hand-review writing saves the exact role rehearsal rather than the old daily demo',async()=>{const p=await page('?play=0&actor=sora');p.get('hand-pose').value='tripod-write';p.get('hand-pose').onchange();await p.flush();assert.deepEqual(p.engine().calls,[['startRole','sora',{variant:0}]]);p.get('loop-start').onclick();assert.deepEqual(p.engine().calls,[['startRole','sora',{variant:0}]]);});
test('static hand-review presets cannot accidentally replay the old daily activity',async()=>{const p=await page('?play=0');p.engine().handReviewPose='key-press';p.get('loop-start').onclick();assert.deepEqual(p.engine().calls,[]);assert.match(p.get('notice').textContent,/직접 관찰/);});

test('team hand-review keeps the selected pen actor and unsupported page actor does not start a pen rehearsal',async()=>{
 for(const actor of ['nara','min']){const p=await page('?play=0&actor='+actor);p.get('hand-pose').value='tripod-write';p.get('hand-pose').onchange();await p.flush();assert.deepEqual(p.engine().calls,[['startRole',actor,{variant:0}]]);assert.equal(p.get('actor').value,actor);}
 const p=await page('?play=0&actor=leo');p.get('hand-pose').value='tripod-write';p.get('hand-pose').onchange();await p.flush();assert.deepEqual(p.engine().calls,[]);
});
