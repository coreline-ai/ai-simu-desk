import {launchBrowser,qaOrigin} from './browser.mjs';import {writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const out='product/evidence/personal-final',browser=await launchBrowser(),page=await browser.newPage({viewport:{width:1280,height:900}}),rows=[];
try{
 await page.goto(qaOrigin+'/demos/activities/personal/?demo=glasses');await page.waitForFunction(()=>!!window.__personalStudio?.engine);const cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.enable');
 await page.evaluate(()=>{window.__retentionProof=[];});
 for(let i=0;i<=16;i++){
  if(i){await page.evaluate(()=>window.__retentionProof.push({view:new WeakRef(window.__personalStudio.view),actor:new WeakRef(window.__personalStudio.engine.desks.jun.actor),scheduler:new WeakRef(window.__personalStudio.engine)}));await page.click(i%2?'#baseline':'#personal');await page.waitForFunction(v=>window.__personalStudio?.diagnostics()?.teamActivities?.version===v,i%2?11:12);await page.click('#cancel');}
  await page.waitForTimeout(250);await cdp.send('HeapProfiler.collectGarbage');await page.waitForTimeout(100);await cdp.send('HeapProfiler.collectGarbage');
  const row={reloads:i,heap:(await cdp.send('Runtime.getHeapUsage')).usedSize,...await page.evaluate(()=>({oldViews:window.__retentionProof.filter(r=>r.view.deref()).length,oldActors:window.__retentionProof.filter(r=>r.actor.deref()).length,oldSchedulers:window.__retentionProof.filter(r=>r.scheduler.deref()).length,canvas:document.querySelectorAll('canvas').length}))};rows.push(row);assert.equal(row.canvas,1);console.log(JSON.stringify(row));
 }
 await writeFile(out+'/memory-retention.json',JSON.stringify({at:new Date().toISOString(),kind:'rapid identical-space rebuilds, double forced GC and WeakRef retention of disposed scene objects; not total GPU memory',rows},null,2));
 assert(rows.at(-1).oldActors===0,'disposed actor graphs must be collected');assert(rows.at(-1).oldSchedulers===0,'disposed schedulers must be collected');assert(rows.at(-1).oldViews===0,'disposed views must be collected');
}finally{await browser.close();}
