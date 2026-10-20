import type {AnswerPhase,FakeAnswer,SourceContext} from "./fake-answer.js";
import type { AgentId, AgentJob, RunStatus } from "./contracts.js";
import type { Workspace, WorkspaceMember, WorkspacePort } from "./workspace-port.js";
import type { MemberRole } from "./collaboration.js";
import type {ProjectSettings} from "./project.js";
import type {Comment,Inbox} from "./discussion.js";

export interface Run {
  id: string; workspaceId: string; taskId: string; requestedBy: string; requestKey: string; requestHash: string;
  status: RunStatus; version: number; output: string; stage: string; note: string; provider: string; externalRef: string | null;
  source?: (Omit<SourceContext,"output"|"body"> & {preview:string})|null;
  phase?:AnswerPhase; answerMeta?:Pick<FakeAnswer,"version"|"analysis"|"checks">|null;
  scenario: "normal" | "failure"; finishedAt: Date | null; createdAt: Date; updatedAt: Date;
}
export interface Snapshot { workspace: Workspace; role: MemberRole; members: WorkspaceMember[]; runs: (Run & { prompt: string; agentId: AgentId; approvalRequired: boolean; requestedByName: string })[]; cursor: number }
export interface StoredEvent { cursor: number; id: string; workspaceId: string; runId: string | null; seq: number; kind: string; payload: Record<string, unknown>; createdAt: Date }
// Transaction-sized storage operations, not one generic repository per entity.
export interface StudioPort extends WorkspacePort {
  comments(userId:string,workspaceId:string,runId:string,before?:string):Promise<{items:Comment[];next:string|null}>;
  addComment(userId:string,workspaceId:string,runId:string,value:unknown,key:string|undefined):Promise<unknown>;
  inbox(userId:string,workspaceId:string):Promise<Inbox>;
  readNotifications(userId:string,workspaceId:string):Promise<{success:boolean}>;
  findRuns(userId:string,workspaceId:string,query:Record<string,string|undefined>):Promise<{items:Snapshot["runs"];next:string|null}>;
  readRun(userId:string,workspaceId:string,id:string):Promise<Snapshot["runs"][number]>;
  compareRun(userId:string,workspaceId:string,id:string):Promise<{before:{runId:string;version:number;prompt:string;output:string;truncated:boolean};after:{runId:string;version:number;prompt:string;output:string};mode:"revise"|"handoff"}>;
  project(userId:string,workspaceId:string):Promise<ProjectSettings>;
  saveProject(userId:string,workspaceId:string,value:unknown):Promise<ProjectSettings>;
  presenceMembers(userId: string, workspaceId: string): Promise<WorkspaceMember[]>;
  startRun(userId: string, workspaceId: string, input: unknown, key: string | undefined): Promise<Run>;
  snapshot(userId: string, workspaceId: string): Promise<Snapshot>;
  events(userId: string, workspaceId: string, after: number): Promise<{ events: StoredEvent[]; cursor: number; hasMore: boolean }>;
  approve(userId: string, id: string, version: unknown, accepted: boolean): Promise<Run>;
  cancel(userId: string, id: string): Promise<Run>;
  retry(userId: string, id: string, key: string | undefined): Promise<Run>;
  claim(): Promise<AgentJob | null>;
  progress(id: string, delta: string | null, stage?: string,phase?:AnswerPhase): Promise<boolean>;
  finish(id: string, outcome: "succeeded" | "failed" | "cancelled", note?: string, externalRef?: string): Promise<Run | undefined>;
  recoverInterrupted(): Promise<number>;
  getStatus(id: string): Promise<RunStatus | undefined>;
}
