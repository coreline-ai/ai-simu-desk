import {launchBrowser,qaOrigin} from './browser.mjs';
import {mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';
const out=process.env.STUDIO_QA_OUT??'product/evidence/personal-final',temp=await mkdtemp(join(tmpdir(),'studio-glasses-video-')),browser=await launchBrowser(),context=await browser.newContext({viewport:{width:1280,height:1000},deviceScaleFactor:1,recordVideo:{dir:temp,size:{width:960,height:750}}}),page=await context.newPage(),errors=[],checks=[],clickAttempts=[];await mkdir(out,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const row=()=>page.evaluate(()=>window.__personalStudio.engine.personalMotion.glasses.diagnostics()),waitIdle=()=>page.waitForFunction(()=>{const g=window.__personalStudio.engine?.personalMotion?.glasses;return g&&!g.active&&g.eligible();});
// Eligibility may change during native pointer scrolling/actionability checks.
// Retry only an observed native click that the page explicitly rejected; an
// accepted gesture must still complete through the original timeout below.
async function clickGlasses(label){
 for(let attempt=1;attempt<=3;attempt++){
  await waitIdle();const before=await row(),eventCount=await page.evaluate(()=>window.__glassesQaClicks.length);
  await page.click('#glasses');
  const after=await page.evaluate(from=>{const s=window.__personalStudio.engine,g=s.personalMotion.glasses;return{sample:g.diagnostics(),active:g.active,eligible:g.eligible(),action:s.state('jun').action,notice:document.querySelector('#notice').textContent,events:window.__glassesQaClicks.slice(from)};},eventCount);
  const accepted=after.active||after.sample.done>before.done;
  const rejected=!accepted&&after.events.length>0&&after.sample.done===before.done&&after.notice==='진행 중인 활동을 정리한 뒤 다시 시작해 주세요.';
  clickAttempts.push({label,attempt,before,after,accepted,rejected,...(rejected?{cause:after.events.at(-1).eligible?'native command explicitly rejected':'eligibility changed before native click'}:{})});
  if(accepted)return before;
  if(!rejected)throw Error('Glasses native click was not acknowledged: '+JSON.stringify(clickAttempts.at(-1)));
 }
 throw Error('Glasses command explicitly rejected after 3 native attempts: '+label);
}
try{
 await page.goto(qaOrigin+'/demos/activities/personal/?actor=jun');await page.waitForFunction(()=>window.__personalStudio.engine?.personalMotion.glasses.available);await page.selectOption('#speed','1');await page.click('#close');
 await page.evaluate(()=>{window.__glassesQaClicks=[];document.addEventListener('click',e=>{if(!e.target.closest?.('#glasses'))return;const s=window.__personalStudio.engine,g=s.personalMotion.glasses;window.__glassesQaClicks.push({time:s.time,eligible:g.eligible(),action:s.state('jun').action,stage:g.stage,done:g.done});},true);});
 // A genuine orthographic close view of the current actor, rather than a raster overlay.
 await page.evaluate(()=>{const v=window.__personalStudio.view,c=v.cameraState();c.zoom=1.7;c.target[1]=1.08;c.position=[c.target[0]+2.8,2.0,c.target[2]+4.8];v.restoreCamera(c);});
 await clickGlasses('first contact');await page.waitForFunction(()=>window.__personalStudio.engine.personalMotion.glasses.stage==='approach');await page.locator('.studio').screenshot({path:out+'/glasses-approach.png'});
 await page.waitForFunction(()=>window.__personalStudio.engine.personalMotion.glasses.stage==='adjust');await page.click('#pause');const frozen=await row();assert(frozen.padError<1e-5);await page.locator('.studio').screenshot({path:out+'/glasses-contact.png'});await page.waitForTimeout(700);assert.deepEqual(await row(),frozen);checks.push({kind:'actual rim contact and paused index',sample:frozen});
 await page.click('#pause');await page.waitForFunction(()=>window.__personalStudio.engine.personalMotion.glasses.stage==='depart');await page.locator('.studio').screenshot({path:out+'/glasses-depart.png'});await waitIdle();
 for(const rate of ['1','1.5','2','3']){await page.selectOption('#speed',rate);const before=await clickGlasses('rate '+rate);await page.waitForFunction(n=>window.__personalStudio.engine.personalMotion.glasses.done>n,before.done);checks.push({kind:'rate',rate,done:(await row()).done});}
 await page.selectOption('#speed','1');await clickGlasses('real work preemption');await page.waitForFunction(()=>window.__personalStudio.engine.personalMotion.glasses.stage==='adjust');await page.click('#work');await page.waitForFunction(()=>!window.__personalStudio.engine.personalMotion.glasses.active);assert.equal((await row()).reason,'higher-priority activity');await page.click('#done');await page.click('#cancel');await waitIdle();checks.push({kind:'real work preemption'});
 await clickGlasses('manual cancel');await page.waitForFunction(()=>window.__personalStudio.engine.personalMotion.glasses.stage==='adjust');await page.click('#cancel');await waitIdle();checks.push({kind:'manual cancel retreats and returns'});
 await page.emulateMedia({reducedMotion:'reduce'});const time=await page.evaluate(()=>window.__personalStudio.diagnostics().animationTime);await clickGlasses('OS reduced motion');await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>window.__personalStudio.diagnostics().animationTime),time);assert(await page.locator('#pause').isDisabled());await page.emulateMedia({reducedMotion:'no-preference'});await page.click('#cancel');await waitIdle();checks.push({kind:'OS reduced motion freezes optional gesture'});
 await page.click('#baseline');await page.waitForFunction(()=>window.__personalStudio.engine&&!window.__personalStudio.engine.personalMotion);assert(await page.locator('#glasses').isDisabled());await page.click('#personal');await page.waitForFunction(()=>!!window.__personalStudio.engine?.personalMotion);await page.click('#cancel');await page.waitForFunction(()=>window.__personalStudio.engine.ids.every(id=>window.__personalStudio.engine.idle(id)));checks.push({kind:'v11 remains opt-out and scene reload disposes gesture'});
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.locator('canvas').count(),1);}await page.setViewportSize({width:390,height:900});await page.screenshot({path:out+'/mobile-390.png',fullPage:true});checks.push({kind:'320/390/768/1440 viewport, single canvas; not a physical device'});
 assert.deepEqual(errors,[]);await writeFile(out+'/browser.json',JSON.stringify({passed:true,at:new Date().toISOString(),origin:qaOrigin,checks,clickAttempts,errors},null,2));console.log('PASS final glasses UI, four speeds, contact/pause, work/cancel, reduced motion, v11, mobile layouts');
}catch(error){await page.screenshot({path:out+'/browser-failure.png',fullPage:true}).catch(()=>{});await writeFile(out+'/browser-failure.json',JSON.stringify({error:error.stack,checks,clickAttempts,errors,sample:await row().catch(()=>null)},null,2));throw error;}finally{const video=page.video();await context.close();if(video)await video.saveAs(out+'/glasses-inspection.webm');await browser.close();}
