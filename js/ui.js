// ═══════════════════════════════════════
// ui.js
// RSR Constructions Tracker v17
// ═══════════════════════════════════════

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
async function init() {
  setupPWAManifest();
  registerServiceWorker();
  setSplashText('Connecting to database…');

  // Check if offline
  if(!navigator.onLine){
    dbOK = false;
    setSplashText('Offline mode — loading cached data…');
    // Try to restore from session even offline
    const saved = loadSession();
    if(saved){
      CU = saved;
      hideSplash();
      if(CU.role==='owner') enterOwner();
      else enterCont();
      toast('📵 Offline mode — showing cached data','error',4000);
      checkOfflineQueue().catch(()=>{});
    } else {
      hideSplash();
      toast('⚠️ No internet. Please connect and try again.','error',5000);
    }
    return;
  }

  try {
    await loadDBSummary();
    dbOK = true;
  } catch(e) {
    console.error('DB failed:', e);
    dbOK = false;
  }

  const saved = loadSession();
  if (saved) {
    CU = saved;
    hideSplash();
    if (CU.role === 'owner') enterOwner();
    else {
      enterCont();
      checkOfflineQueue().catch(()=>{}); // check and sync any offline updates (async)
      if(dbOK) setTimeout(syncOfflineQueue, 2000);
    }
  } else {
    hideSplash();
    if (!dbOK) toast('⚠️ Database unreachable — check internet','error',5000);
  }
}

function setSplashText(t){ const e=document.getElementById('splash-text'); if(e)e.textContent=t; }
function hideSplash(){ const s=document.getElementById('splash'); if(s)s.style.display='none'; }

// ═══════════════════════════════════════════════════════
// AUTO-REFRESH (poll DB every 30s when owner is viewing)
// ═══════════════════════════════════════════════════════
function startAutoRefresh(){
  stopAutoRefresh();
  autoRefreshTimer = setInterval(async () => {
    if (!CU || !dbOK || !navigator.onLine) return;
    try {
      await loadDBSummary();
      // Re-render current view silently
      if (CU.role === 'owner') {
        if (dpid) renderDetail(dpid);
        else if (atab === 0) renderDash();
        else if (atab === 1) renderProjects();
      } else {
        // Contractor: refresh their home if on home screen
        if (!document.getElementById('cp-home').classList.contains('hidden')) renderCHome();
      }
    } catch(e){ console.error('Auto-refresh failed:', e); }
  }, 30000);
}
function stopAutoRefresh(){
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = null;
}

async function manualRefresh(){
  if (!dbOK) return;
  const btn = document.getElementById('refresh-btn');
  btn.classList.add('spin');
  try {
    await loadDB();
    if (CU.role === 'owner') {
      if (dpid) renderDetail(dpid);
      else ownerTab(atab);
    } else {
      renderCHome();
    }
    toast('✓ Updated','ok');
  } catch(e){ toast('Refresh failed','error'); }
  setTimeout(()=>btn.classList.remove('spin'), 500);
}

// ─── DASHBOARD & PROJECT LIST ───────────────────────
function renderDash(){
  // Read search value — element may be in DOM even if section hidden
  const dashSearchEl = document.getElementById('dash-search');
  const searchQ = (dashSearchEl?.value||'').toLowerCase().trim();
  const allProjects = D.projects;
  // Filter by search
  const pp = searchQ ? allProjects.filter(p=>{
    const c = GC(p.contractorId);
    return p.name.toLowerCase().includes(searchQ) ||
           (p.tender||'').toLowerCase().includes(searchQ) ||
           (c&&c.name.toLowerCase().includes(searchQ)) ||
           (p.location||'').toLowerCase().includes(searchQ);
  }) : allProjects;
  const cap=pp.reduce((s,p)=>s+totRel(p),0);
  const settled=pp.reduce((s,p)=>s+(p.settlements||[]).reduce((a,x)=>a+x.amount,0),0);
  const it=pp.reduce((s,p)=>{
    const settledAmt=(p.settlements||[]).reduce((a,x)=>a+x.amount,0);
    const outstanding=Math.max(0,totRel(p)-settledAmt);
    return s+(p.releases||[]).reduce((a,r)=>{
      const d=Math.max(0,Math.round((Date.now()-new Date(r.date).getTime())/86400000));
      return a+r.amount*0.24*d/365;
    },0);
  },0);
  const at=pp.filter(p=>getProjectAlerts(p).some(a=>a.type==='red'||a.type==='amber')).length;
  document.getElementById('dash-stats').innerHTML=`
    <div class="stat"><div class="stat-lbl">Active Projects</div><div class="stat-val">${pp.length}</div><div class="stat-sub">all contractors</div></div>
    <div class="stat"><div class="stat-lbl">Capital Deployed</div><div class="stat-val" style="font-size:17px">${fmt(cap)}</div><div class="stat-sub">${fmt(settled)} settled</div></div>
    <div class="stat"><div class="stat-lbl">Interest Accruing</div><div class="stat-val int-val" style="font-size:17px">${fmt(it)}</div><div class="stat-sub">@ 24% p.a.</div></div>
    <div class="stat"><div class="stat-lbl">Need Attention</div><div class="stat-val" style="color:${at>0?'var(--red)':'var(--green)'}">${at}</div><div class="stat-sub">caution or stop</div></div>`;
  document.getElementById('dash-banner').innerHTML='';
  if(!pp.length){
    document.getElementById('dash-cards').innerHTML='<div class="empty"><div class="empty-icon">🏗️</div><div class="empty-text">No projects yet. Add your first project.</div></div>';
    return;
  }

  // Split by status first, then by alerts
  const active    = pp.filter(p=>projStatus(p)==='active');
  const onhold    = pp.filter(p=>projStatus(p)==='onhold');
  const completed = pp.filter(p=>projStatus(p)==='completed');
  const needsAttn = active.filter(p=>getProjectAlerts(p).length>0);
  const healthy   = active.filter(p=>getProjectAlerts(p).length===0);

  let html='';
  if(searchQ && !pp.length){
    html='<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">No projects match your search.</div></div>';
  } else {
    if(needsAttn.length){
      html+=`<div class="st" style="color:var(--red)">⚠️ Action Required (${needsAttn.length})</div>`;
      html+=needsAttn.map(p=>dashCardHTML(p)).join('');
    }
    if(healthy.length){
      html+=`<div class="st" style="margin-top:${needsAttn.length?'20px':'0'}">✅ On Track (${healthy.length})</div>`;
      html+=healthy.map(p=>dashCardHTML(p)).join('');
    }
    if(onhold.length){
      html+=`<div class="st" style="margin-top:20px;color:#4a6080">⏸ On Hold (${onhold.length})</div>`;
      html+=onhold.map(p=>dashCardHTML(p)).join('');
    }
    if(completed.length){
      html+=`<details style="margin-top:20px"><summary style="cursor:pointer;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);padding:8px 0;border-bottom:1px solid var(--border)">✓ Completed Projects (${completed.length}) — click to expand</summary>`;
      html+=`<div style="margin-top:10px">${completed.map(p=>dashCardHTML(p)).join('')}</div></details>`;
    }
  }
  document.getElementById('dash-cards').innerHTML=html;
  // Restore search value after re-render (innerHTML rebuild clears input)
  const searchElAfter = document.getElementById('dash-search');
  if(searchElAfter && searchQ) searchElAfter.value = searchQ;
}

function dashCardHTML(p){
  const c=GC(p.contractorId);
  const rel=totRel(p),max=maxF(p),el=eligR(p),vp=verPct(p);
  const rp=Math.min(rel/max*100,100); const s=pStat(p); const hw=hdroom(p);
  const pend=(p.contractorUpdates||[]).filter(u=>!u.reviewed).length;
  const lv=(p.verifications||[]).slice(-1)[0];
  const alerts=getProjectAlerts(p);
  const alertsHtml=alerts.map(a=>`<div class="alert-banner ab-${a.type}" onclick="openDetail('${p.id}')">${a.msg}</div>`).join('');
  return `<div class="card" style="${alerts.some(a=>a.type==='red')?'border-color:var(--red);border-left:4px solid var(--red)':''}">
    <div class="card-hdr">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="card-title">${p.name}</span>${sBadge(s,p)}
        </div>
        <div class="card-sub">${p.type} · ${p.location||'—'} · ${c?c.name:'—'} · #${p.tender}</div>
      </div>
      <div class="card-acts">
        <button class="btn btn-sm" onclick="openDetail('${p.id}')">View</button>
        <div class="amenu-wrap">
          <button class="amenu-btn" onclick="event.stopPropagation();toggleMenu('pm-${p.id}')">⋮</button>
          <div class="amenu" id="pm-${p.id}">
            <button class="amenu-item" onclick="openDetail('${p.id}')">📋 View Detail</button>
            <button class="amenu-item" onclick="openOwnerNotes('${p.id}')">📝 Owner Notes${p.ownerNotes?' ●':''}</button>
            <button class="amenu-item" onclick="openSettle('${p.id}')">🏦 Record Payment</button>
            <button class="amenu-item danger" onclick="deleteProject('${p.id}')">🗑️ Delete Project</button>
          </div>
        </div>
      </div>
    </div>
    ${alertsHtml}
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-top:${alerts.length?'10px':'0'}">
      <div>
        <div class="prog"><div class="prog-lbl"><span style="color:var(--amber)">Contractor reported</span><span style="color:var(--amber)">${pct(reportedPct(p))}</span></div><div class="prog-track" style="background:rgba(176,96,0,.15)"><div style="height:100%;border-radius:4px;background:var(--amber);width:${Math.min(reportedPct(p),100)}%"></div></div></div>
        <div class="prog"><div class="prog-lbl"><span>RSR verified</span><span>${pct(vp)}</span></div><div class="prog-track"><div class="prog-fill pf-navy" style="width:${Math.min(vp,100)}%"></div></div></div>
        <div class="prog"><div class="prog-lbl"><span>Cap used (${fmt(rel)} / ${fmt(max)})</span><span>${pct(rp)}</span></div><div class="prog-track"><div class="prog-fill ${s==='red'?'pf-red':s==='amber'?'pf-amber':'pf-green'}" style="width:${rp}%"></div></div></div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">${lv?'Last verified: '+lv.date:'No verification yet'}</div>
      </div>
      <div style="font-size:12px">
        <div class="fr" style="font-size:12px"><span class="fl">Agreement</span><span class="fv">${fmt(agAmt(p))}</span></div>
        <div class="fr" style="font-size:12px"><span class="fl">Max (70%)</span><span class="fv">${fmt(max)}</span></div>
        <div class="fr" style="font-size:12px"><span class="fl">Eligible</span><span class="fv" style="color:var(--green)">${fmt(el)}</span></div>
        <div class="fr" style="font-size:12px"><span class="fl">Headroom</span><span class="fv" style="color:${s==='red'?'var(--red)':s==='amber'?'var(--amber)':'var(--green)'}">${fmt(hw)}</span></div>
        <div class="fr" style="font-size:12px"><span class="fl">Interest</span><span class="int-val">${fmt(intr(p))}</span></div>
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════
// PROJECTS TABLE
// ═══════════════════════════════════════════════════════
function renderProjects(){
  const q=(document.getElementById('psearch')?.value||'').toLowerCase();
  const list=D.projects.filter(p=>{
    if(!q) return true;
    const c=GC(p.contractorId);
    return p.name.toLowerCase().includes(q)||p.tender.includes(q)||(c&&c.name.toLowerCase().includes(q));
  });
  const el=document.getElementById('proj-tbl');
  if(!list.length){el.innerHTML='<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">No projects found.</div></div>';return;}
  el.innerHTML=`<div class="tbl-wrap"><table><thead><tr><th>Project</th><th>Type</th><th>Contractor</th><th>Agreement</th><th>Released</th><th>Verified</th><th>Status</th><th></th></tr></thead><tbody>
  ${list.map(p=>{const c=GC(p.contractorId);return`<tr>
    <td><div style="font-weight:700;color:var(--navy)">${p.name}</div><div style="font-size:11px;color:var(--text3)">#${p.tender}</div></td>
    <td>${p.type}</td><td>${c?c.name:'—'}</td>
    <td class="fv">${fmt(agAmt(p))}</td><td class="fv">${fmt(totRel(p))}</td>
    <td>${pct(verPct(p))}</td><td>${sBadge(pStat(p),p)}</td>
    <td><button class="btn btn-sm" onclick="openDetail('${p.id}')">View</button></td>
  </tr>`;}).join('')}</tbody></table></div>`;
}

// ═══════════════════════════════════════════════════════
// PROJECT DETAIL — owner view
// ═══════════════════════════════════════════════════════
// ─── OWNER TAB NAVIGATION ─────────────────────────────
function ownerTab(i){
  atab=i; dpid=null;
  document.querySelectorAll('.nav-link').forEach((e,j)=>e.classList.toggle('active',j===i));
  document.querySelectorAll('[id^="obn-"]').forEach((e,j)=>e.classList.toggle('active',j===i));
  // Only switch main tabs (not detail view which is sec-detail)
  const mainSecs = ['sec-dash','sec-proj','sec-cont','sec-funds','sec-interest'];
  document.querySelectorAll('.osec').forEach(e=>e.classList.add('hidden'));
  const targetId = mainSecs[i];
  if(targetId) document.getElementById(targetId)?.classList.remove('hidden');
  if(i===0) renderDash();
  if(i===1) renderProjects();
  if(i===2) renderConts();
  if(i===3) renderFunds();
  if(i===4) renderInterest();
}
// ─── GLOBAL SEARCH ────────────────────────────────────
function toggleGlobalSearch(){
  const wrap = document.getElementById('gsearch-wrap');
  if(!wrap) return;
  const isVisible = wrap.style.display !== 'none';
  wrap.style.display = isVisible ? 'none' : 'flex';
  if(!isVisible) document.getElementById('gsearch-input')?.focus();
}

function globalSearch(query){
  const resultsEl = document.getElementById('gsearch-results');
  if(!resultsEl) return;
  const q = query.trim().toLowerCase();
  if(!q){ resultsEl.style.display='none'; return; }

  const results = [];

  // Search projects
  D.projects.forEach(p=>{
    const c = GC(p.contractorId);
    if(p.name.toLowerCase().includes(q) ||
       (p.tender||'').toLowerCase().includes(q) ||
       (p.location||'').toLowerCase().includes(q) ||
       (c&&c.name.toLowerCase().includes(q))){
      results.push({ type:'project', id:p.id, name:p.name,
        sub:`${p.type||''}${p.location?' · '+p.location:''} · #${p.tender||''}`,
        badge: sBadge(pStat(p),p) });
    }
  });

  // Search contractors
  D.contractors.forEach(c=>{
    if(c.name.toLowerCase().includes(q) ||
       (c.phone||'').includes(q)){
      const pp = D.projects.filter(p=>p.contractorId===c.id);
      results.push({ type:'contractor', id:c.id, name:c.name,
        sub:`📞 ${c.phone||'—'} · ${pp.length} project${pp.length!==1?'s':''}` });
    }
  });

  if(!results.length){
    resultsEl.innerHTML=`<div style="padding:14px 16px;font-size:13px;color:#666">No results for "${query}"</div>`;
    resultsEl.style.display='block';
    return;
  }

  resultsEl.innerHTML = results.map(r=>`
    <div onclick="searchGoTo('${r.type}','${r.id}')"
      style="padding:10px 16px;cursor:pointer;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:10px"
      onmouseover="this.style.background='#f7f8fb'" onmouseout="this.style.background='#fff'">
      <span style="font-size:18px">${r.type==='project'?'🏗️':'👷'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:#1a2744;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.name}</div>
        <div style="font-size:11px;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.sub}</div>
      </div>
    </div>`).join('');
  resultsEl.style.display='block';
}

function searchGoTo(type, id){
  closeGlobalSearch();
  if(type==='project'){
    openDetail(id);
  } else {
    // Go to contractors tab and highlight
    ownerTab(2);
    setTimeout(()=>{
      const el = document.querySelector(`[data-cid="${id}"]`);
      if(el) el.scrollIntoView({behavior:'smooth',block:'center'});
    }, 300);
  }
}

function closeGlobalSearch(){
  const resultsEl = document.getElementById('gsearch-results');
  if(resultsEl) resultsEl.style.display='none';
  const input = document.getElementById('gsearch-input');
  if(input) input.value='';
}
