// ═══════════════════════════════════════════════════════
// cashregister.js — Cash Drawer Register Archive
// Stores scanned/photographed physical cash register sheets (the paper
// ledger, one sheet per period) so any date's cash transactions can be
// looked up and the right physical sheet found without digging through
// a filing cabinet. Not tied to any project — this is office-level cash,
// not project-specific.
// ═══════════════════════════════════════════════════════

const CASH_REGISTER_KEY = 'rsr_cash_register_sheets';

async function loadCashRegisterSheets(){
  if(D.cashRegisterSheets) return D.cashRegisterSheets;
  D.cashRegisterSheets = await getSetting(CASH_REGISTER_KEY, []);
  return D.cashRegisterSheets;
}
async function saveCashRegisterSheets(){
  D.cashRegisterSheets = await mergeAndSaveSetting(CASH_REGISTER_KEY, D.cashRegisterSheets||[], true);
}

async function uploadCashRegisterFile(file, sheetNo){
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `cash-register/sheet_${sheetNo}_${Date.now()}_${safeName}`;
  return await r2UploadViaWorker(file, R2_DOCS_BUCKET, key);
}

// ─── MAIN RENDER ───────────────────────────────────────
async function renderCashRegister(){
  const el = document.getElementById('sec-cashreg');
  if(!el) return;
  el.innerHTML = '<div class="wrap"><div class="loading" style="padding:40px;text-align:center;color:var(--text3)">⏳ Loading…</div></div>';
  try{ await loadCashRegisterSheets(); }catch(e){ console.error(e); }
  _renderCashRegisterTab();
}

let _cashRegLookupDate = '';

function _renderCashRegisterTab(){
  const el = document.getElementById('sec-cashreg');
  if(!el) return;
  const sheets = (D.cashRegisterSheets||[]).filter(s=>!s._archived).sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||''));

  // Date lookup: find which sheet(s) cover the entered date
  let lookupResult = '';
  if(_cashRegLookupDate){
    const matches = sheets.filter(s=>s.startDate && s.endDate && _cashRegLookupDate>=s.startDate && _cashRegLookupDate<=s.endDate);
    lookupResult = `<div class="card" style="border-top:3px solid ${matches.length?'var(--green)':'var(--red)'};margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">
        🔎 ${fmtDate(_cashRegLookupDate)} belongs to:
      </div>
      ${matches.length ? matches.map(s=>_sheetRow(s,true)).join('') : '<div style="font-size:13px;color:var(--red)">No uploaded sheet covers this date yet. Check the list below, or this sheet may not be scanned/uploaded yet.</div>'}
    </div>`;
  }

  el.innerHTML = `<div class="wrap">
    <div class="pg-hdr">
      <div><div class="pg-title">🗄️ Cash Drawer Register Archive</div>
        <div style="font-size:12px;color:var(--text3)">${sheets.length} sheet${sheets.length!==1?'s':''} on file — office cash transactions, not tied to any project</div></div>
      <button class="btn btn-navy" onclick="openCashRegisterUploadModal()">+ Upload Sheet</button>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">🔎 Find the sheet for a specific date</div>
      <input type="date" value="${_cashRegLookupDate}" onchange="_cashRegLookupDate=this.value;_renderCashRegisterTab()" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--rs);font-size:13px">
    </div>

    ${lookupResult}

    <div class="card">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">All Uploaded Sheets</div>
      ${!sheets.length ? '<div style="font-size:13px;color:var(--text3);font-style:italic;padding:10px 0">No sheets uploaded yet — click "+ Upload Sheet" above to add the first one.</div>' : sheets.map(s=>_sheetRow(s,false)).join('')}
    </div>
  </div>`;
}

function _sheetRow(s, highlighted){
  return `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding:12px;border:1px solid ${highlighted?'var(--green)':'var(--border)'};border-radius:var(--rs);margin-bottom:8px;background:${highlighted?'#eaf5ee':'#fff'}">
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--navy)">Sheet No. ${s.sheetNo}</div>
      <div style="font-size:12px;color:var(--text2)">${fmtDate(s.startDate)} → ${fmtDate(s.endDate)}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">👤 ${s.uploadedBy||'—'} · ${fmtDateTime?fmtDateTime(s.uploadedAt):fmtDate((s.uploadedAt||'').split('T')[0])}</div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <a href="${s.fileUrl}" target="_blank" class="btn btn-sm">👁 View</a>
      <a href="${s.fileUrl}" download="${s.fileName||('Sheet_'+s.sheetNo)}" class="btn btn-sm btn-navy">⬇️ Download</a>
      ${CU&&CU.isSuperAdmin?`<button class="btn btn-sm" style="color:var(--red);border-color:var(--red)" onclick="deleteCashRegisterSheet('${s.id}')">🗑️</button>`:''}
    </div>
  </div>`;
}

// ─── UPLOAD MODAL ──────────────────────────────────────
function openCashRegisterUploadModal(){
  let modal = document.getElementById('modal-cashreg-upload');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-cashreg-upload'; document.body.appendChild(modal); }
  modal.innerHTML = `<div class="mbox" style="max-width:480px">
    <div class="mhdr"><h2>🗄️ Upload Cash Register Sheet</h2><button class="mx" onclick="CM('modal-cashreg-upload')">✕</button></div>
    <div class="fg"><label>Sheet No.</label><input type="text" id="cr-sheetno" placeholder="e.g. 1, 2, 3…"></div>
    <div class="frow">
      <div class="fg"><label>Sheet Starts (Opening Date)</label><input type="date" id="cr-startdate"></div>
      <div class="fg"><label>Sheet Closes (Last Date on Sheet)</label><input type="date" id="cr-enddate"></div>
    </div>
    <div class="fg"><label>File (PDF or Photo/Scan)</label><input type="file" id="cr-file" accept=".pdf,.jpg,.jpeg,.png"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn" onclick="CM('modal-cashreg-upload')">Cancel</button>
      <button class="btn btn-navy" onclick="saveCashRegisterUpload()">⬆️ Upload</button>
    </div>
  </div>`;
  modal.classList.add('open');
}

async function saveCashRegisterUpload(){
  const sheetNo = document.getElementById('cr-sheetno')?.value.trim();
  const startDate = document.getElementById('cr-startdate')?.value;
  const endDate = document.getElementById('cr-enddate')?.value;
  const fileInput = document.getElementById('cr-file');
  const file = fileInput?.files?.[0];
  if(!sheetNo){ toast('Enter the sheet number','error'); return; }
  if(!startDate || !endDate){ toast('Enter both the opening and closing date for this sheet','error'); return; }
  if(startDate>endDate){ toast('Opening date must be before the closing date','error'); return; }
  if(!file){ toast('Choose a file to upload','error'); return; }

  setBusy(true, 'Uploading '+file.name+'…');
  try{
    const url = await uploadCashRegisterFile(file, sheetNo);
    if(!D.cashRegisterSheets) D.cashRegisterSheets=[];
    D.cashRegisterSheets.push({
      id: 'creg_'+uid(), sheetNo, startDate, endDate,
      fileUrl: url, fileName: file.name, fileType: file.type,
      uploadedBy: CU?CU.name:'Unknown', uploadedAt: new Date().toISOString()
    });
    await saveCashRegisterSheets();
    setBusy(false);
    CM('modal-cashreg-upload');
    _renderCashRegisterTab();
    logActivity({category:'system',action:'cash_register_uploaded',description:(CU?CU.name:'User')+' uploaded Cash Register Sheet No. '+sheetNo+' ('+fmtDate(startDate)+' to '+fmtDate(endDate)+')'});
    toast('✓ Sheet uploaded','ok');
  }catch(e){
    setBusy(false);
    toast('Upload failed: '+e.message,'error',5000);
  }
}

async function deleteCashRegisterSheet(id){
  const s = (D.cashRegisterSheets||[]).find(x=>x.id===id); if(!s) return;
  const ok = await showConfirm({title:'Delete Sheet Record?',message:'This removes Sheet No. '+s.sheetNo+' from the archive list. The uploaded file itself is not deleted from storage, only its listing here — recoverable by re-adding the same file if needed.',confirmLabel:'Yes, Delete'});
  if(!ok) return;
  s._archived = true; s._archivedAt = new Date().toISOString();
  try{
    await saveCashRegisterSheets();
    _renderCashRegisterTab();
    toast('✓ Removed from list','ok');
  }catch(e){
    delete s._archived; delete s._archivedAt;
    toast('Save failed — try again','error');
  }
}
