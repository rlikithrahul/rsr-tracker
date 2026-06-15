// ═══════════════════════════════════════
// utils.js
// RSR Constructions Tracker v17
// ═══════════════════════════════════════

// ═══════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════
function toast(msg,type='',dur=2800){
  const el=document.getElementById('toast');
  el.textContent=msg;
  el.style.background=type==='error'?'#c0392b':type==='ok'?'#1a7a3a':'#1a2744';
  el.style.opacity='1';el.style.transform='translateX(-50%) translateY(0)';
  setTimeout(()=>{el.style.opacity='0';el.style.transform='translateX(-50%) translateY(20px)';},dur);
}
function setBusy(v,msg){
  const b=document.getElementById('busy');
  if(msg) document.getElementById('busy-text').textContent=msg;
  if(v) b.classList.add('show'); else b.classList.remove('show');
}

// ─── NUMBER FORMATTING — max 2 decimal places ─────────
const fmt = n => {
  if(!n || n===0) return '₹0';
  const rounded = Math.round((n||0)*100)/100;
  const parts = rounded.toFixed(2).split('.');
  const intPart = parseInt(parts[0]).toLocaleString('en-IN');
  const decPart = parts[1];
  return '₹' + (decPart==='00' ? intPart : intPart+'.'+decPart);
};
const fmtNum = n => {
  if(!n || n===0) return '0';
  const rounded = Math.round((n||0)*100)/100;
  const parts = rounded.toFixed(2).split('.');
  const intPart = parseInt(parts[0]).toLocaleString('en-IN');
  return parts[1]==='00' ? intPart : intPart+'.'+parts[1];
};
const pct = n => (Math.round((n||0)*100)/100).toFixed(2).replace(/\.?0+$/,'') + '%';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
function GP(id){
  let p = D.projects.find(p=>p.id===id);
  if(p) return p;
  // Check personal projects (contractor-owned, not linked to RSR)
  for(const c of (D.contractors||[])){
    if(c.personalProjects){
      const pp = c.personalProjects.find(x=>x.id===id);
      if(pp) return pp;
    }
  }
  return null;
}
function GC(id){ return D.contractors.find(c=>c.id===id)||null; }
function agAmt(p){ return p.estimated*(1+p.bidPct/100); }
function maxF(p){ return agAmt(p)*0.7; }
function totPayments(p){ return (p.releases||[]).filter(r=>r.txType!=='receipt').reduce((s,r)=>s+r.amount,0); }
function totReceipts(p){ return (p.releases||[]).filter(r=>r.txType==='receipt').reduce((s,r)=>s+r.amount,0); }
function totRel(p){ return Math.max(0, totPayments(p) - totReceipts(p)); } // NET deployed = payments minus receipts
function verPct(p){
  // Based on RSR physical verification only — controls funding
  const lv=(p.verifications||[]).slice(-1)[0]; if(!lv) return 0;
  const tv=(p.boq||[]).reduce((s,i)=>s+i.qty*i.rate,0); if(!tv) return 0;
  return (p.boq||[]).reduce((s,i)=>s+(lv.items[i.id]||0)*i.rate,0)/tv*100;
}
function reportedPct(p){
  // Based on contractor-reported quantities (from reviewed updates) — for display only
  const tv=(p.boq||[]).reduce((s,i)=>s+i.qty*i.rate,0); if(!tv) return 0;
  return (p.boq||[]).reduce((s,i)=>s+((p.reportedItems||{})[i.id]||0)*i.rate,0)/tv*100;
}
function eligR(p){ return Math.min(verPct(p)/100*maxF(p),maxF(p)); }
function hdroom(p){ return Math.max(0,eligR(p)-totRel(p)); }
function pStat(p){
  const rel=totRel(p),max=maxF(p);
  if(!max) return 'green';
  const pct=rel/max;
  if(pct>=1.0) return 'overcap';
  if(pct>=0.85) return 'red';
  if(pct>=0.70) return 'orange';
  if(pct>=0.65) return 'caution3';
  if(pct>=0.60) return 'caution2';
  if(pct>=0.55) return 'caution1';
  return 'green';
}
function sBadge(s,p){
  const rel=p?totRel(p):0,max=p?maxF(p):0;
  const pct=max>0?rel/max:0;
  const pp=Math.round(pct*100);
  if(pct>=1.0) return `<span class="badge bg-red">🚨 Over Cap (${pp}%)</span>`;
  if(pct>=0.85) return `<span class="badge bg-red">🔴 High Risk (${pp}%)</span>`;
  if(pct>=0.70) return `<span class="badge bg-amber">🟠 Cap Reached (${pp}%)</span>`;
  if(pct>=0.65) return `<span class="badge bg-amber">🟡 Caution 3 (${pp}%)</span>`;
  if(pct>=0.60) return `<span class="badge bg-amber">🟡 Caution 2 (${pp}%)</span>`;
  if(pct>=0.55) return `<span class="badge bg-amber">🟡 Caution 1 (${pp}%)</span>`;
  return `<span class="badge bg-green">🟢 On Track (${pp}%)</span>`;
}
function capAlert(p){
  const rel=totRel(p),max=maxF(p);
  if(!max) return '';
  const pct=rel/max,pp=Math.round(pct*100);
  if(pct>=1.0) return `<div class="alert al-red">🚨 Over Cap — ${pp}% used. Coordinate with RSR immediately.</div>`;
  if(pct>=0.85) return `<div class="alert al-red">🔴 High Risk — ${pp}% used. RSR monitoring closely.</div>`;
  if(pct>=0.70) return `<div class="alert al-amber">🟠 70% Cap Reached — ${pp}% used. Only verified work can justify further funding.</div>`;
  if(pct>=0.65) return `<div class="alert al-amber">🟡 Caution 3 — ${pp}% used. Work progress must keep pace with funds.</div>`;
  if(pct>=0.60) return `<div class="alert al-amber">🟡 Caution 2 — ${pp}% used. Review work completion vs funds deployed.</div>`;
  if(pct>=0.55) return `<div class="alert al-amber">🟡 Caution 1 — ${pp}% used. Early warning — ensure site is on schedule.</div>`;
  return '';
}
function intr(p){
  return (p.releases||[]).reduce((s,r)=>{
    const d=Math.max(0,Math.round((Date.now()-new Date(r.date).getTime())/86400000));
    return s+r.amount*0.24*d/365;
  },0);
}
function togglePw(id,btn){
  const el=document.getElementById(id);
  el.type=el.type==='password'?'text':'password';
  btn.textContent=el.type==='password'?'👁️':'🙈';
}
function SP(id){ document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); document.getElementById(id).classList.add('active'); }
function OM(id){ if(id==='modal-np') initNP(); document.getElementById(id).classList.add('open'); }
function CM(id){ document.getElementById(id).classList.remove('open'); }
function showErr(msg){ const e=document.getElementById('lerr'); e.textContent=msg; e.style.display='block'; }
// ─── PROJECT STATUS ────────────────────────────────────
function projStatus(p){ return p.status || 'active'; }
function statusBadge(p){
  const s = projStatus(p);
  if(s==='completed') return '<span class="badge status-completed">✓ Completed</span>';
  if(s==='onhold')    return '<span class="badge status-onhold">⏸ On Hold</span>';
  return ''; // active = no badge, just use cap badge
}

// ─── INTEREST — fixed to use outstanding only ──────────
function intr(p){
  const settled = (p.settlements||[]).reduce((s,x)=>s+x.amount,0);
  // Use compounded principal if it exists
  const basePrincipal = p.compoundedPrincipal || 0;
  return (p.releases||[]).reduce((s,r)=>{
    const d = Math.max(0, Math.round((Date.now()-new Date(r.date).getTime())/86400000));
    return s + r.amount * 0.24 * d / 365;
  }, 0) - (settled * 0.24 * 1); // rough reduction for settled portion
}

// Better interest calc — only on outstanding balance
function intrOutstanding(p){
  const settled = (p.settlements||[]).reduce((s,x)=>s+x.amount,0);
  const outstanding = Math.max(0, totRel(p) - settled);
  if(!outstanding) return 0;
  // Find earliest unreleased date
  const releases = (p.releases||[]);
  if(!releases.length) return 0;
  const earliest = releases.reduce((min,r)=>r.date<min?r.date:min, releases[0].date);
  const days = Math.max(0, Math.round((Date.now()-new Date(earliest).getTime())/86400000));
  return outstanding * 0.24 * days / 365;
}

// ─── LAST ACTIVITY ────────────────────────────────────
function lastActivityDays(p){
  const dates = [
    ...(p.releases||[]).map(r=>r.date),
    ...(p.contractorUpdates||[]).map(u=>u.date),
    ...(p.verifications||[]).map(v=>v.date),
    ...(p.settlements||[]).map(s=>s.date)
  ].filter(Boolean);
  if(!dates.length) return null;
  const latest = dates.sort().reverse()[0];
  return Math.round((Date.now()-new Date(latest).getTime())/86400000);
}

function lastActivityHTML(p){
  const days = lastActivityDays(p);
  if(days===null) return '<span style="color:var(--text3);font-size:11px">No activity yet</span>';
  if(days===0) return '<span style="color:var(--green);font-size:11px">⚡ Activity today</span>';
  if(days<=3) return `<span style="color:var(--green);font-size:11px">✓ ${days}d ago</span>`;
  if(days<=7) return `<span style="color:var(--text2);font-size:11px">🕐 ${days}d ago</span>`;
  if(days<=14) return `<span style="color:var(--amber);font-size:11px">⚠️ ${days}d ago</span>`;
  return `<span style="color:var(--red);font-size:11px">🔴 No activity: ${days}d</span>`;
}

// ─── AUTO WARNINGS ENGINE ─────────────────────────────
function getAutoWarnings(p){
  const warnings = [];
  const status = projStatus(p);
  if(status !== 'active') return warnings;

  // 1. No contractor update — only warn if project is 14+ days old
  const updDates = (p.contractorUpdates||[]).map(u=>u.date).filter(Boolean).sort().reverse();
  const daysSinceUpdate = updDates.length
    ? Math.round((Date.now()-new Date(updDates[0]).getTime())/86400000)
    : null;
  const projAgeForUpdate = p.agreeDate
    ? Math.round((Date.now()-new Date(p.agreeDate).getTime())/86400000)
    : Math.round((Date.now()-new Date(p.createdAt||Date.now()).getTime())/86400000);
  // Only alert about missing updates if project is active for 14+ days
  if(projAgeForUpdate > 14){
    if(daysSinceUpdate===null) warnings.push({type:'amber',code:'no_updates',msg:'📭 No contractor updates submitted yet'});
    else if(daysSinceUpdate>14) warnings.push({type:'red',code:'stale_update',msg:`📭 No update for ${daysSinceUpdate} days — follow up with contractor`});
    else if(daysSinceUpdate>7) warnings.push({type:'amber',code:'stale_update',msg:`📭 No update for ${daysSinceUpdate} days`});
  }

  // 2. No RSR verification in 14 days
  const verDates = (p.verifications||[]).map(v=>v.date).filter(Boolean).sort().reverse();
  const daysSinceVer = verDates.length
    ? Math.round((Date.now()-new Date(verDates[0]).getTime())/86400000)
    : null;
  if(daysSinceVer!==null && daysSinceVer>14) warnings.push({type:'amber',code:'no_verification',msg:`🔍 No RSR verification for ${daysSinceVer} days`});

  // 3. Funding above 75%
  const rel=totRel(p), max=maxF(p);
  if(max>0){
    const pct=rel/max;
    if(pct>=0.85) warnings.push({type:'red',code:'high_cap',msg:`🚨 ${Math.round(pct*100)}% of cap used — urgent review`});
    else if(pct>=0.75) warnings.push({type:'amber',code:'high_cap',msg:`⚠️ ${Math.round(pct*100)}% of cap used — monitor closely`});
  }

  // 4. No BOQ items configured
  if(!(p.boq||[]).length) warnings.push({type:'amber',code:'no_boq',msg:'📋 No BOQ items configured — add work items'});

  // 5. JV received but no settlement after 300 days
  if(p.jvDate){
    const jvDays = Math.round((Date.now()-new Date(p.jvDate).getTime())/86400000);
    const hasSettlement = (p.settlements||[]).length > 0;
    if(jvDays>300 && !hasSettlement) warnings.push({type:'amber',code:'settlement_overdue',msg:`🏦 JV received ${jvDays} days ago — settlement overdue`});
  }

  // 6. Pending unreviewed updates
  const pending = (p.contractorUpdates||[]).filter(u=>!u.reviewed).length;
  if(pending>0) warnings.push({type:'info',code:'pending_updates',msg:`📸 ${pending} update${pending>1?'s':''} awaiting your review`});

  return warnings;
}

// ─── SOFT DELETE / ARCHIVE ────────────────────────────
function isArchived(item){ return item && item._archived === true; }

// ─── INCOMPLETE PROJECT DETECTION ────────────────────
function getMissingFields(p){
  const missing = [];
  if(!p.tender) missing.push('Tender ID');
  if(!p.costCentre) missing.push('Tally Cost Centre');
  if(!p.type || p.type==='Other') missing.push('Work Type');
  if(!p.agreeDate) missing.push('Agreement Date');
  if(!p.estimated || p.estimated===0) missing.push('Est. BOQ Amount');
  if(!p.bidPct && p.bidPct!==0) missing.push('Bid %');
  if(!p.boq || p.boq.length===0) missing.push('BOQ Items');
  return missing;
}
function isIncomplete(p){ return p._importedFrom==='bulk_excel' && getMissingFields(p).length>0; }

// ─── DUPLICATE DETECTION ─────────────────────────────
function checkDuplicateRelease(p, amount, date, excludeId){
  const releases = (p.releases||[]).filter(r=>!isArchived(r) && r.id!==excludeId && r.txType!=='receipt');
  return releases.find(r=>{
    if(Math.abs(r.amount-amount)>1) return false;
    const daysDiff = Math.abs(new Date(r.date)-new Date(date))/(1000*60*60*24);
    return daysDiff<=3;
  });
}
function checkDuplicateSettlement(p, amount, date, excludeId){
  const settlements = (p.settlements||[]).filter(s=>!isArchived(s) && s.id!==excludeId);
  return settlements.find(s=>{
    if(Math.abs(s.amount-amount)>1) return false;
    const daysDiff = Math.abs(new Date(s.date)-new Date(date))/(1000*60*60*24);
    return daysDiff<=3;
  });
}

// ─── FUZZY MATCH (Levenshtein distance) ──────────────
function levenshtein(a, b){
  a = a.toUpperCase(); b = b.toUpperCase();
  const m = a.length, n = b.length;
  const dp = Array.from({length:m+1}, (_,i) => Array.from({length:n+1}, (_,j) => i===0?j:j===0?i:0));
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}

function fuzzyMatchProject(costCentre){
  if(!costCentre) return null;
  let best = null, bestDist = 999;
  for(const p of D.projects){
    if(!p.costCentre || isArchived(p)) continue;
    const dist = levenshtein(costCentre, p.costCentre);
    if(dist < bestDist && dist <= 3){ bestDist = dist; best = p; }
  }
  return best && bestDist > 0 ? {project: best, distance: bestDist} : null;
}

// ─── TRANSACTION FINGERPRINT ─────────────────────────
function txFingerprint(tx){
  // Hash of date+amount+costCentre+ledger — catches re-entered transactions
  // Simple deterministic string, no crypto needed
  const raw = [
    tx.date||'',
    Math.round(tx.amount)||0,
    (tx.costCentre||'').toUpperCase().trim(),
    (tx.ledger||'').toUpperCase().trim().slice(0,20),
    Math.round(tx.amount * 100) // extra precision guard
  ].join('|');
  // DJB2 hash — fast, good distribution, no crypto dependency
  let h = 5381;
  for(let i=0;i<raw.length;i++) h = ((h<<5)+h) ^ raw.charCodeAt(i);
  return (h >>> 0).toString(36); // unsigned 32-bit, base36
}

function isDuplicateTx(proj, tx){
  if(!proj.releases) return false;
  const fp = txFingerprint(tx);
  return proj.releases.some(r =>
    (r.ref && r.ref === tx.vchNo && Math.abs(r.amount - tx.amount) < 1 && r.date === tx.date) ||
    (r._fp && r._fp === fp)
  );
}

// ─── DATA MIGRATION FRAMEWORK ────────────────────────
const CURRENT_SCHEMA = 4;

function migrateProject(p){
  if((p._schemaVersion||0) >= CURRENT_SCHEMA) return p;

  // v1 → v2: add txType to releases
  if((p._schemaVersion||0) < 2){
    (p.releases||[]).forEach(r => { if(!r.txType) r.txType = 'payment'; });
  }
  // v2 → v3: add _archived:false default (implicit — checks use isArchived() which returns false if missing)
  // v3 → v4: add fingerprint to existing releases
  if((p._schemaVersion||0) < 4){
    (p.releases||[]).forEach(r => {
      if(!r._fp) r._fp = txFingerprint({
        date: r.date, amount: r.amount,
        costCentre: r.costCentre||'', ledger: r.notes||''
      });
    });
  }

  p._schemaVersion = CURRENT_SCHEMA;
  return p;
}

function migrateAllProjects(){
  let migrated = 0;
  D.projects.forEach(p => {
    if((p._schemaVersion||0) < CURRENT_SCHEMA){
      migrateProject(p);
      migrated++;
    }
  });
  if(migrated > 0) console.log(`[Migration] Migrated ${migrated} projects to schema v${CURRENT_SCHEMA}`);
  return migrated;
}

// ─── INDIAN DATE FORMAT ───────────────────────────────
// Converts YYYY-MM-DD or ISO string to "27 May 2026"
function fmtDate(dateStr){
  if(!dateStr) return '—';
  try{
    const d = new Date(dateStr);
    if(isNaN(d.getTime())) return dateStr;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }catch(e){ return dateStr; }
}

// Short date with time: "27 May 2026, 09:30"
function fmtDateTime(dateStr){
  if(!dateStr) return '—';
  try{
    const d = new Date(dateStr);
    if(isNaN(d.getTime())) return dateStr;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}, ${time}`;
  }catch(e){ return dateStr; }
}

