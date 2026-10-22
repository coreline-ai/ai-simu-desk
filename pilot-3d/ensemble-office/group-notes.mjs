import * as T from "three";
import { part } from "../sample/character-rig.mjs";
import { solveArm } from "../activities/interactions.mjs";
import { ease } from "../sample/motion.mjs";
const V = (...p) => new T.Vector3(...p), Y = V(0, 1, 0), DUR = { reach: 0.8, grasp: 0.3, use: 2.6, replace: 0.8, release: 0.3, retract: 0.5 };
const world = (n) => ({ p: n.getWorldPosition(V()), q: n.getWorldQuaternion(new T.Quaternion()) });
function setWorld(n, p, q) {
  n.parent.updateWorldMatrix(true, false);
  n.position.copy(n.parent.worldToLocal(p.clone()));
  n.quaternion.copy(n.parent.getWorldQuaternion(new T.Quaternion()).invert()).multiply(q);
  n.updateWorldMatrix(false, true);
}
export class GroupNote {
  constructor(model, actor, row, scheduler) {
    this.scheduler = scheduler;
    this.actor = actor;
    this.id = actor.userData.actorId;
    this.hand = part(actor, "NaraHandR");
    this.parent = model.getObjectByName(row.parent);
    this.pen = model.getObjectByName(row.pen);
    this.ink = model.getObjectByName(row.ink);
    this.home = { p: this.pen.position.clone(), q: this.pen.quaternion.clone() };
    this.pen.geometry.computeBoundingBox();
    this.half = this.pen.geometry.boundingBox.max.y;
    this.stage = "idle";
    this.owner = "table";
    this.time = 0;
    this.handError = 0;
    this.tipError = 0;
    this.done = 0;
    this.cancelled = false;
  }
  get busy() {
    return this.stage !== "idle";
  }
  enter(stage) {
    this.stage = stage;
    this.time = 0;
    this.fromHand = world(this.hand);
    this.fromPen = world(this.pen);
    if(stage === "replace") this.replaceOffset = this.fromHand.p.clone().sub(this.fromPen.p.clone().addScaledVector(Y.clone().applyQuaternion(this.fromPen.q), .065-this.half));
  }
  homeWorld() {
    return { p: this.parent.localToWorld(this.home.p.clone()), q: this.parent.getWorldQuaternion(new T.Quaternion()).multiply(this.home.q) };
  }
  start() {
    if (this.busy) return false;
    this.cancelled = false;
    this.enter("reach");
    return true;
  }
  cancel() {
    if (!this.busy) return;
    this.cancelled = true;
    if (!["replace", "release", "retract"].includes(this.stage)) this.enter(this.owner === "hand" ? "replace" : "retract");
  }
  release() {
    this.parent.attach(this.pen);
    this.pen.position.copy(this.home.p);
    this.pen.quaternion.copy(this.home.q);
    this.owner = "table";
  }
  tick(dt) {
    if (!this.busy) return;
    this.time += dt;
    if (this.time < DUR[this.stage]) return;
    const stage = this.stage;
    if (stage === "reach") this.enter("grasp");
    else if (stage === "grasp") {
      this.hand.attach(this.pen);
      this.owner = "hand";
      this.enter("use");
    } else if (stage === "use") this.enter("replace");
    else if (stage === "replace") {
      this.release();
      this.enter("release");
    } else if (stage === "release") this.enter("retract");
    else {
      if (!this.cancelled) this.done++;
      this.stage = "idle";
    }
  }
  apply() {
    if (!this.busy) return;
    const base = world(this.hand), home = this.homeWorld(), u = ease(this.time / DUR[this.stage]);
    let p, q, pen;
    if (["reach", "grasp"].includes(this.stage)) {
      const at = home.p.clone().addScaledVector(Y.clone().applyQuaternion(home.q), 0.065 - this.half).addScaledVector(Y, .032), v = this.stage === "grasp" ? 1 : u;
      p = this.fromHand.p.clone().lerp(at, v).addScaledVector(Y, .035*Math.sin(Math.PI*v));
      q = this.fromHand.q.clone().slerp(home.q, v);
    } else if (this.stage === "use") {
      const localTip = V(-0.025 + Math.sin(this.time * 7) * 0.018, 0.7545, -0.055 + Math.sin(this.time * 1.4) * 6e-3), tip = this.parent.localToWorld(localTip), axis = V(0.35, 0.93, -0.1).normalize().applyQuaternion(this.parent.getWorldQuaternion(new T.Quaternion())), target = tip.clone().addScaledVector(axis, 0.065), targetQ = new T.Quaternion().setFromUnitVectors(Y, axis), v = ease(this.time / 0.7);
      p = this.fromHand.p.clone().lerp(target, v);
      q = this.fromHand.q.clone().slerp(targetQ, v);
      pen = { p: this.fromPen.p.clone().lerp(tip.clone().addScaledVector(axis, this.half), v), q: this.fromPen.q.clone().slerp(targetQ, v) };
      this.tipTarget = tip;
      this.ink.children.forEach((n) => {
        n.visible = this.time > 0.4;
        n.geometry.setDrawRange(0, Math.min(5, Math.floor(this.time * 2)) * 2);
      });
    } else if (this.stage === "replace") {
      pen = { p: this.fromPen.p.clone().lerp(home.p, u), q: this.fromPen.q.clone().slerp(home.q, u) };
      p = pen.p.clone().addScaledVector(Y.clone().applyQuaternion(pen.q), 0.065 - this.half).addScaledVector(this.replaceOffset, 1-u).addScaledVector(Y, .032*u);
      q = pen.q.clone();
    } else if (this.stage === "release") {
      p = this.fromHand.p.clone();
      q = this.fromHand.q.clone();
    } else {
      const support=this.scheduler.meetingSupport.surface(this.actor,"R").addScaledVector(Y,.0275), normal=this.actor.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),-Math.PI/2));
      p = this.fromHand.p.clone().lerp(support, u).addScaledVector(Y,.04*Math.sin(Math.PI*u));
      q = this.fromHand.q.clone().slerp(normal, u);
    }
    this.handError = solveArm(this.actor, p, q, "R");
    if (this.owner === "hand" && pen) setWorld(this.pen, pen.p, pen.q);
    if (this.stage === "use" && this.time > 0.7) this.tipError = this.pen.localToWorld(V(0, -this.half, 0)).distanceTo(this.tipTarget);
  }
  override() {
    const blend = this.stage === "grasp" ? ease(this.time / 0.3) : ["use", "replace"].includes(this.stage) ? 1 : this.stage === "release" ? 1 - ease(this.time / 0.3) : 0;
    return this.busy ? { R: { blend, prop: this.pen, kind: "pen" } } : null;
  }
  diagnostics() {
    return { stage: this.stage, owner: this.owner, done: this.done, handError: this.handError, tipError: this.tipError };
  }
  dispose() {
    this.release();
    this.stage = "idle";
    this.ink.children.forEach((n) => n.visible = false);
  }
}
