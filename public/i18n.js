import {translateCopy} from './i18n-catalog.js';

const storageKey='echo-interface-language';
export function resolveLanguage(saved, browserLanguage='zh-CN') {
 return ['zh-CN','en'].includes(saved)?saved:/^zh\b/i.test(browserLanguage)?'zh-CN':'en';
}
let locale='zh-CN';
try{locale=resolveLanguage(localStorage.getItem(storageKey),navigator.language);}catch{locale=resolveLanguage(null,navigator.language);}
export const getLanguage=()=>locale;
export const t=source=>translateCopy(source,locale);

// The legacy UI renders in several independent modules. This bridge localizes
// allowlisted interface copy without rebuilding DOM, losing focus or resetting media.
// New UI may use t() directly. Never translate arbitrary lesson or user text.
const protectedContent='[data-no-i18n], [translate="no"], script, style, code, [contenteditable], #lesson-title, #lesson-description, #current-sentence, #current-translation, #video-captions, .cue > p, .cue > small, .answer-reveal, .lex-meaning p, .word-example p, .lex-contexts p, .word-top, .lex-tags, [data-keyword], [data-screen-word], #retell-ai-result, #ai-output, #retell-sample, #print-content, #retell-summary p, #retell-keywords, .retell-keywords, .retell-questions, .course-info h3, .course-title, #user-rows td:first-child, #user-rows td:nth-child(2), #ab-sentence-list strong, .catalog-row strong, #favorites-list h3, #favorites-list p, #favorites-list small, #progress-list h3';
const attributes=['aria-label','title','placeholder','alt'];
const originalText=new WeakMap(),originalAttributes=new WeakMap();
let observer;
function excluded(element){return !element||!!element.closest(protectedContent);}
function renderValue(current,record){
 const source=record&&current===record.rendered?record.source:current;
 return {source,rendered:translateCopy(source,locale)};
}
function textNode(node){
 const metadata=node.parentElement.matches('#lesson-title, .course-info h3, .course-title, .catalog-row strong, #progress-list h3, #favorites-list small');
 if((excluded(node.parentElement)&&!metadata)||node.parentElement.closest('textarea'))return;
 // Options without explicit values derive their submitted value from their label.
 if(node.parentElement.tagName==='OPTION'&&!node.parentElement.hasAttribute('value'))node.parentElement.setAttribute('value',node.parentElement.value);
 const next=renderValue(node.data,originalText.get(node));originalText.set(node,next);
 if(node.data!==next.rendered)node.data=next.rendered;
}
function elementAttrs(element){
 if(excluded(element)&&!element.matches('input, textarea, button, [role="button"]'))return;
 const records=originalAttributes.get(element)||{};
 for(const name of attributes){if(!element.hasAttribute(name))continue;const current=element.getAttribute(name),next=renderValue(current,records[name]);records[name]=next;if(current!==next.rendered)element.setAttribute(name,next.rendered);}
 originalAttributes.set(element,records);
}
function translateTree(root){
 if(root.nodeType===3){textNode(root);return;}
 if(root.nodeType!==1&&root.nodeType!==9)return;
 if(root.nodeType===1)elementAttrs(root);
 const walk=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
 while(walk.nextNode()){const node=walk.currentNode;node.nodeType===3?textNode(node):elementAttrs(node);}
}
function observe(){observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});}
function applyLanguage(){
 // Flush pending renders first so switching never drops a newly inserted panel.
 observer?.disconnect();
 document.documentElement.lang=locale;
 document.querySelectorAll('[data-language-select]').forEach(select=>select.value=locale);
 translateTree(document.documentElement);
 if(observer)observe();
 document.dispatchEvent(new CustomEvent('echo:language',{detail:{language:locale}}));
}
export function setLanguage(language){
 if(!['zh-CN','en'].includes(language))return;
 locale=language;try{localStorage.setItem(storageKey,locale);}catch{}
 applyLanguage();
}
function install(){
 const control=document.createElement('label');control.className='language-control';
 control.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/></svg><select data-language-select aria-label="界面语言"><option value="zh-CN" translate="no" lang="zh-CN">简体中文</option><option value="en" translate="no" lang="en">English</option></select>';
 const host=document.querySelector('.top-actions')||document.querySelector('header .account')||document.querySelector('section.auth');
 host?.prepend(control);
 control.querySelector('select').addEventListener('change',event=>setLanguage(event.target.value));
 const playerHeading=document.querySelector('.player-title-row');
 if(playerHeading){const playerControl=control.cloneNode(true);playerControl.classList.add('player-language');playerHeading.append(playerControl);playerControl.querySelector('select').addEventListener('change',event=>setLanguage(event.target.value));}
 observer=new MutationObserver(records=>{
  observer.disconnect();
  const roots=new Set();
  for(const record of records){if(record.type==='childList'){for(const node of record.addedNodes)roots.add(node);}else if(record.type==='characterData')roots.add(record.target);else elementAttrs(record.target);}
  for(const root of roots)if(root.isConnected)translateTree(root);
  observe();
 });
 applyLanguage();
 window.addEventListener('storage',event=>{if(event.key===storageKey){locale=resolveLanguage(event.newValue,navigator.language);applyLanguage();}});
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}
