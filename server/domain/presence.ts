export interface PresenceIdentity {userId:string;sessionId:string;expiresAt:Date}
export interface PresenceEvent {seq:number;userId:string;name:string;kind:"joined"|"left";reason:"page"|"timeout"|"logout"|"revoked";at:string}
export interface PresenceView {instance:string;version:number;serverTime:string;ttlMs:number;members:{userId:string;online:boolean}[];events:PresenceEvent[]}
export interface PresencePort {
  touch(identity:PresenceIdentity,workspaceId:string,clientId:unknown):Promise<PresenceView>;
  leave(identity:PresenceIdentity,workspaceId:string,clientId:unknown):Promise<{ok:boolean}>;
  leaveSession(sessionId:string):void|Promise<void>;
}
