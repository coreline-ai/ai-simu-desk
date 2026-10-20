import {LoopOnce, LoopRepeat} from "three";
export const POSES = ["idle","thinking","typing","waiting","success","error"];
export const EXTRA_POSES=["preparing","reviewing","sending","receiving","acknowledge"];
const once = new Set(["success","error","sending","receiving","acknowledge"]);
export function applyActorPoses(actions, currentActions, actorIds, vm, consumed = {}) {
  for (const id of actorIds) {
    const actor = vm.actors?.find(actor => actor.agentId === id);
    const pose = actor?.pose ?? (id === "nara" ? vm.pose : "idle") ?? "idle";
    if(vm.motionPaused && currentActions[id])continue;
    const cue = actor?.cue ?? vm.cue;
    if (once.has(pose) && (!cue || consumed[id] === cue)) continue;
    const next = actions[id]?.[pose] ?? actions[id]?.idle, previous = currentActions[id];
    if (!next || (previous === next && !once.has(pose))) continue;
    if (once.has(pose)) consumed[id] = cue;
    next.setLoop(once.has(pose) ? LoopOnce : LoopRepeat, once.has(pose) ? 1 : Infinity);
    next.clampWhenFinished = once.has(pose);
    next.setEffectiveTimeScale(vm.naturalMotion&&!once.has(pose)?[.94,1.03,1.09,.90,1][actorIds.indexOf(id)%5]:1);
    if (previous) { previous.fadeOut(.25); next.reset().fadeIn(.25).play(); if(vm.naturalMotion&&!once.has(pose))next.time=actorIds.indexOf(id)*.37%next.getClip().duration; }
    else { next.reset().play(); next.time = actorIds.indexOf(id)*.53; }
    currentActions[id] = next;
  }
}
export function createCueTracker() {
  let previous = new Map(), cues = {};
  return {
    observe(runs = []) {
      for (const run of runs) {
        const owners=run.team&&run.answerMeta?.team?run.answerMeta.team.members:[run.agentId];
        for(const owner of owners){
        if(!["succeeded","failed","cancelled"].includes(run.status))delete cues[owner];
        if (previous.has(run.id) && !["succeeded","failed","cancelled"].includes(previous.get(run.id)) && ["succeeded","failed"].includes(run.status))
          cues[owner] = {pose:run.status === "succeeded" ? (run.team&&owner!==owners.at(-1)?"acknowledge":"success") : "error",cue:run.id+":"+run.status+(run.team?":"+owner:"")};
      }
      }
      previous = new Map(runs.map(run=>[run.id,run.status]));
      return cues;
    },
    reset() { previous = new Map(); cues = {}; },
  };
}
export function runningPose(run) {
  if (run?.status === "queued") return "thinking";
  if (run?.status === "awaiting_approval") return "waiting";
  if (run?.status === "running") return ["analyze","review"].includes(run.phase) || /요청|분석|구조|검토/.test(run.stage ?? "") ? "thinking" : "typing";
  return "idle";
}

export function finishActorAction(actions,current,id,vm) {
 const actor=vm.actors?.find(a=>a.agentId===id),desired=actor?.basePose??actor?.pose??vm.pose??'idle';
 const next=actions[id]?.[once.has(desired)?'idle':desired]??actions[id]?.idle;
 if(!next)return;
 current[id]?.fadeOut(.25);
 next.setLoop(LoopRepeat,Infinity);next.clampWhenFinished=false;
 next.setEffectiveTimeScale(vm.naturalMotion?[.94,1.03,1.09,.90,1][Math.max(0,vm.actors?.findIndex(a=>a.agentId===id)??0)%5]:1);
 current[id]=next.reset().fadeIn(.25).play();
}
