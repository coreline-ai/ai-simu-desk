// Read-only review reproduction, not a passing regression gate. Run from repository root.
import {PGlite} from '../../../node_modules/@electric-sql/pglite/dist/index.js';
import {openDatabase} from '../../../server/db/database.ts';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=await mkdtemp('/private/tmp/studio-backup-review-'),path=root+'/old-studio';
try {
 const old=new PGlite(path);await old.waitReady;
 await old.exec('CREATE TABLE studio_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
 for(const file of ['001_auth.sql','002_work.sql']) {
  const sql=await readFile(new URL('../../../server/db/migrations/'+file,import.meta.url),'utf8');
  await old.exec(sql);await old.query('INSERT INTO studio_migrations(name,checksum) VALUES($1,$2)',[file,createHash('sha256').update(sql).digest('hex')]);
 }
 const before=(await old.query('SELECT name FROM studio_migrations')).rows.length;await old.close();
 // scripts/backup-db.ts calls this auto-migrating opener before dumping any archive.
 const opened=await openDatabase(path);const after=(await opened.client.query('SELECT name FROM studio_migrations')).rows.length;
 const backup=await opened.client.dumpDataDir('gzip');await opened.close();
 console.log(JSON.stringify({case:'backup-opener-migrates-source',migrationsBefore:before,migrationsBeforeDump:after,backupBytes:backup.size},null,2));
}finally{await rm(root,{recursive:true,force:true});}
