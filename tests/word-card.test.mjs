import test from 'node:test';
import assert from 'node:assert/strict';
import {wordData,wordCard} from '../public/word-card.js';
test('词卡保留多义项、独立例句、收藏语境，并转义外部文本',()=>{
 const state={vocab:{old:{meaning:'旧词',example:{text:'An old example.',translation:'旧例句。'}}}};
 const ctx={get:()=>({state,words:{test:['','测试']},course:{cues:[{text:'A test.',translation:'一次测试',start:0,end:2}],wordDetails:{test:{meanings:[{en:'an examination',zh:'考试',example:'A test <script>.',translation:'示例'},{en:'to examine',zh:'检验'}]}}}})};
 assert.equal(wordData(ctx,'test').meanings.length,2);assert.equal(wordData(ctx,'test').contexts.length,1);
 const html=wordCard(ctx,'test',{full:true});assert.match(html,/MEANING 2/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/data-lex-cue="0"/);
 assert.match(wordCard(ctx,'old'),/An old example/);assert.match(wordCard(ctx,'old'),/收藏语境/);
 assert.match(wordCard(ctx,'test',{hideMeaning:true}),/class="lex-meanings" hidden/);
});
