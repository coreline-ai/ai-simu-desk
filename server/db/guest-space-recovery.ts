import {and,eq,isNull} from 'drizzle-orm';
import {randomUUID} from 'node:crypto';
import type {StudioDatabase} from './types.js';
import {workspaces,members,workspaceInvites,runEvents} from './schema.js';
import {isGuestId} from '../domain/guest.js';
import {AppError} from '../domain/contracts.js';

// Offline local-operator tool only. It is deliberately absent from the HTTP API.
export async function recoverGuestOwner(database:StudioDatabase,id:string,targetId:string,revision:number){
 return database.db.transaction(async tx=>{
  const [space]=await tx.select().from(workspaces).where(eq(workspaces.id,id));
  const [target]=await tx.select().from(members).where(and(eq(members.workspaceId,id),eq(members.userId,targetId)));
  if(!space||space.kind!=='shared'||!isGuestId(space.ownerId)||!target||target.role!=='member'||isGuestId(targetId))throw new AppError(400,'기존 게스트 소유 공동 공간과 일반 계정 업무 참여자를 지정해 주세요.');
  if(space.revision!==revision)throw new AppError(409,'공간 정보가 변경됐습니다. 먼저 다시 조사해 주세요.');
  await tx.update(members).set({role:'viewer'}).where(and(eq(members.workspaceId,id),eq(members.userId,space.ownerId)));
  await tx.update(members).set({role:'owner'}).where(and(eq(members.workspaceId,id),eq(members.userId,targetId)));
  const [next]=await tx.update(workspaces).set({ownerId:targetId,revision:revision+1,updatedAt:new Date()}).where(and(eq(workspaces.id,id),eq(workspaces.revision,revision))).returning();
  if(!next)throw new AppError(409,'공간 정보가 변경됐습니다.');
  await tx.update(workspaceInvites).set({revokedAt:new Date()}).where(and(eq(workspaceInvites.workspaceId,id),isNull(workspaceInvites.usedAt),isNull(workspaceInvites.revokedAt)));
  await tx.insert(runEvents).values({id:randomUUID(),workspaceId:id,seq:next.revision,kind:'guest_owner_recovered',payload:{previousOwner:space.ownerId,ownerId:targetId}});
  return next;
 });
}
