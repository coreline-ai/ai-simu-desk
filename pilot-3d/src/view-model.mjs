import { agentPresentation, ACTIVE } from "../../demo/src/domain.mjs";

// One-way presentation contract; neither Three objects nor DOM enter the domain.
export function studioViewModel(state, motionPaused = false) {
  const nara = agentPresentation(state, "nara");
  return Object.freeze({ agentId: "nara", pose: nara.status === "running" ? "typing" : "idle", label: nara.label, motionPaused: Boolean(motionPaused), active: Boolean(state.currentRun && ACTIVE.has(state.currentRun.status)) });
}
