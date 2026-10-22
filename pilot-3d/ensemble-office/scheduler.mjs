import { VisitCorridors } from "../activities/traffic.mjs";
import { GroupMeetings } from "./group-meeting.mjs";
import { InteractionScheduler } from "../activities/interaction-scheduler.mjs";
import { CoffeeActivities } from "./coffee.mjs";
export class EnsembleScheduler extends InteractionScheduler {
  constructor(...args) {
    super(...args);
    this.book = new VisitCorridors({ capacity: 3 });
    this.group = new GroupMeetings(this, args[5].model, args[5].metadata);
    this.groupIntentAt = null;
    this.nextGroup = 180;
    this.coffee = new CoffeeActivities(this, args[5].model, args[5].metadata);
    this.nextCoffee = 20;
    this.coffeeCursor = 0;
    this.threeWalkAt = null;
    this.demoGroupExpected = false;
  }
  extraBusy(id) {
    return !!this.coffee?.rows.has(id) || !!this.group?.record(id);
  }
  presentationBusy(id) {
    return this.extraBusy(id) || super.presentationBusy(id);
  }
  idle(id) {
    return !this.group?.current?.ids.includes(id) && !this.extraBusy(id) && super.idle(id);
  }
  incoming(id) {
    const row = super.incoming(id);
    return this.extraBusy(id) && row.pose === "idle" ? { ...row, pose: "waiting" } : row;
  }
  startRole(id, ...args) {
    return !this.extraBusy(id) && super.startRole(id, ...args);
  }
  getRecord(id) {
    return this.group?.record(id) ?? this.coffee?.rows.get(id) ?? this.records.get(id);
  }
  startGroupMeeting(ids = this.ids) {
    const started = this.group.start(ids);
    if (started) {
      this.groupIntentAt = null;
      this.nextGroup = this.time + 900;
    }
    return started;
  }
  startMeeting(ids = ["nara", "jun"]) {
    return ids.length === 5 ? this.startGroupMeeting(ids) : super.startMeeting(ids);
  }
  startDemo() {
    this.auto = true;
    this.introAt = this.demoAt = this.walkDemoAt = null;
    for (const id of this.ids) this.startRole(id);
    this.demoGroupExpected = true;
    this.threeWalkAt = this.time + 12;
    this.groupIntentAt = this.time + 13;
    this.nextAuto = this.time + 14;
    return true;
  }
  startThreeWalkDemo({ pair = false } = {}) {
    if (!["nara", "sora", "leo", ...pair ? ["jun"] : []].every((id) => this.idle(id))) return false;
    this.startWindow("nara");
    if (pair) this.startSofaPair(["sora", "jun"]);
    else this.startSofa("sora");
    this.startCoffee("leo");
    return true;
  }
  startCoffee(id = this.vm.selectedAgent ?? "nara") {
    return this.coffee.start(id);
  }
  setViewModel(vm) {
    super.setViewModel(vm);
    if (this.group?.current && this.group.current.ids.some((id) => this.rawIncoming(id).pose !== "idle" || vm.actors && !vm.actors.some((a) => a.agentId === id))) this.group.end("\uC5C5\uBB34 \uB3C4\uCC29/\uCC38\uAC00\uC790 \uC885\uB8CC");
    for (const id of this.coffee?.rows.keys() ?? []) if (this.rawIncoming(id).pose !== "idle" || vm.actors && !vm.actors.some((a) => a.agentId === id)) this.coffee.end(id, "\uC5C5\uBB34 \uB3C4\uCC29/\uCC38\uAC00\uC790 \uC885\uB8CC");
  }
  setAuto(value) {
    if (!value) {
      this.groupIntentAt = null;
      this.threeWalkAt = null;
      this.demoGroupExpected = false;
    }
    return super.setAuto(value);
  }
  cancelAll() {
    this.demoGroupExpected = false;
    this.threeWalkAt = null;
    this.groupIntentAt = null;
    this.group?.end("\uD65C\uB3D9 \uC815\uB9AC");
    for (const id of this.coffee?.rows.keys() ?? []) this.coffee.end(id, "\uD65C\uB3D9 \uC815\uB9AC");
    super.cancelAll();
  }
  coverage(id) {
    const c = this.counts[id];
    return { role: this.desks[id].variantsSeen.size === 3, coffee: this.coffee.counts[id] > 0, sofa: c.sofa > 0, cup: c.cup > 0, meeting: c.meeting > 0, sofaPair: this.pairCounts[id] > 0, window: this.windowCounts[id] > 0, rest: this.restCounts[id] > 0 };
  }
  fullCoverage() {
    return this.ids.every((id) => Object.values(this.coverage(id)).every(Boolean));
  }
  chooseAuto() {
    if (this.tour || this.group?.current || this.threeWalkAt !== null) return false;
    const periodic = this.time >= this.nextGroup && (this.group.history.length === 0 || this.fullCoverage());
    if ((this.groupIntentAt !== null || periodic) && this.ids.every((id) => this.rawIncoming(id).pose === "idle")) {
      this.groupIntentAt ??= this.time;
      if (this.time >= this.groupIntentAt && this.ids.every((id) => this.idle(id))) {
        if (this.startGroupMeeting()) return true;
      }
      return false;
    }
    const free = this.ids.filter((id) => this.idle(id) && (this.cooldowns.get(id) ?? 0) <= this.time), types = ["role", "coffee", "cup", "rest", "window", "sofaPair", "meeting", "sofa"];
    if (!this.fullCoverage()) {
      // Complete the missing first experiences before repeating popular actions.
      const choices = free.flatMap((id) => types.filter((kind) => !this.coverage(id)[kind]).map((kind, index) => ({ id, kind, score: Object.values(this.coverage(id)).filter(Boolean).length, rank: kind === "role" ? -1 : (types.indexOf(kind) + this.ids.indexOf(id) + this.autoRound) % types.length }))).sort((a, b) => a.score - b.score || a.rank - b.rank || this.ids.indexOf(a.id) - this.ids.indexOf(b.id));
      for (const { id, kind } of choices) {
        let started = false;
        if (kind === "role" && this.time >= (this.roleReady.get(id) ?? 0)) started = this.startRole(id, { variant: [0, 1, 2].find((v) => !this.desks[id].variantsSeen.has(v)) });
        else if (kind === "coffee" && !this.coffee.rows.size) started = this.startCoffee(id);
        else if (kind === "cup") started = this.startCup(id);
        else if (kind === "rest") started = this.startRest(id);
        else if (kind === "window") started = this.startWindow(id);
        else if (kind === "sofa" && [...this.records.values()].filter((r) => r.kind === "sofa").length < 2) started = this.startSofa(id);
        else if (kind === "sofaPair" || kind === "meeting") {
          const peers = free.filter((other) => other !== id).sort((a, b) => Number(this.coverage(a)[kind]) - Number(this.coverage(b)[kind]) || this.ids.indexOf(a) - this.ids.indexOf(b));
          if (peers.length) started = kind === "sofaPair" ? this.startSofaPair([id, peers[0]]) : this.startMeeting([id, peers[0]]);
        }
        if (started) return true;
      }
      return false;
    }
    if (this.time >= this.nextCoffee && !this.coffee.rows.size) {
      const id = free.toSorted((a, b) => this.coffee.counts[a] - this.coffee.counts[b])[0];
      if (id && this.startCoffee(id)) {
        this.nextCoffee = this.time + 50;
        return true;
      }
    }
    return super.chooseAuto();
  }
  tick(raw) {
    super.tick(raw);
    if (this.paused || this.disposed) return;
    const dt = Math.max(0, Math.min(0.06, raw));
    this.coffee.tick(dt);
    const before = this.group.current;
    this.group.tick(dt);
    if (before && !this.group.current && this.demoGroupExpected) {
      this.demoGroupExpected = false;
      if (this.group.history.at(-1)?.status === "complete") {
        this.tour = [["nara", "jun"], ["sora", "min"], ["leo", "nara"]];
        this.startSofaPair(["sora", "leo"]);
      }
    }
    if (this.threeWalkAt !== null && this.time >= this.threeWalkAt && this.startThreeWalkDemo()) this.threeWalkAt = null;
  }
  state(id) {
    return this.group?.state(id) ?? this.coffee?.state(id) ?? super.state(id);
  }
  handControl(id, side) {
    return !!this.coffee?.controls(id, side) || this.group?.controls(id, side);
  }
  handOverrides(id) {
    return { ...this.transfer?.handOverrides(id), ...this.coffee?.handOverrides(id), ...this.group?.overrides(id) };
  }
  applyCustom(id, actor) {
    this.coffee.apply(id, actor);
    this.group.apply(id);
  }
  present(id, state, dt) {
    super.present(id, state, dt);
    this.group.present(id, state, dt);
  }
  diagnostics() {
    const d = super.diagnostics();
    d.teamActivities.version = 10;
    d.teamActivities.coffee = this.coffee.diagnostics();
    d.teamActivities.group = this.group.diagnostics();
    d.teamActivities.groupIntent = this.groupIntentAt;
    for (const r of this.group.current?.records.values() ?? []) {
      const a = d.teamActivities.actors[r.id];
      a.kind = "group";
      a.stage = ["pickup", "putback"].includes(r.phase) ? r.phase : r.trip.stage;
      a.slot = r.slot;
      a.returning = this.group.current.ending;
    }
    for (const r of this.coffee.rows.values()) {
      const a = d.teamActivities.actors[r.id];
      a.kind = "coffee";
      a.stage = r.phase;
      a.returning = r.ending || ["home", "putback"].includes(r.phase);
    }
    return d;
  }
  dispose() {
    this.group?.dispose();
    this.coffee?.dispose();
    super.dispose();
  }
}
