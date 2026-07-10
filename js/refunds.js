// ═══════════════════════════════════════════════════════
// refunds.js — EMD / FSD / ASD Deposit Refund Tracker
// RSR Constructions Tracker
//
// Tracks all deposit refunds across all projects:
//   EMD = 2.5% of agreement amount (1% at bid + 1.5% at agreement)
//   FSD = amount deducted from JV (stored on project)
//   ASD = (|bidPct| - 25)% × estimated value (if bid % > 25% absolute)
//
// Eligibility:
//   EMD + FSD: 2 years after JV date
//   ASD: immediately after EA number received
//
// Lifecycle: Not Eligible → Eligible → Applied → JV Received → Paid
// ═══════════════════════════════════════════════════════

// ─── HELPERS ─────────────────────────────────────────
function getRefundData(p){
  // Compute all deposit amounts and statuses for a project
  const today = new Date();
  const hasJV = !!p.jvDate;
  const hasEA = !!(p.eaNumber||(p.documents&&p.documents.ea));
  const agreeAmt = agAmt(p)||0;
  const asdEligible = Math.abs(p.bidPct||0) > 25;

  // ── EMD ──────────────────────────────────────────
  // Total EMD = 2.5% of agreement amount
  // Stored as p.emd (may already be set), otherwise auto-calculate
  const emdAmt = p.emd > 0 ? p.emd : Math.round(agreeAmt * 0.025);
  let emdEligibleDate = null, emdDaysLeft = null;
  if(p.jvDate){
    const d = new Date(p.jvDate);
    d.setFullYear(d.getFullYear()+2);
    emdEligibleDate = d;
    emdDaysLeft = Math.round((d-today)/86400000);
  }
  const emdStatus = !hasJV ? 'no_jv'
    : emdDaysLeft > 0 ? 'not_eligible'
    : p.refundReceived ? 'paid'
    : p.refundApplied ? 'applied'
    : 'eligible';

  // ── FSD ──────────────────────────────────────────
  const fsdAmt = p.fsd||0;
  const fsdStatus = fsdAmt <= 0 ? 'no_fsd'
    : !hasJV ? 'no_jv'
    : emdDaysLeft !== null && emdDaysLeft > 0 ? 'not_eligible'
    : p.refundReceived ? 'paid'
    : p.refundApplied ? 'applied'
    : 'eligible';

  // ── ASD ──────────────────────────────────────────
  const asdAmt = p.asd||0;
  const asdStatus = !asdEligible && asdAmt <= 0 ? 'not_applicable'
    : !hasEA ? 'no_ea'
    : p.asdRefundReceived ? 'paid'
    : p.asdRefundApplied ? 'applied'
    : 'eligible';

  const totalDeposit = emdAmt + fsdAmt + (asdEligible ? asdAmt : 0);
  const totalReceivable = (emdStatus==='paid'?emdAmt:0) + (fsdStatus==='paid'?fsdAmt:0) + (asdStatus==='paid'?asdAmt:0);

  return {
    emdAmt, fsdAmt, asdAmt, asdEligible,
    emdStatus, fsdStatus, asdStatus,
    emdEligibleDate, emdDaysLeft,
    totalDeposit, totalReceivable,
    hasJV, hasEA
  };
}

const STATUS_LABEL = {
  no_jv:          {label:'Waiting for JV',    color:'var(--text3)',  bg:'var(--surface2)'},
  not_eligible:   {label:'Not Eligible Yet',  color:'var(--text3)',  bg:'var(--surface2)'},
  eligible:       {label:'Apply Now',         color:'#b45309',       bg:'#fef9c3'},
  applied:        {label:'Applied — Pending', color:'#7c3aed',       bg:'#f5f3ff'},
  paid:           {label:'✓ Paid',            color:'var(--green)',  bg:'#f0fdf4'},
  no_fsd:         {label:'No FSD',            color:'var(--text3)',  bg:'var(--surface2)'},
  not_applicable: {label:'Not Applicable',    color:'var(--text3)',  bg:'var(--surface2)'},
  no_ea:          {label:'Waiting for EA',    color:'var(--text3)',  bg:'var(--surface2)'},
};

function _statusBadge(status){
  const s = STATUS_LABEL[status]||STATUS_LABEL['not_eligible'];
  return `<span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:8px;background:${s.bg};color:${s.color};white-space:nowrap">${s.label}</span>`;
}

// ─── TAB VIEWS ────────────────────────────────────────
let _refView = 'overview'; // 'overview' | 'emd' | 'fsd' | 'asd'

async function renderRefunds(){
  const el = document.getElementById('sec-refunds');
  if(!el) return;
  if(!CU){
    el.innerHTML='<div class="wrap"><div class="empty"><div class="empty-icon">🔒</div><div class="empty-text">Please log in.</div></div></div>';
    return;
  }
  _renderRefundsTab(el);
}

function _renderRefundsTab(el){
  const today = new Date();
  const projects = D.projects.filter(p=>!isArchived(p) && (projStatus(p)==='completed'||p.jvDate));

  // Aggregate totals
  let totEMD=0, totFSD=0, totASD=0;
  let pendEMD=0, pendFSD=0, pendASD=0;
  let paidEMD=0, paidFSD=0, paidASD=0;
  let eligEMD=0, eligFSD=0, eligASD=0;

  projects.forEach(p=>{
    const r=getRefundData(p);
    totEMD+=r.emdAmt; totFSD+=r.fsdAmt; totASD+=r.asdEligible?r.asdAmt:0;
    if(r.emdStatus==='paid') paidEMD+=r.emdAmt;
    else if(r.emdStatus==='eligible'||r.emdStatus==='applied') pendEMD+=r.emdAmt;
    if(r.emdStatus==='eligible') eligEMD+=r.emdAmt;
    if(r.fsdStatus==='paid') paidFSD+=r.fsdAmt;
    else if(r.fsdStatus==='eligible'||r.fsdStatus==='applied') pendFSD+=r.fsdAmt;
    if(r.fsdStatus==='eligible') eligFSD+=r.fsdAmt;
    if(r.asdStatus==='paid') paidASD+=r.asdAmt;
    else if(r.asdStatus==='eligible'||r.asdStatus==='applied') pendASD+=r.asdAmt;
    if(r.asdStatus==='eligible') eligASD+=r.asdAmt;
  });

  const totalDeposit = totEMD+totFSD+totASD;
  const totalPaid = paidEMD+paidFSD+paidASD;
  const totalPending = pendEMD+pendFSD+pendASD;
  const totalEligible = eligEMD+eligFSD+eligASD;

  const tabs=[
    {key:'overview',label:'📊 Overview'},
    {key:'emd',     label:'🏦 EMD'},
    {key:'fsd',     label:'📄 FSD'},
    {key:'asd',     label:'💵 ASD'},
  ];

  el.innerHTML=`<div class="wrap">
    <div class="pg-hdr">
      <div>
        <div class="pg-title">🏦 Deposit Refunds</div>
        <div style="font-size:12px;color:var(--text3)">Track EMD, FSD and ASD refunds across all completed projects</div>
      </div>
      <button onclick="exportRefunds()" style="background:var(--gold);color:var(--navy);border:none;border-radius:var(--rs);padding:9px 18px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">📊 Export Excel</button>
    </div>

    <!-- Summary KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:16px">
      ${[
        {l:'Total Deposits Paid',  v:fmt(totalDeposit),  c:'var(--navy)'},
        {l:'Total Refunds Pending',v:fmt(totalPending),  c:'var(--amber)'},
        {l:'Apply Now (Eligible)', v:fmt(totalEligible), c:'#b45309'},
        {l:'Total Received Back',  v:fmt(totalPaid),     c:'var(--green)'},
      ].map(x=>`<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center;border-top:3px solid ${x.c}">
        <div style="font-size:16px;font-weight:800;color:${x.c}">${x.v}</div>
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:600;margin-top:3px">${x.l}</div>
      </div>`).join('')}
    </div>

    <!-- Tab strip -->
    <div style="display:flex;gap:4px;margin-bottom:16px;background:var(--surface2);border-radius:var(--rs);padding:4px">
      ${tabs.map(t=>`<button onclick="_refView='${t.key}';_renderRefundsTab(document.getElementById('sec-refunds'))"
        style="flex:1;padding:8px 12px;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;
          background:${_refView===t.key?'#fff':'transparent'};color:${_refView===t.key?'var(--navy)':'var(--text3)'};
          box-shadow:${_refView===t.key?'0 1px 4px rgba(0,0,0,.1)':'none'}">${t.label}
      </button>`).join('')}
    </div>

    <!-- Tab content -->
    <div id="refunds-body"></div>
  </div>`;

  const body = document.getElementById('refunds-body');
  if(!body) return;

  if(_refView==='overview') body.innerHTML = _renderRefOverview(projects, {totEMD,totFSD,totASD,paidEMD,paidFSD,paidASD,pendEMD,pendFSD,pendASD,eligEMD,eligFSD,eligASD});
  else if(_refView==='emd') body.innerHTML = _renderRefTable(projects, 'emd');
  else if(_refView==='fsd') body.innerHTML = _renderRefTable(projects, 'fsd');
  else if(_refView==='asd') body.innerHTML = _renderRefTable(projects, 'asd');
}

// ─── OVERVIEW TAB ────────────────────────────────────
function _renderRefOverview(projects, totals){
  const today = new Date();

  // Eligible right now (apply immediately)
  const eligibleNow = projects.filter(p=>{
    const r=getRefundData(p);
    return r.emdStatus==='eligible'||r.fsdStatus==='eligible'||r.asdStatus==='eligible';
  });

  // Becoming eligible in next 90 days
  const comingSoon = projects.filter(p=>{
    const r=getRefundData(p);
    return r.emdDaysLeft!==null && r.emdDaysLeft>0 && r.emdDaysLeft<=90 && r.emdStatus==='not_eligible';
  }).sort((a,b)=>getRefundData(a).emdDaysLeft - getRefundData(b).emdDaysLeft);

  // Applied — waiting for JV
  const applied = projects.filter(p=>{
    const r=getRefundData(p);
    return r.emdStatus==='applied'||r.fsdStatus==='applied'||r.asdStatus==='applied';
  });

  const section=(title,color,items,render)=>items.length?`
    <div class="card" style="margin-bottom:14px;border-top:3px solid ${color}">
      <div style="font-size:13px;font-weight:700;color:${color};margin-bottom:12px">${title} (${items.length})</div>
      ${render(items)}
    </div>`:'';

  const projRow=(p,r)=>`<div onclick="openDetail('${p.id}')" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface2);border-radius:var(--rs);margin-bottom:6px;cursor:pointer;flex-wrap:wrap;gap:6px" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='var(--surface2)'">
    <div>
      <div style="font-size:12px;font-weight:700;color:var(--navy)">${p.name.substring(0,55)}</div>
      <div style="font-size:11px;color:var(--text3)">${GC(p.contractorId)?.name||'—'}</div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      ${r.emdStatus==='eligible'?`<span style="font-size:11px;font-weight:600">EMD ${fmt(r.emdAmt)}</span>`:''}
      ${r.fsdStatus==='eligible'?`<span style="font-size:11px;font-weight:600">FSD ${fmt(r.fsdAmt)}</span>`:''}
      ${r.asdStatus==='eligible'?`<span style="font-size:11px;font-weight:600">ASD ${fmt(r.asdAmt)}</span>`:''}
      <span style="font-size:11px;background:#fef9c3;color:#b45309;padding:2px 8px;border-radius:6px;font-weight:700">
        Total: ${fmt((r.emdStatus==='eligible'?r.emdAmt:0)+(r.fsdStatus==='eligible'?r.fsdAmt:0)+(r.asdStatus==='eligible'?r.asdAmt:0))}
      </span>
    </div>
  </div>`;

  return section('🟡 Apply Now — Eligible for Refund', '#b45309', eligibleNow, items=>
    items.map(p=>projRow(p,getRefundData(p))).join('')
  )
  + section('⏳ Applied — Waiting for Refund JV', '#7c3aed', applied, items=>
    items.map(p=>{
      const r=getRefundData(p);
      return `<div onclick="openDetail('${p.id}')" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface2);border-radius:var(--rs);margin-bottom:6px;cursor:pointer;flex-wrap:wrap;gap:6px">
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--navy)">${p.name.substring(0,55)}</div>
          <div style="font-size:11px;color:var(--text3)">${GC(p.contractorId)?.name||'—'}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${r.emdStatus==='applied'?`<span style="font-size:11px;background:#f5f3ff;color:#7c3aed;padding:2px 8px;border-radius:6px">EMD: ${fmt(r.emdAmt)}</span>`:''}
          ${r.fsdStatus==='applied'?`<span style="font-size:11px;background:#f5f3ff;color:#7c3aed;padding:2px 8px;border-radius:6px">FSD: ${fmt(r.fsdAmt)}</span>`:''}
          ${r.asdStatus==='applied'?`<span style="font-size:11px;background:#f5f3ff;color:#7c3aed;padding:2px 8px;border-radius:6px">ASD: ${fmt(r.asdAmt)}</span>`:''}
        </div>
      </div>`;
    }).join('')
  )
  + (comingSoon.length?`<div class="card" style="margin-bottom:14px;border-top:3px solid var(--navy)">
      <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:12px">📅 Becoming Eligible Soon — Next 90 Days (${comingSoon.length})</div>
      ${comingSoon.map(p=>{
        const r=getRefundData(p);
        const d=r.emdDaysLeft;
        const total=r.emdAmt+(r.fsdAmt||0);
        return `<div onclick="openDetail('${p.id}')" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface2);border-radius:var(--rs);margin-bottom:6px;cursor:pointer;flex-wrap:wrap;gap:6px">
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--navy)">${p.name.substring(0,55)}</div>
            <div style="font-size:11px;color:var(--text3)">JV: ${fmtDate(p.jvDate)} · Eligible: ${fmtDate(r.emdEligibleDate)}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <span style="font-size:11px;font-weight:700;color:var(--navy)">${fmt(total)}</span>
            <span style="font-size:11px;background:var(--surface2);border:1px solid var(--border);padding:2px 9px;border-radius:8px;font-weight:700;color:${d<=30?'var(--red)':'var(--amber)'}">${d} days</span>
          </div>
        </div>`;
      }).join('')}
    </div>`:''
  );
}

// ─── INDIVIDUAL DEPOSIT TABLES ────────────────────────
function _renderRefTable(projects, type){
  const today = new Date();
  const col = type==='emd' ? {title:'EMD',color:'var(--navy)'} :
              type==='fsd' ? {title:'FSD',color:'#7c3aed'} :
                             {title:'ASD',color:'#b45309'};

  // Filter to relevant projects
  const rows = projects.map(p=>{
    const r=getRefundData(p);
    if(type==='emd' && !r.hasJV) return null;
    if(type==='fsd' && r.fsdAmt<=0) return null;
    if(type==='asd' && !r.asdEligible && r.asdAmt<=0) return null;
    const status = type==='emd'?r.emdStatus : type==='fsd'?r.fsdStatus : r.asdStatus;
    const amt = type==='emd'?r.emdAmt : type==='fsd'?r.fsdAmt : r.asdAmt;
    return {p, r, status, amt};
  }).filter(Boolean).sort((a,b)=>{
    // Sort: eligible first, then applied, then not eligible, then paid —
    // and *within* each of those groups, nearest-to-eligible first (fewest
    // days left), so the projects that need action soonest are always at
    // the top and newer/further-out ones sink toward the bottom.
    const order = {eligible:0,applied:1,not_eligible:2,no_ea:2,no_jv:3,paid:4,no_fsd:5,not_applicable:5};
    const primary = (order[a.status]||3)-(order[b.status]||3);
    if(primary !== 0) return primary;
    if(type==='asd'){
      // ASD has no fixed waiting period (eligible immediately on EA number)
      // — the closest equivalent to "days left" is how long it's already
      // been waiting on JV, oldest JV first.
      const da = a.p.jvDate ? new Date(a.p.jvDate).getTime() : Infinity;
      const db = b.p.jvDate ? new Date(b.p.jvDate).getTime() : Infinity;
      return da - db;
    }
    const da = a.r.emdDaysLeft===null||a.r.emdDaysLeft===undefined ? Infinity : a.r.emdDaysLeft;
    const db = b.r.emdDaysLeft===null||b.r.emdDaysLeft===undefined ? Infinity : b.r.emdDaysLeft;
    return da - db;
  });

  if(!rows.length) return `<div class="empty"><div class="empty-icon">🏦</div><div class="empty-text">No ${col.title} deposits tracked yet.</div></div>`;

  const totalAmt = rows.reduce((s,x)=>s+x.amt,0);
  const paidAmt = rows.filter(x=>x.status==='paid').reduce((s,x)=>s+x.amt,0);
  const pendingAmt = rows.filter(x=>['eligible','applied'].includes(x.status)).reduce((s,x)=>s+x.amt,0);

  return `<div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap">
    ${[
      {l:'Total ${col.title}',v:fmt(totalAmt),c:col.color},
      {l:'Pending Recovery',v:fmt(pendingAmt),c:'var(--amber)'},
      {l:'Received Back',v:fmt(paidAmt),c:'var(--green)'},
    ].map(x=>`<div style="flex:1;min-width:130px;padding:12px;background:#fff;border:1px solid var(--border);border-radius:10px;text-align:center;border-top:3px solid ${x.c}">
      <div style="font-size:15px;font-weight:800;color:${x.c}">${x.v}</div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase">${x.l}</div>
    </div>`).join('')}
  </div>
  <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:600px">
    <thead><tr style="background:var(--navy);color:#fff">
      <th style="padding:8px 12px;text-align:left">Project</th>
      <th style="padding:8px 12px;text-align:left">Contractor</th>
      <th style="padding:8px 12px;text-align:right">${col.title} Amount</th>
      ${type==='emd'||type==='fsd'?'<th style="padding:8px 12px;text-align:center">Eligible Date</th>':''}
      ${type==='asd'?'<th style="padding:8px 12px;text-align:center">Bid %</th>':''}
      <th style="padding:8px 12px;text-align:center">Status</th>
      <th style="padding:8px 12px;text-align:center">Actions</th>
    </tr></thead>
    <tbody>
      ${rows.map((x,i)=>{
        const {p,r,status,amt}=x;
        const c=GC(p.contractorId);
        return `<tr style="border-bottom:1px solid var(--surface2);background:${i%2?'var(--surface2)':'#fff'}">
          <td style="padding:8px 12px">
            <div style="font-weight:700;font-size:12px;cursor:pointer;color:var(--navy)" onclick="openDetail('${p.id}')">${p.name.substring(0,50)}</div>
            <div style="font-size:10px;color:var(--text3)">${p.firm||'—'} · JV: ${fmtDate(p.jvDate)||'—'}</div>
          </td>
          <td style="padding:8px 12px;font-size:11px">${c?c.name:'—'}</td>
          <td style="padding:8px 12px;text-align:right;font-weight:700">${fmt(amt)}</td>
          ${type==='emd'||type==='fsd'?`<td style="padding:8px 12px;text-align:center;font-size:11px">
            ${r.emdEligibleDate?fmtDate(r.emdEligibleDate):'—'}
            ${r.emdDaysLeft!==null&&r.emdDaysLeft>0?`<div style="font-size:10px;color:var(--amber)">${r.emdDaysLeft}d left</div>`:''}
          </td>`:''}
          ${type==='asd'?`<td style="padding:8px 12px;text-align:center;font-size:11px;font-weight:600">${p.bidPct||0}%</td>`:''}
          <td style="padding:8px 12px;text-align:center">${_statusBadge(status)}</td>
          <td style="padding:8px 12px;text-align:center">
            ${_refActionBtn(p,r,type)}
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table></div>`;
}

function _refActionBtn(p,r,type){
  const status = type==='emd'?r.emdStatus : type==='fsd'?r.fsdStatus : r.asdStatus;
  if(status==='eligible'){
    if(type==='asd') return `<button onclick="markASDApplied('${p.id}')" style="background:#fef9c3;border:1px solid #b45309;color:#b45309;border-radius:6px;padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">Mark Applied</button>`;
    return `<button onclick="markRefundApplied('${p.id}')" style="background:#fef9c3;border:1px solid #b45309;color:#b45309;border-radius:6px;padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">Mark Applied</button>`;
  }
  if(status==='applied'){
    if(type==='asd') return `<button onclick="markASDReceived('${p.id}')" style="background:#f5f3ff;border:1px solid #7c3aed;color:#7c3aed;border-radius:6px;padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">Mark Received</button>`;
    return `<button onclick="markRefundReceived('${p.id}')" style="background:#f5f3ff;border:1px solid #7c3aed;color:#7c3aed;border-radius:6px;padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">Mark Received</button>`;
  }
  return '—';
}

// ─── MARK REFUND RECEIVED ────────────────────────────
async function markRefundReceived(pid){
  const p=GP(pid); if(!p) return;
  const ok = await showConfirm({title:'Mark Refund Received?',message:`Mark EMD + FSD refund as received for <strong>${p.name.substring(0,40)}</strong>?`,confirmLabel:'Yes, Mark Received'});
  if(!ok) return;
  p.refundReceived=true; p.refundReceivedDate=new Date().toISOString().split('T')[0];
  try{
    await saveProjectDB(p,{type:'refund_received',amount:(p.emd||0)+(p.fsd||0),ref:null,meta:{}});
    logActivity({category:'finance',action:'refund_received',projectId:pid,projectName:p.name,amount:(p.emd||0)+(p.fsd||0),description:`EMD+FSD refund received for ${p.name}`});
    toast('✓ Refund marked as received','ok');
    _renderRefundsTab(document.getElementById('sec-refunds'));
  }catch(e){toast('Save failed','error');}
}

// ─── EXPORT ───────────────────────────────────────────
async function exportRefunds(){
  if(!window.XLSX){
    try{/* XLSX pre-loaded */}
    catch(e){toast('Could not load Excel','error');return;}
  }
  const projects = D.projects.filter(p=>!isArchived(p)&&(projStatus(p)==='completed'||p.jvDate));
  const wb = window.XLSX.utils.book_new();

  // Overview sheet
  const hdr=['Project Name','Contractor','Firm','JV Date','EMD Amount','EMD Status','FSD Amount','FSD Status','ASD Amount','ASD Eligible','ASD Status','EMD Eligible Date','Total Deposit','Total Pending'];
  const rows=[hdr];
  projects.forEach(p=>{
    const r=getRefundData(p);
    const c=GC(p.contractorId);
    const pending=(r.emdStatus==='eligible'||r.emdStatus==='applied'?r.emdAmt:0)+(r.fsdStatus==='eligible'||r.fsdStatus==='applied'?r.fsdAmt:0)+(r.asdStatus==='eligible'||r.asdStatus==='applied'?r.asdAmt:0);
    rows.push([
      p.name, c?c.name:'—', p.firm||'—', p.jvDate||'—',
      r.emdAmt, r.emdStatus,
      r.fsdAmt, r.fsdStatus,
      r.asdAmt, r.asdEligible?'YES':'No', r.asdStatus,
      r.emdEligibleDate?r.emdEligibleDate.toISOString().split('T')[0]:'—',
      r.totalDeposit, pending
    ]);
  });
  const ws=window.XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=[{wch:50},{wch:20},{wch:18},{wch:12},{wch:12},{wch:14},{wch:12},{wch:14},{wch:12},{wch:12},{wch:14},{wch:14},{wch:14},{wch:14}];
  window.XLSX.utils.book_append_sheet(wb,ws,'Refunds Overview');
  window.XLSX.writeFile(wb,`RSR_Refunds_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('✓ Exported','ok');
}
