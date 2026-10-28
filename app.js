'use strict';
const sample={topic:'让客户看懂一款便携风扇',audience:'通勤与办公人群',seconds:'60',facts:'便携机身，重量180g\n三档风速\nUSB-C充电',conditions:'手机一部，桌面，产品实物，自然光；无演员',action:'查看产品资料，进一步了解规格'};
W.mount({...TOOL,demo:()=>Object.entries(sample).forEach(([k,v])=>W.set(k,v))});
W.add(W.field('topic','视频主题','text'),W.row(W.field('audience','目标观众','text'),W.field('seconds','总时长（15—300秒）','number','60')),W.field('facts','本期只讲这些已核实信息','textarea'),W.field('conditions','现有设备、场地和素材','textarea'),W.field('action','结尾行动建议','text'));
W.onRun(()=>{
 const d=W.data(), duration=+d.seconds;if(!d.topic||!d.audience||!d.facts)throw Error('请填写主题、观众和已核实信息');if(!Number.isInteger(duration)||duration<15||duration>300)throw Error('时长请输入15—300之间的整数');
 const a=Math.max(3,Math.round(duration*.12)),b=Math.round(duration*.3),c=Math.round(duration*.38),e=duration-a-b-c;
 const facts=d.facts.split('\n').filter(Boolean), shots=[{len:a,title:'开场 · 说明问题',screen:'产品或服务对象的近景，配主题字幕',voice:'如果你是'+d.audience+'，这条视频带你了解：'+d.topic+'。'},{len:b,title:'主体一 · 介绍信息',screen:'根据现有条件拍摄产品全貌或工作过程',voice:facts.slice(0,Math.ceil(facts.length/2)).join('。')+'。'},{len:c,title:'主体二 · 细节说明',screen:'对应已核实信息，补拍细节和操作；素材不足处用文字卡',voice:(facts.slice(Math.ceil(facts.length/2)).join('。')||'请结合实际补充一个具体使用步骤')+'。'},{len:e,title:'结尾 · 下一步',screen:'成果定格，展示行动建议',voice:d.action||'有需要可进一步沟通具体需求。'}];
 let pos=0;const lines=shots.map((s,i)=>{const start=pos;pos+=s.len;return `## 镜头${i+1}｜${start}—${pos}秒（${s.len}秒）\n${s.title}\n画面：${s.screen}\n口播：${s.voice}\n字幕：根据口播精简，避免一屏文字过多\n声音：以清晰口播和现场声为主`;});
 const chars=shots.reduce((n,s)=>n+[...s.voice].length,0), speed=(chars/duration).toFixed(1);
 W.setResult(`# ${d.topic}\n模式：本地分镜模板，镜头时长合计${duration}秒\n目标观众：${d.audience}\n现有条件：${d.conditions||'待补充'}\n\n${lines.join('\n\n')}\n\n## 拍摄清单\n- 产品或服务成果全貌\n- 与各项已核实信息对应的细节\n- 操作过程与补充空镜\n- 干净背景、收音和必要照明\n\n## 拍前检查\n- 资料中的参数和说法已确认\n- 现有条件能覆盖镜头，不能覆盖处改用已有素材或文字卡\n- 图片、音乐和出镜者已取得必要使用授权\n\n## 剪辑与交付检查\n- 镜头时长合计${duration}秒，实际以试读及剪辑调整\n- 本草稿口播约${chars}字，平均${speed}字/秒；按实际试读增删\n- 检查画面比例、字幕、音量和结尾行动建议\n- 配乐、交付尺寸及封面待按订单确认`);W.status('已生成4段分镜，时间段连续且总时长一致');
});
W.onAI(async()=>{const d=W.data();if(!d.topic||!d.facts||!Number.isInteger(+d.seconds)||+d.seconds<15||+d.seconds>300)throw Error('请填写主题、事实及15—300秒整数时长');W.setResult(await W.generate(W.aiPrompt('创作适合现有设备和场地的短视频方案：口播、每镜起止时间与时长、画面、字幕、声音、道具、拍摄及剪辑检查表。所有镜头时长相加等于指定总时长。每条只讲一个主题，有一条行动建议。不要求额外演员或虚构素材。注明需要试读校准。',d)));});
