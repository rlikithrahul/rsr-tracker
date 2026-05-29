// ═══════════════════════════════════════
// finance.js
// RSR Constructions Tracker v17
// ═══════════════════════════════════════

// ═══════════════════════════════════════════════════════
// FUNDS LOG
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// TALLY IMPORT ENGINE
// ═══════════════════════════════════════════════════════

// ─── DAYBOOK CALENDAR ─────────────────────────────────
// 4 states: green=uploaded, red=missing, orange=checked/empty, grey=sunday
// Orange state persists in localStorage
// All days clickable including Sundays

const CAL_ORANGE_KEY = 'rsr_cal_orange_days'; // days marked as checked/no transactions

function getOrangeDays(){
  try{ return new Set(JSON.parse(localStorage.getItem(CAL_ORANGE_KEY)||'[]')); }catch(e){return new Set();}
}
function setOrangeDay(dateStr, isOrange){
  try{
    const days = getOrangeDays();
    if(isOrange) days.add(dateStr); else days.delete(dateStr);
    localStorage.setItem(CAL_ORANGE_KEY, JSON.stringify([...days]));
  }catch(e){}
}

function getDaybookUploadedDates(){
  const dateSet = new Set();
  D.projects.forEach(p=>{
    (p.releases||[]).forEach(r=>{
      if((r.source==='tally'||r.source==='tally-manual') && r.date)
        dateSet.add(r.date.split('T')[0]);
    });
  });
  try{
    const log = JSON.parse(localStorage.getItem('rsr_daybook_log')||'[]');
    log.forEach(d=>dateSet.add(d));
  }catch(e){}
  return dateSet;
}

function recordDaybookUpload(dateStr){
  try{
    const log = JSON.parse(localStorage.getItem('rsr_daybook_log')||'[]');
    if(!log.includes(dateStr)) log.push(dateStr);
    localStorage.setItem('rsr_daybook_log', JSON.stringify(log));
  }catch(e){}
}

function renderDaybookCalendar(){
  const uploadedDates = getDaybookUploadedDates();
  const orangeDays = getOrangeDays();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const year = calViewYear, month = calViewMonth;
  const monthNames = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const dayNames = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  let greenCount=0, redCount=0, orangeCount=0;
  for(let d=1;d<=daysInMonth;d++){
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if(ds > todayStr) continue;
    if(uploadedDates.has(ds)) greenCount++;
    else if(orangeDays.has(ds)) orangeCount++;
    else redCount++;
  }

  let html = `<div style="max-width:420px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-size:14px;font-weight:700;color:var(--navy)">${monthNames[month]} ${year}</div>
      <div style="display:flex;gap:4px">
        <button onclick="calNavMonth(-1)" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:14px;color:var(--text2)">‹</button>
        <button onclick="calNavMonth(0)" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px;color:var(--text3)">Today</button>
        <button onclick="calNavMonth(1)" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:14px;color:var(--text2)">›</button>
      </div>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:10px;font-size:11px;flex-wrap:wrap">
      <span>🟢 ${greenCount} uploaded</span>
      <span style="color:var(--red)">🔴 ${redCount} missing</span>
      ${orangeCount?`<span style="color:var(--amber)">🟠 ${orangeCount} checked/empty</span>`:''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:8px">
      ${dayNames.map(d=>`<div style="text-align:center;font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;padding:3px 0">${d}</div>`).join('')}
      ${Array(firstDayOfWeek).fill('<div></div>').join('')}`;

  for(let d=1; d<=daysInMonth; d++){
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isSunday = new Date(year,month,d).getDay()===0;
    const isFuture = ds > todayStr;
    const isToday = ds === todayStr;
    const isUploaded = uploadedDates.has(ds);
    const isOrange = orangeDays.has(ds) && !isUploaded;

    let bg, color, cursor='pointer', border='none', title='';
    if(isFuture){
      bg='var(--surface2)'; color='var(--text3)'; cursor='default';
    } else if(isUploaded){
      bg='#d4edda'; color='#155724'; title=`${ds} ✅ Uploaded`;
    } else if(isOrange){
      bg='#fff3cd'; color='#856404'; title=`${ds} 🟠 Checked — no transactions. Click to reset.`;
    } else if(isSunday){
      bg='#e9ecef'; color='#6c757d'; title=`${ds} Sunday — click to upload daybook`;
    } else {
      bg='#fde8e8'; color='#c0392b'; title=`${ds} ❌ Missing — click to import`;
    }
    if(isToday) border='2px solid var(--navy)';

    const onclick = isFuture ? '' : `onclick="calDayClick('${ds}')"`;

    html += `<div ${onclick} title="${title}"
      class="cal-day-cell"
      style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;
             border-radius:5px;font-size:11px;font-weight:600;cursor:${cursor};
             background:${bg};color:${color};border:${border};
             transition:transform .1s;${!isFuture?'user-select:none':''}">
      ${d}
    </div>`;
  }

  html += `</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:10px;color:var(--text3)">
      <span>🟢 Uploaded</span>
      <span>🔴 Missing (click to import)</span>
      <span>🟠 Checked/empty (right-click to reset)</span>
      <span style="background:#e9ecef;padding:1px 6px;border-radius:3px;color:#6c757d">Su Sunday</span>
    </div>
  </div>`;

  return html;
}

function calNavMonth(dir){
  if(dir===0){ calViewYear=new Date().getFullYear(); calViewMonth=new Date().getMonth(); }
  else{
    calViewMonth+=dir;
    if(calViewMonth>11){calViewMonth=0;calViewYear++;}
    if(calViewMonth<0){calViewMonth=11;calViewYear--;}
  }
  const calEl=document.getElementById('daybook-calendar');
  if(calEl) calEl.innerHTML=renderDaybookCalendar();
}

function calDayClick(dateStr){
  const uploadedDates = getDaybookUploadedDates();
  const orangeDays = getOrangeDays();

  if(uploadedDates.has(dateStr)){
    // Already uploaded — show info toast
    toast(`✅ Daybook already imported for ${dateStr}`,'ok',2000);
    return;
  }

  if(orangeDays.has(dateStr)){
    // Orange → reset back to red
    setOrangeDay(dateStr, false);
    const calEl=document.getElementById('daybook-calendar');
    if(calEl) calEl.innerHTML=renderDaybookCalendar();
    toast(`Reset ${dateStr} back to unchecked`,'ok',2000);
    return;
  }

  // Red or grey → show options: upload daybook OR mark as checked
  const isToday = dateStr === new Date().toISOString().split('T')[0];
  const choice = confirm(
    `📅 ${dateStr}\n\nWhat do you want to do?\n\n` +
    `• Click OK to scroll to Upload and import daybook for this date\n` +
    `• Click Cancel, then use the "Mark as Checked" button if you verified there are no transactions`
  );

  if(choice){
    prefillDaybookDate(dateStr);
  }
}

function markDayChecked(dateStr){
  setOrangeDay(dateStr, true);
  const calEl=document.getElementById('daybook-calendar');
  if(calEl) calEl.innerHTML=renderDaybookCalendar();
  toast(`🟠 ${dateStr} marked as checked — no transactions`,'ok',2000);
}

function prefillDaybookDate(dateStr){
  // tally-type selector removed — auto-detection handles file type
  const uploadCard=document.getElementById('tally-upload-card');
  if(uploadCard){
    uploadCard.scrollIntoView({behavior:'smooth',block:'start'});
    uploadCard.style.outline='2px solid var(--red)';
    setTimeout(()=>{uploadCard.style.outline='';},3000);
  }
  toast(`Upload daybook for ${dateStr}`,'ok',3000);
}

function renderFunds(){
  const all=[];
  D.projects.forEach(p=>{(p.releases||[]).filter(r=>!isArchived(r)).forEach(r=>{const c=GC(p.contractorId);all.push({...r,project:p.name,contractor:c?c.name:'—',pid:p.id});});});
  all.sort((a,b)=>new Date(b.date)-new Date(a.date));
  const totPay=all.filter(r=>r.txType!=='receipt').reduce((s,r)=>s+r.amount,0);
  const totRec=all.filter(r=>r.txType==='receipt').reduce((s,r)=>s+r.amount,0);
  const tot=Math.max(0,totPay-totRec);
  const ccMap = D.projects.filter(p=>p.costCentre).map(p=>`<tr><td style="font-family:monospace;font-size:12px">${p.costCentre}</td><td style="font-weight:700;color:var(--navy)">${p.name}</td><td>${GC(p.contractorId)?.name||'—'}</td></tr>`).join('');

  document.getElementById('tally-wrap').innerHTML=`
    <div class="pg-hdr"><div class="pg-title">📂 Tally Import</div></div>

    <!-- DAYBOOK CALENDAR -->
    <div class="card" style="border-top:4px solid var(--navy)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div class="st" style="margin:0;border:none;padding:0">📅 Daybook Upload Calendar</div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <input type="date" id="mark-checked-date" value="${new Date().toISOString().split('T')[0]}"
            style="padding:5px 8px;font-size:12px;border:1px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif">
          <button class="btn btn-sm" onclick="markDayChecked(document.getElementById('mark-checked-date').value)"
            style="background:#fff3cd;color:#856404;border:1px solid #ffc107;white-space:nowrap;font-size:12px">🟠 Mark Checked</button>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:12px">
        🔴 Missing → click day to import &nbsp;·&nbsp; 🟠 Checked/no transactions → click to reset &nbsp;·&nbsp; 🟢 Uploaded
      </div>
      <div id="daybook-calendar">${renderDaybookCalendar()}</div>
    </div>

    <!-- UPLOAD PANEL -->
    <div class="card" id="tally-upload-card" style="border-top:4px solid var(--gold)">
      <div class="st">Upload Tally Export</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:12px">
        Upload any Tally export — Day Book, Monthly Day Book, or Cost Centre report. Exported as XLS or XLSX from Tally.
        The app auto-detects the file type, reads every transaction, matches by Cost Centre name, and imports into the correct project.
      </div>
      <div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:var(--rs);padding:10px 14px;margin-bottom:14px;font-size:12px">
        <strong style="color:#2e7d32">✅ Supported formats (auto-detected):</strong><br>
        📄 <strong>Day Book</strong> — single day export &nbsp;·&nbsp;
        📅 <strong>Monthly Day Book</strong> — date range export &nbsp;·&nbsp;
        🏷️ <strong>Cost Centre Report</strong> — per-project report<br>
        <span style="color:var(--text3);margin-top:4px;display:block">Payments (Debit) add to deployed amount. Receipts (Credit) reduce it. Both are imported automatically.</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div class="fg">
          <label>File Type</label>
          <select id="tally-type" style="padding:8px;border:1px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px;width:100%">
            <option value="daybook">📄 Day Book (single day)</option>
            <option value="monthly">📅 Monthly Day Book (date range)</option>
            <option value="costcentre">🏷️ Cost Centre Report</option>
          </select>
        </div>
        <div class="fg">
          <label>Select File (XLS or XLSX from Tally)</label>
          <input type="file" id="tally-file" accept=".xls,.xlsx" style="padding:8px">
        </div>
      </div>
      <button class="btn btn-navy" onclick="processTallyFile()" style="padding:10px 28px;font-size:14px">⚡ Process & Import</button>
      <div id="tally-progress" style="display:none;margin-top:12px">
        <div class="alert al-navy">⏳ Reading file and matching transactions…</div>
      </div>
    </div>

    <!-- MONTHLY VERIFICATION RESULTS -->
    <div id="monthly-verify-section" style="display:none"></div>

    <!-- UNMATCHED PAYMENTS -->
    <div id="tally-unmatched-section" style="${tallyUnmatched.length?'':'display:none'}">
      <div class="card" style="border-top:4px solid var(--amber)">
        <div class="st" style="color:var(--amber)">⚠️ Unmatched Payments (${tallyUnmatched.length}) — Needs Manual Assignment</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:12px">These payment transactions did not match any project's Cost Centre. Assign them to a project or delete them.</div>
        ${tallyUnmatched.map((t,i)=>`
          <div style="background:var(--amber-bg);border:1px solid #f5d5a0;border-radius:var(--rs);padding:12px;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:8px">
              <div>
                <div style="font-weight:700;font-size:13px">${t.date} · Vch #${t.vchNo} <span style="font-size:11px;background:#fff3cd;color:#856404;padding:1px 6px;border-radius:3px">PAYMENT</span></div>
                <div style="font-size:12px;color:var(--text2)">${t.ledger} · CC: <span style="font-family:monospace">${t.costCentre||'(no cost centre)'}</span></div>
                <div style="font-size:12px;color:var(--text3)">${t.narration||''}</div>
                ${t._fuzzyMatch?`<div style="font-size:12px;background:#fffde7;border:1px solid #f9a825;border-radius:4px;padding:4px 8px;margin-top:4px">
                  🔍 Did you mean: <strong>${t._fuzzyMatch.name}</strong>? (${t._fuzzyMatch.dist} char difference)
                  <button class="btn btn-sm" style="margin-left:8px;padding:2px 8px;font-size:11px" onclick="quickAssignUnmatched(${t._fuzzyMatch.id?`'${t._fuzzyMatch.id}'`:'null'},${`${tallyUnmatched.indexOf(t)}`},false)">✓ Yes, assign</button>
                </div>`:''}
              </div>
              <div style="font-size:18px;font-weight:800;color:var(--navy)">₹${t.amount.toLocaleString('en-IN')}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <select id="um-assign-p-${i}" style="flex:1;padding:7px;border:1px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px">
                <option value="">— Assign to project —</option>
                ${D.projects.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}
              </select>
              <button class="btn btn-sm btn-navy" onclick="assignUnmatched(${i},false)">✓ Assign</button>
              <button class="btn btn-sm" style="color:var(--red)" onclick="deleteUnmatched(${i},false)">🗑️ Delete</button>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <!-- UNMATCHED RECEIPTS -->
    <div id="tally-unmatched-receipts-section" style="${tallyUnmatchedReceipts.length?'':'display:none'}">
      <div class="card" style="border-top:4px solid var(--green)">
        <div class="st" style="color:var(--green)">📥 Unmatched Receipts (${tallyUnmatchedReceipts.length}) — Needs Manual Assignment</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:12px">These receipt transactions (money received from contractor/govt) did not match any project. Assign to a project to reduce net deployed amount.</div>
        ${tallyUnmatchedReceipts.map((t,i)=>`
          <div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:var(--rs);padding:12px;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:8px">
              <div>
                <div style="font-weight:700;font-size:13px">${t.date} · Vch #${t.vchNo} <span style="font-size:11px;background:#c8e6c9;color:#2e7d32;padding:1px 6px;border-radius:3px">RECEIPT</span></div>
                <div style="font-size:12px;color:var(--text2)">${t.ledger} · CC: <span style="font-family:monospace">${t.costCentre||'(no cost centre)'}</span></div>
                <div style="font-size:12px;color:var(--text3)">${t.narration||''}</div>
                ${t._fuzzyMatch?`<div style="font-size:12px;background:#fffde7;border:1px solid #f9a825;border-radius:4px;padding:4px 8px;margin-top:4px">
                  🔍 Did you mean: <strong>${t._fuzzyMatch.name}</strong>? (${t._fuzzyMatch.dist} char difference)
                  <button class="btn btn-sm" style="margin-left:8px;padding:2px 8px;font-size:11px" onclick="quickAssignUnmatched('${t._fuzzyMatch.id}',${`${tallyUnmatchedReceipts.indexOf(t)}`},true)">✓ Yes, assign</button>
                </div>`:''}
              </div>
              <div style="font-size:18px;font-weight:800;color:var(--green)">₹${t.amount.toLocaleString('en-IN')}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <select id="um-assign-r-${i}" style="flex:1;padding:7px;border:1px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px">
                <option value="">— Assign to project —</option>
                ${D.projects.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}
              </select>
              <button class="btn btn-sm" style="background:var(--green);color:#fff" onclick="assignUnmatched(${i},true)">✓ Assign</button>
              <button class="btn btn-sm" style="color:var(--red)" onclick="deleteUnmatched(${i},true)">🗑️ Delete</button>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <!-- ALL TRANSACTIONS LOG -->
    <div class="card">
      <div class="st">All Tally Transactions — All Projects</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:12px">
        Total payments: <strong style="color:var(--navy)">${fmt(totPay)}</strong> &nbsp;·&nbsp;
        Total receipts: <strong style="color:var(--green)">${fmt(totRec)}</strong> &nbsp;·&nbsp;
        Net deployed: <strong style="color:var(--navy)">${fmt(Math.max(0,totPay-totRec))}</strong>
      </div>
      ${all.length?`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Project</th><th>Contractor</th><th>Vch No</th><th>Narration</th><th style="text-align:right">Amount</th></tr></thead><tbody>
        ${all.map(r=>`<tr style="${r.txType==='receipt'?'background:#f0faf0':''}">
          <td style="white-space:nowrap">${r.date}</td>
          <td><span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;${r.txType==='receipt'?'background:#c8e6c9;color:#2e7d32':'background:#fff3cd;color:#856404'}">${r.txType==='receipt'?'RECEIPT':'PAYMENT'}</span></td>
          <td><a href="#" onclick="openDetail('${r.pid}');return false" style="color:var(--navy);font-weight:700">${r.project}</a></td>
          <td>${r.contractor}</td>
          <td style="font-family:monospace;font-size:11px">${r.ref||'—'}</td>
          <td style="font-size:12px;color:var(--text2);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.notes||''}">${r.notes||'—'}</td>
          <td style="text-align:right;font-weight:700;color:${r.txType==='receipt'?'var(--green)':'var(--navy)'}">${r.txType==='receipt'?'−':''}${fmt(r.amount)}</td>
        </tr>`).join('')}</tbody></table></div>`
      :'<div style="color:var(--text3);font-size:13px;padding:20px 0;text-align:center">No transactions imported yet. Upload a Tally file above.</div>'}
    </div>

    <!-- COST CENTRE MAPPING -->
    <div class="card">
      <div class="st">Cost Centre → Project Mapping</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:12px">These are the Tally Cost Centre names registered for each project. Transactions matching these names are auto-imported.</div>
      ${ccMap?`<div class="tbl-wrap"><table><thead><tr><th>Tally Cost Centre Name</th><th>Project</th><th>Contractor</th></tr></thead><tbody>${ccMap}</tbody></table></div>`
      :'<div style="color:var(--text3);font-size:13px">No cost centres registered yet. Edit each project to add the Tally Cost Centre name.</div>'}
    </div>`;
}

// ─── PARSE TALLY FILE ─────────────────────────────────
async function processTallyFile(){
  const fileInput=document.getElementById('tally-file');
  const typeEl=document.getElementById('tally-type');
  const type=typeEl?typeEl.value:'daybook';
  if(!fileInput.files.length){toast('Select a file first','error');return;}
  const file=fileInput.files[0];
  document.getElementById('tally-progress').style.display='block';
  setBusy(true,'Reading Tally file…');
  try{
    const transactions=await parseTallyXLSReal(file, type);
    if(!transactions.length){
      toast('No transactions found. Check file type selection and format.','error',5000);
      setBusy(false);
      document.getElementById('tally-progress').style.display='none';
      return;
    }
    document.getElementById('tally-progress').style.display='none';
    fileInput.value='';
    setBusy(false);
    if(type==='monthly'){
      // Monthly daybook — run verification against existing imports
      await matchAndImport(transactions);
      renderFunds();
      setTimeout(()=>{const c=document.getElementById('daybook-calendar');if(c)c.innerHTML=renderDaybookCalendar();},100);
      toast(`✅ Monthly daybook imported — ${transactions.length} transactions processed`,'ok',4000);
    } else {
      await matchAndImport(transactions);
      renderFunds();
      setTimeout(()=>{const c=document.getElementById('daybook-calendar');if(c)c.innerHTML=renderDaybookCalendar();},100);
    }
  }catch(e){
    document.getElementById('tally-progress').style.display='none';
    setBusy(false);
    toast('Error: '+e.message,'error',5000);
    console.error('Tally parse error:',e);
  }
}


// parseTallyXLS removed — parseTallyXLSReal handles all formats


// Simple XLS/XLSX reader using FileReader + raw parsing
// Uses a minimal approach: convert to CSV-like structure
// parseXLSX removed — use parseTallyXLSReal

// ─── DYNAMIC SCRIPT LOADER ───────────────────────────
function loadScript(src){
  return new Promise((resolve, reject) => {
    if(document.querySelector(`script[src="${src}"]`)){
      // Already loaded
      resolve(); return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load: ' + src));
    document.head.appendChild(s);
  });
}

// Override with SheetJS-based reader (loaded dynamically)
async function parseTallyXLSReal(file, type){
  // Ensure SheetJS is loaded
  if(!window.XLSX){
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  }
  const buffer = await file.arrayBuffer();
  const wb = window.XLSX.read(buffer, {type:'array', cellDates:true});
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const rows = window.XLSX.utils.sheet_to_json(ws, {header:1, defval:''});

  // Use manually selected type — trust the user's selection
  // Only force costcentre if we see the Cost Centre: header (safety guard)
  const firstRows = rows.slice(0,8).map(r=>String(r[0]||'').trim());
  let detectedType = type || 'daybook';
  if(firstRows.some(r=>r.startsWith('Cost Centre:'))) detectedType = 'costcentre';
  console.log('[Tally Import] Auto-detected type:', detectedType, '| File:', file.name);
  return parseRowsByType(rows, detectedType);
}

function parseRowsByType(rows, type){
  // ─── VERIFIED AGAINST REAL TALLY EXPORTS ─────────────
  // Daybook/Monthly: 4-row blocks per transaction
  //   R0: [DATE, LEDGER, '', '', VCH_TYPE, VCH_NO, DEBIT, CREDIT]
  //   R1: ['', COST_CENTRE, CC_AMT, 'Dr'/'Cr', ...]
  //   R2: ['', 'Cash'/'Bank', ...]
  //   R3: ['', NARRATION, ...]
  // Cost Centre: 2-row blocks, CC name in header
  //   R0: [DATE, LEDGER, '', '', VCH_TYPE, VCH_NO, DEBIT, CREDIT]
  //   R1: ['', NARRATION, ...]
  // Debit col6 = payment out. Credit col7 = receipt in.
  // VchType col4 = 'Payment' or 'Receipt' (most reliable signal)
  // ─────────────────────────────────────────────────────

  const STOP_WORDS = ['Opening Balance', 'Current Total', 'Closing Balance', 'Grand Total'];
  const SKIP_CC = ['Cash', 'cash', 'Bank', 'bank', 'SBI', 'HDFC', 'ICICI', 'Axis'];
  const transactions = [];

  // Find header row (row with 'Date' in col0)
  let headerIdx = -1;
  let headerCC = ''; // for cost centre reports
  let headerLedger = ''; // for cost centre reports

  for(let i=0; i<rows.length; i++){
    const c0 = String(rows[i][0]||'').trim();
    if(c0.startsWith('Cost Centre:')) headerCC = c0.replace('Cost Centre:','').trim();
    if(c0.startsWith('Under Ledger:')) headerLedger = c0.replace('Under Ledger:','').trim();
    if(c0 === 'Date') { headerIdx = i; break; }
  }
  if(headerIdx < 0) return transactions; // no header found

  // Auto-detect column layout by inspecting header row
  // Format A (8-col): Date, Ledger, '', '', VchType, VchNo, Debit, Credit
  // Format B (6-col): Date, Particulars, VchType, VchNo, Debit, Credit
  const headerRow = rows[headerIdx] || [];
  const isFormat6Col = headerRow.length <= 6 ||
    (String(headerRow[2]||'').toLowerCase().includes('vch') &&
     !String(headerRow[4]||'').toLowerCase().includes('vch'));

  for(let i = headerIdx+1; i < rows.length; i++){
    const row = rows[i];
    const c0 = String(row[0]||'').trim();

    // Stop at summary rows
    if(STOP_WORDS.some(w => c0.includes(w))) break;

    // Detect date in col0 — Tally exports dates as Excel serial or ISO string
    const dateStr = parseTallyDate(row[0]);
    if(!dateStr) continue;

    let ledger, vchType, vchNo, debit, credit;
    if(isFormat6Col){
      // 6-col format: Date, Particulars, VchType, VchNo, Debit, Credit
      ledger  = String(row[1]||'').trim();
      vchType = String(row[2]||'').trim();
      vchNo   = String(row[3]||'').trim();
      debit   = parseFloat(String(row[4]||'').replace(/,/g,''))||0;
      credit  = parseFloat(String(row[5]||'').replace(/,/g,''))||0;
    } else {
      // 8-col format: Date, Ledger, '', '', VchType, VchNo, Debit, Credit
      ledger  = String(row[1]||'').trim();
      vchType = String(row[4]||'').trim();
      vchNo   = String(row[5]||'').trim();
      debit   = parseFloat(String(row[6]||'').replace(/,/g,''))||0;
      credit  = parseFloat(String(row[7]||'').replace(/,/g,''))||0;
    }

    // txType from VchType column — most reliable
    const txType = vchType.toLowerCase().includes('receipt') ? 'receipt' : 'payment';
    const amount = txType === 'receipt' ? credit : debit;
    if(amount <= 0) continue;

    // Cost centre resolution
    let costCentre = headerCC; // for cost centre reports, already set
    let narration  = '';

    if(type === 'daybook' || type === 'monthly'){
      // Next row (R+1) has cost centre in col1, confirmed by Dr/Cr in col3
      if(i+1 < rows.length){
        const r1 = rows[i+1];
        const cc = String(r1[1]||'').trim();
        const drCr = String(r1[3]||'').trim();
        if((drCr === 'Dr' || drCr === 'Cr') && cc && !SKIP_CC.some(s=>cc.startsWith(s))){
          costCentre = cc;
        }
      }
      // Narration is R+3 col1
      if(i+3 < rows.length){
        narration = String(rows[i+3][1]||'').trim();
      }
    } else {
      // Cost centre report: narration in R+1 col1
      if(i+1 < rows.length){
        const r1 = rows[i+1];
        const c1 = String(r1[1]||'').trim();
        // Narration row has no date and no vch type
        if(c1 && !parseTallyDate(r1[0]) && !String(r1[4]||'').trim()){
          narration = c1;
        }
      }
      // ledger from header if set
      if(headerLedger && !ledger) ledger = headerLedger;
    }

    transactions.push({
      date:       dateStr,
      ledger:     ledger || headerLedger,
      vchType,
      vchNo,
      txType,
      amount,
      costCentre: costCentre.toUpperCase(),
      narration
    });
  }

  return transactions;
}

// Parse Tally date — handles datetime objects from SheetJS and ISO strings
function parseTallyDate(val){
  if(!val && val !== 0) return null;
  const s = String(val).trim();
  if(!s || s === 'None' || s === 'null') return null;

  // ISO datetime: "2025-04-02 00:00:00" or "2025-04-02T00:00:00"
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if(isoMatch) return isoMatch[1];

  // Date object (SheetJS returns these as JS Date)
  if(val instanceof Date && !isNaN(val.getTime())){
    return val.toISOString().split('T')[0];
  }

  // Excel serial number (SheetJS sometimes returns numbers)
  if(typeof val === 'number' && val > 40000 && val < 60000){
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return d.toISOString().split('T')[0];
  }

  // "2-Apr-25" or "1-Apr-25" format from Tally
  const tallyMatch = s.match(/^(\d{1,2})-(\w{3})-(\d{2,4})$/);
  if(tallyMatch){
    const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    const day = parseInt(tallyMatch[1]);
    const mon = months[tallyMatch[2]];
    let yr = parseInt(tallyMatch[3]);
    if(yr < 100) yr += 2000;
    if(mon === undefined) return null;
    const d = new Date(yr, mon, day);
    return d.toISOString().split('T')[0];
  }

  return null;
}


async function matchAndImport(transactions){
  let matchedPayments=0, matchedReceipts=0, skipped=0, unmatchedCount=0;

  for(const tx of transactions){
    // Exact cost centre match (case-insensitive)
    const proj = D.projects.find(p=>p.costCentre && p.costCentre.toUpperCase()===tx.costCentre.toUpperCase() && !isArchived(p));

    if(!proj){
      // Fuzzy match suggestion — attach to tx for UI display
      const fuzzy = fuzzyMatchProject(tx.costCentre);
      const txWithFuzzy = {...tx, _fuzzyMatch: fuzzy ? {id: fuzzy.project.id, name: fuzzy.project.name, dist: fuzzy.distance} : null};

      if(tx.txType==='receipt'){
        const dup=tallyUnmatchedReceipts.find(u=>u.vchNo===tx.vchNo&&Math.abs(u.amount-tx.amount)<1&&u.date===tx.date);
        if(!dup){ tallyUnmatchedReceipts.push(txWithFuzzy); unmatchedCount++; }
      } else {
        const dup=tallyUnmatched.find(u=>u.vchNo===tx.vchNo&&Math.abs(u.amount-tx.amount)<1&&u.date===tx.date);
        if(!dup){ tallyUnmatched.push(txWithFuzzy); unmatchedCount++; }
      }
      continue;
    }

    if(!proj.releases) proj.releases=[];

    // Dual duplicate check: voucher number match OR fingerprint match
    if(isDuplicateTx(proj, tx)){ skipped++; continue; }

    const fp = txFingerprint(tx);
    proj.releases.push({
      id: uid(),
      date: tx.date,
      amount: tx.amount,
      method: tx.vchType||'Payment',
      txType: tx.txType||'payment',
      ref: tx.vchNo,
      notes: tx.narration||'',
      costCentre: tx.costCentre,
      source: 'tally',
      _fp: fp
    });
    await saveProjectDB(proj, {
      type: tx.txType||'payment',
      amount: tx.amount,
      ref: tx.vchNo,
      meta: { costCentre: tx.costCentre, narration: tx.narration, vchType: tx.vchType, source:'tally' }
    });
    if(tx.txType==='receipt') matchedReceipts++; else matchedPayments++;
  }

  if(matchedPayments+matchedReceipts+unmatchedCount>0){
    const importedDates=new Set(transactions.map(t=>t.date).filter(Boolean));
    importedDates.forEach(d=>recordDaybookUpload(d));
  }

  const parts=[];
  if(matchedPayments) parts.push(`${matchedPayments} payments`);
  if(matchedReceipts) parts.push(`${matchedReceipts} receipts`);
  if(unmatchedCount) parts.push(`${unmatchedCount} unmatched`);
  if(skipped) parts.push(`${skipped} duplicates skipped`);
  toast(`✅ Imported: ${parts.join(' · ')}`,'ok',5000);
  renderFunds();
  updateOfflineQueueBadge();
}

// Override processTallyFile to use real parser

// ─── UNMATCHED ACTIONS ────────────────────────────────

// Quick assign from fuzzy suggestion (one click)
async function quickAssignUnmatched(pid, i, isReceipt){
  if(!pid){ toast('Project not found','error'); return; }
  const queue = isReceipt ? tallyUnmatchedReceipts : tallyUnmatched;
  const tx = queue[i]; if(!tx) return;
  const proj = GP(pid); if(!proj) return;
  if(!proj.releases) proj.releases=[];
  const fp = txFingerprint(tx);
  proj.releases.push({
    id:uid(), date:tx.date, amount:tx.amount,
    method:tx.vchType||(isReceipt?'Receipt':'Payment'),
    txType:isReceipt?'receipt':'payment',
    ref:tx.vchNo, notes:tx.narration||'',
    costCentre:tx.costCentre||'FUZZY-MATCHED',
    source:'tally-fuzzy', _fp:fp
  });
  try{
    await saveProjectDB(proj);
    queue.splice(i,1);
    renderFunds(); ownerTab(3);
    toast(`✓ Assigned to ${proj.name} (fuzzy match)`,'ok');
  }catch(e){ toast('Save failed','error'); }
}

async function assignUnmatched(i, isReceipt){
  const queue = isReceipt ? tallyUnmatchedReceipts : tallyUnmatched;
  const tx=queue[i];
  const pid=document.getElementById(`um-assign-${isReceipt?'r':'p'}-${i}`)?.value;
  if(!pid){toast('Select a project first','error');return;}
  const proj=GP(pid); if(!proj)return;
  if(!proj.releases) proj.releases=[];
  proj.releases.push({
    id:uid(),date:tx.date,amount:tx.amount,
    method:tx.vchType||(isReceipt?'Receipt':'Payment'),
    txType:isReceipt?'receipt':'payment',
    ref:tx.vchNo,notes:tx.narration||'',
    costCentre:tx.costCentre||'MANUAL',source:'tally-manual'
  });
  try{
    await saveProjectDB(proj);
    queue.splice(i,1);
    renderFunds(); ownerTab(3);
    toast(`✓ ${isReceipt?'Receipt':'Payment'} assigned to project`,'ok');
  }catch(e){toast('Save failed','error');}
}

function deleteUnmatched(i, isReceipt){
  if(!confirm(`Delete this unmatched ${isReceipt?'receipt':'payment'}?`))return;
  const queue = isReceipt ? tallyUnmatchedReceipts : tallyUnmatched;
  queue.splice(i,1);
  renderFunds(); ownerTab(3);
  toast('Deleted','ok');
}

// ═══════════════════════════════════════════════════════

// ─── DATA EXPORT ──────────────────────────────────────
// ═══════════════════════════════════════════════════════
// FULL DATA EXPORT (Excel — all projects, finance, updates)
// ═══════════════════════════════════════════════════════
async function exportAllData(){
  setBusy(true,'Preparing export…');
  try {
    // Ensure SheetJS is loaded
    if(!window.XLSX){
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    }

    const wb = window.XLSX.utils.book_new();
    const now = new Date().toLocaleString('en-IN');

    // ── SHEET 1: Projects Summary ──
    const projRows = [
      ['RSR CONSTRUCTIONS — Data Export', '', '', '', '', '', '', '', now],
      [],
      ['Project Name','Tender ID','Type','Contractor','Location','Tally Cost Centre',
       'Agreement Amount','Max Fundable (70%)','Total Deployed','Cap Used %',
       'Verified Work %','Total Settled','Outstanding','Interest Accrued','Status']
    ];
    D.projects.forEach(p=>{
      const c=GC(p.contractorId);
      const rel=totRel(p),max=maxF(p),settled=(p.settlements||[]).reduce((s,x)=>s+x.amount,0);
      projRows.push([
        p.name, p.tender, p.type, c?c.name:'—', p.location||'—', p.costCentre||'—',
        Math.round(agAmt(p)), Math.round(max),
        Math.round(rel), Math.round(rel/max*100)+'%',
        Math.round(verPct(p))+'%',
        Math.round(settled), Math.round(Math.max(0,rel-settled)),
        Math.round(intr(p)),
        pStat(p)==='green'?'On Track':pStat(p)==='red'?'High Risk':'Caution'
      ]);
    });
    const ws1 = window.XLSX.utils.aoa_to_sheet(projRows);
    ws1['!cols'] = [{wch:40},{wch:12},{wch:12},{wch:20},{wch:20},{wch:35},
      {wch:16},{wch:16},{wch:14},{wch:10},{wch:12},{wch:14},{wch:14},{wch:14},{wch:12}];
    window.XLSX.utils.book_append_sheet(wb, ws1, 'Projects Summary');

    // ── SHEET 2: All Fund Releases ──
    const fundRows = [
      ['Date','Project','Contractor','Voucher No','Cost Centre','Method','Narration','Amount','Source']
    ];
    D.projects.forEach(p=>{
      const c=GC(p.contractorId);
      (p.releases||[]).forEach(r=>{
        fundRows.push([
          r.date, p.name, c?c.name:'—', r.ref||'—', r.costCentre||'—',
          r.method||'—', r.notes||'—', r.amount, r.source||'manual'
        ]);
      });
    });
    fundRows.sort((a,b)=>new Date(b[0])-new Date(a[0]));
    const ws2 = window.XLSX.utils.aoa_to_sheet(fundRows);
    ws2['!cols']=[{wch:12},{wch:40},{wch:20},{wch:12},{wch:35},{wch:10},{wch:30},{wch:12},{wch:14}];
    window.XLSX.utils.book_append_sheet(wb, ws2, 'Fund Releases');

    // ── SHEET 3: Government Settlements ──
    const settRows = [['Date','Project','Contractor','Amount','Mode','Reference','Notes']];
    D.projects.forEach(p=>{
      const c=GC(p.contractorId);
      (p.settlements||[]).forEach(s=>{
        settRows.push([s.date, p.name, c?c.name:'—', s.amount, s.mode||'—', s.ref||'—', s.notes||'—']);
      });
    });
    const ws3 = window.XLSX.utils.aoa_to_sheet(settRows);
    ws3['!cols']=[{wch:12},{wch:40},{wch:20},{wch:12},{wch:10},{wch:16},{wch:30}];
    window.XLSX.utils.book_append_sheet(wb, ws3, 'Settlements');

    // ── SHEET 4: BOQ & Verification ──
    const boqRows = [['Project','BOQ Item','Unit','Total Qty','Rate','Total Value','Reported Qty','Verified Qty','Verified %']];
    D.projects.forEach(p=>{
      const lv=(p.verifications||[]).slice(-1)[0];
      (p.boq||[]).forEach(item=>{
        const reported=(p.reportedItems||{})[item.id]||0;
        const verified=lv?(lv.items[item.id]||0):0;
        boqRows.push([
          p.name, item.desc, item.unit, item.qty, item.rate,
          Math.round(item.qty*item.rate), reported, verified,
          item.qty?Math.round(verified/item.qty*100)+'%':'—'
        ]);
      });
    });
    const ws4 = window.XLSX.utils.aoa_to_sheet(boqRows);
    ws4['!cols']=[{wch:40},{wch:30},{wch:8},{wch:10},{wch:10},{wch:12},{wch:12},{wch:12},{wch:10}];
    window.XLSX.utils.book_append_sheet(wb, ws4, 'BOQ & Verification');

    // ── SHEET 5: Contractor Updates Log ──
    const updRows = [['Date','Project','Contractor','Notes','Quantities Reported','Status','GPS Location','Submitted At']];
    D.projects.forEach(p=>{
      const c=GC(p.contractorId);
      (p.contractorUpdates||[]).forEach(u=>{
        const qtyStr = (p.boq||[]).filter(i=>u.quantities?.[i.id])
          .map(i=>`${i.desc}: ${u.quantities[i.id]} ${i.unit}`).join('; ');
        const status = u.rejected?'Rejected':u.reviewed?'Approved':'Pending';
        const gps = u.submittedGPS ? `${u.submittedGPS.area} (${u.submittedGPS.time})` : '—';
        updRows.push([u.date, p.name, c?c.name:u.submittedBy||'—',
          u.notes||'—', qtyStr||'—', status, gps, u.queuedAt||'—']);
      });
    });
    const ws5 = window.XLSX.utils.aoa_to_sheet(updRows);
    ws5['!cols']=[{wch:12},{wch:40},{wch:20},{wch:30},{wch:40},{wch:10},{wch:30},{wch:20}];
    window.XLSX.utils.book_append_sheet(wb, ws5, 'Site Updates Log');

    // ── SHEET 6: Contractors ──
    const cRows = [['Name','Phone','Notes','Projects Count','Total Deployed','Created']];
    D.contractors.forEach(c=>{
      const pp=D.projects.filter(p=>p.contractorId===c.id);
      const dep=pp.reduce((s,p)=>s+totRel(p),0);
      cRows.push([c.name, c.phone||'—', c.notes||'—', pp.length, Math.round(dep), c.createdAt?.split('T')[0]||'—']);
    });
    const ws6 = window.XLSX.utils.aoa_to_sheet(cRows);
    ws6['!cols']=[{wch:25},{wch:14},{wch:30},{wch:14},{wch:16},{wch:12}];
    window.XLSX.utils.book_append_sheet(wb, ws6, 'Contractors');

    // Generate file
    const filename = `RSR_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
    window.XLSX.writeFile(wb, filename);
    setBusy(false);
    toast(`✅ Exported: ${filename}`,'ok',4000);

  } catch(e) {
    setBusy(false);
    toast('Export failed: '+e.message,'error',5000);
    console.error('Export error:', e);
  }
}

// ─── MONTHLY VERIFICATION ─────────────────────────────
async function runMonthlyVerification(transactions){
  // Compare monthly daybook transactions against what is already in the app
  // Show: matched, missing, duplicates, unmatched cost centres

  const matched = [], missing = [], duplicates = [], unmatched = [];

  for(const tx of transactions){
    // Find project by cost centre
    const proj = D.projects.find(p=>p.costCentre &&
      p.costCentre.toUpperCase()===tx.costCentre.toUpperCase());

    if(!proj){
      unmatched.push(tx);
      continue;
    }

    // Check if already in releases
    const existing = (proj.releases||[]).find(r=>
      r.ref===tx.vchNo && Math.abs(r.amount-tx.amount)<1 && r.date===tx.date
    );

    if(existing){
      matched.push({...tx, projectName: proj.name});
    } else {
      // Check if it's a duplicate by vchNo only
      const dupByVch = (proj.releases||[]).find(r=>r.ref===tx.vchNo);
      if(dupByVch){
        duplicates.push({...tx, projectName: proj.name,
          existingAmount: dupByVch.amount, existingDate: dupByVch.date});
      } else {
        missing.push({...tx, projectName: proj.name, projId: proj.id});
      }
    }
  }

  // Render results
  const section = document.getElementById('monthly-verify-section');
  if(!section) return;
  section.style.display='block';

  section.innerHTML = `
    <div class="card" style="border-top:4px solid var(--navy)">
      <div class="st">📊 Monthly Verification Results</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px">
        <div style="background:#d4edda;border-radius:var(--rs);padding:12px;text-align:center">
          <div style="font-size:22px;font-weight:800;color:#155724">${matched.length}</div>
          <div style="font-size:11px;color:#155724;font-weight:600">✅ Matched</div>
        </div>
        <div style="background:#fde8e8;border-radius:var(--rs);padding:12px;text-align:center">
          <div style="font-size:22px;font-weight:800;color:var(--red)">${missing.length}</div>
          <div style="font-size:11px;color:var(--red);font-weight:600">❌ Missing</div>
        </div>
        <div style="background:#fff3cd;border-radius:var(--rs);padding:12px;text-align:center">
          <div style="font-size:22px;font-weight:800;color:#856404">${duplicates.length}</div>
          <div style="font-size:11px;color:#856404;font-weight:600">⚠️ Possible Duplicates</div>
        </div>
        <div style="background:var(--surface2);border-radius:var(--rs);padding:12px;text-align:center">
          <div style="font-size:22px;font-weight:800;color:var(--text2)">${unmatched.length}</div>
          <div style="font-size:11px;color:var(--text3);font-weight:600">❓ No Cost Centre</div>
        </div>
      </div>

      ${missing.length ? `
        <div style="margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:var(--red);margin-bottom:8px">❌ Missing Transactions — Not in App</div>
          ${missing.map((tx,i)=>`
            <div style="background:#fde8e8;border-radius:var(--rs);padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <div style="flex:1">
                <div style="font-size:12px;font-weight:700">${tx.date} · Vch #${tx.vchNo} · ${tx.projectName}</div>
                <div style="font-size:11px;color:var(--text3)">${tx.narration||''} · CC: ${tx.costCentre}</div>
              </div>
              <div style="font-weight:800;color:var(--red)">${fmt(tx.amount)}</div>
              <button class="btn btn-sm btn-navy" onclick="importMissingTx(${i})">+ Import</button>
            </div>`).join('')}
          <button class="btn btn-navy" onclick="importAllMissing()" style="margin-top:8px;width:100%">⚡ Import All Missing (${missing.length})</button>
        </div>` : ''}

      ${duplicates.length ? `
        <div style="margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:#856404;margin-bottom:8px">⚠️ Possible Duplicates — Same Voucher No, Different Amount/Date</div>
          ${duplicates.map(tx=>`
            <div style="background:#fff3cd;border-radius:var(--rs);padding:10px 12px;margin-bottom:6px">
              <div style="font-size:12px;font-weight:700">${tx.date} · Vch #${tx.vchNo} · ${tx.projectName}</div>
              <div style="font-size:11px;color:var(--text3)">Monthly: ${fmt(tx.amount)} · In app: ${fmt(tx.existingAmount)} on ${tx.existingDate}</div>
            </div>`).join('')}
        </div>` : ''}

      ${unmatched.length ? `
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:8px">❓ No Cost Centre Match</div>
          ${unmatched.map(tx=>`
            <div style="background:var(--surface2);border-radius:var(--rs);padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <div>
                <div style="font-size:12px;font-weight:700">${tx.date} · Vch #${tx.vchNo}</div>
                <div style="font-size:11px;color:var(--text3)">CC: ${tx.costCentre||'(none)'} · ${tx.narration||''}</div>
              </div>
              <div style="font-weight:700">${fmt(tx.amount)}</div>
            </div>`).join('')}
        </div>` : ''}
    </div>`;

  // Store missing list for import actions
  window._monthlyMissing = missing;
  toast(`Monthly verification: ${matched.length} matched, ${missing.length} missing, ${duplicates.length} duplicate warnings`,'ok',5000);
}

async function importMissingTx(idx){
  const tx = window._monthlyMissing?.[idx]; if(!tx) return;
  const proj = D.projects.find(p=>p.id===tx.projId); if(!proj) return;
  if(!proj.releases) proj.releases=[];
  proj.releases.push({id:uid(),date:tx.date,amount:tx.amount,
    method:tx.vchType||'Payment',ref:tx.vchNo,
    notes:tx.narration||'',costCentre:tx.costCentre,source:'tally-monthly'});
  try {
    await saveProjectDB(proj);
    window._monthlyMissing.splice(idx,1);
    toast('✅ Transaction imported','ok');
    renderFunds();
  } catch(e){ toast('Import failed','error'); }
}

async function importAllMissing(){
  const missing = window._monthlyMissing||[];
  if(!missing.length) return;
  if(!confirm(`Import all ${missing.length} missing transactions?`)) return;
  for(const tx of missing){
    const proj = D.projects.find(p=>p.id===tx.projId); if(!proj) continue;
    if(!proj.releases) proj.releases=[];
    proj.releases.push({id:uid(),date:tx.date,amount:tx.amount,
      method:tx.vchType||'Payment',ref:tx.vchNo,
      notes:tx.narration||'',costCentre:tx.costCentre,source:'tally-monthly'});
    await saveProjectDB(proj);
  }
  window._monthlyMissing=[];
  toast(`✅ ${missing.length} transactions imported`,'ok');
  renderFunds();
}
