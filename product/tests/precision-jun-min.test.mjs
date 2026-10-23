import test from 'node:test';
import {precisionCases} from '../../scripts/qa/precision-jun-min.mjs';

for(const [name,run] of precisionCases)test('independent precision: '+name,()=>{run();});
