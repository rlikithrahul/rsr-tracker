// ═══════════════════════════════════════
// integrity.js — System Protection Layer
// RSR Constructions Tracker v19
//
// 1. System Health Check Panel (10 checks)
// 2. Anomaly Detection on contractor updates
// 3. One-click full data backup
// ═══════════════════════════════════════

// ─── 1. SYSTEM HEALTH CHECKS ──────────────────────────

async function runSystemChecks(){
  const modal = document.getElementById('modal-health');
  const body = document.getElementById('health-body');
  modal.classList.add('open');
  body.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text3)"><div class="spinner" style="margin:0 auto 12px"></div>Running checks…</div>';

  const checks = [
    { id:'db',    label:'Database connection',         fn: checkDB },
    { id:'owner', label:'Owner login credentials',     fn: checkOwnerLogin },
    { id:'r2ph',  label:'R2 photo storage reachable',  fn: checkR2Photos },
    { id:'r2doc', label:'R2 document storage reachable',fn: checkR2Docs },
    { id:'cap',   label:'70% cap calculation correct',  fn: checkCapCalc },
    { id:'intr',  label:'Interest calculation correct', fn: checkInterestCalc },
    { id:'cc',    label:'All active projects have Cost Centre set', fn: checkCostCentres },
    { id:'dup',   label:'No duplicate voucher numbers in Tally imports', fn: checkDuplicates },
    { id:'queue', label:'Offline queue empty or syncable', fn: checkOfflineQueue2 },
    { id:'data',  label:'All projects have contractor assigned', fn: checkProjectIntegrity },
  ];

  const results = [];
  for(const check of checks){
    const result = { label: check.label, status: 'running' };
    results.push(result);
    renderHealthResults(results, body);
    try {
      const r = await check.fn();
      result.status = r.pass ? 'pass' : 'warn';
      result.detail = r.detail || '';
    } catch(e){
      result.status = 'fail';
      result.detail = e.message;
    }
    renderHealthResults(results, body);
    await new Promise(r=>setTimeout(r,200)); // small delay so UI updates
  }

  const passes = results.filter(r=>r.status==='pass').length;
  const warns  = results.filter(r=>r.status==='warn').length;
  const fails  = results.filter(r=>r.status==='fail').length;
  const summary = document.getElementById('health-summary');
  if(summary){
    summary.innerHTML = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
        <span style="color:var(--green);font-weight:700">✅ ${passes} passed</span>
        ${warns?`<span style="color:var(--amber);font-weight:700">⚠️ ${warns} warnings</span>`:''}
        ${fails?`<span style="color:var(--red);font-weight:700">❌ ${fails} failed</span>`:''}
        <span style="color:var(--text3);font-size:12px;margin-left:auto">${fails===0&&warns===0?'Safe to deploy ✅':'Review issues before deploying'}</span>
      </div>`;
  }
}

function renderHealthResults(results, container){
  const icons = { pass:'✅', warn:'⚠️', fail:'❌', running:'⏳' };
  const colors = { pass:'var(--green)', warn:'var(--amber)', fail:'var(--red)', running:'var(--text3)' };
  container.innerHTML = `
    <div id="health-summary"></div>
    ${results.map(r=>`
      <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:18px;flex-shrink:0">${icons[r.status]}</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:${colors[r.status]}">${r.label}</div>
          ${r.detail?`<div style="font-size:12px;color:var(--text3);margin-top:2px">${r.detail}</div>`:''}
        </div>
      </div>`).join('')}`;
  // Re-attach summary after re-render
  const summary = document.getElementById('health-summary');
  if(summary && results.every(r=>r.status!=='running')){
    const passes = results.filter(r=>r.status==='pass').length;
    const warns  = results.filter(r=>r.status==='warn').length;
    const fails  = results.filter(r=>r.status==='fail').length;
    summary.innerHTML = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
        <span style="color:var(--green);font-weight:700">✅ ${passes} passed</span>
        ${warns?`<span style="color:var(--amber);font-weight:700">⚠️ ${warns} warnings</span>`:''}
        ${fails?`<span style="color:var(--red);font-weight:700">❌ ${fails} failed</span>`:''}
        <span style="color:var(--text3);font-size:12px">${fails===0&&warns===0?'✅ Safe to deploy':'⚠️ Review before deploying'}</span>
      </div>`;
  }
}

// Individual check functions
async function checkDB(){
  const rows = await sbReq('settings?limit=1','GET');
  return { pass: Array.isArray(rows), detail: 'Supabase responding correctly' };
}

async function checkOwnerLogin(){
  if(!D.ownerPw || D.ownerPw.length < 4) return { pass:false, detail:'Owner password too short or not set' };
  return { pass:true, detail:'Password set and valid length' };
}

async function checkR2Photos(){
  // Try fetching the R2 public URL to confirm bucket is accessible
  try {
    const r = await fetch(R2_PHOTOS_PUBLIC + '/', {method:'HEAD'});
    // 403 or 404 is fine — means R2 is reachable, just no file at root
    return { pass: r.status < 500, detail: `R2 rsr-photos reachable (HTTP ${r.status})` };
  } catch(e){
    return { pass:false, detail:'Cannot reach R2 photos bucket: ' + e.message };
  }
}

async function checkR2Docs(){
  try {
    const r = await fetch(R2_DOCS_PUBLIC + '/', {method:'HEAD'});
    return { pass: r.status < 500, detail: `R2 rsr-documents reachable (HTTP ${r.status})` };
  } catch(e){
    return { pass:false, detail:'Cannot reach R2 documents bucket: ' + e.message };
  }
}

async function checkCapCalc(){
  // Test with known values: BOQ=1000000, bid=-10% → agree=900000, cap=630000
  const testP = { estimated:1000000, bidPct:-10, releases:[], settlements:[] };
  const agree = agAmt(testP);
  const cap = maxF(testP);
  const expectAgree = 900000;
  const expectCap = 630000;
  const ok = Math.abs(agree-expectAgree)<1 && Math.abs(cap-expectCap)<1;
  return { pass:ok, detail: ok ? `✓ 900000 agreement, 630000 cap (correct)` : `Got ${agree} and ${cap}, expected ${expectAgree} and ${expectCap}` };
}

async function checkInterestCalc(){
  // Test: 100000 payment released 30 days ago, 0 settled → interest = 100000*0.24*30/365 ≈ 1973
  const testDate = new Date(Date.now()-30*86400000).toISOString().split('T')[0];
  const testP = {
    releases:[{ id:'t1', date: testDate, amount:100000, txType:'payment' }],
    settlements:[], boq:[], contractorUpdates:[], verifications:[]
  };
  const interest = calcProjectInterest(testP).interest;
  const expected = 100000*0.24*30/365;
  const ok = Math.abs(interest - expected) < 50; // within ₹50 tolerance
  return { pass:ok, detail: ok ? `✓ Interest ${Math.round(interest)} (expected ~${Math.round(expected)})` : `Got ${Math.round(interest)}, expected ~${Math.round(expected)}` };
}

async function checkCostCentres(){
  const active = D.projects.filter(p=>projStatus(p)==='active');
  const missing = active.filter(p=>!p.costCentre || !p.costCentre.trim());
  if(missing.length===0) return { pass:true, detail:`All ${active.length} active projects have Cost Centre set` };
  return { pass:false, detail:`${missing.length} active project(s) missing Cost Centre: ${missing.map(p=>p.name).join(', ')}` };
}

async function checkDuplicates(){
  const vchNos = {};
  let dupCount = 0;
  D.projects.forEach(p=>{
    (p.releases||[]).filter(r=>r.source==='tally').forEach(r=>{
      const key = r.ref + '_' + r.amount + '_' + r.date;
      if(key && key !== '__') {
        if(vchNos[key]) dupCount++;
        else vchNos[key] = p.name;
      }
    });
  });
  if(dupCount===0) return { pass:true, detail:'No duplicate Tally voucher entries found' };
  return { pass:false, detail:`${dupCount} possible duplicate Tally entries detected` };
}

async function checkOfflineQueue2(){
  const q = await getOfflineQueue();
  if(q.length===0) return { pass:true, detail:'Offline queue is empty — all updates synced' };
  return { pass:false, detail:`${q.length} update(s) pending sync — connect to internet and sync before deploying` };
}

async function checkProjectIntegrity(){
  const noContractor = D.projects.filter(p=>!p.contractorId);
  const noBoq = D.projects.filter(p=>(!p.boq||p.boq.length===0));
  const issues = [];
  if(noContractor.length) issues.push(`${noContractor.length} project(s) have no contractor`);
  if(noBoq.length) issues.push(`${noBoq.length} project(s) have no BOQ items`);
  if(!issues.length) return { pass:true, detail:`All ${D.projects.length} projects have contractor and BOQ set` };
  return { pass:false, detail: issues.join('. ') };
}

// ─── 2. ANOMALY DETECTION ─────────────────────────────

function checkUpdateAnomalies(p, update){
  const warnings = [];
  const boq = p.boq || [];
  const history = (p.contractorUpdates||[]).filter(u=>u.reviewed && !u.rejected);

  boq.forEach(item=>{
    const claimed = update.quantities?.[item.id] || 0;
    if(!claimed) return;

    // Check 1: Claimed exceeds remaining BOQ
    const alreadyReported = (p.reportedItems||{})[item.id] || 0;
    const remaining = Math.max(0, item.qty - alreadyReported);
    if(claimed > remaining + 0.5){
      warnings.push({
        level: 'hard',
        msg: `🚫 ${item.desc}: Claimed ${claimed} ${item.unit} but only ${remaining.toFixed(1)} ${item.unit} remaining in BOQ. Cannot exceed total BOQ quantity.`
      });
    }

    // Check 2: More than 2x average daily claim
    const prevClaims = history.map(u=>u.quantities?.[item.id]||0).filter(v=>v>0);
    if(prevClaims.length >= 2){
      const avg = prevClaims.reduce((s,v)=>s+v,0)/prevClaims.length;
      if(claimed > avg * 2.5){
        warnings.push({
          level: 'warn',
          msg: `⚠️ ${item.desc}: Claimed ${claimed} ${item.unit} is ${Math.round(claimed/avg*10)/10}x their average (${Math.round(avg)} ${item.unit}). Verify on site.`
        });
      }
    }

    // Check 3: Exact same as previous update
    const lastClaim = history.slice(-1)[0]?.quantities?.[item.id];
    if(lastClaim && Math.abs(lastClaim - claimed) < 0.01 && claimed > 0){
      warnings.push({
        level: 'warn',
        msg: `⚠️ ${item.desc}: Claimed ${claimed} ${item.unit} — identical to their previous update. Possible duplicate?`
      });
    }
  });

  // Check 4: Unusual submission time
  const hour = new Date().getHours();
  if(hour < 6 || hour > 21){
    warnings.push({
      level: 'info',
      msg: `ℹ️ Update submitted at unusual hour (${hour}:${String(new Date().getMinutes()).padStart(2,'0')}). Note for records.`
    });
  }

  return warnings;
}

// Store pending approval callback globally so anomaly modal can call it
let _pendingApprovalFn = null;
let _pendingCancelFn = null;

function showAnomalyWarnings(warnings, onProceed, onCancel){
  if(!warnings.length){ onProceed(); return; }

  const hardBlocks = warnings.filter(w=>w.level==='hard');
  const softWarns  = warnings.filter(w=>w.level==='warn'||w.level==='info');

  // Store callbacks globally — safe reference, no toString() needed
  _pendingApprovalFn = onProceed;
  _pendingCancelFn = onCancel;

  const modal = document.getElementById('modal-anomaly');
  const body  = document.getElementById('anomaly-body');

  body.innerHTML = `
    ${hardBlocks.length ? `
      <div class="alert al-red" style="margin-bottom:12px">
        <strong>Cannot Approve — BOQ Limit Exceeded</strong>
        ${hardBlocks.map(w=>`<div style="margin-top:6px;font-size:13px">${w.msg}</div>`).join('')}
      </div>` : ''}
    ${softWarns.length ? `
      <div class="alert al-amber" style="margin-bottom:12px">
        <strong>⚠️ Warnings — Review Before Approving</strong>
        ${softWarns.map(w=>`<div style="margin-top:6px;font-size:13px">${w.msg}</div>`).join('')}
      </div>` : ''}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap">
      <button class="btn" onclick="anomalyCancel()">Cancel</button>
      ${hardBlocks.length===0 ? `<button class="btn btn-navy" onclick="anomalyProceed()">Proceed Anyway</button>` : ''}
    </div>`;

  // Ensure anomaly modal is on top — set higher z-index
  modal.style.zIndex = '10000';
  modal.classList.add('open');
}

function anomalyProceed(){
  CM('modal-anomaly');
  if(_pendingApprovalFn){ 
    const fn = _pendingApprovalFn;
    _pendingApprovalFn = null;
    _pendingCancelFn = null;
    fn();
  }
}

function anomalyCancel(){
  CM('modal-anomaly');
  if(_pendingCancelFn){
    const fn = _pendingCancelFn;
    _pendingApprovalFn = null;
    _pendingCancelFn = null;
    fn();
  }
}

// ─── 3. DATA BACKUP ───────────────────────────────────

async function backupAllData(){
  setBusy(true,'Preparing backup…');
  try {
    // Fetch fresh data
    await loadDBSummary();

    const backup = {
      exportedAt: new Date().toISOString(),
      exportedBy: CU?.name || 'RSR Admin',
      appVersion: APP_VERSION,
      summary: {
        projects: D.projects.length,
        contractors: D.contractors.length,
        totalReleased: D.projects.reduce((s,p)=>s+totRel(p),0),
        totalSettled: D.projects.reduce((s,p)=>s+(p.settlements||[]).reduce((a,x)=>a+x.amount,0),0),
      },
      contractors: D.contractors.map(c=>({
        id: c.id,
        name: c.name,
        phone: c.phone,
        notes: c.notes,
        compoundLog: c.compoundLog||[],
        createdAt: c.createdAt
        // password intentionally excluded from backup
      })),
      projects: D.projects.map(p=>({
        ...p,
        // Include everything except we don't need to strip anything
      }))
    };

    // Convert to JSON and download
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `RSR_Backup_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setBusy(false);
    toast(`✅ Backup saved: RSR_Backup_${date}.json (${Math.round(json.length/1024)}KB)`, 'ok', 5000);
  } catch(e){
    setBusy(false);
    toast('Backup failed: ' + e.message, 'error', 5000);
  }
}
