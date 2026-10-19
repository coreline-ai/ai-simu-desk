import { ACTIVE } from "../../server/domain/contracts.ts";
import { canStartRun, canControlRun } from "../../server/domain/collaboration.ts";
export const ROLE_NAMES = Object.freeze({ owner:"소유자",member:"업무 참여",viewer:"보기 전용" });
export function acceptsWorkspaceSnapshot(request,current,nextCursor) {
  return request.epoch===current.epoch && request.workspaceId===current.workspaceId && nextCursor>=current.cursor;
}
export function workspacePresentation(snapshot, userId, selectedId, followLive = true) {
  const active = snapshot.runs.find(run=>ACTIVE.includes(run.status)) ?? null;
  const run = (followLive ? active ?? snapshot.runs[0] : snapshot.runs.find(run=>run.id===selectedId) ?? snapshot.runs[0]) ?? null;
  return { active,run,isOwner:snapshot.role==="owner",shared:snapshot.workspace.kind==="shared",canStart:canStartRun(snapshot.role),canApprove:snapshot.role==="owner",canControl:Boolean(run && canControlRun(snapshot.role,run.requestedBy,userId)) };
}
