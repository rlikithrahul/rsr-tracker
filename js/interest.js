// ═══════════════════════════════════════
// interest.js — Interest Tracking System
// RSR Constructions Tracker v18
// Three levels:
//   1. Per project (outstanding balance only)
//   2. Per contractor total
//   3. Financial year compounding on 31st March
// ═══════════════════════════════════════

// ─── INTEREST TAB RENDER ──────────────────────────────
function renderInterest(){
  const wrap = document.getElementById('interest-wrap');
  if(!wrap){ console.error('interest-wrap not found'); return; }

  let totalInterest = 0, totalOutstanding = 0;

  const contractorCards = D.contractors.map(c => {
    const projects = D.projects.filter(p => p.contractorId === c.id && projStatus(p) !== 'completed');
    if(!projects.length) return '';

    const settled = projects.reduce((s,p)=>(p.settlements||[]).reduce((a,x)=>a+x.amount,s),0);
    const released = projects.reduce((s,p)=>s+totRel(p),0);
    const outstanding = Math.max(0, released - settled);
    const interest = projects.reduce((s,p)=>s+intrOutstanding(p),0);
    const compoundLog = c.compoundLog || [];

    totalInterest += interest;
    totalOutstanding += outstanding;

    const projRows = projects.map(p => {
      const pSettled = (p.settlements||[]).reduce((s,x)=>s+x.amount,0);
      const pOutstanding = Math.max(0, totRel(p) - pSettled);
      const pInterest = intrOutstanding(p);
      return `<tr>
        <td><a href="#" onclick="openDetail('${p.id}');return false" style="color:var(--navy);font-weight:600">${p.name}</a></td>
        <td style="text-align:right">${fmt(totRel(p))}</td>
        <td style="text-align:right;color:var(--green)">${fmt(pSettled)}</td>
        <td style="text-align:right;color:${pOutstanding>0?'var(--red)':'var(--green)'}">${fmt(pOutstanding)}</td>
        <td style="text-align:right;color:var(--amber);font-weight:600">${fmt(pInterest)}</td>
      </tr>`;
    }).join('');

    const lastFY = compoundLog.slice(-1)[0];
    const currentFY = getCurrentFY();
    const canCompound = canDoCompounding(c, projects);

    return `<div class="int-card">
      <div class="int-card-header">
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--navy)">${c.name}</div>
          <div style="font-size:12px;color:var(--text3)">${projects.length} active project${projects.length!==1?'s':''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Total Interest Accrued</div>
          <div style="font-size:24px;font-weight:800;color:var(--amber)">${fmt(interest)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">on ${fmt(outstanding)} outstanding</div>
        </div>
      </div>
      <div class="tbl-wrap" style="margin-bottom:12px"><table>
        <thead><tr><th>Project</th><th style="text-align:right">Released</th><th style="text-align:right">Settled</th><th style="text-align:right">Outstanding</th><th style="text-align:right">Interest</th></tr></thead>
        <tbody>${projRows}</tbody>
        <tfoot><tr style="background:var(--surface2);font-weight:700">
          <td>TOTAL</td>
          <td style="text-align:right">${fmt(released)}</td>
          <td style="text-align:right;color:var(--green)">${fmt(settled)}</td>
          <td style="text-align:right;color:${outstanding>0?'var(--red)':'var(--green)'}">${fmt(outstanding)}</td>
          <td style="text-align:right;color:var(--amber)">${fmt(interest)}</td>
        </tr></tfoot>
      </table></div>
      <div style="border-top:1px solid var(--border);padding-top:12px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:6px">Financial Year Compounding</div>
          <div style="font-size:12px;color:var(--text3)">On 31st March each year, accumulated interest is added to principal.<br>Current FY: ${currentFY}</div>
          ${lastFY ? `<div class="compound-log" style="margin-top:8px">Last compounded: ${lastFY.date} — Added ${fmt(lastFY.interestAdded)} to principal. New principal: ${fmt(lastFY.newPrincipal)}</div>` : '<div style="font-size:12px;color:var(--text3);margin-top:6px;font-style:italic">No compounding done yet for this contractor.</div>'}
          ${compoundLog.length > 1 ? `<details style="margin-top:6px"><summary style="font-size:12px;cursor:pointer;color:var(--navy)">View full compounding history (${compoundLog.length} entries)</summary>
            ${compoundLog.slice().reverse().map(e=>`<div class="compound-log" style="margin-top:4px">${e.date}: Added ${fmt(e.interestAdded)} → Principal became ${fmt(e.newPrincipal)}</div>`).join('')}
          </details>` : ''}
        </div>
        ${canCompound ? `
          <button class="btn btn-gold" onclick="doCompound('${c.id}')" style="flex-shrink:0">
            📅 Compound Interest<br><span style="font-size:10px;font-weight:400">Add ${fmt(interest)} to principal</span>
          </button>` :
          `<div style="font-size:11px;color:var(--text3);text-align:right;flex-shrink:0">Compounding available<br>on/after 31st March</div>`
        }
      </div>
    </div>`;
  }).filter(Boolean).join('');

  wrap.innerHTML = `
    <div class="pg-hdr"><div class="pg-title">📈 Interest Tracker</div></div>
    <div class="stats" style="margin-bottom:20px">
      <div class="stat"><div class="stat-lbl">Total Outstanding</div><div class="stat-val" style="font-size:18px;color:var(--red)">${fmt(totalOutstanding)}</div><div class="stat-sub">across all contractors</div></div>
      <div class="stat"><div class="stat-lbl">Total Interest</div><div class="stat-val int-val" style="font-size:18px">${fmt(totalInterest)}</div><div class="stat-sub">@ 24% p.a. on outstanding</div></div>
      <div class="stat"><div class="stat-lbl">Rate</div><div class="stat-val" style="font-size:18px">24%</div><div class="stat-sub">per annum</div></div>
      <div class="stat"><div class="stat-lbl">Next Compounding</div><div class="stat-val" style="font-size:16px">${getNextMarch()}</div><div class="stat-sub">31st March</div></div>
    </div>
    <div style="font-size:13px;color:var(--text2);background:var(--amber-bg);border:1px solid #f5d5a0;border-radius:var(--rs);padding:12px 14px;margin-bottom:20px">
      ℹ️ Interest is calculated on <strong>outstanding balance only</strong> (funds released minus government settlements received). Once a project is settled, interest stops on that amount.
    </div>
    ${contractorCards || '<div class="empty"><div class="empty-icon">📈</div><div class="empty-text">No active contractors with outstanding balances.</div></div>'}`;
}

function getCurrentFY(){
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear()-1;
  return `FY ${year}-${String(year+1).slice(-2)}`;
}

function getNextMarch(){
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear()+1 : now.getFullYear();
  return `31 Mar ${year}`;
}

function canDoCompounding(c, projects){
  const now = new Date();
  const isMarchOrLater = now.getMonth() >= 2; // March = 2 (0-indexed)
  if(!isMarchOrLater) return false;
  const currentFY = getCurrentFY();
  const log = c.compoundLog || [];
  const alreadyDoneThisFY = log.some(e => e.fy === currentFY);
  const hasOutstanding = projects.reduce((s,p)=>s+Math.max(0,totRel(p)-(p.settlements||[]).reduce((a,x)=>a+x.amount,0)),0) > 0;
  return !alreadyDoneThisFY && hasOutstanding;
}

async function doCompound(cid){
  const c = D.contractors.find(x=>x.id===cid); if(!c) return;
  const projects = D.projects.filter(p=>p.contractorId===cid && projStatus(p)!=='completed');
  const interest = projects.reduce((s,p)=>s+intrOutstanding(p),0);
  const outstanding = projects.reduce((s,p)=>s+Math.max(0,totRel(p)-(p.settlements||[]).reduce((a,x)=>a+x.amount,0)),0);
  const newPrincipal = outstanding + interest;

  if(!confirm(`Compound interest for ${c.name}?\n\nOutstanding: ${fmt(outstanding)}\nInterest to add: ${fmt(interest)}\nNew principal after compounding: ${fmt(newPrincipal)}\n\nThis is a permanent record. Proceed?`)) return;

  if(!c.compoundLog) c.compoundLog = [];
  c.compoundLog.push({
    id: uid(),
    date: new Date().toLocaleDateString('en-IN'),
    fy: getCurrentFY(),
    outstandingBefore: outstanding,
    interestAdded: interest,
    newPrincipal: newPrincipal,
    compoundedAt: new Date().toISOString(),
    compoundedBy: CU.name
  });
  c.compoundedPrincipal = newPrincipal;

  try {
    await saveContractorDB(c);
    toast(`✅ Interest compounded for ${c.name} — ${fmt(interest)} added to principal`, 'ok', 5000);
    renderInterest();
  } catch(e){ toast('Save failed', 'error'); }
}
