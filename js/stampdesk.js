// ═══════════════════════════════════════════════════════
// stampdesk.js — Tender Documents → 🖊 Stamp & Letterhead
//
// For anything that is not one of the generated statements:
//   • a PDF you upload      → preview, drag the stamp & sign to the right place, download a stamped PDF
//   • a Word file you upload → choose the line the stamp goes after (and/or put it on the firm's letterhead),
//                              download as Word — the content is kept as it is, you can still edit it
//   • text you type or paste → a Word file on the letterhead (plain A4 or digital), with an optional stamp & sign
// Optionally a copy is saved in the firm's Tender Documents library (category “Signed documents”) under a name
// you give. The uploaded file is never changed. Stamp & sign is Super Admin only; letterhead is for everyone.
// PDFs are never put on a letterhead (there may be no free space) — only stamped.
// ═══════════════════════════════════════════════════════

let _sdFirm = 'RSR Constructions';
let _sdFile = null;                  // {name, kind:'pdf'|'docx', bytes:Uint8Array}
let _sdText = '';
let _sdBusy = false;

const _sdE = s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const SD_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const SD_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

async function sdJSZip(){
  if(typeof JSZip!=='undefined') return JSZip;
  await new Promise((ok,bad)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload=ok; s.onerror=()=>bad(new Error('could not load the Word tools — check the internet connection')); document.head.appendChild(s); });
  return JSZip;
}

// ─── the page ──────────────────────────────────────────
function sdDraw(){
  const el = document.getElementById('sec-tenderdocs'); if(!el) return;
  const ok = stAllowed();
  const sec = (t,sub,inner)=>`<div class="card" style="margin-bottom:14px"><div style="font-size:15px;font-weight:800;color:var(--navy)">${t}</div><div style="font-size:12px;color:var(--text3);margin:2px 0 10px">${sub}</div>${inner}</div>`;
  el.innerHTML = `<div class="wrap">${tdTabsHTML()}
    <div class="pg-hdr"><div><div class="pg-title">🖊 Stamp &amp; Letterhead</div>
      <div style="font-size:12px;color:var(--text3)">Any other document that needs the stamp &amp; sign, or the letterhead. Your uploaded file is never changed.</div></div></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">${TD_FIRMS.map(f=>`<div onclick="_sdFirm='${_sdE(f)}';sdDraw()" style="cursor:pointer;padding:10px 16px;border-radius:var(--r);border:2px solid ${f===_sdFirm?'var(--navy)':'var(--border)'};background:${f===_sdFirm?'var(--navy)':'#fff'};color:${f===_sdFirm?'#fff':'var(--navy)'};font-weight:800;font-size:13px">${_sdE(f)}</div>`).join('')}</div>

    ${sec('📄 A document you already have','Upload a PDF (stamp &amp; sign only) or a Word file (stamp &amp; sign and/or letterhead).',`
      <input type="file" id="sd-file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onchange="sdPick(this)" style="margin-bottom:8px">
      <div id="sd-fileinfo" style="font-size:12px;color:var(--text3);margin-bottom:8px">${_sdFile?'Chosen: <b>'+_sdE(_sdFile.name)+'</b>':'No file chosen. Old .doc files: open in Word and Save As .docx first.'}</div>
      <button class="btn btn-sm btn-navy" onclick="sdGo()" ${_sdFile?'':'disabled'} id="sd-go">${_sdFile&&_sdFile.kind==='pdf'?'✍ Place stamp &amp; sign on this PDF':'Continue with this Word file…'}</button>
      ${_sdFile&&_sdFile.kind==='pdf'&&!ok?'<div style="font-size:12px;color:var(--red);margin-top:6px">Stamp &amp; sign on a PDF is for the Super Admin only.</div>':''}`)}

    ${sec('✏️ Type or paste text','Becomes a Word file on the letterhead (or plain A4), with an optional stamp &amp; sign at the end.',`
      <textarea id="sd-text" rows="9" oninput="_sdText=this.value" placeholder="Type or paste the text here…" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--rs);font-family:inherit;font-size:13px">${_sdE(_sdText)}</textarea>
      <div style="margin-top:8px"><button class="btn btn-sm btn-navy" onclick="sdText()">Continue…</button></div>`)}
  </div>`;
}
async function sdPick(inp){
  const f = inp.files && inp.files[0]; if(!f) return;
  const nm = f.name, low = nm.toLowerCase();
  const kind = low.endsWith('.pdf') ? 'pdf' : low.endsWith('.docx') ? 'docx' : '';
  if(!kind){ toast(low.endsWith('.doc') ? 'Old .doc files cannot be used — open it in Word, Save As .docx, then upload that' : 'Choose a PDF or a Word (.docx) file','error',6000); inp.value=''; return; }
  if(f.size > 25*1024*1024){ toast('That file is over 25 MB','error'); inp.value=''; return; }
  _sdFile = {name:nm, kind, bytes:new Uint8Array(await f.arrayBuffer())};
  sdDraw();
}

// ─── dialog (shared) ───────────────────────────────────
// opts: {title, defName, letterhead:'none'|'choose'|'plain-or-digital', stamp:true/false, ask}
async function sdDialog(o){
  const key = lhKeyFor(_sdFirm), lhName = (LH_SETS[key]&&LH_SETS[key].name)||_sdFirm;
  let stHtml = '';
  if(o.stamp && stAllowed()){ try{ await stAvailable(); }catch(e){} stHtml = stPickerHTML('sdd', key, '', {variant:'none', address:false}); }
  const lh = o.lh ? `<div class="fg" style="margin:10px 0"><label>Page</label><div style="display:flex;flex-direction:column;gap:4px;font-size:13px">
      ${o.lh.map((c,i)=>`<label style="display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0;font-weight:600"><input type="radio" name="sdd-lh" value="${c[0]}" ${i===0?'checked':''}> ${_sdE(c[1].replace('{LH}',lhName))}</label>`).join('')}</div></div>` : '';
  let cap = null;
  const pr = tlModal(_sdE(o.title),
    `<div class="fg" style="margin:0 0 8px"><label>File name</label><input id="sdd-name" value="${_sdE(o.defName)}" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs)"></div>
     ${lh}${stHtml}
     <div class="fg" style="margin:10px 0 0"><label>Also save a copy in ${_sdE(_sdFirm)}’s library <span style="font-weight:400;color:var(--text3)">(optional)</span></label>
       <input id="sdd-save" placeholder="Leave empty to only download — or type a name to keep it" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs)">
       <div style="font-size:11px;color:var(--text3);margin-top:3px">Kept in Library → category “Signed documents”.</div></div>`,
    [{label:'Cancel', value:null}, {label:o.okLabel||'Download', value:'go', primary:true}]);
  const d = document.getElementById('tl-modal');
  if(d) d.addEventListener('click', e=>{ if(e.target.closest && e.target.closest('button[data-i]')){
    const lhr = document.querySelector('input[name="sdd-lh"]:checked');
    cap = {name:(document.getElementById('sdd-name')||{}).value||'', save:((document.getElementById('sdd-save')||{}).value||'').trim(), lh:lhr?lhr.value:'none', st:stChoice('sdd')}; } }, true);
  const v = await pr; if(!v || !cap) return null;
  return cap;
}
function _sdFileName(n, ext){ n = tdSafeName(String(n||'').replace(/\.(docx|pdf)$/i,'')); return n+ext; }

// output: blob → download, then (optionally) the library copy
async function sdFinish(blob, fileName, saveName){
  tdSaveBlob(blob, fileName, blob.type);
  toast('✓ Downloaded — '+fileName,'ok');
  try{ logActivity({category:'system', action:'stamp_desk_download', description:(CU?CU.name:'')+' prepared "'+fileName.slice(0,60)+'" ('+_sdFirm+')'}); }catch(e){}
  if(!saveName) return;
  try{
    await loadTenderDocs();
    const key = 'firmdocs/'+tdSlug(_sdFirm)+'/'+Date.now()+'_'+fileName.replace(/[^a-zA-Z0-9._-]/g,'_');
    const f = new File([blob], fileName, {type:blob.type});
    const url = await r2UploadViaWorker(f, R2_DOCS_BUCKET, key);
    const rec = {id:'td_'+uid(), firm:_sdFirm, name:saveName, category:'Signed documents', department:'', notes:'', validTill:'', url, key, mime:blob.type, fileName, size:blob.size, uploadedBy:CU.name, uploadedAt:new Date().toISOString()};
    D.tenderDocs.push(rec);
    try{ await saveTenderDocs(); }catch(e){ D.tenderDocs = D.tenderDocs.filter(x=>x.id!==rec.id); throw new Error('the file uploaded but its details could not be saved'); }
    toast('✓ Copy saved in the library as “'+saveName+'”','ok',5000);
  }catch(e){ console.error(e); toast('The download worked, but the copy was NOT saved in the library — '+(e.message||'upload failed'),'error',9000); }
}

// ─── PDF: stamp ────────────────────────────────────────
async function sdGoPdf(){
  if(!stAllowed()){ toast('Stamp & sign is for the Super Admin only','error'); return; }
  if(typeof tdPdfReady==='function' && !tdPdfReady()) return;
  const r = await csPlace({name:_sdFile.name, bytes:_sdFile.bytes, firm:_sdFirm, pos:null, label:_sdFirm, okLabel:'Use this place', noRemember:true});
  if(!r || r==='skip') return;
  const ask = await sdDialog({title:'Download the stamped PDF', defName:_sdFile.name.replace(/\.pdf$/i,'')+' - signed', okLabel:'Download PDF'});
  if(!ask) return;
  setBusy(true,'Stamping…');
  try{
    const key = lhKeyFor(_sdFirm), res = await stResolve(key, {variant:r.pos.variant, address:r.pos.address});
    const out = await csStampBytes(_sdFile.bytes, r.pos, res);
    setBusy(false);
    await sdFinish(new Blob([out],{type:'application/pdf'}), _sdFileName(ask.name,'.pdf'), ask.save);
  }catch(e){ console.error(e); toast('Nothing was downloaded — '+(e.message||'stamping failed'),'error',7000); }
  finally{ setBusy(false); }
}

// ─── Word: read / edit the package ─────────────────────
function sdBlocks(xmlDoc){
  const body = xmlDoc.getElementsByTagNameNS(SD_W,'body')[0]; if(!body) throw new Error('this does not look like a Word document');
  return [...body.children].filter(n=>n.localName==='p' || n.localName==='tbl');
}
function sdBlockText(n){
  const t = [...n.getElementsByTagNameNS(SD_W,'t')].map(x=>x.textContent).join('').replace(/\s+/g,' ').trim();
  if(n.localName==='tbl') return '▦ Table — '+(t.slice(0,70)||'(empty)');
  return t ? t.slice(0,90)+(t.length>90?'…':'') : '';
}
// ask which block the stamp goes after. Resolves an index (-1 = very top, n-1 = the end) or null.
async function sdChooseSpot(blocks){
  const lines = blocks.map((b,i)=>({i, t:sdBlockText(b)}));
  const shown = lines.filter(x=>x.t);                     // blank lines are skipped in the list
  let html = `<div style="font-size:12px;color:var(--text3);margin-bottom:6px">Pick the line the stamp &amp; sign should go <b>after</b>. You can still move it in Word later.</div>
    <div style="max-height:46vh;overflow:auto;border:1px solid var(--border);border-radius:var(--rs)">
    <label style="display:flex;gap:8px;padding:6px 10px;border-bottom:1px solid var(--border);font-size:12px;cursor:pointer;text-transform:none;letter-spacing:0;font-weight:600"><input type="radio" name="sd-spot" value="-1"> ⬆ At the very top</label>
    ${shown.map((x,k)=>`<label style="display:flex;gap:8px;padding:6px 10px;border-bottom:1px solid var(--border);font-size:12px;cursor:pointer;text-transform:none;letter-spacing:0;font-weight:500"><input type="radio" name="sd-spot" value="${x.i}" ${k===shown.length-1?'checked':''}> <span>${_sdE(x.t)}</span></label>`).join('')}
    <label style="display:flex;gap:8px;padding:6px 10px;font-size:12px;cursor:pointer;text-transform:none;letter-spacing:0;font-weight:600"><input type="radio" name="sd-spot" value="${blocks.length-1}" ${shown.length?'':'checked'}> ⬇ At the very end of the document</label></div>`;
  let pick = null;
  const pr = tlModal('Where should the stamp & sign go?', html, [{label:'Cancel', value:null},{label:'Place it here', value:'go', primary:true}]);
  const d = document.getElementById('tl-modal');
  if(d){ d.querySelector('input[name="sd-spot"]:checked')?.scrollIntoView({block:'center'}); d.addEventListener('click', e=>{ if(e.target.closest && e.target.closest('button[data-i]')){ const r = document.querySelector('input[name="sd-spot"]:checked'); pick = r ? Number(r.value) : null; } }, true); }
  const v = await pr; if(!v || pick==null) return null; return pick;
}
function sdEnsureDefault(ct, ext, mime){
  return new RegExp('Extension="'+ext+'"','i').test(ct) ? ct : ct.replace(/(<Types[^>]*>)/, '$1<Default Extension="'+ext+'" ContentType="'+mime+'"/>');
}
function sdSect(xmlDoc){ return [...xmlDoc.getElementsByTagNameNS(SD_W,'sectPr')]; }
function sdTextWidth(xmlDoc){
  const s = sdSect(xmlDoc).pop(); if(!s) return 9000;
  const g = (tag,a)=>{ const e = s.getElementsByTagNameNS(SD_W,tag)[0]; return e ? Number(e.getAttributeNS(SD_W,a)||e.getAttribute('w:'+a)) : NaN; };
  const w = g('pgSz','w'), l = g('pgMar','left'), r = g('pgMar','right');
  return (w>0 && l>=0 && r>=0 && w-l-r>2000) ? w-l-r : 9000;
}
async function sdEditWord(opts){      // opts: {bytes, stamp:{res, afterIdx}|null, letterhead:'digital'|'none'}
  const Z = await sdJSZip(), zip = await Z.loadAsync(opts.bytes);
  const docFile = zip.file('word/document.xml'); if(!docFile) throw new Error('this does not look like a Word document');
  const xmlDoc = new DOMParser().parseFromString(await docFile.async('string'), 'application/xml');
  if(xmlDoc.getElementsByTagName('parsererror').length) throw new Error('the Word file could not be read');
  let relsPath = 'word/_rels/document.xml.rels', relsF = zip.file(relsPath);
  let rels = relsF ? await relsF.async('string') : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  let ct = await zip.file('[Content_Types].xml').async('string');
  const key = lhKeyFor(_sdFirm);
  // letterhead first (it changes the margins, which the stamp width depends on)
  if(opts.letterhead==='digital'){
    const lh = await lhDocxPackage(key), m = lhMargins(key,'digital');
    const sects = sdSect(xmlDoc);
    const body = xmlDoc.getElementsByTagNameNS(SD_W,'body')[0];
    if(!sects.length){ const s = xmlDoc.createElementNS(SD_W,'w:sectPr'); body.appendChild(s); sects.push(s); }
    sects.forEach(s=>{
      [...s.children].filter(c=>c.localName==='headerReference').forEach(c=>c.remove());
      [...s.children].filter(c=>c.localName==='titlePg').forEach(c=>c.remove());
      const hr = xmlDoc.createElementNS(SD_W,'w:headerReference'); hr.setAttributeNS(SD_W,'w:type','default'); hr.setAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','r:id','rIdSDLH');
      s.insertBefore(hr, s.firstChild);
      let sz = [...s.children].find(c=>c.localName==='pgSz');
      if(!sz){ sz = xmlDoc.createElementNS(SD_W,'w:pgSz'); s.appendChild(sz); }
      if(sz.getAttributeNS(SD_W,'orient')!=='landscape'){ sz.setAttributeNS(SD_W,'w:w','11906'); sz.setAttributeNS(SD_W,'w:h','16838'); }
      let mg = [...s.children].find(c=>c.localName==='pgMar');
      if(!mg){ mg = xmlDoc.createElementNS(SD_W,'w:pgMar'); sz.after(mg); }
      ['top','right','bottom','left'].forEach(k=>mg.setAttributeNS(SD_W,'w:'+k,String(m[k])));
      mg.setAttributeNS(SD_W,'w:header','0'); mg.setAttributeNS(SD_W,'w:footer','0');
    });
    zip.file('word/headerSDLH.xml', lh.headerXml);
    zip.file('word/_rels/headerSDLH.xml.rels', lh.headerRels);
    zip.file(lh.mediaName, lh.mediaBytes);
    ct = sdEnsureDefault(ct, lh.ext, lh.mime);
    if(!/PartName="\/word\/headerSDLH\.xml"/.test(ct)) ct = ct.replace('</Types>','<Override PartName="/word/headerSDLH.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>');
    rels = rels.replace('</Relationships>','<Relationship Id="rIdSDLH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="headerSDLH.xml"/></Relationships>');
  }
  // the stamp
  if(opts.stamp){
    const blk = stDocxBlock(opts.stamp.res, sdTextWidth(xmlDoc)); if(!blk) throw new Error('no stamp picture to add');
    let xml = blk.xml.replace(/id="(20\d)"/g,(m,n)=>'id="'+(9000+Number(n))+'"').replace(/rIdStamp(\d+)/g,'rIdSDStamp$1');
    const frag = new DOMParser().parseFromString('<w:body '+SD_NS+'>'+xml+'</w:body>','application/xml');
    if(frag.getElementsByTagName('parsererror').length) throw new Error('the stamp block could not be built');
    const blocks = sdBlocks(xmlDoc), at = opts.stamp.afterIdx;
    const nodes = [...frag.documentElement.children].map(n=>xmlDoc.importNode(n,true));
    if(at<0){ const first = blocks[0] || null; nodes.forEach(n=>first ? first.parentNode.insertBefore(n, first) : xmlDoc.getElementsByTagNameNS(SD_W,'body')[0].insertBefore(n, xmlDoc.getElementsByTagNameNS(SD_W,'sectPr')[0]||null)); }
    else { let ref = blocks[at]; if(!ref) ref = blocks[blocks.length-1]; const nxt = ref ? ref.nextSibling : null; const par = ref ? ref.parentNode : xmlDoc.getElementsByTagNameNS(SD_W,'body')[0]; nodes.forEach(n=>par.insertBefore(n, nxt)); }
    blk.media.forEach(mm=>{
      const rid = mm.rid.replace('rIdStamp','rIdSDStamp'), nm = mm.name.replace('stamp','sdstamp');
      zip.file(nm, mm.bytes);
      rels = rels.replace('</Relationships>','<Relationship Id="'+rid+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="'+nm.replace('word/','')+'"/></Relationships>');
    });
    ct = sdEnsureDefault(ct,'png','image/png');
  }
  zip.file('word/document.xml', new XMLSerializer().serializeToString(xmlDoc));
  zip.file(relsPath, rels); zip.file('[Content_Types].xml', ct);
  return await zip.generateAsync({type:'blob', mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression:'DEFLATE'});
}

async function sdGo(){
  if(!_sdFile || _sdBusy) return;
  if(_sdFile.kind==='pdf') return sdGoPdf();
  _sdBusy = true;
  try{
    const Z = await sdJSZip();
    let blocks;
    try{ const zz = await Z.loadAsync(_sdFile.bytes); const dx = zz.file('word/document.xml'); if(!dx) throw 0; blocks = sdBlocks(new DOMParser().parseFromString(await dx.async('string'),'application/xml')); }
    catch(e){ toast('That file could not be read as a Word document','error',6000); return; }
    const ask = await sdDialog({title:'Word file — '+_sdFile.name, defName:_sdFile.name.replace(/\.docx$/i,'')+' - signed', stamp:true, okLabel:'Next',
      lh:[['none','Keep the document’s own page and margins'],['digital','Put it on the {LH} letterhead (digital)']]});
    if(!ask) return;
    const wantStamp = stAllowed() && ask.st && ask.st.variant!=='none';
    if(!wantStamp && ask.lh==='none'){ toast('Nothing to do — choose a stamp and/or the letterhead','error',5000); return; }
    let after = null;
    if(wantStamp){ after = await sdChooseSpot(blocks); if(after==null) return; }
    setBusy(true,'Preparing the Word file…');
    const res = wantStamp ? await stResolve(lhKeyFor(_sdFirm), ask.st) : null;
    const blob = await sdEditWord({bytes:_sdFile.bytes, stamp: wantStamp ? {res, afterIdx:after} : null, letterhead: ask.lh==='digital'?'digital':'none'});
    setBusy(false);
    await sdFinish(blob, _sdFileName(ask.name,'.docx'), ask.save);
  }catch(e){ console.error(e); toast('Nothing was downloaded — '+(e.message||'failed'),'error',8000); }
  finally{ setBusy(false); _sdBusy = false; }
}

// ─── typed text → Word ─────────────────────────────────
async function sdText(){
  const txt = (document.getElementById('sd-text')||{}).value || _sdText;
  if(!String(txt).trim()){ toast('Type or paste the text first','error'); return; }
  if(_sdBusy) return; _sdBusy = true;
  try{
    const ask = await sdDialog({title:'Text to Word', defName:'Letter - '+_sdFirm, stamp:true, okLabel:'Download Word',
      lh:[['digital','On the {LH} letterhead (digital)'],['plain','Plain A4 page']]});
    if(!ask) return;
    const key = lhKeyFor(_sdFirm), mode = ask.lh==='plain' ? 'plain' : 'digital', margins = lhMargins(key, mode);
    const avail = 11906 - margins.left - margins.right;
    const wantStamp = stAllowed() && ask.st && ask.st.variant!=='none';
    setBusy(true,'Preparing the Word file…');
    let blk = null;
    if(wantStamp) blk = stDocxBlock(await stResolve(key, ask.st), avail);
    const lines = String(txt).replace(/\r\n?/g,'\n').split('\n');
    const body = lines.map(l=>wxsP(l.replace(/\t/g,'    '), {after: l.trim()?100:0, sz:24})).join('') + (blk ? wxsP('',{after:200}) + blk.xml : '');
    const docx = buildDOCX(body, margins);
    if(blk) docx.stamps = blk.media;
    if(mode==='digital') docx.letterhead = await lhDocxPackage(key);
    const blob = await sdPartsBlob(docx);
    setBusy(false);
    await sdFinish(blob, _sdFileName(ask.name,'.docx'), ask.save);
  }catch(e){ console.error(e); toast('Nothing was downloaded — '+(e.message||'failed'),'error',8000); }
  finally{ setBusy(false); _sdBusy = false; }
}
// same package assembly as triggerDownload (letters.js), but returns the file so a copy can also be kept
async function sdPartsBlob(parts){
  const Z = await sdJSZip(), zip = new Z();
  let ct = parts.contentTypes, doc = parts.docXml, rels = parts.relsXml; const lh = parts.letterhead;
  if(parts.stamps && parts.stamps.length){
    if(!(lh && lh.ext==='png')) ct = ct.replace('<Default Extension="xml"','<Default Extension="png" ContentType="image/png"/>\n  <Default Extension="xml"');
    parts.stamps.forEach(m=>{ rels = rels.replace('</Relationships>','  <Relationship Id="'+m.rid+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="'+m.name.replace('word/','')+'"/>\n</Relationships>'); zip.file(m.name, m.bytes); });
  }
  if(lh){
    ct = ct.replace('<Default Extension="xml"',`<Default Extension="${lh.ext}" ContentType="${lh.mime}"/>\n  <Default Extension="xml"`).replace('</Types>','  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>\n</Types>');
    doc = doc.replace('##HDR##','<w:headerReference w:type="default" r:id="rId2"/>');
    rels = rels.replace('</Relationships>','  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>\n</Relationships>');
    zip.file('word/header1.xml', lh.headerXml); zip.file('word/_rels/header1.xml.rels', lh.headerRels); zip.file(lh.mediaName, lh.mediaBytes);
  } else doc = doc.replace('##HDR##','');
  zip.file('[Content_Types].xml', ct); zip.file('_rels/.rels', parts.rootRels); zip.file('word/document.xml', doc);
  zip.file('word/_rels/document.xml.rels', rels); zip.file('word/styles.xml', parts.stylesXml);
  return await zip.generateAsync({type:'blob', mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
