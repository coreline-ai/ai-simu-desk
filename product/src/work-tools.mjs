import {TEAM,TEAM_NAMES} from "../../server/domain/team.ts";
import {compareLines} from "./comparison.mjs";
import {TASK_TEMPLATES} from '../../server/domain/project.ts';
import {projectPrompt} from './project.mjs';
const $=id=>document.getElementById(id);
export function createWorkTools({request,onTemplate,onConditions,onOpen,onError}) {
 let context=null,project=null,ticket=0,searchTicket=0,nextPage=null,currentRun=null;
 for(const person of TEAM.filter(p=>!['nara','jun'].includes(p.id))){const option=document.createElement('option');option.value=person.id;option.textContent=person.name;$('search-agent').append(option);}
 const template=$('task-template');
 for(const item of TASK_TEMPLATES){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;template.append(option);}
 $('apply-template').addEventListener('click',()=>{const item=TASK_TEMPLATES.find(t=>t.id===template.value);if(item)onTemplate(item);});
 function notice(text){$('project-notice').textContent=text;}
 function showProject(data){project=data;for(const key of ['goal','audience','technology','exclusions'])$('project-'+key).value=data[key];}
 async function loadProject(){if(!context)return;const stamp=ticket,id=context.id;try{const next=await request(`/api/workspaces/${id}/project`);if(stamp!==ticket)return;showProject(next);notice('저장된 프로젝트 조건을 불러왔어요.');}catch(e){if(stamp===ticket)onError(e);}}
 $('reload-project').addEventListener('click',()=>void loadProject());
 $('project-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!project||context?.role!=='owner')return;const stamp=ticket;
  $('save-project').disabled=true;
  const body={version:project.version};for(const key of ['goal','audience','technology','exclusions'])body[key]=$('project-'+key).value;
  try{const next=await request(`/api/workspaces/${context.id}/project`,body);if(stamp===ticket){showProject(next);notice('프로젝트 조건을 저장했어요. 새 업무에 넣어 적용할 수 있어요.');}}
  catch(error){if(stamp===ticket){notice(error.message);if(error.status!==409)onError(error);}}
  finally{if(stamp===ticket)$('save-project').disabled=context.role!=='owner';}
 });
 $('apply-project').addEventListener('click',()=>{if(project)onConditions(projectPrompt(project));});
 async function search(more=false){
  if(!context)return;const stamp=ticket,searchStamp=++searchTicket,id=context.id;
  const params=new URLSearchParams({q:$('search-query').value,status:$('search-status').value,agent:$('search-agent').value});
  if(more&&nextPage)params.set('before',nextPage);
  $('search-submit').disabled=true;$('search-more').disabled=true;
  try{const result=await request(`/api/workspaces/${id}/runs?${params}`);if(stamp!==ticket||searchStamp!==searchTicket)return;
   if(!more)$('search-results').replaceChildren();
   for(const run of result.items){const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=`${run.team?'5명 협업':TEAM_NAMES[run.agentId]} · ${run.prompt.slice(0,90)}`;button.addEventListener('click',()=>void onOpen(run.id));li.append(button);$('search-results').append(li);}
   nextPage=result.next;$('search-more').hidden=!nextPage;$('search-notice').textContent=result.items.length?'검색 결과를 선택하면 저장된 업무를 열어요.':'검색 결과가 없어요.';
  }catch(e){if(stamp===ticket)onError(e);}finally{if(stamp===ticket){$('search-submit').disabled=false;$('search-more').disabled=false;}}
 }
 $('search-form').addEventListener('submit',e=>{e.preventDefault();void search();});
 $('search-more').addEventListener('click',()=>void search(true));
 for(const id of ['search-query','search-status','search-agent'])$(id).addEventListener('input',()=>{searchTicket++;nextPage=null;$('search-more').hidden=true;});
 $('compare-result').addEventListener('click',async()=>{
  if(!context||!currentRun?.source)return;const stamp=ticket,id=currentRun.id;
  try{const data=await request(`/api/workspaces/${context.id}/runs/${id}/compare`);if(stamp!==ticket||id!==currentRun?.id)return;
   const lines=compareLines(data.before.output,data.after.output);
   for(const [side,key] of [['before','left'],['after','right']]){
    const nodes=lines[key].map(line=>{const el=document.createElement('span');el.textContent=(line.text||' ')+'\n';if(line.changed)el.className=side==='before'?'removed-line':'added-line';return el;});$('compare-'+side).replaceChildren(...nodes);
   }
   $('compare-summary').textContent=`원본 스냅샷 → ${data.mode==='handoff'?'인계 결과':'수정 결과'} · 삭제/변경 ${lines.removed}줄 · 추가/변경 ${lines.added}줄${data.before.truncated?' · 원본 앞 4,000자 기준':''}${lines.truncated?' · 각 400줄까지 비교':''}`;
   $('comparison').hidden=false;
  }catch(e){if(stamp===ticket)onError(e);}
 });
 return {
  renderRun(run){if(currentRun?.id!==run?.id)$('comparison').hidden=true;currentRun=run;$('compare-result').hidden=!run?.source;},
  reset(){ticket++;searchTicket++;context=null;project=null;currentRun=null;nextPage=null;$('search-results').replaceChildren();$('search-notice').textContent='';$('search-more').hidden=true;$('comparison').hidden=true;for(const id of ['compare-before','compare-after','compare-summary','search-query']){$(id).textContent='';if(id==='search-query')$(id).value='';}$('search-status').value='';$('search-agent').value='';notice('');for(const key of ['goal','audience','technology','exclusions'])$('project-'+key).value='';},
  render(snapshot){if(!snapshot)return;const id=snapshot.workspace.id,changed=context?.id!==id;context={id,role:snapshot.role};
   for(const key of ['goal','audience','technology','exclusions'])$('project-'+key).disabled=context.role!=='owner';
   $('save-project').hidden=context.role!=='owner';$('save-project').disabled=context.role!=='owner';
   if(changed){ticket++;project=null;void loadProject();}
  },
 };
}
