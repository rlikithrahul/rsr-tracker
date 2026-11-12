// ═══════════════════════════════════════════════════════
// actlog.js — Activity Log v2 (loads after activity.js, settings.js, db.js)
//  • Records EVERY change made in the web app, in one central place: each project save, contractor save and settings save
//    is compared with what it was before, and the old → new values are written to the log.
//  • Tally-sourced data is NOT logged (Tally imports / syncs). Passwords are never written to the log, only "changed".
//  • Viewer (Settings → Activity Log): tabs "Our side" / "Contractor side", filter by person, category, date, search; Excel export.
// Nothing here ever blocks or fails a save — logging problems are swallowed.
// ═══════════════════════════════════════════════════════

// ── 1. what is NOT logged ──
const ACT_SKIP_SETTINGS = new Set(['rsr_activity_v2','rsr_tv_cache_v1','rsr_session_state_v2','rsr_np_draft_v1','rsr_access_requests_v1',
  'rsr_tally_baseline_v1','rsr_tally_unmatched_v1','rsr_tally_intset_v1','rsr_tally_switch_v1']);
const ACT_SETTING_LABELS = {
  rsr_emi_data_v1:'EMI', rsr_expense_v1:'Expenses', rsr_labour_v1:'Labour', rsr_creditors_v1:'Creditors', rsr_wex_data_v3:'Work Experience',
  rsr_meetings_v1:'Board Meeting', rsr_gst_filer_v1:'GST filer choices', rsr_gst_manual_bills_v1:'GST manual bills', rsr_staff_v1:'Staff logins & access',
  rsr_contractor_extras_v1:'Contractor extras', rsr_contractor_fin_v1:'Contractor finance view', rsr_cheque_log_v1:'Cheque log',
  rsr_cheque_profiles_v1:'Cheque profiles', rsr_tender_docs_v1:'Tender documents', rsr_paytype_v1:'Payment types', rsr_ccledger_v1:'Cost-centre ledger',
  rsr_deleted_bin_v1:'Deleted items', rsr_tally_decisions_v1:'Tally match decisions', rsr_owner_pw_v1:'Main login password',
  rsr_owner_tally_pw_v1:'Tally Live password', rsr_owner_recovery_pw_v1:'Recovery password'
};
const ACT_SECRET_SETTINGS = new Set(['rsr_owner_pw_v1','rsr_owner_tally_pw_v1','rsr_owner_recovery_pw_v1']);
const ACT_SKIP_FIELDS = new Set(['photos','_loadedSnapshot']);
const ACT_SENSITIVE = /pass|pwd|pw$|^pw|secret|token/i;
// Tally-sourced entries that earlier code wrote to the log — no longer written, and hidden when viewing old ones
function actIsTally(e){
  const a = String(e.action||''), c = String(e.category||'');
  return c==='tally' || a.startsWith('tally') || ['daybook_import','import','bulk_import','fund_release','receipt','bulk_date_correction'].includes(a);
}

// ── 2. diff engine ──
function _actVal(v){
  if(v===undefined || v===null || v==='') return '—';
  if(typeof v==='object'){ try{ v = JSON.stringify(v); }catch(e){ return '[object]'; } }
  v = String(v); if(v.startsWith('data:')) return '[file]';
  return v.length>110 ? v.slice(0,110)+'…' : v;
}
function _actHuman(k){ try{ const c=(D.contractors||[]).find(x=>x.id===k)||(D.projects||[]).find(x=>x.id===k); if(c && c.name) return c.name; }catch(e){} return String(k).replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase()); }
function _actItemLabel(o){
  if(!o || typeof o!=='object') return _actVal(o);
  const base = o.name||o.title||o.item||o.desc||o.description||o.label||o.ref||o.vchNo||o.date||o.id||'entry';
  const extra = [];
  if(o.amount!=null && o.amount!=='') extra.push('₹'+Number(o.amount).toLocaleString('en-IN'));
  if(o.date && o.date!==base) extra.push(o.date);
  return String(base).slice(0,60)+(extra.length?' ('+extra.join(', ')+')':'');
}
function _actEq(a,b){
  const e = x => x===undefined || x===null || x==='';
  if(e(a) && e(b)) return true;
  if(typeof a==='object' || typeof b==='object'){ try{ return JSON.stringify(a)===JSON.stringify(b); }catch(x){ return false; } }
  if(a===b) return true;
  if(typeof a==='number' || typeof b==='number'){ const x=Number(a), y=Number(b); return !isNaN(x) && !isNaN(y) && x===y; }
  return false;
}
function actDiff(a, b, path, out, depth){
  out = out || []; path = path || ''; depth = depth||0;
  if(out.length>=60 || depth>7) return out;
  const last = path.split(' › ').pop();
  if(ACT_SENSITIVE.test(last) && !_actEq(a,b)){ out.push({field:path, from:'••••', to:'•••• (changed)'}); return out; }
  const isArr = Array.isArray(a) || Array.isArray(b);
  if(isArr){
    const A = Array.isArray(a)?a:[], B = Array.isArray(b)?b:[];
    const withId = x => x && typeof x==='object' && x.id!=null;
    if(A.concat(B).every(withId)){
      const ma = new Map(A.map(x=>[x.id,x])), mb = new Map(B.map(x=>[x.id,x]));
      for(const [id,x] of mb){ if(out.length>=60) break; if(x.source==='tally') continue;
        if(!ma.has(id)) out.push({field:(path||'List')+' — added', from:'—', to:_actItemLabel(x)});
        else if(!_actEq(ma.get(id),x)) actDiff(ma.get(id), x, (path||'List')+' › '+_actItemLabel(x), out, depth+1); }
      for(const [id,x] of ma){ if(out.length>=60) break; if(x.source==='tally') continue;
        if(!mb.has(id)) out.push({field:(path||'List')+' — removed', from:_actItemLabel(x), to:'—'}); }
      return out;
    }
    if(!_actEq(A,B)) out.push({field:path||'List', from:_actVal(A.length?A:null), to:_actVal(B.length?B:null)});
    return out;
  }
  const oa = a && typeof a==='object', ob = b && typeof b==='object';
  if(oa || ob){
    const o1 = oa?a:{}, o2 = ob?b:{};
    const keys = new Set([...Object.keys(o1), ...Object.keys(o2)]);
    for(const k of keys){
      if(out.length>=60) break;
      if(k.startsWith('_') || ACT_SKIP_FIELDS.has(k)) continue;
      if(_actEq(o1[k], o2[k])) continue;
      actDiff(o1[k], o2[k], (path?path+' › ':'')+_actHuman(k), out, depth+1);
    }
    return out;
  }
  if(!_actEq(a,b)) out.push({field:path||'Value', from:_actVal(a), to:_actVal(b)});
  return out;
}
function _actFinish(ch){ if(ch.length>=60) ch.push({field:'…', from:'', to:'more changes not listed'}); return ch; }

// ── 3. central recording ──
function _actWho(){ return (typeof CU!=='undefined' && CU && CU.name) ? CU.name : 'System'; }
function actRecordRecord(kind, rec, before, after){
  const ch = _actFinish(actDiff(before, after));
  if(!ch.length) return;
  const isProj = kind==='project';
  const cid = isProj ? rec.contractorId : rec.id;
  const cn = (typeof GC==='function' && GC(cid)) ? GC(cid).name : (isProj?'':rec.name);
  const nm = rec.name || (isProj?'Project':'Contractor');
  const short = ch.slice(0,3).map(c=>c.field+': '+c.from+' → '+c.to).join('; ');
  logActivity({
    category:'change', action: isProj?'project_change':'contractor_change',
    projectId: isProj?rec.id:null, projectName: isProj?nm:'', contractorId: cid||null, contractorName: cn||'',
    description: (isProj?'Changed project ':'Changed contractor ')+nm+' — '+ch.length+' field'+(ch.length>1?'s':'')+': '+short+(ch.length>3?' …':''),
    changes: ch
  });
}
function actRecordSetting(key, before, after){
  if(ACT_SECRET_SETTINGS.has(key)){
    return logActivity({category:'change', action:'password_change', description:'Changed '+ACT_SETTING_LABELS[key]});
  }
  const label = ACT_SETTING_LABELS[key] || String(key).replace(/^rsr_/,'').replace(/_v\d+$/,'').replace(/_/g,' ');
  if(before===undefined){ return logActivity({category:'change', action:'setting_change', description:'Changed '+label+' (details unavailable)', meta:{key}}); }
  const ch = _actFinish(actDiff(before, after));
  if(!ch.length) return;
  const short = ch.slice(0,3).map(c=>c.field+': '+c.from+' → '+c.to).join('; ');
  return logActivity({category:'change', action:'setting_change',
    description:'Changed '+label+' — '+ch.length+' change'+(ch.length>1?'s':'')+': '+short+(ch.length>3?' …':''), changes:ch, meta:{key}});
}

// ── 4. hooks (wrap the existing save functions; the originals are untouched) ──
(function(){
  if(typeof saveProjectDB==='function'){
    const o = saveProjectDB;
    saveProjectDB = async function(p, eventMeta){
      let before=null, after=null;
      try{ if(p && !p._isPersonal){ before = p._loadedSnapshot||null; after = (typeof _snapshotRecord==='function')?_snapshotRecord(p):null; } }catch(e){}
      const r = await o.apply(this, arguments);
      try{ if(before && after && !(eventMeta && eventMeta.meta && eventMeta.meta.source==='tally')) actRecordRecord('project', p, before, after); }catch(e){ console.warn('[actlog]',e); }
      return r;
    };
  }
  if(typeof saveContractorDB==='function'){
    const o = saveContractorDB;
    saveContractorDB = async function(c){
      let before=null, after=null;
      try{ if(c){ before = c._loadedSnapshot||null; after = (typeof _snapshotRecord==='function')?_snapshotRecord(c):null; } }catch(e){}
      const r = await o.apply(this, arguments);
      try{ if(before && after) actRecordRecord('contractor', c, before, after); }catch(e){ console.warn('[actlog]',e); }
      return r;
    };
  }
  if(typeof saveSetting==='function'){
    const o = saveSetting;
    saveSetting = async function(key, value){
      let before, track = !ACT_SKIP_SETTINGS.has(key) && !/^rsr_tally_/.test(String(key));
      if(track){ try{ before = ACT_SECRET_SETTINGS.has(key) ? null : await getSetting(key, null); }catch(e){ before = undefined; } }
      const r = await o.apply(this, arguments);
      if(track){ try{ actRecordSetting(key, before, value); }catch(e){ console.warn('[actlog]',e); } }
      return r;
    };
  }
  // never write Tally-sourced entries to the log
  if(typeof logActivity==='function'){
    const o = logActivity;
    logActivity = function(ev){ try{ if(ev && actIsTally(ev)) return Promise.resolve(null); }catch(e){} return o.apply(this, arguments); };
  }
  if(typeof CATEGORY_META!=='undefined') CATEGORY_META.change = { icon:'✏️', label:'Data change', color:'#0f766e' };
})();

// ── 5. viewer ──
const ACTV = { side:'our', person:'all', cat:'all', from:'', to:'', q:'', shown:300, all:[] };
const _aeL = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function _actNormalize(r){
  const meta = typeof r.meta==='string' ? (()=>{ try{ return JSON.parse(r.meta||'{}'); }catch(e){ return {}; } })() : (r.meta||{});
  const t = String(r.type||'');
  const legacy = t.startsWith('activity_');
  const action = meta.action || t.replace(/^act_[a-z]+_?/,'').replace(/^activity_/,'') || t;
  return {
    id:r.id, ts:r.ts, legacy,
    category: legacy ? 'system' : (meta.category || (t.replace('act_','').split('_')[0])),
    action: legacy ? t.replace('activity_','') : action,
    user: r.user_name||r.user||'—',
    userType: legacy ? (meta.isSuperAdmin?'super_admin':'staff') : (meta.userType||'unknown'),
    projectId:r.project_id, projectName:meta.projectName||'', contractorId:r.contractor_id, contractorName:meta.contractorName||'',
    amount:r.amount, ref:r.ref, description:meta.description||r.ref||'', changes:meta.changes||null, meta
  };
}
async function actvFetch(){
  let url = 'ledger_events?or=(type.ilike.act_*,type.ilike.activity_*)&order=ts.desc&limit=2000';
  if(ACTV.from) url += '&ts=gte.'+new Date(ACTV.from+'T00:00:00').toISOString();
  if(ACTV.to)   url += '&ts=lte.'+new Date(ACTV.to+'T23:59:59').toISOString();
  let rows = [];
  try{ rows = (await sbReq(url,'GET'))||[]; }catch(e){ console.warn('[actlog] fetch failed', e); }
  let list = rows.map(_actNormalize);
  // entries that were saved locally but not (yet) in the database
  try{ const key = x=>x.ts+'|'+x.user+'|'+x.action; const have = new Set(list.map(key)); (_loadActivityCache()||[]).forEach(x=>{ if(!have.has(key(x)) && !have.has(x.id)) list.push(x); }); }catch(e){}
  list = list.filter(e=>!actIsTally(e));
  // drop the old-style duplicate of an event that the new log also recorded
  const dupOf = { login:['login'], logout:['logout'], project_create:['create'], project_edit:['edit','project_change'] };
  const newer = list.filter(e=>!e.legacy);
  list = list.filter(e=>{ if(!e.legacy) return true; const m = dupOf[e.action]; if(!m) return true;
    return !newer.some(n=>n.user===e.user && m.includes(n.action) && Math.abs(new Date(n.ts)-new Date(e.ts))<20000 && (n.projectId||null)===(e.projectId||null)); });
  // attach the precise field changes to the "Edited project" entry made at the same moment, instead of listing both
  const explicit = list.filter(e=>e.action==='edit' && !(e.changes&&e.changes.length));
  list = list.filter(e=>{ if(e.action!=='project_change' && e.action!=='contractor_change') return true;
    const host = explicit.find(x=>x.user===e.user && (x.projectId||null)===(e.projectId||null) && Math.abs(new Date(x.ts)-new Date(e.ts))<20000 && !(x.changes&&x.changes.length));
    if(host){ host.changes = e.changes; return false; } return true; });
  list.sort((a,b)=>new Date(b.ts)-new Date(a.ts));
  ACTV.all = list;
}
function _actSideOf(e){
  return (e.userType==='super_admin' || e.userType==='staff' || e.userType==='system' || e.userType==='unknown') ? 'our' : 'contractor';
}
function _actInSide(e){
  if(ACTV.side==='our') return _actSideOf(e)==='our';
  return _actSideOf(e)==='contractor' || !!(e.contractorId || e.contractorName || e.category==='contractor');
}
function _actFiltered(){
  const q = ACTV.q.toLowerCase();
  return ACTV.all.filter(e=>{
    if(!_actInSide(e)) return false;
    if(ACTV.person!=='all' && e.user!==ACTV.person) return false;
    if(ACTV.cat!=='all' && e.category!==ACTV.cat) return false;
    if(q && !((e.description||'')+' '+(e.user||'')+' '+(e.projectName||'')+' '+(e.contractorName||'')+' '+(e.changes||[]).map(c=>c.field+c.from+c.to).join(' ')).toLowerCase().includes(q)) return false;
    return true;
  });
}
async function renderFullActivityLog(){
  const bar = document.getElementById('activity-filter-bar'), box = document.getElementById('activity-log-full');
  if(!bar || !box) return;
  box.style.maxHeight = 'none';
  box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">Loading…</div>';
  await actvFetch();
  actvDraw();
}
function actvSet(k, v){ ACTV[k]=v; if(k==='side') ACTV.person='all'; ACTV.shown=300; if(k==='from'||k==='to'){ renderFullActivityLog(); } else actvDraw(); }
function actvDraw(){
  const bar = document.getElementById('activity-filter-bar'), box = document.getElementById('activity-log-full');
  if(!bar || !box) return;
  const sideAll = ACTV.all.filter(_actInSide);
  const people = {}; sideAll.forEach(e=>{ people[e.user]=(people[e.user]||0)+1; });
  const ppl = Object.entries(people).sort((a,b)=>b[1]-a[1]);
  const tab = (id,label)=>`<button onclick="actvSet('side','${id}')" style="padding:8px 16px;border:none;border-bottom:3px solid ${ACTV.side===id?'var(--navy)':'transparent'};background:none;font-weight:${ACTV.side===id?'800':'600'};font-size:13px;color:${ACTV.side===id?'var(--navy)':'var(--text3)'};cursor:pointer">${label}</button>`;
  const cats = Object.entries(CATEGORY_META);
  const inp = 'padding:6px 9px;border:1px solid var(--border);border-radius:8px;font-size:12px;font-family:inherit';
  bar.innerHTML =
    `<div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:10px">${tab('our','👥 Our side')}${tab('contractor','👷 Contractor side')}</div>
     <div style="font-size:11px;color:var(--text3);margin-bottom:8px">${ACTV.side==='our'?'Everything done by you and your staff.':'Everything done by contractors in their portal, and everything done about contractors by your team.'} Tally syncs are not logged.</div>
     <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
       <button onclick="actvSet('person','all')" style="padding:4px 11px;border-radius:14px;border:1px solid var(--border);font-size:12px;cursor:pointer;background:${ACTV.person==='all'?'var(--navy)':'transparent'};color:${ACTV.person==='all'?'#fff':'var(--text2)'}">Everyone (${sideAll.length})</button>
       ${ppl.map(([n,c])=>`<button onclick="actvSet('person',this.dataset.n)" data-n="${_aeL(n)}" style="padding:4px 11px;border-radius:14px;border:1px solid var(--border);font-size:12px;cursor:pointer;background:${ACTV.person===n?'var(--navy)':'transparent'};color:${ACTV.person===n?'#fff':'var(--text2)'}">${_aeL(n)} (${c})</button>`).join('')}
     </div>
     <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
       <select onchange="actvSet('cat',this.value)" style="${inp}"><option value="all">All types</option>${cats.map(([k,v])=>`<option value="${k}" ${ACTV.cat===k?'selected':''}>${v.icon} ${_aeL(v.label)}</option>`).join('')}</select>
       <label style="font-size:11px;color:var(--text3)">From <input type="date" value="${_aeL(ACTV.from)}" onchange="actvSet('from',this.value)" style="${inp}"></label>
       <label style="font-size:11px;color:var(--text3)">To <input type="date" value="${_aeL(ACTV.to)}" onchange="actvSet('to',this.value)" style="${inp}"></label>
       <input type="text" placeholder="🔍 Search…" value="${_aeL(ACTV.q)}" oninput="ACTV.q=this.value;ACTV.shown=300;actvList()" style="${inp};min-width:180px">
       <button class="btn btn-sm" onclick="actvExport()">⬇ Excel</button>
     </div>`;
  actvList();
}
function actvList(){
  const box = document.getElementById('activity-log-full'); if(!box) return;
  const list = _actFiltered();
  if(!list.length){ box.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">No activity matches.</div>'; return; }
  const groups = {}; list.slice(0,ACTV.shown).forEach(e=>{ const d = new Date(e.ts).toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}); (groups[d]=groups[d]||[]).push(e); });
  let h = `<div style="font-size:11px;color:var(--text3);margin:4px 0 6px">${list.length} entr${list.length===1?'y':'ies'}${ACTV.all.length>=2000?' (newest 2,000 loaded — narrow the dates to see older)':''}</div>`;
  Object.entries(groups).forEach(([d,items])=>{
    h += `<div style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;padding:10px 0 6px;border-bottom:1px solid var(--border)">${_aeL(d)}</div>`;
    items.forEach(e=>{
      const cm = CATEGORY_META[e.category]||CATEGORY_META.general;
      const ubg = e.userType==='super_admin'?'var(--navy)':(e.userType==='contractor'||e.userType==='supervisor')?'#7b3f00':'#4b5563';
      const ch = e.changes||[];
      const rows = ch.map(c=>`<div><span style="color:var(--text3);font-weight:600">${_aeL(c.field)}:</span> <span style="color:var(--red)">${_aeL(c.from)}</span> → <span style="color:#16a34a;font-weight:600">${_aeL(c.to)}</span></div>`);
      const chHtml = !ch.length ? '' : `<div style="margin-top:5px;background:#f8fafc;border-left:3px solid var(--border);padding:4px 8px;border-radius:0 4px 4px 0;font-size:11px">${ch.length>4?`<details><summary style="cursor:pointer;color:var(--text2)">${ch.length} changes — show</summary>${rows.join('')}</details>`:rows.join('')}</div>`;
      h += `<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--surface2);align-items:flex-start">
        <div style="width:30px;height:30px;border-radius:50%;background:${cm.color}22;border:1.5px solid ${cm.color}44;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">${cm.icon}</div>
        <div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:var(--text1);line-height:1.4;margin-bottom:4px">${_aeL(e.description)}</div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:8px;background:${ubg};color:#fff">${_aeL(e.user)}</span>
          <span style="font-size:10px;padding:1px 7px;border-radius:8px;background:${cm.color}22;color:${cm.color};font-weight:600">${_aeL(cm.label)}</span>
          ${e.projectName?`<span style="font-size:10px;color:var(--navy);font-weight:600">${_aeL(e.projectName)}</span>`:''}
          ${e.contractorName&&ACTV.side==='contractor'?`<span style="font-size:10px;color:#7b3f00;font-weight:600">👷 ${_aeL(e.contractorName)}</span>`:''}
          ${e.amount?`<span style="font-size:10px;color:var(--green);font-weight:700">${fmtLog(e.amount)}</span>`:''}
          <span style="font-size:10px;color:var(--text3)">${_aeL(fmtTS(e.ts))}</span></div>${chHtml}</div></div>`;
    });
  });
  if(list.length>ACTV.shown) h += `<div style="text-align:center;padding:12px"><button class="btn btn-sm" onclick="ACTV.shown+=300;actvList()">Show more (${list.length-ACTV.shown} left)</button></div>`;
  box.innerHTML = h;
}
function actvExport(){
  if(!window.XLSX){ toast('Excel not loaded','error'); return; }
  const list = _actFiltered(); const rows = [['Date & time','Side','Person','Type','Project','Contractor','What happened','Field','Old value','New value','Amount']];
  list.forEach(e=>{ const base=[fmtTS(e.ts), _actSideOf(e)==='our'?'Our side':'Contractor side', e.user, (CATEGORY_META[e.category]||{}).label||e.category, e.projectName||'', e.contractorName||'', e.description||''];
    if(e.changes&&e.changes.length) e.changes.forEach(c=>rows.push([...base,c.field,c.from,c.to,e.amount||''])); else rows.push([...base,'','','',e.amount||'']); });
  const ws = window.XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:20},{wch:14},{wch:16},{wch:14},{wch:34},{wch:22},{wch:60},{wch:28},{wch:26},{wch:26},{wch:12}];
  const wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, 'Activity Log');
  window.XLSX.writeFile(wb, `RSR_Activity_Log_${ACTV.side}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
// old entry points kept so nothing else breaks
function applyActivityFilter(){ return renderFullActivityLog(); }
