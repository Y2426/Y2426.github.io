// Longest match wins, so an expression remains one learning unit.
export function vocabularyTokens(text,words){
 const keys=Object.keys(words).filter(Boolean).sort((a,b)=>b.length-a.length);
 if(!keys.length)return [text];
 const pattern=keys.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
 return text.split(new RegExp('((?<![a-zA-Z])(?:'+pattern+')(?![a-zA-Z]))','gi'));
}
export const wordKind=w=>/\s/.test(w)?'expression':'vocabulary';
