import {and,eq,lte,desc} from "drizzle-orm";
import type {StudioDatabase} from "./types.js";
import {members,user,session,workspaces,presenceRooms,presenceClients,presenceStatus,presenceEvents} from "./schema.js";
import {AppError} from "../domain/contracts.js";
import type {PresencePort,PresenceIdentity,PresenceEvent} from "../domain/presence.js";
import {PRESENCE_TTL_MS} from "../application/presence.js";

export function createSharedPresence(database:StudioDatabase,now=Date.now):PresencePort {
  const db=database.db;
  async function sync(workspaceId:string,identity?:PresenceIdentity,clientId?:string,leaving=false,logoutSession?:string) {
    return db.transaction(async tx=>{
      const time=now();
      const people=await tx.select({userId:members.userId,name:user.name}).from(members).innerJoin(user,eq(members.userId,user.id)).where(eq(members.workspaceId,workspaceId));
      const [space]=await tx.select().from(workspaces).where(eq(workspaces.id,workspaceId));
      if(!space||identity&&!people.some(p=>p.userId===identity.userId))throw new AppError(404,"작업 공간을 찾을 수 없습니다.");
      if(space.kind!=="shared")throw new AppError(400,"공동 공간에서만 접속 상태를 공유합니다.");
      if(identity) {
        const [active]=await tx.select().from(session).where(and(eq(session.id,identity.sessionId),eq(session.userId,identity.userId)));
        if(!active||active.expiresAt.getTime()<=time)throw new AppError(401,"로그인이 필요합니다.");
      }
      await tx.insert(presenceRooms).values({workspaceId}).onConflictDoNothing();
      const [room]=await tx.select().from(presenceRooms).where(eq(presenceRooms.workspaceId,workspaceId));
      await tx.delete(presenceClients).where(and(eq(presenceClients.workspaceId,workspaceId),eq(presenceClients.closed,true),lte(presenceClients.expiresAt,new Date(time))));
      const rows=await tx.select({lease:presenceClients,auth:session}).from(presenceClients).leftJoin(session,eq(session.id,presenceClients.sessionId)).where(eq(presenceClients.workspaceId,workspaceId));
      const survived=new Set<string>();
      const reasons=new Map<string,{reason:PresenceEvent['reason'];at:number}>();
      for(const {lease,auth} of rows) {
        if(lease.closed)continue;
        let reason:PresenceEvent['reason']|undefined,at=time;
        if(!people.some(p=>p.userId===lease.userId))reason="revoked";
        else if(logoutSession===lease.sessionId||!auth)reason="logout";
        else if(auth.expiresAt.getTime()<=time||lease.expiresAt.getTime()<=time){reason="timeout";at=Math.min(auth.expiresAt.getTime(),lease.expiresAt.getTime());}
        if(reason){
          if(reason==="timeout")await tx.delete(presenceClients).where(and(eq(presenceClients.workspaceId,workspaceId),eq(presenceClients.sessionId,lease.sessionId),eq(presenceClients.clientId,lease.clientId)));
          else await tx.update(presenceClients).set({closed:true,expiresAt:new Date(time+PRESENCE_TTL_MS)}).where(and(eq(presenceClients.workspaceId,workspaceId),eq(presenceClients.sessionId,lease.sessionId),eq(presenceClients.clientId,lease.clientId)));
          const previous=reasons.get(lease.userId);if(!previous||at>=previous.at)reasons.set(lease.userId,{reason,at});
        } else survived.add(lease.userId);
      }
      if(identity&&clientId) {
        const where=and(eq(presenceClients.workspaceId,workspaceId),eq(presenceClients.sessionId,identity.sessionId),eq(presenceClients.clientId,clientId));
        const [old]=await tx.select().from(presenceClients).where(where);
        if(old?.closed&&!leaving)throw new AppError(409,"종료된 접속입니다. 다시 연결해 주세요.","PRESENCE_CLOSED");
        if(!old) {
          const all=await tx.select().from(presenceClients).where(eq(presenceClients.workspaceId,workspaceId));
          if(all.length>=256||all.filter(l=>l.sessionId===identity.sessionId).length>=16)throw new AppError(429,"접속 탭이 많습니다. 잠시 후 다시 시도해 주세요.");
          await tx.insert(presenceClients).values({workspaceId,sessionId:identity.sessionId,clientId,userId:identity.userId,closed:leaving,expiresAt:new Date(leaving?time+PRESENCE_TTL_MS:Math.min(time+PRESENCE_TTL_MS,identity.expiresAt.getTime()))});
        } else await tx.update(presenceClients).set({closed:leaving,expiresAt:new Date(leaving?time+PRESENCE_TTL_MS:Math.min(time+PRESENCE_TTL_MS,identity.expiresAt.getTime()))}).where(where);
        if(leaving)reasons.set(identity.userId,{reason:"page",at:time});
      }
      const active=await tx.select().from(presenceClients).where(and(eq(presenceClients.workspaceId,workspaceId),eq(presenceClients.closed,false)));
      const online=new Set(active.map(l=>l.userId)),before=await tx.select().from(presenceStatus).where(eq(presenceStatus.workspaceId,workspaceId));
      const names=new Map([...before.map(p=>[p.userId,p.name] as const),...people.map(p=>[p.userId,p.name] as const)]);
      let version=room.version;
      for(const [userId,name] of names) {
        const was=before.find(p=>p.userId===userId)?.online??false,isOnline=online.has(userId);
        if(was&&isOnline&&!survived.has(userId)&&reasons.has(userId)) {
          const cause=reasons.get(userId)!;
          await tx.insert(presenceEvents).values({workspaceId,seq:++version,userId,name,kind:"left",reason:cause.reason,happenedAt:new Date(cause.at)});
          await tx.insert(presenceEvents).values({workspaceId,seq:++version,userId,name,kind:"joined",reason:"page",happenedAt:new Date(time)});
        }
        if(was!==isOnline) {
          const cause=reasons.get(userId);
          await tx.insert(presenceEvents).values({workspaceId,seq:++version,userId,name,kind:isOnline?"joined":"left",reason:isOnline?"page":cause?.reason??"timeout",happenedAt:new Date(isOnline?time:cause?.at??time)});
        }
        if(!people.some(p=>p.userId===userId)&&!isOnline)await tx.delete(presenceStatus).where(and(eq(presenceStatus.workspaceId,workspaceId),eq(presenceStatus.userId,userId)));
        else if(!before.some(p=>p.userId===userId&&p.online===isOnline&&p.name===name)) await tx.insert(presenceStatus).values({workspaceId,userId,name,online:isOnline}).onConflictDoUpdate({target:[presenceStatus.workspaceId,presenceStatus.userId],set:{name,online:isOnline}});
      }
      if(version!==room.version)await tx.update(presenceRooms).set({version}).where(eq(presenceRooms.workspaceId,workspaceId));
      await tx.delete(presenceEvents).where(and(eq(presenceEvents.workspaceId,workspaceId),lte(presenceEvents.seq,version-20)));
      const events=await tx.select().from(presenceEvents).where(eq(presenceEvents.workspaceId,workspaceId)).orderBy(desc(presenceEvents.seq)).limit(20);
      return {instance:`postgres:${workspaceId}`,version,serverTime:new Date(time).toISOString(),ttlMs:PRESENCE_TTL_MS,members:people.map(p=>({userId:p.userId,online:online.has(p.userId)})),events:events.reverse().map(e=>({seq:e.seq,userId:e.userId,name:e.name,kind:e.kind,reason:e.reason,at:e.happenedAt.toISOString()}))};
    });
  }
  function valid(value:unknown):asserts value is string {
    if(typeof value!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw new AppError(400,"접속 식별자를 확인해 주세요.");
  }
  return {
    async touch(identity,workspaceId,clientId){valid(clientId);return sync(workspaceId,identity,clientId);},
    async leave(identity,workspaceId,clientId){valid(clientId);await sync(workspaceId,identity,clientId,true);return {ok:true};},
    async leaveSession(sessionId){
      const rooms=await db.selectDistinct({id:presenceClients.workspaceId}).from(presenceClients).where(eq(presenceClients.sessionId,sessionId));
      for(const room of rooms)await sync(room.id,undefined,undefined,false,sessionId);
    },
  };
}
