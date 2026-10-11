// Basic function words are never standalone course highlights. Useful expressions
// such as "put it off" and "as soon as" remain eligible as complete learning units.
const basic = new Set(`a an the and or but nor so yet for to of in on at by from with without into onto over under out off up down as than if then that this these those i me my mine myself you your yours yourself he him his himself she her hers herself it its itself we us our ours ourselves they them their theirs themselves who whom whose which what where when why how am is are was were be been being do does did done doing have has had having can could will would shall should may might must ought not no yes very too also just only even really quite all any some each every both either neither much many more most less least few little such other another same own here there now ago again already still ever never always often sometimes today tomorrow yesterday once twice ok okay yeah yep nope oh ah uh um hmm hi hello bye well please thanks thank thankyou let's i'm you're he's she's it's we're they're i've you've we've they've isn't aren't wasn't weren't don't doesn't didn't won't wouldn't can't couldn't shouldn't mustn't haven't hasn't hadn't`.split(/\s+/));
export function isHighlightTerm(value){
 const key=String(value||'').trim().toLowerCase().replaceAll('’',"'");
 return !!key && !basic.has(key);
}
export function replaceCourseVocabulary(target,vocabulary){
 for(const key of Object.keys(target))delete target[key];
 for(const [key,value] of Object.entries(vocabulary||{})){
  if(isHighlightTerm(key))target[key.toLowerCase()]=value;
 }
 return target;
}
