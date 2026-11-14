// ═══════════════════════════════════════════════════════
// tenderstatements.js — the statements a tender asks for, as Word files (Tender Documents → Statements)
//
// Statements are known by what they ARE (not “Statement 4”) because every department numbers them differently.
// The number is typed only when downloading (optional) and goes into the file name, so the downloads folder
// shows at a glance which statements of a tender are done. Optionally it can also be printed as the heading.
//
//   • Value of civil works executed per year  → from a saved turnover list per firm (edit / add years any time)
//   • Existing commitments (Part A + Part B)  → NIL by default; or tick projects from the app to fill what is known
//   • Litigation history · Criminal record    → NIL statements
//   • Key personnel                           → people saved once (all firms share them); designation / experience /
//                                               “working since” can be changed for each tender; their certificates
//                                               (from the Tender Documents library) download separately, stamped if wanted
//   Similar works and physical quantities stay in Work Experience (Find by Value / Find by Quantity).
// Every statement: Word only, plain A4 or the firm’s digital letterhead, optional stamp & sign (Super Admin only).
// ═══════════════════════════════════════════════════════

const TS_TURN_KEY = 'rsr_turnover_v1';
const TS_PEOPLE_KEY = 'rsr_key_people_v1';
// from the CA turnover certificate dated 05/10/2026 (N. Chandra Mouli Prasad, Chartered Accountant)
const TS_TURN_SEED = {'RSR Constructions': {_note:'Turnover certificate of the Chartered Accountant dated 05/10/2026', '2015-16':3265050,'2016-17':8894479,'2017-18':6831165,'2018-19':8730635,'2019-20':3782819,'2020-21':491332,'2021-22':2168270,'2022-23':736750,'2023-24':0,'2024-25':11991350}};

let _tsFirm = 'RSR Constructions';
let _tsYears = 5;
let _tsCommA = [], _tsCommB = [];       // project ids ticked for Part A / Part B
let _tsPpl = {};                        // per-download values for each person {sel, designation, experience, since}
let _tsTurn = null;
let _tsSaveChain = Promise.resolve();

function _tsE(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _tsIN(n){ return Number(n||0).toLocaleString('en-IN'); }
function _tsFyOk(k){ return /^\d{4}-\d{2}$/.test(k); }

// ─── data ──────────────────────────────────────────────
async function tsLoad(){
  if(!_tsTurn){
    let v = null; try{ v = await getSetting(TS_TURN_KEY, null); }catch(e){ throw e; }
    _tsTurn = (v && typeof v==='object') ? v : JSON.parse(JSON.stringify(TS_TURN_SEED));
  }
  if(!D.keyPeople){
    let v = await getSetting(TS_PEOPLE_KEY, []);
    D.keyPeople = Array.isArray(v) ? v : [];
  }
  await loadTenderDocs();
}
function tsPeople(){ return (D.keyPeople||[]).filter(p=>!p._archived); }
function tsSavePeople(){
  const run = async ()=>{
    const merged = await mergeAndSaveSetting(TS_PEOPLE_KEY, D.keyPeople||[], true);
    (merged||[]).forEach(m=>{ if(!D.keyPeople.some(x=>x.id===m.id)) D.keyPeople.push(m); });
  };
  const p = _tsSaveChain.catch(()=>{}).then(run); _tsSaveChain = p; return p;
}
// the years we have a figure for (a recorded 0 counts), newest N, shown oldest → newest
function tsTurnYears(firm, n){
  const t = _tsTurn && _tsTurn[firm] || {};
  const have = Object.keys(t).filter(k=>_tsFyOk(k) && t[k]!=null && t[k]!=='' && isFinite(Number(t[k]))).sort().reverse().slice(0, n);
  return have.reverse().map(fy=>({fy, v:Number(t[fy])}));
}

// ─── the page ──────────────────────────────────────────
async function tsDraw(){
  const el = document.getElementById('sec-tenderdocs'); if(!el) return;
  el.innerHTML = '<div class="wrap"><div style="padding:40px;text-align:center;color:var(--text3)">⏳ Loading…</div></div>';
  try{ await tsLoad(); }
  catch(e){ console.error(e); el.innerHTML = '<div class="wrap">'+tdTabsHTML()+'<div class="card" style="text-align:center;padding:30px;color:var(--red)">Could not load the statements data. Check your connection and reload.</div></div>'; return; }
  const yrs = tsTurnYears(_tsFirm, _tsYears), want = _tsYears;
  const ppl = tsPeople();
  ppl.forEach(p=>{ if(!_tsPpl[p.id]) _tsPpl[p.id] = {sel:false, designation:p.designation||'', experience:p.experience||'', since:p.since||''}; });
  const projName = id=>{ const p = (D.projects||[]).find(x=>x.id===id); return p ? p.name : '(project removed)'; };
  const sec = (title, sub, inner)=>`<div class="card" style="margin-bottom:14px"><div style="font-size:15px;font-weight:800;color:var(--navy)">${title}</div><div style="font-size:12px;color:var(--text3);margin:2px 0 10px">${sub}</div>${inner}</div>`;
  const chips = (arr, which)=> arr.length ? arr.map(id=>`<span style="display:inline-block;background:#eef2fb;border-radius:10px;padding:2px 9px;margin:2px 4px 2px 0;font-size:12px">${_tsE(projName(id))}</span>`).join('') : '<span style="color:var(--text3);font-size:12px">NIL</span>';
  el.innerHTML = `<div class="wrap">${tdTabsHTML()}
    <div class="pg-hdr"><div><div class="pg-title">📝 Tender Statements</div>
      <div style="font-size:12px;color:var(--text3)">Fill once, download as Word in a second. Similar works and quantities are in Work Experience.</div></div></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">${TD_FIRMS.map(f=>`<div onclick="tsFirm('${_tsE(f)}')" style="cursor:pointer;padding:10px 16px;border-radius:var(--r);border:2px solid ${f===_tsFirm?'var(--navy)':'var(--border)'};background:${f===_tsFirm?'var(--navy)':'#fff'};color:${f===_tsFirm?'#fff':'var(--navy)'};font-weight:800;font-size:13px">${_tsE(f)}</div>`).join('')}</div>

    ${sec('💰 Value of civil works executed in each year','The turnover figures saved for '+_tsE(_tsFirm)+'. “Last N years” uses the latest N years that have a figure.',`
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
        <label style="font-size:12px;font-weight:700">Last <select onchange="_tsYears=Number(this.value);tsDraw()" style="padding:5px 8px;border:1px solid var(--border);border-radius:var(--rs)">${[3,5,10].map(n=>`<option value="${n}" ${n===_tsYears?'selected':''}>${n}</option>`).join('')}</select> years</label>
        <button class="btn btn-sm" onclick="tsTurnEdit()">✏️ Edit turnover figures</button>
        <button class="btn btn-sm btn-navy" onclick="tsDlTurnover()" ${yrs.length?'':'disabled'}>⬇ Download Word</button>
      </div>
      ${yrs.length ? `<div style="font-size:12px;overflow:auto"><table style="border-collapse:collapse"><tr>${yrs.map(y=>`<td style="border:1px solid var(--border);padding:4px 10px;text-align:center"><div style="color:var(--text3);font-size:11px">${y.fy}</div><div style="font-weight:700">${_tsIN(y.v)}</div></td>`).join('')}</tr></table></div>
        ${yrs.length<want?`<div style="font-size:11px;color:#92400e;margin-top:6px">Only ${yrs.length} year${yrs.length!==1?'s':''} saved — the statement will show those. Add the latest year with “Edit turnover figures”.</div>`:''}
        ${(_tsTurn[_tsFirm]&&_tsTurn[_tsFirm]._note)?`<div style="font-size:11px;color:var(--text3);margin-top:4px">${_tsE(_tsTurn[_tsFirm]._note)}</div>`:''}`
      : '<div style="color:var(--text3);font-size:12px">No figures saved for this firm yet — press “Edit turnover figures”.</div>'}`)}

    ${sec('📋 Details of existing commitments','NIL unless you tick projects. Part A = works on hand; Part B = tenders submitted. The app fills what it knows; the rest you complete in Word.',`
      <div style="font-size:12px;font-weight:700;margin-bottom:2px">A) Existing commitments on ongoing works</div>
      <div style="margin-bottom:6px">${chips(_tsCommA)} <button class="btn btn-sm" onclick="tsPickComm('A')">🔍 Choose projects</button> ${_tsCommA.length?'<button class="btn btn-sm" onclick="_tsCommA=[];tsDraw()">Clear</button>':''}</div>
      <div style="font-size:12px;font-weight:700;margin-bottom:2px">B) Works for which tenders are submitted</div>
      <div style="margin-bottom:10px">${chips(_tsCommB)} <button class="btn btn-sm" onclick="tsPickComm('B')">🔍 Choose projects</button> ${_tsCommB.length?'<button class="btn btn-sm" onclick="_tsCommB=[];tsDraw()">Clear</button>':''}</div>
      <button class="btn btn-sm btn-navy" onclick="tsDlCommit()">⬇ Download Word${(_tsCommA.length||_tsCommB.length)?'':' (NIL)'}</button>`)}

    ${sec('⚖️ Litigation history & 🚔 Criminal record','Both come as NIL statements.',`
      <button class="btn btn-sm btn-navy" onclick="tsDlNil('lit')">⬇ Litigation history (NIL)</button>
      <button class="btn btn-sm btn-navy" onclick="tsDlNil('crim')">⬇ Criminal record (NIL)</button>`)}

    ${sec('👷 Key personnel','The same people serve all three firms. Tick who goes in this tender; designation, experience and “working since” can be changed for this download only.',`
      ${ppl.length ? `<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#f3f5f9;text-align:left"><th style="padding:6px"></th><th style="padding:6px">Name</th><th style="padding:6px">Designation</th><th style="padding:6px">Qualification</th><th style="padding:6px">Total experience</th><th style="padding:6px">Working since</th><th style="padding:6px">Certificates</th><th></th></tr>
        ${ppl.map(p=>{ const s = _tsPpl[p.id]; const nc = (p.certIds||[]).filter(i=>tdDoc(i)).length; const inp=(k,w)=>`<input value="${_tsE(s[k])}" oninput="_tsPpl['${p.id}'].${k}=this.value" style="width:${w}px;padding:4px 6px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px">`;
          return `<tr style="border-top:1px solid var(--border)"><td style="padding:6px"><input type="checkbox" ${s.sel?'checked':''} onchange="_tsPpl['${p.id}'].sel=this.checked"></td><td style="padding:6px;font-weight:700">${_tsE(p.name)}</td><td style="padding:6px">${inp('designation',130)}</td><td style="padding:6px">${_tsE(p.qualification||'')}</td><td style="padding:6px">${inp('experience',90)}</td><td style="padding:6px">${inp('since',90)}</td><td style="padding:6px">${nc?'📕 '+nc:'<span style="color:var(--text3)">—</span>'}</td><td style="padding:6px;white-space:nowrap"><button class="btn btn-sm" onclick="tsPersonEdit('${p.id}')">✏️</button> <button class="btn btn-sm" title="Hide this person (kept, not deleted)" onclick="tsPersonHide('${p.id}')">🙈</button></td></tr>`; }).join('')}</table></div>` : '<div style="color:var(--text3);font-size:12px;margin-bottom:6px">No one added yet.</div>'}
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px">
        <button class="btn btn-sm" onclick="tsPersonEdit('')">+ Add a person</button>
        <button class="btn btn-sm btn-navy" onclick="tsDlPeople()" ${ppl.length?'':'disabled'}>⬇ Statement (Word)</button>
        <span style="flex:1"></span>
        ${typeof csToggleHTML==='function'?csToggleHTML():''}
        <button class="btn btn-sm btn-navy" onclick="tsDlCerts()" ${ppl.length?'':'disabled'}>📎 Certificates of the ticked people (one PDF)</button>
      </div>`)}

    ${sec('🛠 Key critical equipment','Coming next — you add items once, tick the ones to include, and download with stamp and sign.','')}
  </div>`;
}
// tabs on the Tender Documents page
let _tdTab = 'lib';
function tdTabsHTML(){
  const t=(k,l)=>`<span onclick="tdSetTab('${k}')" style="cursor:pointer;padding:8px 16px;border-radius:var(--rs) var(--rs) 0 0;font-weight:800;font-size:13px;border:1px solid var(--border);border-bottom:${_tdTab===k?'2px solid var(--navy)':'1px solid var(--border)'};background:${_tdTab===k?'#fff':'#f3f5f9'};color:var(--navy)">${l}</span>`;
  return `<div style="display:flex;gap:4px;margin-bottom:14px">${t('lib','📁 Library')}${t('stmt','📝 Statements')}${t('desk','🖊 Stamp & Letterhead')}</div>`;
}
function tdSetTab(k){ _tdTab = k; renderTenderDocs(); }
function tsFirm(f){ _tsFirm = f; tsDraw(); }

// ─── dialog + Word builder (shared) ────────────────────
async function tsAsk(firm, title){
  const key = lhKeyFor(firm), lhName = (LH_SETS[key] && LH_SETS[key].name) || firm;
  let stHtml = '';
  if(stAllowed()){ try{ await stAvailable(); }catch(e){} stHtml = stPickerHTML('tsd', key, '', {variant:'none', address:false}); }
  let cap = {num:'', print:false, st:{variant:'none', address:false}};
  const pr = tlModal('Download — '+_tsE(title),
    `<div class="fg" style="margin:0 0 10px"><label>Statement number for this tender <span style="font-weight:400;color:var(--text3)">(optional)</span></label>
       <input id="tsd-num" placeholder="e.g. 4 or IV" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs)">
       <div style="font-size:11px;color:var(--text3);margin:4px 0">Goes into the file name (“Statement 4 - …”) so you can see which statements of the tender you have downloaded. Asked every time.</div>
       <label style="display:flex;gap:6px;align-items:center;font-size:12px;text-transform:none;letter-spacing:0;font-weight:600"><input type="checkbox" id="tsd-print"> Also print “STATEMENT – …” as the heading</label></div>
     <div>Put it on the <strong>${_tsE(lhName)}</strong> letterhead, or a plain A4 page?</div>
     <div style="font-size:12px;color:var(--text3);margin-top:6px">It downloads as a Word file either way — you can still edit it.</div>${stHtml}`,
    [{label:'Cancel', value:null}, {label:'Plain A4 page', value:'plain'}, {label:'On the letterhead', value:'digital', primary:true}]);
  const d = document.getElementById('tl-modal');
  if(d) d.addEventListener('click', e=>{ if(e.target.closest && e.target.closest('button[data-i]')){
    cap = {num:(document.getElementById('tsd-num')||{}).value||'', print:!!(document.getElementById('tsd-print')||{}).checked, st:stChoice('tsd')}; } }, true);
  const mode = await pr; if(!mode) return null;
  return {mode, num:String(cap.num).trim(), print:cap.print, st:cap.st};
}
function _tsSign(stampXml){
  return (stampXml||'') + (stampXml?'<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>':'')
    + wxsP('Signature of the Tenderer',{b:true,jc:'right',before:stampXml?40:480,after:0});
}
// makeBody(avail, stampXml, stampXml2, head) → body XML.  stampXml2 = a second copy (for statements signed twice).
async function tsBuild(firm, title, makeBody){
  const ask = await tsAsk(firm, title); if(!ask) return false;
  const key = lhKeyFor(firm), margins = lhMargins(key, ask.mode), avail = 11906 - margins.left - margins.right;
  let blk = null;
  try{ blk = stDocxBlock(await stResolve(key, ask.st), avail); }
  catch(e){ console.error(e); toast('Stamp could not be added — nothing was downloaded. '+e.message,'error',7000); return false; }
  const sx = blk ? blk.xml : '';
  const sx2 = blk ? blk.xml.replace(/id="(20\d)"/g,(m,n)=>'id="'+(Number(n)+10)+'"') : '';
  const head = (ask.print && ask.num) ? wxsP('STATEMENT – '+ask.num.toUpperCase(),{b:true,u:true,jc:'center',after:200}) : '';
  const docx = buildDOCX(makeBody(avail, sx, sx2, head), margins);
  if(blk) docx.stamps = blk.media;
  if(ask.mode==='digital'){
    try{ docx.letterhead = await lhDocxPackage(key); }
    catch(e){ console.error(e); toast('Letterhead could not be loaded — nothing was downloaded. '+e.message,'error',7000); return false; }
  }
  const base = (ask.num?'Statement '+ask.num+' - ':'')+title+' - '+firm;
  triggerDownload(docx, tdSafeName(base)+'.docx');
  toast('✓ Downloaded — '+base+'.docx','ok');
  try{ logActivity({category:'system', action:'tender_statement_downloaded', description:(CU?CU.name:'')+' downloaded the tender statement “'+title+'” ('+firm+')'+(ask.num?' as Statement '+ask.num:'')}); }catch(e){}
  return true;
}
const _tsNum = n=>({t:String(n)});
function _tsNumRow(k){ return Array.from({length:k},(_,i)=>({t:String(i+1)})); }

// ─── 1 · value of civil works ──────────────────────────
async function tsDlTurnover(){
  const yrs = tsTurnYears(_tsFirm, _tsYears); if(!yrs.length){ toast('No turnover figures saved for this firm','error'); return; }
  const word = {3:'three',5:'five',10:'ten'}[_tsYears] || String(_tsYears);
  await tsBuild(_tsFirm, 'Value of civil works executed', (avail, sx, sx2, head)=>{
    const w = wxsScale([900,3200,4400], avail);
    const hd = ['Sl. No.','Financial Year','Value in Rs.'].map(t=>({t, b:true, sz:22}));
    const rows = yrs.map((y,i)=>[{t:String(i+1),sz:22},{t:y.fy,sz:22},{t:_tsIN(y.v),sz:22,b:true}]);
    return head + wxsP('Details of value of Civil Engineering works executed in each year during the last '+word+' financial years by the Tenderer.',{b:true,after:200,sz:24})
      + wxsTable(w, [hd, ...rows], 1)
      + wxsP('a) Attach certificate(s) issued by the Executive Engineer concerned and counter signed by Superintending Engineer showing work wise / year wise value of work done in respect of all the works executed by the Tenderer during last '+word+' years',{before:200,after:60})
      + wxsP('OR',{b:true,jc:'center',after:60})
      + wxsP('b) Certificate from Chartered Accountant supported with Annual Balance Sheet tallying with I.T. Clearance certificate.',{after:200})
      + _tsSign(sx);
  });
}
function tsTurnEdit(){
  const t = (_tsTurn && _tsTurn[_tsFirm]) || {};
  const fys = Object.keys(t).filter(_tsFyOk).sort().reverse();
  const next = (()=>{ const m = fys[0]; if(!m) return ''; const y = Number(m.slice(0,4))+1; return y+'-'+String(y+1).slice(-2); })();
  let m = document.getElementById('ts-modal');
  if(!m){ m = document.createElement('div'); m.className='mov'; m.id='ts-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="mbox" style="max-width:520px"><div class="mhdr"><h2>✏️ Turnover — ${_tsE(_tsFirm)}</h2><button class="mx" onclick="CM('ts-modal')">✕</button></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px">One figure per financial year (rupees). Leave a year empty to leave it out. A recorded 0 is kept.</div>
    <div style="display:flex;gap:8px;margin-bottom:10px"><input id="ts-newfy" placeholder="Add a year, e.g. ${_tsE(next||'2025-26')}" style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:var(--rs)"><button class="btn btn-sm" onclick="tsTurnAddYear()">+ Add year</button></div>
    <div id="ts-trows" style="max-height:50vh;overflow:auto">${fys.map(fy=>_tsTurnRow(fy,t[fy])).join('')}</div>
    <div class="fg" style="margin-top:10px"><label>Source / note (shown on this page only)</label><input id="ts-note" value="${_tsE(t._note||'')}" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:var(--rs)"></div>
    <div id="ts-err" style="color:var(--red);font-size:12px;margin:6px 0;display:none"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" onclick="CM('ts-modal')">Cancel</button><button class="btn btn-navy" id="ts-save" onclick="tsTurnSave()">Save</button></div></div>`;
  OM('ts-modal');
}
function _tsTurnRow(fy, v){ return `<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px" data-fy="${fy}"><span style="width:90px;font-weight:700;font-size:13px">${fy}</span><input class="ts-tv" value="${v===''||v==null?'':_tsE(_tsIN(v))}" inputmode="numeric" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:var(--rs);text-align:right"></div>`; }
function tsTurnAddYear(){
  const inp = document.getElementById('ts-newfy'), v = (inp.value||'').trim();
  const m = /^(\d{4})\s*[-–]\s*(\d{2}|\d{4})$/.exec(v);
  if(!m || (Number(m[2].slice(-2)) !== (Number(m[1])+1)%100)){ const e = document.getElementById('ts-err'); e.textContent = 'Write the year like 2025-26.'; e.style.display = 'block'; return; }
  const fy = m[1]+'-'+String(Number(m[1])+1).slice(-2);
  if(document.querySelector('#ts-trows [data-fy="'+fy+'"]')){ document.getElementById('ts-err').textContent = fy+' is already in the list.'; document.getElementById('ts-err').style.display = 'block'; return; }
  document.getElementById('ts-err').style.display = 'none';
  const wrap = document.getElementById('ts-trows'); wrap.insertAdjacentHTML('afterbegin', _tsTurnRow(fy,''));
  wrap.querySelector('[data-fy="'+fy+'"] input').focus(); inp.value = '';
}
async function tsTurnSave(){
  const err = document.getElementById('ts-err'); err.style.display = 'none';
  const next = {}; let bad = '';
  document.querySelectorAll('#ts-trows [data-fy]').forEach(r=>{
    const raw = r.querySelector('input').value.replace(/[,\s₹]/g,''); if(raw==='') return;
    if(!/^\d+(\.\d+)?$/.test(raw)){ bad = r.dataset.fy; return; }
    next[r.dataset.fy] = Number(raw);
  });
  if(bad){ err.textContent = 'The figure for '+bad+' is not a valid number.'; err.style.display = 'block'; return; }
  const note = document.getElementById('ts-note').value.trim(); if(note) next._note = note;
  const all = Object.assign({}, _tsTurn); all[_tsFirm] = next;
  const btn = document.getElementById('ts-save'); btn.disabled = true;
  try{ await saveSetting(TS_TURN_KEY, all); _tsTurn = all; CM('ts-modal'); toast('✓ Turnover saved','ok'); tsDraw(); }
  catch(e){ console.error(e); err.textContent = 'NOT saved — '+(e.message||'unknown error')+'. Nothing was changed.'; err.style.display = 'block'; }
  finally{ btn.disabled = false; }
}

// ─── 2 · existing commitments ──────────────────────────
function tsPickComm(part){
  const cur = new Set(part==='A' ? _tsCommA : _tsCommB);
  const all = (D.projects||[]).filter(p=>!p._archived);
  let m = document.getElementById('ts-modal');
  if(!m){ m = document.createElement('div'); m.className='mov'; m.id='ts-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="mbox" style="max-width:640px"><div class="mhdr"><h2>🔍 Part ${part} — choose projects</h2><button class="mx" onclick="CM('ts-modal')">✕</button></div>
    <input id="ts-pq" placeholder="Search project name, gen code or tender no…" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);margin-bottom:8px">
    <div id="ts-pl" style="max-height:46vh;overflow:auto;border:1px solid var(--border);border-radius:var(--rs)"></div>
    <div id="ts-pn" style="font-size:12px;color:var(--text3);margin:6px 0"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" onclick="CM('ts-modal')">Cancel</button><button class="btn btn-navy" id="ts-pok">Use selected</button></div></div>`;
  OM('ts-modal');
  const draw = ()=>{
    const q = (document.getElementById('ts-pq').value||'').toLowerCase();
    const rows = all.filter(p=>!q || (p.name+' '+(p.tender||'')+' '+(typeof getGenCode==='function'?getGenCode(p):'')).toLowerCase().includes(q)).sort((a,b)=>(cur.has(b.id)?1:0)-(cur.has(a.id)?1:0)||String(a.name).localeCompare(b.name)).slice(0,200);
    document.getElementById('ts-pl').innerHTML = rows.map(p=>`<label style="display:flex;gap:8px;padding:6px 10px;border-bottom:1px solid var(--border);cursor:pointer;font-size:12px;align-items:flex-start;text-transform:none;letter-spacing:0;font-weight:500"><input type="checkbox" data-i="${p.id}" ${cur.has(p.id)?'checked':''} style="margin-top:2px"><span><strong>${_tsE(p.name)}</strong><br><span style="color:var(--text3)">${_tsE(p.firm||'')}${p.tender?' · Tender '+_tsE(p.tender):''}${p.status&&p.status!=='active'?' · '+_tsE(p.status):''}</span></span></label>`).join('') || '<div style="padding:14px;color:var(--text3);font-size:12px">No project matches.</div>';
    document.getElementById('ts-pn').textContent = cur.size+' selected';
    document.querySelectorAll('#ts-pl input[data-i]').forEach(c=>c.onchange=()=>{ c.checked?cur.add(c.dataset.i):cur.delete(c.dataset.i); document.getElementById('ts-pn').textContent = cur.size+' selected'; });
  };
  document.getElementById('ts-pq').oninput = draw; draw();
  document.getElementById('ts-pok').onclick = ()=>{ if(part==='A') _tsCommA = [...cur]; else _tsCommB = [...cur]; CM('ts-modal'); tsDraw(); };
}
function _tsProjValue(p){ return (typeof agAmt_calc==='function') ? agAmt_calc(p) : Math.round((p.estimated||0)*(1+(p.bidPct||0)/100)); }
function _tsDMY(d){ if(!d) return ''; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d)); return m ? m[3]+'-'+m[2]+'-'+m[1] : String(d); }
async function tsDlCommit(){
  const pa = _tsCommA.map(id=>(D.projects||[]).find(p=>p.id===id)).filter(Boolean);
  const pb = _tsCommB.map(id=>(D.projects||[]).find(p=>p.id===id)).filter(Boolean);
  await tsBuild(_tsFirm, 'Details of existing commitments', (avail, sx, sx2, head)=>{
    const wa = wxsScale([420,1500,950,820,860,800,860,880,820,860], avail), wb = wxsScale([450,2200,1500,1200,1100,1100,1100], avail);
    const ha = ['Sl. No','Name of work','Address of Agt. concluding authority','Agt No & date','Value of contract','Stipulated period of completion','Value of work done so far','Balance value of works to be completed','Anticipated date of completion','Updated value of balance work'].map(t=>({t,b:true,sz:16}));
    const hb = ['Sl. No.','Name of work','Address of Agt. Concluding authority','Estimated value of work','Stipulated period of completion','Date on which tender was submitted','Present stage of Tender.'].map(t=>({t,b:true,sz:16}));
    const nilA = [{t:'NIL',span:10,b:true,sz:20}], nilB = [{t:'NIL',span:7,b:true,sz:20}];
    const ra = pa.length ? pa.map((p,i)=>[{t:String(i+1),sz:16},{t:p.name||'',jc:'left',sz:16},{t:'',sz:16},{t:_tsDMY(p.agreeDate),sz:16},{t:_tsProjValue(p)?_tsIN(_tsProjValue(p)):'',sz:16},{t:'',sz:16},{t:'',sz:16},{t:'',sz:16},{t:'',sz:16},{t:'',sz:16}]) : [nilA];
    const rb = pb.length ? pb.map((p,i)=>[{t:String(i+1),sz:16},{t:p.name||'',jc:'left',sz:16},{t:'',sz:16},{t:(Number(p.estimated)>0?_tsIN(Math.round(p.estimated)):''),sz:16},{t:'',sz:16},{t:'',sz:16},{t:'',sz:16}]) : [nilB];
    const num = (k)=>_tsNumRow(k).map(c=>Object.assign(c,{sz:16}));
    return head + wxsP('Details of Existing Commitments.',{b:true,u:true,jc:'center',after:120,sz:24})
      + wxsP('Details of works on hand and, yet to be completed as on the date of submission of the Tender and works for which Tenders have been submitted are to be furnished.',{after:120})
      + wxsP('A) Existing Commitments on ongoing works:',{b:true,after:80})
      + wxsTable(wa, [ha, num(10), ...ra], 2)
      + wxsP('Attach certificates issued by the Executive Engineer concerned and countersigned by Superintending Engineer, indicating the balance work to be done, and likely period of completion.',{before:120,after:80})
      + _tsSign(sx)
      + wxsP('Details of works for which Tenders are submitted [awarded / likely to be awarded]',{b:true,before:240,after:80,keep:true})
      + wxsTable(wb, [hb, num(7), ...rb], 2)
      + wxsP('',{after:80}) + _tsSign(sx2);
  });
}

// ─── 3 · litigation / criminal (NIL) ───────────────────
async function tsDlNil(kind){
  const lit = kind==='lit';
  const title = lit ? 'Litigation history' : 'Criminal record';
  const heading = lit ? 'Information on litigation history in which Tenderer is the Petitioner.' : 'Information on criminal record if any';
  const cols = lit ? ['S. No','Case No. / Year','Court where filed.','Subject Matter / Prayer in the case.','Respondents i.e., SE / CE','Present Stage'] : ['S. No','Name of Police station','Town or village and District','FIR No. Date','Details of the charges','Stage of case / result'];
  await tsBuild(_tsFirm, title+' (NIL)', (avail, sx, sx2, head)=>{
    const w = wxsScale([600,1500,1500,1800,1500,1300], avail);
    return head + wxsP('Statement — '+heading.replace(/\.$/,'')+'.',{b:true,u:true,jc:'center',after:160,sz:24}).replace('Statement — ','')
      + wxsTable(w, [cols.map(t=>({t,b:true,sz:20})), _tsNumRow(6).map(c=>Object.assign(c,{sz:20})), [{t:'NIL',span:6,b:true,sz:22}]], 2)
      + wxsP('',{after:200}) + _tsSign(sx);
  });
}

// ─── 4 · key personnel ─────────────────────────────────
function tsPersonEdit(id){
  const p = id ? (D.keyPeople||[]).find(x=>x.id===id) : null;
  const docs = (D.tenderDocs||[]).filter(d=>!d._archived).sort((a,b)=>(b.category==='Key personnel'?1:0)-(a.category==='Key personnel'?1:0)||String(a.name).localeCompare(b.name));
  const have = new Set((p&&p.certIds)||[]);
  let m = document.getElementById('ts-modal');
  if(!m){ m = document.createElement('div'); m.className='mov'; m.id='ts-modal'; document.body.appendChild(m); }
  const f = (lbl,idn,val,ph)=>`<div class="fg"><label>${lbl}</label><input id="${idn}" value="${_tsE(val||'')}" placeholder="${_tsE(ph||'')}" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:var(--rs)"></div>`;
  m.innerHTML = `<div class="mbox" style="max-width:600px"><div class="mhdr"><h2>${p?'✏️ Edit':'+ Add'} key personnel</h2><button class="mx" onclick="CM('ts-modal')">✕</button></div>
    ${f('Name','kp-name',p&&p.name,'e.g. TAMANAMPUDI KASI SAI RAM REDDY')}
    <div style="display:flex;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:160px">${f('Designation (default)','kp-des',p?p.designation:'CIVIL ENGINEER','')}</div><div style="flex:1;min-width:160px">${f('Qualification','kp-qual',p?p.qualification:'BTECH','')}</div></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:160px">${f('Total experience (default)','kp-exp',p&&p.experience,'e.g. 3 YEARS')}</div><div style="flex:1;min-width:160px">${f('Working with the tenderer since (default)','kp-since',p&&p.since,'e.g. 3 YEARS')}</div></div>
    <div class="fg"><label>Certificates <span style="font-weight:400;color:var(--text3)">(from the Tender Documents library — upload them there first, category “Key personnel”)</span></label>
      <div style="max-height:30vh;overflow:auto;border:1px solid var(--border);border-radius:var(--rs)">${docs.length?docs.map(d=>`<label style="display:flex;gap:8px;padding:6px 10px;border-bottom:1px solid var(--border);cursor:pointer;font-size:12px;text-transform:none;letter-spacing:0;font-weight:500;align-items:center"><input type="checkbox" class="kp-c" value="${d.id}" ${have.has(d.id)?'checked':''}><span><strong>${_tsE(d.name)}</strong> <span style="color:var(--text3)">· ${_tsE(d.firm)} · ${_tsE(d.category||'')}</span></span></label>`).join(''):'<div style="padding:12px;color:var(--text3);font-size:12px">No documents in the library yet.</div>'}</div></div>
    <div id="kp-err" style="color:var(--red);font-size:12px;margin-bottom:6px;display:none"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" onclick="CM('ts-modal')">Cancel</button><button class="btn btn-navy" id="kp-save" onclick="tsPersonSave('${id||''}')">Save</button></div></div>`;
  OM('ts-modal');
}
async function tsPersonSave(id){
  const v = i=>(document.getElementById(i).value||'').trim(), err = document.getElementById('kp-err');
  const name = v('kp-name'); if(!name){ err.textContent = 'Enter the name.'; err.style.display = 'block'; return; }
  const rec = {name, designation:v('kp-des'), qualification:v('kp-qual'), experience:v('kp-exp'), since:v('kp-since'), certIds:[...document.querySelectorAll('#ts-modal .kp-c:checked')].map(c=>c.value)};
  const btn = document.getElementById('kp-save'); btn.disabled = true;
  let p = id ? D.keyPeople.find(x=>x.id===id) : null, backup = p ? JSON.parse(JSON.stringify(p)) : null;
  if(p) Object.assign(p, rec); else { p = Object.assign({id:'kp_'+uid(), addedAt:new Date().toISOString()}, rec); D.keyPeople.push(p); }
  try{ await tsSavePeople(); delete _tsPpl[p.id]; CM('ts-modal'); toast('✓ Saved','ok'); tsDraw(); }
  catch(e){ console.error(e); if(backup){ Object.keys(p).forEach(k=>delete p[k]); Object.assign(p, backup); } else D.keyPeople = D.keyPeople.filter(x=>x!==p);
    err.textContent = 'NOT saved — '+(e.message||'unknown error')+'. Nothing was changed.'; err.style.display = 'block'; }
  finally{ btn.disabled = false; }
}
async function tsPersonHide(id){
  const p = D.keyPeople.find(x=>x.id===id); if(!p) return;
  if(!confirm('Hide '+p.name+' from this list? Nothing is deleted.')) return;
  p._archived = true;
  try{ await tsSavePeople(); toast('✓ Hidden','ok'); }catch(e){ delete p._archived; toast('NOT hidden — '+(e.message||'save failed'),'error',7000); }
  tsDraw();
}
function _tsPicked(){ return tsPeople().filter(p=>_tsPpl[p.id] && _tsPpl[p.id].sel); }
async function tsDlPeople(){
  const sel = _tsPicked(); if(!sel.length){ toast('Tick at least one person','error'); return; }
  await tsBuild(_tsFirm, 'Key personnel', (avail, sx, sx2, head)=>{
    const w = wxsScale([600,2700,1700,1600,1200,1500], avail);
    const hd = ['Sl. No','Name','Designation','Qualification','Total Experience','Working with the tenderer since'].map(t=>({t,b:true,sz:20}));
    const rows = sel.map((p,i)=>{ const s = _tsPpl[p.id]; return [{t:String(i+1),sz:20},{t:String(p.name||'').toUpperCase(),sz:20},{t:String(s.designation||'').toUpperCase(),sz:20},{t:String(p.qualification||'').toUpperCase(),sz:20},{t:String(s.experience||'').toUpperCase(),sz:20},{t:String(s.since||'').toUpperCase(),sz:20}]; });
    return head + wxsP('Availability of Key Personnel',{b:true,u:true,jc:'center',after:100,sz:24})
      + wxsP('Qualification and experience of Key Personnel proposed to be deployed for execution of the Contract.',{after:160})
      + wxsTable(w, [hd, _tsNumRow(6).map(c=>Object.assign(c,{sz:20})), ...rows], 2)
      + wxsP('',{after:200}) + _tsSign(sx);
  });
}
async function tsDlCerts(){
  const sel = _tsPicked(); if(!sel.length){ toast('Tick at least one person','error'); return; }
  if(typeof tdPdfReady==='function' && !tdPdfReady()) return;
  const docs = [], missing = [];
  sel.forEach(p=>{ const ds = (p.certIds||[]).map(tdDoc).filter(Boolean); if(!ds.length) missing.push(p.name); ds.forEach(d=>docs.push({id:d.id, name:d.name, fileName:d.fileName, mime:d.mime, url:d.url, firm:_tsFirm})); });
  if(!docs.length){ toast('None of the ticked people has a certificate attached yet','error'); return; }
  if(missing.length && !confirm('No certificate is attached for: '+missing.join(', ')+'.\n\nDownload the others anyway?')) return;
  setBusy(true,'Preparing certificates…');
  try{
    setBusy(false);
    if(typeof csWanted==='function' && csWanted()){ if(!(await csPrepare(docs))) return; }
    setBusy(true,'Building one PDF…');
    const bytes = await tdBuildPdf(PDFLib, docs, {getBytes:d=>d._bytes||tdFetchBytes(d), imageToJpeg:tdImageToJpeg});
    tdSaveBlob(bytes, tdSafeName('Key personnel certificates - '+_tsFirm)+'.pdf', 'application/pdf');
    toast('✓ Certificates downloaded — '+docs.length+' file'+(docs.length!==1?'s':''),'ok');
  }catch(e){ console.error(e); toast('Nothing was downloaded. '+tdExplainFailure(e),'error',8000); }
  finally{ setBusy(false); }
}
