// ═══════════════════════════════════════════════════════
// labour.js — RSR Constructions Tracker
// Daily Labour Register + Site Expense Logger
// Contractor-side only
// ═══════════════════════════════════════════════════════

// ─── DEFAULT LABOUR TYPES ─────────────────────────────
const DEFAULT_LABOUR_TYPES = [
  { id:'mestri',    label:'Mestri',           icon:'👷' },
  { id:'nmr_m',     label:'NMR (Male)',        icon:'👨' },
  { id:'nmr_f',     label:'NMR (Female)',      icon:'👩' },
  { id:'rod_bender',label:'Rod Bender',        icon:'🔧' },
  { id:'centering', label:'Centering Labour',  icon:'🏗️' },
  { id:'carpenter', label:'Carpenter',         icon:'🪚' },
  { id:'plumber',   label:'Plumber',           icon:'🔩' },
  { id:'painter',   label:'Painter',           icon:'🖌️' },
];

const LABOUR_STORAGE_KEY = 'rsr_labour_v1';
const EXPENSE_STORAGE_KEY = 'rsr_expense_v1';

// ─── GET CONTRACTOR LABOUR TYPES ─────────────────────
function getLabourTypes(){
  const custom = JSON.parse(localStorage.getItem('rsr_custom_labour')||'[]');
  return [...DEFAULT_LABOUR_TYPES, ...custom];
}

function addCustomLabourType(label){
  if(!label.trim()) return;
  const custom = JSON.parse(localStorage.getItem('rsr_custom_labour')||'[]');
  const id = 'custom_'+label.trim().toLowerCase().replace(/\s+/g,'_');
  if(custom.some(c=>c.id===id)) return;
  custom.push({id, label:label.trim(), icon:'👤', custom:true});
  localStorage.setItem('rsr_custom_labour', JSON.stringify(custom));
}

// ─── LOAD/SAVE LABOUR DATA ────────────────────────────
async function loadLabourData(){
  const key = LABOUR_STORAGE_KEY + '_' + (CU&&CU.id||'');
  D.labourData = await getSetting(key, {});
}

async function saveLabourData(){
  const key = LABOUR_STORAGE_KEY + '_' + (CU&&CU.id||'');
  await saveSetting(key, D.labourData);
}

async function loadExpenseData(){
  const key = EXPENSE_STORAGE_KEY + '_' + (CU&&CU.id||'');
  D.expenseData = await getSetting(key, {});
}

async function saveExpenseData(){
  const key = EXPENSE_STORAGE_KEY + '_' + (CU&&CU.id||'');
  await saveSetting(key, D.expenseData);
}


// ─── REFRESH LABOUR INPUTS ON DATE CHANGE ─────────────
function refreshLabourInputs(pid){
  const dateEl = document.getElementById('labour_date_'+pid);
  if(!dateEl) return;
  const date = dateEl.value;
  const today = new Date().toISOString().split('T')[0];
  const types = getLabourTypes();
  const entry = ((D.labourData||{})[pid]||{})[date] || {};

  // Update label
  const labelEl = document.getElementById('labour_date_label_'+pid);
  if(labelEl){
    if(date===today) labelEl.textContent='Today';
    else if(date===new Date(Date.now()-86400000).toISOString().split('T')[0]) labelEl.textContent='Yesterday';
    else labelEl.textContent=fmtDate(date);
  }

  // Update input values
  types.forEach(t=>{
    const inp = document.getElementById('labour_'+pid+'_'+t.id);
    if(inp) inp.value = entry[t.id]||'';
  });
}

// ─── SAVE LABOUR FROM DATE PICKER ─────────────────────
async function saveLabourEntryFromDate(pid){
  const dateEl = document.getElementById('labour_date_'+pid);
  const date = dateEl ? dateEl.value : new Date().toISOString().split('T')[0];
  await saveLabourEntry(pid, date);
}

// ─── RENDER LABOUR TAB FOR A PROJECT ─────────────────
function renderLabourTab(pid){
  const p = GP(pid); if(!p) return '';
  const entries = (D.labourData||{})[pid] || {};
  const types = getLabourTypes();
  const today = new Date().toISOString().split('T')[0];

  // Sort dates descending
  const dates = Object.keys(entries).sort().reverse();
  const todayEntry = entries[today] || {};

  return `<div style="padding:14px">

    <!-- Log Labour -->
    <div class="card" style="margin-bottom:14px">
      <div class="st" style="margin-bottom:12px">📋 Log Labour</div>

      <!-- Date selector -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:10px 12px;background:var(--surface2);border-radius:var(--rs);flex-wrap:wrap">
        <label style="font-size:12px;font-weight:600;color:var(--text2);white-space:nowrap">📅 Date:</label>
        <input type="date" id="labour_date_${pid}" value="${today}"
          onchange="refreshLabourInputs('${pid}')"
          style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px;font-weight:600;color:var(--navy);flex:1;min-width:140px">
        <span style="font-size:11px;color:var(--text3)" id="labour_date_label_${pid}">Today</span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:12px">
        ${types.map(t=>`
          <div style="background:var(--surface2);border-radius:var(--rs);padding:10px">
            <div style="font-size:11px;color:var(--text2);margin-bottom:6px">${t.icon} ${t.label}</div>
            <input type="number" min="0" step="1"
              id="labour_${pid}_${t.id}"
              value="${todayEntry[t.id]||''}"
              placeholder="0"
              style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border);border-radius:var(--rs);font-size:14px;font-weight:700;text-align:center;font-family:'Inter',sans-serif">
          </div>`).join('')}

        <!-- Add custom type -->
        <div style="background:var(--surface2);border-radius:var(--rs);padding:10px;display:flex;flex-direction:column;justify-content:center;align-items:center;cursor:pointer;border:1.5px dashed var(--border)" onclick="showAddCustomLabour('${pid}')">
          <div style="font-size:22px;color:var(--text3)">+</div>
          <div style="font-size:11px;color:var(--text3)">Add type</div>
        </div>
      </div>

      <button class="btn btn-navy" onclick="saveLabourEntryFromDate('${pid}')" style="width:100%;margin-bottom:10px">
        ✓ Save Labour Entry
      </button>

      <!-- Optional photo -->
      <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:600">📸 Optional — attach photo</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="triggerLabourPhoto('${pid}','camera')" style="flex:1;padding:8px;border:1.5px solid var(--border);border-radius:var(--rs);background:#fff;cursor:pointer;font-size:12px;font-weight:600;font-family:'Inter',sans-serif">📷 Camera</button>
          <button onclick="triggerLabourPhoto('${pid}','gallery')" style="flex:1;padding:8px;border:1.5px solid var(--border);border-radius:var(--rs);background:#fff;cursor:pointer;font-size:12px;font-weight:600;font-family:'Inter',sans-serif">🖼️ Gallery</button>
        </div>
        <input type="file" id="labour-photo-input-${pid}" accept="image/*" style="display:none" onchange="previewLabourPhoto('${pid}',this)">
        <div id="labour-photo-preview-${pid}" style="margin-top:8px"></div>
      </div>
    </div>

    <!-- History -->
    ${dates.length ? `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div class="st" style="margin:0;border:none;padding:0">📅 Labour History</div>
        <button class="btn btn-sm btn-navy" onclick="showLabourReport('${pid}')">📊 View Report</button>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:400px;font-size:12px">
          <thead><tr style="background:var(--navy)">
            <th style="padding:8px;color:#fff;text-align:left">Date</th>
            ${types.map(t=>`<th style="padding:8px;color:#fff;text-align:center;white-space:nowrap">${t.label}</th>`).join('')}
            <th style="padding:8px;color:#fff;text-align:center">Total</th>
          </tr></thead>
          <tbody>
            ${dates.slice(0,30).map((d,i)=>{
              const e = entries[d]||{};
              const total = types.reduce((s,t)=>s+(parseInt(e[t.id])||0),0);
              return `<tr style="background:${i%2===0?'#fff':'var(--surface2)'}">
                <td style="padding:7px 8px;font-weight:600;white-space:nowrap">${fmtDate(d)}</td>
                ${types.map(t=>`<td style="padding:7px 8px;text-align:center">${e[t.id]||'—'}</td>`).join('')}
                <td style="padding:7px 8px;text-align:center;font-weight:700;color:var(--navy)">${total}</td>
                <td style="padding:4px"><button onclick="deleteLabourEntry('${pid}','${d}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:2px">🗑️</button></td>
              </tr>`;
            }).join('')}
            <!-- Totals row -->
            <tr style="background:var(--navy);font-weight:700">
              <td style="padding:8px;color:var(--gold)">TOTAL</td>
              ${types.map(t=>`<td style="padding:8px;text-align:center;color:#fff">${dates.reduce((s,d)=>s+(parseInt((entries[d]||{})[t.id])||0),0)}</td>`).join('')}
              <td style="padding:8px;text-align:center;color:var(--gold)">${dates.reduce((s,d)=>s+types.reduce((ss,t)=>ss+(parseInt((entries[d]||{})[t.id])||0),0),0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>` : '<div style="text-align:center;color:var(--text3);font-size:13px;padding:20px">No labour entries yet. Log today\'s labour above.</div>'}
  </div>`;
}

// ─── SAVE LABOUR ENTRY ────────────────────────────────
async function saveLabourEntry(pid, date){
  if(!D.labourData) D.labourData = {};
  if(!D.labourData[pid]) D.labourData[pid] = {};
  const types = getLabourTypes();
  const entry = {};
  types.forEach(t=>{
    const val = parseInt(document.getElementById(`labour_${pid}_${t.id}`)?.value)||0;
    if(val>0) entry[t.id] = val;
  });
  D.labourData[pid][date] = entry;
  try{
    await saveLabourData();
    const lp = (typeof GP==='function')?GP(pid):null;
    logActivity({category:'project',action:'labour_added',projectId:pid,projectName:lp?lp.name:'',description:(typeof CU!=='undefined'&&CU?CU.name:'Contractor')+' added labour for '+fmtDate(date)+(lp?' — '+lp.name:'')});
    toast('✓ Labour saved for '+fmtDate(date),'ok');
    // Re-render labour tab
    const wrap = document.getElementById('labour-tab-wrap');
    if(wrap) wrap.innerHTML = renderLabourTab(pid);
  }catch(e){ toast('Save failed','error'); }
}

// ─── ADD CUSTOM LABOUR TYPE ───────────────────────────
function showAddCustomLabour(pid){
  const label = prompt('Enter custom labour type name:');
  if(!label) return;
  addCustomLabourType(label);
  const wrap = document.getElementById('labour-tab-wrap');
  if(wrap) wrap.innerHTML = renderLabourTab(pid);
  toast(`✓ "${label}" added to labour types`,'ok');
}

// ─── LABOUR REPORT MODAL ──────────────────────────────
function showLabourReport(pid){
  const p = GP(pid); if(!p) return;
  const entries = (D.labourData||{})[pid] || {};
  const types = getLabourTypes();
  const dates = Object.keys(entries).sort();

  let modal = document.getElementById('modal-labour-report');
  if(!modal){
    modal = document.createElement('div');
    modal.className='mov'; modal.id='modal-labour-report';
    document.body.appendChild(modal);
  }

  const totals = {};
  types.forEach(t=>{ totals[t.id]=dates.reduce((s,d)=>s+(parseInt((entries[d]||{})[t.id])||0),0); });
  const grandTotal = Object.values(totals).reduce((s,v)=>s+v,0);

  modal.innerHTML = `<div class="mbox" style="max-width:95vw;width:900px;max-height:90vh;display:flex;flex-direction:column">
    <div style="background:var(--navy);padding:14px 18px;border-radius:var(--rs) var(--rs) 0 0;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
      <div>
        <div style="font-size:15px;font-weight:700;color:#fff">📊 Labour Report — ${p.name}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.6)">${dates.length} working days · Total ${grandTotal} labour</div>
      </div>
      <button class="mx" onclick="CM('modal-labour-report')" style="color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2)">✕</button>
    </div>
    <!-- Summary -->
    <div style="background:var(--surface2);padding:12px 18px;display:flex;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--border);flex-shrink:0">
      ${types.filter(t=>totals[t.id]>0).map(t=>`
        <div style="font-size:12px"><span style="color:var(--text3)">${t.label}: </span><strong>${totals[t.id]}</strong></div>
      `).join('')}
    </div>
    <!-- Table -->
    <div style="overflow:auto;flex:1">
      <table style="width:100%;border-collapse:collapse;min-width:500px">
        <thead><tr style="background:var(--navy);position:sticky;top:0">
          <th style="padding:10px 12px;color:#fff;text-align:left;font-size:11px">Date</th>
          ${types.map(t=>`<th style="padding:10px 8px;color:#fff;text-align:center;font-size:11px;white-space:nowrap">${t.label}</th>`).join('')}
          <th style="padding:10px 12px;color:var(--gold);text-align:center;font-size:11px">Total</th>
        </tr></thead>
        <tbody>
          ${dates.map((d,i)=>{
            const e=entries[d]||{};
            const total=types.reduce((s,t)=>s+(parseInt(e[t.id])||0),0);
            return `<tr style="background:${i%2===0?'#fff':'#f8f9fc'}">
              <td style="padding:8px 12px;font-weight:600;font-size:12px">${fmtDate(d)}</td>
              ${types.map(t=>`<td style="padding:8px;text-align:center;font-size:12px">${parseInt(e[t.id])||'—'}</td>`).join('')}
              <td style="padding:8px 12px;text-align:center;font-weight:700;color:var(--navy)">${total}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr style="background:var(--navy);position:sticky;bottom:0">
          <td style="padding:10px 12px;color:var(--gold);font-weight:700">TOTAL</td>
          ${types.map(t=>`<td style="padding:10px 8px;text-align:center;color:#fff;font-weight:700">${totals[t.id]||'—'}</td>`).join('')}
          <td style="padding:10px 12px;text-align:center;color:var(--gold);font-weight:800">${grandTotal}</td>
        </tr></tfoot>
      </table>
    </div>
  </div>`;
  modal.classList.add('open');
}

// ─── EXPENSE LOGGER ───────────────────────────────────
const DEFAULT_EXPENSE_CATS = [
  {id:'labour_pay', label:'Labour Payment',  icon:'💵'},
  {id:'diesel',     label:'Diesel / Fuel',   icon:'⛽'},
  {id:'transport',  label:'Transport',        icon:'🚛'},
  {id:'material',   label:'Material (Petty)', icon:'🧱'},
  {id:'food',       label:'Food / Tea',       icon:'☕'},
  {id:'petty_cash', label:'Petty Cash',       icon:'💰'},
  {id:'other',      label:'Other',            icon:'📝'},
];

function renderExpenseTab(pid){
  const p = GP(pid); if(!p) return '';
  const expenses = ((D.expenseData||{})[pid])||[];
  const sorted = [...expenses].sort((a,b)=>b.date.localeCompare(a.date));
  const total = expenses.reduce((s,e)=>s+(e.amount||0),0);

  return `<div style="padding:14px">

    <!-- Add Expense -->
    <div class="card" style="margin-bottom:14px">
      <div class="st" style="margin-bottom:12px">💸 Log Expense</div>
      <div class="frow">
        <div class="fg"><label>Date</label><input type="date" id="exp_date_${pid}" value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="fg"><label>Category</label>
          <select id="exp_cat_${pid}">
            ${DEFAULT_EXPENSE_CATS.map(c=>`<option value="${c.id}">${c.icon} ${c.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="frow">
        <div class="fg"><label>Amount (₹)</label><input type="number" id="exp_amt_${pid}" placeholder="Enter amount" step="0.01" min="0"></div>
        <div class="fg"><label>Note (optional)</label><input type="text" id="exp_note_${pid}" placeholder="Brief description"></div>
      </div>
      <button class="btn btn-navy" onclick="addExpense('${pid}')" style="width:100%;margin-top:8px;margin-bottom:10px">+ Add Expense</button>

      <!-- Optional photo for expense -->
      <div style="border-top:1px solid var(--border);padding-top:10px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:600">📸 Optional — attach receipt photo</div>
        <div style="display:flex;gap:8px">
          <button onclick="triggerExpensePhoto('${pid}','camera')" style="flex:1;padding:7px;border:1.5px solid var(--border);border-radius:var(--rs);background:#fff;cursor:pointer;font-size:12px;font-weight:600;font-family:'Inter',sans-serif">📷 Camera</button>
          <button onclick="triggerExpensePhoto('${pid}','gallery')" style="flex:1;padding:7px;border:1.5px solid var(--border);border-radius:var(--rs);background:#fff;cursor:pointer;font-size:12px;font-weight:600;font-family:'Inter',sans-serif">🖼️ Gallery</button>
        </div>
        <input type="file" id="expense-photo-input-${pid}" accept="image/*" style="display:none" onchange="previewExpensePhoto('${pid}',this)">
        <div id="expense-photo-preview-${pid}" style="margin-top:8px"></div>
      </div>
    </div>

    <!-- Summary -->
    ${expenses.length ? `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:14px">
      ${DEFAULT_EXPENSE_CATS.map(cat=>{
        const catTotal = expenses.filter(e=>e.cat===cat.id).reduce((s,e)=>s+(e.amount||0),0);
        if(!catTotal) return '';
        return `<div style="background:var(--surface2);border-radius:var(--rs);padding:10px;text-align:center">
          <div style="font-size:16px">${cat.icon}</div>
          <div style="font-size:10px;color:var(--text3);margin:2px 0">${cat.label}</div>
          <div style="font-size:13px;font-weight:700;color:var(--navy)">${fmt(catTotal)}</div>
        </div>`;
      }).join('')}
      <div style="background:var(--navy);border-radius:var(--rs);padding:10px;text-align:center">
        <div style="font-size:16px">📊</div>
        <div style="font-size:10px;color:rgba(255,255,255,.7);margin:2px 0">Total</div>
        <div style="font-size:13px;font-weight:700;color:var(--gold)">${fmt(total)}</div>
      </div>
    </div>` : ''}

    <!-- Expense List -->
    ${sorted.length ? `
    <div class="card">
      <div class="st" style="margin-bottom:12px">All Expenses</div>
      ${sorted.map((e,i)=>{
        const cat = DEFAULT_EXPENSE_CATS.find(c=>c.id===e.cat)||{icon:'📝',label:e.cat};
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--surface2);gap:8px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:18px">${cat.icon}</span>
            <div>
              <div style="font-size:12px;font-weight:600">${cat.label}</div>
              <div style="font-size:11px;color:var(--text3)">${fmtDate(e.date)}${e.note?' · '+e.note:''}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-weight:700;color:var(--navy)">${fmt(e.amount)}</span>
            <button onclick="deleteExpense('${pid}',${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:2px 4px">✕</button>
          </div>
        </div>`;
      }).join('')}
    </div>` : '<div style="text-align:center;color:var(--text3);font-size:13px;padding:20px">No expenses logged yet.</div>'}
  </div>`;
}

async function addExpense(pid){
  const date = document.getElementById('exp_date_'+pid)?.value;
  const cat = document.getElementById('exp_cat_'+pid)?.value;
  const amount = parseFloat(document.getElementById('exp_amt_'+pid)?.value)||0;
  const note = document.getElementById('exp_note_'+pid)?.value?.trim()||'';
  if(!amount){ toast('Enter an amount','error'); return; }
  if(!D.expenseData) D.expenseData={};
  if(!D.expenseData[pid]) D.expenseData[pid]=[];
  D.expenseData[pid].push({id:uid(), date, cat, amount:Math.round(amount*100)/100, note, addedAt:new Date().toISOString()});
  try{
    await saveExpenseData();
    document.getElementById('exp_amt_'+pid).value='';
    document.getElementById('exp_note_'+pid).value='';
    const ep2 = (typeof GP==='function')?GP(pid):null;
    logActivity({category:'project',action:'expense_added',projectId:pid,projectName:ep2?ep2.name:'',description:(typeof CU!=='undefined'&&CU?CU.name:'Contractor')+' added expense'+(ep2?' — '+ep2.name:'')});
    toast('✓ Expense added','ok');
    const wrap = document.getElementById('expense-tab-wrap');
    if(wrap) wrap.innerHTML = renderExpenseTab(pid);
  }catch(e){ toast('Save failed','error'); }
}

async function deleteExpense(pid, idx){
  const p2 = (typeof GP==='function')?GP(pid):null;
  const expItem = ((D.expenseData||{})[pid]||[])[idx];
  const ok2 = await showConfirm({title:'Delete Expense?',message:(expItem?'<strong>'+fmt(expItem.amount||0)+'</strong> — '+(expItem.note||expItem.cat||'Expense')+'<br><br>':'')+'Can be restored within 7 days by admin.',confirmLabel:'Yes, Delete'});
  if(!ok2) return;
  if(expItem){ saveToBin('expense_entry',{...expItem},pid,p2?p2.name:''); logActivity({category:'project',action:'expense_deleted',projectId:pid,projectName:p2?p2.name:'',description:(typeof CU!=='undefined'&&CU?CU.name:'Contractor')+' deleted expense '+(expItem?fmt(expItem.amount):'')+(p2?' — '+p2.name:'')}); }
  if(D.expenseData&&D.expenseData[pid]) D.expenseData[pid].splice(idx,1);
  try{
    await saveExpenseData();
    toast('✓ Deleted','ok');
    const wrap = document.getElementById('expense-tab-wrap');
    if(wrap) wrap.innerHTML = renderExpenseTab(pid);
  }catch(e){ toast('Failed','error'); }
}

// ─── PHOTO HELPERS FOR LABOUR / EXPENSE / MATERIAL ───
let _labourPhotoFile = {}; // pid -> {file, dataUrl}

function triggerLabourPhoto(pid, source){
  const inp = document.getElementById('labour-photo-input-'+pid);
  if(!inp) return;
  if(source==='camera') inp.setAttribute('capture','environment');
  else inp.removeAttribute('capture');
  inp.click();
}

function previewLabourPhoto(pid, input){
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{
    _labourPhotoFile[pid] = {file, dataUrl:e.target.result};
    const prev = document.getElementById('labour-photo-preview-'+pid);
    if(prev) prev.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:6px;background:var(--surface2);border-radius:var(--rs)">'
      +'<img src="'+e.target.result+'" style="width:48px;height:48px;object-fit:cover;border-radius:4px">'
      +'<span style="font-size:11px;color:var(--text2)">'+file.name+'</span>'
      +'<button onclick="clearLabourPhoto(\''+pid+'\')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px">✕</button>'
      +'</div>';
  };
  reader.readAsDataURL(file);
}

function clearLabourPhoto(pid){
  delete _labourPhotoFile[pid];
  const prev = document.getElementById('labour-photo-preview-'+pid);
  if(prev) prev.innerHTML='';
  const inp = document.getElementById('labour-photo-input-'+pid);
  if(inp) inp.value='';
}

// ─── EXPENSE PHOTO HELPERS ────────────────────────────
let _expensePhotoFile = {}; // pid -> {file, dataUrl}

function triggerExpensePhoto(pid, source){
  const inp = document.getElementById('expense-photo-input-'+pid);
  if(!inp) return;
  if(source==='camera') inp.setAttribute('capture','environment');
  else inp.removeAttribute('capture');
  inp.click();
}

function previewExpensePhoto(pid, input){
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{
    _expensePhotoFile[pid] = {file, dataUrl:e.target.result};
    const prev = document.getElementById('expense-photo-preview-'+pid);
    if(prev) prev.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:6px;background:var(--surface2);border-radius:var(--rs)">'
      +'<img src="'+e.target.result+'" style="width:48px;height:48px;object-fit:cover;border-radius:4px">'
      +'<span style="font-size:11px;color:var(--text2)">'+file.name+'</span>'
      +'<button onclick="clearExpensePhoto(\''+pid+'\')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px">✕</button>'
      +'</div>';
  };
  reader.readAsDataURL(file);
}

function clearExpensePhoto(pid){
  delete _expensePhotoFile[pid];
  const prev = document.getElementById('expense-photo-preview-'+pid);
  if(prev) prev.innerHTML='';
  const inp = document.getElementById('expense-photo-input-'+pid);
  if(inp) inp.value='';
}

async function deleteLabourEntry(pid, date){
  const ok = await showConfirm({title:'Delete Labour Entry?',message:'Labour entry for <strong>'+fmtDate(date)+'</strong><br><br>Can be restored within 7 days by admin.',confirmLabel:'Yes, Delete'});
  if(!ok) return;
  if(!D.labourData||!D.labourData[pid]) return;
  const entry = D.labourData[pid][date];
  const p = (typeof GP==='function')?GP(pid):null;
  saveToBin('labour_entry', {date, entry}, pid, p?p.name:'');
  logActivity({category:'project',action:'labour_deleted',projectId:pid,projectName:p?p.name:'',description:(typeof CU!=='undefined'&&CU?CU.name:'Contractor')+' deleted labour entry for '+fmtDate(date)+(p?' — '+p.name:'')});
  delete D.labourData[pid][date];
  try{
    await saveLabourData();
    const wrap = document.getElementById('labour-tab-wrap');
    if(wrap) wrap.innerHTML = renderLabourTab(pid);
    toast('Labour entry moved to deleted bin','ok');
  }catch(e){ toast('Failed to delete','error'); }
}
