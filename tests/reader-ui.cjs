const path=require('node:path');
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
class Element{
  constructor(id=''){this.id=id;this.hidden=false;this.disabled=false;this.checked=false;this.value='';this.textContent='';this.style={};this.handlers={};this.children=[];this.offsetHeight=220;this.scrollHeight=500;this.scrollTop=0}
  addEventListener(type,fn){this.handlers[type]=fn} append(...items){this.children.push(...items.flatMap(x=>x.fragment?x.children:[x]))}
  querySelectorAll(selector){return selector==='.selection-word'?this.children.filter(x=>x.className==='selection-word'):[]}
  remove(){for(const e of elements.values())e.children=e.children.filter(x=>x!==this)}
  getBoundingClientRect(){return {left:0,top:0,width:600,height:800}}focus(){}setPointerCapture(id){this.capture=id}hasPointerCapture(id){return this.capture===id}releasePointerCapture(){this.capture=null}
}
const elements=new Map();const get=s=>{if(!elements.has(s))elements.set(s,new Element(s));return elements.get(s)};
let calls=[],deferred=false,pending=[],switches=0;
const context={console,AbortController,setTimeout,clearTimeout,setImmediate,innerWidth:1280,innerHeight:900,
 document:{querySelector:get,querySelectorAll:s=>s==='.selection-word'?get('#pdfpage').querySelectorAll(s):[],createElement:()=>new Element(),createDocumentFragment:()=>Object.assign(new Element(),{fragment:true}),addEventListener(){}},
 navigator:{clipboard:{writeText:async()=>{}}},addEventListener(){},getSelection:()=>({removeAllRanges(){}}),
 fetch:async(path,options)=>{calls.push({path,options});if(deferred)return new Promise(resolve=>pending.push({resolve,options}));return {ok:true,json:async()=>({translation:'自动翻译结果'})}}};
context.window=context;vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/selection.js'),'utf8'),context);
let source=fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8');source=source.replace(/library\(\)\.then\(\(\)=>\{if\(papers.length\)return openPaper\(papers\[0\].id\)\}\)\.catch\(e=>toast\(e.message\)\);\s*$/,'');
vm.runInContext(source,context);context.tab=()=>switches++;
vm.runInContext("current={id:'test-paper'};page=4;",context);get('#translationPopup').hidden=true;
const words=[[40,100,90,114,'first',0,0,0],[100,100,150,114,'second',0,0,1],[160,100,210,114,'third',0,0,2],[40,120,90,134,'fourth',0,1,0],[100,120,150,134,'fifth',0,1,1],[160,120,210,134,'sixth',0,1,2]];
context.attachSelection(get('#pdfpage'),{words,width:600},1);
function event(x,y){return {button:0,pointerType:'mouse',pointerId:1,clientX:x,clientY:y,preventDefault(){}}}
function select(x1,x2){const h=get('#pdfpage').handlers;h.pointerdown(event(x1,105));h.pointermove(event(x2,105));h.pointerup(event(x2,105))}
const flush=()=>new Promise(setImmediate);
(async()=>{
 select(45,125);await flush();assert.equal(calls.length,0);assert.equal(get('#selectionTranslate').hidden,false);await get('#selectionTranslate').onclick();await flush();
 assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/translate');assert.equal(JSON.parse(calls[0].options.body).text,'first second');
 assert.equal(get('#translationPopup').hidden,false);assert.equal(get('#popupTranslation').textContent,'自动翻译结果');assert.equal(switches,0);assert.equal(get('#popupPage').textContent,'PDF 第 4 页');
 select(45,125);await get('#selectionTranslate').onclick();await flush();assert.equal(calls.length,1,'same selection uses translation cache');
 deferred=true;select(105,180);get('#selectionTranslate').onclick();await flush();assert.equal(pending.length,1);
 select(165,200);get('#selectionTranslate').onclick();await flush();assert.equal(pending.length,2);assert.equal(pending[0].options.signal.aborted,true);
 pending[1].resolve({ok:true,json:async()=>({translation:'新选区译文'})});await flush();
 pending[0].resolve({ok:true,json:async()=>({translation:'旧选区译文'})});await flush();
 assert.equal(get('#popupTranslation').textContent,'新选区译文','stale request must not overwrite current selection');
 context.closePopup();assert.equal(get('#translationPopup').hidden,true);
 const before=calls.length;select(45,180);await flush();assert.equal(calls.length,before);assert.equal(get('#translationPopup').hidden,true);
const h=get('#pdfpage').handlers;
 h.pointerdown(event(105,105));h.pointermove(event(125,125));h.pointerup(event(125,125));await flush();
 assert.equal(get('#selection').value,'second third\nfourth fifth');assert.equal(calls.length,before,'cross-line drag alone must not call AI');
 console.log('PASS: no AI call until confirm, translation after click, multiline drag, cache, stale-response isolation, no chat/tab switch');
})().catch(e=>{console.error(e);process.exitCode=1});
