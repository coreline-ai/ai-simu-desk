import test from "node:test";
import assert from "node:assert/strict";
import { teamSceneState } from "../src/scene-state.mjs";

test("server run owner controls each actor independently of selected colleague and old history", () => {
  const runs = [{ agentId: "nara", status: "succeeded" }, { agentId: "jun", status: "running" }];
  const before = JSON.stringify(runs);
  for (const selected of ["nara", "jun"]) {
    const vm = teamSceneState(runs, selected);
    assert.equal(vm.selectedAgent, selected);
    assert.deepEqual(vm.actors.map(a => a.pose), ["idle", "typing"]);
    assert.equal(vm.actors[1].label, "답변 작성 중");
  }
  assert.equal(JSON.stringify(runs), before);
  assert.deepEqual(teamSceneState([{ agentId: "nara", status: "running" }], "jun").actors.map(a => a.pose), ["typing", "idle"]);
});

test("approval, queued, cancel request and terminal states do not type; reduced motion changes no run", () => {
  for (const status of ["awaiting_approval", "queued", "cancel_requested", "succeeded", "failed", "cancelled"]) {
    assert.deepEqual(teamSceneState([{ agentId: "jun", status }]).actors.map(a => a.pose), ["idle", "idle"]);
  }
  const run = { agentId: "jun", status: "running" };
  const paused = teamSceneState([run], "unknown", true);
  assert.equal(paused.motionPaused, true); assert.equal(paused.selectedAgent, "nara");
  assert.equal(paused.actors[1].pose, "typing"); assert.equal(run.status, "running");
  assert.deepEqual(teamSceneState().actors.map(a => a.pose), ["idle", "idle"]);
});
