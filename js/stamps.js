// ═══════════════════════════════════════════════════════
// stamps.js — firm stamps & signatures for letters / statements
//
// SUPER ADMIN ONLY. The images are not part of the app files: each one is
// kept in its own settings row (rsr_stamp_<slot>) and is only ever loaded
// for the Super Admin login. Staff never see the option, the upload screen
// or the pictures.
//
// Pictures are transparent PNGs (ink only, no paper), so on the letter they
// look like a real stamp pressed on the page.
//
// To add another stamp or signature later: add one line to ST_SLOTS (and, for
// a new choice in the letter dialog, to ST_FIRMS). Nothing else changes.
// ═══════════════════════════════════════════════════════

const ST_SLOTS = [
  {id:'rsr_stamp',         firm:'rsr',    title:'RSR Constructions — managing partner stamp',          sub:'Blank stamp'},
  {id:'rsr_signed',        firm:'rsr',    title:'RSR Constructions — stamp with Likith’s sign',       sub:'Stamp + sign together'},
  {id:'rsr_signed_father', firm:'rsr',    title:'RSR Constructions — stamp with father’s sign',        sub:'Stamp + sign together'},
  {id:'rsr_address',       firm:'rsr',    title:'RSR Constructions — address stamp',                   sub:'Used with any RSR stamp, where needed'},
  {id:'likith_stamp',      firm:'likith', title:'R Likith Rahul — proprietor stamp',                   sub:'Blank stamp'},
  {id:'likith_signed',     firm:'likith', title:'R Likith Rahul — stamp with sign',                    sub:'Stamp + sign together'},
  {id:'sadhu_stamp',       firm:'sadhu',  title:'R Sadhu Rao — stamp',                                 sub:'Blank stamp'},
  {id:'sadhu_signed',      firm:'sadhu',  title:'R Sadhu Rao — stamp with sign',                       sub:'Stamp + sign together'}
];
// what each firm can offer in the letter dialog
const ST_FIRMS = {
  rsr:    {stamp:'rsr_stamp',    signs:[{id:'rsr_signed',label:'with Likith’s sign'},{id:'rsr_signed_father',label:'with father’s sign'}], address:'rsr_address'},
  likith: {stamp:'likith_stamp', signs:[{id:'likith_signed',label:'with sign'}]},
  sadhu:  {stamp:'sadhu_stamp',  signs:[{id:'sadhu_signed',label:'with sign'}]}
};
const ST_WIDTH_CM = {stamp:6.3, address:6.6};   // printed width on the page
const ST_KEY = id => 'rsr_stamp_'+id;
const _stCache = {};     // id -> {dataUrl, bytes, w, h}  (memory only, this tab)
let _stAvail = null;     // ids that have an image uploaded (null = not checked yet)

function stAllowed(){ return !!(typeof CU!=='undefined' && CU && CU.isSuperAdmin); }

// ── load / save ──
function _stDecode(dataUrl){
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl||''); if(!m) return null;
  const bin = atob(m[1]), bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  const dv = new DataView(bytes.buffer);
  if(bytes.length<24 || dv.getUint32(0)!==0x89504e47) return null;
  return {dataUrl, bytes, w:dv.getUint32(16), h:dv.getUint32(20)};
}
async function stGet(id){
  if(!stAllowed()) return null;
  if(_stCache[id]) return _stCache[id];
  const v = await getSetting(ST_KEY(id), null);
  const d = v ? _stDecode(v) : null;
  if(d) _stCache[id] = d;
  return d;
}
// which images exist — asks for the key names only (no image data)
async function stAvailable(force){
  if(!stAllowed()) return new Set();
  if(_stAvail && !force) return _stAvail;
  try{
    const rows = await sbReq('settings?select=key&key=like.'+encodeURIComponent('rsr_stamp_*'),'GET');
    _stAvail = new Set((rows||[]).map(r=>String(r.key).replace(/^rsr_stamp_/,'')).filter(k=>!k.startsWith('hidden_')));
  }catch(e){ console.warn('stamps list',e); _stAvail = _stAvail || new Set(); }
  return _stAvail;
}

// ── choice in the letter / statement dialog ──
// prefix: 'lf' (letter) / 'wxs' (statement). Returns '' for anyone but the Super Admin.
function stPickerHTML(prefix, firmKey, onchange, sel){
  if(!stAllowed()) return '';
  const f = ST_FIRMS[firmKey] || ST_FIRMS.rsr, av = _stAvail || new Set();
  sel = sel || {variant:'none', address:false};
  const opt = (v,label,has)=>`<label style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1.5px solid ${sel.variant===v?'var(--navy)':'var(--border)'};border-radius:var(--rs);background:${sel.variant===v?'#eef2fb':'#fff'};${has?'cursor:pointer':'opacity:.5;cursor:not-allowed'}">
      <input type="radio" name="${prefix}-stv" value="${v}" ${sel.variant===v?'checked':''} ${has?'':'disabled'} onchange="${onchange}">
      <span style="font-size:13px;font-weight:600">${label}</span>${has?'':'<span style="font-size:11px;color:var(--text3)">&nbsp;— not uploaded yet</span>'}</label>`;
  return `<div class="fg" style="margin:10px 0" id="${prefix}-st-box"><label>Stamp &amp; sign <span style="font-size:10px;color:#92400e;background:#fef3c7;border-radius:6px;padding:1px 6px;margin-left:4px">Super Admin only</span></label>
    <div style="display:flex;flex-direction:column;gap:5px">
      ${opt('none','No stamp',true)}
      ${opt('stamp','Stamp only',av.has(f.stamp))}
      ${f.signs.map(s=>opt(s.id,'Stamp '+s.label,av.has(s.id))).join('')}
      ${f.address?`<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-top:2px;${av.has(f.address)?'cursor:pointer':'opacity:.5'}"><input type="checkbox" id="${prefix}-st-addr" ${sel.address?'checked':''} ${av.has(f.address)?'':'disabled'} onchange="${onchange}"> Also add the address stamp${av.has(f.address)?'':' <span style="font-size:11px;color:var(--text3)">— not uploaded yet</span>'}</label>`:''}
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:4px">Goes at the signing place at the end of the letter. Upload or replace pictures in Settings → Stamps &amp; Signs.</div></div>`;
}
function stChoice(prefix){
  if(!stAllowed()) return {variant:'none', address:false};
  const r = document.querySelector('input[name="'+prefix+'-stv"]:checked');
  return {variant: r ? r.value : 'none', address: !!document.getElementById(prefix+'-st-addr')?.checked};
}
function _stImageId(firmKey, ch){
  const f = ST_FIRMS[firmKey] || ST_FIRMS.rsr;
  if(ch.variant==='stamp') return f.stamp;
  return f.signs.some(s=>s.id===ch.variant) ? ch.variant : null;
}
// the pictures a choice needs (loaded). {main, addr} — either may be null.
async function stResolve(firmKey, ch){
  if(!stAllowed() || !ch || ch.variant==='none') return null;
  const f = ST_FIRMS[firmKey] || ST_FIRMS.rsr;
  const id = _stImageId(firmKey, ch);
  const main = id ? await stGet(id) : null;
  if(id && !main) throw new Error('The selected stamp picture is not uploaded (Settings → Stamps & Signs).');
  const addr = (ch.address && f.address) ? await stGet(f.address) : null;
  if(ch.address && f.address && !addr) throw new Error('The address stamp is not uploaded (Settings → Stamps & Signs).');
  return (main||addr) ? {main, addr} : null;
}

// ── WORD ──
const _EMU = 360000;
function _stInline(rid, n, img, cm){
  const cx = Math.round(cm*_EMU), cy = Math.round(cx*img.h/img.w);
  return `<w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" distT="0" distB="0" distL="0" distR="0">
<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${200+n}" name="Stamp ${n}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${200+n}" name="stamp${n}.png"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}
// Returns {xml, media:[{rid, name, bytes}]} — the signing block as Word XML, or null.
// width = text width in twips (used when the address stamp sits left of the stamp).
function stDocxBlock(res, width){
  if(!res) return null;
  const media = [], p = (jc, inner)=>`<w:p><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="0" w:after="0"/><w:jc w:val="${jc}"/></w:pPr>${inner}</w:p>`;
  let n = 0;
  const add = (img, cm)=>{ n++; const rid='rIdStamp'+n; media.push({rid, name:'word/media/stamp'+n+'.png', bytes:img.bytes}); return _stInline(rid, n, img, cm); };
  let xml;
  if(res.main && res.addr){
    // address stamp on the left, stamp/sign on the right — borderless table
    const wl = Math.round(width*0.5), wr = width - wl;
    const cell = (w, jc, inner)=>`<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:vAlign w:val="bottom"/></w:tcPr>${p(jc, inner)}</w:tc>`;
    xml = `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr>
<w:tblGrid><w:gridCol w:w="${wl}"/><w:gridCol w:w="${wr}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(wl,'left',add(res.addr,ST_WIDTH_CM.address-0.6))}${cell(wr,'right',add(res.main,ST_WIDTH_CM.stamp))}</w:tr></w:tbl>`;
  } else if(res.main){
    xml = p('right', add(res.main, ST_WIDTH_CM.stamp));
  } else {
    xml = p('right', add(res.addr, ST_WIDTH_CM.address));
  }
  return {xml, media};
}

// ── PRINT / PDF ──
function stHtmlBlock(res){
  if(!res) return '';
  const im = (img,cm)=>`<img src="${img.dataUrl}" style="width:${cm}cm;height:auto;display:block">`;
  if(res.main && res.addr) return `<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:4px;page-break-inside:avoid">${im(res.addr,ST_WIDTH_CM.address-0.6)}${im(res.main,ST_WIDTH_CM.stamp)}</div>`;
  const one = res.main || res.addr;
  return `<div style="display:flex;justify-content:flex-end;margin-top:4px;page-break-inside:avoid">${im(one,res.main?ST_WIDTH_CM.stamp:ST_WIDTH_CM.address)}</div>`;
}

// ── SETTINGS: upload screen (Super Admin only) ──
function _setStampsSection(){
  if(!stAllowed()) return '';
  return `<!-- STAMPS & SIGNS -->
    <div class="set-sec" id="set-stamps">
      <div class="set-hd" onclick="setToggle('stamps');stRenderSlots()" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();setToggle('stamps');stRenderSlots()}">
        <span class="set-ic" style="background:#ede9fe">🖋️</span>
        <span class="set-tt"><span class="set-t1">Stamps &amp; Signs</span><span class="set-t2">Super Admin only · used in letter and statement downloads</span></span>
        <svg class="set-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
      </div>
      <div class="set-bd"><div class="set-bdi"><div class="set-pad">
        <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Upload each picture once as a <b>transparent PNG</b> (ink only, no paper background). Staff logins never see this section or the pictures.</div>
        <div id="st-slots">Loading…</div>
        <div id="st-err" style="display:none;color:#b91c1c;font-size:12px;margin-top:6px"></div>
      </div></div></div>
    </div>`;
}
async function stRenderSlots(){
  const box = document.getElementById('st-slots'); if(!box || !stAllowed()) return;
  const av = await stAvailable(true);
  const firmName = {rsr:'RSR Constructions', likith:'R Likith Rahul', sadhu:'R Sadhu Rao'};
  let html = '';
  for(const s of ST_SLOTS){
    const has = av.has(s.id);
    let thumb = '<div style="width:110px;height:56px;border:1px dashed var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text3)">empty</div>';
    if(has){ try{ const d = await stGet(s.id); if(d) thumb = `<img src="${d.dataUrl}" style="width:110px;height:56px;object-fit:contain;border:1px solid var(--border);border-radius:6px;background:repeating-conic-gradient(#f1f1f1 0 25%,#fff 0 50%) 0 0/12px 12px">`; }catch(e){} }
    html += `<div style="display:flex;gap:12px;align-items:center;border:1px solid var(--border);border-radius:12px;padding:10px;margin-bottom:8px;flex-wrap:wrap">${thumb}
      <div style="flex:1;min-width:180px"><div style="font-weight:700;font-size:13px">${s.title}</div><div style="font-size:11px;color:var(--text3)">${s.sub} · ${has?'<span style="color:#15803d;font-weight:700">uploaded</span>':'not uploaded'}</div></div>
      <label class="btn btn-sm" style="cursor:pointer;margin:0">${has?'Replace':'Upload'}<input type="file" accept="image/png" style="display:none" onchange="stUpload('${s.id}',this)"></label>
      ${has?`<button class="btn btn-sm" onclick="stHide('${s.id}')" title="Stops the option appearing in letters. The picture is moved aside, not deleted.">Hide</button>`:''}
    </div>`;
  }
  box.innerHTML = html;
}
async function stUpload(id, input){
  const err = document.getElementById('st-err'); const bad = m=>{ if(err){ err.textContent=m; err.style.display='block'; } };
  if(err) err.style.display='none';
  const f = input.files && input.files[0]; input.value='';
  if(!f || !stAllowed()) return;
  if(f.type!=='image/png'){ bad('Please choose a PNG file (transparent background).'); return; }
  if(f.size>1500*1024){ bad('That file is too large (limit 1.5 MB). Ask for a compressed copy.'); return; }
  const dataUrl = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(f); });
  const d = _stDecode(dataUrl); if(!d){ bad('That does not look like a valid PNG.'); return; }
  try{
    await saveSetting(ST_KEY(id), dataUrl);
    delete _stCache[id]; _stAvail = null;
    try{ writeActivityLog('stamp_upload','Uploaded stamp/sign picture: '+id); }catch(e){}
    toast('✓ Saved','ok'); stRenderSlots();
  }catch(e){ console.error(e); bad('Could not save: '+e.message); }
}
// hide = keep the picture but stop offering it (never deleted)
async function stHide(id){
  if(!stAllowed()) return;
  if(!confirm('Hide this picture? It stops showing in letters. The picture is kept (moved aside), and Upload brings it back.')) return;
  try{
    const v = await getSetting(ST_KEY(id), null); if(!v) return;
    await saveSetting('rsr_stamp_hidden_'+id, v);
    await sbReq('settings?key=eq.'+encodeURIComponent(ST_KEY(id)),'DELETE');
    delete _stCache[id]; _stAvail = null; stRenderSlots();
  }catch(e){ console.error(e); toast('Could not hide: '+e.message,'error'); }
}
