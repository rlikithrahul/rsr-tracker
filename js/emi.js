// ═══════════════════════════════════════════════════════
// emi.js — RSR Constructions Tracker
// EMI Calendar — Track EMIs, credit cards, due dates
// ═══════════════════════════════════════════════════════

const EMI_KEY = 'rsr_emi_data_v1';

// ─── LOAD/SAVE EMI DATA ───────────────────────────────
async function loadEMIData(){
  try{
    const rows = await sbReq('settings','GET');
    const row = (rows||[]).find(x=>x.key===EMI_KEY);
    D.emiData = row ? JSON.parse(row.value||'{}') : {emis:[], cards:[], billAmounts:{}};
    if(!D.emiData.emis) D.emiData.emis = [];
    if(!D.emiData.cards) D.emiData.cards = [];
    if(!D.emiData.billAmounts) D.emiData.billAmounts = {};
  }catch(e){ D.emiData = {emis:[], cards:[], billAmounts:{}}; }
}

async function saveEMIData(){
  await sbReq('settings','POST',{key:EMI_KEY, value:JSON.stringify(D.emiData)});
}

// ─── RENDER EMI TAB ───────────────────────────────────
async function renderEMI(){
  const el = document.getElementById('sec-emi');
  if(!el) return;
  if(!D.emiData) await loadEMIData();

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  el.innerHTML = `<div class="wrap">
    <div class="pg-hdr"><div class="pg-title">💳 EMI Calendar</div></div>

    <!-- UPCOMING PAYMENTS (next 7 days) -->
    <div id="emi-upcoming"></div>

    <!-- EMI LIST -->
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div class="st" style="margin:0;border:none;padding:0">📅 EMIs & Loan Payments</div>
        <button class="btn btn-sm btn-navy" onclick="openAddEMI()">+ Add EMI</button>
      </div>
      <div id="emi-list-wrap">${renderEMIList()}</div>
    </div>

    <!-- CREDIT CARDS -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div class="st" style="margin:0;border:none;padding:0">💳 Credit Cards</div>
        <button class="btn btn-sm btn-navy" onclick="openAddCard()">+ Add Card</button>
      </div>
      <div id="emi-cards-wrap">${renderCardListNew()}</div>
    </div>
  </div>`;

  renderUpcomingPayments();
  checkBillPromptsNew();
}

// ─── RENDER EMI LIST ──────────────────────────────────
function renderEMIList(){
  const emis = D.emiData.emis||[];
  if(!emis.length) return '<div style="font-size:13px;color:var(--text3);text-align:center;padding:16px">No EMIs added yet.</div>';

  return `<div class="tbl-wrap"><table>
    <thead><tr>
      <th>Name / Description</th><th>Type</th>
      <th style="text-align:right">Amount (₹)</th>
      <th style="text-align:center">Due Date</th>
      <th style="text-align:center">Status</th>
      <th></th>
    </tr></thead>
    <tbody>
      ${emis.map(e=>`<tr>
        <td style="font-weight:600;font-size:13px">${e.name}</td>
        <td style="font-size:12px;color:var(--text2)">${e.type||'EMI'}</td>
        <td style="text-align:right;font-weight:700;color:var(--navy)">${fmt(e.amount)}</td>
        <td style="text-align:center;font-size:12px">${e.dueDay}th every month</td>
        <td style="text-align:center">${e.active!==false?'<span style="color:var(--green);font-size:11px;font-weight:700">● Active</span>':'<span style="color:var(--text3);font-size:11px">Closed</span>'}</td>
        <td style="white-space:nowrap">
          <div class="amenu-wrap">
            <button class="amenu-btn" onclick="event.stopPropagation();toggleMenu('em-${e.id}')">⋮</button>
            <div class="amenu" id="em-${e.id}">
              <button class="amenu-item" onclick="editEMI('${e.id}')">✏️ Edit</button>
              <button class="amenu-item" onclick="toggleEMIActive('${e.id}')">${e.active!==false?'⏸ Mark Closed':'▶ Mark Active'}</button>
              <button class="amenu-item danger" onclick="deleteEMI('${e.id}')">🗑️ Delete</button>
            </div>
          </div>
        </td>
      </tr>`).join('')}
    </tbody>
    <tfoot><tr style="background:var(--surface2);font-weight:700">
      <td colspan="2" style="padding:8px">Total Monthly EMIs</td>
      <td style="text-align:right;padding:8px;color:var(--navy)">${fmt(emis.filter(e=>e.active!==false).reduce((s,e)=>s+e.amount,0))}</td>
      <td colspan="3"></td>
    </tr></tfoot>
  </table></div>`;
}

// ─── RENDER CARD LIST ─────────────────────────────────
function renderCardList(){
  const cards = D.emiData.cards||[];
  if(!cards.length) return '<div style="font-size:13px;color:var(--text3);text-align:center;padding:16px">No credit cards added yet.</div>';

  return cards.map(card=>{
    const thisMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    const billAmt = D.emiData.billAmounts[`${card.id}_${thisMonthKey}`];
    return `<div style="padding:12px;border:1px solid var(--border);border-radius:var(--rs);margin-bottom:8px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-weight:700;font-size:14px">${card.name}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">
          Bill generates: ${card.billDay}th · Due: ${card.dueDay}th
        </div>
        <div style="font-size:12px;margin-top:4px">
          ${billAmt!==undefined
            ? `This month's bill: <strong style="color:var(--navy)">₹${billAmt.toLocaleString('en-IN')}</strong>`
            : `<span style="color:var(--amber)">Bill amount not entered for this month</span>`}
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-sm" onclick="enterBillAmount('${card.id}','${card.name}')">💰 Enter Bill</button>
        <div class="amenu-wrap">
          <button class="amenu-btn" onclick="event.stopPropagation();toggleMenu('cd-${card.id}')">⋮</button>
          <div class="amenu" id="cd-${card.id}">
            <button class="amenu-item" onclick="editCard('${card.id}')">✏️ Edit</button>
            <button class="amenu-item danger" onclick="deleteCard('${card.id}')">🗑️ Delete</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ─── UPCOMING PAYMENTS ────────────────────────────────
function renderUpcomingPayments(){
  const el = document.getElementById('emi-upcoming');
  if(!el || !D.emiData) return;

  const today = new Date();
  const todayDay = today.getDate();
  const upcoming = [];

  // Check EMIs
  (D.emiData.emis||[]).filter(e=>e.active!==false).forEach(e=>{
    const daysUntil = e.dueDay >= todayDay ? e.dueDay - todayDay : (e.dueDay + 30 - todayDay);
    if(daysUntil <= 5){
      upcoming.push({
        type: 'emi', name: e.name, amount: e.amount,
        daysUntil, dueDay: e.dueDay,
        urgent: daysUntil <= 2
      });
    }
  });

  // Check credit card due dates
  (D.emiData.cards||[]).forEach(card=>{
    const daysUntil = card.dueDay >= todayDay ? card.dueDay - todayDay : (card.dueDay + 30 - todayDay);
    if(daysUntil <= 5){
      const thisMonthKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
      const billAmt = D.emiData.billAmounts[`${card.id}_${thisMonthKey}`] || 0;
      upcoming.push({
        type: 'card', name: card.name, amount: billAmt,
        daysUntil, dueDay: card.dueDay,
        urgent: daysUntil <= 2
      });
    }
  });

  if(!upcoming.length){ el.innerHTML=''; return; }

  upcoming.sort((a,b)=>a.daysUntil-b.daysUntil);

  el.innerHTML = `<div class="card" style="border-top:3px solid ${upcoming.some(u=>u.urgent)?'var(--red)':'var(--amber)'};margin-bottom:14px">
    <div class="st" style="margin-bottom:10px">⏰ Upcoming Payments</div>
    ${upcoming.map(u=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;
        background:${u.urgent?'#fef2f2':'#fffbeb'};border-radius:var(--rs);margin-bottom:6px;flex-wrap:wrap;gap:6px">
        <div>
          <div style="font-weight:700;font-size:13px">${u.type==='card'?'💳':'📅'} ${u.name}</div>
          <div style="font-size:11px;color:var(--text2)">Due on ${u.dueDay}th · ${u.daysUntil===0?'Today!':u.daysUntil===1?'Tomorrow':u.daysUntil+' days'}</div>
        </div>
        <div style="font-weight:800;font-size:14px;color:${u.urgent?'var(--red)':'#92400e'}">${u.amount?fmt(u.amount):'Amount pending'}</div>
      </div>`).join('')}
  </div>`;
}

// ─── DASHBOARD UPCOMING ───────────────────────────────
function getEMIDashboardAlerts(){
  if(!D.emiData) return '';
  const today = new Date();
  const todayDay = today.getDate();
  const upcoming = [];

  (D.emiData.emis||[]).filter(e=>e.active!==false).forEach(e=>{
    const daysUntil = e.dueDay >= todayDay ? e.dueDay - todayDay : e.dueDay + 30 - todayDay;
    if(daysUntil <= 3) upcoming.push({name:e.name, amount:e.amount, daysUntil, urgent:daysUntil<=1});
  });

  (D.emiData.cards||[]).forEach(card=>{
    const daysUntil = card.dueDay >= todayDay ? card.dueDay - todayDay : card.dueDay + 30 - todayDay;
    if(daysUntil <= 3){
      const key = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
      const amt = D.emiData.billAmounts[`${card.id}_${key}`]||0;
      upcoming.push({name:card.name+' (CC)', amount:amt, daysUntil, urgent:daysUntil<=1});
    }
  });

  if(!upcoming.length) return '';
  upcoming.sort((a,b)=>a.daysUntil-b.daysUntil);

  return `<div class="card" style="border-top:3px solid ${upcoming.some(u=>u.urgent)?'var(--red)':'var(--amber)'};padding:12px;margin-bottom:14px">
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">💳 Upcoming Payments</div>
    ${upcoming.slice(0,3).map(u=>`
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--surface2)">
        <div style="font-size:12px;font-weight:600">${u.name}</div>
        <div style="font-size:12px;color:${u.urgent?'var(--red)':'#92400e'}">
          ${u.amount?fmt(u.amount):'—'} · ${u.daysUntil===0?'Today':u.daysUntil===1?'Tomorrow':u.daysUntil+'d'}
        </div>
      </div>`).join('')}
    <button onclick="ownerTab(6)" style="margin-top:8px;background:none;border:none;font-size:11px;color:var(--navy);font-weight:600;cursor:pointer;font-family:'Inter',sans-serif">View EMI Calendar →</button>
  </div>`;
}

// ─── CHECK BILL PROMPTS ───────────────────────────────
function checkBillPrompts(){
  if(!D.emiData) return;
  const today = new Date();
  const todayDay = today.getDate();
  const thisMonthKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;

  (D.emiData.cards||[]).forEach(card=>{
    // Prompt day after bill generation
    const promptDay = card.billDay + 1;
    if(todayDay === promptDay){
      const key = `${card.id}_${thisMonthKey}`;
      if(D.emiData.billAmounts[key] === undefined){
        // Show prompt after short delay
        setTimeout(()=>enterBillAmount(card.id, card.name, true), 500);
      }
    }
  });
}

// ─── ADD/EDIT EMI ─────────────────────────────────────
function openAddEMI(id){
  const e = id ? (D.emiData.emis||[]).find(x=>x.id===id) : null;
  let modal = document.getElementById('modal-add-emi');
  if(!modal){
    modal = document.createElement('div');
    modal.className='mov'; modal.id='modal-add-emi';
    document.body.appendChild(modal);
  }
  modal.innerHTML=`<div class="mbox" style="max-width:420px">
    <div class="mhdr"><h2>${e?'✏️ Edit':'+ Add'} EMI / Loan Payment</h2><button class="mx" onclick="CM('modal-add-emi')">✕</button></div>
    <div class="fg"><label>Name / Description *</label><input type="text" id="emi-name" placeholder="e.g. HDFC Home Loan, Car EMI" value="${e?e.name:''}"></div>
    <div class="frow">
      <div class="fg"><label>Type</label>
        <select id="emi-type">
          ${['Home Loan','Car Loan','Personal Loan','Flat EMI','Land EMI','Apartment EMI','Other'].map(t=>`<option ${e&&e.type===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="fg"><label>Monthly Amount (₹) *</label><input type="number" id="emi-amount" placeholder="Amount" value="${e?e.amount:''}"></div>
    </div>
    <div class="fg"><label>Due Date (day of month) *</label><input type="number" id="emi-due" placeholder="e.g. 5 for 5th of every month" min="1" max="31" value="${e?e.dueDay:''}"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn" onclick="CM('modal-add-emi')">Cancel</button>
      <button class="btn btn-navy" onclick="saveEMI('${id||''}')">✓ Save</button>
    </div>
  </div>`;
  modal.classList.add('open');
}

function editEMI(id){ openAddEMI(id); }

async function saveEMI(id){
  const name = document.getElementById('emi-name').value.trim();
  const amount = parseFloat(document.getElementById('emi-amount').value)||0;
  const dueDay = parseInt(document.getElementById('emi-due').value)||0;
  const type = document.getElementById('emi-type').value;
  if(!name||!amount||!dueDay){ toast('Fill all required fields','error'); return; }
  if(!D.emiData.emis) D.emiData.emis=[];
  if(id){
    const e = D.emiData.emis.find(x=>x.id===id);
    if(e){ e.name=name; e.amount=amount; e.dueDay=dueDay; e.type=type; }
  } else {
    D.emiData.emis.push({id:uid(), name, amount, dueDay, type, active:true, createdAt:new Date().toISOString()});
  }
  try{
    await saveEMIData();
    CM('modal-add-emi');
    renderEMI();
    toast(`✓ EMI ${id?'updated':'added'}`,'ok');
  }catch(e){ toast('Save failed','error'); }
}

async function deleteEMI(id){
  if(!confirm('Delete this EMI?')) return;
  D.emiData.emis = (D.emiData.emis||[]).filter(e=>e.id!==id);
  try{ await saveEMIData(); renderEMI(); toast('✓ EMI deleted','ok'); }
  catch(e){ toast('Delete failed','error'); }
}

async function toggleEMIActive(id){
  const e = (D.emiData.emis||[]).find(x=>x.id===id);
  if(!e) return;
  e.active = e.active===false ? true : false;
  try{ await saveEMIData(); renderEMI(); toast(`✓ EMI ${e.active?'activated':'closed'}`,'ok'); }
  catch(e){ toast('Save failed','error'); }
}

// ─── ADD/EDIT CREDIT CARD ─────────────────────────────
function openAddCard(id){
  const card = id ? (D.emiData.cards||[]).find(x=>x.id===id) : null;
  let modal = document.getElementById('modal-add-card');
  if(!modal){
    modal = document.createElement('div');
    modal.className='mov'; modal.id='modal-add-card';
    document.body.appendChild(modal);
  }
  modal.innerHTML=`<div class="mbox" style="max-width:420px">
    <div class="mhdr"><h2>${card?'✏️ Edit':'+ Add'} Credit Card</h2><button class="mx" onclick="CM('modal-add-card')">✕</button></div>
    <div class="fg"><label>Card Name *</label><input type="text" id="card-name" placeholder="e.g. HDFC Millennia, SBI SimplyCLICK" value="${card?card.name:''}"></div>
    <div class="frow">
      <div class="fg"><label>Bill Generation Date *</label><input type="number" id="card-bill-day" placeholder="Day of month (1-31)" min="1" max="31" value="${card?card.billDay:''}"></div>
      <div class="fg"><label>Payment Due Date *</label><input type="number" id="card-due-day" placeholder="Day of month (1-31)" min="1" max="31" value="${card?card.dueDay:''}"></div>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:12px">Bill amount is entered each month after bill generation. You'll be prompted automatically.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn" onclick="CM('modal-add-card')">Cancel</button>
      <button class="btn btn-navy" onclick="saveCard('${id||''}')">✓ Save</button>
    </div>
  </div>`;
  modal.classList.add('open');
}

function editCard(id){ openAddCard(id); }

async function saveCard(id){
  const name = document.getElementById('card-name').value.trim();
  const billDay = parseInt(document.getElementById('card-bill-day').value)||0;
  const dueDay = parseInt(document.getElementById('card-due-day').value)||0;
  if(!name||!billDay||!dueDay){ toast('Fill all fields','error'); return; }
  if(!D.emiData.cards) D.emiData.cards=[];
  if(id){
    const c = D.emiData.cards.find(x=>x.id===id);
    if(c){ c.name=name; c.billDay=billDay; c.dueDay=dueDay; }
  } else {
    D.emiData.cards.push({id:uid(), name, billDay, dueDay, createdAt:new Date().toISOString()});
  }
  try{
    await saveEMIData();
    CM('modal-add-card');
    renderEMI();
    toast(`✓ Card ${id?'updated':'added'}`,'ok');
  }catch(e){ toast('Save failed','error'); }
}

async function deleteCard(id){
  if(!confirm('Delete this card?')) return;
  D.emiData.cards = (D.emiData.cards||[]).filter(c=>c.id!==id);
  try{ await saveEMIData(); renderEMI(); toast('✓ Card deleted','ok'); }
  catch(e){ toast('Delete failed','error'); }
}

// ─── ENTER BILL AMOUNT ────────────────────────────────
function enterBillAmount(cardId, cardName, isAutoPrompt){
  const today = new Date();
  const monthKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthLabel = months[today.getMonth()]+' '+today.getFullYear();
  const existing = D.emiData.billAmounts[`${cardId}_${monthKey}`];

  let modal = document.getElementById('modal-bill-amount');
  if(!modal){
    modal = document.createElement('div');
    modal.className='mov'; modal.id='modal-bill-amount';
    document.body.appendChild(modal);
  }
  modal.innerHTML=`<div class="mbox" style="max-width:380px">
    <div class="mhdr"><h2>💳 ${cardName} — ${monthLabel}</h2><button class="mx" onclick="CM('modal-bill-amount')">✕</button></div>
    ${isAutoPrompt?'<div style="font-size:13px;color:var(--amber);margin-bottom:12px;font-weight:600">📨 Bill generated — please enter the bill amount for this month.</div>':''}
    <div class="fg"><label>Bill Amount (₹) for ${monthLabel}</label><input type="number" id="bill-amount-input" placeholder="Enter bill amount" value="${existing||''}"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn" onclick="CM('modal-bill-amount')">Later</button>
      <button class="btn btn-navy" onclick="saveBillAmount('${cardId}','${monthKey}')">✓ Save Amount</button>
    </div>
  </div>`;
  modal.classList.add('open');
  setTimeout(()=>document.getElementById('bill-amount-input')?.focus(),200);
}

async function saveBillAmount(cardId, monthKey){
  const amt = parseFloat(document.getElementById('bill-amount-input').value)||0;
  D.emiData.billAmounts[`${cardId}_${monthKey}`] = amt;
  try{
    await saveEMIData();
    CM('modal-bill-amount');
    renderEMI();
    toast('✓ Bill amount saved','ok');
  }catch(e){ toast('Save failed','error'); }
}

// ─── CREDIT CARD CYCLE HELPERS ───────────────────────
function getCardCycleKey(card, refDate){
  const d = refDate || new Date();
  const today = d.getDate();
  const year = d.getFullYear();
  const month = d.getMonth();
  let cycleYear, cycleMonth;
  if(today >= card.billDay){ cycleYear = year; cycleMonth = month; }
  else { const prev = new Date(year, month-1, 1); cycleYear = prev.getFullYear(); cycleMonth = prev.getMonth(); }
  return cycleYear+'-'+String(cycleMonth+1).padStart(2,'0')+'-'+String(card.billDay).padStart(2,'0');
}

function getCardPhase(card){
  const today = new Date();
  const todayDay = today.getDate();
  const cycleKey = getCardCycleKey(card);
  const billEntered = D.emiData.billAmounts[card.id+'_'+cycleKey] !== undefined;
  const billDay = card.billDay;
  const dueDay = card.dueDay;
  let inWaiting;
  if(dueDay < billDay){ inWaiting = todayDay > dueDay && todayDay < billDay; }
  else { inWaiting = todayDay > dueDay || todayDay < billDay; }
  if(inWaiting) return 'waiting';
  if(todayDay >= billDay && !billEntered) return 'enter-bill';
  if(billEntered){
    const daysUntilDue = dueDay >= todayDay ? dueDay - todayDay : dueDay + 30 - todayDay;
    if(daysUntilDue <= 3) return 'reminder';
    return 'silent';
  }
  const daysUntilDue = dueDay >= todayDay ? dueDay - todayDay : dueDay + 30 - todayDay;
  if(daysUntilDue <= 3) return 'reminder';
  return 'waiting';
}

// ─── DASHBOARD UPCOMING ───────────────────────────────
function getEMIDashboardAlerts(){
  if(!D.emiData) return '';
  const today = new Date();
  const todayDay = today.getDate();
  const items = [];
  (D.emiData.emis||[]).filter(e=>e.active!==false).forEach(e=>{
    const daysUntil = e.dueDay >= todayDay ? e.dueDay - todayDay : e.dueDay + 30 - todayDay;
    if(daysUntil <= 3) items.push({icon:'📅', name:e.name, amount:e.amount, daysUntil, urgent:daysUntil<=1, type:'emi'});
  });
  (D.emiData.cards||[]).forEach(card=>{
    const phase = getCardPhase(card);
    const cycleKey = getCardCycleKey(card);
    const amt = D.emiData.billAmounts[card.id+'_'+cycleKey];
    if(phase==='enter-bill'){
      items.push({icon:'📨', name:card.name+' (CC)', amount:null, daysUntil:999, urgent:false, type:'bill-prompt', cardId:card.id, cardName:card.name});
    } else if(phase==='reminder'){
      const daysUntil = card.dueDay >= todayDay ? card.dueDay - todayDay : card.dueDay + 30 - todayDay;
      items.push({icon:'💳', name:card.name+' (CC)', amount:amt||0, daysUntil, urgent:daysUntil<=1, type:'card'});
    }
  });
  if(!items.length) return '';
  items.sort((a,b)=>{ if(a.type==='bill-prompt'&&b.type!=='bill-prompt') return 1; if(b.type==='bill-prompt'&&a.type!=='bill-prompt') return -1; return a.daysUntil-b.daysUntil; });
  const borderColor = items.some(u=>u.urgent)?'var(--red)':'var(--amber)';
  const rows = items.slice(0,5).map(u=>{
    const isPrompt = u.type==='bill-prompt';
    const color = u.urgent?'var(--red)':isPrompt?'var(--amber)':'#92400e';
    const valHtml = isPrompt
      ? '<button onclick="enterBillAmount(\''+u.cardId+'\',\''+u.cardName+'\')" style="background:var(--amber);color:#fff;border:none;border-radius:var(--rs);padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif">Enter Amount</button>'
      : (u.amount?fmt(u.amount):'—')+' · '+(u.daysUntil===0?'Today':u.daysUntil===1?'Tomorrow':u.daysUntil+'d');
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--surface2)">'
      +'<div style="font-size:12px;font-weight:600">'+u.icon+' '+u.name+'</div>'
      +'<div style="font-size:12px;color:'+color+'">'+valHtml+'</div>'
      +'</div>';
  }).join('');
  return '<div class="card" style="border-top:3px solid '+borderColor+';padding:12px;margin-bottom:14px">'
    +'<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">💳 Payments & Bills</div>'
    +rows
    +'<button onclick="ownerTab(5)" style="margin-top:8px;background:none;border:none;font-size:11px;color:var(--navy);font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif">View EMI Calendar →</button>'
    +'</div>';
}

// ─── CREDIT CARD PHASE-AWARE RENDER ──────────────────
function renderCardListNew(){
  const cards = D.emiData.cards||[];
  if(!cards.length) return '<div style="font-size:13px;color:var(--text3);text-align:center;padding:16px">No credit cards added yet.</div>';
  return cards.map(card=>{
    const cycleKey = getCardCycleKey(card);
    const billAmt = D.emiData.billAmounts[card.id+'_'+cycleKey];
    const phase = getCardPhase(card);
    const today = new Date(); const todayDay = today.getDate();
    let statusHtml;
    if(phase==='waiting'){
      const d = card.billDay >= todayDay ? card.billDay - todayDay : card.billDay + 30 - todayDay;
      statusHtml = '<span style="color:var(--text3);font-size:12px">⏳ Bill generates in '+d+' day'+(d===1?'':'s')+' ('+card.billDay+'th)</span>';
    } else if(phase==='enter-bill'){
      statusHtml = '<span style="color:var(--amber);font-size:12px;font-weight:600">📨 Bill generated — enter amount</span>';
    } else if(phase==='silent'){
      statusHtml = '<span style="color:var(--green);font-size:12px">✅ Bill entered: <strong>₹'+(billAmt||0).toLocaleString('en-IN')+'</strong> · Due '+card.dueDay+'th</span>';
    } else if(phase==='reminder'){
      const d = card.dueDay >= todayDay ? card.dueDay - todayDay : card.dueDay + 30 - todayDay;
      statusHtml = '<span style="color:var(--red);font-size:12px;font-weight:700">🔴 ₹'+(billAmt||0).toLocaleString('en-IN')+' due in '+d+' day'+(d===1?'':'s')+' ('+card.dueDay+'th)</span>';
    }
    return '<div style="padding:12px;border:1px solid var(--border);border-radius:var(--rs);margin-bottom:8px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">'
      +'<div>'
      +'<div style="font-weight:700;font-size:14px">'+card.name+'</div>'
      +'<div style="font-size:12px;color:var(--text2);margin-top:2px">Bill generates: '+card.billDay+'th · Due: '+card.dueDay+'th</div>'
      +'<div style="margin-top:6px">'+statusHtml+'</div>'
      +'</div>'
      +'<div style="display:flex;gap:6px;align-items:center">'
      +'<button class="btn btn-sm" onclick="enterBillAmount(\''+card.id+'\',\''+card.name+'\')" title="Enter or update bill amount">💰 Enter Bill</button>'
      +'<div class="amenu-wrap">'
      +'<button class="amenu-btn" onclick="event.stopPropagation();toggleMenu(\'cd-'+card.id+'\')">⋮</button>'
      +'<div class="amenu" id="cd-'+card.id+'">'
      +'<button class="amenu-item" onclick="editCard(\''+card.id+'\')">✏️ Edit</button>'
      +'<button class="amenu-item danger" onclick="deleteCard(\''+card.id+'\')">🗑️ Delete</button>'
      +'</div></div></div></div>';
  }).join('');
}

// ─── ENTER BILL AMOUNT (PHASE-AWARE) ─────────────────
function enterBillAmountNew(cardId, cardName, isAutoPrompt){
  const card = (D.emiData.cards||[]).find(c=>c.id===cardId);
  const d = new Date();
  const cycleKey = card ? getCardCycleKey(card) : (d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const parts = cycleKey.split('-');
  const cycleLabel = months[parseInt(parts[1])-1]+' '+parts[0]+' cycle';
  const existing = D.emiData.billAmounts[cardId+'_'+cycleKey];
  let modal = document.getElementById('modal-bill-amount');
  if(!modal){ modal = document.createElement('div'); modal.className='mov'; modal.id='modal-bill-amount'; document.body.appendChild(modal); }
  modal.innerHTML = '<div class="mbox" style="max-width:380px">'
    +'<div class="mhdr"><h2>💳 '+cardName+'</h2><button class="mx" onclick="CM(\'modal-bill-amount\')">✕</button></div>'
    +(isAutoPrompt?'<div style="font-size:13px;color:var(--amber);margin-bottom:12px;font-weight:600">📨 Bill generated — please enter the bill amount.</div>':'')
    +'<div class="fg"><label>Bill Amount (₹) — '+cycleLabel+'</label><input type="number" id="bill-amount-input" placeholder="Enter bill amount" value="'+(existing||'')+'"></div>'
    +'<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">'
    +'<button class="btn" onclick="CM(\'modal-bill-amount\')">Later</button>'
    +'<button class="btn btn-navy" onclick="saveBillAmountNew(\''+cardId+'\',\''+cycleKey+'\')">✓ Save Amount</button>'
    +'</div></div>';
  modal.classList.add('open');
  setTimeout(()=>document.getElementById('bill-amount-input')?.focus(),200);
}

async function saveBillAmountNew(cardId, cycleKey){
  const amt = parseFloat(document.getElementById('bill-amount-input').value)||0;
  D.emiData.billAmounts[cardId+'_'+cycleKey] = amt;
  try{
    await saveEMIData();
    CM('modal-bill-amount');
    renderEMI();
    const banner = document.getElementById('dash-banner');
    if(banner) banner.innerHTML = renderDashAlertStrip();
    const emiEl = document.getElementById('dash-emi-section');
    if(emiEl) emiEl.innerHTML = getEMIDashboardAlerts();
    toast('✓ Bill amount saved','ok');
  }catch(e){ toast('Save failed','error'); }
}

// ─── CHECK BILL PROMPTS (PHASE-AWARE) ────────────────
function checkBillPromptsNew(){
  if(!D.emiData) return;
  const todayDay = new Date().getDate();
  (D.emiData.cards||[]).forEach(card=>{
    if(todayDay===card.billDay || todayDay===card.billDay+1){
      const cycleKey = getCardCycleKey(card);
      if(D.emiData.billAmounts[card.id+'_'+cycleKey]===undefined){
        setTimeout(()=>enterBillAmountNew(card.id, card.name, true), 500);
      }
    }
  });
}
