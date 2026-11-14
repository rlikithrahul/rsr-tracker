// ═══════════════════════════════════════════════════════
// wexfinder.js — Work Experience Finder (quantity-wise)
//
// For a tender that asks, say, "50,000 kg of HYSD steel" or "250 cum of
// brickwork": pick the work, type the quantity, and see which financial
// year can satisfy it — then tick the projects whose certificates make it
// up and download those certificates as ONE PDF.
//
//  • Quantities come from the Work Experience records already in the app
//    (the same data as the other tabs). Nothing is re-entered.
//  • One requirement = ONE financial year. Each work type is judged on its
//    own, so concrete and steel can come from different years; the year
//    with the most of that quantity is suggested first.
//  • "Any type" or specific sub-types: tick every type the tender accepts
//    (e.g. all concrete, or just M30). Ticked types are added together and
//    every project shows its contribution broken down by type, so a type
//    that overlaps another can be unticked. Only types sharing a unit can
//    be combined.
//  • Only projects whose certificate (WEC) is uploaded in the app can be
//    ticked — those are the ones that can go into the PDF. Records without
//    an uploaded certificate are counted separately and can be shown.
//  • Uses the selected firm of the Work Experience page: one firm's
//    experience is never mixed with another's.
//  • Merging reuses the tender library's PDF builder, so a damaged or
//    locked certificate stops the download by name instead of leaving a gap.
// ═══════════════════════════════════════════════════════

const WXF_UNITS = {kg:'kg', cum:'cum', rmt:'rmt', sqm:'sqm', nos:'nos'};
const WXF_EPS = 0.005;   // matches the 2-decimal display, so 49,999.998 is not "short"
let _wxf = {firm:null, blocks:[], busy:false};
// One "block" = one requirement of the tender (e.g. steel 45,150 kg, or concrete 567 cum), each with its own types, quantity, financial year and projects.
function _wxfNewBlock(){ return {group:null, keys:[], reqValue:'', reqUnit:'', fy:null, sel:[], showNoCert:false}; }
function _wxfBlk(bi){ if(!_wxf.blocks.length) _wxf.blocks.push(_wxfNewBlock()); return _wxf.blocks[bi] || _wxf.blocks[0]; }

// ─── PURE HELPERS (testable) ───────────────────────────
function wxfN(n){ return Number(n||0).toLocaleString('en-IN', {maximumFractionDigits:2}); }
function wxfUnit(u){ return WXF_UNITS[u] || u || ''; }
function wxfRowId(r){ return r.id || ((r.genCode||'')+'|'+(r.fy||'')); }
function wxfEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// the tender may be written in tonnes; records are in kg
function wxfToStored(value, storedUnit, reqUnit){
  const v = Number(value); if(!(v>0)) return 0;
  return (storedUnit==='kg' && reqUnit==='MT') ? v*1000 : v;
}
// One row per Work Experience record that has any of the ticked types.
// linkFn(record) -> the project that record belongs to (or null).
function wxfCollect(records, linkFn, firm, keys){
  const rows = [];
  (records||[]).forEach(r=>{
    if(r._archived) return;
    if((r.firm||'RSR Constructions')!==firm) return;
    const parts = keys.map(k=>({key:k, qty:Number((r.quantities||{})[k])||0})).filter(x=>x.qty>0);
    const total = parts.reduce((s,x)=>s+x.qty,0);
    if(!(total>0)) return;
    const project = linkFn ? (linkFn(r)||null) : null;
    const w = (typeof wlCert==='function') ? wlCert(r, project) : (project && project.documents && project.documents.wec);
    rows.push({id:wxfRowId(r), rec:r, project, fy:r.fy, parts, total, cert:(w && w.url) ? w : null});
  });
  return rows;
}
// per financial year: what the certificates in hand add up to, best first
function wxfFYSummary(rows){
  const m = {};
  rows.forEach(x=>{
    const f = m[x.fy] = m[x.fy] || {fy:x.fy, total:0, count:0, noTotal:0, noCount:0};
    if(x.cert){ f.total += x.total; f.count++; } else { f.noTotal += x.total; f.noCount++; }
  });
  return Object.values(m).sort((a,b)=> (b.total-a.total) || String(b.fy).localeCompare(String(a.fy)));
}
function wxfStatus(selTotal, required){
  if(!(required>0)) return {state:'none'};
  const d = selTotal - required;
  return d >= -WXF_EPS ? {state:'met', excess:Math.max(0,d)} : {state:'short', short:-d};
}
// largest first, stopping as soon as the requirement is covered
function wxfAutoPick(certRows, required){
  const pick = []; let sum = 0;
  [...certRows].sort((a,b)=>b.total-a.total).forEach(r=>{
    if(required>0 && sum >= required-WXF_EPS) return;
    pick.push(r.id); sum += r.total;
  });
  return pick;
}
// record -> project, using the same linkage as the rest of the page
// (getWEXEntries); where two projects share a record, the one with a
// certificate wins.
function wxfBuildLinker(){
  const map = new Map();
  (D.projects||[]).filter(p=>!isArchived(p)).forEach(p=>{
    let entries = []; try{ entries = getWEXEntries(p)||[]; }catch(e){ if(!wxfBuildLinker._warned){ wxfBuildLinker._warned = true; console.error('Work Experience Finder: could not link a project to its records —', e); } }
    const has = !!(p.documents && p.documents.wec && p.documents.wec.url);
    entries.forEach(r=>{
      const cur = map.get(r);
      if(!cur || (!(cur.documents && cur.documents.wec && cur.documents.wec.url) && has)) map.set(r, p);
    });
  });
  return r=>map.get(r)||null;
}

// ─── STATE / HANDLERS ──────────────────────────────────
function wxfRefresh(){ const el = document.getElementById('wxf-root'); if(el) el.innerHTML = _wxfBody(); }
function wxfAddBlock(){ _wxf.blocks.push(_wxfNewBlock()); wxfRefresh(); }
async function wxfRemoveBlock(bi){
  if(_wxf.blocks.length<2) return;
  const ok = await showConfirm({title:'Remove this quantity?', message:'Its types, year and ticked projects are cleared. Nothing in your records is changed.', confirmLabel:'Remove', danger:false});
  if(!ok) return; _wxf.blocks.splice(bi,1); wxfRefresh();
}
function wxfSetGroup(bi,g){ const b=_wxfBlk(bi); b.group = g; b.keys = []; b.fy = null; b.sel = []; b.reqUnit = ''; wxfRefresh(); }
function wxfToggleKey(bi,k){
  const b=_wxfBlk(bi); const i = b.keys.indexOf(k); if(i>=0) b.keys.splice(i,1); else b.keys.push(k);
  b.sel = []; if(!b.keys.length) b.reqUnit = ''; wxfRefresh();
}
function wxfTickAll(bi,unit){
  const b=_wxfBlk(bi); const items = getAllWEXItems().filter(i=>(i.group||'Other')===b.group && i.unit===unit);
  b.keys = items.map(i=>i.key); b.sel = []; b.reqUnit = ''; wxfRefresh();
}
function wxfClearKeys(bi){ const b=_wxfBlk(bi); b.keys = []; b.sel = []; b.fy = null; b.reqUnit = ''; wxfRefresh(); }
function wxfSetReq(bi,v){ _wxfBlk(bi).reqValue = v; wxfRefresh(); }
function wxfSetUnit(bi,u){ _wxfBlk(bi).reqUnit = u; wxfRefresh(); }
function wxfPickFY(bi,fy){ const b=_wxfBlk(bi); b.fy = fy; b.sel = []; wxfRefresh(); }
function wxfToggleRow(bi,id){ const b=_wxfBlk(bi); const i = b.sel.indexOf(id); if(i>=0) b.sel.splice(i,1); else b.sel.push(id); wxfRefresh(); }
function wxfClearSel(bi){ _wxfBlk(bi).sel = []; wxfRefresh(); }
function wxfToggleNoCert(bi,on){ _wxfBlk(bi).showNoCert = !!on; wxfRefresh(); }

// everything block bi's choices produce — one place, used by render + actions
function _wxfModel(bi){
  const firm = (typeof _wexFirm!=='undefined' && _wexFirm) ? _wexFirm : 'RSR Constructions';
  if(_wxf.firm!==firm){ _wxf.firm = firm; _wxf.blocks.forEach(b=>{ b.sel = []; b.fy = null; }); }
  const bk = _wxfBlk(bi);
  const items = getAllWEXItems();
  const groups = [...new Set(items.map(i=>i.group||'Other'))];
  if(!bk.group || !groups.includes(bk.group)){ bk.group = groups[0]; bk.keys = []; }
  const records = ((D.wexData && D.wexData.records)||[]).filter(r=>!r._archived && (r.firm||'RSR Constructions')===firm);
  const groupItems = items.filter(i=>(i.group||'Other')===bk.group);
  const active = items.filter(i=>bk.keys.includes(i.key));
  const unit = active.length ? active[0].unit : null;
  const reqUnit = bk.reqUnit || unit;
  const required = unit ? wxfToStored(bk.reqValue, unit, reqUnit) : 0;
  const rows = unit ? wxfCollect(records, wxfBuildLinker(), firm, bk.keys) : [];
  const fys = wxfFYSummary(rows);
  if(unit && (!bk.fy || !fys.some(f=>f.fy===bk.fy))){ bk.fy = fys.length ? fys[0].fy : null; bk.sel = []; }
  const fyRows = rows.filter(x=>x.fy===bk.fy).sort((a,b)=>b.total-a.total);
  const certRows = fyRows.filter(x=>x.cert);
  bk.sel = bk.sel.filter(id=>certRows.some(x=>x.id===id));
  const selRows = bk.sel.map(id=>certRows.find(x=>x.id===id)).filter(Boolean);
  const selTotal = selRows.reduce((s,x)=>s+x.total,0);
  return {bk, bi, firm, items, groups, records, groupItems, active, unit, reqUnit, required, rows, fys, fyRows, certRows, selRows, selTotal, status:wxfStatus(selTotal, required)};
}
function _wxfAllModels(){ _wxfBlk(0); return _wxf.blocks.map((_,i)=>_wxfModel(i)); }
function wxfAutoPickClick(bi){
  const m = _wxfModel(bi);
  if(!(m.required>0)){ toast('Enter the required quantity first','error'); return; }
  m.bk.sel = wxfAutoPick(m.certRows, m.required); wxfRefresh();
}

// ─── DOWNLOAD ──────────────────────────────────────────
async function wxfDownload(){
  if(_wxf.busy) return;
  const ms = _wxfAllModels(); const m = ms[0]; const allSel = ms.flatMap(x=>x.selRows);
  if(!allSel.length){ toast('Tick at least one project first','error'); return; }
  if(typeof tdBuildPdf!=='function' || typeof tdPdfReady!=='function'){ toast('PDF tools are not available — hard refresh the page (Ctrl+Shift+R)','error'); return; }
  if(!tdPdfReady()) return;
  const seen = new Set(), docs = [];
  allSel.forEach(x=>{
    if(seen.has(x.cert.url)) return; seen.add(x.cert.url);
    // the file type is read from the file name; fall back to the link if the name has no extension
    const fileName = tdExt(x.cert.name) ? x.cert.name : String(x.cert.url).split('?')[0];
    docs.push({id:x.id, name:((x.project&&x.project.name)||x.rec.projectName||x.rec.genCode||'Project')+' — work experience certificate', fileName, mime:'', url:x.cert.url});
  });
  const label = ms.map(x=>x.active.length===1 ? x.active[0].label : (x.bk.group+' ('+x.active.length+' types)')).join(' + ');
  _wxf.busy = true; toast('Building one PDF from '+docs.length+' certificate'+(docs.length!==1?'s':'')+'…','ok',2500);
  try{
    const bytes = await tdBuildPdf(PDFLib, docs, {getBytes:tdFetchBytes, imageToJpeg:tdImageToJpeg});
    tdSaveBlob(bytes, tdSafeName(m.firm+' - Work experience - '+label+' FY '+ms.map(x=>x.bk.fy).join('/')+' ('+docs.length+' certificates)')+'.pdf', 'application/pdf');
    toast('✓ PDF downloaded — '+docs.length+' certificate'+(docs.length!==1?'s':''),'ok');
    logActivity({category:'system', action:'wex_bundle_downloaded', description:(CU?CU.name:'')+' downloaded a work-experience bundle: '+label+', FY '+ms.map(x=>x.bk.fy).join('/')+', '+docs.length+' certificates ('+m.firm+')'});
  }catch(e){
    console.error(e);
    toast('Nothing was downloaded. '+tdExplainFailure(e),'error',8000);
  }finally{ _wxf.busy = false; }
}

// ─── RENDER ────────────────────────────────────────────
function renderWexFinder(){ return '<div id="wxf-root">'+_wxfBody()+'</div>'; }

function _wxfBlockBody(bi){
  const m = _wxfModel(bi), bk = m.bk;
  const uLabel = wxfUnit(m.unit);
  const showT = u => (m.unit==='kg' ? ` <span style="color:var(--text3)">(${wxfN(u/1000)} MT)</span>` : '');
  const reqUnits = m.unit ? (m.unit==='kg' ? ['kg','MT'] : [m.unit]) : [];
  const unitsInGroup = [...new Set(m.groupItems.map(i=>i.unit))];
  const cnt = k => m.records.filter(r=>Number((r.quantities||{})[k])>0).length;

  // 1 — what does the tender ask for?
  const step1 = `<div class="card" style="margin-bottom:14px">
    <div class="st">1 · What does the tender ask for?</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px">Choose the kind of work, then tick every type the tender accepts. Tick them all for “any ${wxfEsc(String(bk.group||'').toLowerCase())}”, or just the specific one (e.g. only M30).</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      ${m.groups.map(g=>`<button onclick="wxfSetGroup(${bi},'${wxfEsc(g).replace(/'/g,"\\'")}')" style="padding:7px 14px;border-radius:18px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;border:1.5px solid ${bk.group===g?'var(--navy)':'var(--border)'};background:${bk.group===g?'var(--navy)':'#fff'};color:${bk.group===g?'#fff':'var(--text2)'}">${wxfEsc(g)}</button>`).join('')}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
      ${m.groupItems.map(i=>{
        const on = bk.keys.includes(i.key), blocked = !!m.unit && i.unit!==m.unit, n = cnt(i.key);
        return `<label title="${blocked?'Uses a different unit ('+wxfUnit(i.unit)+') — can’t be added to the ticked types':''}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:var(--rs);font-size:12px;border:1.5px solid ${on?'var(--navy)':'var(--border)'};background:${on?'#eef2fb':'#fff'};${blocked?'opacity:.4;cursor:not-allowed':'cursor:pointer'}${n===0&&!on?';color:var(--text3)':''}">
          <input type="checkbox" ${on?'checked':''} ${blocked?'disabled':''} onchange="wxfToggleKey(${bi},'${i.key}')" style="margin:0"> ${wxfEsc(i.label)} <span style="color:var(--text3);font-size:10px">${wxfUnit(i.unit)} · ${n} record${n!==1?'s':''}</span>
        </label>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      ${unitsInGroup.map(u=>`<button class="btn btn-sm" onclick="wxfTickAll(${bi},'${u}')">☑ ${unitsInGroup.length>1?'All types in '+wxfUnit(u):'Any type — tick all'}</button>`).join('')}
      ${m.active.length?`<button class="btn btn-sm" onclick="wxfClearKeys(${bi})">Clear</button>`:''}
    </div>
    ${m.active.length>1?`<div style="font-size:11px;color:var(--text3);margin-top:8px">Ticked types are <strong>added together</strong>. If one of them is already counted inside another (so it would count twice), untick it — each project below shows its quantity by type so you can check.</div>`:''}
  </div>`;

  // 2 — the quantity asked for
  const step2 = `<div class="card" style="margin-bottom:14px">
    <div class="st">2 · How much is required?</div>
    ${!m.unit ? '<div style="font-size:12px;color:var(--text3)">Tick at least one type above first.</div>' : `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <input type="number" min="0" step="any" value="${wxfEsc(bk.reqValue)}" placeholder="e.g. ${m.unit==='kg'?'50000':'250'}" onchange="wxfSetReq(${bi},this.value)" onkeydown="if(event.key==='Enter')this.blur()" style="width:160px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--rs);font-size:14px;font-weight:700">
      ${reqUnits.length>1 ? `<select onchange="wxfSetUnit(${bi},this.value)" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:13px">${reqUnits.map(u=>`<option value="${u}" ${m.reqUnit===u?'selected':''}>${u==='MT'?'tonnes (MT)':wxfUnit(u)}</option>`).join('')}</select>`
                            : `<span style="font-size:13px;font-weight:700;color:var(--navy)">${uLabel}</span>`}
      ${m.required>0 && m.reqUnit==='MT' ? `<span style="font-size:12px;color:var(--text3)">= ${wxfN(m.required)} kg</span>`:''}
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">Tender quantity for <strong>${wxfEsc(m.active.map(a=>a.label).join(' + '))}</strong>, all from one financial year.</div>`}
  </div>`;

  // 3 — which financial year
  let step3 = '';
  if(m.unit){
    const fyCards = m.fys.map((f,idx)=>{
      const on = f.fy===bk.fy;
      const st = wxfStatus(f.total, m.required);
      const chip = st.state==='met' ? `<span style="color:var(--green);font-weight:700">✓ meets it${st.excess>0?' (+'+wxfN(st.excess)+')':''}</span>`
                 : st.state==='short' ? `<span style="color:var(--amber);font-weight:700">short by ${wxfN(st.short)}</span>` : '';
      return `<div onclick="wxfPickFY(${bi},'${f.fy}')" style="cursor:pointer;padding:10px 14px;border-radius:var(--rs);min-width:170px;border:2px solid ${on?'var(--navy)':'var(--border)'};background:${on?'#eef2fb':'#fff'}">
        <div style="font-size:12px;font-weight:800;color:var(--navy)">FY ${wxfEsc(f.fy)} ${idx===0&&f.total>0?'<span title="Most of this quantity" style="color:var(--gold2)">★ best</span>':''}</div>
        <div style="font-size:14px;font-weight:800;margin-top:2px">${wxfN(f.total)} ${uLabel}${showT(f.total)}</div>
        <div style="font-size:11px;color:var(--text3)">${f.count} project${f.count!==1?'s':''} with certificate${f.count!==1?'s':''}</div>
        ${chip?`<div style="font-size:11px;margin-top:2px">${chip}</div>`:''}
        ${f.noCount?`<div style="font-size:10px;color:var(--text3);margin-top:2px">+ ${f.noCount} record${f.noCount!==1?'s':''} (${wxfN(f.noTotal)}) with no certificate uploaded</div>`:''}
      </div>`;
    }).join('');
    step3 = `<div class="card" style="margin-bottom:14px">
      <div class="st">3 · Which financial year?</div>
      ${m.fys.length ? `<div style="font-size:12px;color:var(--text3);margin-bottom:8px">All the quantity must come from one year. The year with the most is marked ★ and chosen first — click another to compare.</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">${fyCards}</div>`
        : '<div style="font-size:13px;color:var(--text3);padding:6px 0">No work experience recorded for these types under <strong>'+wxfEsc(m.firm)+'</strong>.</div>'}
    </div>`;
  }

  // 4 — pick the projects
  let step4 = '';
  if(m.unit && bk.fy){
    const noCert = m.fyRows.filter(x=>!x.cert);
    const showParts = m.active.length>1;
    const stBar = (()=>{
      const s = m.status;
      const pct = m.required>0 ? Math.min(100, m.selTotal/m.required*100) : 0;
      const color = s.state==='met' ? 'var(--green)' : 'var(--amber)';
      return `<div style="background:#f7f8fb;border:1px solid var(--border);border-radius:var(--rs);padding:10px 14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13px">
          <div><strong>${m.selRows.length}</strong> selected · <strong>${wxfN(m.selTotal)} ${uLabel}</strong>${showT(m.selTotal)}${m.required>0?` of <strong>${wxfN(m.required)} ${uLabel}</strong> required`:''}</div>
          <div style="font-weight:800;color:${color}">${s.state==='met'?'✓ Requirement met'+(s.excess>0?' — '+wxfN(s.excess)+' '+uLabel+' extra':''):s.state==='short'?'Short by '+wxfN(s.short)+' '+uLabel:''}</div>
        </div>
        ${m.required>0?`<div style="height:7px;background:var(--border);border-radius:5px;margin-top:8px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${color}"></div></div>`:''}
      </div>`;
    })();
    step4 = `<div class="card" style="margin-bottom:14px">
      <div class="st">4 · Choose the projects — FY ${wxfEsc(bk.fy)}</div>
      ${stBar}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <button class="btn btn-sm" onclick="wxfAutoPickClick(${bi})" title="Ticks the biggest projects first until the requirement is covered — you can change the ticks afterwards">⚡ Pick largest first until met</button>
        ${m.selRows.length?`<button class="btn btn-sm" onclick="wxfClearSel(${bi})">Clear ticks</button>`:''}
      </div>
      ${m.certRows.length ? `<div class="tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:620px">
        <thead><tr><th style="width:34px"></th><th style="text-align:left">Project</th>${showParts?'<th style="text-align:left">By type</th>':''}<th style="text-align:right">Quantity</th><th style="text-align:right">Work value</th><th style="text-align:left">Certificate</th></tr></thead>
        <tbody>${m.certRows.map(x=>{
          const on = bk.sel.includes(x.id);
          const nm = (x.project && x.project.name) || x.rec.projectName || x.rec.genCode || '—';
          return `<tr style="border-bottom:1px solid var(--border);${on?'background:#eef2fb':''}">
            <td style="padding:6px 8px"><input type="checkbox" ${on?'checked':''} onchange="wxfToggleRow(${bi},'${x.id.replace(/'/g,"\\'")}')" style="width:16px;height:16px;cursor:pointer"></td>
            <td style="padding:6px 8px"><div style="font-weight:700;color:var(--navy)">${wxfEsc(nm)}</div><div style="font-size:10px;color:var(--text3)">${wxfEsc(x.rec.genCode||'')}${x.rec.workType?' · '+wxfEsc(x.rec.workType):''}</div></td>
            ${showParts?`<td style="padding:6px 8px;font-size:11px;color:var(--text2)">${x.parts.map(p=>{ const it = m.items.find(i=>i.key===p.key); return wxfEsc(it?it.label:p.key)+' '+wxfN(p.qty); }).join('<br>')}</td>`:''}
            <td style="padding:6px 8px;text-align:right;font-weight:800">${wxfN(x.total)} ${uLabel}</td>
            <td style="padding:6px 8px;text-align:right;color:var(--text2)">${x.rec.workValue?fmt(x.rec.workValue):'—'}</td>
            <td style="padding:6px 8px"><a href="${wxfEsc(x.cert.url)}" target="_blank" rel="noopener" style="color:var(--navy)">📕 View</a></td>
          </tr>`;
        }).join('')}</tbody></table></div>`
        : '<div style="font-size:13px;color:var(--text3);padding:6px 0">No projects with an uploaded certificate in this year.</div>'}
      ${noCert.length ? `<div style="margin-top:10px;font-size:12px"><label style="cursor:pointer"><input type="checkbox" ${bk.showNoCert?'checked':''} onchange="wxfToggleNoCert(${bi},this.checked)"> Show the ${noCert.length} record${noCert.length!==1?'s':''} with no certificate uploaded <span style="color:var(--text3)">(can’t be put in the PDF — upload the certificate on the project first)</span></label></div>` : ''}
      ${bk.showNoCert && noCert.length ? `<div class="tbl-wrap" style="margin-top:8px"><table style="width:100%;border-collapse:collapse;font-size:12px;opacity:.7"><tbody>${noCert.map(x=>`<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 8px"><span style="font-weight:700">${wxfEsc((x.project&&x.project.name)||x.rec.genCode||'—')}</span><div style="font-size:10px;color:var(--text3)">${wxfEsc(x.rec.genCode||'')}${x.rec.workType?' · '+wxfEsc(x.rec.workType):''} — no certificate uploaded</div></td><td style="padding:6px 8px;text-align:right">${wxfN(x.total)} ${uLabel}</td></tr>`).join('')}</tbody></table></div>`:''}
    </div>`;
  }

  const many = _wxf.blocks.length>1;
  const title = many ? `<div style="display:flex;align-items:center;justify-content:space-between;margin:2px 0 8px"><div style="font-size:14px;font-weight:800;color:var(--navy)">Quantity ${bi+1}${m.active.length?' — '+wxfEsc(m.active.map(a=>a.label).join(' + ')):''}${m.status.state==='met'?' <span style="color:var(--green)">✓ met</span>':m.status.state==='short'?' <span style="color:var(--amber)">short</span>':''}</div><button class="btn btn-sm" onclick="wxfRemoveBlock(${bi})">✕ Remove</button></div>` : '';
  return `<div style="${many?'border:2px solid var(--border);border-radius:var(--r);padding:10px;margin-bottom:14px;background:var(--surface2)':''}">${title}${step1 + step2 + step3 + step4}</div>`;
}

function _wxfBody(){
  const ms = _wxfAllModels(), m0 = ms[0];
  const nSel = ms.reduce((a,x)=>a+x.selRows.length,0);
  const bar = `<div class="card" style="margin-bottom:14px;position:sticky;bottom:8px;z-index:5;box-shadow:0 4px 18px rgba(26,39,68,.15)">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-sm" onclick="wxfAddBlock()" title="For a tender that asks for more than one quantity (for example steel and concrete)">➕ Add another quantity</button>
      <span style="flex:1"></span>
      <button class="btn btn-sm btn-navy" onclick="wxfDownload()" ${nSel?'':'disabled style="opacity:.5"'}>📎 Download certificates as one PDF</button>
      <button class="btn btn-sm btn-navy" onclick="wxfStatementDownload()" ${nSel?'':'disabled style="opacity:.5"'}>📝 Statement as Word</button>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">${nSel?nSel+' project selection'+(nSel!==1?'s':'')+' across '+ms.length+' quantit'+(ms.length!==1?'ies':'y')+'. ':''}The statement lists every ticked project once; a project ticked under two quantities gets both columns filled.</div>
  </div>`;
  return `<div style="font-size:12px;color:var(--text3);margin-bottom:12px">Finding experience for <strong>${wxfEsc(m0.firm)}</strong> (change the firm above). Quantity-wise requirements — each “X of this work, from one financial year”. Add one quantity for every item the tender asks for.</div>`
    + (typeof wexFlagsBanner==='function'?wexFlagsBanner():'') + ms.map((_,i)=>_wxfBlockBody(i)).join('') + bar;
}

// ─── WORD STATEMENT (physical quantities) ──────────────
async function wxfStatementDownload(){
  const ms = _wxfAllModels().filter(x=>x.selRows.length);
  if(!ms.length){ toast('Tick at least one project first','error'); return; }
  if(typeof wxsQtyStatement!=='function'){ toast('Hard refresh the page (Ctrl+Shift+R) — the statement tool did not load','error'); return; }
  await wxsQtyStatement(ms);
}

