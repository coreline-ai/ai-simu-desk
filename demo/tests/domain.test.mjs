import test from "node:test";
import assert from "node:assert/strict";
import { createState, reduce, validateTask, completedRuns, agentPresentation } from "../src/domain.mjs";

function start(state = createState(), scenario = "normal", id = "run-1") {
  return reduce(state, { type: "START", runId: id, requestKey: `request-${id}`, task: "첫 화면을 설계해 줘", scenario, now: 100 });
}
function advance(state) {
  return reduce(state, { type: "ADVANCE", runId: state.currentRun.id, expectedStep: state.currentRun.step, now: 200 });
}
function finish(state) { for (let i = 0; i < 4; i++) state = advance(state); return state; }

test("normal work completes with a result without mutating the initial state", () => {
  const initial = createState();
  const final = finish(start(initial));
  assert.equal(initial.currentRun, null);
  assert.equal(final.currentRun.status, "succeeded");
  assert.equal(final.currentRun.step, 4);
  assert.ok(final.currentRun.result.items.length);
  assert.equal(completedRuns(final).length, 1);
});
test("approval cannot be bypassed by ticks; approval resumes the same run", () => {
  let state = finish(start(createState(), "approval"));
  assert.equal(state.currentRun.status, "awaiting_approval");
  assert.equal(advance(state), state);
  state = reduce(state, { type: "APPROVE", runId: "run-1" });
  assert.equal(advance(state).currentRun.status, "succeeded");
});
test("cancellation and declined approval reject late ticks and approval", () => {
  let state = finish(start(createState(), "approval"));
  state = reduce(state, { type: "CANCEL", runId: "run-1", now: 300, reason: "승인을 거절했어요." });
  assert.equal(state.currentRun.status, "cancelled");
  assert.equal(advance(state), state);
  assert.equal(reduce(state, { type: "APPROVE", runId: "run-1" }), state);
});
test("a duplicate request, run ID, or active second run cannot execute twice", () => {
  const state = start();
  assert.equal(start(state), state);
  assert.equal(start(state, "normal", "run-2"), state);
  const final = finish(state);
  assert.equal(start(final), final);
});
test("a duplicated stage and a callback from another run cannot move progress", () => {
  const first = start();
  const next = advance(first);
  assert.equal(reduce(next, { type: "ADVANCE", runId: "run-1", expectedStep: 0 }), next);
  assert.equal(reduce(next, { type: "ADVANCE", runId: "old-run", expectedStep: 1 }), next);
});
test("failure can retry with a new run while old callbacks stay ineffective", () => {
  const failed = finish(start(createState(), "failure"));
  assert.equal(failed.currentRun.status, "failed");
  const retry = start(failed, "normal", "run-2");
  assert.equal(retry.history[0].id, "run-1");
  assert.equal(reduce(retry, { type: "ADVANCE", runId: "run-1", expectedStep: 2 }), retry);
  assert.equal(finish(retry).currentRun.status, "succeeded");
});
test("invalid and boundary input does not create work", () => {
  assert.ok(validateTask(" "));
  assert.ok(validateTask("가"));
  assert.equal(validateTask("가나"), "");
  assert.equal(validateTask("가".repeat(400)), "");
  assert.ok(validateTask("가".repeat(401)));
  const state = createState();
  assert.equal(reduce(state, { type: "START", runId: "a", requestKey: "a", task: "  ", scenario: "normal" }), state);
});
test("selection does not transfer execution ownership; unknown employees are ignored", () => {
  const first = advance(start());
  const selected = reduce(first, { type: "SELECT", agentId: "jun" });
  assert.equal(selected.currentRun.agentId, "nara");
  assert.equal(agentPresentation(selected, "nara").row, 1);
  assert.equal(agentPresentation(selected, "jun").row, 2);
  assert.equal(reduce(first, { type: "SELECT", agentId: "unknown" }), first);
});
test("history is bounded to ten terminal runs", () => {
  let state = createState();
  for (let i = 0; i < 15; i++) state = finish(start(state, "normal", `run-${i}`));
  assert.equal(completedRuns(state).length, 10);
  assert.equal(completedRuns(state)[0].id, "run-14");
});

test("evicting visible history does not forget an earlier idempotency key", () => {
  let state = createState();
  for (let i = 0; i < 15; i++) state = finish(start(state, "normal", `run-${i}`));
  assert.equal(state.history.some(run => run.id === "run-0"), false);
  assert.equal(start(state, "normal", "run-0"), state);
  assert.equal(reduce(state, { type: "START", runId: "new-id", requestKey: "request-run-0", task: "다시 요청", scenario: "normal" }), state);
});
