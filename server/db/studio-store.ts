import {createFakeAnswer,type SourceContext,type FakeAnswer} from "../domain/fake-answer.js";
import { simulationFrame } from "../application/simulation.js";
import { and, asc, desc, eq, gt, inArray, max, isNull } from "drizzle-orm";
import { randomUUID, createHash } from "node:crypto";
import type { StudioDatabase as Database } from "./types.js";
import { members, workspaces, tasks, runs, approvals, runEvents, user } from "./schema.js";
import { AppError, AgentFailure, ACTIVE, TERMINAL, parseInput, validRequestKey, mayTransition } from "../domain/contracts.js";
import type { StudioPort } from "../domain/studio-port.js";
import type { AgentJob } from "../domain/contracts.js";
import { canStartRun, canControlRun } from "../domain/collaboration.js";
import { workspaceMember as member, expiredGuestWorkspace, type Tx, type Store } from "./workspace-access.js";
import { createWorkspaceStore } from "./workspace-store.js";
import { notifyRun } from "./notifications.js";
import { runView } from "./run-view.js";
import { createWorkspaceTools, toolsEvent } from "./workspace-tools.js";

type Run = typeof runs.$inferSelect;
type Task = typeof tasks.$inferSelect;

async function event(db: Store, run: Run, kind: string, payload: Record<string, unknown> = {}) {
  if(kind==="approval_requested"||kind==="completed"||kind==="failed")await notifyRun(db,run,kind,`${run.id}:${kind}`);
  await db.insert(runEvents).values({ id: randomUUID(), workspaceId: run.workspaceId, runId: run.id, seq: run.version, kind, payload: { status: run.status, ...payload } });
}
async function change(tx: Tx, run: Run, status: Run["status"], kind: string, patch: Partial<Pick<Run, "output" | "stage" | "note" | "externalRef" | "simulatedStartedAt" | "phase">> = {}, payload: Record<string, unknown> = {}) {
  if (!mayTransition(run.status, status)) throw new AppError(409, "업무 상태가 바뀌었습니다. 다시 확인해 주세요.", "STATE_CONFLICT");
  const [next] = await tx.update(runs).set({ ...patch, status, version: run.version + 1, updatedAt: new Date(), finishedAt: TERMINAL.includes(status) ? new Date() : null }).where(and(eq(runs.id, run.id), eq(runs.version, run.version))).returning();
  if (!next) throw new AppError(409, "업무 상태가 바뀌었습니다.", "STATE_CONFLICT");
  await event(tx, next, kind, payload); return next;
}

export function createStudio(database: Database, simulation?: {answer:(job:AgentJob)=>string;delayMs:number;now?:()=>number}): StudioPort {
  const db = database.db;
  async function ownedRun(tx: Store, userId: string, id: string, permission: "control" | "approve" = "control") {
    const [run] = await tx.select().from(runs).where(eq(runs.id, id));
    if (!run) throw new AppError(404, "업무를 찾을 수 없습니다.", "NOT_FOUND");
    const access = await member(tx, userId, run.workspaceId);
    if (permission === "approve" ? access.role !== "owner" : !canControlRun(access.role,run.requestedBy,userId)) throw new AppError(403,"이 업무를 조작할 권한이 없습니다.","ROLE_FORBIDDEN");
    return run;
  }
  async function startInTransaction(tx: Tx, userId: string, workspaceId: string, value: unknown, requestKey: string | undefined, existingTask?: Task, retryAnswer?:FakeAnswer|null) {
    const input = parseInput(value), key = validRequestKey(requestKey);
    if(input.mode==="handoff")input.approvalRequired=true;
    const hash = createHash("sha256").update(JSON.stringify({ ...input, retryTask: existingTask?.id ?? null })).digest("hex");
    const access = await member(tx, userId, workspaceId);
    if (!canStartRun(access.role)) throw new AppError(403,"보기 전용 사용자는 업무를 요청할 수 없습니다.","ROLE_FORBIDDEN");
    const [old] = await tx.select().from(runs).where(and(eq(runs.workspaceId, workspaceId), eq(runs.requestKey, key)));
    if (old) { if (old.requestedBy !== userId || old.requestHash !== hash) throw new AppError(409, "같은 요청 키에 다른 업무를 보낼 수 없습니다.", "KEY_CONFLICT"); return old; }
    const [active] = await tx.select({ id: runs.id }).from(runs).where(and(eq(runs.workspaceId, workspaceId), inArray(runs.status, [...ACTIVE]))).limit(1);
    if (active) throw new AppError(409, "진행 중인 업무를 먼저 마쳐 주세요.", "RUN_ACTIVE");
    let context:SourceContext|undefined=existingTask?.sourceContext??undefined;
    if(input.sourceRunId&&!existingTask){
      const [source]=await tx.select().from(runs).where(and(eq(runs.id,input.sourceRunId),eq(runs.workspaceId,workspaceId)));
      if(!source)throw new AppError(404,"같은 공간에서 접근 가능한 원본 결과를 선택해 주세요.","SOURCE_NOT_FOUND");
      if(source.status!=="succeeded"||!source.output)throw new AppError(400,"완료된 답변만 수정하거나 인계할 수 있습니다.","SOURCE_NOT_READY");
      const [original]=await tx.select().from(tasks).where(eq(tasks.id,source.taskId));
      if(input.mode==="handoff"&&original.agentId===input.agentId)throw new AppError(400,"인계할 다른 동료를 선택해 주세요.","SAME_AGENT");
      context={runId:source.id,version:source.version,agentId:original.agentId,prompt:original.prompt,output:source.output.slice(0,4000),truncated:source.output.length>4000,
        ...(source.generatedAnswer?{conditions:{days:source.generatedAnswer.analysis.days,deadline:source.generatedAnswer.analysis.deadline,people:source.generatedAnswer.analysis.people,budget:source.generatedAnswer.analysis.budget,freeOnly:source.generatedAnswer.analysis.freeOnly,exclusions:source.generatedAnswer.analysis.exclusions}}:{}),
        ...(source.generatedAnswer?.text===source.output?{body:source.generatedAnswer.body.slice(0,4000)}:{}),mode:input.mode!};
    }
    const task = existingTask ?? (await tx.insert(tasks).values({ id: randomUUID(), workspaceId, authorId: userId, sourceContext:context??null, prompt: input.prompt, agentId: input.agentId, approvalRequired: input.approvalRequired,team:!!input.team }).returning())[0];
    const runId=randomUUID(), job:AgentJob={runId,prompt:task.prompt,agentId:task.agentId,scenario:input.scenario,context,team:task.team};
    const generatedAnswer=retryAnswer??createFakeAnswer(job);
    if(simulation&&!retryAnswer)generatedAnswer.text=simulation.answer(job);
    const [run] = await tx.insert(runs).values({ id: runId, generatedAnswer, workspaceId, taskId: task.id, requestedBy: userId, requestKey: key, requestHash: hash, status: input.approvalRequired ? "awaiting_approval" : "queued", scenario: input.scenario, stage: input.approvalRequired ? "실행 승인 대기" : "실행 대기" }).returning();
    if (input.approvalRequired) await tx.insert(approvals).values({ id: randomUUID(), runId: run.id, workspaceId, status: "pending" });
    await event(tx, run, input.approvalRequired ? "approval_requested" : "created", { actorId:userId }); return run;
  }
  const startRun = (userId: string, workspaceId: string, value: unknown, key: string | undefined) => db.transaction(tx => startInTransaction(tx,userId,workspaceId,value,key));
  async function frozenAnswer(tx:Tx,run:Run,task:Task) {
    if(run.generatedAnswer)return run.generatedAnswer;
    const job:AgentJob={runId:run.id,prompt:task.prompt,agentId:task.agentId,scenario:run.scenario,context:task.sourceContext??undefined,team:task.team};
    const answer=createFakeAnswer(job);
    if(simulation)answer.text=simulation.answer(job);
    if(run.output&&!answer.text.startsWith(run.output)) {
      await change(tx,run,"failed","failed",{note:"이전 생성 규칙의 실행입니다. 저장된 답변은 보존했고 새 실행으로 재시도할 수 있습니다."});
      return null;
    }
    await tx.update(runs).set({generatedAnswer:answer}).where(eq(runs.id,run.id));
    return answer;
  }
  async function advance(tx:Tx,workspaceId:string) {
    if(await expiredGuestWorkspace(tx,workspaceId)){
      const [closed]=await tx.select({id:runEvents.id}).from(runEvents).where(and(eq(runEvents.workspaceId,workspaceId),isNull(runEvents.runId),eq(runEvents.kind,'guest_space_expired'))).limit(1);
      if(!closed)await toolsEvent(tx,workspaceId,'guest_space_expired');
      const active=await tx.select().from(runs).where(and(eq(runs.workspaceId,workspaceId),inArray(runs.status,[...ACTIVE])));
      for(let run of active){
        if(run.status==='running')run=await change(tx,run,'cancel_requested','cancel_requested',{note:'체험 공간의 소유자 세션이 종료되었습니다.'});
        await tx.update(approvals).set({status:'declined',decidedAt:new Date()}).where(and(eq(approvals.runId,run.id),eq(approvals.status,'pending')));
        await change(tx,run,'cancelled','cancelled',{stage:'체험 공간 종료',note:'소유자 세션이 종료되어 업무를 정리했습니다. 기존 결과는 보존됩니다.'});
      }
      return;
    }
    if(!simulation)return;
    const now=simulation.now?.()??Date.now();
    const [run]=await tx.select().from(runs).where(and(eq(runs.workspaceId,workspaceId),inArray(runs.status,["queued","running","cancel_requested"]))).limit(1);
    if(!run)return;
    if(run.status==="cancel_requested"){await change(tx,run,"cancelled","cancelled",{stage:"취소됨",note:"사용자가 취소를 요청했습니다."});return;}
    if(run.status==="queued"){await change(tx,run,"running","started",{simulatedStartedAt:new Date(now),stage:"요청 분석",externalRef:`fake:${run.id}`});return;}
    const [task]=await tx.select().from(tasks).where(eq(tasks.id,run.taskId));
    const answer=await frozenAnswer(tx,run,task);if(!answer)return;
    const frame=simulationFrame(answer.text,run.scenario,Math.max(0,now-(run.simulatedStartedAt??run.updatedAt).getTime()),simulation.delayMs,800);
    if(frame.status!==run.status||frame.output!==run.output||frame.stage!==run.stage||frame.phase!==run.phase)await change(tx,run,frame.status,frame.status==="succeeded"?"completed":frame.status==="failed"?"failed":"delta",frame);
  }
  async function snapshot(userId: string, workspaceId: string) {
    return db.transaction(async tx => {
      const access = await member(tx, userId, workspaceId);
      await advance(tx,workspaceId);
      const [workspace] = await tx.select().from(workspaces).where(eq(workspaces.id, workspaceId));
      const rows = await tx.select({ run: runs, task: tasks, requestedByName:user.name }).from(runs).innerJoin(tasks, eq(runs.taskId, tasks.id)).innerJoin(user,eq(runs.requestedBy,user.id)).where(eq(runs.workspaceId, workspaceId)).orderBy(desc(runs.createdAt), desc(runs.id)).limit(20);
      const [latest] = await tx.select({ cursor: max(runEvents.cursor) }).from(runEvents).where(eq(runEvents.workspaceId, workspaceId));
      const people = await tx.select({ userId:members.userId,name:user.name,role:members.role }).from(members).innerJoin(user,eq(members.userId,user.id)).where(eq(members.workspaceId,workspaceId)).orderBy(asc(user.name),asc(user.id));
      return { workspace:{...workspace,readOnlyReason:access.readOnlyReason}, role:access.role, members:people, runs: rows.map(({run,task,requestedByName})=>runView(run,task,requestedByName)), cursor: latest.cursor ?? 0 };
    });
  }
  async function presenceMembers(userId: string, workspaceId: string) {
    return db.transaction(async tx => {
      await member(tx,userId,workspaceId);
      const [space] = await tx.select().from(workspaces).where(eq(workspaces.id,workspaceId));
      if(space.kind!=="shared") throw new AppError(400,"공동 공간에서만 접속 상태를 공유합니다.");
      return tx.select({userId:members.userId,name:user.name,role:members.role}).from(members).innerJoin(user,eq(members.userId,user.id)).where(eq(members.workspaceId,workspaceId));
    });
  }
  async function events(userId: string, workspaceId: string, after: number) {
    if (!Number.isSafeInteger(after) || after < 0) throw new AppError(400, "이벤트 위치를 확인해 주세요.");
    return db.transaction(async tx => {
      await member(tx, userId, workspaceId);
      await advance(tx,workspaceId);
      const rows = await tx.select().from(runEvents).where(and(eq(runEvents.workspaceId, workspaceId), gt(runEvents.cursor, after))).orderBy(asc(runEvents.cursor)).limit(100);
      return { events: rows, cursor: rows.at(-1)?.cursor ?? after, hasMore: rows.length === 100 };
    });
  }

  async function approve(userId: string, id: string, version: unknown, accepted: boolean) {
    return db.transaction(async tx => {
      const run = await ownedRun(tx, userId, id, "approve");
      if (run.status !== "awaiting_approval" || run.version !== version) throw new AppError(409, "이미 처리되었거나 변경된 승인입니다.", "STATE_CONFLICT");
      await tx.update(approvals).set({ status: accepted ? "approved" : "declined", decidedBy: userId, decidedAt: new Date() }).where(eq(approvals.runId, id));
      return change(tx, run, accepted ? "queued" : "cancelled", accepted ? "approved" : "cancelled", { stage: accepted ? "실행 대기" : "승인 거절", note: accepted ? "" : "사용자가 실행을 승인하지 않았습니다." }, { actorId:userId });
    });
  }
  async function cancel(userId: string, id: string) {
    return db.transaction(async tx => {
      const run = await ownedRun(tx, userId, id);
      if (TERMINAL.includes(run.status) || run.status === "cancel_requested") return run;
      if (run.status === "awaiting_approval") await tx.update(approvals).set({ status: "declined", decidedBy: userId, decidedAt: new Date() }).where(eq(approvals.runId, id));
      return change(tx, run, run.status === "running" ? "cancel_requested" : "cancelled", run.status === "running" ? "cancel_requested" : "cancelled", { stage: "취소 요청", note: "사용자가 취소를 요청했습니다." }, { actorId:userId });
    });
  }
  async function retry(userId: string, id: string, key: string | undefined) {
    return db.transaction(async tx => {
      const old = await ownedRun(tx,userId,id);
      if (!["failed", "cancelled"].includes(old.status)) throw new AppError(409, "실패하거나 취소한 업무만 재시도할 수 있습니다.");
      const [task] = await tx.select().from(tasks).where(eq(tasks.id,old.taskId));
      return startInTransaction(tx,userId,old.workspaceId,{...task,...(task.sourceContext?{sourceRunId:task.sourceContext.runId,mode:task.sourceContext.mode}:{}),scenario:"normal"},key,task,old.generatedAnswer);
    });
  }

  async function claim(): Promise<AgentJob | null> {
    return db.transaction(async tx => {
      const [run] = await tx.select().from(runs).where(eq(runs.status, "queued")).orderBy(asc(runs.createdAt)).limit(1);
      if (!run) return null;
      if(await expiredGuestWorkspace(tx,run.workspaceId)){await advance(tx,run.workspaceId);return null;}
      const [task] = await tx.select().from(tasks).where(eq(tasks.id, run.taskId));
      const answer=await frozenAnswer(tx,run,task);if(!answer)return null;
      await change(tx, run, "running", "started", { stage: "요청 분석", phase:"analyze", externalRef: `fake:${run.id}` });
      return { runId: run.id, prompt: task.prompt, agentId: task.agentId, scenario: run.scenario, answer,context:task.sourceContext??undefined,team:task.team };
    });
  }
  async function progress(id: string, delta: string | null, stage?: string,phase?:import("../domain/fake-answer.js").AnswerPhase) {
    return db.transaction(async tx => {
      const [run] = await tx.select().from(runs).where(eq(runs.id, id));
      if (!run || run.status !== "running") return false;
      if (run.output.length + (delta?.length ?? 0) > 16000) throw new AgentFailure("OUTPUT_LIMIT");
      await change(tx, run, "running", delta === null ? "progress" : "delta", { ...(delta === null ? {} : { output: run.output + delta }), ...(stage ? { stage } : {}),...(phase?{phase}:{}) }, delta === null ? { stage } : { text: delta }); return true;
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
  return { ...createWorkspaceStore(database), ...createWorkspaceTools(database), presenceMembers, startRun, snapshot, events, approve, cancel, retry, claim, progress, finish, recoverInterrupted, getStatus };
}
