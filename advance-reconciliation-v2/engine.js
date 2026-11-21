/* Prototype only. All data are synthetic, in integer minor units. No remote calls. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Recon = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const channels = ['PayPal', 'Airwallex', 'Oceanpayment', 'ShopifyPayments'];
  const clone = x => JSON.parse(JSON.stringify(x));
  const roundRate = (cents, basisPoints) => Math.sign(cents) * Math.floor((Math.abs(cents) * basisPoints + 5000) / 10000);
  const addDays = (date, n) => new Date(Date.parse(date + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  const dateOK = date => /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  function fail(msg) { throw new Error(msg); }
  function audit(s, type, object, detail) {
    s.audit.unshift({id: 'LOG-' + (++s.seq), time: new Date().toISOString(), operator: '演示财务', type, object, detail});
  }
  const account = (s, id) => s.accounts.find(a => a.id === id) || fail('账户不存在');
  const customer = (s, id) => s.customers.find(c => c.id === id) || fail('客户不存在');
  const period = (s, id) => s.periods.find(p => p.id === id) || fail('周期不存在');
  const editable = p => ['draft', 'reviewed'].includes(p.status);
  function windows(p) {
    return {
      start: p.start,
      end: p.end,
      orderStart: p.orderStart || p.start,
      orderEnd: p.orderEnd || p.end,
      flowStart: p.flowStart || p.start,
      flowEnd: p.flowEnd || p.end
    };
  }
  const flowKey = f => [f.channel, f.account, f.eventId].join('|');
  function matches(s, f) {
    return s.orders.filter(o => o.customer === f.customer && o.account === f.account && o.currency === f.currency && o.refs.includes(f.bill));
  }
  function flowStatus(s, f) {
    if (['reserve_hold','reserve_release','conversion','transfer'].includes(f.type)) return '账户变动';
    const n = matches(s, f).length;
    return n === 1 ? '已匹配' : n > 1 ? '多重匹配' : '未匹配';
  }
  function invalidate(s, id) {
    const p = period(s,id);
    if (!editable(p)) fail('已确认周期已锁定，需通过更正单处理');
    p.status = 'draft'; p.snapshot = null; p.version++; p.reviewedAt = null;
  }
  function calc(s, id) {
    const p = period(s,id);
    if (p.snapshot && !editable(p)) return clone(p.snapshot);
    const rows = s.flows.filter(f => f.period === id);
    const eligible = rows.filter(f => flowStatus(s,f) === '已匹配');
    const missingOrders = s.orders.filter(o => o.customer === p.customer && o.date >= p.start && o.date <= p.end &&
      !s.flows.some(f => f.type === 'payment' && matches(s,f).some(m => m.id === o.id)));
    const unresolved = rows.filter(f => !['已匹配','账户变动'].includes(flowStatus(s,f))).length + missingOrders.length;
    const byAccount = {};
    const sum = {gross:0,refund:0,dispute:0,fee:0,service:0,reserve:0,manual:0,total:0,unresolved,matched:eligible.length,excluded:rows.length-eligible.length};
    s.accounts.filter(a => a.customer === p.customer && a.currency === p.currency).forEach(a => {
      const fs = eligible.filter(f => f.account === a.id);
      const aSum = {gross:0,refund:0,dispute:0,fee:0,service:0,reserve:0,manual:0,total:0};
      fs.forEach(f => {
        if (f.type === 'payment') aSum.gross += f.amount;
        else if (f.type === 'refund') aSum.refund += f.amount;
        else if (['dispute','recovery'].includes(f.type)) aSum.dispute += f.amount;
        aSum.fee += f.fee;
      });
      aSum.service = -roundRate(aSum.gross,p.service);
      aSum.reserve = -roundRate(aSum.gross,p.reserve);
      aSum.manual = p.adjustments.filter(x=>x.account===a.id).reduce((n,x)=>n+x.amount,0);
      aSum.total = Object.values(aSum).reduce((n,x)=>n+x,0);
      byAccount[a.id] = aSum;
      for(const k of Object.keys(aSum)) sum[k]+=aSum[k];
    });
    const lines=p.statementFees||[];
    const platform=lines.filter(x=>x.type==='platform').reduce((n,x)=>n+x.amount,0);
    const other=lines.filter(x=>x.type==='other').reduce((n,x)=>n+x.amount,0);
    sum.platform=platform; sum.other=other; sum.total+=platform+other;
    const first=Object.keys(byAccount)[0];
    if(first){byAccount[first].platform=platform; byAccount[first].other=other; byAccount[first].total+=platform+other;}
    return {...sum,byAccount};
  }
  function fundBalance(s, id) {
    const a=account(s,id);
    if (a.opening === null) return null;
    return a.opening + s.events.filter(e=>e.account===id).reduce((n,e)=>n+e.delta,0);
  }
  function summary(s, id) {
    const c = customer(s,id), accts = s.accounts.filter(a=>a.customer===id && a.currency===c.currency);
    const initialised = accts.every(a=>a.opening!==null);
    const confirmed = s.periods.filter(p=>p.customer===id && ['confirmed','synced','failed'].includes(p.status));
    const settled = confirmed.reduce((n,p)=>n+calc(s,p.id).total,0);
    const movement = s.events.filter(e=>e.customer===id && e.kind!=='settlement').reduce((n,e)=>n+e.delta,0);
    const opening = initialised ? accts.reduce((n,a)=>n+a.opening,0) : null;
    const expected = initialised ? opening+settled+movement : null;
    const fund = initialised ? accts.reduce((n,a)=>n+fundBalance(s,a.id),0) : null;
    const pending = confirmed.filter(p=>p.status!=='synced').reduce((n,p)=>n+calc(s,p.id).total,0);
    const mirrored=initialised && accts.every(a=>s.mirrors.some(m=>m.account===a.id&&m.amount!==null)) ? accts.reduce((n,a)=>n+s.mirrors.find(m=>m.account===a.id).amount,0) : null;
    return {opening,settled,movement,expected,fund,mirrored,pending,difference:initialised?expected-fund:null,
      reserve:confirmed.reduce((n,p)=>n-calc(s,p.id).reserve,0),drafts:s.periods.filter(p=>p.customer===id&&editable(p)).length};
  }
  function ensureEditable(s,id) { const p=period(s,id); if(!editable(p)) fail('此周期已确认或已入账，禁止直接修改；请在对账管理提交更正申请'); return p; }
  function moveOrder(s,id,target,reason) {
    if(!reason.trim()) fail('请填写调整原因');
    const o=s.orders.find(x=>x.id===id)||fail('订单不存在');
    const current=o.period?period(s,o.period):s.periods.find(p=>p.customer===o.customer&&p.currency===o.currency&&o.date>=p.start&&o.date<=p.end);
    const to=ensureEditable(s,target);
    if(current&&!editable(current)) fail('原对账周期已确认或已入账，不能直接改期');
    if(current&&current.id===to.id) fail('请选择不同的对账周期');
    if(to.customer!==o.customer||to.currency!==o.currency) fail('仅允许调整到同客户、同币种周期');
    if(current) invalidate(s,current.id);
    invalidate(s,to.id);
    o.period=to.id; o.override=true; o.originalPeriod=o.originalPeriod||(current?current.id:null);
    audit(s,'订单改期',id,`${current?current.id:'未归属'} → ${to.id}；${reason}`);
  }
  function moveFlow(s,id,target,reason) {
    if(!reason.trim()) fail('请填写调整原因');
    const f=s.flows.find(x=>x.id===id)||fail('流水不存在');
    const from=ensureEditable(s,f.period), to=ensureEditable(s,target);
    if(from.id===to.id) fail('请选择不同的周期');
    if(to.customer!==f.customer||to.currency!==f.currency) fail('仅允许调整到同客户、同币种周期');
    invalidate(s,from.id); invalidate(s,to.id);
    f.period=to.id; f.override=true;
    audit(s,'流水改期',id,`${from.id} → ${to.id}；${reason}`);
  }
  function adjustPeriod(s,id,start,end,reason) {
    const p=ensureEditable(s,id);
    if(!dateOK(start)||!dateOK(end)||start>end) fail('请填写有效的起止日期');
    if(!reason.trim()) fail('请填写调整原因');
    if(s.periods.some(x=>x.id!==id&&x.customer===p.customer&&x.currency===p.currency&&x.start<=end&&x.end>=start)) fail('日期与已有周期重叠，请先调整相邻周期');
    const affected=s.flows.filter(f=>f.customer===p.customer&&f.currency===p.currency&&!f.override);
    const future=s.periods.map(x=>x.id===id?{...x,start,end}:x);
    const moves=[];
    affected.forEach(f=>{
      const next=future.find(x=>x.customer===f.customer&&x.currency===f.currency&&f.date>=x.start&&f.date<=x.end);
      if(!next && f.period===id) fail('调整后有流水不属于任何周期，请先单笔改期或补建周期');
      if(next && next.id!==f.period){ensureEditable(s,f.period); ensureEditable(s,next.id); moves.push([f,next.id]);}
    });
    const old=`${p.start} ~ ${p.end}`;
    const orderDefault=(p.orderStart||p.start)===p.start&&(p.orderEnd||p.end)===p.end;
    const flowDefault=(p.flowStart||p.start)===p.start&&(p.flowEnd||p.end)===p.end;
    const changed=new Set([id]); moves.forEach(([f,to])=>{changed.add(f.period);changed.add(to);f.period=to;});
    changed.forEach(x=>invalidate(s,x)); p.start=start;p.end=end;
    if(orderDefault){p.orderStart=start;p.orderEnd=end;}
    if(flowDefault){p.flowStart=start;p.flowEnd=end;}
    audit(s,'周期日期调整',id,`${old} → ${start} ~ ${end}；${moves.length} 笔自动重分配，手动改期流水保留；${reason}`);
  }
  function addAdjustment(s,id,accountId,amount,reason) {
    const p=ensureEditable(s,id), a=account(s,accountId);
    if(a.customer!==p.customer||a.currency!==p.currency) fail('费用必须归属本客户同币种账户');
    if(!Number.isSafeInteger(amount)||!amount) fail('金额不能为空或零，最多两位小数');
    if(!reason.trim()) fail('请填写费用或调整原因');
    invalidate(s,id); p.adjustments.push({id:'ADJ-'+(++s.seq),account:accountId,amount,reason});
    audit(s,'对账金额调整',id,`${accountId}；${amount/100} ${p.currency}；${reason}`);
  }
  function addReserveAdjustment(s,id,direction,amount,reason) {
    const p=ensureEditable(s,id);
    if(customer(s,p.customer).book==='excel') fail('Excel 手工维护客户不做保证金调整');
    if(direction!=='add'&&direction!=='sub') fail('请选择增加或减少');
    if(!Number.isSafeInteger(amount)||amount<=0) fail('保证金调整金额须大于 0');
    if(!reason.trim()) fail('请填写保证金调整原因');
    if(!p.reserveAdjustments) p.reserveAdjustments=[];
    p.reserveAdjustments.push({id:'RADJ-'+(++s.seq),direction,amount,reason,posted:false});
    audit(s,'保证金调整',id,`${direction==='add'?'增加':'减少'} ${amount/100} ${p.currency}；待确认，未计入保证金余额；${reason}`);
  }
  function marginValue(s,p) {
    if(p.snapshot&&!editable(p)) return p.snapshot;
    return calc(s,p.id);
  }
  function periodMarginParts(s,p) {
    const value=marginValue(s,p);
    const base=-(value.reserve||0);
    const adjs=p.reserveAdjustments||[];
    const signed=adjs.reduce((n,a)=>n+(a.direction==='sub'?-a.amount:a.amount),0);
    const posted=['confirmed','synced','failed'].includes(p.status);
    return {base,signed,posted,applied:posted?signed:0,pending:posted?0:signed};
  }
  function marginRunning(s,cid) {
    const c=customer(s,cid), map={};
    if(c.reserveOpening==null) return map;
    let bal=c.reserveOpening;
    s.periods.filter(p=>p.customer===cid).slice().sort((a,b)=>a.end<b.end?-1:a.end>b.end?1:0).forEach(p=>{
      const part=periodMarginParts(s,p);
      if(part.posted) bal+=part.base+part.applied;
      map[p.id]={...part,bal};
    });
    return map;
  }
  function marginBalance(s,cid) {
    const c=customer(s,cid);
    if(c.reserveOpening==null) return null;
    const map=marginRunning(s,cid);
    const posted=s.periods.filter(p=>p.customer===cid&&map[p.id]&&map[p.id].posted).sort((a,b)=>a.end<b.end?-1:1);
    return posted.length?map[posted[posted.length-1].id].bal:c.reserveOpening;
  }
  function setReserveOpening(s,cid,amount) {
    const c=customer(s,cid);
    if(c.book!=='weekly'&&c.book!=='single'&&c.book!=='excel') fail('未知的客户类型');
    if(!Number.isSafeInteger(amount)||amount<0) fail('请填写有效的保证金期初');
    c.reserveOpening=amount;
    audit(s,'保证金期初',cid,`${amount/100} ${c.currency}`);
  }
  function fetchPaypalRate(s) {
    const rates=['0.9214','0.9188','0.9241','0.9196'];
    const prev=s.paypalRate&&s.paypalRate.rate;
    const rate=rates.find(r=>r!==prev)||rates[0];
    s.paypalRate={pair:'USD/EUR',rate,source:'PayPal 后台自动获取',fetchedAt:new Date().toISOString()};
    audit(s,'PayPal 汇率','USD/EUR',`${rate}；来源 PayPal 后台，不手填`);
    return s.paypalRate;
  }
  function generatePaypalStatements(s) {
    let n=0;
    s.periods.forEach(p=>{
      if(customer(s,p.customer).book==='excel') return;
      p.paypalGeneratedAt=new Date().toISOString();
      n++;
    });
    audit(s,'生成 PayPal 对账单','单平台',`按周期生成 ${n} 张`);
    return n;
  }
  function excelBalance(row) {
    return Number.isSafeInteger(row.available)?row.available:null;
  }
  function syncExcelToFund(s,cid) {
    const c=customer(s,cid);
    if(c.book!=='excel') fail('只有 Excel 手工维护客户把日余额同步到 Fund');
    const rows=(s.paypalDaily||[]).filter(r=>r.customer===cid).slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
    if(!rows.length) fail('没有可同步的日余额');
    const latest=rows[rows.length-1];
    const target=excelBalance(latest);
    if(target==null) fail('客户可用余额还没有数');
    const acct=s.accounts.find(a=>a.customer===cid&&a.channel==='PayPal')||fail('没有 PayPal 资金账户');
    if(acct.opening===null){acct.opening=0;acct.openingAt=rows[0].date;}
    const key=`EXCEL-SYNC:${cid}:${latest.date}`;
    if(s.events.some(e=>e.id===key)){
      audit(s,'Excel 余额同步',cid,`${latest.date} 已同步，未重复入账`);
      return {added:false,balance:fundBalance(s,acct.id),date:latest.date,account:acct.id};
    }
    const delta=target-fundBalance(s,acct.id);
    s.events.push({id:key,kind:'excel-sync',account:acct.id,customer:cid,currency:c.currency,delta,reference:latest.date,time:latest.date+'T23:59:00.000Z'});
    audit(s,'Excel 余额同步',cid,`${latest.date} 客户余额 ${target/100} ${c.currency} 已同步到 Fund ${acct.id}`);
    mirror(s);
    return {added:true,balance:fundBalance(s,acct.id),date:latest.date,account:acct.id};
  }
  function review(s,id) {
    const p=ensureEditable(s,id), result=calc(s,id);
    if(result.unresolved) fail('仍有未匹配或多重匹配记录，请先处理订单匹配');
    p.status='reviewed';p.reviewedAt=new Date().toISOString(); audit(s,'财务复核',id,'复核通过，等待登记客户确认');
  }
  function creditWallet(s,p,value) {
    for(const aid of Object.keys(value.byAccount)) if(account(s,aid).opening===null) fail('请先在 Fund 设置垫资钱包期初余额');
    const key=`SETTLE:${p.id}:V${p.version}`;
    const time=`${p.end}T18:00:00.000Z`;
    for(const [aid,row] of Object.entries(value.byAccount)) {
      const ekey=`${key}:${aid}`;
      if(!s.events.some(e=>e.id===ekey)) s.events.push({id:ekey,kind:'settlement',account:aid,customer:p.customer,delta:row.total,currency:p.currency,reference:p.id,time,line:'垫资'});
    }
    p.walletPosted=true;
    audit(s,'计入垫资钱包',p.id,`确认后增量 ${value.total/100} ${p.currency} 已加入 Fund 垫资钱包`);
  }
  function confirm(s,id,reference) {
    const p=period(s,id);
    if(p.status!=='reviewed') fail('请先完成财务复核');
    if(!reference.trim()) fail('请填写客户确认凭据或记录编号');
    const value=calc(s,id); if(value.unresolved) fail('存在未解决的匹配异常');
    p.snapshot=value;
    creditWallet(s,p,value);
    (p.reserveAdjustments||[]).forEach(a=>{a.posted=true;});
    p.status='confirmed';p.confirmation=reference;p.confirmedAt=new Date().toISOString();
    audit(s,'客户确认',id,`${reference}；V${p.version} 锁定；结算增量已计入垫资钱包；本期保证金已计入保证金余额`);
  }
  function syncSettlement(s,id,failOnce=false) {
    const p=period(s,id);
    if(p.status==='synced') return '该对账单已入账，重复请求未再次计入';
    if(!['confirmed','failed'].includes(p.status)) fail('仅已确认对账单可同步 Fund');
    const result=calc(s,id);
    for(const aid of Object.keys(result.byAccount)) if(account(s,aid).opening===null) fail('请先在 Fund 设置相关账户期初余额');
    const key=`SETTLE:${id}:V${p.version}`;
    p.request=key;
    if(failOnce){p.status='failed';audit(s,'同步失败',id,`${key}；确认时增量已计入垫资钱包，Fund 回执失败不回冲`);return 'Fund 回执失败。确认时的结算增量仍留在垫资钱包';}
    const now=new Date().toISOString();
    for(const [aid,row] of Object.entries(result.byAccount)) {
      const ekey=`${key}:${aid}`;
      if(!s.events.some(e=>e.id===ekey)) s.events.push({id:ekey,kind:'settlement',account:aid,customer:p.customer,delta:row.total,currency:p.currency,reference:id,time:now});
    }
    p.status='synced';p.syncedAt=now;
    audit(s,'Fund 入账成功',id,`${key}；账户拆分合计 ${result.total/100} ${p.currency}`);
    s.mirrors=s.accounts.map(a=>({account:a.id,amount:fundBalance(s,a.id),time:now}));
    return 'Fund 入账成功，余额表已更新';
  }
  function initialise(s,id,amount,date,reason) {
    const a=account(s,id);
    if(a.opening!==null) fail('期初已生效，后续更正请走手动调额，不能覆盖期初');
    if(!Number.isSafeInteger(amount)||!dateOK(date)||!reason.trim()) fail('请完整填写金额、基准日期和依据');
    if(date>=s.periods.filter(p=>p.customer===a.customer).map(p=>p.start).sort()[0]) fail('期初基准日必须早于首个对账周期');
    a.opening=amount;a.openingAt=date;a.initialReason=reason;
    audit(s,'期初余额生效',id,`${amount/100} ${a.currency}；${date} 日终；${reason}`);
  }
  function requestOperation(s,type,source,target,amount,reason) {
    const a=account(s,source);
    if(a.opening===null) fail('请先设置来源账户期初余额');
    if(!Number.isSafeInteger(amount)||amount===0||!reason.trim()) fail('请填写有效金额和申请原因');
    if(!['transfer','adjust'].includes(type)) fail('操作类型无效');
    if(type==='transfer') {
      const b=account(s,target);
      if(source===target) fail('调出与调入账户不能相同');
      if(a.currency!==b.currency) fail('原型仅演示同币种调拨，跨币种汇率规则待确认');
      if(b.opening===null) fail('请先设置目标账户期初余额');
      if(amount<=0 || fundBalance(s,source)<amount) fail('调拨金额必须大于零且不超过 Fund 账面余额');
    }
    const op={id:'OP-'+(++s.seq),type,source,target:type==='transfer'?target:null,amount,reason,approval:'审批中',execution:'未执行',callback:'未回传',time:new Date().toISOString()};
    s.operations.unshift(op);audit(s,'发起 Fund 申请',op.id,'已提交飞书审批；尚未改变余额');return op;
  }
  function approve(s,id,pass) {
    const op=s.operations.find(o=>o.id===id)||fail('申请不存在');
    if(op.approval!=='审批中') fail('审批状态已经更新');
    op.approval=pass?'已通过':'已驳回';op.execution=pass?'待执行':'未执行';
    audit(s,'飞书审批回调',id,`${op.approval}；尚未入账`);
  }
  function execute(s,id,failed=false) {
    const op=s.operations.find(o=>o.id===id)||fail('申请不存在');
    if(op.execution==='执行成功') return '已成功，重复执行未产生新流水';
    if(op.approval!=='已通过') fail('审批通过后才可执行');
    if(failed){op.execution='执行失败';audit(s,'Fund 执行失败',id,'演示执行失败，余额未变动');return '执行失败，可重试原申请';}
    if(op.type==='transfer' && fundBalance(s,op.source)<op.amount) fail('执行时余额不足');
    const a=account(s,op.source), now=new Date().toISOString();
    const changes=op.type==='transfer'?[[a,-op.amount],[account(s,op.target),op.amount]]:[[a,op.amount]];
    changes.forEach(([ac,delta])=>{const key=`${id}:${ac.id}`;if(!s.events.some(e=>e.id===key))s.events.push({id:key,kind:op.type,account:ac.id,customer:ac.customer,currency:ac.currency,delta,reference:id,time:now});});
    op.execution='执行成功';op.callback='待回传';op.executedAt=now;
    audit(s,'Fund 执行成功',id,'资金账本已更新，等待回传垫资对账系统');return '执行成功，等待余额回传';
  }
  function mirror(s) {
    s.mirrors=s.accounts.map(a=>({account:a.id,amount:fundBalance(s,a.id),time:new Date().toISOString()}));
    s.operations.filter(o=>o.execution==='执行成功').forEach(o=>o.callback='已回传');
    audit(s,'Fund 余额回传','全部账户','按账户更新余额快照；不再次计入结算收入');
  }
  function ingest(s,batch,opts) {
    const target=period(s,opts&&opts.periodId);
    if(!opts||!opts.customer||target.customer!==opts.customer) fail('请选择该客户的结算周期');
    if(!editable(target)) fail('已对账周期不能直接写入流水');
    if(!opts.channel) fail('请选择渠道');
    if(!dateOK(opts.start)||!dateOK(opts.end)||opts.start>opts.end) fail('请填写有效的流水时间');
    let added=0,duplicates=0,quarantined=0;
    batch.forEach(raw=>{
      if(raw.customer!==opts.customer||raw.channel!==opts.channel) return;
      if(!raw.date||raw.date<opts.start||raw.date>opts.end) return;
      const f=clone(raw), old=s.flows.find(x=>flowKey(x)===flowKey(f));
      if(old){duplicates++;return;}
      const a=s.accounts.find(a=>a.id===f.account);
      if(!a||a.customer!==f.customer||a.channel!==f.channel||a.currency!==f.currency){quarantined++;return;}
      f.period=target.id;f.originalPeriod=target.id;f.source='Fund';f.override=false;s.flows.push(f);added++;
    });
    if(added) invalidate(s,target.id);
    s.lastSync={time:new Date().toISOString(),added,duplicates,quarantined};
    audit(s,'渠道流水同步',target.id,`${opts.channel} ${opts.start} ~ ${opts.end} → ${target.start} ~ ${target.end}；新增 ${added}；重复 ${duplicates}；待处理 ${quarantined}`);
    return s.lastSync;
  }
  function ingestOrders(s,batch,opts) {
    const target=period(s,opts&&opts.periodId);
    if(!opts||!opts.customer||target.customer!==opts.customer) fail('请选择该客户的结算周期');
    if(!editable(target)) fail('已对账周期不能直接写入订单');
    if(!dateOK(opts.start)||!dateOK(opts.end)||opts.start>opts.end) fail('请填写有效的订单时间');
    let added=0,duplicates=0,quarantined=0;
    batch.forEach(raw=>{
      if(raw.customer!==opts.customer) return;
      if(!raw.date||raw.date<opts.start||raw.date>opts.end) return;
      const o=clone(raw);
      if(!o.id){quarantined++;return;}
      if(s.orders.some(x=>x.id===o.id)){duplicates++;return;}
      const a=s.accounts.find(a=>a.id===o.account);
      if(!a||a.customer!==o.customer||a.currency!==o.currency){quarantined++;return;}
      o.period=target.id;o.originalPeriod=target.id;o.override=false;s.orders.push(o);added++;
    });
    if(added) invalidate(s,target.id);
    s.lastOrderSync={time:new Date().toISOString(),added,duplicates,quarantined};
    audit(s,'订单明细同步',target.id,`${opts.start} ~ ${opts.end} → ${target.start} ~ ${target.end}；新增 ${added}；重复 ${duplicates}；待处理 ${quarantined}`);
    return s.lastOrderSync;
  }
  function createPeriod(s,cid,start,endOverride) {
    const c=customer(s,cid);
    if(!dateOK(start)) fail('起始日期无效');
    const end=endOverride || addDays(start,c.days-1);
    if(!dateOK(end)||end<start||s.periods.some(p=>p.customer===cid&&p.start<=end&&p.end>=start)) fail('日期无效或与已有周期重叠');
    const p={id:'P-'+(++s.seq),customer:cid,currency:c.currency,start,end,orderStart:start,orderEnd:end,flowStart:start,flowEnd:end,status:'draft',version:1,service:c.service,reserve:c.reserve,adjustments:[]};
    s.periods.push(p);audit(s,'生成周期',p.id,`${start} ~ ${end}；${c.days} 天；Asia/Shanghai`);return p;
  }
  function saveCyclePlan(s,cid,days,rows) {
    const c=customer(s,cid);
    if(c.book==='excel'||c.book==='single') fail('这类客户不做周期设置');
    if(!Number.isInteger(days)||days<1||days>90) fail('周期天数须为 1–90 的整数（原型输入范围）');
    const mine=s.periods.filter(p=>p.customer===cid);
    const byId=Object.fromEntries(mine.map(p=>[p.id,p]));
    const proposed=mine.map(p=>({id:p.id,start:p.start,end:p.end,orderStart:p.orderStart||p.start,orderEnd:p.orderEnd||p.end,flowStart:p.flowStart||p.start,flowEnd:p.flowEnd||p.end}));
    rows.forEach(row=>{
      if(!dateOK(row.start)||!dateOK(row.end)||row.start>row.end) fail('请填写有效的起止日期');
      if(row.id&&byId[row.id]){
        const cur=proposed.find(p=>p.id===row.id);
        if(!editable(byId[row.id])&&(cur.start!==row.start||cur.end!==row.end)) fail('已对账周期不能直接改日期');
        cur.start=row.start;cur.end=row.end;
      }else proposed.push({id:null,start:row.start,end:row.end});
    });
    for(let i=0;i<proposed.length;i++) for(let j=i+1;j<proposed.length;j++){
      const a=proposed[i],b=proposed[j];
      if(a.start<=b.end&&b.start<=a.end) fail('所含日期与其他周期有重合');
    }
    if(days!==c.days) configure(s,cid,days,c.service,c.reserve);
    proposed.forEach(row=>{
      if(!row.id){
        const p={id:'P-'+(++s.seq),customer:cid,currency:c.currency,start:row.start,end:row.end,orderStart:row.start,orderEnd:row.end,flowStart:row.start,flowEnd:row.end,status:'draft',version:1,service:c.service,reserve:c.reserve,adjustments:[]};
        s.periods.push(p);audit(s,'生成周期',p.id,`${row.start} ~ ${row.end}`);
        return;
      }
      const p=byId[row.id];
      if(!editable(p)) return;
      if(p.start===row.start&&p.end===row.end) return;
      const old=`${p.start} ~ ${p.end}`;
      invalidate(s,p.id);p.start=row.start;p.end=row.end;p.orderStart=row.start;p.orderEnd=row.end;p.flowStart=row.start;p.flowEnd=row.end;
      audit(s,'周期日期调整',p.id,`${old} → ${row.start} ~ ${row.end}`);
    });
  }
  function configure(s,cid,days,service,reserve) {
    if(!Number.isInteger(days)||days<1||days>90) fail('周期天数须为 1–90 的整数（原型输入范围）');
    if(![service,reserve].every(x=>Number.isInteger(x)&&x>=0&&x<=10000)) fail('费率须在 0%–100% 范围');
    Object.assign(customer(s,cid),{days,service,reserve});
    audit(s,'客户配置更新',cid,`周期 ${days} 天；服务费 ${service/100}%；保证金 ${reserve/100}%；仅新周期使用，历史快照不变`);
  }
  function correction(s,id,reason) {
    const p=period(s,id);if(editable(p)) fail('未确认周期可直接调整');if(!reason.trim())fail('请填写更正原因');
    s.corrections.push({id:'COR-'+(++s.seq),period:id,reason,status:'待财务处理'});
    audit(s,'更正申请',id,reason+'；原对账单和已入账金额保持不变');
  }
  const MERT_CCY=['AUD','CAD','CHF','EUR','GBP','NZD','USD'];
  const MERT_TX=['express','expressFee','card','cardFee','normal','ipr','iprFee','recur','recurFee','refund','refundFee','voidPay','voidFee','chargeback','cbFee','dispute','preapprove','preapproveFee','disputeDebit','reviewHold'];
  const MERT_RATES={AUD:0.6746,CAD:0.7082,CHF:1.2373,EUR:1.1123,GBP:1.2992,NZD:0.5676,USD:1};
  function r2(n){return Math.round((Number(n)||0)*100)/100;}
  function blankMertRow(){
    const row={opening:0,fxOut:0,fxIn:0,withdraw:0,withdrawFee:0,generalHold:0,reserveHold:0};
    MERT_TX.forEach(k=>{row[k]=0;});
    return row;
  }
  function blankMertRows(){
    const rows={};
    MERT_CCY.forEach(ccy=>{rows[ccy]=blankMertRow();});
    return rows;
  }
  function mertSampleRows(){
    const rows=blankMertRows();
    Object.assign(rows.AUD,{express:1224.36,expressFee:-51.93,reserveHold:-351.76});
    Object.assign(rows.CAD,{express:345.81,expressFee:-14.69,reserveHold:-99.34});
    Object.assign(rows.CHF,{express:24893.26,expressFee:-1377.16,refund:-32.9,refundFee:1.83,voidPay:-31.95,voidFee:1.8,chargeback:-59.95,dispute:-8,fxOut:-23162.52,reserveHold:-42.43});
    Object.assign(rows.EUR,{express:733461.97,expressFee:-36209.33,normal:-1440,refund:-4515.83,refundFee:186.91,voidPay:-1553.39,voidFee:73.24,chargeback:-498.69,dispute:-434,preapprove:3360.44,preapproveFee:-322.99,disputeDebit:-32.23,fxOut:-696673.84,reserveHold:-69.44});
    Object.assign(rows.GBP,{express:45239.32,expressFee:-2150.8,refund:-249.92,refundFee:10.83,voidPay:-42.85,voidFee:2.07,chargeback:-68.7,dispute:-12,fxOut:-41901.47,reserveHold:-243.7});
    Object.assign(rows.NZD,{express:168,expressFee:-7.46,reserveHold:-48.16});
    Object.assign(rows.USD,{express:1933.08,expressFee:-83.83,normal:-3950,preapprove:99.92,preapproveFee:-4.79,fxIn:804269.02,withdraw:-830000,withdrawFee:-735,reserveHold:-430.72});
    return rows;
  }
  function computeMert(st){
    const rates=st.rates||MERT_RATES;
    const lines=MERT_CCY.map(ccy=>{
      const src=st.rows&&st.rows[ccy]||blankMertRow();
      const tx=MERT_TX.map(k=>r2(src[k]));
      const total=r2(tx.reduce((n,v)=>n+v,0));
      const paypal=r2(total+r2(src.fxOut)+r2(src.fxIn)+r2(src.withdraw)+r2(src.withdrawFee)+r2(src.generalHold)+r2(src.reserveHold)+r2(src.opening));
      const rate=Number(rates[ccy])||0;
      return {ccy,opening:r2(src.opening),tx,total,fxOut:r2(src.fxOut),fxIn:r2(src.fxIn),withdraw:r2(src.withdraw),withdrawFee:r2(src.withdrawFee),generalHold:r2(src.generalHold),reserveHold:r2(src.reserveHold),paypal,usd:r2(paypal*rate),rate};
    });
    const usdOf=pick=>r2(lines.reduce((n,l)=>n+r2(pick(l)*l.rate),0));
    const absUsd=pick=>r2(lines.reduce((n,l)=>n+Math.abs(r2(pick(l)*l.rate)),0));
    const total={
      opening:usdOf(l=>l.opening),
      tx:MERT_TX.map((_,i)=>usdOf(l=>l.tx[i])),
      total:usdOf(l=>l.total),
      fxOut:usdOf(l=>l.fxOut),fxIn:usdOf(l=>l.fxIn),
      withdraw:absUsd(l=>l.withdraw),withdrawFee:absUsd(l=>l.withdrawFee),
      generalHold:absUsd(l=>l.generalHold),reserveHold:absUsd(l=>l.reserveHold),
      paypal:usdOf(l=>l.paypal),
      usd:r2(lines.reduce((n,l)=>n+l.usd,0))
    };
    const base=r2(total.tx[0]+total.tx[16]);
    const revenue=r2(total.reserveHold+total.usd+total.withdraw+total.withdrawFee+total.generalHold);
    const hold20=r2(total.reserveHold*0.2);
    const available=r2(total.usd+total.withdraw-hold20);
    const fee=r2(base*0.031);
    const reserveFee=r2(base*0.065);
    const payout=r2(available-fee-reserveFee);
    return {lines,total,rates,summary:{revenue,hold20,available,fee,reserve:reserveFee,payout,customerUsd:total.usd}};
  }
  function paypalCustomerBalance(s,cid){
    const list=(s.paypalStatements||[]).filter(st=>st.customer===cid&&st.status==='confirmed');
    if(!list.length) return null;
    return Math.round(r2(list.reduce((n,st)=>n+computeMert(st).summary.customerUsd,0))*100);
  }
  function createPaypalStatement(s,cid,start,end){
    const c=customer(s,cid);
    if(c.book==='excel') fail('Excel 手工维护客户不做 PayPal 对账单');
    if(!dateOK(start)||!dateOK(end)||start>end) fail('请填写有效的起止日期');
    if((s.paypalStatements||[]).some(st=>st.customer===cid&&!(end<st.start||start>st.end))) fail('日期与已有对账单重叠');
    const st={id:'PS-'+(++s.seq),customer:cid,start,end,status:'draft',creator:'自动创建对账任务',createdAt:new Date().toISOString(),rates:Object.assign({},MERT_RATES),rows:blankMertRows()};
    s.paypalStatements=s.paypalStatements||[];
    s.paypalStatements.unshift(st);
    audit(s,'PayPal 对账',cid,`${start} ~ ${end} 已生成 PayPal 对账单 ${st.id}`);
    return st;
  }
  function postAdvanceSettlement(s,st){
    const cents=Math.round(r2(computeMert(st).summary.customerUsd)*100);
    const acct=s.accounts.find(a=>a.customer===st.customer&&a.channel==='PayPal')||s.accounts.find(a=>a.customer===st.customer&&a.channel==='垫资钱包')||fail('没有可同步的垫资账户');
    const key=`ADVANCE-SETTLE:${st.id}`;
    if(!s.events.some(e=>e.id===key)){
      s.events.push({id:key,kind:'advance-settlement',account:acct.id,customer:st.customer,currency:'USD',delta:cents,reference:st.id,time:st.confirmedAt||new Date().toISOString(),label:'垫资客户结算'});
    }
    audit(s,'垫资客户结算',st.id,`${cents/100} USD 已同步到 Fund ${acct.id}`);
    return s.events.find(e=>e.id===key);
  }
  function confirmPaypalStatement(s,id){
    const st=(s.paypalStatements||[]).find(x=>x.id===id)||fail('对账单不存在');
    if(st.status==='confirmed') return st;
    st.status='confirmed';
    st.confirmedAt=new Date().toISOString();
    const ev=postAdvanceSettlement(s,st);
    audit(s,'确认 PayPal 对账单',id,`客户余额 USD ${computeMert(st).summary.customerUsd} 已写入余额表；Fund 流水 ${ev.id} 类型 垫资客户结算`);
    return st;
  }
  function seed() {
    const s={schema:17,seq:100,customers:[
      {id:'DEMO-1001',name:'示例商户 A',currency:'EUR',days:7,service:640,reserve:1000,book:'weekly',reserveOpening:80000},
      {id:'DEMO-1002',name:'示例商户 B',currency:'USD',days:7,service:200,reserve:1000,book:'weekly',reserveOpening:30000},
      {id:'DEMO-1003',name:'示例商户 C',currency:'USD',days:7,service:100,reserve:0,book:'excel',reserveOpening:45000},
      {id:'DEMO-1004',name:'示例商户 D',currency:'USD',days:7,service:640,reserve:1000,book:'single',reserveOpening:60000}],accounts:[],periods:[],orders:[],flows:[],events:[],operations:[],mirrors:[],audit:[],corrections:[],lastSync:null};
    [['A-PP','DEMO-1001','PayPal','EUR',100000,142000,8000],['A-OP','DEMO-1001','Oceanpayment','EUR',50000,62000,4000],['B-AW','DEMO-1002','Airwallex','USD',80000,240000,12000],['B-SP','DEMO-1002','ShopifyPayments','USD',20000,87000,9000],['C-PP','DEMO-1003','PayPal','USD',null,25000,0]].forEach(([id,cid,channel,currency,opening,channelBalance,frozen])=>s.accounts.push({id,customer:cid,channel,currency,opening,openingAt:opening===null?null:'2026-09-01',channelBalance,frozen,channelAt:'2026-10-27 08:00:00'}));
    s.customers.forEach((c,i)=>{if(c.book==='single')return;[13,20].forEach((day,j)=>s.periods.push({id:`P${i+1}${j+1}`,customer:c.id,currency:c.currency,start:`2026-10-${day}`,end:`2026-10-${day+6}`,status:'draft',version:1,service:c.service,reserve:c.reserve,adjustments:[]}));});
    let n=0;
    const payment=(aid,pid,day,amount,fee,refund=0)=>{
      const a=account(s,aid), ref='REF-DEMO-'+(++n), oid='ORDER-DEMO-'+n;
      s.orders.push({id:oid,customer:a.customer,account:aid,store:a.customer==='DEMO-1001'?'示例店铺 Alpha':'示例店铺 '+a.id,currency:a.currency,date:day,amount,refs:[ref]});
      const base={customer:a.customer,account:aid,channel:a.channel,currency:a.currency,date:day,bill:ref,period:pid,originalPeriod:pid,override:false,source:'Fund',status:'已完成'};
      s.flows.push({...base,id:'FLOW-'+n,eventId:'TX-P-'+n,type:'payment',amount,fee});
      if(refund)s.flows.push({...base,id:'REFUND-'+n,eventId:'TX-R-'+n,type:'refund',amount:-refund,fee:0});
    };
    payment('A-PP','P11','2026-10-15',100000,-3000);payment('A-OP','P11','2026-10-17',50000,-1500);
    payment('A-PP','P12','2026-10-22',200000,-6000,10000);payment('A-OP','P12','2026-10-24',100000,-2500);
    const secondRefund=s.flows.find(f=>f.period==='P12'&&f.type==='refund');
    s.flows.push({...clone(secondRefund),id:'REFUND-P12-2',eventId:'TX-R-P12-2',amount:-4500,fee:0});
    s.periods.find(p=>p.id==='P12').statementFees=[{type:'platform',amount:-2800},{type:'other',amount:-1200},{type:'other',amount:-650}];
    payment('B-AW','P21','2026-10-16',150000,-4500);payment('B-SP','P21','2026-10-18',60000,-1800);
    payment('B-AW','P22','2026-10-23',240000,-7200,12000);payment('B-SP','P22','2026-10-25',90000,-2700);
    payment('C-PP','P32','2026-10-25',25000,-1000);
    s.flows.find(f=>f.id==='FLOW-9').bill='REF-MISSING';
    s.flows.push({...clone(s.flows.find(f=>f.id==='FLOW-3')),id:'HOLD-3',eventId:'TX-H-3',type:'reserve_hold',amount:-20000,fee:0});
    ['P11','P21'].forEach(id=>{review(s,id);confirm(s,id,'演示历史确认');syncSettlement(s,id);});
    review(s,'P22');confirm(s,'P22','演示客户确认记录 DEMO-ACK-22');syncSettlement(s,'P22',true);
    const transfer=requestOperation(s,'transfer','A-PP','A-OP',20000,'PayPal 账户调入 Oceanpayment，同客户同币种');
    approve(s,transfer.id,true);execute(s,transfer.id);
    const adjust=requestOperation(s,'adjust','B-AW',null,5000,'Airwallex 账户手动调增');
    approve(s,adjust.id,true);execute(s,adjust.id);
    const pending=requestOperation(s,'adjust','A-PP',null,-3000,'待审批的手动调减，不应改变余额');
    const stamp=(op,iso)=>{op.time=iso;s.events.filter(e=>e.reference===op.id).forEach(e=>e.time=iso);};
    stamp(transfer,'2026-10-16T02:00:00.000Z');
    stamp(adjust,'2026-10-17T02:00:00.000Z');
    pending.time='2026-10-18T02:00:00.000Z';
    s.customers.forEach((c,i)=>{if(c.book==='single')return;s.periods.push({id:`P${i+1}3`,customer:c.id,currency:c.currency,start:'2026-10-27',end:'2026-11-02',status:'draft',version:1,service:c.service,reserve:c.reserve,adjustments:[]});});
    ['2026-09-08','2026-09-15','2026-09-22','2026-09-29','2026-10-06'].forEach((start,j)=>{
      const end=addDays(start,6);
      s.customers.forEach((c,i)=>{
        if(c.book==='single') return;
        const id=`H${i+1}${j+1}`;
        s.periods.push({id,customer:c.id,currency:c.currency,start,end,status:'draft',version:1,service:c.service,reserve:c.reserve,adjustments:[]});
        if(c.id==='DEMO-1003') return;
        s.accounts.filter(a=>a.customer===c.id).forEach((a,k)=>{
          const amount=(c.id==='DEMO-1001'?60000:70000)+j*8000+k*15000;
          payment(a.id,id,addDays(start,2+k),amount,c.id==='DEMO-1001'?-1800:-2200);
        });
        review(s,id);confirm(s,id,'演示历史确认 '+id);syncSettlement(s,id);
        s.events.filter(e=>e.kind==='settlement'&&e.reference===id).forEach(e=>{e.time=end+'T12:00:00.000Z';});
      });
    });
    const earlyTransfer=requestOperation(s,'transfer','A-PP','A-OP',15000,'9月中 PayPal 调入 Oceanpayment');
    approve(s,earlyTransfer.id,true);execute(s,earlyTransfer.id);
    const earlyAdjustA=requestOperation(s,'adjust','A-PP',null,8000,'10月初 PayPal 手动调增');
    approve(s,earlyAdjustA.id,true);execute(s,earlyAdjustA.id);
    const earlyAdjustB=requestOperation(s,'adjust','B-SP',null,-4000,'9月初 ShopifyPayments 手动调减');
    approve(s,earlyAdjustB.id,true);execute(s,earlyAdjustB.id);
    stamp(earlyTransfer,'2026-09-16T02:00:00.000Z');
    stamp(earlyAdjustA,'2026-10-02T02:00:00.000Z');
    stamp(earlyAdjustB,'2026-09-10T02:00:00.000Z');
    const liveA=requestOperation(s,'adjust','A-PP',null,1500,'最新一期结束后，Fund 垫资钱包实时调增');
    approve(s,liveA.id,true);execute(s,liveA.id);
    const liveB=requestOperation(s,'adjust','B-AW',null,3000,'最新一期结束后，Fund 垫资钱包实时调增');
    approve(s,liveB.id,true);execute(s,liveB.id);
    stamp(liveA,'2026-11-03T08:00:00.000Z');
    stamp(liveB,'2026-11-03T08:10:00.000Z');
    const a=s.customers[0];
    s.periods.push({id:'NA4',customer:a.id,currency:a.currency,start:'2026-12-01',end:'2026-12-07',orderStart:'2026-12-01',orderEnd:'2026-12-07',flowStart:'2026-12-01',flowEnd:'2026-12-07',status:'draft',version:1,service:a.service,reserve:a.reserve,adjustments:[],snapshot:null});
    s.inbox=[
      {id:'SYNC-A1',eventId:'TX-SYNC-A1',customer:a.id,account:'A-PP',channel:'PayPal',currency:'EUR',date:'2026-11-18',bill:'BILL-SYNC-A1',type:'payment',amount:3200,fee:-80},
      {id:'SYNC-A2',eventId:'TX-SYNC-A2',customer:a.id,account:'A-PP',channel:'PayPal',currency:'EUR',date:'2026-11-20',bill:'BILL-SYNC-A2',type:'payment',amount:4500,fee:-90}
    ];
    s.orderInbox=[
      {id:'ORDER-SYNC-18',shopifyId:'9100000000018',customer:a.id,account:'A-PP',store:'示例店铺 Alpha',currency:'EUR',date:'2026-11-18',amount:8800,refs:['REF-SYNC-ORD-18']},
      {id:'ORDER-SYNC-20',shopifyId:'9100000000020',customer:a.id,account:'A-PP',store:'示例店铺 Alpha',currency:'EUR',date:'2026-11-20',amount:12600,refs:['REF-SYNC-ORD-20']}
    ];
    mirror(s);s.lastSync={time:'2026-10-27T00:00:00Z',added:s.flows.length,duplicates:0,quarantined:0};s.lastUpload={added:8,failed:2};
    s.paypalRate={pair:'USD/EUR',rate:'0.9214',source:'PayPal 后台自动获取',fetchedAt:'2026-11-20T16:00:00.000Z'};
    s.paypalDaily=[
      {customer:'DEMO-1003',account:'C-PP',date:'2026-11-18',currency:'USD',eod:250000,frozen:18000,withdraw:40000,available:268400,fetchedAt:'2026-11-18 23:59:12'},
      {customer:'DEMO-1003',account:'C-PP',date:'2026-11-19',currency:'USD',eod:180000,frozen:15000,withdraw:12000,available:191500,fetchedAt:'2026-11-19 23:58:40'},
      {customer:'DEMO-1003',account:'C-PP',date:'2026-11-20',currency:'USD',eod:210000,frozen:22000,withdraw:0,available:205000,fetchedAt:'2026-11-20 23:59:05'}
    ];
    s.accounts.push({id:'C-FW',customer:'DEMO-1003',channel:'垫资钱包',currency:'USD',opening:0,openingAt:'2026-09-01',channelBalance:0,frozen:0,channelAt:'2026-11-20 23:59:00'});
    s.accounts.push({id:'D-PP',customer:'DEMO-1004',channel:'PayPal',currency:'USD',opening:0,openingAt:'2026-09-01',channelBalance:0,frozen:0,channelAt:'2026-11-20 08:00:00'});
    s.paypalStatements=[
      {id:'PS-1',customer:'DEMO-1004',start:'2024-08-02',end:'2026-09-15',status:'confirmed',creator:'自动创建对账任务',createdAt:'2026-11-18T02:00:00.000Z',confirmedAt:'2026-11-18T03:00:00.000Z',rates:Object.assign({},MERT_RATES),rows:mertSampleRows()},
      {id:'PS-2',customer:'DEMO-1004',start:'2026-10-01',end:'2026-10-07',status:'draft',creator:'自动创建对账任务',createdAt:'2026-11-20T02:00:00.000Z',rates:Object.assign({},MERT_RATES),rows:blankMertRows()}
    ];
    s.periods.push({id:'SD1',customer:'DEMO-1004',currency:'USD',start:'2026-10-13',end:'2026-10-19',status:'draft',version:1,service:640,reserve:1000,adjustments:[]});
    s.periods.push({id:'SD2',customer:'DEMO-1004',currency:'USD',start:'2026-10-20',end:'2026-10-26',status:'draft',version:1,service:640,reserve:1000,adjustments:[]});
    addReserveAdjustment(s,'SD1','add',2500,'单平台示例保证金');
    review(s,'SD1');confirm(s,'SD1','演示单平台周期确认');syncSettlement(s,'SD1');
    s.paypalStatements.filter(st=>st.status==='confirmed').forEach(st=>postAdvanceSettlement(s,st));
    s.periods.forEach(p=>{if(customer(s,p.customer).book==='weekly') p.paypalGeneratedAt='2026-11-20T16:00:00.000Z';});
    return s;
  }
  return {channels,clone,roundRate,addDays,windows,account,customer,period,editable,flowKey,matches,flowStatus,calc,fundBalance,summary,moveFlow,moveOrder,adjustPeriod,addAdjustment,addReserveAdjustment,periodMarginParts,marginRunning,marginBalance,setReserveOpening,fetchPaypalRate,generatePaypalStatements,excelBalance,syncExcelToFund,MERT_CCY,MERT_TX,MERT_RATES,computeMert,paypalCustomerBalance,createPaypalStatement,confirmPaypalStatement,review,confirm,syncSettlement,initialise,requestOperation,approve,execute,mirror,ingest,ingestOrders,createPeriod,configure,saveCyclePlan,correction,audit,seed};
});
