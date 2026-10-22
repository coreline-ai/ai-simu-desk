import {launchBrowser,qaOrigin} from './browser.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const b=await launchBrowser(),p=await b.newPage({viewport:{width:1280,height:900}}),errors=[],rows=[];
p.on('pageerror',e=>errors.push(e.message));
const get=async()=>JSON.parse(await p.locator('#metrics').textContent()),version=v=>p.waitForFunction(v=>JSON.parse(document.querySelector('#metrics').textContent||'{}').teamActivities?.version===v,v);
function same(a,b){assert.equal(a.focus,b.focus);assert(Math.abs(a.zoom-b.zoom)<1e-7);for(const key of['position','target'])a[key].forEach((v,i)=>assert(Math.abs(v-b[key][i])<1e-7,key+' camera coordinate'));}
try{
 await p.goto(qaOrigin+'/demos/activities/ensemble/');await version(10);await p.click('#meeting-close');await p.waitForFunction(()=>JSON.parse(document.querySelector('#metrics').textContent||'{}').camera?.zoom===2.5);const camera=(await get()).camera;rows.push({version:10,camera});
 await p.click('#final');await version(9);same(camera,(await get()).camera);rows.push({version:9,camera:(await get()).camera});await p.click('#ensemble');await version(10);same(camera,(await get()).camera);
 await p.locator('.diagnostics summary').click();await p.click('#recover');await version(9);same(camera,(await get()).camera);for(const id of['coffee-station','coffee-tour','group-meeting','three-walk','sound'])assert(await p.locator('#'+id).isDisabled());assert.equal(await p.locator('canvas').count(),1);
 await p.goto(qaOrigin+'/demos/activities/final/');await version(9);await p.click('#meeting-close');await p.waitForFunction(()=>JSON.parse(document.querySelector('#metrics').textContent||'{}').camera?.zoom===2.5);await p.click('#grounded');await version(8);const smaller=await get();assert.equal(smaller.modelVersion,6);assert.equal(smaller.camera.zoom,1);rows.push({version:8,camera:smaller.camera});assert.equal(errors.length,0);
 await mkdir('product/evidence/ensemble-activities',{recursive:true});await writeFile('product/evidence/ensemble-activities/camera-comparison.json',JSON.stringify({passed:true,checks:['room8/activity10 and room7/activity9 keep identical camera','room8 binding fallback preserves modern camera','unsupported fallback controls disabled','room6 uses its own framing','one canvas'],rows,errors},null,2));console.log(JSON.stringify({passed:true,rows,errors}));
}finally{await b.close();}
