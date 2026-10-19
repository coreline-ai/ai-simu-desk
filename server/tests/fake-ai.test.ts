import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";
import { FakeAgent, composeFakeAnswer } from "../adapters/fake-ai.js";
import { openDatabase } from "../db/database.js";
import { user } from "../db/schema.js";
import { createStudio } from "../db/studio-store.js";
import { createRunner } from "../application/runner.js";
import type { AgentPort } from "../domain/contracts.js";

test("Fake AI varies by task and role, streams exact text, and performs no network request", async () => {
  const original = globalThis.fetch; let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error("NETWORK_NOT_ALLOWED"); };
  try {
    const job = { runId: "local", prompt: "새 앱의 API 구현 계획을 만들어줘", agentId: "jun" as const, scenario: "normal" as const };
    const agent = new FakeAgent(0); let text = "", deltas = 0, completed = false;
    for await (const e of agent.execute(job, new AbortController().signal)) {
      if (e.kind === "delta") { text += e.text; deltas++; } if (e.kind === "completed") completed = true;
    }
    assert.equal(text, composeFakeAnswer(job)); assert.ok(deltas > 10); assert.ok(completed);
    assert.match(text, /API 구현 계획/); assert.match(text, /준의 제안/); assert.match(text, /Fake AI 시뮬레이션/);
    assert.notEqual(text, composeFakeAnswer({ ...job, prompt: "서비스 소개 글을 써줘", agentId: "nara" }));
    assert.equal(requests, 0);
  } finally { globalThis.fetch = original; }
});

const until = async <T>(read: () => Promise<T>, condition: (v: T) => boolean, timeout = 6000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const value = await read(); if (condition(value)) return value; await wait(10); }
  throw new Error("Timed out waiting for a persisted state");
};
test("persistent worker: approval gate, streamed result, failure retry, cancellation and late-response protection", async () => {
  const d = await openDatabase(); const s = createStudio(d); const runner = createRunner(s, new FakeAgent(8), { pollMs: 5 });
  try {
    await d.db.insert(user).values({ id: "worker", name: "Worker", email: "worker@example.test" });
    const space = await s.personalWorkspace("worker", "Worker");
    await runner.start();
    const input = { prompt: "첫 화면의 메시지 구성", agentId: "nara", approvalRequired: true, scenario: "normal" };
    const r = await s.startRun("worker", space.id, input, "worker-request-1");
    await wait(30); assert.equal(await s.getStatus(r.id), "awaiting_approval");
    await s.approve("worker", r.id, r.version, true);
    await until(() => s.snapshot("worker", space.id), v => Boolean(v.runs[0].output));
    const complete = await until(() => s.snapshot("worker", space.id), v => v.runs[0].status === "succeeded");
    assert.equal(complete.runs[0].output, composeFakeAnswer({ runId: r.id, ...input, agentId: "nara", scenario: "normal" }));
    const failed = await s.startRun("worker", space.id, { ...input, approvalRequired: false, scenario: "failure" }, "worker-request-2");
    await until(() => s.getStatus(failed.id), v => v === "failed");
    const retry = await s.retry("worker", failed.id, "worker-retry-1");
    await until(() => s.getStatus(retry.id), v => v === "running");
    await s.cancel("worker", retry.id); runner.cancel(retry.id);
    await until(() => s.getStatus(retry.id), v => v === "cancelled");
    assert.equal(await s.progress(retry.id, "late"), false);
    const good = await s.retry("worker", retry.id, "worker-retry-2");
    await until(() => s.getStatus(good.id), v => v === "succeeded");
    assert.equal(runner.status().failed, false);
  } finally { await runner.stop(); await d.close(); }
});

test("worker timeout and oversized output fail with bounded, persisted results", async () => {
  for (const mode of ["timeout", "oversized"] as const) {
    const d = await openDatabase(); const s = createStudio(d);
    const port: AgentPort = { provider: "fake", async *execute(_job, signal) { if (mode === "timeout") await wait(1000, undefined, { signal }); else yield { kind: "delta", text: "x".repeat(17000) }; } };
    const runner = createRunner(s, port, { timeoutMs: 30, pollMs: 5 });
    try {
      await d.db.insert(user).values({ id: "test", name: "Test", email: "test@example.test" });
      const space = await s.personalWorkspace("test", "Test");
      const r = await s.startRun("test", space.id, { prompt: "안전한 테스트", agentId: "jun", approvalRequired: false, scenario: "normal" }, `bound-key-${mode}`);
      await runner.start(); await until(() => s.getStatus(r.id), v => v === "failed");
      const result = (await s.snapshot("test", space.id)).runs[0]; assert.equal(result.output, ""); assert.ok(result.note);
    } finally { await runner.stop(); await d.close(); }
  }
});
