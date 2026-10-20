import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { openDatabase } from "../db/database.js";
import { createStudio } from "../db/studio-store.js";
import { user, runs, tasks, members, runEvents } from "../db/schema.js";

test("DB authorization, idempotency, body conflicts, one active run, approval, cancellation and retry", async () => {
  const d = await openDatabase();
  try {
    await d.db.insert(user).values([{ id: "alice", name: "Alice", email: "alice@example.test" }, { id: "bob", name: "Bob", email: "bob@example.test" }]);
    const s = createStudio(d), a = await s.personalWorkspace("alice", "Alice"), b = await s.personalWorkspace("bob", "Bob");
    assert.notEqual(a.id, b.id);
    const input = { prompt: "서비스 기획을 정리해줘", agentId: "nara", approvalRequired: true, scenario: "normal" };
    const copies = await Promise.all(Array.from({ length: 8 }, () => s.startRun("alice", a.id, input, "request-key-123")));
    const r = copies[0]; assert.ok(copies.every(v => v.id === r.id)); assert.equal(r.status, "awaiting_approval");
    assert.equal((await d.db.select().from(runs)).length, 1); assert.equal((await d.db.select().from(tasks)).length, 1);
    assert.equal(await s.claim(), null);
    for (const op of [() => s.snapshot("bob", a.id), () => s.events("bob", a.id, 0), () => s.approve("bob", r.id, r.version, true), () => s.cancel("bob", r.id)]) await assert.rejects(op, { status: 404 });
    await assert.rejects(() => s.startRun("alice", a.id, { ...input, prompt: "다른 내용" }, "request-key-123"), { status: 409, code: "KEY_CONFLICT" });
    await assert.rejects(() => s.startRun("alice", a.id, input, "request-key-456"), { status: 409, code: "RUN_ACTIVE" });
    await assert.rejects(() => d.db.insert(runs).values({ ...r, id: "bypass", requestKey: "different-key" }), (error: unknown) => {
      const cause = (error as { cause?: { code?: string; constraint?: string } }).cause;
      return cause?.code === "23505" && cause.constraint === "runs_one_active";
    });
    await assert.rejects(() => s.approve("alice", r.id, 999, true), { status: 409 });
    await s.approve("alice", r.id, r.version, true);
    const job = await s.claim(); assert.equal(job?.runId, r.id);
    await s.progress(r.id, null, "답변 구성"); await s.progress(r.id, "안녕하세요");
    assert.equal((await s.cancel("alice", r.id)).status, "cancel_requested");
    assert.equal((await s.finish(r.id, "cancelled", "취소 확인"))?.status, "cancelled");
    assert.equal(await s.progress(r.id, "늦은 응답"), false);
    assert.equal((await s.finish(r.id, "succeeded"))?.status, "cancelled");
    const retry = await s.retry("alice", r.id, "retry-key-123"); assert.notEqual(retry.id, r.id); assert.equal(retry.taskId, r.taskId);
    assert.equal((await d.db.select().from(tasks)).length, 1);
    await s.approve("alice", retry.id, retry.version, false);
    const snapshot = await s.snapshot("alice", a.id); assert.equal(snapshot.runs.length, 2);
    const events = await s.events("alice", a.id, 0); assert.equal(events.events.length, (await d.db.select().from(runEvents)).length);
    const seq = events.events.filter(e => e.runId === r.id).map(e => e.seq); assert.deepEqual(seq, Array.from({ length: seq.length }, (_, i) => i + 1));
    assert.equal((await s.events("alice", a.id, snapshot.cursor)).events.length, 0);
    await d.db.delete(members).where(eq(members.userId, "alice"));
    await assert.rejects(() => s.personalWorkspace("alice", "Alice"), { status: 404 });
  } finally { await d.close(); }
});

test("disk reopen, exclusive process lock, interrupted run recovery, migrations and gzip backup restore", async () => {
  const root = await mkdtemp(join(tmpdir(), "simu-studio-db-")), path = join(root, "database");
  let d = await openDatabase(path);
  try {
    await assert.rejects(() => openDatabase(path), /DATABASE_ALREADY_OPEN/);
    await d.db.insert(user).values([{ id: "a", name: "A", email: "a@example.test" }, { id: "b", name: "B", email: "b@example.test" }]);
    let s = createStudio(d); const a = await s.personalWorkspace("a", "A"), b = await s.personalWorkspace("b", "B");
    const r = await s.startRun("a", a.id, { prompt: "영속 업무", agentId: "jun", approvalRequired: false, scenario: "normal" }, "persistent-key-1");
    await s.claim(); await s.progress(r.id, "중간 결과");
    await s.startRun("b", b.id, { prompt: "승인 보존", agentId: "nara", approvalRequired: true, scenario: "normal" }, "persistent-key-2");
    const backup = await d.client.dumpDataDir("gzip"); assert.ok(backup.size > 1000);
    await d.close(); d = await openDatabase(path); s = createStudio(d);
    assert.equal(await s.recoverInterrupted(), 1);
    const snapshot = await s.snapshot("a", a.id); assert.equal(snapshot.runs[0].status, "failed"); assert.equal(snapshot.runs[0].output, "중간 결과");
    assert.equal((await s.snapshot("b", b.id)).runs[0].status, "awaiting_approval");
    const same = await s.startRun("a", a.id, { prompt: "영속 업무", agentId: "jun", approvalRequired: false, scenario: "normal" }, "persistent-key-1"); assert.equal(same.id, r.id);
    const restored = await openDatabase(join(root, "restored"), backup);
    try {
      const restoredSnapshot = await createStudio(restored).snapshot("a", a.id); assert.equal(restoredSnapshot.runs[0].output, "중간 결과");
      const migrations = await restored.client.query("SELECT name FROM studio_migrations ORDER BY name"); assert.equal(migrations.rows.length, 10);
      await assert.rejects(() => openDatabase(join(root, "restored"), backup), /new empty directory/);
    } finally { await restored.close(); }
  } finally { await d.close(); await rm(root, { recursive: true, force: true }); }
});
