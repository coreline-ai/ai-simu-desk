import { pgTable, text, timestamp, boolean, uniqueIndex, index, integer, bigint, bigserial, jsonb, primaryKey, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type {FakeAnswer,AnswerPhase,SourceContext} from "../domain/fake-answer.js";
import type { AgentId, RunStatus } from "../domain/contracts.js";
import type { InviteRole, MemberRole } from "../domain/collaboration.js";

const dates = () => ({ createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow() });
export const user = pgTable("auth_user", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false), image: text("image"), ...dates(),
});
export const session = pgTable("auth_session", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"), userAgent: text("user_agent"), ...dates(),
}, t => [index("session_user_idx").on(t.userId)]);
export const account = pgTable("auth_account", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(),
  accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"), scope: text("scope"), password: text("password"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }), refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }), ...dates(),
}, t => [uniqueIndex("account_provider_idx").on(t.providerId, t.accountId)]);
export const verification = pgTable("auth_verification", {
  id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), ...dates(),
}, t => [index("verification_identifier_idx").on(t.identifier)]);

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(), kind: text("kind").$type<"personal" | "shared">().notNull().default("personal"),
  revision: integer("revision").notNull().default(1), creationKey: text("creation_key"), ...dates(),
}, t => [uniqueIndex("workspaces_one_personal").on(t.ownerId).where(sql`${t.kind}='personal'`), uniqueIndex("workspaces_creation_key").on(t.ownerId, t.creationKey)]);
export const members = pgTable("members", {
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), role: text("role").$type<MemberRole>().notNull().default("viewer"),
}, t => [primaryKey({ columns: [t.workspaceId, t.userId] }), uniqueIndex("members_one_owner").on(t.workspaceId).where(sql`${t.role}='owner'`)]);
export const workspaceInvites = pgTable("workspace_invites", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(), role: text("role").$type<InviteRole>().notNull(),
  issuedBy: text("issued_by").notNull().references(() => user.id), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedBy: text("used_by").references(() => user.id), usedAt: timestamp("used_at", { withTimezone: true }), revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("invites_workspace_idx").on(t.workspaceId)]);
export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  authorId: text("author_id").notNull().references(() => user.id), sourceContext:jsonb("source_context").$type<SourceContext>(), prompt: text("prompt").notNull(),
  agentId: text("agent_id").$type<AgentId>().notNull(), team:boolean("team").notNull().default(false), approvalRequired: boolean("approval_required").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const runs = pgTable("runs", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  taskId: text("task_id").notNull().references(() => tasks.id), requestedBy: text("requested_by").notNull().references(() => user.id),
  requestKey: text("request_key").notNull(), requestHash: text("request_hash").notNull(),
  status: text("status").$type<RunStatus>().notNull(), version: integer("version").notNull().default(1),
  output: text("output").notNull().default(""), stage: text("stage").notNull().default("요청 접수"), note: text("note").notNull().default(""),
  provider: text("provider").notNull().default("fake"), externalRef: text("external_ref"),
  scenario: text("scenario").$type<"normal" | "failure">().notNull(),
  generatedAnswer: jsonb("generated_answer").$type<FakeAnswer>(),
  phase: text("phase").$type<AnswerPhase>().notNull().default("analyze"),
  simulatedStartedAt: timestamp("simulated_started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }), ...dates(),
}, t => [
  uniqueIndex("runs_request_key").on(t.workspaceId, t.requestKey),
  uniqueIndex("runs_one_active").on(t.workspaceId).where(sql`${t.status} in ('awaiting_approval','queued','running','cancel_requested')`),
  index("runs_queue_idx").on(t.status, t.createdAt),
  check("runs_status_check", sql`${t.status} in ('awaiting_approval','queued','running','cancel_requested','succeeded','failed','cancelled')`),
]);
export const approvals = pgTable("approvals", {
  id: text("id").primaryKey(), runId: text("run_id").notNull().unique().references(() => runs.id),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  status: text("status").$type<"pending" | "approved" | "declined">().notNull(), decidedBy: text("decided_by").references(() => user.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const runEvents = pgTable("run_events", {
  cursor: bigserial("cursor", { mode: "number" }).primaryKey(), id: text("id").notNull().unique(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id), runId: text("run_id").references(() => runs.id),
  seq: integer("seq").notNull(), kind: text("kind").notNull(), payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("events_run_seq").on(t.runId, t.seq), uniqueIndex("events_workspace_revision").on(t.workspaceId,t.seq).where(sql`${t.runId} IS NULL`), index("events_workspace_cursor").on(t.workspaceId, t.cursor)]);

export const presenceRooms=pgTable("presence_rooms",{workspaceId:text("workspace_id").primaryKey().references(()=>workspaces.id,{onDelete:"cascade"}),version:integer("version").notNull().default(0)});
export const presenceClients=pgTable("presence_clients",{
  workspaceId:text("workspace_id").notNull().references(()=>workspaces.id,{onDelete:"cascade"}),sessionId:text("session_id").notNull(),clientId:text("client_id").notNull(),
  userId:text("user_id").notNull().references(()=>user.id,{onDelete:"cascade"}),expiresAt:timestamp("expires_at",{withTimezone:true}).notNull(),closed:boolean("closed").notNull().default(false),
},t=>[primaryKey({columns:[t.workspaceId,t.sessionId,t.clientId]}),index("presence_clients_session").on(t.sessionId)]);
export const presenceStatus=pgTable("presence_status",{
  workspaceId:text("workspace_id").notNull().references(()=>workspaces.id,{onDelete:"cascade"}),userId:text("user_id").notNull().references(()=>user.id,{onDelete:"cascade"}),name:text("name").notNull(),online:boolean("online").notNull(),
},t=>[primaryKey({columns:[t.workspaceId,t.userId]})]);
export const presenceEvents=pgTable("presence_events",{
  workspaceId:text("workspace_id").notNull().references(()=>workspaces.id,{onDelete:"cascade"}),seq:integer("seq").notNull(),userId:text("user_id").notNull(),name:text("name").notNull(),
  kind:text("kind").$type<"joined"|"left">().notNull(),reason:text("reason").$type<"page"|"timeout"|"logout"|"revoked">().notNull(),happenedAt:timestamp("happened_at",{withTimezone:true}).notNull(),
},t=>[primaryKey({columns:[t.workspaceId,t.seq]})]);

export const rateLimit=pgTable("auth_rate_limit",{id:text("id").primaryKey(),key:text("key").notNull().unique(),count:integer("count").notNull(),lastRequest:bigint("last_request",{mode:"number"}).notNull()});

export const projectSettings=pgTable('project_settings',{
 workspaceId:text('workspace_id').primaryKey().references(()=>workspaces.id,{onDelete:'cascade'}),version:integer('version').notNull().default(1),
 goal:text('goal').notNull().default(''),audience:text('audience').notNull().default(''),technology:text('technology').notNull().default(''),exclusions:text('exclusions').notNull().default(''),
 updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
});

export const taskComments=pgTable('task_comments',{
 id:text('id').primaryKey(),workspaceId:text('workspace_id').notNull().references(()=>workspaces.id,{onDelete:'cascade'}),runId:text('run_id').notNull().references(()=>runs.id,{onDelete:'cascade'}),authorId:text('author_id').notNull().references(()=>user.id),body:text('body').notNull(),requestKey:text('request_key').notNull(),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('comments_request_key').on(t.runId,t.authorId,t.requestKey)]);
export const notifications=pgTable('notifications',{
 id:text('id').primaryKey(),workspaceId:text('workspace_id').notNull().references(()=>workspaces.id,{onDelete:'cascade'}),userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),runId:text('run_id').notNull().references(()=>runs.id,{onDelete:'cascade'}),kind:text('kind').$type<'approval_requested'|'completed'|'failed'|'comment'>().notNull(),sourceKey:text('source_key').notNull(),readAt:timestamp('read_at',{withTimezone:true}),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('notifications_source').on(t.userId,t.sourceKey)]);
