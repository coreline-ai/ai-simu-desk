import { pgTable, text, timestamp, boolean, uniqueIndex, index, integer, bigserial, jsonb, primaryKey, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AgentId, RunStatus } from "../domain/contracts.js";

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
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(), ...dates(),
});
export const members = pgTable("members", {
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), role: text("role").notNull().default("owner"),
}, t => [primaryKey({ columns: [t.workspaceId, t.userId] })]);
export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  authorId: text("author_id").notNull().references(() => user.id), prompt: text("prompt").notNull(),
  agentId: text("agent_id").$type<AgentId>().notNull(), approvalRequired: boolean("approval_required").notNull(),
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
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id), runId: text("run_id").notNull().references(() => runs.id),
  seq: integer("seq").notNull(), kind: text("kind").notNull(), payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("events_run_seq").on(t.runId, t.seq), index("events_workspace_cursor").on(t.workspaceId, t.cursor)]);
