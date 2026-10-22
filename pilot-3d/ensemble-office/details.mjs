import { EnsembleExpressions } from "./expressions.mjs";
import { RoomDetails } from "./room-details.mjs";
import { PaperSurfaces } from "./props.mjs";
import { part } from "../sample/character-rig.mjs";
import { MOTION_PROFILES } from "./motion.mjs";
import { ease } from "../sample/motion.mjs";
// Decorative parts follow the authoritative role stage; they never own props.
export class EnsembleDetails {
  constructor(model, scheduler, metadata = model.userData) {
    this.scheduler = scheduler;
    this.papers = new PaperSurfaces(scheduler);
    this.expressions = new EnsembleExpressions(model, metadata);
    this.room = new RoomDetails(model, metadata);
    this.detailNodes = [];
    model.traverse((n) => {
      if (n.userData.ensembleDetail) this.detailNodes.push({ node: n, visible: n.visible });
    });
    this.detailLevel = "close";
    this.model = model;
    this.metadata = metadata;
    this.rows = /* @__PURE__ */ new Map();
    for (const id of metadata.ensembleOffice.enhancedActors) {
      const pre = id[0].toUpperCase() + id.slice(1), hinge = model.getObjectByName(pre + "PageHinge"), ink = model.getObjectByName(pre + "WrittenStrokes");
      this.rows.set(id, { hinge, ink, folds: (metadata.ensembleOffice.bodies?.[id]?.folds ?? []).map((name) => {
        const node = model.getObjectByName(name);
        return { node, base: node.scale.clone() };
      }), extraInk: model.getObjectByName(metadata.ensembleOffice.roles[id]?.ink), checks: (metadata.ensembleOffice.roles[id]?.checks ?? []).map((name) => model.getObjectByName(name)), mouse: model.getObjectByName(metadata.ensembleOffice.roles[id]?.mouse), mouseX: 0, motionPhase: "idle", flips: 0, maxAngle: 0, lastAngle: 0, written: 0 });
    }
  }
  pose(id, actor, state, dt) {
    const row = this.rows.get(id);
    if (!row || dt <= 0) return;
    if (row.mouse) {
      row.mouseX ??= row.mouse.position.x;
      row.mouse.position.x = 0.27 + (this.scheduler.desks[id].stage === "use" && this.scheduler.desks[id].variant === 2 ? Math.sin(this.scheduler.desks[id].time * 1.8) * 4e-3 : 0);
    }
    const p = state.pose, record = this.scheduler.getRecord?.(id) ?? this.scheduler.records.get(id), torso = part(actor, "NaraTorso");
    row.motionPhase = p?.ensemblePhase ?? record?.trip?.stage ?? state.action;
    if (p) {
      torso.rotation.x += p.travelLean ?? 0;
      if (p.seatBlend !== void 0) torso.rotation.x += 0.04 * Math.sin(Math.PI * p.seatBlend);
      part(actor, "NaraHead").rotation.y += (p.turnLead ?? 0) * 0.4;
    }
    if (state.action === "walk") part(actor, "NaraShoulderR").rotation.x += Math.sin((p?.gaitTime ?? 0) * Math.PI * 2) * MOTION_PROFILES[id].arm * (p?.gaitFade ?? 0);
    if (record?.trip?.stage === "queued") torso.rotation.z += Math.sin(this.scheduler.time * 0.65 + this.scheduler.ids.indexOf(id)) * 6e-3;
    for (const f of row.folds) {
      const joint = f.node.parent, flex = Math.min(1, Math.abs(joint.rotation.x) / 1.8);
      f.node.scale.copy(f.base);
      f.node.scale.x *= 1 + 0.035 * flex;
      f.node.scale.y *= 1 - 0.1 * flex;
    }
  }
  apply(id, _actor, _state, dt) {
    const row = this.rows.get(id);
    if (!row || dt <= 0) return;
    const d = this.scheduler.desks[id], active = d?.stage === "use", phase = (d?.time ?? 0) % 2.4;
    let angle = 0;
    if (active && id === "nara" && d.variant === 1) angle = 0.4 * ease((phase - 1.4) / 0.3) * (1 - ease((phase - 2) / 0.35));
    if (row.hinge) row.hinge.rotation.z = angle;
    if (angle > 0.1 && row.lastAngle <= 0.1) row.flips++;
    row.maxAngle = Math.max(row.maxAngle, angle);
    row.lastAngle = angle;
    this.expressions.apply(id, _state, this.scheduler, dt);
    this.room.apply(this.scheduler);
    if (row.extraInk && id !== "nara") {
      if (active && !d.reading) row.written = Math.max(row.written, Math.floor(d.time * 1.4));
      row.extraInk.children.forEach((n, i) => n.visible = i < row.written);
    }
    if (row.checks.length) {
      if (active && !d.reading) row.written = Math.max(row.written, Math.floor(d.time / 1.1));
      row.checks.forEach((g, i) => g.children.forEach((n) => n.visible = i < row.written));
    }
    if (row.ink) {
      if (active && d.variant !== 1) row.written = Math.max(row.written, Math.floor(d.time * 1.5));
      row.ink.children.forEach((n, i) => {
        n.visible = i < row.written;
      });
    }
  }
  setDetail(level) {
    if (level === this.detailLevel) return;
    this.detailLevel = level;
    for (const r of this.detailNodes) r.node.visible = level === "close" && r.visible;
  }
  deform(id, actor) {
    this.papers.apply(id, actor);
  }
  diagnostics() {
    const expressions = this.expressions.diagnostics();
    return Object.fromEntries([...this.rows].map(([id, r]) => [id, { detail: this.detailLevel, expression: expressions[id], roleMarks: r.written, motionPhase: r.motionPhase, pageFlips: r.flips, maxPageAngle: r.maxAngle, pageAngle: r.lastAngle, inkLines: r.ink?.children.filter((n) => n.visible).length ?? 0 }]));
  }
  dispose() {
    this.papers.dispose();
    this.expressions.dispose();
    this.room.dispose();
    for (const r of this.detailNodes) r.node.visible = r.visible;
    for (const row of this.rows.values()) {
      if (row.hinge) row.hinge.rotation.z = 0;
      row.ink?.children.forEach((n) => {
        n.visible = false;
      });
      row.extraInk?.children.forEach((n) => n.visible = false);
      for (const g of row.checks) g.children.forEach((n) => n.visible = false);
      if (row.mouse) row.mouse.position.x = 0.27;
    }
    this.rows.clear();
  }
}
