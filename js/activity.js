// ═══════════════════════════════════════════════════════
// activity.js — RSR Constructions Tracker
// Professional Activity Log System
// Tracks: logins, project changes (with diffs), fund releases,
//         settlements, BOQ edits, Tally imports, contractor actions
// ═══════════════════════════════════════════════════════

// ─── IN-MEMORY LOG (fallback + cache) ────────────────
// We keep a local array in case Supabase write fails
// This survives page reload via localStorage
const ACTIVITY_STORE_KEY = 'rsr_activity_v2';
let _activityCache = null;

function _loadActivityCache(){
  if(_activityCache) return _activityCache;
  try{ _activityCache = JSON.parse(localStorage.getItem(ACTIVITY_STORE_KEY)||'[]'); }
  catch(e){ _activityCache = []; }
  return _activityCache;
}

function _saveActivityCache(entries){
  _activityCache = entries;
  try{ localStorage.setItem(ACTIVITY_STORE_KEY, JSON.stringify(entries.slice(0,500))); }
  catch(e){}
}

// ─── CORE LOG WRITER ─────────────────────────────────
async function logActivity(event){
  const now = new Date().toISOString();
  const user = (typeof CU !== 'undefined' && CU) ? CU.name : (event.user||'System');
  const isSuperAdmin = (typeof CU !== 'undefined' && CU) ? !!CU.isSuperAdmin : false;
  const isStaff = (typeof CU !== 'undefined' && CU) ? (!CU.isSuperAdmin && !CU.isContractor) : false;
  const isContractor = (typeof CU !== 'undefined' && CU) ? !!CU.isContractor : false;

  const entry = {
    id: (typeof uid==='function') ? uid() : Math.random().toString(36).slice(2),
    ts: event.ts || now,
    category: event.category || 'general',  // login | project | finance | tally | contractor | system
    action: event.action || 'unknown',       // e.g. 'fund_release', 'project_edit', 'login'
    user,
    userType: isSuperAdmin?'super_admin':isStaff?'staff':isContractor?'contractor':'system',
    projectId: event.projectId||null,
    projectName: event.projectName||null,
    contractorId: event.contractorId||null,
    contractorName: event.contractorName||null,
    amount: event.amount||null,
    ref: event.ref||null,
    description: event.description||'',
    changes: event.changes||null,  // [{field, from, to}]
    meta: event.meta||{}
  };

  // 1. Save to local cache immediately (never fails)
  const cache = _loadActivityCache();
  cache.unshift(entry);
  _saveActivityCache(cache.slice(0,500));

  // 2. Try to write to Supabase (non-blocking)
  if(typeof dbOK !== 'undefined' && dbOK && typeof appendLedgerEvent === 'function'){
    appendLedgerEvent({
      projectId: entry.projectId,
      contractorId: entry.contractorId,
      type: 'act_'+entry.category+'_'+entry.action,
      amount: entry.amount||0,
      ref: entry.ref||null,
      ts: entry.ts,
      user: entry.user,
      meta: {
        category: entry.category,
        action: entry.action,
        userType: entry.userType,
        description: entry.description,
        projectName: entry.projectName,
        contractorName: entry.contractorName,
        changes: entry.changes,
        ...entry.meta
      }
    }).catch(()=>{});
  }

  return entry;
}

// ─── SPECIFIC LOGGERS ────────────────────────────────

function logLogin(userName, userType, contractorName){
  return logActivity({
    category:'login', action:'login',
    user: userName,
    description: userName+' logged in'+(contractorName?' (Contractor: '+contractorName+')':''),
    contractorName: contractorName||null,
    meta:{ userType }
  });
}

function logLogout(userName){
  return logActivity({
    category:'login', action:'logout',
    user: userName,
    description: userName+' logged out'
  });
}

function logProjectView(p){
  if(!p) return;
  return logActivity({
    category:'project', action:'view',
    projectId:p.id, projectName:p.name,
    contractorId:p.contractorId,
    description:'Viewed project: '+p.name
  });
}

function logProjectEdit(pid, pname, changes){
  // changes: [{field, from, to}]
  const desc = changes && changes.length
    ? changes.map(c=>c.field+': "'+c.from+'" → "'+c.to+'"').join(', ')
    : 'Project updated';
  return logActivity({
    category:'project', action:'edit',
    projectId:pid, projectName:pname,
    changes,
    description:'Edited '+pname+': '+desc
  });
}

function logFundRelease(p, amount, ref, txType){
  const isReceipt = txType==='receipt';
  return logActivity({
    category:'finance', action: isReceipt?'receipt':'fund_release',
    projectId:p.id, projectName:p.name,
    contractorId:p.contractorId,
    amount,
    ref,
    description:(isReceipt?'Receipt':'Fund release')+' of '+fmtLog(amount)+' for '+p.name+(ref?' (Vch #'+ref+')':'')
  });
}

function logSettlement(p, amount, ref, date){
  return logActivity({
    category:'finance', action:'settlement',
    projectId:p.id, projectName:p.name,
    contractorId:p.contractorId,
    amount, ref,
    description:'Settlement recorded: '+fmtLog(amount)+' for '+p.name+' on '+date+(ref?' ('+ref+')':'')
  });
}

function logBOQEdit(p, itemName, from, to){
  return logActivity({
    category:'project', action:'boq_edit',
    projectId:p.id, projectName:p.name,
    contractorId:p.contractorId,
    description:'BOQ updated in '+p.name+': '+itemName+' qty '+from+' → '+to,
    changes:[{field:'BOQ: '+itemName, from:String(from), to:String(to)}]
  });
}

function logTallyImport(projectName, projectId, txCount, amount){
  return logActivity({
    category:'tally', action:'import',
    projectId, projectName,
    amount,
    description:'Tally import: '+txCount+' transactions ('+fmtLog(amount)+') → '+projectName
  });
}

function logTallyBulkImport(count, totalAmount){
  return logActivity({
    category:'tally', action:'bulk_import',
    description:'Tally daybook imported: '+count+' transactions, total '+fmtLog(totalAmount)
  });
}

function logJVUpdate(p, jvDate, jvNumber, jvAmount){
  return logActivity({
    category:'project', action:'jv_update',
    projectId:p.id, projectName:p.name,
    amount:jvAmount,
    ref:jvNumber,
    description:'JV updated for '+p.name+': Date '+jvDate+', #'+jvNumber+', Amount '+fmtLog(jvAmount)
  });
}

function logVerification(p, verifiedBy, verifiedPct){
  return logActivity({
    category:'project', action:'verification',
    projectId:p.id, projectName:p.name,
    description:'Verification submitted for '+p.name+' by '+verifiedBy+' ('+verifiedPct+'%)'
  });
}

function logContractorAction(action, contractorName, contractorId, description){
  return logActivity({
    category:'contractor', action,
    contractorId, contractorName,
    description
  });
}

function logGSTAction(action, firmName, period, description){
  return logActivity({
    category:'gst', action,
    description: description || 'GST '+action+' for '+firmName+' ('+period+')',
    meta:{ firmName, period }
  });
}

function fmtLog(amt){
  if(!amt) return '₹0';
  return '₹'+Number(amt).toLocaleString('en-IN');
}

// ─── ACTIVITY LOG READER ─────────────────────────────
async function fetchActivityLog(options){
  // options: { category, userType, projectId, contractorId, limit, from, to }
  const opts = options||{};
  const limit = opts.limit||500;

  let entries = [];

  // Try Supabase first
  try{
    if(typeof dbOK !== 'undefined' && dbOK && typeof sbReq === 'function'){
      let url = 'ledger_events?type=ilike.act_*&order=ts.desc&limit='+limit;
      if(opts.projectId) url += '&project_id=eq.'+opts.projectId;
      if(opts.contractorId) url += '&contractor_id=eq.'+opts.contractorId;
      const rows = await sbReq(url, 'GET');
      if(rows && rows.length){
        entries = rows.map(r=>{
          const meta = typeof r.meta==='string'?JSON.parse(r.meta||'{}'):r.meta||{};
          return {
            id: r.id,
            ts: r.ts,
            category: meta.category || r.type.replace('act_','').split('_')[0],
            action: meta.action || r.type.replace('act_',''),
            user: r.user_name||r.user||'—',
            userType: meta.userType||'unknown',
            projectId: r.project_id,
            projectName: meta.projectName||'',
            contractorId: r.contractor_id,
            contractorName: meta.contractorName||'',
            amount: r.amount,
            ref: r.ref,
            description: meta.description||r.ref||'',
            changes: meta.changes||null,
            meta
          };
        });
        // Also merge local cache for recent ones not yet in Supabase
        const localCache = _loadActivityCache();
        const supaIds = new Set(entries.map(e=>e.id));
        const localOnly = localCache.filter(e=>!supaIds.has(e.id));
        entries = [...localOnly, ...entries].sort((a,b)=>new Date(b.ts)-new Date(a.ts));
      }
    }
  }catch(e){
    console.warn('Activity log fetch from Supabase failed, using local cache');
  }

  // Fallback to local cache
  if(!entries.length){
    entries = _loadActivityCache();
  }

  // Apply filters
  if(opts.category && opts.category !== 'all'){
    entries = entries.filter(e=>e.category===opts.category);
  }
  if(opts.userType && opts.userType !== 'all'){
    entries = entries.filter(e=>e.userType===opts.userType);
  }
  if(opts.projectId){
    entries = entries.filter(e=>e.projectId===opts.projectId);
  }
  if(opts.contractorId){
    entries = entries.filter(e=>e.contractorId===opts.contractorId);
  }
  if(opts.from){
    entries = entries.filter(e=>new Date(e.ts)>=new Date(opts.from));
  }
  if(opts.to){
    entries = entries.filter(e=>new Date(e.ts)<=new Date(opts.to));
  }

  return entries.slice(0, limit);
}

// ─── ACTIVITY LOG RENDERER ────────────────────────────
const CATEGORY_META = {
  login:      { icon:'🔐', label:'Login / Logout', color:'#6366f1' },
  project:    { icon:'🏗️', label:'Project Activity', color:'var(--navy)' },
  finance:    { icon:'💰', label:'Finance', color:'#16a34a' },
  tally:      { icon:'📂', label:'Tally Import', color:'#f59e0b' },
  contractor: { icon:'👷', label:'Contractor', color:'#7b3f00' },
  gst:        { icon:'🧾', label:'GST', color:'#0891b2' },
  system:     { icon:'⚙️', label:'System', color:'var(--text3)' },
  general:    { icon:'📋', label:'General', color:'var(--text2)' }
};

function timeAgo(ts){
  const diff = (new Date()-new Date(ts))/1000;
  if(diff<60) return Math.round(diff)+'s ago';
  if(diff<3600) return Math.round(diff/60)+'m ago';
  if(diff<86400) return Math.round(diff/3600)+'h ago';
  if(diff<604800) return Math.round(diff/86400)+'d ago';
  return new Date(ts).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
}

function fmtTS(ts){
  return new Date(ts).toLocaleString('en-IN',{
    day:'2-digit', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit', hour12:true
  });
}

async function renderActivityLog(containerId, options){
  const el = document.getElementById(containerId);
  if(!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">Loading activity log…</div>';

  const entries = await fetchActivityLog(options||{});

  if(!entries.length){
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">No activity recorded yet.</div>';
    return;
  }

  // Group by date
  const groups = {};
  entries.forEach(e=>{
    const date = new Date(e.ts).toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
    if(!groups[date]) groups[date]=[];
    groups[date].push(e);
  });

  let html = '';
  Object.entries(groups).forEach(([date, items])=>{
    html += '<div style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;padding:12px 0 6px;border-bottom:1px solid var(--border);margin-bottom:8px">'+date+'</div>';
    items.forEach(e=>{
      const cm = CATEGORY_META[e.category]||CATEGORY_META.general;
      const userBg = e.userType==='super_admin'?'var(--navy)':e.userType==='contractor'?'#7b3f00':'#4b5563';
      html += '<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--surface2);align-items:flex-start">'
        // Icon
        +'<div style="width:32px;height:32px;border-radius:50%;background:'+cm.color+'22;border:1.5px solid '+cm.color+'44;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">'+cm.icon+'</div>'
        // Content
        +'<div style="flex:1;min-width:0">'
        +'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px">'
        +'<span style="font-size:12px;font-weight:700;color:var(--text1)">'+e.description+'</span>'
        +'</div>'
        +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:3px">'
        +'<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:8px;background:'+userBg+';color:#fff">'+e.user+'</span>'
        +'<span style="font-size:10px;padding:1px 7px;border-radius:8px;background:'+cm.color+'22;color:'+cm.color+';font-weight:600">'+cm.label+'</span>'
        +(e.amount?'<span style="font-size:10px;color:var(--green);font-weight:700">'+fmtLog(e.amount)+'</span>':'')
        +(e.ref?'<span style="font-size:10px;color:var(--text3)">Ref: '+e.ref+'</span>':'')
        +'<span style="font-size:10px;color:var(--text3)" title="'+fmtTS(e.ts)+'">'+timeAgo(e.ts)+'</span>'
        +'</div>'
        // Changes diff
        +(e.changes && e.changes.length
          ? '<div style="margin-top:6px;background:var(--surface2);border-radius:6px;padding:6px 10px;font-size:11px">'
            +e.changes.map(c=>'<div><span style="color:var(--text3)">'+c.field+':</span> '
              +'<span style="color:var(--red);text-decoration:line-through">'+c.from+'</span>'
              +' → <span style="color:var(--green);font-weight:600">'+c.to+'</span></div>').join('')
            +'</div>'
          : '')
        +'</div>'
        +'</div>';
    });
  });

  el.innerHTML = html;
}

// ─── FULL SETTINGS ACTIVITY LOG PANEL ────────────────
let actLogFilter = { category:'all', userType:'all', search:'' };

async function renderFullActivityLog(){
  const container = document.getElementById('activity-log-full');
  if(!container) return;

  // Filter bar
  const filterBar = document.getElementById('activity-filter-bar');
  if(filterBar){
    filterBar.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
      +'<select id="act-cat-filter" onchange="applyActivityFilter()" style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--rs);font-family:\'Inter\',sans-serif;font-size:12px">'
      +'<option value="all">All Categories</option>'
      +Object.entries(CATEGORY_META).map(([k,v])=>'<option value="'+k+'">'+(v.icon)+' '+v.label+'</option>').join('')
      +'</select>'
      +'<select id="act-user-filter" onchange="applyActivityFilter()" style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--rs);font-family:\'Inter\',sans-serif;font-size:12px">'
      +'<option value="all">All Users</option>'
      +'<option value="super_admin">Super Admin</option>'
      +'<option value="staff">Staff</option>'
      +'<option value="contractor">Contractor</option>'
      +'</select>'
      +'<input type="text" id="act-search" placeholder="🔍 Search activity…" oninput="applyActivityFilter()" '
      +'style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--rs);font-family:\'Inter\',sans-serif;font-size:12px;min-width:200px">'
      +'<button onclick="applyActivityFilter()" style="padding:6px 12px;background:var(--navy);color:#fff;border:none;border-radius:var(--rs);font-size:12px;font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif">Refresh</button>'
      +'<button onclick="clearActivityLog()" style="padding:6px 12px;background:none;border:1px solid var(--border);border-radius:var(--rs);font-size:11px;color:var(--text3);cursor:pointer;font-family:\'Inter\',sans-serif">Clear Local Cache</button>'
      +'</div>';
  }

  await applyActivityFilter();
}

async function applyActivityFilter(){
  const catEl = document.getElementById('act-cat-filter');
  const userEl = document.getElementById('act-user-filter');
  const searchEl = document.getElementById('act-search');
  actLogFilter.category = catEl?.value||'all';
  actLogFilter.userType = userEl?.value||'all';
  actLogFilter.search = (searchEl?.value||'').toLowerCase();

  const container = document.getElementById('activity-log-full');
  if(!container) return;
  container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">Loading…</div>';

  let entries = await fetchActivityLog({
    category: actLogFilter.category!=='all'?actLogFilter.category:null,
    userType: actLogFilter.userType!=='all'?actLogFilter.userType:null,
    limit: 300
  });

  // Apply search
  if(actLogFilter.search){
    entries = entries.filter(e=>
      (e.description||'').toLowerCase().includes(actLogFilter.search)||
      (e.user||'').toLowerCase().includes(actLogFilter.search)||
      (e.projectName||'').toLowerCase().includes(actLogFilter.search)||
      (e.contractorName||'').toLowerCase().includes(actLogFilter.search)
    );
  }

  if(!entries.length){
    container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">No activity matching your filters.</div>';
    return;
  }

  // Render with stats bar
  const stats = {};
  entries.forEach(e=>{ stats[e.category]=(stats[e.category]||0)+1; });
  const statsHtml = Object.entries(stats).map(([k,v])=>{
    const cm = CATEGORY_META[k]||CATEGORY_META.general;
    return '<span style="font-size:11px;background:'+cm.color+'22;color:'+cm.color+';padding:2px 8px;border-radius:10px;font-weight:600">'+cm.icon+' '+v+' '+cm.label+'</span>';
  }).join('');

  // Group by date
  const groups = {};
  entries.forEach(e=>{
    const date = new Date(e.ts).toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
    if(!groups[date]) groups[date]=[];
    groups[date].push(e);
  });

  let html = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)">'+statsHtml+'</div>';

  Object.entries(groups).forEach(([date, items])=>{
    html += '<div style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;padding:10px 0 6px;border-bottom:1px solid var(--border);margin-bottom:6px">'+date+' <span style="font-weight:500">('+items.length+')</span></div>';
    items.forEach(e=>{
      const cm = CATEGORY_META[e.category]||CATEGORY_META.general;
      const userBg = e.userType==='super_admin'?'var(--navy)':e.userType==='contractor'?'#7b3f00':'#4b5563';
      html += '<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--surface2);align-items:flex-start">'
        +'<div style="width:30px;height:30px;border-radius:50%;background:'+cm.color+'22;border:1.5px solid '+cm.color+'44;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">'+cm.icon+'</div>'
        +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:12px;font-weight:600;color:var(--text1);line-height:1.4;margin-bottom:4px">'+e.description+'</div>'
        +'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
        +'<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:8px;background:'+userBg+';color:#fff">'+e.user+'</span>'
        +'<span style="font-size:10px;padding:1px 7px;border-radius:8px;background:'+cm.color+'22;color:'+cm.color+';font-weight:600">'+cm.label+'</span>'
        +(e.projectName?'<span style="font-size:10px;color:var(--navy);font-weight:600">'+e.projectName.substring(0,30)+(e.projectName.length>30?'…':'')+'</span>':'')
        +(e.amount?'<span style="font-size:10px;color:var(--green);font-weight:700">'+fmtLog(e.amount)+'</span>':'')
        +'<span style="font-size:10px;color:var(--text3)" title="'+fmtTS(e.ts)+'">'+timeAgo(e.ts)+'</span>'
        +'</div>'
        +(e.changes && e.changes.length
          ? '<div style="margin-top:5px;background:#f8fafc;border-left:3px solid var(--border);padding:4px 8px;border-radius:0 4px 4px 0;font-size:11px">'
            +e.changes.map(c=>'<div><span style="color:var(--text3);font-weight:600">'+c.field+':</span> '
              +'<span style="color:var(--red)">'+c.from+'</span> → <span style="color:#16a34a;font-weight:600">'+c.to+'</span></div>').join('')
            +'</div>'
          : '')
        +'</div></div>';
    });
  });

  container.innerHTML = html;
}

function clearActivityLog(){
  if(!confirm('Clear local activity log cache? This only removes the local copy — Supabase data is unchanged.')) return;
  _activityCache = [];
  localStorage.removeItem(ACTIVITY_STORE_KEY);
  applyActivityFilter();
  if(typeof toast==='function') toast('Local cache cleared','ok');
}
