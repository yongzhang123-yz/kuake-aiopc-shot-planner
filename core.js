(function () {
  'use strict';
  const $ = s => document.querySelector(s), esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let cfg, currentText = '', aiConfig = {base:'https://api.example.com/v1',model:'',key:''};
  let runFn, aiFn;
  const h = (tag, attrs={}, children=[]) => { const el=document.createElement(tag); for(const [k,v] of Object.entries(attrs)){ if(k==='class')el.className=v; else if(k==='text')el.textContent=v; else if(k.startsWith('on'))el.addEventListener(k.slice(2),v); else el.setAttribute(k,v); } for(const c of [].concat(children))if(c!==null&&c!==undefined)el.append(typeof c==='string'?document.createTextNode(c):c); return el; };
  function status(message, error=false) { $('#status').textContent=message; $('#status').className='status'+(error?' error':''); }
  function field(name,label,type,value='',help='',options=[]) {
    const box=h('div',{class:'field'}), id='f-'+name;
    const input=type==='textarea'?h('textarea',{id,rows:5}):type==='select'?h('select',{id}):h('input',{id,type});
    if(type==='select')for(const o of options)input.append(h('option',{value:typeof o==='string'?o:o.value,text:typeof o==='string'?o:o.label}));
    if(type==='number'){input.step='any';input.min='0';}
    if(type!=='file')input.value=value;
    box.append(h('label',{for:id,text:label}),input);
    if(help){const hint=h('div',{class:'hint',id:id+'-help',text:help});box.append(hint);input.setAttribute('aria-describedby',hint.id);}
    return box;
  }
  function add(...elements) { $('#formFields').append(...elements); }
  function value(name) { const el=$('#f-'+name); return el?el.value.trim():''; }
  function set(name,value) { $('#f-'+name).value=value; }
  function data() { return Object.fromEntries([...$('#formFields').querySelectorAll('[id^="f-"]')].filter(el=>el.matches('input,textarea,select')).map(el=>[el.id.slice(2),el.value.trim()])); }
  function row(...elements) { return h('div',{class:'row'},elements); }
  function markdown(text) {
    return text.split('\n').map(line=> {
      if(line.startsWith('# '))return '<h2>'+esc(line.slice(2))+'</h2>';
      if(line.startsWith('## '))return '<h3>'+esc(line.slice(3))+'</h3>';
      if(line.startsWith('### '))return '<h4>'+esc(line.slice(4))+'</h4>';
      if(line.startsWith('- '))return '<p class="bullet">'+esc(line.slice(2))+'</p>';
      return line.trim()?'<p>'+esc(line)+'</p>':'';
    }).join('');
  }
  function setResult(text, custom=null) {
    currentText=text; $('#edit').textContent='编辑结果'; const body=$('#output');body.replaceChildren();
    if(custom)body.append(custom);else {const doc=h('article',{class:'document'});doc.innerHTML=markdown(text);body.append(doc);}
    $('#export').disabled=false;$('#copy').disabled=false;$('#edit').disabled=false;$('#print').disabled=false;
    $('#resultTag').textContent='已整理 · 可编辑导出';
  }
  function table(head,rows) { return h('div',{class:'table-wrap'},h('table',{},[h('thead',{},h('tr',{},head.map(s=>h('th',{text:s})))),h('tbody',{},rows.map(r=>h('tr',{},r.map(s=>h('td',{text:String(s)})))))])); }
  function download(name,content,type='text/plain;charset=utf-8') {
    const blob=content instanceof Blob?content:new Blob([content],{type}), url=URL.createObjectURL(blob), a=h('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  async function copy(text=currentText) { try { if(!navigator.clipboard)throw Error();await navigator.clipboard.writeText(text);status('已复制到剪贴板'); }catch{status('浏览器未提供剪贴板权限，请点击“编辑结果”后手动复制',true);} }
  function onRun(fn) {runFn=fn;}
  function onAI(fn) {aiFn=fn;}
  async function guarded(fn) {try{await fn();}catch(e){status(e.message||String(e),true);}}
  async function generate(prompt) {
    if(!aiConfig.model||!aiConfig.key){$('#aiDialog').showModal();throw Error('请先填写模型服务地址、模型名称和API密钥');}
    if(!/^https?:$/.test(location.protocol))throw Error('AI功能需使用本地服务：运行 python3 server.py，再打开终端提示的网址');
    const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...aiConfig,prompt}),signal:AbortSignal.timeout(100000)});
    const result=await response.json().catch(()=>({error:'请使用随项目提供的server.py启动AI代理，静态托管仅支持离线功能'}));
    if(!response.ok||result.error)throw Error(result.error||'模型请求失败');
    if(typeof result.text!=='string'||!result.text.trim())throw Error('模型未返回文字结果');
    return result.text;
  }
  function aiPrompt(task, input) { return '你是面向中国独立创业者的工作助手。只根据用户资料生成可编辑草稿，不编造证书、性能、价格、客户、优惠、承诺或事实。缺失信息请写待确认。输出纯文字或Markdown，不输出HTML。\n任务：'+task+'\n输入资料：\n'+JSON.stringify(input,null,2); }
  function mount(options) {
    cfg=options;document.title=cfg.title+' · OPC Toolkit';
    document.body.innerHTML=`<div class="app"><aside class="sidebar"><a class="brand" href="./index.html"><span class="brand-mark">o.</span><span>独立工作室<small>OPC TOOLKIT</small></span></a><div class="side-group"><div class="side-kicker">YOUR WORKSPACE</div><div class="side-active">${esc(cfg.icon)} &nbsp; ${esc(cfg.short)}</div></div><div class="side-note"><strong>小工具，做好一件事。</strong>为独立创业者的日常工作<br>留出更多时间。</div><div class="side-bottom">OPEN SOURCE / MIT<br>中文界面 · 本地优先<br>v1.0 · 2026</div></aside><main class="main"><div class="topline"><span class="crumb">OPC 实用工具 / ${esc(cfg.category)}</span><div class="top-actions"><span class="pill"><i class="dot"></i>本地运行</span>${cfg.ai?'<button id="settings" class="small quiet">模型设置</button>':''}<a class="small" href="./README.md" target="_blank">使用说明 ↗</a></div></div><header class="page-head"><div><div class="eyebrow">${esc(cfg.eyebrow)}</div><h1>${esc(cfg.title)}</h1><p class="lead">${esc(cfg.desc)}</p></div><span class="head-number">${esc(cfg.number)}</span></header><div class="workspace"><section class="panel"><div class="panel-title"><h2>01 &nbsp; ${esc(cfg.inputTitle||'填写工作资料')}</h2><button class="small" id="demo">载入示例</button></div><div class="form-body"><div id="formFields"></div><div class="form-actions"><button class="primary" id="run">${esc(cfg.runLabel||'整理草稿')}</button>${cfg.ai?'<button id="aiRun">✧ AI 辅助生成</button>':''}</div><div id="status" class="status" role="status" aria-live="polite"></div></div><div class="mode-note">${esc(cfg.note||'资料只在当前页面处理，关闭页面前请下载需要保留的结果。')}</div></section><section class="panel"><div class="panel-title"><h2>02 &nbsp; ${esc(cfg.outputTitle||'工作成果')}</h2><span id="resultTag">等待输入</span></div><div class="panel-title"><span>预览与导出</span><div class="output-actions"><button id="edit" class="small" disabled>编辑结果</button><button id="copy" class="small" disabled>复制</button><button id="print" class="small" disabled>打印</button><button id="export" class="small" disabled>导出文档</button></div></div><div class="output-body" id="output"><div class="empty-state"><div class="empty-symbol">${esc(cfg.icon)}</div><strong>${esc(cfg.empty||'把零散资料，变成可交付的成果')}</strong><span>先载入示例，体验一次完整流程。</span></div></div></section></div><footer class="footer"><span>OPC Toolkit · 每个工具都可以独立运行</span><span>本地处理 / 无账号 / MIT 开源</span></footer></main></div>`;
    if(cfg.ai){
      const dialog=h('dialog',{id:'aiDialog'});dialog.innerHTML='<div class="dialog-top"><h2>连接你的AI模型</h2><button id="closeAI" aria-label="关闭模型设置">×</button></div><p class="hint">支持兼容Chat Completions的服务。先运行本地server.py；静态页面仍可使用离线功能。调用费用以服务商为准。</p><div class="dialog-form" id="aiFields"></div><div class="warning">点击AI生成时，表单资料会发送至你填写的服务商。密钥仅保存在本页内存，不写入文件或浏览器存储。</div><button class="primary" id="saveAI">保存本次设置</button>';document.body.append(dialog);
      const base=field('aiBase','服务地址（包含 /v1）','url',aiConfig.base), model=field('aiModel','模型名称','text','', '按服务商文档填写'), key=field('aiKey','API密钥','password','');$('#aiFields').append(base,model,key);
      $('#settings').onclick=()=>dialog.showModal();$('#closeAI').onclick=()=>dialog.close();$('#saveAI').onclick=()=>guarded(()=>{const base=$('#f-aiBase').value.trim(),model=$('#f-aiModel').value.trim(),key=$('#f-aiKey').value.trim();if(!/^https?:\/\//.test(base)||!model||!key)throw Error('请填写有效网址、模型名称及密钥');aiConfig={base,model,key};dialog.close();status('设置已保存在当前页面内存');});
      $('#aiRun').onclick=()=>guarded(async()=>{const btn=$('#aiRun');btn.disabled=true;status('正在请求你配置的模型…');try{if(aiFn)await aiFn();else setResult(await generate(aiPrompt(cfg.aiTask,data())));status('AI草稿已生成，请核对事实与承诺后使用');$('#resultTag').textContent='AI生成 · 待人工核对';}finally{btn.disabled=false;}});
    }
    $('#run').onclick=()=>guarded(async()=>{const b=$('#run');b.disabled=true;try{await runFn();}finally{b.disabled=false;}});
    $('#demo').onclick=()=>guarded(async()=>{await cfg.demo();status('示例已载入。点击左侧主按钮生成结果。');});
    $('#export').onclick=()=>download(cfg.slug+'-result.md',currentText,'text/markdown;charset=utf-8');$('#copy').onclick=()=>copy();$('#print').onclick=()=>{const previous=$('#printCopy');if(previous)previous.remove();const printable=h('article',{id:'printCopy',class:'document'});printable.style.display='none';printable.innerHTML=markdown(currentText);document.body.append(printable);window.print();};
    $('#edit').onclick=()=>{const editor=$('#resultEditor');if(editor){setResult(editor.value);$('#edit').textContent='编辑结果';return;}$('#output').replaceChildren(h('textarea',{id:'resultEditor',class:'editable-output','aria-label':'编辑生成的文档'}));$('#resultEditor').value=currentText;$('#resultEditor').addEventListener('input',()=>currentText=$('#resultEditor').value);$('#edit').textContent='完成编辑';};
  }
  window.W={mount,field,add,row,value,set,data,setResult,status,download,copy,generate,aiPrompt,onRun,onAI,h,table,$,esc,guarded,getText:()=>currentText};
})();
