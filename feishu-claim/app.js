const receipts = [
  {id:'2c3e6e7e-7a3c-41d7-8c12-0a91c8e11a01',time:'2026-10-20 11:24:00',channel:'Airwallex',currency:'USD',amount:320,payer:'SHENZHEN STARLINK E-COMMERCE CO LTD',merchant:'星辰出海-广告主账户',merchantId:'14229',biz:'广告',owner:'林晓',confidence:98,reason:'付款账号 GB29NWBK60161331926819：历史 100 次中 98 次认领至星辰出海-广告主账户',status:'待认领',stop:false},
  {id:'c80d11e2-12ab-4f20-a111-55e0cc900031',time:'2026-10-20 10:45:10',channel:'Airwallex',currency:'EUR',amount:860.5,payer:'EURO BUYER GMBH',merchant:'北辰广告-欧洲账户',merchantId:'15301',biz:'广告',owner:'林晓',confidence:72,reason:'付款人名称及收款账户历史记录关联至北辰广告-欧洲账户',status:'待认领',stop:false}
];
// 演示客户；生产从 Fund 读取有权限且具备对应子业务账户的客户。
const customers = [
  {id:'14229',name:'星辰出海-广告主账户',lines:['广告']},
  {id:'15301',name:'北辰广告-欧洲账户',lines:['广告']},
  {id:'17701',name:'迅达供应链-履约账户',lines:['履约']},
  {id:'18801',name:'海川-拒付账户（演示）',lines:['拒付']}
];
let scene='messages', config={enabled:true,count:3,first:'09:00',interval:180};
let activeReceipt=null, attachments=[], pendingClaim=null, toastTimer;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
function toast(text) { $('#toast').textContent=text; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000); }
function render() {
  document.querySelectorAll('[data-scene]').forEach(b=>b.classList.toggle('active',b.dataset.scene===scene));
  $('#app').innerHTML=scene==='messages'?messages():settingsPage();
  if(scene==='settings') preview();
}
function messages() {
  return `<div class="feishu-shell">
  <aside class="app-rail" aria-label="飞书场景装饰"><div class="feishu-mark">✦</div><div class="rail-avatar">林</div><div class="rail-selected">▣<small>消息</small></div><div>▦<small>日历</small></div><div>▤<small>云文档</small></div><div>▧<small>工作台</small></div></aside>
  <section class="conversation-list"><div class="search">⌕　搜索</div><div class="list-heading">消息 <span>＋</span></div><div class="chat-selected"><div class="bot-avatar">F</div><div><b>Fund 资金助手</b><p>收款流水待认领推荐</p></div></div><div class="chat-explain">来自资金中台的应用通知<br>每张卡片对应一笔收款流水</div></section>
  <section class="chat"><header class="chat-head"><div class="bot-avatar">F</div><div><h1>Fund 资金助手 <span class="app-tag">应用</span></h1><p>资金中台通知 · 飞书消息</p></div><span class="chat-menu">⌕　⋯</span></header><div class="chat-scroll"><div class="date-line">今天　09:00</div>${receipts.map(card).join('')}<div class="chat-end">以上为演示消息 · 认领及充值由 Fund 后台执行</div></div></section></div>`;
}
function card(r) {
  const inactive=r.status!=='待认领'||r.returned;
  const state=r.status==='已认领'?'已认领':r.returned?'已退回':r.stop?'已停止提醒':'待认领';
  return `<article class="message"><div class="bot-avatar">F</div><div class="message-content"><div class="sender">Fund 资金助手 <span>应用</span></div>
  <div class="message-card"><div class="card-head"><span>收款流水待认领推荐</span><span class="tag ${inactive?'done':''}">${state}</span></div><div class="card-body">
  <dl class="card-fields"><dt>接收人</dt><dd>${r.owner}</dd><dt>渠道</dt><dd>${r.channel}</dd><dt>交易号</dt><dd class="transaction">${r.id}</dd><dt>金额</dt><dd class="amount">${r.currency} ${money(r.amount)}</dd><dt>付款人</dt><dd>${r.payer}</dd><dt>推荐商户</dt><dd>${r.merchant}（${r.merchantId}）</dd><dt>推荐业务线</dt><dd>${r.biz}</dd><dt>可信度</dt><dd>${r.confidence}%</dd><dt>简要原因</dt><dd>${r.reason}</dd></dl>
  ${r.status==='已认领'?`<div class="result success"><b>认领成功</b><br>客户：${esc(r.claimedCustomer.name)}（${r.claimedCustomer.id}）<br>子业务：${r.claimedBiz} · 金额：${r.currency} ${money(r.amount)}<br>Fund 已完成充值，后续不再提醒。</div>`:r.returned?`<div class="result">已退回，Fund 流水保持待认领，停止该笔提醒。<br>退回原因：${esc(r.returnReason||'未填写')}</div>`:r.stop?'<div class="result">已停止该笔后续提醒，仍可确定认领或退回。</div>':''}
  <p class="card-note">系统推荐仅供参考，请核对子业务、客户与金额后认领。</p>
  <div class="card-actions"><button class="primary" data-action="claim" data-id="${r.id}" ${inactive?'disabled':''}>确定认领</button><button data-action="return" data-id="${r.id}" ${inactive?'disabled':''}>退回</button>${!r.stop&&!inactive?`<button class="text-button" data-action="mute" data-id="${r.id}">不再提醒</button>`:''}</div>
  </div></div></div></article>`;
}
function openModal(title,content,footer) {
  $('#modal').innerHTML=`<div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close" aria-label="关闭认领弹窗">×</button></div>${content}<div class="modal-foot">${footer}</div>`;
  $('#modal').showModal();
}
function beginClaim(r) {
  if(r.status!=='待认领'||r.returned) return toast('该流水已处理，请查看最新卡片。');
  activeReceipt=r; attachments=[]; pendingClaim=null;
  openModal('一键认领',`<form id="claim-form"><div class="modal-body">
    <div class="transaction-box"><div><span>交易 ID</span><b>${r.id}</b></div><div><span>交易时间（UTC+8）</span><b>${r.time}</b></div><div><span>支付渠道</span><b>${r.channel}</b></div><div><span>金额</span><b>${r.currency} ${money(r.amount)}</b></div></div>
    <div class="form-grid"><fieldset><legend><em>*</em> 子业务</legend><div class="radios">${['广告','履约','拒付'].map(b=>`<label><input type="radio" name="biz" value="${b}" ${r.biz===b?'checked':''} required> ${b}</label>`).join('')}</div></fieldset>
    <div><label class="field-label" for="customer"><em>*</em> 客户</label><select id="customer" name="customer" required><option value="">请选择客户</option>${customers.map(c=>`<option value="${c.id}" ${r.merchantId===c.id?'selected':''}>${c.name}（${c.id}）</option>`).join('')}</select></div></div>
    <p class="form-hint">已按推荐预填，可修改。修改子业务后，请核对客户是否匹配。</p>
    <label class="field-label" for="voucher"><em>*</em> 上传文件（支持图片/pdf格式文件，最多10个，单个文件20M内）</label>
    <div class="upload-zone" id="drop-zone" tabindex="0" role="button" aria-label="上传文件区域，支持点击、拖拽或粘贴"><span class="upload-symbol">↥</span><p>点击或拖拽或粘贴文件到此区域上传</p><small>支持图片/pdf格式文件</small><input class="file-input" id="voucher" type="file" accept="image/*,.pdf" multiple aria-label="上传文件"></div>
    <div id="file-list"></div><div id="claim-error" class="error" role="alert"></div>
    <p class="prototype-hint">演示：附件仅在本地选择，不上传；此步骤不会入账。</p>
    </div></form>`, '<button data-action="close">取消</button><button class="primary" type="submit" form="claim-form">确认</button>');
}
function fileError(files) {
  if(files.length>10) return '最多上传 10 个文件，请移除多余附件。';
  for(const f of files) {
    if(!(f.type?.startsWith('image/')||f.type==='application/pdf'||/\.(pdf|png|jpe?g|gif|webp|bmp|heic|heif|tiff?|avif|svg)$/i.test(f.name))) return '仅支持图片或 PDF 文件：'+f.name;
    if(f.size>20*1024*1024) return '单个文件不能超过 20M：'+f.name;
  }
  return '';
}
function addFiles(newFiles) {
  const unique=[...attachments];
  for(const f of newFiles) if(!unique.some(x=>x.name===f.name&&x.size===f.size&&x.lastModified===f.lastModified)) unique.push(f);
  const err=fileError(unique);
  $('#claim-error').textContent=err;
  if(err) return false;
  attachments=unique; renderFiles(); return true;
}
function renderFiles() {
  $('#file-list').innerHTML=attachments.map((f,i)=>`<div class="file-row"><span>▤　${esc(f.name)} <small>${(f.size/1024/1024).toFixed(2)} MB</small></span><button type="button" class="text-button" data-action="remove-file" data-index="${i}" aria-label="移除附件 ${esc(f.name)}">移除</button></div>`).join('');
}
function validateClaim(r,biz,customerId,files) {
  if(!r||r.status!=='待认领'||r.returned) return '该流水已处理，请刷新最新状态。';
  if(!['广告','履约','拒付'].includes(biz)) return '请选择子业务。';
  const customer=customers.find(c=>c.id===customerId);
  if(!customer) return '请选择客户。';
  if(!customer.lines.includes(biz)) return '所选客户没有对应子业务的演示账户，请重新选择匹配客户。';
  if(!files.length) return '请至少上传一个转账凭证。';
  return fileError(files);
}
function showSecondConfirmation() {
  const form=$('#claim-form'),biz=form.elements.biz.value,customerId=form.elements.customer.value;
  const error=validateClaim(activeReceipt,biz,customerId,attachments);
  $('#claim-error').textContent=error;
  if(error) return;
  const customer=customers.find(c=>c.id===customerId);
  pendingClaim={receiptId:activeReceipt.id,biz,customerId,files:[...attachments]};
  $('#confirm-modal').innerHTML=`<div class="modal-head"><h2 id="confirm-title">确认认领并充值？</h2><button class="icon-button" data-action="back" aria-label="返回修改">×</button></div><div class="modal-body"><div class="confirm-icon">!</div><p class="confirm-intro">请再次核对以下信息，确认后将直接充值至所选客户对应子业务的账户。</p>
    <dl class="confirm-fields"><dt>交易 ID</dt><dd>${activeReceipt.id}</dd><dt>子业务</dt><dd>${biz}</dd><dt>客户</dt><dd>${customer.name}（${customer.id}）</dd><dt>充值金额</dt><dd class="amount">${activeReceipt.currency} ${money(activeReceipt.amount)}</dd><dt>附件</dt><dd>${attachments.length} 个<br><small>${attachments.map(f=>esc(f.name)).join('<br>')}</small></dd></dl>
    <p class="confirm-warning">确认后，Fund 流水变为已认领，并停止后续提醒。请勿重复操作。</p><p class="prototype-hint">当前为交互演示，不发生真实充值。</p><div id="confirm-error" class="error" role="alert"></div></div>
    <div class="modal-foot"><button data-action="back">返回修改</button><button class="primary" data-action="final-confirm">确认认领并充值</button></div>`;
  $('#confirm-modal').showModal();
}
function commitClaim() {
  if(!pendingClaim) return;
  const r=receipts.find(x=>x.id===pendingClaim.receiptId);
  const error=validateClaim(r,pendingClaim.biz,pendingClaim.customerId,pendingClaim.files);
  if(error) { $('#confirm-error').textContent=error; return; }
  r.status='已认领'; r.stop=true;
  r.claimedCustomer=customers.find(c=>c.id===pendingClaim.customerId);
  r.claimedBiz=pendingClaim.biz; r.vouchers=pendingClaim.files.map(f=>f.name);
  pendingClaim=null; $('#confirm-modal').close(); $('#modal').close(); render(); toast('认领成功（演示），Fund 已完成充值。');
}
function returnModal(r) {
  if(r.status!=='待认领'||r.returned) return toast('该流水已处理。');
  activeReceipt=r;
  openModal('退回推荐流水',`<form id="return-form"><div class="modal-body"><p class="confirm-intro">退回后流水保持待认领，停止该笔提醒，由 Fund 业务人员继续处理。</p><div class="return-summary">${r.merchant} · ${r.currency} ${money(r.amount)}</div><label for="return-reason" class="field-label">退回原因（选填）</label><textarea id="return-reason" name="reason" rows="4" placeholder="可填写推荐客户不符等说明"></textarea></div></form>`, '<button data-action="close">取消</button><button class="primary" type="submit" form="return-form">确认退回</button>');
}
function schedule(c) {
  if(!Number.isInteger(c.count)||c.count<1||c.count>24) return {error:'每日次数请输入 1～24 的整数（建议范围）。'};
  if(!/^\d{2}:\d{2}$/.test(c.first)) return {error:'请选择首次提醒时间。'};
  const [h,m]=c.first.split(':').map(Number);
  if(h>23||m>59) return {error:'首次提醒时间无效。'};
  if(c.count>1&&(!Number.isInteger(c.interval)||c.interval<1)) return {error:'间隔请输入正整数分钟。'};
  const start=h*60+m;
  if(start+(c.count-1)*c.interval>=1440) return {error:'最后一次提醒不能跨过当天 24:00，请调整计划。'};
  return {times:Array.from({length:c.count},(_,i)=>{const n=start+i*c.interval;return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');})};
}
function settingsPage() {
  return `<main class="settings-scene"><div class="settings-heading"><span class="eyebrow">FUND 端配置示意 · 非飞书聊天功能</span><h1>推荐配置</h1><p>资金中台设置发送计划，飞书仅接收逐笔通知。</p></div>
  <form id="settings-form"><section class="settings-panel"><div class="switch-row"><div><h2>启用飞书通知</h2><p>关闭后停止发送，不影响 Fund 的推荐结果。</p></div><input type="checkbox" name="enabled" aria-label="启用飞书通知" ${config.enabled?'checked':''}></div></section>
  <section class="settings-panel"><h2>通知频次</h2><p class="form-hint">北京时间（UTC+8） · 每个计划时点逐笔发送</p><div class="schedule-grid"><div><label for="count">每日提醒次数</label><input id="count" name="count" type="number" value="${config.count}" min="1" max="24" step="1" required></div><div><label for="first">首次提醒时间</label><input id="first" name="first" type="time" value="${config.first}" required></div><div><label for="interval">提醒间隔（分钟）</label><input id="interval" name="interval" type="number" value="${config.interval}" min="1" step="1" required></div></div>
  <div class="schedule-preview"><b>当天发送时间预览</b><div id="time-preview"></div><div id="schedule-error" class="error" role="alert"></div></div><p class="form-hint">每日一次时无需配置间隔。保存后按后续时点执行，不补发已错过的时点。已认领、退回或停止提醒的流水不再发送。</p><p class="prototype-hint">每日 3 次、09:00、间隔 180 分钟为演示默认值；次数范围 1～24 为待评审建议。</p><button type="submit" class="primary">保存配置</button></section></form></main>`;
}
function preview() {
  const f=$('#settings-form'),count=Number(f.elements.count.value);f.elements.interval.disabled=count===1;
  const result=schedule({count,first:f.elements.first.value,interval:count===1?config.interval:Number(f.elements.interval.value)});
  $('#time-preview').innerHTML=result.times?result.times.map(t=>`<span>${t}</span>`).join(''):'';
  $('#schedule-error').textContent=result.error||'';f.querySelector('button[type="submit"]').disabled=!!result.error;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.scene){scene=b.dataset.scene;render();return;}
  const action=b.dataset.action,r=receipts.find(x=>x.id===b.dataset.id);
  if(action==='claim')beginClaim(r);
  if(action==='return')returnModal(r);
  if(action==='mute'&&r?.status==='待认领'){r.stop=true;render();toast('已停止该笔后续提醒。');}
  if(action==='close'){$('#modal').close();pendingClaim=null;}
  if(action==='back'){$('#confirm-modal').close();pendingClaim=null;}
  if(action==='final-confirm')commitClaim();
  if(action==='remove-file'){attachments.splice(Number(b.dataset.index),1);renderFiles();$('#claim-error').textContent='';}
});
document.addEventListener('change',e=>{if(e.target.id==='voucher'){addFiles(Array.from(e.target.files));e.target.value='';}if(e.target.closest('#settings-form'))preview();});
document.addEventListener('input',e=>{if(e.target.closest('#settings-form'))preview();});
document.addEventListener('keydown',e=>{if(e.target.id==='drop-zone'&&['Enter',' '].includes(e.key)){e.preventDefault();$('#voucher').click();}});
document.addEventListener('dragover',e=>{if(e.target.closest('#drop-zone')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
document.addEventListener('drop',e=>{if($('#modal').open&&$('#claim-form')){e.preventDefault();if(e.target.closest('#drop-zone'))addFiles(Array.from(e.dataTransfer.files));}});
document.addEventListener('paste',e=>{if($('#modal').open&&$('#claim-form')){const files=Array.from(e.clipboardData?.files||[]);if(files.length){e.preventDefault();addFiles(files);}}});
document.addEventListener('submit',e=>{
  e.preventDefault();const f=e.target;
  if(f.id==='claim-form'){showSecondConfirmation();return;}
  if(f.id==='return-form'){const r=activeReceipt;if(r.status!=='待认领'||r.returned)return toast('流水已处理。');r.returned=true;r.returnReason=f.elements.reason.value.trim();r.stop=true;$('#modal').close();render();toast('已退回，停止该笔提醒。');return;}
  if(f.id==='settings-form'){const c={enabled:f.elements.enabled.checked,count:Number(f.elements.count.value),first:f.elements.first.value,interval:Number(f.elements.interval.value)||config.interval};if(schedule(c).error)return;config=c;render();toast('配置已保存（演示）。');}
});
$('#confirm-modal').addEventListener('cancel',()=>{pendingClaim=null;});
$('#modal').addEventListener('close',()=>{activeReceipt=null;attachments=[];pendingClaim=null;});
render();
