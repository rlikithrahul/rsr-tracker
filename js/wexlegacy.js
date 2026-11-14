// ═══════════════════════════════════════════════════════
// wexlegacy.js — Work Experience of the years before the app (FY 2023-24 and 2024-25)
//
// Those records came from the old Excel: gen code, work type (as text), value and quantities, but no
// project in the app and no certificate. This file lets them take part in every finder like any other year:
//   • All Records (Excel View) → ✏️ Edit on those rows: work value, work types (several allowed, picked from
//     the same list as everywhere — new ones can be added there and are kept for the whole app),
//     quantities, and the certificate upload.
//   • A certificate is shared by gen code: upload it once and the same project's record in the other year
//     uses it too (matched ignoring hyphens/spaces). A project in the app that already has a certificate is
//     used automatically.
//   • wlCert / wlTypes are used by Find by Value, Find by Quantity and the Annual Summary. Projects, their
//     types and their certificates are never changed from here.
// ═══════════════════════════════════════════════════════

function wlNorm(g){ return String(g||'').replace(/[^A-Za-z0-9]/g,'').toUpperCase(); }
function wlIsLegacy(r){ return !!r && String(r.fy||'') < '2025-26'; }
// certificate for a record: its project's, else its own, else a sibling record of the same project (other year)
function wlCert(r, project){
  const w = project && project.documents && project.documents.wec;
  if(w && w.url) return w;
  if(r && r.cert && r.cert.url) return r.cert;
  const n = wlNorm(r && r.genCode); if(!n) return null;
  const recs = (typeof D!=='undefined' && D.wexData && D.wexData.records) || [];
  const sib = recs.find(x=>x!==r && !x._archived && (x.firm||'RSR Constructions')===((r&&r.firm)||'RSR Constructions') && wlNorm(x.genCode)===n && x.cert && x.cert.url);
  return sib ? sib.cert : null;
}
function wlCertSource(r){
  if(r.cert && r.cert.url) return 'own';
  const n = wlNorm(r.genCode);
  const recs = (D.wexData && D.wexData.records) || [];
  const sib = recs.find(x=>x!==r && !x._archived && (x.firm||'RSR Constructions')===(r.firm||'RSR Constructions') && wlNorm(x.genCode)===n && x.cert && x.cert.url);
  return sib ? sib : null;
}
// work types of a record: its own list when set, else the project's
function wlTypes(r, project){
  if(r && Array.isArray(r.types) && r.types.length) return r.types.filter(Boolean);
  return typeof wxvTypesOf==='function' ? wxvTypesOf(project) : [];
}

// ─── EDIT WINDOW ───────────────────────────────────────
let _wlRec = null;
function _wlE(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _wlTypeChips(selected){
  const all = getAllWorkTypes();
  const extra = selected.filter(t=>!all.includes(t));   // a type that was removed from the list later keeps showing while it is on a record
  return [...all, ...extra].map(t=>`<label style="display:inline-flex;align-items:center;justify-content:flex-start;gap:6px;margin:0;text-transform:none;letter-spacing:0;font-weight:600;padding:6px 10px;border-radius:var(--rs);font-size:12px;cursor:pointer;border:1.5px solid ${selected.includes(t)?'var(--navy)':'var(--border)'};background:${selected.includes(t)?'#eef2fb':'#fff'}"><input type="checkbox" class="wl-t" value="${_wlE(t)}" ${selected.includes(t)?'checked':''} style="margin:0"> ${_wlE(t)}</label>`).join('');
}
function _wlPickedTypes(){ return [...document.querySelectorAll('#wl-modal .wl-t:checked')].map(i=>i.value); }
async function wlOpen(id){
  try{ if(typeof loadWEXData==='function') await loadWEXData(); if(typeof loadCustomWorkTypes==='function') await loadCustomWorkTypes(); if(typeof loadWEXCustomTypes==='function') await loadWEXCustomTypes(); }catch(e){}
  const r = ((D.wexData&&D.wexData.records)||[]).find(x=>x.id===id);
  if(!r){ toast('Record not found — refresh the page','error'); return; }
  _wlRec = id;
  const items = getAllWEXItems(), q = r.quantities||{};
  const own = Array.isArray(r.types) ? r.types.filter(Boolean) : [];
  const sib = wlCertSource(r);
  const certNote = (r.cert && r.cert.url)
    ? `<a href="${_wlE(r.cert.url)}" target="_blank" rel="noopener" style="color:var(--navy);font-weight:700">📕 ${_wlE(r.cert.name||'Certificate')}</a> <span style="color:var(--text3)">· uploaded${r.cert.uploadedAt?' '+new Date(r.cert.uploadedAt).toLocaleDateString('en-IN'):''}</span>`
    : sib ? `<a href="${_wlE(sib.cert.url)}" target="_blank" rel="noopener" style="color:var(--navy);font-weight:700">📕 ${_wlE(sib.cert.name||'Certificate')}</a> <span style="color:var(--green);font-weight:700">· shared from FY ${_wlE(sib.fy)} (same project)</span>`
    : '<span style="color:var(--text3)">No certificate uploaded yet</span>';
  let m = document.getElementById('wl-modal');
  if(!m){ m = document.createElement('div'); m.className='mov'; m.id='wl-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="mbox" style="max-width:720px">
    <div class="mhdr"><h2>✏️ Experience record — FY ${_wlE(r.fy)}</h2><button class="mx" onclick="CM('wl-modal')">✕</button></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">Gen code <strong style="font-family:monospace">${_wlE(r.genCode)}</strong> · ${_wlE(r.firm||'RSR Constructions')}</div>
    <div class="fg"><label>Work value (₹)</label><input type="number" step="any" min="0" id="wl-value" value="${r.workValue?_wlE(r.workValue):''}" placeholder="e.g. 1590228"></div>
    <div class="fg"><label>Work types <span style="font-weight:400;color:var(--text3)">(tick every one that applies)</span></label>
      ${r.workType?`<div style="font-size:11px;color:var(--text3);margin-bottom:6px">Recorded earlier as: <strong>${_wlE(r.workType)}</strong></div>`:''}
      <div id="wl-types" style="display:flex;gap:6px;flex-wrap:wrap">${_wlTypeChips(own)}</div>
      <div style="display:flex;gap:6px;margin-top:8px"><input id="wl-newtype" placeholder="Add a new work type…" style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px" onkeydown="if(event.key==='Enter'){event.preventDefault();wlAddType()}"><button class="btn btn-sm" type="button" onclick="wlAddType()">+ Add type</button></div>
      <div style="font-size:11px;color:var(--text3);margin-top:4px">A new type is added to the same list used in Settings and on every project.</div>
    </div>
    <div class="fg"><label>Work experience certificate</label>
      <div style="font-size:12px;margin-bottom:6px">${certNote}</div>
      <input type="file" id="wl-file" accept=".pdf,image/*">
      <div style="font-size:11px;color:var(--text3);margin-top:4px">Upload once — the same project’s record in the other year uses it too. Uploading again replaces it for this project.</div>
    </div>
    <div class="fg"><label>Quantities</label>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px 12px;max-height:240px;overflow:auto;border:1px solid var(--border);border-radius:var(--rs);padding:8px">
        ${items.map(it=>`<label style="font-size:11px;display:flex;flex-direction:column;gap:2px;margin:0;text-transform:none;letter-spacing:0;font-weight:600">${_wlE(it.label)} <span style="color:var(--text3)">(${_wlE(it.unit)})</span><input type="number" step="any" min="0" class="wl-q" data-key="${_wlE(it.key)}" value="${Number(q[it.key])>0?_wlE(q[it.key]):''}" style="padding:5px 8px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px"></label>`).join('')}
      </div>
    </div>
    <div id="wl-err" style="color:var(--red);font-size:13px;margin-bottom:10px;display:none"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn" onclick="CM('wl-modal')">Cancel</button>
      <button class="btn btn-navy" id="wl-save" onclick="wlSave()">Save</button>
    </div>
  </div>`;
  OM('wl-modal');
}
async function wlAddType(){
  const inp = document.getElementById('wl-newtype'); if(!inp) return;
  const val = inp.value.trim(); if(!val) return;
  const picked = _wlPickedTypes();
  const all = getAllWorkTypes();
  const exists = all.find(t=>t.toLowerCase()===val.toLowerCase());
  if(!exists){
    if(!D.customWorkTypes) D.customWorkTypes = [];
    D.customWorkTypes.push(val);
    try{ await saveCustomWorkTypes(); }
    catch(e){
      D.customWorkTypes = D.customWorkTypes.filter(t=>t!==val);
      toast('"'+val+'" was NOT saved as a work type — '+(e.message||'try again'),'error',7000); return;
    }
    toast('✓ "'+val+'" added — available everywhere','ok');
  }
  const use = exists || val;
  if(!picked.includes(use)) picked.push(use);
  document.getElementById('wl-types').innerHTML = _wlTypeChips(picked);
  inp.value = '';
}
async function wlSave(){
  const err = document.getElementById('wl-err'); err.style.display = 'none';
  const r = ((D.wexData&&D.wexData.records)||[]).find(x=>x.id===_wlRec); if(!r) return;
  const vRaw = document.getElementById('wl-value').value.trim();
  const value = vRaw==='' ? 0 : Number(vRaw);
  if(!(value>=0) || isNaN(value)){ err.textContent = 'Enter the work value as a number.'; err.style.display = 'block'; return; }
  const types = _wlPickedTypes();
  const qty = {};
  let bad = false;
  document.querySelectorAll('#wl-modal .wl-q').forEach(i=>{ const s = i.value.trim(); if(s==='') return; const n = Number(s); if(isNaN(n) || n<0){ bad = true; return; } if(n>0) qty[i.dataset.key] = n; });
  if(bad){ err.textContent = 'A quantity is not a valid number.'; err.style.display = 'block'; return; }
  const file = document.getElementById('wl-file').files[0] || null;
  const before = JSON.parse(JSON.stringify({workValue:r.workValue, types:r.types, quantities:r.quantities, cert:r.cert}));
  const btn = document.getElementById('wl-save'); btn.disabled = true;
  setBusy(true, file ? 'Uploading certificate…' : 'Saving…');
  try{
    let cert = r.cert;
    if(file){
      const url = await uploadDocument(file, 'wex-'+wlNorm(r.genCode), 'wec');
      cert = {url, name:file.name, size:file.size, uploadedAt:new Date().toISOString(), uploadedBy:(CU&&CU.name)||''};
    }
    r.workValue = value; r.quantities = qty;
    if(types.length) r.types = types; else delete r.types;
    if(cert) r.cert = cert;
    await saveWEXData();
    // the other year of the same project shares this certificate by gen code — nothing to copy
    try{ logActivity({category:'system', action:'wex_legacy_edited', description:(CU?CU.name:'')+' edited experience record '+r.genCode+' FY '+r.fy+(file?' (certificate uploaded)':'')}); }catch(e){}
    CM('wl-modal');
    toast('✓ Saved'+(file?' — certificate uploaded':''),'ok');
    if(typeof _renderWEXTab==='function') _renderWEXTab(document.getElementById('sec-wex'));
  }catch(e){
    console.error(e);
    r.workValue = before.workValue; r.quantities = before.quantities;
    if(before.types) r.types = before.types; else delete r.types;
    if(before.cert) r.cert = before.cert; else delete r.cert;
    err.textContent = 'NOT saved — '+(e.message||'unknown error')+'. Nothing was changed; please try again.'; err.style.display = 'block';
  }finally{ setBusy(false); btn.disabled = false; }
}
