let scene = "alert";
let view = "message"; // message | detail
let detailTab = "refund";

const refundRows = [
  ["Payoneer", "Payoneer-Luzhennan", "2026-11-18 13:19", "Debit from Payoneer", "debit", "-1,280.00 USD"],
  ["Payoneer", "Payoneer-Bestads", "2026-11-12 09:41", "Debit from Payoneer", "debit", "-560.40 USD"],
  ["Payoneer", "Payoneer-Besttech", "2026-11-05 16:02", "Debit from Payoneer", "debit", "-2,100.00 USD"],
];

const pullRows = [
  ["Worldfirst", "WF-Ops-01", "每 2 小时", "2026-11-26 12:10", "danger", "超时未执行", "超过约定窗口 40 分钟"],
  ["Payoneer", "Payoneer-Bestads", "每 2 小时", "2026-11-26 16:02", "ok", "正常", "—"],
  ["Airwallex", "AWX-Main", "每 1 小时", "2026-11-26 16:55", "ok", "正常", "—"],
];

const reconRows = [
  ["Airwallex", "AWX-Main", "warn", "流水缺失", "3 笔 / 420.00 USD", "ok", "补拉成功", "2026-11-26 15:30"],
  ["Payoneer", "Payoneer-Luzhennan", "ok", "一致", "—", "", "—", "2026-11-26 15:30"],
  ["Worldfirst", "WF-Ops-01", "ok", "一致", "—", "", "—", "2026-11-26 15:30"],
];

const logRows = [
  ["2026-11-26 15:30", "Airwallex", "AWX-Main", "对账兜底", "部分成功", "补拉 3 笔成功"],
  ["2026-11-26 14:05", "Worldfirst", "WF-Ops-01", "拉流频率检查", "失败", "—"],
  ["2026-11-26 09:00", "Payoneer", "Payoneer-Bestads", "异常退款扫描", "成功", "—"],
];

function shell(chatBody) {
  return `<div class="feishu-shell">
    <aside class="app-rail" aria-label="飞书场景装饰">
      <div class="feishu-mark">✦</div>
      <div class="rail-avatar">财</div>
      <div class="rail-selected">▣<small>消息</small></div>
      <div>▦<small>日历</small></div>
      <div>▤<small>云文档</small></div>
      <div>▧<small>工作台</small></div>
    </aside>
    <section class="conversation-list">
      <div class="search">⌕　搜索</div>
      <div class="list-heading">消息 <span>＋</span></div>
      <div class="chat-selected">
        <div class="bot-avatar">监</div>
        <div>
          <b>资金流水监控 · 财务群</b>
          <p>${scene === "ok" ? "今日流水监控日报 · 全部正常" : "今日流水监控日报 · 有异常"}</p>
        </div>
      </div>
      <div class="chat-explain">定向推送到财务群<br>消息卡片本身就是看板<br>点进去才看明细</div>
    </section>
    <section class="chat">
      <header class="chat-head">
        <div class="bot-avatar">监</div>
        <div>
          <h1>资金流水监控 · 财务群 <span class="app-tag">应用</span></h1>
          <p>资金中台通知 · 飞书消息</p>
        </div>
        <span class="chat-menu">⌕　⋯</span>
      </header>
      <div class="chat-scroll">${chatBody}</div>
    </section>
  </div>`;
}

function alertCard() {
  return `<div class="message-card tone-warn">
    <div class="card-banner">
      <div class="card-banner-main">
        <b>流水监控看板</b>
        <span class="banner-tag">有异常</span>
      </div>
      <p>2026-11-26 · 财务群定向推送</p>
    </div>
    <div class="card-body">
      <div class="board-kpis">
        <button type="button" data-action="open-detail" data-tab="refund">
          <span>异常退款</span>
          <strong>3</strong>
          <em>Payoneer</em>
        </button>
        <button type="button" data-action="open-detail" data-tab="pull">
          <span>拉流异常</span>
          <strong class="sev-critical">1</strong>
          <em>Worldfirst 超时</em>
        </button>
        <button type="button" data-action="open-detail" data-tab="recon">
          <span>缺失 / 补拉</span>
          <strong class="sev-normal">1 / 1</strong>
          <em>已补拉成功</em>
        </button>
      </div>
      <p class="board-section-title">摘要</p>
      <ul class="board-hits">
        <li>
          <div class="hit-main">
            <b>异常退款</b>
            <span>Payoneer · 3 笔命中 debit</span>
          </div>
        </li>
        <li>
          <div class="hit-main sev-critical">
            <b>拉流频率</b>
            <span>Worldfirst / WF-Ops-01 超时未执行</span>
          </div>
        </li>
        <li>
          <div class="hit-main sev-normal">
            <b>对账兜底</b>
            <span>Airwallex / AWX-Main 缺失 3 笔，已补拉成功</span>
          </div>
        </li>
      </ul>
      <div class="card-actions">
        <button type="button" class="primary" data-action="open-detail" data-tab="refund">查看明细</button>
        <button type="button" data-action="toast-download">下载明细</button>
      </div>
    </div>
  </div>`;
}

function okCard() {
  return `<div class="message-card tone-ok">
    <div class="card-banner">
      <div class="card-banner-main">
        <b>流水监控看板</b>
        <span class="banner-tag">全部正常</span>
      </div>
      <p>2026-11-26 · 财务群定向推送</p>
    </div>
    <div class="card-body">
      <div class="board-kpis">
        <button type="button" data-action="open-detail" data-tab="refund">
          <span>异常退款</span>
          <strong class="sev-normal">0</strong>
          <em>无命中</em>
        </button>
        <button type="button" data-action="open-detail" data-tab="pull">
          <span>拉流异常</span>
          <strong class="sev-normal">0</strong>
          <em>全部按时</em>
        </button>
        <button type="button" data-action="open-detail" data-tab="recon">
          <span>缺失 / 补拉</span>
          <strong class="sev-normal">0 / 0</strong>
          <em>轧差一致</em>
        </button>
      </div>
      <p class="board-empty">三类监控均无异常。</p>
      <div class="card-actions">
        <button type="button" class="primary" data-action="open-detail" data-tab="logs">查看任务记录</button>
      </div>
    </div>
  </div>`;
}

function messagePage() {
  const card = scene === "ok" ? okCard() : alertCard();
  return shell(`
    <div class="date-line">今天　18:00</div>
    <article class="message">
      <div class="bot-avatar">监</div>
      <div class="message-content">
        <div class="sender">流水监控助手 <span>应用</span></div>
        ${card}
      </div>
    </article>
    <div class="chat-end">演示消息 · 点击指标或「查看明细」进入详情</div>
  `);
}

function detailPage() {
  const tabs = [
    ["refund", "异常退款"],
    ["pull", "拉流频率"],
    ["recon", "对账兜底"],
    ["logs", "任务记录"],
  ]
    .map(
      ([id, label]) =>
        `<button type="button" class="${detailTab === id ? "active" : ""}" data-action="switch-tab" data-tab="${id}">${label}</button>`
    )
    .join("");

  const refund = `
    <table class="detail-table">
      <thead><tr><th>平台</th><th>账户别名</th><th>发生时间</th><th>交易信息</th><th>关键词</th><th>金额</th></tr></thead>
      <tbody>${refundRows
        .map(
          (r) =>
            `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td><code>${r[4]}</code></td><td>${r[5]}</td></tr>`
        )
        .join("")}</tbody>
    </table>`;

  const pull = `
    <table class="detail-table">
      <thead><tr><th>平台</th><th>账户别名</th><th>约定频率</th><th>最近执行</th><th>状态</th><th>说明</th></tr></thead>
      <tbody>${pullRows
        .map(
          (r) =>
            `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td><span class="pill ${r[4]}">${r[5]}</span></td><td>${r[6]}</td></tr>`
        )
        .join("")}</tbody>
    </table>`;

  const recon = `
    <table class="detail-table">
      <thead><tr><th>平台</th><th>账户别名</th><th>校验结果</th><th>差额</th><th>补拉结果</th><th>执行时间</th></tr></thead>
      <tbody>${reconRows
        .map(
          (r) =>
            `<tr><td>${r[0]}</td><td>${r[1]}</td><td><span class="pill ${r[2]}">${r[3]}</span></td><td>${r[4]}</td><td>${
              r[5] ? `<span class="pill ${r[5]}">${r[6]}</span>` : r[6]
            }</td><td>${r[7]}</td></tr>`
        )
        .join("")}</tbody>
    </table>`;

  const logs = `
    <table class="detail-table">
      <thead><tr><th>任务执行时间</th><th>平台</th><th>账户别名</th><th>任务内容</th><th>执行结果</th><th>补拉结果</th></tr></thead>
      <tbody>${logRows
        .map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td></tr>`)
        .join("")}</tbody>
    </table>`;

  return `<div class="detail-shell">
    <aside class="app-rail" aria-label="飞书场景装饰">
      <div class="feishu-mark">✦</div>
      <div class="rail-avatar">财</div>
      <div class="rail-selected">▣<small>消息</small></div>
      <div>▦<small>日历</small></div>
      <div>▤<small>云文档</small></div>
      <div>▧<small>工作台</small></div>
    </aside>
    <main class="detail-main">
      <div class="detail-bar">
        <button type="button" class="text-button" data-action="back-message">← 返回消息</button>
        <div>
          <h1>流水监控明细</h1>
          <p>从飞书看板卡片进入 · 2026-11-26 · 财务群定向推送</p>
        </div>
      </div>
      <section class="detail-card">
        <div class="detail-summary">
          <div><span>异常退款</span><b class="${scene === "ok" ? "" : "warn"}">${scene === "ok" ? 0 : 3}</b></div>
          <div><span>拉流异常</span><b class="${scene === "ok" ? "" : "danger"}">${scene === "ok" ? 0 : 1}</b></div>
          <div><span>缺失 / 补拉</span><b>${scene === "ok" ? "0 / 0" : "1 / 1"}</b></div>
        </div>
        <div class="detail-tabs">${tabs}</div>
        <div class="detail-panel ${detailTab === "refund" ? "active" : ""}" data-panel="refund">${refund}</div>
        <div class="detail-panel ${detailTab === "pull" ? "active" : ""}" data-panel="pull">${pull}</div>
        <div class="detail-panel ${detailTab === "recon" ? "active" : ""}" data-panel="recon">${recon}</div>
        <div class="detail-panel ${detailTab === "logs" ? "active" : ""}" data-panel="logs">${logs}</div>
      </section>
      <p class="detail-hint">明细在飞书侧打开（侧边栏 / 子页面），不是独立网页后台看板。演示数据仅用于样式确认。</p>
    </main>
  </div>`;
}

function render() {
  document.querySelectorAll("[data-scene]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.scene === scene);
  });
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = view === "detail" ? detailPage() : messagePage();
}

document.addEventListener("click", (event) => {
  const btn = event.target.closest("button");
  if (!btn) return;

  if (btn.dataset.scene) {
    scene = btn.dataset.scene;
    view = "message";
    detailTab = "refund";
    render();
    return;
  }

  const action = btn.dataset.action;
  if (action === "open-detail") {
    view = "detail";
    detailTab = btn.dataset.tab || "refund";
    render();
    return;
  }
  if (action === "switch-tab") {
    detailTab = btn.dataset.tab;
    render();
    return;
  }
  if (action === "back-message") {
    view = "message";
    render();
    return;
  }
  if (action === "toast-download") {
    window.alert("演示：下载明细附件（Excel）");
  }
});

render();
