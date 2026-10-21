const $=id=>document.getElementById(id);
const kinds={approval_requested:'승인 요청',completed:'업무 완료',failed:'실행 실패',comment:'새 댓글'};
export function createDiscussion({request,onOpen,onError}) {
 let context=null,runId=null,ticket=0,runTicket=0,inboxEpoch=0,commentEpoch=0,inboxRequest=0,commentRequest=0,next=null,draftKey=null,busy=false,reading=false,loading=false,inboxSignature='',commentCache=new Map(),olderLoaded=false;
 function renderInbox(data){const signature=JSON.stringify(data);if(signature===inboxSignature)return;inboxSignature=signature;
  $('inbox-count').textContent=`읽지 않음 ${data.unread}개`;$('inbox-empty').hidden=!!data.items.length;
  $('inbox-list').replaceChildren(...data.items.map(item=>{const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=`${item.readAt?'':'● '}${kinds[item.kind]} · ${item.prompt.slice(0,65)}`;button.addEventListener('click',()=>void onOpen(item.runId));li.append(button);return li;}));
 }
 function renderComments(data,more=false){
  if(more)olderLoaded=true;if(more||!olderLoaded)next=data.next;
  // Comments are immutable. A refresh must not discard already loaded or newly posted rows.
  for(const item of data.items)commentCache.set(item.id,item);
  $('comments-more').hidden=!next;$('comments-empty').hidden=commentCache.size>0;
  const all=[...commentCache.values()].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)||a.id.localeCompare(b.id));
  $('comments-list').replaceChildren(...all.map(item=>{const li=document.createElement('li'),meta=document.createElement('small'),body=document.createElement('p');meta.textContent=`${item.name} · ${new Date(item.createdAt).toLocaleString('ko-KR')}`;body.textContent=item.body;li.append(meta,body);return li;}));
 }
 async function loadInbox(){const stamp=ticket,mutation=inboxEpoch,seq=++inboxRequest;if(!context)return;try{const data=await request(`/api/workspaces/${context.id}/inbox`);if(stamp===ticket&&mutation===inboxEpoch&&seq===inboxRequest)renderInbox(data);}catch(e){if(stamp===ticket&&mutation===inboxEpoch&&seq===inboxRequest)onError(e);}}
 async function loadComments(more=false){
  if(!context||!runId||(more&&loading))return;
  const stamp=runTicket,mutation=commentEpoch,seq=++commentRequest,id=runId;loading=true;$('comments-more').disabled=true;
  try{const data=await request(`/api/workspaces/${context.id}/runs/${id}/comments${more&&next?'?before='+encodeURIComponent(next):''}`);if(stamp===runTicket&&mutation===commentEpoch&&seq===commentRequest)renderComments(data,more);}
  catch(e){if(stamp===runTicket&&mutation===commentEpoch&&seq===commentRequest)onError(e);}
  finally{if(stamp===runTicket&&seq===commentRequest){loading=false;$('comments-more').disabled=false;}}
 }
 $('read-inbox').addEventListener('click',async()=>{if(!context||reading)return;const stamp=ticket;reading=true;inboxEpoch++;$('read-inbox').disabled=true;try{await request(`/api/workspaces/${context.id}/inbox/read`,{});if(stamp===ticket){inboxEpoch++;await loadInbox();}}catch(e){if(stamp===ticket)onError(e);}finally{if(stamp===ticket){reading=false;$('read-inbox').disabled=false;}}});
 $('comments-more').addEventListener('click',()=>void loadComments(true));
 $('comment-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!context||context.role==='viewer'||!runId||busy)return;
  const body=$('comment-body').value.trim();if(!body)return;
  if(draftKey?.body!==body||draftKey.runId!==runId)draftKey={body,runId,key:crypto.randomUUID()};
  const stamp=runTicket,id=runId;busy=true;commentEpoch++;$('send-comment').disabled=true;
  try{await request(`/api/workspaces/${context.id}/runs/${id}/comments`,{body},draftKey.key);if(stamp===runTicket){commentEpoch++;$('comment-body').value='';draftKey=null;await loadComments();}}
  catch(error){if(stamp===runTicket)onError(error);}finally{if(stamp===runTicket){busy=false;$('send-comment').disabled=false;}}
 });
 function clearRun(){runTicket++;commentEpoch++;commentRequest++;runId=null;next=null;draftKey=null;busy=loading=false;commentCache.clear();olderLoaded=false;$('comment-body').value='';$('send-comment').disabled=false;$('comments-list').replaceChildren();$('comments-more').hidden=true;$('comments-more').disabled=false;$('comments-empty').hidden=false;}
 return {
  reset(){ticket++;inboxEpoch++;inboxRequest++;context=null;reading=false;inboxSignature='';clearRun();$('inbox-list').replaceChildren();$('inbox-count').textContent='';$('read-inbox').disabled=false;},
  render(snapshot,run){if(!snapshot)return;const changed=context?.id!==snapshot.workspace.id;if(changed){ticket++;inboxEpoch++;inboxRequest++;inboxSignature='';reading=false;clearRun();$('read-inbox').disabled=false;}$('discussion').hidden=!run;context={id:snapshot.workspace.id,role:snapshot.role};if(changed)void loadInbox();
   $('comment-form').hidden=context.role==='viewer';
   if(runId!==(run?.id??null)){clearRun();runId=run?.id??null;if(runId)void loadComments();}
  },
  syncToken(){return{ticket,runTicket,inboxEpoch,commentEpoch};},
  sync(data,selected,stamp){if(!stamp||stamp.ticket!==ticket)return;if(data.inbox&&!reading&&stamp.inboxEpoch===inboxEpoch)renderInbox(data.inbox);if(data.comments&&!busy&&stamp.runTicket===runTicket&&stamp.commentEpoch===commentEpoch&&selected===runId)renderComments(data.comments);},
 };
}
