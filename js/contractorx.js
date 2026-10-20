// ═══════════════════════════════════════════════════════
// contractorx.js — Contractor profile extras (Super Admin only)
//
//  1. Tally closing balance (typed in) + reconciliation against what the
//     app tracks, with the gap shown rather than hidden.
//  2. Earlier-work ledger: lightweight one-line-per-project entries for
//     work from before the app (FY24-25 onward), fully editable.
//  3. Interest by financial year, typed in from Tally, shown beside the
//     app's own calculated figure.
//  4. Edit / reset on every headline figure. An edit never destroys the
//     calculated value — it stays visible beside the edit, and reset
//     brings the calculation straight back.
//
// Stored in its own settings key, never on project/contractor records,
// so nothing here can touch or corrupt tracked project data. Clears are
// stored as explicit nulls (never deleted keys) so a merge with the
// server copy can't resurrect an old value. Saves are queued one at a
// time so quick successive edits can't race. Edit controls only appear
// once the saved data has loaded, so an edit can never hide what's saved.
// ═══════════════════════════════════════════════════════

const CX_KEY = 'rsr_contractor_extras_v1';
const CX_FIRST_FY = 2024;          // earliest financial year start (FY24-25)
let _cxSaveChain = Promise.resolve();
let _cxLoadFailed = false, _cxLoading = false;

function cxIsAdmin(){ return !!(typeof CU!=='undefined' && CU && CU.isSuperAdmin); }
function cxReady(){ return cxIsAdmin() && !!D.contractorExtras; }
function cxEsc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── DATA ──────────────────────────────────────────────
async function loadContractorExtras(){
  if(D.contractorExtras) return D.contractorExtras;
  // A failed load throws (getSetting does not swallow errors) and is never
  // cached as "empty", so a bad connection can't later overwrite real data.
  let v = await getSetting(CX_KEY, {});
  if(!v || typeof v!=='object' || Array.isArray(v)) v = {};
  D.contractorExtras = v;
  return D.contractorExtras;
}
// Called from the profile render: starts the one-time load and re-renders
// when it lands. A failed load is remembered so it can't loop.
function cxEnsureLoaded(cid){
  if(!cxIsAdmin() || D.contractorExtras || _cxLoading || _cxLoadFailed) return;
  _cxLoading = true;
  loadContractorExtras()
    .then(()=>{ _cxLoading=false; _cxRefresh(cid); })
    .catch(e=>{ console.error(e); _cxLoading=false; _cxLoadFailed=true; _cxRefresh(cid); });
}
function cxGet(cid){ return (D.contractorExtras||{})[cid] || {}; }
function cxEnsure(cid){
  if(!D.contractorExtras) throw new Error('contractor extras not loaded');
  const e = D.contractorExtras[cid] = D.contractorExtras[cid] || {};
  if(!e.overrides) e.overrides = {};
  if(!e.interestFY) e.interestFY = {};
  if(!Array.isArray(e.history)) e.history = [];
  if(e.tally===undefined) e.tally = null;
  return e;
}
function saveContractorExtras(){
  const run = async ()=>{
    const merged = await mergeAndSaveSetting(CX_KEY, D.contractorExtras||{}, false);
    // adopt contractors another session added; never overwrite what's in memory
    Object.keys(merged||{}).forEach(k=>{ if(!(k in D.contractorExtras)) D.contractorExtras[k] = merged[k]; });
  };
  const p = _cxSaveChain.catch(()=>{}).then(run);
  _cxSaveChain = p;
  return p;
}
// Snapshot/restore so a failed save leaves memory exactly as it was.
function _cxSnap(cid){ return JSON.stringify(D.contractorExtras && D.contractorExtras[cid] ? D.contractorExtras[cid] : null); }
function _cxRestore(cid, snap){
  const v = JSON.parse(snap);
  if(v===null){ if(D.contractorExtras) delete D.contractorExtras[cid]; }
  else D.contractorExtras[cid] = v;
}
async function _cxCommit(cid, snap, okMsg){
  try{
    await saveContractorExtras();
    if(okMsg) toast(okMsg,'ok');
    return true;
  }catch(e){
    console.error(e);
    _cxRestore(cid, snap);
    toast('Save failed — that change was not saved','error');
    return false;
  }
}
function _cxRefresh(cid){ if(typeof renderContractorProfile==='function') renderContractorProfile(cid); }

// ─── FINANCIAL YEARS ───────────────────────────────────
function cxFYList(){
  const now = new Date();
  const cur = now.getMonth()>=3 ? now.getFullYear() : now.getFullYear()-1;
  const out = [];
  for(let y=cur; y>=CX_FIRST_FY; y--) out.push({key:y+'-'+String(y+1).slice(-2), label:'FY '+y+'-'+String(y+1).slice(-2)});
  return out;
}

// ─── OVERRIDES ─────────────────────────────────────────
// Returns the figure to display. Non-admins always get the calculation.
function cxEffective(cid, key, calc){
  if(!cxReady()) return {value:calc, edited:false, calc};
  const o = (cxGet(cid).overrides||{})[key];
  if(o && o.value!==null && o.value!==undefined && o.value!=='' && isFinite(Number(o.value))){
    return {value:Number(o.value), edited:true, calc, note:o.note||'', by:o.by||'', at:o.at||''};
  }
  return {value:calc, edited:false, calc};
}

function cxOpenStatEdit(cid, key, label, calc){
  if(!cxReady()) return;
  const eff = cxEffective(cid, key, calc);
  let modal = document.getElementById('modal-cx-stat');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-cx-stat'; document.body.appendChild(modal); }
  modal.innerHTML = `<div class="mbox" style="max-width:420px">
    <div class="mhdr"><h2>✏️ Edit — ${cxEsc(label)}</h2><button class="mx" onclick="CM('modal-cx-stat')">✕</button></div>
    <div style="background:var(--surface2);border-radius:var(--rs);padding:10px 12px;margin-bottom:12px;font-size:12px">
      Calculated from the app's records: <strong>${fmt(calc)}</strong><br>
      <span style="color:var(--text3)">Your edit replaces what's shown on this page only. The calculation is never changed — use Reset to bring it back.</span>
    </div>
    <div class="fg"><label>Your figure (₹)</label><input type="number" step="0.01" id="cxs-value" value="${eff.edited?eff.value:''}" placeholder="${calc}"></div>
    <div class="fg"><label>Note <span style="font-weight:400;color:var(--text3)">(optional — e.g. "matched to Tally 30 Sep")</span></label><input type="text" id="cxs-note" value="${cxEsc(eff.note||'')}"></div>
    <div style="display:flex;gap:8px;justify-content:space-between;margin-top:14px">
      ${eff.edited?`<button class="btn" onclick="CM('modal-cx-stat');cxResetStat('${cid}','${key}')">↺ Reset to calculated</button>`:'<span></span>'}
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="CM('modal-cx-stat')">Cancel</button>
        <button class="btn btn-navy" onclick="cxSaveStat('${cid}','${key}')">✓ Save</button>
      </div>
    </div>
  </div>`;
  modal.classList.add('open');
}

async function cxSaveStat(cid, key){
  if(!cxReady()) return;
  const raw = document.getElementById('cxs-value')?.value;
  const note = (document.getElementById('cxs-note')?.value||'').trim();
  if(raw===''||raw==null||!isFinite(Number(raw))){ toast('Enter a number, or use Reset to go back to the calculated figure','error'); return; }
  const snap = _cxSnap(cid);
  const e = cxEnsure(cid);
  e.overrides[key] = { value:Number(raw), note, by:CU.name, at:new Date().toISOString() };
  CM('modal-cx-stat');
  _cxRefresh(cid);
  const ok = await _cxCommit(cid, snap, '✓ Saved');
  if(ok) logActivity({category:'system', action:'cx_stat_edited', description:CU.name+' edited "'+key+'" on '+((GC(cid)||{}).name||'a contractor')+' to '+fmt(Number(raw))});
  else _cxRefresh(cid);
}

async function cxResetStat(cid, key){
  if(!cxReady()) return;
  const snap = _cxSnap(cid);
  const e = cxEnsure(cid);
  e.overrides[key] = { value:null, by:CU.name, at:new Date().toISOString() };
  _cxRefresh(cid);
  const ok = await _cxCommit(cid, snap, '↺ Back to calculated');
  if(ok) logActivity({category:'system', action:'cx_stat_reset', description:CU.name+' reset "'+key+'" on '+((GC(cid)||{}).name||'a contractor')+' to its calculated value'});
  else _cxRefresh(cid);
}

async function cxResetAllStats(cid){
  if(!cxReady()) return;
  const ok = await showConfirm({title:'Reset all edited figures?', message:'Every figure you have edited on this contractor\'s page goes back to the app\'s own calculation. Earlier-work entries, the Tally balance and typed interest are not touched.', confirmLabel:'Yes, reset them'});
  if(!ok) return;
  const snap = _cxSnap(cid);
  const e = cxEnsure(cid);
  Object.keys(e.overrides).forEach(k=>{ e.overrides[k] = { value:null, by:CU.name, at:new Date().toISOString() }; });
  _cxRefresh(cid);
  const done = await _cxCommit(cid, snap, '↺ All figures back to calculated');
  if(!done) _cxRefresh(cid);
}

// HTML for the edit / reset buttons that sit inside a stat box.
function cxStatControls(cid, key, label, eff){
  if(!cxReady()) return '';
  const lab = String(label).replace(/'/g,"\\'");
  return `<div style="margin-top:6px;display:flex;justify-content:center;gap:6px;align-items:center;flex-wrap:wrap">
    <button onclick="cxOpenStatEdit('${cid}','${key}','${lab}',${Number(eff.calc)||0})" title="Edit this figure" style="background:none;border:1px solid var(--border);border-radius:10px;padding:1px 8px;font-size:10px;cursor:pointer;color:var(--navy)">✏️ Edit</button>
    ${eff.edited?`<button onclick="cxResetStat('${cid}','${key}')" title="Back to the calculated figure" style="background:none;border:1px solid var(--amber);border-radius:10px;padding:1px 8px;font-size:10px;cursor:pointer;color:var(--amber)">↺ Reset</button>`:''}
  </div>`;
}

// ─── TALLY BALANCE ─────────────────────────────────────
function cxOpenTallyEdit(cid){
  if(!cxReady()) return;
  const t = cxGet(cid).tally;
  const cur = t && t.value!=null ? t.value : '';
  const asOf = t && t.asOf ? t.asOf : new Date().toISOString().split('T')[0];
  let modal = document.getElementById('modal-cx-tally');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-cx-tally'; document.body.appendChild(modal); }
  modal.innerHTML = `<div class="mbox" style="max-width:400px">
    <div class="mhdr"><h2>📒 Tally closing balance</h2><button class="mx" onclick="CM('modal-cx-tally')">✕</button></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">The closing balance on this contractor's ledger in Tally. Enter it as it shows there — an amount owed to RSR is positive.</div>
    <div class="fg"><label>Closing balance (₹)</label><input type="number" step="0.01" id="cxt-value" value="${cur}"></div>
    <div class="fg"><label>As of date</label><input type="date" id="cxt-asof" value="${asOf}"></div>
    <div style="display:flex;gap:8px;justify-content:space-between;margin-top:14px">
      ${cur!==''?`<button class="btn" onclick="CM('modal-cx-tally');cxClearTally('${cid}')">↺ Clear</button>`:'<span></span>'}
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="CM('modal-cx-tally')">Cancel</button>
        <button class="btn btn-navy" onclick="cxSaveTally('${cid}')">✓ Save</button>
      </div>
    </div>
  </div>`;
  modal.classList.add('open');
}
async function cxSaveTally(cid){
  if(!cxReady()) return;
  const raw = document.getElementById('cxt-value')?.value;
  const asOf = document.getElementById('cxt-asof')?.value || '';
  if(raw===''||raw==null||!isFinite(Number(raw))){ toast('Enter the closing balance','error'); return; }
  const snap = _cxSnap(cid);
  const e = cxEnsure(cid);
  e.tally = { value:Number(raw), asOf, by:CU.name, at:new Date().toISOString() };
  CM('modal-cx-tally'); _cxRefresh(cid);
  const ok = await _cxCommit(cid, snap, '✓ Tally balance saved');
  if(!ok) _cxRefresh(cid);
}
async function cxClearTally(cid){
  if(!cxReady()) return;
  const snap = _cxSnap(cid);
  const e = cxEnsure(cid);
  e.tally = { value:null, by:CU.name, at:new Date().toISOString() };
  _cxRefresh(cid);
  const ok = await _cxCommit(cid, snap, '↺ Cleared');
  if(!ok) _cxRefresh(cid);
}

// ─── INTEREST BY FINANCIAL YEAR ────────────────────────
async function cxSaveInterest(cid, fyKey, raw){
  if(!cxReady()) return;
  const snap = _cxSnap(cid);
  const e = cxEnsure(cid);
  const t = String(raw).trim();
  if(t===''){ e.interestFY[fyKey] = { value:null, by:CU.name, at:new Date().toISOString() }; }
  else if(!isFinite(Number(t))){ toast('Enter a number','error'); _cxRefresh(cid); return; }
  else e.interestFY[fyKey] = { value:Number(t), by:CU.name, at:new Date().toISOString() };
  _cxRefresh(cid);
  const ok = await _cxCommit(cid, snap, '✓ Interest saved');
  if(!ok) _cxRefresh(cid);
}

// ─── EARLIER-WORK LEDGER ───────────────────────────────
function cxHistoryList(cid){ return (cxGet(cid).history||[]).filter(h=>!h._archived); }

function cxOpenHistoryEdit(cid, hid){
  if(!cxReady()) return;
  const h = hid ? cxHistoryList(cid).find(x=>x.id===hid) : null;
  const fys = cxFYList();
  let modal = document.getElementById('modal-cx-hist');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-cx-hist'; document.body.appendChild(modal); }
  modal.innerHTML = `<div class="mbox" style="max-width:440px">
    <div class="mhdr"><h2>${h?'✏️ Edit':'+ Add'} earlier work</h2><button class="mx" onclick="CM('modal-cx-hist')">✕</button></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">One line per project from before it was tracked here. Keep it light — you can edit or remove it any time.</div>
    <div class="fg"><label>Project / work</label><input type="text" id="cxh-name" value="${h?cxEsc(h.name):''}" placeholder="e.g. CC road, Ward 63 — Gen code 2025-77"></div>
    <div class="fg"><label>Financial year</label>
      <select id="cxh-fy">${fys.map(f=>`<option value="${f.key}" ${h&&h.fy===f.key?'selected':''}>${f.label}</option>`).join('')}</select>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="fg"><label>Deployed / expense (₹)</label><input type="number" step="0.01" id="cxh-dep" value="${h?h.deployed:''}"></div>
      <div class="fg"><label>Received (₹)</label><input type="number" step="0.01" id="cxh-rec" value="${h?h.received:''}"></div>
      <div class="fg"><label>GST (₹) <span style="font-weight:400;color:var(--text3)">optional</span></label><input type="number" step="0.01" id="cxh-gst" value="${h&&h.gst!=null?h.gst:''}"></div>
      <div class="fg"><label>Interest (₹) <span style="font-weight:400;color:var(--text3)">optional</span></label><input type="number" step="0.01" id="cxh-int" value="${h&&h.interest!=null?h.interest:''}"></div>
    </div>
    <div class="fg"><label>Note <span style="font-weight:400;color:var(--text3)">optional</span></label><input type="text" id="cxh-note" value="${h?cxEsc(h.note||''):''}"></div>
    <div style="display:flex;gap:8px;justify-content:space-between;margin-top:14px">
      ${h?`<button class="btn" style="color:var(--red);border-color:var(--red)" onclick="CM('modal-cx-hist');cxDeleteHistory('${cid}','${h.id}')">🗑️ Delete</button>`:'<span></span>'}
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="CM('modal-cx-hist')">Cancel</button>
        <button class="btn btn-navy" onclick="cxSaveHistory('${cid}',${h?`'${h.id}'`:'null'})">✓ ${h?'Save':'Add'}</button>
      </div>
    </div>
  </div>`;
  modal.classList.add('open');
}

async function cxSaveHistory(cid, hid){
  if(!cxReady()) return;
  const num = id=>{ const v=document.getElementById(id)?.value; return (v===''||v==null)?null:Number(v); };
  const name = (document.getElementById('cxh-name')?.value||'').trim();
  const fy = document.getElementById('cxh-fy')?.value;
  const deployed = num('cxh-dep'), received = num('cxh-rec'), gst = num('cxh-gst'), interest = num('cxh-int');
  const note = (document.getElementById('cxh-note')?.value||'').trim();
  if(!name){ toast('Enter a project name','error'); return; }
  if(deployed===null && received===null){ toast('Enter at least the deployed or the received amount','error'); return; }
  if([deployed,received,gst,interest].some(v=>v!==null && !isFinite(v))){ toast('One of the amounts is not a valid number','error'); return; }

  const snap = _cxSnap(cid);
  const e = cxEnsure(cid);
  const rec = { name, fy, deployed:deployed||0, received:received||0, gst, interest, note };
  if(hid){
    const h = e.history.find(x=>x.id===hid);
    if(!h){ toast('That entry no longer exists','error'); return; }
    Object.assign(h, rec, { editedBy:CU.name, editedAt:new Date().toISOString() });
  } else {
    e.history.push({ id:'cxh_'+uid(), ...rec, addedBy:CU.name, addedAt:new Date().toISOString() });
  }
  CM('modal-cx-hist'); _cxRefresh(cid);
  const ok = await _cxCommit(cid, snap, hid?'✓ Updated':'✓ Added');
  if(ok) logActivity({category:'system', action:hid?'cx_history_edited':'cx_history_added', description:CU.name+(hid?' edited':' added')+' an earlier-work entry "'+name.substring(0,40)+'" for '+((GC(cid)||{}).name||'a contractor')});
  else _cxRefresh(cid);
}

async function cxDeleteHistory(cid, hid){
  if(!cxReady()) return;
  const h = cxHistoryList(cid).find(x=>x.id===hid); if(!h) return;
  const ok = await showConfirm({title:'Delete this entry?', message:'"'+cxEsc(h.name)+'" will be removed from this contractor\'s earlier-work list and from the reconciliation.', confirmLabel:'Yes, delete'});
  if(!ok) return;
  const snap = _cxSnap(cid);
  const e = cxEnsure(cid);
  const target = e.history.find(x=>x.id===hid);
  if(target){ target._archived = true; target._archivedAt = new Date().toISOString(); target._archivedBy = CU.name; }
  _cxRefresh(cid);
  const done = await _cxCommit(cid, snap, '✓ Deleted');
  if(!done) _cxRefresh(cid);
}

// ─── RECONCILIATION MATH (pure — easy to test) ─────────
// gap = what Tally says − (what the app tracks + earlier-work entries).
// Uses the app's calculated net, never an edited headline figure, so
// editing a headline to "match" can't make the gap vanish by itself.
function cxReconcile(tallyValue, appNet, history){
  const histNet = (history||[]).filter(h=>!h._archived).reduce((s,h)=>s+(Number(h.deployed)||0)-(Number(h.received)||0),0);
  const explained = appNet + histNet;
  const has = tallyValue!==null && tallyValue!==undefined && isFinite(Number(tallyValue));
  return { has, histNet, appNet, explained, gap: has ? Number(tallyValue) - explained : null };
}

// ─── THE BLOCK ON THE CONTRACTOR PAGE ──────────────────
// calc = { appNet (un-floored), ledger } from renderContractorProfile
function renderContractorExtrasBlock(cid, calc){
  if(!cxIsAdmin()) return '';
  if(!D.contractorExtras){
    return `<div class="card" style="margin-bottom:14px;border-top:3px solid #7c3aed"><div class="st">📒 Tally reconciliation &amp; earlier work</div><div style="font-size:12px;color:var(--text3);padding:6px 0">${_cxLoadFailed?'<span style="color:var(--red)">Could not load this — check your connection and reload the page.</span>':'Loading…'}</div></div>`;
  }
  const e = cxGet(cid);
  const tallyOk = e.tally && e.tally.value!==null && e.tally.value!==undefined;
  const hist = cxHistoryList(cid);
  const rec = cxReconcile(tallyOk ? e.tally.value : null, calc.appNet, hist);
  const fys = cxFYList();
  const ledger = calc.ledger || {};
  const fyBreak = ledger.fyBreakdown || {};
  const interestTyped = fys.reduce((s,f)=>{ const v=(e.interestFY||{})[f.key]; return s + ((v&&v.value!=null)?Number(v.value):0); },0);
  const anyEdits = Object.values(e.overrides||{}).some(o=>o && o.value!==null && o.value!==undefined);

  const row = (label, val, sub, color, bold)=>`<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:6px 0;border-bottom:1px solid var(--surface2)">
    <div><div style="font-size:12px;${bold?'font-weight:700;':''}color:var(--text)">${label}</div>${sub?`<div style="font-size:10px;color:var(--text3)">${sub}</div>`:''}</div>
    <div style="font-size:${bold?'15':'13'}px;font-weight:${bold?'800':'700'};color:${color||'var(--navy)'};white-space:nowrap">${val}</div>
  </div>`;

  // earlier work grouped by FY (newest first), with a subtotal each
  const byFY = {};
  hist.forEach(h=>{ (byFY[h.fy]=byFY[h.fy]||[]).push(h); });
  const fyKeys = Object.keys(byFY).sort().reverse();

  return `<div class="card" style="margin-bottom:14px;border-top:3px solid #7c3aed">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px">
      <div class="st" style="margin:0;border:none;padding:0">📒 Tally reconciliation &amp; earlier work <span style="font-size:10px;background:#7c3aed;color:#fff;padding:1px 8px;border-radius:8px;margin-left:6px;vertical-align:middle">SUPER ADMIN ONLY</span></div>
      ${anyEdits?`<button class="btn btn-sm" onclick="cxResetAllStats('${cid}')">↺ Reset all edited figures</button>`:''}
    </div>

    <div style="margin:10px 0 4px;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase">Tally vs the app</div>
    ${row('Tally closing balance', tallyOk?fmt(e.tally.value):'<span style="color:var(--text3)">not entered</span>', tallyOk&&e.tally.asOf?'as of '+fmtDate(e.tally.asOf):'', 'var(--navy)', true)}
    ${row('Tracked in the app', fmt(rec.appNet), 'Net deployed across this contractor\'s live projects (payments − checks received)')}
    ${row('Earlier work entered below', fmt(rec.histNet), hist.length+' entr'+(hist.length===1?'y':'ies')+' — deployed minus received')}
    ${rec.has ? row('Difference not explained', fmt(rec.gap),
        Math.abs(rec.gap)<1 ? 'Tally and the app agree' :
        (rec.gap>0 ? 'Tally shows more than the app explains — other cost centres, non-project spends, failed tenders, or older work not yet entered'
                   : 'The app explains more than Tally shows — a payment or receipt may be missing or counted twice in one of them'),
        Math.abs(rec.gap)<1?'var(--green)':'var(--amber)', true) : ''}
    <div style="margin:8px 0 12px"><button class="btn btn-sm btn-navy" onclick="cxOpenTallyEdit('${cid}')">${tallyOk?'✏️ Update Tally balance':'+ Enter Tally balance'}</button></div>

    <div style="margin:14px 0 4px;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase">Interest by financial year <span style="font-weight:400;text-transform:none">— type the figure from Tally; the app's own calculation is shown beside it</span></div>
    <div class="tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr><th style="text-align:left">Financial year</th><th style="text-align:right">From Tally (you)</th><th style="text-align:right">App calculated</th><th style="text-align:right">Difference</th></tr></thead>
      <tbody>
        ${fys.map(f=>{
          const typed = (e.interestFY||{})[f.key];
          const has = typed && typed.value!=null;
          const appv = (fyBreak['FY '+f.key]||{}).interest;
          const appNum = appv!=null ? Math.round(appv) : null;
          return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:6px 8px;font-weight:600">${f.label}</td>
            <td style="padding:6px 8px;text-align:right"><input type="number" step="0.01" value="${has?typed.value:''}" placeholder="—" onchange="cxSaveInterest('${cid}','${f.key}',this.value)" style="width:120px;text-align:right;padding:3px 6px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px"></td>
            <td style="padding:6px 8px;text-align:right;color:var(--text2)">${appNum!=null?fmt(appNum):'—'}</td>
            <td style="padding:6px 8px;text-align:right;${has&&appNum!=null&&Math.abs(typed.value-appNum)>1?'color:var(--amber);font-weight:700':'color:var(--text3)'}">${has&&appNum!=null?fmt(Number(typed.value)-appNum):'—'}</td>
          </tr>`;
        }).join('')}
        <tr style="background:var(--surface2);font-weight:700"><td style="padding:6px 8px">Total typed</td><td style="padding:6px 8px;text-align:right">${fmt(interestTyped)}</td><td colspan="2"></td></tr>
      </tbody>
    </table></div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin:16px 0 6px;flex-wrap:wrap;gap:8px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase">Earlier work (from FY24-25) <span style="font-weight:400;text-transform:none">— work from before it was tracked here</span></div>
      <button class="btn btn-sm btn-navy" onclick="cxOpenHistoryEdit('${cid}')">+ Add earlier work</button>
    </div>
    ${!hist.length ? '<div style="font-size:12px;color:var(--text3);padding:6px 0">Nothing added yet.</div>' : `
    <div class="tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:640px">
      <thead><tr><th style="text-align:left">Project / work</th><th style="text-align:right">Deployed</th><th style="text-align:right">Received</th><th style="text-align:right">Net</th><th style="text-align:right">GST</th><th style="text-align:right">Interest</th><th></th></tr></thead>
      <tbody>
        ${fyKeys.map(fy=>{
          const rows = byFY[fy];
          const sd = rows.reduce((s,h)=>s+(h.deployed||0),0), sr = rows.reduce((s,h)=>s+(h.received||0),0);
          const sg = rows.reduce((s,h)=>s+(Number(h.gst)||0),0), si = rows.reduce((s,h)=>s+(Number(h.interest)||0),0);
          return `<tr style="background:var(--surface2)"><td colspan="7" style="padding:5px 8px;font-weight:700;color:var(--navy)">FY ${fy}</td></tr>`
          + rows.map(h=>`<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="cxOpenHistoryEdit('${cid}','${h.id}')" title="Click to edit">
              <td style="padding:6px 8px">${cxEsc(h.name)}${h.note?`<div style="font-size:10px;color:var(--text3)">${cxEsc(h.note)}</div>`:''}</td>
              <td style="padding:6px 8px;text-align:right">${fmt(h.deployed)}</td>
              <td style="padding:6px 8px;text-align:right">${fmt(h.received)}</td>
              <td style="padding:6px 8px;text-align:right;font-weight:700;color:${((h.received||0)-(h.deployed||0))>=0?'var(--green)':'var(--red)'}">${fmt((h.received||0)-(h.deployed||0))}</td>
              <td style="padding:6px 8px;text-align:right">${h.gst!=null?fmt(h.gst):'—'}</td>
              <td style="padding:6px 8px;text-align:right">${h.interest!=null?fmt(h.interest):'—'}</td>
              <td style="padding:6px 8px;white-space:nowrap"><span style="color:var(--navy)">✏️</span></td>
            </tr>`).join('')
          + `<tr style="font-weight:700;border-bottom:2px solid var(--border)"><td style="padding:5px 8px;color:var(--text3)">FY ${fy} total</td><td style="padding:5px 8px;text-align:right">${fmt(sd)}</td><td style="padding:5px 8px;text-align:right">${fmt(sr)}</td><td style="padding:5px 8px;text-align:right">${fmt(sr-sd)}</td><td style="padding:5px 8px;text-align:right">${sg?fmt(sg):'—'}</td><td style="padding:5px 8px;text-align:right">${si?fmt(si):'—'}</td><td></td></tr>`;
        }).join('')}
      </tbody>
    </table></div>`}
  </div>`;
}
