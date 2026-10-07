import test from 'node:test';
import assert from 'node:assert/strict';
import {translateCopy} from '../public/i18n-catalog.js';

test('界面翻译保留动态参数、原文及特殊字符，不做片段替换',()=>{
 assert.equal(translateCopy('已练习 3 / 21 句','en'),'Practiced 3 / 21 sentences');
 assert.equal(translateCopy('B2 挑战 · 免费体验','en'),'B2 Upper intermediate · Free preview');
 assert.equal(translateCopy('  ← 返回资料库  ','en'),'  ← Back to library  ');
 assert.equal(translateCopy('查看第 12 句听写答案','en'),'Show answer for sentence 12');
 assert.equal(translateCopy('你好，<Alex & Sam>','en'),'Hello, <Alex & Sam>');
 assert.equal(translateCopy('I practice every day.','en'),'I practice every day.');
 assert.equal(translateCopy('今天我们学习“播放速度”这个词。','en'),'今天我们学习“播放速度”这个词。');
 assert.equal(translateCopy('视频 CC','zh-CN'),'视频 CC');
 assert.equal(translateCopy('未知词条','en'),'未知词条');
});
