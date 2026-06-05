// ─── CUSTOM WORK TYPE ────────────────────────────────
// Custom types are stored in settings and added to dropdown
function handleCustomType(selectId, inputId){
  const sel = document.getElementById(selectId);
  const inp = document.getElementById(inputId);
  if(!inp) return;
  if(sel.value === '__custom__'){
    inp.style.display = 'block';
    inp.focus();
  } else {
    inp.style.display = 'none';
  }
}

function getSelectedType(selectId, inputId){
  const sel = document.getElementById(selectId);
  const inp = document.getElementById(inputId);
  if(sel.value === '__custom__') return (inp&&inp.value.trim()) || 'Other';
  return sel.value;
}

function setTypeDropdown(selectId, inputId, value){
  const sel = document.getElementById(selectId);
  if(!sel || !value) return;
  // Check if value exists in dropdown
  const exists = Array.from(sel.options).some(o=>o.value===value);
  if(exists){
    sel.value = value;
  } else {
    // Custom type — select custom option and show input
    sel.value = '__custom__';
    const inp = document.getElementById(inputId);
    if(inp){ inp.style.display='block'; inp.value=value; }
  }
}

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
    type:getSelectedType('np-type','np-type-custom'),
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
    renderConts();
    toast('Contractor deleted','ok');
  } catch(e){ toast('Delete failed: '+e.message,'error'); }
}

// ═══════════════════════════════════════════════════════
// DELETE / EDIT — FUND RELEASES
// ═══════════════════════════════════════════════════════
function openEditRelease(pid, rid){
  const p=GP(pid); if(!p) return;
  const r=(p.releases||[]).find(x=>x.id===rid); if(!r) return;
  editReleasePid=pid; editReleaseId=rid;
  document.getElementById('er-amt').value=r.amount;
  document.getElementById('er-date').value=r.date;
  document.getElementById('er-meth').value=r.method||'NEFT';
  document.getElementById('er-ref').value=r.ref||'';
  document.getElementById('er-notes').value=r.notes||'';
  document.getElementById('modal-edit-release').classList.add('open');
}
async function saveEditRelease(){
  const p=GP(editReleasePid); if(!p) return;
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
  const p=GP(pid); if(!p) return;
  const r=(p.releases||[]).find(x=>x.id===rid);
  if(r){ r._archived=true; r._archivedAt=new Date().toISOString(); }
  try{ await saveProjectDB(p); renderDetail(pid); toast('✓ Transaction archived','ok'); }
  catch(e){ toast('Archive failed','error'); }
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
  p.settlements.push({
    id:uid(),
    amount:amt,
    date,
    mode:document.getElementById('settle-mode').value,
    ref,
    tallyRef,
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
  p.type = getSelectedType('ep-type','ep-type-custom');
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

  // Recalculate agreement amount
  const boqTotal = (p.boq||[]).reduce((s,x)=>s+x.amount,0);
  const base = p.estimated || boqTotal;
  p.agreeAmt = Math.round(base * (1 + p.bidPct/100) * 100)/100;

  try {
    await saveProjectDB(p);
    CM('modal-edit-proj');
    renderDetail(editProjId);
    ownerTab(0);
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
    // Load XLSX
    if(!window.XLSX) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
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
    await fetchAllData();
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
