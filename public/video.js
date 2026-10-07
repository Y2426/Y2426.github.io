const $=s=>document.querySelector(s);
export function installVideo(ctx){
 const media=$('#media'),stage=$('#media-stage');let captionOn=false,lastId='';
 stage.insertAdjacentHTML('beforeend','<div id="video-captions" hidden><span id="video-caption-en"></span><span id="video-caption-zh"></span></div><div id="video-actions" hidden><button id="video-overlay-play" aria-label="播放或暂停视频">▶</button><button id="video-cc" aria-label="视频内字幕" aria-pressed="false">CC</button><button id="video-fullscreen" aria-label="视频全屏">⛶</button></div>');
 $('#lesson-description').insertAdjacentHTML('afterend','<p id="video-credit" hidden><a target="_blank" rel="noopener noreferrer"></a><span> · 历史影像原始画质</span></p>');
 function captions(){const {course,index,mode,blind,translate}=ctx.get();if(!course)return;const video=course.kind==='video'||course.blob?.type?.startsWith('video/');const cue=course.cues[index];const show=video&&captionOn&&!blind&&mode!=='dictation'&&$('#cloze-mode').getAttribute('aria-pressed')!=='true';$('#video-captions').hidden=!show;$('#video-caption-en').textContent=show?cue.text:'';$('#video-caption-zh').textContent=show&&translate?cue.translation:'';$('#video-actions').hidden=!video;$('#video-credit').hidden=!course.source; if(course.source){const a=$('#video-credit a');a.textContent='影像来源：'+course.source.name;a.href=/^https:\/\//.test(course.source.url)?course.source.url:'#';}if(lastId!==course.id){lastId=course.id;$('#video-overlay-play').textContent='▶';}}
 document.addEventListener('echo:sentence',captions);$('#video-cc').onclick=()=>{captionOn=!captionOn;$('#video-cc').setAttribute('aria-pressed',captionOn);captions();};$('#video-overlay-play').onclick=()=>$('#play-btn').click();media.addEventListener('play',()=>$('#video-overlay-play').textContent='Ⅱ');media.addEventListener('pause',()=>$('#video-overlay-play').textContent='▶');
 $('#video-fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen();}catch{ctx.toast('当前浏览器无法进入全屏');}};
 $('#cloze-mode').addEventListener('click',()=>queueMicrotask(captions));
 $('.hero small').textContent='真实演讲视频 · 27 秒 · 8 个跟读片段';
 $('#start-demo').innerHTML='体验视频跟读 <span>↗</span>';
 $('.hero .pill').textContent='VIDEO SHADOWING / REAL VOICES';
}
