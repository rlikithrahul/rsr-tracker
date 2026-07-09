// ═══════════════════════════════════════
// documents.js — Project Document Vault
// RSR Constructions Tracker v18
// Handles JV, Work Orders, WEC, EA Number
// Owner: upload/view/delete
// Contractor: view only
// ═══════════════════════════════════════

// Document slot definitions — every project has these
const DOC_SLOTS = [
  { id: 'jv',       label: 'Journal Voucher (JV)',        icon: '📋', accept: '.pdf,.jpg,.jpeg,.png', note: 'Upload after work completion & recording' },
  { id: 'ea',       label: 'EA Number',                   icon: '🔢', type: 'text', note: 'Accounts number — filled after 1-2 months of receiving JV' },
  { id: 'gencode',  label: 'Gen Code',                    icon: '🏷️', type: 'text', note: 'Unique generation code for this tender' },
  { id: 'wec',      label: 'Work Experience Certificate', icon: '🏆', accept: '.pdf,.jpg,.jpeg,.png', note: 'Upload after certificate is issued' },
  { id: 'wo',       label: 'Work Order',                  icon: '📄', accept: '.pdf,.jpg,.jpeg,.png', note: 'Original tender work order document' },
  { id: 'billform', label: 'Bill Form',                   icon: '🧾', accept: '.pdf,.jpg,.jpeg,.png', note: 'Upload after JV & EA received — verify final JV amount' },
  { id: 'other1',   label: 'Other Document 1',            icon: '📎', accept: '.pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx', customLabel: true },
  { id: 'other2',   label: 'Other Document 2',            icon: '📎', accept: '.pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx', customLabel: true },
  { id: 'other3',   label: 'Other Document 3',            icon: '📎', accept: '.pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx', customLabel: true },
];

let uploadingDocPid = null;
let uploadingDocSlot = null;

// ─── RENDER DOCUMENT VAULT (owner view) ───────────────
function renderDocVault(p, isOwner) {
  if (!p.documents) p.documents = {};

  const slots = DOC_SLOTS.map(slot => {
    const doc = p.documents[slot.id];
    const customLabel = p.documents[slot.id + '_label'] || slot.label;

    if (slot.type === 'text') {
      const isEA = slot.id === 'ea';
      const savedVal = doc || '';
      const inputId = isEA ? `ea-input-${p.id}` : `gencode-input-${p.id}`;
      const editWrapperId = isEA ? `ea-wrap-${p.id}` : `gencode-wrap-${p.id}`;
      const saveFn = isEA ? `saveEANumber('${p.id}')` : `saveGenCode('${p.id}')`;
      const toggleFn = isEA ? `toggleEAEdit('${p.id}')` : `toggleGenCodeEdit('${p.id}')`;

      return `<div class="doc-slot">
        <div class="doc-slot-header">
          <span class="doc-slot-icon">${slot.icon}</span>
          <div>
            <div class="doc-slot-title">${slot.label}</div>
            <div class="doc-slot-note">${slot.note}</div>
          </div>
        </div>
        ${isOwner ? `
          <div id="${editWrapperId}" style="margin-top:10px">
            ${savedVal
              ? `<div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:14px;font-weight:700;color:var(--navy);letter-spacing:.03em">${savedVal}</span>
                  <button onclick="${toggleFn}" style="background:none;border:1px solid var(--border);border-radius:var(--rs);padding:3px 8px;font-size:11px;cursor:pointer;font-family:'Inter',sans-serif;color:var(--text2)">✏️ Edit</button>
                </div>
                <div id="${inputId}-edit" style="display:none;margin-top:8px">
                  <div style="display:flex;gap:8px;align-items:center">
                    <input type="text" id="${inputId}" value="${savedVal}"
                      style="flex:1;padding:8px 12px;border:1.5px solid var(--navy);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px"
                      onkeydown="if(event.key==='Enter')${saveFn};if(event.key==='Escape')${toggleFn}">
                    <button class="btn btn-sm btn-navy" onclick="${saveFn}">Save</button>
                    <button class="btn btn-sm" onclick="${toggleFn}">Cancel</button>
                  </div>
                </div>`
              : `<div style="display:flex;gap:8px;align-items:center">
                  <input type="text" id="${inputId}" value=""
                    placeholder="${slot.id === 'ea' ? 'Enter EA / Accounts number' : 'Enter Gen Code'}"
                    style="flex:1;padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px"
                    onkeydown="if(event.key==='Enter')${saveFn}">
                  <button class="btn btn-sm btn-navy" onclick="${saveFn}">Save</button>
                </div>`
            }
          </div>` :
          `<div style="margin-top:8px;font-size:14px;font-weight:600;color:var(--navy)">${savedVal || '<span style="color:var(--text3);font-weight:400">Not entered yet</span>'}</div>`
        }
      </div>`;
    }

    // File upload slot
    const isUploaded = doc && doc.url;
    return `<div class="doc-slot ${isUploaded ? 'doc-slot-filled' : ''}">
      <div class="doc-slot-header">
        <span class="doc-slot-icon">${slot.icon}</span>
        <div style="flex:1">
          ${slot.customLabel && isOwner ?
            `<input type="text" value="${customLabel}" placeholder="Document label"
              style="font-weight:700;font-size:13px;color:var(--navy);border:none;border-bottom:1px solid var(--border);background:transparent;font-family:'Inter',sans-serif;width:100%;outline:none;padding:2px 0"
              onchange="saveDocLabel('${p.id}','${slot.id}',this.value)">` :
            `<div class="doc-slot-title">${customLabel}</div>`
          }
          <div class="doc-slot-note">${slot.note || ''}</div>
        </div>
      </div>
      ${isUploaded ? `
        <div class="doc-uploaded">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="font-size:13px;color:var(--green);font-weight:600">✅ ${doc.name}</span>
            <span style="font-size:11px;color:var(--text3)">${doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('en-IN') : ''}</span>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
            <a href="${doc.url}" target="_blank" class="btn btn-sm">👁️ View</a>
            <a href="${doc.url}" download="${doc.name}" class="btn btn-sm">⬇️ Download</a>
            ${isOwner ? `<button class="btn btn-sm" style="color:var(--red)" onclick="deleteDocument('${p.id}','${slot.id}')">🗑️ Delete</button>` : ''}
            ${isOwner ? `<label class="btn btn-sm" style="cursor:pointer">🔄 Replace<input type="file" accept="${slot.accept||'*'}" style="display:none" onchange="handleDocUpload(event,'${p.id}','${slot.id}')"></label>` : ''}
          </div>
        </div>` : `
        ${isOwner ? `
          <label class="doc-upload-btn" style="cursor:pointer">
            <span>📤 Upload File</span>
            <span style="font-size:11px;color:var(--text3);margin-left:6px">${slot.accept ? slot.accept.split(',').join(', ') : 'Any file'}</span>
            <input type="file" accept="${slot.accept||'*'}" style="display:none" onchange="handleDocUpload(event,'${p.id}','${slot.id}')">
          </label>` :
          `<div style="font-size:13px;color:var(--text3);margin-top:8px;font-style:italic">Not uploaded yet</div>`
        }
      `}
    </div>`;
  }).join('');

  return `<div class="card" id="doc-vault-${p.id}">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div class="st" style="margin:0;border:none;padding:0">📁 Project Documents</div>
      ${isOwner ? '<div style="font-size:11px;color:var(--text3)">Owner only: upload & delete. Contractors can view.</div>' : '<div style="font-size:11px;color:var(--text3)">View only</div>'}
    </div>
    <div class="doc-grid">${slots}</div>
  </div>`;
}

// ─── UPLOAD HANDLER ───────────────────────────────────
async function handleDocUpload(evt, pid, slotId) {
  const file = evt.target.files[0];
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) { toast('File too large. Max 50MB.', 'error'); return; }

  // For JV — show date picker modal first, then upload
  if(slotId === 'jv'){
    // Store file reference for after date is confirmed
    window._pendingJVFile = file;
    window._pendingJVPid = pid;
    // Set today's date as default
    document.getElementById('jv-date-input').value = new Date().toISOString().split('T')[0];
    OM('modal-jv-date');
    evt.target.value = '';
    return;
  }

  // For Bill Form — upload first, then ask about JV amount verification
  if(slotId === 'billform'){
    await _doDocUpload(file, pid, slotId, null);
    evt.target.value = '';
    // Show JV amount verification popup after upload
    _showBillFormVerification(pid);
    return;
  }

  await _doDocUpload(file, pid, slotId, null);
  evt.target.value = '';
}

function _showBillFormVerification(pid){
  const p = GP(pid); if(!p) return;
  const currentJVAmt = p.jvAmount||0;
  let modal = document.getElementById('modal-billform-verify');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-billform-verify'; document.body.appendChild(modal); }
  modal.innerHTML = `<div class="mbox" style="max-width:440px">
    <div class="mhdr"><h2>🧾 Bill Form — Verify JV Amount</h2><button class="mx" onclick="CM('modal-billform-verify')">✕</button></div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:16px">
      Bill Form uploaded. Please verify: is the final JV amount on the Bill Form the same as the current JV amount?
    </div>
    <div style="background:var(--surface2);border-radius:var(--rs);padding:10px 14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;color:var(--text2)">Current JV Amount</span>
      <span style="font-size:16px;font-weight:800;color:var(--navy)">${fmt(currentJVAmt)}</span>
    </div>
    <div class="fg" id="billform-new-amt-section" style="display:none">
      <label>Final JV Amount on Bill Form (₹)</label>
      <input type="number" id="billform-new-amt" placeholder="Enter corrected amount"
        style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border);border-radius:var(--rs);font-size:14px;font-family:'Inter',sans-serif">
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
      <button class="btn" onclick="CM('modal-billform-verify')" style="color:var(--text3)">Skip for now</button>
      <button class="btn" onclick="document.getElementById('billform-new-amt-section').style.display='block';this.style.display='none'"
        style="background:#fef2f2;border-color:var(--red);color:var(--red)">
        ✗ Amount is Different
      </button>
      <button class="btn btn-green" onclick="saveBillFormAmt('${pid}',false)">✓ Same Amount</button>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px" id="billform-save-btn" style="display:none">
      <button class="btn btn-navy" onclick="saveBillFormAmt('${pid}',true)">Save Corrected Amount</button>
    </div>
  </div>`;
  modal.classList.add('open');
  // Show save button when new amount section is visible
  setTimeout(()=>{
    const newAmtSection = document.getElementById('billform-new-amt-section');
    const saveBtn = document.getElementById('billform-save-btn');
    if(newAmtSection && saveBtn){
      const obs = new MutationObserver(()=>{ saveBtn.style.display = newAmtSection.style.display==='block'?'flex':'none'; });
      obs.observe(newAmtSection, {attributes:true, attributeFilter:['style']});
    }
  },100);
}

async function saveBillFormAmt(pid, isDifferent){
  const p = GP(pid); if(!p) return;
  if(isDifferent){
    const newAmt = parseFloat(document.getElementById('billform-new-amt')?.value)||0;
    if(!newAmt){ toast('Please enter the corrected amount','error'); return; }
    const oldAmt = p.jvAmount||0;
    p.jvAmount = newAmt;
    p.billFormAmtNote = `Bill Form corrected JV amount from ${fmt(oldAmt)} to ${fmt(newAmt)}`;
    p.billFormVerified = true;
    await saveProjectDB(p,{type:'billform_correction',amount:newAmt,ref:null,meta:{oldAmt}});
    logActivity({category:'project',action:'billform_correction',projectId:pid,projectName:p.name,
      description:`Bill Form: JV amount corrected from ${fmt(oldAmt)} to ${fmt(newAmt)}`});
    toast(`✓ JV amount updated to ${fmt(newAmt)}`,'ok');
  } else {
    p.billFormVerified = true;
    await saveProjectDB(p,{type:'billform_verified',amount:p.jvAmount||0,ref:null,meta:{}});
    logActivity({category:'project',action:'billform_verified',projectId:pid,projectName:p.name,
      description:'Bill Form uploaded — JV amount verified as same'});
    toast('✓ JV amount verified','ok');
  }
  CM('modal-billform-verify');
  renderDetail(pid);
}

async function confirmJVDate(){
  const jvDate = document.getElementById('jv-date-input')?.value;
  if(!jvDate){ toast('Please select the JV date','error'); return; }

  const jvDetails = {
    jvDate,
    jvNumber: document.getElementById('jv-number-input')?.value?.trim()||'',
    jvAmount: parseFloat(document.getElementById('jv-amount-input')?.value)||0,
    emd: parseFloat(document.getElementById('jv-emd-input')?.value)||0,
    fsd: parseFloat(document.getElementById('jv-fsd-input')?.value)||0,
    jvNotes: document.getElementById('jv-notes-input')?.value?.trim()||''
  };

  CM('modal-jv-date');
  const file = window._pendingJVFile;
  const pid = window._pendingJVPid;
  window._pendingJVFile = null;
  window._pendingJVPid = null;
  if(!file || !pid){ toast('Upload error — please try again','error'); return; }
  await _doDocUpload(file, pid, 'jv', jvDetails);
}

async function _doDocUpload(file, pid, slotId, jvDetails){
  setBusy(true, `Uploading ${file.name}…`);
  try {
    const url = await uploadDocument(file, pid, slotId);
    const p = GP(pid);
    if (!p.documents) p.documents = {};
    p.documents[slotId] = {
      url, name: file.name, size: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: CU.name
    };
    if(slotId === 'jv' && jvDetails){
      const d = typeof jvDetails === 'object' ? jvDetails : { jvDate: jvDetails };
      p.jvDate = d.jvDate || jvDetails;
      if(d.jvNumber) p.jvNumber = d.jvNumber;
      if(d.jvAmount) p.jvAmount = d.jvAmount;
      if(d.emd) p.emd = d.emd;
      if(d.fsd) p.fsd = d.fsd;
      if(d.jvNotes) p.jvNotes = d.jvNotes;
      if(!p.status || p.status === 'active'){
        p.status = 'completed';
        toast('✅ JV uploaded — project marked as Completed','ok',4000);
      }
    }
    await saveProjectDB(p);
    setBusy(false);
    toast(`✅ ${file.name} uploaded`, 'ok');
    const vaultEl = document.getElementById(`doc-vault-${pid}`);
    if (vaultEl) vaultEl.outerHTML = renderDocVault(p, CU.role === 'owner');
    else renderDetail(pid);
  } catch(e) {
    setBusy(false);
    toast('Upload failed: ' + e.message, 'error', 5000);
    console.error('Doc upload error:', e);
  }
}
function toggleEAEdit(pid){
  const editDiv = document.getElementById(`ea-input-${pid}-edit`);
  const isHidden = editDiv?.style.display === 'none';
  if(editDiv) editDiv.style.display = isHidden ? 'flex' : 'none';
  if(isHidden) document.getElementById(`ea-input-${pid}`)?.focus();
}
function toggleGenCodeEdit(pid){
  const editDiv = document.getElementById(`gencode-input-${pid}-edit`);
  const isHidden = editDiv?.style.display === 'none';
  if(editDiv) editDiv.style.display = isHidden ? 'flex' : 'none';
  if(isHidden) document.getElementById(`gencode-input-${pid}`)?.focus();
}

async function saveEANumber(pid) {
  const p = GP(pid); if (!p) return;
  const val = document.getElementById(`ea-input-${pid}`)?.value?.trim() || '';
  if (!p.documents) p.documents = {};
  p.documents['ea'] = val;
  p.eaNumber = val;
  try {
    await saveProjectDB(p);
    toast('✓ EA Number saved', 'ok');
    const vaultEl = document.getElementById(`doc-vault-${pid}`);
    if(vaultEl) vaultEl.outerHTML = renderDocVault(p, true);
    else renderDetail(pid);
  } catch(e) { toast('Save failed', 'error'); }
}

async function saveGenCode(pid) {
  const p = GP(pid); if (!p) return;
  const val = document.getElementById(`gencode-input-${pid}`)?.value?.trim() || '';
  if (!p.documents) p.documents = {};
  p.documents['gencode'] = val;
  p.genCode = val;
  try {
    await saveProjectDB(p);
    toast('✓ Gen Code saved', 'ok');
    const vaultEl = document.getElementById(`doc-vault-${pid}`);
    if(vaultEl) vaultEl.outerHTML = renderDocVault(p, true);
    else renderDetail(pid);
  } catch(e) { toast('Save failed', 'error'); }
}

async function saveDocLabel(pid, slotId, label) {
  const p = GP(pid); if (!p) return;
  if (!p.documents) p.documents = {};
  p.documents[slotId + '_label'] = label;
  try { await saveProjectDB(p); } catch(e) {}
}

async function deleteDocument(pid, slotId) {
  if (!confirm('Delete this document? This cannot be undone.')) return;
  const p = GP(pid); if (!p) return;
  if (!p.documents) return;
  // Note: we delete from DB record but the R2 file remains (R2 lifecycle rules handle cleanup)
  delete p.documents[slotId];
  try {
    await saveProjectDB(p);
    toast('Document deleted', 'ok');
    const vaultEl = document.getElementById(`doc-vault-${pid}`);
    if (vaultEl) vaultEl.outerHTML = renderDocVault(p, true);
    else renderDetail(pid);
  } catch(e) { toast('Delete failed', 'error'); }
}

// ─── UPDATE JV DETAILS (after initial upload) ─────────
// Shown via the yellow "JV Details Incomplete" banner
function openJVDetailsUpdate(pid){
  const p = GP(pid); if(!p) return;
  let modal = document.getElementById('modal-jv-details-update');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-jv-details-update'; document.body.appendChild(modal); }

  modal.innerHTML = `<div class="mbox" style="max-width:420px">
    <div class="mhdr"><h2>📋 Update JV Details</h2><button class="mx" onclick="CM('modal-jv-details-update')">✕</button></div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:14px">JV date: <strong>${fmtDate(p.jvDate)}</strong> — fill in the remaining details from the document.</div>
    <div class="frow">
      <div class="fg"><label>JV Number</label><input type="text" id="jvupd-number" value="${p.jvNumber||''}" placeholder="e.g. JV/2026/001"></div>
      <div class="fg"><label>JV Amount (₹)</label><input type="number" id="jvupd-amount" value="${p.jvAmount||''}" placeholder="Total sanctioned"></div>
    </div>
    <div class="frow">
      <div class="fg"><label>EMD Amount (₹)</label><input type="number" id="jvupd-emd" value="${p.emd||''}" placeholder="0"></div>
      <div class="fg"><label>FSD Amount (₹)</label><input type="number" id="jvupd-fsd" value="${p.fsd||''}" placeholder="0"></div>
    </div>
    <div class="fg"><label>Remarks / Notes</label><input type="text" id="jvupd-notes" value="${p.jvNotes||''}" placeholder="Any notes about this JV"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn" onclick="CM('modal-jv-details-update')">Cancel</button>
      <button class="btn btn-navy" onclick="saveJVDetailsUpdate('${pid}')">✓ Save Details</button>
    </div>
  </div>`;
  modal.classList.add('open');
}

async function saveJVDetailsUpdate(pid){
  const p = GP(pid); if(!p) return;
  const num = document.getElementById('jvupd-number')?.value?.trim();
  const amt = parseFloat(document.getElementById('jvupd-amount')?.value)||0;
  const emd = parseFloat(document.getElementById('jvupd-emd')?.value)||0;
  const fsd = parseFloat(document.getElementById('jvupd-fsd')?.value)||0;
  const notes = document.getElementById('jvupd-notes')?.value?.trim()||'';

  if(num) p.jvNumber = num;
  if(amt) p.jvAmount = amt;
  if(emd) p.emd = emd;
  if(fsd) p.fsd = fsd;
  if(notes) p.jvNotes = notes;

  try{
    await saveProjectDB(p);
    logActivity({category:'project',action:'jv_details_updated',projectId:pid,projectName:p.name,description:`JV details updated: JV #${num||p.jvNumber||'—'}, Amount ₹${fmt(amt||p.jvAmount||0)}`});
    CM('modal-jv-details-update');
    renderDetail(pid);
    toast('✓ JV details saved','ok');
  }catch(e){ toast('Save failed — try again','error'); }
}
