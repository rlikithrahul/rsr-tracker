// ═══════════════════════════════════════════════════════
// tenderprep.js — Tender Documents → 📋 Tender Prep
//
// A checklist for a big tender: on the left the documents the tender asks for, on the right any number of
// files for each (Word, PDF, image — already signed; nothing is stamped here). Tick what you want, download one
// file, one row merged into a PDF, or the whole technical document merged into one PDF.
//
// Nothing is ever deleted: removing an item or a file only hides it (kept in the data).
// Word (and other non-PDF/non-image) files are kept in the row but cannot go into a merged PDF — the
// merge says which ones were left out and why, and the row shows “add its PDF”.
// ═══════════════════════════════════════════════════════

const TP_KEY = 'rsr_tender_prep_v1';
let _tpOpen = null;               // id of the checklist being shown
let _tpOff = new Set();           // file ids the user has un-ticked (everything is ticked by default)
let _tpBusy = false;
let _tpSaveChain = Promise.resolve();

const _tpE = s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const _tpJs = s=>String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");

async function tpLoad(){
  if(!D.tenderPreps){
    const v = await getSetting(TP_KEY, []);      // a failed load throws; never cached as "empty"
    D.tenderPreps = Array.isArray(v) ? v : [];
  }
}
function tpSave(){
  const run = async ()=>{
    const merged = await mergeAndSaveSetting(TP_KEY, D.tenderPreps||[], true);
    (merged||[]).forEach(m=>{ if(!D.tenderPreps.some(x=>x.id===m.id)) D.tenderPreps.push(m); });
  };
  const p = _tpSaveChain.catch(()=>{}).then(run); _tpSaveChain = p; return p;
}
// change one checklist and save; on failure the checklist goes back exactly as it was
async function tpChange(prepId, fn, okMsg){
  const p = D.tenderPreps.find(x=>x.id===prepId); if(!p) return false;
  const backup = JSON.parse(JSON.stringify(p));
  try{ fn(p); await tpSave(); if(okMsg) toast(okMsg,'ok'); return true; }
  catch(e){ console.error(e); Object.keys(p).forEach(k=>delete p[k]); Object.assign(p, backup); toast('NOT saved — '+(e.message||'save failed')+'. Nothing was changed.','error',7000); return false; }
}
const tpLive = ()=>(D.tenderPreps||[]).filter(p=>!p._archived);
const tpItems = p=>(p.items||[]).filter(i=>!i._archived);
const tpFiles = i=>(i.files||[]).filter(f=>!f._archived);
function tpKindLabel(f){ const k = tdKind(f); return k==='pdf' ? '📕 PDF' : k==='image' ? '🖼 Image' : /^docx?$/.test(tdExt(f.fileName)) ? '📘 Word' : '📄 '+(tdExt(f.fileName)||'file').toUpperCase(); }

// ─── page ──────────────────────────────────────────────
async function tpDraw(){
  const el = document.getElementById('sec-tenderdocs'); if(!el) return;
  try{ await tpLoad(); }
  catch(e){ console.error(e); el.innerHTML = '<div class="wrap">'+tdTabsHTML()+'<div class="card" style="text-align:center;padding:30px;color:var(--red)">Could not load the checklists. Check your connection and reload.</div></div>'; return; }
  const p = _tpOpen ? tpLive().find(x=>x.id===_tpOpen) : null;
  if(_tpOpen && !p) _tpOpen = null;
  el.innerHTML = '<div class="wrap">'+tdTabsHTML()+(p ? tpOpenHTML(p) : tpListHTML())+'</div>';
}
function tpListHTML(){
  const ps = tpLive().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  return `<div class="pg-hdr"><div><div class="pg-title">📋 Tender Prep</div>
      <div style="font-size:12px;color:var(--text3)">For a big tender: list every document it needs, add the signed files, and download the technical document in one go.</div></div>
      <button class="btn btn-navy" onclick="tpNew()">+ New tender checklist</button></div>
    ${ps.length ? ps.map(p=>{ const it = tpItems(p), done = it.filter(i=>tpFiles(i).length).length;
      return `<div class="card" style="margin-bottom:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap"><div style="flex:1;min-width:200px;cursor:pointer" onclick="_tpOpen='${_tpJs(p.id)}';_tpOff=new Set();tpDraw()"><div style="font-size:15px;font-weight:800;color:var(--navy)">${_tpE(p.name)}</div><div style="font-size:12px;color:var(--text3)">${done} of ${it.length} items have files${p.createdBy?' · created by '+_tpE(p.createdBy):''}</div></div>
        <button class="btn btn-sm btn-navy" onclick="_tpOpen='${_tpJs(p.id)}';_tpOff=new Set();tpDraw()">Open</button>
        <button class="btn btn-sm" title="Hide this checklist (kept, not deleted)" onclick="tpHidePrep('${_tpJs(p.id)}')">🙈</button></div>`; }).join('')
      : '<div class="card" style="text-align:center;padding:30px;color:var(--text3)">No checklist yet. Press “+ New tender checklist”.</div>'}`;
}
function tpOpenHTML(p){
  const items = tpItems(p), withFiles = items.filter(i=>tpFiles(i).length), missing = items.filter(i=>!tpFiles(i).length);
  const row = (i,n)=>{
    const fs = tpFiles(i), on = fs.filter(f=>!_tpOff.has(f.id)).length;
    const mergeable = fs.filter(f=>tdKind(f)!=='other').length;
    return `<div style="display:flex;gap:10px;padding:12px 14px;border-top:1px solid var(--border);align-items:flex-start;flex-wrap:wrap;background:${fs.length?'#fff':'#fffbeb'}">
      <div style="width:24px"><input type="checkbox" ${fs.length&&on===fs.length?'checked':''} ${fs.length?'':'disabled'} onchange="tpTickRow('${_tpJs(p.id)}','${_tpJs(i.id)}',this.checked)" title="Tick / untick every file of this item"></div>
      <div style="flex:0 0 230px;min-width:160px"><div style="font-weight:800;font-size:13px;color:var(--navy)">${n}. ${_tpE(i.title)}</div>
        <div style="font-size:11px;color:${fs.length?'var(--green,#15803d)':'#92400e'}">${fs.length?'✓ '+fs.length+' file'+(fs.length!==1?'s':''):'No file yet'}</div>
        <div style="margin-top:4px"><button class="btn btn-sm" onclick="tpRenameItem('${_tpJs(p.id)}','${_tpJs(i.id)}')">✏️</button> <button class="btn btn-sm" title="Hide this item (kept, not deleted)" onclick="tpHideItem('${_tpJs(p.id)}','${_tpJs(i.id)}')">🙈</button></div></div>
      <div style="flex:1;min-width:240px">
        ${fs.map(f=>`<div style="display:flex;gap:8px;align-items:center;padding:4px 0;font-size:12px;flex-wrap:wrap"><input type="checkbox" ${_tpOff.has(f.id)?'':'checked'} onchange="tpTickFile('${_tpJs(f.id)}',this.checked)">
          <span style="color:var(--text3);white-space:nowrap">${tpKindLabel(f)}</span><span style="font-weight:600;word-break:break-all">${_tpE(f.name||f.fileName)}</span>
          <span style="color:var(--text3)">${tdFmtSize(f.size)}</span>
          ${tdKind(f)==='other'?'<span style="color:#92400e">· cannot go in a merged PDF — add its PDF to this row</span>':''}
          <button class="btn btn-sm" title="Download this file" onclick="tpDlFile('${_tpJs(p.id)}','${_tpJs(i.id)}','${_tpJs(f.id)}')">⬇</button>
          <button class="btn btn-sm" title="Hide this file (kept, not deleted)" onclick="tpHideFile('${_tpJs(p.id)}','${_tpJs(i.id)}','${_tpJs(f.id)}')">🙈</button></div>`).join('')}
        <div style="margin-top:6px"><label class="btn btn-sm" style="cursor:pointer">+ Add files<input type="file" multiple style="display:none" onchange="tpAddFiles('${_tpJs(p.id)}','${_tpJs(i.id)}',this)"></label></div></div>
      <div style="flex:0 0 auto">${fs.length?`<button class="btn btn-sm btn-navy" ${mergeable?'':'disabled'} title="Download this item's ticked files merged into one PDF" onclick="tpMerge('${_tpJs(p.id)}','${_tpJs(i.id)}')">⬇ Merged PDF</button>`:''}</div></div>`; };
  return `<div class="pg-hdr"><div><div class="pg-title">📋 ${_tpE(p.name)}</div>
      <div style="font-size:12px;color:var(--text3)">${withFiles.length} of ${items.length} items have files${missing.length?' — still missing: <b>'+missing.map(i=>_tpE(i.title)).join(', ')+'</b>':' — nothing missing ✓'}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="_tpOpen=null;tpDraw()">← All checklists</button><button class="btn" onclick="tpRenamePrep('${_tpJs(p.id)}')">✏️ Rename</button></div></div>
    <div class="card" style="padding:0;margin-bottom:12px;overflow:hidden">${items.length ? items.map((i,k)=>row(i,k+1)).join('') : '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">No items yet — add what the tender asks for below.</div>'}</div>
    <div class="card" style="margin-bottom:12px"><div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:6px">+ Add items to the checklist</div>
      <textarea id="tp-new" rows="3" placeholder="One item per line, e.g.&#10;Registration&#10;Statement 1 — value of works&#10;Statement 2 — similar works" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--rs);font-family:inherit;font-size:13px"></textarea>
      <div style="margin-top:6px"><button class="btn btn-sm btn-navy" onclick="tpAddItems('${_tpJs(p.id)}')">Add</button></div></div>
    <div class="card" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px;font-size:12px;color:var(--text3)">The technical document merges every <b>ticked</b> file, item by item in checklist order. Word files can’t go into a PDF — add their PDF to the same row.</div>
      <button class="btn btn-navy" onclick="tpMerge('${_tpJs(p.id)}',null)" ${withFiles.length?'':'disabled'}>⬇ Download the whole technical document (one PDF)</button></div>`;
}
function tpTickFile(fid, on){ on ? _tpOff.delete(fid) : _tpOff.add(fid); tpDraw(); }
function tpTickRow(pid, iid, on){
  const p = tpLive().find(x=>x.id===pid), it = p && (p.items||[]).find(x=>x.id===iid); if(!it) return;
  tpFiles(it).forEach(f=>{ on ? _tpOff.delete(f.id) : _tpOff.add(f.id); }); tpDraw();
}

// ─── checklists ────────────────────────────────────────
function tpNew(){
  const old = tpLive();
  let m = document.getElementById('tp-modal');
  if(!m){ m = document.createElement('div'); m.className='mov'; m.id='tp-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="mbox" style="max-width:480px"><div class="mhdr"><h2>+ New tender checklist</h2><button class="mx" onclick="CM('tp-modal')">✕</button></div>
    <div class="fg"><label>Tender name</label><input id="tp-name" placeholder="e.g. GVMC Tender 924815 — Road works" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs)"></div>
    ${old.length?`<div class="fg"><label>Copy the item names from an earlier checklist <span style="font-weight:400;color:var(--text3)">(optional — files are not copied)</span></label><select id="tp-copy" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs)"><option value="">Start empty</option>${old.map(p=>`<option value="${_tpE(p.id)}">${_tpE(p.name)}</option>`).join('')}</select></div>`:''}
    <div id="tp-err" style="color:var(--red);font-size:12px;margin-bottom:6px;display:none"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" onclick="CM('tp-modal')">Cancel</button><button class="btn btn-navy" id="tp-ok" onclick="tpCreate()">Create</button></div></div>`;
  OM('tp-modal');
}
async function tpCreate(){
  const name = (document.getElementById('tp-name').value||'').trim(), err = document.getElementById('tp-err');
  if(!name){ err.textContent = 'Enter the tender name.'; err.style.display = 'block'; return; }
  const src = (document.getElementById('tp-copy')||{}).value;
  const from = src ? tpLive().find(x=>x.id===src) : null;
  const p = {id:'tp_'+uid(), name, createdAt:new Date().toISOString(), createdBy:CU?CU.name:'', items:(from?tpItems(from):[]).map(i=>({id:'ti_'+uid(), title:i.title, files:[]}))};
  const btn = document.getElementById('tp-ok'); btn.disabled = true;
  D.tenderPreps.push(p);
  try{ await tpSave(); CM('tp-modal'); _tpOpen = p.id; _tpOff = new Set(); toast('✓ Checklist created','ok'); tpDraw(); }
  catch(e){ console.error(e); D.tenderPreps = D.tenderPreps.filter(x=>x!==p); err.textContent = 'NOT saved — '+(e.message||'save failed')+'. Nothing was changed.'; err.style.display = 'block'; }
  finally{ btn.disabled = false; }
}
async function tpRenamePrep(pid){
  const p = tpLive().find(x=>x.id===pid); if(!p) return;
  const n = prompt('Tender name', p.name); if(n==null || !n.trim()) return;
  await tpChange(pid, q=>{ q.name = n.trim(); }, '✓ Renamed'); tpDraw();
}
async function tpHidePrep(pid){
  const p = tpLive().find(x=>x.id===pid); if(!p) return;
  if(!confirm('Hide the checklist “'+p.name+'”? Nothing is deleted.')) return;
  await tpChange(pid, q=>{ q._archived = true; }, '✓ Hidden'); if(_tpOpen===pid) _tpOpen = null; tpDraw();
}

// ─── items & files ─────────────────────────────────────
async function tpAddItems(pid){
  const ta = document.getElementById('tp-new'), lines = (ta.value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  if(!lines.length){ toast('Type at least one item','error'); return; }
  if(await tpChange(pid, p=>{ p.items = p.items||[]; lines.forEach(t=>p.items.push({id:'ti_'+uid(), title:t, files:[]})); }, '✓ Added '+lines.length+' item'+(lines.length!==1?'s':''))) tpDraw();
}
async function tpRenameItem(pid, iid){
  const p = tpLive().find(x=>x.id===pid), it = p && p.items.find(x=>x.id===iid); if(!it) return;
  const n = prompt('Item name', it.title); if(n==null || !n.trim()) return;
  await tpChange(pid, q=>{ q.items.find(x=>x.id===iid).title = n.trim(); }); tpDraw();
}
async function tpHideItem(pid, iid){
  const p = tpLive().find(x=>x.id===pid), it = p && p.items.find(x=>x.id===iid); if(!it) return;
  if(!confirm('Hide “'+it.title+'” from this checklist? Its files are kept, not deleted.')) return;
  await tpChange(pid, q=>{ q.items.find(x=>x.id===iid)._archived = true; }, '✓ Hidden'); tpDraw();
}
async function tpHideFile(pid, iid, fid){
  const p = tpLive().find(x=>x.id===pid), it = p && p.items.find(x=>x.id===iid), f = it && it.files.find(x=>x.id===fid); if(!f) return;
  if(!confirm('Hide “'+(f.name||f.fileName)+'” from this item? The file is kept, not deleted.')) return;
  await tpChange(pid, q=>{ q.items.find(x=>x.id===iid).files.find(x=>x.id===fid)._archived = true; }, '✓ Hidden'); tpDraw();
}
async function tpAddFiles(pid, iid, inp){
  const list = [...(inp.files||[])]; inp.value = ''; if(!list.length || _tpBusy) return;
  const big = list.find(f=>f.size > TD_MAX_BYTES);
  if(big){ toast('“'+big.name+'” is '+tdFmtSize(big.size)+' — the limit is 25 MB per file','error',6000); return; }
  _tpBusy = true; const p = tpLive().find(x=>x.id===pid); const recs = [], failed = [];
  try{
    for(let k=0;k<list.length;k++){
      const f = list[k]; setBusy(true,'Uploading '+(k+1)+' of '+list.length+'…');
      try{
        const key = 'techprep/'+tdSlug(p.name).slice(0,40)+'/'+Date.now()+'_'+f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
        const url = await r2UploadViaWorker(f, R2_DOCS_BUCKET, key);
        recs.push({id:'tf_'+uid(), name:f.name.replace(/\.[^.]+$/,''), fileName:f.name, mime:f.type||'', size:f.size, url, key, uploadedBy:CU?CU.name:'', uploadedAt:new Date().toISOString()});
      }catch(e){ console.error(e); failed.push(f.name); }
    }
    setBusy(false);
    if(recs.length){ const ok = await tpChange(pid, q=>{ const it = q.items.find(x=>x.id===iid); it.files = it.files||[]; recs.forEach(r=>it.files.push(r)); }, '✓ Added '+recs.length+' file'+(recs.length!==1?'s':'')); if(!ok) toast('The files uploaded but could not be attached — try again','error',7000); }
    if(failed.length) toast('Not uploaded: '+failed.join(', '),'error',8000);
  } finally { setBusy(false); _tpBusy = false; tpDraw(); }
}

// ─── downloads ─────────────────────────────────────────
async function tpDlFile(pid, iid, fid){
  const p = tpLive().find(x=>x.id===pid), it = p && p.items.find(x=>x.id===iid), f = it && it.files.find(x=>x.id===fid); if(!f) return;
  setBusy(true,'Downloading…');
  try{ const b = await tdFetchBytes(f); tdSaveBlob(b, f.fileName||f.name, f.mime); }
  catch(e){ console.error(e); toast('Not downloaded — '+tdExplainFailure(e),'error',8000); }
  finally{ setBusy(false); }
}
// iid null = the whole technical document
async function tpMerge(pid, iid){
  if(_tpBusy) return; if(typeof tdPdfReady==='function' && !tdPdfReady()) return;
  const p = tpLive().find(x=>x.id===pid); if(!p) return;
  const items = iid ? tpItems(p).filter(i=>i.id===iid) : tpItems(p);
  const docs = [], left = [];
  items.forEach(i=>tpFiles(i).filter(f=>!_tpOff.has(f.id)).forEach(f=>{ if(tdKind(f)==='other') left.push((iid?'':i.title+' — ')+(f.name||f.fileName)+' ('+tpKindLabel(f).slice(3)+')'); else docs.push(f); }));
  if(!docs.length){ toast(left.length ? 'Nothing to merge — only Word/other files are ticked, and they can’t go into a PDF. Add their PDFs.' : 'Nothing ticked to merge','error',7000); return; }
  if(left.length && !confirm('These files can’t go into a PDF and will be LEFT OUT:\n\n• '+left.join('\n• ')+'\n\nAdd their PDFs to the rows to include them.\n\nMerge the rest ('+docs.length+' file'+(docs.length!==1?'s':'')+')?')) return;
  _tpBusy = true; setBusy(true,'Building one PDF…');
  try{
    const bytes = await tdBuildPdf(PDFLib, docs, {getBytes:d=>tdFetchBytes(d), imageToJpeg:tdImageToJpeg});
    const nm = iid ? items[0].title+' - '+p.name : p.name+' - Technical document';
    tdSaveBlob(bytes, tdSafeName(nm)+'.pdf', 'application/pdf');
    toast('✓ Downloaded — '+docs.length+' file'+(docs.length!==1?'s':'')+' merged'+(left.length?' ('+left.length+' left out)':''),'ok',6000);
  }catch(e){ console.error(e); toast('Nothing was downloaded — '+tdExplainFailure(e),'error',9000); }
  finally{ setBusy(false); _tpBusy = false; }
}
