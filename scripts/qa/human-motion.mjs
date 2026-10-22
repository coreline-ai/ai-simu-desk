import {launchBrowser,qaOrigin} from './browser.mjs';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const out='product/evidence/human-motion',b=await launchBrowser(),p=await b.newPage({viewport:{width:1440,height:1100}}),errors=[],checks=[];
p.on('pageerror',e=>errors.push(e.message));
async function ready(enabled){await p.waitForFunction(value=>window.__livingStudio?.diagnostics()?.teamActivities?.living?.humanMotion?.enabled===value,enabled);}
async function walkingShot(name){
 await p.selectOption('#speed','3');
 await p.waitForFunction(()=>{const s=window.__livingStudio.engine,state=s.state('sora'),phase=(state.pose?.gaitTime??0)%1;return state.action==='walk'&&state.pose.gaitTime>2&&phase>.16&&phase<.4;},null,{timeout:60000});
 await p.click('#pause');await p.selectOption('#actor','sora');await p.click('#close');
 await p.evaluate(()=>{const{view,engine:s}=window.__livingStudio,state=s.state('sora'),position=view.diagnostics().scenePositions.sora,c=view.cameraState(),yaw=state.pose.yaw;const offset=[Math.sin(yaw)*4+Math.cos(yaw)*2,1.7,Math.cos(yaw)*4-Math.sin(yaw)*2];view.restoreCamera({...c,position:[position[0]+offset[0],1+offset[1],position[2]+offset[2]],target:[position[0],1,position[2]],zoom:1.05});});
 await p.locator('.studio').screenshot({path:out+'/'+name+'.png'});assert.equal(await p.locator('canvas').count(),1);
 return p.evaluate(()=>{const d=window.__livingStudio.diagnostics();return{camera:d.camera,humanMotion:d.teamActivities.living.humanMotion,actors:d.actors,violations:d.teamActivities.violations};});
}
try{
 await mkdir(out,{recursive:true});await p.goto(qaOrigin+'/demos/activities/living/?play=1&activity=walk');await ready(true);
 const after=await walkingShot('after-walk');checks.push('new five-person demo and relaxed visible walking hands');
 const time=await p.evaluate(()=>window.__livingStudio.diagnostics().animationTime);await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>window.__livingStudio.diagnostics().animationTime),time);checks.push('pause freezes motion');
 await p.click('#pause');await p.click('#original');await ready(false);assert.equal(await p.locator('#original').getAttribute('aria-pressed'),'true');const before=await walkingShot('original-v11-walk');checks.push('same-space original v11 comparison, actor camera, speed and one canvas');
 await p.click('#pause');await p.click('#human');await ready(true);await p.click('#room');await p.selectOption('#speed','3');
 await p.evaluate(()=>{window.__humanWalkSeen=[];});
 await p.waitForFunction(()=>{const s=window.__livingStudio.engine;for(const id of s.ids)if(s.state(id).action==='walk'&&!window.__humanWalkSeen.includes(id))window.__humanWalkSeen.push(id);return window.__humanWalkSeen.length===5;},null,{timeout:60000});checks.push('all five walk in the browser');
 await p.waitForFunction(()=>window.__livingStudio.engine.huddles.current?.phase==='talk',null,{timeout:60000});await p.locator('.studio').screenshot({path:out+'/five-person-dialogue.png'});await p.waitForFunction(()=>!window.__livingStudio.engine.huddles.current,null,{timeout:60000});assert.equal(await p.evaluate(()=>window.__livingStudio.engine.huddles.history.at(-1).status),'complete');checks.push('all five discuss and return');
 for(const rate of['1','1.5','2','3']){await p.selectOption('#speed',rate);assert.equal(await p.evaluate(()=>window.__livingStudio.diagnostics().motionSpeed),Number(rate));}checks.push('x1 x1.5 x2 x3');
 for(const width of[320,390,768,1440]){await p.setViewportSize({width,height:1100});await p.waitForTimeout(100);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await p.locator('canvas').count(),1);}checks.push('320–1440px, no horizontal overflow');
 await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>document.querySelector('#pause').disabled);const frozen=await p.evaluate(()=>window.__livingStudio.diagnostics().animationTime);await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>window.__livingStudio.diagnostics().animationTime),frozen);checks.push('OS reduced motion');
 await p.emulateMedia({reducedMotion:'no-preference'});await p.click('#baseline');await p.waitForFunction(()=>window.__livingStudio.diagnostics()?.teamActivities?.version===10);assert(await p.locator('#human').isDisabled());await p.click('#living');await ready(true);assert.equal(await p.locator('canvas').count(),1);checks.push('v10 preserved and v11 restored');
 assert.deepEqual(errors,[]);await writeFile(out+'/browser-controls.json',JSON.stringify({passed:true,origin:qaOrigin,checks,before,after,errors},null,2));console.log(JSON.stringify({passed:true,checks,errors}));
}catch(e){await p.screenshot({path:out+'/browser-failure.png',fullPage:true}).catch(()=>{});await writeFile(out+'/browser-failure.json',JSON.stringify({error:e.message,errors,diagnostics:await p.evaluate(()=>window.__livingStudio?.diagnostics()).catch(()=>null)},null,2));throw e;}finally{await b.close();}
