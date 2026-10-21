import{launchBrowser,qaOrigin as origin}from'./browser.mjs';import assert from'node:assert/strict';import{mkdir,writeFile}from'node:fs/promises';
const browser=await launchBrowser(),contexts=[],errors=[];
try{
 const owner=await browser.newContext({baseURL:origin,reducedMotion:'reduce'});contexts.push(owner);
 const signup=await owner.request.post('/api/auth/sign-up/email',{headers:{origin},data:{name:'QA Owner',email:`owner-${Date.now()}@qa.test`,password:'isolated-qa-password-12345'}});assert(signup.ok());
 const created=await owner.request.post('/api/workspaces',{headers:{origin,'idempotency-key':crypto.randomUUID()},data:{name:'다섯 게스트의 안정화 공간'}});assert(created.ok());const space=await created.json();
 for(let n=0;n<5;n++){
  const context=await browser.newContext({baseURL:origin,reducedMotion:'reduce',viewport:{width:n?390:1280,height:900}});contexts.push(context);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('#guest-login').click();await page.locator('#workspace-content').waitFor({state:'visible'});
  assert(await page.locator('#create-space-details').isHidden());
  const snap=await(await owner.request.get(`/api/workspaces/${space.id}/snapshot`)).json();const invite=await(await owner.request.post(`/api/workspaces/${space.id}/invites`,{headers:{origin},data:{role:'member',version:snap.workspace.revision}})).json();
  await page.locator('#join-space-details summary').click();await page.locator('#join-code').fill(invite.code);await page.locator('#join-workspace button').click();await page.waitForFunction(()=>document.querySelector('#workspace-heading').textContent==='다섯 게스트의 안정화 공간');
  assert.equal(await page.locator('#workspace-role').textContent(),'업무 참여');assert(await page.locator('#task-form').isVisible());
 }
 const extra=await browser.newContext({baseURL:origin});contexts.push(extra);assert.equal((await extra.request.post('/api/auth/sign-in/guest',{headers:{origin},data:{}})).status(),429);
 assert.equal(errors.length,0);await mkdir('product/evidence/stabilization-implementation',{recursive:true});await writeFile('product/evidence/stabilization-implementation/phase2-browser.json',JSON.stringify({passed:true,independentGuests:5,regularOwner:true,guestCreationHidden:true,guestParticipation:true,sixthGuestStatus:429,viewports:[390,1280],errors},null,2));console.log('Five guest browser participation: passed');
}finally{for(const c of contexts){await c.request.post('/api/auth/sign-out',{headers:{origin},data:{}}).catch(()=>{});await c.close();}await browser.close();}
