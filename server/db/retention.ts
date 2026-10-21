import type{PGlite}from'@electric-sql/pglite';import{createHash}from'node:crypto';import{openDataDirectory}from'./database.js';
type Reader=Pick<PGlite,'query'>;
const reviewHash=(data:string,cutoff:string)=>createHash('sha256').update(data+'|'+cutoff).digest('hex');
const TARGETS=['auth_session','auth_verification','presence_clients'] as const;
export function retentionCutoff(value:string,now=Date.now()){const date=new Date(value);if(!Number.isFinite(date.getTime())||date.getTime()>now-7*86400_000)throw Error('Cleanup cutoff must be at least seven days in the past');return date.toISOString();}
export async function dataFingerprint(client:Reader,exclude:readonly string[]=[]){
 const names=(await client.query<{tablename:string}>("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename).filter(n=>!exclude.includes(n));const rows=[];
 for(const name of names){const table='"'+name.replaceAll('"','""')+'"';const row=(await client.query<{digest:string;n:string}>(`SELECT md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text),'')) AS digest,count(*)::text AS n FROM public.${table} t`)).rows[0];rows.push({table:name,...row});}
 const columns=(await client.query("SELECT table_name,column_name,ordinal_position,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[]) ORDER BY table_name,ordinal_position",[names])).rows;
 const indexes=(await client.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=ANY($1::text[]) ORDER BY tablename,indexname",[names])).rows;
 const constraints=(await client.query("SELECT c.relname AS table_name,k.conname,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[]) ORDER BY c.relname,k.conname",[names])).rows;
 const sequences=(await client.query<{sequencename:string}>("SELECT sequencename,start_value::text,min_value::text,max_value::text,increment_by::text,cycle,cache_size::text FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename")).rows,sequenceStates=[];
 for(const sequence of sequences){const name='"'+sequence.sequencename.replaceAll('"','""')+'"',state=(await client.query(`SELECT last_value::text,is_called FROM public.${name}`)).rows[0];sequenceStates.push({...sequence,state});}
 return createHash('sha256').update(JSON.stringify({rows,columns,indexes,constraints,sequences:sequenceStates})).digest('hex');
}
export async function retentionPreview(client:Reader,before:string){const cutoff=retentionCutoff(before),counts:Record<string,number>={};for(const table of TARGETS)counts[table]=Number((await client.query<{n:string}>(`SELECT count(*)::text AS n FROM ${table} WHERE expires_at<$1`,[cutoff])).rows[0].n);return{cutoff,revision:reviewHash(await dataFingerprint(client),cutoff),counts,total:Object.values(counts).reduce((a,b)=>a+b,0),retained:'all users, workspaces, tasks, runs, events, comments, notifications, settings and active/recent sessions'};}
// Offline operator only. Verified raw backup + current whole-data fingerprint,
// then an atomic recheck/delete. No HTTP route and no automatic user/history deletion.
export async function applyRetention(client:PGlite,options:{before:string;revision:string;backup:Blob}){
 const cutoff=retentionCutoff(options.before);if(!/^[a-f0-9]{64}$/.test(options.revision)||!options.backup?.size)throw Error('Current preview revision and nonempty raw backup required');
 const restored=await openDataDirectory(undefined,options.backup);let backed:string;try{backed=await dataFingerprint(restored.client);}finally{await restored.close();}if(reviewHash(backed,cutoff)!==options.revision)throw Error('Backup does not match the reviewed database');
 return client.transaction(async tx=>{if(reviewHash(await dataFingerprint(tx),cutoff)!==options.revision)throw Error('Database changed; create a fresh backup and preview');const protectedBefore=await dataFingerprint(tx,TARGETS),deleted:Record<string,number>={};for(const table of TARGETS)deleted[table]=(await tx.query(`DELETE FROM ${table} WHERE expires_at<$1 RETURNING 1`,[cutoff])).rows.length;if(await dataFingerprint(tx,TARGETS)!==protectedBefore)throw Error('Protected history changed; cleanup rolled back');return{cutoff,deleted,protectedHistoryUnchanged:true,automatic:false};});
}
