const $=id=>document.getElementById(id);
const kinds={approval_requested:'승인 요청',completed:'업무 완료',failed:'실행 실패',comment:'새 댓글'};
export function createDiscussion({request,onOpen,onError}) {
 let context=null,runId=null,ticket=0,runTicket=0,next=null,draftKey=null,busy=false,commentSignature='',inboxSignature='',commentCache=new Map(),olderLoaded=false;
 function renderInbox(data){const signature=JSON.stringify(data);if(signature===inboxSignature)return;inboxSignature=signature;
  $('inbox-count').textContent=`읽지 않음 ${data.unread}개`;$('inbox-empty').hidden=!!data.items.length;
  $('inbox-list').replaceChildren(...data.items.map(item=>{const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=`${item.readAt?'':'● '}${kinds[item.kind]} · ${item.prompt.slice(0,65)}`;button.addEventListener('click',()=>void onOpen(item.runId));li.append(button);return li;}));
 }
 function renderComments(data,more=false){const signature=JSON.stringify(data);if(!more&&signature===commentSignature)return;commentSignature=signature;if(more)olderLoaded=true;if(more||!olderLoaded)next=data.next;$('comments-more').hidden=!next;$('comments-empty').hidden=!!data.items.length||more;
  if(!more&&!olderLoaded)commentCache.clear();for(const item of data.items)commentCache.set(item.id,item);
  const all=[...commentCache.values()].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)||a.id.localeCompare(b.id));
  const nodes=all.map(item=>{const li=document.createElement('li'),meta=document.createElement('small'),body=document.createElement('p');meta.textContent=`${item.name} · ${new Date(item.createdAt).toLocaleString('ko-KR')}`;body.textContent=item.body;li.append(meta,body);return li;});
  $('comments-list').replaceChildren(...nodes);
 }
 async function loadInbox(){const stamp=ticket;if(!context)return;try{const data=await request(`/api/workspaces/${context.id}/inbox`);if(stamp===ticket)renderInbox(data);}catch(e){if(stamp===ticket)onError(e);}}
 async function loadComments(more=false){if(!context||!runId)return;const stamp=runTicket,id=runId;try{const data=await request(`/api/workspaces/${context.id}/runs/${id}/comments${more&&next?'?before='+encodeURIComponent(next):''}`);if(stamp===runTicket)renderComments(data,more);}catch(e){if(stamp===runTicket)onError(e);}}
 $('read-inbox').addEventListener('click',async()=>{if(!context)return;const stamp=ticket;try{await request(`/api/workspaces/${context.id}/inbox/read`,{});if(stamp===ticket)await loadInbox();}catch(e){if(stamp===ticket)onError(e);}});
 $('comments-more').addEventListener('click',()=>void loadComments(true));
 $('comment-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!context||!runId||busy)return;
  const body=$('comment-body').value.trim();if(!body)return;
  if(draftKey?.body!==body||draftKey.runId!==runId)draftKey={body,runId,key:crypto.randomUUID()};
  const stamp=runTicket,id=runId;busy=true;$('send-comment').disabled=true;
  try{await request(`/api/workspaces/${context.id}/runs/${id}/comments`,{body},draftKey.key);if(stamp===runTicket){$('comment-body').value='';draftKey=null;await loadComments();}}
  catch(error){if(stamp===runTicket)onError(error);}finally{if(stamp===runTicket){busy=false;$('send-comment').disabled=false;}}
 });
 return {
  reset(){ticket++;runTicket++;context=null;runId=null;next=null;draftKey=null;busy=false;commentSignature='';inboxSignature='';commentCache.clear();olderLoaded=false;$('comment-body').value='';$('comments-list').replaceChildren();$('inbox-list').replaceChildren();$('inbox-count').textContent='';$('comments-more').hidden=true;},
  render(snapshot,run){if(!snapshot)return;const changed=context?.id!==snapshot.workspace.id;context={id:snapshot.workspace.id,role:snapshot.role};if(changed){ticket++;void loadInbox();}
   $('discussion').hidden=!run;$('comment-form').hidden=context.role==='viewer';
   if(runId!==run?.id){runTicket++;runId=run?.id??null;busy=false;draftKey=null;next=null;commentSignature='';commentCache.clear();olderLoaded=false;$('comment-body').value='';$('send-comment').disabled=false;$('comments-list').replaceChildren();$('comments-more').hidden=true;if(runId)void loadComments();}
  },
  sync(data,selected){if(data.inbox)renderInbox(data.inbox);if(data.comments&&selected===runId)renderComments(data.comments);},
 };
}
