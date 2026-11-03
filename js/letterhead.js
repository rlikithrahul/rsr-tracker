// ═══════════════════════════════════════════════════════
// letterhead.js — digital letterheads for all three firms
//
// Every letter / statement can be produced three ways:
//   plain    — no letterhead, normal margins
//   space    — blank space at the top for the PRINTED letterhead
//   digital  — the firm's letterhead built into the page (colour as designed;
//              a black & white printer simply prints it grey)
//
// The letterheads are full-page A4 images (300 dpi) in assets/letterheads/.
// Each firm also has "safe zones" — the margins that keep text clear of the
// header, footer and the RSR curve — so nothing prints over the artwork.
//
// For any new letter or statement, only three calls are needed:
//   lhPickerHTML(prefix, onchange)        → the 3-way choice (+ thumbnail)
//   lhMode(prefix) / lhKeyFor(firmText)   → what was chosen / which firm
//   lhPrintHTML(key, mode, html, title)   → print or Save-as-PDF, repeating
//                                           the letterhead on every page
//   lhDocxPackage(...)                    → (Word) used by letters.js
// ═══════════════════════════════════════════════════════

// margins in twips (1 cm = 567); page is A4 = 11906 x 16838 twips
const LH_SETS = {
  rsr:    {name:'RSR Constructions', file:'assets/letterheads/rsr.jpg',    ext:'jpg', mime:'image/jpeg', m:{top:2835,right:1531,bottom:1361,left:1800}},
  likith: {name:'R Likith Rahul',    file:'assets/letterheads/likith.png', ext:'png', mime:'image/png',  m:{top:2948,right:1440,bottom:1474,left:1800}},
  sadhu:  {name:'R Sadhu Rao',       file:'assets/letterheads/sadhu.png',  ext:'png', mime:'image/png',  m:{top:2948,right:1440,bottom:1474,left:1800}}
};
const LH_PLAIN_MARGINS = {top:1440,right:1440,bottom:1440,left:1800};
const LH_SPACE_MARGINS = {top:2835,right:1440,bottom:1440,left:1800};
const _lhCache = {};

function lhKeyFor(text){
  const t = String(text||'').toLowerCase();
  if(t.includes('sadhu')) return 'sadhu';
  if(t.includes('likith')) return 'likith';
  return 'rsr';
}
function lhMode(prefix){
  const el = document.querySelector('input[name="'+prefix+'-lhmode"]:checked');
  return el ? el.value : 'plain';
}
function lhMargins(key, mode){
  if(mode==='digital' && LH_SETS[key]) return {...LH_SETS[key].m};
  if(mode==='space') return {...LH_SPACE_MARGINS};
  return {...LH_PLAIN_MARGINS};
}
// the three-way choice. onchange = JS string run when it changes.
function lhPickerHTML(prefix, onchange, firmKey, selected){
  const sel = selected || 'plain';
  const opt = (v,title,sub)=>`<label style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;border:1.5px solid ${sel===v?'var(--navy)':'var(--border)'};border-radius:var(--rs);cursor:pointer;background:${sel===v?'#eef2fb':'#fff'}">
      <input type="radio" name="${prefix}-lhmode" value="${v}" ${sel===v?'checked':''} onchange="${onchange}" style="margin-top:3px">
      <div><div style="font-weight:700;font-size:13px">${title}</div><div style="font-size:11px;color:var(--text3)">${sub}</div></div></label>`;
  const k = LH_SETS[firmKey] ? firmKey : 'rsr';
  return `<div class="fg" style="margin:10px 0"><label>Letterhead</label><div style="display:flex;flex-direction:column;gap:6px">
    ${opt('plain','Plain','No letterhead, normal margins')}
    ${opt('space','Leave space for my printed letterhead','Blank space at the top (about 5 cm)')}
    ${opt('digital','Digital letterhead — '+LH_SETS[k].name,'The letterhead is built into the page. Print it, or save it as a file. Colour or black &amp; white is decided by the printer you use.')}
    ${sel==='digital'?`<img src="${LH_SETS[k].file}" alt="" style="height:110px;align-self:flex-start;border:1px solid var(--border);border-radius:4px">`:''}
  </div></div>`;
}
async function lhLoad(key){
  if(_lhCache[key]) return _lhCache[key];
  const set = LH_SETS[key]; if(!set) throw new Error('Unknown letterhead');
  const r = await fetch(set.file, {cache:'force-cache'});
  if(!r.ok) throw new Error('Letterhead image could not be loaded ('+r.status+')');
  _lhCache[key] = new Uint8Array(await r.arrayBuffer());
  return _lhCache[key];
}

// ─── WORD: parts that make the letterhead the page background ───
const LH_EMU_W = 7560310, LH_EMU_H = 10692130;   // A4 in EMU
async function lhDocxPackage(key){
  const set = LH_SETS[key], bytes = await lhLoad(key);
  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:sz w:val="2"/></w:rPr><w:drawing>
<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="1" locked="1" layoutInCell="1" allowOverlap="1">
<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV>
<wp:extent cx="${LH_EMU_W}" cy="${LH_EMU_H}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="100" name="Letterhead"/><wp:cNvGraphicFramePr/>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="100" name="letterhead.${set.ext}"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${LH_EMU_W}" cy="${LH_EMU_H}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>
</wp:anchor></w:drawing></w:r></w:p></w:hdr>`;
  const headerRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/letterhead.${set.ext}"/></Relationships>`;
  return {headerXml, headerRels, mediaName:'word/media/letterhead.'+set.ext, mediaBytes:bytes, ext:set.ext, mime:set.mime};
}

// ─── PRINT / SAVE AS PDF (any HTML content) ───────────
// The letterhead repeats on every printed page; content never enters the
// header/footer zones. In the print dialog choose "Save as PDF" to get a file.
async function lhPrintHTML(key, mode, innerHtml, title, opts){
  opts = opts || {};
  const m = lhMargins(key, mode);
  const cm = n => (n/567).toFixed(2)+'cm';
  let bg = '';
  if(mode==='digital'){
    try{
      const bytes = await lhLoad(key);
      let bin=''; for(let i=0;i<bytes.length;i+=8192) bin += String.fromCharCode.apply(null, bytes.subarray(i,i+8192));
      bg = `<img class="lhbg" src="data:${LH_SETS[key].mime};base64,${btoa(bin)}">`;
    }catch(e){ console.error(e); if(typeof toast==='function') toast('Letterhead could not be loaded: '+e.message,'error'); return false; }
  }
  const font = opts.font || "'Times New Roman',serif", size = opts.size || '12pt', lh = opts.lineHeight || '1.55';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${String(title||'Document').replace(/[<>&]/g,'')}</title><style>
    @page{size:A4;margin:0}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:transparent}
    body{font-family:${font};font-size:${size};line-height:${lh};color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .lhbg{position:fixed;left:0;top:0;width:210mm;height:297mm;z-index:-1}
    table.pg{width:100%;border-collapse:collapse}
    table.pg td{padding:0}
    table.pg td.pad{padding-left:${cm(m.left)};padding-right:${cm(m.right)}}
    .sp-top{height:${cm(m.top)}} .sp-bot{height:${cm(m.bottom)}}
    table{page-break-inside:auto} tr{page-break-inside:avoid}
  </style></head><body>${bg}
  <table class="pg"><thead><tr><td><div class="sp-top"></div></td></tr></thead>
  <tfoot><tr><td><div class="sp-bot"></div></td></tr></tfoot>
  <tbody><tr><td class="pad">${innerHtml}</td></tr></tbody></table></body></html>`;
  const fr = document.createElement('iframe');
  fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(fr);
  const doc = fr.contentWindow.document; doc.open(); doc.write(html); doc.close();
  const go = ()=>{ try{ fr.contentWindow.focus(); fr.contentWindow.print(); }catch(e){ console.error(e); if(typeof toast==='function') toast('Printing is not available in this browser','error'); } setTimeout(()=>fr.remove(), 60000); };
  const img = doc.querySelector('.lhbg');
  if(img && !img.complete) img.onload = ()=>setTimeout(go,150); else setTimeout(go,250);
  return true;
}
