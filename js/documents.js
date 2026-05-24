// ═══════════════════════════════════════
// documents.js — Project Document Vault
// RSR Constructions Tracker v18
// Handles JV, Work Orders, WEC, EA Number
// Owner: upload/view/delete
// Contractor: view only
// ═══════════════════════════════════════

// Document slot definitions — every project has these
const DOC_SLOTS = [
  { id: 'jv',    label: 'Journal Voucher (JV)',          icon: '📋', accept: '.pdf,.jpg,.jpeg,.png', note: 'Upload after work completion & recording' },
  { id: 'ea',    label: 'EA Number',                     icon: '🔢', type: 'text', note: 'Accounts number — filled after 1-2 months of receiving JV' },
  { id: 'gencode', label: 'Gen Code',                    icon: '🏷️', type: 'text', note: 'Unique generation code for this tender' },
  { id: 'wec',   label: 'Work Experience Certificate',   icon: '🏆', accept: '.pdf,.jpg,.jpeg,.png', note: 'Upload after certificate is issued' },
  { id: 'wo',    label: 'Work Order',                    icon: '📄', accept: '.pdf,.jpg,.jpeg,.png', note: 'Original tender work order document' },
  { id: 'other1',label: 'Other Document 1',              icon: '📎', accept: '.pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx', customLabel: true },
  { id: 'other2',label: 'Other Document 2',              icon: '📎', accept: '.pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx', customLabel: true },
  { id: 'other3',label: 'Other Document 3',              icon: '📎', accept: '.pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx', customLabel: true },
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
      // EA Number — text input only
      return `<div class="doc-slot">
        <div class="doc-slot-header">
          <span class="doc-slot-icon">${slot.icon}</span>
          <div>
            <div class="doc-slot-title">${slot.label}</div>
            <div class="doc-slot-note">${slot.note}</div>
          </div>
        </div>
        ${isOwner ? `
          <div style="display:flex;gap:8px;align-items:center;margin-top:10px">
            <input type="text" id="ea-input-${p.id}" value="${doc || ''}"
              placeholder="${slot.id === 'ea' ? 'Enter EA number / Accounts number' : 'Enter Gen Code'}"
              style="flex:1;padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px"
              onkeydown="if(event.key==='Enter')saveEANumber('${p.id}')">
            <button class="btn btn-sm btn-navy" onclick="saveEANumber('${p.id}')">Save</button>
          </div>` :
          `<div style="margin-top:8px;font-size:14px;font-weight:600;color:var(--navy)">${doc || '<span style="color:var(--text3);font-weight:400">Not entered yet</span>'}</div>`
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

  await _doDocUpload(file, pid, slotId, null);
  evt.target.value = '';
}

async function confirmJVDate(){
  const jvDate = document.getElementById('jv-date-input')?.value;
  if(!jvDate){ toast('Please select the JV date','error'); return; }
  CM('modal-jv-date');
  const file = window._pendingJVFile;
  const pid = window._pendingJVPid;
  window._pendingJVFile = null;
  window._pendingJVPid = null;
  if(!file || !pid){ toast('Upload error — please try again','error'); return; }
  await _doDocUpload(file, pid, 'jv', jvDate);
}

async function _doDocUpload(file, pid, slotId, jvDate){
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
    if(slotId === 'jv' && jvDate){
      p.jvDate = jvDate;
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
async function saveEANumber(pid) {
  const p = GP(pid); if (!p) return;
  const val = document.getElementById(`ea-input-${pid}`)?.value?.trim() || '';
  if (!p.documents) p.documents = {};
  p.documents['ea'] = val;
  try {
    await saveProjectDB(p);
    toast('✓ EA Number saved', 'ok');
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
    renderDocVault(pid);
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
