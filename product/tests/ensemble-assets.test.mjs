import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createEnsembleOffice, validateEnsembleOffice } from "../../pilot-3d/ensemble-office/model.mjs";
import { createTeamRuntime } from "../../pilot-3d/activities/team-runtime.mjs";
import { releaseStudioAsset } from "../../pilot-3d/sample/asset-loader.mjs";
import { activityCleanup } from "../../pilot-3d/activities/team-soak.mjs";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { validateOfficeAsset } from "../../pilot-3d/sample/asset-contract.mjs";
import { EnsembleRoute, MOTION_PROFILES } from "../../pilot-3d/ensemble-office/motion.mjs";
import { GroundedRoute } from "../../pilot-3d/activities/grounded-route.mjs";
import { MotionClock } from "../../pilot-3d/sample/motion-clock.mjs";
import { createFinalOffice } from "../../pilot-3d/final-office/model.mjs";
const options = { auto: false, natural: true, enriched: true, expressive: true, interaction: true, refined: true, grounded: true };
function fixture(args = {}) {
  const { root, animations } = createEnsembleOffice(args), runtime = createTeamRuntime(root, root.userData, options), s = runtime.scheduler, vm = { actors: s.ids.map((agentId) => ({ agentId, pose: "idle" })) };
  runtime.setViewModel(vm);
  runtime.update(0);
  return { root, animations, runtime, s, vm, close() {
    runtime.dispose();
    releaseStudioAsset(root);
  } };
}
function until(f, predicate, max = 12e3) {
  for (let n = 0; n < max && !predicate(); n++) f.runtime.update(1 / 60);
  assert(predicate(), "action settles");
}
test("exported Nara GLB reloads with all original bindings and usable enhanced parts", async () => {
  const bytes = await readFile("product/evidence/ensemble-activities/nara-prototype.glb");
  globalThis.self ??= globalThis;
  const loader = new GLTFLoader();
  loader.register((parser) => {
    parser.textureLoader = { load(_url, done) {
      const texture = new T.Texture();
      queueMicrotask(() => done(texture));
      return texture;
    } };
    return { name: "TestDecoder" };
  });
  const gltf2 = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), "");
  let runtime;
  try {
    const meta = validateOfficeAsset(gltf2);
    validateEnsembleOffice(gltf2, { prototype: true });
    runtime = createTeamRuntime(gltf2.scene, meta, options);
    runtime.setViewModel({ actors: meta.actorIds.map((agentId) => ({ agentId, pose: "idle" })) });
    runtime.update(0);
    gltf2.scene.updateMatrixWorld(true);
    assert(Math.abs(new T.Box3().setFromObject(gltf2.scene.getObjectByName("NaraTurningPage")).max.y - runtime.scheduler.desks.nara.contactY) < 2e-4);
    assert(runtime.scheduler.startRole("nara", { variant: 1 }));
    for (let n = 0; n < 900; n++) {
      runtime.update(1 / 60);
      assert(runtime.scheduler.desks.nara.handError < 1e-3);
      assert(runtime.scheduler.desks.nara.tipError < 1e-3);
    }
    assert(runtime.diagnostics().teamActivities.assetDetails.nara.pageFlips > 0);
    assert(activityCleanup(runtime.diagnostics()).passed);
  } finally {
    runtime?.dispose();
    releaseStudioAsset(gltf2.scene);
  }
});
test("Nara asset prototype preserves five rigs and the original motion contract while adding real notebook and pencil geometry", async () => {
  const f = fixture({ enhancedActors: ["nara"] });
  try {
    validateEnsembleOffice({ scene: f.root }, { prototype: true });
    assert.throws(() => validateEnsembleOffice({ scene: f.root }));
    assert.equal(f.animations.length, 105);
    assert.equal(f.root.userData.actorIds.length, 5);
    const pen = f.s.desks.nara.prop;
    pen.geometry.computeBoundingBox();
    assert(Math.abs(pen.geometry.boundingBox.min.y + f.s.desks.nara.half) < 1e-6);
    assert(pen.material.vertexColors);
    assert.equal(f.root.getObjectByName("NaraWrittenStrokes").children.length, 6);
    f.root.updateMatrixWorld(true);
    const page = f.root.getObjectByName("NaraTurningPage"), top = new T.Box3().setFromObject(page).max.y;
    assert(Math.abs(top - f.s.desks.nara.contactY) < 2e-4);
    const hands = f.s.handGrips.diagnostics();
    assert.equal(hands.nara.R.surfaceVersion, 2);
    assert.equal(hands.jun.R.surfaceVersion, 1);
  } finally {
    f.close();
  }
  const baseline = JSON.parse(await readFile("product/evidence/ensemble-activities/baseline.json"));
  for (const [p, h] of Object.entries(baseline.assetHashes)) assert.equal(createHash("sha256").update(await readFile(p)).digest("hex"), h);
});
test("Nara writing and page reading keep pencil and five-finger contacts continuous and return the animated page", () => {
  const f = fixture({ enhancedActors: ["nara"] });
  try {
    for (const variant of [0, 1, 2]) {
      assert(f.s.startRole("nara", { variant }));
      let ink = false, flip = false, previous;
      for (let n = 0; n < 1200 && f.s.desks.nara.busy; n++) {
        f.runtime.update(1 / 60);
        const d = f.s.desks.nara, detail = f.runtime.diagnostics().teamActivities.assetDetails.nara;
        ink ||= detail.inkLines > 0;
        flip ||= detail.pageAngle > 0.1;
        assert(d.handError < 1e-3);
        assert(d.tipError < 1e-3);
        const position = d.prop.getWorldPosition(new T.Vector3());
        if (previous && d.stage === "use") assert(position.distanceTo(previous) < 0.02, "pen motion stays continuous");
        previous = position;
        for (const h of Object.values(f.s.handGrips.diagnostics().nara)) assert(h.padError < 3e-3);
      }
      assert(!f.s.desks.nara.busy);
      assert.equal(f.s.desks.nara.owner, "desk");
      if (variant === 1) assert(flip);
      else assert(ink);
      assert.equal(f.root.getObjectByName("NaraPageHinge").rotation.z, 0);
      assert(f.root.getObjectByName("NaraWrittenStrokes").children.filter((n) => n.visible).length > 0, "written marks remain while reading and putting the pencil away");
    }
    assert.deepEqual(f.s.violations, []);
    assert(activityCleanup(f.runtime.diagnostics()).passed);
  } finally {
    f.close();
  }
});
test("Nara enhanced props recover from interruption at every role stage without surface duplicates", () => {
  for (const stage of ["reach", "grasp", "use", "replace", "release", "retract"]) {
    const f = fixture({ enhancedActors: ["nara"] });
    try {
      assert(f.s.startRole("nara", { variant: 1 }));
      until(f, () => f.s.desks.nara.stage === stage);
      f.runtime.setViewModel({ actors: f.vm.actors.map((a) => a.agentId === "nara" ? { ...a, pose: "typing" } : a) });
      f.s.cancelAll();
      f.runtime.setViewModel(f.vm);
      until(f, () => activityCleanup(f.runtime.diagnostics()).passed);
      f.runtime.update(1 / 60);
      assert.equal(f.root.getObjectByName("NaraPageHinge").rotation.z, 0);
      const actor = f.root.getObjectByName(f.root.userData.bindings.nara.actor);
      let surfaces = 0;
      actor.traverse((n) => {
        if (n.name === "EnsembleHandSurface") surfaces++;
      });
      assert.equal(surfaces, 2);
      f.runtime.dispose();
      assert.equal(actor.getObjectByName("EnsembleHandSurface"), void 0);
    } finally {
      f.close();
    }
  }
});
test("all five enhanced characters have stable anatomy, garment details and original sole height", () => {
  const f = fixture();
  try {
    validateEnsembleOffice({ scene: f.root });
    const hands = f.s.handGrips.diagnostics();
    for (const id of f.s.ids) {
      for (const side of ["L", "R"]) assert.equal(hands[id][side].surfaceVersion, 2);
      assert.equal(f.root.userData.ensembleOffice.bodies[id].folds.length, 4);
      const actor = f.root.getObjectByName(f.root.userData.bindings[id].actor);
      f.runtime.setViewModel({ actors: f.vm.actors.map((a) => a.agentId === id ? { ...a, pose: "standing" } : a) });
      for (let n = 0; n < 30; n++) f.runtime.update(1 / 60);
      for (const name of f.root.userData.bindings[id].feet) {
        const foot = actor.getObjectByName(name), sole = foot.getObjectByName(actor.userData.prefix + "_Sole" + name.at(-1));
        assert(sole);
        assert(Math.abs(new T.Box3().setFromObject(foot).min.y - new T.Box3().setFromObject(sole).min.y) < 1e-5, "new detail must not extend below the actual sole");
      }
      f.runtime.setViewModel(f.vm);
    }
  } finally {
    f.close();
  }
});
test("new route has first-step, cruise, arrival and foot-led pivot with continuous endpoints", () => {
  const points = [[0, 0, 0], [0, 0, 2], [1.5, 0, 2]], route = new EnsembleRoute(points, Math.PI / 2, { speed: 0.58, period: MOTION_PROFILES.sora.period, colliders: [], origin: [0, 0, 0] }), phases = /* @__PURE__ */ new Set();
  let previous;
  for (let n = 0; n < 1800 && !route.done; n++) {
    route.tick(1 / 60);
    const p = route.state();
    phases.add(p.ensemblePhase);
    assert(p.feet.every((f) => f.position.every(Number.isFinite)));
    if (previous) assert(Math.hypot(p.x - previous.x, p.z - previous.z) < 0.02);
    previous = p;
  }
  assert(route.done);
  assert.deepEqual([...phases].sort(), ["arrival", "cruise", "first_step", "pivot"]);
  const end = route.state();
  assert(Math.hypot(end.x - 1.5, end.z - 2) < 1e-5);
  assert(route.parts.filter((b) => b.kind === "walk").every((b) => b.ramp > 0.28));
});
test("five actors walk, sit, return for work and release their seats safely at all four visual rates", () => {
  for (const rate of [1, 1.5, 2, 3]) {
    const f = fixture(), clock = new MotionClock();
    clock.setSpeed(rate);
    const step = () => clock.advance(1 / 60, true, (dt) => f.runtime.update(dt)), wait = (predicate) => {
      for (let n = 0; n < 15e3 && !predicate(); n++) step();
      assert(predicate(), "movement settles at x" + rate);
    };
    try {
      for (const id of f.s.ids) {
        assert(f.s.startWindow(id));
        assert.equal(f.s.records.get(id).trip.options.routeFactory, EnsembleRoute);
        wait(() => f.s.records.get(id)?.trip.stage === "rest");
        assert.deepEqual(f.s.violations, []);
        f.runtime.setViewModel({ actors: f.vm.actors.map((a) => a.agentId === id ? { ...a, pose: "typing" } : a) });
        wait(() => !f.s.records.has(id));
        f.runtime.setViewModel(f.vm);
        f.s.cancelAll();
        wait(() => activityCleanup(f.runtime.diagnostics()).passed);
        assert(f.s.startSofa(id));
        wait(() => f.s.records.get(id)?.trip.stage === "rest");
        for (let n = 0; n < 120; n++) step();
        for (const h of Object.values(f.s.sofaSupport.diagnostics()[id]?.hands ?? {})) assert(h.error < 1e-3);
        f.s.cancelAll();
        wait(() => activityCleanup(f.runtime.diagnostics()).passed);
        assert.deepEqual(f.s.violations, []);
      }
      assert(f.s.startMeeting(["nara", "leo"]));
      wait(() => f.s.session?.phase === "discussion");
      f.s.cancelAll();
      wait(() => activityCleanup(f.runtime.diagnostics()).passed);
    } finally {
      f.close();
    }
  }
});
test("v9 baseline keeps its route and hand surface when enhanced profile is absent", () => {
  const { root } = createFinalOffice(), runtime = createTeamRuntime(root, root.userData, options);
  try {
    const s = runtime.scheduler;
    runtime.setViewModel({ actors: s.ids.map((agentId) => ({ agentId, pose: "idle" })) });
    assert(s.startWindow("nara"));
    assert.equal(s.records.get("nara").trip.options.routeFactory, GroundedRoute);
    runtime.update(1 / 60);
    assert.equal(s.handGrips.diagnostics().nara.R.surfaceVersion, 1);
    assert.equal(runtime.diagnostics().teamActivities.assetDetails, void 0);
  } finally {
    runtime.dispose();
    releaseStudioAsset(root);
  }
});
test("all five hollow cups have a physical rim, lower liquid and a supported coaster, and sip safely", () => {
  const f = fixture();
  try {
    for (const id of f.s.ids) {
      const row = f.root.userData.ensembleOffice.cups[id], c = f.s.cups[id], coaster = f.root.getObjectByName(row.coaster), liquid = f.root.getObjectByName(row.liquid);
      f.root.updateMatrixWorld(true);
      assert(Math.abs(new T.Box3().setFromObject(coaster).max.y - row.coasterTop) < 1e-5);
      assert(Math.abs(new T.Box3().setFromObject(c.mug).min.y - row.coasterTop - row.baseGap) < 1e-4);
      assert(liquid.position.y < 0.032);
      assert(f.s.startCup(id));
      let sip = false;
      until(f, () => {
        sip ||= c.state === "sip";
        assert(c.reachError < 1e-3);
        for (const h of Object.values(f.s.handGrips.diagnostics()[id])) assert(h.padError < 3e-3);
        return !f.s.records.has(id);
      });
      assert(sip);
      assert.equal(c.owner, "desk");
    }
    assert(activityCleanup(f.runtime.diagnostics()).passed);
  } finally {
    f.close();
  }
});
test("paper flex pins the grip, keeps thickness and restores each page after all twenty directed transfers", () => {
  const f = fixture();
  try {
    for (const visitor of f.s.ids) for (const host of f.s.ids.filter((id) => id !== visitor)) {
      assert(f.s.startVisit(visitor, host, { transfer: true }), visitor + " -> " + host);
      let bent = false;
      until(f, () => {
        for (const p of f.s.transfer.pages.values()) {
          const data = p.mesh.userData.pageBend;
          if (data) {
            assert(Math.abs(data.top - data.bottom - 2e-3) < 1e-8);
            if (Math.abs(data.amount) > 5e-4) bent = true;
          }
        }
        for (const id of [visitor, host]) for (const h of Object.values(f.s.handGrips.diagnostics()[id])) assert(h.padError < 3e-3, visitor + " -> " + host + " " + h.padError);
        assert(f.s.transfer.handError < 1e-3);
        return !f.s.visit;
      });
      assert(bent);
      assert(f.s.visitHistory.at(-1).transferComplete);
      assert.deepEqual(f.s.violations, []);
      assert(activityCleanup(f.runtime.diagnostics()).passed);
      for (const p of f.s.transfer.pages.values()) {
        assert.equal(p.mesh.userData.pageBend?.amount ?? 0, 0);
        assert(p.owner.startsWith("desk:"));
      }
    }
  } finally {
    f.close();
  }
});
test("new cup and paper surfaces survive staged work interruption and release the same objects", () => {
  for (const id of ["nara", "sora", "jun", "min", "leo"]) for (const stage of ["reach", "grasp", "lift", "sip", "lower", "place", "release"]) {
    const f = fixture();
    try {
      assert(f.s.startCup(id));
      until(f, () => f.s.cups[id].state === stage);
      const cup = f.s.cups[id].mug;
      f.runtime.setViewModel({ actors: f.vm.actors.map((a) => a.agentId === id ? { ...a, pose: "typing" } : a) });
      f.s.cancelAll();
      f.runtime.setViewModel(f.vm);
      until(f, () => activityCleanup(f.runtime.diagnostics()).passed);
      assert.equal(f.s.cups[id].mug, cup);
      assert.equal(f.s.cups[id].owner, "desk");
      assert(f.s.cups[id].reachError < 1e-3);
    } finally {
      f.close();
    }
  }
  for (const stage of ["pickup", "grasp", "present", "receive", "accept", "read", "giveback", "regrasp", "return", "release"]) {
    const f = fixture();
    try {
      assert(f.s.startVisit("nara", "jun", { transfer: true }));
      until(f, () => f.s.transfer.stage === stage);
      const page = f.s.transfer.page.mesh;
      f.s.cancelAll();
      until(f, () => activityCleanup(f.runtime.diagnostics()).passed);
      assert.equal(f.s.transfer.page.mesh, page);
      assert(f.s.transfer.pages.size === 5);
      assert.equal(page.userData.pageBend?.amount ?? 0, 0);
      assert.deepEqual(f.s.violations, []);
    } finally {
      f.close();
    }
  }
});
test("all five role assets complete three variants with physical support and restored device positions", () => {
  const f = fixture();
  try {
    for (const id of f.s.ids) for (const variant of [0, 1, 2]) {
      assert(f.s.startRole(id, { variant }));
      let used = false;
      until(f, () => {
        const d = f.s.desks[id];
        used ||= d.stage === "use";
        assert(d.handError < 1e-3, id + " wrist");
        assert(d.tipError < 1e-3, id + " tip");
        for (const h of Object.values(f.s.handGrips.diagnostics()[id])) assert(h.padError < 3e-3, id + " fingers " + h.padError);
        return !d.busy;
      });
      assert(used);
      assert.equal(f.s.desks[id].owner, "desk");
    }
    assert(f.runtime.diagnostics().teamActivities.assetDetails.sora.roleMarks > 0);
    assert(f.runtime.diagnostics().teamActivities.assetDetails.min.roleMarks > 0);
    const leo = f.s.desks.leo.prop;
    f.root.updateMatrixWorld(true);
    assert(Math.abs(new T.Box3().setFromObject(leo).min.y - 0.7535) < 1e-4);
    assert.equal(f.root.getObjectByName("JunPrecisionMouse").position.x, 0.27);
    assert.deepEqual(f.s.violations, []);
    assert(activityCleanup(f.runtime.diagnostics()).passed);
  } finally {
    f.close();
  }
});
test("five expressions and close detail LOD restore without moving contact geometry or accumulating transforms", () => {
  const f = fixture();
  try {
    const cups = f.s.ids.map((id) => f.s.cups[id].mug.getWorldPosition(new T.Vector3()).toArray());
    for (const pose of ["typing", "success", "idle"]) {
      f.runtime.setViewModel({ actors: f.s.ids.map((agentId) => ({ agentId, pose })) });
      for (let n = 0; n < 600; n++) f.runtime.update(1 / 60);
      for (const id of f.s.ids) {
        const detail = f.runtime.diagnostics().teamActivities.assetDetails[id];
        assert(["focus", "positive", "relaxed", "thinking"].includes(detail.expression.mode));
        assert(Math.abs(detail.expression.brow) < 0.05);
      }
      f.runtime.setDetail("room");
      const points = f.s.ids.map((id) => f.s.cups[id].mug.getWorldPosition(new T.Vector3()).toArray());
      assert.deepEqual(points, cups);
      for (const n of f.runtime.scheduler.ids.map((id) => f.root.getObjectByName(id[0].toUpperCase() + id.slice(1) + "ShoeStitchL"))) assert.equal(n.visible, false);
      f.runtime.setDetail("close");
      assert.deepEqual(f.s.ids.map((id) => f.s.cups[id].mug.getWorldPosition(new T.Vector3()).toArray()), cups);
    }
    f.runtime.setViewModel(f.vm);
    f.s.cancelAll();
    until(f, () => activityCleanup(f.runtime.diagnostics()).passed);
    const actors = f.s.ids.map((id) => f.s.desks[id].actor);
    f.runtime.dispose();
    for (const actor of actors) assert.equal(actor.getObjectByName(actor.userData.prefix + "ExpressionMouths").children.filter((n) => n.visible).length, 1);
  } finally {
    f.close();
  }
});
test("full five-person exported asset reloads its wardrobes, expressions, role props and cup supports", async () => {
  const bytes = await readFile("product/assets/studio-room-v8.glb");
  globalThis.self ??= globalThis;
  const loader = new GLTFLoader();
  loader.register((parser) => {
    parser.textureLoader = { load(_url, done) {
      const texture = new T.Texture();
      queueMicrotask(() => done(texture));
      return texture;
    } };
    return { name: "TestDecoder" };
  });
  const gltf2 = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), "");
  let runtime;
  try {
    const meta = validateOfficeAsset(gltf2);
    validateEnsembleOffice(gltf2);
    runtime = createTeamRuntime(gltf2.scene, meta, options);
    const s = runtime.scheduler;
    for (const id of s.ids) assert.equal(gltf2.scene.getObjectByName(id[0].toUpperCase() + id.slice(1) + "ExpressionMouths").children.length, 4);
    assert(gltf2.scene.getObjectByName("EnsembleCoffeeFlow"));
    runtime.setViewModel({ actors: s.ids.map((agentId) => ({ agentId, pose: "idle" })) });
    runtime.update(0);
    for (const id of s.ids) assert(s.startRole(id, { variant: 2 }));
    for (let n = 0; n < 650; n++) {
      runtime.update(1 / 60);
      for (const id of s.ids) {
        assert(s.desks[id].handError < 1e-3);
        assert(s.desks[id].tipError < 1e-3);
      }
    }
    assert(s.ids.every((id) => s.desks[id].done > 0));
    assert(activityCleanup(runtime.diagnostics()).passed);
    assert(bytes.length < 15 * 1024 * 1024);
  } finally {
    runtime?.dispose();
    releaseStudioAsset(gltf2.scene);
  }
});
