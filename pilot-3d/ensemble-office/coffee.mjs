import * as T from "three";
import { StandingTrip } from "./standing-trip.mjs";
import { coffeeAnchors } from "./station-anchors.mjs";
import { part } from "../sample/character-rig.mjs";
import { solveArm } from "../activities/interactions.mjs";
import { poseFor } from "../sample/poses.mjs";
import { ease } from "../sample/motion.mjs";
const V = (...p) => new T.Vector3(...p);
export class CoffeeActivities {
  constructor(scheduler, model, metadata) {
    this.s = scheduler;
    this.model = model;
    this.meta = metadata;
    this.rows = /* @__PURE__ */ new Map();
    this.counts = Object.fromEntries(scheduler.ids.map((id) => [id, 0]));
    this.history = [];
    this.anchors = new Map(scheduler.ids.map((id) => [id, coffeeAnchors(metadata, id)]));
    const m = metadata.ensembleOffice.coffee;
    this.drop = model.getObjectByName(m.drop);
    this.button = model.getObjectByName(m.button);
    this.flow = model.getObjectByName(m.flow);
    this.flowBase = { p: this.flow.position.clone(), s: this.flow.scale.clone() };
    this.buttonBase = this.button.material.emissiveIntensity;
    this.maxHandError = 0;
    this.presses = 0;
  }
  start(id) {
    if (!this.s.idle(id)) return false;
    this.rows.set(id, { id, owner: id + "-coffee", phase: "queued", time: 0, age: 0, ending: false, brewed: false, stages: ["queued"] });
    return true;
  }
  enter(r, phase) {
    r.phase = phase;
    r.time = 0;
    r.stages.push(phase);
  }
  end(id, reason = "\uCEE4\uD53C \uC0AC\uC6A9 \uC911\uB2E8") {
    const r = this.rows.get(id);
    if (!r) return;
    r.ending = true;
    r.reason = reason;
    if (r.phase === "queued") {
      this.finish(r);
      return;
    }
    if (r.trip?.stage !== "idle") {
      r.trip.requestReturn(reason);
      this.s.cups[id].returnToHand();
    } else this.s.cups[id].requestWork();
  }
  finish(r) {
    const c = this.s.cups[r.id];
    r.trip?.dispose();
    this.s.book.release(r.owner);
    this.rows.delete(r.id);
    this.s.cooldowns.set(r.id, this.s.time + 25);
    this.history.push({ id: r.id, status: r.brewed && !r.ending ? "complete" : "cancelled", reason: r.reason ?? "", stages: [...r.stages], time: this.s.time });
    if (this.history.length > 40) this.history.shift();
    if (r.brewed && !r.ending) this.counts[r.id]++;
    this.flow.visible = false;
    this.flow.position.copy(this.flowBase.p);
    this.flow.scale.copy(this.flowBase.s);
    this.button.material.emissiveIntensity = this.buttonBase;
    const liquid = this.model.getObjectByName(this.meta.ensembleOffice.cups[r.id].liquid);
    liquid.position.y = 0.028;
    liquid.scale.x = liquid.scale.z = 1;
  }
  tick(dt) {
    const s = this.s;
    this.flow.visible = false;
    this.button.material.emissiveIntensity = this.buttonBase;
    for (const r of [...this.rows.values()]) {
      r.time += dt;
      r.age += dt;
      const cup = s.cups[r.id];
      if ((r.phase === "queued" ? r.age > 600 : s.time - (r.startedAt ?? s.time) > 240) && !r.ending) this.end(r.id, "\uCEE4\uD53C \uC774\uB3D9 \uB300\uAE30 \uC885\uB8CC");
      if (!this.rows.has(r.id)) continue;
      if (r.phase === "queued") {
        if (s.book.request(r.owner, ["coffee-0"])) {
          r.startedAt = s.time;
          r.trip = new StandingTrip([r.id], this.anchors.get(r.id), { actorId: r.id, owner: r.owner, book: s.book, sharedTransit: true, waitLimit: 180, routeMotion: { speed: 0.56, period: 0.8 }, canDepart: () => cup.state === "carry" });
          s.configure(r.trip, r.id);
          r.trip.setViewModel(s.vm);
          cup.start({ carry: true });
          this.enter(r, "pickup");
        }
        continue;
      }
      if (r.phase === "pickup") {
        if (r.ending) {
          cup.requestWork();
          if (cup.state === "carry") cup.finishCarry();
          if (cup.state === "idle") this.finish(r);
        } else if (cup.state === "carry") {
          r.trip.startSofa();
          this.enter(r, "out");
        }
        continue;
      }
      r.trip.setViewModel(s.vm);
      if (r.ending) {
        r.trip.requestReturn(r.reason);
        cup.returnToHand();
      }
      r.trip.tick(dt);
      if (r.trip.stage === "rest" && !r.ending) {
        if (r.phase === "out") {
          cup.setDownAt(this.drop);
          this.enter(r, "place");
        } else if (r.phase === "place" && cup.state === "tableRest") {
          this.enter(r, "press");
        } else if (r.phase === "press") {
          this.button.material.emissiveIntensity = 0.18 + 0.5 * Math.sin(Math.PI * Math.min(1, r.time / 1.4));
          if (r.time >= 1.4) {
            this.presses++;
            this.enter(r, "brew");
          }
        } else if (r.phase === "brew") {
          const u = Math.min(1, r.time / 3.2), liquid = this.model.getObjectByName(this.meta.ensembleOffice.cups[r.id].liquid);
          liquid.position.y = 0.012 + 0.016 * u;
          liquid.scale.x = liquid.scale.z = 0.95 + 0.05 * u;
          this.flow.visible = true;
          const surface = this.drop.getWorldPosition(V()).y + liquid.position.y;
          this.flow.scale.y = 1.045 - surface;
          this.flow.position.y = (1.045 + surface) / 2;
          if (r.time >= 3.2) {
            r.brewed = true;
            cup.returnToHand();
            this.enter(r, "retrieve");
          }
        } else if (r.phase === "retrieve" && cup.state === "carry") {
          r.trip.requestReturn("\uC74C\uB8CC \uC900\uBE44 \uC644\uB8CC");
          this.enter(r, "home");
        }
      }
      if (r.ending && r.trip.stage !== "idle" && cup.state === "idle" && r.trip.stage === "rest") {
        r.trip.options.canDepart = () => true;
      }
      if (r.trip.stage === "idle") {
        if (cup.state === "carry") {
          cup.finishCarry();
          this.enter(r, "putback");
        } else if (cup.state === "idle") this.finish(r);
      }
    }
  }
  state(id) {
    const r = this.rows.get(id);
    if (!r) return null;
    const base = r.trip && r.trip.stage !== "idle" ? r.trip.state(id) : { action: "idle", pose: poseFor(id, "idle", this.s.time), time: this.s.time };
    return { ...base, activity: "coffee", coffeePhase: r.phase, returning: r.ending || ["home", "putback"].includes(r.phase), ...r.trip?.stage === "rest" ? { action: r.phase === "press" ? "coffee_press" : "coffee_wait", gazePoint: (r.phase === "press" ? this.button : this.s.cups[id].mug).getWorldPosition(V()).toArray() } : {} };
  }
  pressAmount(r) {
    return r?.phase === "press" ? ease(r.time / 0.4) * (1 - ease((r.time - 1) / 0.4)) : 0;
  }
  apply(id, actor) {
    const r = this.rows.get(id), u = this.pressAmount(r);
    if (!u) return;
    const hand = part(actor, "NaraHandR"), from = hand.getWorldPosition(V()), fromQ = hand.getWorldQuaternion(new T.Quaternion()), q = new T.Quaternion().setFromUnitVectors(V(0, -1, 0), V(1, 0, 0)), face = this.button.localToWorld(V(0, 65e-4, 0)), target = face.clone().sub(V(-0.027, -0.077, 0.011).applyQuaternion(q));
    this.maxHandError = Math.max(this.maxHandError, solveArm(actor, from.lerp(target, u), fromQ.slerp(q, u), "R"));
  }
  controls(id, side) {
    return side === "R" && this.pressAmount(this.rows.get(id)) > 0;
  }
  handOverrides(id) {
    const r = this.rows.get(id);
    return r?.phase === "press" ? { R: { blend: this.pressAmount(r), prop: this.button, kind: "button" } } : null;
  }
  diagnostics() {
    return { counts: { ...this.counts }, presses: this.presses, handError: this.maxHandError, active: [...this.rows.values()].map((r) => ({ id: r.id, phase: r.phase, stage: r.trip?.stage ?? "queued", ending: r.ending, seconds: r.age })), history: [...this.history], flow: this.flow.visible };
  }
  dispose() {
    for (const id of this.s.ids) {
      const liquid = this.model.getObjectByName(this.meta.ensembleOffice.cups[id]?.liquid);
      if (liquid) {
        liquid.position.y = 0.028;
        liquid.scale.x = liquid.scale.z = 1;
      }
    }
    for (const r of this.rows.values()) {
      r.trip?.dispose();
      this.s.book.release(r.owner);
    }
    this.rows.clear();
    this.flow.visible = false;
    this.flow.position.copy(this.flowBase.p);
    this.flow.scale.copy(this.flowBase.s);
    this.button.material.emissiveIntensity = this.buttonBase;
  }
}
