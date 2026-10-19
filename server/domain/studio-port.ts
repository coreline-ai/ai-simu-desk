import type { AgentId, AgentJob, RunStatus } from "./contracts.js";

export interface Workspace { id: string; ownerId: string; name: string; createdAt: Date; updatedAt: Date }
export interface Run {
  id: string; workspaceId: string; taskId: string; requestedBy: string; requestKey: string; requestHash: string;
  status: RunStatus; version: number; output: string; stage: string; note: string; provider: string; externalRef: string | null;
  scenario: "normal" | "failure"; finishedAt: Date | null; createdAt: Date; updatedAt: Date;
}
export interface Snapshot { workspace: Workspace; runs: (Run & { prompt: string; agentId: AgentId; approvalRequired: boolean })[]; cursor: number }
export interface StoredEvent { cursor: number; id: string; workspaceId: string; runId: string; seq: number; kind: string; payload: Record<string, unknown>; createdAt: Date }
// Transaction-sized storage operations, not one generic repository per entity.
export interface StudioPort {
  personalWorkspace(userId: string, name: string): Promise<Workspace>;
  startRun(userId: string, workspaceId: string, input: unknown, key: string | undefined): Promise<Run>;
  snapshot(userId: string, workspaceId: string): Promise<Snapshot>;
  events(userId: string, workspaceId: string, after: number): Promise<{ events: StoredEvent[]; cursor: number; hasMore: boolean }>;
  approve(userId: string, id: string, version: unknown, accepted: boolean): Promise<Run>;
  cancel(userId: string, id: string): Promise<Run>;
  retry(userId: string, id: string, key: string | undefined): Promise<Run>;
  claim(): Promise<AgentJob | null>;
  progress(id: string, delta: string | null, stage?: string): Promise<boolean>;
  finish(id: string, outcome: "succeeded" | "failed" | "cancelled", note?: string, externalRef?: string): Promise<Run | undefined>;
  recoverInterrupted(): Promise<number>;
  getStatus(id: string): Promise<RunStatus | undefined>;
}
