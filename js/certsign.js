// ═══════════════════════════════════════════════════════
// certsign.js — stamp & sign on work-experience certificates (Super Admin only)
//
// A certificate PDF (or photo) is shown; the stamp/sign picture is dragged to the right place (normally the
// last page, where the engineers signed) and a NEW signed PDF is made. The uploaded certificate is never
// changed and the signed copy is not stored — it is made again each time it is downloaded.
//   • The chosen place is remembered per certificate (setting rsr_cert_sign_v1, keyed by the file link), so
//     a certificate that is used again — or shared by two financial years — is one click.
//   • Single: Work Experience → All Records → “✍ Signed copy”.
//   • Bulk: tick “Stamp & sign” beside the download button in Find by Value / Find by Quantity. Certificates
//     with a remembered place are stamped straight away; for the others the preview opens one by one.
//   • Looks the same as printing and signing by hand. It is not a digital signature certificate (DSC).
// ═══════════════════════════════════════════════════════

const CS_KEY = 'rsr_cert_sign_v1';
const CS_DEFAULT = {page:'last', fx:0.66, fy:0.74, fw:0.20, variant:'none', address:false};
let _csOn = false;                 // “Stamp & sign” ticked beside a download button
let _csMap = null;                 // remembered places {certUrl: pos}
let _csPdfjs = null;

function csWanted(){ return stAllowed() && _csOn; }
function csToggleHTML(){
  if(!stAllowed()) return '';
  return `<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--navy);margin-right:10px;cursor:pointer"><input type="checkbox" ${_csOn?'checked':''} onchange="_csOn=this.checked"> ✍ Stamp &amp; sign the certificates <span style="font-size:10px;font-weight:600;color:#92400e;background:#fef3c7;border-radius:6px;padding:1px 6px">Super Admin only</span></label>`;
}

// ─── remembered places ─────────────────────────────────
async function csLoadMap(force){
  if(_csMap && !force) return _csMap;
  let v = null; try{ v = await getSetting(CS_KEY, null); }catch(e){}
  _csMap = (v && typeof v==='object') ? v : {};
  return _csMap;
}
async function csSavePos(url, pos){
  const fresh = await getSetting(CS_KEY, null);
  const m = (fresh && typeof fresh==='object') ? fresh : {};
  m[url] = pos;
  await saveSetting(CS_KEY, m);
  _csMap = m;
}
function csUsable(pos){
  return !!(pos && pos.variant && pos.variant!=='none' && isFinite(pos.fx) && isFinite(pos.fy) && pos.fw>0);
}

// ─── pdf.js (only loaded when a preview is opened) ─────
async function csLoadPdfjs(){
  if(_csPdfjs) return _csPdfjs;
  const base = new URL('js/pdfjs/', document.baseURI).href, v = (typeof APP_VERSION!=='undefined'?APP_VERSION:'1');
  const m = await import(base+'pdf.min.mjs?v='+v);
  m.GlobalWorkerOptions.workerSrc = base+'pdf.worker.min.mjs?v='+v;
  _csPdfjs = m; return m;
}

// ─── the certificate as PDF bytes (a photo becomes one A4 page first) ───
async function csPdfBytes(doc){
  if(doc._pdf) return doc._pdf;
  const kind = (typeof tdKind==='function') ? tdKind(doc) : 'pdf';
  let bytes;
  if(kind==='pdf'){ bytes = await tdFetchBytes(doc); }
  else bytes = await tdBuildPdf(PDFLib, [doc], {getBytes:tdFetchBytes, imageToJpeg:tdImageToJpeg});
  doc._pdf = new Uint8Array(bytes);
  return doc._pdf;
}

// ─── put the stamp on the PDF (pure; res = {main, addr} from stResolve) ───
// pos: {page:'last'|n, fx, fy, fw} — fx/fy = top-left of the stamp block as a fraction of the page as seen,
// fw = the stamp's width as a fraction of the page's width as seen.
async function csStampBytes(pdfBytes, pos, res){
  const L = PDFLib, doc = await L.PDFDocument.load(pdfBytes);
  const pages = doc.getPages(); if(!pages.length) throw new Error('this PDF has no pages');
  const pi = pos.page==='last' ? pages.length-1 : Math.min(Math.max(1,parseInt(pos.page,10)||1), pages.length)-1;
  const page = pages[pi];
  const box = page.getCropBox ? page.getCropBox() : {x:0,y:0,width:page.getWidth(),height:page.getHeight()};
  const W = box.width, H = box.height, r = ((page.getRotation().angle%360)+360)%360;
  const Wd = (r===90||r===270) ? H : W, Hd = (r===90||r===270) ? W : H;     // the page as seen
  const items = [];
  if(res.main) items.push(await doc.embedPng(res.main.bytes).then(img=>({img, w:res.main.w, h:res.main.h, k:1})));
  if(res.addr) items.push(await doc.embedPng(res.addr.bytes).then(img=>({img, w:res.addr.w, h:res.addr.h, k:ST_WIDTH_CM.address/ST_WIDTH_CM.stamp})));
  const mainW = pos.fw*Wd;
  const widths = items.map(it=>mainW*it.k), groupW = Math.max(...widths);
  let v = pos.fy*Hd; const u0 = pos.fx*Wd;
  items.forEach((it,i)=>{
    const wd = widths[i], ht = wd*it.h/it.w, u = u0 + (groupW-wd)/2, vb = v+ht;   // vb = bottom edge as seen
    let X, Y;
    if(r===0){ X=u; Y=Hd-vb; } else if(r===90){ X=vb; Y=u; } else if(r===180){ X=Wd-u; Y=vb; } else { X=Hd-vb; Y=Wd-u; }
    page.drawImage(it.img, {x:box.x+X, y:box.y+Y, width:wd, height:ht, rotate:L.degrees(r)});
    v += ht + 0.012*Hd;
  });
  return await doc.save();
}

// ─── the preview / placement window ────────────────────
// info: {name, bytes, firm, pos, label, canSkip}. Resolves {pos, remember} | 'skip' | null (cancelled).
function csPlace(info){
  return new Promise(async resolve=>{
    const key = lhKeyFor(info.firm);
    const f = ST_FIRMS[key] || ST_FIRMS.rsr;
    let pos = Object.assign({}, CS_DEFAULT, info.pos||{});
    if(!pos.variant || pos.variant==='none') pos.variant = f.signs[0].id;       // a sensible first pick for a new certificate
    let pdf = null, nPages = 1, res = null, rendered = 0;
    try{ await stAvailable(); }catch(e){}
    let m = document.getElementById('cs-modal');
    if(!m){ m = document.createElement('div'); m.className='mov'; m.id='cs-modal'; document.body.appendChild(m); }
    m.innerHTML = `<div class="mbox" style="max-width:920px;width:96vw">
      <div class="mhdr"><h2>✍ Stamp &amp; sign${info.label?' — '+_wlE(info.label):''}</h2><button class="mx" id="cs-x">✕</button></div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:8px">${_wlE(info.name||'Certificate')} · drag the stamp to where it should go (usually next to the engineers’ signatures on the last page).</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
        <div style="flex:1 1 440px;min-width:300px">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;font-size:12px">
            <button class="btn btn-sm" id="cs-prev">◀</button> <span>Page <strong id="cs-pg">1</strong> of <span id="cs-np">1</span></span> <button class="btn btn-sm" id="cs-next">▶</button>
            <button class="btn btn-sm" id="cs-last">Last page</button>
          </div>
          <div id="cs-wrap" style="position:relative;display:inline-block;max-width:100%;border:1px solid var(--border);background:#fff;touch-action:none;user-select:none"><canvas id="cs-cv" style="display:block;max-width:100%"></canvas><div id="cs-st" style="position:absolute;cursor:move;outline:2px dashed #3b6fd4;outline-offset:1px;display:none"></div></div>
          <div id="cs-msg" style="font-size:12px;color:var(--text3);margin-top:6px">Loading the certificate…</div>
        </div>
        <div style="flex:0 0 250px;min-width:230px">
          <div id="cs-pick">${stPickerHTML('cs', key, 'csChoose()', {variant:pos.variant, address:pos.address}).replace('Goes at the signing place at the end of the letter. Upload','Upload')}</div>
          <div class="fg"><label>Size</label><input type="range" id="cs-size" min="8" max="45" value="${Math.round(pos.fw*100)}" style="width:100%"></div>
          ${info.noRemember?'':`<label style="display:flex;gap:8px;align-items:center;font-size:12px;margin:8px 0;text-transform:none;letter-spacing:0;font-weight:600"><input type="checkbox" id="cs-rem" checked> Remember this place for this certificate</label>`}
          <div id="cs-err" style="color:var(--red);font-size:12px;margin-bottom:8px;display:none"></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
            ${info.canSkip?'<button class="btn" id="cs-skip" title="Include this certificate without a stamp">Skip — no stamp</button>':'<button class="btn" id="cs-cancel">Cancel</button>'}
            <button class="btn btn-navy" id="cs-ok">${_wlE(info.okLabel||'Use this place')}</button>
          </div>
          ${info.canSkip?'<div style="text-align:right;margin-top:6px"><button class="btn btn-sm" id="cs-cancel" style="font-size:11px">Cancel the whole download</button></div>':''}
        </div>
      </div></div>`;
    OM('cs-modal');
    const $ = id=>document.getElementById(id);
    const done = v=>{ CM('cs-modal'); try{ if(pdf) pdf.destroy(); }catch(e){} resolve(v); };
    $('cs-x').onclick = ()=>done(null); $('cs-cancel').onclick = ()=>done(null);
    if($('cs-skip')) $('cs-skip').onclick = ()=>done('skip');
    const err = t=>{ $('cs-err').textContent = t||''; $('cs-err').style.display = t?'block':'none'; };
    // the stamp block on the page
    const stEl = $('cs-st');
    const drawStamp = ()=>{
      if(!res || (!res.main && !res.addr)){ stEl.style.display='none'; return; }
      const k = ST_WIDTH_CM.address/ST_WIDTH_CM.stamp, both = res.main && res.addr;
      const gw = pos.fw * (res.addr ? k : 1);
      stEl.style.display = 'block';
      stEl.style.width = (gw*100)+'%';
      stEl.style.left = (pos.fx*100)+'%'; stEl.style.top = (pos.fy*100)+'%';
      stEl.innerHTML = [res.main&&{i:res.main,w:1/(res.addr?k:1)}, res.addr&&{i:res.addr,w:1}].filter(Boolean).map(o=>`<img src="${o.i.dataUrl}" draggable="false" style="display:block;width:${o.w*100}%;margin:0 auto 1.2%;pointer-events:none">`).join('');
    };
    const loadRes = async ()=>{
      err('');
      try{ res = await stResolve(key, {variant:pos.variant, address:pos.address}); }catch(e){ res = null; err(e.message); }
      drawStamp();
    };
    window.csChoose = async ()=>{ const c = stChoice('cs'); pos.variant = c.variant; pos.address = c.address; await loadRes(); };
    const showPage = async n=>{
      if(!pdf) return;
      n = Math.min(Math.max(1,n), nPages); const tok = ++rendered;
      const pg = await pdf.getPage(n), vp1 = pg.getViewport({scale:1});
      const cssW = Math.max(220, Math.min(560, (($('cs-wrap').parentElement.clientWidth)||560), Math.floor(window.innerHeight*0.68*vp1.width/vp1.height)));   // the whole page fits on screen
      const vp = pg.getViewport({scale: (cssW/vp1.width)*Math.min(2, window.devicePixelRatio||1)});
      const cv = $('cs-cv'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height); cv.style.width = cssW+'px'; cv.style.height = Math.round(cssW*vp.height/vp.width)+'px';
      await pg.render({canvasContext:cv.getContext('2d'), canvas:cv, viewport:vp}).promise;
      if(tok!==rendered) return;
      $('cs-pg').textContent = n; $('cs-np').textContent = nPages; cur = n;
      pos.page = (n===nPages) ? 'last' : n;
      drawStamp();
    };
    let cur = 1;
    $('cs-prev').onclick = ()=>showPage(cur-1); $('cs-next').onclick = ()=>showPage(cur+1); $('cs-last').onclick = ()=>showPage(nPages);
    $('cs-size').oninput = e=>{ pos.fw = Number(e.target.value)/100; clampPos(); drawStamp(); };
    // dragging
    const clampPos = ()=>{
      const k = ST_WIDTH_CM.address/ST_WIDTH_CM.stamp, gw = pos.fw*((res&&res.addr)?k:1);
      const cv = $('cs-cv'), gh = (stEl.offsetHeight||0)/(cv.clientHeight||1);
      pos.fx = Math.min(Math.max(0,pos.fx), Math.max(0,1-gw)); pos.fy = Math.min(Math.max(0,pos.fy), Math.max(0,1-gh));
    };
    let drag = null;
    stEl.addEventListener('pointerdown', e=>{ const cv=$('cs-cv').getBoundingClientRect(); drag = {x:e.clientX, y:e.clientY, fx:pos.fx, fy:pos.fy, w:cv.width, h:cv.height}; stEl.setPointerCapture(e.pointerId); e.preventDefault(); });
    stEl.addEventListener('pointermove', e=>{ if(!drag) return; pos.fx = drag.fx + (e.clientX-drag.x)/drag.w; pos.fy = drag.fy + (e.clientY-drag.y)/drag.h; clampPos(); drawStamp(); });
    const end = ()=>{ drag = null; }; stEl.addEventListener('pointerup', end); stEl.addEventListener('pointercancel', end);
    // go
    $('cs-ok').onclick = async ()=>{
      const c = stChoice('cs'); pos.variant = c.variant; pos.address = c.address;
      if(!csUsable(pos) || !res || !(res.main||res.addr)){ err('Choose a stamp first (and make sure its picture is uploaded in Settings → Stamps & Signs).'); return; }
      done({pos:{page:pos.page, fx:+pos.fx.toFixed(4), fy:+pos.fy.toFixed(4), fw:+pos.fw.toFixed(4), variant:pos.variant, address:!!pos.address}, remember:!!($('cs-rem')&&$('cs-rem').checked)});
    };
    // open the certificate
    try{
      const lib = await csLoadPdfjs();
      pdf = await lib.getDocument({data: info.bytes.slice()}).promise;
      nPages = pdf.numPages;
      await loadRes();
      const start = (pos.page==='last' || !pos.page) ? nPages : Math.min(nPages, parseInt(pos.page,10)||nPages);
      await showPage(start);
      $('cs-msg').textContent = 'Drag the stamp; use ◀ ▶ to change page. The uploaded certificate is not changed.';
    }catch(e){
      console.error(e);
      $('cs-msg').textContent = ''; err('The preview could not open this certificate'+(e&&e.message?' — '+e.message:'')+'.');
    }
  });
}

// ─── SINGLE certificate (Excel view button) ────────────
async function csSingle(recId){
  if(!stAllowed()){ toast('Only the Super Admin can stamp & sign','error'); return; }
  if(typeof tdPdfReady==='function' && !tdPdfReady()) return;
  const r = ((D.wexData&&D.wexData.records)||[]).find(x=>x.id===recId); if(!r) return;
  const p = (D.projects||[]).find(pr=>pr.genCode && String(pr.genCode).toUpperCase()===String(r.genCode||'').toUpperCase());
  const cert = (typeof wlCert==='function') ? wlCert(r, p) : (p&&p.documents&&p.documents.wec);
  if(!cert || !cert.url){ toast('This record has no certificate uploaded yet','error'); return; }
  const nm = (p&&p.name) || r.projectName || r.genCode || 'Certificate';
  const doc = {url:cert.url, name:nm+' — work experience certificate', fileName:(typeof tdExt==='function'&&tdExt(cert.name))?cert.name:String(cert.url).split('?')[0], mime:'', firm:r.firm||'RSR Constructions'};
  setBusy(true,'Opening the certificate…');
  try{
    const map = await csLoadMap(); const bytes = await csPdfBytes(doc); setBusy(false);
    const out = await csPlace({name:doc.name, bytes, firm:doc.firm, pos:map[cert.url], okLabel:'Download signed PDF'});
    if(!out) return;
    setBusy(true,'Making the signed copy…');
    const res = await stResolve(lhKeyFor(doc.firm), {variant:out.pos.variant, address:out.pos.address});
    const signed = await csStampBytes(bytes, out.pos, res);
    if(out.remember){ try{ await csSavePos(cert.url, out.pos); }catch(e){ toast('Downloaded, but the place could not be remembered — '+e.message,'error',6000); } }
    tdSaveBlob(signed, tdSafeName(nm+' - work experience certificate (signed)')+'.pdf', 'application/pdf');
    toast('✓ Signed copy downloaded','ok');
    try{ logActivity({category:'system', action:'wex_cert_signed', description:(CU?CU.name:'')+' downloaded a stamped & signed certificate: '+(r.genCode||nm)+' FY '+r.fy}); }catch(e){}
  }catch(e){ console.error(e); toast('Nothing was downloaded. '+((typeof tdExplainFailure==='function')?tdExplainFailure(e):e.message),'error',8000); }
  finally{ setBusy(false); }
}

// ─── BULK (used by Find by Value / Find by Quantity) ───
// docs: [{url,name,fileName,mime,firm,...}] — returns true when every doc is ready (stamped ones carry _bytes
// and a .pdf file name); false when the person cancelled.
async function csPrepare(docs){
  const map = await csLoadMap();
  let n = 0, signed = 0, skipped = 0;
  for(const doc of docs){
    n++;
    let pos = map[doc.url];
    const bytes = await csPdfBytes(doc);
    if(!csUsable(pos)){
      const out = await csPlace({name:doc.name, bytes, firm:doc.firm, pos, label:'certificate '+n+' of '+docs.length, canSkip:true, okLabel:'Use this place'});
      if(!out) return false;
      if(out==='skip'){ skipped++; continue; }
      pos = out.pos;
      if(out.remember){ try{ await csSavePos(doc.url, pos); }catch(e){ console.warn('place not remembered', e); } }
    }
    const res = await stResolve(lhKeyFor(doc.firm), {variant:pos.variant, address:pos.address});
    doc._bytes = await csStampBytes(bytes, pos, res);
    doc.fileName = (tdSafeName(doc.name)||'certificate')+'.pdf';   // it is a PDF now, whatever it was uploaded as
    signed++;
  }
  try{ logActivity({category:'system', action:'wex_cert_signed', description:(CU?CU.name:'')+' stamped & signed '+signed+' certificate(s) in a download'+(skipped?' ('+skipped+' left without stamp)':'')}); }catch(e){}
  return true;
}
