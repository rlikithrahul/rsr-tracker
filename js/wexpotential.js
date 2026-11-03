// ═══════════════════════════════════════════════════════
// wexpotential.js — Potential experience from BOQ (not yet certified)
//
// The quantity / value finders only see work that already has a Work
// Experience record. This tab looks at projects that have reached JV / EA /
// Completed but whose experience certificate has NOT been received yet, and
// uses their BOQ as an ESTIMATE of the experience they could give — so you
// can see which BOQ/certificate to go and get from the department to close
// the gap for a tender.
//
//  • Estimate only. The certificate is for work actually executed and can
//    come out higher or lower than the BOQ. Every figure is labelled so.
//  • Financial year = JV date's FY, else EA date, else completion date,
//    else agreement date (the basis is shown). It can be overridden per
//    project to any year; the override is saved.
//  • Quantity: BOQ lines are free text, so each quantity type has keyword
//    rules ("m30+unreinforced, m30+plain" = either group; "+" = all words).
//    Defaults are built in, editable here, and every project shows the exact
//    BOQ lines it matched. Or type any text for a one-off manual search.
//    Each BOQ line is counted once. Units are checked (cum / kg / sqm …);
//    tonnes convert to kg; a line in a different unit is listed, not added.
//  • Value: JV amount if received, else BOQ total with the bid % applied,
//    else the agreement value.
//  • Already-certified experience for the same year is added alongside, so
//    the gap left to close is visible.
// ═══════════════════════════════════════════════════════

const WXP_FY_KEY = 'rsr_wex_potential_fy';
const WXP_KW_KEY = 'rsr_wex_boq_keywords';
const WXP_DEFAULT_RULES = {
  earthwork:'earth work, earthwork, excavation', conveyance:'conveyance', wet_silt:'silt',
  crusher_fill:'crusher dust', gravel_fill:'gravel', sand_fill:'filling+sand, sand filling',
  bailing:'bailing, dewatering', cc_148:'1:4:8', vcc_136:'1:3:6', m30_total:'m30', m30_unr:'m30+unreinforced, m30+plain',
  m20_total:'m20', hysd_steel:'hysd, tmt, reinforcement', drain_225:'225mm+drain, 9"+drain', drain_300:'300mm+drain',
  dismantle_cc:'dismantl+cc', dismantle_rcc:'dismantl+rcc', dismantle_rr:'dismantl+rr, dismantl+rubble',
  brick_masonry:'brick+masonry, brick work', brick_falg:'fal-g, falg, fal g', plastering:'plaster', grating_1200:'grating+1200'
};
let _wxp = {mode:'qty', group:null, keys:[], types:[], reqValue:'', reqUnit:'', valUnit:'crore', manualOn:false, manualText:'', manualUnit:'cum',
            fy:null, sel:[], showKw:false, loaded:false, loading:false};

// ─── PURE HELPERS ──────────────────────────────────────
function wxpNorm(s){ return String(s==null?'':s).toLowerCase().replace(/\s*:\s*/g,':').replace(/\s+/g,' ').trim(); }
function wxpParseRule(str){
  return String(str||'').split(/[,;|]/).map(a=>a.split('+').map(t=>wxpNorm(t)).filter(Boolean)).filter(a=>a.length);
}
function wxpMatch(descNorm, alts){ return alts.some(terms=>terms.every(t=>descNorm.includes(t))); }
function wxpUnitNorm(u){
  const x = String(u||'').toLowerCase().replace(/[\s.]/g,'');
  if(['cum','cu.m','m3','cumt','cubicmeter','cubicmetre','cubicmtr'].includes(x)) return 'cum';
  if(['sqm','m2','sqmt','squaremeter','squaremetre'].includes(x)) return 'sqm';
  if(['rmt','rm','rmtr','mtr','m','runningmeter','runningmetre','rmtrs'].includes(x)) return 'rmt';
  if(['kg','kgs','kilogram'].includes(x)) return 'kg';
  if(['mt','tonne','tonnes','ton','tons'].includes(x)) return 'mt';
  if(['nos','no','nr','each','ea','nos.'].includes(x)) return 'nos';
  return x;
}
function wxpToStored(qty, boqUnit, wexUnit){
  const u = wxpUnitNorm(boqUnit);
  if(u===wexUnit) return qty;
  if(wexUnit==='kg' && u==='mt') return qty*1000;
  return null;
}
// items: [{key,label,unit,rule}] — each BOQ line counted once, to the first item it matches
function wxpMatchBOQ(boq, items){
  const lines = [], unitMismatch = []; let total = 0;
  const parsed = items.map(it=>({it, alts:wxpParseRule(it.rule)}));
  (boq||[]).forEach(b=>{
    const d = wxpNorm(b.desc); if(!d) return;
    const hit = parsed.find(x=>x.alts.length && wxpMatch(d, x.alts)); if(!hit) return;
    const q = wxpToStored(Number(b.qty)||0, b.unit, hit.it.unit);
    if(q===null){ unitMismatch.push({desc:b.desc, qty:b.qty, unit:b.unit, key:hit.it.key}); return; }
    if(!(q>0)) return;
    total += q; lines.push({desc:b.desc, qty:q, boqQty:b.qty, boqUnit:b.unit, key:hit.it.key, label:hit.it.label});
  });
  return {total, lines, unitMismatch};
}
function wxpProjectFY(p, overrides){
  const o = overrides && overrides[p.id];
  if(o) return {fy:o, basis:'chosen by you', overridden:true};
  const cands = [[p.jvDate,'JV date'],[p.eaDate,'EA date'],[p.completedDate||p.completionDate,'completion date'],[p.agreeDate,'agreement date']];
  for(const [d,b] of cands){ if(d) return {fy:getFYLabel(d), basis:b}; }
  return {fy:'Unknown', basis:'no date on project'};
}
function wxpBOQTotal(p){ return (p.boq||[]).reduce((s,x)=>s+(Number(x.amount)||0),0); }
function wxpValueOf(p){
  const jv = Number(p.jvAmount)||0;
  if(jv>0) return {amt:jv, basis:'JV amount'};
  const bt = wxpBOQTotal(p);
  if(bt>0) return {amt:Math.round(bt*(1+(Number(p.bidPct)||0)/100)*100)/100, basis:'BOQ × bid %'};
  const ag = Number(p.agreeAmt)||0;
  if(ag>0) return {amt:ag, basis:'agreement value'};
  return {amt:0, basis:'no amount'};
}
// projects that have reached JV / EA / Completed but have no experience yet
function wxpIsCandidate(p, firm){
  if(isArchived(p)) return false;
  if((p.firm||'RSR Constructions')!==firm) return false;
  const reached = !!(p.jvDate || p.eaNumber || (p.documents&&p.documents.ea) || projStatus(p)==='completed');
  if(!reached) return false;
  let entries = []; try{ entries = getWEXEntries(p)||[]; }catch(e){}
  const hasExp = !!(p.wecReceived || (p.documents&&p.documents.wec) || entries.length);
  return !hasExp;
}
function wxpRuleFor(item, kw){
  const o = kw && kw[item.key];
  if(o) return o;
  return WXP_DEFAULT_RULES[item.key] || wxpNorm(item.label);
}

// ─── SETTINGS (shared, saved) ──────────────────────────
async function wxpLoad(){
  if(_wxp.loaded || _wxp.loading) return;
  _wxp.loading = true;
  try{
    D.wxpFy = await getSetting(WXP_FY_KEY, {}) || {};
    D.wxpKw = await getSetting(WXP_KW_KEY, {}) || {};
    _wxp.loaded = true;
  }catch(e){ console.error('BOQ estimate settings could not load', e); D.wxpFy = D.wxpFy||{}; D.wxpKw = D.wxpKw||{}; _wxp.loaded = true; toast('Could not load saved year/keyword choices — defaults used (nothing was changed)','error'); }
  _wxp.loading = false; wxpRefresh();
}
async function wxpSaveMap(key, field){
  try{ D[field] = await mergeAndSaveSetting(key, D[field]||{}, false); }
  catch(e){ console.error(e); toast('Could not save — try again','error'); }
}
async function wxpSetFY(pid, fy){
  D.wxpFy = D.wxpFy||{}; D.wxpFy[pid] = fy||'';   // '' = back to automatic (explicit clear so merges keep it)
  _wxp.sel = _wxp.sel.filter(x=>x!==pid); wxpRefresh();
  await wxpSaveMap(WXP_FY_KEY,'wxpFy');
  const p = GP(pid); toast(fy?('✓ '+(p?p.name:'Project')+' now counts toward FY '+fy):'✓ Back to automatic year','ok');
  wxpRefresh();
}
async function wxpSetKw(key, val){
  D.wxpKw = D.wxpKw||{}; D.wxpKw[key] = String(val||'').trim(); wxpRefresh();
  await wxpSaveMap(WXP_KW_KEY,'wxpKw'); toast('✓ Keywords saved','ok'); wxpRefresh();
}

// ─── HANDLERS ──────────────────────────────────────────
function wxpRefresh(){ const el = document.getElementById('wxp-root'); if(el) el.innerHTML = _wxpBody(); }
function wxpMode(m){ _wxp.mode = m; _wxp.sel = []; _wxp.fy = null; wxpRefresh(); }
function wxpSetGroup(g){ _wxp.group = g; _wxp.keys = []; _wxp.sel = []; _wxp.fy = null; wxpRefresh(); }
function wxpToggleKey(k){ const i=_wxp.keys.indexOf(k); if(i>=0)_wxp.keys.splice(i,1); else _wxp.keys.push(k); _wxp.sel=[]; wxpRefresh(); }
function wxpTickAll(unit){ _wxp.keys = getAllWEXItems().filter(i=>(i.group||'Other')===_wxp.group && i.unit===unit).map(i=>i.key); _wxp.sel=[]; wxpRefresh(); }
function wxpClearKeys(){ _wxp.keys=[]; _wxp.sel=[]; _wxp.fy=null; wxpRefresh(); }
function wxpToggleType(t){ const i=_wxp.types.indexOf(t); if(i>=0)_wxp.types.splice(i,1); else _wxp.types.push(t); _wxp.sel=[]; wxpRefresh(); }
function wxpAllTypes(){ _wxp.types=[...getAllWorkTypes()]; _wxp.sel=[]; wxpRefresh(); }
function wxpClearTypes(){ _wxp.types=[]; _wxp.sel=[]; _wxp.fy=null; wxpRefresh(); }
function wxpSetReq(v){ _wxp.reqValue=v; wxpRefresh(); }
function wxpSetReqUnit(u){ _wxp.reqUnit=u; wxpRefresh(); }
function wxpSetValUnit(u){ _wxp.valUnit=u; wxpRefresh(); }
function wxpManual(on){ _wxp.manualOn=!!on; _wxp.sel=[]; _wxp.fy=null; wxpRefresh(); }
function wxpManualText(v){ _wxp.manualText=v; _wxp.sel=[]; wxpRefresh(); }
function wxpManualUnit(u){ _wxp.manualUnit=u; _wxp.sel=[]; wxpRefresh(); }
function wxpPickFY(fy){ _wxp.fy=fy; _wxp.sel=[]; wxpRefresh(); }
function wxpToggleRow(id){ const i=_wxp.sel.indexOf(id); if(i>=0)_wxp.sel.splice(i,1); else _wxp.sel.push(id); wxpRefresh(); }
function wxpClearSel(){ _wxp.sel=[]; wxpRefresh(); }
function wxpToggleKw(){ _wxp.showKw=!_wxp.showKw; wxpRefresh(); }

// ─── MODEL ─────────────────────────────────────────────
function _wxpModel(){
  const firm = (typeof _wexFirm!=='undefined' && _wexFirm) ? _wexFirm : 'RSR Constructions';
  const isQty = _wxp.mode==='qty';
  const items = getAllWEXItems();
  const groups = [...new Set(items.map(i=>i.group||'Other'))];
  if(!_wxp.group || !groups.includes(_wxp.group)){ _wxp.group = groups[0]; _wxp.keys = []; }
  const groupItems = items.filter(i=>(i.group||'Other')===_wxp.group);
  const allTypes = getAllWorkTypes();
  _wxp.types = _wxp.types.filter(t=>allTypes.includes(t));
  const kw = D.wxpKw||{}, ov = D.wxpFy||{};
  // what is being searched for
  let searchItems = [], unit = null, label = '';
  if(isQty){
    if(_wxp.manualOn){
      const rule = _wxp.manualText.trim();
      if(rule){ unit = _wxp.manualUnit; searchItems = [{key:'manual', label:'“'+rule+'”', unit, rule}]; label = rule; }
    } else {
      const act = items.filter(i=>_wxp.keys.includes(i.key));
      if(act.length){ unit = act[0].unit; searchItems = act.map(i=>({key:i.key, label:i.label, unit:i.unit, rule:wxpRuleFor(i,kw)})); label = act.map(a=>a.label).join(' + '); }
    }
  }
  const activeSearch = isQty ? searchItems.length>0 : _wxp.types.length>0;
  const reqUnit = isQty ? (_wxp.reqUnit || unit) : _wxp.valUnit;
  const required = isQty ? wxfToStored(_wxp.reqValue, unit, reqUnit) : wxvToRupees(_wxp.reqValue, _wxp.valUnit);

  // candidates
  const cands = []; let noBOQ = 0, noType = 0, noAmount = 0;
  if(activeSearch){
    (D.projects||[]).filter(p=>wxpIsCandidate(p, firm)).forEach(p=>{
      const f = wxpProjectFY(p, ov);
      if(isQty){
        if(!(p.boq&&p.boq.length)){ noBOQ++; return; }
        const r = wxpMatchBOQ(p.boq, searchItems);
        if(!(r.total>0)) { if(r.unitMismatch.length) cands.push({id:p.id, p, fy:f.fy, basis:f.basis, overridden:!!f.overridden, total:0, lines:[], unitMismatch:r.unitMismatch}); return; }
        cands.push({id:p.id, p, fy:f.fy, basis:f.basis, overridden:!!f.overridden, total:r.total, lines:r.lines, unitMismatch:r.unitMismatch});
      } else {
        const ts = wxvTypesOf(p); if(!ts.length){ noType++; return; }
        const matched = ts.filter(t=>_wxp.types.includes(t)); if(!matched.length) return;
        const v = wxpValueOf(p); if(!(v.amt>0)){ noAmount++; return; }
        cands.push({id:p.id, p, fy:f.fy, basis:f.basis, overridden:!!f.overridden, total:v.amt, valBasis:v.basis, matched, others:ts.filter(t=>!_wxp.types.includes(t)), lines:[], unitMismatch:[]});
      }
    });
  }
  const shown = cands.filter(c=>c.total>0);
  // already-certified experience in hand, per FY
  const certByFY = {};
  if(activeSearch && !(isQty && _wxp.manualOn)){
    const records = ((D.wexData&&D.wexData.records)||[]).filter(r=>!r._archived&&(r.firm||'RSR Constructions')===firm);
    const linker = wxfBuildLinker();
    const rows = isQty ? wxfCollect(records, linker, firm, _wxp.keys) : wxvCollect(records, linker, firm, _wxp.types, wxvRecentFYs(new Date(),10)).rows;
    rows.forEach(x=>{ if(x.cert) certByFY[x.fy] = (certByFY[x.fy]||0) + x.total; });
  }
  const potByFY = {}, cntByFY = {};
  shown.forEach(c=>{ potByFY[c.fy]=(potByFY[c.fy]||0)+c.total; cntByFY[c.fy]=(cntByFY[c.fy]||0)+1; });
  const fyAll = [...new Set([...Object.keys(potByFY)])].map(fy=>({fy, cert:certByFY[fy]||0, pot:potByFY[fy]||0, count:cntByFY[fy]||0, combined:(certByFY[fy]||0)+(potByFY[fy]||0)}))
    .sort((a,b)=>(a.fy==='Unknown')-(b.fy==='Unknown') || (b.combined-a.combined) || String(b.fy).localeCompare(String(a.fy)));
  if(activeSearch && (!_wxp.fy || !fyAll.some(f=>f.fy===_wxp.fy))){ _wxp.fy = fyAll.length?fyAll[0].fy:null; _wxp.sel=[]; }
  const fyRows = shown.filter(c=>c.fy===_wxp.fy).sort((a,b)=>b.total-a.total);
  _wxp.sel = _wxp.sel.filter(id=>fyRows.some(c=>c.id===id));
  const selRows = _wxp.sel.map(id=>fyRows.find(c=>c.id===id)).filter(Boolean);
  const selTotal = selRows.reduce((s,c)=>s+c.total,0);
  const certHere = certByFY[_wxp.fy]||0;
  return {firm, isQty, items, groups, groupItems, allTypes, kw, searchItems, unit, label, activeSearch, reqUnit, required, shown, noBOQ, noType, noAmount, fyAll, fyRows, selRows, selTotal, certHere, status:wxfStatus(certHere+selTotal, required)};
}
function wxpAutoPickClick(){
  const m = _wxpModel();
  if(!(m.required>0)){ toast('Enter the required amount first','error'); return; }
  const gap = m.required - m.certHere;
  if(gap<=0){ _wxp.sel=[]; toast('Already covered by certified experience in this year','ok'); wxpRefresh(); return; }
  _wxp.sel = wxfAutoPick(m.fyRows.map(c=>({id:c.id,total:c.total})), gap); wxpRefresh();
}
function wxpCopyList(){
  const m = _wxpModel();
  if(!m.selRows.length){ toast('Tick at least one project first','error'); return; }
  const f = n=> m.isQty ? wxfN(n)+' '+wxfUnit(m.unit) : wxfN(n);
  const txt = 'Projects to get the experience certificate for — '+m.firm+', FY '+_wxp.fy+' ('+m.label+')\n'
    + m.selRows.map((c,i)=>(i+1)+'. '+c.p.name+' ['+(getGenCode(c.p)||'no gen code')+'] — estimate '+f(c.total)).join('\n')
    + '\nTotal estimate: '+f(m.selTotal)+' (BOQ estimate, not certified)';
  const done = ()=>toast('✓ List copied','ok');
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(()=>toast('Could not copy — select and copy manually','error'));
  else toast('Copy is not available in this browser','error');
}

// ─── RENDER ────────────────────────────────────────────
function renderWexPotential(){ if(!_wxp.loaded) wxpLoad(); return '<div id="wxp-root">'+_wxpBody()+'</div>'; }
function _wxpBody(){
  const m = _wxpModel(), esc = wxfEsc;
  const q = s=>String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const fmtV = n => m.isQty ? wxfN(n)+' '+wxfUnit(m.unit) : fmt(n);
  const btn = (on,txt,fn)=>`<button onclick="${fn}" style="padding:7px 14px;border-radius:18px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;border:1.5px solid ${on?'var(--navy)':'var(--border)'};background:${on?'var(--navy)':'#fff'};color:${on?'#fff':'var(--text2)'}">${txt}</button>`;
  const intro = `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:var(--rs);padding:10px 14px;margin-bottom:12px;font-size:12px;color:#92400e">
    <strong>BOQ estimate — not certified.</strong> These projects have reached JV / EA / Completed but their experience certificate has not been received. Figures come from the BOQ (or JV amount), so the real certificate can come out higher or lower. Use this to decide which certificate to chase for <strong>${esc(m.firm)}</strong>.</div>`;

  const step0 = `<div class="card" style="margin-bottom:14px"><div class="st">1 · What is the tender asking?</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">${btn(m.isQty,'📦 A quantity (e.g. 2000 cum concrete)',"wxpMode('qty')")}${btn(!m.isQty,'💰 A similar-works value (e.g. ₹1.5 Cr)',"wxpMode('val')")}</div></div>`;

  let step1 = '';
  if(m.isQty){
    const unitsInGroup = [...new Set(m.groupItems.map(i=>i.unit))];
    step1 = `<div class="card" style="margin-bottom:14px"><div class="st">2 · Which work?</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${m.groups.map(g=>btn(_wxp.group===g,esc(g),`wxpSetGroup('${q(g)}')`)).join('')}</div>
      <label style="font-size:12px;cursor:pointer;display:inline-block;margin-bottom:8px"><input type="checkbox" ${_wxp.manualOn?'checked':''} onchange="wxpManual(this.checked)"> <strong>Manual search</strong> — type any BOQ words instead of using the quantity types</label>
      ${_wxp.manualOn ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px">
          <input type="text" value="${esc(_wxp.manualText)}" placeholder="e.g. m30   or   brick+masonry, brick work" onchange="wxpManualText(this.value)" onkeydown="if(event.key==='Enter')this.blur()" style="width:300px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--rs);font-size:13px">
          <select onchange="wxpManualUnit(this.value)" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:13px">${['cum','kg','sqm','rmt','nos'].map(u=>`<option value="${u}" ${_wxp.manualUnit===u?'selected':''}>${u}</option>`).join('')}</select></div>
          <div style="font-size:11px;color:var(--text3)">Use <strong>+</strong> when all words must appear (brick+masonry), a <strong>comma</strong> for alternatives. BOQ lines in a different unit are listed but not added.</div>`
      : `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${m.groupItems.map(i=>{ const on=_wxp.keys.includes(i.key), blocked=!!m.unit&&i.unit!==m.unit;
          return `<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:var(--rs);font-size:12px;border:1.5px solid ${on?'var(--navy)':'var(--border)'};background:${on?'#eef2fb':'#fff'};${blocked?'opacity:.4;cursor:not-allowed':'cursor:pointer'}"><input type="checkbox" ${on?'checked':''} ${blocked?'disabled':''} onchange="wxpToggleKey('${i.key}')" style="margin:0"> ${esc(i.label)} <span style="color:var(--text3);font-size:10px">${wxfUnit(i.unit)}</span></label>`; }).join('')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${unitsInGroup.map(u=>`<button class="btn btn-sm" onclick="wxpTickAll('${u}')">☑ ${unitsInGroup.length>1?'All in '+wxfUnit(u):'Any type — tick all'}</button>`).join('')}${m.searchItems.length?'<button class="btn btn-sm" onclick="wxpClearKeys()">Clear</button>':''}
          <button class="btn btn-sm" onclick="wxpToggleKw()">⚙ ${_wxp.showKw?'Hide':'Edit'} BOQ keywords</button></div>
        ${_wxp.showKw?`<div style="margin-top:10px;border:1px solid var(--border);border-radius:var(--rs);padding:10px"><div style="font-size:11px;color:var(--text3);margin-bottom:6px">Words that identify each type in a BOQ line. <strong>+</strong> = all words, <strong>comma</strong> = alternatives. Saved for everyone.</div>
          ${m.groupItems.map(i=>{ const cur=(m.kw[i.key]||'').trim(); const eff=wxpRuleFor(i,m.kw);
            return `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap"><div style="width:210px;font-size:12px;font-weight:600">${esc(i.label)}</div>
              <input type="text" value="${esc(eff)}" onchange="wxpSetKw('${i.key}',this.value)" style="flex:1;min-width:220px;padding:6px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px">
              ${cur?`<button class="btn btn-sm" onclick="wxpSetKw('${i.key}','')">Reset</button>`:'<span style="font-size:10px;color:var(--text3)">default</span>'}</div>`; }).join('')}</div>`:''}`}
    </div>`;
  } else {
    const allOn = m.allTypes.length>0 && _wxp.types.length===m.allTypes.length;
    step1 = `<div class="card" style="margin-bottom:14px"><div class="st">2 · What kind of work?</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:8px">“Civil works” in general → <em>Any civil works</em>. A specific similar work → tick only that type. A project counts if any of its types is ticked, once, at its full amount.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn btn-sm ${allOn?'btn-navy':''}" onclick="wxpAllTypes()">☑ Any civil works (all types)</button>${_wxp.types.length?'<button class="btn btn-sm" onclick="wxpClearTypes()">Clear</button>':''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${m.allTypes.map(t=>{ const on=_wxp.types.includes(t); return `<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:var(--rs);font-size:12px;cursor:pointer;border:1.5px solid ${on?'var(--navy)':'var(--border)'};background:${on?'#eef2fb':'#fff'}"><input type="checkbox" ${on?'checked':''} onchange="wxpToggleType('${q(t)}')" style="margin:0"> ${esc(t)}</label>`; }).join('')}</div>
      ${m.activeSearch&&m.noType?`<div style="font-size:12px;color:#92400e;margin-top:8px">⚠ ${m.noType} project${m.noType!==1?'s':''} have no work type and can’t be placed (Action Centre → Work Type Not Set).</div>`:''}</div>`;
  }

  const reqUnits = m.isQty ? (m.unit==='kg'?['kg','MT']:[m.unit]) : [];
  const step2 = `<div class="card" style="margin-bottom:14px"><div class="st">3 · How much is required?</div>
    ${!m.activeSearch?'<div style="font-size:12px;color:var(--text3)">Choose the work above first.</div>':`
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input type="number" min="0" step="any" value="${esc(_wxp.reqValue)}" placeholder="${m.isQty?'e.g. 2000':'e.g. 1.5'}" onchange="wxpSetReq(this.value)" onkeydown="if(event.key==='Enter')this.blur()" style="width:160px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--rs);font-size:14px;font-weight:700">
      ${m.isQty ? (reqUnits.length>1?`<select onchange="wxpSetReqUnit(this.value)" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:13px">${reqUnits.map(u=>`<option value="${u}" ${m.reqUnit===u?'selected':''}>${u==='MT'?'tonnes (MT)':u}</option>`).join('')}</select>`:`<span style="font-weight:700;color:var(--navy)">${wxfUnit(m.unit)}</span>`)
        : `<select onchange="wxpSetValUnit(this.value)" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:13px"><option value="crore" ${_wxp.valUnit==='crore'?'selected':''}>₹ Crore</option><option value="lakh" ${_wxp.valUnit==='lakh'?'selected':''}>₹ Lakh</option><option value="inr" ${_wxp.valUnit==='inr'?'selected':''}>₹ Rupees</option></select>`}
      ${m.required>0?`<span style="font-size:12px;color:var(--text3)">= ${m.isQty?wxfN(m.required)+' '+wxfUnit(m.unit):'₹ '+wxfN(m.required)}</span>`:''}</div>`}</div>`;

  let step3 = '';
  if(m.activeSearch){
    const cards = m.fyAll.map((f,idx)=>{ const on=f.fy===_wxp.fy, st=wxfStatus(f.combined,m.required);
      const chip = st.state==='met'?`<span style="color:var(--green);font-weight:700">✓ could meet it${st.excess>0?' (+'+fmtV(st.excess)+')':''}</span>`:st.state==='short'?`<span style="color:var(--amber);font-weight:700">still short by ${fmtV(st.short)}</span>`:'';
      return `<div onclick="wxpPickFY('${q(f.fy)}')" style="cursor:pointer;padding:10px 14px;border-radius:var(--rs);min-width:200px;border:2px solid ${on?'var(--navy)':'var(--border)'};background:${on?'#eef2fb':'#fff'}">
        <div style="font-size:12px;font-weight:800;color:var(--navy)">${f.fy==='Unknown'?'Year unknown':'FY '+esc(f.fy)} ${idx===0&&f.fy!=='Unknown'&&f.combined>0?'<span style="color:var(--gold2)">★ best</span>':''}</div>
        <div style="font-size:11px;margin-top:3px">Certified in hand: <strong>${fmtV(f.cert)}</strong></div>
        <div style="font-size:11px">BOQ estimate (${f.count} project${f.count!==1?'s':''}): <strong>${fmtV(f.pot)}</strong></div>
        <div style="font-size:13px;font-weight:800;margin-top:2px">Together ≈ ${fmtV(f.combined)}</div>${chip?`<div style="font-size:11px;margin-top:2px">${chip}</div>`:''}</div>`; }).join('');
    step3 = `<div class="card" style="margin-bottom:14px"><div class="st">4 · Which financial year?</div>
      ${m.fyAll.length?`<div style="font-size:12px;color:var(--text3);margin-bottom:8px">All from one year. “Certified in hand” is what you can already prove with uploaded certificates; the BOQ estimate is what the pending projects might add.</div><div style="display:flex;gap:10px;flex-wrap:wrap">${cards}</div>`
      :`<div style="font-size:13px;color:var(--text3);padding:6px 0">No pending project’s BOQ matches this${m.noBOQ?` (${m.noBOQ} project${m.noBOQ!==1?'s':''} have no BOQ uploaded)`:''}.</div>`}</div>`;
  }

  let step4 = '';
  if(m.activeSearch && _wxp.fy){
    const need = Math.max(0, m.required - m.certHere), s = m.status;
    const pct = m.required>0?Math.min(100,(m.certHere+m.selTotal)/m.required*100):0, color = s.state==='met'?'var(--green)':'var(--amber)';
    const fyOpts = cur => ['<option value="">Automatic</option>'].concat(wxvRecentFYs(new Date(),12).map(fy=>`<option value="${fy}" ${cur===fy?'selected':''}>FY ${fy}</option>`)).join('');
    step4 = `<div class="card" style="margin-bottom:14px"><div class="st">5 · Pending projects — ${_wxp.fy==='Unknown'?'year unknown':'FY '+esc(_wxp.fy)}</div>
      <div style="background:#f7f8fb;border:1px solid var(--border);border-radius:var(--rs);padding:10px 14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13px">
          <div>Certified <strong>${fmtV(m.certHere)}</strong> + <strong>${m.selRows.length}</strong> ticked (estimate <strong>${fmtV(m.selTotal)}</strong>) = <strong>${fmtV(m.certHere+m.selTotal)}</strong>${m.required>0?` of <strong>${fmtV(m.required)}</strong>`:''}</div>
          <div style="font-weight:800;color:${color}">${s.state==='met'?'✓ Would meet it (if certificates match the BOQ)':s.state==='short'?'Short by '+fmtV(s.short):''}</div></div>
        ${m.required>0?`<div style="font-size:11px;color:var(--text3);margin-top:4px">Gap to close from pending projects: ${fmtV(need)}</div><div style="height:7px;background:var(--border);border-radius:5px;margin-top:6px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${color}"></div></div>`:''}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn btn-sm" onclick="wxpAutoPickClick()">⚡ Pick largest first until the gap is covered</button>
        ${m.selRows.length?'<button class="btn btn-sm" onclick="wxpClearSel()">Clear ticks</button>':''}<button class="btn btn-sm btn-navy" onclick="wxpCopyList()" ${m.selRows.length?'':'disabled style="opacity:.5"'}>📋 Copy list of ticked projects</button></div>
      <div class="tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:700px"><thead><tr><th style="width:34px"></th><th style="text-align:left">Project</th><th style="text-align:left">Counts toward year</th><th style="text-align:left">${m.isQty?'BOQ lines matched':'Work type'}</th><th style="text-align:right">${m.isQty?'Est. quantity':'Est. amount'}</th></tr></thead><tbody>
      ${m.fyRows.map(c=>{ const on=_wxp.sel.includes(c.id), p=c.p;
        const stage = [p.jvDate?'JV '+fmtDate(p.jvDate):'', (p.eaNumber||(p.documents&&p.documents.ea))?'EA ✓':'', projStatus(p)==='completed'?'Completed':'', p.wecApplied?'WEC applied':''].filter(Boolean).join(' · ');
        return `<tr style="border-bottom:1px solid var(--border);vertical-align:top;${on?'background:#eef2fb':''}">
          <td style="padding:6px 8px"><input type="checkbox" ${on?'checked':''} onchange="wxpToggleRow('${q(c.id)}')" style="width:16px;height:16px;cursor:pointer"></td>
          <td style="padding:6px 8px"><div style="font-weight:700;color:var(--navy);cursor:pointer" onclick="openDetail('${q(p.id)}')">${esc(p.name)}</div><div style="font-size:10px;color:var(--text3)">${esc(getGenCode(p)||'no gen code')}${stage?' · '+esc(stage):''}</div></td>
          <td style="padding:6px 8px"><select onchange="wxpSetFY('${q(p.id)}',this.value)" style="padding:4px 6px;border:1px solid ${c.overridden?'var(--navy)':'var(--border)'};border-radius:6px;font-size:11px">${fyOpts(c.overridden?c.fy:'')}</select><div style="font-size:10px;color:var(--text3);margin-top:2px">${c.overridden?'chosen by you':'auto: '+esc(c.basis)}</div></td>
          <td style="padding:6px 8px;font-size:11px">${m.isQty
              ? `<details><summary style="cursor:pointer;color:var(--navy)">${c.lines.length} line${c.lines.length!==1?'s':''}</summary>${c.lines.map(l=>`<div style="margin-top:3px;color:var(--text2)">• ${esc(l.desc)} — <strong>${wxfN(l.boqQty)} ${esc(l.boqUnit||'')}</strong></div>`).join('')}</details>${c.unitMismatch.length?`<div style="color:#92400e;margin-top:3px">⚠ ${c.unitMismatch.length} similar line${c.unitMismatch.length!==1?'s':''} in another unit not added</div>`:''}`
              : `${c.matched.map(esc).join(', ')}${c.others.length?`<div style="color:#92400e">also: ${c.others.map(esc).join(', ')} ⚠</div>`:''}<div style="color:var(--text3)">basis: ${esc(c.valBasis)}</div>`}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:800">${fmtV(c.total)}</td></tr>`; }).join('')}
      </tbody></table></div>
      <div style="font-size:11px;color:var(--text3);margin-top:8px">${m.noBOQ?`${m.noBOQ} pending project${m.noBOQ!==1?'s':''} have no BOQ uploaded and are not listed. `:''}${m.noAmount?`${m.noAmount} have no amount. `:''}The year dropdown moves a project to another year and is saved for everyone; “Automatic” goes back to the date-based year.</div>
    </div>`;
  }
  return intro + step0 + step1 + step2 + step3 + step4;
}
