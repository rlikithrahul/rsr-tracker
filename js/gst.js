// ═══════════════════════════════════════════════════════
// gst.js — RSR Constructions Tracker
// GST Tracking: Monthly 2B uploads + Quarterly filing records
// Firms: RSR Constructions, R Sadhu Rao, R Likith Rahul
// ═══════════════════════════════════════════════════════

const GST_FIRMS = ['RSR Constructions', 'R Sadhu Rao', 'R Likith Rahul'];

// Quarterly filing months (month after quarter end, 1-indexed)
// Q1: Apr-Jun → July(7), Q2: Jul-Sep → Oct(10), Q3: Oct-Dec → Jan(1), Q4: Jan-Mar → Apr(4)
const GST_FILING_MONTHS = [1, 4, 7, 10];
const GST_FILING_DUE_DAY = 22; // 22nd of the filing month
const GST_MONTHLY_DUE_DAY = 1; // 1st of every month for 2B upload

// ─── DATA LOAD / SAVE ────────────────────────────────
async function loadGSTData(){
  D.gstData = await getSetting('gst_data', {monthly:{}, quarterly:{}});
  if(!D.gstData.monthly) D.gstData.monthly = {};
  if(!D.gstData.quarterly) D.gstData.quarterly = {};
}

async function saveGSTData(){
  D.gstData = await mergeAndSaveSetting('gst_data', D.gstData, false);
}

// ─── KEY HELPERS ─────────────────────────────────────
// Monthly key: "YYYY-MM" for the month being uploaded
function gstMonthKey(year, month){ // month 1-indexed
  return `${year}-${String(month).padStart(2,'0')}`;
}

// Quarterly key: "YYYY-Q1" etc
function gstQuarterKey(year, quarter){
  return `${year}-Q${quarter}`;
}

// Get current quarter info
function getCurrentQuarter(){
  const today = new Date();
  const m = today.getMonth() + 1; // 1-indexed
  const y = today.getFullYear();
  // Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar
  if(m >= 4 && m <= 6) return {q:1, label:'Q1 (Apr–Jun)', year:y, filingMonth:7, filingYear:y};
  if(m >= 7 && m <= 9) return {q:2, label:'Q2 (Jul–Sep)', year:y, filingMonth:10, filingYear:y};
  if(m >= 10 && m <= 12) return {q:3, label:'Q3 (Oct–Dec)', year:y, filingMonth:1, filingYear:y+1};
  // Jan-Mar → Q4 of previous financial year
  return {q:4, label:'Q4 (Jan–Mar)', year:y-1, filingMonth:4, filingYear:y};
}

// Get previous quarter
function getPreviousQuarter(){
  const today = new Date();
  const m = today.getMonth() + 1;
  const y = today.getFullYear();
  if(m >= 4 && m <= 6) return {q:4, label:'Q4 (Jan–Mar)', year:y-1, filingMonth:4, filingYear:y};
  if(m >= 7 && m <= 9) return {q:1, label:'Q1 (Apr–Jun)', year:y, filingMonth:7, filingYear:y};
  if(m >= 10 && m <= 12) return {q:2, label:'Q2 (Jul–Sep)', year:y, filingMonth:10, filingYear:y};
  return {q:3, label:'Q3 (Oct–Dec)', year:y-1, filingMonth:1, filingYear:y};
}

// ─── QUARTERLY BILLS RECEIVED (Dashboard card) ───────
// Start/end date (inclusive) for a given calendar quarter. Note the
// financial-year framing: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
// (Q4 falls in the calendar year AFTER the year label, matching Indian FY
// convention used everywhere else in this app).
function gstQuarterDateRange(year, q){
  const ranges = {
    1: [`${year}-04-01`, `${year}-06-30`],
    2: [`${year}-07-01`, `${year}-09-30`],
    3: [`${year}-10-01`, `${year}-12-31`],
    4: [`${year+1}-01-01`, `${year+1}-03-31`]
  };
  return ranges[q];
}
function gstQuarterFYLabel(year, q){
  // FY label: Q1-Q3 belong to FY year/year+1; Q4 (Jan-Mar) belongs to FY year/year+1 too
  // (year here is the "Q1 anchor year", e.g. year=2026 means FY2026-27)
  const fy = `FY${String(year).slice(2)}-${String(year+1).slice(2)}`;
  const names = {1:'Q1 (Apr–Jun)', 2:'Q2 (Jul–Sep)', 3:'Q3 (Oct–Dec)', 4:'Q4 (Jan–Mar)'};
  return `${names[q]} ${fy}`;
}
// Builds a list of the last N quarters (most recent completed first), for
// the dashboard card's quarter switcher.
function getRecentGSTQuarters(n){
  const cur = getCurrentQuarter();
  let {year, q} = cur;
  const out = [];
  for(let i=0;i<n;i++){
    q--;
    if(q<1){ q=4; year--; }
    out.push({year, q, key:`${year}-Q${q}`, label:gstQuarterFYLabel(year,q)});
  }
  return out;
}

let _gstQuarterlySelected = null; // {year, q} — remembers dropdown choice while on the dashboard

function computeQuarterlyBills(year, q){
  const [start, end] = gstQuarterDateRange(year, q);
  const byFirm = {};
  GST_FIRMS.forEach(f => byFirm[f] = {bills:[], total:0});
  let grandTotal = 0;

  D.projects.filter(p=>!isArchived(p)).forEach(p=>{
    (p.settlements||[]).filter(s=>!isArchived(s)).forEach(s=>{
      if(!s.date || s.date < start || s.date > end) return;
      const firm = p.firm || 'RSR Constructions';
      if(!byFirm[firm]) byFirm[firm] = {bills:[], total:0};
      byFirm[firm].bills.push({
        projectId: p.id, projectName: p.name, contractorName: (GC(p.contractorId)||{}).name||'—',
        amount: s.amount||0, date: s.date, ref: s.ref||'', gstFilingNote: p.gstFilingNote||''
      });
      byFirm[firm].total += (s.amount||0);
      grandTotal += (s.amount||0);
    });
  });
  Object.values(byFirm).forEach(f => f.bills.sort((a,b)=>a.date<b.date?-1:1));
  return {byFirm, grandTotal, start, end};
}

function renderGSTQuarterlyCard(){
  if(!_gstQuarterlySelected){
    const prev = getPreviousQuarter();
    _gstQuarterlySelected = {year: prev.year, q: prev.q};
  }
  const {year, q} = _gstQuarterlySelected;
  const data = computeQuarterlyBills(year, q);
  const quarters = getRecentGSTQuarters(8);
  // Make sure the currently-selected quarter is always in the dropdown
  // even if it's older than the last 8 (e.g. someone picked an old one)
  if(!quarters.some(qt=>qt.year===year&&qt.q===q)){
    quarters.push({year, q, key:`${year}-Q${q}`, label:gstQuarterFYLabel(year,q)});
  }
  const anyBills = Object.values(data.byFirm).some(f=>f.bills.length>0);

  return `
    <div class="card" style="border-top:3px solid var(--navy);margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:4px">
        <div class="st">🧾 GST Filing — Bills Received</div>
        <select onchange="_gstQuarterlySelected=JSON.parse(this.value);renderGSTQuarterlyCardInto()" style="padding:5px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px;font-family:'Inter',sans-serif">
          ${quarters.map(qt=>`<option value='${JSON.stringify({year:qt.year,q:qt.q})}' ${qt.year===year&&qt.q===q?'selected':''}>${qt.label}</option>`).join('')}
        </select>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:14px">
        All payments received (per Settlement date) in <strong>${gstQuarterFYLabel(year,q)}</strong> — ${fmtDate(data.start)} to ${fmtDate(data.end)}. This is what needs to be filed for this quarter.
      </div>
      ${!anyBills ? `<div style="font-size:13px;color:var(--text3);font-style:italic;padding:12px 0">No payments received in this quarter yet.</div>` : GST_FIRMS.concat(Object.keys(data.byFirm).filter(f=>!GST_FIRMS.includes(f))).map(firm=>{
        const f = data.byFirm[firm];
        if(!f || !f.bills.length) return '';
        return `
        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface2);padding:6px 10px;border-radius:6px 6px 0 0;font-weight:700;font-size:13px;color:var(--navy)">
            <span>${firm}</span><span>${fmt(f.total)}</span>
          </div>
          <div class="tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:12px">
            <tbody>
              ${f.bills.map(b=>`
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:6px 10px;cursor:pointer;color:var(--navy)" onclick="openDetail('${b.projectId}')">${b.projectName}</td>
                  <td style="padding:6px 10px;color:var(--text3)">${b.contractorName}</td>
                  <td style="padding:6px 10px;color:var(--text3)">${fmtDate(b.date)}</td>
                  <td style="padding:6px 10px;text-align:right;font-weight:600">${fmt(b.amount)}</td>
                  <td style="padding:6px 10px;min-width:160px">
                    ${CU&&CU.isSuperAdmin
                      ? `<input type="text" value="${(b.gstFilingNote||'').replace(/"/g,'&quot;')}" placeholder="Who files this?" style="width:100%;font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:4px" onblur="saveGSTFilingNote('${b.projectId}', this.value)">`
                      : `<span style="font-size:11px;color:var(--text3)">${b.gstFilingNote||'—'}</span>`}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table></div>
        </div>`;
      }).join('')}
      ${anyBills ? `<div style="display:flex;justify-content:space-between;padding-top:10px;border-top:2px solid var(--navy);font-weight:800;font-size:14px;color:var(--navy)">
        <span>Grand Total</span><span>${fmt(data.grandTotal)}</span>
      </div>` : ''}
    </div>`;
}

function renderGSTQuarterlyCardInto(){
  const el = document.getElementById('dash-gst-quarterly-section');
  if(el) el.innerHTML = renderGSTQuarterlyCard();
}

async function saveGSTFilingNote(pid, note){
  if(!CU || !CU.isSuperAdmin){ toast('Only Super Admin can edit this note','error'); return; }
  const p = await GPFull(pid);
  if(!p) return;
  p.gstFilingNote = note.trim();
  try{
    await saveProjectDB(p);
    renderGSTQuarterlyCardInto();
    toast('✓ Note saved','ok');
  }catch(e){ toast('Save failed — try again','error'); }
}

// ─── DASHBOARD ALERTS ────────────────────────────────
function getGSTDashboardAlerts(){
  if(!D.gstData) return '';
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();
  const items = [];

  // ── MONTHLY 2B UPLOAD ALERTS ──────────────────────
  // Show from 1st of month until uploaded for all 3 firms
  // Check previous month's 2B (uploaded on 1st of current month)
  const prevMonth = todayMonth === 1 ? 12 : todayMonth - 1;
  const prevYear = todayMonth === 1 ? todayYear - 1 : todayYear;
  const prevMonthKey = gstMonthKey(prevYear, prevMonth);
  const monthNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Show monthly alert from 1st to end of month
  if(todayDay >= GST_MONTHLY_DUE_DAY){
    GST_FIRMS.forEach(firm=>{
      const uploaded = D.gstData.monthly[`${firm}_${prevMonthKey}`];
      if(!uploaded){
        const isOverdue = todayDay > 7; // overdue after 7th
        items.push({
          type: isOverdue ? 'red' : 'amber',
          icon: '📂',
          text: `Upload ${monthNames[prevMonth]} 2B — ${firm}`,
          sub: isOverdue ? `Overdue — upload now` : `Due by 7th`,
          action: ()=>openGSTMonthlyUpload(firm, prevMonthKey, monthNames[prevMonth]+' '+prevYear),
          actionLabel: 'Upload 2B'
        });
      }
    });
  }

  // ── QUARTERLY FILING ALERTS ───────────────────────
  // Show from 22nd of filing month until all 3 firms are done
  const currQ = getCurrentQuarter();
  const prevQ = getPreviousQuarter();

  // Check if we're in a filing month (1st to end of filing month)
  const checkQuarter = (qInfo) => {
    if(todayMonth === qInfo.filingMonth && todayYear === qInfo.filingYear){
      const qKey = gstQuarterKey(qInfo.year, qInfo.q);
      GST_FIRMS.forEach(firm=>{
        const filed = D.gstData.quarterly[`${firm}_${qKey}`];
        if(!filed){
          const daysUntilDue = GST_FILING_DUE_DAY - todayDay;
          const isOverdue = todayDay > GST_FILING_DUE_DAY;
          const isDueSoon = daysUntilDue <= 5 && daysUntilDue >= 0;
          if(isDueSoon || isOverdue || todayDay >= 15){
            items.push({
              type: isOverdue ? 'red' : 'amber',
              icon: '📋',
              text: `GST ${qInfo.label} filing — ${firm}`,
              sub: isOverdue ? `Overdue — enter filing details` : `Due ${GST_FILING_DUE_DAY}th`,
              action: ()=>openGSTQuarterlyEntry(firm, qKey, qInfo.label),
              actionLabel: 'Enter Details'
            });
          }
        }
      });
    }
  };

  checkQuarter(currQ);
  checkQuarter(prevQ);

  if(!items.length) return '';

  return `<div class="card" style="border-top:3px solid ${items.some(i=>i.type==='red')?'var(--red)':'var(--amber)'};padding:12px;margin-bottom:14px">
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">🧾 GST Tasks</div>
    ${items.map(item=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--surface2);gap:8px">
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--text1)">${item.icon} ${item.text}</div>
          <div style="font-size:11px;color:${item.type==='red'?'var(--red)':'#92400e'}">${item.sub}</div>
        </div>
        <button onclick="(${item.action.toString()})()" style="background:${item.type==='red'?'var(--red)':'var(--amber)'};color:#fff;border:none;border-radius:var(--rs);padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;white-space:nowrap">${item.actionLabel}</button>
      </div>`).join('')}
    <button onclick="ownerTab(7)" style="margin-top:8px;background:none;border:none;font-size:11px;color:var(--navy);font-weight:600;cursor:pointer;font-family:'Inter',sans-serif">View GST Tab →</button>
  </div>`;
}

// ─── MAIN GST TAB RENDER ─────────────────────────────
function renderGST(){
  const el = document.getElementById('gst-wrap');
  if(!el) return;

  const today = new Date();
  const currYear = today.getFullYear();
  const monthNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Build last 6 months for monthly section
  const months = [];
  for(let i=0; i<6; i++){
    let m = today.getMonth() + 1 - i;
    let y = currYear;
    if(m <= 0){ m += 12; y--; }
    months.push({month:m, year:y, key:gstMonthKey(y,m), label:`${monthNames[m]} ${y}`});
  }

  // Build last 4 quarters
  const quarters = [];
  const qSeq = [getPreviousQuarter(), getCurrentQuarter()];
  // Add 2 more quarters back
  // Simple: manually build last 4 quarters
  const allQ = [];
  for(let i=3; i>=0; i--){
    const refDate = new Date(today.getFullYear(), today.getMonth() - (i*3), 1);
    const rm = refDate.getMonth() + 1;
    const ry = refDate.getFullYear();
    let q, label, qYear;
    if(rm >= 4 && rm <= 6){ q=1; label='Q1 (Apr–Jun)'; qYear=ry; }
    else if(rm >= 7 && rm <= 9){ q=2; label='Q2 (Jul–Sep)'; qYear=ry; }
    else if(rm >= 10 && rm <= 12){ q=3; label='Q3 (Oct–Dec)'; qYear=ry; }
    else { q=4; label='Q4 (Jan–Mar)'; qYear=ry-1; }
    const key = gstQuarterKey(qYear, q);
    if(!allQ.find(x=>x.key===key)) allQ.push({q, label, year:qYear, key});
  }

  el.innerHTML = `
    <div class="pg-hdr">
      <div class="pg-title">🧾 GST Tracker</div>
      <div style="font-size:12px;color:var(--text3)">Quarterly filing · 3 firms</div>
    </div>

    <!-- MONTHLY 2B UPLOADS -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-hdr">
        <div class="st">📂 Monthly 2B Uploads</div>
        <div style="font-size:11px;color:var(--text3)">Upload by 7th of each month</div>
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead>
            <tr>
              <th style="text-align:left;padding:8px 12px;font-size:12px;color:var(--text3);font-weight:600;border-bottom:2px solid var(--border)">Month</th>
              ${GST_FIRMS.map(f=>`<th style="text-align:center;padding:8px 12px;font-size:12px;color:var(--text3);font-weight:600;border-bottom:2px solid var(--border)">${f}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${months.map(({month,year,key,label})=>`
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:10px 12px;font-size:13px;font-weight:600">${label}</td>
                ${GST_FIRMS.map(firm=>{
                  const data = D.gstData.monthly[`${firm}_${key}`];
                  return `<td style="padding:10px 12px;text-align:center">
                    ${data
                      ? `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
                          <span style="color:var(--green);font-size:12px;font-weight:700">✅ ₹${(data.itcTotal||0).toLocaleString('en-IN')}</span>
                          <span style="font-size:10px;color:var(--text3)">${data.uploadedOn||''}</span>
                          <button onclick="openGSTMonthlyUpload('${firm}','${key}','${label}')" style="font-size:10px;color:var(--navy);background:none;border:none;cursor:pointer;font-family:'Inter',sans-serif;text-decoration:underline">Edit</button>
                        </div>`
                      : `<button onclick="openGSTMonthlyUpload('${firm}','${key}','${label}')" style="background:var(--navy);color:#fff;border:none;border-radius:var(--rs);padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif">📂 Upload 2B</button>`
                    }
                  </td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- QUARTERLY FILING -->
    <div class="card">
      <div class="card-hdr">
        <div class="st">📋 Quarterly GST Filing</div>
        <div style="font-size:11px;color:var(--text3)">Enter after CA files — due 22nd of filing month</div>
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead>
            <tr>
              <th style="text-align:left;padding:8px 12px;font-size:12px;color:var(--text3);font-weight:600;border-bottom:2px solid var(--border)">Quarter</th>
              ${GST_FIRMS.map(f=>`<th style="text-align:center;padding:8px 12px;font-size:12px;color:var(--text3);font-weight:600;border-bottom:2px solid var(--border)">${f}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${allQ.map(({q,label,year,key})=>`
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:10px 12px">
                  <div style="font-size:13px;font-weight:700">${label}</div>
                  <div style="font-size:11px;color:var(--text3)">FY ${year}-${String(year+1).slice(2)}</div>
                </td>
                ${GST_FIRMS.map(firm=>{
                  const data = D.gstData.quarterly[`${firm}_${key}`];
                  return `<td style="padding:10px 12px;text-align:center">
                    ${data
                      ? `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
                          <span style="color:var(--green);font-size:11px;font-weight:700">✅ Filed ${data.filedDate||''}</span>
                          <span style="font-size:10px;color:var(--text2)">Out: ₹${(data.outputTax||0).toLocaleString('en-IN')}</span>
                          <span style="font-size:10px;color:var(--green)">ITC: ₹${(data.itcClaimed||0).toLocaleString('en-IN')}</span>
                          <span style="font-size:10px;color:var(--red)">Paid: ₹${(data.netPaid||0).toLocaleString('en-IN')}</span>
                          <button onclick="openGSTQuarterlyEntry('${firm}','${key}','${label}')" style="font-size:10px;color:var(--navy);background:none;border:none;cursor:pointer;font-family:'Inter',sans-serif;text-decoration:underline;margin-top:2px">Edit</button>
                        </div>`
                      : `<button onclick="openGSTQuarterlyEntry('${firm}','${key}','${label}')" style="background:var(--navy);color:#fff;border:none;border-radius:var(--rs);padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif">📋 Enter</button>`
                    }
                  </td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- ANNUAL SUMMARY -->
    ${renderGSTAnnualSummary()}
  `;
}

function renderGSTAnnualSummary(){
  const today = new Date();
  const fy = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fyLabel = `FY ${fy}-${String(fy+1).slice(2)}`;

  // Sum up quarterly data for current FY
  const quarters = ['Q1','Q2','Q3','Q4'];
  let totalOutput = 0, totalITC = 0, totalPaid = 0;
  let hasData = false;

  GST_FIRMS.forEach(firm=>{
    quarters.forEach(q=>{
      const key = `${fy}-${q}`;
      const data = D.gstData.quarterly[`${firm}_${key}`];
      if(data){
        hasData = true;
        totalOutput += data.outputTax||0;
        totalITC += data.itcClaimed||0;
        totalPaid += data.netPaid||0;
      }
    });
  });

  if(!hasData) return '';

  return `<div class="card" style="margin-top:20px">
    <div class="st" style="margin-bottom:14px">📊 ${fyLabel} Summary (All Firms)</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
      <div style="text-align:center;padding:12px;background:var(--surface2);border-radius:var(--rs)">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Total Output Tax</div>
        <div style="font-size:16px;font-weight:800;color:var(--navy)">₹${totalOutput.toLocaleString('en-IN')}</div>
      </div>
      <div style="text-align:center;padding:12px;background:#e8f5e9;border-radius:var(--rs)">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Total ITC Claimed</div>
        <div style="font-size:16px;font-weight:800;color:var(--green)">₹${totalITC.toLocaleString('en-IN')}</div>
      </div>
      <div style="text-align:center;padding:12px;background:#fef2f2;border-radius:var(--rs)">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Net Cash Paid</div>
        <div style="font-size:16px;font-weight:800;color:var(--red)">₹${totalPaid.toLocaleString('en-IN')}</div>
      </div>
    </div>
  </div>`;
}

// ─── MONTHLY 2B UPLOAD MODAL ─────────────────────────
function openGSTMonthlyUpload(firm, monthKey, monthLabel){
  let modal = document.getElementById('modal-gst-monthly');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'mov'; modal.id = 'modal-gst-monthly';
    document.body.appendChild(modal);
  }
  const existing = D.gstData.monthly[`${firm}_${monthKey}`];

  modal.innerHTML = `<div class="mbox" style="max-width:500px">
    <div class="mhdr">
      <h2>📂 ${firm} — ${monthLabel} 2B Upload</h2>
      <button class="mx" onclick="CM('modal-gst-monthly')">✕</button>
    </div>

    <div style="background:var(--surface2);border-radius:var(--rs);padding:12px;margin-bottom:16px;font-size:12px;color:var(--text2)">
      <strong>How to download 2B:</strong> GST Portal → Returns → Input Tax Credit → GSTR-2B → Select month → Download JSON
    </div>

    <div class="fg">
      <label>Upload GSTR-2B JSON File</label>
      <input type="file" id="gst-2b-file" accept=".json" style="padding:8px;border:1.5px dashed var(--border);border-radius:var(--rs);width:100%;font-family:'Inter',sans-serif;cursor:pointer">
    </div>

    <div style="text-align:center;color:var(--text3);font-size:12px;padding:4px 0">— or enter manually —</div>

    <div class="fg">
      <label>Total ITC Available (₹) <span style="color:var(--text3);font-weight:400">— from 2B summary</span></label>
      <input type="number" id="gst-itc-total" placeholder="e.g. 45000" value="${existing?.itcTotal||''}">
    </div>
    <div class="frow">
      <div class="fg">
        <label>No. of Suppliers</label>
        <input type="number" id="gst-supplier-count" placeholder="e.g. 12" value="${existing?.supplierCount||''}">
      </div>
      <div class="fg">
        <label>IGST (₹)</label>
        <input type="number" id="gst-igst" placeholder="0" value="${existing?.igst||''}">
      </div>
    </div>
    <div class="frow">
      <div class="fg">
        <label>CGST (₹)</label>
        <input type="number" id="gst-cgst" placeholder="0" value="${existing?.cgst||''}">
      </div>
      <div class="fg">
        <label>SGST (₹)</label>
        <input type="number" id="gst-sgst" placeholder="0" value="${existing?.sgst||''}">
      </div>
    </div>

    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn" onclick="CM('modal-gst-monthly')">Cancel</button>
      <button class="btn btn-navy" onclick="saveGSTMonthly('${firm}','${monthKey}')">✓ Save</button>
    </div>
  </div>`;

  modal.classList.add('open');

  // Handle JSON file upload
  document.getElementById('gst-2b-file').addEventListener('change', function(e){
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(ev){
      try{
        const json = JSON.parse(ev.target.result);
        // GST 2B JSON structure: data.docdata.itc or summary
        const itc = extractITCFromJSON(json);
        if(itc.total) document.getElementById('gst-itc-total').value = itc.total;
        if(itc.igst) document.getElementById('gst-igst').value = itc.igst;
        if(itc.cgst) document.getElementById('gst-cgst').value = itc.cgst;
        if(itc.sgst) document.getElementById('gst-sgst').value = itc.sgst;
        if(itc.count) document.getElementById('gst-supplier-count').value = itc.count;
        toast('✓ 2B file read — verify amounts below','ok');
      }catch(err){
        toast('Could not read JSON — enter manually below','error');
      }
    };
    reader.readAsText(file);
  });
}

function extractITCFromJSON(json){
  // Handle GST portal 2B JSON format
  try{
    // Standard GSTN 2B format
    const data = json.data || json;
    let igst=0, cgst=0, sgst=0, count=0;

    // Try summary first
    if(data.itcavl){
      data.itcavl.forEach(section=>{
        (section.items||[]).forEach(item=>{
          igst += item.igst||0;
          cgst += item.cgst||0;
          sgst += item.sgst||0;
        });
      });
    }

    // Count suppliers from B2B section
    if(data.docdata && data.docdata.b2b){
      count = data.docdata.b2b.length;
      if(!igst){ // fallback: sum from invoice level
        data.docdata.b2b.forEach(supplier=>{
          (supplier.inv||[]).forEach(inv=>{
            (inv.items||[]).forEach(item=>{
              igst += item.igst||0;
              cgst += item.cgst||0;
              sgst += item.sgst||0;
            });
          });
        });
      }
    }

    const total = Math.round(igst + cgst + sgst);
    return {total, igst:Math.round(igst), cgst:Math.round(cgst), sgst:Math.round(sgst), count};
  }catch(e){ return {}; }
}

async function saveGSTMonthly(firm, monthKey){
  const itcTotal = parseFloat(document.getElementById('gst-itc-total').value)||0;
  if(!itcTotal){ toast('Enter ITC total amount','error'); return; }

  if(!D.gstData.monthly) D.gstData.monthly = {};
  D.gstData.monthly[`${firm}_${monthKey}`] = {
    itcTotal,
    igst: parseFloat(document.getElementById('gst-igst').value)||0,
    cgst: parseFloat(document.getElementById('gst-cgst').value)||0,
    sgst: parseFloat(document.getElementById('gst-sgst').value)||0,
    supplierCount: parseInt(document.getElementById('gst-supplier-count').value)||0,
    uploadedOn: new Date().toISOString().split('T')[0],
    uploadedBy: CU?.name||'Admin'
  };

  try{
    await saveGSTData();
    CM('modal-gst-monthly');
    renderGST();
    // Refresh dashboard GST section
    refreshGSTDashSection();
    toast('✓ 2B data saved','ok');
  }catch(e){ toast('Save failed','error'); }
}

// ─── QUARTERLY FILING ENTRY MODAL ────────────────────
function openGSTQuarterlyEntry(firm, quarterKey, quarterLabel){
  let modal = document.getElementById('modal-gst-quarterly');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'mov'; modal.id = 'modal-gst-quarterly';
    document.body.appendChild(modal);
  }
  const existing = D.gstData.quarterly[`${firm}_${quarterKey}`];

  modal.innerHTML = `<div class="mbox" style="max-width:480px">
    <div class="mhdr">
      <h2>📋 ${firm}</h2>
      <button class="mx" onclick="CM('modal-gst-quarterly')">✕</button>
    </div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:16px">${quarterLabel} GST Filing Details</div>

    <div class="fg">
      <label>Date Filed by CA *</label>
      <input type="date" id="gst-q-filed-date" value="${existing?.filedDate||''}">
    </div>
    <div class="frow">
      <div class="fg">
        <label>Output Tax (₹) *</label>
        <input type="number" id="gst-q-output" placeholder="GST collected on sales" value="${existing?.outputTax||''}">
      </div>
      <div class="fg">
        <label>ITC Claimed (₹) *</label>
        <input type="number" id="gst-q-itc" placeholder="Input credit used" value="${existing?.itcClaimed||''}">
      </div>
    </div>
    <div class="frow">
      <div class="fg">
        <label>Net Cash Paid (₹) *</label>
        <input type="number" id="gst-q-paid" placeholder="Tax paid in cash" value="${existing?.netPaid||''}">
      </div>
      <div class="fg">
        <label>Late Fees / Interest (₹)</label>
        <input type="number" id="gst-q-latef" placeholder="0 if filed on time" value="${existing?.lateFees||''}">
      </div>
    </div>
    <div class="fg">
      <label>Notes (optional)</label>
      <input type="text" id="gst-q-notes" placeholder="Any CA remarks, issues..." value="${existing?.notes||''}">
    </div>

    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn" onclick="CM('modal-gst-quarterly')">Cancel</button>
      <button class="btn btn-navy" onclick="saveGSTQuarterly('${firm}','${quarterKey}')">✓ Save Filing Details</button>
    </div>
  </div>`;

  modal.classList.add('open');
}

async function saveGSTQuarterly(firm, quarterKey){
  const filedDate = document.getElementById('gst-q-filed-date').value;
  const outputTax = parseFloat(document.getElementById('gst-q-output').value)||0;
  const itcClaimed = parseFloat(document.getElementById('gst-q-itc').value)||0;
  const netPaid = parseFloat(document.getElementById('gst-q-paid').value)||0;

  if(!filedDate){ toast('Enter filing date','error'); return; }

  if(!D.gstData.quarterly) D.gstData.quarterly = {};
  D.gstData.quarterly[`${firm}_${quarterKey}`] = {
    filedDate,
    outputTax,
    itcClaimed,
    netPaid,
    lateFees: parseFloat(document.getElementById('gst-q-latef').value)||0,
    notes: document.getElementById('gst-q-notes').value.trim(),
    enteredOn: new Date().toISOString().split('T')[0],
    enteredBy: CU?.name||'Admin'
  };

  try{
    await saveGSTData();
    CM('modal-gst-quarterly');
    renderGST();
    refreshGSTDashSection();
    toast('✓ GST filing details saved','ok');
  }catch(e){ toast('Save failed','error'); }
}

// ─── REFRESH DASHBOARD GST SECTION ───────────────────
function refreshGSTDashSection(){
  const sidebarCol = document.getElementById('dash-sidebar-col');
  if(sidebarCol){
    // Re-render the EMI + GST sections in sidebar col
    const emiEl = document.getElementById('dash-emi-section');
    const gstEl = document.getElementById('dash-gst-section');
    if(emiEl) emiEl.innerHTML = getEMIDashboardAlerts();
    if(gstEl) gstEl.innerHTML = getGSTDashboardAlerts();
  }
  // Also refresh alert strip
  const banner = document.getElementById('dash-banner');
  if(banner) banner.innerHTML = renderDashAlertStrip();
}
