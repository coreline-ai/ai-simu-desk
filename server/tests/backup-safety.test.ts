import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openDataDirectory,openDatabase,migrateDatabase} from '../db/database.js';

test('raw backup preserves old schema and data even when a future migration fails; restore is separate from upgrade',async()=>{
 const root=await mkdtemp(join(tmpdir(),'studio-backup-safe-')),source=join(root,'source');
 let d:Awaited<ReturnType<typeof openDataDirectory>>|undefined;
 try{
  d=await openDataDirectory(source);
  await d.client.exec('CREATE TABLE studio_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz DEFAULT now())');
  for(const file of ['001_auth.sql','002_work.sql']){const sql=await readFile('server/db/migrations/'+file,'utf8');await d.client.exec(sql);await d.client.query('INSERT INTO studio_migrations(name,checksum) VALUES($1,$2)',[file,createHash('sha256').update(sql).digest('hex')]);}
  await d.client.exec(`INSERT INTO auth_user(id,name,email) VALUES('backup-user','Preserved','backup@example.test')`);
  const before=await d.client.query('SELECT name,checksum FROM studio_migrations ORDER BY name');
  const bad=join(root,'bad');await mkdir(bad);await writeFile(join(bad,'012_failure.sql'),'THIS IS NOT SQL');
  await assert.rejects(()=>migrateDatabase(d!.client,bad));
  const blob=await d.client.dumpDataDir('gzip');assert(blob.size>1000);
  assert.deepEqual((await d.client.query('SELECT name,checksum FROM studio_migrations ORDER BY name')).rows,before.rows);
  await assert.rejects(()=>openDataDirectory(source),/DATABASE_ALREADY_OPEN/);await d.close();
  d=await openDataDirectory(join(root,'restore'),blob);
  assert.deepEqual((await d.client.query('SELECT name,checksum FROM studio_migrations ORDER BY name')).rows,before.rows);
  assert.equal((await d.client.query<{name:string}>('SELECT name FROM auth_user WHERE id=$1',['backup-user'])).rows[0]?.name,'Preserved');await d.close();
  const upgraded=await openDatabase(join(root,'restore'));assert((await upgraded.client.query('SELECT name FROM studio_migrations')).rows.length>=11);await upgraded.close();
  await assert.rejects(()=>openDataDirectory(join(root,'restore'),blob),/new empty directory/);
  await assert.rejects(()=>openDataDirectory(join(root,'broken'),new Blob(['broken archive'])));
  const recovered=await openDataDirectory(join(root,'broken'));await recovered.close();
 }finally{await d?.close();await rm(root,{recursive:true,force:true});}
});
