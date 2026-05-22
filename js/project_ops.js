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
  if(!est){toast('Estimated BOQ value is required','error');document.getElementById('np-est').focus();return;}
  if(!loc){toast('Location is required','error');document.getElementById('np-loc').focus();return;}
  if(!cc){toast('Tally Cost Centre name is required','error');document.getElementById('np-cc').focus();return;}
  if(!contractorId){toast('Please select a contractor','error');return;}

  // Get BOQ from the upload/preview system
  const boq=getBOQForSave();
  if(!boq.length){toast('Add at least one BOQ item. Upload Excel or add manually.','error');return;}

  const proj={
    id:uid(), name, tender,
    type:document.getElementById('np-type').value,
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
  if(!confirm('Delete this project? This cannot be undone. All data including releases and updates will be lost.')) return;
  try {
    await sbReq(`projects?id=eq.${pid}`, 'DELETE');
    D.projects = D.projects.filter(p=>p.id!==pid);
    toast('Project deleted','ok');
    ownerTab(0);
  } catch(e){ toast('Delete failed: '+e.message,'error'); }
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
  if(!confirm('Delete this fund release? This will also reduce the interest calculation.')) return;
  const p=GP(pid); if(!p) return;
  p.releases=(p.releases||[]).filter(r=>r.id!==rid);
  try {
    await saveProjectDB(p);
    renderDetail(pid);
    toast('Release deleted','ok');
  } catch(e){ toast('Delete failed','error'); }
}

// ═══════════════════════════════════════════════════════
// DELETE / EDIT — VERIFICATIONS
// ═══════════════════════════════════════════════════════
async function deleteVerification(pid, vid){
  if(!confirm('Delete this verification record? Verified quantities will revert to previous verification.')) return;
  const p=GP(pid); if(!p) return;
  p.verifications=(p.verifications||[]).filter(v=>v.id!==vid);
  try {
    await saveProjectDB(p);
    renderDetail(pid);
    toast('Verification deleted','ok');
  } catch(e){ toast('Delete failed','error'); }
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
  if(!confirm('Delete this update completely?')) return;
  const p=GP(pid); if(!p) return;
  p.contractorUpdates=(p.contractorUpdates||[]).filter(u=>u.id!==uid_val);
  try {
    await saveProjectDB(p);
    renderDetail(pid);
    toast('Update deleted','ok');
  } catch(e){ toast('Delete failed','error'); }
}

// ═══════════════════════════════════════════════════════
// SETTLEMENT / GOVERNMENT PAYMENT
// ═══════════════════════════════════════════════════════
function openSettle(pid){
  settlePid=pid;
  const p=GP(pid); if(!p) return;
  const rel=totRel(p);
  const settled=(p.settlements||[]).reduce((s,x)=>s+x.amount,0);
  const outstanding=rel-settled;
  document.getElementById('settle-summary').innerHTML=`<div class="calc" style="margin-bottom:14px">
    <div class="fr"><span class="fl">Total Released to Contractor</span><span class="fv">${fmt(rel)}</span></div>
    <div class="fr"><span class="fl">Already Settled</span><span class="fv" style="color:var(--green)">${fmt(settled)}</span></div>
    <div class="fr"><span class="fl">Outstanding Balance</span><span class="fv" style="color:var(--red)">${fmt(outstanding)}</span></div>
  </div>`;
  document.getElementById('settle-amt').value='';
  document.getElementById('settle-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('settle-ref').value='';
  document.getElementById('settle-notes').value='';
  document.getElementById('modal-settle').classList.add('open');
}

async function confirmSettle(){
  const p=GP(settlePid); if(!p) return;
  const amt=parseFloat(document.getElementById('settle-amt').value);
  if(!amt||amt<=0){alert('Enter valid amount');return;}
  if(!p.settlements) p.settlements=[];
  p.settlements.push({
    id:uid(),
    amount:amt,
    date:document.getElementById('settle-date').value,
    mode:document.getElementById('settle-mode').value,
    ref:document.getElementById('settle-ref').value,
    notes:document.getElementById('settle-notes').value
  });
  try {
    await saveProjectDB(p);
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
    await saveProjectDB(p);
    toast(`✓ Project marked as ${labels[newStatus]}`, 'ok');
    if(dpid===pid) renderDetail(pid);
    else renderDash();
  } catch(e){ toast('Save failed','error'); }
}
