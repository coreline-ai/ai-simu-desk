import {teamStages} from "./team-handoff.mjs";
import { runningPose } from "../../pilot-3d/src/animation.mjs";
import {TEAM_NAMES} from "../../server/domain/team.ts";
import { ACTIVE, AGENTS } from "../../server/domain/contracts.ts";

export const AGENT_NAMES = Object.freeze(TEAM_NAMES);
export const RUN_LABELS = Object.freeze({ awaiting_approval: "실행 승인 대기", queued: "실행 대기", running: "답변 작성 중", cancel_requested: "취소 확인 중", succeeded: "답변 저장 완료", failed: "실행 실패", cancelled: "취소됨" });

// Selection and history are presentation choices. Only a live server run owns motion.
export function teamSceneState(runs = [], selectedAgent = "nara", motionPaused = false, cues = {}) {
  const active = runs.find(run => ACTIVE.includes(run.status));
  const team=teamProgress(active);
  return Object.freeze({
    selectedAgent: AGENTS.includes(selectedAgent) ? selectedAgent : "nara", motionPaused: Boolean(motionPaused),
    actors: AGENTS.map(agentId => Object.freeze({ agentId,
      pose:teamStages(active).length ? team[agentId]?.pose??"preparing" : active?.agentId===agentId ? runningPose(active) : cues[agentId]?.pose ?? "idle",
      cue:active?.agentId===agentId ? undefined : cues[agentId]?.cue,
      label:teamStages(active).length ? team[agentId]?.label??"협업 준비" : active?.agentId === agentId ? RUN_LABELS[active.status] : "새 업무 대기" })),

  });
}


export function teamProgress(run){
 const stages=teamStages(run),length=run?.output?.length??0;
 const found=stages.findIndex(s=>length<s.end),current=found<0?Math.max(0,stages.length-1):found;
 return Object.fromEntries(stages.map((s,i)=>{
  if(run.status==='succeeded')return [s.agentId,{pose:'idle',label:s.title+' 완료',state:'done'}];
  if(['failed','cancelled'].includes(run.status))return [s.agentId,{pose:'idle',label:i<current?'전달 완료':'협업 중단',state:i<current?'done':'stopped'}];
  if(run.status==='awaiting_approval')return [s.agentId,{pose:'waiting',label:'실행 승인 대기',state:'waiting'}];
  if(run.status==='queued'||run.phase==='analyze')return [s.agentId,{pose:'preparing',label:s.title+' 준비',state:'preparing'}];
  if(run.status==='cancel_requested')return [s.agentId,{pose:'waiting',label:'취소 확인 중',state:'waiting'}];
  return [s.agentId,i<current?{pose:'reviewing',label:'전달 후 검토',state:'done'}:i===current?{pose:run.phase==='review'?'reviewing':'typing',label:s.title+(run.phase==='review'?' 검토':' 작성'),state:'active'}:{pose:'preparing',label:'자료·기준 준비',state:'preparing'}];
 }));
}

export function motionPolicy(paused,reduced,hidden){
  return {paused:Boolean(paused||reduced),animate:!paused&&!reduced&&!hidden};
}
