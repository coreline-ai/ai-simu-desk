import { and, eq, gt } from "drizzle-orm";
import type { StudioDatabase as Database } from "./types.js";
import { members, workspaces, session } from "./schema.js";
import {isGuestId} from '../domain/guest.js';
import { AppError } from "../domain/contracts.js";
export type Tx = Parameters<Parameters<Database["db"]["transaction"]>[0]>[0];
export type Store = Database["db"] | Tx;
export const EXPIRED_GUEST_SPACE='체험 소유자의 세션이 끝나 읽기 전용으로 보존된 공간입니다. 일반 계정 소유자의 공간에 참여해 주세요.';
export async function expiredGuestWorkspace(db:Store,id:string) {
  const [space]=await db.select().from(workspaces).where(eq(workspaces.id,id));
  if(!space||space.kind!=='shared'||!isGuestId(space.ownerId))return false;
  const [active]=await db.select({id:session.id}).from(session).where(and(eq(session.userId,space.ownerId),gt(session.expiresAt,new Date()))).limit(1);
  return !active;
}
export async function workspaceMember(db: Store, userId: string, workspaceId: string) {
  const [row] = await db.select().from(members).where(and(eq(members.userId, userId), eq(members.workspaceId, workspaceId)));
  if (!row) throw new AppError(404, "작업 공간을 찾을 수 없습니다.", "NOT_FOUND");
  return await expiredGuestWorkspace(db,workspaceId)?{...row,role:'viewer' as const,readOnlyReason:EXPIRED_GUEST_SPACE}:{...row,readOnlyReason:undefined};
}
