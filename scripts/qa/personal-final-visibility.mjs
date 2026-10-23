import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {qaOrigin} from './browser.mjs';

// Playwright's default focus override makes even real inactive tabs report visible.
// Connect to an isolated ordinary Chrome default context with documented noDefaults.
const require=createRequire(import.meta.url),{chromium}=require(process.env.STUDIO_PLAYWRIGHT_PATH??'/Users/iriver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=process.env.STUDIO_QA_OUT??'product/evidence/personal-final',dir=await mkdtemp(join(tmpdir(),'studio-native-visibility-')),errors=[],checks=[],started=Date.now();await mkdir(out,{recursive:true});
const child=spawn(process.env.STUDIO_CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--user-data-dir='+dir,'--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--no-first-run','--no-default-browser-check','about:blank'],{stdio:'ignore'});
let browser,page;
try{
 let port;for(let i=0;i<100&&!port;i++){await new Promise(r=>setTimeout(r,100));try{port=Number((await readFile(join(dir,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{}}assert(port,'isolated Chrome endpoint');
 browser=await chromium.connectOverCDP('http://127.0.0.1:'+port,{noDefaults:true});const context=browser.contexts()[0];page=context.pages()[0];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(qaOrigin+'/demos/activities/personal/?actor=jun');await page.waitForFunction(()=>!!window.__personalStudio?.engine);
 await page.evaluate(()=>{window.__visibilityProof=[];document.addEventListener('visibilitychange',()=>window.__visibilityProof.push({at:performance.now(),hidden:document.hidden,time:window.__personalStudio.diagnostics().animationTime}));});
 const snapshot=()=>page.evaluate(()=>({hidden:document.hidden,time:window.__personalStudio.diagnostics().animationTime,events:window.__visibilityProof,canvas:document.querySelectorAll('canvas').length}));
 const freeze=async(label,hide,show)=>{
  await hide();await page.waitForFunction(()=>document.hidden,null,{polling:100,timeout:8000});const before=await snapshot();await new Promise(r=>setTimeout(r,5000));const after=await snapshot();assert.equal(before.time,after.time,label+' hidden time');
  await show();await page.waitForFunction(()=>!document.hidden,null,{polling:100,timeout:8000});const returned=await snapshot();assert(returned.time-after.time<.35,'no hidden-time catch-up');await page.waitForTimeout(600);const resumed=await snapshot();assert(resumed.time>returned.time);assert.equal(resumed.canvas,1);checks.push({label,before,after,returned,resumed});console.log('PASS actual '+label);
 };
 const blank=await context.newPage();await blank.goto('about:blank');await page.bringToFront();
 await freeze('inactive tab',()=>blank.bringToFront(),()=>page.bringToFront());
 const cdp=await context.newCDPSession(page),win=await cdp.send('Browser.getWindowForTarget');
 await freeze('minimized window',()=>cdp.send('Browser.setWindowBounds',{windowId:win.windowId,bounds:{windowState:'minimized'}}),async()=>{await cdp.send('Browser.setWindowBounds',{windowId:win.windowId,bounds:{windowState:'normal'}});await page.bringToFront();});
 await page.click('#pause');await freeze('paused during inactive tab',()=>blank.bringToFront(),async()=>{await page.bringToFront();await page.click('#pause');});
 await page.selectOption('#speed','3');await page.click('#close');const final=await page.evaluate(()=>window.__personalStudio.diagnostics());assert.equal(final.motionSpeed,3);assert.equal(final.camera.focus,'jun');assert.equal(await page.locator('canvas').count(),1);assert.deepEqual(final.teamActivities.claims,{});assert.deepEqual(errors,[]);checks.push({label:'restored input',speed:final.motionSpeed,focus:final.camera.focus,canvas:1});
 await page.screenshot({path:out+'/visibility-restored.png',fullPage:true});await writeFile(out+'/visibility.json',JSON.stringify({passed:true,kind:'actual-headful-Chrome-default-context; native visibilitychange, no fake hidden overrides',at:new Date().toISOString(),origin:qaOrigin,wallSeconds:(Date.now()-started)/1000,checks,errors},null,2));
}catch(error){await writeFile(out+'/visibility-failure.json',JSON.stringify({error:error.stack,checks,errors,final:await page?.evaluate(()=>({hidden:document.hidden,d:window.__personalStudio?.diagnostics()})).catch(()=>null)},null,2));throw error;}finally{await browser?.close();child.kill('SIGTERM');await new Promise(r=>setTimeout(r,500));await rm(dir,{recursive:true,force:true});}
