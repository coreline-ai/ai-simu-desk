import * as T from "three";
import { part } from "../sample/character-rig.mjs";
import { group, tube, material } from "../sample/geometry.mjs";
const MODES = ["focus", "positive", "thinking", "relaxed"];
export function addExpressions(actor) {
  part(actor, "Smile").visible = false;
  const head = part(actor, "NaraHead"), g = group(head, actor.userData.prefix + "ExpressionMouths"), ink = material(actor.userData.prefix + "ExpressionInk", 4996402, 0.8);
  for (const [i, mode] of MODES.entries()) {
    const width = [0.021, 0.029, 0.014, 0.024][i], dip = [2e-3, 0.01, -1e-3, 5e-3][i], n = tube(g, actor.userData.prefix + "Mouth_" + mode, [[-width, -0.064, 0.143], [0, -0.064 - dip, 0.151], [width, -0.064, 0.143]], 28e-4, ink);
    n.userData.ensembleMotion = mode;
    n.visible = mode === "relaxed";
  }
  return g.name;
}
export class EnsembleExpressions {
  constructor(model, metadata) {
    this.rows = /* @__PURE__ */ new Map();
    for (const id of metadata.ensembleOffice.enhancedActors) {
      const actor = model.getObjectByName(metadata.bindings[id].actor), g = model.getObjectByName(actor.userData.prefix + "ExpressionMouths"), smile = part(actor, "Smile");
      this.rows.set(id, { g, smile, original: smile.visible, mode: "relaxed", strength: 0, brows: [-1, 1].map((sign) => {
        const node = part(actor, "Brow" + sign);
        return { node, z: node.rotation.z, sign };
      }) });
    }
  }
  apply(id, state, scheduler, dt) {
    const r = this.rows.get(id);
    if (!r || dt <= 0) return;
    const d = scheduler.desks[id], mode = state.action === "group_note" ? "focus" : d.busy ? d.reading ? "thinking" : "focus" : ["success", "sofa_agree", "social_confirm", "meeting_ack"].includes(state.action) ? "positive" : ["sofa_rest", "sofa_listen", "rest_shoulder", "rest_stretch"].includes(state.action) || ["sofa", "sofaPair", "window"].includes(state.activity) ? "relaxed" : ["meeting_talk", "desk_visit"].includes(state.action) ? "thinking" : ["preparing", "typing", "reviewing"].includes(state.action) ? "focus" : "relaxed";
    r.mode = mode;
    r.smile.visible = false;
    for (const n of r.g.children) n.visible = n.name.endsWith("_" + mode);
    const desired = mode === "focus" ? 0.025 : mode === "thinking" ? 0.045 : mode === "positive" ? -0.035 : 0;
    r.strength += (desired - r.strength) * (1 - Math.exp(-dt * 5));
    for (const b of r.brows) b.node.rotation.z = b.z + b.sign * r.strength;
  }
  diagnostics() {
    return Object.fromEntries([...this.rows].map(([id, r]) => [id, { mode: r.mode, brow: r.strength }]));
  }
  dispose() {
    for (const r of this.rows.values()) {
      r.smile.visible = r.original;
      for (const b of r.brows) b.node.rotation.z = b.z;
      for (const n of r.g.children) n.visible = n.name.endsWith("_relaxed");
    }
    this.rows.clear();
  }
}
