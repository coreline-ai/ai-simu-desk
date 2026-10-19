import { and, asc, count, eq, isNull } from "drizzle-orm";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import type { StudioDatabase as Database } from "./types.js";
import { members, workspaces, workspaceInvites, runEvents } from "./schema.js";
import { workspaceMember, type Tx } from "./workspace-access.js";
import { AppError, validRequestKey } from "../domain/contracts.js";
import { inviteRole, workspaceName, workspaceVersion } from "../domain/collaboration.js";
import type { WorkspacePort } from "../domain/workspace-port.js";

type Space = typeof workspaces.$inferSelect;
const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");
async function sharedOwner(tx: Tx, userId: string, id: string, version: unknown) {
  const membership = await workspaceMember(tx, userId, id);
  const [space] = await tx.select().from(workspaces).where(eq(workspaces.id, id));
  if (membership.role !== "owner" || space.ownerId !== userId || space.kind !== "shared") throw new AppError(403, "공동 공간 소유자만 관리할 수 있습니다.", "ROLE_FORBIDDEN");
  if (space.revision !== workspaceVersion(version)) throw new AppError(409, "참여자 정보가 바뀌었습니다. 다시 확인해 주세요.", "STATE_CONFLICT");
  return space;
}
async function spaceEvent(tx: Tx, space: Space, kind: string, actorId: string) {
  await tx.insert(runEvents).values({ id: randomUUID(), workspaceId: space.id, runId: null, seq: space.revision, kind, payload: { actorId, revision: space.revision } });
}
async function changed(tx: Tx, space: Space, kind: string, actorId: string) {
  const [next] = await tx.update(workspaces).set({ revision: space.revision + 1, updatedAt: new Date() }).where(and(eq(workspaces.id, space.id), eq(workspaces.revision,space.revision))).returning();
  if (!next) throw new AppError(409, "공간 정보가 바뀌었습니다.", "STATE_CONFLICT");
  await spaceEvent(tx, next, kind, actorId); return next;
}
export function createWorkspaceStore(database: Database): WorkspacePort {
  const db = database.db;
  async function personalWorkspace(userId: string, name: string) {
    return db.transaction(async tx => {
      const [created] = await tx.insert(workspaces).values({ id: randomUUID(), ownerId: userId, name: `${name.slice(0,30)}의 스튜디오`, kind: "personal" }).onConflictDoNothing().returning();
      if (created) await tx.insert(members).values({ workspaceId: created.id, userId, role: "owner" });
      const [space] = created ? [created] : await tx.select().from(workspaces).where(and(eq(workspaces.ownerId,userId),eq(workspaces.kind,"personal")));
      await workspaceMember(tx,userId,space.id); return space;
    });
  }
  async function listWorkspaces(userId: string) {
    const rows = await db.select({ workspace: workspaces, role: members.role }).from(members).innerJoin(workspaces,eq(members.workspaceId,workspaces.id)).where(eq(members.userId,userId)).orderBy(asc(workspaces.createdAt),asc(workspaces.id));
    return rows.map(row => ({ ...row.workspace, role: row.role }));
  }
  async function createWorkspace(userId: string, value: unknown, requestKey: string | undefined) {
    const name = workspaceName(value), key = validRequestKey(requestKey);
    return db.transaction(async tx => {
      const [old] = await tx.select().from(workspaces).where(and(eq(workspaces.ownerId,userId),eq(workspaces.creationKey,key)));
      if (old) { if (old.name !== name) throw new AppError(409,"같은 요청 키에 다른 공간 이름을 보낼 수 없습니다.","KEY_CONFLICT"); return old; }
      const [total] = await tx.select({ n: count() }).from(workspaces).where(and(eq(workspaces.ownerId,userId),eq(workspaces.kind,"shared")));
      if (total.n >= 5) throw new AppError(409,"공동 공간은 소유자당 5개까지 만들 수 있습니다.","SPACE_LIMIT");
      const [space] = await tx.insert(workspaces).values({ id: randomUUID(), ownerId:userId, kind:"shared",name,creationKey:key }).returning();
      await tx.insert(members).values({ workspaceId:space.id,userId,role:"owner" });
      await spaceEvent(tx,space,"workspace_created",userId); return space;
    });
  }
  async function clearInvites(tx: Tx, id: string) { await tx.update(workspaceInvites).set({ revokedAt:new Date() }).where(and(eq(workspaceInvites.workspaceId,id),isNull(workspaceInvites.usedAt),isNull(workspaceInvites.revokedAt))); }
  async function issueInvite(userId: string, id: string, value: unknown, version: unknown) {
    const role = inviteRole(value), code = `desk_${randomBytes(24).toString("base64url")}`, expiresAt = new Date(Date.now()+60*60*1000);
    return db.transaction(async tx => {
      const space = await sharedOwner(tx,userId,id,version);
      await clearInvites(tx,id);
      await tx.insert(workspaceInvites).values({ id:randomUUID(),workspaceId:id,tokenHash:hashCode(code),role,issuedBy:userId,expiresAt });
      const next = await changed(tx,space,"invite_changed",userId);
      return { code,expiresAt,revision:next.revision };
    });
  }
  async function revokeInvites(userId: string, id: string, version: unknown) {
    return db.transaction(async tx => { const space = await sharedOwner(tx,userId,id,version); await clearInvites(tx,id); return changed(tx,space,"invite_changed",userId); });
  }
  async function joinWorkspace(userId: string, value: unknown) {
    const invalid = () => new AppError(400,"초대 코드가 만료되었거나 유효하지 않습니다.","INVITE_INVALID");
    if (typeof value !== "string" || !/^desk_[A-Za-z0-9_-]{32}$/.test(value.trim())) throw invalid();
    return db.transaction(async tx => {
      const [invite] = await tx.select().from(workspaceInvites).where(eq(workspaceInvites.tokenHash,hashCode(value.trim())));
      if (!invite) throw invalid();
      const [membership] = await tx.select().from(members).where(and(eq(members.workspaceId,invite.workspaceId),eq(members.userId,userId)));
      const [space] = await tx.select().from(workspaces).where(eq(workspaces.id,invite.workspaceId));
      if (invite.usedBy === userId && membership) return space;
      if (invite.usedAt || invite.revokedAt || invite.expiresAt.getTime() <= Date.now() || space.kind !== "shared") throw invalid();
      if (membership) return space; // An invite never upgrades an existing member.
      const [total] = await tx.select({ n:count() }).from(members).where(eq(members.workspaceId,space.id));
      if (total.n >= 20) throw new AppError(409,"한 공간에는 20명까지 참여할 수 있습니다.","MEMBER_LIMIT");
      await tx.insert(members).values({ workspaceId:space.id,userId,role:invite.role });
      await tx.update(workspaceInvites).set({ usedAt:new Date(),usedBy:userId }).where(eq(workspaceInvites.id,invite.id));
      return changed(tx,space,"members_changed",userId);
    });
  }
  async function updateMember(userId: string, id: string, target: string, value: unknown, version: unknown) {
    const role = value === null ? null : inviteRole(value);
    return db.transaction(async tx => {
      const space = await sharedOwner(tx,userId,id,version);
      const membership = await workspaceMember(tx,target,id);
      if (membership.role === "owner" || target === space.ownerId) throw new AppError(403,"소유자의 권한은 변경할 수 없습니다.","ROLE_FORBIDDEN");
      if (role === membership.role) return space;
      const where = and(eq(members.workspaceId,id),eq(members.userId,target));
      if (role === null) await tx.delete(members).where(where);
      else await tx.update(members).set({ role }).where(where);
      return changed(tx,space,"members_changed",userId);
    });
  }
  return { personalWorkspace,listWorkspaces,createWorkspace,issueInvite,revokeInvites,joinWorkspace,updateMember };
}
