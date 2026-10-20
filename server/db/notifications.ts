import {eq} from 'drizzle-orm';
import {randomUUID} from 'node:crypto';
import type {Store} from './workspace-access.js';
import {members,notifications,runs} from './schema.js';
export async function notifyRun(tx:Store,run:typeof runs.$inferSelect,kind:typeof notifications.$inferInsert['kind'],sourceKey:string,actorId?:string){
 const people=await tx.select().from(members).where(eq(members.workspaceId,run.workspaceId));
 const recipients=people.filter(p=>kind==='comment'?p.userId!==actorId:kind==='approval_requested'?p.role==='owner':p.role==='owner'||p.userId===run.requestedBy);
 if(recipients.length)await tx.insert(notifications).values(recipients.map(p=>({id:randomUUID(),workspaceId:run.workspaceId,userId:p.userId,runId:run.id,kind,sourceKey}))).onConflictDoNothing();
}
