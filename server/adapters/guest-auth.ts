import { APIError, createAuthEndpoint, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import {and,eq,gt,like} from 'drizzle-orm';
import {randomUUID,randomBytes} from 'node:crypto';
import type { StudioDatabase } from '../db/types.js';
import { user,session as sessions } from '../db/schema.js';

import {GUEST_PREFIX,GUEST_LIMIT,GUEST_TTL_MS,isGuestId} from '../domain/guest.js';
export {GUEST_ID,GUEST_PREFIX,GUEST_LIMIT,GUEST_TTL_MS,isGuestId} from '../domain/guest.js';
export const GUEST_EMAIL = 'guest@ai-simu-desk.invalid';
const safePaths = new Set(['/sign-in/guest','/sign-in/email','/sign-up/email','/sign-out','/get-session']);

export function guestAuth(database: StudioDatabase) {
 return {
  id:'studio-guest',
  endpoints:{signInGuest:createAuthEndpoint('/sign-in/guest',{method:'POST'},async ctx=>{
   const current=await getSessionFromCtx(ctx);
   if(current){if(!isGuestId(current.user.id))throw new APIError('CONFLICT',{message:'로그아웃한 뒤 게스트로 시작해 주세요.',code:'ALREADY_SIGNED_IN'});return ctx.json({success:true});}
   // The same transaction lock serializes the count+insert on local and pooled PG.
   // New identities prevent slot reuse from exposing a previous visitor's work.
   const result=await database.db.transaction(async tx=>{
    const time=new Date();
    const active=await tx.select({id:sessions.id}).from(sessions).innerJoin(user,eq(user.id,sessions.userId)).where(and(like(user.id,GUEST_PREFIX+'%'),gt(sessions.expiresAt,time)));
    if(active.length>=GUEST_LIMIT)throw new APIError('TOO_MANY_REQUESTS',{message:'게스트 5명이 모두 이용 중이에요. 다른 게스트가 로그아웃하거나 2시간 세션이 만료된 뒤 다시 시도해 주세요.',code:'GUEST_FULL'});
    const id=GUEST_PREFIX+randomUUID();
    const [guest]=await tx.insert(user).values({id,name:'게스트 '+id.slice(-4),email:id+'@ai-simu-desk.invalid',emailVerified:false}).returning();
    const [session]=await tx.insert(sessions).values({id:randomUUID(),userId:id,token:randomBytes(32).toString('base64url'),expiresAt:new Date(time.getTime()+GUEST_TTL_MS),createdAt:time,updatedAt:time,ipAddress:null,userAgent:ctx.headers?.get('user-agent')?.slice(0,500)??null}).returning();
    return {user:guest,session};
   });
   await setSessionCookie(ctx,result);
   return ctx.json({success:true});
  })},
  hooks:{before:[{matcher:()=>true,handler:createAuthMiddleware(async ctx=>{
   if(ctx.path==='/sign-up/email'&&typeof ctx.body?.email==='string'&&ctx.body.email.trim().toLowerCase().endsWith('@ai-simu-desk.invalid'))throw new APIError('BAD_REQUEST',{message:'체험 계정 전용 이메일입니다.',code:'RESERVED_GUEST_EMAIL'});
   if(safePaths.has(ctx.path??''))return;
   const current=await getSessionFromCtx(ctx);
   if(current&&isGuestId(current.user.id))throw new APIError('FORBIDDEN',{message:'게스트 계정 정보는 변경할 수 없습니다.',code:'GUEST_ACCOUNT_LOCKED'});
  })}]},
 };
}
