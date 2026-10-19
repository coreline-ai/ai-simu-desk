import { and, asc, desc, eq, gt, inArray, max } from "drizzle-orm";
import { randomUUID, createHash } from "node:crypto";
import type { Database } from "./database.js";
import { members, workspaces, tasks, runs, approvals, runEvents } from "./schema.js";
import { AppError, AgentFailure, ACTIVE, TERMINAL, parseInput, validRequestKey, mayTransition } from "../domain/contracts.js";
import type { StudioPort } from "../domain/studio-port.js";
import type { AgentJob } from "../domain/contracts.js";

type Tx = Parameters<Parameters<Database["db"]["transaction"]>[0]>[0];
type Store = Database["db"] | Tx;
type Run = typeof runs.$inferSelect;
type Task = typeof tasks.$inferSelect;

async function member(db: Store, userId: string, workspaceId: string) {
  const [row] = await db.select().from(members).where(and(eq(members.userId, userId), eq(members.workspaceId, workspaceId)));
  if (!row) throw new AppError(404, "작업 공간을 찾을 수 없습니다.", "NOT_FOUND");
}
async function event(db: Store, run: Run, kind: string, payload: Record<string, unknown> = {}) {
  await db.insert(runEvents).values({ id: randomUUID(), workspaceId: run.workspaceId, runId: run.id, seq: run.version, kind, payload: { status: run.status, ...payload } });
}
async function change(tx: Tx, run: Run, status: Run["status"], kind: string, patch: Partial<Pick<Run, "output" | "stage" | "note" | "externalRef">> = {}, payload: Record<string, unknown> = {}) {
  if (!mayTransition(run.status, status)) throw new AppError(409, "업무 상태가 바뀌었습니다. 다시 확인해 주세요.", "STATE_CONFLICT");
  const [next] = await tx.update(runs).set({ ...patch, status, version: run.version + 1, updatedAt: new Date(), finishedAt: TERMINAL.includes(status) ? new Date() : null }).where(and(eq(runs.id, run.id), eq(runs.version, run.version))).returning();
  if (!next) throw new AppError(409, "업무 상태가 바뀌었습니다.", "STATE_CONFLICT");
  await event(tx, next, kind, payload); return next;
}

export function createStudio(database: Database): StudioPort {
  const db = database.db;
  async function personalWorkspace(userId: string, name: string) {
    return db.transaction(async tx => {
      const [created] = await tx.insert(workspaces).values({ id: randomUUID(), ownerId: userId, name: `${name.slice(0, 30)}의 스튜디오` }).onConflictDoNothing({ target: workspaces.ownerId }).returning();
      if (created) await tx.insert(members).values({ workspaceId: created.id, userId, role: "owner" });
      const [space] = created ? [created] : await tx.select().from(workspaces).where(eq(workspaces.ownerId, userId));
      await member(tx, userId, space.id); return space;
    });
  }
  async function ownedRun(tx: Store, userId: string, id: string) {
    const [run] = await tx.select().from(runs).where(eq(runs.id, id));
    if (!run) throw new AppError(404, "업무를 찾을 수 없습니다.", "NOT_FOUND");
    await member(tx, userId, run.workspaceId); return run;
  }
  async function startRun(userId: string, workspaceId: string, value: unknown, requestKey: string | undefined, existingTask?: Task) {
    const input = parseInput(value), key = validRequestKey(requestKey);
    const hash = createHash("sha256").update(JSON.stringify({ ...input, retryTask: existingTask?.id ?? null })).digest("hex");
    return db.transaction(async tx => {
      await member(tx, userId, workspaceId);
      const [old] = await tx.select().from(runs).where(and(eq(runs.workspaceId, workspaceId), eq(runs.requestKey, key)));
      if (old) { if (old.requestHash !== hash) throw new AppError(409, "같은 요청 키에 다른 업무를 보낼 수 없습니다.", "KEY_CONFLICT"); return old; }
      const [active] = await tx.select({ id: runs.id }).from(runs).where(and(eq(runs.workspaceId, workspaceId), inArray(runs.status, [...ACTIVE]))).limit(1);
      if (active) throw new AppError(409, "진행 중인 업무를 먼저 마쳐 주세요.", "RUN_ACTIVE");
      const task = existingTask ?? (await tx.insert(tasks).values({ id: randomUUID(), workspaceId, authorId: userId, prompt: input.prompt, agentId: input.agentId, approvalRequired: input.approvalRequired }).returning())[0];
      const [run] = await tx.insert(runs).values({ id: randomUUID(), workspaceId, taskId: task.id, requestedBy: userId, requestKey: key, requestHash: hash, status: input.approvalRequired ? "awaiting_approval" : "queued", scenario: input.scenario, stage: input.approvalRequired ? "실행 승인 대기" : "실행 대기" }).returning();
      if (input.approvalRequired) await tx.insert(approvals).values({ id: randomUUID(), runId: run.id, workspaceId, status: "pending" });
      await event(tx, run, input.approvalRequired ? "approval_requested" : "created"); return run;
    });
  }
  async function snapshot(userId: string, workspaceId: string) {
    return db.transaction(async tx => {
      await member(tx, userId, workspaceId);
      const [workspace] = await tx.select().from(workspaces).where(eq(workspaces.id, workspaceId));
      const rows = await tx.select({ run: runs, task: tasks }).from(runs).innerJoin(tasks, eq(runs.taskId, tasks.id)).where(eq(runs.workspaceId, workspaceId)).orderBy(desc(runs.createdAt), desc(runs.id)).limit(20);
      const [latest] = await tx.select({ cursor: max(runEvents.cursor) }).from(runEvents).where(eq(runEvents.workspaceId, workspaceId));
      return { workspace, runs: rows.map(({ run, task }) => ({ ...run, prompt: task.prompt, agentId: task.agentId, approvalRequired: task.approvalRequired })), cursor: latest.cursor ?? 0 };
    });
  }
  async function events(userId: string, workspaceId: string, after: number) {
    if (!Number.isSafeInteger(after) || after < 0) throw new AppError(400, "이벤트 위치를 확인해 주세요.");
    await member(db, userId, workspaceId);
    const rows = await db.select().from(runEvents).where(and(eq(runEvents.workspaceId, workspaceId), gt(runEvents.cursor, after))).orderBy(asc(runEvents.cursor)).limit(100);
    return { events: rows, cursor: rows.at(-1)?.cursor ?? after, hasMore: rows.length === 100 };
  }
  async function approve(userId: string, id: string, version: unknown, accepted: boolean) {
    return db.transaction(async tx => {
      const run = await ownedRun(tx, userId, id);
      if (run.status !== "awaiting_approval" || run.version !== version) throw new AppError(409, "이미 처리되었거나 변경된 승인입니다.", "STATE_CONFLICT");
      await tx.update(approvals).set({ status: accepted ? "approved" : "declined", decidedBy: userId, decidedAt: new Date() }).where(eq(approvals.runId, id));
      return change(tx, run, accepted ? "queued" : "cancelled", accepted ? "approved" : "cancelled", { stage: accepted ? "실행 대기" : "승인 거절", note: accepted ? "" : "사용자가 실행을 승인하지 않았습니다." });
    });
  }
  async function cancel(userId: string, id: string) {
    return db.transaction(async tx => {
      const run = await ownedRun(tx, userId, id);
      if (TERMINAL.includes(run.status) || run.status === "cancel_requested") return run;
      if (run.status === "awaiting_approval") await tx.update(approvals).set({ status: "declined", decidedBy: userId, decidedAt: new Date() }).where(eq(approvals.runId, id));
      return change(tx, run, run.status === "running" ? "cancel_requested" : "cancelled", run.status === "running" ? "cancel_requested" : "cancelled", { stage: "취소 요청", note: "사용자가 취소를 요청했습니다." });
    });
  }
  async function retry(userId: string, id: string, key: string | undefined) {
    const old = await ownedRun(db, userId, id);
    if (!["failed", "cancelled"].includes(old.status)) throw new AppError(409, "실패하거나 취소한 업무만 재시도할 수 있습니다.");
    const [task] = await db.select().from(tasks).where(eq(tasks.id, old.taskId));
    return startRun(userId, old.workspaceId, { ...task, scenario: "normal" }, key, task);
  }
  async function claim(): Promise<AgentJob | null> {
    return db.transaction(async tx => {
      const [run] = await tx.select().from(runs).where(eq(runs.status, "queued")).orderBy(asc(runs.createdAt)).limit(1);
      if (!run) return null;
      const [task] = await tx.select().from(tasks).where(eq(tasks.id, run.taskId));
      await change(tx, run, "running", "started", { stage: "요청 분석", externalRef: `fake:${run.id}` });
      return { runId: run.id, prompt: task.prompt, agentId: task.agentId, scenario: run.scenario };
    });
  }
  async function progress(id: string, delta: string | null, stage?: string) {
    return db.transaction(async tx => {
      const [run] = await tx.select().from(runs).where(eq(runs.id, id));
      if (!run || run.status !== "running") return false;
      if (run.output.length + (delta?.length ?? 0) > 16000) throw new AgentFailure("OUTPUT_LIMIT");
      await change(tx, run, "running", delta === null ? "progress" : "delta", { ...(delta === null ? {} : { output: run.output + delta }), ...(stage ? { stage } : {}) }, delta === null ? { stage } : { text: delta }); return true;
    });
  }
  async function finish(id: string, outcome: "succeeded" | "failed" | "cancelled", note = "", externalRef?: string) {
    return db.transaction(async tx => {
      const [run] = await tx.select().from(runs).where(eq(runs.id, id));
      if (!run || TERMINAL.includes(run.status)) return run;
      let status = outcome;
      if (run.status === "cancel_requested" && outcome !== "succeeded") status = "cancelled";
      return change(tx, run, status, status === "succeeded" ? "completed" : status, { stage: status === "succeeded" ? "답변 완성" : status === "failed" ? "실행 실패" : "취소됨", note, ...(externalRef ? { externalRef } : {}) });
    });
  }
  async function recoverInterrupted() {
    return db.transaction(async tx => {
      const interrupted = await tx.select().from(runs).where(inArray(runs.status, ["running", "cancel_requested"]));
      for (const run of interrupted) await change(tx, run, run.status === "cancel_requested" ? "cancelled" : "failed", "recovered", { stage: "서버 재시작 후 정리", note: "서버가 중단되어 실행을 종료했습니다. 같은 업무를 새 실행으로 재시도할 수 있습니다." });
      return interrupted.length;
    });
  }
  const getStatus = async (id: string) => (await db.select({ status: runs.status }).from(runs).where(eq(runs.id, id)))[0]?.status;
  return { personalWorkspace, startRun, snapshot, events, approve, cancel, retry, claim, progress, finish, recoverInterrupted, getStatus };
}
