import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { createEnsembleOffice } from "../../pilot-3d/ensemble-office/model.mjs";
import { createTeamRuntime } from "../../pilot-3d/activities/team-runtime.mjs";
import { releaseStudioAsset } from "../../pilot-3d/sample/asset-loader.mjs";
import { activityCleanup } from "../../pilot-3d/activities/team-soak.mjs";
import { routeClear } from "../../pilot-3d/final-office/destinations.mjs";
import { pointClear } from "../../pilot-3d/activities/anchors.mjs";
import { MotionClock } from "../../pilot-3d/sample/motion-clock.mjs";
const options = { auto: false, natural: true, enriched: true, expressive: true, interaction: true, refined: true, grounded: true };
function fixture() {
  const { root } = createEnsembleOffice(), runtime = createTeamRuntime(root, root.userData, options), s = runtime.scheduler, vm = { actors: s.ids.map((agentId) => ({ agentId, pose: "idle" })) };
  runtime.setViewModel(vm);
  runtime.update(0);
  return { root, runtime, s, vm, close() {
    runtime.dispose();
    releaseStudioAsset(root);
  } };
}
function until(f, p, max = 3e4) {
  for (let n = 0; n < max && !p(); n++) f.runtime.update(0.025);
  assert(p(), "group settles: " + JSON.stringify(f.s.group.diagnostics()));
}
function permutations(xs) {
  return xs.length === 1 ? [xs] : xs.flatMap((x, i) => permutations(xs.filter((_, j) => j !== i)).map((rest) => [x, ...rest]));
}
test("25 seat approaches and 120 actor orders have unique reachable supports without walking through their chairs", () => {
  const f = fixture();
  try {
    assert.equal(f.s.group.anchors.size, 25);
    for (const a of f.s.group.anchors.values()) {
      const p = a.route.map((p2) => [p2[0] + a.stationOrigin[0], p2[1], p2[2] + a.stationOrigin[2]]);
      for (let n = 2; n < p.length; n++) assert(routeClear(p[n - 1], p[n], a.colliders));
      const chair = f.root.userData.ensembleOffice.group.slots[a.slot], forward = [Math.sin(a.facing), 0, Math.cos(a.facing)], delta = p.at(-1).map((v, k) => v - chair.position[k]);
      assert(Math.abs(delta[0] * forward[0] + delta[2] * forward[2] - 0.25) < 1e-8);
      assert(Math.hypot(...[p.at(-2)[0] - chair.position[0], p.at(-2)[2] - chair.position[2]]) > 0.5);
    }
    for (const order of permutations(f.s.ids)) {
      const slots = order.map((id, i) => f.s.group.anchors.get(id + ":" + i));
      assert.equal(new Set(slots.map((a) => a.seat)).size, 5);
      assert(slots.every((a) => a.route.length >= 3));
    }
    assert.equal(permutations(f.s.ids).length, 120);
    const c = { center: [0, 0], radii: [1.7, 0.75] };
    assert(!pointClear([0, 0, 0], [c]));
    assert(pointClear([2, 0, 0], [c]));
    assert(!pointClear([1.8, 0, 0], [c]));
  } finally {
    f.close();
  }
});
test("all five sit before presentation, speak and write with one pencil owner, then safely return at four speeds", () => {
  for (const rate of [1, 1.5, 2, 3]) {
    const f = fixture(), clock = new MotionClock();
    clock.setSpeed(rate);
    try {
      assert(!f.s.startGroupMeeting(["nara", "sora", "jun"]));
      assert(!f.s.startGroupMeeting(["nara", "sora", "jun", "min"]));
      assert(f.s.startGroupMeeting(rate === 2 ? [...f.s.ids].reverse() : f.s.ids));
      assert(!f.s.startGroupMeeting());
      let talks = 0, notes = 0, maxPad = 0;
      for (let n = 0; n < 35e3 && f.s.group.current; n++) {
        clock.advance(1 / 30, true, (dt) => f.runtime.update(dt));
        const g = f.s.group.current;
        if (g && ["talk", "note"].includes(g.phase) && !g.ending) {
          assert(g.ids.every((id) => g.records.get(id).trip.stage === "rest" && f.s.cups[id].state === "tableRest"));
          talks += g.phase === "talk";
          notes += g.phase === "note";
        }
        if (n % 5 === 0) {
          for (const id of f.s.ids) {
            for (const h2 of Object.values(f.s.handGrips.diagnostics()[id])) {
              maxPad = Math.max(maxPad, h2.padError);
              assert(h2.padError < 3e-3, id + " fingers " + h2.padError);
            }
            assert(f.s.cups[id].reachError < 1e-3);
          }
          for (const note of f.s.group.notes) {
            assert(note.handError < 1e-3);
            assert(note.tipError < 1e-3);
          }
          for (const row of Object.values(f.s.meetingSupport.diagnostics())) for (const h2 of Object.values(row.hands)) assert(h2.error < 1e-3);
          assert.deepEqual(f.s.violations, []);
        }
      }
      assert(talks > 30 && notes > 30);
      assert.equal(f.s.group.current, null);
      const h = f.s.group.history.at(-1);
      assert.equal(h.status, "complete");
      assert.equal(new Set(h.spoke).size, 5);
      assert.equal(new Set(h.noted).size, 5);
      assert(f.s.ids.every((id) => f.s.group.counts[id] === 1));
      assert(activityCleanup(f.runtime.diagnostics()).passed);
    } finally {
      f.close();
    }
  }
});
test("three independent destinations admit three actual movers without lowering body or corridor radii", () => {
  const f = fixture();
  try {
    assert(f.s.startThreeWalkDemo());
    let three = false;
    for (let n = 0; n < 6e3; n++) {
      f.runtime.update(0.025);
      if (f.s.book.diagnostics().active.length === 3 && f.s.ids.filter(id => f.s.state(id).action === "walk").length === 3) three = true;
      assert(f.s.book.diagnostics().active.length <= 3);
      assert.equal(f.s.book.diagnostics().radius, 0.5);
      assert.deepEqual(f.s.violations, []);
    }
    assert(three);
    f.s.cancelAll();
    until(f, () => activityCleanup(f.runtime.diagnostics()).passed);
    assert.equal(f.s.book.diagnostics().capacity, 3);
  } finally {
    f.close();
  }
});
test("group interruption at gathering, talking and every note stage cancels presentation and returns all five", () => {
  for (const stage of ["pickup", "out", "rest", "talk", "reach", "grasp", "use", "replace", "release", "retract"]) {
    const f = fixture();
    try {
      assert(f.s.startGroupMeeting());
      until(f, () => {
        const g = f.s.group.current, r = g?.records.get("nara");
        return ["talk"].includes(stage) ? g?.phase === stage : ["pickup", "out", "rest"].includes(stage) ? r?.trip.stage === stage || r?.phase === stage : r?.note.stage === stage;
      });
      const cups = f.s.ids.map((id) => f.s.cups[id].mug);
      f.runtime.setViewModel({ actors: f.vm.actors.map((a) => a.agentId === "nara" ? { ...a, pose: "typing" } : a) });
      f.s.cancelAll();
      f.runtime.setViewModel(f.vm);
      until(f, () => activityCleanup(f.runtime.diagnostics()).passed);
      assert(!f.s.group.current);
      assert.deepEqual(f.s.ids.map((id) => f.s.cups[id].mug), cups);
      assert(f.s.ids.every((id) => f.s.cups[id].owner === "desk"));
      assert.deepEqual(f.s.violations, []);
      for (let i = 0; i < 5; i++) assert.equal(f.root.getObjectByName("GroupPencil" + i).parent.name, "GroupNoteDock" + i);
    } finally {
      f.close();
    }
  }
});
