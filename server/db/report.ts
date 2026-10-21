import type{PGlite}from'@electric-sql/pglite';
import{GUEST_ID,GUEST_PREFIX}from'../domain/guest.js';
// Read-only aggregate report. It deliberately excludes IDs, names, tokens and user content.
export async function databaseReport(client:PGlite){
 const tables=(await client.query<{tablename:string}>("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename),counts:Record<string,number>={};
 for(const name of tables){const escaped=name.replaceAll('"','""');counts[name]=Number((await client.query<{n:string}>(`SELECT count(*)::text AS n FROM public."${escaped}"`)).rows[0].n);}
 const size=await client.query<{bytes:string}>('SELECT pg_database_size(current_database())::text AS bytes');
 const guests=tables.includes('auth_user')&&tables.includes('auth_session')?(await client.query<{total:string;active:string;inactive:string}>(`SELECT count(*)::text AS total,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM auth_session s WHERE s.user_id=u.id AND s.expires_at>now()))::text AS active,count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM auth_session s WHERE s.user_id=u.id AND s.expires_at>now()))::text AS inactive FROM auth_user u WHERE u.id=$1 OR u.id LIKE $2`,[GUEST_ID,GUEST_PREFIX+'%'])).rows[0]:null;
 return{at:new Date().toISOString(),schemaChanged:false,logicalBytes:Number(size.rows[0].bytes),counts,guests:guests?Object.fromEntries(Object.entries(guests).map(([k,v])=>[k,Number(v)])):null,retention:'observe-only; stop server, backup, explicitly review before any manual cleanup; no automatic deletion'};
}
