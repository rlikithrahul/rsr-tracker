// ═══════════════════════════════════════════════════════
// tenderdocs.js — Tender Documents library (firm-wise)
//
// A reusable folder for everything that goes into tender submissions:
// registration/PAN/GST certificates, key-personnel certificates, key
// equipment lists, statements (litigation etc.), experience and financial
// documents — stored once per firm, with notes written at upload time so
// a document can be picked without opening it.
//
//  • Files go to the existing R2 documents bucket through the same upload
//    worker as project documents; only the details (name, category,
//    department, notes, validity, link) are saved in settings.
//  • Download one document as a PDF (images are converted), an image (for
//    image files), or the original file — or tick several and merge them
//    into ONE PDF in the order ticked, or download each as its own PDF.
//  • If any selected document can't be included, the merge is refused with
//    the name of the one that failed — never a bundle with a silent gap.
//
// Reading a stored file back as data (needed to merge / convert) requires
// the storage bucket to allow it (CORS). A one-time check says plainly
// whether that's set up. Viewing and plain downloads work either way.
// Access: all staff can view, upload, edit and download; only Super Admin
// can delete (a soft delete — hidden, not erased).
// ═══════════════════════════════════════════════════════

const TD_KEY = 'rsr_tender_docs_v1';
const TD_FIRMS = ['RSR Constructions','R Sadhu Rao','R Likith Rahul'];
const TD_CATEGORIES = ['Registration & statutory','Key personnel','Key equipment','Statements','Certificates','Experience & work orders','Financial','Other'];
const TD_DEPT_SUGGEST = ['All departments','GVMC','APIIC','R&B','PWD','Irrigation'];
const TD_MAX_BYTES = 25*1024*1024;
const TD_CORS_JSON = '[\n  {\n    "AllowedOrigins": ["https://rsr-tracker.pages.dev", "http://127.0.0.1:5500"],\n    "AllowedMethods": ["GET", "HEAD"],\n    "AllowedHeaders": ["*"],\n    "MaxAgeSeconds": 3600\n  }\n]';

let _tdFirmIdx = 0;
let _tdSel = [];          // ids in the order they were ticked (= merge order)
let _tdSearch = '';
let _tdCat = 'all';
let _tdProbe = 'unknown'; // 'unknown' | 'ok' | 'blocked'
let _tdBusy = false;
let _tdSaveChain = Promise.resolve();

// ─── SMALL HELPERS (pure) ──────────────────────────────
function tdEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function tdSafeName(s){ return String(s||'document').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,120) || 'document'; }
function tdSlug(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function tdExt(name){ const m = String(name||'').match(/\.([A-Za-z0-9]+)$/); return m ? m[1].toLowerCase() : ''; }
function tdFmtSize(n){ n = Number(n)||0; return n>=1048576 ? (n/1048576).toFixed(1)+' MB' : Math.max(1,Math.round(n/1024))+' KB'; }
// 'pdf' | 'image' | 'other' — decided by what the file actually is
function tdKind(doc){
  const mime = String(doc.mime||'').toLowerCase(), ext = tdExt(doc.fileName);
  if(mime==='application/pdf' || ext==='pdf') return 'pdf';
  if(mime.startsWith('image/') || ['jpg','jpeg','png','webp','gif','bmp','heic'].includes(ext)) return 'image';
  return 'other';
}
// days until validTill (negative = already expired); null when no date
function tdExpiryDays(validTill, now){
  if(!validTill) return null;
  const d = new Date(validTill+'T00:00:00'); if(isNaN(d.getTime())) return null;
  const t = new Date((now||new Date()).toISOString().split('T')[0]+'T00:00:00');
  return Math.round((d - t)/86400000);
}
function tdMatches(doc, query){
  const terms = String(query||'').toLowerCase().split(/\s+/).filter(Boolean);
  if(!terms.length) return true;
  const hay = [doc.name, doc.category, doc.department, doc.notes, doc.fileName, doc.uploadedBy].filter(Boolean).join(' ').toLowerCase();
  return terms.every(t=>hay.includes(t));
}
// the visible list for a firm: live docs only, filtered, grouped by category
function tdVisible(allDocs, firm, query, cat){
  return (allDocs||[]).filter(d=>!d._archived && d.firm===firm && (cat==='all' || d.category===cat) && tdMatches(d, query))
    .sort((a,b)=>{
      const ca = TD_CATEGORIES.indexOf(a.category), cb = TD_CATEGORIES.indexOf(b.category);
      return (ca<0?99:ca)-(cb<0?99:cb) || String(a.name||'').localeCompare(String(b.name||''));
    });
}

// ─── PDF BUILDING (pure; deps injected so it can be tested) ──
// docs: in the order they should appear. deps.getBytes(doc) -> Uint8Array;
// deps.imageToJpeg(bytes, doc) -> {bytes, width, height}.
// Throws an Error naming the document if ANY one can't be included.
async function tdBuildPdf(PDFLib, docs, deps){
  const out = await PDFLib.PDFDocument.create();
  for(const doc of docs){
    const kind = tdKind(doc);
    try{
      if(kind==='other') throw new Error('this is a '+(tdExt(doc.fileName)||'non-PDF')+' file — only PDFs and images can be put into a PDF');
      const bytes = await deps.getBytes(doc);
      if(kind==='pdf'){
        // Encryption is NOT ignored: a locked PDF copied page-by-page would
        // come out as unreadable pages inside a bundle that looks fine, so a
        // locked or damaged PDF is refused by name instead.
        // Everything that can go wrong while reading the file's pages is
        // caught here, so a damaged PDF always gets a plain message rather
        // than a raw technical one — and a PDF with no pages is treated as
        // damaged too.
        let pages;
        try{
          const src = await PDFLib.PDFDocument.load(bytes);
          const idx = src.getPageIndices();
          if(!idx.length) throw new Error('no pages');
          pages = await out.copyPages(src, idx);
        }catch(le){
          const locked = !!(le && ((le.constructor && le.constructor.name==='EncryptedPDFError') || /encrypt/i.test(le.message||'')));
          throw new Error(locked ? 'this PDF is password-protected — open it, save a copy without the password, and upload that instead'
                                 : 'this PDF could not be read — it may be damaged; try re-saving or re-scanning it');
        }
        pages.forEach(p=>out.addPage(p));
      } else {
        const j = await deps.imageToJpeg(bytes, doc);
        const img = await out.embedJpg(j.bytes);
        // A4, turned to landscape for a wide image; the image is scaled to fit inside the margins and centred
        const landscape = j.width > j.height*1.1;
        const pw = landscape ? 841.89 : 595.28, ph = landscape ? 595.28 : 841.89, m = 28;
        const s = Math.min((pw-2*m)/j.width, (ph-2*m)/j.height);
        const w = j.width*s, h = j.height*s;
        const page = out.addPage([pw, ph]);
        page.drawImage(img, {x:(pw-w)/2, y:(ph-h)/2, width:w, height:h});
      }
    }catch(e){
      const err = new Error('"'+(doc.name||doc.fileName||'document')+'": '+(e && e.message ? e.message : e));
      err.tdDoc = doc; err.tdCause = e;
      throw err;
    }
  }
  return await out.save();
}

// ─── BROWSER-ONLY HELPERS ──────────────────────────────
async function tdFetchBytes(doc){
  let res;
  try{ res = await fetch(doc.url, {cache:'no-store'}); }
  catch(e){ const err = new Error('the file could not be read from storage'); err.tdCors = true; throw err; }
  if(!res.ok) throw new Error('storage returned '+res.status+' for this file');
  return new Uint8Array(await res.arrayBuffer());
}
// Draw to a white canvas and re-encode as JPEG. Going through the canvas
// applies a phone photo's rotation (so scans aren't sideways) and handles
// PNG/WebP/GIF too; very large images are scaled down to keep memory sane.
async function tdImageToJpeg(bytes, doc){
  const blob = new Blob([bytes], {type: doc.mime || 'image/jpeg'});
  let bmp;
  try{ bmp = await createImageBitmap(blob, {imageOrientation:'from-image'}); }
  catch(e){
    bmp = await new Promise((res, rej)=>{
      const url = URL.createObjectURL(blob), im = new Image();
      im.onload = ()=>{ URL.revokeObjectURL(url); res(im); };
      im.onerror = ()=>{ URL.revokeObjectURL(url); rej(new Error('this image could not be read')); };
      im.src = url;
    });
  }
  const iw = bmp.width || bmp.naturalWidth, ih = bmp.height || bmp.naturalHeight;
  const k = Math.min(1, 3000/Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw*k)), h = Math.max(1, Math.round(ih*k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h); ctx.drawImage(bmp, 0, 0, w, h);
  const jb = await new Promise(r=>c.toBlob(r, 'image/jpeg', 0.92));
  if(!jb) throw new Error('this image could not be converted');
  return {bytes: new Uint8Array(await jb.arrayBuffer()), width:w, height:h};
}
function tdSaveBlob(data, filename, mime){
  const blob = data instanceof Blob ? data : new Blob([data], {type:mime||'application/octet-stream'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
function tdPdfReady(){
  if(typeof PDFLib==='undefined'){ toast('PDF tools did not load — hard refresh the page (Ctrl+Shift+R) and try again','error'); return false; }
  return true;
}
function tdIsCors(e){ return !!(e && (e.tdCors || (e.tdCause && e.tdCause.tdCors))); }
function tdExplainFailure(e){
  if(tdIsCors(e)){ _tdProbe = 'blocked'; tdOpenCorsHelp(); return 'Storage is not allowing the app to read files yet — see the instructions that just opened.'; }
  return (e && e.message) ? e.message : 'something went wrong';
}

// ─── DATA ──────────────────────────────────────────────
async function loadTenderDocs(){
  if(D.tenderDocs) return D.tenderDocs;
  // a failed load throws and is never cached as "empty"
  let v = await getSetting(TD_KEY, []);
  if(!Array.isArray(v)) v = [];
  D.tenderDocs = v;
  return D.tenderDocs;
}
function saveTenderDocs(){
  const run = async ()=>{
    const merged = await mergeAndSaveSetting(TD_KEY, D.tenderDocs||[], true);
    // adopt documents another session added; never replace what's in memory
    (merged||[]).forEach(m=>{ if(!D.tenderDocs.some(x=>x.id===m.id)) D.tenderDocs.push(m); });
  };
  const p = _tdSaveChain.catch(()=>{}).then(run);
  _tdSaveChain = p;
  return p;
}
function tdDoc(id){ return (D.tenderDocs||[]).find(d=>d.id===id && !d._archived); }

// ─── PAGE ──────────────────────────────────────────────
async function renderTenderDocs(){
  const el = document.getElementById('sec-tenderdocs'); if(!el) return;
  el.innerHTML = '<div class="wrap"><div style="padding:40px;text-align:center;color:var(--text3)">⏳ Loading…</div></div>';
  try{ await loadTenderDocs(); }
  catch(e){
    console.error(e);
    el.innerHTML = '<div class="wrap"><div class="card" style="text-align:center;padding:30px;color:var(--red)">Could not load the document library. Check your connection and reload.</div></div>';
    return;
  }
  _tdDraw();
  tdProbeStorage();
}

function _tdDraw(){
  const el = document.getElementById('sec-tenderdocs'); if(!el) return;
  const firm = TD_FIRMS[_tdFirmIdx];
  el.innerHTML = `<div class="wrap">
    <div class="pg-hdr">
      <div>
        <div class="pg-title">📁 Tender Documents</div>
        <div style="font-size:12px;color:var(--text3)">Certificates, statements, registrations and equipment lists — stored once per firm, ready for every tender.</div>
      </div>
      <button class="btn btn-navy" onclick="tdOpenUpload()">+ Upload to ${tdEsc(firm)}</button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-bottom:14px">
      ${TD_FIRMS.map((f,i)=>{
        const live = (D.tenderDocs||[]).filter(d=>!d._archived && d.firm===f);
        const warn = live.filter(d=>{ const n = tdExpiryDays(d.validTill); return n!==null && n<=30; }).length;
        const on = i===_tdFirmIdx;
        return `<div onclick="tdSelectFirm(${i})" style="cursor:pointer;padding:14px 16px;border-radius:var(--r);border:2px solid ${on?'var(--navy)':'var(--border)'};background:${on?'var(--navy)':'#fff'};color:${on?'#fff':'var(--navy)'};box-shadow:${on?'0 4px 14px rgba(26,39,68,.25)':'none'}">
          <div style="font-size:14px;font-weight:800">${tdEsc(f)}</div>
          <div style="font-size:12px;opacity:.85;margin-top:2px">${live.length} document${live.length!==1?'s':''}${warn?` · <span style="color:${on?'#ffd27a':'var(--amber)'};font-weight:700">⏳ ${warn} expiring / expired</span>`:''}</div>
        </div>`;
      }).join('')}
    </div>

    <div id="td-banner"></div>

    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input type="search" id="td-search" value="${tdEsc(_tdSearch)}" placeholder="Search name, notes, department…" oninput="tdSetSearch(this.value)" style="flex:1;min-width:200px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--rs);font-size:13px">
        <select onchange="tdSetCat(this.value)" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:13px">
          <option value="all">All categories</option>
          ${TD_CATEGORIES.map(c=>`<option value="${tdEsc(c)}" ${_tdCat===c?'selected':''}>${tdEsc(c)}</option>`).join('')}
        </select>
      </div>
      <div id="td-selbar"></div>
      <div id="td-list" style="margin-top:12px"></div>
    </div>
  </div>`;
  tdRenderList(); tdRenderBanner();
}

function tdSelectFirm(i){ _tdFirmIdx = i; _tdSel = []; _tdDraw(); }
function tdSetSearch(v){ _tdSearch = v; tdRenderList(); }
function tdSetCat(v){ _tdCat = v; tdRenderList(); }

function tdRenderList(){
  const listEl = document.getElementById('td-list'); if(!listEl) return;
  const firm = TD_FIRMS[_tdFirmIdx];
  const docs = tdVisible(D.tenderDocs, firm, _tdSearch, _tdCat);
  _tdSel = _tdSel.filter(id=>docs.some(d=>d.id===id));   // anything filtered out can't stay ticked
  tdRenderSelBar();
  if(!docs.length){
    const any = (D.tenderDocs||[]).some(d=>!d._archived && d.firm===firm);
    listEl.innerHTML = `<div style="text-align:center;color:var(--text3);padding:26px 10px;font-size:13px">${any?'No documents match your search.':'No documents stored for '+tdEsc(firm)+' yet — use “+ Upload” to add the first one.'}</div>`;
    return;
  }
  const allTicked = docs.every(d=>_tdSel.includes(d.id));
  let lastCat = null, rows = '';
  docs.forEach(d=>{
    if(d.category!==lastCat){
      lastCat = d.category;
      rows += `<tr><td colspan="6" style="background:var(--surface2);padding:6px 10px;font-weight:700;color:var(--navy);font-size:12px">${tdEsc(d.category||'Other')} <span style="font-weight:400;color:var(--text3)">(${docs.filter(x=>x.category===d.category).length})</span></td></tr>`;
    }
    const kind = tdKind(d), order = _tdSel.indexOf(d.id);
    const nd = tdExpiryDays(d.validTill);
    const valid = d.validTill ? (nd<0 ? `<span style="color:var(--red);font-weight:700">Expired ${tdEsc(fmtDate(d.validTill))}</span>`
                 : nd<=30 ? `<span style="color:var(--amber);font-weight:700">${nd===0?'Expires today':'Expires in '+nd+' day'+(nd!==1?'s':'')}</span><div style="font-size:10px;color:var(--text3)">${tdEsc(fmtDate(d.validTill))}</div>`
                 : `<span style="color:var(--text2)">${tdEsc(fmtDate(d.validTill))}</span>`) : '<span style="color:var(--text3)">—</span>';
    const icon = kind==='pdf'?'📕':kind==='image'?'🖼️':'📄';
    rows += `<tr style="border-bottom:1px solid var(--border);${order>=0?'background:#eef2fb':''}">
      <td style="padding:8px;width:46px;white-space:nowrap"><input type="checkbox" ${order>=0?'checked':''} onchange="tdToggle('${d.id}')" style="width:16px;height:16px;cursor:pointer;vertical-align:middle">${order>=0?`<span style="display:inline-block;margin-left:4px;background:var(--navy);color:#fff;border-radius:9px;min-width:18px;text-align:center;font-size:10px;font-weight:700;padding:1px 4px">${order+1}</span>`:''}</td>
      <td style="padding:8px;min-width:240px">
        <div style="font-weight:700;color:var(--navy);font-size:13px">${icon} <a href="${tdEsc(d.url)}" target="_blank" rel="noopener" style="color:var(--navy)">${tdEsc(d.name)}</a></div>
        <div style="font-size:10px;color:var(--text3)">${tdEsc(d.fileName||'')} · ${tdFmtSize(d.size)}</div>
        ${d.notes?`<div style="font-size:12px;color:var(--text2);margin-top:4px;background:#fffdf3;border-left:3px solid var(--gold);padding:4px 8px;white-space:pre-wrap">${tdEsc(d.notes)}</div>`:''}
      </td>
      <td style="padding:8px;font-size:12px">${d.department?tdEsc(d.department):'<span style="color:var(--text3)">—</span>'}</td>
      <td style="padding:8px;font-size:12px;white-space:nowrap">${valid}</td>
      <td style="padding:8px;font-size:11px;color:var(--text3);white-space:nowrap">${tdEsc(fmtDate(d.uploadedAt))}<div>${tdEsc(d.uploadedBy||'')}</div></td>
      <td style="padding:8px;white-space:nowrap">
        <button class="btn btn-sm" onclick="tdView('${d.id}')" title="Open in a new tab">👁 View</button>
        ${kind==='pdf'||kind==='image'?`<button class="btn btn-sm" onclick="tdDownloadPdf('${d.id}')" title="Download as a PDF">⬇ PDF</button>`:`<button class="btn btn-sm" onclick="tdView('${d.id}')" title="Open / download the original file">⬇ File</button>`}
        ${kind==='image'?`<button class="btn btn-sm" onclick="tdDownloadImage('${d.id}')" title="Download the image">🖼 Image</button>`:''}
        <button class="btn btn-sm" onclick="tdOpenEdit('${d.id}')" title="Edit details">✏️</button>
        ${CU&&CU.isSuperAdmin?`<button class="btn btn-sm" style="color:var(--red);border-color:var(--red)" onclick="tdDelete('${d.id}')" title="Delete">🗑️</button>`:''}
      </td>
    </tr>`;
  });
  listEl.innerHTML = `<div class="tbl-wrap"><table style="width:100%;border-collapse:collapse;min-width:820px">
    <thead><tr>
      <th style="width:46px"><input type="checkbox" ${allTicked?'checked':''} onchange="tdToggleAll(this.checked)" title="Tick all shown" style="width:16px;height:16px;cursor:pointer"></th>
      <th style="text-align:left">Document &amp; notes</th><th style="text-align:left">Used for</th><th style="text-align:left">Valid till</th><th style="text-align:left">Added</th><th></th>
    </tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function tdToggle(id){ const i=_tdSel.indexOf(id); if(i>=0) _tdSel.splice(i,1); else _tdSel.push(id); tdRenderList(); }
function tdToggleAll(on){
  const docs = tdVisible(D.tenderDocs, TD_FIRMS[_tdFirmIdx], _tdSearch, _tdCat);
  if(on) docs.forEach(d=>{ if(!_tdSel.includes(d.id)) _tdSel.push(d.id); }); else _tdSel = _tdSel.filter(id=>!docs.some(d=>d.id===id));
  tdRenderList();
}
function tdRenderSelBar(){
  const el = document.getElementById('td-selbar'); if(!el) return;
  if(!_tdSel.length){ el.innerHTML = ''; return; }
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-top:12px;padding:10px 12px;background:#eef2fb;border:1.5px solid var(--navy);border-radius:var(--rs)">
    <div style="font-size:12px;font-weight:700;color:var(--navy)">☑️ ${_tdSel.length} selected <span style="font-weight:400;color:var(--text3)">— merged in the order ticked (the numbers on the left)</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-sm" onclick="tdClearSel()">Clear</button>
      <button class="btn btn-sm" onclick="tdDownloadEach()">⬇ Each as its own PDF</button>
      <button class="btn btn-sm btn-navy" onclick="tdMerge()">📎 Merge into one PDF</button>
    </div>
  </div>`;
}
function tdClearSel(){ _tdSel = []; tdRenderList(); }

// ─── VIEW / DOWNLOAD ───────────────────────────────────
function tdView(id){ const d = tdDoc(id); if(d) window.open(d.url, '_blank', 'noopener'); }

async function tdDocToPdfBytes(d){
  // A PDF is returned exactly as stored; an image is converted to a one-page PDF
  if(tdKind(d)==='pdf') return await tdFetchBytes(d);
  return await tdBuildPdf(PDFLib, [d], {getBytes:tdFetchBytes, imageToJpeg:tdImageToJpeg});
}
async function tdDownloadPdf(id){
  const d = tdDoc(id); if(!d || _tdBusy) return;
  if(tdKind(d)==='other'){ tdView(id); return; }
  if(tdKind(d)==='image' && !tdPdfReady()) return;
  _tdBusy = true; toast('Preparing PDF…','ok',1500);
  try{
    const bytes = await tdDocToPdfBytes(d);
    tdSaveBlob(bytes, tdSafeName(d.firm+' - '+d.name)+'.pdf', 'application/pdf');
  }catch(e){
    console.error(e);
    if(tdKind(d)==='pdf' && tdIsCors(e)){ window.open(d.url,'_blank','noopener'); toast('Opened in a new tab — save it from there. (Direct download needs the one-time storage setting.)','ok',5000); }
    else toast('Could not make the PDF — '+tdExplainFailure(e),'error',6000);
  }finally{ _tdBusy = false; }
}
async function tdDownloadImage(id){
  const d = tdDoc(id); if(!d || _tdBusy) return;
  _tdBusy = true;
  try{
    const bytes = await tdFetchBytes(d);
    const ext = tdExt(d.fileName) || 'jpg';
    tdSaveBlob(bytes, tdSafeName(d.firm+' - '+d.name)+'.'+ext, d.mime||'image/jpeg');
  }catch(e){
    console.error(e);
    window.open(d.url,'_blank','noopener'); toast('Opened in a new tab — save the image from there.','ok',4000);
  }finally{ _tdBusy = false; }
}
function _tdSelDocs(){ return _tdSel.map(tdDoc).filter(Boolean); }

async function tdMerge(){
  const docs = _tdSelDocs(); if(!docs.length || _tdBusy) return;
  if(!tdPdfReady()) return;
  _tdBusy = true; toast('Building one PDF from '+docs.length+' document'+(docs.length!==1?'s':'')+'…','ok',2500);
  try{
    const bytes = await tdBuildPdf(PDFLib, docs, {getBytes:tdFetchBytes, imageToJpeg:tdImageToJpeg});
    tdSaveBlob(bytes, tdSafeName(TD_FIRMS[_tdFirmIdx]+' - Tender documents ('+docs.length+')')+'.pdf', 'application/pdf');
    toast('✓ Merged PDF downloaded — '+docs.length+' document'+(docs.length!==1?'s':''),'ok');
  }catch(e){
    console.error(e);
    toast('Nothing was downloaded. '+tdExplainFailure(e),'error',8000);
  }finally{ _tdBusy = false; }
}
async function tdDownloadEach(){
  const docs = _tdSelDocs(); if(!docs.length || _tdBusy) return;
  if(docs.some(d=>tdKind(d)==='image') && !tdPdfReady()) return;
  _tdBusy = true;
  let done = 0; const failed = [];
  try{
    for(const d of docs){
      try{
        if(tdKind(d)==='other') throw new Error('not a PDF or image');
        toast('Downloading '+(done+1)+' of '+docs.length+'…','ok',1200);
        const bytes = await tdDocToPdfBytes(d);
        tdSaveBlob(bytes, tdSafeName(d.firm+' - '+d.name)+'.pdf', 'application/pdf');
        done++;
        await new Promise(r=>setTimeout(r, 450));   // lets the browser accept several downloads in a row
      }catch(e){
        if(tdIsCors(e)){ tdExplainFailure(e); failed.push(d.name+' (storage not readable)'); break; }
        failed.push(d.name+' ('+(e.message||'failed')+')');
      }
    }
  } finally { _tdBusy = false; }
  if(failed.length) toast('✓ '+done+' downloaded. Not downloaded: '+failed.join('; '),'error',9000);
  else toast('✓ '+done+' PDF'+(done!==1?'s':'')+' downloaded. (If your browser asks to allow multiple downloads, choose Allow.)','ok',5000);
}

// ─── STORAGE CHECK + ONE-TIME SETUP HELP ───────────────
async function tdProbeStorage(){
  if(_tdProbe!=='unknown') { tdRenderBanner(); return; }
  const sample = (D.tenderDocs||[]).find(d=>!d._archived && d.url);
  if(!sample) return;                     // nothing stored yet — nothing to test against
  try{ await fetch(sample.url, {method:'HEAD', cache:'no-store'}); _tdProbe = 'ok'; }
  catch(e){ _tdProbe = (typeof navigator!=='undefined' && navigator.onLine===false) ? 'unknown' : 'blocked'; }
  tdRenderBanner();
}
function tdRenderBanner(){
  const el = document.getElementById('td-banner'); if(!el) return;
  el.innerHTML = _tdProbe==='blocked'
    ? `<div style="background:#fff8ec;border:1px solid var(--gold);border-radius:var(--rs);padding:10px 14px;margin-bottom:14px;font-size:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <span>⚠️ <strong>Merging and image-to-PDF need a one-time storage setting.</strong> Uploading, viewing and opening files work already.</span>
        <button class="btn btn-sm btn-navy" onclick="tdOpenCorsHelp()">How to fix</button></div>`
    : '';
}
function tdOpenCorsHelp(){
  let modal = document.getElementById('modal-td-cors');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-td-cors'; document.body.appendChild(modal); }
  modal.innerHTML = `<div class="mbox" style="max-width:560px">
    <div class="mhdr"><h2>One-time storage setting</h2><button class="mx" onclick="CM('modal-td-cors')">✕</button></div>
    <div style="font-size:13px;color:var(--text2);line-height:1.55">
      To merge documents or turn an image into a PDF, the app has to read the stored file. Cloudflare blocks that until you allow it — a single setting, done once:
      <ol style="margin:10px 0 10px 18px;padding:0">
        <li>Cloudflare dashboard → <strong>R2</strong> → the bucket <strong>rsr-documents</strong></li>
        <li><strong>Settings</strong> → <strong>CORS Policy</strong> → <strong>Add CORS policy</strong> (JSON tab)</li>
        <li>Paste this, save, then reload this page:</li>
      </ol>
      <textarea readonly onclick="this.select()" style="width:100%;height:150px;font-family:monospace;font-size:12px;padding:8px;border:1px solid var(--border);border-radius:var(--rs)">${tdEsc(TD_CORS_JSON)}</textarea>
      <div style="font-size:11px;color:var(--text3);margin-top:6px">It only lets this app (and your local test address) read files — it doesn't make anything public that wasn't already.</div>
    </div>
    <div style="text-align:right;margin-top:12px"><button class="btn btn-navy" onclick="CM('modal-td-cors')">Close</button></div>
  </div>`;
  modal.classList.add('open');
}

// ─── UPLOAD / EDIT ─────────────────────────────────────
function tdDeptList(){
  const s = new Set(TD_DEPT_SUGGEST);
  (D.tenderDocs||[]).forEach(d=>{ if(d.department) s.add(d.department); });
  return [...s];
}
function tdOpenUpload(){ _tdOpenForm(null); }
function tdOpenEdit(id){ const d = tdDoc(id); if(d) _tdOpenForm(d); }

function _tdOpenForm(d){
  const firm = d ? d.firm : TD_FIRMS[_tdFirmIdx];
  let modal = document.getElementById('modal-td-form');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-td-form'; document.body.appendChild(modal); }
  modal.innerHTML = `<div class="mbox" style="max-width:500px">
    <div class="mhdr"><h2>${d?'✏️ Edit document':'+ Upload document'}</h2><button class="mx" onclick="CM('modal-td-form')">✕</button></div>
    <div class="fg"><label>Firm</label><select id="tdf-firm">${TD_FIRMS.map(f=>`<option ${f===firm?'selected':''}>${tdEsc(f)}</option>`).join('')}</select></div>
    ${d ? `<div style="font-size:12px;color:var(--text3);margin:-4px 0 10px">File: ${tdEsc(d.fileName||'')} (${tdFmtSize(d.size)}) — to replace the file itself, delete this entry and upload again.</div>`
        : `<div class="fg"><label>File <span style="font-weight:400;color:var(--text3)">(PDF, photo or scan — up to 25 MB)</span></label><input type="file" id="tdf-file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onchange="tdFileChosen(this)"></div>`}
    <div class="fg"><label>What is this document?</label><input type="text" id="tdf-name" value="${d?tdEsc(d.name):''}" placeholder="e.g. B.Tech certificate — K. Ramesh (Civil Engineer)"></div>
    <div class="fg"><label>Category</label><select id="tdf-cat">${TD_CATEGORIES.map(c=>`<option ${d&&d.category===c?'selected':''}>${tdEsc(c)}</option>`).join('')}</select></div>
    <div class="fg"><label>Which department / used for <span style="font-weight:400;color:var(--text3)">(optional)</span></label><input type="text" id="tdf-dept" list="tdf-dept-list" value="${d?tdEsc(d.department||''):''}" placeholder="e.g. All departments, or GVMC only"><datalist id="tdf-dept-list">${tdDeptList().map(x=>`<option value="${tdEsc(x)}">`).join('')}</datalist></div>
    <div class="fg"><label>Valid till <span style="font-weight:400;color:var(--text3)">(optional — for certificates that expire)</span></label><input type="date" id="tdf-valid" value="${d?tdEsc(d.validTill||''):''}"></div>
    <div class="fg"><label>Notes <span style="font-weight:400;color:var(--text3)">(shown in the list, so you needn't open the file)</span></label><textarea id="tdf-notes" rows="3" placeholder="e.g. Reusable for all departments. Signed copy. Updated Mar 2026.">${d?tdEsc(d.notes||''):''}</textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn" onclick="CM('modal-td-form')">Cancel</button>
      <button class="btn btn-navy" id="tdf-save" onclick="tdSaveForm(${d?`'${d.id}'`:'null'})">${d?'✓ Save':'⬆ Upload'}</button>
    </div>
  </div>`;
  modal.classList.add('open');
}
function tdFileChosen(inp){
  const f = inp.files && inp.files[0]; const nm = document.getElementById('tdf-name');
  if(f && nm && !nm.value.trim()) nm.value = f.name.replace(/\.[^.]+$/,'').replace(/[_]+/g,' ');
}

async function tdSaveForm(editId){
  const val = id => (document.getElementById(id)?.value||'').trim();
  const firm = val('tdf-firm'), name = val('tdf-name'), category = val('tdf-cat'), department = val('tdf-dept'), validTill = val('tdf-valid'), notes = val('tdf-notes');
  if(!name){ toast('Enter what this document is','error'); return; }
  try{ await loadTenderDocs(); }catch(e){ toast('Could not load the library — reload and try again','error'); return; }
  const btn = document.getElementById('tdf-save');

  if(editId){
    const d = tdDoc(editId); if(!d){ toast('That document no longer exists','error'); return; }
    const backup = {...d};
    Object.assign(d, {firm, name, category, department, validTill, notes, editedBy:CU.name, editedAt:new Date().toISOString()});
    try{
      await saveTenderDocs();
      CM('modal-td-form'); _tdFirmIdx = Math.max(0, TD_FIRMS.indexOf(d.firm)); _tdDraw(); toast('✓ Saved','ok');
    }catch(e){ console.error(e); Object.keys(d).forEach(k=>delete d[k]); Object.assign(d, backup); toast('Save failed — that change was not saved','error'); }
    return;
  }

  const file = document.getElementById('tdf-file')?.files?.[0];
  if(!file){ toast('Choose a file to upload','error'); return; }
  if(file.size > TD_MAX_BYTES){ toast('That file is '+tdFmtSize(file.size)+' — the limit is 25 MB','error'); return; }
  if(btn){ btn.disabled = true; btn.textContent = 'Uploading…'; }
  try{
    const key = 'firmdocs/'+tdSlug(firm)+'/'+Date.now()+'_'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const url = await r2UploadViaWorker(file, R2_DOCS_BUCKET, key);
    const rec = { id:'td_'+uid(), firm, name, category, department, notes, validTill, url, key,
      mime:file.type||'', fileName:file.name, size:file.size, uploadedBy:CU.name, uploadedAt:new Date().toISOString() };
    if(!D.tenderDocs) D.tenderDocs = [];
    D.tenderDocs.push(rec);
    try{
      await saveTenderDocs();
    }catch(e){
      D.tenderDocs = D.tenderDocs.filter(x=>x.id!==rec.id);
      throw new Error('the file uploaded but its details could not be saved — try again');
    }
    logActivity({category:'system', action:'tender_doc_uploaded', description:CU.name+' uploaded "'+name.substring(0,50)+'" to '+firm+' tender documents'});
    CM('modal-td-form'); _tdFirmIdx = Math.max(0, TD_FIRMS.indexOf(firm)); _tdProbe = 'unknown'; _tdDraw(); tdProbeStorage();
    toast('✓ Uploaded','ok');
  }catch(e){
    console.error(e);
    toast('Upload failed — '+(e.message||'check your connection'),'error',6000);
    if(btn){ btn.disabled = false; btn.textContent = '⬆ Upload'; }
  }
}

async function tdDelete(id){
  if(!CU || !CU.isSuperAdmin){ toast('Only Super Admin can delete documents','error'); return; }
  const d = tdDoc(id); if(!d) return;
  const ok = await showConfirm({title:'Delete this document?', message:'"'+tdEsc(d.name)+'" will be removed from '+tdEsc(d.firm)+'\'s library. The file itself is kept in storage.', confirmLabel:'Yes, delete'});
  if(!ok) return;
  try{ await loadTenderDocs(); }catch(e){ toast('Could not load — reload and try again','error'); return; }
  d._archived = true; d._archivedAt = new Date().toISOString(); d._archivedBy = CU.name;
  _tdSel = _tdSel.filter(x=>x!==id);
  try{
    await saveTenderDocs();
    logActivity({category:'system', action:'tender_doc_deleted', description:CU.name+' deleted tender document "'+(d.name||'').substring(0,50)+'" ('+d.firm+')'});
    _tdDraw(); toast('✓ Deleted','ok');
  }catch(e){
    console.error(e); delete d._archived; delete d._archivedAt; delete d._archivedBy; toast('Delete failed — try again','error');
  }
}
