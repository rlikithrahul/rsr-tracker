// ─── WORK TYPE SYSTEM ────────────────────────────────
// Multi-select work types with persistent custom types

const BASE_WORK_TYPES = [
  'Road','Building','Drain','SW DRAIN','Culvert','Bridge',
  'Retaining Wall','False Ceiling','Compound Wall','Community Hall',
  'Electrical','Plumbing','Central Median','Bailing Water','Other'
];

function getAllWorkTypes(){
  const custom = D.customWorkTypes||[];
  return [...new Set([...BASE_WORK_TYPES, ...custom])];
}

async function saveCustomWorkTypes(){
  await saveSetting('custom_work_types', D.customWorkTypes||[]);
}

async function loadCustomWorkTypes(){
  if(D.customWorkTypes) return D.customWorkTypes;
  D.customWorkTypes = await getSetting('custom_work_types', []);
  return D.customWorkTypes;
}

async function removeCustomWorkType(idx){
  if(!D.customWorkTypes||!D.customWorkTypes[idx]) return;
  const t=D.customWorkTypes[idx];
  if(!confirm(`Remove "${t}" from the work type list?\n(Projects already using this type keep it — it just won't be offered for new selections.)`)) return;
  D.customWorkTypes.splice(idx,1);
  await saveCustomWorkTypes();
  const el=document.getElementById('worktypes-settings-list');
  if(el) el.innerHTML=_renderWorkTypesSettingsList();
}

async function addCustomWorkTypeFromSettings(){
  const inp=document.getElementById('new-worktype-input');
  if(!inp) return;
  const val=inp.value.trim();
  if(!val){ toast('Enter a work type name','error'); return; }
  if(!D.customWorkTypes) D.customWorkTypes=[];
  if(D.customWorkTypes.includes(val) || BASE_WORK_TYPES.includes(val)){
    toast('That work type already exists','error'); return;
  }
  D.customWorkTypes.push(val);
  try{
    await saveCustomWorkTypes();
    inp.value='';
    const el=document.getElementById('worktypes-settings-list');
    if(el) el.innerHTML=_renderWorkTypesSettingsList();
    toast(`✓ "${val}" added — available for every project now`,'ok');
  }catch(e){
    // Roll back the local addition — it did NOT actually save, so the UI
    // must not pretend it did. Silently keeping a local-only value here is
    // exactly the kind of "looks saved but isn't" situation we must never
    // allow again.
    D.customWorkTypes = D.customWorkTypes.filter(t=>t!==val);
    const el=document.getElementById('worktypes-settings-list');
    if(el) el.innerHTML=_renderWorkTypesSettingsList();
    alert('⚠️ "'+val+'" was NOT saved.\n\n'+(e.message||'Unknown error')+'\n\nThis has not been added — please try again, and if it keeps failing, tell Likith\'s developer immediately (this means the database is silently rejecting saves).');
  }
}

function _renderWorkTypesSettingsList(){
  const custom=D.customWorkTypes||[];
  return `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
      ${BASE_WORK_TYPES.map(t=>`<span style="padding:4px 12px;border-radius:16px;font-size:12px;font-weight:600;background:var(--surface2);color:var(--text2)">${t}</span>`).join('')}
    </div>
    ${custom.length?`<div style="font-size:11px;color:var(--text3);margin-bottom:6px">Custom types (added by you):</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${custom.map((t,i)=>`<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 6px 4px 12px;border-radius:16px;font-size:12px;font-weight:600;background:var(--navy);color:#fff">
        ${t}
        <button onclick="removeCustomWorkType(${i})" style="background:none;border:none;color:#fff;cursor:pointer;font-size:13px;line-height:1;padding:2px 4px" title="Remove">✕</button>
      </span>`).join('')}
    </div>`:'<div style="font-size:12px;color:var(--text3);font-style:italic">No custom work types added yet.</div>'}`;
}

// Render multi-select type chips widget
function renderTypeChips(containerId, selectedTypes){
  const sel = Array.isArray(selectedTypes) ? selectedTypes : (selectedTypes ? [selectedTypes] : []);
  const all = getAllWorkTypes();
  const el = document.getElementById(containerId);
  if(!el) return;

  el.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px" id="'+containerId+'-chips">'
    +all.map(t=>{
      const isSel = sel.includes(t);
      return '<button type="button" onclick="toggleTypeChip(\''+containerId+'\',\''+t+'\')" '
        +'id="chip-'+containerId+'-'+t.replace(/\s/g,'_')+'" '
        +(isSel?'data-sel="1" ':'')
        +'style="padding:4px 12px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif;border:1.5px solid '
        +(isSel?'var(--navy)':'var(--border)')+';background:'
        +(isSel?'var(--navy)':'#fff')+';color:'
        +(isSel?'#fff':'var(--text2)')+';transition:all .15s">'+t+'</button>';
    }).join('')
    +'</div>'
    +'<div style="display:flex;gap:8px;align-items:center">'
    +'<input type="text" id="'+containerId+'-custom-input" placeholder="+ Add custom type" '
    +'style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px;font-family:\'Inter\',sans-serif;flex:1" '
    +'onkeydown="if(event.key===\'Enter\'){event.preventDefault();addCustomTypeChip(\''+containerId+'\')}">'
    +'<button type="button" onclick="addCustomTypeChip(\''+containerId+'\')" '
    +'style="padding:6px 12px;background:var(--navy);color:#fff;border:none;border-radius:var(--rs);font-size:12px;font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif">+ Add</button>'
    +'</div>'
    +'<div id="'+containerId+'-selected" style="font-size:11px;color:var(--text3);margin-top:6px">'
    +(sel.length?'Selected: '+sel.join(', '):'No types selected')+'</div>';
}

function toggleTypeChip(containerId, type){
  const chipsEl = document.getElementById(containerId+'-chips');
  if(!chipsEl) return;
  const btn = document.getElementById('chip-'+containerId+'-'+type.replace(/\s/g,'_'));
  if(!btn) return;
  const isSelected = btn.style.background === 'var(--navy)' || btn.getAttribute('data-sel')==='1';
  if(isSelected){
    btn.style.background='#fff'; btn.style.color='var(--text2)'; btn.style.borderColor='var(--border)';
    btn.removeAttribute('data-sel');
  } else {
    btn.style.background='var(--navy)'; btn.style.color='#fff'; btn.style.borderColor='var(--navy)';
    btn.setAttribute('data-sel','1');
  }
  // Update selected label
  const selected = getSelectedTypes(containerId);
  const selEl = document.getElementById(containerId+'-selected');
  if(selEl) selEl.textContent = selected.length ? 'Selected: '+selected.join(', ') : 'No types selected';
}

async function addCustomTypeChip(containerId){
  const inp = document.getElementById(containerId+'-custom-input');
  if(!inp) return;
  const val = inp.value.trim();
  if(!val) return;
  // Add to global custom types if not already there
  if(!D.customWorkTypes) D.customWorkTypes=[];
  if(!D.customWorkTypes.includes(val) && !BASE_WORK_TYPES.includes(val)){
    D.customWorkTypes.push(val);
    try{
      await saveCustomWorkTypes();
    }catch(e){
      // Roll back — it did NOT actually save globally. It can still be
      // selected on THIS project below (harmless), but we must not let
      // the person believe it's now a permanent, reusable work type when
      // it isn't — that silent gap is exactly what caused it to vanish
      // after logout before.
      D.customWorkTypes = D.customWorkTypes.filter(t=>t!==val);
      alert('⚠️ "'+val+'" could not be saved as a reusable work type ('+(e.message||'unknown error')+').\n\nIt will still apply to this project right now, but won\'t be available for other projects until this is fixed — please try again, and report this if it keeps happening.');
    }
  }
  // Re-render with new type selected
  const current = getSelectedTypes(containerId);
  current.push(val);
  renderTypeChips(containerId, current);
  // Re-select the newly added chip
  setTimeout(()=>{
    const btn = document.getElementById('chip-'+containerId+'-'+val.replace(/\s/g,'_'));
    if(btn){ btn.style.background='var(--navy)'; btn.style.color='#fff'; btn.style.borderColor='var(--navy)'; btn.setAttribute('data-sel','1'); }
    const selEl = document.getElementById(containerId+'-selected');
    const sel = getSelectedTypes(containerId);
    if(selEl) selEl.textContent = sel.length ? 'Selected: '+sel.join(', ') : 'No types selected';
  }, 50);
}

function getSelectedTypes(containerId){
  const chipsEl = document.getElementById(containerId+'-chips');
  if(!chipsEl) return [];
  return Array.from(chipsEl.querySelectorAll('[data-sel="1"]')).map(b=>b.textContent.trim());
}

// Legacy compat
function handleCustomType(selectId, inputId){}
function getSelectedType(selectId, inputId){ return getSelectedTypes(selectId).join(', ')||'Other'; }
function setTypeDropdown(selectId, inputId, value){}


// ═══════════════════════════════════════
// project_ops.js
// RSR Constructions Tracker v17
// ═══════════════════════════════════════

// ═══════════════════════════════════════════════════════
// NEW PROJECT
// ═══════════════════════════════════════════════════════
function initNP(){
  bqc=0;
  boqPreviewItems=[];
  window._boqFile=null; window._boqFileName=null;
  const sel=document.getElementById('np-cont');
  if(sel) sel.innerHTML=D.contractors.length?D.contractors.map(c=>`<option value="${c.id}">${c.name}</option>`).join(''):'<option value="">— Add contractors first —</option>';
  document.getElementById('np-calc')?.classList.add('hidden');
  ['np-name','np-tender','np-loc','np-est','np-bid','np-cc'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const dateEl=document.getElementById('np-date');
  if(dateEl) dateEl.value=new Date().toISOString().split('T')[0];
  // Render type chips (empty selection)
  renderTypeChips('np-type-chips', []);
  // Render BOQ upload section
  const uploadSection=document.getElementById('boq-upload-section');
  if(uploadSection) uploadSection.innerHTML=renderBOQUploadSection();
}

function calcAgree(){
  const est=parseFloat(document.getElementById('np-est').value)||0;
  const bid=parseFloat(document.getElementById('np-bid').value)||0;
  if(!est){document.getElementById('np-calc').classList.add('hidden');return;}
  document.getElementById('np-agree').textContent=fmt(est*(1+bid/100));
  document.getElementById('np-max').textContent=fmt(est*(1+bid/100)*0.7);
  document.getElementById('np-calc').classList.remove('hidden');
}

function addBOQRow(){
  bqc++;
  const id='b'+bqc;
  const row=document.createElement('div');
  row.className='brow'; row.id='br-'+id;
  row.innerHTML=`<input type="text" id="bd-${id}" placeholder="Item description"><input type="text" id="bu-${id}" placeholder="Unit" value="Cum"><input type="number" id="bq-${id}" placeholder="Qty" step="0.1"><input type="number" id="brate-${id}" placeholder="Rate ₹" step="0.01"><button type="button" class="bdel" onclick="document.getElementById('br-${id}').remove()">✕</button>`;
  document.getElementById('np-boq').appendChild(row);
}

async function saveProject(){
  const name=document.getElementById('np-name').value.trim();
  const tender=document.getElementById('np-tender').value.trim();
  const est=parseFloat(document.getElementById('np-est').value)||0;
  const loc=document.getElementById('np-loc').value.trim();
  const cc=document.getElementById('np-cc').value.trim();
  const contractorId=document.getElementById('np-cont').value;

  // All fields mandatory
  if(!name){toast('Project name is required','error');document.getElementById('np-name').focus();return;}
  if(!tender){toast('Tender ID is required','error');document.getElementById('np-tender').focus();return;}
  // Duplicate tender ID check
  const dupTender = D.projects.find(p=>!isArchived(p)&&(p.tender||'').trim().toLowerCase()===tender.toLowerCase());
  if(dupTender){ toast(`⚠️ Tender ID "${tender}" already exists — "${dupTender.name}". Check before saving.`,'error',6000); return; }
  if(!est){toast('Estimated BOQ value is required','error');document.getElementById('np-est').focus();return;}
  if(!loc){toast('Location is required','error');document.getElementById('np-loc').focus();return;}
  if(!cc){toast('Tally Cost Centre name is required','error');document.getElementById('np-cc').focus();return;}
  if(!contractorId){toast('Please select a contractor','error');return;}
  // Agreement date is OPTIONAL — can be added later

  // Get BOQ from the upload/preview system
  const boq=getBOQForSave();
  if(!boq.length){toast('Add at least one BOQ item. Upload Excel or add manually.','error');return;}

  const proj={
    id:uid(), name, tender,
    firm:document.getElementById('np-firm').value||'RSR Constructions',
    type:getSelectedTypes('np-type-chips').join(', ')||'Other',
    types:getSelectedTypes('np-type-chips'),
    contractorId, estimated:est,
    bidPct:parseFloat(document.getElementById('np-bid').value)||0,
    agreeDate:document.getElementById('np-date').value,
    location:loc,
    costCentre:cc.toUpperCase(),
    boq, verifications:[], releases:[], contractorUpdates:[],
    createdAt:new Date().toISOString()
  };

  D.projects.push(proj);
  try {
    await saveProjectDB(proj);
    // If BOQ file was uploaded, store it in document vault
    if(window._boqFile && window._boqFileName){
      setBusy(true,'Uploading BOQ file…');
      try {
        const url = await uploadDocument(window._boqFile, proj.id, 'boq');
        if(!proj.documents) proj.documents={};
        proj.documents['boq']={url, name:window._boqFileName, uploadedAt:new Date().toISOString(), uploadedBy:CU.name};
        await saveProjectDB(proj);
        window._boqFile=null; window._boqFileName=null;
      } catch(e){ console.warn('BOQ file upload failed:', e); }
      setBusy(false);
    }
    CM('modal-np');
    logActivity({category:'project',action:'create',projectId:proj.id,projectName:proj.name,
      description:(CU?CU.name:'User')+' created project: '+proj.name+' ('+proj.tender+')',
      meta:{firm:proj.firm,contractor:GC(proj.contractorId)?.name||'',boqItems:boq.length}});
    toast('✓ Project created with '+boq.length+' BOQ items','ok');
    writeActivityLog('project_create', `Project created: ${proj.name}`, proj.id).catch(()=>{});
    ownerTab(0);
  } catch(e){ setBusy(false); toast('Save failed: '+e.message,'error'); }
}

// ═══════════════════════════════════════════════════════
// CHANGE PASSWORD
// ═══════════════════════════════════════════════════════
async function changePw(){
  const cur=document.getElementById('pw-cur').value;
  const nw=document.getElementById('pw-new').value;
  const conf=document.getElementById('pw-conf').value;
  const err=document.getElementById('pw-err');
  if(cur!==D.ownerPw){err.textContent='Current password incorrect.';err.style.display='block';return;}
  if(nw.length<6){err.textContent='Min 6 characters.';err.style.display='block';return;}
  if(nw!==conf){err.textContent='Passwords do not match.';err.style.display='block';return;}
  D.ownerPw=nw;
  try {
    await savePwDB(nw);
    CM('modal-pw');
    ['pw-cur','pw-new','pw-conf'].forEach(id=>document.getElementById(id).value='');
    err.style.display='none';
    toast('✓ Password updated','ok');
  } catch(e){ toast('Save failed','error'); }
}

// ═══════════════════════════════════════════════════════
// ACTION MENU (3-dot) helpers
// ═══════════════════════════════════════════════════════
function toggleMenu(id){
  // close all other menus first
  document.querySelectorAll('.amenu.open').forEach(m=>{ if(m.id!==id) m.classList.remove('open'); });
  document.getElementById(id)?.classList.toggle('open');
}
// Close menus on outside click
document.addEventListener('click', e=>{
  if(!e.target.closest('.amenu-wrap')) document.querySelectorAll('.amenu.open').forEach(m=>m.classList.remove('open'));
});

// ═══════════════════════════════════════════════════════
// ALERT HELPERS (for dashboard)
// ═══════════════════════════════════════════════════════
function daysSince(dateStr){
  if(!dateStr) return 9999;
  return Math.floor((Date.now()-new Date(dateStr).getTime())/86400000);
}
function getProjectAlerts(p){
  const alerts=[];
  const rel=totRel(p), max=maxF(p);
  const lv=(p.verifications||[]).slice(-1)[0];
  const lu=(p.contractorUpdates||[]).slice(-1)[0];
  const lastUpdDate = lu ? lu.date : p.createdAt?.split('T')[0];
  const lastVerDate = lv ? lv.date : null;
  const daysSinceUpd = daysSince(lastUpdDate);
  const daysSinceVer = daysSince(lastVerDate);
  const capPct = max>0 ? rel/max*100 : 0;

  if(rel>=max*0.97) alerts.push({type:'red',msg:'🔴 Hard Stop — 70% cap reached. No more releases.'});
  else if(capPct>=65) alerts.push({type:'red',msg:`🚨 ${Math.round(capPct)}% of cap used — approaching limit.`});
  if(daysSinceUpd>=5 && p.contractorUpdates?.length>0) alerts.push({type:'amber',msg:`⏰ No site update for ${daysSinceUpd} days.`});
  else if(!p.contractorUpdates?.length) alerts.push({type:'navy',msg:'📋 No site updates submitted yet.'});
  if(daysSinceVer>=7 && lastVerDate) alerts.push({type:'amber',msg:`🔍 No site verification for ${daysSinceVer} days.`});
  const pend=(p.contractorUpdates||[]).filter(u=>!u.reviewed).length;
  if(pend>0) alerts.push({type:'navy',msg:`📸 ${pend} update${pend>1?'s':''} waiting for your review.`});
  return alerts;
}

// ═══════════════════════════════════════════════════════
// DELETE / EDIT — PROJECTS
// ═══════════════════════════════════════════════════════
async function deleteProject(pid){
  if(!confirm('Archive this project? It will be hidden from dashboard but all data is preserved. You can restore it from the Archive section.')) return;
  const p=GP(pid); if(!p) return;
  p._archived=true;
  p._archivedAt=new Date().toISOString();
  try{
    await saveProjectDB(p);
    // Safely close any open modals without crashing
    document.querySelectorAll('.mov.open').forEach(m=>m.classList.remove('open'));
    dpid=null;
    ownerTab(0);
    logActivity({category:'project',action:'archive',projectId:pid,projectName:p.name,
      description:(CU?CU.name:'User')+' archived project: '+p.name});
    toast('✓ Project archived — restore it anytime from Archive','ok');
  }catch(e){ toast('Archive failed: '+e.message,'error'); }
}

async function permanentDeleteProject(pid){
  const p=GP(pid); if(!p) return;
  if(!confirm(`PERMANENT DELETE: "${p.name}"\n\nThis removes ALL data — releases, updates, photos, verifications. This CANNOT be undone.\n\nType DELETE to confirm.`)) return;
  try{
    await sbReq(`projects?id=eq.${pid}`,'DELETE');
    D.projects=D.projects.filter(x=>x.id!==pid);
    document.querySelectorAll('.mov.open').forEach(m=>m.classList.remove('open'));
    dpid=null;
    const stillArchived=D.projects.filter(p=>isArchived(p));
    if(stillArchived.length) setTimeout(renderArchive,300);
    else ownerTab(0);
    toast('Project permanently deleted','ok');
  }catch(e){ toast('Delete failed: '+e.message,'error'); }
}

// ═══════════════════════════════════════════════════════
// DELETE / EDIT — CONTRACTORS
// ═══════════════════════════════════════════════════════
async function deleteContractor(cid){
  const inUse = D.projects.some(p=>p.contractorId===cid);
  if(inUse){ alert('Cannot delete — this contractor has projects assigned. Delete the projects first.'); return; }
  if(!confirm('Delete this contractor? This cannot be undone.')) return;
  try {
    await sbReq(`contractors?id=eq.${cid}`, 'DELETE');
    D.contractors = D.contractors.filter(c=>c.id!==cid);
    const profileEl = document.getElementById('cont-profile');
    if(profileEl) profileEl.classList.add('hidden');
    const listEl = document.getElementById('cont-list');
    if(listEl) listEl.classList.remove('hidden');
    renderConts();
    toast('Contractor deleted','ok');
  } catch(e){ toast('Delete failed: '+e.message,'error'); }
}

// ═══════════════════════════════════════════════════════
// DELETE / EDIT — FUND RELEASES
// ═══════════════════════════════════════════════════════
async function openEditRelease(pid, rid){
  const p=await GPFull(pid); if(!p) return;
  const r=(p.releases||[]).find(x=>x.id===rid); if(!r) return;
  editReleasePid=pid; editReleaseId=rid;
  document.getElementById('er-amt').value=r.amount;
  document.getElementById('er-date').value=r.date;
  document.getElementById('er-meth').value=r.method||'NEFT';
  document.getElementById('er-ref').value=r.ref||'';
  document.getElementById('er-notes').value=r.notes||'';
  // Show/hide Tally warning banner
  const tallyBanner = document.getElementById('er-tally-warning');
  if(tallyBanner) tallyBanner.style.display = (r.source==='tally'||r.source==='tally-manual') ? 'block' : 'none';
  document.getElementById('modal-edit-release').classList.add('open');
}
async function saveEditRelease(){
  const p=await GPFull(editReleasePid); if(!p) return;
  const r=(p.releases||[]).find(x=>x.id===editReleaseId); if(!r) return;
  const newAmt=parseFloat(document.getElementById('er-amt').value);
  if(!newAmt||newAmt<=0){alert('Enter a valid amount');return;}
  const newDate=document.getElementById('er-date').value;
  if(r.txType!=='receipt'){
    const dup=checkDuplicateRelease(p,newAmt,newDate,editReleaseId);
    if(dup && !confirm(`⚠️ Similar transaction of ${fmt(dup.amount)} exists on ${dup.date}. Save anyway?`)) return;
  }
  r.amount=newAmt;
  r.date=document.getElementById('er-date').value;
  r.method=document.getElementById('er-meth').value;
  r.ref=document.getElementById('er-ref').value;
  r.notes=document.getElementById('er-notes').value;
  try {
    await saveProjectDB(p);
    CM('modal-edit-release');
    renderDetail(editReleasePid);
    toast('Release updated','ok');
  } catch(e){ toast('Save failed','error'); }
}
async function deleteRelease(pid, rid){
  if(!confirm('Archive this transaction? Data is preserved and recoverable.')) return;
  const p=await GPFull(pid); if(!p) return;
  const r=(p.releases||[]).find(x=>x.id===rid);
  if(r){ r._archived=true; r._archivedAt=new Date().toISOString(); }
  try{ await saveProjectDB(p); renderDetail(pid); toast('✓ Transaction archived','ok'); }
  catch(e){ toast('Archive failed','error'); }
}

// ─── TRANSFER A TRANSACTION TO A DIFFERENT PROJECT ────
// Super Admin only — moves a fund release entry from one project to
// another entirely (not a copy). Useful when a Tally transaction got
// matched to the wrong project by cost centre and needs correcting.
let _transferPid=null, _transferRid=null;
async function openTransferRelease(pid, rid){
  if(!CU || !CU.isSuperAdmin){ toast('Only Super Admin can transfer transactions','error'); return; }
  const p=await GPFull(pid); if(!p) return;
  const r=(p.releases||[]).find(x=>x.id===rid); if(!r) return;
  _transferPid=pid; _transferRid=rid;
  const otherProjects = D.projects.filter(x=>!isArchived(x) && x.id!==pid).sort((a,b)=>a.name.localeCompare(b.name));
  let modal = document.getElementById('modal-transfer-release');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-transfer-release'; document.body.appendChild(modal); }
  modal.innerHTML = `<div class="mbox" style="max-width:520px">
    <div class="mhdr"><h2>↔️ Transfer Transaction</h2><button class="mx" onclick="CM('modal-transfer-release')">✕</button></div>
    <div style="background:var(--surface2);border-radius:var(--rs);padding:12px;margin-bottom:14px;font-size:13px">
      <strong>${fmt(r.amount)}</strong> on ${fmtDate(r.date)} — Vch #${r.ref||'—'} — ${r.notes||'(no notes)'}<br>
      <span style="color:var(--text3);font-size:11px">Currently on: ${p.name.substring(0,60)}</span>
    </div>
    <div class="fg"><label>Move to Project</label>
      <select id="transfer-target-pid" style="width:100%">
        <option value="">— Select target project —</option>
        ${otherProjects.map(x=>`<option value="${x.id}">${x.name.substring(0,70)} (${(GC(x.contractorId)||{}).name||'—'})</option>`).join('')}
      </select>
    </div>
    <div style="font-size:12px;color:var(--amber);margin-top:8px">⚠️ This moves the transaction entirely — it will no longer appear on the current project's Fund Releases once transferred.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn" onclick="CM('modal-transfer-release')">Cancel</button>
      <button class="btn btn-navy" onclick="saveTransferRelease()">↔️ Transfer</button>
    </div>
  </div>`;
  modal.classList.add('open');
}
async function saveTransferRelease(){
  const targetPid = document.getElementById('transfer-target-pid')?.value;
  if(!targetPid){ toast('Select a target project','error'); return; }
  const sourceP = await GPFull(_transferPid); if(!sourceP) return;
  const idx = (sourceP.releases||[]).findIndex(x=>x.id===_transferRid);
  if(idx<0){ toast('Transaction not found','error'); return; }
  const [release] = sourceP.releases.splice(idx,1);
  const targetP = await GPFull(targetPid); if(!targetP){ toast('Target project not found','error'); return; }
  if(!targetP.releases) targetP.releases=[];
  targetP.releases.push(release);
  try{
    await saveProjectDB(sourceP);
    await saveProjectDB(targetP);
    logActivity({category:'project',action:'transaction_transferred',projectId:targetPid,projectName:targetP.name,
      description:(CU?CU.name:'Super Admin')+' transferred a '+fmt(release.amount)+' transaction (Vch #'+(release.ref||'—')+') from "'+sourceP.name.substring(0,40)+'" to "'+targetP.name.substring(0,40)+'"'});
    CM('modal-transfer-release');
    renderDetail(_transferPid);
    toast('✓ Transaction transferred to '+targetP.name.substring(0,40),'ok');
  }catch(e){
    // Best-effort rollback if the target save failed after removing from source
    sourceP.releases.splice(idx,0,release);
    toast('Transfer failed — try again','error');
  }
}

// ═══════════════════════════════════════════════════════
// DELETE / EDIT — VERIFICATIONS
// ═══════════════════════════════════════════════════════
async function deleteVerification(pid, vid){
  if(!confirm('Archive this verification? Data is preserved.')) return;
  const p=GP(pid); if(!p) return;
  const v=(p.verifications||[]).find(x=>x.id===vid);
  if(v){ v._archived=true; v._archivedAt=new Date().toISOString(); }
  try{ await saveProjectDB(p); renderDetail(pid); toast('✓ Verification archived','ok'); }
  catch(e){ toast('Archive failed','error'); }
}

// ═══════════════════════════════════════════════════════
// REVIEW UPDATE — Approve with editable quantities, or Reject
// ═══════════════════════════════════════════════════════
function openReviewUpd(pid, uid_val){
  const p=GP(pid); if(!p) return;
  const u=(p.contractorUpdates||[]).find(x=>x.id===uid_val); if(!u) return;
  reviewUpdPid=pid; reviewUpdId=uid_val;
  let html='';

  // Show contractor's photos for this update first
  if(u.photos && u.photos.length){
    html += `<div style="margin-bottom:14px">
      <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">📸 Site Photos (${u.photos.length})</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${u.photos.map(ph=>`<img src="${ph.url}" style="width:90px;height:90px;object-fit:cover;border-radius:var(--rs);cursor:pointer;border:1px solid var(--border)" onclick="lightbox('${ph.url}')">`).join('')}
      </div>
    </div>`;
  } else {
    html += `<div style="font-size:12px;color:var(--text3);margin-bottom:14px;padding:8px 12px;background:var(--surface2);border-radius:var(--rs)">⚠️ No photos attached to this update.</div>`;
  }

  if(u.notes){
    html += `<div style="font-size:13px;color:var(--text2);margin-bottom:14px;padding:8px 12px;background:var(--surface2);border-radius:var(--rs)"><strong>Contractor's note:</strong> ${u.notes}</div>`;
  }

  (p.boq||[]).forEach(item=>{
    const claimed=u.quantities?.[item.id]||0;
    const existing=(p.reportedItems||{})[item.id]||0;
    html+=`<div class="vrow">
      <div class="vdesc"><strong>${item.desc}</strong>
        <div style="font-size:11px;color:var(--text3)">Contractor claimed today: ${claimed} ${item.unit} · Already reported: ${existing} ${item.unit}</div>
      </div>
      <div class="vmeta">today's qty</div>
      <input type="number" class="vinput" id="ru-q-${item.id}" value="${claimed}" min="0" step="0.1">
    </div>`;
  });
  document.getElementById('review-upd-fields').innerHTML=html||'<p style="color:var(--text3)">No quantities in this update.</p>';
  document.getElementById('ru-notes').value='';
  document.getElementById('modal-review-upd').classList.add('open');
}

async function approveWithEdit(){
  const p=GP(reviewUpdPid); if(!p) return;
  const u=(p.contractorUpdates||[]).find(x=>x.id===reviewUpdId); if(!u) return;

  // Collect edited quantities from modal inputs
  const approved={};
  (p.boq||[]).forEach(item=>{
    const v=parseFloat(document.getElementById('ru-q-'+item.id)?.value)||0;
    approved[item.id]=Math.min(v, item.qty);
  });

  // Run anomaly detection
  const tempUpdate = { ...u, quantities: approved };
  const anomalies = checkUpdateAnomalies(p, tempUpdate);

  if(anomalies.length > 0){
    const hasHardBlock = anomalies.some(a=>a.level==='hard');
    // Close review modal FIRST so anomaly modal is visible
    CM('modal-review-upd');
    // Snapshot the context needed for approval
    const snapPid = reviewUpdPid;
    const snapUid = reviewUpdId;
    const snapApproved = {...approved};
    showAnomalyWarnings(
      anomalies,
      async function(){
        // Re-fetch fresh references after modal close
        const fp = GP(snapPid);
        const fu = (fp?.contractorUpdates||[]).find(x=>x.id===snapUid);
        if(fp && fu) await doApprove(fp, fu, snapApproved, snapPid);
      },
      function(){
        // User cancelled — re-open review modal
        reviewUpdPid = snapPid;
        reviewUpdId = snapUid;
        OM('modal-review-upd');
      }
    );
    return;
  }

  // No anomalies — approve directly
  await doApprove(p, u, approved, reviewUpdPid);
}

async function doApprove(p, u, approved, pid){
  u.reviewed=true;
  u.approvedQty=approved;
  u.reviewNotes=document.getElementById('ru-notes')?.value||'';
  if(!p.reportedItems) p.reportedItems={};
  (p.boq||[]).forEach(item=>{
    p.reportedItems[item.id]=Math.min(
      (p.reportedItems[item.id]||0) + (approved[item.id]||0),
      item.qty
    );
  });
  try {
    await saveProjectDB(p);
    CM('modal-review-upd');
    renderDetail(pid||reviewUpdPid);
    toast('✓ Update approved — quantities updated','ok');
  } catch(e){ toast('Save failed','error'); }
}

async function rejectUpdate(){
  if(!confirm('Reject this update completely? The contractor\'s quantities will NOT be recorded.')) return;
  const p=GP(reviewUpdPid); if(!p) return;
  const u=(p.contractorUpdates||[]).find(x=>x.id===reviewUpdId); if(!u) return;
  u.reviewed=true;
  u.rejected=true;
  u.reviewNotes=document.getElementById('ru-notes').value||'Rejected by RSR';
  try {
    await saveProjectDB(p);
    CM('modal-review-upd');
    renderDetail(reviewUpdPid);
    toast('Update rejected','ok');
  } catch(e){ toast('Save failed','error'); }
}

async function deleteUpdate(pid, uid_val){
  if(!confirm('Archive this update? It will be hidden but data is preserved.')) return;
  const p=GP(pid); if(!p) return;
  const u=(p.contractorUpdates||[]).find(x=>x.id===uid_val);
  if(u){ u._archived=true; u._archivedAt=new Date().toISOString(); }
  try{ await saveProjectDB(p); renderDetail(pid); toast('✓ Update archived','ok'); }
  catch(e){ toast('Archive failed','error'); }
}

// ═══════════════════════════════════════════════════════
// SETTLEMENT / GOVERNMENT PAYMENT
// ═══════════════════════════════════════════════════════
function openSettle(pid){
  settlePid=pid;
  const p=GP(pid); if(!p) return;
  const pay=totPayments(p);
  const rec=totReceipts(p);
  const net=totRel(p);
  const settled=(p.settlements||[]).filter(s=>!isArchived(s)).reduce((s,x)=>s+x.amount,0);
  const outstanding=Math.max(0,net-settled);

  // Build receipt transaction list from Tally imports for this project (not yet used as settlement)
  const usedRefs=new Set((p.settlements||[]).filter(s=>!isArchived(s)&&s.tallyRef).map(s=>s.tallyRef));
  const availableReceipts=(p.releases||[]).filter(r=>r.txType==='receipt'&&!usedRefs.has(r.ref)&&!isArchived(r));

  const txOptions=availableReceipts.length
    ? availableReceipts.map((r,i)=>`<option value="${i}">${r.date} · Vch #${r.ref||'—'} · ${fmt(r.amount)}${r.notes?' · '+r.notes:''}</option>`).join('')
    : '<option value="">No Tally receipt transactions available — enter manually</option>';

  document.getElementById('settle-summary').innerHTML=`
    <div class="calc" style="margin-bottom:14px">
      <div class="fr"><span class="fl">Total Payments (gross)</span><span class="fv">${fmt(pay)}</span></div>
      <div class="fr"><span class="fl">Total Receipts</span><span class="fv" style="color:var(--green)">− ${fmt(rec)}</span></div>
      <div class="fr"><span class="fl">Net Deployed</span><span class="fv" style="color:var(--navy)">${fmt(net)}</span></div>
      <div class="fr"><span class="fl">Already Settled</span><span class="fv" style="color:var(--green)">${fmt(settled)}</span></div>
      <div class="fr" style="border-top:2px solid var(--border);padding-top:6px;margin-top:4px"><span class="fl" style="font-weight:700">Outstanding Balance</span><span class="fv" style="color:var(--red);font-weight:700">${fmt(outstanding)}</span></div>
    </div>
    ${availableReceipts.length?`
    <div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:var(--rs);padding:10px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:#2e7d32;margin-bottom:6px">📥 Select from Tally Receipt Transactions</div>
      <select id="settle-tx-select" onchange="prefillSettleFromTx(${JSON.stringify(availableReceipts.map(r=>({ref:r.ref,amount:r.amount,date:r.date,notes:r.notes||''})))})" style="width:100%;padding:7px;border:1px solid #a5d6a7;border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:12px">
        <option value="">— Select a Tally receipt transaction —</option>
        ${txOptions}
      </select>
      <div style="font-size:11px;color:#2e7d32;margin-top:4px">Selecting a transaction auto-fills amount, date and reference below.</div>
    </div>`
    :'<div style="font-size:12px;color:var(--text3);margin-bottom:12px">ℹ️ No unmatched Tally receipts found — enter settlement details manually or import from Tally first.</div>'}`;

  document.getElementById('settle-amt').value='';
  document.getElementById('settle-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('settle-ref').value='';
  document.getElementById('settle-notes').value='';
  document.getElementById('modal-settle').classList.add('open');
}

function prefillSettleFromTx(txArr){
  const sel=document.getElementById('settle-tx-select');
  if(!sel||sel.value==='') return;
  const idx=parseInt(sel.value);
  if(isNaN(idx)||!txArr[idx]) return;
  const tx=txArr[idx];
  document.getElementById('settle-amt').value=tx.amount;
  document.getElementById('settle-date').value=tx.date;
  document.getElementById('settle-ref').value=tx.ref||'';
  document.getElementById('settle-notes').value=tx.notes||'';
}

async function confirmSettle(){
  const p=GP(settlePid); if(!p) return;
  const amt=parseFloat(document.getElementById('settle-amt').value);
  if(!amt||amt<=0){alert('Enter valid amount');return;}
  const date=document.getElementById('settle-date').value;
  const ref=document.getElementById('settle-ref').value;

  // Duplicate detection
  const dup=checkDuplicateSettlement(p,amt,date);
  if(dup){
    if(!confirm(`⚠️ A similar settlement of ${fmt(dup.amount)} already exists on ${dup.date}. Record anyway?`)) return;
  }

  // Get tallyRef if selected from Tally transaction
  const sel=document.getElementById('settle-tx-select');
  const tallyRef=sel&&sel.value!==''?ref:null;

  if(!p.settlements) p.settlements=[];
  const billType = document.getElementById('settle-bill-type')?.value||'Final Bill';
  p.settlements.push({
    id:uid(),
    amount:amt,
    date,
    mode:document.getElementById('settle-mode').value,
    ref,
    tallyRef,
    billType,
    notes:document.getElementById('settle-notes').value,
    recordedAt:new Date().toISOString()
  });
  try {
    await saveProjectDB(p, {
      type:'settlement', amount:amt,
      ref: document.getElementById('settle-ref').value,
      meta:{ mode: document.getElementById('settle-mode').value, notes: document.getElementById('settle-notes').value }
    });
    logSettlement(p, amt, ref, date);
    CM('modal-settle');
    renderDetail(settlePid);
    toast(`✓ Settlement of ${fmt(amt)} recorded`,'ok');
  } catch(e){ toast('Save failed','error'); }
}
// ─── PROJECT STATUS CHANGE ────────────────────────────
async function changeProjectStatus(pid, newStatus){
  const p = GP(pid); if(!p) return;
  const labels = {active:'Active',onhold:'On Hold',completed:'Completed'};
  if(!confirm(`Change project status to "${labels[newStatus]}"?`)) return;
  p.status = newStatus;
  p.statusChangedAt = new Date().toISOString();
  p.statusChangedBy = CU.name;
  try {
    await saveProjectDB(p, {type:'status_change', amount:0, ref:null, meta:{newStatus, oldStatus: p.status}});
    toast(`✓ Project marked as ${labels[newStatus]}`, 'ok');
    writeActivityLog('status_change', `${p.name} → ${labels[newStatus]}`, p.id).catch(()=>{});
    if(dpid===pid) renderDetail(pid);
    else renderDash();
  } catch(e){ toast('Save failed','error'); }
}

// ─── EDIT PROJECT ─────────────────────────────────────
let editProjId = null;

function openEditProject(pid){
  const p = GP(pid); if(!p) return;
  editProjId = pid;

  document.getElementById('ep-firm').value = p.firm||'RSR Constructions';
  setTypeDropdown('ep-type','ep-type-custom', p.type||'Road');
  // Render type chips with current selection
  const currentTypes = p.types && p.types.length ? p.types : (p.type ? p.type.split(', ').map(t=>t.trim()) : ['Road']);
  setTimeout(()=>{ renderTypeChips('ep-type-chips', currentTypes); }, 100);
  document.getElementById('ep-name').value = p.name||'';
  document.getElementById('ep-tender').value = p.tender||'';
  document.getElementById('ep-date').value = p.agreeDate||'';
  document.getElementById('ep-jvdate').value = p.jvDate||'';
  document.getElementById('ep-jvnum').value = p.jvNumber||'';
  document.getElementById('ep-jvamt').value = p.jvAmount||'';
  document.getElementById('ep-emd').value = p.emd||'';
  document.getElementById('ep-asd').value = p.asd||'';
  document.getElementById('ep-fsd').value = p.fsd||'';
  document.getElementById('ep-bid').value = p.bidPct||'';
  document.getElementById('ep-loc').value = p.location||'';
  document.getElementById('ep-cc').value = p.costCentre||'';
  document.getElementById('ep-status').value = p.status||'active';

  const contSel = document.getElementById('ep-cont');
  contSel.innerHTML = D.contractors.map(c=>
    `<option value="${c.id}" ${c.id===p.contractorId?'selected':''}>${c.name}</option>`
  ).join('');

  OM('modal-edit-proj');
}

async function saveEditProject(){
  const p = GP(editProjId); if(!p) return;
  const name = document.getElementById('ep-name').value.trim();
  if(!name){ toast('Project name is required','error'); return; }

  p.firm = document.getElementById('ep-firm').value||'RSR Constructions';
  p.types = getSelectedTypes('ep-type-chips');
  p.type = p.types.join(', ')||getSelectedType('ep-type','ep-type-custom')||'Other';
  p.name = name;
  p.tender = document.getElementById('ep-tender').value.trim();
  p.agreeDate = document.getElementById('ep-date').value;
  p.jvDate = document.getElementById('ep-jvdate').value;
  p.jvNumber = document.getElementById('ep-jvnum').value.trim();
  p.jvAmount = parseFloat(document.getElementById('ep-jvamt').value)||0;
  p.emd = parseFloat(document.getElementById('ep-emd').value)||0;
  p.asd = parseFloat(document.getElementById('ep-asd').value)||0;
  p.fsd = parseFloat(document.getElementById('ep-fsd').value)||0;
  p.bidPct = parseFloat(document.getElementById('ep-bid').value)||0;
  p.location = document.getElementById('ep-loc').value.trim();
  p.costCentre = document.getElementById('ep-cc').value.trim().toUpperCase();
  p.contractorId = document.getElementById('ep-cont').value;
  p.status = document.getElementById('ep-status').value;

  // ASD validation: bid % more than 25% above OR below estimate requires ASD
  if(Math.abs(p.bidPct||0) > 25 && (!p.asd || p.asd <= 0)){
    const bidDir = (p.bidPct||0) < 0 ? 'below' : 'above';
    const proceed = await showConfirm({
      title:'⚠️ ASD Amount Missing',
      message:'This project is quoted at <strong>'+p.bidPct+'%</strong> (more than 25% '+bidDir+' estimate). '
        +'Tenders deviating more than 25% from the estimate require an <strong>Additional Security Deposit (ASD)</strong> — '
        +'roughly <strong>'+(Math.abs(p.bidPct||0)-25).toFixed(2)+'%</strong> of the estimated value.<br><br>'
        +'You have not entered an ASD amount. Continue anyway, or go back and enter it?',
      confirmLabel:'Continue without ASD',
      cancelLabel:'Go back and add ASD'
    });
    if(!proceed) return;
  }

  // Recalculate agreement amount
  const boqTotal = (p.boq||[]).reduce((s,x)=>s+x.amount,0);
  const base = p.estimated || boqTotal;
  p.agreeAmt = Math.round(base * (1 + p.bidPct/100) * 100)/100;

  try {
    await saveProjectDB(p);
    CM('modal-edit-proj');
    renderDetail(editProjId);
    ownerTab(0);
    logActivity({category:'project',action:'edit',projectId:p.id,projectName:p.name,
      description:(CU?CU.name:'User')+' edited project: '+p.name});
    toast('✅ Project updated','ok');
    writeActivityLog('project_edit',`Project edited: ${p.name}`,editProjId).catch(()=>{});
  } catch(e){ toast('Save failed: '+e.message,'error'); }
}

// ─── TOGGLE FULL BOQ ──────────────────────────────────
function toggleFullBOQ(elId){
  const el = document.getElementById(elId);
  if(!el) return;
  const isHidden = el.style.display === 'none';
  el.style.display = isHidden ? 'block' : 'none';
}

// ─── EXPECTED JV TAGGING ─────────────────────────────
function openExpectedJVMenu(pid){
  const today = new Date();
  const thisMonth = today.toLocaleString('en-IN',{month:'long',year:'numeric'});
  const nextMonthDate = new Date(today.getFullYear(), today.getMonth()+1, 1);
  const nextMonth = nextMonthDate.toLocaleString('en-IN',{month:'long',year:'numeric'});
  const thisKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const nextKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth()+1).padStart(2,'0')}`;

  // Show inline choice modal
  let modal = document.getElementById('modal-expected-jv');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'mov';
    modal.id = 'modal-expected-jv';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="mbox" style="max-width:380px">
    <div class="mhdr"><h2>📅 Add to Expected JV</h2><button class="mx" onclick="CM('modal-expected-jv')">✕</button></div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:16px">Which month do you expect the JV for this project?</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-navy" onclick="setExpectedJV('${pid}','${thisKey}','${thisMonth}')" style="padding:14px;font-size:14px">
        📅 ${thisMonth}<br><span style="font-size:11px;font-weight:400;opacity:.8">This month</span>
      </button>
      <button class="btn" onclick="setExpectedJV('${pid}','${nextKey}','${nextMonth}')" style="padding:14px;font-size:14px;background:var(--surface2);color:var(--navy)">
        📅 ${nextMonth}<br><span style="font-size:11px;font-weight:400;opacity:.7">Next month</span>
      </button>
      ${GP(pid)&&GP(pid).expectedJVMonth?`<button class="btn" onclick="clearExpectedJV('${pid}')" style="padding:10px;font-size:12px;color:var(--red);border-color:var(--red)">
        ✕ Remove from Expected JV
      </button>`:''}
    </div>
  </div>`;
  modal.classList.add('open');
}

async function setExpectedJV(pid, monthKey, monthLabel){
  const p = GP(pid); if(!p) return;
  p.expectedJVMonth = monthKey;
  p.expectedJVMonthLabel = monthLabel;
  p.expectedJVSetAt = new Date().toISOString();
  p.expectedJVSetBy = CU.name;
  try{
    await saveProjectDB(p);
    CM('modal-expected-jv');
    renderProjects();
    renderDash();
    toast(`✓ Added to Expected JV — ${monthLabel}`,'ok');
  }catch(e){ toast('Save failed','error'); }
}

async function clearExpectedJV(pid){
  const p = GP(pid); if(!p) return;
  delete p.expectedJVMonth;
  delete p.expectedJVMonthLabel;
  delete p.expectedJVSetAt;
  try{
    await saveProjectDB(p);
    CM('modal-expected-jv');
    renderProjects();
    renderDash();
    toast('✓ Removed from Expected JV','ok');
  }catch(e){ toast('Save failed','error'); }
}

// ═══════════════════════════════════════════════════════
// BULK PROJECT IMPORT FROM EXCEL
// ═══════════════════════════════════════════════════════
function openBulkImport(){
  let modal = document.getElementById('modal-bulk-import');
  if(!modal){
    modal = document.createElement('div');
    modal.className='mov'; modal.id='modal-bulk-import';
    document.body.appendChild(modal);
  }
  modal.innerHTML=`<div class="mbox" style="max-width:600px">
    <div class="mhdr"><h2>📥 Bulk Import Projects from Excel</h2><button class="mx" onclick="CM('modal-bulk-import')">✕</button></div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:16px">
      Upload the filled Excel template. The app will create all projects automatically.<br>
      <strong>Sheet 1</strong> = JV Projects (Check Pending) &nbsp;|&nbsp; <strong>Sheet 2</strong> = Cheque Received (Settled)
    </div>
    <div style="border:2px dashed var(--border);border-radius:var(--rs);padding:24px;text-align:center;margin-bottom:16px">
      <div style="font-size:32px;margin-bottom:8px">📊</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:8px">Select Excel file (.xlsx)</div>
      <input type="file" id="bulk-import-file" accept=".xlsx,.xls" style="display:none" onchange="processBulkImport()">
      <button class="btn btn-navy" onclick="document.getElementById('bulk-import-file').click()">Choose File</button>
    </div>
    <div id="bulk-import-status"></div>
  </div>`;
  modal.classList.add('open');
}

async function processBulkImport(){
  const file = document.getElementById('bulk-import-file').files[0];
  if(!file) return;
  const status = document.getElementById('bulk-import-status');
  status.innerHTML='<div style="text-align:center;padding:20px;color:var(--text2)">⏳ Reading file...</div>';

  try{
    // Load XLSX (pre-bundled)
    if(!window.XLSX){ toast('Excel library not loaded','error'); return; }
    const buf = await file.arrayBuffer();
    const wb = window.XLSX.read(buf, {type:'array'});

    let created=0, skipped=0, errors=[];

    // Process Sheet 1 — JV Projects
    if(wb.SheetNames[0]){
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = window.XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      // Find data rows (skip title rows, find first row with a number in col A)
      let dataStart = 0;
      for(let i=0;i<rows.length;i++){
        const v = String(rows[i][0]||'').trim();
        if(v && !isNaN(parseFloat(v))){ dataStart=i; break; }
      }
      for(let i=dataStart; i<rows.length; i++){
        const row = rows[i];
        const slno = String(row[0]||'').trim();
        if(!slno || isNaN(parseFloat(slno))) continue;
        const r = await importProjectRow(row, 'check_pending');
        if(r.ok) created++;
        else if(r.skip) skipped++;
        else errors.push(r.msg);
      }
    }

    // Process Sheet 2 — Cheque Received
    if(wb.SheetNames[1]){
      const ws = wb.Sheets[wb.SheetNames[1]];
      const rows = window.XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      let dataStart = 0;
      for(let i=0;i<rows.length;i++){
        const v = String(rows[i][0]||'').trim();
        if(v && !isNaN(parseFloat(v))){ dataStart=i; break; }
      }
      for(let i=dataStart; i<rows.length; i++){
        const row = rows[i];
        const slno = String(row[0]||'').trim();
        if(!slno || isNaN(parseFloat(slno))) continue;
        const r = await importProjectRow(row, 'settled');
        if(r.ok) created++;
        else if(r.skip) skipped++;
        else errors.push(r.msg);
      }
    }

    // Result
    let html = `<div style="padding:16px;background:var(--surface2);border-radius:var(--rs)">
      <div style="font-size:16px;font-weight:700;color:var(--navy);margin-bottom:8px">✅ Import Complete</div>
      <div style="font-size:13px;margin-bottom:4px">✓ <strong>${created}</strong> projects created</div>
      ${skipped?`<div style="font-size:13px;margin-bottom:4px;color:var(--text3)">⏭ ${skipped} rows skipped (missing project name or duplicate tender ID)</div>`:''}
      ${errors.length?`<div style="font-size:12px;color:var(--red);margin-top:8px"><strong>Errors:</strong><br>${errors.slice(0,10).join('<br>')}</div>`:''}
      <button class="btn btn-navy" style="margin-top:12px;width:100%" onclick="CM('modal-bulk-import');ownerTab(1)">View Projects →</button>
    </div>`;
    status.innerHTML = html;

    // Refresh projects list
    await loadDB();
    renderProjects();

  }catch(e){
    status.innerHTML=`<div style="padding:16px;background:var(--surface2);border-radius:var(--rs);color:var(--red)">
      Error reading file: ${e.message}</div>`;
  }
}

async function importProjectRow(row, mode){
  const c = i => String(row[i]||'').trim();
  const n = i => { try{ return parseFloat(String(row[i]||'').replace(/[,₹%]/g,''))||0; }catch{ return 0; } };

  // Sheet 1 columns: Sl, Firm, Contractor, ProjectName, TenderID, CostCentre, WorkType,
  //   AgreeDate, EstBOQ, BidPct, GenCode, EA, JVDate, JVNo, JVAmt, EMD, ASD, FSD
  // Sheet 2 columns: Sl, Firm, Contractor, ProjectName, TenderID, CostCentre, WorkType,
  //   AgreeDate, EstBOQ, BidPct, GenCode, EA, JVDate, JVAmt, EMD, ASD, FSD, ChequeDate, ChequeAmt

  const name = c(3);
  const costCentre = c(5);
  if(!name) return {skip:true, msg:`Row missing project name`};

  const tender = c(4);
  // Check duplicate tender ID
  if(tender && D.projects.find(p=>!p._archived&&(p.tender||'').toLowerCase()===tender.toLowerCase()))
    return {skip:true, msg:`Duplicate tender: ${tender}`};

  // Find contractor by name
  const contName = c(2);
  let contractorId = '';
  if(contName){
    const cont = D.contractors.find(ct=>ct.name&&ct.name.toLowerCase().includes(contName.toLowerCase().slice(0,6)));
    contractorId = cont ? cont.id : '';
  }

  const firm = c(1) || 'RSR Constructions';
  const estimated = n(8);
  const bidPct = n(9);
  const genCode = c(10);
  const eaNumber = c(11);

  let jvDate='', jvNumber='', jvAmount=0, emd=0, asd=0, fsd=0;
  let settleDate='', settleAmt=0;

  if(mode==='check_pending'){
    jvDate=c(12); jvNumber=c(13); jvAmount=n(14);
    emd=n(15); asd=n(16); fsd=n(17);
  } else {
    jvDate=c(12); jvAmount=n(13);
    emd=n(14); asd=n(15); fsd=n(16);
    settleDate=c(17); settleAmt=n(18);
  }

  const p = {
    id: uid(),
    name, tender, firm,
    contractorId,
    costCentre,
    type: c(6) || 'Other',
    agreeDate: c(7) || '',
    estimated: estimated || jvAmount,
    bidPct: bidPct || 0,
    genCode,
    eaNumber,
    jvDate,
    jvNumber,
    jvAmount,
    emd, asd, fsd,
    status: 'active',
    releases: [],
    boq: [],
    contractorUpdates: [],
    verifications: [],
    settlements: settleAmt>0 ? [{id:uid(),date:settleDate,amount:settleAmt,notes:'Imported from cheque received list'}] : [],
    createdAt: new Date().toISOString(),
    _importedFrom: 'bulk_excel',
  };

  try{
    await saveProjectDB(p);
    D.projects.push(p);
    return {ok:true};
  }catch(e){
    return {ok:false, msg:`${name}: ${e.message}`};
  }
}

// ═══════════════════════════════════════════════════════
// SETTLEMENT DETECTION
// Detects receipt transactions that likely = GVMC settlement
// Criteria:
//  1. Within ±5% of JV amount
//  2. Within ±5% of agreement amount
//  3. Greater than 70% cap amount
//  4. Single largest transaction in project
// ═══════════════════════════════════════════════════════

function detectSettlementCandidates(p){
  if(!p || isArchived(p)) return [];
  // Only for completed/settled projects
  const status = p.status||'active';
  if(status==='active'||status==='onhold') return [];

  // Already fully settled? Skip
  const settled = (p.settlements||[]).filter(s=>!isArchived(s)).reduce((s,x)=>s+x.amount,0);
  const usedRefs = new Set((p.settlements||[]).filter(s=>!isArchived(s)&&s.tallyRef).map(s=>s.tallyRef));
  const ignoredRefs = new Set((p.ignoredSettlementRefs||[]));

  // Get unmatched receipt transactions
  const receipts = (p.releases||[]).filter(r=>
    r.txType==='receipt' &&
    !isArchived(r) &&
    !usedRefs.has(r.ref) &&
    !ignoredRefs.has(r.id||r.ref)
  );

  if(!receipts.length) return [];

  const jvAmt = p.jvAmount||0;
  const agAmt = p.agreeAmt || (p.estimated*(1+(p.bidPct||0)/100)) || 0;
  const cap70 = agAmt*0.7;

  const candidates = [];

  receipts.forEach(r=>{
    const reasons = [];
    const amt = r.amount;

    // Criteria 1: within ±5% of JV amount
    if(jvAmt>0 && Math.abs(amt-jvAmt)/jvAmt <= 0.05){
      reasons.push('within ±5% of JV amount ('+fmt(jvAmt)+')');
    }
    // Criteria 2: within ±5% of agreement amount
    if(agAmt>0 && Math.abs(amt-agAmt)/agAmt <= 0.05){
      reasons.push('within ±5% of agreement amount ('+fmt(agAmt)+')');
    }
    // Criteria 3: greater than 70% cap
    if(cap70>0 && amt > cap70){
      reasons.push('exceeds 70% cap ('+fmt(cap70)+')');
    }

    if(reasons.length>0){
      candidates.push({...r, reasons});
    }
  });

  // Sort by amount desc — most likely candidate first
  return candidates.sort((a,b)=>b.amount-a.amount);
}

function hasPossibleSettlement(p){
  return detectSettlementCandidates(p).length > 0;
}

function renderSettlementDetectionBanner(p){
  const candidates = detectSettlementCandidates(p);
  if(!candidates.length) return '';

  // Show top candidate
  const c = candidates[0];
  const extra = candidates.length>1 ? ` (+${candidates.length-1} more)` : '';

  return '<div id="settle-detect-banner-'+p.id+'" style="background:#fffbeb;border:2px solid #f59e0b;border-radius:10px;padding:14px 16px;margin-bottom:16px">'
    +'<div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">'
    +'<div style="font-size:20px;line-height:1">💰</div>'
    +'<div style="flex:1">'
    +'<div style="font-weight:800;font-size:13px;color:#92400e;margin-bottom:4px">Possible Settlement Detected'+extra+'</div>'
    +'<div style="font-size:14px;font-weight:700;color:var(--navy);margin-bottom:2px">'+fmt(c.amount)+'</div>'
    +'<div style="font-size:12px;color:var(--text2);margin-bottom:4px">'
    +c.date+' · '+(c.ref?'Vch #'+c.ref+' · ':'')+(c.notes||'Receipt')
    +'</div>'
    +'<div style="font-size:11px;color:#92400e;margin-bottom:10px">Matches: '+c.reasons.join(' · ')+'</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button onclick="quickSettleFromDetection(\''+p.id+'\',\''+c.id+'\','+c.amount+',\''+c.date+'\',\''+c.ref+'\')" '
    +'style="background:#16a34a;color:#fff;border:none;border-radius:var(--rs);padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif">✅ Yes, Record Settlement</button>'
    +'<button onclick="editSettleFromDetection(\''+p.id+'\',\''+c.id+'\','+c.amount+',\''+c.date+'\',\''+c.ref+'\')" '
    +'style="background:var(--navy);color:#fff;border:none;border-radius:var(--rs);padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif">✏️ Edit First</button>'
    +'<button onclick="ignoreSettlementDetection(\''+p.id+'\',\''+c.id+'\',\''+c.ref+'\')" '
    +'style="background:none;border:1.5px solid #d1d5db;border-radius:var(--rs);padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif;color:var(--text2)">❌ Not a Settlement</button>'
    +'</div>'
    +'</div>'
    +'</div>'
    +'</div>';
}

async function quickSettleFromDetection(pid, rid, amount, date, ref){
  const p = GP(pid); if(!p) return;
  if(!p.settlements) p.settlements = [];
  p.settlements.push({
    id: uid(), date, amount,
    mode: 'Bank Transfer', ref: ref||'',
    notes: 'Auto-detected from Tally receipt',
    tallyRef: ref||'',
    settledAt: new Date().toISOString()
  });
  try{
    await saveProjectDB(p, {type:'settlement', amount, ref, meta:{autoDetected:true}});
    renderDetail(pid);
    logActivity({category:'finance',action:'settlement',projectId:pid,projectName:p.name,
      amount:amount,description:(CU?CU.name:'User')+' recorded settlement of ₹'+amount.toLocaleString('en-IN')+' for '+p.name});
    toast('✅ Settlement recorded — ₹'+amount.toLocaleString('en-IN'), 'ok');
  }catch(e){ toast('Save failed','error'); }
}

function editSettleFromDetection(pid, rid, amount, date, ref){
  // Open settle modal with amount pre-filled
  openSettle(pid);
  setTimeout(()=>{
    const amtEl = document.getElementById('settle-amt');
    const dateEl = document.getElementById('settle-date');
    const refEl = document.getElementById('settle-ref');
    if(amtEl) amtEl.value = amount;
    if(dateEl) dateEl.value = date;
    if(refEl) refEl.value = ref||'';
  }, 200);
}

async function ignoreSettlementDetection(pid, rid, ref){
  const p = GP(pid); if(!p) return;
  if(!p.ignoredSettlementRefs) p.ignoredSettlementRefs = [];
  if(rid && !p.ignoredSettlementRefs.includes(rid)) p.ignoredSettlementRefs.push(rid);
  if(ref && !p.ignoredSettlementRefs.includes(ref)) p.ignoredSettlementRefs.push(ref);
  try{
    await saveProjectDB(p, {type:'ignore_settlement_detection', amount:0, ref, meta:{}});
    // Remove banner without full re-render
    const banner = document.getElementById('settle-detect-banner-'+pid);
    if(banner) banner.remove();
    toast('Dismissed — transaction marked as not a settlement', 'ok');
  }catch(e){ toast('Save failed','error'); }
}

// ─── DELETE SETTLEMENT ────────────────────────────────
async function deleteSettlement(pid, sid){
  if(!confirm('Remove this settlement record? This cannot be undone.')) return;
  const p = GP(pid); if(!p) return;
  const s = (p.settlements||[]).find(x=>x.id===sid);
  if(!s) return;
  // Soft delete
  s._archived = true;
  try{
    await saveProjectDB(p, {type:'settlement_deleted', amount:s.amount, ref:s.ref, meta:{deletedSettlementId:sid, date:s.date}});
    renderDetail(pid);
    toast('Settlement removed','ok');
  }catch(e){ toast('Failed to remove','error'); }
}

// ─── OPEN VERIFICATION MODAL ─────────────────────────
function openVer(pid){
  const p = GP(pid); if(!p) return;
  const modal = document.getElementById('modal-ver');
  if(!modal) return;
  const verBody = document.getElementById('ver-body');
  if(!verBody) return;

  const boqItems = (p.boq||[]);

  verBody.innerHTML = `
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px">Record RSR physical verification of work completed on site.</div>
    <div class="fg"><label>Verification Date</label><input type="date" id="ver-date" value="${new Date().toISOString().split('T')[0]}"></div>
    <div class="fg"><label>Verified By</label><input type="text" id="ver-by" value="Likith" placeholder="Your name"></div>
    ${boqItems.length ? `
    <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px">Quantities Verified (cumulative to date):</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-bottom:12px">
      ${boqItems.map(item=>`
        <div style="background:var(--surface2);border-radius:var(--rs);padding:10px">
          <div style="font-size:11px;color:var(--text2);margin-bottom:4px">${item.desc||item.name} (${item.unit})</div>
          <input type="number" min="0" step="0.01" id="ver-qty-${item.id}"
            value="${(p.verifiedItems||{})[item.id]||''}"
            placeholder="0"
            style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border);border-radius:var(--rs);font-size:13px;font-weight:700;text-align:right;font-family:'Inter',sans-serif">
        </div>`).join('')}
    </div>` : ''}
    <div class="fg"><label>Notes</label><input type="text" id="ver-notes" placeholder="Observations, issues..."></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn" onclick="CM('modal-ver')">Cancel</button>
      <button class="btn btn-navy" onclick="saveVerification('${pid}')">✓ Save Verification</button>
    </div>`;

  OM('modal-ver');
}

async function saveVerification(pid){
  const p = GP(pid); if(!p) return;
  const date = document.getElementById('ver-date')?.value;
  const verifiedBy = document.getElementById('ver-by')?.value?.trim()||'Likith';
  const notes = document.getElementById('ver-notes')?.value?.trim();

  if(!date){ toast('Select verification date','error'); return; }

  // Collect verified quantities
  const verifiedItems = {};
  (p.boq||[]).forEach(item=>{
    const val = parseFloat(document.getElementById('ver-qty-'+item.id)?.value)||0;
    if(val>0) verifiedItems[item.id] = val;
  });

  if(!p.verifications) p.verifications=[];
  p.verifiedItems = {...(p.verifiedItems||{}), ...verifiedItems};

  p.verifications.push({
    id: uid(),
    date, verifiedBy, notes,
    items: verifiedItems,       // canonical key — read by verPct, eligR, projects.js, finance.js, contractor_view.js
    quantities: verifiedItems,  // alias kept for backward/forward compatibility
    createdAt: new Date().toISOString()
  });

  try{
    await saveProjectDB(p, {type:'verification', amount:0, ref:null, meta:{verifiedBy, date}});
    CM('modal-ver');
    renderDetail(pid);
    toast('✓ Verification saved','ok');
    if(typeof haptic==='function') haptic('success');
  }catch(e){ toast('Save failed','error'); }
}

// ─── FULL BOQ MODAL ────────────────────────────────────
const RSR_LOGO_B64 = 'data:image/png;base64,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';

function openFullBOQModal(pid){
  const p = GP(pid); if(!p) return;
  const boq = p.boq||[];
  if(!boq.length){ toast('No BOQ items yet — click Edit BOQ to add','info'); return; }

  let modal = document.getElementById('modal-full-boq');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-full-boq'; document.body.appendChild(modal); }

  const bidPct = p.bidPct||0;
  const bidMult = 1 + (bidPct/100);
  const total = boq.reduce((s,i)=>s+(i.qty||0)*(i.rate||0),0);
  const totalAdjusted = total * bidMult;

  modal.innerHTML = `<div class="mbox" style="max-width:780px">
    <div class="mhdr"><h2>📋 Full BOQ — ${p.name.substring(0,40)}</h2>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-sm" onclick="exportBOQPDF('${pid}','print')" title="Open a print-ready version">🖨️ Print</button>
        <button class="btn btn-sm btn-navy" onclick="exportBOQPDF('${pid}','download')" title="Download as a PDF file">⬇️ Download PDF</button>
        <button class="mx" onclick="CM('modal-full-boq')">✕</button>
      </div>
    </div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px;padding:8px 12px;background:var(--surface2);border-radius:var(--rs)">
      Bid quoted: <strong style="color:${bidPct<0?'var(--red)':'var(--green)'}">${bidPct>0?'+':''}${bidPct}%</strong> — rates below show <strong>quoted rate</strong> with <strong style="color:var(--navy)">(actual rate after bid%)</strong> underneath
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr>
        <th>Item Description</th><th>Unit</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Rate (₹)</th>
        <th style="text-align:right">Value (₹)</th>
        <th style="text-align:right">Reported</th>
        <th style="text-align:right">Verified</th>
      </tr></thead>
      <tbody>
        ${boq.map((item,i)=>{
          const qty = item.qty||0;
          const rate = item.rate||0;
          const value = qty*rate;
          const adjRate = rate*bidMult;
          const adjValue = value*bidMult;
          return `<tr style="background:${i%2===0?'#fff':'var(--surface2)'}">
          <td style="font-size:12px">${item.desc||item.name||'—'}</td>
          <td style="font-size:12px">${item.unit||'—'}</td>
          <td style="text-align:right;font-size:12px">${qty}</td>
          <td style="text-align:right;font-size:12px">
            ${fmt(rate)}
            ${bidPct!==0?`<div style="color:var(--navy);font-weight:700;font-size:11px">(${fmt(adjRate)})</div>`:''}
          </td>
          <td style="text-align:right;font-size:12px;font-weight:700">
            ${fmt(value)}
            ${bidPct!==0?`<div style="color:var(--navy);font-weight:700;font-size:11px">(${fmt(adjValue)})</div>`:''}
          </td>
          <td style="text-align:right;font-size:12px;color:var(--amber)">${(p.reportedItems||{})[item.id]||'—'}</td>
          <td style="text-align:right;font-size:12px;color:var(--green);font-weight:700">${(p.verifiedItems||{})[item.id]||'—'}</td>
        </tr>`;}).join('')}
        <tr style="background:var(--navy);font-weight:700">
          <td colspan="4" style="padding:10px 12px;color:var(--gold)">Total BOQ Value</td>
          <td style="text-align:right;padding:10px 12px;color:#fff">
            ${fmt(total)}
            ${bidPct!==0?`<div style="color:var(--gold);font-size:11px">(${fmt(totalAdjusted)})</div>`:''}
          </td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table></div>
  </div>`;
  modal.classList.add('open');
}

// ─── BOQ PDF EXPORT (Print / Download) ────────────────
// Builds a clean, shareable PDF of a project's full BOQ — company logo,
// project name, every item with quantity/rate/value, and the total —
// so it can be shared with a contractor or anyone else without needing
// to log into the government e-procurement portal to pull it again.
// Both buttons build the identical PDF; "Print" opens it in a new tab and
// triggers the browser's print dialog (which itself offers "Save as PDF"
// as a destination), "Download" saves the file directly to disk in one
// click — covering both without needing two separate documents.
// jsPDF's built-in fonts don't include the ₹ glyph — it was rendering as
// broken characters. Using "Rs." (plain ASCII) instead for anything that
// goes into the PDF specifically; the live app UI is unaffected and still
// shows ₹ normally, since browsers render that fine.
function pdfFmt(n){
  if(!n || n===0) return 'Rs. 0';
  const rounded = Math.round((n||0)*100)/100;
  const parts = rounded.toFixed(2).split('.');
  const intPart = parseInt(parts[0]).toLocaleString('en-IN');
  const decPart = parts[1];
  return 'Rs. ' + (decPart==='00' ? intPart : intPart+'.'+decPart);
}

function _buildBOQPDF(pid){
  const p = GP(pid); if(!p) return null;
  const boq = p.boq||[];
  if(!boq.length){ toast('No BOQ items yet — click Edit BOQ to add','error'); return null; }
  if(typeof window.jspdf === 'undefined'){ toast('PDF library failed to load — try refreshing the page','error'); return null; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const navy = [26, 39, 68], gold = [201, 168, 76];

  // Header band
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, 70, 'F');
  try{ doc.addImage(RSR_LOGO_B64, 'PNG', 24, 10, 50, 50); }catch(e){}
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold'); doc.setFontSize(18);
  doc.text('RSR CONSTRUCTIONS', 86, 32);
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.setTextColor(230,230,230);
  doc.text('BILL OF QUANTITIES', 86, 48);

  // Project info
  let y = 92;
  doc.setTextColor(20,20,20);
  doc.setFont('helvetica','bold'); doc.setFontSize(12);
  const nameLines = doc.splitTextToSize(p.name||'—', pageW-100);
  doc.text(nameLines, 50, y);
  y += nameLines.length*15 + 6;
  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.setTextColor(90,90,90);
  const meta = [
    p.tender?('Tender ID: '+p.tender):null,
    'Contractor: '+((GC(p.contractorId)||{}).name||'—'),
    p.firm?('Firm: '+p.firm):null,
    'Generated: '+fmtDate(new Date().toISOString().split('T')[0])
  ].filter(Boolean).join('   |   ');
  doc.text(meta, 50, y);
  y += 16;

  const bidPct = p.bidPct||0;
  const bidMult = 1 + (bidPct/100);
  const total = boq.reduce((s,i)=>s+(i.qty||0)*(i.rate||0),0);
  const totalAdjusted = total * bidMult;

  if(bidPct!==0){
    doc.setFontSize(8.5); doc.setTextColor(120,120,120);
    doc.text('Bid quoted: '+(bidPct>0?'+':'')+bidPct+'%  —  rates/values below show the quoted figure, with the actual figure after bid% on the line beneath.', 50, y);
    y += 14;
  }

  const rows = boq.map(item=>{
    const qty=item.qty||0, rate=item.rate||0, value=qty*rate;
    const adjRate=rate*bidMult, adjValue=value*bidMult;
    return [
      item.desc||item.name||'—',
      item.unit||'—',
      String(qty),
      bidPct!==0 ? pdfFmt(rate)+'\nActual: '+pdfFmt(adjRate) : pdfFmt(rate),
      bidPct!==0 ? pdfFmt(value)+'\nActual: '+pdfFmt(adjValue) : pdfFmt(value),
    ];
  });

  doc.autoTable({
    startY: y+8,
    head: [['Item Description','Unit','Qty','Rate (Rs.)','Value (Rs.)']],
    body: rows,
    styles: { font:'helvetica', fontSize:8.5, cellPadding:5, valign:'middle' },
    headStyles: { fillColor: navy, textColor: [255,255,255], fontStyle:'bold' },
    alternateRowStyles: { fillColor: [247,248,251] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 45, halign:'center' },
      2: { cellWidth: 45, halign:'right' },
      3: { cellWidth: 95, halign:'right' },
      4: { cellWidth: 105, halign:'right' },
    },
    foot: [[
      { content:'Total BOQ Value', colSpan:4, styles:{fillColor:navy,textColor:gold,fontStyle:'bold',halign:'right'} },
      { content: bidPct!==0 ? pdfFmt(total)+'\nActual: '+pdfFmt(totalAdjusted) : pdfFmt(total), styles:{fillColor:navy,textColor:[255,255,255],fontStyle:'bold',halign:'right'} },
    ]],
    margin: { left:50, right:50 },
    didDrawPage: (data)=>{
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8); doc.setTextColor(150,150,150);
      doc.text('Page '+doc.internal.getCurrentPageInfo().pageNumber+' of '+pageCount, pageW-70, doc.internal.pageSize.getHeight()-20);
    }
  });

  return doc;
}

function exportBOQPDF(pid, action){
  const doc = _buildBOQPDF(pid);
  if(!doc) return;
  const p = GP(pid);
  const filename = 'BOQ_'+(p.name||'project').replace(/[^a-z0-9]+/gi,'_').substring(0,50)+'.pdf';
  if(action==='download'){
    doc.save(filename);
    toast('✓ PDF downloaded','ok');
  } else {
    // Print: open in a new tab and trigger the browser's print dialog,
    // which itself offers "Save as PDF" as a destination too.
    const blobUrl = doc.output('bloburl');
    const win = window.open(blobUrl, '_blank');
    if(win){
      win.addEventListener('load', ()=>{ try{ win.focus(); win.print(); }catch(e){} });
    } else {
      toast('Please allow pop-ups to print, or use Download PDF instead','error');
    }
  }
}

