import {access} from 'node:fs/promises';
import {getConfig} from '../server/config.js';
import {openDataDirectory} from '../server/db/database.js';
import {drizzle} from 'drizzle-orm/pglite';
import * as schema from '../server/db/schema.js';
import {workspaces} from '../server/db/schema.js';
import {isGuestId} from '../server/domain/guest.js';
import {recoverGuestOwner} from '../server/db/guest-space-recovery.js';
const config=getConfig();if(config.databaseUrl||config.deployment==='vercel')throw new Error('Local offline PGlite tool only');
await access(config.dataDir+'/PG_VERSION');
const raw=await openDataDirectory(config.dataDir),d={...raw,db:drizzle(raw.client,{schema})};
try{
 const mode=process.argv[2]??'audit';
 if(mode==='audit')console.log(JSON.stringify((await d.db.select().from(workspaces)).filter(s=>s.kind==='shared'&&isGuestId(s.ownerId)).map(({id,name,revision})=>({id,name,revision})),null,2));
 else if(mode==='transfer'&&process.argv.length===8&&process.argv[6]==='--backup'){
  await access(process.argv[7]);const revision=Number(process.argv[5]);if(!Number.isSafeInteger(revision)||revision<1)throw new Error('Explicit revision required');
  await recoverGuestOwner(d,process.argv[3],process.argv[4],revision);console.log('Explicit ownership recovery completed. Existing records retained.');
 }else throw new Error('guest-spaces.ts audit | transfer <space-id> <regular-member-id> <revision> --backup <archive>');
}finally{await d.close();}
