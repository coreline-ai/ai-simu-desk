import { randomUUID } from "node:crypto";
import { AppError } from "../domain/contracts.js";
import type { WorkspaceMember } from "../domain/workspace-port.js";

export const PRESENCE_TTL_MS = 75_000;
export interface PresenceIdentity { userId: string; sessionId: string; expiresAt: Date }
interface Lease { userId: string; name: string; sessionId: string; expires: number; closed: boolean }
interface PresenceEvent { seq: number; userId: string; name: string; kind: "joined" | "left"; reason: "page" | "timeout" | "logout" | "revoked"; at: string }
interface Room { leases: Map<string,Lease>; events: PresenceEvent[]; version: number; touched: number }
// Ephemeral, single-process presence. Heartbeats never write the durable task log.
export function createPresence(readMembers: (userId: string, workspaceId: string) => Promise<WorkspaceMember[]>, now = Date.now) {
  const rooms = new Map<string,Room>(), instance = randomUUID(), loggedOut = new Map<string,number>();
  function activeSession(identity: PresenceIdentity) {
    if(identity.expiresAt.getTime()<=now()||(loggedOut.get(identity.sessionId)??0)>now()) throw new AppError(401,"로그인이 필요합니다.");
  }
  function online(room: Room,userId: string) { return [...room.leases.values()].some(l=>l.userId===userId&&!l.closed); }
  function record(room: Room,lease: Lease,kind: PresenceEvent["kind"],reason: PresenceEvent["reason"],at=now()) {
    room.events.push({seq:++room.version,userId:lease.userId,name:lease.name,kind,reason,at:new Date(at).toISOString()});
    room.events=room.events.slice(-20);
  }
  function close(room: Room,lease: Lease,reason: PresenceEvent["reason"],at=now()) {
    if(lease.closed) return;
    lease.closed=true; lease.expires=now()+PRESENCE_TTL_MS;
    if(!online(room,lease.userId)) record(room,lease,"left",reason,at);
  }
  function sweep(room: Room,people?: WorkspaceMember[]) {
    // Oldest expiry first gives the last surviving tab's expiry as departure time.
    for(const [key,lease] of [...room.leases].sort((a,b)=>a[1].expires-b[1].expires)) {
      if(lease.closed) {if(lease.expires<=now()) room.leases.delete(key);}
      else if(people&&!people.some(p=>p.userId===lease.userId)) close(room,lease,"revoked");
      else if(lease.expires<=now()) { // Expiry is reconnectable; explicit leave remains a tombstone.
        room.leases.delete(key);
        if(!online(room,lease.userId)) record(room,lease,"left","timeout",lease.expires);
      }
    }
  }
  async function access(identity: PresenceIdentity,workspaceId: string,clientId: unknown) {
    if(typeof clientId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) throw new AppError(400,"접속 식별자를 확인해 주세요.");
    activeSession(identity);
    const people=await readMembers(identity.userId,workspaceId);
    if(!people.some(p=>p.userId===identity.userId)) throw new AppError(404,"작업 공간을 찾을 수 없습니다.");
    for(const [id,room] of rooms) if(room.touched<now()-600_000) {sweep(room);if(![...room.leases.values()].some(l=>!l.closed)) rooms.delete(id);}
    let room=rooms.get(workspaceId);
    if(!room) {
      if(rooms.size>=1024) throw new AppError(429,"접속 공간이 많습니다. 잠시 후 다시 시도해 주세요.");
      room={leases:new Map(),events:[],version:0,touched:now()}; rooms.set(workspaceId,room);
    }
    room.touched=now(); sweep(room,people);
    return {room,people,key:`${identity.sessionId}:${clientId}`};
  }
  return {
    async touch(identity: PresenceIdentity,workspaceId: string,clientId: unknown) {
      const {room,people,key}=await access(identity,workspaceId,clientId);activeSession(identity);
      const old=room.leases.get(key);
      if(old?.closed) throw new AppError(409,"종료된 접속입니다. 다시 연결해 주세요.","PRESENCE_CLOSED");
      if(!old) {
        if(room.leases.size>=256||[...room.leases.values()].filter(l=>l.sessionId===identity.sessionId).length>=16) throw new AppError(429,"접속 탭이 많습니다. 사용하지 않는 탭을 닫아 주세요.");
        const wasOnline=online(room,identity.userId),person=people.find(p=>p.userId===identity.userId)!;
        const lease={userId:identity.userId,name:person.name,sessionId:identity.sessionId,expires:Math.min(now()+PRESENCE_TTL_MS,identity.expiresAt.getTime()),closed:false};
        room.leases.set(key,lease); if(!wasOnline) record(room,lease,"joined","page");
      } else old.expires=Math.min(now()+PRESENCE_TTL_MS,identity.expiresAt.getTime());
      return {instance,version:room.version,serverTime:new Date(now()).toISOString(),ttlMs:PRESENCE_TTL_MS,
        members:people.map(p=>({userId:p.userId,online:online(room,p.userId)})),events:room.events};
    },
    async leave(identity: PresenceIdentity,workspaceId: string,clientId: unknown) {
      const {room,key,people}=await access(identity,workspaceId,clientId);activeSession(identity);
      const lease=room.leases.get(key);
      if(lease) close(room,lease,"page");
      else { // A leave can reach the server before its in-flight first heartbeat.
        if(room.leases.size>=256) throw new AppError(429,"접속 정리 중입니다. 잠시 후 다시 시도해 주세요.");
        room.leases.set(key,{userId:identity.userId,name:people.find(p=>p.userId===identity.userId)!.name,sessionId:identity.sessionId,expires:now()+PRESENCE_TTL_MS,closed:true});
      }
      return {ok:true};
    },
    leaveSession(sessionId: string) {
      for(const [id,expiry] of loggedOut) if(expiry<=now()) loggedOut.delete(id);
      if(loggedOut.size>=4096) loggedOut.delete(loggedOut.keys().next().value!);
      loggedOut.set(sessionId,now()+PRESENCE_TTL_MS);
      for(const room of rooms.values()) {sweep(room);for(const lease of room.leases.values()) if(lease.sessionId===sessionId) close(room,lease,"logout");}
    },
  };
}
export type Presence = ReturnType<typeof createPresence>;
