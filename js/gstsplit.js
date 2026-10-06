// ═══════════════════════════════════════════════════════
// gstsplit.js — GST Filing Split (Super Admin only)
//
// Records WHO files GST for each bill (settlement) received, so the
// roughly-70/30 split between a contractor and RSR can be managed and
// carried forward quarter after quarter. Tracked from FY26-27 Q1
// (1 Apr 2026) onward.
//
// Design rules:
//  - Likith decides every assignment. Nothing is auto-assigned.
//  - Any party can file any bill: RSR, the bill's own contractor, or a
//    DIFFERENT contractor (cross-filing).
//  - Stored in its own settings key, NOT on the project records — this
//    module can never touch or corrupt project/settlement data.
//  - Each bill is identified by projectId|settlementId.
//  - Saves are queued one at a time so two quick changes can't race and
//    overwrite each other.
// ═══════════════════════════════════════════════════════

const GST_FILER_KEY = 'rsr_gst_filer_v1';
const GST_MANUAL_KEY = 'rsr_gst_manual_bills_v1';
const GST_SPLIT_START = '2026-04-01';
const GST_SPLIT_DEFAULT_TARGET = 70;

let _gsTab = 'split';
let _gsQuarter = null;
let _gsTokMap = {};
let _gsTokN = 0;
let _gsSaveChain = Promise.resolve();
let _gsWidgetLoading = false;

function gsEsc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function gsTok(key){ const t = 'gsb'+(++_gsTokN); _gsTokMap[t] = key; return t; }
function gsPct(part, whole){ return whole>0 ? (part/whole*100).toFixed(1)+'%' : '—'; }
function gsIsOwnProjects(name){ return /own\s*projects?/i.test(name||''); }

// ─── DATA LAYER ────────────────────────────────────────
async function loadGSTFilers(){
  if(D.gstFilers) return D.gstFilers;
  // A failed load must never be cached as "empty" — getSetting throws on a
  // failed request, and we let that propagate so callers can show an error.
  let v = await getSetting(GST_FILER_KEY, {});
  if(!v || typeof v!=='object' || Array.isArray(v)) v = {};
  D.gstFilers = v;
  return D.gstFilers;
}

async function loadGSTManualBills(){
  if(D.gstManualBills) return D.gstManualBills;
  let v = await getSetting(GST_MANUAL_KEY, []);
  if(!Array.isArray(v)) v = [];
  D.gstManualBills = v;
  return D.gstManualBills;
}
let _gsManualSaveChain = Promise.resolve();
function saveGSTManualBills(){
  const run = async ()=>{
    const merged = await mergeAndSaveSetting(GST_MANUAL_KEY, D.gstManualBills||[], true);
    D.gstManualBills = merged;
  };
  const p = _gsManualSaveChain.catch(()=>{}).then(run);
  _gsManualSaveChain = p;
  return p;
}

function saveGSTFilers(){
  const run = async ()=>{
    const merged = await mergeAndSaveSetting(GST_FILER_KEY, D.gstFilers||{}, false);
    // Pull in anything another session added, without ever overwriting
    // what's in memory here.
    Object.keys(merged||{}).forEach(k=>{ if(!(k in D.gstFilers)) D.gstFilers[k] = merged[k]; });
  };
  const p = _gsSaveChain.catch(()=>{}).then(run);
  _gsSaveChain = p;
  return p;
}

function gsBillKey(p, s){
  const sid = s.id || ('n'+String(s.date||'')+'_'+String(s.amount||0)+'_'+String(s.ref||'').replace(/[^A-Za-z0-9]/g,''));
  return p.id+'|'+sid;
}
function gsGetFiler(key){
  const e = (D.gstFilers||{})[key];
  return (e && e.filer) ? e.filer : '';
}
function gsFilerName(v){
  if(!v) return 'Not decided';
  if(v==='rsr') return 'RSR';
  const c = (typeof GC==='function') ? GC(v) : null;
  return c ? c.name : '(removed contractor)';
}
function gsTarget(){
  const c = (D.gstFilers||{}).cfg;
  const t = c ? parseFloat(c.targetPct) : NaN;
  return (t>0 && t<=100) ? t : GST_SPLIT_DEFAULT_TARGET;
}

// Every bill (settlement) across all live projects.
function gsCollectBills(){
  const out = [];
  (D.projects||[]).filter(p=>!isArchived(p)).forEach(p=>{
    const c = p.contractorId ? GC(p.contractorId) : null;
    (p.settlements||[]).filter(s=>!isArchived(s)).forEach(s=>{
      if(!s.date || !(s.amount>0)) return;
      out.push({
        key: gsBillKey(p, s), projectId: p.id, projectName: p.name||'—',
        contractorId: p.contractorId||'', contractorName: c ? c.name : '—',
        firm: p.firm || 'RSR Constructions',
        date: s.date, amount: s.amount||0, ref: s.ref||'',
        billType: s.billType||'', jvAmount: p.jvAmount||0,
        legacyNote: p.gstFilingNote||''
      });
    });
  });
  // Manually-added historical bills — ones never recorded as a proper
  // settlement (older bills from before this was tracked in the app).
  // Given the quarter's own start date so every existing date-range
  // filter (quarter view, running totals, ledger) picks these up exactly
  // like a real bill, with nothing else needing to change.
  (D.gstManualBills||[]).filter(m=>!m._archived).forEach(m=>{
    const [qs] = gstQuarterDateRange(m.quarterYear, m.quarterQ);
    const c = m.contractorId ? GC(m.contractorId) : null;
    out.push({
      key: 'manual_'+m.id, projectId:'', projectName: m.details || 'Manually added bill',
      contractorId: m.contractorId||'', contractorName: c ? c.name : '(no contractor)',
      firm: 'Manually added', date: qs, amount: m.amount||0, ref:'',
      billType:'Manual entry', jvAmount:0, legacyNote:'',
      manual:true, manualId: m.id
    });
  });
  return out;
}

// 'undecided' | 'rsr' | 'self' (bill's own contractor) | 'others' (a different contractor)
function gsClassify(b){
  const f = gsGetFiler(b.key);
  if(!f) return 'undecided';
  if(f==='rsr') return 'rsr';
  if(f===b.contractorId) return 'self';
  return 'others';
}
function gsStats(bills){
  const s = {total:0, count:bills.length, self:0, rsr:0, others:0, undecided:0, undecidedCount:0};
  bills.forEach(b=>{
    s.total += b.amount;
    const c = gsClassify(b);
    s[c] += b.amount;
    if(c==='undecided') s.undecidedCount++;
  });
  return s;
}

// ─── THE "FILED BY" DROPDOWN (used here and on the dashboard widget) ──
function gsFilerSelectHTML(bill){
  const cur = gsGetFiler(bill.key);
  const tok = gsTok(bill.key);
  const conts = (D.contractors||[]).filter(c=>!isArchived(c)).sort((a,b)=>a.name.localeCompare(b.name));
  const owner = bill.contractorId ? conts.find(c=>c.id===bill.contractorId) : null;
  const others = conts.filter(c=>!owner || c.id!==owner.id);
  const opt = (v, label)=>'<option value="'+gsEsc(v)+'"'+(cur===v?' selected':'')+'>'+gsEsc(label)+'</option>';
  let html = '<select onchange="setBillFiler(\''+tok+'\', this.value)" style="width:100%;font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:var(--rs);font-family:\'Inter\',sans-serif;background:'+(cur?'#eefaf1':'#fff8ec')+'">';
  html += opt('', '— Not decided —');
  html += opt('rsr', 'RSR');
  if(owner) html += '<optgroup label="Bill owner">'+opt(owner.id, owner.name)+'</optgroup>';
  if(cur && cur!=='rsr' && !conts.some(c=>c.id===cur)) html += opt(cur, gsFilerName(cur));
  html += '<optgroup label="Other contractors">'+others.map(c=>opt(c.id, c.name)).join('')+'</optgroup>';
  html += '</select>';
  return html;
}

async function setBillFiler(tok, value){
  if(!CU || !CU.isSuperAdmin){ toast('Only Super Admin can change this','error'); return; }
  const key = _gsTokMap[tok]; if(!key) return;
  try{ await loadGSTFilers(); }catch(e){ toast('Could not load filing data — reload and try again','error'); return; }
  const prev = D.gstFilers[key] ? {...D.gstFilers[key]} : undefined;
  D.gstFilers[key] = { filer: value||'', by: CU.name, at: new Date().toISOString() };
  gsRefreshDerived();
  try{
    await saveGSTFilers();
    const pid = key.split('|')[0];
    const p = GP(pid);
    logActivity({category:'project', action:'gst_filer_set', projectId:pid, projectName:p?p.name:'',
      description:(CU.name)+' set GST filer to "'+gsFilerName(value)+'" for a bill on '+(p?p.name.substring(0,50):'a project')});
    toast('✓ Saved','ok');
  }catch(e){
    console.error(e);
    if(prev) D.gstFilers[key] = prev; else delete D.gstFilers[key];
    gsRefreshDerived();
    toast('Save failed — that change was not saved','error');
  }
}

async function gsSetTarget(v){
  const n = parseFloat(v);
  if(!(n>0 && n<=100)){ toast('Enter a percentage between 1 and 100','error'); return; }
  try{ await loadGSTFilers(); }catch(e){ toast('Could not load filing data','error'); return; }
  const prev = D.gstFilers.cfg ? {...D.gstFilers.cfg} : undefined;
  D.gstFilers.cfg = { targetPct: n, by: CU?CU.name:'', at: new Date().toISOString() };
  gsRefreshDerived();
  try{ await saveGSTFilers(); toast('✓ Target updated','ok'); }
  catch(e){
    if(prev) D.gstFilers.cfg = prev; else delete D.gstFilers.cfg;
    gsRefreshDerived(); toast('Save failed','error');
  }
}

// ─── PAGE (sidebar tab 10) ─────────────────────────────
async function renderGSTSplit(){
  const el = document.getElementById('sec-gst-calc');
  if(!el) return;
  if(!CU || !CU.isSuperAdmin){
    el.innerHTML = '<div class="wrap"><div class="empty"><div class="empty-icon">🔒</div><div class="empty-text">Access restricted to Super Admin only.</div></div></div>';
    return;
  }
  el.innerHTML = '<div class="wrap"><div style="padding:40px;text-align:center;color:var(--text3)">⏳ Loading…</div></div>';
  try{ await loadGSTFilers(); await loadGSTManualBills(); }
  catch(e){
    console.error(e);
    el.innerHTML = '<div class="wrap"><div class="card" style="text-align:center;padding:30px;color:var(--red)">Could not load GST filing data. Check your connection and reload.</div></div>';
    return;
  }
  if(!_gsQuarter){ const c = getCurrentQuarter(); _gsQuarter = {year:c.year, q:c.q}; }
  _gsTab = 'split';
  _gsDrawPage();
}

function _gsDrawPage(){
  const el = document.getElementById('sec-gst-calc'); if(!el) return;
  const quarters = getRecentGSTQuarters(16).filter(x=>x.year>=2026);
  const {year, q} = _gsQuarter;
  el.innerHTML = `<div class="wrap">
    <div class="pg-hdr">
      <div>
        <div class="pg-title">🧾 GST Filing Split
          <span style="font-size:11px;background:#7c3aed;color:#fff;padding:2px 10px;border-radius:8px;font-weight:700;vertical-align:middle;margin-left:8px">SUPER ADMIN ONLY</span>
        </div>
        <div style="font-size:12px;color:var(--text3)">Decide who files GST for each bill received. Running totals carry forward from Q1 FY26-27.</div>
      </div>
      <button class="btn btn-sm" onclick="openOldGSTCalc()">🧮 Old calculators</button>
    </div>

    <div class="card" style="margin-bottom:14px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Quarter</div>
        <select onchange="_gsQuarter=JSON.parse(this.value);_gsDrawPage()" style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:13px;font-family:'Inter',sans-serif">
          ${quarters.map(qt=>`<option value='${JSON.stringify({year:qt.year,q:qt.q})}' ${qt.year===year&&qt.q===q?'selected':''}>${qt.label}</option>`).join('')}
        </select>
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Contractor target %</div>
        <input type="number" min="1" max="100" step="1" value="${gsTarget()}" onchange="gsSetTarget(this.value)" style="width:80px;padding:6px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:13px">
      </div>
      <div id="gs-qstats" style="flex:1;min-width:220px"></div>
    </div>

    <div id="gs-bills"></div>
    <div id="gs-manual"></div>
    <div id="gs-ledger"></div>
    <div id="gs-parties"></div>
  </div>`;

  const [qs, qe] = gstQuarterDateRange(year, q);
  const qBills = gsCollectBills().filter(b=>!b.manual && b.date>=GST_SPLIT_START && b.date>=qs && b.date<=qe);
  document.getElementById('gs-bills').innerHTML = _gsBillsSectionHTML(qBills);
  document.getElementById('gs-manual').innerHTML = _gsManualSectionHTML();
  gsRefreshDerived();
}

// Re-draws only the parts that depend on the assignments (stats, running
// totals, who-filed-what) — the dropdowns themselves already show the new
// value natively, so the bills table isn't rebuilt (keeps scroll position).
function gsRefreshDerived(){
  if(!_gsQuarter) return;
  const statsEl = document.getElementById('gs-qstats');
  const ledgerEl = document.getElementById('gs-ledger');
  const partiesEl = document.getElementById('gs-parties');
  if(!statsEl && !ledgerEl && !partiesEl) return;
  const {year, q} = _gsQuarter;
  const [qs, qe] = gstQuarterDateRange(year, q);
  const all = gsCollectBills().filter(b=>b.date>=GST_SPLIT_START);
  const qBills = all.filter(b=>b.date>=qs && b.date<=qe);
  const st = gsStats(qBills);
  if(statsEl){
    statsEl.innerHTML = `<div style="font-size:12px;color:var(--text2);line-height:1.6">
      <strong>${st.count}</strong> bill${st.count!==1?'s':''} this quarter · <strong>${fmt(st.total)}</strong><br>
      ${st.undecidedCount
        ? `<span style="color:var(--amber);font-weight:700">⏳ ${st.undecidedCount} not decided yet (${fmt(st.undecided)})</span>`
        : (st.count ? '<span style="color:var(--green);font-weight:700">✓ Every bill this quarter has a filer</span>' : '<span style="color:var(--text3)">No bills received yet this quarter</span>')}
    </div>`;
  }
  if(ledgerEl) ledgerEl.innerHTML = _gsLedgerHTML(all.filter(b=>b.date<=qe), qs, qe);
  if(partiesEl) partiesEl.innerHTML = _gsPartiesHTML(all.filter(b=>b.date<=qe));
}

function _gsBillsSectionHTML(qBills){
  if(!qBills.length){
    return '<div class="card" style="text-align:center;color:var(--text3);padding:24px;margin-bottom:14px">No bills received in this quarter yet. They will appear here as soon as a settlement is recorded.</div>';
  }
  const firms = GST_FIRMS.concat([...new Set(qBills.map(b=>b.firm))].filter(f=>!GST_FIRMS.includes(f)));
  return firms.map(firm=>{
    const fb = qBills.filter(b=>b.firm===firm).sort((a,b)=>a.date<b.date?-1:(a.date>b.date?1:0));
    if(!fb.length) return '';
    const tot = fb.reduce((s,b)=>s+b.amount,0);
    return `<div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface2);padding:8px 12px;border-radius:6px;font-weight:700;font-size:13px;color:var(--navy);margin-bottom:8px">
        <span>${gsEsc(firm)} — bills received</span><span>${fmt(tot)}</span>
      </div>
      <div class="tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr><th style="text-align:left">Date</th><th style="text-align:left">Project</th><th style="text-align:left">Contractor</th><th style="text-align:right">Amount</th><th style="text-align:left">Bill type</th><th style="text-align:left;min-width:200px">GST filed by</th></tr></thead>
        <tbody>
          ${fb.map(b=>`<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:6px 8px;white-space:nowrap">${fmtDate(b.date)}</td>
            <td style="padding:6px 8px"><a href="#project-${b.projectId}" onclick="openDetail('${b.projectId}');return false" style="color:var(--navy);font-weight:600">${gsEsc(b.projectName)}</a></td>
            <td style="padding:6px 8px;color:var(--text2)">${gsEsc(b.contractorName)}</td>
            <td style="padding:6px 8px;text-align:right;font-weight:700">${fmt(b.amount)}</td>
            <td style="padding:6px 8px;color:var(--text3)">${gsEsc(b.billType||'—')}</td>
            <td style="padding:6px 8px">${gsFilerSelectHTML(b)}${b.legacyNote && !gsGetFiler(b.key) ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">Earlier note: ${gsEsc(b.legacyNote)}</div>` : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;
  }).join('');
}

// ─── MANUALLY ADDED (HISTORICAL, NOT TRACKED) BILLS ────
// For bills from before this was tracked in the app — Likith enters
// them by hand so they count toward the running split, same as a real
// bill would. Shown for the currently selected quarter only, same as
// the tracked-bills table above it.
function _gsManualSectionHTML(){
  const {year, q} = _gsQuarter;
  const entries = (D.gstManualBills||[]).filter(m=>!m._archived && m.quarterYear===year && m.quarterQ===q)
    .sort((a,b)=>(b.addedAt||'').localeCompare(a.addedAt||''));
  const total = entries.reduce((s,m)=>s+(m.amount||0),0);
  return `<div class="card" style="margin-bottom:14px;border-left:4px solid #7c3aed">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
      <div>
        <div class="st" style="margin:0;border:none;padding:0">📎 Manually Added Bills <span style="font-size:11px;font-weight:400;color:var(--text3)">— not in the app's records, entered by hand so they still count in the split</span></div>
      </div>
      <button class="btn btn-sm btn-navy" onclick="openAddManualGSTBill()">+ Add Bill</button>
    </div>
    ${!entries.length ? '<div style="font-size:12px;color:var(--text3);padding:6px 0">None added for this quarter.</div>' : `
    <div class="tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr><th style="text-align:left">Contractor</th><th style="text-align:right">Amount</th><th style="text-align:left">Details</th><th style="text-align:left;min-width:200px">GST filed by</th><th></th></tr></thead>
      <tbody>
        ${entries.map(m=>{
          const bill = gsCollectBills().find(b=>b.key==='manual_'+m.id);
          return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:6px 8px">${m.contractorId ? gsEsc(gsFilerName(m.contractorId)) : '<span style="color:var(--text3)">—</span>'}</td>
            <td style="padding:6px 8px;text-align:right;font-weight:700">${fmt(m.amount)}</td>
            <td style="padding:6px 8px;color:var(--text2)">${gsEsc(m.details||'—')}</td>
            <td style="padding:6px 8px">${bill ? gsFilerSelectHTML(bill) : ''}</td>
            <td style="padding:6px 8px;white-space:nowrap">
              <button onclick="openAddManualGSTBill('${m.id}')" title="Edit" style="background:none;border:none;color:var(--navy);cursor:pointer;font-size:13px">✏️</button>
              <button onclick="deleteManualGSTBill('${m.id}')" title="Delete" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:13px">🗑️</button>
            </td>
          </tr>`;
        }).join('')}
        <tr style="background:var(--surface2);font-weight:700"><td style="padding:6px 8px">Total</td><td style="padding:6px 8px;text-align:right">${fmt(total)}</td><td colspan="3"></td></tr>
      </tbody>
    </table></div>`}
  </div>`;
}

function openAddManualGSTBill(editId){
  const editing = editId ? (D.gstManualBills||[]).find(m=>m.id===editId) : null;
  const conts = (D.contractors||[]).filter(c=>!isArchived(c)).sort((a,b)=>a.name.localeCompare(b.name));
  const {year, q} = _gsQuarter;
  const quarters = getRecentGSTQuarters(16).filter(x=>x.year>=2026);
  const curFiler = editing ? gsGetFiler('manual_'+editing.id) : '';

  let modal = document.getElementById('modal-gs-manual');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-gs-manual'; document.body.appendChild(modal); }
  modal.innerHTML = `<div class="mbox" style="max-width:460px">
    <div class="mhdr"><h2>${editing?'Edit':'+ Add'} Manual Bill</h2><button class="mx" onclick="CM('modal-gs-manual')">✕</button></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">For a bill from before this was tracked — it will count toward the running split as if it were a real bill.</div>

    <div class="fg"><label>Quarter</label>
      <select id="gsm-quarter">
        ${quarters.map(qt=>`<option value='${qt.year}|${qt.q}' ${editing ? (editing.quarterYear===qt.year&&editing.quarterQ===qt.q?'selected':'') : (year===qt.year&&q===qt.q?'selected':'')}>${qt.label}</option>`).join('')}
      </select>
    </div>
    <div class="fg"><label>Contractor <span style="font-weight:400;color:var(--text3)">(optional — leave blank if it's purely RSR's own)</span></label>
      <select id="gsm-contractor">
        <option value="">— None —</option>
        ${conts.map(c=>`<option value="${c.id}" ${editing&&editing.contractorId===c.id?'selected':''}>${gsEsc(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="fg"><label>Amount (₹)</label><input type="number" id="gsm-amount" value="${editing?editing.amount:''}" placeholder="e.g. 1600000"></div>
    <div class="fg"><label>Bill Details <span style="font-weight:400;color:var(--text3)">(gen code, tender ID, name — whatever identifies it)</span></label><input type="text" id="gsm-details" value="${editing?gsEsc(editing.details||''):''}" placeholder="e.g. Gen code 2024-05-113, drain work Ward 63"></div>
    <div class="fg"><label>Filed By</label>
      <select id="gsm-filer">
        <option value="" ${!curFiler?'selected':''}>— Not decided —</option>
        <option value="rsr" ${curFiler==='rsr'?'selected':''}>RSR</option>
        ${conts.map(c=>`<option value="${c.id}" ${curFiler===c.id?'selected':''}>${gsEsc(c.name)}</option>`).join('')}
      </select>
    </div>

    <div style="display:flex;gap:8px;justify-content:space-between;margin-top:16px">
      ${editing?`<button class="btn" style="color:var(--red);border-color:var(--red)" onclick="CM('modal-gs-manual');deleteManualGSTBill('${editing.id}')">🗑️ Delete</button>`:'<span></span>'}
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="CM('modal-gs-manual')">Cancel</button>
        <button class="btn btn-navy" onclick="saveManualGSTBillEntry(${editing?`'${editing.id}'`:'null'})">✓ ${editing?'Save':'Add'}</button>
      </div>
    </div>
  </div>`;
  modal.classList.add('open');
}

async function saveManualGSTBillEntry(editId){
  const [quarterYear, quarterQ] = document.getElementById('gsm-quarter').value.split('|').map(Number);
  const contractorId = document.getElementById('gsm-contractor').value;
  const amount = parseFloat(document.getElementById('gsm-amount').value);
  const details = document.getElementById('gsm-details').value.trim();
  const filer = document.getElementById('gsm-filer').value;
  if(!(amount>0)){ toast('Enter a valid amount','error'); return; }

  try{ await loadGSTManualBills(); await loadGSTFilers(); }
  catch(e){ toast('Could not load — reload and try again','error'); return; }

  const id = editId || uid();
  const prevEntry = editId ? (D.gstManualBills||[]).find(m=>m.id===editId) : null;
  const prevBackup = prevEntry ? {...prevEntry} : null;
  const record = { id, quarterYear, quarterQ, contractorId, amount, details, addedBy:CU?CU.name:'', addedAt: prevEntry?prevEntry.addedAt:new Date().toISOString() };

  if(!D.gstManualBills) D.gstManualBills=[];
  if(prevEntry) Object.assign(prevEntry, record);
  else D.gstManualBills.push(record);

  const filerKey = 'manual_'+id;
  const prevFiler = D.gstFilers[filerKey] ? {...D.gstFilers[filerKey]} : undefined;
  D.gstFilers[filerKey] = { filer: filer||'', by: CU?CU.name:'', at: new Date().toISOString() };

  try{
    await saveGSTManualBills();
    await saveGSTFilers();
    CM('modal-gs-manual');
    logActivity({category:'system', action: editId?'gst_manual_bill_edited':'gst_manual_bill_added',
      description:(CU?CU.name:'')+' '+(editId?'edited':'added')+' a manual GST bill for '+fmt(amount)+' (Q'+quarterQ+' FY'+quarterYear+')'});
    _gsDrawPage();
    toast('✓ Saved','ok');
  }catch(e){
    console.error(e);
    if(prevBackup) Object.assign(prevEntry, prevBackup);
    else if(!editId) D.gstManualBills = D.gstManualBills.filter(m=>m.id!==id);
    if(prevFiler) D.gstFilers[filerKey]=prevFiler; else delete D.gstFilers[filerKey];
    toast('Save failed — that change was not saved','error');
  }
}

async function deleteManualGSTBill(id){
  const m = (D.gstManualBills||[]).find(x=>x.id===id); if(!m) return;
  const ok = await showConfirm({title:'Delete this manual bill?', message:'This removes it from the split calculation — '+fmt(m.amount)+' ('+gsEsc(m.details||'no details')+'). This cannot be undone from here.', confirmLabel:'Yes, Delete'});
  if(!ok) return;
  try{ await loadGSTManualBills(); }catch(e){ toast('Could not load — reload and try again','error'); return; }
  m._archived = true; m._archivedAt = new Date().toISOString(); m._archivedBy = CU?CU.name:'';
  try{
    await saveGSTManualBills();
    logActivity({category:'system', action:'gst_manual_bill_deleted', description:(CU?CU.name:'')+' deleted a manual GST bill for '+fmt(m.amount)});
    _gsDrawPage();
    toast('✓ Deleted','ok');
  }catch(e){
    delete m._archived; delete m._archivedAt; delete m._archivedBy;
    toast('Delete failed — try again','error');
  }
}

// Running totals per contractor (owner of the bills), cumulative from
// 1 Apr 2026 up to the end of the selected quarter.
function _gsLedgerHTML(bills, qs, qe){
  if(!bills.length) return '';
  const target = gsTarget();
  const byOwner = {};
  bills.forEach(b=>{ const k = b.contractorId||'_none'; (byOwner[k] = byOwner[k]||[]).push(b); });
  const rows = Object.keys(byOwner).map(k=>{
    const arr = byOwner[k];
    const st = gsStats(arr);
    const name = k==='_none' ? '(No contractor)' : gsFilerName(k);
    const thisQ = arr.filter(b=>b.date>=qs && b.date<=qe).reduce((s,b)=>s+b.amount,0);
    const own = gsIsOwnProjects(name);
    const targetAmt = st.total*target/100;
    return {k, name, st, thisQ, own, targetAmt, gap: targetAmt - st.self};
  }).sort((a,b)=>a.name.localeCompare(b.name));

  const cell = (v, total)=>`<td style="padding:6px 8px;text-align:right"><div style="font-weight:700">${fmt(v)}</div><div style="font-size:10px;color:var(--text3)">${gsPct(v,total)}</div></td>`;
  return `<div class="card" style="margin-bottom:14px">
    <div class="st">📒 Running totals per contractor <span style="font-size:11px;font-weight:400;color:var(--text3)">— cumulative from 1 Apr 2026 to end of selected quarter</span></div>
    <div class="tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:820px">
      <thead><tr>
        <th style="text-align:left">Contractor</th><th style="text-align:right">This quarter</th><th style="text-align:right">Total bills</th>
        <th style="text-align:right">Contractor files</th><th style="text-align:right">RSR files</th><th style="text-align:right">Other contractor</th>
        <th style="text-align:right">Not decided</th><th style="text-align:right">Target ${target}%</th><th style="text-align:left">Gap to target</th>
      </tr></thead>
      <tbody>
        ${rows.map(r=>{
          let gapHtml;
          if(r.own) gapHtml = '<span style="color:var(--text3)">—</span>';
          else if(r.gap > 0.5) gapHtml = `<span style="color:var(--amber);font-weight:700">Contractor ${fmt(r.gap)} below</span>`;
          else if(r.gap < -0.5) gapHtml = `<span style="color:var(--navy);font-weight:700">Contractor ${fmt(-r.gap)} above</span>`;
          else gapHtml = '<span style="color:var(--green);font-weight:700">✓ On target</span>';
          const nameHtml = r.k==='_none' ? gsEsc(r.name) : `<a href="#" onclick="ownerTab(2);openContractorProfile('${r.k}');return false" style="color:var(--navy);font-weight:700">${gsEsc(r.name)}</a>`;
          return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:6px 8px">${nameHtml}</td>
            <td style="padding:6px 8px;text-align:right">${fmt(r.thisQ)}</td>
            <td style="padding:6px 8px;text-align:right;font-weight:700">${fmt(r.st.total)}</td>
            ${cell(r.st.self, r.st.total)}${cell(r.st.rsr, r.st.total)}${cell(r.st.others, r.st.total)}${cell(r.st.undecided, r.st.total)}
            <td style="padding:6px 8px;text-align:right">${r.own ? '—' : fmt(r.targetAmt)}</td>
            <td style="padding:6px 8px">${gapHtml}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>
    <div style="font-size:11px;color:var(--text3);margin-top:8px">"Gap to target" compares what the contractor has filed for his own bills against ${target}% of his total bills (undecided bills count in the total). It is information only — nothing is assigned automatically.</div>
  </div>`;
}

// Who has filed how much, across ALL owners (includes cross-filing).
function _gsPartiesHTML(bills){
  const parties = {};
  bills.forEach(b=>{
    const f = gsGetFiler(b.key); if(!f) return;
    const p = parties[f] = parties[f] || {id:f, count:0, value:0, own:0, forOthers:0};
    p.count++; p.value += b.amount;
    if(f!=='rsr' && f===b.contractorId) p.own += b.amount; else p.forOthers += b.amount;
  });
  const list = Object.values(parties).sort((a,b)=>b.value-a.value);
  if(!list.length) return '';
  return `<div class="card" style="margin-bottom:14px">
    <div class="st">🧾 Who files how much <span style="font-size:11px;font-weight:400;color:var(--text3)">— all bills, from 1 Apr 2026 to end of selected quarter</span></div>
    <div class="tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr><th style="text-align:left">Filer</th><th style="text-align:right">Bills</th><th style="text-align:right">Value filed</th><th style="text-align:right">Own bills</th><th style="text-align:right">Others' bills</th></tr></thead>
      <tbody>
        ${list.map(p=>`<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:6px 8px;font-weight:700;color:var(--navy)">${gsEsc(gsFilerName(p.id))}</td>
          <td style="padding:6px 8px;text-align:right">${p.count}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:700">${fmt(p.value)}</td>
          <td style="padding:6px 8px;text-align:right">${p.id==='rsr' ? '—' : fmt(p.own)}</td>
          <td style="padding:6px 8px;text-align:right">${fmt(p.id==='rsr' ? p.value : p.forOthers)}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>
  </div>`;
}

// The earlier manual calculators are kept, one click away, in case they're
// wanted again — nothing was deleted.
function openOldGSTCalc(){
  if(typeof renderGSTCalc !== 'function') return;
  _gsTab = 'old';
  renderGSTCalc();
  const wrap = document.querySelector('#sec-gst-calc .wrap');
  if(wrap) wrap.insertAdjacentHTML('afterbegin', '<button class="btn btn-sm btn-navy" style="margin-bottom:12px" onclick="renderGSTSplit()">← Back to GST Filing Split</button>');
}

// ─── CONTRACTOR PROFILE SECTION (Super Admin only) ─────
function renderContractorBillsSection(cid){
  if(!CU || !CU.isSuperAdmin) return '';
  setTimeout(()=>fillContractorBills(cid), 0);
  return '<div id="cont-bills-'+cid+'" class="card" style="margin-bottom:14px;border-left:4px solid var(--gold)"><div class="st">🧾 Bills Received &amp; GST Filing</div><div style="font-size:12px;color:var(--text3);padding:8px 0">Loading…</div></div>';
}

async function fillContractorBills(cid){
  const el = document.getElementById('cont-bills-'+cid);
  if(!el) return;
  try{ await loadGSTFilers(); }
  catch(e){
    el.innerHTML = '<div class="st">🧾 Bills Received &amp; GST Filing</div><div style="color:var(--red);font-size:12px">Could not load GST filing data — reload the page.</div>';
    return;
  }
  const c = GC(cid); if(!c) return;
  const all = gsCollectBills();
  const mine = all.filter(b=>b.contractorId===cid).sort((a,b)=>a.date<b.date?1:(a.date>b.date?-1:0));
  const tracked = all.filter(b=>b.date>=GST_SPLIT_START);
  const myTracked = tracked.filter(b=>b.contractorId===cid);
  const st = gsStats(myTracked);
  const target = gsTarget();
  const own = gsIsOwnProjects(c.name);
  const gap = st.total*target/100 - st.self;

  const filedByHim = tracked.filter(b=>gsGetFiler(b.key)===cid).sort((a,b)=>a.date<b.date?1:-1);
  const hisFiledByRSR = myTracked.filter(b=>gsGetFiler(b.key)==='rsr').sort((a,b)=>a.date<b.date?1:-1);
  const hisFiledByOthers = myTracked.filter(b=>{ const f=gsGetFiler(b.key); return f && f!=='rsr' && f!==cid; }).sort((a,b)=>a.date<b.date?1:-1);
  const totalCredited = mine.reduce((s,b)=>s+b.amount,0);

  const chip = (label, v, sub, color)=>`<div style="background:var(--surface2);border-radius:var(--rs);padding:8px 12px;min-width:120px"><div style="font-size:10px;color:var(--text3);font-weight:600">${label}</div><div style="font-size:14px;font-weight:800;color:${color||'var(--navy)'}">${v}</div>${sub?`<div style="font-size:10px;color:var(--text3)">${sub}</div>`:''}</div>`;

  const mini = (title, arr, showOther, otherLabel)=>{
    if(!arr.length) return '';
    const tot = arr.reduce((s,b)=>s+b.amount,0);
    return `<details style="margin-top:10px">
      <summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--navy)">${title} (${arr.length}) — ${fmt(tot)}</summary>
      <div class="tbl-wrap" style="margin-top:6px"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr><th style="text-align:left">Date</th><th style="text-align:left">Project</th>${showOther?`<th style="text-align:left">${otherLabel}</th>`:''}<th style="text-align:right">Amount</th></tr></thead>
        <tbody>${arr.map(b=>`<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:5px 8px;white-space:nowrap">${fmtDate(b.date)}</td>
          <td style="padding:5px 8px"><a href="#project-${b.projectId}" onclick="openDetail('${b.projectId}');return false" style="color:var(--navy);font-weight:600">${gsEsc(b.projectName)}</a></td>
          ${showOther?`<td style="padding:5px 8px;color:var(--text2)">${gsEsc(otherLabel==='Bill owner' ? b.contractorName : gsFilerName(gsGetFiler(b.key)))}</td>`:''}
          <td style="padding:5px 8px;text-align:right;font-weight:700">${fmt(b.amount)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </details>`;
  };

  el.innerHTML = `<div class="st">🧾 Bills Received &amp; GST Filing</div>

    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin:8px 0 6px">GST filing — from 1 Apr 2026</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px">
      ${chip('Total bills', fmt(st.total), st.count+' bill'+(st.count!==1?'s':''))}
      ${chip('He files (own)', fmt(st.self), gsPct(st.self,st.total), 'var(--green)')}
      ${chip('RSR files', fmt(st.rsr), gsPct(st.rsr,st.total))}
      ${chip('Other contractor files', fmt(st.others), gsPct(st.others,st.total))}
      ${chip('Not decided', fmt(st.undecided), st.undecidedCount?st.undecidedCount+' bill'+(st.undecidedCount!==1?'s':''):'', st.undecided?'var(--amber)':'var(--navy)')}
      ${chip('He files for others', fmt(filedByHim.filter(b=>b.contractorId!==cid).reduce((s,b)=>s+b.amount,0)), 'bills of other contractors')}
    </div>
    <div style="font-size:12px;margin:6px 0 4px;color:var(--text2)">${own ? 'Own-projects contractor — target does not apply.' : (Math.abs(gap)<=0.5 ? '<span style="color:var(--green);font-weight:700">✓ On the '+target+'% target.</span>' : (gap>0 ? 'Target '+target+'%: <strong style="color:var(--amber)">contractor is '+fmt(gap)+' below</strong> what he would file at target.' : 'Target '+target+'%: <strong>contractor is '+fmt(-gap)+' above</strong> target.'))}</div>

    ${mini('GST filed by '+gsEsc(c.name)+' (any contractor\'s bill)', filedByHim, true, 'Bill owner')}
    ${mini(gsEsc(c.name)+'\'s bills filed by RSR', hisFiledByRSR, false, '')}
    ${mini(gsEsc(c.name)+'\'s bills filed by other contractors', hisFiledByOthers, true, 'Filed by')}

    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin:16px 0 6px">All bills received (${mine.length}) — ${fmt(totalCredited)}</div>
    ${!mine.length ? '<div style="font-size:13px;color:var(--text3);padding:8px 0">No bills received yet.</div>' : `
    <div class="tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:640px">
      <thead><tr><th style="text-align:left">Date</th><th style="text-align:left">Project</th><th style="text-align:right">JV amount</th><th style="text-align:right">Credited</th><th style="text-align:right">% of JV</th><th style="text-align:left">Bill type</th><th style="text-align:left">GST filed by</th></tr></thead>
      <tbody>
        ${mine.map(b=>`<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:6px 8px;white-space:nowrap">${fmtDate(b.date)}</td>
          <td style="padding:6px 8px"><a href="#project-${b.projectId}" onclick="openDetail('${b.projectId}');return false" style="color:var(--navy);font-weight:600">${gsEsc(b.projectName)}</a></td>
          <td style="padding:6px 8px;text-align:right">${b.jvAmount ? fmt(b.jvAmount) : '—'}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:700">${fmt(b.amount)}</td>
          <td style="padding:6px 8px;text-align:right">${b.jvAmount>0 ? (b.amount/b.jvAmount*100).toFixed(1)+'%' : '—'}</td>
          <td style="padding:6px 8px;color:var(--text3)">${gsEsc(b.billType||'—')}</td>
          <td style="padding:6px 8px">${b.date>=GST_SPLIT_START ? gsEsc(gsFilerName(gsGetFiler(b.key))) : '<span style="color:var(--text3)">not tracked</span>'}</td>
        </tr>`).join('')}
        <tr style="background:var(--navy);color:#fff;font-weight:700"><td colspan="3" style="padding:7px 8px">Total credited</td><td style="padding:7px 8px;text-align:right">${fmt(totalCredited)}</td><td colspan="3"></td></tr>
      </tbody>
    </table></div>`}
    <div style="font-size:11px;color:var(--text3);margin-top:8px">GST filing is tracked from bills received on or after 1 Apr 2026. Change who files a bill on the <a href="#" onclick="ownerTab(10);return false" style="color:var(--navy);font-weight:600">GST Split</a> page.</div>`;
}
