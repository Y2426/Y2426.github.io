import test from 'node:test';
import assert from 'node:assert/strict';
import {answerState} from '../public/answer-validation.js';
test('听写自动判定：空白中立，忽略大小写标点，保留单词顺序和拼写差异',()=>{
 assert.equal(answerState('  ','Hello.'),'empty');
 assert.equal(answerState('HELLO, world!','Hello world.'),'correct');
 assert.equal(answerState('I dont know','I don’t know.'),'correct');
 assert.equal(answerState('self doubt','self-doubt'),'correct');
 assert.equal(answerState('word','world'),'incorrect');
 assert.equal(answerState('world hello','Hello world'),'incorrect');
 assert.equal(answerState('Hello','Hello world'),'incorrect');
});
