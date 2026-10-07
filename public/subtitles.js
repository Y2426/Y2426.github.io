export function timeValue(value) {
  const parts = value.trim().replace(',', '.').split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some(n => !Number.isFinite(n) || n < 0) || parts.at(-1)>=60 || (parts.length===3 && parts[1]>=60)) throw new Error('字幕时间格式不正确');
  return parts.reduce((total,n)=>total*60+n,0);
}
export function validateCues(cues) {
  if (!Array.isArray(cues) || !cues.length) throw new Error('没有找到字幕，请导入 SRT 或 VTT 字幕');
  let lastEnd=0;
  return cues.map((cue,i)=>{
    const start=Number(cue.start), end=Number(cue.end), text=String(cue.text||'').trim();
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||!text) throw new Error(`第 ${i+1} 句内容或起止时间无效`);
    if (start < lastEnd - .015) throw new Error(`第 ${i+1} 句与上一句重叠，请先调整时间轴`);
    lastEnd=end;
    return {start,end,text,translation:String(cue.translation||'').trim()};
  });
}
export function parseSubtitles(raw) {
  const blocks=raw.replace(/^\uFEFF/,'').replace(/\r/g,'').trim().split(/\n\s*\n/);
  const cues=[];
  for(const block of blocks){
    const lines=block.split('\n');
    if (/^(WEBVTT|NOTE|STYLE|REGION)(\s|$)/.test(lines[0])) continue;
    const index=lines.findIndex(line=>line.includes('-->'));
    if(index<0) continue;
    const times=lines[index].match(/(\d{1,3}:\d{2}(?::\d{2})?[.,]\d{1,3})\s*-->\s*(\d{1,3}:\d{2}(?::\d{2})?[.,]\d{1,3})/);
    if(!times) throw new Error(`无法识别时间轴：${lines[index]}`);
    const content=lines.slice(index+1).map(s=>s.replace(/<[^>]*>/g,'').trim()).filter(Boolean);
    const english=content.filter(s=>!/[\u3400-\u9fff]/.test(s));
    const chinese=content.filter(s=>/[\u3400-\u9fff]/.test(s));
    cues.push({start:timeValue(times[1]),end:timeValue(times[2]),text:(english.length?english:content).join(' '),translation:english.length?chinese.join(' '):''});
  }
  return validateCues(cues);
}
export function stamp(seconds,ms=false) {
  const t=Math.max(0,Number(seconds)||0);
  const minutes=Math.floor(t/60), sec=Math.floor(t%60);
  return `${String(minutes).padStart(2,'0')}:${String(sec).padStart(2,'0')}${ms?'.'+String(Math.round(t%1*1000)).padStart(3,'0'):''}`;
}
export function toSrt(cues) {
  const time=s=>{const n=Math.round(s*1000);return `${String(Math.floor(n/3600000)).padStart(2,'0')}:${String(Math.floor(n/60000)%60).padStart(2,'0')}:${String(Math.floor(n/1000)%60).padStart(2,'0')},${String(n%1000).padStart(3,'0')}`;};
  return cues.map((c,i)=>`${i+1}\n${time(c.start)} --> ${time(c.end)}\n${c.text}${c.translation?'\n'+c.translation:''}`).join('\n\n')+'\n';
}
