import test from "node:test";
import assert from "node:assert/strict";
import {answerBlocks} from "../src/answer-view.mjs";
test("complete and streaming tables retain headers, rows and surrounding source prose",()=>{
 const text="조건: 2주\n기간 | 업무 | 기준\n--- | --- | ---\n1~7일차 | 구현 | 로그인 검증\n8~14일차 | 검토 | 모바일 검증\n\n원본: saved";
 const blocks=answerBlocks(text);assert.equal(blocks[1].type,"table");assert.equal(blocks[1].rows.length,2);assert.equal(blocks[2].text,"\n원본: saved");
 assert.equal(answerBlocks("기간 | 업무\n--- | ---\n진행 중").at(-1).text,"진행 중");
 assert.equal(answerBlocks("1~7일차 | 완료 기준").length,1);
});
test("HTML and unsafe source strings remain plain cell data",()=>{
 const blocks=answerBlocks("항목 | 내용\n--- | ---\n1 | <img src=x onerror=alert(1)>");
 assert.equal(blocks[0].rows[0][1],"<img src=x onerror=alert(1)>");
 assert.deepEqual(answerBlocks("첫 줄\n둘째 줄\n셋째 줄"),[{type:"text",text:"첫 줄\n둘째 줄\n셋째 줄"}]);
});
