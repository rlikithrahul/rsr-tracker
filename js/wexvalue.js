// ═══════════════════════════════════════════════════════
// wexvalue.js — Work Experience Finder (value / work-type wise)
//
// For a tender that says "similar works worth not less than ₹X in any one
// financial year": pick the work type(s), type the value, see which year can
// reach it, tick the projects, download their certificates as ONE PDF.
//
//  • "Any civil works"  = tick every type (one button). "Similar to Road" =
//    tick only Road. A project counts when ANY of its work types is ticked.
//  • Each Work Experience record is counted ONCE, at its full work value —
//    never once per type — so a project with Road + Drain is not doubled.
//    Because the value is not split by type, a mixed project is marked
//    "also: Drain" when you ticked only Road, so you can judge it yourself.
//  • One requirement = ONE financial year, among the last 10.
//  • Work type comes only from the project's own type list (Settings). A
//    record whose project has no type cannot be placed — it is counted and
//    flagged (Action Centre → "Work Type Not Set"), never guessed.
//  • Only projects with an uploaded certificate can be ticked / merged.
//  • Also here: wexFlagStages() — the three data-gap lists used by the
//    Action Centre (no work type / quantities without certificate /
//    certificate without quantities).
// ═══════════════════════════════════════════════════════

const WXV_MULT = {inr:1, lakh:100000, crore:10000000};
let _wxv = {firm:null, types:[], reqValue:'', reqUnit:'crore', fy:null, sel:[], showNoCert:false, busy:false};

// ─── PURE HELPERS ──────────────────────────────────────
function wxvTypesOf(p){
  if(!p) return [];
  if(p.types && p.types.length) return p.types.filter(Boolean);
  if(p.type) return String(p.type).split(',').map(t=>t.trim()).filter(Boolean);
  return [];
}
// "2025-26" labels for the current FY and the previous n-1
function wxvRecentFYs(today, n){
  const d = today || new Date(), y = d.getMonth()+1>=4 ? d.getFullYear() : d.getFullYear()-1;
  const out = [];
  for(let i=0;i<(n||10);i++){ const s=y-i; out.push(s+'-'+String(s+1).slice(2)); }
  return out;
}
function wxvToRupees(v, unit){ const n = Number(v); return n>0 ? n*(WXV_MULT[unit]||1) : 0; }
function wxvCollect(records, linkFn, firm, types, allowedFYs){
  const rows = []; let noType = 0;
  (records||[]).forEach(r=>{
    if(r._archived) return;
    if((r.firm||'RSR Constructions')!==firm) return;
    const val = Number(r.workValue)||0;
    if(!(val>0)) return;
    if(allowedFYs && !allowedFYs.includes(r.fy)) return;
    const project = linkFn ? (linkFn(r)||null) : null;
    const ptypes = wxvTypesOf(project);
    if(!ptypes.length){ noType++; return; }
    const matched = ptypes.filter(t=>types.includes(t));
    if(!matched.length) return;
    const w = project.documents && project.documents.wec;
    rows.push({id:wxfRowId(r), rec:r, project, fy:r.fy, total:val, ptypes, matched, others:ptypes.filter(t=>!types.includes(t)), cert:(w&&w.url)?w:null});
  });
  return {rows, noType};
}

// The three data-gap lists (projects). Shared by Action Centre + finder banner.
function _wexQtyCount(r){ return Object.values(r.quantities||{}).filter(v=>Number(v)>0).length; }
function wexFlagStages(projects){
  const out = {no_worktype:[], qty_no_cert:[], wex_pending:[]};
  (projects||[]).forEach(p=>{
    if(isArchived(p)) return;
    let entries = []; try{ entries = getWEXEntries(p)||[]; }catch(e){}
    const hasCert = !!(p.documents && p.documents.wec && p.documents.wec.url);
    const hasQty = entries.some(r=>_wexQtyCount(r)>0);
    // only projects that matter for experience: they have a record, a certificate or a JV
    if(!wxvTypesOf(p).length && (entries.length || hasCert || p.jvDate)) out.no_worktype.push(p);
    if(hasQty && !hasCert) out.qty_no_cert.push(p);
    if(hasCert && !hasQty) out.wex_pending.push(p);
  });
  return out;
}
function wexFlagDetail(key, p){
  let entries = []; try{ entries = getWEXEntries(p)||[]; }catch(e){}
  if(key==='no_worktype') return 'Open project → Edit → tick the work type'+(entries.length?' · '+entries.length+' experience record'+(entries.length>1?'s':'')+' waiting on it':'');
  if(key==='qty_no_cert') return 'Quantities entered for FY '+entries.filter(r=>_wexQtyCount(r)>0).map(r=>r.fy).join(', ')+' · certificate not uploaded';
  if(key==='wex_pending') return 'Certificate uploaded'+((p.documents.wec||{}).name?' ('+p.documents.wec.name+')':'')+' · '+(entries.length?'quantities empty':'no experience record');
  return '';
}
function wexFlagsBanner(){
  const f = wexFlagStages(D.projects||[]);
  const items = [
    ['no_worktype','🏷️','without a work type — the value finder can’t place them'],
    ['qty_no_cert','📎','have quantities but no certificate uploaded — can’t go in the PDF'],
    ['wex_pending','🔢','have a certificate but no quantities entered']
  ].filter(i=>f[i[0]].length);
  if(!items.length) return '';
  return `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:var(--rs);padding:10px 14px;margin-bottom:12px;font-size:12px;color:#92400e">
    <strong>Gaps that hide experience from the finders</strong> (full lists: Action Centre):
    ${items.map(i=>`<div style="margin-top:3px">${i[1]} <strong>${f[i[0]].length}</strong> project${f[i[0]].length!==1?'s':''} ${i[2]}</div>`).join('')}
  </div>`;
}

// ─── STATE / HANDLERS ──────────────────────────────────
function wxvRefresh(){ const el = document.getElementById('wxv-root'); if(el) el.innerHTML = _wxvBody(); }
function wxvToggleType(t){ const i=_wxv.types.indexOf(t); if(i>=0) _wxv.types.splice(i,1); else _wxv.types.push(t); _wxv.sel=[]; wxvRefresh(); }
function wxvAllTypes(){ _wxv.types = [...getAllWorkTypes()]; _wxv.sel=[]; wxvRefresh(); }
function wxvClearTypes(){ _wxv.types=[]; _wxv.sel=[]; _wxv.fy=null; wxvRefresh(); }
function wxvSetReq(v){ _wxv.reqValue=v; wxvRefresh(); }
function wxvSetUnit(u){ _wxv.reqUnit=u; wxvRefresh(); }
function wxvPickFY(fy){ _wxv.fy=fy; _wxv.sel=[]; wxvRefresh(); }
function wxvToggleRow(id){ const i=_wxv.sel.indexOf(id); if(i>=0) _wxv.sel.splice(i,1); else _wxv.sel.push(id); wxvRefresh(); }
function wxvClearSel(){ _wxv.sel=[]; wxvRefresh(); }
function wxvToggleNoCert(on){ _wxv.showNoCert=!!on; wxvRefresh(); }

function _wxvModel(){
  const firm = (typeof _wexFirm!=='undefined' && _wexFirm) ? _wexFirm : 'RSR Constructions';
  if(_wxv.firm!==firm){ _wxv.firm=firm; _wxv.sel=[]; _wxv.fy=null; }
  const allTypes = getAllWorkTypes();
  _wxv.types = _wxv.types.filter(t=>allTypes.includes(t));
  const records = ((D.wexData&&D.wexData.records)||[]).filter(r=>!r._archived && (r.firm||'RSR Constructions')===firm);
  const fyList = wxvRecentFYs(new Date(), 10);
  const linker = wxfBuildLinker();
  const active = _wxv.types.length > 0;
  const {rows, noType} = active ? wxvCollect(records, linker, firm, _wxv.types, fyList) : {rows:[], noType:0};
  // how many records each type has (for chip labels)
  const typeCount = {};
  records.forEach(r=>{ if(!(Number(r.workValue)>0)||!fyList.includes(r.fy)) return; wxvTypesOf(linker(r)).forEach(t=>typeCount[t]=(typeCount[t]||0)+1); });
  const required = wxvToRupees(_wxv.reqValue, _wxv.reqUnit);
  const fys = wxfFYSummary(rows);
  if(active && (!_wxv.fy || !fys.some(f=>f.fy===_wxv.fy))){ _wxv.fy = fys.length?fys[0].fy:null; _wxv.sel=[]; }
  const fyRows = rows.filter(x=>x.fy===_wxv.fy).sort((a,b)=>b.total-a.total);
  const certRows = fyRows.filter(x=>x.cert);
  _wxv.sel = _wxv.sel.filter(id=>certRows.some(x=>x.id===id));
  const selRows = _wxv.sel.map(id=>certRows.find(x=>x.id===id)).filter(Boolean);
  const selTotal = selRows.reduce((s,x)=>s+x.total,0);
  return {firm, allTypes, typeCount, active, rows, noType, required, fys, fyRows, certRows, selRows, selTotal, status:wxfStatus(selTotal, required)};
}
function wxvAutoPickClick(){
  const m=_wxvModel();
  if(!(m.required>0)){ toast('Enter the required value first','error'); return; }
  _wxv.sel = wxfAutoPick(m.certRows, m.required); wxvRefresh();
}

async function wxvDownload(){
  if(_wxv.busy) return;
  const m=_wxvModel();
  if(!m.selRows.length){ toast('Tick at least one project first','error'); return; }
  if(typeof tdBuildPdf!=='function' || typeof tdPdfReady!=='function'){ toast('PDF tools are not available — hard refresh the page (Ctrl+Shift+R)','error'); return; }
  if(!tdPdfReady()) return;
  const seen=new Set(), docs=[];
  m.selRows.forEach(x=>{
    if(seen.has(x.cert.url)) return; seen.add(x.cert.url);
    const fileName = tdExt(x.cert.name) ? x.cert.name : String(x.cert.url).split('?')[0];
    docs.push({id:x.id, name:((x.project&&x.project.name)||x.rec.genCode||'Project')+' — work experience certificate', fileName, mime:'', url:x.cert.url});
  });
  const label = _wxv.types.length===m.allTypes.length ? 'Civil works (all types)' : _wxv.types.join(' + ');
  _wxv.busy=true; toast('Building one PDF from '+docs.length+' certificate'+(docs.length!==1?'s':'')+'…','ok',2500);
  try{
    const bytes = await tdBuildPdf(PDFLib, docs, {getBytes:tdFetchBytes, imageToJpeg:tdImageToJpeg});
    tdSaveBlob(bytes, tdSafeName(m.firm+' - Similar works - '+label+' FY '+_wxv.fy+' ('+docs.length+' certificates)')+'.pdf','application/pdf');
    toast('✓ PDF downloaded — '+docs.length+' certificate'+(docs.length!==1?'s':''),'ok');
    logActivity({category:'system', action:'wex_bundle_downloaded', description:(CU?CU.name:'')+' downloaded a similar-works bundle: '+label+', FY '+_wxv.fy+', '+docs.length+' certificates ('+m.firm+')'});
  }catch(e){ console.error(e); toast('Nothing was downloaded. '+tdExplainFailure(e),'error',8000); }
  finally{ _wxv.busy=false; }
}

// ─── RENDER ────────────────────────────────────────────
function renderWexValueFinder(){ return '<div id="wxv-root">'+_wxvBody()+'</div>'; }
function _wxvBody(){
  const m=_wxvModel();
  const q = s=>String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const allOn = m.allTypes.length>0 && _wxv.types.length===m.allTypes.length;
  const step1 = `<div class="card" style="margin-bottom:14px">
    <div class="st">1 · What kind of work does the tender accept?</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px">Tender says <strong>“civil works / similar works”</strong> in general → use <em>Any civil works</em> (every type counts together). Tender says similar to a <strong>specific</strong> work (road, wall, culvert…) → tick only that type, or the few the tender names.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <button class="btn btn-sm ${allOn?'btn-navy':''}" onclick="wxvAllTypes()">☑ Any civil works (all types)</button>
      ${_wxv.types.length?'<button class="btn btn-sm" onclick="wxvClearTypes()">Clear</button>':''}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${m.allTypes.map(t=>{ const on=_wxv.types.includes(t), n=m.typeCount[t]||0;
        return `<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:var(--rs);font-size:12px;cursor:pointer;border:1.5px solid ${on?'var(--navy)':'var(--border)'};background:${on?'#eef2fb':'#fff'}${n===0&&!on?';color:var(--text3)':''}">
          <input type="checkbox" ${on?'checked':''} onchange="wxvToggleType('${q(t)}')" style="margin:0"> ${wxfEsc(t)} <span style="color:var(--text3);font-size:10px">${n} record${n!==1?'s':''}</span></label>`; }).join('')}
    </div>
    ${m.active&&m.noType?`<div style="font-size:12px;color:#92400e;background:#fffbeb;border-radius:var(--rs);padding:6px 10px;margin-top:10px">⚠ ${m.noType} experience record${m.noType!==1?'s':''} belong to projects with <strong>no work type</strong> and can’t be counted here. Set their type (Action Centre → “Work Type Not Set”).</div>`:''}
    ${m.active&&_wxv.types.length>1&&!allOn?`<div style="font-size:11px;color:var(--text3);margin-top:8px">A project counts if <strong>any</strong> of its types is ticked, and is counted <strong>once</strong> at its full value.</div>`:''}
  </div>`;

  const step2 = `<div class="card" style="margin-bottom:14px">
    <div class="st">2 · How much value is required?</div>
    ${!m.active?'<div style="font-size:12px;color:var(--text3)">Tick at least one type above first.</div>':`
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <input type="number" min="0" step="any" value="${wxfEsc(_wxv.reqValue)}" placeholder="e.g. 1.5" onchange="wxvSetReq(this.value)" onkeydown="if(event.key==='Enter')this.blur()" style="width:160px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--rs);font-size:14px;font-weight:700">
      <select onchange="wxvSetUnit(this.value)" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:13px">
        <option value="crore" ${_wxv.reqUnit==='crore'?'selected':''}>₹ Crore</option><option value="lakh" ${_wxv.reqUnit==='lakh'?'selected':''}>₹ Lakh</option><option value="inr" ${_wxv.reqUnit==='inr'?'selected':''}>₹ Rupees</option></select>
      ${m.required>0?`<span style="font-size:12px;color:var(--text3)">= ₹ ${wxfN(m.required)}</span>`:''}
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">“Not less than” this value, all from <strong>one financial year</strong> (last 10 years searched).</div>`}
  </div>`;

  let step3='';
  if(m.active){
    const cards = m.fys.map((f,idx)=>{ const on=f.fy===_wxv.fy, st=wxfStatus(f.total,m.required);
      const chip = st.state==='met'?`<span style="color:var(--green);font-weight:700">✓ meets it${st.excess>0?' (+'+fmt(st.excess)+')':''}</span>`:st.state==='short'?`<span style="color:var(--amber);font-weight:700">short by ${fmt(st.short)}</span>`:'';
      return `<div onclick="wxvPickFY('${f.fy}')" style="cursor:pointer;padding:10px 14px;border-radius:var(--rs);min-width:170px;border:2px solid ${on?'var(--navy)':'var(--border)'};background:${on?'#eef2fb':'#fff'}">
        <div style="font-size:12px;font-weight:800;color:var(--navy)">FY ${wxfEsc(f.fy)} ${idx===0&&f.total>0?'<span style="color:var(--gold2)">★ best</span>':''}</div>
        <div style="font-size:14px;font-weight:800;margin-top:2px">${fmt(f.total)}</div>
        <div style="font-size:11px;color:var(--text3)">${f.count} project${f.count!==1?'s':''} with certificate${f.count!==1?'s':''}</div>
        ${chip?`<div style="font-size:11px;margin-top:2px">${chip}</div>`:''}
        ${f.noCount?`<div style="font-size:10px;color:var(--text3);margin-top:2px">+ ${f.noCount} record${f.noCount!==1?'s':''} (${fmt(f.noTotal)}) with no certificate uploaded</div>`:''}</div>`; }).join('');
    step3 = `<div class="card" style="margin-bottom:14px"><div class="st">3 · Which financial year?</div>
      ${m.fys.length?`<div style="font-size:12px;color:var(--text3);margin-bottom:8px">Totals count only projects whose certificate is uploaded. The year with the most is ★ — click another to compare.</div><div style="display:flex;gap:10px;flex-wrap:wrap">${cards}</div>`
      :`<div style="font-size:13px;color:var(--text3);padding:6px 0">No work value recorded for these types under <strong>${wxfEsc(m.firm)}</strong> in the last 10 years.</div>`}</div>`;
  }

  let step4='';
  if(m.active && _wxv.fy){
    const noCert = m.fyRows.filter(x=>!x.cert), s=m.status;
    const pct = m.required>0?Math.min(100,m.selTotal/m.required*100):0, color=s.state==='met'?'var(--green)':'var(--amber)';
    step4 = `<div class="card" style="margin-bottom:14px"><div class="st">4 · Choose the projects — FY ${wxfEsc(_wxv.fy)}</div>
      <div style="background:#f7f8fb;border:1px solid var(--border);border-radius:var(--rs);padding:10px 14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13px">
          <div><strong>${m.selRows.length}</strong> selected · <strong>${fmt(m.selTotal)}</strong>${m.required>0?` of <strong>${fmt(m.required)}</strong> required`:''}</div>
          <div style="font-weight:800;color:${color}">${s.state==='met'?'✓ Requirement met'+(s.excess>0?' — '+fmt(s.excess)+' extra':''):s.state==='short'?'Short by '+fmt(s.short):''}</div></div>
        ${m.required>0?`<div style="height:7px;background:var(--border);border-radius:5px;margin-top:8px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${color}"></div></div>`:''}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <button class="btn btn-sm" onclick="wxvAutoPickClick()">⚡ Pick largest first until met</button>
        ${m.selRows.length?'<button class="btn btn-sm" onclick="wxvClearSel()">Clear ticks</button>':''}
        <button class="btn btn-sm btn-navy" onclick="wxvDownload()" ${m.selRows.length?'':'disabled style="opacity:.5"'}>📎 Download ${m.selRows.length||''} certificate${m.selRows.length!==1?'s':''} as one PDF</button></div>
      ${m.certRows.length?`<div class="tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:620px">
        <thead><tr><th style="width:34px"></th><th style="text-align:left">Project</th><th style="text-align:left">Work type</th><th style="text-align:right">Work value</th><th style="text-align:left">Certificate</th></tr></thead>
        <tbody>${m.certRows.map(x=>{ const on=_wxv.sel.includes(x.id), nm=(x.project&&x.project.name)||x.rec.genCode||'—';
          return `<tr style="border-bottom:1px solid var(--border);${on?'background:#eef2fb':''}">
            <td style="padding:6px 8px"><input type="checkbox" ${on?'checked':''} onchange="wxvToggleRow('${q(x.id)}')" style="width:16px;height:16px;cursor:pointer"></td>
            <td style="padding:6px 8px"><div style="font-weight:700;color:var(--navy)">${wxfEsc(nm)}</div><div style="font-size:10px;color:var(--text3)">${wxfEsc(x.rec.genCode||'')}</div></td>
            <td style="padding:6px 8px;font-size:11px">${x.matched.map(wxfEsc).join(', ')}${x.others.length?`<div style="color:#92400e">also: ${x.others.map(wxfEsc).join(', ')} <span title="Value is for the whole project and is not split by type">⚠</span></div>`:''}</td>
            <td style="padding:6px 8px;text-align:right;font-weight:800">${fmt(x.total)}</td>
            <td style="padding:6px 8px"><a href="${wxfEsc(x.cert.url)}" target="_blank" rel="noopener" style="color:var(--navy)">📕 View</a></td></tr>`; }).join('')}</tbody></table></div>`
      :'<div style="font-size:13px;color:var(--text3);padding:6px 0">No projects with an uploaded certificate in this year.</div>'}
      ${noCert.length?`<div style="margin-top:10px;font-size:12px"><label style="cursor:pointer"><input type="checkbox" ${_wxv.showNoCert?'checked':''} onchange="wxvToggleNoCert(this.checked)"> Show the ${noCert.length} record${noCert.length!==1?'s':''} with no certificate uploaded <span style="color:var(--text3)">(can’t be put in the PDF)</span></label></div>`:''}
      ${_wxv.showNoCert&&noCert.length?`<div class="tbl-wrap" style="margin-top:8px"><table style="width:100%;border-collapse:collapse;font-size:12px;opacity:.7"><tbody>${noCert.map(x=>`<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 8px"><span style="font-weight:700">${wxfEsc((x.project&&x.project.name)||x.rec.genCode||'—')}</span><div style="font-size:10px;color:var(--text3)">${wxfEsc(x.matched.join(', '))} — no certificate uploaded</div></td><td style="padding:6px 8px;text-align:right">${fmt(x.total)}</td></tr>`).join('')}</tbody></table></div>`:''}
    </div>`;
  }
  return `<div style="font-size:12px;color:var(--text3);margin-bottom:12px">Finding experience for <strong>${wxfEsc(m.firm)}</strong> (change the firm above). Value-wise requirements — “similar works worth ₹X, in one financial year”.</div>`
    + wexFlagsBanner() + step1 + step2 + step3 + step4;
}
