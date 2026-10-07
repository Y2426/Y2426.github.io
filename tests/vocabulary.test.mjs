import {test} from 'node:test';
import assert from 'node:assert/strict';
import {vocabularyTokens} from '../public/vocabulary.js';
test('词汇匹配优先完整短语，保留标点且不匹配单词内部',()=>{
 const words={'day in, day out':[],day:[],trust:[], 'self-doubt':[],doubt:[]};
 const text='DAY IN, DAY OUT, distrust and self-doubt.';
 const parts=vocabularyTokens(text,words);
 assert.equal(parts.join(''),text);
 assert.ok(parts.includes('DAY IN, DAY OUT'));
 assert.ok(parts.includes('self-doubt'));
 assert.ok(!parts.includes('trust'));
 assert.ok(!parts.includes('doubt'));
 assert.deepEqual(vocabularyTokens('plain text',{}),['plain text']);
});
