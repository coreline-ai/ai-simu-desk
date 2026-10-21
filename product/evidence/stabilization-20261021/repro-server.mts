// Read-only review reproduction, not a passing regression gate. Run from repository root.
import {createFakeAnswer} from '../../../server/domain/fake-answer.ts';
import {openDatabase} from '../../../server/db/database.ts';
import {createStudio} from '../../../server/db/studio-store.ts';
import {createRuntime} from '../../../server/runtime.ts';
import {getConfig} from '../../../server/config.ts';
import {user,session} from '../../../server/db/schema.ts';
import {randomBytes, randomUUID} from 'node:crypto';
import {eq} from '../../../node_modules/drizzle-orm/index.js';
const prompt='로그인 제외. 개발 계획을 작성해줘';
const input={runId:'review',prompt,agentId:'nara',scenario:'normal'} as const;
const solo=createFakeAnswer(input),team=createFakeAnswer({...input,team:true});
console.log(JSON.stringify({case:'excluded-items',soloBlocked:solo.body.includes('결과를 확정하지 않았'),teamExcludedTask:team.body.includes('이메일 로그인'),excludedTerms:team.analysis.exclusions},null,2));
const db=await openDatabase();
try {
 const config=getConfig({BETTER_AUTH_SECRET:randomBytes(40).toString('hex')});
 const app=createRuntime(db,config),s=createStudio(db);
 const req=(path:string,cookie?:string,body?:object)=>app.request(config.origin+path,{method:body?'POST':'GET',headers:{origin:config.origin,'content-type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const signed=await req('/api/auth/sign-in/guest',undefined,{}),guestCookie=signed.headers.get('set-cookie')!.split(';')[0];
 const me=await (await req('/api/me',guestCookie)).json();
 await db.db.insert(user).values({id:'review-member',name:'Member',email:'member@review.test'});
 const w=await s.createWorkspace(me.user.id,'Guest owned shared space',randomUUID());
 const invite=await s.issueInvite(me.user.id,w.id,'member',w.revision);await s.joinWorkspace('review-member',invite.code);
 const run=await s.startRun(me.user.id,w.id,{prompt:'공동 공간 기획',agentId:'nara',scenario:'normal',approvalRequired:true},randomUUID());
 await db.db.update(session).set({expiresAt:new Date(0)}).where(eq(session.userId,me.user.id));
 let cancelStatus:number|undefined,startStatus:number|undefined;
 try{await s.cancel('review-member',run.id);}catch(e){cancelStatus=(e as any).status;}
 try{await s.startRun('review-member',w.id,{prompt:'다음 업무 기획',agentId:'nara',scenario:'normal',approvalRequired:false},randomUUID());}catch(e){startStatus=(e as any).status;}
 console.log(JSON.stringify({case:'guest-owner-expiry',guestOwnerMe:(await req('/api/me',guestCookie)).status,memberCanStillRead:(await s.snapshot('review-member',w.id)).role,memberCancelStatus:cancelStatus,memberStartStatus:startStatus,runStatus:(await s.snapshot('review-member',w.id)).runs[0].status},null,2));
}finally{await db.close();}
