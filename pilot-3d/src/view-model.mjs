import { runningPose } from "./animation.mjs";
import { agentPresentation, ACTIVE } from "../../demo/src/domain.mjs";

// One-way presentation contract; neither Three objects nor DOM enter the domain.
export function studioViewModel(state, motionPaused = false, cue = {}) {
  const nara = agentPresentation(state, "nara");
  return Object.freeze({ agentId: "nara", pose: ["queued","running","awaiting_approval"].includes(nara.status) ? runningPose({status:nara.status}) : cue.pose ?? "idle", cue:cue.cue, label: nara.label, motionPaused: Boolean(motionPaused), active: Boolean(state.currentRun && ACTIVE.has(state.currentRun.status)) });
}
