// finance.js v2 — 202607100611
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
    <div class="pg-hdr">
      <div class="pg-title">📂 Tally Import</div>
      <button onclick="showCCRef()" style="background:#7c3aed;color:#fff;border:none;border-radius:var(--rs);padding:9px 18px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;display:flex;align-items:center;gap:6px">
        🏷️ Cost Centre Reference
      </button>
    </div>

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
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
          <div class="st" style="color:var(--amber);margin:0;border:none;padding:0">⚠️ Unmatched Payments (${tallyUnmatched.length})</div>
          <button onclick="dismissAllUnmatched(false)" style="background:#fef3c7;color:#92400e;border:1px solid #f59e0b;border-radius:var(--rs);padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">🗑️ Dismiss All Payments</button>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:12px">These payment transactions did not match any project's Cost Centre. Assign what belongs to projects, then Dismiss All remaining.</div>
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
              <div style="flex:1;min-width:200px;position:relative">
                <input type="text" id="um-search-p-${i}" placeholder="🔍 Type to search project…"
                  oninput="filterUnmatchedDropdown('um-search-p-${i}','um-assign-p-${i}-list')"
                  onfocus="document.getElementById('um-assign-p-${i}-list').style.display='block'"
                  style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px;box-sizing:border-box">
                <div id="um-assign-p-${i}-list" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid var(--border);border-radius:var(--rs);z-index:999;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,.1)">
                  ${D.projects.filter(p=>!isArchived(p)).map(p=>`<div onclick="selectUnmatchedProject('um-search-p-${i}','um-assign-p-${i}-list','${p.id}','${p.name.replace(/'/g,'&#39;')}')" style="padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--surface2)" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='#fff'"><div style="font-weight:600">${p.name.substring(0,55)}</div><div style="font-size:11px;color:var(--text3)">${(GC(p.contractorId)||{name:'—'}).name} · ${p.firm||'RSR'}</div></div>`).join('')}
                </div>
                <input type="hidden" id="um-assign-p-${i}" value="">
              </div>
              <button class="btn btn-sm btn-navy" onclick="assignUnmatched(${i},false)">✓ Assign</button>
              <button class="btn btn-sm" style="color:var(--red)" onclick="deleteUnmatched(${i},false)">🗑️ Delete</button>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <!-- UNMATCHED RECEIPTS -->
    <div id="tally-unmatched-receipts-section" style="${tallyUnmatchedReceipts.length?'':'display:none'}">
      <div class="card" style="border-top:4px solid var(--green)">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
          <div class="st" style="color:var(--green);margin:0;border:none;padding:0">📥 Unmatched Receipts (${tallyUnmatchedReceipts.length})</div>
          <button onclick="dismissAllUnmatched(true)" style="background:#d1fae5;color:#065f46;border:1px solid #34d399;border-radius:var(--rs);padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">🗑️ Dismiss All Receipts</button>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:12px">These receipt transactions did not match any project. Assign to a project or dismiss all remaining.</div>
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
              <div style="flex:1;min-width:200px;position:relative">
                <input type="text" id="um-search-r-${i}" placeholder="🔍 Type to search project…"
                  oninput="filterUnmatchedDropdown('um-search-r-${i}','um-assign-r-${i}-list')"
                  onfocus="document.getElementById('um-assign-r-${i}-list').style.display='block'"
                  style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px;box-sizing:border-box">
                <div id="um-assign-r-${i}-list" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid var(--border);border-radius:var(--rs);z-index:999;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,.1)">
                  ${D.projects.filter(p=>!isArchived(p)).map(p=>`<div onclick="selectUnmatchedProject('um-search-r-${i}','um-assign-r-${i}-list','${p.id}','${p.name.replace(/'/g,'&#39;')}')" style="padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--surface2)" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='#fff'"><div style="font-weight:600">${p.name.substring(0,55)}</div><div style="font-size:11px;color:var(--text3)">${(GC(p.contractorId)||{name:'—'}).name} · ${p.firm||'RSR'}</div></div>`).join('')}
                </div>
                <input type="hidden" id="um-assign-r-${i}" value="">
              </div>
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
      logActivity({category:'tally',action:'daybook_import',
      description:(CU?CU.name:'User')+' imported monthly daybook: '+transactions.length+' transactions processed',
      meta:{count:transactions.length}});
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
    /* XLSX pre-loaded */
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
    const totalAmount = txType === 'receipt' ? credit : debit;
    if(totalAmount <= 0) continue;

    // Cost centre resolution
    let narration  = '';

    if(type === 'daybook' || type === 'monthly'){
      // Collect ALL cost centre sub-rows that follow (each has Dr/Cr in col3)
      const ccEntries = [];
      let j = i + 1;
      while(j < rows.length){
        const rj = rows[j];
        const cc = String(rj[1]||'').trim();
        const drCr = String(rj[3]||'').trim();
        const ccAmt = parseFloat(String(rj[2]||'').replace(/,/g,''))||0;
        if((drCr === 'Dr' || drCr === 'Cr') && cc && !SKIP_CC.some(s=>cc.startsWith(s))){
          ccEntries.push({ cc: cc.toUpperCase(), amount: ccAmt });
          j++;
        } else {
          break;
        }
      }
      // Narration: look ahead past cc rows + credit row
      const narRow = rows[i + ccEntries.length + 2];
      if(narRow) narration = String(narRow[1]||'').trim();

      if(ccEntries.length === 0){
        // No cost centre found — use header or blank
        transactions.push({
          date: dateStr, ledger, vchType, vchNo, txType,
          amount: totalAmount,
          costCentre: (headerCC||'').toUpperCase(),
          narration
        });
      } else if(ccEntries.length === 1){
        // Single cost centre — normal case
        transactions.push({
          date: dateStr, ledger, vchType, vchNo, txType,
          amount: ccEntries[0].amount > 0 ? ccEntries[0].amount : totalAmount,
          costCentre: ccEntries[0].cc,
          narration
        });
      } else {
        // Multiple cost centres — SPLIT into one transaction per CC
        // Use each CC's own amount (col2 of that row); fallback to proportional split
        const ccTotal = ccEntries.reduce((s,e)=>s+e.amount, 0);
        ccEntries.forEach(entry=>{
          const amt = entry.amount > 0 ? entry.amount : totalAmount * (1/ccEntries.length);
          transactions.push({
            date: dateStr, ledger, vchType, vchNo, txType,
            amount: Math.round(amt * 100) / 100,
            costCentre: entry.cc,
            narration,
            multiCC: true  // flag so we can show this in UI
          });
        });
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
      // Cost centre report — single push
      transactions.push({
        date:       dateStr,
        ledger:     ledger || headerLedger,
        vchType,
        vchNo,
        txType,
        amount:     totalAmount,
        costCentre: (headerCC||'').toUpperCase(),
        narration
      });
    }
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




// ─── DISMISS ALL UNMATCHED ────────────────────────────
async function dismissAllUnmatched(isReceipt){
  const queue = isReceipt ? tallyUnmatchedReceipts : tallyUnmatched;
  const type = isReceipt ? 'receipts' : 'payments';
  if(!queue.length){ toast('Nothing to dismiss','ok'); return; }
  if(!confirm(`Dismiss all ${queue.length} unmatched ${type}? This cannot be undone.`)) return;
  if(isReceipt){ tallyUnmatchedReceipts = []; }
  else { tallyUnmatched = []; }
  await saveUnmatchedToCloud().catch(()=>{});
  renderFunds();
  toast(`✓ All ${queue.length} unmatched ${type} dismissed`,'ok');
}

// ─── PERSIST UNMATCHED TRANSACTIONS ──────────────────
// Saves to Supabase settings so they survive refresh and mobile
async function saveUnmatchedToCloud(){
  const data = {
    payments: tallyUnmatched,
    receipts: tallyUnmatchedReceipts,
    savedAt: new Date().toISOString()
  };
  await saveSetting(UNMATCHED_KEY, data);
}

async function loadUnmatchedFromCloud(){
  try{
    const data = await getSetting(UNMATCHED_KEY, null);
    if(!data) return;
    if(data.payments && data.payments.length){
      tallyUnmatched = data.payments;
    }
    if(data.receipts && data.receipts.length){
      tallyUnmatchedReceipts = data.receipts;
    }
  }catch(e){ /* non-critical */ }
}

async function clearUnmatchedFromCloud(){
  await saveSetting(UNMATCHED_KEY, {payments:[],receipts:[],savedAt:new Date().toISOString()}).catch(()=>{});
}

async function matchAndImport(transactions){
  // Tally import can touch any project by cost centre, and D.projects may
  // currently only hold the lightweight dashboard summary (contractorUpdates
  // photos stripped to placeholders, to keep the initial page load fast —
  // see loadDBSummary). Mutating and saving that stripped version back
  // would permanently destroy real photo data — and since a single import
  // run can touch dozens of projects at once, that mistake would compound
  // across all of them in one operation. Refresh every project to its true
  // full record — one request, not N — before matching/mutating anything.
  try{
    const rows = await sbReq('projects?order=created_at','GET');
    if(rows) D.projects = rows.map(r=>({...r.data, id:r.id}));
  }catch(e){ /* fall back to whatever's already in memory if this fails */ }

  let matchedPayments=0, matchedReceipts=0, skipped=0, unmatchedCount=0;
  let corrected=0, reassigned=0;
  const skippedDuplicates = []; // track for review
  const correctionLog = []; // track for summary toast
  const projectsTouched = new Set(); // batch saves — avoid saving the same project repeatedly

  for(const tx of transactions){
    // ── STEP 1: Does this exact voucher (by number+date) already exist
    // anywhere in the system? If so, this is a RE-IMPORT of a transaction
    // we've already recorded — check whether anything about it changed. ──
    const existing = findExistingReleaseByVoucher(tx.vchNo, tx.date, tx.costCentre);

    if(existing){
      const { project: oldProj, release: oldRel } = existing;
      const targetProj = D.projects.find(p=>p.costCentre && p.costCentre.toUpperCase()===tx.costCentre.toUpperCase() && !isArchived(p));

      const amountChanged = Math.abs(oldRel.amount - tx.amount) >= 1;
      const movedProject = targetProj && targetProj.id !== oldProj.id;

      if(!amountChanged && !movedProject){
        // Truly identical — genuine duplicate, skip as before
        skipped++;
        skippedDuplicates.push({tx, proj: oldProj});
        continue;
      }

      if(movedProject){
        // Cost centre was reassigned in Tally — move the release to the correct project
        oldProj.releases = (oldProj.releases||[]).filter(r=>r!==oldRel);
        if(!targetProj.releases) targetProj.releases=[];
        targetProj.releases.push({
          ...oldRel,
          amount: tx.amount, // also apply any amount correction at the same time
          costCentre: tx.costCentre,
          notes: tx.narration||oldRel.notes||'',
          _fp: txFingerprint(tx),
          _movedFrom: oldProj.name,
          _movedAt: new Date().toISOString()
        });
        projectsTouched.add(oldProj.id);
        projectsTouched.add(targetProj.id);
        reassigned++;
        correctionLog.push(`Vch #${tx.vchNo} moved: ${oldProj.name.substring(0,30)} → ${targetProj.name.substring(0,30)}`);
        logActivity({
          category:'finance', action:'tally_reassigned',
          projectId:targetProj.id, projectName:targetProj.name,
          amount:tx.amount, ref:tx.vchNo,
          description:`Vch #${tx.vchNo} (₹${tx.amount.toLocaleString('en-IN')}) reassigned from cost centre of "${oldProj.name}" to "${targetProj.name}" — Tally cost centre changed`
        });
      } else if(amountChanged){
        // Same project, same cost centre — just an amount correction
        const oldAmount = oldRel.amount;
        oldRel.amount = tx.amount;
        oldRel.notes = tx.narration||oldRel.notes||'';
        oldRel._fp = txFingerprint(tx);
        oldRel._correctedAt = new Date().toISOString();
        projectsTouched.add(oldProj.id);
        corrected++;
        correctionLog.push(`Vch #${tx.vchNo}: ₹${oldAmount.toLocaleString('en-IN')} → ₹${tx.amount.toLocaleString('en-IN')}`);
        logActivity({
          category:'finance', action:'tally_corrected',
          projectId:oldProj.id, projectName:oldProj.name,
          amount:tx.amount, ref:tx.vchNo,
          description:`Vch #${tx.vchNo} amount corrected from ₹${oldAmount.toLocaleString('en-IN')} to ₹${tx.amount.toLocaleString('en-IN')} for ${oldProj.name} — Tally was re-imported with a different amount`
        });
      }
      continue;
    }

    // ── STEP 2: Genuinely new transaction — match by cost centre as before ──
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
    projectsTouched.add(proj.id);
    logFundRelease(proj, tx.amount, tx.vchNo, tx.txType||'payment');
    if(tx.txType==='receipt') matchedReceipts++; else matchedPayments++;
  }

  // Batch-save every project touched (new transactions, corrections, reassignments)
  for(const pid of projectsTouched){
    const p = D.projects.find(x=>x.id===pid);
    if(p) await saveProjectDB(p, { type:'tally_reimport', amount:0, ref:null, meta:{source:'tally'} });
  }

  if(matchedPayments+matchedReceipts+unmatchedCount+corrected+reassigned>0){
    const importedDates=new Set(transactions.map(t=>t.date).filter(Boolean));
    importedDates.forEach(d=>recordDaybookUpload(d));
  }
  // Persist unmatched transactions to Supabase so they survive page refresh
  await saveUnmatchedToCloud().catch(()=>{});

  const parts=[];
  if(matchedPayments) parts.push(`${matchedPayments} payments`);
  if(matchedReceipts) parts.push(`${matchedReceipts} receipts`);
  if(corrected) parts.push(`${corrected} corrected`);
  if(reassigned) parts.push(`${reassigned} reassigned`);
  if(unmatchedCount) parts.push(`${unmatchedCount} unmatched`);
  if(skipped) parts.push(`${skipped} duplicates skipped`);
  toast(`✅ Imported: ${parts.join(' · ')}`,'ok',5000);
  renderFunds();
  updateOfflineQueueBadge();

  // Show correction/reassignment summary if anything changed
  if(correctionLog.length > 0){
    setTimeout(()=>showCorrectionSummaryModal(correctionLog), 500);
  } else if(skippedDuplicates.length > 0){
    setTimeout(()=>showDuplicateReviewModal(skippedDuplicates), 500);
  }
}

// ─── CORRECTION/REASSIGNMENT SUMMARY MODAL ────────────
function showCorrectionSummaryModal(log){
  let modal = document.getElementById('modal-correction-summary');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-correction-summary'; document.body.appendChild(modal); }
  modal.innerHTML = `<div class="mbox" style="max-width:520px">
    <div class="mhdr"><h2>🔄 Transactions Updated</h2><button class="mx" onclick="CM('modal-correction-summary')">✕</button></div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px">This re-import detected ${log.length} transaction${log.length>1?'s':''} that already existed but changed — either the amount was corrected in Tally, or the cost centre was reassigned. These were updated in place, not duplicated.</div>
    <div style="max-height:300px;overflow-y:auto">
      ${log.map(l=>`<div style="padding:8px 10px;background:var(--surface2);border-radius:var(--rs);margin-bottom:6px;font-size:12px">${l}</div>`).join('')}
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:14px">
      <button class="btn btn-navy" onclick="CM('modal-correction-summary')">Got it</button>
    </div>
  </div>`;
  modal.classList.add('open');
}

// ─── DUPLICATE REVIEW MODAL ───────────────────────────
function showDuplicateReviewModal(dupes){
  let modal = document.getElementById('modal-dup-review');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'mov';
    modal.id = 'modal-dup-review';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `<div class="mbox" style="max-width:700px;max-height:90vh;display:flex;flex-direction:column">
    <div style="background:var(--amber);padding:14px 18px;border-radius:var(--rs) var(--rs) 0 0;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
      <div>
        <div style="font-size:15px;font-weight:700;color:#fff">⚠️ ${dupes.length} Duplicate Transaction${dupes.length>1?'s':''} Skipped</div>
        <div style="font-size:11px;color:rgba(255,255,255,.85);margin-top:2px">Review and force-import if these are NOT duplicates</div>
      </div>
      <button class="mx" onclick="CM('modal-dup-review')" style="color:#fff;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3)">✕</button>
    </div>
    <div style="overflow-y:auto;flex:1;padding:16px">
      <div style="font-size:12px;color:var(--text2);margin-bottom:14px;padding:10px 12px;background:#fffbeb;border-radius:var(--rs);border:1px solid var(--amber)">
        These transactions were skipped because they match an existing entry by voucher number or fingerprint. 
        If you believe these are new transactions (not duplicates), click <strong>Force Import</strong>.
      </div>
      ${dupes.map((d,i)=>{
        const existing = (d.proj.releases||[]).find(r=>r.ref===d.tx.vchNo||(r._fp&&r._fp===txFingerprint(d.tx)));
        return `<div style="border:1px solid var(--border);border-radius:var(--rs);padding:12px;margin-bottom:10px;background:#fff">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:10px">
            <div>
              <div style="font-weight:700;font-size:13px;color:var(--navy)">${d.proj.name}</div>
              <div style="font-size:11px;color:var(--text3)">#${d.proj.tender}</div>
            </div>
            <span style="background:#fef3c7;color:#92400e;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700">SKIPPED AS DUPLICATE</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:10px">
            <div style="background:var(--surface2);padding:8px;border-radius:var(--rs)">
              <div style="font-weight:600;color:var(--text3);margin-bottom:4px">NEW TRANSACTION (skipped)</div>
              <div>Date: <strong>${fmtDate(d.tx.date)}</strong></div>
              <div>Voucher: <strong>#${d.tx.vchNo}</strong></div>
              <div>Amount: <strong style="color:var(--navy)">${fmt(d.tx.amount)}</strong></div>
              <div>Type: <strong>${d.tx.txType==='receipt'?'Receipt':'Payment'}</strong></div>
              <div style="color:var(--text3);font-size:11px">${d.tx.narration||''}</div>
            </div>
            <div style="background:#e8f5e9;padding:8px;border-radius:var(--rs)">
              <div style="font-weight:600;color:var(--text3);margin-bottom:4px">EXISTING ENTRY (kept)</div>
              ${existing?`
              <div>Date: <strong>${fmtDate(existing.date)}</strong></div>
              <div>Voucher: <strong>#${existing.ref||'—'}</strong></div>
              <div>Amount: <strong style="color:var(--green)">${fmt(existing.amount)}</strong></div>
              <div>Type: <strong>${existing.txType==='receipt'?'Receipt':'Payment'}</strong></div>
              <div style="color:var(--text3);font-size:11px">${existing.notes||''}</div>`:'<div style="color:var(--text3)">Matched by fingerprint</div>'}
            </div>
          </div>
          <button onclick="forceImportDuplicate(${i},'${d.proj.id}',${JSON.stringify(d.tx).replace(/'/g,"\'")})" 
            style="background:var(--amber);color:#fff;border:none;border-radius:var(--rs);padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">
            ⚡ Force Import This Transaction
          </button>
        </div>`;
      }).join('')}
    </div>
  </div>`;
  modal.classList.add('open');
}

// Store dupes for force import
window._pendingDupes = [];

async function forceImportDuplicate(idx, projId, tx){
  const proj = await GPFull(projId);
  if(!proj){ toast('Project not found','error'); return; }
  if(!proj.releases) proj.releases=[];
  const fp = txFingerprint(tx);
  proj.releases.push({
    id:uid(), date:tx.date, amount:tx.amount,
    method:tx.vchType||'Payment', txType:tx.txType||'payment',
    ref:tx.vchNo, notes:tx.narration||'', costCentre:tx.costCentre,
    source:'tally-forced', _fp:fp
  });
  try{
    await saveProjectDB(proj);
    toast(`✓ Transaction force-imported — ₹${tx.amount} for ${proj.name}`,'ok');
    // Remove from modal
    const card = document.getElementById('modal-dup-review').querySelectorAll('[style*="border:1px solid var(--border)"]')[idx];
    if(card){ card.style.opacity='.4'; card.querySelector('button').disabled=true; card.querySelector('button').textContent='✓ Imported'; }
  }catch(e){ toast('Import failed','error'); }
}

// Override processTallyFile to use real parser

// ─── UNMATCHED ACTIONS ────────────────────────────────

// Quick assign from fuzzy suggestion (one click)
async function quickAssignUnmatched(pid, i, isReceipt){
  if(!pid){ toast('Project not found','error'); return; }
  const queue = isReceipt ? tallyUnmatchedReceipts : tallyUnmatched;
  const tx = queue[i]; if(!tx) return;
  const proj = await GPFull(pid); if(!proj) return;
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
    saveUnmatchedToCloud().catch(()=>{});
    renderFunds(); ownerTab(3);
    toast(`✓ Assigned to ${proj.name} (fuzzy match)`,'ok');
  }catch(e){ toast('Save failed','error'); }
}

async function assignUnmatched(i, isReceipt){
  const queue = isReceipt ? tallyUnmatchedReceipts : tallyUnmatched;
  const tx=queue[i];
  const pid=document.getElementById(`um-assign-${isReceipt?'r':'p'}-${i}`)?.value;
  if(!pid){toast('Select a project first','error');return;}
  const proj=await GPFull(pid); if(!proj)return;
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
    saveUnmatchedToCloud().catch(()=>{});
    renderFunds(); ownerTab(3);
    toast(`✓ ${isReceipt?'Receipt':'Payment'} assigned to project`,'ok');
  }catch(e){toast('Save failed','error');}
}

function deleteUnmatched(i, isReceipt){
  if(!confirm(`Delete this unmatched ${isReceipt?'receipt':'payment'}?`))return;
  const queue = isReceipt ? tallyUnmatchedReceipts : tallyUnmatched;
  queue.splice(i,1);
  saveUnmatchedToCloud().catch(()=>{});
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
      /* XLSX pre-loaded */
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
        Math.round(calcProjectInterest(p).interest),
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
        const verified=lv?((lv.items||lv.quantities||{})[item.id]||0):0;
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
  const proj = await GPFull(tx.projId); if(!proj) return;
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
    const proj = await GPFull(tx.projId); if(!proj) continue;
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

// ─── SEARCHABLE PROJECT DROPDOWN FOR UNMATCHED ───────
function filterUnmatchedDropdown(inputId, listId){
  const q = (document.getElementById(inputId)?.value||'').toLowerCase();
  const list = document.getElementById(listId);
  if(!list) return;
  list.style.display = 'block';
  Array.from(list.children).forEach(item=>{
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(q) ? 'block' : 'none';
  });
}

function selectUnmatchedProject(inputId, listId, pid, pname){
  const inp = document.getElementById(inputId);
  const hidden = document.getElementById(inputId.replace('um-search-','um-assign-').replace('-list','').replace('search-',''));
  const list = document.getElementById(listId);
  // Find the hidden input by deriving its ID
  const hiddenId = listId.replace('-list','');
  const hiddenEl = document.getElementById(hiddenId);
  if(inp) inp.value = pname;
  if(hiddenEl) hiddenEl.value = pid;
  if(list) list.style.display = 'none';
}

// Close dropdowns when clicking outside
document.addEventListener('click', e=>{
  if(!e.target.closest('[id^="um-search-"]') && !e.target.closest('[id$="-list"]')){
    document.querySelectorAll('[id$="-list"][style*="display: block"]').forEach(el=>el.style.display='none');
  }
});


// ─── COST CENTRE REFERENCE MODAL ─────────────────────
let _ccSearch='',_ccContractor='',_ccStatus='',_ccFirm='';

function openCostCentreRef(){
  let modal=document.getElementById('modal-cc-ref');
  if(!modal){modal=document.createElement('div');modal.className='mov';modal.id='modal-cc-ref';document.body.appendChild(modal);}
  _ccSearch='';_ccContractor='';_ccStatus='';_ccFirm='';
  _renderCCRef(modal);
  modal.classList.add('open');
  setTimeout(()=>document.getElementById('cc-search-inp')?.focus(),150);
}

function _renderCCRef(modal){
  const projects=D.projects.filter(p=>!isArchived(p));
  const contractors=[...new Set(projects.map(p=>GC(p.contractorId)?.name).filter(Boolean))].sort();
  const firms=[...new Set(projects.map(p=>p.firm||'RSR Constructions'))].sort();

  let filtered=projects.filter(p=>{
    if(!p.costCentre) return false;
    const st=projStatus(p),cn=GC(p.contractorId)?.name||'',fi=p.firm||'RSR Constructions';
    if(_ccStatus&&st!==_ccStatus) return false;
    if(_ccFirm&&fi!==_ccFirm) return false;
    if(_ccContractor&&cn!==_ccContractor) return false;
    if(_ccSearch){
      const q=_ccSearch.toLowerCase();
      if(!p.costCentre.toLowerCase().includes(q)&&!p.name.toLowerCase().includes(q)&&!cn.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a,b)=>{
    const ca=GC(a.contractorId)?.name||'',cb=GC(b.contractorId)?.name||'';
    return ca!==cb?ca.localeCompare(cb):a.name.localeCompare(b.name);
  });

  const ST={
    active:{l:'Active',bg:'#dcfce7',c:'#166534'},
    onhold:{l:'On Hold',bg:'#fef9c3',c:'#92400e'},
    completed:{l:'Completed',bg:'#e8edf8',c:'var(--navy)'}
  };
  const noCCCount=projects.filter(p=>!p.costCentre).length;

  // Build rows grouped by contractor
  let lastCon='',bodyHTML='';
  filtered.forEach(p=>{
    const st=projStatus(p),s=ST[st]||ST.active;
    const cn=GC(p.contractorId)?.name||'—';
    const fi=(p.firm||'RSR Constructions').replace('RSR Constructions','RSR').replace('R Sadhu Rao','RS Rao').replace('R Likith Rahul','RLR');
    if(cn!==lastCon){
      lastCon=cn;
      const cnt=filtered.filter(x=>(GC(x.contractorId)?.name||'—')===cn).length;
      bodyHTML+=`<tr style="background:var(--navy)"><td colspan="4" style="padding:8px 14px;font-size:11px;font-weight:800;color:#fff;letter-spacing:.06em">👷 ${cn.toUpperCase()} &nbsp;<span style="opacity:.5;font-weight:400">${cnt} project${cnt>1?'s':''}</span></td></tr>`;
    }
    bodyHTML+=`<tr style="border-bottom:1px solid var(--surface2)" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background=''">
      <td style="padding:9px 14px">
        <div style="font-family:monospace;font-size:12px;font-weight:700;color:#1e3a8a;letter-spacing:.01em;margin-bottom:2px">${p.costCentre}</div>
        <div style="font-size:11px;color:var(--text3)">${fi}</div>
      </td>
      <td style="padding:9px 12px;font-size:12px;color:var(--text2);max-width:320px">${p.name.substring(0,60)}${p.name.length>60?'…':''}</td>
      <td style="padding:9px 10px;text-align:center;white-space:nowrap">
        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:${s.bg};color:${s.c}">${s.l}</span>
      </td>
      <td style="padding:9px 12px;text-align:center">
        <button onclick="copyCCName('${p.costCentre.replace(/'/g,"\\'")}',this)" style="background:var(--navy);color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;white-space:nowrap">📋 Copy</button>
      </td>
    </tr>`;
  });

  modal.innerHTML=`<div class="mbox" style="max-width:900px;width:96vw;max-height:92vh;display:flex;flex-direction:column;padding:0">
    <!-- Header -->
    <div style="background:var(--navy);color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;flex-shrink:0;display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:16px;font-weight:800">🏷️ Tally Cost Centre Reference</div>
        <div style="font-size:11px;opacity:.7;margin-top:3px">Find the correct cost centre name to use while entering transactions in Tally</div>
      </div>
      <button onclick="CM('modal-cc-ref')" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center">✕</button>
    </div>

    <!-- Filters -->
    <div style="padding:12px 16px;background:#f8faff;border-bottom:1px solid var(--border);flex-shrink:0">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input id="cc-search-inp" type="text" placeholder="🔍 Search cost centre, project, contractor…" value="${_ccSearch}"
          oninput="_ccSearch=this.value;_renderCCRef(document.getElementById('modal-cc-ref'))"
          style="flex:1;min-width:200px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px;font-family:'Inter',sans-serif;background:#fff">
        <select onchange="_ccStatus=this.value;_renderCCRef(document.getElementById('modal-cc-ref'))" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px;font-family:'Inter',sans-serif;background:#fff">
          <option value="">All Statuses</option>
          <option value="active" ${_ccStatus==='active'?'selected':''}>🟢 Active</option>
          <option value="completed" ${_ccStatus==='completed'?'selected':''}>✅ Completed</option>
          <option value="onhold" ${_ccStatus==='onhold'?'selected':''}>⏸ On Hold</option>
        </select>
        <select onchange="_ccFirm=this.value;_renderCCRef(document.getElementById('modal-cc-ref'))" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px;font-family:'Inter',sans-serif;background:#fff">
          <option value="">All Firms</option>
          ${firms.map(f=>`<option value="${f}" ${_ccFirm===f?'selected':''}>${f}</option>`).join('')}
        </select>
        <select onchange="_ccContractor=this.value;_renderCCRef(document.getElementById('modal-cc-ref'))" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px;font-family:'Inter',sans-serif;background:#fff">
          <option value="">All Contractors</option>
          ${contractors.map(c=>`<option value="${c}" ${_ccContractor===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;flex-wrap:wrap;gap:6px">
        <span style="font-size:12px;color:var(--text3)">
          Showing <strong>${filtered.length}</strong> of ${projects.filter(p=>p.costCentre).length} projects with cost centres
          ${noCCCount?`&nbsp;·&nbsp;<span style="color:var(--amber)">⚠️ ${noCCCount} missing cost centre</span>`:''}
        </span>
        <button onclick="exportCCRef()" style="background:var(--gold);color:var(--navy);border:none;border-radius:var(--rs);padding:6px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">📊 Export Excel</button>
      </div>
    </div>

    <!-- Table -->
    <div style="overflow-y:auto;overflow-x:auto;flex:1">
      ${filtered.length===0
        ? `<div style="text-align:center;padding:50px;color:var(--text3)">No projects match your filters.</div>`
        : `<table style="width:100%;border-collapse:collapse">
          <thead style="position:sticky;top:0;z-index:2;background:#fff;box-shadow:0 1px 0 var(--border)">
            <tr>
              <th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">Cost Centre Name</th>
              <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">Project</th>
              <th style="padding:9px 10px;text-align:center;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">Status</th>
              <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">Copy</th>
            </tr>
          </thead>
          <tbody>${bodyHTML}</tbody>
        </table>`}
    </div>
  </div>`;
}

function copyCCName(name,btn){
  navigator.clipboard.writeText(name).then(()=>{
    const o=btn.innerHTML;btn.innerHTML='✓ Copied!';btn.style.background='var(--green)';
    setTimeout(()=>{btn.innerHTML=o;btn.style.background='var(--navy)';},1500);
  }).catch(()=>toast('Could not copy — select the text manually','error'));
}

async function exportCCRef(){
  if(!window.XLSX){toast('Excel library not loaded','error');return;}
  const rows=[['Sl No','Cost Centre Name','Project Name','Contractor','Firm','Status']];
  D.projects.filter(p=>!isArchived(p)&&p.costCentre)
    .sort((a,b)=>{const ca=GC(a.contractorId)?.name||'',cb=GC(b.contractorId)?.name||'';return ca!==cb?ca.localeCompare(cb):a.name.localeCompare(b.name);})
    .forEach((p,i)=>{
      const c=GC(p.contractorId);
      rows.push([i+1,p.costCentre,p.name,c?c.name:'—',p.firm||'RSR Constructions',projStatus(p)||'active']);
    });
  const wb=window.XLSX.utils.book_new();
  const ws=window.XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=[{wch:6},{wch:35},{wch:60},{wch:22},{wch:18},{wch:12}];
  window.XLSX.utils.book_append_sheet(wb,ws,'Cost Centres');
  window.XLSX.writeFile(wb,`RSR_Cost_Centres_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('✓ Exported','ok');
}
