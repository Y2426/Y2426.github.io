import {icon} from './icons.js';
const $=s=>document.querySelector(s);
export function installPracticeRefinements(){
 document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="/practice-refinements.css">');
 $('#repeat-dialog').classList.add('loop-settings');$('#repeat-dialog .dialog-heading h2').textContent='循环播放';$('#repeat-dialog .repeat-summary').insertAdjacentHTML('afterbegin','<span class="loop-emblem">'+icon('loop')+'</span>');const audioSwitch=$('#repeat-audio');const audioLabel=audioSwitch.closest('label');audioLabel.replaceChildren();audioLabel.innerHTML='<span><strong>第二遍起仅播放音频</strong><small>专注听音，减少画面干扰</small></span>';audioLabel.append(audioSwitch);const hint=$('#repeat-dialog .hint');hint.textContent='循环完成后停在本句。选择 ∞ 可持续循环。';$('#repeat-done').textContent='完成设置';
 function position(d,b){const r=b.getBoundingClientRect();d.style.setProperty('--popover-x',Math.max(10,Math.min(innerWidth-d.offsetWidth-10,r.left+r.width/2-d.offsetWidth/2))+'px');d.style.setProperty('--popover-y',Math.max(10,r.top-d.offsetHeight-18)+'px');}
 function toggle(id,button){const d=$(id),b=$(button);b.setAttribute('aria-haspopup','dialog');b.onclick=()=>{const open=d.open;for(const other of ['#font-dialog','#speed-dialog'])$(other).close();if(!open){d.show();position(d,b);}};}
 toggle('#font-dialog','#size-btn');toggle('#speed-dialog','#speed-picker');
 $('#font-dialog').classList.add('compact-popover');$('#speed-dialog').classList.add('compact-popover');
 $('#font-dialog .dialog-heading h2').textContent='字幕大小';$('#speed-dialog .dialog-heading h2').textContent='播放速度';
 const fontLabel=$('#font-dialog label');fontLabel.firstChild.textContent='字幕 ';fontLabel.childNodes.forEach(n=>{if(n.nodeType===3&&n.textContent.includes('英文略大一级'))n.textContent=' px';});
 $('#font-dialog').insertAdjacentHTML('beforeend','<p class="popover-note">拖动即可实时预览，点击空白处收起</p>');
 $('#speed-dialog .primary').remove();
 $('#speed-dialog').insertAdjacentHTML('beforeend','<p class="popover-note">即时应用到视频和原音</p>');
 const refresh=()=>{for(const [id,b]of [['#font-dialog','#size-btn'],['#speed-dialog','#speed-picker']])if($(id).open)position($(id),$(b));};window.addEventListener('resize',refresh);
 for(const [id,b]of [['#font-dialog','#size-btn'],['#speed-dialog','#speed-picker']]){document.addEventListener('pointerdown',e=>{if($(id).open&&!$(id).contains(e.target)&&!$(b).contains(e.target))$(id).close();});}
}
