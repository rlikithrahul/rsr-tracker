// ═══════════════════════════════════════
// boq.js — BOQ Upload & Management
// RSR Constructions Tracker v20
//
// 1. Parse AP eProcurement BOQ Excel
// 2. Editable preview before saving
// 3. Edit BOQ after project creation
// 4. BOQ visible to contractors (read-only)
// ═══════════════════════════════════════

let boqPreviewItems = []; // items parsed from Excel, shown in preview
let boqEditPid = null;    // project being edited

// ─── PARSE AP ePROCUREMENT BOQ EXCEL ─────────────────
// Format: col0=SNo, col1=SubworkName, col2=SpecNo, col3=Qty, col4=UOM, col5=Rate, col6=Amount
// Next row after each item = description (merged cell text)
// Items with Qty=0 OR Rate=0 are category headers — skip them

async function parseBOQExcel(file){
  if(!window.XLSX){
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  }
  const buffer = await file.arrayBuffer();
  const wb = window.XLSX.read(buffer, {type:'array', cellDates:false});
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = window.XLSX.utils.sheet_to_json(ws, {header:1, defval:''});

  // ── Extract metadata from header rows ──────────────
  let tenderId = '', tenderName = '', totalValue = 0;
  for(let i=0; i<Math.min(rows.length, 15); i++){
    const row = rows[i];
    const joined = row.map(c=>String(c||'').trim()).join('\t');
    // Tender ID: look for "Tender ID" followed by a number
    if(joined.includes('Tender ID') || joined.toLowerCase().includes('tender id')){
      for(let c=0; c<row.length; c++){
        const val = String(row[c]||'').trim();
        if(val === 'Tender ID' || val.toLowerCase() === 'tender id'){
          // Next non-empty cell is the ID
          for(let nc=c+1; nc<row.length; nc++){
            const nval = String(row[nc]||'').trim();
            if(nval && nval !== 'Tender ID') { tenderId = nval; break; }
          }
        }
      }
    }
    // Name of Work
    if(joined.includes('Name of Work') || joined.toLowerCase().includes('name of work')){
      for(let c=0; c<row.length; c++){
        const val = String(row[c]||'').trim();
        if(val.toLowerCase().includes('name of work')){
          // Concatenate remaining cells for the full name
          let name = '';
          for(let nc=c+1; nc<row.length; nc++){
            const nval = String(row[nc]||'').trim();
            if(nval) name += (name?' ':'') + nval;
          }
          if(name) tenderName = name;
        }
      }
    }
    // Total value: look for "Total(INR):" or similar
    if(joined.includes('Total(INR)') || joined.includes('Total (INR)')){
      const match = joined.match(/[\d,]+(?:\.\d+)?/g);
      if(match){
        const val = parseFloat(match[match.length-1].replace(/,/g,''));
        if(val > 0) totalValue = val;
      }
    }
  }

  // Also check last few rows for total
  for(let i=Math.max(0,rows.length-5); i<rows.length; i++){
    const joined = rows[i].map(c=>String(c||'').trim()).join('\t');
    if(joined.includes('Total(INR)') || joined.includes('Total (INR)')||joined.includes('Total:')){
      const match = joined.match(/[\d,]+(?:\.\d+)?/g);
      if(match){
        const val = parseFloat(match[match.length-1].replace(/,/g,''));
        if(val > 0) totalValue = val;
      }
    }
  }

  const items = [];
  for(let i=0; i<rows.length; i++){
    const row = rows[i];
    const col0 = String(row[0]||'').trim();
    const sno = parseFloat(col0);
    if(!isNaN(sno) && sno > 0 && col0 !== ''){
      const qty  = parseFloat(String(row[3]||'0').replace(/,/g,'')) || 0;
      const uom  = String(row[4]||'').trim();
      const rate = parseFloat(String(row[5]||'0').replace(/,/g,'')) || 0;
      const amt  = parseFloat(String(row[6]||'0').replace(/,/g,'')) || 0;
      if(qty <= 0 || rate <= 0) continue;
      let desc = '';
      if(i+1 < rows.length){
        const nextRow = rows[i+1];
        const nextCol0 = String(nextRow[0]||'').trim();
        if(isNaN(parseFloat(nextCol0)) || nextCol0 === ''){
          for(let c=0; c<nextRow.length; c++){
            const val = String(nextRow[c]||'').trim();
            if(val && val.length > 3){ desc = val; break; }
          }
        }
      }
      if(!desc) desc = `Item ${Math.round(sno)}`;
      items.push({
        id: uid(), sno: Math.round(sno),
        desc: desc.slice(0, 200),
        unit: uom || 'Job',
        qty, rate: Math.round(rate*100)/100,
        amount: Math.round(amt*100)/100,
        _selected: true
      });
    }
  }

  return { items, meta: { tenderId, tenderName, totalValue } };
}

// ─── BOQ UPLOAD UI (inside New Project modal) ─────────
function renderBOQUploadSection(){
  return `
    <div class="fg" style="margin-top:8px">
      <label>BOQ File Upload <span style="color:var(--text3);font-weight:400;text-transform:none">(AP eProcurement Excel — recommended)</span></label>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <label style="flex:1;cursor:pointer">
          <div style="border:2px dashed var(--border);border-radius:var(--rs);padding:12px 16px;display:flex;align-items:center;gap:10px;transition:border-color .2s" 
               onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
            <span style="font-size:24px">📊</span>
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--navy)">Upload BOQ Excel</div>
              <div style="font-size:11px;color:var(--text3)">Download from AP eProcurement and upload here (.xlsx or .xls)</div>
            </div>
          </div>
          <input type="file" id="boq-file-input" accept=".xlsx,.xls" style="display:none" onchange="handleBOQFileUpload(event)">
        </label>
        <button type="button" class="btn btn-sm" onclick="addManualBOQRow()" style="flex-shrink:0">+ Add Manually</button>
      </div>
      <div id="boq-parse-status" style="font-size:12px;margin-top:6px"></div>
    </div>

    <!-- BOQ Preview / Edit Table -->
    <div id="boq-preview-section" style="display:none;margin-top:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
        <div style="font-size:13px;font-weight:700;color:var(--navy)">BOQ Items <span id="boq-count-label" style="font-weight:400;color:var(--text3)"></span></div>
        <div style="font-size:11px;color:var(--text3)">Uncheck items you don't want to track. You can edit quantities, rates and units.</div>
      </div>
      <div id="boq-preview-table"></div>
      <button type="button" class="btn btn-sm" onclick="addManualBOQRow()" style="margin-top:8px">+ Add Item Manually</button>
    </div>`;
}

async function handleBOQFileUpload(evt){
  const file = evt.target.files[0];
  if(!file) return;
  const status = document.getElementById('boq-parse-status');
  status.innerHTML = '<span style="color:var(--text2)">⏳ Reading file…</span>';
  try {
    const result = await parseBOQExcel(file);
    const { items, meta } = result;
    if(!items.length){
      status.innerHTML = '<span style="color:var(--red)">⚠️ No valid BOQ items found. Check the file is an AP eProcurement BOQ Excel.</span>';
      return;
    }
    boqPreviewItems = items;

    // Auto-fill project form fields from Excel metadata
    let autofilled = [];
    if(meta.tenderName){
      const nameEl = document.getElementById('np-name');
      if(nameEl && !nameEl.value) { nameEl.value = meta.tenderName; autofilled.push('project name'); }
    }
    if(meta.tenderId){
      const tidEl = document.getElementById('np-tender');
      if(tidEl && !tidEl.value) { tidEl.value = meta.tenderId; autofilled.push('tender ID'); }
    }
    if(meta.totalValue > 0){
      const estEl = document.getElementById('np-est');
      if(estEl && !estEl.value) { estEl.value = Math.round(meta.totalValue); calcAgree(); autofilled.push('estimated value'); }
    }

    const autoMsg = autofilled.length ? ` Auto-filled: ${autofilled.join(', ')}.` : '';
    status.innerHTML = `<span style="color:var(--green)">✅ Found ${items.length} BOQ items.${autoMsg} Review below.</span>`;
    document.getElementById('boq-preview-section').style.display = 'block';
    renderBOQPreviewTable();
    window._boqFileName = file.name;
    window._boqFile = file;
  } catch(e) {
    status.innerHTML = `<span style="color:var(--red)">Error reading file: ${e.message}</span>`;
    console.error('BOQ parse error:', e);
  }
  evt.target.value = '';
}

function renderBOQPreviewTable(){
  const selected = boqPreviewItems.filter(x=>x._selected).length;
  const label = document.getElementById('boq-count-label');
  if(label) label.textContent = `(${selected} of ${boqPreviewItems.length} selected)`;

  const table = document.getElementById('boq-preview-table');
  if(!table) return;

  table.innerHTML = `
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:var(--navy);color:#fff">
          <th style="padding:6px 4px;text-align:center;width:28px">✓</th>
          <th style="padding:6px 8px;text-align:left">Description</th>
          <th style="padding:6px 4px;text-align:center;width:60px">Qty</th>
          <th style="padding:6px 4px;text-align:center;width:50px">Unit</th>
          <th style="padding:6px 4px;text-align:center;width:80px">Rate (₹)</th>
          <th style="padding:6px 4px;text-align:center;width:90px">Amount (₹)</th>
          <th style="padding:6px 4px;text-align:center;width:28px">🗑</th>
        </tr>
      </thead>
      <tbody>
        ${boqPreviewItems.map((item,idx)=>`
          <tr style="background:${item._selected?'var(--surface)':'rgba(0,0,0,.03)'};opacity:${item._selected?'1':'.5'};border-bottom:1px solid var(--border)">
            <td style="text-align:center;padding:4px">
              <input type="checkbox" ${item._selected?'checked':''} onchange="toggleBOQItem(${idx},this.checked)" style="cursor:pointer">
            </td>
            <td style="padding:4px 8px">
              <input type="text" value="${item.desc.replace(/"/g,'&quot;')}" 
                onchange="updateBOQItem(${idx},'desc',this.value)"
                style="width:100%;border:1px solid var(--border);border-radius:4px;padding:3px 6px;font-size:12px;font-family:'Inter',sans-serif">
            </td>
            <td style="padding:4px;text-align:center">
              <input type="number" value="${item.qty}" min="0" step="0.01"
                onchange="updateBOQItem(${idx},'qty',parseFloat(this.value)||0)"
                style="width:56px;border:1px solid var(--border);border-radius:4px;padding:3px 4px;font-size:12px;text-align:center">
            </td>
            <td style="padding:4px;text-align:center">
              <select onchange="updateBOQItem(${idx},'unit',this.value)"
                style="width:48px;border:1px solid var(--border);border-radius:4px;padding:3px 2px;font-size:11px">
                ${['Cum','Sqm','Rm','Kg','Nos','Job','Rmt','Lum','MT','Ltr'].map(u=>`<option ${item.unit===u?'selected':''}>${u}</option>`).join('')}
                <option ${!['Cum','Sqm','Rm','Kg','Nos','Job','Rmt','Lum','MT','Ltr'].includes(item.unit)?'selected':''}>${item.unit}</option>
              </select>
            </td>
            <td style="padding:4px;text-align:center">
              <input type="number" value="${item.rate}" min="0" step="0.01"
                onchange="updateBOQItem(${idx},'rate',parseFloat(this.value)||0);recalcBOQAmount(${idx})"
                style="width:76px;border:1px solid var(--border);border-radius:4px;padding:3px 4px;font-size:12px;text-align:right">
            </td>
            <td style="padding:4px;text-align:right;font-weight:600;color:var(--navy);padding-right:8px" id="boq-amt-${idx}">
              ${fmt(item.amount)}
            </td>
            <td style="text-align:center;padding:4px">
              <button type="button" onclick="removeBOQItem(${idx})" 
                style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px">✕</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
    </div>
    <div style="font-size:12px;font-weight:700;color:var(--navy);text-align:right;margin-top:6px;padding-right:8px">
      Total: ${fmt(boqPreviewItems.filter(x=>x._selected).reduce((s,x)=>s+x.amount,0))}
    </div>`;
}

function toggleBOQItem(idx, checked){ boqPreviewItems[idx]._selected = checked; renderBOQPreviewTable(); }
function updateBOQItem(idx, field, val){ boqPreviewItems[idx][field] = val; }
function recalcBOQAmount(idx){
  const item = boqPreviewItems[idx];
  item.amount = Math.round(item.qty * item.rate * 100) / 100;
  const el = document.getElementById(`boq-amt-${idx}`);
  if(el) el.textContent = fmt(item.amount);
}
function removeBOQItem(idx){ boqPreviewItems.splice(idx,1); renderBOQPreviewTable(); }

function addManualBOQRow(){
  boqPreviewItems.push({ id:uid(), sno:boqPreviewItems.length+1, desc:'New Item', unit:'Cum', qty:1, rate:0, amount:0, _selected:true });
  document.getElementById('boq-preview-section').style.display='block';
  renderBOQPreviewTable();
  // Scroll to bottom of table
  setTimeout(()=>{ const t=document.getElementById('boq-preview-table'); if(t) t.scrollTop=t.scrollHeight; },100);
}

function getBOQForSave(){
  return boqPreviewItems.filter(x=>x._selected).map(x=>({
    id: x.id, sno: x.sno, desc: x.desc, unit: x.unit,
    qty: parseFloat(x.qty)||0, rate: parseFloat(x.rate)||0,
    amount: parseFloat(x.amount)||0
  }));
}

// ─── BOQ EDIT MODAL (existing projects) ───────────────
function openEditBOQ(pid){
  const p = GP(pid); if(!p) return;
  boqEditPid = pid;
  // Load existing BOQ into preview
  boqPreviewItems = (p.boq||[]).map(item=>({...item, _selected:true}));
  if(!boqPreviewItems.length) boqPreviewItems = [];

  const originalTotal = (p.boq||[]).reduce((s,x)=>s+x.amount,0);
  const tenderValue = p.estimated || originalTotal;

  const modal = document.getElementById('modal-edit-boq');
  const body  = document.getElementById('edit-boq-body');
  body.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:4px">${p.name}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:14px;padding:10px;background:var(--surface2);border-radius:var(--rs)">
      <div style="font-size:12px"><div style="color:var(--text3)">Original Tender Value</div><div style="font-weight:700;color:var(--navy)">${fmt(tenderValue)}</div></div>
      <div style="font-size:12px"><div style="color:var(--text3)">Current BOQ Total</div><div style="font-weight:700;color:var(--navy)" id="boq-current-total">${fmt(originalTotal)}</div></div>
      <div style="font-size:12px"><div style="color:var(--text3)">Difference</div><div style="font-weight:700" id="boq-diff">${fmt(originalTotal - tenderValue)}</div></div>
    </div>
    <div style="margin-bottom:12px">
      <label style="cursor:pointer;display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:var(--surface2);border:1.5px dashed var(--border);border-radius:var(--rs);font-size:13px;font-weight:600;color:var(--navy)">
        📊 Upload New BOQ Excel (replaces current)
        <input type="file" accept=".xlsx,.xls" style="display:none" onchange="handleBOQReplaceUpload(event,'${pid}')">
      </label>
    </div>
    <div id="boq-preview-table"></div>
    <button type="button" class="btn btn-sm" onclick="addManualBOQRow()" style="margin-top:8px">+ Add Item</button>`;

  // Use setTimeout to ensure DOM is updated before rendering table
  setTimeout(()=>{
    renderBOQPreviewTable();
    updateBOQValueTracking(tenderValue);
  }, 50);
  modal.classList.add('open');
}

function updateBOQValueTracking(tenderValue){
  const currentTotal = boqPreviewItems.filter(x=>x._selected).reduce((s,x)=>s+(parseFloat(x.amount)||0),0);
  const diff = currentTotal - (tenderValue||0);
  const totalEl = document.getElementById('boq-current-total');
  const diffEl = document.getElementById('boq-diff');
  if(totalEl) totalEl.textContent = fmt(currentTotal);
  if(diffEl){
    diffEl.textContent = (diff >= 0 ? '+' : '') + fmt(diff);
    diffEl.style.color = diff > 0 ? 'var(--red)' : diff < 0 ? 'var(--green)' : 'var(--text2)';
  }
}

async function handleBOQReplaceUpload(evt, pid){
  const file = evt.target.files[0]; if(!file) return;
  try {
    setBusy(true,'Parsing BOQ…');
    const result = await parseBOQExcel(file);
    setBusy(false);
    const items = result.items || result; // handle both old and new format
    if(!items.length){ toast('No valid items found','error'); return; }
    boqPreviewItems = items;
    window._boqFile = file;
    window._boqFileName = file.name;
    renderBOQPreviewTable();
    toast(`✅ ${items.length} items loaded — review and save`,'ok');
  } catch(e){ setBusy(false); toast('Parse error: '+e.message,'error'); }
  evt.target.value='';
}

async function saveEditBOQ(){
  const p = GP(boqEditPid); if(!p) return;
  const newBOQ = getBOQForSave();
  if(!newBOQ.length){ toast('Add at least one BOQ item','error'); return; }
  p.boq = newBOQ;
  try {
    // If a new BOQ file was uploaded during edit, store it
    if(window._boqFile && window._boqFileName){
      setBusy(true,'Uploading BOQ file…');
      try {
        const url = await uploadDocument(window._boqFile, p.id, 'boq');
        if(!p.documents) p.documents={};
        p.documents['boq'] = { url, name: window._boqFileName, uploadedAt: new Date().toISOString(), uploadedBy: CU.name };
        window._boqFile = null; window._boqFileName = null;
      } catch(e){ console.warn('BOQ file upload failed:', e); }
      setBusy(false);
    }
    await saveProjectDB(p);
    CM('modal-edit-boq');
    boqEditPid = null;
    boqPreviewItems = [];
    renderDetail(p.id);
    toast('✅ BOQ updated','ok');
  } catch(e){ setBusy(false); toast('Save failed: '+e.message,'error'); }
}

// ─── BOQ CONTRACTOR VIEW ──────────────────────────────
function renderBOQContractorView(p){
  const boq = p.boq||[];
  if(!boq.length) return `<div style="font-size:13px;color:var(--text3);font-style:italic">No BOQ items set for this project.</div>`;

  const total = boq.reduce((s,x)=>s+x.amount,0);
  return `
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:var(--navy);color:#fff">
          <th style="padding:6px 8px;text-align:left">Item Description</th>
          <th style="padding:6px 4px;text-align:center;width:60px">Qty</th>
          <th style="padding:6px 4px;text-align:center;width:50px">Unit</th>
          <th style="padding:6px 4px;text-align:right;width:90px">Rate (₹)</th>
          <th style="padding:6px 4px;text-align:right;width:90px">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${boq.map(item=>`
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:6px 8px;font-size:12px">${item.desc}</td>
            <td style="padding:6px 4px;text-align:center">${item.qty}</td>
            <td style="padding:6px 4px;text-align:center;color:var(--text3)">${item.unit}</td>
            <td style="padding:6px 4px;text-align:right">${fmt(item.rate)}</td>
            <td style="padding:6px 4px;text-align:right;font-weight:600">${fmt(item.amount)}</td>
          </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr style="background:var(--surface2);font-weight:700">
          <td colspan="4" style="padding:6px 8px">Total BOQ Value</td>
          <td style="padding:6px 4px;text-align:right;color:var(--navy)">${fmt(total)}</td>
        </tr>
      </tfoot>
    </table>
    </div>`;
}
