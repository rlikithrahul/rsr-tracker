// ═══════════════════════════════════════════════════════
// growthpool.js — Growth Pool Employee Incentive System
// Applies ONLY to projects Likith explicitly adds (self-executed work),
// never subcontractor-funded ones. Membership is forward-looking — a
// project added today only starts counting future collections, not past
// ones. Super Admin only for now (view-only for staff planned later, but
// allocation stays Likith-only forever, even then).
// ═══════════════════════════════════════════════════════

const GP_PROJECTS_KEY = 'rsr_growth_pool_projects';
const GP_COLLECTIONS_KEY = 'rsr_growth_pool_collections';
const GP_DEFAULT_PCT = 1; // 1% of net collection, editable per collection

async function loadGrowthPoolProjects(){
  if(D.growthPoolProjects) return D.growthPoolProjects;
  D.growthPoolProjects = await getSetting(GP_PROJECTS_KEY, []);
  return D.growthPoolProjects;
}
async function saveGrowthPoolProjects(){
  D.growthPoolProjects = await mergeAndSaveSetting(GP_PROJECTS_KEY, D.growthPoolProjects||[], true);
}
async function loadGrowthPoolCollections(){
  if(D.growthPoolCollections) return D.growthPoolCollections;
  D.growthPoolCollections = await getSetting(GP_COLLECTIONS_KEY, []);
  return D.growthPoolCollections;
}
async function saveGrowthPoolCollections(){
  D.growthPoolCollections = await mergeAndSaveSetting(GP_COLLECTIONS_KEY, D.growthPoolCollections||[], true);
}

function isProjectInGrowthPool(pid){
  return (D.growthPoolProjects||[]).some(x=>!x._archived && x.projectId===pid);
}

// Called right after a settlement is confirmed elsewhere in the app
// (confirmSettle in project_ops.js) — if this project is a Growth Pool
// member, this settlement automatically becomes a pending allocation.
// The settlement amount is what actually landed in the bank — GVMC
// already deducts GST/TDS before paying, so this figure is already the
// real net collection; there's no separate GST step needed here.
const GP_DEFAULT_GST_PCT = 16; // editable per collection — GST% to deduct before computing the pool

async function registerGrowthPoolCollection(p, settlement){
  if(!isProjectInGrowthPool(p.id)) return;
  await loadGrowthPoolCollections();
  // Avoid duplicates if this somehow runs twice for the same settlement
  if((D.growthPoolCollections||[]).some(c=>c.settlementId===settlement.id)) return;
  if(!D.growthPoolCollections) D.growthPoolCollections=[];
  D.growthPoolCollections.push({
    id: 'gpc_'+uid(), projectId: p.id, projectName: p.name,
    settlementId: settlement.id, source: 'settlement',
    grossAmount: settlement.amount, gstPct: GP_DEFAULT_GST_PCT,
    collectionDate: settlement.date, poolPct: GP_DEFAULT_PCT,
    splits: [], status: 'pending',
    createdAt: new Date().toISOString()
  });
  try{ await saveGrowthPoolCollections(); }
  catch(e){ console.error('Growth Pool collection registration failed:', e); }
}

function gpNetAmount(c){ return (c.grossAmount||0) * (1 - (c.gstPct||0)/100); }
function gpPoolAmount(c){ return gpNetAmount(c) * (c.poolPct||0) / 100; }

// ─── MANUAL COLLECTION ENTRY (for testing, or any collection that didn't
// come through the Settle flow) ────────────────────────
function openManualGrowthPoolCollectionModal(){
  const members = (D.growthPoolProjects||[]).filter(x=>!x._archived);
  if(!members.length){ toast('Add a project to the Growth Pool first','error'); return; }
  let modal = document.getElementById('modal-gp-manual');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-gp-manual'; document.body.appendChild(modal); }
  modal.innerHTML = `<div class="mbox" style="max-width:460px">
    <div class="mhdr"><h2>+ Manual Collection Entry</h2><button class="mx" onclick="CM('modal-gp-manual')">✕</button></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">Use this to test allocation now, or to record a collection that didn't come through the Settle flow.</div>
    <div class="fg"><label>Project</label>
      <select id="gp-manual-project">${members.map(m=>`<option value="${m.projectId}">${m.projectName.substring(0,60)}</option>`).join('')}</select>
    </div>
    <div class="fg"><label>Gross Amount Received (₹)</label><input type="number" id="gp-manual-gross" placeholder="e.g. 500000"></div>
    <div class="fg"><label>Date Received</label><input type="date" id="gp-manual-date" value="${new Date().toISOString().split('T')[0]}"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn" onclick="CM('modal-gp-manual')">Cancel</button>
      <button class="btn btn-navy" onclick="saveManualGrowthPoolCollection()">+ Create Pending Allocation</button>
    </div>
  </div>`;
  modal.classList.add('open');
}
async function saveManualGrowthPoolCollection(){
  const pid = document.getElementById('gp-manual-project')?.value;
  const gross = parseFloat(document.getElementById('gp-manual-gross')?.value);
  const date = document.getElementById('gp-manual-date')?.value;
  if(!pid){ toast('Select a project','error'); return; }
  if(!gross||gross<=0){ toast('Enter a valid amount','error'); return; }
  if(!date){ toast('Enter a date','error'); return; }
  const p = GP(pid); if(!p) return;
  if(!D.growthPoolCollections) D.growthPoolCollections=[];
  D.growthPoolCollections.push({
    id: 'gpc_'+uid(), projectId: pid, projectName: p.name,
    settlementId: null, source: 'manual',
    grossAmount: gross, gstPct: GP_DEFAULT_GST_PCT,
    collectionDate: date, poolPct: GP_DEFAULT_PCT,
    splits: [], status: 'pending',
    createdAt: new Date().toISOString()
  });
  try{
    await saveGrowthPoolCollections();
    CM('modal-gp-manual');
    _renderGrowthPoolTab();
    toast('✓ Pending allocation created','ok');
  }catch(e){ toast('Save failed','error'); }
}

async function deleteGrowthPoolCollection(id){
  const c = (D.growthPoolCollections||[]).find(x=>x.id===id); if(!c) return;
  const isAllocated = c.status==='allocated';
  const ok = await showConfirm({
    title: 'Delete Collection Entry?',
    message: isAllocated
      ? 'This was already split and allocated ('+fmt(gpPoolAmount(c))+' across '+(c.splits||[]).length+' recipients). Deleting it removes that record entirely — use this for test/mistaken entries, not real allocations someone may already expect to be paid.'
      : 'This removes the pending collection for "'+c.projectName+'" before it\'s been allocated. Safe to do for test entries or mistakes.',
    confirmLabel: 'Yes, Delete'
  });
  if(!ok) return;
  c._archived = true; c._archivedAt = new Date().toISOString();
  try{
    await saveGrowthPoolCollections();
    _renderGrowthPoolTab();
    toast('✓ Deleted','ok');
  }catch(e){
    delete c._archived; delete c._archivedAt;
    toast('Save failed — try again','error');
  }
}

// ─── MAIN RENDER (Super Admin only) ───────────────────
async function renderGrowthPool(){
  const el = document.getElementById('sec-growthpool');
  if(!el) return;
  if(!CU || !CU.isSuperAdmin){
    el.innerHTML = '<div class="wrap"><div class="card" style="text-align:center;padding:40px;color:var(--text3)">This section is only available to the Super Admin.</div></div>';
    return;
  }
  el.innerHTML = '<div class="wrap"><div class="loading" style="padding:40px;text-align:center;color:var(--text3)">⏳ Loading…</div></div>';
  try{
    await loadGrowthPoolProjects();
    await loadGrowthPoolCollections();
    if(typeof loadStaff==='function' && !D.staffMembers) await loadStaff();
  }catch(e){ console.error(e); }
  _renderGrowthPoolTab();
}

function _renderGrowthPoolTab(){
  const el = document.getElementById('sec-growthpool');
  if(!el) return;
  const members = (D.growthPoolProjects||[]).filter(x=>!x._archived);
  const collections = (D.growthPoolCollections||[]).filter(c=>!c._archived);
  const pending = collections.filter(c=>c.status==='pending');
  const allocated = collections.filter(c=>c.status==='allocated').sort((a,b)=>(b.collectionDate||'').localeCompare(a.collectionDate||''));

  const totalPool = allocated.reduce((s,c)=>s+gpPoolAmount(c),0);
  const totalReserve = allocated.reduce((s,c)=>s+(c.splits||[]).filter(sp=>sp.type==='reserve').reduce((a,sp)=>a+sp.amount,0),0);
  const totalRework = allocated.reduce((s,c)=>s+(c.splits||[]).filter(sp=>sp.type==='rework').reduce((a,sp)=>a+sp.amount,0),0);
  const totalStaffPaid = allocated.reduce((s,c)=>s+(c.splits||[]).filter(sp=>sp.type==='staff').reduce((a,sp)=>a+sp.amount,0),0);

  el.innerHTML = `<div class="wrap">
    <div class="pg-hdr">
      <div><div class="pg-title">🌱 Growth Pool</div>
        <div style="font-size:12px;color:var(--text3)">Employee incentive on self-executed project collections — Super Admin only</div></div>
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="openManualGrowthPoolCollectionModal()">+ Manual Collection</button>
        <button class="btn btn-navy" onclick="openAddGrowthPoolProjectModal()">+ Add Project</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:16px">
      <div class="stat"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">Total Pool (allocated)</div><div style="font-size:18px;font-weight:800;color:var(--navy)">${fmt(totalPool)}</div></div>
      <div class="stat"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">Paid to Staff</div><div style="font-size:18px;font-weight:800;color:var(--green)">${fmt(totalStaffPaid)}</div></div>
      <div class="stat"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">Reserve Balance</div><div style="font-size:18px;font-weight:800;color:var(--gold2)">${fmt(totalReserve)}</div></div>
      <div class="stat"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">Rework Set Aside</div><div style="font-size:18px;font-weight:800;color:var(--amber)">${fmt(totalRework)}</div></div>
    </div>

    ${pending.length ? `<div class="card" style="border-top:3px solid var(--amber);margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:10px">⏳ Pending Allocation (${pending.length})</div>
      ${pending.map(c=>`<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding:12px;border:1px solid var(--border);border-radius:var(--rs);margin-bottom:8px">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--navy)">${c.projectName.substring(0,60)}</div>
          <div style="font-size:12px;color:var(--text2)">Collected ${fmtDate(c.collectionDate)} — Gross ${fmt(c.grossAmount)} − ${c.gstPct}% GST = Net ${fmt(gpNetAmount(c))} — Pool (${c.poolPct}%): <strong>${fmt(gpPoolAmount(c))}</strong></div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-navy" onclick="openAllocateGrowthPoolModal('${c.id}')">Split Allocation →</button>
          <button class="btn btn-sm" style="color:var(--red);border-color:var(--red)" onclick="deleteGrowthPoolCollection('${c.id}')" title="Delete this collection entry">🗑️</button>
        </div>
      </div>`).join('')}
    </div>` : ''}

    <div class="card" style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:10px">🏗️ Growth Pool Projects (${members.length})</div>
      ${!members.length ? '<div style="font-size:13px;color:var(--text3);font-style:italic;padding:10px 0">No projects added yet. Click "+ Add Project" to add the first one — only future collections on added projects count.</div>' : members.map(m=>{
        const projCollections = collections.filter(c=>c.projectId===m.projectId);
        const removable = projCollections.length===0;
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--surface2)">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--navy)">${m.projectName}</div>
            <div style="font-size:11px;color:var(--text3)">Added ${fmtDate(m.addedAt.split('T')[0])} by ${m.addedBy} · ${projCollections.length} collection${projCollections.length!==1?'s':''} so far</div>
          </div>
          ${removable?`<button class="btn btn-sm" style="color:var(--red);border-color:var(--red)" onclick="removeGrowthPoolProject('${m.id}')">✕ Remove</button>`:`<span style="font-size:11px;color:var(--text3);font-style:italic">Has collections — can't remove</span>`}
        </div>`;
      }).join('')}
    </div>

    <div class="card">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:10px">📜 Allocation History (${allocated.length})</div>
      ${!allocated.length ? '<div style="font-size:13px;color:var(--text3);font-style:italic;padding:10px 0">Nothing allocated yet.</div>' : allocated.map(c=>`
        <div style="padding:10px 12px;border-bottom:1px solid var(--surface2)">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
            <div style="font-size:13px;font-weight:700;color:var(--navy)">${c.projectName.substring(0,55)}</div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:12px;color:var(--text3)">${fmtDate(c.collectionDate)} — Pool: ${fmt(gpPoolAmount(c))}</span>
              <button onclick="deleteGrowthPoolCollection('${c.id}')" title="Delete this allocation" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:12px">🗑️</button>
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
            ${(c.splits||[]).map(sp=>`<span style="font-size:11px;background:var(--surface2);padding:2px 8px;border-radius:10px">${sp.type==='staff'?sp.name:sp.type==='reserve'?'Reserve':'Rework'}: ${sp.pct}% (${fmt(sp.amount)})</span>`).join('')}
          </div>
        </div>`).join('')}
    </div>
  </div>`;
}

// ─── ADD PROJECT TO GROWTH POOL ────────────────────────
function openAddGrowthPoolProjectModal(){
  const existingIds = new Set((D.growthPoolProjects||[]).filter(x=>!x._archived).map(x=>x.projectId));
  const available = D.projects.filter(p=>!isArchived(p) && !existingIds.has(p.id)).sort((a,b)=>a.name.localeCompare(b.name));
  let modal = document.getElementById('modal-gp-add-project');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-gp-add-project'; document.body.appendChild(modal); }
  modal.innerHTML = `<div class="mbox" style="max-width:480px">
    <div class="mhdr"><h2>+ Add Project to Growth Pool</h2><button class="mx" onclick="CM('modal-gp-add-project')">✕</button></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">Only collections from this point forward will count — anything already received before adding won't retroactively join the pool.</div>
    <div class="fg"><label>Search Project</label>
      <input type="text" id="gp-project-search" placeholder="Type to search…" oninput="_filterGPProjectOptions()" style="margin-bottom:8px">
      <select id="gp-project-select" size="8" style="width:100%">
        ${available.map(p=>`<option value="${p.id}" data-name="${p.name.toLowerCase()}">${p.name.substring(0,70)}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn" onclick="CM('modal-gp-add-project')">Cancel</button>
      <button class="btn btn-navy" onclick="saveAddGrowthPoolProject()">+ Add to Growth Pool</button>
    </div>
  </div>`;
  modal.classList.add('open');
}
function _filterGPProjectOptions(){
  const q = document.getElementById('gp-project-search')?.value.toLowerCase()||'';
  document.querySelectorAll('#gp-project-select option').forEach(opt=>{
    opt.style.display = opt.dataset.name.includes(q) ? '' : 'none';
  });
}
async function saveAddGrowthPoolProject(){
  const sel = document.getElementById('gp-project-select');
  const pid = sel?.value;
  if(!pid){ toast('Select a project','error'); return; }
  const p = GP(pid); if(!p) return;
  if(!D.growthPoolProjects) D.growthPoolProjects=[];
  D.growthPoolProjects.push({ id:'gpp_'+uid(), projectId:pid, projectName:p.name, addedAt:new Date().toISOString(), addedBy:CU?CU.name:'Unknown' });
  try{
    await saveGrowthPoolProjects();
    CM('modal-gp-add-project');
    _renderGrowthPoolTab();
    logActivity({category:'system',action:'growth_pool_project_added',projectId:pid,projectName:p.name,description:(CU?CU.name:'Super Admin')+' added "'+p.name.substring(0,50)+'" to the Growth Pool'});
    toast('✓ Added to Growth Pool','ok');
  }catch(e){ toast('Save failed','error'); }
}
async function removeGrowthPoolProject(id){
  const m = (D.growthPoolProjects||[]).find(x=>x.id===id); if(!m) return;
  const ok = await showConfirm({title:'Remove from Growth Pool?',message:'This stops "'+m.projectName+'" from generating future Growth Pool collections. Safe to do since it has no collections recorded yet.',confirmLabel:'Yes, Remove'});
  if(!ok) return;
  m._archived = true;
  try{ await saveGrowthPoolProjects(); _renderGrowthPoolTab(); toast('✓ Removed','ok'); }
  catch(e){ delete m._archived; toast('Save failed','error'); }
}

// ─── ALLOCATE A PENDING COLLECTION ────────────────────
let _gpAllocatingId = null;
function openAllocateGrowthPoolModal(collectionId){
  const c = (D.growthPoolCollections||[]).find(x=>x.id===collectionId); if(!c) return;
  _gpAllocatingId = collectionId;
  const staffNames = (D.staffMembers||[]).map(s=>s.name);
  let modal = document.getElementById('modal-gp-allocate');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-gp-allocate'; document.body.appendChild(modal); }
  modal.innerHTML = `<div class="mbox" style="max-width:560px">
    <div class="mhdr"><h2>Split Growth Pool Allocation</h2><button class="mx" onclick="CM('modal-gp-allocate')">✕</button></div>
    <div style="background:var(--surface2);border-radius:var(--rs);padding:12px;margin-bottom:14px;font-size:13px">
      <strong>${c.projectName.substring(0,60)}</strong><br>Collected ${fmtDate(c.collectionDate)}
    </div>
    <div class="frow">
      <div class="fg"><label>Gross Amount Received (₹)</label><input type="number" id="gp-gross" value="${c.grossAmount}" oninput="_gpRecalc()"></div>
      <div class="fg"><label>GST % to Deduct</label><input type="number" step="0.1" id="gp-gst-pct" value="${c.gstPct}" oninput="_gpRecalc()"></div>
    </div>
    <div style="background:#fff8ec;border:1px solid var(--gold);border-radius:var(--rs);padding:10px 14px;margin:10px 0;font-size:13px">
      Gross <strong id="gp-disp-gross">${fmt(c.grossAmount)}</strong>
      &nbsp;−&nbsp; GST (<span id="gp-disp-gstpct">${c.gstPct}</span>%) <strong id="gp-disp-gst">${fmt(c.grossAmount*c.gstPct/100)}</strong>
      &nbsp;=&nbsp; Net <strong id="gp-disp-net" style="color:var(--navy)">${fmt(gpNetAmount(c))}</strong>
    </div>
    <div class="fg"><label>Pool Percentage (of net amount)</label>
      <input type="number" step="0.1" id="gp-pool-pct" value="${c.poolPct}" oninput="_gpRecalc()" style="width:120px">
      <span style="font-size:13px;font-weight:700;color:var(--navy);margin-left:10px">= <span id="gp-pool-total">${fmt(gpPoolAmount(c))}</span> total pool</span>
    </div>
    <div style="margin-top:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <label style="font-weight:600;font-size:13px">Split (must total 100%)</label>
        <button class="btn btn-sm" onclick="_gpAddSplitRow()">+ Add Row</button>
      </div>
      <div id="gp-split-rows"></div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
        <span style="font-size:13px;font-weight:700">Total</span>
        <span id="gp-split-total" style="font-size:13px;font-weight:800">0%</span>
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn" onclick="CM('modal-gp-allocate')">Cancel</button>
      <button class="btn btn-navy" onclick="saveGrowthPoolAllocation()">✓ Confirm Allocation</button>
    </div>
  </div>`;
  modal.classList.add('open');
  window._gpStaffNames = staffNames;
  _gpAddSplitRow(); // start with one row
}
function _gpAddSplitRow(type, name, pct){
  const wrap = document.getElementById('gp-split-rows');
  const rowId = 'gprow_'+uid();
  const staffOptions = (window._gpStaffNames||[]).map(n=>`<option value="staff:${n}" ${type==='staff'&&name===n?'selected':''}>${n}</option>`).join('');
  const div = document.createElement('div');
  div.id = rowId;
  div.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;align-items:center';
  div.innerHTML = `
    <select onchange="_gpRecalc()" style="flex:1">
      <option value="">— Select —</option>
      ${staffOptions}
      <option value="reserve" ${type==='reserve'?'selected':''}>Growth Pool Reserve</option>
      <option value="rework" ${type==='rework'?'selected':''}>Rework</option>
    </select>
    <input type="number" step="0.1" placeholder="%" value="${pct||''}" oninput="_gpRecalc()" style="width:80px">
    <span class="gp-row-amt" style="font-size:11px;color:var(--text3);width:90px;text-align:right">₹0</span>
    <button onclick="document.getElementById('${rowId}').remove();_gpRecalc()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px">✕</button>
  `;
  wrap.appendChild(div);
  _gpRecalc();
}
function _gpRecalc(){
  const gross = parseFloat(document.getElementById('gp-gross')?.value)||0;
  const gstPct = parseFloat(document.getElementById('gp-gst-pct')?.value)||0;
  const gstAmt = gross * gstPct / 100;
  const net = gross - gstAmt;
  const poolPct = parseFloat(document.getElementById('gp-pool-pct')?.value)||0;
  const poolAmt = net * poolPct / 100;

  if(document.getElementById('gp-disp-gross')) document.getElementById('gp-disp-gross').textContent = fmt(gross);
  if(document.getElementById('gp-disp-gstpct')) document.getElementById('gp-disp-gstpct').textContent = gstPct;
  if(document.getElementById('gp-disp-gst')) document.getElementById('gp-disp-gst').textContent = fmt(gstAmt);
  if(document.getElementById('gp-disp-net')) document.getElementById('gp-disp-net').textContent = fmt(net);
  document.getElementById('gp-pool-total').textContent = fmt(poolAmt);

  let total = 0;
  document.querySelectorAll('#gp-split-rows > div').forEach(row=>{
    const pct = parseFloat(row.querySelector('input').value)||0;
    total += pct;
    row.querySelector('.gp-row-amt').textContent = fmt(poolAmt*pct/100);
  });
  const totalEl = document.getElementById('gp-split-total');
  totalEl.textContent = total.toFixed(1)+'%';
  totalEl.style.color = Math.abs(total-100)<0.01 ? 'var(--green)' : 'var(--red)';
}
async function saveGrowthPoolAllocation(){
  const c = (D.growthPoolCollections||[]).find(x=>x.id===_gpAllocatingId); if(!c) return;
  const gross = parseFloat(document.getElementById('gp-gross')?.value)||0;
  const gstPct = parseFloat(document.getElementById('gp-gst-pct')?.value)||0;
  const net = gross * (1 - gstPct/100);
  const poolPct = parseFloat(document.getElementById('gp-pool-pct')?.value)||0;
  const poolAmt = net * poolPct / 100;
  const rows = document.querySelectorAll('#gp-split-rows > div');
  let total = 0;
  const splits = [];
  for(const row of rows){
    const sel = row.querySelector('select').value;
    const pct = parseFloat(row.querySelector('input').value)||0;
    if(!sel || pct<=0) continue;
    total += pct;
    if(sel.startsWith('staff:')){
      splits.push({type:'staff', name:sel.substring(6), pct, amount: poolAmt*pct/100});
    } else {
      splits.push({type:sel, pct, amount: poolAmt*pct/100});
    }
  }
  if(Math.abs(total-100)>0.01){ toast('Split must total exactly 100% (currently '+total.toFixed(1)+'%)','error'); return; }
  if(!splits.length){ toast('Add at least one split row','error'); return; }

  c.grossAmount = gross;
  c.gstPct = gstPct;
  c.poolPct = poolPct;
  c.splits = splits;
  c.status = 'allocated';
  c.allocatedAt = new Date().toISOString();
  c.allocatedBy = CU?CU.name:'Unknown';
  try{
    await saveGrowthPoolCollections();
    logActivity({category:'system',action:'growth_pool_allocated',projectId:c.projectId,projectName:c.projectName,
      description:(CU?CU.name:'Super Admin')+' allocated Growth Pool for "'+c.projectName.substring(0,40)+'" — '+fmt(poolAmt)+' split '+splits.length+' ways'});
    CM('modal-gp-allocate');
    _renderGrowthPoolTab();
    toast('✓ Allocation confirmed','ok');
  }catch(e){ toast('Save failed','error'); }
}
