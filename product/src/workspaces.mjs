import { presencePresentation } from "./presence.mjs";
import { ROLE_NAMES } from "./workspace-state.mjs";
const $ = id => document.getElementById(id);
export function createWorkspacePanel({ request,onSelect,onBusy,onError,refreshSnapshot }) {
  let generation=0,spaces=[],snapshot=null,key="",pendingCreation=null,issuedRevision=0,externalBusy=false,operating=false,switching=false,presence=null,presenceKey="";
  function clearCode() { $("issued-invite").value=""; $("issued-invite").type="password"; $("invite-result").hidden=true; issuedRevision=0; $("show-invite").textContent="코드 보기"; }
  function lock() {
    const disabled=externalBusy||operating||switching;
    for(const node of $("workspace-tools").querySelectorAll("button,input,select")) node.disabled=disabled;
  }
  function clearPresence() {presence=null;presenceKey="";$("presence-summary").hidden=true;$("presence-activity").hidden=true;$("presence-events").replaceChildren();}
  function text(id,value) {if($(id).textContent!==value)$(id).textContent=value;}
  function renderPresence(data=presence) {
    presence=data;
    if(!snapshot)return;
    const shared=snapshot.workspace.kind==="shared",view=presencePresentation(snapshot.members,data);
    $("presence-summary").hidden=!shared;$("presence-activity").hidden=!shared;
    text("presence-summary",data ? `온라인 ${view.online}명 / 참여자 ${snapshot.members.length}명` : "접속 상태 확인 중…");
    text("members-hint",shared ? "이 공간을 열고 연결된 계정이 온라인이에요. 여러 탭은 한 명으로 집계하며, 연결이 끊기면 마지막 응답 후 75초에 오프라인으로 바뀝니다." : "나만 확인하는 개인 공간이에요.");
    for(const person of view.members) {
      const node=[...$("members-list").children].find(li=>li.dataset.userId===person.userId)?.querySelector(".presence-badge");
      if(node){node.hidden=!shared;node.dataset.status=person.status;node.textContent={online:"온라인",offline:"오프라인",unknown:"확인 중"}[person.status];}
    }
    const nextKey=data ? `${data.instance}:${data.version}` : "unknown";
    if(presenceKey!==nextKey) {
      presenceKey=nextKey;$("presence-empty").hidden=view.events.length>0;
      $("presence-empty").textContent=data ? "아직 접속 기록이 없어요." : "연결되면 최근 입장·퇴장을 확인할 수 있어요.";
      $("presence-events").replaceChildren(...[...view.events].reverse().map(event=>{
        const li=document.createElement("li"),text=document.createElement("span"),time=document.createElement("time");
        li.dataset.kind=event.kind;text.textContent=`${event.name} · ${event.kind==="joined" ? "입장" : "퇴장"}${event.reason==="timeout" ? " (연결 만료)" : event.reason==="revoked" ? " (권한 해제)" : event.reason==="logout" ? " (로그아웃)" : ""}`;
        time.dateTime=event.at;time.textContent=new Date(event.at).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});li.append(text,time);return li;
      }));
    }
  }
  function reset() {clearPresence();
    generation++; spaces=[]; snapshot=null; key=""; pendingCreation=null; operating=false; externalBusy=false; switching=false;
    clearCode(); $("workspace-select").replaceChildren(); $("members-list").replaceChildren(); $("join-code").value=""; $("space-name").value="";
    $("workspace-error").hidden=true; $("workspace-flash").hidden=true; $("workspace-members").open=false; lock();
  }
  function beginSwitch(id) {clearPresence();
    generation++; snapshot=null; key=""; operating=false; externalBusy=false; switching=true;
    clearCode(); $("join-code").value=""; $("members-list").replaceChildren(); $("workspace-select").value=id;
    $("workspace-owner-tools").hidden=true; $("workspace-role").textContent="확인 중"; $("members-summary").textContent="참여자 불러오는 중"; $("workspace-members").open=false; $("workspace-error").hidden=true; lock();
  }
  async function loadList() {
    const ticket=generation, data=await request("/api/workspaces");
    if(ticket!==generation) return spaces;
    spaces=data.workspaces;
    const selected=$("workspace-select").value;
    $("workspace-select").replaceChildren(...spaces.map(space=>{const option=document.createElement("option");option.value=space.id;option.textContent=`${space.kind==="shared" ? "공동" : "개인"} · ${space.name}`;return option;}));
    if(spaces.some(space=>space.id===selected)) $("workspace-select").value=selected;
    lock(); return spaces;
  }
  async function perform(action) {
    if(externalBusy||operating||switching) return;
    const ticket=generation; operating=true; $("workspace-error").hidden=true; onBusy(true); lock();
    try { await action(()=>ticket===generation); }
    catch(error) { if(ticket===generation) { $("workspace-error").textContent=error.message||"공간 요청을 처리하지 못했습니다."; $("workspace-error").hidden=false; await onError(error); } }
    finally { if(ticket===generation) { operating=false; onBusy(false); lock(); } }
  }
  function render(next) {
    snapshot=next; switching=false; $("workspace-select").value=next.workspace.id;
    $("workspace-role").textContent=ROLE_NAMES[next.role]; $("workspace-role").dataset.role=next.role;
    $("members-summary").textContent=`참여자 ${next.members.length}명${next.role==="owner" && next.workspace.kind==="shared" ? " · 초대와 권한 관리" : ""}`;
    $("workspace-owner-tools").hidden=next.role!=="owner"||next.workspace.kind!=="shared";
    if(issuedRevision && next.workspace.revision!==issuedRevision) clearCode();
    const nextKey=`${next.workspace.id}:${next.workspace.revision}:${next.role}`;
    if(key!==nextKey) {
      key=nextKey;
      $("members-list").replaceChildren(...next.members.map(person=>{
        const li=document.createElement("li"), name=document.createElement("strong"), badge=document.createElement("span");
        li.dataset.userId=person.userId;name.textContent=person.name; badge.textContent=ROLE_NAMES[person.role]; const status=document.createElement("span");status.className="presence-badge";li.append(name,badge,status);
        if(next.role==="owner" && next.workspace.kind==="shared" && person.role!=="owner") {
          const select=document.createElement("select"); select.setAttribute("aria-label",`${person.name} 권한`);
          for(const role of ["viewer","member"]) {const option=document.createElement("option");option.value=role;option.textContent=ROLE_NAMES[role];select.append(option);}
          select.value=person.role;
          const apply=document.createElement("button"), remove=document.createElement("button");
          apply.type=remove.type="button"; apply.textContent="권한 적용"; remove.textContent="내보내기";
          apply.setAttribute("aria-label",`${person.name} 권한 적용`); remove.setAttribute("aria-label",`${person.name} 내보내기`);
          const update=role=>perform(async valid=>{await request(`/api/workspaces/${snapshot.workspace.id}/members/${person.userId}`,{role,version:snapshot.workspace.revision});if(valid()) await refreshSnapshot();});
          apply.addEventListener("click",()=>update(select.value)); remove.addEventListener("click",()=>update(null));
          li.append(select,apply,remove);
        }
        return li;
      }));
    }
    renderPresence();lock();
  }
  $("workspace-select").addEventListener("change",()=>{void onSelect($("workspace-select").value);});
  $("refresh-workspaces").addEventListener("click",()=>perform(async valid=>{await loadList();if(valid()) await refreshSnapshot();}));
  $("create-workspace").addEventListener("submit",event=>{
    event.preventDefault(); const name=$("space-name").value.trim();
    if(!pendingCreation||pendingCreation.name!==name) pendingCreation={name,key:crypto.randomUUID()};
    void perform(async valid=>{const space=await request("/api/workspaces",{name},pendingCreation.key);if(!valid())return;pendingCreation=null;await loadList();if(valid()){$("create-space-details").open=false;await onSelect(space.id);}});
  });
  $("join-workspace").addEventListener("submit",event=>{event.preventDefault();const code=$("join-code").value.trim();void perform(async valid=>{const space=await request("/api/workspaces/join",{code});if(!valid())return;$("join-code").value="";await loadList();if(valid()){$("join-space-details").open=false;await onSelect(space.id);}});});
  $("issue-invite").addEventListener("click",()=>perform(async valid=>{
    const result=await request(`/api/workspaces/${snapshot.workspace.id}/invites`,{role:$("invite-role").value,version:snapshot.workspace.revision});
    if(!valid())return; issuedRevision=result.revision; $("issued-invite").value=result.code; $("invite-result").hidden=false;
    $("invite-expiry").textContent=`1회 사용 · ${new Date(result.expiresAt).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}까지 · 재발급하면 이전 코드는 폐기돼요.`;
    await refreshSnapshot();
  }));
  $("revoke-invites").addEventListener("click",()=>perform(async valid=>{await request(`/api/workspaces/${snapshot.workspace.id}/invites/revoke`,{version:snapshot.workspace.revision});if(valid()){clearCode();await refreshSnapshot();}}));
  $("show-invite").addEventListener("click",()=>{const show=$("issued-invite").type==="password";$("issued-invite").type=show?"text":"password";$("show-invite").textContent=show?"코드 가리기":"코드 보기";});
  return {renderPresence,reset,beginSwitch,loadList,render,setBusy(value){externalBusy=value;lock();},setNotice(text){$("workspace-flash").textContent=text;$("workspace-flash").hidden=!text;}};
}
