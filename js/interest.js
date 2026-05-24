// ═══════════════════════════════════════════════════════
// interest.js — RSR Constructions Tracker v21d
// COMPLETE REWRITE — Two-level interest system:
//
//  LEVEL 1: Per-project (reference only)
//   - Chronological walk of releases/receipts/settlements
//   - Settlement stops interest from that day
//   - Full settlement stops interest permanently
//
//  LEVEL 2: Contractor total ledger (the real calculation)
//   - ALL transactions across ALL projects pooled
//   - Running outstanding = payments out − any receipts in
//   - Interest accrues daily on running balance
//   - March 31 each year: compound (add accrued interest to principal)
//   - New FY starts on compounded principal from April 1
//
// Rate: 24% per annum, simple daily (amount × 0.24 × days/365)
// ═══════════════════════════════════════════════════════

// ─── FINANCIAL YEAR HELPERS ──────────────────────────
function getCurrentFY(){
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear()-1;
  return `FY ${year}-${String(year+1).slice(-2)}`;
}
function getFYLabel(date){
  const d = new Date(date);
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear()-1;
  return `FY ${year}-${String(year+1).slice(-2)}`;
}
function getFYStart(fyLabel){
  // "FY 2024-25" → April 1 2024
  const year = parseInt(fyLabel.split(' ')[1].split('-')[0]);
  return new Date(year, 3, 1); // April = month 3 (0-indexed)
}
function getFYEnd(fyLabel){
  const year = parseInt(fyLabel.split(' ')[1].split('-')[0]);
  return new Date(year+1, 2, 31, 23, 59, 59); // March 31
}
function getNextMarch(){
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear()+1 : now.getFullYear();
  return `31 Mar ${year}`;
}
function daysBetween(d1, d2){
  return Math.max(0, Math.round((new Date(d2) - new Date(d1)) / 86400000));
}

// ─── PROJECT-LEVEL INTEREST (Reference) ─────────────
// Walks chronologically, balance reduces on settlement
// Returns: { interest, outstanding, settled, isFullySettled, breakdown[] }
function calcProjectInterest(p){
  const RATE = 0.24;

  // Build chronological event list
  const events = [];

  // Payments (add to balance)
  (p.releases||[]).filter(r=>!isArchived(r)&&r.txType!=='receipt').forEach(r=>{
    events.push({date:r.date, type:'payment', amount:r.amount, ref:r.ref||''});
  });
  // Receipts (reduce balance)
  (p.releases||[]).filter(r=>!isArchived(r)&&r.txType==='receipt').forEach(r=>{
    events.push({date:r.date, type:'receipt', amount:r.amount, ref:r.ref||''});
  });
  // Settlements (reduce balance + may stop interest)
  (p.settlements||[]).filter(s=>!isArchived(s)).forEach(s=>{
    events.push({date:s.date, type:'settlement', amount:s.amount, ref:s.ref||''});
  });

  if(!events.length) return {interest:0, outstanding:0, settled:0, isFullySettled:false, breakdown:[]};

  events.sort((a,b)=>a.date.localeCompare(b.date));

  let balance = 0;
  let totalSettled = 0;
  let interest = 0;
  let prevDate = null;
  let isFullySettled = false;
  const breakdown = [];
  const today = new Date().toISOString().split('T')[0];

  for(let i=0; i<=events.length; i++){
    const ev = events[i];
    const currentDate = ev ? ev.date : today;

    // Accrue interest on current balance for the period since last event
    if(prevDate && balance > 0 && !isFullySettled){
      const days = daysBetween(prevDate, currentDate);
      if(days > 0){
        const periodInterest = balance * RATE * days / 365;
        interest += periodInterest;
        breakdown.push({
          from:prevDate, to:currentDate, days,
          balance, periodInterest
        });
      }
    }

    if(!ev) break;

    if(ev.type==='payment') balance += ev.amount;
    else if(ev.type==='receipt') balance = Math.max(0, balance - ev.amount);
    else if(ev.type==='settlement'){
      totalSettled += ev.amount;
      balance = Math.max(0, balance - ev.amount);
      // Check if fully settled (balance at zero)
      if(balance <= 0){
        isFullySettled = true;
        balance = 0;
      }
    }
    prevDate = currentDate;
  }

  return {
    interest: Math.round(interest * 100) / 100,
    outstanding: Math.max(0, balance),
    settled: totalSettled,
    isFullySettled,
    breakdown
  };
}

// ─── CONTRACTOR LEDGER INTEREST (The Real Calculation) ─
// All transactions across all projects pooled.
// Outstanding = total payments − total receipts (from any project)
// Compounding log stored per contractor in c.compoundLog[]
// Returns full ledger analysis including per-FY breakdown
function calcContractorLedger(c){
  const RATE = 0.24;
  const projects = D.projects.filter(p=>p.contractorId===c.id&&!isArchived(p));

  // Build complete transaction stream across ALL projects
  const txStream = [];

  projects.forEach(p=>{
    // Payments out (add to outstanding)
    (p.releases||[]).filter(r=>!isArchived(r)&&r.txType!=='receipt').forEach(r=>{
      txStream.push({date:r.date, amount:r.amount, type:'payment', project:p.name, ref:r.ref||''});
    });
    // Receipts in (reduce outstanding) — includes government payments, partial recoveries
    (p.releases||[]).filter(r=>!isArchived(r)&&r.txType==='receipt').forEach(r=>{
      txStream.push({date:r.date, amount:r.amount, type:'receipt', project:p.name, ref:r.ref||''});
    });
    // Settlements also reduce outstanding (government paid, we received it)
    (p.settlements||[]).filter(s=>!isArchived(s)).forEach(s=>{
      txStream.push({date:s.date, amount:s.amount, type:'settlement', project:p.name, ref:s.ref||''});
    });
  });

  if(!txStream.length) return {
    currentOutstanding:0, currentFYInterest:0,
    totalInterestAllTime:0, compoundLog:[],
    fyBreakdown:[], txStream:[]
  };

  txStream.sort((a,b)=>a.date.localeCompare(b.date));

  // Include historical compounding events as balance adjustments
  // Compounding adds interest to principal — we model this as:
  // On March 31, accrued interest is zeroed and added to running balance
  const compoundLog = (c.compoundLog||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));

  // Build master event list: transactions + compound events
  const masterEvents = [
    ...txStream.map(t=>({...t, isCompound:false})),
    ...compoundLog.map(e=>({date:e.date, amount:e.interestAdded, type:'compound', isCompound:true, fy:e.fy}))
  ].sort((a,b)=>a.date.localeCompare(b.date));

  let balance = 0;       // running outstanding principal
  let accrued = 0;       // interest accrued in current FY (resets after compounding)
  let totalInterest = 0; // all-time interest
  let prevDate = null;
  const today = new Date().toISOString().split('T')[0];
  const currentFY = getCurrentFY();
  const currentFYStart = getFYStart(currentFY).toISOString().split('T')[0];
  let currentFYInterest = 0;
  const fyBreakdown = {};

  for(let i=0; i<=masterEvents.length; i++){
    const ev = masterEvents[i];
    const currentDate = ev ? ev.date : today;

    // Accrue interest since last event
    if(prevDate && balance > 0){
      const days = daysBetween(prevDate, currentDate);
      if(days > 0){
        const periodInt = balance * RATE * days / 365;
        accrued += periodInt;
        totalInterest += periodInt;

        // Attribute to correct FY
        const fy = getFYLabel(prevDate);
        if(!fyBreakdown[fy]) fyBreakdown[fy] = {interest:0, avgBalance:0, days:0};
        fyBreakdown[fy].interest += periodInt;
        fyBreakdown[fy].days += days;

        // Current FY interest
        if(prevDate >= currentFYStart) currentFYInterest += periodInt;
      }
    }

    if(!ev) break;

    if(ev.isCompound){
      // Compounding: clear accrued, add to principal
      balance += ev.amount;
      accrued = 0; // reset — now part of principal
    } else if(ev.type==='payment'){
      balance += ev.amount;
    } else if(ev.type==='receipt'||ev.type==='settlement'){
      balance = Math.max(0, balance - ev.amount);
    }

    prevDate = currentDate;
  }

  return {
    currentOutstanding: Math.max(0, balance),
    currentFYInterest: Math.round(currentFYInterest * 100) / 100,
    totalInterestAllTime: Math.round(totalInterest * 100) / 100,
    accruedSinceLastCompound: Math.round(accrued * 100) / 100,
    compoundLog,
    fyBreakdown,
    txStream: masterEvents,
    canCompound: canDoCompounding(c, projects)
  };
}

function canDoCompounding(c, projects){
  const now = new Date();
  // Allow compounding from March 31 onwards
  const isMarchOrLater = (now.getMonth()===2 && now.getDate()>=31) || now.getMonth()>2;
  if(!isMarchOrLater) return false;
  const currentFY = getCurrentFY();
  const log = c.compoundLog || [];
  const alreadyDoneThisFY = log.some(e=>e.fy===currentFY);
  if(alreadyDoneThisFY) return false;
  const outstanding = projects.reduce((s,p)=>s+Math.max(0,
    totPayments(p)-totReceipts(p)-(p.settlements||[]).filter(x=>!isArchived(x)).reduce((a,x)=>a+x.amount,0)
  ),0);
  return outstanding > 0;
}

// ─── COMPOUND INTEREST (March 31 action) ─────────────
async function doCompound(cid){
  const c = D.contractors.find(x=>x.id===cid); if(!c) return;
  const projects = D.projects.filter(p=>p.contractorId===cid&&!isArchived(p));
  const ledger = calcContractorLedger(c);
  const interest = ledger.currentFYInterest;
  const outstanding = ledger.currentOutstanding;

  if(interest<=0){ toast('No interest to compound','ok'); return; }

  if(!confirm(
    `Compound interest for ${c.name}?\n\n` +
    `Current outstanding: ${fmt(outstanding)}\n` +
    `Interest this FY: ${fmt(interest)}\n` +
    `New principal after compounding: ${fmt(outstanding+interest)}\n\n` +
    `This permanently adds ${fmt(interest)} to their principal.\n` +
    `New FY interest will run on ${fmt(outstanding+interest)} from April 1.\n\nProceed?`
  )) return;

  if(!c.compoundLog) c.compoundLog=[];
  c.compoundLog.push({
    id: uid(),
    date: new Date().toLocaleDateString('en-IN', {year:'numeric',month:'2-digit',day:'2-digit'}).split('/').reverse().join('-'),
    fy: getCurrentFY(),
    outstandingBefore: outstanding,
    interestAdded: interest,
    newPrincipal: outstanding + interest,
    compoundedAt: new Date().toISOString(),
    compoundedBy: CU.name
  });

  try{
    await saveContractorDB(c);
    // Write ledger event
    await writeLedgerEvent('compound', null, cid, interest, null, {
      outstanding, newPrincipal: outstanding+interest, fy: getCurrentFY()
    });
    toast(`✅ Compounded: ${fmt(interest)} added to ${c.name}'s principal`, 'ok', 5000);
    renderInterest();
  }catch(e){ toast('Save failed','error'); }
}

// ─── RENDER INTEREST TAB ─────────────────────────────
function renderInterest(){
  const wrap = document.getElementById('interest-wrap');
  if(!wrap) return;

  const today = new Date().toISOString().split('T')[0];
  let grandOutstanding = 0, grandInterestFY = 0, grandInterestAllTime = 0;

  const contractorCards = D.contractors.map(c=>{
    const projects = D.projects.filter(p=>p.contractorId===c.id&&!isArchived(p));
    if(!projects.length) return '';

    const ledger = calcContractorLedger(c);
    grandOutstanding += ledger.currentOutstanding;
    grandInterestFY += ledger.currentFYInterest;
    grandInterestAllTime += ledger.totalInterestAllTime;

    // Per-project reference rows
    const projRows = projects.map(p=>{
      const pi = calcProjectInterest(p);
      const statusLabel = pi.isFullySettled
        ? '<span style="color:var(--green);font-size:10px;font-weight:700">✓ SETTLED</span>'
        : pi.outstanding<=0
          ? '<span style="color:var(--green);font-size:10px">Zero balance</span>'
          : `<span style="color:var(--red);font-size:10px">${fmt(pi.outstanding)} outstanding</span>`;
      return `<tr>
        <td><a href="#" onclick="openDetail('${p.id}');ownerTab(5);return false" style="color:var(--navy);font-weight:600">${p.name}</a></td>
        <td style="text-align:right">${fmt(totPayments(p))}</td>
        <td style="text-align:right;color:var(--green)">${fmt(pi.settled)}</td>
        <td style="text-align:right">${statusLabel}</td>
        <td style="text-align:right;color:var(--amber);font-weight:600">${fmt(pi.interest)}</td>
        <td style="text-align:center;font-size:11px">${pi.isFullySettled?'Stopped':'Running'}</td>
      </tr>`;
    }).join('');

    // FY breakdown
    const fyRows = Object.entries(ledger.fyBreakdown).sort((a,b)=>b[0].localeCompare(a[0])).map(([fy,data])=>`
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:12px">
        <span style="color:var(--text2)">${fy}</span>
        <span style="font-weight:600;color:var(--amber)">${fmt(data.interest)}</span>
      </div>`).join('');

    const lastCompound = ledger.compoundLog.slice(-1)[0];

    return `<div class="int-card" style="margin-bottom:20px">

      <!-- Contractor Header -->
      <div class="int-card-header">
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--navy)">${c.name}</div>
          <div style="font-size:12px;color:var(--text3)">${projects.length} project${projects.length!==1?'s':''} · Ledger-level calculation</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Interest This FY</div>
          <div style="font-size:26px;font-weight:800;color:var(--amber)">${fmt(ledger.currentFYInterest)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">on ${fmt(ledger.currentOutstanding)} outstanding</div>
        </div>
      </div>

      <!-- Ledger Summary -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0">
        <div style="background:var(--surface2);border-radius:var(--rs);padding:10px;text-align:center">
          <div style="font-size:11px;color:var(--text3)">Current Outstanding</div>
          <div style="font-size:16px;font-weight:700;color:${ledger.currentOutstanding>0?'var(--red)':'var(--green)'}">${fmt(ledger.currentOutstanding)}</div>
        </div>
        <div style="background:var(--surface2);border-radius:var(--rs);padding:10px;text-align:center">
          <div style="font-size:11px;color:var(--text3)">This FY Interest</div>
          <div style="font-size:16px;font-weight:700;color:var(--amber)">${fmt(ledger.currentFYInterest)}</div>
        </div>
        <div style="background:var(--surface2);border-radius:var(--rs);padding:10px;text-align:center">
          <div style="font-size:11px;color:var(--text3)">All-Time Interest</div>
          <div style="font-size:16px;font-weight:700;color:var(--amber)">${fmt(ledger.totalInterestAllTime)}</div>
        </div>
      </div>

      <!-- Per-project reference table -->
      <div style="font-size:12px;font-weight:700;color:var(--navy);margin:10px 0 6px">Per-Project Reference</div>
      <div class="tbl-wrap" style="margin-bottom:14px">
        <table>
          <thead><tr>
            <th>Project</th>
            <th style="text-align:right">Payments</th>
            <th style="text-align:right">Settled</th>
            <th style="text-align:right">Balance</th>
            <th style="text-align:right">Interest</th>
            <th style="text-align:center">Status</th>
          </tr></thead>
          <tbody>${projRows}</tbody>
        </table>
      </div>

      <!-- FY Interest History -->
      ${Object.keys(ledger.fyBreakdown).length>0?`
      <details style="margin-bottom:14px">
        <summary style="font-size:12px;font-weight:700;color:var(--navy);cursor:pointer;padding:6px 0">
          📅 Interest by Financial Year
        </summary>
        <div style="margin-top:8px;padding:10px;background:var(--surface2);border-radius:var(--rs)">
          ${fyRows}
        </div>
      </details>`:''}

      <!-- Compounding -->
      <div style="border-top:1px solid var(--border);padding-top:12px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:6px">📅 FY Compounding (31st March)</div>
          <div style="font-size:12px;color:var(--text3);margin-bottom:8px">On March 31 each year, this FY's interest (${fmt(ledger.currentFYInterest)}) is added to the outstanding principal. New FY starts on the compounded amount.</div>
          ${lastCompound?`<div style="font-size:12px;background:var(--surface2);border-radius:var(--rs);padding:8px 10px;margin-bottom:6px">
            Last compounded: <strong>${lastCompound.date}</strong> (${lastCompound.fy}) — Added ${fmt(lastCompound.interestAdded)} → Principal became ${fmt(lastCompound.newPrincipal)}
          </div>`:'<div style="font-size:12px;color:var(--text3);font-style:italic;margin-bottom:6px">No compounding done yet.</div>'}
          ${ledger.compoundLog.length>1?`<details><summary style="font-size:11px;cursor:pointer;color:var(--navy)">View all ${ledger.compoundLog.length} compounding entries</summary>
            <div style="margin-top:6px">
              ${ledger.compoundLog.slice().reverse().map(e=>`<div style="font-size:11px;color:var(--text2);padding:3px 0;border-bottom:1px solid var(--border)">${e.date} · ${e.fy} · Added ${fmt(e.interestAdded)} · Principal → ${fmt(e.newPrincipal)}</div>`).join('')}
            </div>
          </details>`:''}
        </div>
        ${ledger.canCompound?`
          <button class="btn btn-gold" onclick="doCompound('${c.id}')" style="flex-shrink:0;padding:10px 16px">
            📅 Compound Now<br>
            <span style="font-size:10px;font-weight:400">Add ${fmt(ledger.currentFYInterest)} to principal</span>
          </button>`:`
          <div style="font-size:11px;color:var(--text3);text-align:right;flex-shrink:0">
            Next compounding:<br><strong>${getNextMarch()}</strong>
          </div>`}
      </div>
    </div>`;
  }).filter(Boolean).join('');

  wrap.innerHTML=`
    <div class="pg-hdr"><div class="pg-title">📈 Interest Tracker</div></div>

    <!-- Grand Total Summary -->
    <div class="stats" style="margin-bottom:20px">
      <div class="stat">
        <div class="stat-lbl">Total Outstanding</div>
        <div class="stat-val" style="font-size:18px;color:var(--red)">${fmt(grandOutstanding)}</div>
        <div class="stat-sub">all contractors combined</div>
      </div>
      <div class="stat">
        <div class="stat-lbl">This FY Interest</div>
        <div class="stat-val int-val" style="font-size:18px">${fmt(grandInterestFY)}</div>
        <div class="stat-sub">${getCurrentFY()}</div>
      </div>
      <div class="stat">
        <div class="stat-lbl">All-Time Interest</div>
        <div class="stat-val int-val" style="font-size:18px">${fmt(grandInterestAllTime)}</div>
        <div class="stat-sub">since records began</div>
      </div>
      <div class="stat">
        <div class="stat-lbl">Next Compounding</div>
        <div class="stat-val" style="font-size:16px">${getNextMarch()}</div>
        <div class="stat-sub">31st March</div>
      </div>
    </div>

    <div style="font-size:13px;color:var(--text2);background:var(--amber-bg);border:1px solid #f5d5a0;border-radius:var(--rs);padding:12px 14px;margin-bottom:20px">
      ℹ️ <strong>How this works:</strong> Contractor ledger interest tracks ALL transactions across all projects in one running balance. Any receipt (government payment, partial recovery) immediately reduces the outstanding. Per-project numbers are for reference only. Interest = 24% p.a., calculated daily on outstanding balance.
    </div>

    ${contractorCards||'<div class="empty"><div class="empty-icon">📈</div><div class="empty-text">No contractors with transactions yet.</div></div>'}`;
}
