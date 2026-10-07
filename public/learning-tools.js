import {answerState} from './answer-validation.js';
import {vocabularyTokens,wordKind} from './vocabulary.js';
import {installAdvancedTools} from './advanced-tools.js';
import {installWordHover} from './word-hover.js';
import {stamp} from './subtitles.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function installLearningTools(ctx){
 const originalAudio=document.createElement('audio');originalAudio.hidden=true;originalAudio.id='original-audio';document.body.append(originalAudio);let originalEnd=0;
 const media=$('#media'), answers=new Map(),sentenceAnswers=new Map(),solutions=new Set(), revealed=new Set(), recordings=new Map();
 let exercise='normal', lesson='', hiddenWords=false, sentenceStop=false, repeatCount=1, played=0, playingKey='', singleEnd=null, recorder=null, recordingKey=null, recordTimer, recordingPending=false,recordTicker,recordStarted=0;
 document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="/learning-tools.css"><link rel="stylesheet" href="/reference-layout.css">');
 const tabs=$('.mode-tabs');$('.transcript-header').after(tabs);
 $('[data-mode="listen"]').textContent='双语';$('[data-mode="shadow"]').textContent='跟读';$('[data-mode="dictation"]').textContent='整句听写';$('#cloze-mode').textContent='挖空';
 tabs.insertAdjacentHTML('beforeend','<button class="mode" id="word-dictation" aria-pressed="false">听写词</button><button class="mode" id="retell-mode" aria-pressed="false">复述</button>');
 $('.transcript-foot').textContent='点击字幕定位 · 点击重点词查看释义';
 $('.transcript-header h3').firstChild.textContent='动态字幕 ';
 $('.transport-buttons').insertAdjacentHTML('afterend',`<div class="learning-toolbar"><button id="pip-button">小窗</button><button id="pause-sentence" aria-pressed="false">连播</button><button id="mask-keywords" aria-pressed="false">屏词</button><button id="theme-button" aria-pressed="false">浅色主题</button><button id="print-preview">打印 / PDF</button><label>音量 <input id="volume-control" aria-label="音量" type="range" min="0" max="1" step="0.05" value="1"></label><button id="mute-button" aria-pressed="false">静音</button></div>`);
 $('#speed').innerHTML=[.3,.5,.8,1,1.2,1.5,2].map(v=>`<option value="${v}" ${v===1?'selected':''}>${v}×</option>`).join('');
 $('#size-btn').textContent='字号';$('#size-btn').setAttribute('aria-label','字幕字号设置');
 $('#loop-btn').setAttribute('aria-label','循环次数设置');
 document.body.insertAdjacentHTML('beforeend',`<dialog id="font-dialog" aria-labelledby="font-title"><div class="dialog-heading"><h2 id="font-title">字幕字号</h2><button data-close="font-dialog" aria-label="关闭字号设置">×</button></div><label>中文 <output id="font-value">16</output> px · 英文略大一级<input id="font-range" aria-label="字幕字号" type="range" min="12" max="32" value="16"></label><div class="font-presets">${[12,16,20,24].map(n=>`<button data-font="${n}">${n} px</button>`).join('')}</div><p id="font-example">Listen closely. 听见每一个细节。</p></dialog>
 <dialog id="repeat-dialog" aria-labelledby="repeat-title"><div class="dialog-heading"><h2 id="repeat-title">循环次数</h2><button data-close="repeat-dialog" aria-label="关闭循环设置">×</button></div><div class="repeat-summary"><strong id="repeat-state">单次播放</strong><span id="repeat-count">1 次</span></div><label>次数<input id="repeat-range" aria-label="循环次数" type="range" min="0" max="5" step="1" value="0"></label><p>默认播放 1 遍；大于 1 才会对当前句自动循环。</p><div class="repeat-presets">${[1,2,3,5,10,Infinity].map(n=>`<button data-repeat="${n}" aria-pressed="${n===1}">${n===1?'单次':n===Infinity?'∞':n+' 次'}</button>`).join('')}</div><label class="check-line"><input id="repeat-audio" type="checkbox" role="switch" checked>仅播放音频</label><p class="hint">从第二遍开始只听音频。视频片段跳转可能有时间偏差，多次循环建议开启。</p><button id="repeat-done" class="primary">完成</button></dialog>
 <dialog id="print-dialog" class="wide-dialog" aria-labelledby="print-title"><div class="dialog-heading"><h2 id="print-title">字幕打印预览</h2><button data-close="print-dialog" aria-label="关闭打印预览">×</button></div><div class="print-language"><button data-print-lang="both" aria-pressed="true">双语</button><button data-print-lang="en" aria-pressed="false">仅 EN</button><button data-print-lang="zh" aria-pressed="false">仅 ZH</button></div><button id="print-now" class="primary">打印 / 另存为 PDF</button><div id="print-content"></div></dialog>
 <dialog id="retell-dialog" aria-labelledby="retell-title"><div class="dialog-heading"><h2 id="retell-title">复述练习</h2><button data-close="retell-dialog" aria-label="关闭复述练习">×</button></div><p>听完本课，用自己的话复述主要内容。</p><div id="retell-keywords"></div><label>复述提纲<textarea id="retell-notes" placeholder="主要观点 → 支持细节 → 我的理解" rows="5"></textarea></label><button id="retell-record" class="primary">去录制复述</button><p class="hint">可录音、回听和下载。AI 评分尚未接入，不消耗积分。</p></dialog>`);
 $$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
 function font(n){document.documentElement.style.setProperty('--subtitle-size',n+'px');$('#font-value').textContent=n;$('#font-range').value=n;$('#font-example').style.fontSize=n+'px';}
 $('#size-btn').onclick=()=>{const d=$('#font-dialog');d.open?d.close():d.show();};$('#font-range').oninput=e=>font(e.target.value);$$('[data-font]').forEach(b=>b.onclick=()=>font(b.dataset.font));
 $('#theme-button').onclick=()=>{const light=document.body.classList.toggle('light-learning');$('#theme-button').textContent=light?'深色主题':'浅色主题';$('#theme-button').setAttribute('aria-pressed',light);};
 $('#volume-control').oninput=e=>{media.volume=Number(e.target.value);};$('#mute-button').onclick=()=>{media.muted=!media.muted;$('#mute-button').textContent=media.muted?'取消静音':'静音';$('#mute-button').setAttribute('aria-pressed',media.muted);};
 $('#pip-button').onclick=async()=>{try{if(!media.videoWidth)throw Error('这节课没有可进入小窗的视频画面');if(!document.pictureInPictureEnabled||!media.requestPictureInPicture)throw Error('当前浏览器不支持画中画，请使用全屏播放');if(document.pictureInPictureElement)await document.exitPictureInPicture();else await media.requestPictureInPicture();}catch(e){ctx.toast(e.message);}};
 $('#pause-sentence').onclick=()=>{sentenceStop=!sentenceStop;$('#pause-sentence').textContent=sentenceStop?'句停':'连播';$('#pause-sentence').setAttribute('aria-pressed',sentenceStop);};
 $('#mask-keywords').onclick=()=>{hiddenWords=!hiddenWords;$('#mask-keywords').setAttribute('aria-pressed',hiddenWords);drawScreenWords();};
 $('#loop-btn').onclick=()=>$('#repeat-dialog').showModal();
 function clearRepeat(){$('#loop-btn').dataset.repeatCount='1';$('#repeat-range').value=0;$('#repeat-state').textContent='单次播放';$('#repeat-count').textContent='1 次';repeatCount=1;played=0;singleEnd=null;document.body.classList.remove('audio-repeat');$('#loop-btn').setAttribute('aria-pressed','false');$('#loop-btn').textContent='↻';$$('[data-repeat]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.repeat==='1'));}
 $$('[data-repeat]').forEach(b=>b.onclick=()=>{repeatCount=Number(b.dataset.repeat);$('#loop-btn').dataset.repeatCount=repeatCount===Infinity?'∞':String(repeatCount);played=0;ctx.disableLoop();$$('[data-repeat]').forEach(x=>x.setAttribute('aria-pressed',x===b));$('#loop-btn').textContent=repeatCount===1?'↻':repeatCount===Infinity?'↻ ∞':'↻ '+repeatCount;$('#loop-btn').setAttribute('aria-pressed',repeatCount!==1);$('#repeat-state').textContent=repeatCount===1?'单次播放':'音频循环';$('#repeat-count').textContent=repeatCount===Infinity?'∞':repeatCount+' 次';$('#repeat-range').value=[1,2,3,5,10,Infinity].indexOf(repeatCount);});
 $('#repeat-range').oninput=e=>$$('[data-repeat]')[Number(e.target.value)].click();$('#repeat-done').onclick=()=>$('#repeat-dialog').close();
 $('#start-ab').addEventListener('click',()=>{clearRepeat();sentenceStop=false;$('#pause-sentence').textContent='连播';$('#pause-sentence').setAttribute('aria-pressed','false');});
 document.addEventListener('echo:select',()=>{originalAudio.pause();originalAudio.onloadedmetadata=null;singleEnd=null;played=0;document.body.classList.remove('audio-repeat');});
 // Capture before the core player's time handler so finite repetition stops at this cue.
 media.addEventListener('timeupdate',e=>{
  const {course,index,mode}=ctx.get();if(!course||media.paused)return;
  const c=course.cues[index],key=course.id+':'+index;
  if(playingKey!==key){playingKey=key;played=0;document.body.classList.remove('audio-repeat');}
  if(media.currentTime<(singleEnd??c.end)||(!singleEnd&&!sentenceStop&&repeatCount===1))return;
  if($('#ab-btn').getAttribute('aria-pressed')==='true')return;if(mode==='shadow'&&!singleEnd&&repeatCount===1)return;
  e.stopImmediatePropagation();media.pause();played++;
  if(!singleEnd&&played<repeatCount){media.currentTime=c.start;document.body.classList.toggle('audio-repeat',$('#repeat-audio').checked);media.play().catch(x=>ctx.toast(x.message));}
  else{singleEnd=null;media.currentTime=c.start;played=0;document.body.classList.remove('audio-repeat');$('#playback-status').textContent='本句播放完成，点击播放可再听一次。';}
 },true);
 ctx.playVideoCue=i=>{const {course}=ctx.get();if(!course||i<0||i>=course.cues.length)return;$('#clear-ab').click();ctx.select(i);singleEnd=course.cues[i].end;media.play().catch(e=>ctx.toast(e.message));};
 const keyFor=(i,j)=>ctx.get().course.id+':'+i+':'+j;
 function tokens(text){return vocabularyTokens(text,ctx.get().words);}
 function exerciseText(text,i){const words=ctx.get().words;return tokens(text).map((w,j)=>{
  if(!words[w.toLowerCase()])return esc(w);const key=keyFor(i,j);
  if(exercise==='words')return `<input class="word-answer answer-${wordKind(w)}" data-answer-key="${key}" aria-label="第 ${i+1} 句第 ${tokens(text).slice(0,j).filter(x=>words[x.toLowerCase()]).length+1} 个空" autocomplete="off" autocapitalize="off" spellcheck="false" style="width:${Math.min(30,Math.max(7,w.length+1))}ch" value="${esc(answers.get(key)||'')}">`;
  return `<button class="reveal-word ${revealed.has(key)?'revealed':''}" data-reveal="${key}" aria-label="${revealed.has(key)?'隐藏':'揭晓'}第 ${i+1} 句单词" aria-pressed="${revealed.has(key)}">${revealed.has(key)?esc(w):'????'}</button>`;
 }).join('');}
 function stopRecording(){if(recorder?.state==='recording')recorder.stop();}
 function draw(){
  const {course,index,mode,blind,state}=ctx.get();if(!course)return;$('#prev-btn').disabled=index===0;$('#next-btn').disabled=index===course.cues.length-1;
  if(lesson!==course.id){stopRecording();lesson=course.id;exercise='normal';$('#word-dictation').setAttribute('aria-pressed','false');$('#word-dictation').classList.remove('active');clearRepeat();$('#retell-notes').value='';}
  const cloze=$('#cloze-mode').getAttribute('aria-pressed')==='true';
  document.body.classList.toggle('exercise-masked',exercise==='words'||cloze);drawScreenWords();document.body.classList.toggle('shadow-practice',mode==='shadow');
  $$('.mode').forEach(b=>{const active=b.id==='cloze-mode'?cloze:b.id==='word-dictation'?exercise==='words':exercise==='normal'&&!cloze&&b.dataset.mode===mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});
  $$('.cue').forEach((el,i)=>{
   if((cloze||exercise==='words')&&!blind&&mode!=='dictation'){el.querySelector('p').innerHTML=exerciseText(course.cues[i].text,i);el.querySelector('small')?.remove();}
   if(mode==='dictation'){el.querySelector('p').innerHTML=`<textarea class="sentence-answer" data-sentence-answer="${i}" aria-label="第 ${i+1} 句整句听写" rows="3" placeholder="听视频，用英文写下这一句…" spellcheck="false">${esc(sentenceAnswers.get(course.id+':'+i)||'')}</textarea>`;}
   el.querySelector('.cue-actions')?.remove();el.querySelector('.cue-feedback')?.remove();el.querySelector('.answer-reveal')?.remove();el.querySelector('.inline-recording')?.remove();
   el.hidden=mode==='shadow'?i!==index:!!$('#subtitle-search').value&&!course.cues[i].text.toLowerCase().includes($('#subtitle-search').value.toLowerCase())&&!course.cues[i].translation.includes($('#subtitle-search').value);
   const key=course.id+':'+i,r=recordings.get(key),activeRecord=recordingKey===key&&recorder?.state==='recording';
   el.insertAdjacentHTML('beforeend',`<div class="cue-actions"><span>#${i+1} · ${stamp(course.cues[i].start)}–${stamp(course.cues[i].end)}</span><div>${mode==='shadow'?`<button data-shadow-prev="${i}" ${i===0?'disabled':''} aria-label="跟读上一句">❮</button><button data-video-segment="${i}" aria-label="播放视频片段">▷</button>`:''}${mode==='dictation'?`<button data-full-solution="${i}" aria-label="${solutions.has('full:'+key)?'隐藏':'查看'}第 ${i+1} 句听写答案" aria-expanded="${solutions.has('full:'+key)}">◎</button>`:''}${exercise==='words'?`<button data-solution="${i}" aria-label="${solutions.has(course.id+':'+i)?'隐藏':'查看'}第 ${i+1} 句答案" aria-expanded="${solutions.has(course.id+':'+i)}" title="查看或隐藏答案">${solutions.has(course.id+':'+i)?'◉':'◎'}</button>`:''}<button data-favorite="${i}" aria-label="${state.favorites[key]?'取消收藏':'收藏'}第 ${i+1} 句" aria-pressed="${!!state.favorites[key]}">${state.favorites[key]?'★':'☆'}</button><button data-copy="${i}" aria-label="复制第 ${i+1} 句">复制</button><button data-original="${i}" aria-label="播放第 ${i+1} 句原音">♪</button><button data-record="${i}" aria-pressed="${activeRecord}" aria-label="${activeRecord?'停止':'开始'}第 ${i+1} 句录音">${activeRecord?'■ 停止':'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v3M8 21h8"/></svg>'}</button><button data-replay-record="${i}" ${r?'':'disabled'} aria-label="回放第 ${i+1} 句录音">回听</button>${mode==='shadow'?`<button data-shadow-next="${i}" ${i===course.cues.length-1?'disabled':''} aria-label="跟读下一句">❯</button>`:''}</div></div><div class="cue-feedback" role="status"></div>`);
   if(mode==='dictation'&&solutions.has('full:'+key))el.querySelector('p').insertAdjacentHTML('afterend',`<div class="answer-reveal">${esc(course.cues[i].text)}<small>${esc(course.cues[i].translation)}</small></div>`);
   if(exercise==='words'&&solutions.has(key))el.querySelector('p').insertAdjacentHTML('afterend',`<div class="answer-reveal" role="status">${esc(course.cues[i].text)}</div>`);
   if(activeRecord)el.querySelector('.cue-feedback').textContent='● 正在录音 · 点击停止结束（最长 5 分钟）';
   if(r)el.insertAdjacentHTML('beforeend',`<div class="inline-recording"><audio controls preload="metadata" src="${r}" aria-label="第 ${i+1} 句录音"></audio><a href="${r}" download="echo-sentence-${i+1}.webm">下载录音</a><small>仅保留在本页，请及时下载</small></div>`);
  });
  if((cloze||exercise==='words')&&!blind&&mode!=='dictation')$('#current-sentence').innerHTML=exerciseText(course.cues[index].text,index);
  if(exercise==='words'||cloze)$('#current-translation').textContent='';
  $$('[data-sentence-answer]').forEach(input=>{const i=Number(input.dataset.sentenceAnswer),key=course.id+':'+i;const validate=()=>{const state=answerState(input.value,course.cues[i].text);input.dataset.answerState=state;input.classList.toggle('answer-ok',state==='correct');input.classList.toggle('answer-wrong',state==='incorrect');input.setAttribute('aria-invalid',state==='incorrect');input.closest('.cue').querySelector('.cue-feedback').textContent=state==='empty'?'':state==='correct'?'✓ 本句正确':'尚未完全匹配，可以再听一次或继续修改。';};input.oninput=()=>{sentenceAnswers.set(key,input.value);validate();};validate();});
  $$('[data-full-solution]').forEach(b=>b.onclick=()=>{const key='full:'+course.id+':'+b.dataset.fullSolution;solutions.has(key)?solutions.delete(key):solutions.add(key);draw();});
  $$('[data-answer-key]').forEach(input=>{input.oninput=()=>{answers.set(input.dataset.answerKey,input.value);$$('[data-answer-key]').filter(x=>x!==input&&x.dataset.answerKey===input.dataset.answerKey).forEach(x=>x.value=input.value);check(Number(input.dataset.answerKey.split(':').at(-2)),false);};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();check(Number(input.dataset.answerKey.split(':').at(-2)),false);}};});
  if(exercise==='words')$$('.cue').forEach((el,i)=>{if([...el.querySelectorAll('[data-answer-key]')].some(x=>x.value))check(i,false);});
  $$('[data-reveal]').forEach(b=>b.onclick=e=>{e.stopPropagation();const k=b.dataset.reveal;revealed.has(k)?revealed.delete(k):revealed.add(k);draw();});
  $$('[data-favorite]').forEach(b=>b.onclick=()=>ctx.toggleFavorite(Number(b.dataset.favorite)));
  $$('[data-copy]').forEach(b=>b.onclick=async()=>{try{const c=course.cues[Number(b.dataset.copy)];await navigator.clipboard.writeText(c.text+'\n'+c.translation);ctx.toast('本句中英字幕已复制');}catch{ctx.toast('浏览器未允许复制，请手动选择字幕复制');}});
  $$('[data-original]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.original);if(!originalAudio.paused&&ctx.get().index===i){originalAudio.pause();return;}ctx.select(i);originalAudio.src=media.currentSrc||media.src;originalEnd=course.cues[i].end;originalAudio.playbackRate=media.playbackRate;originalAudio.onloadedmetadata=()=>{originalAudio.currentTime=course.cues[i].start;originalAudio.play().catch(e=>ctx.toast(e.message));};});
  $$('[data-video-segment]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.videoSegment);ctx.select(i);singleEnd=course.cues[i].end;media.play().catch(e=>ctx.toast(e.message));});
  $$('[data-shadow-prev]').forEach(b=>b.onclick=()=>{ctx.playVideoCue(Number(b.dataset.shadowPrev)-1);});$$('[data-shadow-next]').forEach(b=>b.onclick=()=>{ctx.playVideoCue(Number(b.dataset.shadowNext)+1);});
  $$('[data-check]').forEach(b=>b.onclick=()=>check(Number(b.dataset.check),false));$$('[data-solution]').forEach(b=>b.onclick=()=>check(Number(b.dataset.solution),true));
  $$('[data-record]').forEach(b=>b.onclick=()=>record(Number(b.dataset.record)));
  $$('[data-replay-record]').forEach(b=>b.onclick=()=>{media.pause();const audio=$$('.cue')[Number(b.dataset.replayRecord)].querySelector('audio');$$('audio').forEach(a=>{if(a!==audio)a.pause();});audio.paused?audio.play().catch(e=>ctx.toast(e.message)):audio.pause();});
 }
 function check(i,show){const {course,words}=ctx.get();if(show){const key=course.id+':'+i;solutions.has(key)?solutions.delete(key):solutions.add(key);draw();return;}let total=0,correct=0;tokens(course.cues[i].text).forEach((w,j)=>{if(!words[w.toLowerCase()])return;total++;const key=keyFor(i,j),ok=answerState(answers.get(key),w)==='correct';if(ok)correct++;$$('[data-answer-key]').filter(x=>x.dataset.answerKey===key).forEach(x=>{x.classList.toggle('answer-ok',ok);const filled=!!(answers.get(key)||'').trim();x.classList.toggle('answer-wrong',filled&&!ok);x.setAttribute('aria-invalid',filled&&!ok);x.dataset.answerState=!filled?'empty':ok?'correct':'incorrect';});});const row=$$('.cue')[i];row.querySelector('.cue-feedback').textContent=show?'参考答案：'+course.cues[i].text:total?`正确 ${correct} / ${total}，${correct===total?'全部答对！':'可再听一次，修改后重新核对。'}`:'本句没有收录重点词，可以切换整句听写。';}
 async function record(i){
  if(recorder?.state==='recording'){stopRecording();return;}
  if(recordingPending)return;recordingPending=true;
  try{ctx.endRecording();media.pause();originalAudio.pause();$('#recording-audio').pause();const {course}=ctx.get(),key=course.id+':'+i;if(!navigator.mediaDevices?.getUserMedia)throw Error('录音需要 HTTPS 或本机 localhost 环境');const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   if(ctx.get().course.id!==course.id||$('#player-view').hidden){stream.getTracks().forEach(t=>t.stop());return;}
   try{recorder=new MediaRecorder(stream);}catch(e){stream.getTracks().forEach(t=>t.stop());throw e;}
   const activeRecorder=recorder;const chunks=[];recordingKey=key;recorder.ondataavailable=e=>chunks.push(e.data);
   recorder.onstop=()=>{clearTimeout(recordTimer);clearInterval(recordTicker);stream.getTracks().forEach(t=>t.stop());if(recordings.has(key))URL.revokeObjectURL(recordings.get(key));recordings.set(key,URL.createObjectURL(new Blob(chunks,{type:activeRecorder.mimeType})));recordingKey=null;draw();};recorder.start();recordStarted=Date.now();recordTicker=setInterval(()=>{const b=$$('[data-record]').find(x=>x.getAttribute('aria-pressed')==='true');if(b){b.closest('.cue').querySelector('.cue-feedback').textContent='● 正在录音 '+stamp((Date.now()-recordStarted)/1000)+' / 05:00 · 再点停止结束';}},500);recordTimer=setTimeout(stopRecording,300000);draw();
  }catch(e){const row=$$('.cue')[i];if(row)row.querySelector('.cue-feedback').textContent='无法录音：'+(e.name==='NotAllowedError'?'请在浏览器地址栏允许麦克风权限后重试。':e.message);}finally{recordingPending=false;}
 }
 $('#record-btn').addEventListener('click',stopRecording);
 media.addEventListener('play',()=>$$('audio').forEach(a=>a.pause()));
 originalAudio.ontimeupdate=()=>{if(originalAudio.currentTime>=originalEnd)originalAudio.pause();};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)$$('audio').forEach(a=>a.pause());});
 new MutationObserver(()=>{if($('#player-view').hidden){originalAudio.pause();stopRecording();clearRepeat();}}).observe($('#player-view'),{attributes:true,attributeFilter:['hidden']});
 document.addEventListener('echo:sentence',draw);document.addEventListener('echo:tools',draw);
 $$('.mode').filter(b=>b.id!=='retell-mode').forEach(b=>b.addEventListener('click',()=>{originalAudio.pause();originalAudio.onloadedmetadata=null;singleEnd=null;exercise=b.id==='word-dictation'?'words':'normal';if(b.id==='word-dictation'){ctx.setMode('listen');$('#cloze-mode').setAttribute('aria-pressed','false');$$('.mode').forEach(x=>x.classList.toggle('active',x===b));}$('#word-dictation').setAttribute('aria-pressed',exercise==='words');draw();}));
 $('#retell-mode').onclick=()=>{const {course,words}=ctx.get();$('#retell-keywords').textContent='关键词：'+Object.keys(words).filter(w=>course.cues.some(c=>new RegExp('\\b'+w+'\\b','i').test(c.text))).join(' · ');$('#retell-dialog').showModal();};
 $('#retell-record').onclick=()=>{$('#retell-dialog').close();ctx.setMode('shadow');record(ctx.get().index);};
 let printLang='both';
 function printContent(){const {course}=ctx.get();$('#print-content').innerHTML=`<h1>${esc(course.title)}</h1>`+course.cues.map((c,i)=>`<article><span>${i+1} · ${stamp(c.start)}–${stamp(c.end)}</span>${printLang!=='zh'?`<p>${esc(c.text)}</p>`:''}${printLang!=='en'?`<p>${esc(c.translation)}</p>`:''}</article>`).join('');}
 $('#print-preview').onclick=()=>{media.pause();printContent();$('#print-dialog').showModal();};$$('[data-print-lang]').forEach(b=>b.onclick=()=>{printLang=b.dataset.printLang;$$('[data-print-lang]').forEach(x=>x.setAttribute('aria-pressed',x===b));printContent();});$('#print-now').onclick=()=>window.print();

 $('#media-stage').insertAdjacentHTML('beforeend','<div id="screen-vocabulary" hidden aria-label="视频屏词"></div>');
 function drawScreenWords(){const {course,index,words}=ctx.get();if(!course)return;const panel=$('#screen-vocabulary');panel.hidden=!hiddenWords;const found=[...new Set(vocabularyTokens(course.cues[index].text,words).map(t=>t.toLowerCase()).filter(t=>words[t]))];panel.innerHTML=found.map(w=>`<button class="screen-${wordKind(w)}" data-screen-word="${esc(w)}"><strong>${esc(w)}</strong><span>${esc(words[w][1])}</span></button>`).join('');$$('[data-screen-word]').forEach(b=>b.onclick=()=>{if($('#word-dock').hidden)$('#words-btn').click();$('#word-'+b.dataset.screenWord)?.scrollIntoView({block:'nearest'});});}
 const rail=document.createElement('aside');rail.className='study-rail';rail.setAttribute('aria-label','学习工具');rail.innerHTML='<button id="study-home" title="返回资料库">←<small>资料库</small></button>';document.body.append(rail);
 $('#study-home').onclick=()=>$('#back-btn').click();
 for(const [id,label,symbol] of [['words-btn','重点词','✧'],['course-complete','标记已学','⊕'],['catalog-btn','目录','▤']]){const b=document.createElement('button');b.dataset.forward=id;b.innerHTML=symbol+'<small>'+label+'</small>';b.onclick=()=>$('#'+id).click();rail.append(b);}
 const vocab=document.createElement('button');vocab.id='study-vocab';vocab.innerHTML='▧<small>生词本</small>';vocab.onclick=()=>ctx.showSavedWords();rail.insertBefore(vocab,rail.lastChild);
 $('.media-column').prepend($('.player-heading'));
 const search=document.createElement('details');search.className='subtitle-options';search.innerHTML='<summary>搜索与学习进度</summary>';$('.mode-tabs').after(search);search.append($('.transcript-tools'),$('.lesson-progress'));
 const bar=document.createElement('div');bar.className='reference-controls';$('.transport').append(bar);
 for(const [id,label] of [['pip-button','小窗'],['video-fullscreen','全屏'],['video-cc','字幕'],['ab-btn','复读'],['speed','倍速'],['blind-btn','盲听'],['loop-btn','循环'],['prev-btn','上句'],['play-btn','播放'],['next-btn','下句'],['pause-sentence','连播'],['mask-keywords','屏词'],['size-btn','字号'],['theme-button','外观'],['print-preview','PDF']]){const cell=document.createElement('div');cell.className='control-cell';const b=$('#'+id);cell.append(b);const caption=document.createElement('small');caption.textContent=label;cell.append(caption);bar.append(cell);}
 $('#size-btn').textContent='T+';$('#mask-keywords').textContent='词';$('#print-preview').textContent='▧';$('#theme-button').textContent='◐';$('#theme-button').onclick=()=>{const on=document.body.classList.toggle('light-learning');$('#theme-button').setAttribute('aria-pressed',on);};
 $('#pause-sentence').textContent='▶';$('#pause-sentence').onclick=()=>{sentenceStop=!sentenceStop;$('#pause-sentence').textContent=sentenceStop?'Ⅱ':'▶';$('#pause-sentence').setAttribute('aria-pressed',sentenceStop);$('#pause-sentence').nextElementSibling.textContent=sentenceStop?'句停':'连播';};
 $('#blind-btn').textContent='◉';$('#blind-btn').setAttribute('aria-label','切换盲听');$('#mask-keywords').setAttribute('aria-label','视频屏词');$('#print-preview').setAttribute('aria-label','字幕打印预览');$('#theme-button').setAttribute('aria-label','切换学习页主题');$('#pause-sentence').setAttribute('aria-label','切换连播与句停');$('#font-dialog').setAttribute('aria-label','实时字幕字号');
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#font-dialog').open)$('#font-dialog').close();});


 function syncButtons(){const {course,index,mode,state}=ctx.get();if(!course)return;const complete=ctx.progress(course)>=100;const b=$('[data-forward="course-complete"]');b.setAttribute('aria-pressed',complete);b.title=complete?'撤销整课已学':'标记整课已学';b.querySelector('small').textContent=complete?'已学完':'标记已学';$('#study-vocab').title='生词本 · '+Object.keys(state.vocab).length+' 个词';$('#pause-sentence').setAttribute('aria-pressed',sentenceStop||mode==='shadow');$('#pause-sentence').nextElementSibling.textContent=sentenceStop||mode==='shadow'?'句停':'连播';$('#blind-btn').textContent='◉';
  $$('.cue-actions button').forEach(x=>{x.title=x.getAttribute('aria-label')||x.textContent;});
 }
 document.addEventListener('echo:sentence',syncButtons);
 $$('.control-cell>button,.control-cell>select,.study-rail button').forEach(b=>{b.title=b.getAttribute('aria-label')||b.textContent.trim();});
 $('#speed').addEventListener('change',()=>{originalAudio.playbackRate=media.playbackRate;});
 originalAudio.addEventListener('play',()=>{const b=$$('[data-original]').find(x=>Number(x.dataset.original)===ctx.get().index);if(b){b.setAttribute('aria-pressed','true');b.textContent='Ⅱ';}});
 originalAudio.addEventListener('pause',()=>$$('[data-original]').forEach(b=>{b.setAttribute('aria-pressed','false');b.textContent='♪';}));
 document.addEventListener('pointerdown',e=>{const d=$('#font-dialog');if(d.open&&!d.contains(e.target)&&!$('#size-btn').contains(e.target))d.close();});

 $('.dock-filters').insertAdjacentHTML('afterend','<div class="word-dock-extras"><button id="hide-spelling" aria-pressed="false">隐藏单词</button><button id="word-details" aria-pressed="true">详细例句</button></div>');
 $('#hide-spelling').onclick=()=>{const on=$('#word-dock').classList.toggle('hide-word-spelling');$('#hide-spelling').setAttribute('aria-pressed',on);$('#hide-spelling').textContent=on?'显示单词':'隐藏单词';};
 $('#word-details').onclick=()=>{const on=$('#word-dock').classList.toggle('compact-word-cards');$('#word-details').setAttribute('aria-pressed',!on);$('#word-details').textContent=on?'显示例句':'收起例句';};
 function wordButtons(){
  $$('.word-entry').forEach(card=>{if(card.querySelector('.word-pronunciation'))return;const word=card.querySelector('strong').textContent;
   const bar=document.createElement('div');bar.className='word-pronunciation';
   for(const [label,lang] of [['美音','en-US'],['英音','en-GB'],['复制','copy']]){const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label',label+' '+word);b.onclick=async()=>{try{if(lang==='copy'){await navigator.clipboard.writeText(word);ctx.toast('单词已复制');return;}if(!('speechSynthesis' in window))throw Error('当前浏览器没有语音朗读功能');const voice=speechSynthesis.getVoices().find(v=>v.lang===lang);if(!voice)throw Error('系统尚未安装'+label+'语音，可先听本课原音');media.pause();speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(word);utterance.voice=voice;utterance.lang=lang;utterance.rate=.85;speechSynthesis.speak(utterance);}catch(e){ctx.toast(e.message);}};bar.append(b);}
   card.querySelector('.phonetic').after(bar);
  });
 }
 installWordHover(ctx);
 new MutationObserver(wordButtons).observe($('#dock-list'),{childList:true});
 // Independently control the current-cue caption below the video.
 const captionCell=document.createElement('div');captionCell.className='control-cell';captionCell.innerHTML='<button id="below-caption-toggle" aria-label="视频下方字幕" aria-pressed="true" title="显示或隐藏视频下方字幕">文</button><small>下字幕</small>';
 $('#video-cc').closest('.control-cell').after(captionCell);$('#video-cc').nextElementSibling.textContent='视频 CC';
 $('#below-caption-toggle').onclick=()=>{const off=document.body.classList.toggle('below-captions-off');$('#below-caption-toggle').setAttribute('aria-pressed',!off);$('#below-caption-toggle').title=off?'显示视频下方字幕':'隐藏视频下方字幕';};
 document.addEventListener('echo:sentence',()=>document.body.classList.toggle('full-dictation',ctx.get().mode==='dictation'));
 // Dismiss only when both ends of the pointer gesture are outside the panel.
 let outsideDialog=null;
 const outside=(e,d)=>{const r=d.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
 document.addEventListener('pointerdown',e=>{const d=$$('dialog[open]').at(-1);outsideDialog=d&&outside(e,d)?d:null;});
 document.addEventListener('pointerup',e=>{if(outsideDialog?.open&&outside(e,outsideDialog))outsideDialog.close();outsideDialog=null;});
 document.addEventListener('pointerdown',e=>{if(matchMedia('(max-width:1100px)').matches&&!$('#word-dock').hidden&&!e.target.closest('#word-dock,[data-keyword],[data-screen-word],[data-forward="words-btn"],#words-btn'))$('#close-dock').click();});

 installAdvancedTools(ctx);
}
