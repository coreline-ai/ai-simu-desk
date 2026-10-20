import {and,desc,eq,lt,or,sql,count,gte,isNull} from 'drizzle-orm';
import {randomUUID} from 'node:crypto';
import type {StudioDatabase} from './types.js';
import {projectSettings,workspaces,runEvents,runs,tasks,user,taskComments,notifications} from './schema.js';
import {workspaceMember} from './workspace-access.js';
import {runView} from './run-view.js';
import {RUN_STATUSES,AGENTS} from '../domain/contracts.js';
import {parseProject} from '../domain/project.js';
import {notifyRun} from './notifications.js';
import {validRequestKey} from '../domain/contracts.js';
import {AppError} from '../domain/contracts.js';
import type {Store} from './workspace-access.js';
export async function toolsEvent(tx:Store,workspaceId:string,kind:string) {
 const [space]=await tx.select().from(workspaces).where(eq(workspaces.id,workspaceId));
 const revision=space.revision+1;
 await tx.update(workspaces).set({revision,updatedAt:new Date()}).where(eq(workspaces.id,workspaceId));
 await tx.insert(runEvents).values({id:randomUUID(),workspaceId,seq:revision,kind,payload:{}});
}
export function createWorkspaceTools(database:StudioDatabase) {
 const db=database.db;
 async function accessibleRun(tx:Store,userId:string,workspaceId:string,id:string){
  await workspaceMember(tx,userId,workspaceId);
  const [row]=await tx.select({run:runs,task:tasks,name:user.name}).from(runs).innerJoin(tasks,eq(tasks.id,runs.taskId)).innerJoin(user,eq(user.id,runs.requestedBy)).where(and(eq(runs.id,id),eq(runs.workspaceId,workspaceId)));
  if(!row)throw new AppError(404,'업무를 찾을 수 없습니다.');return row;
 }
 return {
  comments:(userId:string,workspaceId:string,runId:string,before?:string)=>db.transaction(async tx=>{
   await accessibleRun(tx,userId,workspaceId,runId);
   const created=sql`date_trunc('milliseconds',${taskComments.createdAt})`;
   let boundary;
   if(before){const [old]=await tx.select().from(taskComments).where(and(eq(taskComments.id,before),eq(taskComments.runId,runId)));if(!old)throw new AppError(400,'댓글 페이지를 확인해 주세요.');boundary=or(lt(created,old.createdAt),and(eq(created,old.createdAt),lt(taskComments.id,old.id)));}
   const rows=await tx.select({id:taskComments.id,runId:taskComments.runId,authorId:taskComments.authorId,name:user.name,body:taskComments.body,createdAt:taskComments.createdAt}).from(taskComments).innerJoin(user,eq(user.id,taskComments.authorId)).where(and(eq(taskComments.runId,runId),boundary)).orderBy(desc(created),desc(taskComments.id)).limit(51);
   const items=rows.slice(0,50);return {items:items.reverse(),next:rows.length>50?rows[49].id:null};
  }),
  addComment:(userId:string,workspaceId:string,runId:string,value:unknown,key:string|undefined)=>db.transaction(async tx=>{
   const row=await accessibleRun(tx,userId,workspaceId,runId),access=await workspaceMember(tx,userId,workspaceId);
   if(access.role==='viewer')throw new AppError(403,'보기 전용 참여자는 댓글을 작성할 수 없습니다.');
   const body=(value as {body?:unknown})?.body,requestKey=validRequestKey(key);
   if(typeof body!=='string'||!body.trim()||body.trim().length>1000)throw new AppError(400,'댓글은 1~1000자로 작성해 주세요.');
   const [old]=await tx.select().from(taskComments).where(and(eq(taskComments.runId,runId),eq(taskComments.authorId,userId),eq(taskComments.requestKey,requestKey)));
   if(old){if(old.body!==body.trim())throw new AppError(409,'같은 요청 키에 다른 댓글을 보낼 수 없습니다.');return old;}
   const [recent]=await tx.select({total:count()}).from(taskComments).where(and(eq(taskComments.authorId,userId),gte(taskComments.createdAt,new Date(Date.now()-60000))));
   if(recent.total>=10)throw new AppError(429,'댓글이 많아요. 잠시 후 다시 작성해 주세요.');
   const [comment]=await tx.insert(taskComments).values({id:randomUUID(),workspaceId,runId,authorId:userId,body:body.trim(),requestKey}).returning();
   await notifyRun(tx,row.run,'comment',comment.id,userId);await toolsEvent(tx,workspaceId,'comment_added');return comment;
  }),
  inbox:(userId:string,workspaceId:string)=>db.transaction(async tx=>{
   await workspaceMember(tx,userId,workspaceId);
   const filter=and(eq(notifications.userId,userId),eq(notifications.workspaceId,workspaceId));
   const items=await tx.select({id:notifications.id,runId:notifications.runId,kind:notifications.kind,prompt:tasks.prompt,readAt:notifications.readAt,createdAt:notifications.createdAt}).from(notifications).innerJoin(runs,eq(runs.id,notifications.runId)).innerJoin(tasks,eq(tasks.id,runs.taskId)).where(filter).orderBy(desc(notifications.createdAt),desc(notifications.id)).limit(20);
   const [unread]=await tx.select({total:count()}).from(notifications).where(and(filter,isNull(notifications.readAt)));
   return {items,unread:unread.total};
  }),
  readNotifications:(userId:string,workspaceId:string)=>db.transaction(async tx=>{
   await workspaceMember(tx,userId,workspaceId);
   await tx.update(notifications).set({readAt:new Date()}).where(and(eq(notifications.userId,userId),eq(notifications.workspaceId,workspaceId),isNull(notifications.readAt)));
   return {success:true};
  }),
  findRuns:(userId:string,workspaceId:string,query:Record<string,string|undefined>)=>db.transaction(async tx=>{
   await workspaceMember(tx,userId,workspaceId);
   const created=sql`date_trunc('milliseconds',${runs.createdAt})`;
   const q=(query.q??'').trim(),status=query.status??'',agent=query.agent??'';
   if(q.length>100||status&&!RUN_STATUSES.includes(status as never)||agent&&!AGENTS.includes(agent as never))throw new AppError(400,'검색 조건을 확인해 주세요.');
   let before:{time:Date;id:string}|undefined;
   if(query.before){try{const parts=JSON.parse(Buffer.from(query.before,'base64url').toString());const time=new Date(parts.time);if(query.before.length>200||!Number.isFinite(time.getTime())||typeof parts.id!=='string'||!/^[a-f0-9-]{36}$/i.test(parts.id))throw Error();before={time,id:parts.id};}catch{throw new AppError(400,'검색 페이지를 확인해 주세요.');}}
   const rows=await tx.select({run:runs,task:tasks,name:user.name}).from(runs).innerJoin(tasks,eq(tasks.id,runs.taskId)).innerJoin(user,eq(user.id,runs.requestedBy))
    .where(and(eq(runs.workspaceId,workspaceId),q?sql`(strpos(lower(${tasks.prompt}),lower(${q}))>0 OR strpos(lower(${runs.output}),lower(${q}))>0)`:undefined,status?eq(runs.status,status as typeof RUN_STATUSES[number]):undefined,agent?eq(tasks.agentId,agent as typeof AGENTS[number]):undefined,before?or(lt(created,before.time),and(eq(created,before.time),lt(runs.id,before.id))):undefined))
    .orderBy(desc(created),desc(runs.id)).limit(21);
   const items=rows.slice(0,20).map(r=>runView(r.run,r.task,r.name)),last=items.at(-1);
   return {items,next:rows.length>20&&last?Buffer.from(JSON.stringify({time:last.createdAt.toISOString(),id:last.id})).toString('base64url'):null};
  }),
  readRun:(userId:string,workspaceId:string,id:string)=>db.transaction(async tx=>{const r=await accessibleRun(tx,userId,workspaceId,id);return runView(r.run,r.task,r.name);}),
  compareRun:(userId:string,workspaceId:string,id:string)=>db.transaction(async tx=>{
   const r=await accessibleRun(tx,userId,workspaceId,id),source=r.task.sourceContext;
   if(!source)throw new AppError(400,'연결된 원본이 없는 업무입니다.');
   return {before:{runId:source.runId,version:source.version,prompt:source.prompt,output:source.output,truncated:!!source.truncated},after:{runId:r.run.id,version:r.run.version,prompt:r.task.prompt,output:r.run.output},mode:source.mode};
  }),
  project:(userId:string,workspaceId:string)=>db.transaction(async tx=>{
   await workspaceMember(tx,userId,workspaceId);
   return (await tx.select().from(projectSettings).where(eq(projectSettings.workspaceId,workspaceId)))[0]??{workspaceId,version:0,goal:'',audience:'',technology:'',exclusions:''};
  }),
  saveProject:(userId:string,workspaceId:string,value:unknown)=>db.transaction(async tx=>{
   const access=await workspaceMember(tx,userId,workspaceId);
   if(access.role!=='owner')throw new AppError(403,'소유자만 프로젝트 설정을 바꿀 수 있습니다.');
   const parsed=parseProject(value),[old]=await tx.select().from(projectSettings).where(eq(projectSettings.workspaceId,workspaceId));
   if((old?.version??0)!==parsed.version)throw new AppError(409,'프로젝트 설정이 변경됐습니다. 새로 불러온 뒤 저장해 주세요.','SETTINGS_CONFLICT');
   const next={...parsed,workspaceId,version:parsed.version+1,updatedAt:new Date()};
   if(old)await tx.update(projectSettings).set(next).where(eq(projectSettings.workspaceId,workspaceId));
   else await tx.insert(projectSettings).values(next);
   await toolsEvent(tx,workspaceId,'project_updated');return next;
  }),
 };
}
