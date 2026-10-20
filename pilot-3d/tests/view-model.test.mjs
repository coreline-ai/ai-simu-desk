import test from "node:test";
import assert from "node:assert/strict";
import { createState, reduce } from "../../demo/src/domain.mjs";
import { studioViewModel } from "../src/view-model.mjs";
import { releaseModel } from "../src/scene.mjs";
import * as T from "three";

test("3D pose follows the run owner and running state; pausing changes no business state", () => {
  let state = createState();
  assert.equal(studioViewModel(state).pose, "idle");
  state = reduce(state, { type: "START", task: "기획 정리", scenario: "approval", runId: "r", requestKey: "q", now: 0 });
  for (let step = 0; step < 4; step++) {
    state = reduce(state, { type: "ADVANCE", runId: "r", expectedStep: state.currentRun.step, now: step });
    assert.equal(studioViewModel(state).pose, state.currentRun.status === "running" ? "typing" : state.currentRun.status==="awaiting_approval"?"waiting":state.currentRun.status==="queued"?"thinking":"idle");
  }
  assert.equal(state.currentRun.status, "awaiting_approval");
  assert.equal(studioViewModel(state).pose, "waiting");
  const snapshot = JSON.stringify(state);
  assert.equal(studioViewModel(state, true).motionPaused, true);
  assert.equal(JSON.stringify(state), snapshot);
  state = reduce(state, { type: "APPROVE", runId: "r" });
  assert.equal(studioViewModel(state).pose, "typing");
  state = reduce(state, { type: "CANCEL", runId: "r", now: 5 });
  assert.equal(studioViewModel(state).pose, "idle");
  state = reduce(state, { type: "SELECT", agentId: "jun" });
  state = reduce(state, { type: "START", task: "구조 설계", scenario: "normal", runId: "j", requestKey: "j", now: 6 });
  state = reduce(state, { type: "ADVANCE", runId: "j", expectedStep: 0, now: 7 });
  assert.equal(studioViewModel(state).pose, "idle");
});

test("scene disposal releases shared geometry, material arrays and textures once", () => {
  const geometry = new T.BoxGeometry(), texture = new T.Texture(), material = new T.MeshStandardMaterial({ map: texture });
  const root = new T.Group(); root.add(new T.Mesh(geometry, material), new T.Mesh(geometry, [material, material]));
  const disposed = { geometry: 0, material: 0, texture: 0 };
  geometry.addEventListener("dispose", () => disposed.geometry++);
  material.addEventListener("dispose", () => disposed.material++);
  texture.addEventListener("dispose", () => disposed.texture++);
  assert.deepEqual(releaseModel(root), { geometries: 1, materials: 1, textures: 1 });
  assert.deepEqual(disposed, { geometry: 1, material: 1, texture: 1 });
});
