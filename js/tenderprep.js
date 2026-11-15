// ═══════════════════════════════════════════════════════
// tenderprep.js — Tender Documents → 📋 Tender Prep
//
// A checklist per big tender: the documents the tender asks for on the left, any number of already-signed
// files (Word / PDF / image) on the right. Tick what you want, reorder, and download one file, one item merged
// into a PDF, or the whole technical document as one PDF. Several tenders sit side by side as tabs.
//
//  • The FILES are temporary: each checklist has a “delete files on” date & time. After it, the files are removed from
//    storage (only files under techprep/ — nothing else in the app). Headings, order and ticks stay, with empty slots.
//    A file shared by two tenders is deleted only when no live tender still uses it.
//    The deletion runs when the app is opened on this tab after that time (the browser cannot run while closed).
//  • Everything else is hide-only: items, files and checklists are hidden, never deleted from the data.
//  • Saved headings: item names are remembered; a new tender starts from them and you keep only what it needs.
//  • Word files stay in the row but cannot be merged; “Replace with PDF” puts the PDF in the same place.
// ═══════════════════════════════════════════════════════

const TP_KEY = 'rsr_tender_prep_v1';
const TP_HEAD_KEY = 'rsr_tender_prep_headings_v1';
let _tpOpen = null;               // id of the checklist being shown
let _tpOff = new Set();           // file ids the user has un-ticked (everything is ticked by default)
let _tpBusy = false;
let _tpSwept = false;
let _tpSaveChain = Promise.resolve();

const _tpE = s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const _tpJs = s=>String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");

async function tpLoad(){
  if(!D.tenderPreps){
    const v = await getSetting(TP_KEY, []);      // a failed load throws; never cached as "empty"
    D.tenderPreps = Array.isArray(v) ? v : [];
  }
  if(!D.tpHeadings){
    const h = await getSetting(TP_HEAD_KEY, []);
    D.tpHeadings = Array.isArray(h) ? h : [];
  }
}
function tpSave(){
  const run = async ()=>{
    const merged = await mergeAndSaveSetting(TP_KEY, D.tenderPreps||[], true);
    (merged||[]).forEach(m=>{ if(!D.tenderPreps.some(x=>x.id===m.id)) D.tenderPreps.push(m); });
  };
  const p = _tpSaveChain.catch(()=>{}).then(run); _tpSaveChain = p; return p;
}
function tpSaveHeadings(){
  const run = async ()=>{
    const merged = await mergeAndSaveSetting(TP_HEAD_KEY, D.tpHeadings||[], true);
    (merged||[]).forEach(m=>{ if(!D.tpHeadings.some(x=>x.id===m.id)) D.tpHeadings.push(m); });
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
const tpFiles = i=>(i.files||[]).filter(f=>!f._archived);          // shown in the row
const tpAvail = f=>!f._purged;                                      // still in storage
function tpKindLabel(f){ const k = tdKind(f); return k==='pdf' ? '📕 PDF' : k==='image' ? '🖼 Image' : /^docx?$/.test(tdExt(f.fileName)) ? '📘 Word' : '📄 '+(tdExt(f.fileName)||'file').toUpperCase(); }
function tpFmtWhen(iso){ const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}); }

// ─── automatic removal of expired files ────────────────
async function tpDeleteKey(key){
  if(!/^techprep\//.test(key)) throw new Error('refused: not a Tender Prep file');
  const r = await fetch(UPLOAD_WORKER_URL, {method:'DELETE', headers:{'X-Bucket':R2_DOCS_BUCKET, 'X-Key':key}});
  if(r.ok || r.status===404) return;
  let m = ''; try{ m = (await r.json()).error; }catch(e){}
  throw new Error('storage said '+r.status+(m?' — '+m:''));
}
async function tpSweep(){
  const now = Date.now();
  const due = (D.tenderPreps||[]).filter(p=>p.deleteAt && Date.parse(p.deleteAt)<=now);
  if(!due.length) return;
  const keep = new Set();                                           // files still needed by tenders that are not due
  (D.tenderPreps||[]).filter(p=>!due.includes(p)).forEach(p=>(p.items||[]).forEach(i=>(i.files||[]).forEach(f=>{ if(f.key && !f._purged) keep.add(f.key); })));
  const failed = []; const done = new Set();
  for(const p of due){
    const keys = new Set(); (p.items||[]).forEach(i=>(i.files||[]).forEach(f=>{ if(f.key && !f._purged && !keep.has(f.key)) keys.add(f.key); }));
    for(const k of keys){ if(done.has(k)) continue; try{ await tpDeleteKey(k); done.add(k); }catch(e){ failed.push(e.message||String(e)); } }
    // a file is marked removed only when its storage copy is really gone (or another tender, still alive, owns it)
    await tpChange(p.id, q=>{ (q.items||[]).forEach(i=>(i.files||[]).forEach(f=>{ if(f.key && !f._purged && (keep.has(f.key) || done.has(f.key) || !keys.has(f.key))){ f._purged = true; f._purgedAt = new Date().toISOString(); } })); });
  }
  if(failed.length) toast('Some expired files could not be removed from storage ('+failed[0]+'). They will be tried again next time.','error',9000);
  else if(done.size) toast('✓ Expired tender-prep files removed from storage ('+done.size+')','ok',6000);
}

// ─── page ──────────────────────────────────────────────
async function tpDraw(){
  const el = document.getElementById('sec-tenderdocs'); if(!el) return;
  try{ await tpLoad(); }
  catch(e){ console.error(e); el.innerHTML = '<div class="wrap">'+tdTabsHTML()+'<div class="card" style="text-align:center;padding:30px;color:var(--red)">Could not load the checklists. Check your connection and reload.</div></div>'; return; }
  if(!_tpSwept){ _tpSwept = true; try{ await tpSweep(); }catch(e){ console.error(e); } }
  const ps = tpLive();
  if(!ps.find(x=>x.id===_tpOpen)) _tpOpen = ps[0] ? ps[0].id : null;
  const p = ps.find(x=>x.id===_tpOpen);
  const tabs = `<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px;border-bottom:1px solid var(--border)">${ps.map(q=>{ const it = tpItems(q), done = it.filter(i=>tpFiles(i).some(tpAvail)).length, on = q.id===_tpOpen;
      return `<span onclick="_tpOpen='${_tpJs(q.id)}';_tpOff=new Set();tpDraw()" style="cursor:pointer;padding:8px 14px;border:1px solid var(--border);border-bottom:${on?'2px solid #fff':'1px solid var(--border)'};margin-bottom:-1px;border-radius:var(--rs) var(--rs) 0 0;background:${on?'#fff':'#f3f5f9'};font-size:12px;font-weight:800;color:var(--navy);max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_tpE(q.name)}">${_tpE(q.name)} <span style="font-weight:600;color:var(--text3)">${done}/${it.length}</span></span>`; }).join('')}
      <span onclick="tpNew()" title="Prepare another tender" style="cursor:pointer;padding:8px 14px;font-weight:900;font-size:15px;color:var(--navy)">＋</span></div>`;
  el.innerHTML = '<div class="wrap">'+tdTabsHTML()+tabs+(p ? tpOpenHTML(p) : '<div class="card" style="text-align:center;padding:30px;color:var(--text3)">No tender checklist yet. Press ＋ to prepare one.</div>')+'</div>';
}
function tpExpiryHTML(p){
  if(!p.deleteAt) return `<div style="font-size:12px;color:var(--text3)">⏳ No deletion time set — these files stay in storage until you set one. <button class="btn btn-sm" onclick="tpSetExpiry('${_tpJs(p.id)}')">Set delete date &amp; time</button></div>`;
  const ms = Date.parse(p.deleteAt)-Date.now(), days = ms/86400000, past = ms<=0;
  const anyLeft = (p.items||[]).some(i=>(i.files||[]).some(f=>f.key && !f._purged));
  const col = past ? 'var(--red)' : days<3 ? '#92400e' : 'var(--text2,#334155)';
  return `<div style="font-size:12px;color:${col}">⏳ ${past ? (anyLeft ? 'Deletion was due on <b>'+tpFmtWhen(p.deleteAt)+'</b> — it has not run yet (it runs when this tab is opened; if it keeps failing, storage delete is not enabled).' : 'Files were removed from storage on <b>'+tpFmtWhen(p.deleteAt)+'</b>. Headings are kept; add files again if needed.') : 'Files will be deleted from storage on <b>'+tpFmtWhen(p.deleteAt)+'</b> ('+(days<1?'in under a day':'in '+Math.ceil(days)+' day'+(Math.ceil(days)!==1?'s':''))+')'}.
    <button class="btn btn-sm" onclick="tpSetExpiry('${_tpJs(p.id)}')">Change</button></div>`;
}
function tpOpenHTML(p){
  const items = tpItems(p), withFiles = items.filter(i=>tpFiles(i).some(tpAvail)), missing = items.filter(i=>!tpFiles(i).some(tpAvail));
  const row = (i,n)=>{
    const fs = tpFiles(i), av = fs.filter(tpAvail), on = av.filter(f=>!_tpOff.has(f.id)).length;
    const mergeable = av.filter(f=>tdKind(f)!=='other').length;
    const arrows = (iid,fid)=>`<button class="btn btn-sm" style="padding:0 6px" title="Move up" onclick="tpMove('${_tpJs(p.id)}','${_tpJs(iid)}',${fid?`'${_tpJs(fid)}'`:'null'},-1)">▲</button><button class="btn btn-sm" style="padding:0 6px" title="Move down" onclick="tpMove('${_tpJs(p.id)}','${_tpJs(iid)}',${fid?`'${_tpJs(fid)}'`:'null'},1)">▼</button>`;
    return `<div style="display:flex;gap:10px;padding:12px 14px;border-top:1px solid var(--border);align-items:flex-start;flex-wrap:wrap;background:${av.length?'#fff':'#fffbeb'}">
      <div style="width:24px"><input type="checkbox" ${av.length&&on===av.length?'checked':''} ${av.length?'':'disabled'} onchange="tpTickRow('${_tpJs(p.id)}','${_tpJs(i.id)}',this.checked)" title="Tick / untick every file of this item"></div>
      <div style="flex:0 0 230px;min-width:160px"><div style="font-weight:800;font-size:13px;color:var(--navy)">${n}. ${_tpE(i.title)}</div>
        <div style="font-size:11px;color:${av.length?'var(--green,#15803d)':'#92400e'}">${av.length?'✓ '+av.length+' file'+(av.length!==1?'s':''):'No file yet'}</div>
        <div style="margin-top:4px;display:flex;gap:3px;flex-wrap:wrap">${arrows(i.id,null)}<button class="btn btn-sm" onclick="tpRenameItem('${_tpJs(p.id)}','${_tpJs(i.id)}')">✏️</button><button class="btn btn-sm" title="Hide this item for this tender (kept, not deleted)" onclick="tpHideItem('${_tpJs(p.id)}','${_tpJs(i.id)}')">🙈</button></div></div>
      <div style="flex:1;min-width:260px">
        ${fs.map(f=>{ const gone = f._purged, other = tdKind(f)==='other';
          return `<div style="display:flex;gap:6px;align-items:center;padding:4px 0;font-size:12px;flex-wrap:wrap"><input type="checkbox" ${gone?'disabled':''} ${_tpOff.has(f.id)?'':'checked'} onchange="tpTickFile('${_tpJs(f.id)}',this.checked)">
          <span style="color:var(--text3);white-space:nowrap">${tpKindLabel(f)}</span><span style="font-weight:600;word-break:break-all;${gone?'text-decoration:line-through;color:var(--text3)':''}">${_tpE(f.name||f.fileName)}</span>
          <span style="color:var(--text3)">${tdFmtSize(f.size)}</span>
          ${gone?'<span style="color:var(--text3)">· removed from storage</span>':''}
          ${other&&!gone?'<span style="color:#92400e">· can’t be merged</span>':''}
          ${arrows(i.id,f.id)}
          ${gone?'':`<button class="btn btn-sm" title="Download this file" onclick="tpDlFile('${_tpJs(p.id)}','${_tpJs(i.id)}','${_tpJs(f.id)}')">⬇</button>`}
          ${other&&!gone?`<label class="btn btn-sm" style="cursor:pointer" title="Upload this file's PDF — it takes this file's place and this one is hidden">⇄ Replace with PDF<input type="file" accept=".pdf,image/*" style="display:none" onchange="tpReplace('${_tpJs(p.id)}','${_tpJs(i.id)}','${_tpJs(f.id)}',this)"></label>`:''}
          <button class="btn btn-sm" title="Hide this file (kept, not deleted)" onclick="tpHideFile('${_tpJs(p.id)}','${_tpJs(i.id)}','${_tpJs(f.id)}')">🙈</button></div>`; }).join('')}
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap"><label class="btn btn-sm" style="cursor:pointer">+ Add files<input type="file" multiple style="display:none" onchange="tpAddFiles('${_tpJs(p.id)}','${_tpJs(i.id)}',this)"></label>
          <button class="btn btn-sm" title="Reuse a file already added in another tender (no second upload)" onclick="tpReuse('${_tpJs(p.id)}','${_tpJs(i.id)}')">↪ From another tender</button></div></div>
      <div style="flex:0 0 auto">${av.length?`<button class="btn btn-sm btn-navy" ${mergeable?'':'disabled'} title="Download this item's ticked files merged into one PDF" onclick="tpMerge('${_tpJs(p.id)}','${_tpJs(i.id)}')">⬇ Merged PDF</button>`:''}</div></div>`; };
  return `<div class="pg-hdr"><div><div class="pg-title">📋 ${_tpE(p.name)}</div>
      <div style="font-size:12px;color:var(--text3)">${withFiles.length} of ${items.length} items have files${missing.length?' — still missing: <b>'+missing.map(i=>_tpE(i.title)).join(', ')+'</b>':' — nothing missing ✓'}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="tpRenamePrep('${_tpJs(p.id)}')">✏️ Rename</button><button class="btn" title="Hide this whole checklist (kept, not deleted)" onclick="tpHidePrep('${_tpJs(p.id)}')">🙈 Hide tender</button></div></div>
    <div class="card" style="margin-bottom:12px;padding:10px 14px">${tpExpiryHTML(p)}</div>
    <div class="card" style="padding:0;margin-bottom:12px;overflow:hidden">${items.length ? items.map((i,k)=>row(i,k+1)).join('') : '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">No items yet — add what the tender asks for below.</div>'}</div>
    <div class="card" style="margin-bottom:12px"><div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:6px">+ Add items to this tender</div>
      <textarea id="tp-new" rows="3" placeholder="One item per line, e.g.&#10;Registration&#10;Statement 1 — value of works&#10;Statement 2 — similar works" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--rs);font-family:inherit;font-size:13px"></textarea>
      <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-sm btn-navy" onclick="tpAddItems('${_tpJs(p.id)}')">Add</button><button class="btn btn-sm" onclick="tpManageHeadings()">📑 Saved headings…</button></div></div>
    <div class="card" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px;font-size:12px;color:var(--text3)">The technical document merges every <b>ticked</b> file, item by item, in the order shown. Word files can’t go into a PDF — use “⇄ Replace with PDF” on them.</div>
      <button class="btn btn-navy" onclick="tpMerge('${_tpJs(p.id)}',null)" ${withFiles.length?'':'disabled'}>⬇ Download the whole technical document (one PDF)</button></div>`;
}
function tpTickFile(fid, on){ on ? _tpOff.delete(fid) : _tpOff.add(fid); tpDraw(); }
function tpTickRow(pid, iid, on){
  const p = tpLive().find(x=>x.id===pid), it = p && (p.items||[]).find(x=>x.id===iid); if(!it) return;
  tpFiles(it).filter(tpAvail).forEach(f=>{ on ? _tpOff.delete(f.id) : _tpOff.add(f.id); }); tpDraw();
}
// move an item (fid null) or a file one place up (-1) / down (+1) among the ones shown
async function tpMove(pid, iid, fid, dir){
  await tpChange(pid, p=>{
    const arr = fid ? p.items.find(x=>x.id===iid).files : p.items;
    const idx = arr.findIndex(x=>x.id===(fid||iid)); if(idx<0) return;
    let j = idx+dir; while(j>=0 && j<arr.length && arr[j]._archived) j += dir;
    if(j<0 || j>=arr.length) return;
    const t = arr[idx]; arr[idx] = arr[j]; arr[j] = t;
  });
  tpDraw();
}

// ─── checklists ────────────────────────────────────────
function tpNew(){
  const old = tpLive(), heads = (D.tpHeadings||[]).filter(h=>!h._archived);
  let m = document.getElementById('tp-modal');
  if(!m){ m = document.createElement('div'); m.className='mov'; m.id='tp-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="mbox" style="max-width:520px"><div class="mhdr"><h2>＋ Prepare a tender</h2><button class="mx" onclick="CM('tp-modal')">✕</button></div>
    <div class="fg"><label>Tender name</label><input id="tp-name" placeholder="e.g. GVMC Tender 924815 — Road works" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs)"></div>
    ${old.length?`<div class="fg"><label>Start from the items of an earlier tender <span style="font-weight:400;color:var(--text3)">(files are not copied)</span></label><select id="tp-copy" onchange="document.getElementById('tp-headbox').style.display=this.value?'none':'block'" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs)"><option value="">No — use my saved headings</option>${old.map(p=>`<option value="${_tpE(p.id)}">${_tpE(p.name)}</option>`).join('')}</select></div>`:''}
    <div id="tp-headbox" class="fg"><label>Saved headings — untick what this tender doesn't need</label>
      <div style="max-height:30vh;overflow:auto;border:1px solid var(--border);border-radius:var(--rs)">${heads.length?heads.map(h=>`<label style="display:flex;gap:8px;padding:5px 10px;border-bottom:1px solid var(--border);font-size:12px;text-transform:none;letter-spacing:0;font-weight:500;cursor:pointer"><input type="checkbox" class="tp-h" value="${_tpE(h.id)}" checked> ${_tpE(h.title)}</label>`).join(''):'<div style="padding:10px;color:var(--text3);font-size:12px">No saved headings yet — they are saved automatically as you add items.</div>'}</div></div>
    <div class="fg"><label>Delete this tender's files from storage on <span style="font-weight:400;color:var(--text3)">(optional — you can set it later)</span></label><input type="datetime-local" id="tp-exp" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs)"></div>
    <div id="tp-err" style="color:var(--red);font-size:12px;margin-bottom:6px;display:none"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" onclick="CM('tp-modal')">Cancel</button><button class="btn btn-navy" id="tp-ok" onclick="tpCreate()">Create</button></div></div>`;
  OM('tp-modal');
}
async function tpCreate(){
  const name = (document.getElementById('tp-name').value||'').trim(), err = document.getElementById('tp-err');
  if(!name){ err.textContent = 'Enter the tender name.'; err.style.display = 'block'; return; }
  const src = (document.getElementById('tp-copy')||{}).value;
  const from = src ? tpLive().find(x=>x.id===src) : null;
  let titles;
  if(from) titles = tpItems(from).map(i=>i.title);
  else { const pick = new Set([...document.querySelectorAll('#tp-modal .tp-h:checked')].map(c=>c.value)); titles = (D.tpHeadings||[]).filter(h=>!h._archived && pick.has(h.id)).map(h=>h.title); }
  const ex = (document.getElementById('tp-exp')||{}).value;
  const p = {id:'tp_'+uid(), name, createdAt:new Date().toISOString(), createdBy:CU?CU.name:'', items:titles.map(t=>({id:'ti_'+uid(), title:t, files:[]}))};
  if(ex){ const d = new Date(ex); if(!isNaN(d)) p.deleteAt = d.toISOString(); }
  const btn = document.getElementById('tp-ok'); btn.disabled = true;
  D.tenderPreps.push(p);
  try{ await tpSave(); CM('tp-modal'); _tpOpen = p.id; _tpOff = new Set(); toast('✓ Tender created','ok'); tpDraw(); }
  catch(e){ console.error(e); D.tenderPreps = D.tenderPreps.filter(x=>x!==p); err.textContent = 'NOT saved — '+(e.message||'save failed')+'. Nothing was changed.'; err.style.display = 'block'; }
  finally{ btn.disabled = false; }
}
async function tpRenamePrep(pid){
  const p = tpLive().find(x=>x.id===pid); if(!p) return;
  const n = prompt('Tender name (used in the downloaded file names)', p.name); if(n==null || !n.trim()) return;
  await tpChange(pid, q=>{ q.name = n.trim(); }, '✓ Renamed'); tpDraw();
}
async function tpHidePrep(pid){
  const p = tpLive().find(x=>x.id===pid); if(!p) return;
  if(!confirm('Hide the tender “'+p.name+'”? Its data is kept. (Its files are still removed from storage on the delete date, if one is set.)')) return;
  await tpChange(pid, q=>{ q._archived = true; }, '✓ Hidden'); tpDraw();
}
function tpSetExpiry(pid){
  const p = tpLive().find(x=>x.id===pid); if(!p) return;
  const loc = p.deleteAt ? new Date(new Date(p.deleteAt).getTime()-new Date(p.deleteAt).getTimezoneOffset()*60000).toISOString().slice(0,16) : '';
  let m = document.getElementById('tp-modal');
  if(!m){ m = document.createElement('div'); m.className='mov'; m.id='tp-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="mbox" style="max-width:440px"><div class="mhdr"><h2>⏳ Delete files on…</h2><button class="mx" onclick="CM('tp-modal')">✕</button></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px">After this date and time, the files of <b>${_tpE(p.name)}</b> are removed from storage for good. Headings and order stay. The removal runs when this tab is next opened after that time.</div>
    <input type="datetime-local" id="tp-exp2" value="${loc}" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs)">
    <div id="tp-err" style="color:var(--red);font-size:12px;margin:6px 0;display:none"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="btn" onclick="tpApplyExpiry('${_tpJs(pid)}',true)">No deletion</button><button class="btn" onclick="CM('tp-modal')">Cancel</button><button class="btn btn-navy" onclick="tpApplyExpiry('${_tpJs(pid)}',false)">Save</button></div></div>`;
  OM('tp-modal');
}
async function tpApplyExpiry(pid, clear){
  let iso = null;
  if(!clear){ const v = document.getElementById('tp-exp2').value, d = new Date(v);
    if(!v || isNaN(d)){ const e = document.getElementById('tp-err'); e.textContent = 'Pick a date and time.'; e.style.display = 'block'; return; }
    iso = d.toISOString(); }
  if(await tpChange(pid, q=>{ if(iso) q.deleteAt = iso; else delete q.deleteAt; }, iso?'✓ Deletion time set':'✓ Deletion time cleared')){ CM('tp-modal'); _tpSwept = false; tpDraw(); }
}

// ─── saved headings ────────────────────────────────────
async function tpRememberHeadings(titles){
  D.tpHeadings = D.tpHeadings||[]; let added = false;
  titles.forEach(t=>{ const k = String(t).trim().toLowerCase(); if(k && !D.tpHeadings.some(h=>String(h.title).trim().toLowerCase()===k)){ D.tpHeadings.push({id:'th_'+uid(), title:String(t).trim()}); added = true; } else { const h = D.tpHeadings.find(h=>String(h.title).trim().toLowerCase()===k); if(h && h._archived){ delete h._archived; added = true; } } });
  if(added){ try{ await tpSaveHeadings(); }catch(e){ console.error(e); } }   // a failure here never blocks the checklist
}
function tpManageHeadings(){
  const heads = (D.tpHeadings||[]).filter(h=>!h._archived);
  let m = document.getElementById('tp-modal');
  if(!m){ m = document.createElement('div'); m.className='mov'; m.id='tp-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="mbox" style="max-width:520px"><div class="mhdr"><h2>📑 Saved headings</h2><button class="mx" onclick="CM('tp-modal')">✕</button></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px">A new tender starts from these (you untick what it doesn't need). Items you add to any tender are saved here automatically. Changes here don't alter existing tenders.</div>
    <div style="max-height:44vh;overflow:auto;border:1px solid var(--border);border-radius:var(--rs);margin-bottom:8px">${heads.length?heads.map(h=>`<div style="display:flex;gap:8px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--border);font-size:13px"><span style="flex:1">${_tpE(h.title)}</span><button class="btn btn-sm" onclick="tpHeadEdit('${_tpJs(h.id)}')">✏️</button><button class="btn btn-sm" title="Hide (kept)" onclick="tpHeadHide('${_tpJs(h.id)}')">🙈</button></div>`).join(''):'<div style="padding:12px;color:var(--text3);font-size:12px">None yet.</div>'}</div>
    <div style="display:flex;gap:8px"><input id="tp-hnew" placeholder="Add a heading" style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:var(--rs)"><button class="btn btn-sm btn-navy" onclick="tpHeadAdd()">Add</button></div></div>`;
  OM('tp-modal');
}
async function tpHeadAdd(){ const v = (document.getElementById('tp-hnew').value||'').trim(); if(!v) return; await tpRememberHeadings([v]); tpManageHeadings(); }
async function tpHeadEdit(id){ const h = D.tpHeadings.find(x=>x.id===id); if(!h) return; const n = prompt('Heading', h.title); if(n==null||!n.trim()) return; const old = h.title; h.title = n.trim(); try{ await tpSaveHeadings(); }catch(e){ h.title = old; toast('NOT saved — '+(e.message||'failed'),'error'); } tpManageHeadings(); }
async function tpHeadHide(id){ const h = D.tpHeadings.find(x=>x.id===id); if(!h) return; h._archived = true; try{ await tpSaveHeadings(); }catch(e){ delete h._archived; toast('NOT saved — '+(e.message||'failed'),'error'); } tpManageHeadings(); }

// ─── items & files ─────────────────────────────────────
async function tpAddItems(pid){
  const ta = document.getElementById('tp-new'), lines = (ta.value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  if(!lines.length){ toast('Type at least one item','error'); return; }
  if(await tpChange(pid, p=>{ p.items = p.items||[]; lines.forEach(t=>p.items.push({id:'ti_'+uid(), title:t, files:[]})); }, '✓ Added '+lines.length+' item'+(lines.length!==1?'s':''))){ await tpRememberHeadings(lines); tpDraw(); }
}
async function tpRenameItem(pid, iid){
  const p = tpLive().find(x=>x.id===pid), it = p && p.items.find(x=>x.id===iid); if(!it) return;
  const n = prompt('Item name', it.title); if(n==null || !n.trim()) return;
  if(await tpChange(pid, q=>{ q.items.find(x=>x.id===iid).title = n.trim(); })) await tpRememberHeadings([n.trim()]);
  tpDraw();
}
async function tpHideItem(pid, iid){
  const p = tpLive().find(x=>x.id===pid), it = p && p.items.find(x=>x.id===iid); if(!it) return;
  if(!confirm('Hide “'+it.title+'” from this tender? (Its files are kept until the delete date.)')) return;
  await tpChange(pid, q=>{ q.items.find(x=>x.id===iid)._archived = true; }, '✓ Hidden'); tpDraw();
}
async function tpHideFile(pid, iid, fid){
  const p = tpLive().find(x=>x.id===pid), it = p && p.items.find(x=>x.id===iid), f = it && it.files.find(x=>x.id===fid); if(!f) return;
  if(!confirm('Hide “'+(f.name||f.fileName)+'” from this item? (The file is kept until the delete date.)')) return;
  await tpChange(pid, q=>{ q.items.find(x=>x.id===iid).files.find(x=>x.id===fid)._archived = true; }, '✓ Hidden'); tpDraw();
}
async function tpUploadOne(p, f){
  const key = 'techprep/'+tdSlug(p.name).slice(0,40)+'/'+Date.now()+'_'+Math.random().toString(36).slice(2,6)+'_'+f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  const url = await r2UploadViaWorker(f, R2_DOCS_BUCKET, key);
  return {id:'tf_'+uid(), name:f.name.replace(/\.[^.]+$/,''), fileName:f.name, mime:f.type||'', size:f.size, url, key, uploadedBy:CU?CU.name:'', uploadedAt:new Date().toISOString()};
}
async function tpAddFiles(pid, iid, inp){
  const list = [...(inp.files||[])]; inp.value = ''; if(!list.length || _tpBusy) return;
  const big = list.find(f=>f.size > TD_MAX_BYTES);
  if(big){ toast('“'+big.name+'” is '+tdFmtSize(big.size)+' — the limit is 25 MB per file','error',6000); return; }
  _tpBusy = true; const p = tpLive().find(x=>x.id===pid); const recs = [], failed = [];
  try{
    for(let k=0;k<list.length;k++){
      const f = list[k]; setBusy(true,'Uploading '+(k+1)+' of '+list.length+'…');
      try{ recs.push(await tpUploadOne(p, f)); }catch(e){ console.error(e); failed.push(f.name); }
    }
    setBusy(false);
    if(recs.length){ const ok = await tpChange(pid, q=>{ const it = q.items.find(x=>x.id===iid); it.files = it.files||[]; recs.forEach(r=>it.files.push(r)); }, '✓ Added '+recs.length+' file'+(recs.length!==1?'s':'')); if(!ok) toast('The files uploaded but could not be attached — try again','error',7000); }
    if(failed.length) toast('Not uploaded: '+failed.join(', '),'error',8000);
  } finally { setBusy(false); _tpBusy = false; tpDraw(); }
}
// upload the PDF of a Word file: it takes the Word file's place; the Word file is hidden
async function tpReplace(pid, iid, fid, inp){
  const f = inp.files && inp.files[0]; inp.value = ''; if(!f || _tpBusy) return;
  if(f.size > TD_MAX_BYTES){ toast('That file is '+tdFmtSize(f.size)+' — the limit is 25 MB','error'); return; }
  if(tdKind({mime:f.type, fileName:f.name})==='other'){ toast('Choose a PDF or an image','error'); return; }
  _tpBusy = true; const p = tpLive().find(x=>x.id===pid);
  try{
    setBusy(true,'Uploading…'); const rec = await tpUploadOne(p, f); setBusy(false);
    const ok = await tpChange(pid, q=>{ const it = q.items.find(x=>x.id===iid), idx = it.files.findIndex(x=>x.id===fid); it.files[idx]._archived = true; it.files[idx].replacedBy = rec.id; it.files.splice(idx+1, 0, rec); }, '✓ Replaced — the PDF is in the same place');
    if(!ok) toast('The file uploaded but could not be attached — try again','error',7000);
  }catch(e){ console.error(e); toast('Not uploaded — '+(e.message||'failed'),'error',7000); }
  finally{ setBusy(false); _tpBusy = false; tpDraw(); }
}
// reuse a file from another tender (same stored copy — no second upload)
function tpReuse(pid, iid){
  const others = tpLive().filter(x=>x.id!==pid);
  const opts = []; others.forEach(o=>(o.items||[]).forEach(i=>(i.files||[]).forEach(f=>{ if(!f._archived && !f._purged && f.key) opts.push({o,i,f}); })));
  let m = document.getElementById('tp-modal');
  if(!m){ m = document.createElement('div'); m.className='mov'; m.id='tp-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="mbox" style="max-width:560px"><div class="mhdr"><h2>↪ Use a file from another tender</h2><button class="mx" onclick="CM('tp-modal')">✕</button></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px">The same stored file is used — nothing is uploaded again. It is removed from storage only after every tender using it has passed its delete date.</div>
    <div style="max-height:46vh;overflow:auto;border:1px solid var(--border);border-radius:var(--rs)">${opts.length?opts.map((x,k)=>`<label style="display:flex;gap:8px;padding:6px 10px;border-bottom:1px solid var(--border);font-size:12px;cursor:pointer;text-transform:none;letter-spacing:0;font-weight:500;align-items:flex-start"><input type="checkbox" class="tp-r" value="${k}"><span><b>${_tpE(x.f.name||x.f.fileName)}</b> <span style="color:var(--text3)">${tpKindLabel(x.f)} · ${tdFmtSize(x.f.size)}<br>${_tpE(x.o.name)} › ${_tpE(x.i.title)}</span></span></label>`).join(''):'<div style="padding:14px;color:var(--text3);font-size:12px">No files in your other tenders yet.</div>'}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="btn" onclick="CM('tp-modal')">Cancel</button><button class="btn btn-navy" id="tp-rok">Use selected</button></div></div>`;
  OM('tp-modal');
  document.getElementById('tp-rok').onclick = async ()=>{
    const pick = [...document.querySelectorAll('#tp-modal .tp-r:checked')].map(c=>opts[Number(c.value)].f);
    if(!pick.length){ CM('tp-modal'); return; }
    const ok = await tpChange(pid, q=>{ const it = q.items.find(x=>x.id===iid); it.files = it.files||[]; pick.forEach(f=>it.files.push(Object.assign({}, f, {id:'tf_'+uid(), shared:true}))); }, '✓ Added '+pick.length+' file'+(pick.length!==1?'s':''));
    if(ok){ CM('tp-modal'); tpDraw(); }
  };
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
  items.forEach(i=>tpFiles(i).filter(f=>tpAvail(f) && !_tpOff.has(f.id)).forEach(f=>{ if(tdKind(f)==='other') left.push((iid?'':i.title+' — ')+(f.name||f.fileName)+' ('+tpKindLabel(f).slice(3)+')'); else docs.push(f); }));
  if(!docs.length){ toast(left.length ? 'Nothing to merge — only Word/other files are ticked, and they can’t go into a PDF. Use “⇄ Replace with PDF”.' : 'Nothing ticked to merge','error',7000); return; }
  if(left.length && !confirm('These files can’t go into a PDF and will be LEFT OUT:\n\n• '+left.join('\n• ')+'\n\nUse “⇄ Replace with PDF” to include them.\n\nMerge the rest ('+docs.length+' file'+(docs.length!==1?'s':'')+')?')) return;
  _tpBusy = true; setBusy(true,'Building one PDF…');
  try{
    const bytes = await tdBuildPdf(PDFLib, docs, {getBytes:d=>tdFetchBytes(d), imageToJpeg:tdImageToJpeg});
    const nm = iid ? items[0].title+' - '+p.name : p.name+' - Technical document';
    tdSaveBlob(bytes, tdSafeName(nm)+'.pdf', 'application/pdf');
    toast('✓ Downloaded — '+docs.length+' file'+(docs.length!==1?'s':'')+' merged'+(left.length?' ('+left.length+' left out)':''),'ok',6000);
  }catch(e){ console.error(e); toast('Nothing was downloaded — '+tdExplainFailure(e),'error',9000); }
  finally{ setBusy(false); _tpBusy = false; }
}
