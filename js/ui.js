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
  const allProjects = D.projects.filter(p=>!isArchived(p));

  // Stats
  const active = allProjects.filter(p=>(p.status||'active')==='active');
  const cap = allProjects.reduce((s,p)=>s+totRel(p),0);
  const settled = allProjects.reduce((s,p)=>s+(p.settlements||[]).filter(x=>!isArchived(x)).reduce((a,x)=>a+x.amount,0),0);
  const at = allProjects.filter(p=>getProjectAlerts(p).some(a=>a.type='red'||a.type==='amber')).length;
  const pendingUpd = allProjects.reduce((s,p)=>s+(p.contractorUpdates||[]).filter(u=>!u.reviewed&&!isArchived(u)).length,0);
  const totalAgreement = active.reduce((s,p)=>s+agAmt(p),0);
  const allAlerts = getAllAlerts();

  // Last Tally import date
  let lastImport = null;
  allProjects.forEach(p=>{
    (p.releases||[]).filter(r=>r.source==='tally'||r.source==='tally-manual'||r.source==='tally-fuzzy').forEach(r=>{
      if(!lastImport||r.date>lastImport) lastImport=r.date;
    });
  });
  const importAgo = lastImport ? (() => {
    const days = Math.round((new Date()-new Date(lastImport))/86400000);
    return days===0?'Today':days===1?'Yesterday':`${days} days ago`;
  })() : 'Never';
  const importColor = !lastImport?'var(--red)':Math.round((new Date()-new Date(lastImport))/86400000)>3?'var(--amber)':'var(--green)';

  document.getElementById('dash-stats').innerHTML=`
    <div class="stat"><div class="stat-lbl">Active Projects</div><div class="stat-val">${active.length}</div><div class="stat-sub">${fmt(totalAgreement)} value</div></div>
    <div class="stat"><div class="stat-lbl">Capital Deployed</div><div class="stat-val" style="font-size:17px">${fmt(cap)}</div><div class="stat-sub">${fmt(settled)} settled</div></div>
    <div class="stat" style="cursor:pointer" onclick="dashGoTo('attn')"><div class="stat-lbl">Pending Reviews</div><div class="stat-val" style="color:${pendingUpd>0?'var(--red)':'var(--green)'}">${pendingUpd}</div><div class="stat-sub">${pendingUpd>0?'tap to view':'all clear'}</div></div>
    <div class="stat" style="cursor:pointer" onclick="showAllAlerts()"><div class="stat-lbl">Alerts</div><div class="stat-val" style="color:${allAlerts.length>0?'var(--red)':'var(--green)'}">${allAlerts.length}</div><div class="stat-sub">${allAlerts.length>0?'tap to view':'all clear'}</div></div>`;

  // Alert strip
  document.getElementById('dash-banner').innerHTML = renderDashAlertStrip();

  // Main dashboard body — left column
  document.getElementById('dash-cards').innerHTML=`
    <!-- Last Tally Import -->
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface2);border-radius:var(--rs);margin-bottom:14px;font-size:12px">
      <span style="color:var(--text3)">📤 Last Tally import:</span>
      <span style="font-weight:700;color:${importColor}">${importAgo}</span>
      ${lastImport?`<span style="color:var(--text3)">(${lastImport})</span>`:''}
      <button onclick="ownerTab(3)" style="margin-left:auto;background:none;border:1px solid var(--border);border-radius:var(--rs);padding:3px 10px;font-size:11px;cursor:pointer;font-family:'Inter',sans-serif;color:var(--navy)">Upload →</button>
    </div>

    <!-- Quick Access -->
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Quick Access</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px">
      <button onclick="dashGoTo('attn')" style="padding:12px 8px;background:#fff;border:1.5px solid var(--border);border-radius:var(--rs);cursor:pointer;font-family:'Inter',sans-serif;text-align:center">
        <div style="font-size:18px;margin-bottom:4px">⚠️</div>
        <div style="font-size:11px;font-weight:700;color:var(--red)">Needs Attention</div>
        <div style="font-size:13px;font-weight:800;color:var(--red)">${at}</div>
      </button>
      <button onclick="dashGoTo('active')" style="padding:12px 8px;background:#fff;border:1.5px solid var(--border);border-radius:var(--rs);cursor:pointer;font-family:'Inter',sans-serif;text-align:center">
        <div style="font-size:18px;margin-bottom:4px">🏗️</div>
        <div style="font-size:11px;font-weight:700;color:var(--navy)">Active</div>
        <div style="font-size:13px;font-weight:800;color:var(--navy)">${active.length}</div>
      </button>
      <button onclick="dashGoTo('onhold')" style="padding:12px 8px;background:#fff;border:1.5px solid var(--border);border-radius:var(--rs);cursor:pointer;font-family:'Inter',sans-serif;text-align:center">
        <div style="font-size:18px;margin-bottom:4px">⏸</div>
        <div style="font-size:11px;font-weight:700;color:var(--text2)">On Hold</div>
        <div style="font-size:13px;font-weight:800;color:var(--text2)">${allProjects.filter(p=>(p.status||'active')==='onhold').length}</div>
      </button>
    </div>

    <div id="dash-jv-section"></div>`;

  // Right sidebar column — capital + EMI
  const sidebarCol = document.getElementById('dash-sidebar-col');
  if(sidebarCol){
    sidebarCol.innerHTML=`<div id="dash-capital-section"></div><div id="dash-emi-section"></div><div id="dash-gst-section"></div><div id="dash-matcredit-section"></div><div id="dash-pipeline-section"></div>`;
  } else {
    document.getElementById('dash-cards').insertAdjacentHTML('beforeend','<div id="dash-capital-section"></div><div id="dash-emi-section"></div><div id="dash-gst-section"></div><div id="dash-matcredit-section"></div>');
  }

  renderCapitalSection(allProjects);
  renderExpectedJVSection(allProjects);
  // EMI upcoming (if data loaded)
  if(D.emiData){
    const emiEl = document.getElementById('dash-emi-section');
    if(emiEl) emiEl.innerHTML = getEMIDashboardAlerts();
  }
  // GST alerts (if data loaded)
  if(D.gstData){
    const gstEl = document.getElementById('dash-gst-section');
    if(gstEl) gstEl.innerHTML = getGSTDashboardAlerts();
  }
  // Material credit alerts
  const matEl = document.getElementById('dash-matcredit-section');
  if(matEl && typeof getMatCreditDashboardAlerts === 'function'){
    matEl.innerHTML = getMatCreditDashboardAlerts();
  }
  // Pipeline urgent alert
  const pipeEl = document.getElementById('dash-pipeline-section');
  if(pipeEl && typeof getPipelineDashboardAlert === 'function'){
    pipeEl.innerHTML = getPipelineDashboardAlert();
  }
}

function renderCapitalSection(allProjects){
  const el = document.getElementById('dash-capital-section');
  if(!el) return;
  const totalCap = allProjects.reduce((s,p)=>s+maxF(p),0);
  const totalDep = allProjects.reduce((s,p)=>s+totRel(p),0);
  const headroom = Math.max(0,totalCap-totalDep);
  const pct = totalCap>0?Math.round(totalDep/totalCap*100):0;
  const barColor = pct>=85?'var(--red)':pct>=70?'var(--amber)':'var(--green)';
  el.innerHTML='<div class="card" style="margin-bottom:14px;padding:14px">'
    +'<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">💰 Capital Deployment Summary</div>'
    +'<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;flex-wrap:wrap;gap:4px">'
    +'<span>Deployed: <strong style="color:var(--navy)">'+fmt(totalDep)+'</strong></span>'
    +'<span>Headroom: <strong style="color:'+barColor+'">'+fmt(headroom)+'</strong></span>'
    +'</div>'
    +'<div class="prog-track" style="height:8px;margin-bottom:6px">'
    +'<div style="height:100%;border-radius:4px;background:'+barColor+';width:'+pct+'%"></div>'
    +'</div>'
    +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3)">'
    +'<span>'+pct+'% of total cap used</span>'
    +'<span>Total cap: '+fmt(totalCap)+'</span>'
    +'</div></div>';
}

function renderExpectedJVSection(allProjects){
  const el = document.getElementById('dash-jv-section');
  if(!el) return;

  const today = new Date();
  const thisY = today.getFullYear(), thisM = today.getMonth();
  const nextY = thisM===11?thisY+1:thisY, nextM = thisM===11?0:thisM+1;
  const thisKey = thisY+'-'+String(thisM+1).padStart(2,'0');
  const nextKey = nextY+'-'+String(nextM+1).padStart(2,'0');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const thisLabel = months[thisM]+' '+thisY;
  const nextLabel = months[nextM]+' '+nextY;

  const thisProjects = allProjects.filter(p=>p.expectedJVMonth&&!p.jvDate&&(p.expectedJVMonth===thisKey||p.expectedJVMonth<thisKey));
  const nextProjects = allProjects.filter(p=>p.expectedJVMonth&&!p.jvDate&&p.expectedJVMonth===nextKey);

  const buildTable = (projects, monthKey) => {
    if(!projects.length) return '<div style="font-size:12px;color:var(--text3);padding:8px;text-align:center;font-style:italic">None tagged</div>';
    const totalAmt = projects.reduce((s,p)=>s+agAmt(p),0);
    let rows = '';
    projects.forEach(p=>{
      const c = GC(p.contractorId);
      const carried = p.expectedJVMonth < monthKey;
      rows += '<tr style="border-bottom:1px solid var(--surface2);cursor:pointer" onclick="openProjectFromAlert(\'' + p.id + '\')">' 
        +'<td style="padding:6px;max-width:150px">'
        +'<div style="font-weight:600;color:var(--navy);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+p.name+'</div>'
        +(carried?'<div style="font-size:10px;color:var(--amber);font-weight:600">⚠️ Carried from prev month</div>':'')
        +'</td>'
        +'<td style="padding:6px;font-size:11px;color:var(--text2)">'+(c?c.name:'—')+'</td>'
        +'<td style="padding:6px;text-align:right;font-weight:600;color:var(--navy);font-size:11px">'+fmt(agAmt(p))+'</td>'
        +'</tr>';
    });
    return '<table style="width:100%;border-collapse:collapse">'
      +'<thead><tr style="border-bottom:1px solid var(--border)">'
      +'<th style="text-align:left;padding:4px 6px;font-size:11px;color:var(--text3)">Project</th>'
      +'<th style="text-align:left;padding:4px 6px;font-size:11px;color:var(--text3)">Contractor</th>'
      +'<th style="text-align:right;padding:4px 6px;font-size:11px;color:var(--text3)">Agreement</th>'
      +'</tr></thead><tbody>'+rows+'</tbody>'
      +'<tfoot><tr style="border-top:2px solid var(--border);background:var(--surface2)">'
      +'<td colspan="2" style="padding:8px 6px;font-weight:700;font-size:12px">Total ('+projects.length+' projects)</td>'
      +'<td style="padding:8px 6px;text-align:right;font-weight:800;color:var(--navy);font-size:13px">'+fmt(totalAmt)+'</td>'
      +'</tr></tfoot></table>';
  };

  if(!thisProjects.length && !nextProjects.length){
    el.innerHTML='<div class="card" style="padding:14px">'
      +'<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">📅 Expected JVs</div>'
      +'<div style="font-size:13px;color:var(--text3);text-align:center;padding:12px">No projects tagged. Use ⋮ menu on any project card to add.</div>'
      +'</div>';
    return;
  }

  el.innerHTML='<div class="card" style="padding:14px">'
    +'<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">📅 Expected JVs</div>'
    +'<div class="jv-grid">'
    +'<div>'
    +'<div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid var(--gold)">'+thisLabel+'</div>'
    +buildTable(thisProjects,thisKey)
    +'</div>'
    +'<div>'
    +'<div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid var(--border)">'+nextLabel+'</div>'
    +buildTable(nextProjects,nextKey)
    +'</div></div></div>';
}

function dashGoTo(filter){
  dashFilter = filter;
  ownerTab(1);
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
    incomplete:all.filter(p=>isIncomplete(p)).length,
    archived:D.projects.filter(p=>isArchived(p)).length
  };
  const contractors=[...new Set(all.map(p=>p.contractorId).filter(Boolean))];
  const filters=[
    {k:'all',label:'All',count:counts.all},
    {k:'attn',label:'⚠️ Needs Attention',count:counts.attn},
    {k:'active',label:'Active',count:counts.active},
    {k:'onhold',label:'On Hold',count:counts.onhold},
    {k:'completed',label:'Completed',count:counts.completed},
    {k:'incomplete',label:'🔴 Incomplete',count:counts.incomplete},
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
  const rel=totRel(p),max=maxF(p);
  const rp=max>0?Math.min(rel/max*100,100):0;
  const s=pStat(p);
  const pend=(p.contractorUpdates||[]).filter(u=>!u.reviewed&&!isArchived(u)).length;
  const allW=[...getProjectAlerts(p),...getAutoWarnings(p).filter(w=>w.code!=='pending_updates')];
  const topAlert=allW[0];
  const capColor=rp>=85?'var(--red)':rp>=70?'var(--amber)':'var(--green)';
  const capFill=rp>=85?'pf-red':rp>=70?'pf-amber':'pf-green';
  const firmShort=(p.firm||'RSR Constructions')==='RSR Constructions'?'RSR':(p.firm||'').split(' ').map(w=>w[0]).join('');
  const status=p.status||'active';
  return `<div class="card" style="padding:12px 14px;${allW.some(a=>a.type==='red')?'border-left:3px solid var(--red)':''}">
    <div style="display:flex;align-items:flex-start;gap:8px">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px">
          ${sBadge(s,p)}
          <span style="font-size:10px;background:var(--surface2);color:var(--text3);padding:1px 5px;border-radius:3px">${firmShort}</span>
          ${pend>0?`<span style="background:var(--red);color:#fff;font-size:10px;font-weight:800;padding:1px 6px;border-radius:8px">${pend} pending</span>`:''}
        </div>
        <div style="font-weight:700;font-size:13px;color:var(--navy);line-height:1.3;margin-bottom:2px">${p.name}</div>
        <div style="font-size:11px;color:var(--text3)">${c?c.name:'—'} · #${p.tender||'—'}</div>
        ${topAlert?`<div style="font-size:11px;margin-top:4px;color:${topAlert.type==='red'?'var(--red)':'#92400e'}">${topAlert.msg}</div>`:''}
        <div style="margin-top:6px">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-bottom:2px">
            <span>Cap: ${fmt(rel)} / ${fmt(max)}</span>
            <span style="font-weight:700;color:${capColor}">${Math.round(rp)}%</span>
          </div>
          <div class="prog-track" style="height:4px"><div class="prog-fill ${capFill}" style="width:${rp}%"></div></div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;align-items:flex-end">
        <button class="btn btn-sm" onclick="openDetail('${p.id}')" style="padding:5px 12px">View</button>
        <div class="amenu-wrap">
          <button class="amenu-btn" onclick="event.stopPropagation();toggleMenu('pm-${p.id}')">⋮</button>
          <div class="amenu" id="pm-${p.id}">
            <button class="amenu-item" onclick="openDetail('${p.id}')">📋 View Detail</button>
            <button class="amenu-item" onclick="openOwnerNotes('${p.id}')">📝 Owner Notes${p.ownerNotes?' ●':''}</button>
            <button class="amenu-item" onclick="openSettle('${p.id}')">🏦 Record Settlement</button>
            <button class="amenu-item" onclick="openExpectedJVMenu('${p.id}')">📅 Expected JV${p.expectedJVMonth?' ✓':''}</button>
            ${status==='active'?`<button class="amenu-item" onclick="changeProjectStatus('${p.id}','onhold')">⏸ Mark On Hold</button>`:''}
            ${status==='onhold'?`<button class="amenu-item" onclick="changeProjectStatus('${p.id}','active')" style="color:var(--green)">▶ Mark Active</button>`:''}
            ${status!=='completed'?`<button class="amenu-item" onclick="changeProjectStatus('${p.id}','completed')">✓ Mark Completed</button>`:''}
            <button class="amenu-item danger" onclick="deleteProject('${p.id}')">📦 Archive Project</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════
// PROJECTS VIEW STATE
// ═══════════════════════════════════════════════════════
let projViewMode = 'grid'; // 'grid' | 'table'
let projQuickFilter = 'all'; // contractor id, firm name, or 'all'
let projQuickFilterType = 'none'; // 'contractor' | 'firm' | 'none'

function setProjectView(mode){
  projViewMode = mode;
  document.getElementById('vt-grid')?.classList.toggle('active', mode==='grid');
  document.getElementById('vt-table')?.classList.toggle('active', mode==='table');
  renderProjects();
}

function toggleAdvFilters(){
  const panel = document.getElementById('adv-filters-panel');
  if(!panel) return;
  const isHidden = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = isHidden ? 'block' : 'none';
  document.getElementById('adv-filter-btn').style.borderColor = isHidden ? 'var(--navy)' : 'var(--border)';
  document.getElementById('adv-filter-btn').style.color = isHidden ? 'var(--navy)' : 'var(--text2)';
}

function clearAllFilters(){
  document.getElementById('proj-status-filter').value = 'all';
  document.getElementById('proj-firm-filter').value = 'all';
  document.getElementById('proj-type-filter').value = 'all';
  document.getElementById('proj-sort-filter').value = 'agree-asc';
  projQuickFilter = 'all'; projQuickFilterType = 'none';
  renderProjects();
}

function setQuickFilter(val, type){
  if(projQuickFilter === val){ projQuickFilter='all'; projQuickFilterType='none'; }
  else { projQuickFilter=val; projQuickFilterType=type; }
  renderProjects();
}

function buildQuickPills(list){
  const pillsEl = document.getElementById('proj-quick-pills');
  if(!pillsEl) return;

  // Contractor pills
  const contractorIds = [...new Set(list.map(p=>p.contractorId).filter(Boolean))];
  const firmNames = [...new Set(list.map(p=>p.firm||'RSR Constructions'))];

  let html = '';

  // Status pills
  const statuses = [
    {k:'active',label:'🟢 Active'},
    {k:'onhold',label:'⏸ On Hold'},
    {k:'completed',label:'✅ Completed'},
    {k:'incomplete',label:'🔴 Incomplete'},
  ];
  statuses.forEach(s=>{
    const count = D.projects.filter(p=>!isArchived(p)&&(s.k==='incomplete'?isIncomplete(p):(p.status||'active')===s.k)).length;
    if(count>0) html += `<button class="qfilter-pill${projQuickFilter===s.k?' active':''}" onclick="setQuickFilter('${s.k}','status')">${s.label} <span style="opacity:.7">${count}</span></button>`;
  });

  // Firm pills
  firmNames.forEach(f=>{
    const short = f==='RSR Constructions'?'RSR':f==='R Sadhu Rao'?'RS Rao':'RLR';
    html += `<button class="qfilter-pill${projQuickFilter===f?' active':''}" onclick="setQuickFilter('${f}','firm')">🏢 ${short}</button>`;
  });

  // Contractor pills — ALL contractors with active projects
  contractorIds.forEach(cid=>{
    const c = GC(cid); if(!c) return;
    const name = c.name.split(' ').slice(0,2).join(' ');
    html += `<button class="qfilter-pill${projQuickFilter===cid?' active':''}" onclick="setQuickFilter('${cid}','contractor')">👷 ${name}</button>`;
  });

  pillsEl.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
// PROJECTS TABLE
// ═══════════════════════════════════════════════════════
function renderProjects(){
  const q=(document.getElementById('psearch')?.value||'').toLowerCase();
  const statusFilter = document.getElementById('proj-status-filter')?.value || 'all';
  const firmFilter = document.getElementById('proj-firm-filter')?.value || 'all';
  const typeFilter = document.getElementById('proj-type-filter')?.value || 'all';
  const sortBy = document.getElementById('proj-sort-filter')?.value || 'agree-asc';

  let list=D.projects.filter(p=>{
    const c=GC(p.contractorId);
    const genCode = p.genCode||(p.docVault&&p.docVault.gencode)||'';
    const eaNum = p.eaNumber||(p.docVault&&p.docVault.ea)||'';
    const matchQ = !q || p.name.toLowerCase().includes(q)||
      (p.tender||'').toLowerCase().includes(q)||
      (c&&c.name.toLowerCase().includes(q))||
      (c&&(c.phone||'').includes(q))||
      (p.costCentre||'').toLowerCase().includes(q)||
      genCode.toLowerCase().includes(q)||
      eaNum.toLowerCase().includes(q)||
      (p.jvNumber||'').toLowerCase().includes(q)||
      (p.location||'').toLowerCase().includes(q);
    const status = p.status || 'active';
    const matchStatus = statusFilter==='all' || (statusFilter==='incomplete' ? isIncomplete(p) : status===statusFilter);
    const matchFirm = firmFilter==='all' || (p.firm||'RSR Constructions')===firmFilter;
    const matchType = typeFilter==='all' || (p.type||'')=== typeFilter;

    // Quick pill filter
    let matchPill = true;
    if(projQuickFilter !== 'all'){
      if(projQuickFilterType==='contractor') matchPill = p.contractorId===projQuickFilter;
      else if(projQuickFilterType==='firm') matchPill = (p.firm||'RSR Constructions')===projQuickFilter;
      else if(projQuickFilterType==='status') matchPill = projQuickFilter==='incomplete' ? isIncomplete(p) : (p.status||'active')===projQuickFilter;
    }

    return matchQ && matchStatus && matchFirm && matchType && matchPill && !isArchived(p);
  });

  // Sort
  list.sort((a,b)=>{
    const boqA=(a.boq||[]).reduce((s,x)=>s+x.amount,0);
    const boqB=(b.boq||[]).reduce((s,x)=>s+x.amount,0);
    const relA=totRel(a);
    const relB=totRel(b);
    const maxA=maxF(a)||1;
    const maxB=maxF(b)||1;
    const capA=relA/maxA; const capB=relB/maxB;
    if(sortBy==='agree-asc'){ if(!a.agreeDate&&!b.agreeDate) return 0; if(!a.agreeDate) return 1; if(!b.agreeDate) return -1; return a.agreeDate.localeCompare(b.agreeDate); }
    if(sortBy==='agree-desc'){ if(!a.agreeDate&&!b.agreeDate) return 0; if(!a.agreeDate) return 1; if(!b.agreeDate) return -1; return b.agreeDate.localeCompare(a.agreeDate); }
    if(sortBy==='cap-desc') return capB-capA;
    if(sortBy==='cap-asc') return capA-capB;
    if(sortBy==='name-asc') return a.name.localeCompare(b.name);
    if(sortBy==='boq-desc') return boqB-boqA;
    return 0;
  });

  // Update result count
  const countEl = document.getElementById('proj-result-count');
  if(countEl) countEl.textContent = list.length+' project'+(list.length===1?'':'s');

  // Update advanced filter active count
  const activeFilters = [statusFilter!=='all', firmFilter!=='all', typeFilter!=='all'].filter(Boolean).length;
  const countBadge = document.getElementById('adv-filter-count');
  if(countBadge) countBadge.textContent = activeFilters>0 ? `(${activeFilters})` : '';

  // Build quick pills
  buildQuickPills(list);

  const el=document.getElementById('proj-tbl');
  if(!list.length){el.innerHTML='<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">No projects found.</div></div>';return;}

  if(projViewMode==='grid'){
    renderProjectCards(list, el);
  } else {
    renderProjectTable(list, el);
  }
}

// ─── CARD GRID VIEW ──────────────────────────────────
function renderProjectCards(list, el){
  const tenderCounts = {};
  list.forEach(p=>{ if(p.tender) tenderCounts[p.tender.toLowerCase()] = (tenderCounts[p.tender.toLowerCase()]||0)+1; });
  const dupTenders = new Set(Object.keys(tenderCounts).filter(t=>tenderCounts[t]>1));

  el.innerHTML = '<div class="proj-grid">' + list.map(p=>{
    const c = GC(p.contractorId);
    const firmName = p.firm||'RSR Constructions';
    const firmShort = firmName==='RSR Constructions'?'RSR':firmName==='R Sadhu Rao'?'RS Rao':'RLR';
    const firmBg = firmName==='RSR Constructions'?'var(--navy)':firmName==='R Sadhu Rao'?'#7b3f00':'#1b5e20';
    const status = p.status||'active';
    const boqTotal = (p.boq||[]).reduce((s,x)=>s+x.amount,0);
    const deployed = totRel(p);
    const agAmt = p.agreeAmt||boqTotal;
    const max70 = maxF(p);
    const capPct = max70>0?Math.round(deployed/max70*100):0;
    const capColor = capPct>=100?'var(--red)':capPct>=70?'var(--amber)':'var(--green)';
    const cardClass = capPct>=100?'card-overdue':capPct>=70?'card-warning':isIncomplete(p)?'card-incomplete':'card-ok';
    const jvDate = p.jvDate ? fmtDate(p.jvDate) : '—';
    const statusColors = {active:'#d4edda|#155724',onhold:'#fff3cd|#856404',completed:'#d1ecf1|#0c5460',settled:'#e8f5e9|#1b5e20'};
    const [sbg,sclr] = (statusColors[status]||'#f5f5f5|#666').split('|');
    const statusLabel = {active:'🟢 Active',onhold:'⏸ Hold',completed:'✅ Done',settled:'💰 Settled'}[status]||status;
    const incBadge = isIncomplete(p) ? '<span style="font-size:9px;background:#ffc107;color:#333;padding:1px 5px;border-radius:6px;font-weight:700;margin-left:4px">INCOMPLETE</span>' : '';
    const dupBadge = p.tender&&dupTenders.has((p.tender||'').toLowerCase()) ? '<span style="font-size:9px;background:var(--red);color:#fff;padding:1px 5px;border-radius:6px;font-weight:700;margin-left:4px">DUP</span>' : '';
    const settleBadge = hasPossibleSettlement(p) ? '<span style="font-size:9px;background:#16a34a;color:#fff;padding:1px 5px;border-radius:6px;font-weight:700;margin-left:4px">💰 SETTLE?</span>' : '';

    return '<div class="proj-card '+cardClass+'" onclick="openDetail(\''+p.id+'\')">'+
      '<div class="proj-card-header">'+
        '<div class="proj-card-name">'+p.name+dupBadge+incBadge+settleBadge+'</div>'+
        '<span class="proj-card-firm" style="background:'+firmBg+';color:#fff">'+firmShort+'</span>'+
      '</div>'+
      '<div class="proj-card-meta">'+
        '<span style="background:'+sbg+';color:'+sclr+';padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">'+statusLabel+'</span>'+
        (p.type?'<span style="color:var(--text3)">·</span><span>'+p.type+'</span>':'')+ 
      '</div>'+
      '<div class="proj-card-contractor">'+
        '👷 '+(c?c.name:'No contractor')+ 
      '</div>'+
      '<div class="proj-card-amounts">'+
        '<div><div class="lbl">Agreement</div><div class="val">'+fmt(agAmt)+'</div></div>'+
        '<div><div class="lbl">Deployed</div><div class="val">'+fmt(deployed)+'</div></div>'+
      '</div>'+
      '<div>'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">'+
          '<span style="font-size:10px;color:var(--text3)">Cap used</span>'+
          '<span style="font-size:11px;font-weight:800;color:'+capColor+'">'+capPct+'%</span>'+
        '</div>'+
        '<div class="proj-cap-bar"><div class="proj-cap-fill" style="width:'+Math.min(capPct,100)+'%;background:'+capColor+'"></div></div>'+
      '</div>'+
      '<div class="proj-card-footer">'+
        '<div style="font-size:11px;color:var(--text3)">JV: <span style="font-weight:600;color:var(--text1)">'+jvDate+'</span></div>'+
        '<div style="display:flex;gap:6px" onclick="event.stopPropagation()">'+
          '<button class="btn btn-sm" style="padding:4px 10px;font-size:11px" onclick="openDetail(\''+p.id+'\')">View →</button>'+
          '<div class="amenu-wrap">'+
            '<button class="amenu-btn" onclick="event.stopPropagation();toggleMenu(\'pgm-'+p.id+'\')">⋮</button>'+
            '<div class="amenu" id="pgm-'+p.id+'">'+
              '<button class="amenu-item" onclick="openDetail(\''+p.id+'\')">📋 View Detail</button>'+
              '<button class="amenu-item" onclick="openOwnerNotes(\''+p.id+'\')">📝 Owner Notes'+(p.ownerNotes?' ●':'')+'</button>'+
              '<button class="amenu-item" onclick="openSettle(\''+p.id+'\')">🏦 Record Settlement</button>'+
              '<button class="amenu-item" onclick="openExpectedJVMenu(\''+p.id+'\')" >📅 Expected JV'+(p.expectedJVMonth?' ✓':'')+'</button>'+
              (status==='active'?'<button class="amenu-item" onclick="changeProjectStatus(\''+p.id+'\',\'onhold\')">⏸ Mark On Hold</button>':'')+
              (status==='onhold'?'<button class="amenu-item" style="color:var(--green)" onclick="changeProjectStatus(\''+p.id+'\',\'active\')">▶ Mark Active</button>':'')+
              (status!=='completed'?'<button class="amenu-item" onclick="changeProjectStatus(\''+p.id+'\',\'completed\')">✓ Mark Completed</button>':'')+
              '<button class="amenu-item danger" onclick="deleteProject(\''+p.id+'\')">📦 Archive</button>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('') + '</div>';
}

// ─── TABLE VIEW ───────────────────────────────────────
function renderProjectTable(list, el){
  const tenderCounts = {};
  list.forEach(p=>{ if(p.tender) tenderCounts[p.tender.toLowerCase()] = (tenderCounts[p.tender.toLowerCase()]||0)+1; });
  const dupTenders = new Set(Object.keys(tenderCounts).filter(t=>tenderCounts[t]>1));
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
      const incompleteBadge = isIncomplete(p) ? `<span style="background:#ffc107;color:#333;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;margin-left:4px">🔴 Incomplete (${getMissingFields(p).length})</span>` : '';
      const boqTotal = (p.boq||[]).reduce((s,x)=>s+x.amount,0);
      const rel = totRel(p);
      const max70 = maxF(p);
      const capPct = max70>0?Math.round(rel/max70*100):0;
      const jvDate = p.jvDate || (p.documents?.jv?.uploadedAt ? new Date(p.documents.jv.uploadedAt).toLocaleDateString('en-IN') : '—');
      return `<tr style="cursor:pointer" onclick="openDetail('${p.id}')">
        <td style="font-weight:600;color:var(--navy);max-width:200px">${p.name}${p.tender&&dupTenders.has((p.tender||'').toLowerCase())?' <span style="font-size:9px;background:var(--red);color:#fff;padding:1px 5px;border-radius:4px;font-weight:700">⚠️ DUP</span>':''}</td>
        <td><span style="font-size:11px;font-weight:700;color:${firmColor};white-space:nowrap">${firmShort}</span></td>
        <td>${p.type||'—'}</td>
        <td>${c?c.name:'—'}</td>
        <td>${statusBadge}${incompleteBadge}</td>
        <td style="white-space:nowrap">${p.agreeDate||'<span style="color:var(--text3)">Not set</span>'}</td>
        <td style="text-align:right">${fmt(boqTotal)}</td>
        <td style="text-align:right;color:${capPct>=70?'var(--red)':'var(--navy)'}">${capPct}%</td>
        <td style="white-space:nowrap">${jvDate}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm" onclick="event.stopPropagation();openDetail('${p.id}')">View</button>
          <div class="amenu-wrap" style="display:inline-block;margin-left:4px">
            <button class="amenu-btn" onclick="event.stopPropagation();toggleMenu('ptm-${p.id}')">⋮</button>
            <div class="amenu" id="ptm-${p.id}" style="right:0;min-width:180px">
              <button class="amenu-item" onclick="openDetail('${p.id}')">📋 View Detail</button>
              <button class="amenu-item" onclick="openEditProject('${p.id}')">✏️ Edit Project</button>
              <button class="amenu-item" onclick="openOwnerNotes('${p.id}')">📝 Owner Notes${p.ownerNotes?' ●':''}</button>
              <button class="amenu-item" onclick="openExpectedJVMenu('${p.id}')">📅 Expected JV${p.expectedJVMonth?' ✓':''}</button>
              <button class="amenu-item" onclick="openSettle('${p.id}')">🏦 Record Settlement</button>
              ${(p.status||'active')==='active'?`<button class="amenu-item" onclick="changeProjectStatus('${p.id}','onhold')">⏸ Mark On Hold</button>`:''}
              ${(p.status||'active')==='onhold'?`<button class="amenu-item" style="color:var(--green)" onclick="changeProjectStatus('${p.id}','active')">▶ Mark Active</button>`:''}
              <button class="amenu-item danger" onclick="deleteProject('${p.id}')">📦 Archive</button>
            </div>
          </div>
        </td>
      </tr>`;
    }).join('')}
  </tbody></table></div>`;
}



// ─── SIDEBAR ──────────────────────────────────────────
const SIDEBAR_TABS = [
  {i:0, icon:'📊', label:'Dashboard'},
  {i:1, icon:'🏗️', label:'Projects'},
  {i:2, icon:'👷', label:'Contractors'},
  {i:3, icon:'📂', label:'Tally'},
  {i:4, icon:'📈', label:'Interest'},
  {i:5, icon:'💳', label:'EMI Calendar'},
  {i:7, icon:'🧾', label:'GST'},
  {i:8, icon:'🧱', label:'Material Credit'},
  {i:9, icon:'⚡', label:'Action Centre'},
];

function buildSidebar(isSuperAdmin){
  const linksEl = document.getElementById('sidebar-links');
  const footerEl = document.getElementById('sidebar-footer');
  if(!linksEl) return;

  const tabs = isSuperAdmin
    ? [...SIDEBAR_TABS, {i:6, icon:'⚙️', label:'Settings'}, {i:10, icon:'🧮', label:'GST Calc'}]
    : SIDEBAR_TABS;

  linksEl.innerHTML = tabs.map(t=>`
    <button class="sidebar-link${t.i===0?' active':''}" id="sbl-${t.i}" onclick="ownerTab(${t.i});closeSidebar()">
      <span class="sidebar-link-icon">${t.icon}</span>${t.label}
    </button>`).join('');

  if(footerEl){
    const name = CU?CU.name:'—';
    const role = CU&&CU.isSuperAdmin?'Super Admin':'Staff';
    footerEl.innerHTML=`
      <div class="sidebar-user"><span class="nav-role" style="font-size:10px">${role}</span><br>${name}</div>
      <button class="sidebar-logout" onclick="logout()">🚪 Logout</button>`;
  }
}

function updateSidebarActive(i){
  document.querySelectorAll('.sidebar-link').forEach(el=>el.classList.remove('active'));
  const active = document.getElementById('sbl-'+i);
  if(active) active.classList.add('active');
}

function toggleSidebar(){
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if(!sb) return;
  const isOpen = sb.classList.contains('open');
  if(isOpen){ closeSidebar(); }
  else{ sb.classList.add('open'); if(ov) ov.style.display='block'; }
}

function closeSidebar(){
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if(sb) sb.classList.remove('open');
  if(ov) ov.style.display='none';
}

function showSidebar(){
  const sb = document.getElementById('sidebar');
  if(sb) sb.style.display='flex';
}

function ownerTab(i){
  atab=i; dpid=null;
  document.querySelectorAll('.nav-link').forEach((e,j)=>e.classList.toggle('active',j===i));
  document.querySelectorAll('[id^="obn-"]').forEach((e,j)=>e.classList.toggle('active',j===i));
  // Only switch main tabs (not detail view which is sec-detail)
  const mainSecs = ['sec-dash','sec-proj','sec-cont','sec-funds','sec-interest','sec-emi','sec-settings','sec-gst','sec-matcredit','sec-pipeline','sec-gst-calc'];
  document.querySelectorAll('.osec').forEach(e=>e.classList.add('hidden'));
  const targetId = mainSecs[i];
  if(targetId) document.getElementById(targetId)?.classList.remove('hidden');
  if(i===0) renderDash();
  if(i===1) renderProjects();
  if(i===2){ renderConts(); renderContractorPerformance(); }
  if(i===3){
    loadUnmatchedFromCloud().then(()=>renderFunds()).catch(()=>renderFunds());
  }
  if(i===4) renderInterest();
  if(i===5) renderEMI();
  if(i===6) renderSettings();
  if(i===7) renderGST();
  if(i===8) renderMatCredit();
  if(i===9) renderPipeline();
  if(i===10) renderGSTCalc();
  // Push to browser history + save session
  if(typeof pushTabHistory === 'function') pushTabHistory(i);
  if(typeof saveSessionState === 'function') saveSessionState();
  // Update sidebar active state
  updateSidebarActive(i);
}
// ─── NAVIGATION STATE ────────────────────────────────
// Remembers where user was before opening a project detail
let navHistory = {
  tab: 1,
  statusFilter: 'all',
  firmFilter: 'all',
  typeFilter: 'all',
  sortFilter: 'agree-asc',
  quickFilter: 'all',
  quickFilterType: 'none',
  viewMode: 'grid',
  scrollY: 0
};

function saveNavState(){
  navHistory = {
    tab: atab,
    statusFilter: document.getElementById('proj-status-filter')?.value || 'all',
    firmFilter: document.getElementById('proj-firm-filter')?.value || 'all',
    typeFilter: document.getElementById('proj-type-filter')?.value || 'all',
    sortFilter: document.getElementById('proj-sort-filter')?.value || 'agree-asc',
    quickFilter: projQuickFilter,
    quickFilterType: projQuickFilterType,
    viewMode: projViewMode,
    scrollY: window.scrollY
  };
}

function goBack(){
  // Restore to previous tab and filter state
  projViewMode = navHistory.viewMode;
  projQuickFilter = navHistory.quickFilter;
  projQuickFilterType = navHistory.quickFilterType;

  // Switch to tab (ownerTab resets filters, so restore after)
  const targetTab = navHistory.tab;
  atab = targetTab; dpid = null;
  document.querySelectorAll('[id^="obn-"]').forEach((e,j)=>e.classList.toggle('active',j===targetTab));
  const mainSecs = ['sec-dash','sec-proj','sec-cont','sec-funds','sec-interest','sec-emi','sec-settings','sec-gst'];
  document.querySelectorAll('.osec').forEach(e=>e.classList.add('hidden'));
  const targetId = mainSecs[targetTab];
  if(targetId) document.getElementById(targetId)?.classList.remove('hidden');
  updateSidebarActive(targetTab);

  if(targetTab === 1){
    // Restore project tab state
    renderProjects();
    // Restore filter values after render
    requestAnimationFrame(()=>{
      const sf = document.getElementById('proj-status-filter');
      const ff = document.getElementById('proj-firm-filter');
      const tf = document.getElementById('proj-type-filter');
      const sof = document.getElementById('proj-sort-filter');
      const vtg = document.getElementById('vt-grid');
      const vtt = document.getElementById('vt-table');
      if(sf) sf.value = navHistory.statusFilter;
      if(ff) ff.value = navHistory.firmFilter;
      if(tf) tf.value = navHistory.typeFilter;
      if(sof) sof.value = navHistory.sortFilter;
      if(vtg) vtg.classList.toggle('active', navHistory.viewMode==='grid');
      if(vtt) vtt.classList.toggle('active', navHistory.viewMode==='table');
      renderProjects(); // re-render with restored filters
      window.scrollTo(0, navHistory.scrollY);
    });
  } else if(targetTab === 0){ renderDash(); }
  else if(targetTab === 2){ renderConts(); renderContractorPerformance(); }
  else if(targetTab === 4){ renderInterest(); }
  else if(targetTab === 5){ renderEMI(); }
  else if(targetTab === 7){ renderGST(); }
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

  // Search projects — all fields
  D.projects.filter(p=>!isArchived(p)).forEach(p=>{
    const c = GC(p.contractorId);
    const genCode = (p.genCode||(p.docVault&&p.docVault.gencode)||'').toLowerCase();
    const eaNum = (p.eaNumber||(p.docVault&&p.docVault.ea)||'').toLowerCase();
    const jvNum = (p.jvNumber||'').toLowerCase();
    const cc = (p.costCentre||'').toLowerCase();
    const matched =
      p.name.toLowerCase().includes(q) ||
      (p.tender||'').toLowerCase().includes(q) ||
      (p.location||'').toLowerCase().includes(q) ||
      (c&&c.name.toLowerCase().includes(q)) ||
      genCode.includes(q) || eaNum.includes(q) ||
      jvNum.includes(q) || cc.includes(q);
    if(matched){
      let hint = '';
      if(genCode.includes(q)&&q) hint=`Gen: ${(p.genCode||(p.docVault&&p.docVault.gencode)||'')}`;
      else if(eaNum.includes(q)&&q) hint=`EA: ${(p.eaNumber||(p.docVault&&p.docVault.ea)||'')}`;
      else if(jvNum.includes(q)&&q) hint=`JV: ${p.jvNumber}`;
      else if(cc.includes(q)&&q) hint=`CC: ${p.costCentre}`;
      results.push({ type:'project', id:p.id, name:p.name,
        sub:`#${p.tender||''} · ${c?c.name:'—'}${hint?' · '+hint:''}`,
        badge: sBadge(pStat(p),p) });
    }
  });

  // Search contractors — name, username, phone
  D.contractors.forEach(c=>{
    if(c.name.toLowerCase().includes(q) ||
       (c.username||'').toLowerCase().includes(q) ||
       (c.phone||'').includes(q)){
      const pp = D.projects.filter(p=>p.contractorId===c.id&&!isArchived(p));
      results.push({ type:'contractor', id:c.id, name:c.name,
        sub:`📞 ${c.phone||'—'}${c.username?' · @'+c.username:''} · ${pp.length} project${pp.length!==1?'s':''}` });
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
            <span style="color:var(--text3)">${fmtDate(p.jvDate)}</span>
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
