(function() {
  'use strict';
  const R = window.Recon;
  const storageKey='advance-reconciliation-demo-v1';
  let state;
  try { state=JSON.parse(localStorage.getItem(storageKey)||'null'); } catch(_) {}
  if(!state||state.schema!==2) state=R.seed();
  let view = {page:'balances', customer:'DEMO-1001', currency:'EUR', status:'', from:'2026-10-01', to:'2026-10-31', q:'', period:'', flow:'', detail:'', account:'', syncFail:false, channel:'', balanceTab:'periods', flowCustomer:'', flowPeriod:'', flowPlatform:'', flowMatched:'', flowBill:'', flowTimezone:'UTC+8 北京/上海'};
  let modal = null;
  const root = document.getElementById('app'), overlay = document.getElementById('overlay');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (n, cur) => `${Number(n / 100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} ${cur || ''}`.trim();
  const date = iso => iso ? iso.slice(0,10) : '—';
  const customer = () => R.customer(state,view.customer);
  const periods = () => state.periods.filter(p => (!view.period || p.id===view.period) && p.customer===view.customer && p.currency===view.currency && (!view.status || p.status===view.status) && (!view.from || p.end>=view.from) && (!view.to || p.start<=view.to));
  const allFlows = () => state.flows.filter(f => f.customer===view.customer && f.currency===view.currency && (!view.q || [f.id,f.bill,f.eventId,f.channel,f.account].join(' ').toLowerCase().includes(view.q.toLowerCase())) && (!view.period || f.period===view.period) && (!view.channel || f.channel===view.channel) && (!view.from || f.date>=view.from) && (!view.to || f.date<=view.to));
  const paypalFlows = () => allFlows().filter(f => f.channel==='PayPal');
  const badge = (s) => `<span class="badge ${({'已匹配':'ok','已确认':'ok','已同步 Fund':'ok','已完成':'ok','reviewed':'ok','synced':'ok','已通过':'ok','执行成功':'ok','多重匹配':'warn','待确认':'warn','待执行':'warn','审批中':'warn','已驳回':'bad','执行失败':'bad','未匹配':'bad','failed':'bad','draft':'plain'}[s]||'plain')}">${esc(s)}</span>`;
  const icon = n => `<span class="icon">${n}</span>`;
  function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.className='show';clearTimeout(toast.t);toast.t=setTimeout(()=>t.className='',3000);}
  function pickAndSync(done){const input=document.createElement('input');input.type='file';input.accept='.xlsx,.xls,.csv';input.onchange=()=>{const file=input.files&&input.files[0];if(file) done(file);};input.click();}
  function nav(page){view.page=page;view.detail='';view.period='';view.flow='';view.q='';view.channel='';location.hash=page;render();}
  function shell(){
    const active=view.page, title={balances:'余额表',paypal:'垫资 PayPal 明细',flows:'平台收款明细',matching:'订单匹配',statements:'对账管理',orders:'店铺订单明细',fund:'Fund 联动',customers:'客户管理'}[active]||'余额表';
    root.innerHTML=`<aside class="sidebar"><div class="brand"><span class="mark">垫</span><b>垫资对账</b></div>
      <div class="nav-title">数据管理</div><button class="nav ${active==='customers'?'active':''}" data-nav="customers">${icon('客')}客户管理</button><button class="nav ${active==='orders'?'active':''}" data-nav="orders">${icon('店')}店铺订单明细</button><button class="nav ${active==='flows'?'active':''}" data-nav="flows">${icon('收')}平台收款明细</button>
      <div class="nav-title">对账管理</div><button class="nav ${active==='statements'?'active':''}" data-nav="statements">${icon('单')}对账管理</button><button class="nav ${active==='matching'?'active':''}" data-nav="matching">${icon('链')}订单匹配</button>
      <div class="nav-title">垫资对账管理</div><button class="nav ${active==='paypal'?'active':''}" data-nav="paypal">${icon('P')}垫资 PayPal 明细</button>
      <div class="nav-title">余额与资金</div><button class="nav ${active==='balances'?'active':''}" data-nav="balances">${icon('余')}余额表</button><button class="nav ${active==='fund'?'active':''}" data-nav="fund">${icon('F')}Fund 联动</button>
      <div class="sidebar-foot">原型演示 · 全部为模拟数据<br><button class="link" id="reset-demo">重置演示</button></div></aside>
      <main class="main"><header class="topbar"><div class="menu-glyph">☰</div><div class="crumb"><b>${esc(title)}</b></div><div class="topright"><span>经典</span><span class="theme-on">亮色</span><span>${new Date().toLocaleString('zh-CN',{hour12:false})}</span></div></header><section class="content" id="content"></section></main>`;
    root.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>nav(b.dataset.nav));
  }
  function customerSelect(){return `<select id="customer">${state.customers.map(c=>`<option value="${c.id}" ${view.customer===c.id?'selected':''}>${esc(c.name)}（${c.id}）</option>`).join('')}</select>`;}
  function filters(){return `<div class="filters"><div><label>客户</label>${customerSelect()}</div><div><label>币种</label><select id="currency"><option>${view.currency}</option></select></div><div><label>对账周期</label><select id="period"><option value="">全部周期</option>${state.periods.filter(p=>p.customer===view.customer).map(p=>`<option value="${p.id}" ${view.period===p.id?'selected':''}>${p.start} ~ ${p.end}</option>`).join('')}</select></div><div><label>周期状态</label><select id="status"><option value="">全部状态</option>${[['draft','对账中'],['reviewed','待客户确认'],['confirmed','已确认'],['synced','已同步 Fund'],['failed','同步失败']].map(([v,t])=>`<option value="${v}" ${view.status===v?'selected':''}>${t}</option>`).join('')}</select></div><div><label>日期范围</label><div class="range"><input id="from" type="date" value="${view.from}"><span>至</span><input id="to" type="date" value="${view.to}"></div></div><div class="filter-actions"><button class="btn primary" id="search">查询</button><button class="btn" id="reset">重置</button></div></div>`;}
  function bindFilters(){
    document.getElementById('customer').onchange=e=>{view.customer=e.target.value||'DEMO-1001';view.currency=R.customer(state,view.customer).currency;view.period='';render();};
    ['currency','period','status','from','to'].forEach(id=>document.getElementById(id).onchange=e=>view[id]=e.target.value);
    document.getElementById('search').onclick=render;document.getElementById('reset').onclick=()=>{view.status='';view.period='';view.from='2026-10-01';view.to='2026-10-31';render();};
  }
  function statCards(){const s=R.summary(state,view.customer), c=customer();return `<div class="cards"><div class="stat"><span>客户当前结算余额</span><strong>${s.expected===null?'待设置期初':money(s.expected,c.currency)}</strong><small>期初 + 已确认结算 + Fund 已执行变动</small></div><div class="stat"><span>Fund 账户余额合计</span><strong>${s.mirrored===null?'待回传':money(s.mirrored,c.currency)}</strong><small>${s.fund===null?'存在未设置期初余额':'已收到的 Fund 余额快照'}</small></div><div class="stat"><span>待同步 Fund</span><strong class="${s.pending?'amber':''}">${money(s.pending,c.currency)}</strong><small>${s.pending?'有已确认或失败记录':'无待处理记录'}</small></div><div class="stat"><span>余额差异</span><strong class="${s.expected!==s.mirrored?'red':''}">${s.expected===null||s.mirrored===null?'待回传':money(s.expected-s.mirrored,c.currency)}</strong><small>${s.expected===s.mirrored&&s.expected!==null?'与 Fund 回传余额一致':'含待入账金额或未回传变动'}</small></div></div>`;}
  function balanceAccountName(id){
    return ({'A-PP':'PayPal-HQY 10','A-OP':'Oceanpayment-HUACHAO','B-AW':'Airwallex-try.swellfree.co/p1','B-SP':'ShopifyPayments-volmer-h','C-PP':'PayPal-HQY 14'})[id] || id;
  }
  function signedMoney(n, cur){
    if(n == null) return '—';
    return (n>0?'+':'') + money(n, cur);
  }
  function balanceLedger(a){
    const lines=[];
    if(a.opening!==null) lines.push({time:(a.openingAt||'')+' 23:59', source:'Fund', type:'期初余额', delta:a.opening, count:true, note:'Fund 维护的期初余额', ref:'OPENING'});
    state.events.filter(e=>e.account===a.id && e.kind==='settlement').forEach(e=>{
      const p=state.periods.find(x=>x.id===e.reference);
      lines.push({time:(p?p.end+' 18:00':e.time.slice(0,16).replace('T',' ')), source:'垫资对账', type:'对账单结算', delta:e.delta, count:true, note:p?`对账管理已确认 ${p.start} ~ ${p.end}，Fund 执行成功后计入该资金账户`:'对账单结算已入账', ref:e.reference});
    });
    state.periods.filter(p=>p.customer===a.customer && p.currency===a.currency && ['confirmed','failed'].includes(p.status)).forEach(p=>{
      const row=R.calc(state,p.id).byAccount[a.id];
      if(!row||!row.total) return;
      lines.push({time:p.end+' 18:00', source:'垫资对账', type:'对账单结算', delta:row.total, count:false, note:`对账管理已确认 ${p.start} ~ ${p.end}，Fund 尚未执行成功，当前余额不变`, ref:p.id});
    });
    state.events.filter(e=>e.account===a.id && e.kind!=='settlement').forEach(e=>{
      const op=state.operations.find(o=>o.id===e.reference);
      const other=state.events.find(x=>x.reference===e.reference && x.account!==a.id);
      const where=other?`${e.delta<0?'调往':'来自'} ${balanceAccountName(other.account)}`:'';
      lines.push({time:e.time.slice(0,16).replace('T',' '), source:'Fund', type:e.kind==='transfer'?(e.delta<0?'调拨转出':'调拨转入'):'手动调额', delta:e.delta, count:true, note:[where, op?.reason||''].filter(Boolean).join(' · '), ref:e.reference});
    });
    state.operations.filter(o=>o.source===a.id && o.execution!=='执行成功').forEach(o=>{
      lines.push({time:o.time.slice(0,16).replace('T',' '), source:'Fund', type:o.type==='transfer'?'调拨转出':'手动调额', delta:o.type==='transfer'?-o.amount:o.amount, count:false, note:`${o.reason} · ${o.approval} / ${o.execution}，不计入当前余额`, ref:o.id});
    });
    const rank={期初余额:0,对账单结算:1,调拨转出:2,调拨转入:3,手动调额:4};
    lines.sort((x,y)=>x.time.localeCompare(y.time)||(rank[x.type]||9)-(rank[y.type]||9));
    let bal=0;
    lines.forEach(l=>{if(l.count){l.after=bal+l.delta;bal=l.after;}else l.after=null;});
    return {lines, balance:a.opening===null?null:bal};
  }
  function sumLines(lines, pred){return lines.filter(pred).reduce((n,l)=>n+l.delta,0);}
  function balanceCustomers(){
    const q=(view.balanceQuery||'').trim().toLowerCase();
    return state.customers.filter(c=>!q || [c.id,c.name].join(' ').toLowerCase().includes(q));
  }
  function balanceLineVisible(line){
    const day=String(line.time||'').slice(0,10);
    if(view.balanceFrom && day<view.balanceFrom) return false;
    if(view.balanceTo && day>view.balanceTo) return false;
    if(view.balanceSource && line.source!==view.balanceSource) return false;
    return true;
  }
  function readBalanceFilters(){
    const q=document.getElementById('balance-q'), from=document.getElementById('balance-from'), to=document.getElementById('balance-to'), source=document.getElementById('balance-source'), channel=document.getElementById('balance-channel');
    if(q) view.balanceQuery=q.value.trim();
    if(from) view.balanceFrom=from.value;
    if(to) view.balanceTo=to.value;
    if(source) view.balanceSource=source.value;
    if(channel) view.balanceChannel=channel.value;
  }
  function balanceSuggest(q){
    const text=(q||'').trim().toLowerCase();
    return state.customers.filter(c=>!text || [c.id,c.name].join(' ').toLowerCase().includes(text)).slice(0,8);
  }
  function customerBalanceBlock(c){
    const allAccounts=state.accounts.filter(a=>a.customer===c.id).map(a=>({account:a, ledger:balanceLedger(a)}));
    const accounts=allAccounts.filter(x=>!view.balanceChannel || x.account.channel===view.balanceChannel);
    if(!accounts.length) return '';
    const currencies=[...new Set(allAccounts.map(x=>x.account.currency))];
    const totals=currencies.map(cur=>{
      const rows=allAccounts.filter(x=>x.account.currency===cur);
      const counted=rows.filter(x=>x.ledger.balance!==null);
      const lines=counted.flatMap(x=>x.ledger.lines);
      return {
        cur,
        missing:rows.some(x=>x.account.opening===null),
        balance:counted.reduce((n,x)=>n+x.ledger.balance,0),
        opening:sumLines(lines,l=>l.count&&l.type==='期初余额'),
        settlement:sumLines(lines,l=>l.count&&l.type==='对账单结算'),
        transfer:sumLines(lines,l=>l.count&&l.type.startsWith('调拨')),
        adjust:sumLines(lines,l=>l.count&&l.type==='手动调额'),
        ready:counted.length>0
      };
    });
    const totalHtml=totals.map(t=>`<div class="balance-total"><span>客户总余额 · ${esc(t.cur)}</span><strong>${t.ready?money(t.balance,t.cur):'待设置期初'}</strong></div>`).join('');
    const splitHtml=totals.map(t=>`<div class="balance-split"><span>期初<strong>${t.ready?money(t.opening,t.cur):'—'}</strong></span><span>对账单结算<strong>${t.ready?signedMoney(t.settlement,t.cur):'—'}</strong></span><span>调拨净额<strong>${t.ready?signedMoney(t.transfer,t.cur):'—'}</strong></span><span>手动调额<strong>${t.ready?signedMoney(t.adjust,t.cur):'—'}</strong></span></div>`).join('');
    const accountHtml=accounts.map(({account:a, ledger})=>{
      const lines=ledger.lines;
      const part=(pred)=>a.opening==null?null:sumLines(lines,l=>l.count&&pred(l));
      const visible=lines.filter(balanceLineVisible);
      const rows=visible.map(l=>`<tr class="${l.count?'':'is-idle'}"><td>${esc(l.time)}</td><td>${esc(l.source)}</td><td>${esc(l.type)}</td><td class="money ${l.delta<0?'minus':'plus'}">${signedMoney(l.delta,a.currency)}</td><td class="money">${l.after==null?'—':money(l.after,a.currency)}</td><td>${esc(l.note)}</td><td>${l.count?'<span class="sync-pill ok">已计入</span>':'<span class="sync-pill warn">不计入</span>'}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">这个筛选下没有变动明细</td></tr>';
      return `<article class="balance-account"><header><div><b>${esc(a.channel)}</b><span>${esc(balanceAccountName(a.id))} · ${esc(a.id)} · ${esc(a.currency)}</span></div><div class="balance-total"><span>账户余额</span><strong>${ledger.balance==null?'待设置期初':money(ledger.balance,a.currency)}</strong></div></header><div class="balance-split account"><span>期初<strong>${a.opening==null?'—':money(a.opening,a.currency)}</strong></span><span>对账单结算<strong>${signedMoney(part(l=>l.type==='对账单结算'),a.currency)}</strong></span><span>调拨净额<strong>${signedMoney(part(l=>l.type.startsWith('调拨')),a.currency)}</strong></span><span>手动调额<strong>${signedMoney(part(l=>l.type==='手动调额'),a.currency)}</strong></span></div><div class="table-wrap"><table class="balance-lines"><thead><tr><th>时间</th><th>来源</th><th>变动类型</th><th>变动金额</th><th>变动后余额</th><th>说明</th><th>是否计入</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
    }).join('')||'<p class="empty">这个客户还没有资金账户</p>';
    const missing=totals.some(t=>t.missing)?'有资金账户还没设期初，客户总余额不含这些账户。':'';
    return `<section class="balance-customer"><header><div><b>${esc(c.name)}</b><span>${esc(c.id)}</span></div><div class="balance-totals">${totalHtml}</div></header>${splitHtml}<p class="balance-note">${missing}客户总余额等于下面同币种资金账户的当前余额相加，不跨币种相加。同一客户里的调拨会改变账户余额，客户总额不变。未在对账管理确认的周期不会出现；已确认但 Fund 还没执行成功的，会列出来并标成不计入。</p>${accountHtml}</section>`;
  }
  function renderBalances(){
    const list=balanceCustomers();
    const blocks=list.map(customerBalanceBlock).filter(Boolean);
    const channels=[['PayPal','PayPal'],['Airwallex','Airwallex'],['Oceanpayment','OceanPayment'],['ShopifyPayments','ShopifyPayments']];
    const filtering=view.balanceFrom||view.balanceTo||view.balanceSource||view.balanceChannel;
    document.getElementById('content').innerHTML=`<div class="page-head"><div><h1>余额表</h1><p>按客户、资金账户、变动明细三层看金额。客户看总余额，账户看各渠道资金账户余额，明细看每一笔对账单结算、调拨和手动调额。</p></div><div class="head-actions"><button class="btn" id="export-balance">导出余额表</button></div></div><div class="panel balance-filter"><div class="balance-search"><div class="balance-field grow"><label for="balance-q">客户</label><div class="balance-search-box"><input id="balance-q" placeholder="输入客户名称或客户 ID，支持模糊搜索" value="${esc(view.balanceQuery||'')}" autocomplete="off"><div id="balance-suggest" class="balance-suggest" hidden></div></div></div><div class="balance-field"><label>时间区间</label><div class="range"><input id="balance-from" type="date" aria-label="开始日期" value="${esc(view.balanceFrom||'')}"><span>至</span><input id="balance-to" type="date" aria-label="结束日期" value="${esc(view.balanceTo||'')}"></div></div><div class="balance-field"><label for="balance-source">来源</label><select id="balance-source"><option value="">全部</option><option value="Fund" ${view.balanceSource==='Fund'?'selected':''}>Fund</option><option value="垫资对账" ${view.balanceSource==='垫资对账'?'selected':''}>垫资对账</option></select></div><div class="balance-field"><label for="balance-channel">渠道</label><select id="balance-channel"><option value="">全部</option>${channels.map(([v,t])=>`<option value="${v}" ${view.balanceChannel===v?'selected':''}>${t}</option>`).join('')}</select></div><div class="balance-field actions"><button class="btn primary" id="balance-search">查询</button><button class="btn" id="balance-reset">重置</button></div></div>${filtering?'<p class="balance-note filter">时间、来源和渠道用来筛选资金账户和变动明细。客户总余额、账户余额仍是当前全量，不按筛选重算。</p>':''}</div><div class="balance-list">${blocks.join('')||'<div class="panel"><p class="empty">没有符合筛选的记录</p></div>'}</div>`;
    const input=document.getElementById('balance-q'), box=document.getElementById('balance-suggest');
    const paint=()=>{const hits=balanceSuggest(input.value);box.innerHTML=hits.map(c=>`<button type="button" data-pick="${esc(c.id)}">${esc(c.name)}<span>${esc(c.id)}</span></button>`).join('')||'<div class="empty">没有匹配的客户</div>';box.hidden=false;};
    input.onfocus=paint;input.oninput=paint;
    input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();document.getElementById('balance-search').click();}};
    box.onclick=e=>{const b=e.target.closest('[data-pick]');if(!b)return;readBalanceFilters();const picked=R.customer(state,b.dataset.pick);view.balanceQuery=picked.name;view.customer=picked.id;view.currency=picked.currency;render();};
    document.getElementById('balance-search').onclick=()=>{readBalanceFilters();render();};
    document.getElementById('balance-reset').onclick=()=>{view.balanceQuery='';view.balanceFrom='';view.balanceTo='';view.balanceSource='';view.balanceChannel='';render();};
    document.getElementById('export-balance').onclick=()=>{
      const rows=[];
      list.forEach(c=>state.accounts.filter(a=>a.customer===c.id && (!view.balanceChannel || a.channel===view.balanceChannel)).forEach(a=>{
        const ledger=balanceLedger(a);
        const visible=ledger.lines.filter(balanceLineVisible);
        if(!visible.length) rows.push([c.id,c.name,a.id,balanceAccountName(a.id),a.channel,a.currency,'','','','',ledger.balance==null?'待设置期初':'','','']);
        visible.forEach(l=>rows.push([c.id,c.name,a.id,balanceAccountName(a.id),a.channel,a.currency,l.time,l.source,l.type,(l.delta/100).toFixed(2),l.after==null?'':(l.after/100).toFixed(2),l.count?'已计入':'不计入',l.note]));
      }));
      exportRows(rows,['客户 ID','客户名称','资金账户','账户别名','渠道','币种','时间','来源','变动类型','变动金额','变动后余额','是否计入','说明']);
    };
  }
  function renderFlows(){
    const channels=[['','全部渠道'],['Airwallex','Airwallex'],['PayPal','PayPal'],['Oceanpayment','OceanPayment'],['ShopifyPayments','ShopifyPayments']];
    const flowRows=()=>state.flows.filter(f=>{const c=state.customers.find(x=>x.id===f.customer);const text=[f.customer,c?.name||'',f.account,f.id,f.eventId,f.bill].join(' ').toLowerCase();const p=state.periods.find(x=>x.id===f.period);return (!view.flowCustomer||text.includes(view.flowCustomer.toLowerCase()))&&(!view.flowPeriod||[f.period,p?.start||'',p?.end||''].join(' ').toLowerCase().includes(view.flowPeriod.toLowerCase()))&&(!view.flowPlatform||f.channel===view.flowPlatform)&&(!view.flowMatched||(view.flowMatched==='已对账匹配'?R.flowStatus(state,f)==='已匹配':view.flowMatched==='未匹配'?R.flowStatus(state,f)==='未匹配':true))&&(!view.flowBill||String(f.bill||'').toLowerCase().includes(view.flowBill.toLowerCase()))&&(!view.flowFrom||f.date>=view.flowFrom)&&(!view.flowTo||f.date<=view.flowTo)&&(!view.channel||f.channel===view.channel)});
    const rows=flowRows();
    const accountNames={'A-PP':'PayPal-HQY 10','A-OP':'Oceanpayment-HUACHAO','B-AW':'Airwallex-try.swellfree.co/p1','B-SP':'ShopifyPayments-volmer-h','C-PP':'PayPal-HQY 14'};
    const payerNames=['Anthony Custodi','Linda Pike','Debora Soule','Jennifer Roers','Carol Triebe','Steve','Clifford','Brett','Adam'];
    const payerAccounts=['6JBJ998ND8A4A','CHRMQW7U2SQEL','REPHQ958XW3KS','Y6AVG645AWDDS','KUPJ7485PX9EY'];
    const typeText=(f)=>{
      if(f.channel==='Airwallex') return f.type==='reserve_hold'?'Payment Reserve Hold':f.type==='refund'?'Refund':'Payment';
      if(f.channel==='Oceanpayment') return f.type==='refund'?'退款':f.type==='payment'?'成功':(f.type||'—');
      if(f.channel==='ShopifyPayments') return f.type==='refund'?'REFUND':f.type==='payment'?'CHARGE':(f.type||'—').toUpperCase();
      if(f.type==='reserve_hold') return '准备金冻结';
      if(f.type==='refund') return '付款退款';
      return '快速结账付款';
    };
    const value=(f,key)=>{
      const idx=Math.abs(Number(String(f.id).replace(/\\D/g,''))||1);
      if(key==='order') return f.bill && f.bill!=='—' ? f.bill : `#${66860+idx}`;
      if(key==='payer') return payerNames[idx%payerNames.length];
      if(key==='payerAccount') return payerAccounts[idx%payerAccounts.length];
      if(key==='custom') return `CN-${String(100000+idx)}`;
      return '';
    };
    const common=(f)=>[
      `<td class="mono">${esc(f.customer)}</td>`,
      `<td>${esc(state.customers.find(x=>x.id===f.customer)?.name||f.customer)}</td>`,
      `<td>${esc(accountNames[f.account]||f.account)}</td>`,
      `<td>${f.date}</td>`
    ];
    const commonHead='<th>客户 ID</th><th>客户名称</th><th>账户别名</th><th>交易时间</th>';
    let head=commonHead, body='';
    if(!view.channel){
      head=commonHead+'<th>平台</th><th>账单号/订单号</th><th>交易类型</th><th>交易币种</th><th>交易金额</th><th>手续费</th><th>交易 ID</th><th>匹配状态</th><th>所属周期</th>';
      body=rows.map(f=>{const p=state.periods.find(x=>x.id===f.period);return `<tr>${common(f).join('')}<td><b>${f.channel}</b></td><td class="mono">${esc(value(f,'order'))}</td><td>${typeText(f)}</td><td>${f.currency}</td><td class="money ${f.amount<0?'minus':'plus'}">${f.amount>=0?'+':''}${money(f.amount,f.currency)}</td><td class="money ${f.fee<0?'minus':'plus'}">${money(f.fee,f.currency)}</td><td class="mono">${esc(f.eventId||f.id)}</td><td>${badge(R.flowStatus(state,f))}</td><td>${p?`${p.start} ~ ${p.end}`:'—'}${f.override?'<span class="sub">人工改期</span>':''}</td></tr>`;}).join('');
    } else if(view.channel==='Airwallex'){
      head=commonHead+'<th>Order ID</th><th>类型</th><th>交易币种</th><th>交易金额</th><th>手续费</th><th>交易 ID</th><th>付款方名称</th><th>付款方账号</th><th>备注</th>';
      body=rows.map(f=>`<tr>${common(f).join('')}<td class="mono">${esc(value(f,'order'))}</td><td>${typeText(f)}</td><td>${f.currency}</td><td class="money ${f.amount<0?'minus':'plus'}">${f.amount>=0?'+':''}${money(f.amount,f.currency)}</td><td class="money ${f.fee<0?'minus':'plus'}">${money(f.fee,f.currency)}</td><td class="mono">${esc(f.eventId||f.id)}</td><td>${esc(value(f,'payer'))}</td><td>${esc(value(f,'payerAccount'))}</td><td>—</td></tr>`).join('');
    } else if(view.channel==='PayPal'){
      head=commonHead+'<th>账单号</th><th>交易 ID</th><th>code 类型</th><th>交易币种</th><th>交易金额</th><th>手续费</th><th>关联交易 ID</th><th>付款方名称</th><th>付款方账号</th><th>付款方邮箱</th><th>可用余额</th><th>custom number</th><th>备注</th>';
      body=rows.map(f=>{const a=state.accounts.find(x=>x.id===f.account);return `<tr>${common(f).join('')}<td class="mono">${esc(f.bill||'—')}</td><td class="mono">${esc(f.eventId||f.id)}</td><td>${typeText(f)}</td><td>${f.currency}</td><td class="money ${f.amount<0?'minus':'plus'}">${f.amount>=0?'+':''}${money(f.amount,f.currency)}</td><td class="money ${f.fee<0?'minus':'plus'}">${money(f.fee,f.currency)}</td><td class="mono">${esc('REL-'+(f.eventId||f.id))}</td><td>${esc(value(f,'payer'))}</td><td>${esc(value(f,'payerAccount'))}</td><td>—</td><td class="money">${a?.channelBalance!=null?money(a.channelBalance,a.currency):'—'}</td><td class="mono">${esc(value(f,'custom'))}</td><td>—</td></tr>`;}).join('');
    } else if(view.channel==='Oceanpayment'){
      head=commonHead+'<th>账户订单号</th><th>交易类型</th><th>交易币种</th><th>交易金额</th><th>手续费</th><th>交易 ID</th><th>记账币种</th><th>记账金额</th><th>付款方名称</th><th>付款方账号</th><th>备注</th>';
      body=rows.map(f=>`<tr>${common(f).join('')}<td class="mono">${esc(value(f,'order'))}</td><td>${typeText(f)}</td><td>${f.currency}</td><td class="money ${f.amount<0?'minus':'plus'}">${f.amount>=0?'+':''}${money(f.amount,f.currency)}</td><td class="money ${f.fee<0?'minus':'plus'}">${money(f.fee,f.currency)}</td><td class="mono">${esc(f.eventId||f.id)}</td><td>${f.currency}</td><td class="money">${money(f.amount+f.fee,f.currency)}</td><td>—</td><td>—</td><td>—</td></tr>`).join('');
    } else {
      head=commonHead+'<th>Shopify订单号</th><th>结算日期</th><th>交易类型</th><th>交易币种</th><th>交易金额</th><th>手续费</th><th>净收入金额</th><th>交易 ID</th><th>用户付款金额</th><th>用户付款币种</th><th>银行参考号</th><th>结算 ID</th><th>结算状态</th>';
      body=rows.map(f=>`<tr>${common(f).join('')}<td class="mono">${esc(value(f,'order'))}</td><td>—</td><td>${typeText(f)}</td><td>${f.currency}</td><td class="money ${f.amount<0?'minus':'plus'}">${f.amount>=0?'+':''}${money(f.amount,f.currency)}</td><td class="money ${f.fee<0?'minus':'plus'}">${money(f.fee,f.currency)}</td><td class="money ${f.amount+f.fee<0?'minus':'plus'}">${money(f.amount+f.fee,f.currency)}</td><td class="mono">${esc(f.eventId||f.id)}</td><td class="money">${money(f.amount,f.currency)}</td><td>${f.currency}</td><td class="mono">—</td><td class="mono">—</td><td><span class="badge plain">UNGENERATED</span></td></tr>`).join('');
    }
    const activeLabel=channels.find(x=>x[0]===view.channel)?.[1]||'全部渠道';
    document.getElementById('content').innerHTML=`<div class="page-head"><div><h1>平台收款明细</h1><p>流水由 Fund 垫资交易明细自动同步；按渠道查看字段，统一用于订单匹配和客户维度归集。</p></div></div><div class="panel flow-filter-panel"><div class="flow-tabs" role="tablist">${channels.map(([k,label])=>`<button class="flow-tab ${view.channel===k?'active':''}" data-flow-channel="${k}">${label}${k?`<span>${state.flows.filter(f=>f.channel===k).length}</span>`:''}</button>`).join('')}</div><div class="platform-filters"><div><label>客户</label><input id="flow-customer" placeholder="输入名称/ID筛选" value="${esc(view.flowCustomer)}"></div><div><label>结算周期</label><input id="flow-period" placeholder="搜索结算周期" value="${esc(view.flowPeriod)}"></div><div><label>平台</label><select id="flow-platform"><option value="">全部平台</option>${[['PayPal','PayPal'],['Airwallex','Airwallex'],['Oceanpayment','OceanPayment'],['ShopifyPayments','ShopifyPayments']].map(([v,t])=>`<option value="${v}" ${view.flowPlatform===v?'selected':''}>${t}</option>`).join('')}</select></div><div><label>账单号（模糊）</label><input id="flow-bill" placeholder="platform_order_id 部分匹配" value="${esc(view.flowBill)}"></div><div><label>对账匹配</label><select id="flow-matched"><option value="">全部</option><option value="已对账匹配" ${view.flowMatched==='已对账匹配'?'selected':''}>已对账匹配</option><option value="未匹配" ${view.flowMatched==='未匹配'?'selected':''}>未匹配</option></select></div><div><label>开始日期</label><input id="flow-from" type="date" value="${view.flowFrom||'2026-10-01'}"></div><div><label>结束日期</label><input id="flow-to" type="date" value="${view.flowTo||'2026-10-31'}"></div><div><label>时区</label><select id="flow-timezone"><option>UTC+8 北京/上海</option><option>美国太平洋（PT）</option><option>美国东部（ET）</option><option>UTC</option></select></div><div class="platform-actions"><button class="btn primary" id="flow-filter-search">查询</button><button class="btn" id="flow-filter-reset">重置</button><button class="btn" id="export-flows">导出 Excel</button><button class="btn" id="sync-flows">同步渠道流水</button><button class="btn" id="upload-sync-flows">上传并同步</button><button class="btn" id="flow-audit">操作记录</button></div></div><div class="sync-line"><span class="dot green"></span>来源：Fund 垫资交易明细　最近同步（UTC）：${state.lastSync?date(state.lastSync.time)+' '+(state.lastSync.time.slice(11,19)):'未同步'}　新增 ${state.lastSync?.added||0} 笔　重复 ${state.lastSync?.duplicates||0} 笔　待处理 ${state.lastSync?.quarantined||0} 笔</div></div><div class="panel table-panel flow-table-panel"><div class="table-head"><div><b>${activeLabel}流水</b></div></div><div class="table-wrap"><table><thead><tr>${head}<th>操作</th></tr></thead><tbody>${body||`<tr><td colspan="20" class="empty">暂无${activeLabel}流水</td></tr>`}</tbody></table></div></div>`;
    document.querySelectorAll('[data-flow-channel]').forEach(b=>b.onclick=()=>{view.channel=b.dataset.flowChannel;view.flowPlatform=b.dataset.flowChannel;view.q='';render();});
    document.getElementById('flow-filter-search').onclick=()=>{view.flowCustomer=document.getElementById('flow-customer').value.trim();view.flowPeriod=document.getElementById('flow-period').value.trim();view.flowPlatform=document.getElementById('flow-platform').value;view.flowMatched=document.getElementById('flow-matched').value;view.flowBill=document.getElementById('flow-bill').value.trim();view.flowFrom=document.getElementById('flow-from').value;view.flowTo=document.getElementById('flow-to').value;view.flowTimezone=document.getElementById('flow-timezone').value;render();};
    document.getElementById('flow-filter-reset').onclick=()=>{view.flowCustomer='';view.flowPeriod='';view.flowPlatform='';view.flowMatched='';view.flowBill='';view.flowFrom='2026-10-01';view.flowTo='2026-10-31';view.flowTimezone='UTC+8 北京/上海';view.channel='';render();};
    document.getElementById('sync-flows').onclick=()=>{try{const batch=R.seed().flows.map(x=>({...x}));const r=R.ingest(state,batch);recordIngest('flow','手动同步渠道流水','四渠道',{added:r.added,duplicates:r.duplicates,failed:r.quarantined});toast(`同步完成：成功 ${r.added}，重复 ${r.duplicates}，失败 ${r.quarantined}。详情在操作记录`);render();}catch(e){toast(e.message);}};
    document.getElementById('upload-sync-flows').onclick=()=>pickAndSync(file=>{recordUpload('flow',file.name);render();toast(`「${file.name}」已上传。没进来的明细可以在操作记录里查看`);});
    document.getElementById('flow-audit').onclick=openSyncLog;
    document.getElementById('export-flows').onclick=()=>exportRows(rows.map(f=>[f.customer,state.customers.find(x=>x.id===f.customer)?.name||'',accountNames[f.account]||f.account,f.channel,f.date,f.bill,f.eventId,f.amount/100,f.fee/100,R.flowStatus(state,f)]),['客户 ID','客户名称','账户别名','平台','交易时间','账单号/订单号','交易 ID','交易金额','手续费','匹配状态']);
  }
  function renderPaypal(){
    const rows=state.flows.filter(f=>f.channel==='PayPal'&&(!view.ppCustomer||f.customer===view.ppCustomer)&&(!view.from||f.date>=view.from)&&(!view.to||f.date<=view.to)&&(!view.ppCurrency||f.currency===view.ppCurrency)&&(!view.ppBill||f.bill.toLowerCase().includes(view.ppBill.toLowerCase())));
    document.getElementById('content').innerHTML=`<div class="legacy-page"><div class="panel legacy-panel paypal-filter"><div class="legacy-title"><span class="page-icon">P</span><b>垫资 PayPal 明细</b></div><div class="paypal-grid"><div><label>日期范围</label><div class="range"><input id="pp-from" type="date" value="${view.from}"><span>至</span><input id="pp-to" type="date" value="${view.to}"></div></div><div><label>时间段</label><div class="range"><input type="time" step="1" placeholder="开始时间"><span>至</span><input type="time" step="1" placeholder="结束时间"></div></div><div><label>时区</label><select><option>全部</option><option>UTC+8 北京/上海</option></select></div><div><label>客户名称</label><select id="pp-customer"><option value="">全部</option>${state.customers.map(c=>`<option value="${c.id}" ${view.ppCustomer===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div><label>可用余额</label><input placeholder="等值查询" type="number"></div><div><label>可用余额币种</label><select id="pp-currency"><option value="">全部</option>${['USD','EUR'].map(c=>`<option ${view.ppCurrency===c?'selected':''}>${c}</option>`).join('')}</select></div></div><div class="legacy-actions"><button class="btn primary" id="paypal-search">查询</button><button class="btn" id="export-paypal">导出对账单</button><button class="btn" id="paypal-reset">重置</button><button class="btn" id="paypal-more">更多筛选</button></div></div><div class="panel table-panel legacy-panel paypal-table"><div class="table-head"><b>垫资 PayPal 明细</b><button id="pp-columns" class="column-picker" title="列设置" aria-label="列设置">☷</button></div><div class="table-wrap"><table><thead><tr><th>客户名称</th><th>日期</th><th>时间</th><th>买家名称</th><th>时区</th><th>类型</th><th>状态</th><th>币种</th><th>总额</th><th>费用</th><th>可用余额</th><th>可用余额币种</th><th>数据来源</th><th>发件人邮箱</th><th>收件人邮箱</th><th>交易号</th><th>参考交易号</th><th>账单号</th><th>国家/地区代码</th></tr></thead><tbody>${rows.map(f=>{const c=state.customers.find(x=>x.id===f.customer);const dt=(f.date||'').split(' '), typ=({payment:'快速结账付款',refund:'退款',dispute:'准备金冻结',recovery:'准备金放款',reserve_hold:'准备金冻结'}[f.type]||f.type);return `<tr><td>${esc(c?.name||f.customer)}</td><td>${dt[0]||'—'}</td><td>${dt[1]||'—'}</td><td>${esc(f.buyer||'—')}</td><td>—</td><td>${typ}</td><td>${badge('已完成')}</td><td>${f.currency}</td><td class="money ${f.amount<0?'minus':'plus'}">${money(f.amount)}</td><td class="money minus">${money(f.fee)}</td><td class="money plus">—</td><td>${f.currency}</td><td>fund</td><td>—</td><td>—</td><td class="mono">${esc(f.eventId||f.id)}</td><td class="mono">${esc(f.bill||'—')}</td><td class="mono">${esc(f.bill||'—')}</td><td>—</td></tr>`;}).join('')||`<tr><td colspan="19" class="empty">暂无 PayPal 流水</td></tr>`}</tbody></table></div></div></div>`;
    document.getElementById('paypal-search').onclick=()=>{view.ppCustomer=document.getElementById('pp-customer').value;view.ppCurrency=document.getElementById('pp-currency').value;view.ppBill=document.getElementById('pp-bill')?.value||'';view.from=document.getElementById('pp-from').value;view.to=document.getElementById('pp-to').value;render();};
    document.getElementById('paypal-reset').onclick=()=>{view.ppCustomer='';view.ppCurrency='';view.ppBill='';view.from='2026-10-01';view.to='2026-10-31';render();};
    document.getElementById('export-paypal').onclick=()=>exportTable('.paypal-table table');
    document.getElementById('paypal-more').onclick=()=>{const grid=document.querySelector('.paypal-grid');if(document.getElementById('pp-extra')){document.getElementById('pp-extra').remove();return;}grid.insertAdjacentHTML('beforeend',`<div id="pp-extra"><label for="pp-bill">账单号</label><input id="pp-bill" placeholder="输入账单号" value="${esc(view.ppBill||'')}"></div>`);};
    document.getElementById('pp-columns').onclick=()=>{const heads=[...document.querySelectorAll('.paypal-table th')];showDialog('列设置',heads.map((th,i)=>`<label class="column-option"><input type="checkbox" data-column="${i}" ${th.hidden?'':'checked'}>${esc(th.textContent)}</label>`).join(''));document.querySelectorAll('[data-column]').forEach(input=>input.onchange=()=>document.querySelectorAll('.paypal-table tr').forEach(tr=>{tr.cells[Number(input.dataset.column)].hidden=!input.checked;}));};
  }
  function renderMatching(){const orders=state.orders.filter(o=>{const fs=state.flows.filter(f=>matchesOrder(o,f)),c=R.customer(state,o.customer),m=view.match||{};return (!m.customer||[c.id,c.name].join(' ').toLowerCase().includes(m.customer.toLowerCase()))&&(!view.from||o.date>=view.from)&&(!view.to||o.date<=view.to)&&(!m.ref||o.refs.join(' ').toLowerCase().includes(m.ref.toLowerCase()))&&(!m.bill||fs.some(f=>f.bill.toLowerCase().includes(m.bill.toLowerCase())))&&(!m.platform||m.platform==='全部'||fs.some(f=>f.channel===m.platform))&&(!m.period||fs.some(f=>{const p=R.period(state,f.period);return [p.id,p.start,p.end].join(' ').includes(m.period);}))&&(!m.status||m.status==='全部'||(m.status==='已匹配'?fs.some(f=>f.type==='payment'):!fs.some(f=>f.type==='payment')))&&(!m.exceptions?.length||fs.some(f=>m.exceptions.includes(f.type)));});document.getElementById('content').innerHTML=`<div class="panel legacy-panel match-filter"><div class="legacy-title"><b>♧ 订单匹配</b></div><div class="notice compact">导入的店铺订单：一行一笔订单；表格列支持支付/退款/拒付/争议费等类型混合展示，可按客户、结算周期、平台、支付时间和异常交易筛选。</div><div class="legacy-filters"><div><label>客户</label><input id="match-customer" placeholder="输入客户ID/筛选"></div><div><label>结算周期</label><input id="match-period" placeholder="搜索结算周期"></div><div><label>平台</label><select id="match-platform"><option>全部</option><option>PayPal</option><option>Airwallex</option><option>Oceanpayment</option><option>ShopifyPayments</option></select></div><div><label>订单支付开始</label><input id="match-from" type="date" value="${view.from}"></div><div><label>订单支付结束</label><input id="match-to" type="date" value="${view.to}"></div><div><label>支付时间时区</label><select><option>UTC+8 北京/上海</option><option>UTC</option></select></div><div class="legacy-checks"><label>异常（关联流水类别，多选为「或」）</label><span><label><input type="checkbox" data-exception="refund"> 有过退款</label><label><input type="checkbox" data-exception="dispute"> 有过拒付</label><label><input type="checkbox" data-exception="dispute_fee"> 有过争议费</label></span></div><div><label>Payment Refs</label><input id="match-ref" placeholder="子串匹配（不区分大小写）"></div><div><label>账单号</label><input id="match-bill" placeholder="流水 platform_order_id 子串"></div><div><label>匹配状态</label><select id="match-status"><option>全部</option><option>已匹配</option><option>未匹配</option></select></div><div><label>每页</label><select><option>50</option><option>100</option></select></div><div class="legacy-actions"><button class="btn primary" id="match-search">查询</button><button class="btn" id="match-reset">重置</button><button class="btn" id="match-export">导出 Excel</button></div></div></div><div class="panel table-panel legacy-panel"><div class="table-wrap"><table class="matching-table"><thead><tr><th>结算周期</th><th>客户</th><th>店铺</th><th>Name</th><th>订单支付时间</th><th>订单金额</th><th>订单币种</th><th>Payment Refs</th><th>匹配状态</th><th>支付账单号</th><th>状态</th><th>支付币种</th><th>支付金额</th><th>PayPal费用</th><th>OP手续费</th><th>退款币种</th><th>退款金额</th><th>拒付币种</th><th>拒付金额</th><th>争议费</th><th>异常交易记账日期</th></tr></thead><tbody>${orders.map(o=>{const fs=state.flows.filter(f=>matchesOrder(o,f));const pay=fs.find(f=>f.type==='payment'), refund=fs.filter(f=>f.type==='refund').reduce((n,f)=>n+f.amount,0);const c=state.customers.find(x=>x.id===o.customer);return `<tr><td>${pay?state.periods.find(p=>p.id===pay.period)?.start+' ~ '+state.periods.find(p=>p.id===pay.period)?.end:'—'}</td><td>${esc(c?.name||o.customer)}</td><td>${esc(o.store)}</td><td>${esc(o.id)}</td><td>${o.date} 00:00</td><td>${(o.amount/100).toFixed(2)}</td><td>${o.currency}</td><td class="mono">${esc(o.refs[0])}</td><td>${pay?badge('已匹配'):badge('未匹配')}</td><td class="mono">${pay?.bill||'—'}</td><td>${pay?'快速结账付款':'—'}</td><td>${pay?.currency||o.currency}</td><td>${pay?(pay.amount/100).toFixed(2):'—'}</td><td>${pay?.channel==='PayPal'?(pay.fee/100).toFixed(2):'0.00'}</td><td>${pay?.channel==='Oceanpayment'?(pay.fee/100).toFixed(2):'0.00'}</td><td>${refund?' '+o.currency:'—'}</td><td>${refund?(refund/100).toFixed(2):'—'}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`;}).join('')||`<tr><td colspan="21" class="empty">暂无订单</td></tr>`}</tbody></table></div></div>`;for(const key of ['customer','period','platform','ref','bill','status'])document.getElementById('match-'+key).value=view.match?.[key]||(['platform','status'].includes(key)?'全部':'');document.querySelectorAll('[data-exception]').forEach(i=>i.checked=!!view.match?.exceptions?.includes(i.dataset.exception));document.getElementById('match-search').onclick=()=>{view.match=Object.fromEntries(['customer','period','platform','ref','bill','status'].map(k=>[k,document.getElementById('match-'+k).value]));view.match.exceptions=[...document.querySelectorAll('[data-exception]:checked')].map(i=>i.dataset.exception);view.from=document.getElementById('match-from').value;view.to=document.getElementById('match-to').value;render();};document.getElementById('match-reset').onclick=()=>{view.match={};view.from='2026-10-01';view.to='2026-10-31';render();};document.getElementById('match-export').onclick=()=>exportTable('.matching-table');}
  const matchesOrder=(o,f)=>f.customer===o.customer&&f.account===o.account&&f.currency===o.currency&&o.refs.includes(f.bill);
  function renderStatements(){
    const ps=state.periods.filter(p=>(!view.period||p.id===view.period)&&(!view.stmtQ||[p.id,p.customer,R.customer(state,p.customer).name].join(' ').toLowerCase().includes(view.stmtQ.toLowerCase())));
    document.getElementById('content').innerHTML=`<div class="panel statement-filter legacy-panel"><div class="statement-filter-row"><div><input id="stmt-q" value="${esc(view.stmtQ||'')}" placeholder="输入名称/ID 筛选"></div><div class="legacy-actions"><button class="btn primary" id="stmt-search">查询</button><button class="btn" id="stmt-reset">重置</button></div><button class="btn primary statement-create" id="stmt-create">按店铺订单结算周期创建</button></div></div><div class="panel table-panel legacy-panel statement-list"><div class="table-wrap"><table><thead><tr><th>ID</th><th>客户</th><th>账期</th><th>状态</th><th>创建人</th><th>创建时间</th><th>操作</th></tr></thead><tbody>${ps.map((p,i)=>{const draft=p.status==='draft'||p.status==='reviewed',periodTag=`<span class="tag tag-blue">周期</span>`;return `<tr><td>${220+state.periods.indexOf(p)}</td><td>${esc(state.customers.find(c=>c.id===p.customer)?.name||p.customer)}</td><td>${periodTag} ${p.start} ~ ${p.end}<span class="sub">${p.start}至${p.end}<br>Asia/Shanghai</span></td><td>${badge(p.status==='draft'?'已完成':'已完成')} ${draft?'<span class="tag tag-orange">草稿</span>':'<span class="tag tag-mint">已确认</span>'}</td><td>订单导入自动对账</td><td>2026-10-${String(27-i).padStart(2,'0')} 14:19</td><td class="ops statement-ops">${draft?'<button class="mini-btn" data-fee="'+p.id+'">🛠 编辑费用</button><button class="mini-btn confirm" data-confirm="'+p.id+'">✓ 确认</button>':''}<button class="mini-btn primary" data-export="${p.id}">⇩ 导出</button><button class="mini-btn" data-fee="${p.id}">费用明细</button><button class="mini-btn" data-rerun="${p.id}">⟳ 重跑</button>${draft?'<button class="mini-btn danger" data-delete="'+p.id+'">删除</button>':''}<button class="mini-btn icon-btn" data-refresh="${p.id}" aria-label="刷新对账单">↻</button></td></tr>`;}).join('')||'<tr><td colspan="7" class="empty">暂无对账单</td></tr>'}</tbody></table></div></div>`;
    document.getElementById('stmt-search').onclick=()=>{view.stmtQ=document.getElementById('stmt-q').value.trim();render();};
    document.getElementById('stmt-reset').onclick=()=>{view.stmtQ='';view.period='';render();};
    document.getElementById('stmt-create').onclick=()=>openPeriod();
    document.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>{const x=R.calc(state,b.dataset.export);exportRows([['匹配金额',x.gross/100],['服务费',x.service/100],['保证金',x.reserve/100],['本期结算余额',x.total/100]],['项目','金额']);});
    document.querySelectorAll('[data-fee]').forEach(b=>b.onclick=()=>openStatement(b.dataset.fee));
    document.querySelectorAll('[data-confirm]').forEach(b=>b.onclick=()=>{try{const p=R.period(state,b.dataset.confirm);if(p.status==='draft')R.review(state,p.id);openConfirm(p.id);}catch(e){toast(e.message);}});
    document.querySelectorAll('[data-refresh]').forEach(b=>b.onclick=render);
    document.querySelectorAll('[data-rerun]').forEach(b=>b.onclick=()=>{R.calc(state,b.dataset.rerun);toast('已重新计算当前对账单；已确认周期保持锁定');});
    document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>toast('演示原型不删除对账单，仅保留操作入口'));
  }
  function renderOrders(){
    const f=view.orderFilters||{};
    const all=state.orders;
    const rows=all.filter(o=>{
      const c=R.customer(state,o.customer), num=(o.id.match(/\d+$/)||[''])[0], shop=String(o.store||'');
      return (!f.customer||[o.customer,c.name].join(' ').toLowerCase().includes(f.customer.toLowerCase()))
        &&(!f.period||state.flows.some(x=>{const pp=state.periods.find(p=>p.id===x.period);return x.customer===o.customer&&x.account===o.account&&x.currency===o.currency&&matchesOrder(o,x)&&[x.period,pp?.start,pp?.end].join(' ').includes(f.period)}))
        &&(!f.store||shop.toLowerCase().includes(f.store.toLowerCase()))
        &&(!f.shopify||String(o.shopifyId||'').toLowerCase().includes(f.shopify.toLowerCase()))
        &&(!f.ref||o.refs.join(' ').toLowerCase().includes(f.ref.toLowerCase()))
        &&(!f.amount||Number(o.amount/100)===Number(f.amount))
        &&(!f.from||o.date>=f.from)&&(!f.to||o.date<=f.to);
    });
        document.getElementById('content').innerHTML=`<div class="panel legacy-panel orders-filter"><div class="legacy-title"><span class="page-icon">店</span><b>店铺订单明细</b></div><div class="orders-grid"><div><label>客户</label><input id="order-customer" placeholder="输入名称/ID筛选" value="${esc(f.customer||'')}"></div><div><label>结算周期</label><input id="order-period" placeholder="搜索结算周期" value="${esc(f.period||'')}"></div><div><label>店铺名（模糊）</label><input id="order-store" placeholder="输入店铺关键词" value="${esc(f.store||'')}"></div><div><label>Shopify Id（模糊）</label><input id="order-shopify" placeholder="订单 id，支持部分匹配" value="${esc(f.shopify||'')}"></div><div><label>Payment Refs（模糊）</label><input id="order-ref" placeholder="匹配 payment_refs 拼接文本" value="${esc(f.ref||'')}"></div><div><label>金额（精确）</label><input id="order-amount" placeholder="如 999.00" value="${esc(f.amount||'')}"></div><div><label>开始日期</label><input id="order-from" type="date" value="${f.from||'2026-10-01'}"></div><div><label>结束日期</label><input id="order-to" type="date" value="${f.to||'2026-10-31'}"></div><div><label>时区</label><select><option>UTC+8 北京/上海</option><option>UTC</option></select></div></div><div class="legacy-actions"><button class="btn primary" id="order-search">查询</button><button class="btn" id="order-reset">重置</button><button class="btn" id="order-export">导出 Excel</button><button class="btn" id="upload-sync-orders">上传并同步</button><button class="btn" id="order-audit">操作记录</button></div></div><div class="panel table-panel legacy-panel orders-table"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Shopify Id</th><th>客户</th><th>店铺名</th><th>编号</th><th>支付时间</th><th>币种</th><th>金额</th><th>Payment Refs</th></tr></thead><tbody>${rows.map((o,i)=>{const c=R.customer(state,o.customer),num=(o.id.match(/\d+$/)||[String(i+1)])[0],shopify=o.shopifyId||String(8565378023762+i*10037),fs=state.flows.filter(x=>matchesOrder(o,x));return `<tr><td>${85401-i}</td><td class="mono">${shopify}</td><td>${esc(c.name)}</td><td>${esc(o.store)}</td><td>${num}</td><td>${o.date} 02:59</td><td>${o.currency}</td><td class="money">${(o.amount/100).toFixed(2)}</td><td class="mono">${esc(o.refs[0]||'—')}</td></tr>`;}).join('')||'<tr><td colspan="9" class="empty">暂无订单</td></tr>'}</tbody></table></div></div>`;
    document.getElementById('order-search').onclick=()=>{view.orderFilters={customer:document.getElementById('order-customer').value,period:document.getElementById('order-period').value,store:document.getElementById('order-store').value,shopify:document.getElementById('order-shopify').value,ref:document.getElementById('order-ref').value,amount:document.getElementById('order-amount').value,from:document.getElementById('order-from').value,to:document.getElementById('order-to').value};render();};
    document.getElementById('order-reset').onclick=()=>{view.orderFilters={};render();};
    document.getElementById('order-export').onclick=()=>exportTable('.orders-table table');
    document.getElementById('upload-sync-orders').onclick=()=>pickAndSync(file=>{recordUpload('order',file.name);render();toast(`「${file.name}」已上传。没进来的明细可以在操作记录里查看`);});
    document.getElementById('order-audit').onclick=openSyncLog;
  }
  function renderCustomers(){
    document.getElementById('content').innerHTML=`<div class="panel table-panel legacy-panel customer-panel"><div class="table-head"><b>客户管理</b><button class="btn primary" id="new-customer">+ 新增客户</button></div><div class="table-wrap"><table><thead><tr><th>ID</th><th>客户名称</th><th>服务费率%</th><th>保证金比例%</th><th>业务组</th><th>目标提现币种</th><th>保证金上限</th><th>创建时间</th><th>操作</th></tr></thead><tbody>${state.customers.map((c,i)=>`<tr><td>${i+1}</td><td>${esc(c.name)}</td><td><span class="tag tag-orange">${(c.service/100).toFixed(1)}</span></td><td><span class="tag tag-orange">${(c.reserve/100).toFixed(0)}</span></td><td><span class="tag tag-gray">示例业务组</span></td><td><span class="tag tag-blue">${c.currency}</span></td><td><span class="tag ${i===2?'tag-mint':'tag-none'}">${i===2?'50000':'不限制'}</span></td><td>2026-10-${String(13+i).padStart(2,'0')} 14:${String(34+i).padStart(2,'0')}</td><td class="ops customer-ops"><button class="mini-btn" data-shop="${c.id}">查看店铺</button><button class="mini-btn primary" data-config="${c.id}">编辑</button><button class="mini-btn danger" data-delete="${c.id}">删除</button></td></tr>`).join('')}</tbody></table></div></div>`;
    document.getElementById('new-customer').onclick=openCustomer;
    document.querySelectorAll('[data-shop]').forEach(b=>b.onclick=()=>{view.customer=b.dataset.shop;view.currency=R.customer(state,view.customer).currency;nav('orders');});
    document.querySelectorAll('[data-config]').forEach(b=>b.onclick=()=>{view.customer=b.dataset.config;view.currency=R.customer(state,view.customer).currency;openConfig();});
    document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>toast('演示原型不删除客户，仅保留操作入口'));
  }
  function renderFund(){const c=customer(), accts=state.accounts.filter(a=>a.customer===c.id);document.getElementById('content').innerHTML=`<div class="page-head"><div><h1>Fund 联动</h1><p>Fund 是资金账户余额、调拨和手动调整的账本来源；垫资对账系统只接收同步结果并触发客户余额入账请求。</p></div><div class="head-actions"><button class="btn" id="mirror">回传余额快照</button><button class="btn" id="opening">维护期初余额</button><button class="btn primary" id="operation">发起调拨 / 手动调整</button></div></div><div class="panel"><div class="notice">${icon('!')} 只有飞书审批通过并且 Fund 执行成功，才会改变账户余额。失败或待执行记录不计入余额。</div><div class="table-wrap"><table><thead><tr><th>资金账户</th><th>平台</th><th>币种</th><th>期初余额</th><th>Fund 账面余额</th><th>渠道余额</th><th>冻结金额</th><th>最近同步</th><th>操作</th></tr></thead><tbody>${accts.map(a=>`<tr><td><b>${a.id}</b><span class="sub">${c.name}</span></td><td>${a.channel}</td><td>${a.currency}</td><td>${a.opening===null?badge('未设置'):money(a.opening,a.currency)}<span class="sub">${a.openingAt||''}</span></td><td class="money">${a.opening===null?'待设置':money(R.fundBalance(state,a.id),a.currency)}</td><td class="money">${money(a.channelBalance,a.currency)}</td><td class="money">${money(a.frozen,a.currency)}</td><td>${a.channelAt}</td><td><button class="link" data-account="${a.id}">账户流水</button></td></tr>`).join('')}</tbody></table></div></div><div class="panel table-panel"><div class="table-head"><b>审批与执行记录</b><span class="sub">调拨 / 手动调整</span></div><div class="table-wrap"><table><thead><tr><th>申请单号</th><th>类型</th><th>金额</th><th>审批</th><th>执行</th><th>回传</th><th>操作</th></tr></thead><tbody>${state.operations.filter(o=>state.accounts.some(a=>a.id===o.source&&a.customer===c.id)).map(o=>`<tr><td class="mono">${o.id}</td><td>${o.type==='transfer'?'跨账户调拨':'手动调整'}</td><td class="money">${money(o.amount,c.currency)}</td><td>${badge(o.approval)}</td><td>${badge(o.execution)}</td><td>${badge(o.callback)}</td><td class="ops">${o.approval==='审批中'?`<button class="link" data-approve="${o.id}">模拟审批通过</button>`:''}${o.approval==='已通过'&&o.execution!=='执行成功'?`<button class="link" data-execute="${o.id}">模拟 Fund 执行</button>`:''}</td></tr>`).join('')||`<tr><td colspan="7" class="empty">暂无调拨或调额记录</td></tr>`}</tbody></table></div></div>`;document.getElementById('mirror').onclick=()=>{R.mirror(state);toast('余额快照已回传');render();};document.getElementById('opening').onclick=()=>openOpening();document.getElementById('operation').onclick=()=>openOperation();document.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>{R.approve(state,b.dataset.approve,true);toast('已模拟飞书审批通过，等待 Fund 执行');render();});document.querySelectorAll('[data-execute]').forEach(b=>b.onclick=()=>{try{toast(R.execute(state,b.dataset.execute));render();}catch(e){toast(e.message);}});document.querySelectorAll('[data-account]').forEach(b=>b.onclick=()=>{view.account=b.dataset.account;view.page='flows';view.q=b.dataset.account;render();});}
  function openPeriod(id){const p=id?R.period(state,id):null;if(p&&!R.editable(p)){openCorrection(id);return;}modal={type:'period',id:id||'',start:p?.start||R.addDays(state.periods.filter(p=>p.customer===view.customer).map(p=>p.end).sort().at(-1),1),end:p?.end||R.addDays(state.periods.filter(p=>p.customer===view.customer).map(p=>p.end).sort().at(-1),customer().days),reason:''};renderModal();}
  function openConfig(){const c=customer();modal={type:'config',days:c.days,service:c.service/100,reserve:c.reserve/100};renderModal();}
  function openCustomer(){showDialog('新增客户','<p class="modal-note">当前原型保留新增客户入口，客户主数据仍由 Fund/客户管理维护。</p>','<button class="btn primary" id="customer-save">保存</button>');document.getElementById('customer-save').onclick=()=>{closeModal();toast('新增客户入口已保留，演示不写入主数据');};}
  function openConfirm(id){modal={type:'confirm',id,reference:''};renderModal();}
  function openMove(id){const f=state.flows.find(x=>x.id===id);modal={type:'move',id,target:f.period,reason:''};renderModal();}
  function openFlow(id){const f=state.flows.find(x=>x.id===id);modal={type:'flow',flow:f};renderModal();}
  function openStatement(id){const p=R.period(state,id);modal={type:'statement',id};renderModal();}
  function openOpening(){const a=state.accounts.find(a=>a.customer===view.customer&&a.opening===null)||state.accounts.find(a=>a.customer===view.customer);modal={type:'opening',account:a?.id||'',amount:'',date:'2026-10-12',reason:''};renderModal();}
  function openOperation(){const accts=state.accounts.filter(a=>a.customer===view.customer);modal={type:'operation',op:'transfer',source:accts[0]?.id||'',target:accts[1]?.id||accts[0]?.id||'',amount:'',reason:''};renderModal();}
  function closeModal(){modal=null;overlay.innerHTML='';}
  function field(id,label,value,type='text',extra=''){return `<label>${label}<input id="${id}" type="${type}" value="${esc(value??'')}" ${extra}></label>`;}
  function renderModal(){if(!modal){overlay.innerHTML='';return;}let body='';
    if(modal.type==='period') body=`<h3>${modal.id?'调整对账周期':'新建对账周期'}<button id="x">×</button></h3><div class="modal-body"><div class="modal-note">周期调整会重算受影响余额。已确认周期不能直接覆盖，请在对账管理提交更正申请。</div>${field('m-start','开始日期',modal.start,'date')}${field('m-end','结束日期',modal.end,'date')}${field('m-reason','调整原因',modal.reason)}${modal.id?'':`<p class="hint">默认配置：${customer().days} 天（可在客户管理调整）</p>`}</div><div class="modal-foot"><button class="btn" id="cancel">取消</button><button class="btn primary" id="save">保存</button></div>`;
    if(modal.type==='config') body=`<h3>客户对账参数<button id="x">×</button></h3><div class="modal-body">${field('m-days','默认周期天数',modal.days,'number','min="1" max="90"')}${field('m-service','服务费率（%）',modal.service,'number','step="0.01" min="0" max="100"')}${field('m-reserve','保证金比例（%）',modal.reserve,'number','step="0.01" min="0" max="100"')}<p class="hint">仅新生成周期使用，历史周期保留当时的费率快照。</p></div><div class="modal-foot"><button class="btn" id="cancel">取消</button><button class="btn primary" id="save">保存</button></div>`;
    if(modal.type==='confirm') body=`<h3>登记客户确认<button id="x">×</button></h3><div class="modal-body"><div class="confirm-box">客户已在线下确认。登记后对账单会锁定，财务可执行余额结算并向 Fund 发起入账。</div>${field('m-ref','客户确认凭据 / 记录编号',modal.reference)}</div><div class="modal-foot"><button class="btn" id="cancel">取消</button><button class="btn primary" id="save">登记确认</button></div>`;
    if(modal.type==='move'){const f=state.flows.find(x=>x.id===modal.id);body=`<h3>调整流水所属周期<button id="x">×</button></h3><div class="modal-body"><div class="detail"><b>${f.id}</b><span>${f.channel} · ${money(f.amount,f.currency)} · ${f.bill}</span></div><label>目标周期<select id="m-target">${state.periods.filter(p=>p.customer===f.customer&&p.currency===f.currency&&R.editable(p)).map(p=>`<option value="${p.id}" ${p.id===modal.target?'selected':''}>${p.start} ~ ${p.end}</option>`).join('')}</select></label>${field('m-reason','调整原因',modal.reason)}</div><div class="modal-foot"><button class="btn" id="cancel">取消</button><button class="btn primary" id="save">保存改期</button></div>`;}
    if(modal.type==='flow'){const f=modal.flow,p=state.periods.find(p=>p.id===f.period),c=state.customers.find(x=>x.id===f.customer);body=`<h3>渠道流水详情<button id="x">×</button></h3><div class="modal-body"><dl class="detail-grid">${[['客户 ID',f.customer],['客户名称',c?.name||f.customer],['Fund 流水 ID',f.id],['平台',f.channel],['资金账户',f.account],['Event ID',f.eventId],['账单号',f.bill],['类型',f.type],['金额',money(f.amount,f.currency)],['手续费',money(f.fee,f.currency)],['原始周期',f.originalPeriod],['当前周期',p?`${p.start} ~ ${p.end}`:'—'],['来源',f.source],['匹配状态',R.flowStatus(state,f)]].map(([a,b])=>`<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl></div><div class="modal-foot"><button class="btn primary" id="cancel">关闭</button></div>`;}
    if(modal.type==='statement'){const p=R.period(state,modal.id),x=R.calc(state,p.id);body=`<h3>费用明细 · ${p.start} ~ ${p.end}<button id="x">×</button></h3><div class="modal-body"><dl class="detail-grid">${[['匹配金额',money(x.gross,p.currency)],['退款',money(x.refund,p.currency)],['拒付 / 追回',money(x.dispute,p.currency)],['渠道手续费',money(x.fee,p.currency)],['服务费',money(x.service,p.currency)],['保证金',money(x.reserve,p.currency)],['人工调整',money(x.manual,p.currency)],['本期结算余额',money(x.total,p.currency)]].map(([a,b])=>`<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl><div class="modal-note">服务费和保证金按客户配置计算；历史周期使用自身费率快照。</div><h4>增加额外费用或调整</h4><label>资金账户<select id="m-account">${Object.keys(x.byAccount).map(id=>`<option value="${id}">${id}</option>`).join('')}</select></label>${field('m-amount','金额（可正可负）','')}${field('m-reason','原因','')}</div><div class="modal-foot"><button class="btn" id="cancel">关闭</button><button class="btn primary" id="save">保存调整</button></div>`;}
    if(modal.type==='opening'){const accts=state.accounts.filter(a=>a.customer===view.customer);body=`<h3>维护账户期初余额<button id="x">×</button></h3><div class="modal-body"><label>资金账户<select id="m-account">${accts.map(a=>`<option value="${a.id}" ${a.id===modal.account?'selected':''}>${a.id} · ${a.channel} · ${a.currency}</option>`).join('')}</select></label>${field('m-amount','期初余额','')}${field('m-date','期初基准日',modal.date,'date')}${field('m-reason','余额依据',modal.reason)}<p class="hint">已生效期初不能覆盖，后续更正走 Fund 审批调额。</p></div><div class="modal-foot"><button class="btn" id="cancel">取消</button><button class="btn primary" id="save">提交期初</button></div>`;}
    if(modal.type==='operation'){const accts=state.accounts.filter(a=>a.customer===view.customer);body=`<h3>发起 Fund 资金操作<button id="x">×</button></h3><div class="modal-body"><label>操作类型<select id="m-op"><option value="transfer">跨账户资金调拨</option><option value="adjust">单账户手动调整</option></select></label><label>来源账户<select id="m-source">${accts.map(a=>`<option value="${a.id}">${a.id} · ${a.channel}</option>`).join('')}</select></label><label id="target-wrap">目标账户<select id="m-target">${accts.map(a=>`<option value="${a.id}" ${a.id===modal.target?'selected':''}>${a.id} · ${a.channel}</option>`).join('')}</select></label>${field('m-amount','金额','')}${field('m-reason','申请原因',modal.reason)}<p class="hint">提交后进入飞书审批。审批通过不等于资金已入账，执行成功后才更新 Fund 余额。</p></div><div class="modal-foot"><button class="btn" id="cancel">取消</button><button class="btn primary" id="save">提交审批</button></div>`;}
    overlay.innerHTML=`<div class="modal-mask"><section class="modal" role="dialog" aria-modal="true" aria-label="操作详情">${body}</section></div>`;document.getElementById('x').onclick=closeModal;document.getElementById('cancel').onclick=closeModal;document.getElementById('x').focus();const save=document.getElementById('save');if(save)save.onclick=()=>submitModal();if(modal.type==='statement'&&!R.editable(R.period(state,modal.id))){save.disabled=true;save.textContent='已确认，修改需提交更正申请';}if(modal.type==='period'&&!modal.id){document.getElementById('m-start').onchange=e=>{if(e.target.value)document.getElementById('m-end').value=R.addDays(e.target.value,customer().days-1);};}
    if(modal.type==='operation'){document.getElementById('m-op').onchange=e=>{modal.op=e.target.value;document.getElementById('target-wrap').style.display=e.target.value==='transfer'?'block':'none';};}
  }
  function val(id){return document.getElementById(id)?.value?.trim()||'';}
  function submitModal(){try{if(modal.type==='period'){if(modal.id)R.adjustPeriod(state,modal.id,val('m-start'),val('m-end'),val('m-reason'));else R.createPeriod(state,view.customer,val('m-start'),val('m-end'));toast('周期已保存');}
    else if(modal.type==='config'){R.configure(state,view.customer,Number(val('m-days')),Math.round(Number(val('m-service'))*100),Math.round(Number(val('m-reserve'))*100));toast('客户参数已保存');}
    else if(modal.type==='confirm'){R.confirm(state,modal.id,val('m-ref'));toast('客户确认已登记');}
    else if(modal.type==='move'){R.moveFlow(state,modal.id,val('m-target'),val('m-reason'));toast('流水所属周期已调整');}
    else if(modal.type==='statement'){const a=val('m-account'),amt=parseAmount(val('m-amount'));R.addAdjustment(state,modal.id,a,amt,val('m-reason'));toast('金额调整已保存');}
    else if(modal.type==='opening'){R.initialise(state,val('m-account'),parseAmount(val('m-amount')),val('m-date'),val('m-reason'));toast('期初余额已生效');}
    else if(modal.type==='operation'){const amt=parseAmount(val('m-amount'));R.requestOperation(state,val('m-op'),val('m-source'),val('m-target'),amt,val('m-reason'));toast('已提交飞书审批');}
    closeModal();render();}catch(e){toast(e.message);}}
  function exportTable(selector){const table=document.querySelector(selector);exportRows([...table.tBodies[0].rows].filter(r=>!r.querySelector('.empty')).map(r=>[...r.cells].map(c=>c.textContent.trim())),[...table.tHead.rows[0].cells].map(c=>c.textContent.trim()));}
  function exportRows(rows,headers){const csv=[headers,...rows].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='垫资对账导出.csv';a.click();URL.revokeObjectURL(a.href);}
  function parseAmount(text) {
    if(!/^-?\d+(\.\d{1,2})?$/.test(text)) throw new Error('请输入有效金额，最多两位小数');
    const sign=text[0]==='-'?-1:1, [integer,fraction='']=text.replace('-','').split('.');
    const value=sign*(Number(integer)*100+Number(fraction.padEnd(2,'0')));
    if(!Number.isSafeInteger(value)) throw new Error('金额超出可计算范围');
    return value;
  }
  function showDialog(title,body,footer='') {
    overlay.innerHTML=`<div class="modal-mask"><section class="modal wide" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}<button id="x" aria-label="关闭">×</button></h3><div class="modal-body">${body}</div><div class="modal-foot">${footer}<button class="btn" id="cancel">关闭</button></div></section></div>`;
    document.getElementById('x').onclick=closeModal;document.getElementById('cancel').onclick=closeModal;document.getElementById('x').focus();
  }
  function renderReset(){showDialog('重置演示数据','<p>清除本原型的本地操作，恢复示例客户、周期和 Fund 记录。</p>','<button class="btn primary" id="do-reset">恢复初始演示</button>');document.getElementById('do-reset').onclick=()=>{state=R.seed();view.customer='DEMO-1001';view.currency='EUR';view.period='';view.q='';view.status='';view.channel='';view.page='balances';closeModal();render();toast('已恢复初始演示');};}
  function openCorrection(id){showDialog('已确认周期更正申请',`<p>对账单 ${esc(id)} 已锁定。更正申请会保留历史版本和原入账结果，不直接覆盖余额。</p>${field('cor-reason','更正原因','')}<p class="hint">更正审批与冲正入账规则待确认，本原型仅演示申请记录。</p>`,'<button class="btn primary" id="cor-save">提交更正申请</button>');document.getElementById('cor-save').onclick=()=>{try{R.correction(state,id,val('cor-reason'));closeModal();render();toast('更正申请已记录，原余额保持不变');}catch(e){toast(e.message);}};}
  let syncFilter={kind:'all', issue:false, batch:null};
  function nowText(){const d=new Date(Date.now()+8*3600000);return d.toISOString().slice(0,16).replace('T',' ');}
  function gapRow(customer,channel,ref,amount,time,reason,action,situation){return {situation:situation||'失败',customer,channel,ref,amount,time,reason,action};}
  function demoSyncBatches(){
    return [
      {id:'SYNC-1102-18', time:'2026-11-02 14:20', kind:'flow', trigger:'Fund 定时同步', channel:'PayPal', status:'部分失败', requested:36, success:29, failed:5, duplicate:2, deduped:29, delay:'', note:'失败的 5 条没有进入平台收款明细。列表里已有的流水还在，不受这次同步影响。', gaps:[
        gapRow('示例商户 A','PayPal','REF-PP-88421','1,280.00 EUR','2026-11-02 09:12','资金账户无法匹配到商户','确认账户后，用 Excel 人工上传这一条'),
        gapRow('示例商户 B','PayPal','REF-PP-88455','640.50 EUR','2026-11-02 09:40','客户无法识别','补上客户编码后再上传'),
        gapRow('—','PayPal','REF-PP-88502','—','2026-11-02 10:05','金额或币种为空，字段校验未通过','补全金额和币种后上传'),
        gapRow('示例商户 C','PayPal','—','88.00 USD','2026-11-02 10:18','渠道账单号缺失，无法去重','补上账单号再上传，避免和已有流水重复'),
        gapRow('示例商户 A','PayPal','REF-PP-88610','2,100.00 EUR','2026-11-02 11:02','交易时间无法解析','按 UTC+8 写好交易时间后上传')
      ]},
      {id:'SYNC-1102-15', time:'2026-11-02 13:05', kind:'order', trigger:'店铺订单拉取', channel:'Shopify Payments', status:'同步延迟', requested:20, success:14, failed:0, duplicate:0, deduped:14, delay:'Shopify 预计今天 16:00 前把剩余 6 条订单补回来。16:00 之前不用人工上传；到点仍缺，再按下面的单号导出并补 Excel。', note:'已到的 14 条已进入店铺订单。另外 6 条还在延迟，先不要当成失败。', gaps:[
        gapRow('示例商户 A','Shopify Payments','SO-10441','320.00 USD','2026-11-02 08:10','渠道接口还没返回这条订单','等到今天 16:00；超时仍缺再人工上传','延迟未到'),
        gapRow('示例商户 A','Shopify Payments','SO-10442','86.40 USD','2026-11-02 08:16','渠道接口还没返回这条订单','等到今天 16:00；超时仍缺再人工上传','延迟未到'),
        gapRow('示例商户 B','Shopify Payments','SO-10458','1,050.00 EUR','2026-11-02 08:40','渠道接口还没返回这条订单','等到今天 16:00；超时仍缺再人工上传','延迟未到'),
        gapRow('示例商户 B','Shopify Payments','SO-10460','210.00 EUR','2026-11-02 08:44','渠道接口还没返回这条订单','等到今天 16:00；超时仍缺再人工上传','延迟未到'),
        gapRow('示例商户 C','Shopify Payments','SO-10477','64.00 USD','2026-11-02 09:02','渠道接口还没返回这条订单','等到今天 16:00；超时仍缺再人工上传','延迟未到'),
        gapRow('示例商户 C','Shopify Payments','SO-10481','418.20 USD','2026-11-02 09:15','渠道接口还没返回这条订单','等到今天 16:00；超时仍缺再人工上传','延迟未到')
      ]},
      {id:'SYNC-1102-09', time:'2026-11-02 09:30', kind:'flow', trigger:'人工上传', channel:'Airwallex', status:'已完成', requested:9, success:8, failed:0, duplicate:1, deduped:8, delay:'', note:'8 条新流水已入列表。重复的 1 条已忽略，没有再次入账。', gaps:[]},
      {id:'SYNC-1101-21', time:'2026-11-01 21:00', kind:'flow', trigger:'Fund 定时同步', channel:'四渠道', status:'已完成', requested:52, success:52, failed:0, duplicate:0, deduped:52, delay:'', note:'本批次 52 条全部进入平台收款明细。', gaps:[]},
      {id:'SYNC-1101-16', time:'2026-11-01 16:40', kind:'order', trigger:'店铺订单拉取', channel:'Worldpay', status:'同步失败', requested:3, success:0, failed:3, duplicate:0, deduped:0, delay:'', note:'这 3 条订单整批没有进来。店铺订单里已有的数据还在，没有被清掉。', gaps:[
        gapRow('示例商户 A','Worldpay','WP-22011','560.00 EUR','2026-11-01 15:12','渠道超时，本条没有返回','稍后重试同步；对账截止前仍没有，就人工上传'),
        gapRow('示例商户 B','Worldpay','WP-22018','90.00 EUR','2026-11-01 15:20','渠道超时，本条没有返回','稍后重试同步；对账截止前仍没有，就人工上传'),
        gapRow('示例商户 C','Worldpay','WP-22024','1,430.00 USD','2026-11-01 15:33','渠道超时，本条没有返回','稍后重试同步；对账截止前仍没有，就人工上传')
      ]}
    ];
  }
  function ensureSyncBatches(){if(!Array.isArray(state.syncBatches)||!state.syncBatches.length) state.syncBatches=demoSyncBatches();}
  function kindName(kind){return kind==='flow'?'平台收款流水':'店铺订单';}
  function recordSyncBatch(batch){ensureSyncBatches();state.syncBatches.unshift(batch);}
  function recordIngest(kind,trigger,channel,result){
    const success=result.added||0, failed=result.failed||0, duplicate=result.duplicates||0;
    const reasons=['客户或资金账户无法识别','金额或币种为空，字段校验未通过','交易时间无法解析','渠道账单号缺失，无法去重'];
    recordSyncBatch({
      id:'SYNC-'+Date.now().toString().slice(-6), time:nowText(), kind, trigger, channel, delay:'',
      status:failed?(success?'部分失败':'同步失败'):'已完成',
      requested:success+failed+duplicate, success, failed, duplicate, deduped:success,
      note:failed?`失败的 ${failed} 条没有进入${kindName(kind)}。已有明细不受影响。`:(duplicate&&!success?`没有新明细。重复的 ${duplicate} 条已忽略，列表保持原样。`:`本批次已进入${kindName(kind)}。`),
      gaps:Array.from({length:failed},(_,i)=>gapRow('示例商户 '+['A','B','C'][i%3], channel, '未入账-'+(i+1), '—', '—', reasons[i%reasons.length], '按原因整理 Excel，用上传并同步补录'))
    });
  }
  function recordUpload(kind,filename){
    const name=kindName(kind);
    recordSyncBatch({
      id:'SYNC-UP-'+Date.now().toString().slice(-6), time:nowText(), kind, trigger:'人工上传', channel:'Excel', delay:'',
      status:'部分失败', requested:11, success:8, failed:2, duplicate:1, deduped:8,
      note:`「${filename}」有 2 条没进入${name}。重复的 1 条已忽略。`,
      gaps:[
        gapRow('示例商户 A','Excel','上传行 4','—','—','客户或资金账户无法识别','改好这一行后重新上传'),
        gapRow('示例商户 B','Excel','上传行 9','—','—','金额或币种为空，字段校验未通过','补全金额和币种后重新上传')
      ]
    });
  }
  function syncBanner(){
    const failed=state.syncBatches.find(b=>b.failed>0);
    const delayed=state.syncBatches.find(b=>b.status==='同步延迟');
    if(failed) return `<div class="sync-banner bad"><div><b>${failed.failed} 条明细没有进列表</b><p>${esc(failed.time)} 的${esc(kindName(failed.kind))}（${esc(failed.channel)}）失败了。这些不是延迟，不会自己补上。打开失败明细，按原因整理 Excel，再用「上传并同步」补录。</p></div><button class="btn primary" data-sync-batch="${esc(failed.id)}">查看失败明细</button></div>`;
    if(delayed) return `<div class="sync-banner warn"><div><b>有渠道还在延迟返回</b><p>${esc(delayed.delay)}</p></div><button class="btn" data-sync-batch="${esc(delayed.id)}">查看未到达明细</button></div>`;
    return `<div class="sync-banner ok"><div><b>最近的批次都已进列表</b><p>没有需要人工补录的明细。</p></div></div>`;
  }
  function batchCard(b){
    const pill=b.status==='已完成'?'ok':b.status==='同步延迟'?'warn':'bad';
    const action=b.failed?`<button class="btn" data-sync-batch="${esc(b.id)}">查看失败明细</button>`:(b.status==='同步延迟'?`<button class="btn" data-sync-batch="${esc(b.id)}">查看未到达明细</button>`:'');
    return `<article class="sync-batch"><div class="sync-batch-top"><div><b>${esc(kindName(b.kind))}</b><span class="sync-meta">${esc(b.time)} · ${esc(b.trigger)} · ${esc(b.channel)} · ${esc(b.id)}</span></div><span class="sync-pill ${pill}">${esc(b.status)}</span></div><div class="sync-metrics"><div class="sync-metric ok"><b>${b.success}</b><span>成功</span></div><div class="sync-metric ${b.failed?'bad':''}"><b>${b.failed}</b><span>失败</span></div><div class="sync-metric ${b.duplicate?'warn':''}"><b>${b.duplicate}</b><span>重复</span></div><div class="sync-metric"><b>${b.deduped}</b><span>去重后</span></div></div><div class="sync-gap"><span>${esc(b.note)}</span>${action}</div></article>`;
  }
  function gapBody(b){
    const rows=(b.gaps||[]).map(g=>`<tr><td><span class="sync-pill ${g.situation==='失败'?'bad':'warn'}">${esc(g.situation)}</span></td><td>${esc(g.customer)}</td><td>${esc(g.channel)}</td><td>${esc(g.ref)}</td><td>${esc(g.amount)}</td><td>${esc(g.time)}</td><td>${esc(g.reason)}</td><td>${esc(g.action)}</td></tr>`).join('');
    const banner=b.delay?`<div class="sync-banner warn"><div><b>这批是延迟，不是失败</b><p>${esc(b.delay)}</p></div></div>`:(b.failed?`<div class="sync-banner bad"><div><b>下面这些明细没有进入列表</b><p>按「建议」改好 Excel，回到页面点「上传并同步」。已在列表里的明细不会被这次失败清掉。</p></div></div>`:'');
    return `<div class="sync-log">${banner}<div class="sync-batch-top"><div><b>${esc(kindName(b.kind))} · ${esc(b.channel)}</b><span class="sync-meta">${esc(b.time)} · ${esc(b.id)} · 成功 ${b.success} · 失败 ${b.failed} · 重复 ${b.duplicate} · 去重后 ${b.deduped}</span></div></div><div class="table-wrap"><table class="sync-table"><thead><tr><th>情况</th><th>客户</th><th>渠道</th><th>单号</th><th>金额</th><th>时间</th><th>原因</th><th>建议</th></tr></thead><tbody>${rows||'<tr><td colspan="8" class="empty">这批没有未同步明细</td></tr>'}</tbody></table></div></div>`;
  }
  function bindSyncLog(){
    overlay.querySelectorAll('[data-sync-kind]').forEach(btn=>{btn.onclick=()=>{syncFilter.kind=btn.dataset.syncKind;syncFilter.issue=false;syncFilter.batch=null;renderSyncLog();};});
    const issue=document.getElementById('sync-issue');
    if(issue) issue.onclick=()=>{syncFilter.issue=!syncFilter.issue;syncFilter.batch=null;renderSyncLog();};
    overlay.querySelectorAll('[data-sync-batch]').forEach(btn=>{btn.onclick=()=>{syncFilter.batch=btn.dataset.syncBatch;renderSyncLog();};});
    const back=document.getElementById('sync-back');
    if(back) back.onclick=()=>{syncFilter.batch=null;renderSyncLog();};
    const exp=document.getElementById('sync-export');
    if(exp) exp.onclick=()=>{const b=state.syncBatches.find(x=>x.id===syncFilter.batch);if(!b)return;exportRows((b.gaps||[]).map(g=>[g.situation,g.customer,g.channel,g.ref,g.amount,g.time,g.reason,g.action]),['情况','客户','渠道','单号','金额','时间','原因','处理建议']);};
  }
  function renderSyncLog(){
    ensureSyncBatches();
    const current=syncFilter.batch&&state.syncBatches.find(b=>b.id===syncFilter.batch);
    if(current){
      showDialog('未同步明细', gapBody(current), `<button class="btn" id="sync-back">返回批次</button><button class="btn" id="sync-export">导出这些明细</button>`);
    }else{
      const list=state.syncBatches.filter(b=>(syncFilter.kind==='all'||b.kind===syncFilter.kind)&&(!syncFilter.issue||b.status!=='已完成'));
      const chips=[['all','全部'],['flow','平台收款流水'],['order','店铺订单']].map(([k,label])=>`<button class="sync-chip ${syncFilter.kind===k?'on':''}" data-sync-kind="${k}">${label}</button>`).join('')+`<button class="sync-chip ${syncFilter.issue?'on':''}" id="sync-issue">只看未完成</button>`;
      const body=`<div class="sync-log">${syncBanner()}<div class="sync-chips">${chips}</div><p class="sync-legend">去重后是本批次新进入列表的条数，重复的不计入。失败需要人工上传；延迟是渠道还没返回，到点仍缺再补。</p>${list.map(batchCard).join('')||'<div class="empty">这个范围里还没有同步批次</div>'}</div>`;
      showDialog('操作记录', body);
    }
    const dialog=overlay.querySelector('.modal'); if(dialog) dialog.classList.add('sync-modal');
    bindSyncLog();
  }
  function openSyncLog(){syncFilter={kind:'all',issue:false,batch:null};renderSyncLog();}
  function auditDialog(object='') {const logs=state.audit.filter(l=>!object||l.object===object);showDialog('操作记录',`<ol class="timeline">${logs.map(l=>`<li><time>${esc(l.time.replace('T',' ').slice(0,19))} UTC</time><b>${esc(l.type)} · ${esc(l.object)}</b><p>${esc(l.detail)}</p><small>${esc(l.operator)}</small></li>`).join('')||'<p>此记录暂无变更</p>'}</ol>`);}
  function balanceHistory(){
    const c=customer(), as=state.accounts.filter(a=>a.customer===c.id), s=R.summary(state,c.id);
    if(s.opening===null)return '<p class="empty">尚未设置完整期初余额，请先到 Fund 联动维护期初。</p>';
    const items=[{time:'2026-10-12 23:59:59',type:'期初余额',id:'OPENING',amount:s.opening,status:'已生效',detail:as.map(a=>a.id).join('、')}];
    state.periods.filter(p=>p.customer===c.id&&!R.editable(p)).forEach(p=>items.push({time:p.end+' 23:59:59',type:'周期结算',id:p.id,amount:R.calc(state,p.id).total,status:p.status==='synced'?'已入账':p.status==='failed'?'同步失败':'待入账',detail:p.start+' ~ '+p.end}));
    state.events.filter(e=>e.customer===c.id&&e.kind!=='settlement').forEach(e=>items.push({time:e.time.slice(0,19).replace('T',' '),type:e.kind==='transfer'?'Fund 调拨':'Fund 手调',id:e.reference,amount:e.delta,status:state.operations.find(o=>o.id===e.reference)?.callback||'已回传',detail:e.account}));
    items.sort((a,b)=>a.time.localeCompare(b.time)||a.id.localeCompare(b.id));let balance=0;
    return `<div class="table-wrap"><table class="history"><thead><tr><th>业务时间 / 归属日</th><th>来源</th><th>单号 / 账户</th><th>变动前余额</th><th>变动金额</th><th>变动后余额</th><th>处理状态</th></tr></thead><tbody>${items.map(i=>{const before=balance;balance+=i.amount;return `<tr><td>${i.time}</td><td>${i.type}</td><td><b>${i.id}</b><span class="sub">${i.detail}</span></td><td class="money">${money(before,c.currency)}</td><td class="money ${i.amount<0?'minus':'plus'}">${money(i.amount,c.currency)}</td><td class="money"><b>${money(balance,c.currency)}</b></td><td>${badge(i.status)}</td></tr>`;}).join('')}</tbody></table></div><p class="small-note">周期按结束日排列，未确认周期不累计；Fund 调拨两条记录分别展示，同客户同币种净额为零。期初不包含此后的结算明细。</p>`;
  }
  function accountLedger(id){const a=R.account(state,id);showDialog('Fund 账户记账记录 · '+id,`<p>期初：${a.opening===null?'未设置':money(a.opening,a.currency)}　当前：${a.opening===null?'未设置':money(R.fundBalance(state,id),a.currency)}</p><div class="table-wrap"><table><thead><tr><th>Fund 事件</th><th>类型</th><th>变动金额</th><th>关联单号</th></tr></thead><tbody>${state.events.filter(e=>e.account===id).map(e=>`<tr><td>${e.id}</td><td>${e.kind}</td><td>${money(e.delta,e.currency)}</td><td>${e.reference}</td></tr>`).join('')||'<tr><td colspan="4">暂无期初后变动</td></tr>'}</tbody></table></div><p class="hint">渠道流水用于对账；周期入账事件用于余额池记账，两种来源不重复叠加。</p>`);}
  function matchingDetail(oid){const o=state.orders.find(o=>o.id===oid), fs=state.flows.filter(f=>matchesOrder(o,f));showDialog('订单关联流水 · '+oid,`<p>${esc(o.store)} · 订单金额 ${money(o.amount,o.currency)} · ${esc(o.refs.join('、'))}</p><div class="table-wrap"><table><thead><tr><th>事件 ID</th><th>类型</th><th>金额</th><th>手续费</th><th>周期</th></tr></thead><tbody>${fs.map(f=>`<tr><td>${f.eventId}</td><td>${f.type}</td><td>${money(f.amount,f.currency)}</td><td>${money(f.fee,f.currency)}</td><td>${f.period}</td></tr>`).join('')||'<tr><td colspan="5">未找到对应流水，请核查 Fund 账单号与 Shopify Payment Refs。</td></tr>'}</tbody></table></div><p>渠道准备金和换汇流水保留供账户核对，本原型不把它们再次作为客户保证金扣除。</p>`);}
  function selectedOrders(){return state.orders.filter(o=>o.customer===view.customer&&o.currency===view.currency&&(!view.from||o.date>=view.from)&&(!view.to||o.date<=view.to)&&(!view.period||state.flows.some(f=>f.period===view.period&&matchesOrder(o,f))||(()=>{const p=R.period(state,view.period);return o.date>=p.start&&o.date<=p.end;})()));}
  function enhancePage(){
    document.querySelectorAll('label').forEach(l=>{const next=l.nextElementSibling;if(next?.id&&!l.htmlFor)l.htmlFor=next.id;});
    const content=document.getElementById('content');

    if(view.page!=='flows'){const auditButton=document.createElement('button');auditButton.className='btn';auditButton.textContent='操作记录';auditButton.onclick=()=>auditDialog();document.querySelector('.page-head')?.append(auditButton);}
    if(view.page==='balances'){ /* 余额表自己渲染三层结构，不再追加旧的汇总看板。 */ }
    if(view.page==='flows'){
      const status=document.getElementById('status');
      if(status?.closest('div')) status.closest('div').style.display='none';
      const lastSync=state.lastSync;if(lastSync?.quarantined)document.querySelector('.sync-line').insertAdjacentHTML('beforeend','<span class="red">　锁定周期或映射缺失的流水待人工核查，未自动入账</span>');
    }
    if(view.page==='orders'){ /* 店铺订单明细使用自身筛选，不再套用余额表筛选增强逻辑。 */ }
    if(view.page==='statements'){
      document.querySelectorAll('[data-statement-detail]').forEach(b=>{
        const p=R.period(state,b.dataset.statementDetail), ex=document.createElement('button');ex.className='link';ex.textContent='导出对账单';ex.onclick=()=>{const x=R.calc(state,p.id);exportRows([['收款',x.gross/100],['退款',x.refund/100],['拒付 / 追回',x.dispute/100],['渠道手续费',x.fee/100],['服务费',x.service/100],['保证金',x.reserve/100],['人工调整',x.manual/100],['本期结算余额',x.total/100]],['项目（'+p.start+' ~ '+p.end+'）',p.currency]);};b.after(ex);
      });
      document.querySelectorAll('[data-sync]').forEach(b=>{const fail=document.createElement('button');fail.className='link muted';fail.textContent='演示同步失败';fail.onclick=()=>{toast(R.syncSettlement(state,b.dataset.sync,true));render();};b.after(fail);});
      if(state.corrections.length)content.insertAdjacentHTML('beforeend',`<div class="panel"><b>更正申请</b>${state.corrections.filter(x=>R.period(state,x.period).customer===view.customer).map(x=>`<p>${esc(x.id)} · ${esc(x.period)} · ${esc(x.reason)} · ${esc(x.status)}</p>`).join('')}</div>`);
    }
    if(view.page==='fund'){
      document.querySelector('.page-head').insertAdjacentHTML('afterend',`<div class="fund-select">${customerSelect()}<span>　模拟 Fund 操作，审批人沿用现有流程，不在原型中指定。</span></div>`);document.getElementById('customer').onchange=e=>{view.customer=e.target.value;view.currency=customer().currency;render();};
      document.querySelector('.notice').insertAdjacentHTML('afterend','<p class="small-note">本页 Fund 账面余额指内部垫资结算余额池。渠道余额、冻结金额是独立只读快照；本次记账不会修改渠道 API 实际余额。</p>');
      document.querySelectorAll('[data-account]').forEach(b=>{b.textContent='账本记录';b.onclick=()=>accountLedger(b.dataset.account);});
      document.querySelectorAll('[data-approve]').forEach(b=>{const reject=document.createElement('button');reject.className='link muted';reject.textContent='模拟驳回';reject.onclick=()=>{R.approve(state,b.dataset.approve,false);render();toast('审批驳回，余额未变动');};b.after(reject);});
      document.querySelectorAll('[data-execute]').forEach(b=>{const bad=document.createElement('button');bad.className='link muted';bad.textContent='模拟执行失败';bad.onclick=()=>{toast(R.execute(state,b.dataset.execute,true));render();};b.after(bad);});
      const pending=state.operations.filter(o=>o.execution==='执行成功'&&o.callback==='待回传').length;if(pending)document.querySelector('.notice').insertAdjacentHTML('beforeend',`<b class="amber">　${pending} 笔执行成功，等待回传余额。</b>`);
    }
  }
  function render(){ensureSyncBatches();try{localStorage.setItem(storageKey,JSON.stringify(state));}catch(_){} shell();document.getElementById('reset-demo').onclick=()=>{modal={type:'reset'};renderReset();};if(view.page==='balances')renderBalances();else if(view.page==='paypal')renderPaypal();else if(view.page==='flows')renderFlows();else if(view.page==='matching')renderMatching();else if(view.page==='statements')renderStatements();else if(view.page==='orders')renderOrders();else if(view.page==='customers')renderCustomers();else if(view.page==='fund')renderFund();enhancePage();}
  const hash=location.hash.slice(1); if(['balances','paypal','flows','matching','statements','orders','fund','customers'].includes(hash))view.page=hash;
  window.addEventListener('hashchange',()=>{const page=location.hash.slice(1);if(['balances','paypal','flows','matching','statements','orders','fund','customers'].includes(page)){view.page=page;render();}});
  document.addEventListener('click',e=>{if(!e.target.closest('.balance-search')){const box=document.getElementById('balance-suggest');if(box)box.hidden=true;}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if(e.key==='Tab'&&overlay.firstChild){const nodes=[...overlay.querySelectorAll('button,input,select,textarea,a')].filter(n=>!n.disabled&&n.offsetParent!==null);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  render();
})();
