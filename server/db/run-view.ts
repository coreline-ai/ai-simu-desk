import type {runs,tasks} from './schema.js';
export function runView(run:typeof runs.$inferSelect,task:typeof tasks.$inferSelect,requestedByName:string){
 const {generatedAnswer,...safe}=run;
 return {...safe,answerMeta:generatedAnswer?{version:generatedAnswer.version,analysis:generatedAnswer.analysis,checks:generatedAnswer.checks}:null,
 source:task.sourceContext?{runId:task.sourceContext.runId,version:task.sourceContext.version,agentId:task.sourceContext.agentId,prompt:task.sourceContext.prompt,mode:task.sourceContext.mode,truncated:task.sourceContext.truncated,preview:task.sourceContext.output.slice(0,240)}:null,
 prompt:task.prompt,agentId:task.agentId,approvalRequired:task.approvalRequired,requestedByName};
}
export type RunView=ReturnType<typeof runView>;
