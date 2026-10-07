import {wordCard,wireWordCards,wordData} from './word-card.js';
import {wordKind} from './vocabulary.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function installWordHover(ctx){
 const panel=document.createElement('aside');panel.id='word-hover';panel.hidden=true;panel.setAttribute('aria-label','悬停词义');document.body.append(panel);
 const dialog=document.createElement('dialog');dialog.id='word-detail-dialog';dialog.setAttribute('aria-label','词汇详情');document.body.append(dialog);
 let timer,anchor=null,current='';
 const hide=()=>{clearTimeout(timer);panel.hidden=true;anchor=null;};
 function content(word,full=false){return wordCard(ctx,word,{full});}
 function wire(root,word){wireWordCards(root,ctx);}
 function detail(word){hide();const data=wordData(ctx,word);dialog.innerHTML=`<div class="dialog-heading"><div><small>词条详情</small><h2>${esc(word)}</h2><span>${esc(data.info.pos||'')} · ${data.meanings.length} 条释义 · ${data.contexts.length} 次出现</span></div><button aria-label="关闭词汇详情">×</button></div>`+content(word,true);dialog.querySelector('.dialog-heading button').onclick=()=>dialog.close();wire(dialog,word);if(!dialog.open)dialog.showModal();}
 ctx.openWordDetail=detail;
 function show(el){const word=el.dataset.keyword;if(!ctx.get().words[word])return;clearTimeout(timer);if(anchor===el&&!panel.hidden)return;anchor=el;current=word;panel.innerHTML=content(word);wire(panel,word);panel.hidden=false;
  const r=el.getBoundingClientRect(),w=Math.min(340,innerWidth-24);panel.style.width=w+'px';panel.style.left=Math.min(Math.max(12,r.left),innerWidth-w-12)+'px';const below=innerHeight-r.bottom-20,above=r.top-20,useBelow=below>=Math.min(360,above);panel.style.maxHeight=Math.max(60,Math.min(440,useBelow?below:above))+'px';const h=panel.getBoundingClientRect().height;panel.style.top=(useBelow?r.bottom+8:Math.max(10,r.top-h-8))+'px';
 }
 document.addEventListener('pointerover',e=>{const el=e.target.closest('[data-keyword]');if(el&&e.pointerType!=='touch')show(el);});
 document.addEventListener('pointerout',e=>{if(e.target.closest('[data-keyword]')&&!panel.contains(e.relatedTarget))timer=setTimeout(hide,180);});
 panel.onpointerenter=()=>clearTimeout(timer);panel.onpointerleave=()=>{timer=setTimeout(hide,180);};
 document.addEventListener('focusin',e=>{const el=e.target.closest('[data-keyword]');if(el)show(el);});
 document.addEventListener('click',e=>{const el=e.target.closest('[data-keyword],[data-screen-word]');if(!el)return;e.preventDefault();e.stopImmediatePropagation();detail(el.dataset.keyword||el.dataset.screenWord);},true);
 document.addEventListener('keydown',e=>{const el=e.target.closest('[data-keyword]');if(el&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();detail(el.dataset.keyword||current);}if(e.key==='Escape')hide();},true);
 document.addEventListener('pointerdown',e=>{if(!panel.contains(e.target)&&!e.target.closest('[data-keyword]'))hide();});
 document.addEventListener('scroll',e=>{if(!panel.contains(e.target))hide();},true);
 document.addEventListener('echo:sentence',hide);
}
