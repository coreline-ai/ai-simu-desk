import * as T from "three";
import { group, tube, rod, material } from "../sample/geometry.mjs";
export function addRoomDetails(root) {
  const sofa = root.getObjectByName("LinenSofa"), thread = material("EnsembleLinenThread", 12696746, 0.99), parts = [];
  for (const [i, x] of [-0.82, 0, 0.82].entries()) {
    const seam = tube(sofa, "SofaSeatPiping" + i, [[x - 0.31, 0.462, -0.17], [x + 0.31, 0.462, -0.17], [x + 0.34, 0.462, 0.055], [x + 0.31, 0.462, 0.28], [x - 0.31, 0.462, 0.28], [x - 0.34, 0.462, 0.055], [x - 0.31, 0.462, -0.17]], 14e-4, thread);
    seam.userData.ensembleDetail = "high";
    parts.push(seam.name);
  }
  const cushions = [];
  for (const x of [-0.9, 0.9]) {
    const n = sofa.getObjectByName("LooseCushion" + x);
    n.name = "EnsembleLooseCushion" + cushions.length;
    n.userData.ensembleMotion = n.name;
    cushions.push(n.name);
  }
  const room = root.getObjectByName("QualityRoom"), metal = material("EnsembleWindowSatin", 12501425, 0.35, 0.55);
  for (const i of [0, 2, 4]) {
    const h = rod(room, "WindowHandle" + i, [-4.3 + i * 2.2, 1.35, -4.96], [-4.3 + i * 2.2, 1.48, -4.96], 8e-3, metal);
    h.userData.ensembleDetail = "high";
    parts.push(h.name);
  }
  return { cushions, closeDetails: parts, contactPolicy: "seat surfaces and support heights unchanged" };
}
export class RoomDetails {
  constructor(model, metadata) {
    this.rows = (metadata.ensembleOffice.roomDetails?.cushions ?? []).map((name) => {
      const node = model.getObjectByName(name);
      return { node, base: node.scale.clone() };
    });
  }
  apply(scheduler) {
    for (let i = 0; i < this.rows.length; i++) {
      const r = this.rows[i], slot = i, occupied = [...scheduler.records.values()].some((n) => n.kind === "sofa" && n.slot === slot && n.trip.stage === "rest");
      r.node.scale.copy(r.base);
      r.node.scale.z *= occupied ? 0.985 : 1;
    }
  }
  dispose() {
    for (const r of this.rows) r.node.scale.copy(r.base);
    this.rows = [];
  }
}
