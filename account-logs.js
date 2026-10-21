// UI-only audit prototype. No Feishu requests or real balance mutations.
let accountLogView = null;
let accountLogTrigger = null;
const accountLogSamples = new Map();

function logApprovers(biz, amount) {
  if (biz === '广告') return amount >= 5000 ? ['刘汉威', '沈雅婷', '肖雁方（Vanna）'] : ['张鹏飞', '沈雅婷'];
  if (biz === '履约' || biz === '代发') return ['高阳'];
  return [];
}

function makeAccountLogSamples(m) {
  // An empty account is intentional so the empty state can also be reviewed.
  if (m.id === '20157') return [];
  if (!logApprovers(m.biz, 6800).length) return [];
  const reason = m.biz === '广告' ? 'ad-佣金' : 'fulfill-订单扣款冲回';
  const specs = [
    ['18:00:00', '调额增加', 3200, '审批中', '未执行', ''],
    ['17:40:00', '调额增加', 6800, '已通过', '执行失败', '记账服务拒绝请求，已确认未入账。需运营核查后按原申请重试，不能重复发起调额。'],
    ['17:20:00', '调额增加', 6800, '已通过', '待执行', '审批已通过，等待 Fund 入账。'],
    ['17:00:00', '账户启用', null, '不适用', '执行成功', '核查完成，恢复账户使用。'],
    ['16:40:00', '账户禁用', null, '不适用', '执行成功', '异常交易核查，暂时禁用。'],
    ['16:20:00', '调额减少', 6800, '无需审批', '执行成功', '冲回重复入账。'],
    ['16:00:00', '调额增加', 6800, '已通过', '执行成功', '已核对调额凭证。'],
    ['15:40:00', '调额增加', 3200, '已驳回', '未执行', '凭证不完整，请补充后重新申请。'],
    ['15:20:00', '调额增加', 3200, '已撤回', '未执行', '发起人撤回，金额填写有误。'],
    ['15:00:00', '调额增加', 3200, '发起失败', '未执行', '飞书审批实例创建失败，需确认未创建成功后重试。'],
    ['14:40:00', '账户禁用', null, '不适用', '执行失败', '状态更新失败，账户仍为正常。'],
    ['14:20:00', '调额增加', 6800, '已通过', '执行中', '正在核对记账结果，入账结果以 Fund 最终确认为准。']
  ];
  return specs.map(([time, type, amount, approval, execution, remark], i) => {
    const adjustment = amount !== null;
    const route = adjustment && type === '调额增加' ? logApprovers(m.biz, amount) : [];
    const submitted = '2026-10-20 ' + time;
    const later = minutes => submitted.slice(0, 14) + String(Number(submitted.slice(14, 16)) + minutes).padStart(2, '0') + ':00';
    const updated = later(8);
    const id = `DEMO-${m.accountId}-${String(i + 1).padStart(3, '0')}`;
    const before = type === '调额减少' ? 6800 : 0;
    const after = execution === '执行成功' && adjustment ? before + (type === '调额减少' ? -amount : amount) : null;
    const events = [{ time: submitted, text: adjustment ? '张三在 Fund 提交调额申请' : `张三在 Fund 发起${type}` }];
    if (approval === '发起失败') events.push({ time: submitted, text: remark });
    else if (route.length) {
      events.push({ time: submitted, text: '飞书审批已创建' });
      if (approval === '审批中') events.push({ time: submitted, text: `等待 ${route[0]} 审批` });
      if (approval === '已通过') route.forEach((name, j) => events.push({ time: later(j + 1), text: `${name} 审批通过` }));
      if (approval === '已驳回') events.push({ time: updated, text: `${route[0]} 驳回：${remark}` });
      if (approval === '已撤回') events.push({ time: updated, text: remark });
    } else if (adjustment) events.push({ time: submitted, text: '调额减少，无需审批' });
    if (execution !== '未执行') events.push({ time: updated, text: execution === '执行成功' ? (adjustment ? 'Fund 入账成功，已生成资金流水' : `${type}成功`) : `${execution}：${remark}` });
    return { id, accountId: m.accountId, adjustment, type, amount, approval, execution, remark,
      submitted, updated: events.at(-1).time, operator: '张三', source: 'ops', route,
      approver: approval === '审批中' ? route[0] : '—', reason: adjustment ? (type === '调额减少' ? (m.biz === '广告' ? 'ad-佣金' : 'fulfill-重复认领扣回') : reason) : '—', before, after,
      stateBefore: type === '账户启用' ? '禁用' : '正常', stateAfter: type === '账户禁用' && execution === '执行成功' ? '禁用' : '正常',
      feishuId: route.length && approval !== '发起失败' ? `DEMO-FS-${m.accountId}-${i + 1}` : '',
      flowId: adjustment && execution === '执行成功' ? `DEMO-TX-${m.accountId}-${i + 1}` : '', events };
  });
}

function openAccountLogs(accountId) {
  const account = state.merchants.find(m => m.accountId === accountId);
  if (!account) return;
  accountLogTrigger = document.activeElement;
  if (!accountLogSamples.has(accountId)) accountLogSamples.set(accountId, makeAccountLogSamples(account));
  accountLogView = { account, type: '全部', page: 1, detail: '', refreshed: '' };
  renderAccountLogs();
  document.getElementById('log-close').focus();
}

function closeAccountLogs() {
  accountLogView = null;
  document.getElementById('mask').innerHTML = '';
  if (accountLogTrigger && accountLogTrigger.isConnected) accountLogTrigger.focus();
}

function filteredAccountLogs(view) {
  return (accountLogSamples.get(view.account.accountId) || []).filter(r =>
    (view.type === '全部' || (view.type === '调额申请' ? r.adjustment : !r.adjustment))
  ).sort((a, b) => b.submitted.localeCompare(a.submitted));
}

function logBadge(label) {
  const color = ({ '审批中': 'blue', '已通过': 'green', '执行成功': 'green', '待执行': 'orange', '执行中': 'blue', '已驳回': 'red', '发起失败': 'red', '执行失败': 'red' })[label] || '';
  return `<span class="log-badge ${color}">${esc(label)}</span>`;
}

function logExecutionHint(r) {
  if (!r.adjustment) return '';
  if (r.execution === '执行成功') return '资金已入账';
  if (r.execution === '执行中') return '入账结果确认中';
  return r.approval === '已通过' ? '尚未入账' : '资金未变动';
}

function logRecordDetail(r, m) {
  const pair = (label, value) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  const adjustmentInfo = r.adjustment
    ? pair('调整金额', `${r.type === '调额减少' ? '−' : '+'}${money(r.amount)} ${m.currency}`) +
      pair('变动原因', r.reason) + pair('执行前可用余额', r.after !== null ? `${money(r.before)} ${m.currency}` : '—（尚未成功执行）') +
      pair('执行后可用余额', r.after !== null ? `${money(r.after)} ${m.currency}` : '—（尚未成功执行，不展示预计值）') +
      pair('审批路径', r.route.join(' → ') || '无需审批') + pair('当前审批人', r.approver) +
      pair('飞书审批单号', r.feishuId || '—') + pair('Fund 资金流水号', r.flowId || '—（尚未生成）') +
      pair('申请备注', '模拟申请：核对账户调额依据。') + pair('上传的附件', '调额凭证.pdf（示例占位，未上传文件）')
    : pair('操作前状态', r.stateBefore) + pair('操作后状态', r.stateAfter) + pair('操作时可用余额', `0.00 ${m.currency}（示例快照）`);
  return `<div class="log-detail-head"><button class="btn" id="log-back">← 返回列表</button><b>${esc(r.type)}详情</b>${logBadge(r.approval)}${logBadge(r.execution)}</div>
    <div class="log-notice">${r.execution === '执行成功' ? (r.adjustment ? '调额已完成。以下余额为本次入账时的实际快照，不代表账户当前余额。' : '账户状态已更新。') : (r.execution === '执行中' ? '飞书已通过审批，Fund 正在执行或核验入账结果，请勿重复发起调额。' : r.approval === '已通过' ? '飞书已通过审批，但 Fund 尚未调额成功。请以执行结果为准。' : r.adjustment ? '本记录未发生资金变动。' : '本次操作失败，账户状态未变更。')}</div>
    <dl class="log-detail-grid">${pair(r.adjustment ? 'Fund 申请单号' : '日志 ID', r.id)}${pair('发起人 / 操作人', r.operator)}${pair('发起时间', r.submitted)}${pair('最后更新时间', r.updated)}${pair('请求来源', r.source)}${pair('备注 / 处理说明', r.remark || '等待审批，未调整账户资金。')}${adjustmentInfo}</dl>
    <h4>处理轨迹 <span class="log-muted">同一申请持续更新，保留完整事件记录</span></h4>
    <ol class="log-timeline">${r.events.map(e => `<li><span class="log-muted">${esc(e.time)}</span><br>${esc(e.text)}</li>`).join('')}</ol>
    ${r.feishuId ? '<p class="log-muted">生产环境「查看飞书审批单」应跳转本条实例的链接，并校验访问权限；本原型未连接飞书，不生成虚假链接。</p>' : ''}`;
}

function renderAccountLogs() {
  const v = accountLogView;
  if (!v) return;
  const m = v.account;
  const all = accountLogSamples.get(m.accountId) || [];
  const filtered = filteredAccountLogs(v);
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  v.page = Math.min(v.page, pages);
  const rows = filtered.slice((v.page - 1) * 8, v.page * 8);
  const detail = all.find(r => r.id === v.detail);
  const table = `<div class="log-tabs" role="tablist" aria-label="日志类型">${['全部', '调额申请', '账户状态变更'].map(t => `<button role="tab" aria-selected="${v.type === t}" class="${v.type === t ? 'on' : ''}" data-log-type="${t}">${t} <span class="log-muted">${all.filter(r => t === '全部' || (t === '调额申请' ? r.adjustment : !r.adjustment)).length}</span></button>`).join('')}</div>
    <div class="log-table-wrap"><table class="log-table"><thead><tr><th>发起时间 / 操作人</th><th>操作类型</th><th>变更内容</th><th>操作</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${esc(r.submitted)}<span class="log-sub">${esc(r.operator)} · ${esc(r.source)}</span></td><td>${esc(r.type)}<span class="log-sub">${r.adjustment ? '调额申请' : '账户状态变更'}</span></td><td>${r.adjustment ? `<b class="money ${r.type === '调额减少' ? 'minus' : 'plus'}">${r.type === '调额减少' ? '−' : '+'}${money(r.amount)} ${esc(m.currency)}</b><span class="log-sub">${esc(r.reason)}</span>` : `${r.stateBefore} → ${r.stateAfter}<span class="log-sub">${r.execution === '执行失败' ? '未变更' : '状态变更'}</span>`}</td><td><button class="btn link" data-log-detail="${esc(r.id)}">详情</button></td></tr>`).join('') || '<tr class="empty"><td colspan="4">暂无符合条件的日志</td></tr>'}</tbody></table></div>
    <div class="log-pager"><span class="log-muted">按发起时间倒序 · 共 ${filtered.length} 条 · 8 条/页</span><button class="btn" id="log-prev" ${v.page <= 1 ? 'disabled' : ''}>上一页</button><span>${v.page} / ${pages}</span><button class="btn" id="log-next" ${v.page >= pages ? 'disabled' : ''}>下一页</button></div>`;
  const host = document.getElementById('mask');
  host.innerHTML = `<div class="mask log-mask"><section class="modal log-modal" role="dialog" aria-modal="true" aria-labelledby="log-title"><h3 id="log-title">账户操作日志 <button id="log-close" aria-label="关闭账户操作日志">×</button></h3><div class="log-body"><div class="log-context"><strong>${esc(m.name)} <span class="log-muted">/ ${esc(m.biz === '履约' ? '代发（履约）' : m.biz)}资金账户</span></strong><span>商户 ID：${esc(m.id)}</span><span>账户 ID：${esc(m.accountId)}</span><span>币种：${esc(m.currency)} · ${esc(m.attr)}</span></div>${detail ? logRecordDetail(detail, m) : table}</div><div class="footer"><span class="log-muted" role="status">交互演示 · 全部为模拟日志，未对接飞书${v.refreshed ? ' · 本地刷新于 ' + esc(v.refreshed) : ''}</span><button class="btn" id="log-refresh">刷新记录</button><button class="btn" id="log-done">关闭</button></div></section></div>`;
  document.getElementById('log-close').onclick = closeAccountLogs;
  document.getElementById('log-close').focus();
  document.getElementById('log-done').onclick = closeAccountLogs;
  document.getElementById('log-refresh').onclick = () => { v.refreshed = new Date().toLocaleTimeString('zh-CN', { hour12: false }); renderAccountLogs(); document.getElementById('log-refresh').focus(); };
  if (detail) { document.getElementById('log-back').onclick = () => { v.detail = ''; renderAccountLogs(); }; return; }
  host.querySelectorAll('[data-log-type]').forEach(b => b.onclick = () => { v.type = b.dataset.logType; v.page = 1; renderAccountLogs(); });
  host.querySelectorAll('[data-log-detail]').forEach(b => b.onclick = () => { v.detail = b.dataset.logDetail; renderAccountLogs(); document.getElementById('log-back').focus(); });
  document.getElementById('log-prev').onclick = () => { v.page--; renderAccountLogs(); };
  document.getElementById('log-next').onclick = () => { v.page++; renderAccountLogs(); };
}

document.addEventListener('keydown', e => {
  if (!accountLogView) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeAccountLogs(); }
  if (e.key === 'Tab') {
    const nodes = Array.from(document.querySelectorAll('.log-modal button:not(:disabled), .log-modal input, .log-modal select'));
    const first = nodes[0], last = nodes.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}, true);
