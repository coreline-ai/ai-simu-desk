import {LoopOnce, LoopRepeat} from "three";
export const POSES = ["idle","thinking","typing","waiting","success","error"];
const once = new Set(["success","error"]);
export function applyActorPoses(actions, currentActions, actorIds, vm, consumed = {}) {
  for (const id of actorIds) {
    const actor = vm.actors?.find(actor => actor.agentId === id);
    const pose = actor?.pose ?? (id === "nara" ? vm.pose : "idle") ?? "idle";
    const cue = actor?.cue ?? vm.cue;
    if (once.has(pose) && (!cue || consumed[id] === cue)) continue;
    const next = actions[id]?.[pose] ?? actions[id]?.idle, previous = currentActions[id];
    if (!next || (previous === next && !once.has(pose))) continue;
    if (once.has(pose)) consumed[id] = cue;
    next.setLoop(once.has(pose) ? LoopOnce : LoopRepeat, once.has(pose) ? 1 : Infinity);
    next.clampWhenFinished = once.has(pose);
    if (previous) { previous.fadeOut(.25); next.reset().fadeIn(.25).play(); }
    else { next.reset().play(); next.time = id === "jun" ? .53 : 0; }
    currentActions[id] = next;
  }
}
export function createCueTracker() {
  let previous = new Map(), cues = {};
  return {
    observe(runs = []) {
      for (const run of runs) {
        if(!["succeeded","failed","cancelled"].includes(run.status))delete cues[run.agentId];
        if (previous.has(run.id) && !["succeeded","failed","cancelled"].includes(previous.get(run.id)) && ["succeeded","failed"].includes(run.status))
          cues[run.agentId] = {pose:run.status === "succeeded" ? "success" : "error",cue:run.id+":"+run.status};
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
