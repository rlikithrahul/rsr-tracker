// ═══════════════════════════════════════════════════════
// softdelete.js — RSR Constructions Tracker
// Soft delete system with 7-day recovery bin
// Every delete is reversible for 7 days by Super Admin
// ═══════════════════════════════════════════════════════

// ─── CUSTOM CONFIRM DIALOG ────────────────────────────
// Replaces browser confirm() with premium in-app dialog
function showConfirm(options){
  return new Promise(resolve=>{
    const {title='Are you sure?', message='', confirmLabel='Delete', cancelLabel='Cancel', danger=true} = options;

    let overlay = document.getElementById('confirm-overlay');
    if(!overlay){
      overlay = document.createElement('div');
      overlay.id = 'confirm-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `<div style="background:#fff;border-radius:14px;padding:24px;max-width:360px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.2);animation:slideUp .2s ease-out">
      <div style="font-size:18px;font-weight:800;color:${danger?'var(--red)':'var(--navy)'};margin-bottom:10px">${title}</div>
      <div style="font-size:14px;color:var(--text2);line-height:1.5;margin-bottom:20px">${message}</div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button id="confirm-cancel" style="padding:10px 20px;border:1.5px solid var(--border);border-radius:var(--rs);background:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;color:var(--text2)">${cancelLabel}</button>
        <button id="confirm-ok" style="padding:10px 20px;border:none;border-radius:var(--rs);background:${danger?'var(--red)':'var(--navy)'};color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">${confirmLabel}</button>
      </div>
    </div>`;

    overlay.style.display = 'flex';

    const ok = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');

    const cleanup = (result)=>{
      overlay.style.display = 'none';
      if(typeof haptic==='function') haptic(result?'medium':'light');
      resolve(result);
    };

    ok.onclick = ()=>cleanup(true);
    cancel.onclick = ()=>cleanup(false);
    overlay.onclick = e=>{ if(e.target===overlay) cleanup(false); };
    ok.focus();
  });
}

// ─── SOFT DELETE HELPERS ──────────────────────────────
// NOTE: this bin used to live in localStorage only, which meant a delete
// made on one device/browser was invisible everywhere else — including to
// Super Admin checking Settings from a different device — and vanished
// completely if that browser's data was ever cleared. The whole point of a
// "7-day recovery bin" is that it's reliably there when someone needs it,
// so this now lives in Supabase like everything else that matters.
const DELETED_BIN_KEY = 'rsr_deleted_bin_v1';

async function saveToBin(type, data, projectId, projectName){
  try{
    const bin = await getSetting(DELETED_BIN_KEY, []);
    bin.unshift({
      id: (typeof uid==='function'?uid():Date.now().toString(36)),
      type, data, projectId, projectName,
      deletedAt: new Date().toISOString(),
      deletedBy: (typeof CU!=='undefined'&&CU)?CU.name:'Unknown',
      expiresAt: new Date(Date.now()+7*86400000).toISOString()
    });
    // Keep only items not expired
    const valid = bin.filter(b=>new Date(b.expiresAt)>new Date());
    await saveSetting(DELETED_BIN_KEY, valid.slice(0,200));
  }catch(e){}
}

async function getDeletedBin(){
  try{
    const bin = await getSetting(DELETED_BIN_KEY, []);
    return bin.filter(b=>new Date(b.expiresAt)>new Date());
  }catch(e){ return []; }
}

async function removeFromBin(id){
  try{
    const bin = (await getDeletedBin()).filter(b=>b.id!==id);
    await saveSetting(DELETED_BIN_KEY, bin);
  }catch(e){}
}

// ─── DELETED ITEMS PANEL (in Settings) ───────────────
async function renderDeletedBin(){
  const bin = await getDeletedBin();
  const el = document.getElementById('deleted-bin-wrap');
  if(!el) return;

  if(!bin.length){
    el.innerHTML='<div style="font-size:13px;color:var(--text3);padding:12px 0;text-align:center">No deleted items in the last 7 days.</div>';
    return;
  }

  const typeLabels = {
    'labour_entry':'👷 Labour Entry',
    'material_entry':'🧱 Material Entry',
    'expense_entry':'💸 Expense Entry',
    'site_document':'📄 Site Document',
    'project':'🏗️ Project',
    'fund_release':'💰 Fund Release',
    'settlement':'🏦 Settlement',
    'personal_project':'📁 Other Project',
    'work_progress':'📸 Progress Update'
  };

  el.innerHTML = bin.map(b=>{
    const daysLeft = Math.ceil((new Date(b.expiresAt)-new Date())/86400000);
    const label = typeLabels[b.type]||b.type;
    const name = b.data?.name||b.data?.date||b.data?.materialName||b.data?.supplierName||'Item';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:var(--rs);margin-bottom:8px;flex-wrap:wrap;gap:8px">
      <div style="flex:1">
        <div style="font-size:12px;font-weight:700;color:var(--navy)">${label}: ${name}</div>
        <div style="font-size:11px;color:var(--text3)">${b.projectName||''} · Deleted by ${b.deletedBy} · ${daysLeft}d left to restore</div>
      </div>
      <button onclick="restoreDeletedItem('${b.id}')" style="background:var(--green);color:#fff;border:none;border-radius:var(--rs);padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;white-space:nowrap">↩ Restore</button>
    </div>`;
  }).join('');
}

async function restoreDeletedItem(binId){
  const bin = await getDeletedBin();
  const item = bin.find(b=>b.id===binId);
  if(!item){ toast('Item not found or expired','error'); return; }

  // personal_project: restore at contractor level (no GP lookup needed)
  if(item.type==='personal_project'){
    const c = D.contractors.find(x=>(x.personalProjects||[]).some(pp=>pp.id===item.data.id));
    if(!c){ toast('Contractor not found','error'); return; }
    const pp = c.personalProjects.find(x=>x.id===item.data.id);
    if(pp) delete pp._archived;
    await saveContractorDB(c);
    await removeFromBin(binId);
    await renderDeletedBin();
    toast('✓ Project restored successfully','ok');
    return;
  }

  const p = await GPFull(item.projectId);
  if(!p){ toast('Project not found','error'); return; }

  try{
    if(item.type==='labour_entry'){
      if(!D.labourData) D.labourData={};
      if(!D.labourData[item.projectId]) D.labourData[item.projectId]={};
      D.labourData[item.projectId][item.data.date] = item.data.entry;
      await saveLabourData();
    } else if(item.type==='material_entry'){
      if(!p.materialRegister) p.materialRegister=[];
      const existing = p.materialRegister.find(e=>e.id===item.data.id);
      if(existing) delete existing._archived;
      else p.materialRegister.push(item.data);
      await saveProjectDB(p);
    } else if(item.type==='expense_entry'){
      if(!D.expenseData) D.expenseData={};
      if(!D.expenseData[item.projectId]) D.expenseData[item.projectId]=[];
      const existingExp = D.expenseData[item.projectId].find(e=>e.id===item.data.id);
      if(existingExp) delete existingExp._archived;
      else D.expenseData[item.projectId].push(item.data);
      await saveExpenseData();
    } else if(item.type==='site_document'){
      if(!p.siteDocuments) p.siteDocuments=[];
      const existing = p.siteDocuments.find(d=>d.id===item.data.id);
      if(existing) delete existing._archived;
      else p.siteDocuments.push(item.data);
      await saveProjectDB(p);
    } else if(item.type==='work_progress'){
      if(!p.workProgress) p.workProgress=[];
      const existing = p.workProgress.find(w=>w.id===item.data.id);
      if(existing) delete existing._archived;
      else p.workProgress.push(item.data);
      await saveProjectDB(p);
    } else if(item.type==='wex_entry'){
      await loadWEXData();
      const existing = (D.wexData.records||[]).find(r=>r.id===item.data.id);
      if(existing){ delete existing._archived; delete existing._archivedAt; }
      else D.wexData.records.push(item.data);
      await saveWEXData();
    }
    await removeFromBin(binId);
    await renderDeletedBin();
    toast('✓ Item restored successfully','ok');
    if(typeof haptic==='function') haptic('success');
  }catch(e){ toast('Restore failed — try again','error'); }
}
