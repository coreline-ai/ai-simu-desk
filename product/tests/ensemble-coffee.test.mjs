import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { createEnsembleOffice } from "../../pilot-3d/ensemble-office/model.mjs";
import { createTeamRuntime } from "../../pilot-3d/activities/team-runtime.mjs";
import { releaseStudioAsset } from "../../pilot-3d/sample/asset-loader.mjs";
import { activityCleanup } from "../../pilot-3d/activities/team-soak.mjs";
import { LocalActivityAudio } from "../../pilot-3d/ensemble-office/audio.mjs";
import { routeClear } from "../../pilot-3d/final-office/destinations.mjs";
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
function until(f, p, max = 2e4) {
  for (let n = 0; n < max && !p(); n++) f.runtime.update(1 / 60);
  assert(p(), "coffee settles: " + JSON.stringify(f.s.coffee.diagnostics()));
}
test("all five coffee paths clear measured furniture and the cup rests on the actual drip tray", () => {
  const f = fixture();
  try {
    for (const a of f.s.coffee.anchors.values()) {
      const points = a.route.map((p) => [p[0] + a.stationOrigin[0], p[1], p[2] + a.stationOrigin[2]]);
      for (let n = 2; n < points.length; n++) assert(routeClear(points[n - 1], points[n], a.colliders));
    }
    assert.equal(f.s.coffee.anchors.size, 5);
    const tray = f.root.getObjectByName("CoffeeDripTray"), drop = f.s.coffee.drop;
    f.root.updateMatrixWorld(true);
    assert(Math.abs(drop.getWorldPosition(new T.Vector3()).y - 0.0375 - new T.Box3().setFromObject(tray).max.y - 5e-4) < 1e-5);
  } finally {
    f.close();
  }
});
test("five actors queue fairly, place cups, press the button, brew, retrieve and return without shared ownership", () => {
  const f = fixture();
  try {
    for (const id of f.s.ids) assert(f.s.startCoffee(id));
    let pressed = 0;
    until(f, () => {
      const rows = [...f.s.coffee.rows.values()].filter((r) => !["queued", "putback"].includes(r.phase));
      assert(rows.length <= 1);
      for (const id of f.s.ids) {
        assert(f.s.cups[id].reachError < 1e-3);
        for (const h of Object.values(f.s.handGrips.diagnostics()[id])) assert(h.padError < 3e-3, id + " coffee finger " + h.padError);
      }
      pressed = Math.max(pressed, f.s.coffee.presses);
      assert.deepEqual(f.s.violations, []);
      return !f.s.coffee.rows.size;
    }, 6e4);
    assert.equal(pressed, 5);
    assert(f.s.ids.every((id) => f.s.coffee.counts[id] === 1));
    assert.deepEqual(f.s.coffee.history.map((r) => r.id), f.s.ids);
    assert(f.s.coffee.history.every((r) => r.status === "complete" && ["place", "press", "brew", "retrieve", "home", "putback"].every((s) => r.stages.includes(s))));
    assert(f.s.coffee.maxHandError < 1e-3);
    assert(activityCleanup(f.runtime.diagnostics()).passed);
  } finally {
    f.close();
  }
});
test("coffee work interruption during every stage returns the same cup and releases station, path and spot", () => {
  for (const phase of ["queued", "pickup", "out", "place", "press", "brew", "retrieve", "home", "putback"]) {
    const f = fixture();
    try {
      assert(f.s.startCoffee("nara"));
      until(f, () => f.s.coffee.rows.get("nara")?.phase === phase);
      const cup = f.s.cups.nara.mug;
      f.runtime.setViewModel({ actors: f.vm.actors.map((a) => a.agentId === "nara" ? { ...a, pose: "typing" } : a) });
      f.s.cancelAll();
      f.runtime.setViewModel(f.vm);
      until(f, () => !f.s.coffee.rows.size);
      until(f, () => activityCleanup(f.runtime.diagnostics()).passed);
      assert.equal(f.s.cups.nara.mug, cup);
      assert.equal(f.s.cups.nara.owner, "desk");
      assert.equal(f.s.book.spots.size, 0);
      assert.deepEqual(f.s.violations, []);
    } finally {
      f.close();
    }
  }
});
test("local synthesized effects are gesture enabled, bounded, muted, paused and disposed with one context", async () => {
  let made = 0, time = 0;
  const nodes = [];
  function node() {
    const n = { connect() {
    }, disconnect() {
      this.disconnected = true;
    }, frequency: { setValueAtTime() {
    }, exponentialRampToValueAtTime() {
    } }, gain: { setValueAtTime() {
    }, exponentialRampToValueAtTime() {
    } }, start() {
    }, stop() {
    } };
    nodes.push(n);
    return n;
  }
  const ctx = { state: "suspended", currentTime: 0, destination: {}, async resume() {
    this.state = "running";
  }, async suspend() {
    this.state = "suspended";
  }, async close() {
    this.state = "closed";
  }, createOscillator: node, createGain: node }, a = new LocalActivityAudio({ contextFactory: () => {
    made++;
    return ctx;
  }, now: () => time });
  assert(!a.play("cup"));
  assert.equal(made, 0);
  await a.enable(true);
  await a.enable(true);
  assert.equal(made, 1);
  for (let n = 0; n < 100; n++) {
    time += 0.1;
    a.play("cup");
    a.play("key");
  }
  assert(a.diagnostics().maxVoices <= 12);
  a.pause(true);
  assert.equal(a.voices.size, 0);
  assert(!a.play("cup"));
  a.pause(false);
  await a.enable(false);
  assert(!a.play("cup"));
  await a.enable(true);
  await a.dispose();
  assert.equal(ctx.state, "closed");
  assert.equal(a.voices.size, 0);
  assert(nodes.every((n) => n.disconnected));
  assert(!await a.enable(true));
});
