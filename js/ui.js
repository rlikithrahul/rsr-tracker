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
    migrateAllProjects(); // silent schema migration
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
        updateOfflineQueueBadge();
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
  updateOfflineQueueBadge();
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
  const searchQ = '';
  let allProjects = D.projects.filter(p=>!isArchived(p));
  // Apply contractor filter
  if(dashContractorFilter) allProjects=allProjects.filter(p=>p.contractorId===dashContractorFilter);
  // Apply status filter
  if(dashFilter==='attn') allProjects=allProjects.filter(p=>getAutoWarnings(p).some(w=>w.type==='red'||w.type==='amber'));
  else if(dashFilter==='active') allProjects=allProjects.filter(p=>projStatus(p)==='active');
  else if(dashFilter==='onhold') allProjects=allProjects.filter(p=>projStatus(p)==='onhold');
  else if(dashFilter==='completed') allProjects=allProjects.filter(p=>projStatus(p)==='completed');
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

  // Render filter bar
  renderDashFilterBar();
}

function renderDashFilterBar(){
  const bar = document.getElementById('dash-filter-bar');
  if(!bar) return;
  const all=D.projects.filter(p=>!isArchived(p));
  const counts={
    all:all.length,
    attn:all.filter(p=>getAutoWarnings(p).some(w=>w.type==='red'||w.type==='amber')).length,
    active:all.filter(p=>projStatus(p)==='active').length,
    onhold:all.filter(p=>projStatus(p)==='onhold').length,
    completed:all.filter(p=>projStatus(p)==='completed').length,
    archived:D.projects.filter(p=>isArchived(p)).length
  };
  const contractors=[...new Set(all.map(p=>p.contractorId).filter(Boolean))];
  const filters=[
    {k:'all',label:'All',count:counts.all},
    {k:'attn',label:'⚠️ Needs Attention',count:counts.attn},
    {k:'active',label:'Active',count:counts.active},
    {k:'onhold',label:'On Hold',count:counts.onhold},
    {k:'completed',label:'Completed',count:counts.completed}
  ];
  bar.innerHTML=`
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:0 0 12px">
      ${filters.map(f=>`<button onclick="setDashFilter('${f.k}')"
        style="padding:5px 12px;border-radius:20px;border:1.5px solid ${dashFilter===f.k?'var(--navy)':'var(--border)'};
        background:${dashFilter===f.k?'var(--navy)':'#fff'};color:${dashFilter===f.k?'#fff':'var(--text2)'};
        font-size:12px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif">
        ${f.label}${f.count>0?` <span style="opacity:.7">(${f.count})</span>`:''}
      </button>`).join('')}
      <select onchange="setDashContractorFilter(this.value)"
        style="padding:5px 10px;border-radius:20px;border:1.5px solid var(--border);font-size:12px;font-family:'Inter',sans-serif;background:#fff;color:var(--text2);cursor:pointer">
        <option value="">All Contractors</option>
        ${contractors.map(cid=>{const c=GC(cid);return c?`<option value="${cid}" ${dashContractorFilter===cid?'selected':''}>${c.name}</option>`:''}).join('')}
      </select>
      ${counts.archived>0?`<button onclick="renderArchive()"
        style="padding:5px 12px;border-radius:20px;border:1.5px solid var(--border);background:#fff;color:var(--text3);font-size:12px;cursor:pointer;font-family:'Inter',sans-serif;margin-left:auto">
        📦 Archive (${counts.archived})
      </button>`:''}
    </div>`;
}

function setDashFilter(f){ dashFilter=f; renderDash(); }
function setDashContractorFilter(cid){ dashContractorFilter=cid; renderDash(); }

function renderArchive(){
  const archived=D.projects.filter(p=>isArchived(p));
  if(!archived.length){ toast('No archived projects','ok'); return; }
  
  // Use or create a dedicated archive modal
  let modal = document.getElementById('modal-archive');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'mov';
    modal.id = 'modal-archive';
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `<div class="mbox" style="max-width:560px">
    <div class="mhdr">
      <h2>📦 Archived Projects (${archived.length})</h2>
      <button class="mx" onclick="CM('modal-archive')">✕</button>
    </div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:14px">
      Archived projects are hidden from the dashboard. All data is preserved. Restore anytime or permanently delete.
    </div>
    ${archived.map(p=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--surface2);border-radius:var(--rs);margin-bottom:8px;gap:8px;flex-wrap:wrap">
        <div>
          <div style="font-weight:700;font-size:14px">${p.name}</div>
          <div style="font-size:12px;color:var(--text3)">
            #${p.tender||'—'} · Archived ${p._archivedAt?new Date(p._archivedAt).toLocaleDateString('en-IN'):''}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-sm btn-navy" onclick="restoreProject('${p.id}')">↩️ Restore</button>
          <button class="btn btn-sm" style="color:var(--red);border:1px solid var(--red)" onclick="permanentDeleteProject('${p.id}')">🗑️ Delete Forever</button>
        </div>
      </div>`).join('')}
  </div>`;
  
  modal.classList.add('open');
}

async function restoreProject(pid){
  const p=GP(pid); if(!p) return;
  delete p._archived;
  delete p._archivedAt;
  try{
    await saveProjectDB(p);
    CM('modal-archive');
    renderDash();
    toast('✓ Project restored to dashboard','ok');
  }catch(e){ toast('Restore failed','error'); }
}

function dashCardHTML(p){
  const c=GC(p.contractorId);
  const rel=totRel(p),max=maxF(p),el=eligR(p),vp=verPct(p);
  const rp=max>0?Math.min(rel/max*100,100):0; const s=pStat(p); const hw=hdroom(p);
  const pend=(p.contractorUpdates||[]).filter(u=>!u.reviewed&&!isArchived(u)).length;
  const lv=(p.verifications||[]).filter(v=>!isArchived(v)).slice(-1)[0];
  const alerts=getProjectAlerts(p);
  const autoW=getAutoWarnings(p);
  const allWarnings=[...alerts,...autoW.filter(w=>w.code!=='pending_updates')];
  const alertsHtml=allWarnings.slice(0,2).map(a=>`<div class="alert-banner ab-${a.type}" onclick="openDetail('${p.id}')">${a.msg}</div>`).join('');
  const capColor=rp>=85?'var(--red)':rp>=70?'var(--amber)':'var(--green)';
  const capFill=rp>=85?'pf-red':rp>=70?'pf-amber':'pf-green';
  return `<div class="card" style="${allWarnings.some(a=>a.type==='red')?'border-color:var(--red);border-left:4px solid var(--red)':''}">
    <div class="card-hdr">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span class="card-title">${p.name}</span>${sBadge(s,p)}
          ${pend>0?`<span style="background:var(--red);color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:10px">${pend} pending</span>`:''}
        </div>
        <div class="card-sub">${p.type} · ${p.location||'—'} · ${c?c.name:'—'} · #${p.tender}</div>
        <div style="margin-top:3px">${lastActivityHTML(p)}</div>
      </div>
      <div class="card-acts">
        <button class="btn btn-sm" onclick="openDetail('${p.id}')">View</button>
        <div class="amenu-wrap">
          <button class="amenu-btn" onclick="event.stopPropagation();toggleMenu('pm-${p.id}')">⋮</button>
          <div class="amenu" id="pm-${p.id}">
            <button class="amenu-item" onclick="openDetail('${p.id}')">📋 View Detail</button>
            <button class="amenu-item" onclick="openOwnerNotes('${p.id}')">📝 Owner Notes${p.ownerNotes?' ●':''}</button>
            <button class="amenu-item" onclick="openSettle('${p.id}')">🏦 Record Settlement</button>
            <button class="amenu-item danger" onclick="deleteProject('${p.id}')">📦 Archive Project</button>
          </div>
        </div>
      </div>
    </div>
    ${alertsHtml}
    <div style="margin-top:8px">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <span style="font-size:11px;color:var(--text3)">Funding: ${fmt(rel)} net / ${fmt(max)} cap</span>
        <span style="font-size:11px;font-weight:700;color:${capColor}">${Math.round(rp)}%</span>
      </div>
      <div class="prog-track" style="height:6px;margin-bottom:8px"><div class="prog-fill ${capFill}" style="width:${rp}%"></div></div>
    </div>
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px">
      <div>
        <div class="prog"><div class="prog-lbl"><span style="color:var(--amber)">Contractor reported</span><span style="color:var(--amber)">${pct(reportedPct(p))}</span></div><div class="prog-track" style="background:rgba(176,96,0,.15)"><div style="height:100%;border-radius:4px;background:var(--amber);width:${Math.min(reportedPct(p),100)}%"></div></div></div>
        <div class="prog"><div class="prog-lbl"><span>RSR verified</span><span>${pct(vp)}</span></div><div class="prog-track"><div class="prog-fill pf-navy" style="width:${Math.min(vp,100)}%"></div></div></div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">${lv?'Last verified: '+lv.date:'No verification yet'}</div>
      </div>
      <div style="font-size:12px">
        <div class="fr" style="font-size:12px"><span class="fl">Agreement</span><span class="fv">${fmt(agAmt(p))}</span></div>
        <div class="fr" style="font-size:12px"><span class="fl">Headroom</span><span class="fv" style="color:${capColor}">${fmt(hw)}</span></div>
        <div class="fr" style="font-size:12px"><span class="fl">Net deployed</span><span class="fv">${fmt(rel)}</span></div>
        <!-- Interest removed from dashboard — see Interest tab for full breakdown -->
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════
// PROJECTS TABLE
// ═══════════════════════════════════════════════════════
function renderProjects(){
  const q=(document.getElementById('psearch')?.value||'').toLowerCase();
  const activeFilter = document.getElementById('proj-status-filter')?.value || 'all';
  const firmFilter = document.getElementById('proj-firm-filter')?.value || 'all';

  const list=D.projects.filter(p=>{
    const c=GC(p.contractorId);
    const matchQ = !q || p.name.toLowerCase().includes(q)||
      (p.tender||'').includes(q)||(c&&c.name.toLowerCase().includes(q));
    const status = p.status || 'active';
    const matchStatus = activeFilter==='all' || status===activeFilter;
    const matchFirm = firmFilter==='all' || (p.firm||'RSR Constructions')===firmFilter;
    return matchQ && matchStatus && matchFirm && !isArchived(p);
  });

  const el=document.getElementById('proj-tbl');
  if(!list.length){el.innerHTML='<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">No projects found.</div></div>';return;}
  el.innerHTML=`<div class="tbl-wrap"><table><thead><tr><th>Project</th><th>Firm</th><th>Type</th><th>Contractor</th><th>Status</th><th>Agreement</th><th>BOQ Value</th><th>Cap Used</th><th>JV Date</th><th></th></tr></thead><tbody>
    ${list.map(p=>{
      const c=GC(p.contractorId);
      const firmName = p.firm||'RSR Constructions';
      const firmShort = firmName==='RSR Constructions'?'RSR':firmName==='R Sadhu Rao'?'RS.Rao':firmName==='R Likith Rahul'?'RLR':firmName;
      const firmColor = firmName==='RSR Constructions'?'var(--navy)':firmName==='R Sadhu Rao'?'#7b3f00':'var(--green)';
      const status = p.status||'active';
      const statusBadge = {
        'active':'<span style="background:#d4edda;color:#155724;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">🟢 Active</span>',
        'onhold':'<span style="background:#fff3cd;color:#856404;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">⏸ On Hold</span>',
        'completed':'<span style="background:#d1ecf1;color:#0c5460;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">✅ Completed</span>',
        'settled':'<span style="background:#e8f5e9;color:#1b5e20;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">💰 Settled</span>'
      }[status]||'';
      const boqTotal = (p.boq||[]).reduce((s,x)=>s+x.amount,0);
      const rel = (p.releases||[]).reduce((s,r)=>s+r.amount,0);
      const max70 = (p.agreeAmt||boqTotal)*0.7;
      const capPct = max70>0?Math.round(rel/max70*100):0;
      const jvDate = p.jvDate || (p.documents?.jv?.uploadedAt ? new Date(p.documents.jv.uploadedAt).toLocaleDateString('en-IN') : '—');
      return `<tr style="cursor:pointer" onclick="openDetail('${p.id}')">
        <td style="font-weight:600;color:var(--navy);max-width:200px">${p.name}</td>
        <td><span style="font-size:11px;font-weight:700;color:${firmColor};white-space:nowrap">${firmShort}</span></td>
        <td>${p.type||'—'}</td>
        <td>${c?c.name:'—'}</td>
        <td>${statusBadge}</td>
        <td style="white-space:nowrap">${p.agreeDate||'<span style="color:var(--text3)">Not set</span>'}</td>
        <td style="text-align:right">${fmt(boqTotal)}</td>
        <td style="text-align:right;color:${capPct>=70?'var(--red)':'var(--navy)'}">${capPct}%</td>
        <td style="white-space:nowrap">${jvDate}</td>
        <td><button class="btn btn-sm" onclick="event.stopPropagation();openDetail('${p.id}')">View</button></td>
      </tr>`;
    }).join('')}
  </tbody></table></div>`;
}


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
  if(i===2){ renderConts(); renderContractorPerformance(); }
  if(i===3) renderFunds();
  if(i===4) renderInterest();
}
// ─── SEARCH POSITIONING ───────────────────────────────
function positionSearchResults(){
  const inputEl = document.getElementById('gsearch-input');
  const resultsEl = document.getElementById('gsearch-results');
  if(!inputEl || !resultsEl) return;
  // Get bounding rect — if input is hidden, wrap may need to be visible first
  const wrap = document.getElementById('gsearch-wrap');
  if(!wrap || wrap.style.display === 'none') return;
  const rect = inputEl.getBoundingClientRect();
  if(!rect.width) return; // element not rendered yet
  const top = rect.bottom + window.scrollY + 6;
  const left = Math.max(8, rect.left + window.scrollX);
  const width = Math.min(480, Math.max(280, rect.width + 40));
  resultsEl.style.top = top + 'px';
  resultsEl.style.left = left + 'px';
  resultsEl.style.width = width + 'px';
  resultsEl.style.transform = 'none';
}

// ─── GLOBAL SEARCH ────────────────────────────────────
function toggleGlobalSearch(){
  const wrap = document.getElementById('gsearch-wrap');
  if(!wrap) return;
  const isVisible = wrap.style.display !== 'none';
  wrap.style.display = isVisible ? 'none' : 'flex';
  if(!isVisible){
    document.getElementById('gsearch-input')?.focus();
    // Pre-position the dropdown container as soon as search is shown
    requestAnimationFrame(positionSearchResults);
  } else {
    closeGlobalSearch();
  }
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

  // Position results below search input
  positionSearchResults();

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


// Reposition search results on resize (e.g. orientation change on mobile)
window.addEventListener('resize', function(){
  const el = document.getElementById('gsearch-results');
  if(el && el.style.display !== 'none') positionSearchResults();
});
// ─── FINANCIAL YEAR REPORT ────────────────────────────
function getFY(dateStr){
  if(!dateStr) return null;
  const d = new Date(dateStr);
  const y = d.getFullYear(), m = d.getMonth();
  return m >= 3 ? `${y}-${String(y+1).slice(2)}` : `${y-1}-${String(y).slice(2)}`;
}

function showFYReport(){
  const section = document.getElementById('fy-report-section');
  if(section.style.display !== 'none'){ section.style.display='none'; return; }

  // Group completed projects by FY (JV date)
  const jvByFY = {}, settledByFY = {};

  D.projects.forEach(p=>{
    const jvDate = p.jvDate || (p.documents?.jv?.uploadedAt);
    if(jvDate){
      const fy = getFY(jvDate);
      if(fy){
        if(!jvByFY[fy]) jvByFY[fy]=[];
        jvByFY[fy].push(p);
      }
    }
    const settled = (p.releases||[]).filter(r=>r.source==='settlement');
    settled.forEach(s=>{
      const fy = getFY(s.date);
      if(fy){
        if(!settledByFY[fy]) settledByFY[fy]=[];
        settledByFY[fy].push({...s, projectName:p.name});
      }
    });
  });

  const allFYs = [...new Set([...Object.keys(jvByFY),...Object.keys(settledByFY)])].sort().reverse();

  if(!allFYs.length){
    section.innerHTML=`<div class="card"><div style="color:var(--text3);font-size:13px;text-align:center;padding:16px">No JV or settlement data yet.</div></div>`;
    section.style.display='block';
    return;
  }

  section.innerHTML = allFYs.map(fy=>`
    <div class="card" style="margin-bottom:12px">
      <div class="st">📅 Financial Year ${fy}</div>
      ${jvByFY[fy]?.length ? `
        <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:8px">JV Received (${jvByFY[fy].length} projects)</div>
        ${jvByFY[fy].map(p=>`
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;flex-wrap:wrap;gap:4px">
            <span>${p.name}</span>
            <span style="color:var(--text3)">${p.jvDate||'—'}</span>
          </div>`).join('')}` : ''}
      ${settledByFY[fy]?.length ? `
        <div style="font-size:13px;font-weight:700;color:var(--navy);margin:12px 0 8px">💰 Cheques Received (${settledByFY[fy].length})</div>
        ${settledByFY[fy].map(s=>`
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;flex-wrap:wrap;gap:4px">
            <span>${s.projectName}</span>
            <div style="text-align:right"><div style="font-weight:700;color:var(--navy)">${fmt(s.amount)}</div><div style="font-size:11px;color:var(--text3)">${s.date}</div></div>
          </div>`).join('')}
        <div style="text-align:right;font-weight:700;color:var(--navy);padding-top:8px">Total: ${fmt(settledByFY[fy].reduce((s,x)=>s+x.amount,0))}</div>` : ''}
    </div>`).join('');
  section.style.display='block';
}

// ─── OFFLINE QUEUE BADGE ─────────────────────────────
async function updateOfflineQueueBadge(){
  try{
    const queue = await getOfflineQueue();
    const badge = document.getElementById('offline-queue-badge');
    if(!badge) return;
    if(queue && queue.length>0){
      badge.textContent = queue.length;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }catch(e){}
}

// ─── BACKUP EXPORT ───────────────────────────────────
function exportBackup(){
  const backup = {
    exportedAt: new Date().toISOString(),
    version: APP_VERSION,
    projects: D.projects,
    contractors: D.contractors
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `RSR_Backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('✓ Backup downloaded','ok');
}

// ─── CONTRACTOR PERFORMANCE ──────────────────────────
function renderContractorPerformance(){
  const el=document.getElementById('contractor-perf-section');
  if(!el) return;
  const html=D.contractors.map(c=>{
    const cProjs=D.projects.filter(p=>p.contractorId===c.id&&!isArchived(p));
    const totalRel=cProjs.reduce((s,p)=>s+totRel(p),0);
    const totalPay=cProjs.reduce((s,p)=>s+totPayments(p),0);
    const pending=cProjs.reduce((s,p)=>s+(p.contractorUpdates||[]).filter(u=>!u.reviewed&&!isArchived(u)).length,0);
    const lastDays=cProjs.map(p=>lastActivityDays(p)).filter(d=>d!==null);
    const minDays=lastDays.length?Math.min(...lastDays):null;
    const actColor=minDays===null?'var(--text3)':minDays>14?'var(--red)':minDays>7?'var(--amber)':'var(--green)';
    return `<div class="card" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
        <div>
          <div style="font-weight:700;font-size:14px">${c.name}</div>
          <div style="font-size:12px;color:var(--text3)">${c.type||'—'} · ${cProjs.length} project${cProjs.length!==1?'s':''}</div>
        </div>
        ${pending>0?`<span style="background:var(--red);color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:10px">${pending} pending review</span>`:''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px">
        <div style="text-align:center;padding:8px;background:var(--surface2);border-radius:var(--rs)">
          <div style="font-size:11px;color:var(--text3)">Total Released</div>
          <div style="font-weight:700;font-size:13px;color:var(--navy)">${fmt(totalPay)}</div>
        </div>
        <div style="text-align:center;padding:8px;background:var(--surface2);border-radius:var(--rs)">
          <div style="font-size:11px;color:var(--text3)">Net Deployed</div>
          <div style="font-weight:700;font-size:13px;color:var(--navy)">${fmt(totalRel)}</div>
        </div>
        <div style="text-align:center;padding:8px;background:var(--surface2);border-radius:var(--rs)">
          <div style="font-size:11px;color:var(--text3)">Last Activity</div>
          <div style="font-weight:700;font-size:13px;color:${actColor}">${minDays===null?'None':minDays===0?'Today':minDays+'d ago'}</div>
        </div>
      </div>
    </div>`;
  }).join('');
  el.innerHTML=html||'<div style="color:var(--text3);font-size:13px">No contractors yet.</div>';
}
