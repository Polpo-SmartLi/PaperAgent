const $=s=>document.querySelector(s);
let papers=[],current=null,page=1,selectionPage=1,renderSeq=0,translationSeq=0,notes=[];
let selectedWords=[],selectedText='',translationRequest=null,translationResult=null;
const translationCache=new Map();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(s){$('#toast').textContent=s;$('#toast').style.display='block';clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').style.display='none',6500)}
async function api(path,data,signal){const r=await fetch(path,data===undefined?{signal}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal});const b=await r.json();if(!r.ok)throw Error(b.error||'请求失败');return b}
async function busy(button,fn){button.disabled=true;try{await fn()}catch(e){toast(e.message)}finally{button.disabled=false}}
function requirePaper(){if(!current)throw Error('请先导入或打开论文')}
function tab(name){document.querySelectorAll('.panel').forEach(x=>x.hidden=x.id!==name);document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));if(name==='general'&&!assistantBusy)loadAssistant().catch(e=>toast(e.message))}
document.querySelectorAll('nav button').forEach(x=>x.onclick=()=>tab(x.dataset.tab));
async function library(){papers=await api('/api/library');$('#count').textContent=papers.length;$('#papers').innerHTML=papers.map(p=>`<button class="paperitem ${p.id===current?.id?'active':''}" data-id="${p.id}">▤ ${esc(p.title)}<small>${p.pages} 页 · 本地 PDF</small></button>`).join('');document.querySelectorAll('.paperitem').forEach(x=>x.onclick=()=>openPaper(x.dataset.id).catch(e=>toast(e.message)))}
async function openPaper(id){
  current=papers.find(p=>p.id===id);page=1;clearSelection();
  $('#answers').innerHTML='<p class="muted">正在恢复对话记录…</p>';
  $('#selection').value='';$('#translation').textContent='译文将在这里显示。';
  $('#title').textContent=current.title;$('#total').textContent='/ '+current.pages;$('#page').max=current.pages;
  await library();if(current.id!==id)return;
  await Promise.all([render(),loadNotes(),loadChat(id)]);
}
function closePopup(){translationSeq++;translationRequest?.abort();translationRequest=null;$('#translationPopup').hidden=true;$('#translationReopen').hidden=!translationResult}
function clearSelection(){selectedWords=[];selectedText='';translationResult=null;$('#selectionTranslate').hidden=true;$('#selectionHint').textContent='划选后点击翻译';document.querySelectorAll('.selection-word').forEach(x=>x.remove());closePopup()}
async function render(){
  requirePaper();clearSelection();const seq=++renderSeq,pid=current.id,n=page;
  $('#page').value=page;$('#viewport').innerHTML='<p class="muted">正在渲染页面…</p>';
  try{
    const d=await api(`/api/page/${pid}/${n}/text`);if(seq!==renderSeq)return;
    const scale=Number($('#zoom').value),width=d.width*scale,height=d.height*scale;
    $('#viewport').innerHTML=`<div id="pdfpage" tabindex="0" aria-label="PDF 第 ${n} 页，在正文拖动鼠标划选文字，按 Ctrl+C 复制" style="width:${width}px;height:${height}px"><img draggable="false" alt="PDF 第 ${n} 页" src="/api/page/${pid}/${n}/image"></div>`;
    attachSelection($('#pdfpage'),d,scale);
    $('#pagehint').textContent=d.words.length?'PDF 第 '+n+' 页 · 按词划选，跨行保持当前栏':'本页没有文字层，需要 OCR 后才能划选和检索';
    $('#viewport').scrollTop=0;
  }catch(e){if(seq===renderSeq)$('#viewport').textContent=e.message}
}
function attachSelection(container,data,scale){
  const layout=PaperSelection.layout(data.words,data.width);let drag=null;
  const point=e=>{const r=container.getBoundingClientRect();return {x:(e.clientX-r.left)/scale,y:(e.clientY-r.top)/scale}};
  function paint(words){selectedWords=words;selectedText=PaperSelection.text(words);container.querySelectorAll('.selection-word').forEach(x=>x.remove());const fragment=document.createDocumentFragment();for(const w of words){const b=w.box,mark=document.createElement('span');mark.className='selection-word';mark.style.cssText=`left:${b[0]*scale}px;top:${b[1]*scale}px;width:${(b[2]-b[0])*scale}px;height:${(b[3]-b[1])*scale}px;`;fragment.append(mark)}container.append(fragment)}
  function finish(e){
    const state=drag;if(!state)return;if(state.moved){const p=point(e);paint(PaperSelection.extend(state.selection,p.x,p.y))}drag=null;if(container.hasPointerCapture(e.pointerId))container.releasePointerCapture(e.pointerId);
    if(!state.moved||!selectedText.trim())return;
    selectionPage=page;$('#selection').value=selectedText;
    prepareSelection();
  }
  container.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.pointerType==='touch')return;
    const p=point(e),selection=PaperSelection.begin(layout,p.x,p.y);
    clearSelection();window.getSelection()?.removeAllRanges();if(!selection)return;
    e.preventDefault();container.focus({preventScroll:true});container.setPointerCapture(e.pointerId);
    drag={selection,startX:e.clientX,startY:e.clientY,moved:false};
  });
  container.addEventListener('pointermove',e=>{
    if(!drag)return;e.preventDefault();if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<3&&!drag.moved)return;
    drag.moved=true;const p=point(e);paint(PaperSelection.extend(drag.selection,p.x,p.y));
  });
  container.addEventListener('pointerup',finish);
  container.addEventListener('pointercancel',()=>{drag=null;clearSelection()});
  container.addEventListener('lostpointercapture',()=>{drag=null});
  container.addEventListener('dblclick',e=>{
    e.preventDefault();const p=point(e),s=PaperSelection.begin(layout,p.x,p.y);if(!s)return;
    paint(PaperSelection.extend(s,p.x,p.y));selectionPage=page;$('#selection').value=selectedText;prepareSelection();
  });
  container.addEventListener('dragstart',e=>e.preventDefault());
  container.addEventListener('copy',e=>{if(selectedText&&e.clipboardData){e.preventDefault();e.clipboardData.setData('text/plain',selectedText)}});
}
function prepareSelection(){
  $('#selectionTranslate').hidden=false;$('#selectionTranslate').disabled=false;
  $('#selectionHint').textContent=`已选 ${selectedText.length} 字符 · 点击按钮后翻译`;
}
$('#selectionTranslate').onclick=()=>translate(true);
function setTranslation(text,success){
  $('#translation').textContent=text;$('#popupTranslation').textContent=text;
  $('#popupCopy').disabled=!success;$('#popupSave').disabled=!success;
}
async function translate(showPopup=false){
  const source=$('#selection').value.trim();if(!source){toast('请先划选或粘贴原文');return}
  if(!current){toast('请先打开论文');return}
  translationRequest?.abort();const seq=++translationSeq,pid=current.id,n=selectionPage;
  const controller=new AbortController();translationRequest=controller;translationResult=null;$('#selectionTranslate').disabled=true;
  if(showPopup){$('#translationPopup').hidden=false;$('#translationReopen').hidden=true;$('#popupSource').textContent=source;$('#popupPage').textContent='PDF 第 '+n+' 页'}
  setTranslation('正在翻译…',false);
  const cacheKey=pid+':'+n+':'+source;
  try{
    const d=translationCache.get(cacheKey)||await api('/api/translate',{text:source},controller.signal);
    if(seq!==translationSeq||pid!==current?.id)return;
    if(typeof d.translation!=='string'||!d.translation.trim())throw Error('模型返回空译文，请重试');
    translationCache.set(cacheKey,d);if(translationCache.size>50)translationCache.delete(translationCache.keys().next().value);
    translationResult={paper:pid,page:n,quote:source,body:d.translation};setTranslation(d.translation,true);
  }catch(e){if(e.name!=='AbortError'&&seq===translationSeq)setTranslation(e.message,false)}
  finally{if(seq===translationSeq){translationRequest=null;$('#selectionTranslate').disabled=false}}
}
$('#translateBtn').onclick=()=>{selectionPage=page;translate(false)};
$('#popupClose').onclick=closePopup;$('#popupRetry').onclick=()=>translate(true);
$('#popupCopy').onclick=()=>busy($('#popupCopy'),async()=>{if(translationResult){await navigator.clipboard.writeText(translationResult.body);toast('译文已复制')}});
$('#translationReopen').onclick=()=>{$('#translationPopup').hidden=false;$('#translationReopen').hidden=true};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePopup()});
async function saveTranslation(){
  requirePaper();if(!translationResult||translationResult.paper!==current.id)throw Error('请等待翻译成功后再保存');
  await api('/api/notes',translationResult);await loadNotes();toast('原文和译文已保存');
}
$('#popupSave').onclick=()=>busy($('#popupSave'),saveTranslation);
$('#saveSelection').onclick=()=>busy($('#saveSelection'),async()=>{await saveTranslation();tab('notes')});
async function goto(n){try{requirePaper();page=Math.max(1,Math.min(current.pages,Number(n)||1));await render()}catch(e){toast(e.message)}}
$('#prev').onclick=()=>goto(page-1);$('#next').onclick=()=>goto(page+1);$('#page').onchange=e=>goto(e.target.value);$('#zoom').onchange=()=>goto(page);
$('#upload').onchange=async e=>{const file=e.target.files[0];if(!file)return;toast('正在导入 PDF 并建立页码索引…');try{const r=await fetch('/api/upload?name='+encodeURIComponent(file.name),{method:'POST',headers:{'Content-Type':'application/pdf'},body:file});const b=await r.json();if(!r.ok)throw Error(b.error);await library();await openPaper(b.id);toast('论文已保存到本地论文库')}catch(e){toast(e.message)}finally{$('#upload').value=''}};
function appendTurn(turn,pending=false,target='#answers'){
  const box=document.createElement('article');box.className='chat-turn';
  box.innerHTML=`<div class="message user-message"><span class="message-label">你</span><div>${esc(turn.question)}</div></div><div class="message assistant-message"><span class="message-label">PaperAgent${pending?' · 正在回答':''}</span><div class="answer-text">${esc(turn.answer)}</div></div>`;
  const response=box.querySelector('.assistant-message');
  if(turn.evidence?.length){
    const references=document.createElement('details');references.className='turn-evidence';
    references.innerHTML=`<summary>本轮原文依据 · ${turn.evidence.length} 段</summary><p class="muted">编号仅对应本轮回答。点击页码返回 PDF 核对。</p>`;
    turn.evidence.forEach((ev,i)=>{const detail=document.createElement('details');detail.innerHTML=`<summary>[E${i+1}] PDF 第 ${ev.page} 页</summary><div class="evidence-text">${esc(ev.text)}</div>`;const b=document.createElement('button');b.className='evidence';b.textContent='↗ 返回第 '+ev.page+' 页核对';b.onclick=()=>goto(ev.page);detail.append(b);references.append(detail)});
    response.append(references);
  }
  $(target).append(box);return box;
}
function scrollChat(){$('#answers').scrollTop=$('#answers').scrollHeight}
async function loadChat(pid){
  const turns=await api('/api/chat?paper='+encodeURIComponent(pid));if(current?.id!==pid)return;
  $('#answers').innerHTML='';turns.forEach(t=>appendTurn(t));
  if(!turns.length)$('#answers').innerHTML='<div class="chat-empty">从一个问题开始。<br>后续可以直接追问，历史记录会自动保存。</div>';
  $('#chatstatus').textContent=turns.length?`已保存 ${turns.length} 轮对话 · 支持连续追问`:'对话按论文自动保存，可连续追问。';scrollChat();
}
$('#askform').onsubmit=e=>{
  e.preventDefault();busy($('#askform button'),async()=>{
    requirePaper();const q=$('#question').value.trim(),pid=current.id;if(!q)return;
    $('#answers .chat-empty')?.remove();const box=appendTurn({question:q,answer:'正在结合对话历史检索原文…'},true);$('#question').value='';scrollChat();
    try{await api('/api/ask',{paper:pid,question:q});if(pid===current?.id)await loadChat(pid)}
    catch(e){if(pid===current?.id){box.querySelector('.answer-text').textContent=e.message;box.querySelector('.assistant-message .message-label').textContent='本次请求失败';if(!$('#question').value)$('#question').value=q}throw e}
  });
};
document.querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>{if($('#askform button').disabled)return;$('#question').value=b.dataset.question;$('#askform').requestSubmit()});
$('#question').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!$('#askform button').disabled){e.preventDefault();$('#askform').requestSubmit()}});
$('#searchform').onsubmit=e=>{
  e.preventDefault();if($('#searchform button').disabled)return;
  busy($('#searchform button'),async()=>{
    $('#results').textContent='正在联合搜索论文标题…';
    try{
      const data=await api('/api/search?detailed=1&q='+encodeURIComponent($('#searchterm').value));
      const notices=(data.warnings||[]).map(w=>`<p class="muted">部分搜索源不可用：${esc(w)}。以下为其他来源结果。</p>`).join('');
      const results=data.results||[];
      $('#results').innerHTML=notices+(results.length?results.map(x=>`<article class="searchresult">${x.exact_match?'<span class="search-match">精确匹配</span>':''}<a target="_blank" rel="noopener noreferrer" href="${esc(x.url)}">${esc(x.title)} ↗</a><small>${esc(x.year)} · ${esc(x.authors)}<br>${esc(x.venue)} · ${esc(x.source)}</small>${x.pdf_url?`<a class="pdf-link" target="_blank" rel="noopener noreferrer" href="${esc(x.pdf_url)}">打开 PDF ↗</a>`:''}</article>`).join(''):'<p class="muted">没有找到匹配记录。可尝试缩短标题、输入 DOI 或 arXiv 编号。</p>');
    }catch(error){$('#results').textContent=error.message}
  });
};
$('#searchRelated').onclick=()=>{try{requirePaper();$('#searchterm').value=current.title.replace(/\.pdf$/i,'');$('#searchform').requestSubmit()}catch(e){toast(e.message)}};
async function loadNotes(){if(!current)return;const pid=current.id,data=await api('/api/notes?paper='+pid);if(current.id!==pid)return;notes=data;$('#noteList').innerHTML=notes.length?notes.map(n=>`<article class="note"><button data-goto="${n.page}">PDF 第 ${n.page} 页 ↗</button><button data-delete="${n.id}">删除</button>${n.quote?'<blockquote>'+esc(n.quote)+'</blockquote>':''}<div>${esc(n.body)}</div><small>${esc(n.created)}</small></article>`).join(''):'<p class="muted">这篇论文还没有笔记。</p>';document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>goto(b.dataset.goto));document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>busy(b,async()=>{await api('/api/notes/delete',{id:b.dataset.delete});await loadNotes()}))}
$('#saveNote').onclick=()=>busy($('#saveNote'),async()=>{requirePaper();await api('/api/notes',{paper:current.id,page,body:$('#noteBody').value,quote:''});$('#noteBody').value='';await loadNotes();toast('笔记已保存')});
$('#exportNotes').onclick=()=>busy($('#exportNotes'),async()=>{requirePaper();const r=await api('/api/export',{paper:current.id});toast('笔记已导出到 '+r.path)});
$('#settingsOpen').onclick=()=>busy($('#settingsOpen'),async()=>{const s=await api('/api/settings');$('#baseUrl').value=s.base_url;$('#model').value=s.model;$('#apiKey').value='';$('#apiKey').placeholder=s.has_key?'已保存 Key，留空则保留':'本地服务可填写 local';$('#clearKey').checked=false;$('#settings').showModal()});$('#settingsClose').onclick=()=>$('#settings').close();
$('#settingsform').onsubmit=e=>{e.preventDefault();busy($('#settingsform .primary'),async()=>{await api('/api/settings',{base_url:$('#baseUrl').value,model:$('#model').value,api_key:$('#apiKey').value,clear_key:$('#clearKey').checked});$('#settings').close();toast('配置已保存到本机')})};


let assistantBusy=false;
async function loadAssistant(){
  const turns=await api('/api/assistant');
  if(assistantBusy)return;
  $('#generalAnswers').innerHTML='';turns.forEach(t=>appendTurn(t,false,'#generalAnswers'));
  if(!turns.length)$('#generalAnswers').innerHTML='<div class="chat-empty">在下方输入你的问题。<br>需要论文原文依据时，请使用“问论文”。</div>';
  $('#generalStatus').textContent=turns.length?`已保存 ${turns.length} 轮对话 · 支持连续追问`:'使用已配置的 AI · 无需打开论文';
  $('#generalAnswers').scrollTop=$('#generalAnswers').scrollHeight;
}
$('#generalform').onsubmit=e=>{
  e.preventDefault();if(assistantBusy)return;
  busy($('#generalform button'),async()=>{
    const question=$('#generalQuestion').value.trim();if(!question)return;
    assistantBusy=true;$('#generalAnswers .chat-empty')?.remove();
    const box=appendTurn({question,answer:'正在思考…'},true,'#generalAnswers');
    $('#generalQuestion').value='';$('#generalAnswers').scrollTop=$('#generalAnswers').scrollHeight;
    try{await api('/api/assistant',{question});assistantBusy=false;await loadAssistant()}
    catch(e){box.querySelector('.answer-text').textContent=e.message;box.querySelector('.assistant-message .message-label').textContent='本次请求失败';if(!$('#generalQuestion').value)$('#generalQuestion').value=question;throw e}
    finally{assistantBusy=false}
  });
};
$('#generalQuestion').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!assistantBusy){e.preventDefault();$('#generalform').requestSubmit()}});
library().then(()=>{if(papers.length)return openPaper(papers[0].id)}).catch(e=>toast(e.message));
