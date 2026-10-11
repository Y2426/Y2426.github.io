import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCuration,curateCourse,learningMetrics,examReference} from '../ingestion/curation.mjs';
import {replaceCourseVocabulary,isHighlightTerm} from '../public/vocabulary-policy.js';
const course={id:'yt-test',title:'My original vlog',media:'/media/original.mp4',duration:20,cues:[{start:0,end:4,text:'This is comfort food and it satisfies my cravings.',translation:'这道食物带来慰藉，也解了馋。'},{start:5,end:8,text:'I put it off until tomorrow.',translation:'我把它推迟到明天。'}],source:{platform:'youtube'},ingestion:{}};
const editorial={title:'居家做饭与日常安排',description:'跟随博主聊聊让人感到慰藉的食物与日常安排，学习表达饮食偏好、想吃某种食物的感受，以及推迟计划的自然说法。',topic:'日常 Vlog',cefr:'B1',levelReason:'内容围绕熟悉的生活话题，但包含短语动词和与饮食感受相关的地道表达。',evidence:[{cueIndex:1,reason:'短语动词 put off 的宾语置于动词和副词之间。'}],vocabulary:[
 {word:'is',meaning:'是',reason:'基础系动词表达状态',pos:'verb'},
 {word:'and',meaning:'和',reason:'用于连接并列关系',pos:'adverb'},
 {word:'comfort food',meaning:'让人感到慰藉的食物',reason:'描述食物带来的情绪慰藉，而不只是食物种类',tier:'core',pos:'expression'},
 {word:'comfort',meaning:'慰藉',reason:'表达情绪上的安慰和舒适感',tier:'core',pos:'noun'},
 {word:'cravings',meaning:'对某种食物的强烈渴望',reason:'在饮食语境中表达想吃某种食物的感觉',tier:'core',pos:'noun'},
 {word:'put it off',meaning:'把它推迟',reason:'可以迁移到谈论工作任务和生活计划的场景',tier:'core',pos:'expression'},
 {word:'astronomy',meaning:'天文学',reason:'不在原文中，不应入选',tier:'core',pos:'noun'}]};
test('curation requires Chinese course copy, grounded level and useful contextual vocabulary',()=>{
 const result=applyCuration(course,editorial);
 assert.equal(result.title,editorial.title);assert.equal(result.level,'B1 进阶');
 assert.deepEqual(Object.keys(result.vocabulary),['comfort food','cravings','put it off']);
 assert.deepEqual(result.cues,course.cues);assert.equal(result.media,course.media);
 assert.equal(result.source.originalTitle,course.title);assert.equal(result.difficulty.estimated,true);
 assert.ok(result.wordDetails.cravings.selectionReason);
 for(const change of [{title:'English only'},{cefr:'待评估'},{cefr:'toString'},{description:'来源：YouTube 自动整理，发布前请检查，这是一个处理说明而不是内容简介。'},{evidence:[{cueIndex:999,reason:'不存在的原文'}]}])assert.throws(()=>applyCuration(course,{...editorial,...change}));
});
test('changing lessons removes stale vocabulary and blocks function words but preserves phrases',()=>{
 const target={is:[],and:[],oldword:[]};
 replaceCourseVocabulary(target,{'cravings':['','想吃的东西'],is:['','是'],'put it off':['','推迟']});
 assert.deepEqual(Object.keys(target),['cravings','put it off']);
 replaceCourseVocabulary(target,{});assert.deepEqual(target,{});
 for(const term of ['IS','and','the','you','was',"isn't",'okay'])assert.equal(isHighlightTerm(term),false);
 assert.equal(isHighlightTerm('as soon as'),true);
});
test('DeepSeek editorial call disables thinking and validates the result before applying it',async()=>{
 let calls=0;
 const result=await curateCourse(course,{env:{AI_API_KEY:'test-only'},transport:async(url,options)=>{
  calls++;assert.equal(url,'https://api.deepseek.com/chat/completions');const body=JSON.parse(options.body);
  assert.deepEqual(body.thinking,{type:'disabled'});assert.match(body.messages[0].content,/整课/);
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(editorial)}}]});
 }});
 assert.equal(calls,2);assert.equal(result.ingestion.curationVersion,3);
});

test('spoken duration controls density; long silence does not inflate budget; extension remains unhighlighted',()=>{
 const silent={...course,duration:3600};
 assert.deepEqual(learningMetrics(silent),learningMetrics(course));
 const result=applyCuration(course,{...editorial,vocabulary:editorial.vocabulary.map(t=>({...t,tier:t.word==='cravings'?'extension':t.tier}))});
 assert.ok(result.extensionVocabulary.cravings);assert.equal(result.vocabulary.cravings,undefined);
 assert.equal(result.wordDetails.cravings.tier,'extension');
 const long={...course,cues:Array.from({length:12},(_,i)=>({start:i*80,end:i*80+60,text:'comfort food cravings put it off',translation:'食物与安排'}))};
 assert.deepEqual(learningMetrics(long).candidateRange,[48,72]);
});
test('core budget covers later scenes instead of selecting only early candidates',()=>{
 const cues=[{start:0,end:60,text:'comfort food cravings texture leftover substitute therapeutic',translation:'饮食'}, {start:100,end:160,text:'put it off chase after living in the moment',translation:'生活'}];
 const terms=['comfort food','cravings','texture','leftover','substitute','therapeutic','put it off','chase after','living in the moment'];
 const result=applyCuration({...course,cues},{...editorial,vocabulary:terms.map(word=>({word,tier:'core',pos:'expression',meaning:'语境释义',reason:'这是值得迁移学习的语境表达'}))});
 assert.ok(result.vocabulary['put it off']);assert.equal(Object.keys(result.vocabulary).length,6);
 assert.equal(Object.keys(result.extensionVocabulary).length,3);assert.equal(result.vocabularyCoverage.length,2);
});

test('exam tags come from the pinned dictionary, including inflected forms, never inferred for phrases',()=>{
 assert.ok(examReference('achievement').exams.includes('cet4'));
 assert.equal(examReference('achievements').lemma,'achievement');
 assert.equal(examReference('made up exam phrase'),null);
 assert.equal(examReference('toString'),null);
});
