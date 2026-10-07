export function normalizeAnswer(value){return String(value??'').normalize('NFKC').toLowerCase().replace(/[-–—]/g,' ').replace(/[^\p{L}\p{N}\s]/gu,'').replace(/\s+/g,' ').trim();}
export function answerState(value,expected){if(!String(value??'').trim())return 'empty';return normalizeAnswer(value)===normalizeAnswer(expected)?'correct':'incorrect';}
