import test,{after} from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
import {precisionCases,runPrecisionCase} from '../../scripts/qa/precision-leo-team.mjs';
const results=[];
for(const row of precisionCases)test('precision: '+row.title,()=>{try{const result=runPrecisionCase(row.id);results.push({...result,status:'passed'});}catch(e){results.push({id:row.id,title:row.title,status:'failed',error:e.stack});throw e;}});
after(async()=>{const dir='product/evidence/motion-precision/leo-team';await mkdir(dir,{recursive:true});await writeFile(dir+'/numeric-qa.json',JSON.stringify({version:1,generatedAt:new Date().toISOString(),scope:'v12 procedural runtime; numerical and ownership QA, no rendered appearance guarantee',results,passed:results.length===precisionCases.length&&results.every(r=>r.status==='passed')},null,2)+'\n');});
