import test from 'node:test';
import assert from 'node:assert/strict';
import {compareLines} from '../src/comparison.mjs';
import {projectPrompt} from '../src/project.mjs';
test('comparison preserves repeated lines and identifies insertions/deletions',()=>{
 const result=compareLines('same\nold\nsame','same\nnew\nsame');
 assert.equal(result.removed,1);assert.equal(result.added,1);
 assert.deepEqual(result.left.map(l=>l.text),['same','old','same']);
 assert.equal(compareLines('a\nb','a\nb').added,0);
 assert.equal(compareLines('<script>','<script>').left[0].text,'<script>');
});
test('project conditions have explicit labels and skip empty fields',()=>{
 assert.equal(projectPrompt({goal:' A ',audience:'',technology:'Postgres',exclusions:'유료'}),'목표: A\n기술: Postgres\n제외: 유료');
});
