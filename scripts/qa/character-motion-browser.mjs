import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser,qaOrigin} from './browser.mjs';
const out='product/evidence/character-motion-review',browser=await launchBrowser(),errors=[],shots=[];
async function capture(label,start,ready,ids){const page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('pageerror',e=>errors.push(e.message));try{
 await page.goto(qaOrigin+'/demos/activities/living/');await page.waitForFunction(()=>window.__livingStudio?.diagnostics()?.teamActivities?.living?.humanMotion?.enabled);
 await page.evaluate(()=>{window.__livingStudio.engine.setAuto(false);window.__livingStudio.view.setMotionSpeed(3);});
 assert(await page.evaluate(start));await page.waitForFunction(ready,null,{timeout:120000});
 const d=await page.evaluate(ids=>{const w=window.__livingStudio,s=w.engine;w.view.setViewModel({actors:s.ids.map(agentId=>({agentId,pose:'idle'})),selectedAgent:ids[0],motionPaused:true});w.view.setAutoCamera(false);w.view.resetCamera(ids[0]);const d=w.diagnostics(),points=ids.map(id=>d.scenePositions[id]),p=points.reduce((a,b)=>a.map((v,i)=>v+b[i]/points.length),[0,0,0]),camera=w.view.cameraState();w.view.restoreCamera({...camera,position:[p[0]+2.6,3.2,p[2]+3.8],target:[p[0],1,p[2]+.18],zoom:ids.length===1?1.1:.8,focus:'room'});return{model:d.modelVersion,activities:d.teamActivities.version,actors:Object.fromEntries(ids.map(id=>[id,{state:s.state(id).action,desk:s.desks[id].diagnostics(),cup:s.cups[id].diagnostics()}])),violations:d.teamActivities.violations};},ids);
 await page.waitForTimeout(150);await page.locator('.studio').screenshot({path:out+'/'+label+'.png'});assert.equal(await page.locator('canvas').count(),1);assert.equal(d.model,9);assert.equal(d.activities,11);assert.deepEqual(d.violations,[]);shots.push({label,...d});console.log('PASS browser',label);
 }finally{await page.close();}}
try{await mkdir(out,{recursive:true});
 await capture('nara-note',()=>window.__livingStudio.engine.startRole('nara',{variant:0}),()=>{const d=window.__livingStudio.engine.desks.nara;return d.stage==='use'&&d.time>1;},['nara']);
 await capture('nara-cup',()=>window.__livingStudio.engine.startCup('nara'),()=>{const c=window.__livingStudio.engine.cups.nara;return c.state==='sip'&&c.time>.95&&c.time<2.1;},['nara']);
 await capture('sofa-conversation',()=>window.__livingStudio.engine.startSofaPair(['nara','jun']),()=>{const s=window.__livingStudio.engine;return s.state('nara').action==='sofa_talk'&&s.state('nara').gesture>.5;},['nara','jun']);
 await capture('seated-meeting',()=>window.__livingStudio.engine.startMeeting(),()=>window.__livingStudio.engine.state('nara').action==='meeting_talk',['nara','jun']);
 assert.deepEqual(errors,[]);await writeFile(out+'/browser.json',JSON.stringify({passed:true,at:new Date().toISOString(),origin:qaOrigin,scope:'4 visual spot checks; not all actions or devices',errors,shots},null,2)+'\n');
}catch(error){await writeFile(out+'/browser-failure.json',JSON.stringify({error:error.stack,errors,shots},null,2)+'\n');throw error;}finally{await browser.close();}
