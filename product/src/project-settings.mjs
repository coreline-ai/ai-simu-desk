const keys=['goal','audience','technology','exclusions'];
const $=id=>document.getElementById(id);

export function createProjectSettings({request,onApply,onError}){
 let context=null,project=null,epoch=0,loadSeq=0,saveSeq=0,loading=false,saving=false;
 const notice=text=>{$('project-notice').textContent=text;};
 function lock(){
  const owner=context?.role==='owner';
  for(const key of keys)$('project-'+key).disabled=!owner||loading||saving;
  $('save-project').hidden=!owner;$('save-project').disabled=!owner||!project||loading||saving;
  $('reload-project').disabled=!context||loading||saving;
 }
 function show(next){
  if(!next||!Number.isSafeInteger(next.version)||keys.some(key=>typeof next[key]!=='string'))throw new Error('프로젝트 설정 응답을 확인해 주세요.');
  if(project&&next.version<project.version)return;
  project=next;for(const key of keys)$('project-'+key).value=next[key];
 }
 async function load(){
  if(!context||loading||saving)return;
  const stamp=epoch,seq=++loadSeq,id=context.id;loading=true;lock();
  try{const next=await request(`/api/workspaces/${id}/project`);if(stamp!==epoch||seq!==loadSeq)return;show(next);notice('저장된 프로젝트 조건을 불러왔어요.');}
  catch(error){if(stamp===epoch&&seq===loadSeq){notice(error.message);await onError(error);}}
  finally{if(stamp===epoch&&seq===loadSeq){loading=false;lock();}}
 }
 $('reload-project').addEventListener('click',()=>void load());
 $('project-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!project||context?.role!=='owner'||saving||loading)return;
  const stamp=epoch,seq=++saveSeq,id=context.id,body={version:project.version};
  for(const key of keys)body[key]=$('project-'+key).value;
  saving=true;++loadSeq;lock();
  try{const next=await request(`/api/workspaces/${id}/project`,body);if(stamp!==epoch||seq!==saveSeq)return;show(next);notice('프로젝트 조건을 저장했어요. 새 업무에 넣어 적용할 수 있어요.');}
  catch(error){if(stamp===epoch&&seq===saveSeq){notice(error.message);if(error.status!==409)await onError(error);}}
  finally{if(stamp===epoch&&seq===saveSeq){saving=false;lock();}}
 });
 $('apply-project').addEventListener('click',()=>{if(project&&!loading&&!saving)onApply(project);});
 return{
  reset(){epoch++;loadSeq++;saveSeq++;context=null;project=null;loading=saving=false;notice('');for(const key of keys)$('project-'+key).value='';lock();},
  render(next){const changed=context?.id!==next.id;context={...next};if(changed){epoch++;loadSeq++;saveSeq++;project=null;loading=saving=false;for(const key of keys)$('project-'+key).value='';notice('프로젝트 조건을 불러오는 중…');void load();}lock();},
 };
}
