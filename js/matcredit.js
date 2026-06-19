// ═══════════════════════════════════════════════════════
// matcredit.js — RSR Constructions Tracker
// Material Credit Tracker
// Tracks supplier credit (materials given on credit to contractors,
// guaranteed by RSR) per project + global supplier view
// ═══════════════════════════════════════════════════════

const MAT_TYPES = ['Cement','Steel','Sand','Aggregate','Bricks','Paint','Plumbing','Electrical','Other'];

// ─── DATA HELPERS ─────────────────────────────────────
// Material credits stored inside each project as p.materialCredits[]
// Each entry: { id, supplierId, supplierName, materialType, qty, unit,
//               invoiceNo, invoiceDate, invoiceAmount, contractorGST,
//               status, clearedAmount, clearedDate, clearedNotes, createdAt }

function getAllMaterialCredits(){
  const all = [];
  D.projects.filter(p=>!isArchived(p)).forEach(p=>{
    (p.materialCredits||[]).filter(m=>!isArchived(m)).forEach(m=>{
      all.push({...m, projectId:p.id, projectName:p.name,
        contractorId:p.contractorId,
        contractorName:(GC(p.contractorId)||{name:'—'}).name,
        firm:p.firm||'RSR Constructions'});
    });
  });
  return all;
}

function getAllSuppliers(){
  const suppliers = new Map();
  getAllMaterialCredits().forEach(m=>{
    if(!suppliers.has(m.supplierName)){
      suppliers.set(m.supplierName, {
        name:m.supplierName, entries:[], totalPending:0, totalCleared:0
      });
    }
    const s = suppliers.get(m.supplierName);
    s.entries.push(m);
    const pending = (m.invoiceAmount||0) - (m.clearedAmount||0);
    s.totalPending += Math.max(0, pending);
    s.totalCleared += m.clearedAmount||0;
  });
  return Array.from(suppliers.values()).sort((a,b)=>b.totalPending-a.totalPending);
}

function getAllContractorsWithMaterial(){
  const contractors = new Map();
  getAllMaterialCredits().forEach(m=>{
    const key = m.contractorId || '—';
    if(!contractors.has(key)){
      contractors.set(key, {
        contractorId: m.contractorId, name: m.contractorName||'Unassigned',
        entries:[], totalPending:0, totalCleared:0
      });
    }
    const c = contractors.get(key);
    c.entries.push(m);
    const pending = (m.invoiceAmount||0) - (m.clearedAmount||0);
    c.totalPending += Math.max(0, pending);
    c.totalCleared += m.clearedAmount||0;
  });
  return Array.from(contractors.values()).sort((a,b)=>b.totalPending-a.totalPending);
}

function getProjectMaterialSummary(p){
  const entries = (p.materialCredits||[]).filter(m=>!isArchived(m));
  const total = entries.reduce((s,m)=>s+(m.invoiceAmount||0),0);
  const cleared = entries.reduce((s,m)=>s+(m.clearedAmount||0),0);
  const pending = Math.max(0, total - cleared);
  return { entries, total, cleared, pending, count:entries.length };
}

// ─── MAIN TAB RENDER ──────────────────────────────────
let matView = 'supplier'; // 'supplier' | 'project'
let matFilter = 'pending'; // 'pending' | 'cleared' | 'all'

function renderMatCredit(){
  const wrap = document.getElementById('matcredit-wrap') || document.getElementById('sec-matcredit');
  const el = wrap;
  if(!el) return;

  const all = getAllMaterialCredits();
  const suppliers = getAllSuppliers();
  const totalPending = suppliers.reduce((s,x)=>s+x.totalPending,0);
  const totalCleared = suppliers.reduce((s,x)=>s+x.totalCleared,0);

  el.innerHTML = `<div class="wrap">
    <div class="pg-hdr">
      <div class="pg-title">🧱 Material Credit</div>
      <button class="btn btn-gold" onclick="openAddMatCredit(null)">+ Add Credit Entry</button>
    </div>

    <!-- Summary cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px">
      <div class="card" style="text-align:center;padding:14px;border-top:3px solid var(--red)">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;text-transform:uppercase;font-weight:700">Total Pending</div>
        <div style="font-size:20px;font-weight:800;color:var(--red)">${fmt(totalPending)}</div>
      </div>
      <div class="card" style="text-align:center;padding:14px;border-top:3px solid var(--green)">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;text-transform:uppercase;font-weight:700">Total Cleared</div>
        <div style="font-size:20px;font-weight:800;color:var(--green)">${fmt(totalCleared)}</div>
      </div>
      <div class="card" style="text-align:center;padding:14px;border-top:3px solid var(--navy)">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;text-transform:uppercase;font-weight:700">Suppliers</div>
        <div style="font-size:20px;font-weight:800;color:var(--navy)">${suppliers.length}</div>
      </div>
      <div class="card" style="text-align:center;padding:14px;border-top:3px solid var(--amber)">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;text-transform:uppercase;font-weight:700">Total Entries</div>
        <div style="font-size:20px;font-weight:800;color:var(--amber)">${all.length}</div>
      </div>
    </div>

    <!-- View toggle + filter -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <div class="view-toggle">
        <button id="mcv-supplier" class="${matView==='supplier'?'active':''}" onclick="setMatView('supplier')">🏭 By Supplier</button>
        <button id="mcv-project" class="${matView==='project'?'active':''}" onclick="setMatView('project')">🏗️ By Project</button>
        <button id="mcv-contractor" class="${matView==='contractor'?'active':''}" onclick="setMatView('contractor')">👷 By Contractor</button>
      </div>
      <div style="display:flex;gap:6px">
        ${['pending','cleared','all'].map(f=>`<button onclick="setMatFilter('${f}')" style="padding:5px 12px;border-radius:16px;font-size:11px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;border:1.5px solid ${matFilter===f?'var(--navy)':'var(--border)'};background:${matFilter===f?'var(--navy)':'#fff'};color:${matFilter===f?'#fff':'var(--text2)'}">${f==='pending'?'⏳ Pending':f==='cleared'?'✅ Cleared':'All'}</button>`).join('')}
      </div>
    </div>

    <div id="mat-credit-body"></div>
  </div>`;

  renderMatCreditBody();
}

function setMatView(v){ matView=v; renderMatCredit(); }
function setMatFilter(f){ matFilter=f; renderMatCredit(); }

function renderMatCreditBody(){
  const el = document.getElementById('mat-credit-body');
  if(!el) return;

  if(matView === 'supplier'){
    renderMatBySupplier(el);
  } else if(matView === 'contractor'){
    renderMatByContractor(el);
  } else {
    renderMatByProject(el);
  }
}

function renderMatBySupplier(el){
  const suppliers = getAllSuppliers();
  if(!suppliers.length){
    el.innerHTML='<div class="empty"><div class="empty-icon">🏭</div><div class="empty-text">No material credit entries yet.<br>Click "+ Add Credit Entry" to start tracking.</div></div>';
    return;
  }

  el.innerHTML = suppliers.map(s=>{
    let entries = s.entries;
    if(matFilter==='pending') entries = entries.filter(e=>(e.invoiceAmount||0)>(e.clearedAmount||0));
    if(matFilter==='cleared') entries = entries.filter(e=>(e.clearedAmount||0)>=(e.invoiceAmount||0)&&e.invoiceAmount>0);
    if(!entries.length) return '';

    return `<div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:15px;font-weight:800;color:var(--navy)">${s.name}</div>
          <div style="font-size:12px;color:var(--text3)">${s.entries.length} invoice${s.entries.length!==1?'s':''} across ${new Set(s.entries.map(e=>e.projectId)).size} project${new Set(s.entries.map(e=>e.projectId)).size!==1?'s':''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:14px;font-weight:800;color:${s.totalPending>0?'var(--red)':'var(--green)'}">${fmt(s.totalPending)} pending</div>
          <div style="font-size:11px;color:var(--text3)">${fmt(s.totalCleared)} cleared</div>
        </div>
      </div>
      ${entries.map(e=>renderMatEntry(e, true)).join('')}
    </div>`;
  }).join('') || '<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">No entries in this filter.</div></div>';
}

function renderMatByProject(el){
  const projects = D.projects.filter(p=>!isArchived(p)&&(p.materialCredits||[]).filter(m=>!isArchived(m)).length>0);
  if(!projects.length){
    el.innerHTML='<div class="empty"><div class="empty-icon">🏗️</div><div class="empty-text">No material credit entries yet.</div></div>';
    return;
  }

  el.innerHTML = projects.map(p=>{
    const summ = getProjectMaterialSummary(p);
    let entries = summ.entries;
    if(matFilter==='pending') entries = entries.filter(e=>(e.invoiceAmount||0)>(e.clearedAmount||0));
    if(matFilter==='cleared') entries = entries.filter(e=>(e.clearedAmount||0)>=(e.invoiceAmount||0)&&e.invoiceAmount>0);
    if(!entries.length) return '';

    return `<div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--navy);cursor:pointer;text-decoration:underline" onclick="openDetail('${p.id}')">${p.name.substring(0,60)}</div>
          <div style="font-size:11px;color:var(--text3)">${(GC(p.contractorId)||{name:'—'}).name} · ${p.firm||'RSR'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:13px;font-weight:800;color:${summ.pending>0?'var(--red)':'var(--green)'}">${fmt(summ.pending)} pending</div>
          <div style="font-size:11px;color:var(--text3)">${fmt(summ.total)} total</div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
        <button onclick="openAddMatCredit('${p.id}')" style="background:none;border:1px solid var(--border);border-radius:var(--rs);padding:4px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;color:var(--navy)">+ Add Entry</button>
      </div>
      ${entries.map(e=>renderMatEntry(e, false)).join('')}
    </div>`;
  }).join('') || '<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">No entries in this filter.</div></div>';
}

function renderMatEntry(e, showProject){
  const pending = Math.max(0,(e.invoiceAmount||0)-(e.clearedAmount||0));
  const isCleared = pending <= 0 && (e.invoiceAmount||0) > 0;
  const isPartial = (e.clearedAmount||0) > 0 && !isCleared;
  const daysOld = e.invoiceDate ? Math.round((new Date()-new Date(e.invoiceDate))/86400000) : 0;
  const isOverdue = daysOld > 60 && !isCleared;

  return `<div style="padding:10px 12px;background:${isCleared?'#f0fdf4':isOverdue?'#fef2f2':'var(--surface2)'};border-radius:var(--rs);margin-bottom:8px;border-left:3px solid ${isCleared?'var(--green)':isOverdue?'var(--red)':isPartial?'var(--amber)':'var(--border)'}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px">
          <span style="font-size:13px;font-weight:700">${e.supplierName}</span>
          <span style="font-size:10px;background:var(--navy);color:#fff;padding:1px 7px;border-radius:8px;font-weight:600">${e.materialType||'Material'}</span>
          ${isCleared?'<span style="font-size:10px;color:var(--green);font-weight:700">✅ Cleared</span>':''}
          ${isPartial?'<span style="font-size:10px;color:var(--amber);font-weight:700">⏳ Partial</span>':''}
          ${isOverdue?'<span style="font-size:10px;color:var(--red);font-weight:700">🔴 Overdue</span>':''}
        </div>
        ${showProject?`<div style="font-size:11px;color:var(--navy);font-weight:600;margin-bottom:2px">${e.projectName?.substring(0,50)||''}</div>`:''}
        <div style="font-size:11px;color:var(--text3)">${e.qty?e.qty+' '+e.unit+' · ':''} Invoice #${e.invoiceNo||'—'} · ${e.invoiceDate||'—'} · ${daysOld}d old</div>
        ${e.clearedNotes?`<div style="font-size:11px;color:var(--text2);margin-top:3px;font-style:italic">${e.clearedNotes}</div>`:''}
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:14px;font-weight:800;color:${isCleared?'var(--green)':'var(--red)'}">₹${(e.invoiceAmount||0).toLocaleString('en-IN')}</div>
        ${isPartial?`<div style="font-size:11px;color:var(--amber)">₹${(e.clearedAmount).toLocaleString('en-IN')} cleared</div>`:''}
        ${!isCleared?`<div style="font-size:11px;color:var(--red);font-weight:700">₹${pending.toLocaleString('en-IN')} pending</div>`:''}
      </div>
    </div>
    ${!isCleared?`<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
      <button onclick="openClearMatCredit('${e.projectId}','${e.id}')" style="background:var(--green);color:#fff;border:none;border-radius:var(--rs);padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">💰 Mark Cleared</button>
      <button onclick="openEditMatCredit('${e.projectId}','${e.id}')" style="background:none;border:1px solid var(--border);border-radius:var(--rs);padding:4px 10px;font-size:11px;cursor:pointer;font-family:'Inter',sans-serif;color:var(--text2)">✏️ Edit</button>
      <button onclick="deleteMatCredit('${e.projectId}','${e.id}')" style="background:none;border:1px solid var(--border);border-radius:var(--rs);padding:4px 10px;font-size:11px;cursor:pointer;font-family:'Inter',sans-serif;color:var(--red)">🗑️</button>
    </div>`:`<div style="font-size:11px;color:var(--text3);margin-top:6px">Cleared: ${e.clearedDate||''} · ${e.clearedNotes||''}</div>`}
  </div>`;
}

function renderMatByContractor(el){
  const contractors = getAllContractorsWithMaterial();
  if(!contractors.length){
    el.innerHTML='<div class="empty"><div class="empty-icon">👷</div><div class="empty-text">No material credit entries yet.<br>Click "+ Add Credit Entry" to start tracking.</div></div>';
    return;
  }

  el.innerHTML = contractors.map(c=>{
    let entries = c.entries;
    if(matFilter==='pending') entries = entries.filter(e=>(e.invoiceAmount||0)>(e.clearedAmount||0));
    if(matFilter==='cleared') entries = entries.filter(e=>(e.clearedAmount||0)>=(e.invoiceAmount||0)&&e.invoiceAmount>0);
    if(!entries.length) return '';

    const supplierCount = new Set(c.entries.map(e=>e.supplierName)).size;
    const projectCount = new Set(c.entries.map(e=>e.projectId)).size;

    return `<div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:15px;font-weight:800;color:var(--navy);${c.contractorId?'cursor:pointer;text-decoration:underline':''}" ${c.contractorId?`onclick="ownerTab(2)"`:''}>${c.name}</div>
          <div style="font-size:12px;color:var(--text3)">${c.entries.length} invoice${c.entries.length!==1?'s':''} · ${supplierCount} supplier${supplierCount!==1?'s':''} · ${projectCount} project${projectCount!==1?'s':''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:14px;font-weight:800;color:${c.totalPending>0?'var(--red)':'var(--green)'}">${fmt(c.totalPending)} pending</div>
          <div style="font-size:11px;color:var(--text3)">${fmt(c.totalCleared)} cleared</div>
        </div>
      </div>
      ${entries.map(e=>renderMatEntry(e, true)).join('')}
    </div>`;
  }).join('') || '<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">No entries in this filter.</div></div>';
}

// ─── PROJECT INLINE SECTION ───────────────────────────
function renderProjectMatCredit(p){
  const summ = getProjectMaterialSummary(p);
  const entries = summ.entries;

  return `<div class="card" style="margin-bottom:14px">
    <details>
      <summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:4px">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="st" style="margin:0;border:none;padding:0">🧱 Material Credit</div>
          ${summ.pending>0?`<span style="font-size:11px;font-weight:800;color:var(--red);background:#fef2f2;padding:2px 8px;border-radius:10px">₹${summ.pending.toLocaleString('en-IN')} pending</span>`:''}
          ${summ.count>0&&summ.pending===0?`<span style="font-size:11px;font-weight:700;color:var(--green)">✅ All cleared</span>`:''}
        </div>
        <span style="font-size:11px;font-weight:600;color:var(--navy)">▼ Show / Hide</span>
      </summary>
      <div style="margin-top:12px">
        ${summ.count===0?`<div style="font-size:13px;color:var(--text3);padding:12px 0">No material credit entries for this project.</div>`:''}
        ${entries.map(e=>renderMatEntry({...e,projectId:p.id,projectName:p.name}, false)).join('')}
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div style="font-size:12px;color:var(--text2)">Total: <strong>${fmt(summ.total)}</strong> · Pending: <strong style="color:${summ.pending>0?'var(--red)':'var(--green)'}">${fmt(summ.pending)}</strong></div>
          <button onclick="openAddMatCredit('${p.id}')" style="background:var(--navy);color:#fff;border:none;border-radius:var(--rs);padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">+ Add Entry</button>
        </div>
      </div>
    </details>
  </div>`;
}

// ─── ADD / EDIT MODAL ─────────────────────────────────
function openAddMatCredit(pid){
  // Build project dropdown if no pid given
  const projOptions = pid ? '' : D.projects.filter(p=>!isArchived(p)).map(p=>`<option value="${p.id}">${p.name.substring(0,60)}</option>`).join('');

  // Get known suppliers for autocomplete
  const knownSuppliers = [...new Set(getAllMaterialCredits().map(m=>m.supplierName))];

  let modal = document.getElementById('modal-mat-credit');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-mat-credit'; document.body.appendChild(modal); }

  modal.innerHTML = `<div class="mbox" style="max-width:520px">
    <div class="mhdr"><h2>🧱 Add Material Credit Entry</h2><button class="mx" onclick="CM('modal-mat-credit')">✕</button></div>

    ${!pid?`<div class="fg"><label>Project *</label>
      <select id="mc-project" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px">
        <option value="">— Select Project —</option>${projOptions}
      </select></div>`:'<input type="hidden" id="mc-project" value="'+pid+'">'}

    <div class="frow">
      <div class="fg">
        <label>Supplier Name *</label>
        <input type="text" id="mc-supplier" list="mc-supplier-list" placeholder="e.g. Sai Lakshmi Cement">
        <datalist id="mc-supplier-list">${knownSuppliers.map(s=>`<option value="${s}">`).join('')}</datalist>
      </div>
      <div class="fg">
        <label>Material Type *</label>
        <select id="mc-mattype" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px">
          ${MAT_TYPES.map(t=>`<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="frow">
      <div class="fg"><label>Quantity</label><input type="number" id="mc-qty" placeholder="e.g. 100"></div>
      <div class="fg"><label>Unit</label>
        <select id="mc-unit" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px">
          <option>Bags</option><option>MT</option><option>Nos</option><option>Sqft</option><option>Sqm</option><option>Cum</option><option>Rmt</option><option>LS</option>
        </select>
      </div>
    </div>

    <div class="frow">
      <div class="fg"><label>Invoice Number</label><input type="text" id="mc-invno" placeholder="Invoice #"></div>
      <div class="fg"><label>Invoice Date *</label><input type="date" id="mc-invdate" value="${new Date().toISOString().split('T')[0]}"></div>
    </div>

    <div class="fg"><label>Invoice Amount (₹) *</label><input type="number" id="mc-amount" placeholder="Total invoice value"></div>

    <div class="fg"><label>Contractor GST (on whose name)</label><input type="text" id="mc-gst" placeholder="Contractor's GST number"></div>

    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn" onclick="CM('modal-mat-credit')">Cancel</button>
      <button class="btn btn-navy" onclick="saveMatCredit(null)">✓ Save Entry</button>
    </div>
  </div>`;
  modal.classList.add('open');
  setTimeout(()=>document.getElementById('mc-supplier')?.focus(), 200);
}

async function saveMatCredit(editId){
  const pid = document.getElementById('mc-project')?.value;
  const supplier = document.getElementById('mc-supplier')?.value?.trim();
  const matType = document.getElementById('mc-mattype')?.value;
  const amount = parseFloat(document.getElementById('mc-amount')?.value)||0;
  const invDate = document.getElementById('mc-invdate')?.value;

  if(!pid){ toast('Select a project','error'); return; }
  if(!supplier){ toast('Enter supplier name','error'); return; }
  if(!amount){ toast('Enter invoice amount','error'); return; }

  const p = GP(pid); if(!p) return;
  if(!p.materialCredits) p.materialCredits = [];

  if(editId){
    const entry = p.materialCredits.find(m=>m.id===editId);
    if(entry){
      entry.supplierName = supplier;
      entry.materialType = matType;
      entry.qty = parseFloat(document.getElementById('mc-qty')?.value)||null;
      entry.unit = document.getElementById('mc-unit')?.value;
      entry.invoiceNo = document.getElementById('mc-invno')?.value?.trim();
      entry.invoiceDate = invDate;
      entry.invoiceAmount = amount;
      entry.contractorGST = document.getElementById('mc-gst')?.value?.trim();
    }
  } else {
    p.materialCredits.push({
      id: uid(),
      supplierName: supplier,
      materialType: matType,
      qty: parseFloat(document.getElementById('mc-qty')?.value)||null,
      unit: document.getElementById('mc-unit')?.value,
      invoiceNo: document.getElementById('mc-invno')?.value?.trim(),
      invoiceDate: invDate,
      invoiceAmount: amount,
      contractorGST: document.getElementById('mc-gst')?.value?.trim(),
      status: 'pending',
      clearedAmount: 0,
      createdAt: new Date().toISOString()
    });
  }

  try{
    await saveProjectDB(p, {type:'mat_credit_added', amount, ref:supplier, meta:{supplier,matType}});
    CM('modal-mat-credit');
    if(dpid === pid) renderDetail(pid);
    if(document.getElementById('sec-matcredit')?.classList.contains('hidden')===false) renderMatCredit();
    toast('✓ Material credit entry saved','ok');
  }catch(e){ toast('Save failed','error'); }
}

function openEditMatCredit(pid, mid){
  const p = GP(pid); if(!p) return;
  const m = (p.materialCredits||[]).find(x=>x.id===mid); if(!m) return;
  openAddMatCredit(pid);
  setTimeout(()=>{
    document.getElementById('mc-supplier').value = m.supplierName||'';
    document.getElementById('mc-mattype').value = m.materialType||'Cement';
    document.getElementById('mc-qty').value = m.qty||'';
    document.getElementById('mc-unit').value = m.unit||'Bags';
    document.getElementById('mc-invno').value = m.invoiceNo||'';
    document.getElementById('mc-invdate').value = m.invoiceDate||'';
    document.getElementById('mc-amount').value = m.invoiceAmount||'';
    document.getElementById('mc-gst').value = m.contractorGST||'';
    // Change save button to update
    const saveBtn = document.querySelector('#modal-mat-credit .btn-navy');
    if(saveBtn) saveBtn.setAttribute('onclick', `saveMatCredit('${mid}')`);
    const header = document.querySelector('#modal-mat-credit .mhdr h2');
    if(header) header.textContent = '✏️ Edit Material Credit Entry';
  }, 200);
}

// ─── CLEAR PAYMENT MODAL ──────────────────────────────
function openClearMatCredit(pid, mid){
  const p = GP(pid); if(!p) return;
  const m = (p.materialCredits||[]).find(x=>x.id===mid); if(!m) return;
  const pending = Math.max(0,(m.invoiceAmount||0)-(m.clearedAmount||0));

  let modal = document.getElementById('modal-mat-clear');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-mat-clear'; document.body.appendChild(modal); }

  modal.innerHTML = `<div class="mbox" style="max-width:420px">
    <div class="mhdr"><h2>💰 Clear Payment — ${m.supplierName}</h2><button class="mx" onclick="CM('modal-mat-clear')">✕</button></div>

    <div style="background:var(--surface2);border-radius:var(--rs);padding:12px;margin-bottom:16px;font-size:13px">
      <div>Invoice: <strong>${fmt(m.invoiceAmount||0)}</strong></div>
      <div>Already cleared: <strong style="color:var(--green)">${fmt(m.clearedAmount||0)}</strong></div>
      <div>Pending: <strong style="color:var(--red)">${fmt(pending)}</strong></div>
    </div>

    <div class="fg"><label>Amount Being Cleared (₹)</label><input type="number" id="mc-clear-amt" value="${pending}" placeholder="Amount paid now"></div>
    <div class="fg"><label>Date of Payment</label><input type="date" id="mc-clear-date" value="${new Date().toISOString().split('T')[0]}"></div>
    <div class="fg"><label>Notes (how paid)</label><input type="text" id="mc-clear-notes" placeholder="e.g. Contractor gave check to supplier on 15-Apr"></div>

    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn" onclick="CM('modal-mat-clear')">Cancel</button>
      <button class="btn" style="background:var(--green);color:#fff;border:none;font-weight:700" onclick="clearMatCredit('${pid}','${mid}')">✓ Mark Cleared</button>
    </div>
  </div>`;
  modal.classList.add('open');
}

async function clearMatCredit(pid, mid){
  const p = GP(pid); if(!p) return;
  const m = (p.materialCredits||[]).find(x=>x.id===mid); if(!m) return;
  const amt = parseFloat(document.getElementById('mc-clear-amt')?.value)||0;
  const date = document.getElementById('mc-clear-date')?.value;
  const notes = document.getElementById('mc-clear-notes')?.value?.trim();

  if(!amt){ toast('Enter amount cleared','error'); return; }

  m.clearedAmount = (m.clearedAmount||0) + amt;
  m.clearedDate = date;
  m.clearedNotes = notes;
  m.status = m.clearedAmount >= m.invoiceAmount ? 'cleared' : 'partial';

  try{
    await saveProjectDB(p, {type:'mat_credit_cleared', amount:amt, ref:m.supplierName, meta:{mid, notes}});
    CM('modal-mat-clear');
    if(dpid === pid) renderDetail(pid);
    if(!document.getElementById('sec-matcredit')?.classList.contains('hidden')) renderMatCredit();
    toast(`✓ ₹${amt.toLocaleString('en-IN')} cleared for ${m.supplierName}`,'ok');
    haptic('success');
  }catch(e){ toast('Save failed','error'); }
}

async function deleteMatCredit(pid, mid){
  if(!confirm('Remove this material credit entry?')) return;
  const p = GP(pid); if(!p) return;
  const m = (p.materialCredits||[]).find(x=>x.id===mid); if(!m) return;
  m._archived = true;
  try{
    await saveProjectDB(p);
    if(dpid===pid) renderDetail(pid);
    if(!document.getElementById('sec-matcredit')?.classList.contains('hidden')) renderMatCredit();
    toast('Entry removed','ok');
  }catch(e){ toast('Save failed','error'); }
}

// ─── DASHBOARD ALERTS FOR MATERIAL CREDIT ─────────────
function getMatCreditDashboardAlerts(){
  const all = getAllMaterialCredits();
  const today = new Date();
  const alerts = [];

  // Group overdue entries
  const overdue60 = all.filter(m=>{
    if((m.invoiceAmount||0)<=(m.clearedAmount||0)) return false;
    if(!m.invoiceDate) return false;
    return Math.round((today-new Date(m.invoiceDate))/86400000) > 60;
  });

  const overdue45 = all.filter(m=>{
    if((m.invoiceAmount||0)<=(m.clearedAmount||0)) return false;
    if(!m.invoiceDate) return false;
    const days = Math.round((today-new Date(m.invoiceDate))/86400000);
    return days > 45 && days <= 60;
  });

  if(overdue60.length){
    const total = overdue60.reduce((s,m)=>s+Math.max(0,(m.invoiceAmount||0)-(m.clearedAmount||0)),0);
    alerts.push({
      type:'red', icon:'🧱',
      text:`${overdue60.length} material credit${overdue60.length>1?'s':''} overdue (60+ days)`,
      sub:`${fmt(total)} total pending`,
      action:()=>ownerTab(8)
    });
  }

  if(overdue45.length){
    const total = overdue45.reduce((s,m)=>s+Math.max(0,(m.invoiceAmount||0)-(m.clearedAmount||0)),0);
    alerts.push({
      type:'amber', icon:'🧱',
      text:`${overdue45.length} material credit${overdue45.length>1?'s':''} pending 45+ days`,
      sub:`${fmt(total)} total`,
      action:()=>ownerTab(8)
    });
  }

  if(!alerts.length) return '';

  return `<div class="card" style="border-top:3px solid ${alerts[0].type==='red'?'var(--red)':'var(--amber)'};padding:12px;margin-bottom:14px">
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">🧱 Material Credit</div>
    ${alerts.map(a=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--surface2);gap:8px">
      <div>
        <div style="font-size:12px;font-weight:600">${a.icon} ${a.text}</div>
        <div style="font-size:11px;color:var(--text3)">${a.sub}</div>
      </div>
      <button onclick="ownerTab(8)" style="background:${a.type==='red'?'var(--red)':'var(--amber)'};color:#fff;border:none;border-radius:var(--rs);padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">View</button>
    </div>`).join('')}
  </div>`;
}
