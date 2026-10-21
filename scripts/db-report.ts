import{lstat,readdir}from'node:fs/promises';import{join}from'node:path';import{getConfig}from'../server/config.js';import{openDataDirectory}from'../server/db/database.js';import{databaseReport}from'../server/db/report.js';
const config=getConfig();if(config.databaseUrl||config.deployment!=='local')throw new Error('This read-only report supports a stopped local database only');
if(!(await lstat(join(config.dataDir,'PG_VERSION')).catch(()=>null))?.isFile())throw new Error('Existing local database required');
async function disk(path:string):Promise<number>{const stat=await lstat(path);if(stat.isSymbolicLink())return 0;if(!stat.isDirectory())return stat.size;return(await Promise.all((await readdir(path)).map(name=>disk(join(path,name))))).reduce((a,b)=>a+b,0);}
const db=await openDataDirectory(config.dataDir);try{console.log(JSON.stringify({...await databaseReport(db.client),diskBytes:await disk(config.dataDir)},null,2));}finally{await db.close();}
