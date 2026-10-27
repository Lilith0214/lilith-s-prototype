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
    const changed=new Set([id]); moves.forEach(([f,to])=>{changed.add(f.period);changed.add(to);f.period=to;});
    changed.forEach(x=>invalidate(s,x)); p.start=start;p.end=end;
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
  function review(s,id) {
    const p=ensureEditable(s,id), result=calc(s,id);
    if(result.unresolved) fail('仍有未匹配或多重匹配记录，请先处理订单匹配');
    p.status='reviewed';p.reviewedAt=new Date().toISOString(); audit(s,'财务复核',id,'复核通过，等待登记客户确认');
  }
  function confirm(s,id,reference) {
    const p=period(s,id);
    if(p.status!=='reviewed') fail('请先完成财务复核');
    if(!reference.trim()) fail('请填写客户确认凭据或记录编号');
    const value=calc(s,id); if(value.unresolved) fail('存在未解决的匹配异常');
    p.snapshot=value;p.status='confirmed';p.confirmation=reference;p.confirmedAt=new Date().toISOString();
    audit(s,'客户确认',id,`${reference}；V${p.version} 锁定`);
  }
  function syncSettlement(s,id,failOnce=false) {
    const p=period(s,id);
    if(p.status==='synced') return '该对账单已入账，重复请求未再次计入';
    if(!['confirmed','failed'].includes(p.status)) fail('仅已确认对账单可同步 Fund');
    const result=calc(s,id);
    for(const aid of Object.keys(result.byAccount)) if(account(s,aid).opening===null) fail('请先在 Fund 设置相关账户期初余额');
    const key=`SETTLE:${id}:V${p.version}`;
    p.request=key;
    if(failOnce){p.status='failed';audit(s,'同步失败',id,`${key}；演示请求未入账，可按原请求重试`);return '同步失败，余额未变动';}
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
  function ingest(s,batch) {
    let added=0,duplicates=0,quarantined=0;
    batch.forEach(raw=>{
      const f=clone(raw), old=s.flows.find(x=>flowKey(x)===flowKey(f));
      if(old){duplicates++;return;}
      const a=s.accounts.find(a=>a.id===f.account);
      if(!a||a.customer!==f.customer||a.channel!==f.channel||a.currency!==f.currency){quarantined++;return;}
      const p=s.periods.find(p=>p.customer===f.customer&&p.currency===f.currency&&f.date>=p.start&&f.date<=p.end);
      if(!p||!editable(p)){quarantined++;return;}
      f.period=p.id;f.originalPeriod=p.id;f.source='Fund';s.flows.push(f);invalidate(s,p.id);added++;
    });
    s.lastSync={time:new Date().toISOString(),added,duplicates,quarantined};
    audit(s,'渠道流水同步','四渠道',`新增 ${added}；重复 ${duplicates}；待处理 ${quarantined}`);return s.lastSync;
  }
  function createPeriod(s,cid,start,endOverride) {
    const c=customer(s,cid);
    if(!dateOK(start)) fail('起始日期无效');
    const end=endOverride || addDays(start,c.days-1);
    if(!dateOK(end)||end<start||s.periods.some(p=>p.customer===cid&&p.start<=end&&p.end>=start)) fail('日期无效或与已有周期重叠');
    const p={id:'P-'+(++s.seq),customer:cid,currency:c.currency,start,end,status:'draft',version:1,service:c.service,reserve:c.reserve,adjustments:[]};
    s.periods.push(p);audit(s,'生成周期',p.id,`${start} ~ ${end}；${c.days} 天；Asia/Shanghai`);return p;
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
  function seed() {
    const s={schema:1,seq:100,customers:[
      {id:'DEMO-1001',name:'示例商户 A',currency:'EUR',days:7,service:640,reserve:1000},
      {id:'DEMO-1002',name:'示例商户 B',currency:'USD',days:7,service:200,reserve:1000},
      {id:'DEMO-1003',name:'示例商户 C',currency:'USD',days:7,service:100,reserve:0}],accounts:[],periods:[],orders:[],flows:[],events:[],operations:[],mirrors:[],audit:[],corrections:[],lastSync:null};
    [['A-PP','DEMO-1001','PayPal','EUR',100000,142000,8000],['A-OP','DEMO-1001','Oceanpayment','EUR',50000,62000,4000],['B-AW','DEMO-1002','Airwallex','USD',80000,240000,12000],['B-SP','DEMO-1002','ShopifyPayments','USD',20000,87000,9000],['C-PP','DEMO-1003','PayPal','USD',null,25000,0]].forEach(([id,cid,channel,currency,opening,channelBalance,frozen])=>s.accounts.push({id,customer:cid,channel,currency,opening,openingAt:opening===null?null:'2026-10-12',channelBalance,frozen,channelAt:'2026-10-27 08:00:00'}));
    s.customers.forEach((c,i)=>{[13,20].forEach((day,j)=>s.periods.push({id:`P${i+1}${j+1}`,customer:c.id,currency:c.currency,start:`2026-10-${day}`,end:`2026-10-${day+6}`,status:'draft',version:1,service:c.service,reserve:c.reserve,adjustments:[]}));});
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
    payment('B-AW','P21','2026-10-16',150000,-4500);payment('B-SP','P21','2026-10-18',60000,-1800);
    payment('B-AW','P22','2026-10-23',240000,-7200,12000);payment('B-SP','P22','2026-10-25',90000,-2700);
    payment('C-PP','P32','2026-10-25',25000,-1000);
    s.flows.find(f=>f.id==='FLOW-9').bill='REF-MISSING';
    s.flows.push({...clone(s.flows.find(f=>f.id==='FLOW-3')),id:'HOLD-3',eventId:'TX-H-3',type:'reserve_hold',amount:-20000,fee:0});
    ['P11','P21'].forEach(id=>{review(s,id);confirm(s,id,'演示历史确认');syncSettlement(s,id);});
    review(s,'P22');confirm(s,'P22','演示客户确认记录 DEMO-ACK-22');syncSettlement(s,'P22',true);
    mirror(s);s.lastSync={time:'2026-10-27T00:00:00Z',added:s.flows.length,duplicates:0,quarantined:0};
    return s;
  }
  return {channels,clone,roundRate,addDays,account,customer,period,editable,flowKey,matches,flowStatus,calc,fundBalance,summary,moveFlow,adjustPeriod,addAdjustment,review,confirm,syncSettlement,initialise,requestOperation,approve,execute,mirror,ingest,createPeriod,configure,correction,audit,seed};
});
