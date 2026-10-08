import {validateCues} from '../public/subtitles.js';

export function sourceUrl(raw){
 const u=new URL(raw);
 if(u.protocol!=='https:'||!['www.youtube.com','youtube.com','m.youtube.com'].includes(u.hostname)||u.username||u.password||u.port)throw Error('来源必须是 HTTPS YouTube 频道或播放列表');
 if(u.pathname==='/playlist'&&/^[\w-]+$/.test(u.searchParams.get('list')||''))return u.href;
 if(/^\/(?:@[\w.%-]+|channel\/[\w-]+)(?:\/(?:videos|shorts))?\/?$/.test(u.pathname)){
  u.search='';u.hash='';if(!/\/(videos|shorts)\/?$/.test(u.pathname))u.pathname=u.pathname.replace(/\/$/,'')+'/videos';return u.href;
 }
 throw Error('请提供频道或播放列表链接');
}
export function validateConfig(c){
 if(typeof c.enabled!=='boolean'||!Array.isArray(c.sources))throw Error('采集配置无效');
 for(const [key,min,max] of [['maxPerRun',1,20],['scanLimit',1,100],['minDuration',1,600],['maxDuration',20,1200],['maxCueSeconds',3,20],['maxCueWords',8,40]]){
  if(!Number.isFinite(c[key])||c[key]<min||c[key]>max)throw Error(`配置 ${key} 超出范围`);
 }
 if(!Number.isInteger(c.maxPerRun)||!Number.isInteger(c.scanLimit)||c.minDuration>c.maxDuration||typeof c.premium!=='boolean')throw Error('采集限制无效');
 c.sources=c.sources.map(s=>{
  if(s.maxPerRun!==undefined&&(!Number.isInteger(s.maxPerRun)||s.maxPerRun<1||s.maxPerRun>20))throw Error('来源采集数量无效');
  if(s.titleIncludes!==undefined&&(!Array.isArray(s.titleIncludes)||!s.titleIncludes.every(x=>typeof x==='string'&&x.length>0)))throw Error('来源标题筛选无效');
  return {...s,url:sourceUrl(s.url)};
 });
 if(c.enabled&&!c.sources.length)throw Error('请先填写采集来源');
 return c;
}
export function normalizeWords(words,duration){
 if(!Array.isArray(words)||!words.length||!Number.isFinite(duration)||duration<=0)throw Error('缺少有效的逐词时间轴');
 let end=0;
 return words.map((w,i)=>{
  if(typeof w.text!=='string'||!w.text.trim()||!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<0||w.end<=w.start||w.end>duration+.05||w.start<end-.08)throw Error(`第 ${i+1} 个词时间轴异常，需要重新识别`);
  const start=Math.max(end,w.start);if(w.end<=start)throw Error('词时间戳重叠');end=w.end;
  return {...w,text:w.text.trim(),start,end};
 });
}
// Keep API batches small and prefer pauses/sentence boundaries between batches.
export function wordBatches(words){
 const batches=[];
 for(let start=0;start<words.length;){
  let end=Math.min(start+100,words.length);
  if(end<words.length){for(let i=end-1;i>start+65;i--){if(/[.!?]["']?$/.test(words[i].text)||words[i+1].start-words[i].end>.4){end=i+1;break;}}}
  batches.push(words.slice(start,end));start=end;
 }
 return batches;
}
export function assembleBatch(words,result,config){
 if(!Array.isArray(result?.groups)||!result.groups.length)throw Error('AI 未返回断句');
 let next=0;
 const cues=result.groups.map(g=>{
  if(!Number.isInteger(g.first)||!Number.isInteger(g.last)||g.first!==next||g.last<g.first||g.last>=words.length)throw Error('断句遗漏、重复或更改了词序');
  const part=words.slice(g.first,g.last+1);next=g.last+1;
  const start=part[0].start,end=part.at(-1).end;
  if(part.length>config.maxCueWords||end-start>config.maxCueSeconds+.01)throw Error('句子过长，不适合单句跟读');
  if(typeof g.translation!=='string'||!/[\u3400-\u9fff]/.test(g.translation)||g.translation.length>600)throw Error('缺少有效中文译文');
  // The model chooses boundaries and translates; timestamps and English stay anchored to ASR.
  return {start,end,text:part.map(w=>w.text).join(' ').replace(/\s+([,.;:!?])/g,'$1'),translation:g.translation.trim()};
 });
 if(next!==words.length)throw Error('断句未覆盖全部原文');
 return validateCues(cues);
}
export function vocabularyFrom(results,cues){
 const text=cues.map(c=>c.text).join(' ').toLowerCase(),vocabulary={};
 for(const r of results)for(const w of (Array.isArray(r.vocabulary)?r.vocabulary:[]).slice(0,12)){
  if(typeof w.word!=='string'||! /^[a-zA-Z][a-zA-Z '-]{1,60}$/.test(w.word)||typeof w.meaning!=='string'||!w.meaning.trim())continue;
  const key=w.word.toLowerCase().trim();
  if(!new RegExp('\\b'+key+'\\b','i').test(text))continue;
  vocabulary[key]=[typeof w.phonetic==='string'?w.phonetic.slice(0,100):'',w.meaning.slice(0,300)];
 }
 return vocabulary;
}
export function makeCourse(metadata,cues,results,config){
 if(!/^[\w-]{11}$/.test(metadata.id))throw Error('YouTube 视频编号无效');
 validateCues(cues);
 if(!cues.length||cues.at(-1).end>metadata.duration+.05)throw Error('字幕超出视频');
 const course={id:'yt-'+metadata.id.toLowerCase(),title:String(metadata.title||metadata.id).slice(0,160),
  description:`来源：${metadata.channel||'YouTube'} · 自动整理，发布前请预览校对。`,
  topic:config.topic||'英语跟读',level:'待评估',language:'en',premium:config.premium,kind:'video',
  duration:metadata.duration,media:'',cues,vocabulary:vocabularyFrom(results,cues),
  source:{platform:'youtube',id:metadata.id,url:`https://www.youtube.com/watch?v=${metadata.id}`,channel:metadata.channel||''},
  ingestion:{version:1,created:new Date().toISOString(),reviewRequired:true}};
 // Preserve case-sensitive YouTube IDs using a collision-free lowercase hex encoding.
 course.id='yt-'+Buffer.from(metadata.id).toString('hex');
 if(Buffer.byteLength(JSON.stringify(course))>280000)throw Error('课程内容超出数据库大小限制');
 return course;
}
