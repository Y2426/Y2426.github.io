import test from 'node:test';
import assert from 'node:assert/strict';
import {storeDraft} from '../ingestion/sink.mjs';
import {validateConfig,sourceUrl,normalizeWords,wordBatches,assembleBatch,makeCourse} from '../ingestion/lesson.mjs';
import {parseSubtitles,toSrt} from '../public/subtitles.js';
const config={enabled:false,maxPerRun:20,scanLimit:40,minDuration:20,maxDuration:600,maxCueSeconds:12,maxCueWords:28,premium:false,sources:[]};
const words=[{start:0,end:.3,text:'Hello,'},{start:.3,end:.8,text:'world.'},{start:1.1,end:1.4,text:'Keep'},{start:1.4,end:2,text:'going.'}];
const result={groups:[{first:0,last:1,translation:'你好，世界。'},{first:2,last:3,translation:'继续前行。'}],vocabulary:[{word:'world',meaning:'世界',phonetic:'/wɜːld/'},{word:'invented',meaning:'编造的'}]};
test('only HTTPS channel and playlist sources, bounded configuration',()=>{
 assert.equal(sourceUrl('https://www.youtube.com/@TED'),'https://www.youtube.com/@TED/videos');
 assert.match(sourceUrl('https://www.youtube.com/playlist?list=PL_test'),/PL_test/);
 for(const url of ['http://youtube.com/@TED','https://youtube.com.evil.test/@TED','https://user:pass@youtube.com/@TED','https://youtube.com/watch?v=abc','file:///tmp/test'])assert.throws(()=>sourceUrl(url));
 assert.equal(validateConfig({...config}).maxPerRun,20);
 assert.throws(()=>validateConfig({...config,enabled:true}));
 assert.throws(()=>validateConfig({...config,maxPerRun:21}));
});
test('word alignment normalizes small jitter and rejects invalid timing',()=>{
 assert.deepEqual(normalizeWords(words,2),words);
 assert.equal(normalizeWords([{start:0,end:1,text:'one'},{start:.98,end:2,text:'two'}],2)[1].start,1);
 const merged=normalizeWords([{start:0,end:0,text:'gonna'},{start:0,end:.3,text:'use'}],1);
 assert.equal(merged[0].text,'gonna use');assert.equal(merged[0].end,.3);assert.equal(merged.length,1);
 for(const bad of [[{start:0,end:0,text:'x'}],[{start:0,end:3,text:'x'}],[{start:0,end:1,text:'x'},{start:.5,end:2,text:'y'}]])assert.throws(()=>normalizeWords(bad,2));
});
test('semantic grouping preserves every original word and rejects unsafe model output',()=>{
 const cues=assembleBatch(words,result,config);
 assert.equal(cues[0].end,.8);assert.equal(cues[1].start,1.1);
 assert.equal(cues.map(c=>c.text).join(' '),'Hello, world. Keep going.');
 for(const groups of [[{first:1,last:3,translation:'漏词'}],[{first:0,last:1,translation:'重复'},{first:1,last:3,translation:'重复'}],[{first:0,last:1,translation:'不全'}],[{first:0,last:3,translation:''}]])assert.throws(()=>assembleBatch(words,{groups},config));
 assert.throws(()=>assembleBatch(words,result,{...config,maxCueSeconds:.2}));
 const course=makeCourse({id:'Abcde123_-Z',title:'Example',duration:2,channel:'Example'},cues,[result],config);
 assert.deepEqual(Object.keys(course.vocabulary),['world']);
 assert.equal(course.media,'');assert.equal(course.ingestion.reviewRequired,true);
 assert.notEqual(course.id,makeCourse({id:'abcde123_-Z',title:'Example',duration:2},cues,[result],config).id);
 assert.deepEqual(parseSubtitles(toSrt(course.cues)),course.cues);
});
test('batching covers long transcripts exactly once',()=>{
 const long=Array.from({length:251},(_,i)=>({text:i%9===0?'word.':'word',start:i,end:i+.5}));
 assert.deepEqual(wordBatches(long).flat(),long);
 assert.ok(wordBatches(long).every(b=>b.length<=100));
});
function fakeCloud(){
 const rows=[],objects=new Map(),calls=[];let failOnce=false;
 const sb={rpc:async(name,{route,method,body})=>{
  calls.push({route,method});assert.equal(route,'admin/courses');
  if(method==='GET')return {data:rows};
  assert.equal(method,'POST');if(failOnce){failOnce=false;return {error:{message:'database unavailable'}};}
  const row={course:body.course,status:'draft',revision:1};rows.push(row);return {data:row};
 },storage:{from:()=>({upload:async(name,data,options)=>{
  assert.equal(options.upsert,false);if(objects.has(name))return {error:{statusCode:'409',message:'exists'}};
  objects.set(name,data);return {data:{path:name}};
 },download:async name=>({data:new Blob([objects.get(name)])})})}};
 return {sb,rows,objects,calls,fail:()=>{failOnce=true;}};
}
test('cloud import creates only a draft and duplicate runs preserve manual edits',async()=>{
 const cloud=fakeCloud(),course={id:'yt-test',title:'Example'};
 const first=await storeDraft(cloud.sb,course,Buffer.from('video'));
 assert.equal(first.row.status,'draft');assert.equal(cloud.objects.size,1);
 cloud.rows[0].course.title='Manually edited';cloud.rows[0].status='published';
 const again=await storeDraft(cloud.sb,course,Buffer.from('other video'));
 assert.equal(again.reused,true);assert.equal(again.row.course.title,'Manually edited');
 assert.equal(cloud.objects.size,1);assert.equal(cloud.calls.filter(c=>c.method==='POST').length,1);
});
test('failed database write resumes using verified existing media without duplication',async()=>{
 const cloud=fakeCloud(),course={id:'yt-test',title:'Example'},video=Buffer.from('video');
 cloud.fail();await assert.rejects(storeDraft(cloud.sb,course,video),/database unavailable/);
 assert.equal(cloud.objects.size,1);assert.equal(cloud.rows.length,0);
 await storeDraft(cloud.sb,course,video);
 assert.equal(cloud.objects.size,1);assert.equal(cloud.rows.length,1);
});
