import { Vector3 } from "three";
import { DestinationTrip } from "../activities/destinations.mjs";
import { groupAnchors } from "./station-anchors.mjs";
import { GroupNote } from "./group-notes.mjs";
export class GroupMeetings {
  constructor(s, model, metadata, { minParticipants = 5, maxParticipants = 5 } = {}) {
    this.minParticipants = minParticipants; this.maxParticipants = maxParticipants;
    this.s = s;
    this.model = model;
    this.meta = metadata;
    this.current = null;
    this.history = [];
    this.counts = Object.fromEntries(s.ids.map((id) => [id, 0]));
    this.anchors = new Map(s.ids.flatMap((id) => Array.from({ length: 5 }, (_, slot) => [id + ":" + slot, groupAnchors(metadata, id, slot)])));
    this.notes = [];
  }
  record(id) {
    return this.current?.records.get(id);
  }
  start(ids = this.s.ids) {
    if (this.current || ids.length < this.minParticipants || ids.length > this.maxParticipants || new Set(ids).size !== ids.length || ids.some((id) => !this.s.idle(id)) || this.s.session || this.s.sofaPair) return false;
    const owner = "group-meeting-" + ++this.s.serial, keys = ids.map((_, i) => "meeting-" + i);
    if (!this.s.book.acquire(owner, keys)) return false;
    const g = { withCups: !ids.every(id => this.s.personalMotion?.has(id)), ids: [...ids], records: /* @__PURE__ */ new Map(), completeReason: ids.length + "인 회의 완료", phase: "arriving", time: 0, round: 0, ending: false, presented: /* @__PURE__ */ new Map(), spoke: /* @__PURE__ */ new Set(), noted: /* @__PURE__ */ new Set(), reason: "", started: this.s.time };
    this.current = g;
    ids.forEach((id, slot) => {
      const cup = this.s.cups[id], trip = new DestinationTrip([id], this.anchors.get(id + ":" + slot), { actorId: id, owner: id + "-group", book: this.s.book, sharedTransit: true, waitLimit: 240, restDuration: Infinity, routeMotion: { speed: 0.56, period: 0.8 }, canDepart: () => (!g.withCups || cup.state === "carry") && !this.notes[slot]?.busy });
      trip.setViewModel(this.s.vm);
      this.s.configure(trip, id);
      this.s.book.transfer(owner, trip.owner, ["meeting-" + slot]);
      if (g.withCups) cup.start({ carry: true });
      const note = new GroupNote(this.model, this.s.desks[id].actor, this.meta.ensembleOffice.group.notes[slot], this.s);
      this.notes[slot] = note;
      g.records.set(id, { id, slot, kind: "group", trip, phase: g.withCups ? "pickup" : "trip", placed: false, note });
      if (!g.withCups) trip.startSofa();
    });
    return true;
  }
  end(reason = this.current?.completeReason ?? "5인 회의 완료") {
    const g = this.current;
    if (!g || g.ending) return;
    g.ending = true;
    g.reason = reason;
    for (const r of g.records.values()) {
      r.note.cancel();
      r.trip.requestReturn(reason);
      if (g.withCups) this.s.cups[r.id].returnToHand();
    }
  }
  finishRecord(r) {
    r.note.dispose();
    r.trip.dispose();
    this.s.book.release(r.trip.owner);
    this.current.records.delete(r.id);
    this.s.cooldowns.set(r.id, this.s.time + 25);
  }
  tick(dt) {
    const g = this.current;
    if (!g) return;
    g.time += dt;
    for (const r of [...g.records.values()]) {
      const cup = this.s.cups[r.id];
      r.note.tick(dt);
      if (r.phase === "pickup") {
        if (g.ending) {
          cup.requestWork();
          if (cup.state === "carry") cup.finishCarry();
          if (cup.state === "idle") this.finishRecord(r);
        } else if (cup.state === "carry") {
          r.trip.startSofa();
          r.phase = "trip";
        }
        continue;
      }
      r.trip.setViewModel(this.s.vm);
      if (g.ending) {
        r.trip.requestReturn(g.reason);
        if (g.withCups) cup.returnToHand();
      }
      r.trip.tick(dt);
      if (r.trip.stage === "rest" && !g.ending && !r.placed && cup.state === "carry") {
        cup.setDownAt(this.model.getObjectByName(this.meta.ensembleOffice.group.slots[r.slot].drop));
        r.placed = true;
      }
      if (r.trip.stage === "idle") {
        if (cup.state === "carry") {
          cup.finishCarry();
          r.phase = "putback";
        } else if (cup.state === "idle" && !r.note.busy) this.finishRecord(r);
      }
    }
    if (!g.records.size) {
      const complete = g.spoke.size === g.ids.length && g.noted.size === g.ids.length && g.reason === g.completeReason;
      this.history.push({ ids: [...g.ids], status: complete ? "complete" : "cancelled", reason: g.reason, spoke: [...g.spoke], noted: [...g.noted], seconds: g.time });
      if (this.history.length > 20) this.history.shift();
      if (complete) {
        this.s.meetings++;
        for (const id of g.ids) {
          this.counts[id]++;
          this.s.counts[id].meeting++;
        }
      }
      this.current = null;
      this.notes = [];
      return;
    }
    if (g.ending) return;
    if (g.phase === "arriving") {
      if (g.ids.every((id) => g.records.get(id)?.trip.stage === "rest" && (!g.withCups || this.s.cups[id].state === "tableRest"))) {
        g.phase = "talk";
        g.presented = new Map(g.ids.map((id) => [id, 0]));
      } else if (g.time > 240) this.end("\uD68C\uC758 \uB3C4\uCC29 \uB300\uAE30 \uC885\uB8CC");
      return;
    }
    if (g.phase === "talk" && g.ids.every((id) => (g.presented.get(id) ?? 0) >= 3.2)) {
      const id = g.ids[g.round], r = g.records.get(id);
      g.spoke.add(id);
      r.note.start();
      g.phase = "note";
      g.presented = new Map(g.ids.map((id2) => [id2, 0]));
    } else if (g.phase === "note") {
      const id = g.ids[g.round], r = g.records.get(id);
      if (!r.note.busy && r.note.done > 0 && g.ids.every((id2) => (g.presented.get(id2) ?? 0) >= 0.5)) {
        g.noted.add(id);
        g.round++;
        if (g.round >= g.ids.length) this.end();
        else {
          g.phase = "talk";
          g.presented = new Map(g.ids.map((id2) => [id2, 0]));
        }
      }
    }
  }
  state(id) {
    const g = this.current, r = g?.records.get(id);
    if (!r) return null;
    const base = r.phase === "pickup" || r.phase === "putback" ? { action: "waiting", time: this.s.time } : r.trip.state(id), state = { ...base, activity: "meeting", groupRound: g.round, returning: g.ending };
    if (r.trip.stage === "rest") {
      const speaker = g.ids[g.round], talk = g.phase === "talk" && !g.ending;
      return { ...state, action: g.ending ? "meeting_wait" : g.phase === "arriving" ? "meeting_wait" : g.phase === "note" && id === speaker ? "group_note" : talk && id === speaker ? "meeting_talk" : "meeting_listen", time: g.presented.get(id) ?? 0, gesture: talk && id === speaker ? Math.sin(Math.PI * Math.min(1, (g.presented.get(id) ?? 0) / 3.2)) : 0, note: g.phase === "note" && id === speaker, lookAt: g.phase === "note" && id === speaker ? void 0 : id === speaker ? g.ids[(g.round + 1) % g.ids.length] : speaker, ...g.phase === "note" && id === speaker ? { gazePoint: r.note.parent.localToWorld(new Vector3(0, 0.7545, -0.04)).toArray() } : {}, groupPhase: g.phase };
    }
    return state;
  }
  present(id, state, dt) {
    const g = this.current;
    if (g && !g.ending && g.phase === state.groupPhase && g.round === state.groupRound && g.ids.every((id2) => g.records.get(id2)?.trip.stage === "rest" && (!g.withCups || this.s.cups[id2].state === "tableRest"))) g.presented.set(id, (g.presented.get(id) ?? 0) + dt);
  }
  apply(id) {
    this.record(id)?.note.apply();
  }
  controls(id, side) {
    return side === "R" && !!this.record(id)?.note.busy;
  }
  overrides(id) {
    return this.record(id)?.note.override();
  }
  diagnostics() {
    const g = this.current;
    return { counts: { ...this.counts }, history: [...this.history], current: g ? { ids: [...g.ids], withCups: g.withCups, phase: g.phase, round: g.round, ending: g.ending, spoke: [...g.spoke], noted: [...g.noted], time: g.time, actors: [...g.records.values()].map((r) => ({ id: r.id, slot: r.slot, stage: r.trip.stage, phase: r.phase, note: r.note.diagnostics() })) } : null };
  }
  dispose() {
    for (const r of this.current?.records.values() ?? []) {
      r.note.dispose();
      r.trip.dispose();
      this.s.book.release(r.trip.owner);
    }
    this.current = null;
    this.notes = [];
  }
}
