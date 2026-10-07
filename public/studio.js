import {wordCard,wireWordCards} from './word-card.js';
import {vocabularyTokens,wordKind} from './vocabulary.js';
import {stamp} from './subtitles.js';
import {installVideo} from './video.js';
import {installLearningTools} from './learning-tools.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function installStudio(ctx){
 const compactWords=new Set();
 let savedOnly=false,category='all',scope='all',hideMeaning=false,ab=null,cloze=false,lastCourse='',autoScroll=true;
 let manuallyScrolled=false,lastFollowed='';const list=$('#transcript-list');for(const event of ['wheel','touchstart'])list.addEventListener(event,()=>{manuallyScrolled=true;},{passive:true});list.addEventListener('keydown',e=>{if(['PageDown','PageUp','Home','End','ArrowDown','ArrowUp'].includes(e.key))manuallyScrolled=true;});document.addEventListener('echo:select',()=>{manuallyScrolled=false;lastFollowed='';});
 const media=$('#media');
 document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="/studio.css">');
 $('.mode-tabs').insertAdjacentHTML('beforeend','<button class="mode" id="cloze-mode" aria-pressed="false">挖空练习</button>');
 $('.transport-buttons').insertAdjacentHTML('beforeend','<div class="advanced-controls"><button id="ab-btn" title="选择句子区间反复练习" aria-pressed="false">AB 复读</button><button id="size-btn" aria-label="切换字幕字号">Aa</button><button id="focus-btn" aria-pressed="false">专注</button></div>');
 $('.transport').insertAdjacentHTML('afterbegin','<div class="transport-label"><span id="transport-course">ECHO / LISTENING ROOM</span><span id="ab-status">空格播放 · 方向键切句</span></div>');
 $('.transcript-header').insertAdjacentHTML('afterend','<div class="transcript-tools"><span>原文与译文</span><button id="follow-btn" aria-pressed="true">自动跟随</button><input id="subtitle-search" placeholder="搜索本课字幕…" aria-label="搜索本课字幕"></div>');
 $('.practice-layout').insertAdjacentHTML('beforeend',`<aside id="word-dock" hidden><div class="dock-heading"><div><span class="eyebrow">VOCABULARY</span><h3>重点词汇 <span id="dock-count"></span></h3></div><button id="close-dock" aria-label="收起重点词面板">×</button></div><div class="dock-filters"><button data-scope="all" class="active">全部</button><button data-scope="current">当前句</button><button id="meaning-toggle" aria-pressed="false">隐藏释义</button></div><div id="dock-list"></div><div class="dock-footer">从语境理解单词，把表达变成自己的。</div></aside>`);
 document.body.insertAdjacentHTML('beforeend',`<dialog id="ab-dialog"><div class="dialog-heading"><div><span class="eyebrow">DELIBERATE PRACTICE</span><h2>AB 区间复读</h2></div><button id="close-ab" aria-label="关闭区间设置">×</button></div><p class="hint">选择起始句 A 和结束句 B，整段会持续循环。切换练习模式会结束区间复读。</p><label>A · 起始句<select id="ab-start"></select></label><label>B · 结束句<select id="ab-end"></select></label><p id="ab-error" class="error" role="alert"></p><div class="dialog-actions"><button id="clear-ab" class="secondary">结束区间复读</button><button id="start-ab" class="primary">开始复读</button></div></dialog><dialog id="catalog-dialog"><div class="dialog-heading"><div><span class="eyebrow">COURSE COLLECTION</span><h2>学习目录</h2></div><button id="close-catalog" aria-label="关闭学习目录">×</button></div><div class="catalog-filters"><button data-catalog="all" class="active">全部</button><button data-catalog="free">免费</button><button data-catalog="unlearned">未学完</button></div><div id="catalog-list"></div></dialog>`);
 const foundWords=(ignoreCategory=false)=>{const {course,index,words,state}=ctx.get();if(!course)return [];const text=scope==='current'?course.cues[index].text:course.cues.map(c=>c.text).join(' ');const keys=savedOnly?Object.keys(state.vocab):Object.keys(words);return keys.filter(w=>(savedOnly&&scope==='all'||new RegExp('\\b'+w+'\\b','i').test(text))&&(ignoreCategory||category==='all'||wordKind(w)===category));};

 function drawWords(){
  const {course,words,state}=ctx.get();if(!course)return;const found=foundWords();$('#dock-count').textContent=found.length;
  $('#dock-list').innerHTML=found.map(w=>wordCard(ctx,w,{hideMeaning})).join('')||'<div class="empty">当前没有符合条件的词条</div>';wireWordCards($('#dock-list'),ctx);
  const all=foundWords(true);$$('[data-word-category]').forEach(b=>{const k=b.dataset.wordCategory,n=k==='all'?all.length:all.filter(w=>wordKind(w)===k).length;b.textContent=({all:'全部',vocabulary:'词汇',expression:'表达',other:'其他'}[k])+' '+n;});

 }

 function dock(open=true){$('#word-dock').hidden=!open;document.body.classList.toggle('words-open',open);$('#words-btn').setAttribute('aria-pressed',open);if(open)drawWords();}
 $('#words-btn').onclick=()=>{savedOnly=false;$('#word-dock h3').firstChild.textContent='重点词汇 ';dock($('#word-dock').hidden);};ctx.showSavedWords=()=>{savedOnly=true;$('#word-dock h3').firstChild.textContent='生词本 ';dock(true);};$('#close-dock').onclick=()=>dock(false);
 $$('[data-scope]').forEach(b=>b.onclick=()=>{scope=b.dataset.scope;$$('[data-scope]').forEach(x=>x.classList.toggle('active',x===b));drawWords();});
 document.addEventListener('echo:vocab',()=>{if(!$('#word-dock').hidden)drawWords();});
 $('#meaning-toggle').onclick=()=>{hideMeaning=!hideMeaning;$('#meaning-toggle').textContent=hideMeaning?'显示释义':'隐藏释义';$('#meaning-toggle').setAttribute('aria-pressed',hideMeaning);drawWords();};
 function highlight(text){const words=ctx.get().words;return vocabularyTokens(text,words).map(t=>words[t.toLowerCase()]?`<mark class="keyword-${wordKind(t)}" data-keyword="${t.toLowerCase()}" tabindex="0" role="button" aria-label="查看 ${t.toLowerCase()} 释义">${esc(t)}</mark>`:esc(t)).join('');}
 function decorate(){const {course,index,mode,blind}=ctx.get();if(!course)return;
  if(lastCourse!==course.id){lastCourse=course.id;ab=null;cloze=false;$('#subtitle-search').value='';updateAb();dock(false);}
  $('#transport-course').textContent=course.title+'  /  '+String(index+1).padStart(2,'0')+' · '+course.cues.length;
  $$('.cue').forEach((el,i)=>{const text=course.cues[i].text;if(!blind&&mode!=='dictation')el.querySelector('p').innerHTML=cloze?esc(text).replace(/\b[a-zA-Z]+\b/g,w=>ctx.get().words[w.toLowerCase()]?'______':w):highlight(text);el.hidden=!!$('#subtitle-search').value&&!text.toLowerCase().includes($('#subtitle-search').value.toLowerCase())&&!course.cues[i].translation.includes($('#subtitle-search').value);});
  if(!blind&&mode!=='dictation'){
   $('#current-sentence').innerHTML=cloze?vocabularyTokens(course.cues[index].text,ctx.get().words).map(w=>ctx.get().words[w.toLowerCase()]?`<button class="blank-word" data-answer="${esc(w)}" aria-label="显示隐藏单词">${'·'.repeat(w.length)}</button>`:esc(w)).join(''):highlight(course.cues[index].text);
   $$('.blank-word').forEach(b=>b.onclick=()=>{b.textContent=b.dataset.answer;b.classList.add('revealed');});
  }
  $$('[data-keyword]').forEach(el=>{const open=e=>{e.stopPropagation();scope='all';$$('[data-scope]').forEach(b=>b.classList.toggle('active',b.dataset.scope==='all'));dock(true);const card=$('#word-'+el.dataset.keyword);card?.scrollIntoView({block:'nearest',behavior:'smooth'});card?.classList.add('word-selected');};el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(e);}};});
  if(!$('#word-dock').hidden)drawWords();
  if(autoScroll&&!manuallyScrolled&&!$('#subtitle-search').value&&lastFollowed!==course.id+':'+index){lastFollowed=course.id+':'+index;const list=$('#transcript-list'),active=list.querySelector('.cue.active');if(active)list.scrollTo({top:Math.max(0,active.offsetTop-list.offsetTop-45),behavior:media.paused?'instant':'smooth'});}
 }
 document.addEventListener('echo:sentence',decorate);
 $('#subtitle-search').oninput=()=>{decorate();document.dispatchEvent(new Event('echo:tools'));};
 $('#follow-btn').onclick=()=>{autoScroll=!autoScroll;manuallyScrolled=false;lastFollowed='';$('#follow-btn').setAttribute('aria-pressed',autoScroll);if(autoScroll)decorate();document.dispatchEvent(new Event('echo:tools'));};
 $('#size-btn').onclick=()=>document.body.classList.toggle('large-subtitles');
 $('#focus-btn').onclick=()=>{const on=document.body.classList.toggle('focus-mode');$('#focus-btn').setAttribute('aria-pressed',on);};
 function updateAb(){$('#ab-btn').setAttribute('aria-pressed',!!ab);$('#ab-status').textContent=ab?`正在复读第 ${ab.a+1}—${ab.b+1} 句`:'空格播放 · 方向键切句';}
 $('#ab-btn').onclick=()=>{const {course,index}=ctx.get();const options=course.cues.map((c,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')} · ${stamp(c.start)} ${esc(c.text)}</option>`).join('');$('#ab-start').innerHTML=$('#ab-end').innerHTML=options;$('#ab-start').value=ab?.a??index;$('#ab-end').value=ab?.b??Math.min(index+1,course.cues.length-1);$('#ab-error').textContent='';$('#ab-dialog').showModal();};
 $('#close-ab').onclick=()=>$('#ab-dialog').close();$('#clear-ab').onclick=()=>{ab=null;updateAb();$('#ab-dialog').close();};
 $('#start-ab').onclick=()=>{const a=Number($('#ab-start').value),b=Number($('#ab-end').value);if(b<a){$('#ab-error').textContent='结束句不能早于起始句';return;}ctx.setMode('listen');cloze=false;ctx.disableLoop();ab={a,b};ctx.select(a);updateAb();$('#ab-dialog').close();media.play().catch(e=>ctx.toast(e.message));};
 media.addEventListener('timeupdate',()=>{if(ab&&!media.paused){const {course}=ctx.get();if(media.currentTime>=course.cues[ab.b].end){ctx.select(ab.a);media.play().catch(e=>ctx.toast(e.message));}}});
 $$('.mode').forEach(b=>b.addEventListener('click',()=>{ab=null;updateAb();if(b.id!=='cloze-mode'){cloze=false;$('#cloze-mode').classList.remove('active');$('#cloze-mode').setAttribute('aria-pressed','false');decorate();}}));
 $('#cloze-mode').onclick=()=>{ctx.setMode('listen');cloze=true;$$('.mode').forEach(b=>b.classList.toggle('active',b.id==='cloze-mode'));$('#cloze-mode').setAttribute('aria-pressed','true');decorate();};
 $('#loop-btn').addEventListener('click',()=>{ab=null;updateAb();});
 function catalog(filter='all'){const current=ctx.get().course;$('#catalog-list').innerHTML=ctx.courses().filter(c=>filter==='all'||filter==='free'&&!c.premium||filter==='unlearned'&&ctx.progress(c)<100).map((c,i)=>`<button class="catalog-row ${c.id===current?.id?'current':''}" data-open-course="${esc(c.id)}"><span class="catalog-number">${String(i+1).padStart(2,'0')}</span><span><strong>${esc(c.title)}</strong><small>${esc(c.level)} · ${c.count||c.cues.length} 句 · ${c.locked?'会员课程':ctx.progress(c)+'% 已学'}</small></span><span>${c.id===current?.id?'学习中':c.locked?'◇':'↗'}</span></button>`).join('')||'<p class="empty">暂无符合条件的课程</p>';$$('[data-open-course]').forEach(b=>b.onclick=()=>{$('#catalog-dialog').close();ctx.openCourse(b.dataset.openCourse).catch(e=>ctx.toast(e.message));});}
 $('#catalog-btn').onclick=()=>{catalog();$$('[data-catalog]').forEach(b=>b.classList.toggle('active',b.dataset.catalog==='all'));$('#catalog-dialog').showModal();};$('#close-catalog').onclick=()=>$('#catalog-dialog').close();$$('[data-catalog]').forEach(b=>b.onclick=()=>{$$('[data-catalog]').forEach(x=>x.classList.toggle('active',x===b));catalog(b.dataset.catalog);});
 $('.dock-filters').insertAdjacentHTML('afterend','<div class="word-categories"><button data-word-category="all" aria-pressed="true">全部</button><button data-word-category="vocabulary">单词</button><button data-word-category="expression">表达</button><button data-word-category="other">其他</button></div>');$$('[data-word-category]').forEach(b=>b.onclick=()=>{category=b.dataset.wordCategory;$$('[data-word-category]').forEach(x=>x.setAttribute('aria-pressed',x===b));drawWords();});
 const observer=new MutationObserver(()=>{const on=!$('#player-view').hidden;document.body.classList.toggle('studio-mode',on);if(!on){ab=null;updateAb();}});observer.observe($('#player-view'),{attributes:true,attributeFilter:['hidden']});
 $('.hero .pill').textContent='THE LISTENING COLLECTION / 01';$('.hero h2').innerHTML='听懂世界，<br>说出自己的声音。';$('.hero p').innerHTML='精听语境 · 拆解表达 · 逐句跟读<br>让每一次练习，都有清晰的方向。';$('.hero-art').innerHTML='<div class="editorial-grid"></div><div class="editorial-letter">Aa<span>THE ART OF LISTENING</span></div><div class="hero-sound">'+Array.from({length:29},(_,i)=>`<i style="--h:${18+Math.round(Math.abs(Math.sin(i*1.7))*64)}px"></i>`).join('')+'</div><span class="edition-mark">ECHO<br>STUDY SERIES</span>';
 $('.page-heading .eyebrow').textContent='CURATED LEARNING · DAILY PRACTICE';$('.page-heading h1').textContent='从你的兴趣，开启新的进阶。';$('.page-heading p').textContent='选一段感兴趣的内容，开始一次有深度的练习。';
 $('.audio-wave').innerHTML=Array.from({length:35},(_,i)=>`<i style="--h:${10+Math.round(Math.abs(Math.sin(i*.8))*48)}px;--delay:${i*-.09}s"></i>`).join('');media.addEventListener('play',()=>document.body.classList.add('is-playing'));media.addEventListener('pause',()=>document.body.classList.remove('is-playing'));
 installVideo(ctx);
 installLearningTools(ctx);
}
