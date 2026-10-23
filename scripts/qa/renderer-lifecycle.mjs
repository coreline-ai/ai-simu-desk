// Bounded public-page regression: actual quality views, shared renderer LUT,
// full-GC WeakRefs and survivor pixel readback. No product DB or user page.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {launchBrowser,qaOrigin} from './browser.mjs';
const out=resolve('product/evidence/motion-precision/lut-fix');await mkdir(out,{recursive:true});
const sources=['pilot-3d/sample/renderer-resources.mjs','pilot-3d/sample/quality-view.mjs','pilot-3d/room-quality/lighting.mjs','pilot-3d/sample/lighting.mjs','pilot-3d/sample/app.mjs','pilot-3d/src/scene.mjs','scripts/qa/renderer-fixture.mjs','scripts/qa/renderer-lifecycle.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(sources.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
const report={startedAt:new Date().toISOString(),origin:qaOrigin,kind:'actual createQualityView two-view survivor, early-loading cancellation, 30 rebuilds, double full GC; no GPU VRAM assertion',guardMiB:8,sourceBefore:await hashes(),rows:[],checks:[],errors:[]};
const browser=await launchBrowser(),context=await browser.newContext({viewport:{width:1280,height:960},deviceScaleFactor:1}),page=await context.newPage();
const save=()=>writeFile(out+'/lifecycle.json',JSON.stringify(report,null,2)+'\n');
function visiblePixels(value,label){assert(value&&!value.lost,label+' live WebGL context');assert.equal(value.error,0,label+' WebGL readback error');assert(value.opaque>=5,label+' contains visible rendered geometry');assert(value.range>10&&value.checksum>0,label+' has nonuniform meaningful pixels');}
function nearFrame(frame,label){assert(frame&&!frame.lost&&frame.compared,label+' full paused framebuffer comparison');assert.equal(frame.error,0,label+' readback error');assert(frame.meanAbsoluteDifference<=1,label+' restored frame mean difference <=1 channel value');assert(frame.changedPixelFraction<=.015,label+' restored changed pixel fraction <=1.5%');}
function boundedResources(before,after,label){for(const kind of ['geometry','material','texture','instancedMesh','skeleton']){assert.equal(after[kind].objects,before[kind].objects,label+' '+kind+' CPU objects preserved');assert.equal(after[kind].disposeListeners,before[kind].disposeListeners,label+' '+kind+' dispose listeners bounded');assert.equal(after[kind].maxDisposeListeners,before[kind].maxDisposeListeners,label+' '+kind+' maximum listeners bounded');}}
try{
 page.on('pageerror',error=>report.errors.push(error.message));
 const response=await page.goto(qaOrigin+'/qa/renderer-fixture/');assert(response?.ok(),'public lifecycle fixture HTTP');
 await page.waitForFunction(()=>!!window.__rendererFixture?.summary().ready,null,{timeout:60000});
 const bundle=await page.request.get(qaOrigin+'/qa/renderer-fixture/app.js');assert(bundle.ok(),'fixture bundle HTTP');report.bundleHash=createHash('sha256').update(await bundle.body()).digest('hex');
 const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.enable');
 async function gc(){await page.waitForTimeout(250);await cdp.send('HeapProfiler.collectGarbage');await page.waitForTimeout(100);await cdp.send('HeapProfiler.collectGarbage');await page.waitForTimeout(100);}
 async function sample(stage){await gc();const heap=await cdp.send('Runtime.getHeapUsage'),state=await page.evaluate(()=>window.__rendererFixture.summary());const row={stage,heapMiB:heap.usedSize/1024**2,...heap,...state};report.rows.push(row);await save();return row;}
 async function mount(id){assert.equal(await page.evaluate(id=>window.__rendererFixture.mount(id),id),true,id+' loaded real quality view');await page.waitForFunction(id=>window.__rendererFixture.summary().views[id]?.ready===true,id,{timeout:60000});}
 const both=await page.evaluate(()=>Promise.all(['left','right'].map(id=>window.__rendererFixture.mount(id))));assert.deepEqual(both,[true,true]);
 const leftBefore=await page.evaluate(()=>window.__rendererFixture.pixels('left')),rightBefore=await page.evaluate(()=>window.__rendererFixture.pixels('right'));visiblePixels(leftBefore,'initial left');visiblePixels(rightBefore,'initial right');
 const concurrent=await sample('two-live-views');assert.equal(concurrent.canvas,2);assert.equal(concurrent.lutTextures,1,'observe actual shared Three LUT singleton');assert.equal(concurrent.lutListeners,2,'two active renderer texture listeners');report.checks.push({name:'two concurrent loaded views',passed:true,leftBefore,rightBefore});
 report.resourceBaseline=await page.evaluate(()=>({left:window.__rendererFixture.resources('left'),right:window.__rendererFixture.resources('right')}));
 assert(report.resourceBaseline.right.geometry.disposeListeners>0&&report.resourceBaseline.right.material.disposeListeners>0&&report.resourceBaseline.right.texture.disposeListeners>0,'observe actual live resource listeners');
 await page.evaluate(()=>['left','right'].map(id=>window.__rendererFixture.pixelFrame(id,true)));report.restores=[];
 await page.screenshot({path:out+'/concurrent.png'});
 for(let i=1;i<=3;i++){
  assert.equal(await page.evaluate(()=>window.__rendererFixture.lose('right')),true);
  await page.waitForFunction(()=>window.__rendererFixture.summary().views.right?.status==='lost',null,{timeout:15000});
  visiblePixels(await page.evaluate(()=>window.__rendererFixture.pixels('left')),'survivor during peer context loss '+i);
  assert.equal(await page.evaluate(()=>window.__rendererFixture.restore('right')),true);
  await page.waitForFunction(()=>window.__rendererFixture.summary().views.right?.status==='ready',null,{timeout:15000});
  visiblePixels(await page.evaluate(()=>window.__rendererFixture.pixels('right')),'restored right '+i);
  visiblePixels(await page.evaluate(()=>window.__rendererFixture.pixels('left')),'survivor after peer restore '+i);
  const full=await page.evaluate(()=>({left:window.__rendererFixture.pixelFrame('left'),right:window.__rendererFixture.pixelFrame('right'),resourcesLeft:window.__rendererFixture.resources('left'),resourcesRight:window.__rendererFixture.resources('right')}));report.restores.push({cycle:i,...full});nearFrame(full.left,'left restore '+i);nearFrame(full.right,'right restore '+i);boundedResources(report.resourceBaseline.left,full.resourcesLeft,'left restore '+i);boundedResources(report.resourceBaseline.right,full.resourcesRight,'right restore '+i);
  const restored=await sample('context-restore-'+i);assert.equal(restored.canvas,2);assert.equal(restored.lutListeners,2,'no listener from a lost context epoch remains');assert.equal(restored.errors.length,0);
 }
 report.checks.push({name:'three context loss/restore epochs keep two live listeners and meaningful pixels',passed:true});
 assert.equal(await page.evaluate(()=>window.__rendererFixture.dispose('right')),true);
 const survivor=await page.evaluate(()=>window.__rendererFixture.pixels('left'));visiblePixels(survivor,'left after right disposal');
 nearFrame(await page.evaluate(()=>window.__rendererFixture.pixelFrame('left')),'left after peer disposal');
 let row=await sample('survivor-after-peer-disposal');assert.equal(row.canvas,1);assert.equal(row.lutListeners,1);assert.equal(row.oldViews,0);assert.equal(row.oldContexts,0);report.checks.push({name:'shared LUT disposal leaves survivor drawable and old context collectible',passed:true,survivor});
 for(let i=1;i<=3;i++){
  assert.equal(await page.evaluate(()=>window.__rendererFixture.throwLighting('right')),true,'PMREM post-render construction failure rolls back canvas');
  visiblePixels(await page.evaluate(()=>window.__rendererFixture.pixels('left')),'survivor after PMREM rollback '+i);nearFrame(await page.evaluate(()=>window.__rendererFixture.pixelFrame('left')),'left after PMREM rollback '+i);
  row=await sample('pmrem-throw-rollback-'+i);assert.equal(row.canvas,1);assert.equal(row.lutListeners,1);assert.equal(row.rollbackContexts,0,'failed constructor actual WebGL context collected');assert.equal(row.oldContexts,0);assert.equal(row.errors.length,0);
 }
 report.checks.push({name:'three PMREM post-render exceptions release constructor context, LUT listener and canvas',passed:true});
 for(let i=1;i<=3;i++){
  assert.equal(await page.evaluate(()=>window.__rendererFixture.cancelLoading('right')),true,'dispose before model load resolves');
  visiblePixels(await page.evaluate(()=>window.__rendererFixture.pixels('left')),'survivor after early cancel '+i);
  row=await sample('early-loading-cancel-'+i);assert.equal(row.canvas,1);assert.equal(row.lutListeners,1,'no early PMREM renderer listener remains');assert.equal(row.oldViews,0);assert.equal(row.oldContexts,0);
 }
 assert(row.early.length===3&&row.early.every(x=>x.readyResult===false&&x.canvas===0));report.checks.push({name:'three early-loading cancellations settle false and release their contexts',passed:true});
 const baseline=row.usedSize;
 for(let i=1;i<=30;i++){
  await mount('right');const active=await page.evaluate(()=>window.__rendererFixture.summary());assert.equal(active.canvas,2);assert.equal(active.lutListeners,2,'shared LUT listeners remain bounded while both renderers live');
  if(i===1||i===30)visiblePixels(await page.evaluate(()=>window.__rendererFixture.pixels('right')),'rebuilt right '+i);
  assert.equal(await page.evaluate(()=>window.__rendererFixture.dispose('right')),true);visiblePixels(await page.evaluate(()=>window.__rendererFixture.pixels('left')),'survivor rebuild '+i);
  row=await sample('rebuild-'+i);assert.equal(row.canvas,1);assert.equal(row.lutListeners,1);assert.equal(row.oldViews,0,'disposed view WeakRefs collected');assert.equal(row.oldContexts,0,'disposed actual WebGL context WeakRefs collected');assert.equal(row.errors.length,0);
  console.log(JSON.stringify({rebuild:i,heapMiB:row.heapMiB,lutListeners:row.lutListeners,oldViews:row.oldViews,oldContexts:row.oldContexts}));
 }
 const delta=row.usedSize-baseline;report.heap={baselineMiB:baseline/1024**2,endMiB:row.heapMiB,deltaMiB:delta/1024**2,over8MiB:delta>8*1024**2};assert(delta<=8*1024**2,'original 8MiB guard after 30 renderer rebuilds');report.checks.push({name:'30 rebuilds release all old contexts and retain one live LUT listener',passed:true});
 await page.screenshot({path:out+'/survivor-after-30.png'});
 assert.equal(await page.evaluate(()=>window.__rendererFixture.dispose('left')),true);row=await sample('all-disposed');assert.equal(row.canvas,0);assert.equal(row.lutListeners,0);assert.equal(row.oldViews,0);assert.equal(row.oldContexts,0);assert.equal(row.rollbackContexts,0);assert.equal(row.errors.length,0);report.checks.push({name:'all views disposed leaves zero contexts, views, canvases, LUT listeners',passed:true});
 report.sourceAfter=await hashes();report.sourceUnchanged=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter);assert(report.sourceUnchanged,'source remains fixed throughout run');assert.equal(report.errors.length,0);report.completedAt=new Date().toISOString();report.passed=true;await save();console.log(JSON.stringify({passed:true,checks:report.checks.length,heap:report.heap,out}));
}catch(error){report.passed=false;report.failure=error.stack;report.completedAt=new Date().toISOString();report.sourceAfter=await hashes().catch(()=>null);report.sourceUnchanged=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter);await save();throw error;}finally{await context.close();await browser.close();}
