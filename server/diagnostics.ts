import {randomUUID} from 'node:crypto';
import type{Context,MiddlewareHandler}from'hono';
import{routePath}from'hono/route';
export type RequestDiagnostic={requestId:string;method:string;route:string;status:number;errorKind:'none'|'client'|'internal';durationMs:number};
export type DiagnosticSink=(event:RequestDiagnostic)=>void;
const ids=new WeakMap<Context,string>();
export const requestId=(c:Context)=>ids.get(c)??randomUUID();
export function requestDiagnostics(sink?:DiagnosticSink):MiddlewareHandler{return async(c,next)=>{
 const id=randomUUID(),start=performance.now();ids.set(c,id);c.header('X-Request-ID',id);
 try{await next();}finally{
  // Use the last executed route; a later unmatched middleware must not hide it.
  // Only registered patterns are logged. Never log raw URL, query, headers, bodies or error text.
  const status=c.res.status,route=routePath(c)||'unmatched';
  const event:RequestDiagnostic={requestId:id,method:['GET','POST','HEAD','OPTIONS','PUT','PATCH','DELETE'].includes(c.req.method)?c.req.method:'OTHER',route,status,errorKind:status>=500?'internal':status>=400?'client':'none',durationMs:Math.round((performance.now()-start)*100)/100};
  try{if(sink)sink(event);else if(status>=500)console.error(JSON.stringify(event));}catch{/* Diagnostics must not break the response. */}
 }
};}
