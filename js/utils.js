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
// Date the 2-year EMD/FSD clock starts from: earliest of JV date and MB (Measurement Book) recording date
function refundBase(p){ const a=(p&&p.jvDate)||'', b=(p&&p.mbDate)||''; return (a&&b)?(a<b?a:b):(a||b); }
function hasJvOrMb(p){ return !!(p&&(p.jvDate||p.mbDate)); }
function agAmt(p){ return p.estimated*(1+p.bidPct/100); }
function maxF(p){ return agAmt(p)*0.7; }
// isArchived() check is critical here — without it, a deleted or
// transferred-away release keeps counting forever, since delete/transfer
// both soft-delete (_archived:true) rather than removing the record.
// This single function drives Net Deployed, Cap Used %, Available, and
// the Funding Opportunity panel, so a missing filter here silently wrongs
// every one of those at once.
// The releases a project is judged on. Normally its own p.releases (Excel/Tally-import + manual). When the "Use Tally numbers" switch is ON
// and the project is linked in Tally Live, the Excel-imported entries are HIDDEN (still stored, never deleted) and the Tally payments
// are used instead; manual / settlement-origin entries are kept. Unlinked projects are unaffected.
function relList(p){
  const all=(p.releases||[]).filter(r=>!isArchived(r));
  const t=(typeof tvRel==='function')?tvRel(p):null;
  if(!t) return all;
  return t.concat(all.filter(r=>!isExcelRel(r)));
}
// An entry that came from the old Excel upload (any of its import paths: tally, tally-manual, tally-fuzzy, tally-forced, tally-monthly, or an old entry with no source at all).
// These are HIDDEN everywhere while Tally Live is the source (still stored, never deleted). Settlement-origin entries are not Excel entries and stay.
function isExcelRel(r){ const s=String(r&&r.source||''); if(s==='settlement'||s==='manual'||s==='tally-live') return false; return s===''||s.indexOf('tally')===0; }
function totPayments(p){ return relList(p).filter(r=>r.txType!=='receipt').reduce((s,r)=>s+r.amount,0); }
// Only receipts that have been explicitly confirmed as a real government
// settlement count toward reducing at-risk capital. A raw Tally "Receipt"
// entry can be all sorts of things — an internal transfer between
// contractors, a refund, anything — not necessarily money actually paid
// back by GVMC. The Settle flow (with its settlement-detection
// suggestions) is the explicit, human-confirmed record of what's really
// been received from the government; that confirmed list is the only
// thing that should count here. This directly affects Net Deployed, Cap
// Used %, and interest accrual (interest stops only once capital is
// genuinely confirmed recovered, not just because an unrelated receipt
// happened to show up in Tally).
function totReceipts(p){ return (p.settlements||[]).filter(s=>!isArchived(s)).reduce((s,x)=>s+(x.amount||0),0); }
// Money that came back through Tally on this project's cost centre / ledger but is NOT recorded as a settlement (a settlement already linked to its Tally receipt is counted once, as the settlement).
function totTallyOtherReceipts(p){ return (typeof tvOtherReceipts==='function') ? tvOtherReceipts(p) : 0; }
function totRel(p){ return Math.max(0, totPayments(p) - totReceipts(p) - totTallyOtherReceipts(p)); } // NET deployed = payments − settlements − other receipts in Tally
function verPct(p){
  // Based on RSR physical verification only — controls funding
  const lv=(p.verifications||[]).slice(-1)[0]; if(!lv) return 0;
  const items = lv.items||lv.quantities||{};
  const tv=(p.boq||[]).reduce((s,i)=>s+i.qty*i.rate,0); if(!tv) return 0;
  return (p.boq||[]).reduce((s,i)=>s+(items[i.id]||0)*i.rate,0)/tv*100;
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
  if(s==='settled')   return '<span class="badge status-completed">💰 Settled</span>';
  if(s==='completed') return '<span class="badge status-completed">✓ Completed</span>';
  if(s==='onhold')    return '<span class="badge status-onhold">⏸ On Hold</span>';
  return ''; // active = no badge, just use cap badge
}

// intr(p) removed — approximate formula, no longer called.
// Interest is calculated from Tally (tlInterest in tallylive.js; project/contractor views in tallyview.js)
// (chronological event-based, correctly handles receipts/settlements/compounding).
// Used by: Interest tab, Backup/Excel export.

// (Used by: Interest tab, Backup/Excel export, integrity self-test.)

// ─── LAST ACTIVITY ────────────────────────────────────
function lastActivityDays(p){
  const dates = [
    ...relList(p).map(r=>r.date),
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
  const isCompleted = p.status==='completed';
  const hasEA = !!(p.eaNumber || (p.documents && p.documents.ea));

  // Tender ID and Work Type must always be present, whether the project is
  // active or completed — these identify the project itself, unlike the
  // in-progress operational fields below.
  if(!p.tender) missing.push('Tender ID');
  if(!p.type || p.type==='Other') missing.push('Work Type');

  // For completed projects: the work is done and JV is uploaded — don't keep
  // nagging about setup fields that only matter while a project is still
  // running (Cost Centre, BOQ, Estimated Amount).
  if(!isCompleted){
    if(!p.costCentre) missing.push('Tally Cost Centre');
    if(!p.estimated || p.estimated===0) missing.push('Est. BOQ Amount');
    if(!p.bidPct && p.bidPct!==0) missing.push('Bid %');
    if(!p.boq || p.boq.length===0) missing.push('BOQ Items');
  }
  // Agreement Date: not required for completed projects — JV received already
  // implies the agreement was done, even if the exact date wasn't recorded
  // (common for old/bulk-imported closed projects)
  if(!p.agreeDate && !isCompleted) missing.push('Agreement Date');

  // Security deposit amounts — each only becomes relevant once the project
  // has reached the lifecycle stage where that figure is actually known, so
  // we don't nag about it before then:
  //  - EMD is fixed once the agreement is signed
  //  - FSD is only known once the JV (which it's deducted from) is received
  //  - ASD is only relevant once EA number is received (that's when ASD
  //    refund eligibility begins)
  if(p.agreeDate && (!p.emd || p.emd<=0)) missing.push('EMD Amount');
  if(p.jvDate && (!p.fsd || p.fsd<=0)) missing.push('FSD Amount');
  if(hasEA && Math.abs(p.bidPct||0) > 25 && (!p.asd || p.asd<=0)) missing.push('ASD Amount (required — bid % above 25%)');
  return missing;
}
function isIncomplete(p){
  if(p._importedFrom==='bulk_excel' && getMissingFields(p).length>0) return true;
  // ASD missing on high-bid projects is flagged once EA number is received
  // (that's the point ASD refund eligibility begins) — not before.
  const hasEA = !!(p.eaNumber || (p.documents && p.documents.ea));
  if(hasEA && Math.abs(p.bidPct||0) > 25 && (!p.asd || p.asd<=0)) return true;
  return false;
}

// ─── DUPLICATE DETECTION ─────────────────────────────
// Finds groups of releases that share the same voucher number AND amount
// — this is what a duplicate Tally import actually looks like (the same
// underlying transaction, imported twice, often landing on different
// dates due to date-shift issues). Two genuinely different transactions
// essentially never share both a voucher number and an exact amount, so
// this is a reliable, low-false-positive signal — unlike matching on
// amount alone, which is common for round-number payments.
function findDuplicateVouchers(p){
  const releases = (p.releases||[]).filter(r=>!isArchived(r) && r.ref && String(r.ref).trim());
  const groups = {};
  releases.forEach(r=>{
    const key = String(r.ref).trim().toLowerCase() + '|' + Math.round((r.amount||0)*100);
    if(!groups[key]) groups[key] = { ref:r.ref, amount:r.amount, entries:[] };
    groups[key].entries.push(r);
  });
  return Object.values(groups).filter(g=>g.entries.length>1);
}

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

// ─── FIND EXISTING RELEASE BY VOUCHER IDENTITY ────────
// Voucher number + date together are GVMC's stable transaction identity —
// they don't change even when amount is corrected or cost centre is reassigned
// in Tally. This searches EVERY project (not just the cost-centre match) so
// re-imports can detect corrections and cost-centre moves instead of either
// silently duplicating or silently missing the change.
// For multi-cost-centre vouchers (one Vch # split across several projects),
// costCentre is included to disambiguate between the split portions.
function findExistingReleaseByVoucher(vchNo, date, costCentre){
  if(!vchNo || !date) return null;
  for(const proj of D.projects){
    if(isArchived(proj) || !proj.releases) continue;
    const rel = proj.releases.find(r =>
      r.ref === vchNo && r.date === date &&
      (r.costCentre||'').toUpperCase() === (costCentre||'').toUpperCase()
    );
    if(rel) return { project: proj, release: rel };
  }
  // No exact cost-centre match — try voucher+date alone (handles the case
  // where the SAME voucher portion moved to a different cost centre entirely,
  // which is the reassignment scenario we need to detect)
  for(const proj of D.projects){
    if(isArchived(proj) || !proj.releases) continue;
    const rel = proj.releases.find(r => r.ref === vchNo && r.date === date);
    if(rel) return { project: proj, release: rel };
  }
  return null;
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

// ─── FILE DOWNLOAD ───────────────────────────────────
// Files live on another web address (Cloudflare storage). Browsers ignore <a download> for another address and just OPEN the file,
// so the file is fetched and saved from here instead. Saved with its own name and in whatever format it is stored in.
async function rsrDownload(url, name, ev){
  if(ev && ev.preventDefault) ev.preventDefault();
  if(!url){ toast('No file to download','error'); return false; }
  try{
    toast('Downloading…','ok',1500);
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) throw new Error('storage returned '+res.status);
    const blob = await res.blob();
    let fn = String(name||'').trim() || decodeURIComponent((String(url).split('?')[0].split('/').pop())||'file');
    if(!/\.[A-Za-z0-9]{2,5}$/.test(fn)){                                   // name has no extension → take it from the stored file
      const ue = (/\.([A-Za-z0-9]{2,5})$/.exec(String(url).split('?')[0])||[])[1];
      if(ue) fn += '.'+ue;
    }
    fn = fn.replace(/[\\/:*?"<>|]+/g,'_');
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 30000);
    toast('✓ Downloaded '+fn,'ok',2500);
  }catch(e){
    console.warn('[download]', e);
    window.open(url, '_blank', 'noopener');
    toast('Could not save the file directly, so it was opened in a new tab — the storage needs its one-time CORS setting for direct download.','error',7000);
  }
  return false;
}
function _dlAttr(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

// ─── DATE FORMAT — ONE STYLE EVERYWHERE: "05 Nov 2026" ───────────────
// Every date the app shows goes through fmtDate / fmtDateTime. (datefmt.js also converts any date that slips through.)
const _DF_MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function _dfOut(y,m,d){ return String(d).padStart(2,'0')+' '+_DF_MON[m-1]+' '+y; }
function fmtDate(v){
  if(v===null || v===undefined || v==='') return '—';
  try{
    if(v instanceof Date){ if(isNaN(v.getTime())) return '—'; return _dfOut(v.getFullYear(), v.getMonth()+1, v.getDate()); }
    const s = String(v).trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);                    // 2026-11-05  (no time-zone shifting)
    if(m) return _dfOut(+m[1], +m[2], +m[3]);
    m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(s);         // 05/11/2026, 05-11-2026
    if(m && +m[1]>=1 && +m[1]<=31 && +m[2]>=1 && +m[2]<=12) return _dfOut(+m[3], +m[2], +m[1]);
    const d = new Date(s);                                             // full timestamps
    if(isNaN(d.getTime())) return s;
    return _dfOut(d.getFullYear(), d.getMonth()+1, d.getDate());
  }catch(e){ return String(v); }
}
// Date with time: "05 Nov 2026, 14:30"
function fmtDateTime(v){
  if(v===null || v===undefined || v==='') return '—';
  try{
    const d = (v instanceof Date) ? v : new Date(v);
    if(isNaN(d.getTime())) return fmtDate(v);
    return fmtDate(d)+', '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  }catch(e){ return String(v); }
}


// Financial-year label (moved here from the retired interest.js; used by the Work Experience screens)
function getFYLabel(date){
  const d = new Date(date);
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear()-1;
  return `FY ${year}-${String(year+1).slice(-2)}`;
}
