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
  // which pages: pos.pages = 'all' | [numbers] ; otherwise the single page in pos.page
  let idx;
  if(pos.pages==='all') idx = pages.map((_,i)=>i);
  else if(Array.isArray(pos.pages) && pos.pages.length) idx = [...new Set(pos.pages.map(n=>parseInt(n,10)).filter(n=>n>=1 && n<=pages.length).map(n=>n-1))].sort((x,y)=>x-y);
  else idx = [pos.page==='last' ? pages.length-1 : Math.min(Math.max(1,parseInt(pos.page,10)||1), pages.length)-1];
  if(!idx.length) throw new Error('none of the chosen pages exist in this PDF');
  const k = ST_WIDTH_CM.address/ST_WIDTH_CM.stamp;
  const imgMain = res.main ? await doc.embedPng(res.main.bytes) : null;
  const imgAddr = res.addr ? await doc.embedPng(res.addr.bytes) : null;
  const sep = pos.ax!=null && isFinite(pos.ax) && pos.ay!=null && isFinite(pos.ay);      // stamp and address placed on their own
  for(const pi of idx){
    const page = pages[pi];
    const box = page.getCropBox ? page.getCropBox() : {x:0,y:0,width:page.getWidth(),height:page.getHeight()};
    const W = box.width, H = box.height, r = ((page.getRotation().angle%360)+360)%360;
    const Wd = (r===90||r===270) ? H : W, Hd = (r===90||r===270) ? W : H;     // the page as seen
    const put = (img, u, v, wd, iw, ih)=>{                                    // u,v = top-left as seen; wd = width as seen
      const ht = wd*ih/iw, vb = v+ht; let X, Y;
      if(r===0){ X=u; Y=Hd-vb; } else if(r===90){ X=vb; Y=u; } else if(r===180){ X=Wd-u; Y=vb; } else { X=Hd-vb; Y=Wd-u; }
      page.drawImage(img, {x:box.x+X, y:box.y+Y, width:wd, height:ht, rotate:L.degrees(r)});
      return ht;
    };
    if(sep){
      if(imgMain) put(imgMain, pos.fx*Wd, pos.fy*Hd, pos.fw*Wd, res.main.w, res.main.h);
      if(imgAddr) put(imgAddr, pos.ax*Wd, pos.ay*Hd, (pos.aw>0?pos.aw:pos.fw*k)*Wd, res.addr.w, res.addr.h);
    } else {
      // older remembered places: the address stamp sits right below the stamp
      const items = [];
      if(imgMain) items.push({img:imgMain, w:res.main.w, h:res.main.h, k:1});
      if(imgAddr) items.push({img:imgAddr, w:res.addr.w, h:res.addr.h, k});
      const mainW = pos.fw*Wd, widths = items.map(it=>mainW*it.k), groupW = Math.max(...widths);
      let v = pos.fy*Hd; const u0 = pos.fx*Wd;
      items.forEach((it,i)=>{ const ht = put(it.img, u0+(groupW-widths[i])/2, v, widths[i], it.w, it.h); v += ht + 0.012*Hd; });
    }
  }
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
          <div id="cs-wrap" style="position:relative;display:inline-block;max-width:100%;border:1px solid var(--border);background:#fff;touch-action:none;user-select:none"><canvas id="cs-cv" style="display:block;max-width:100%"></canvas><div id="cs-st" style="position:absolute;cursor:move;outline:2px dashed #3b6fd4;outline-offset:1px;display:none"></div><div id="cs-ad" style="position:absolute;cursor:move;outline:2px dashed #d4803b;outline-offset:1px;display:none"></div></div>
          <div id="cs-msg" style="font-size:12px;color:var(--text3);margin-top:6px">Loading the certificate…</div>
        </div>
        <div style="flex:0 0 250px;min-width:230px">
          <div id="cs-pick">${stPickerHTML('cs', key, 'csChoose()', {variant:pos.variant, address:pos.address}).replace('Goes at the signing place at the end of the letter. Upload','Upload')}</div>
          <div class="fg"><label>Stamp &amp; sign size</label><input type="range" id="cs-size" min="8" max="45" value="${Math.round(pos.fw*100)}" style="width:100%"></div>
          <div class="fg" id="cs-asz" style="display:none"><label>Address stamp size</label><input type="range" id="cs-asize" min="8" max="60" value="30" style="width:100%"><div style="font-size:11px;color:var(--text3)">The address stamp (orange frame) moves on its own — drag it anywhere.</div></div>
          <div class="fg"><label>Put it on</label>
            <div style="display:flex;flex-direction:column;gap:3px;font-size:12px;text-transform:none;letter-spacing:0;font-weight:600">
              <label style="display:flex;gap:6px;align-items:center;text-transform:none;letter-spacing:0;font-weight:600"><input type="radio" name="cs-pm" value="one" checked> Only this page</label>
              <label style="display:flex;gap:6px;align-items:center;text-transform:none;letter-spacing:0;font-weight:600"><input type="radio" name="cs-pm" value="all"> All pages (<span id="cs-npa">1</span>)</label>
              <label style="display:flex;gap:6px;align-items:center;text-transform:none;letter-spacing:0;font-weight:600"><input type="radio" name="cs-pm" value="list"> These pages: <input id="cs-pl" placeholder="e.g. 1,3-4" style="width:90px;padding:3px 6px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px"></label></div></div>
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
    // the stamp and the address stamp on the page — each its own draggable piece
    const stEl = $('cs-st'), adEl = $('cs-ad'), K = ST_WIDTH_CM.address/ST_WIDTH_CM.stamp;
    const getPages = ()=>{
      const mode = (document.querySelector('input[name="cs-pm"]:checked')||{}).value;
      if(mode==='all') return 'all';
      if(mode==='list'){
        const out = new Set(); const txt = ($('cs-pl').value||'').trim(); if(!txt) return null;
        for(const part of txt.split(/[,\s]+/).filter(Boolean)){
          const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(part); if(!m) return null;
          let a = Number(m[1]), b = m[2]?Number(m[2]):a; if(a>b){ const t=a; a=b; b=t; }
          if(a<1 || b>nPages) return null; for(let i=a;i<=b;i++) out.add(i);
        }
        return [...out].sort((x,y)=>x-y);
      }
      return undefined;
    };
    const onThisPage = ()=>{ const g = getPages(); return g==='all' || (Array.isArray(g) ? g.includes(cur) : true); };
    // first time the address stamp is placed on its own, start where it used to sit (below the stamp)
    const ensureSep = ()=>{
      if(!pos.address || !res || !res.addr || (pos.ax!=null && isFinite(pos.ax))) return;
      const cv = $('cs-cv'); if(!cv.clientHeight) return;
      const asp = cv.clientWidth/cv.clientHeight, groupW = Math.max(res.main?pos.fw:0, pos.fw*K);
      const htMain = res.main ? pos.fw*asp*res.main.h/res.main.w : 0;
      pos.aw = pos.fw*K;
      pos.ax = pos.fx + (groupW-pos.aw)/2; pos.ay = pos.fy + (res.main ? htMain + 0.012 : 0);
      if(res.main) pos.fx = pos.fx + (groupW-pos.fw)/2;
      clampAll();
    };
    const drawStamp = ()=>{
      const show = res && onThisPage();
      ensureSep();
      stEl.style.display = (show && res.main) ? 'block' : 'none';
      adEl.style.display = (show && res.addr && pos.address) ? 'block' : 'none';
      $('cs-asz').style.display = (res && res.addr && pos.address) ? 'block' : 'none';
      if(res && res.main){ stEl.style.width = (pos.fw*100)+'%'; stEl.style.left = (pos.fx*100)+'%'; stEl.style.top = (pos.fy*100)+'%'; stEl.innerHTML = `<img src="${res.main.dataUrl}" draggable="false" style="display:block;width:100%;pointer-events:none">`; }
      if(res && res.addr && pos.ax!=null){ adEl.style.width = (pos.aw*100)+'%'; adEl.style.left = (pos.ax*100)+'%'; adEl.style.top = (pos.ay*100)+'%'; adEl.innerHTML = `<img src="${res.addr.dataUrl}" draggable="false" style="display:block;width:100%;pointer-events:none">`; $('cs-asize').value = Math.round(pos.aw*100); }
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
      $('cs-pg').textContent = n; $('cs-np').textContent = nPages; $('cs-npa').textContent = nPages; cur = n;
      pos.page = (n===nPages) ? 'last' : n;
      drawStamp();
    };
    let cur = 1;
    $('cs-prev').onclick = ()=>showPage(cur-1); $('cs-next').onclick = ()=>showPage(cur+1); $('cs-last').onclick = ()=>showPage(nPages);
    document.querySelectorAll('input[name="cs-pm"]').forEach(r=>r.onchange = drawStamp);
    $('cs-pl').oninput = ()=>{ document.querySelector('input[name="cs-pm"][value="list"]').checked = true; drawStamp(); };
    const clampOne = (el, fxk, fyk, wk)=>{
      const cv = $('cs-cv'), gh = (el.offsetHeight||0)/(cv.clientHeight||1);
      pos[fxk] = Math.min(Math.max(0,pos[fxk]), Math.max(0,1-pos[wk])); pos[fyk] = Math.min(Math.max(0,pos[fyk]), Math.max(0,1-gh));
    };
    const clampAll = ()=>{ if(res&&res.main) clampOne(stEl,'fx','fy','fw'); if(res&&res.addr&&pos.ax!=null) clampOne(adEl,'ax','ay','aw'); };
    $('cs-size').oninput = e=>{ pos.fw = Number(e.target.value)/100; clampAll(); drawStamp(); };
    $('cs-asize').oninput = e=>{ pos.aw = Number(e.target.value)/100; clampAll(); drawStamp(); };
    // dragging (each piece on its own)
    const dragger = (el, fxk, fyk, wk)=>{
      let drag = null;
      el.addEventListener('pointerdown', e=>{ const cv=$('cs-cv').getBoundingClientRect(); drag = {x:e.clientX, y:e.clientY, fx:pos[fxk], fy:pos[fyk], w:cv.width, h:cv.height}; el.setPointerCapture(e.pointerId); e.preventDefault(); });
      el.addEventListener('pointermove', e=>{ if(!drag) return; pos[fxk] = drag.fx + (e.clientX-drag.x)/drag.w; pos[fyk] = drag.fy + (e.clientY-drag.y)/drag.h; clampOne(el,fxk,fyk,wk); drawStamp(); });
      const end = ()=>{ drag = null; }; el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    };
    dragger(stEl,'fx','fy','fw'); dragger(adEl,'ax','ay','aw');
    // go
    $('cs-ok').onclick = async ()=>{
      const c = stChoice('cs'); pos.variant = c.variant; pos.address = c.address;
      if(!csUsable(pos) || !res || !(res.main||res.addr)){ err('Choose a stamp first (and make sure its picture is uploaded in Settings → Stamps & Signs).'); return; }
      const pg = getPages();
      if(pg===null){ err('Write the pages like 1,3-4 (this PDF has '+nPages+' page'+(nPages!==1?'s':'')+').'); return; }
      const out = {page:pos.page, fx:+pos.fx.toFixed(4), fy:+pos.fy.toFixed(4), fw:+pos.fw.toFixed(4), variant:pos.variant, address:!!pos.address};
      if(pg!==undefined) out.pages = pg;
      if(pos.address && pos.ax!=null){ out.ax = +pos.ax.toFixed(4); out.ay = +pos.ay.toFixed(4); out.aw = +pos.aw.toFixed(4); }
      done({pos:out, remember:!!($('cs-rem')&&$('cs-rem').checked)});
    };
    // open the certificate
    try{
      const lib = await csLoadPdfjs();
      pdf = await lib.getDocument({data: info.bytes.slice()}).promise;
      nPages = pdf.numPages;
      if(pos.pages==='all') document.querySelector('input[name="cs-pm"][value="all"]').checked = true;
      else if(Array.isArray(pos.pages)){ document.querySelector('input[name="cs-pm"][value="list"]').checked = true; $('cs-pl').value = pos.pages.join(','); }
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
