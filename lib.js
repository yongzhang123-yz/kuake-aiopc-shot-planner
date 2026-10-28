/* Small, dependency-free business functions; usable in Node and browsers. */
(function (root) {
  'use strict';
  const finite = (v, label) => { const n = Number(v); if (!Number.isFinite(n)) throw Error(label + '必须是有效数字'); return n; };
  function profit(p) {
    const sale = finite(p.sale, '售价'), rate = finite(p.rate, '汇率');
    const cost = finite(p.cost, '采购成本') + finite(p.shipping, '物流成本') + finite(p.other, '其他成本') + finite(p.ad, '广告成本');
    const fees = (finite(p.fee, '佣金') + finite(p.payment, '支付费率') + finite(p.refund, '退货损耗率')) / 100;
    if (sale < 0 || rate <= 0 || cost < 0 || ['cost','shipping','other','ad','fee','payment','refund'].some(k => Number(p[k]) < 0) || fees >= 1) throw Error('成本和售价不能为负，汇率须大于0，费率合计须小于100%');
    const revenue = sale * rate, feeCost = revenue * fees, net = revenue - feeCost - cost;
    return { revenue, feeCost, cost, net, margin: revenue ? net / revenue * 100 : null, breakEven: cost / ((1 - fees) * rate) };
  }
  function timeMs(s) {
    const m = /^(\d{2,}):(\d{2}):(\d{2})[,.](\d{3})$/.exec(s.trim());
    if (!m || +m[2] > 59 || +m[3] > 59) throw Error('无效字幕时间：' + s);
    return ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + +m[4];
  }
  function stamp(ms) {
    ms = Math.round(ms); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
    return [h,m,s].map(n => String(n).padStart(2,'0')).join(':') + ',' + String(ms % 1000).padStart(3,'0');
  }
  function parseSrt(raw) {
    if (!raw.trim()) throw Error('请先导入或粘贴SRT字幕');
    return raw.replace(/^\uFEFF/,'').replace(/\r/g,'').trim().split(/\n[ \t]*\n/).map((block, i) => {
      const lines = block.split('\n'); if (/^\d+$/.test(lines[0].trim())) lines.shift();
      const match = /^(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/.exec(lines.shift() || '');
      if (!match) throw Error('第' + (i+1) + '条字幕缺少有效时间轴');
      const start = timeMs(match[1]), end = timeMs(match[2]);
      if (end <= start) throw Error('第' + (i+1) + '条字幕结束时间须晚于开始时间');
      const text = lines.join('\n').trim(); if (!text) throw Error('第' + (i+1) + '条字幕内容为空');
      return { start, end, text };
    });
  }
  function checkSrt(cues, limit) {
    const issues = []; let furthest = 0;
    cues.forEach((c,i) => {
      if (i && c.start < furthest) issues.push('第' + (i+1) + '条与前面的字幕时间重叠');
      if (i && c.start < cues[i-1].start) issues.push('第' + (i+1) + '条时间顺序异常');
      if (c.text.split('\n').some(s => [...s].length > limit)) issues.push('第' + (i+1) + '条存在超过' + limit + '字的长行');
      if ([...c.text.replace(/\s/g,'')].length / ((c.end-c.start)/1000) > 12) issues.push('第' + (i+1) + '条阅读速度超过12字/秒，请人工复核');
      furthest = Math.max(furthest,c.end);
    }); return issues;
  }
  function wrapText(s, max) {
    return s.split('\n').flatMap(line => { const chars = [...line], rows = []; while (chars.length) rows.push(chars.splice(0,max).join('')); return rows.length ? rows : ['']; }).join('\n');
  }
  function serializeSrt(cues) { return cues.map((c,i) => `${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}`).join('\n\n') + '\n'; }
  function validateStory(story) {
    if (!story || !Array.isArray(story.nodes) || !story.nodes.length) throw Error('剧情必须包含非空nodes数组');
    if (story.nodes.length > 200) throw Error('首版支持最多200个节点');
    const ids = new Set();
    for (const n of story.nodes) {
      if (typeof n.id !== 'string' || !n.id.trim() || ids.has(n.id)) throw Error('节点ID不能为空或重复');
      if (typeof n.text !== 'string' || !Array.isArray(n.choices)) throw Error('节点需要text文字和choices选项数组');
      ids.add(n.id);
    }
    if (!ids.has(story.start)) throw Error('起始节点不存在');
    for (const n of story.nodes) for (const c of n.choices) if (typeof c.label !== 'string' || !c.label.trim() || !ids.has(c.target)) throw Error('节点' + n.id + '的选项文字为空或目标不存在');
    const reached = new Set(), stack = [story.start];
    while (stack.length) { const id = stack.pop(); if (reached.has(id)) continue; reached.add(id); story.nodes.find(n => n.id === id).choices.forEach(c => stack.push(c.target)); }
    return { unreachable: story.nodes.filter(n => !reached.has(n.id)).map(n => n.id), endings: story.nodes.filter(n => !n.choices.length).length };
  }
  const crcTable = Array.from({length:256},(_,i) => { let c=i; for(let b=0;b<8;b++) c=(c&1)?0xedb88320^(c>>>1):c>>>1; return c>>>0; });
  const crc32 = bytes => { let c=0xffffffff; for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8); return (c^0xffffffff)>>>0; };
  function zip(files) {
    const encoder = new TextEncoder(), local=[], central=[]; let offset=0;
    function header(size) { const bytes=new Uint8Array(size); return {bytes, view:new DataView(bytes.buffer)}; }
    for(const f of files) {
      const name=encoder.encode(f.name), data=f.data, crc=crc32(data), l=header(30+name.length), d=l.view;
      d.setUint32(0,0x04034b50,true); d.setUint16(4,20,true); d.setUint16(6,0x800,true); d.setUint16(12,33,true); d.setUint32(14,crc,true); d.setUint32(18,data.length,true); d.setUint32(22,data.length,true); d.setUint16(26,name.length,true); l.bytes.set(name,30);
      local.push(l.bytes,data);
      const c=header(46+name.length), v=c.view;
      v.setUint32(0,0x02014b50,true); v.setUint16(4,20,true); v.setUint16(6,20,true); v.setUint16(8,0x800,true); v.setUint16(14,33,true); v.setUint32(16,crc,true); v.setUint32(20,data.length,true); v.setUint32(24,data.length,true); v.setUint16(28,name.length,true); v.setUint32(42,offset,true); c.bytes.set(name,46); central.push(c.bytes); offset+=l.bytes.length+data.length;
    }
    const size=central.reduce((n,b)=>n+b.length,0), end=header(22), v=end.view;
    v.setUint32(0,0x06054b50,true); v.setUint16(8,files.length,true); v.setUint16(10,files.length,true); v.setUint32(12,size,true); v.setUint32(16,offset,true);
    return new Blob([...local,...central,end.bytes],{type:'application/zip'});
  }
  function parseQA(raw) {
    return raw.trim().split(/\n\s*\n/).filter(Boolean).map((s,i) => {
      const lines=s.split('\n'), question=(lines.shift()||'').replace(/^(?:Q|问)\s*[:：]\s*/i,'').trim();
      const answer=lines.join('\n').replace(/^(?:A|答)\s*[:：]\s*/i,'').trim();
      if(!question||!answer) throw Error('第'+(i+1)+'组需包含问题和答案，两组之间空一行');
      return {question,answer,tag:/价格|费用|多少钱|price/i.test(question)?'价格':/交期|时间|多久|delivery/i.test(question)?'交付':/售后|修改|退|after/i.test(question)?'售后':'产品与服务'};
    });
  }
  const api = {profit,timeMs,stamp,parseSrt,checkSrt,wrapText,serializeSrt,validateStory,zip,crc32,parseQA};
  if (typeof module !== 'undefined' && module.exports) module.exports=api; else root.OPCLib=api;
})(typeof window !== 'undefined' ? window : globalThis);
