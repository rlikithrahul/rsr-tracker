// ═══════════════════════════════════════════════════════
// tallyview.js — Tally numbers inside the Projects and Contractors screens (stage 1: ADDED beside the old numbers)
// Nothing here changes Tally, and nothing here changes or deletes any existing project / settlement / release data
// unless Likith presses a confirm button on a "Tally receipt" prompt.
// Data: the tally-api "app_snapshot" action (read-only, built from cost-centre and ledger links; shared items are split equally).
// ═══════════════════════════════════════════════════════

const TV_BASE_KEY = 'rsr_tally_baseline_v1';     // receipts that already existed when this feature started — never flagged
const TV_DEC_KEY  = 'rsr_tally_decisions_v1';    // Likith's answers (confirmed / ignored / "ok as it is" / "not in Tally")
const TV_SW_KEY  = 'rsr_tally_switch_v1';        // {on:true/false} — "use Tally numbers" switch (Super Admin)
const TV_CACHE   = 'rsr_tv_cache_v1';            // last snapshot kept in this browser for a fast, offline-safe first paint (owner/staff only)
let TV = { snap:null, at:0, p:null, base:null, dec:[], err:'', sw:null, relCache:{}, sig:'' };
try{ const c=JSON.parse(localStorage.getItem(TV_CACHE)||'null'); if(c&&c.snap){ TV.snap=c.snap; TV.sw=c.sw||null; TV.sig=_tvSig(c.snap); } }catch(e){}
function _tvSig(s){ return s?((s.last_sync&&(s.last_sync.finished_at||s.last_sync.started_at))||'')+'|'+Object.keys(s.projects||{}).length+'|'+((s.receipt_guids||[]).length):''; }
const tvSwitchOn = () => !!(CU && CU.role==='owner');   // owner / staff: Tally is the ONLY source of payments (Excel-imported entries stay stored but are never shown)
// Tally payments for a linked project (null = use the normal releases). Receipts are NOT included: money received counts only through
// confirmed settlements, exactly as the app already works.
function tvRel(p){
  if(!tvSwitchOn() || !p || !p.tender) return null; const k=String(p.tender);
  if(k in TV.relCache) return TV.relCache[k];
  const t=TV.snap&&TV.snap.projects&&TV.snap.projects[k]; return TV.relCache[k]=t?_tvRelRaw(t):[];   // not linked / not loaded yet: no Excel numbers, just nothing
}
function _tvRelRaw(t){ return t.tx.filter(x=>x.amt<0).map(x=>({id:'tv-'+x.g,date:x.d,amount:-x.amt,method:x.t,txType:'payment',ref:x.n,notes:x.nar||'',costCentre:x.cc||'',source:'tally-live',fromTally:true})); }
function tvRerender(){
  try{ if(typeof atab!=='undefined' && atab===18) return; if(typeof dpid!=='undefined' && dpid && typeof renderDetail==='function') renderDetail(dpid); else if(typeof ownerTab==='function' && typeof atab!=='undefined') ownerTab(atab); }catch(e){ console.warn('tally rerender',e); }
}
async function tvSwitchSet(on){
  const v={on:!!on,at:new Date().toISOString(),by:(CU&&CU.name)||''};
  await saveSetting(TV_SW_KEY,v); TV.sw=v; TV.relCache={}; _tvSave(); tvRerender();
}
function _tvSave(){ try{ localStorage.setItem(TV_CACHE,JSON.stringify({snap:TV.snap,sw:TV.sw})); }catch(e){} }
// numbers that would change if the switch were turned on (computed without turning it on)
function tvImpact(){
  const rows=[]; let linked=0, unlinked=0, oldT=0, newT=0;
  for(const p of (D.projects||[])){ if(isArchived(p)||!p.tender) continue;
    const all=(p.releases||[]).filter(r=>!isArchived(r)); const oldV=all.filter(r=>r.txType!=='receipt').reduce((s,r)=>s+(r.amount||0),0);
    const t=TV.snap&&TV.snap.projects[String(p.tender)]; if(!t){ unlinked++; oldT+=oldV; newT+=oldV; continue; } linked++;
    const manual=all.filter(r=>!(r.source==='tally'||r.source==='tally-manual'||r.source==='tally-fuzzy')&&r.txType!=='receipt').reduce((s,r)=>s+(r.amount||0),0);
    const newV=_tvRelRaw(t).reduce((s,r)=>s+r.amount,0)+manual; oldT+=oldV; newT+=newV;
    if(Math.abs(newV-oldV)>1) rows.push({p,oldV,newV,diff:newV-oldV}); }
  rows.sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff)); return {rows,linked,unlinked,oldT,newT};
}

function _tvE(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function _tvN(n){ return (Number(n)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function _tvD(d){ if(!d) return ''; const p=String(d).split('-'); return p[2]+'-'+p[1]+'-'+p[0]; }
function _tvToday(){ const t=new Date(); return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); }

async function tvLoad(force){
  if(!force && TV.snap && Date.now()-TV.at<5*60000) return TV.snap;
  if(TV.p) return TV.p;
  TV.p=(async()=>{
    try{
      const r=await fetch(SB_URL+'/functions/v1/tally-api',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_KEY,'apikey':SB_KEY},body:JSON.stringify({action:'app_snapshot',fresh:!!force})});
      const j=await r.json(); if(!r.ok) throw new Error(j.error||('Error '+r.status));
      const before=TV.sig; TV.snap=j; TV.at=Date.now(); TV.err=''; TV.relCache={}; TV.sig=_tvSig(j);
      try{ TV.sw=await getSetting(TV_SW_KEY,null); }catch(e){}
      try{ if(typeof tlLoadIntSet==='function') await tlLoadIntSet(); }catch(e){}
      _tvSave();
      if(tvSwitchOn() && before!==TV.sig) setTimeout(tvRerender,0);
      try{ TV.dec=await getSetting(TV_DEC_KEY,[])||[]; }catch(e){ TV.dec=TV.dec||[]; }
      try{ TV.base=await getSetting(TV_BASE_KEY,null); }catch(e){ TV.base=null; }
      // first time ever: the owner freezes today's receipts as "already handled" so old check-received projects are never flagged
      if(!TV.base && CU && CU.isSuperAdmin){
        TV.base={at:new Date().toISOString(), guids:j.receipt_guids||[]};
        try{ await saveSetting(TV_BASE_KEY, TV.base); }catch(e){ TV.base=null; }
      }
    }catch(e){ TV.err=e.message; }   // keep the last synced Tally numbers: nothing changes in Tally unless it is opened, so the last sync is the latest data
    TV.p=null; return TV.snap;
  })();
  return TV.p;
}
const _tvDec = id => (TV.dec||[]).find(d=>d.id===id);
async function tvDecide(id, action, extra){
  const d=Object.assign({id,action,by:(CU&&CU.name)||'',at:new Date().toISOString()},extra||{});
  TV.dec=(TV.dec||[]).filter(x=>x.id!==id).concat([d]);
  try{ TV.dec=await mergeAndSaveSetting(TV_DEC_KEY, TV.dec, true); }catch(e){ toast('Could not save your answer: '+e.message,'error'); }
}

// ───────── interest (24% simple daily on the running balance; accrued interest joins the principal every 31 March) ─────────
function tvInterest(txs, asOn){ // txs: [{d, amt}] amt in Tally sign (Dr negative = paid out = principal up)
  if(typeof tlInterest!=='function' || !txs.length) return null;
  const list=txs.map(t=>({date:t.d,delta:-(Number(t.amt)||0),isInt:tlIsIntText(t.nar)})); const start=list.map(x=>x.date).sort()[0];
  const S=tlIntSet(); return tlInterest(list,0,start,asOn||_tvToday(),null,{set:S,posted:S.autoInt?tlAutoPosted(list):{}});   // a 31-March interest voucher already in Tally is not charged twice
}

// Interest for ONE project from its Tally cost centre (or ledger), as shown on the project page, backup and reports.
//  state: 'noload' (Tally numbers not loaded) | 'notlinked' | 'closed' (settled: shown as 0, atSettle = what it was) | 'open'
function tvProjInterest(p){
  const snap=TV.snap; if(!snap||!snap.projects) return {state:'noload'};
  const t=snap.projects[String(p.tender)]; if(!t||!t.tx||!t.tx.length) return {state:t?'open':'notlinked',amt:0,fy:null};
  const txs=t.tx.map(x=>({d:x.d,amt:x.amt,nar:x.nar}));
  const cl=(typeof _tlProjClosed==='function')?_tlProjClosed(p.tender):{closed:false};
  if(cl.closed){
    const fin=(p.settlements||[]).filter(s=>!isArchived(s)&&s.billType==='Final Bill'&&s.date).map(s=>s.date).sort().pop()||null;
    let at=null, asOn=null; if(fin){ const r=tvInterest(txs,fin); if(r){ at=r.totalInterest; asOn=fin; } }
    return {state:'closed',amt:0,atSettle:at,asOn};
  }
  const r=tvInterest(txs); return {state:'open',amt:r?r.totalInterest:0};
}
function tvIntBoxHtml(p){
  const i=tvProjInterest(p), f=x=>fmt(Math.round(x));
  const row=(v,sub)=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--surface2)"><span style="font-size:12px;color:var(--text2)">Interest (Tally cost centre)</span><span style="font-size:13px;font-weight:700;color:var(--navy)">${v}</span></div>${sub?`<div style="font-size:11px;color:var(--text3);margin-top:4px">${sub}</div>`:''}`;
  const go=`<a href="#" onclick="ownerTab(18);return false" style="color:var(--navy)">📒 Tally Live</a>`;
  if(i.state==='noload') return row('—','Tally numbers not loaded yet.');
  if(i.state==='notlinked') return row('—',`Not linked to a Tally cost centre — link it in ${go}.`);
  if(i.state==='closed') return row('₹0 <span style="font-size:11px;font-weight:600;color:var(--green)">· interest closed</span>',i.atSettle!=null?`Interest at settlement (${i.asOn}): ${f(i.atSettle)}. Details in ${go}.`:`Project is settled. Details in ${go}.`);
  return row(f(i.amt),`24% compounded every 31 March, as of today. Exact transactions: ${go}.`);
}
// Contractor headline "Interest (this FY)" from the contractor's Tally ledger (null = not available)
function tvContInterestFY(c){
  const snap=TV.snap; const t=snap&&snap.contractors&&snap.contractors[c.name]; if(!t||!t.tx||!t.tx.length) return null;
  const r=tvInterest(t.tx.map(x=>({d:x.d,amt:x.amt,nar:x.nar}))); if(!r) return null;
  const lab=_tlFY(_tvToday()); const f=(r.fy||[]).find(x=>x.fy===lab); return f?f.interest:0;
}

// Per-financial-year interest from the contractor's Tally ledger: {'FY 2025-26':{interest}} (empty if not linked / not loaded)
function tvContFyBreakdown(c){
  const snap=TV.snap; const t=snap&&snap.contractors&&snap.contractors[c.name]; const o={}; if(!t||!t.tx||!t.tx.length) return o;
  const r=tvInterest(t.tx.map(x=>({d:x.d,amt:x.amt,nar:x.nar}))); (r&&r.fy||[]).forEach(f=>{ o[f.fy]={interest:f.interest}; }); return o;
}

// ───────── PROJECT PAGE ─────────
function tvProjectShell(id){
  const wrap=document.getElementById('detail-wrap'); if(!wrap || document.getElementById('tv-proj-'+id)) return;
  const html=`<div class="card" id="tv-proj-${id}" style="margin-bottom:14px"><div style="color:var(--text3);font-size:12px">📒 Loading Tally numbers…</div></div>`;
  const grid=wrap.querySelector('.detail-main-grid'); if(grid) grid.insertAdjacentHTML('afterend',html); else wrap.insertAdjacentHTML('beforeend',html);
  tvProjectFill(id);
}
async function tvProjectFill(id){
  const box=document.getElementById('tv-proj-'+id); const p=GP(id); if(!box||!p) return;
  const snap=await tvLoad(); { const ib=document.getElementById('tv-pint-'+id); if(ib) ib.innerHTML=tvIntBoxHtml(p); } if(!document.getElementById('tv-proj-'+id)) return;
  if(!snap){ box.innerHTML=`<div class="st">📒 Tally transactions</div><div style="color:var(--text3);font-size:12px">Tally numbers could not be loaded (${_tvE(TV.err)}). The rest of the page is unaffected.</div>`; return; }
  const t=snap.projects[String(p.tender)];
  if(!t){ box.innerHTML=`<div class="st">📒 Tally transactions</div><div style="color:var(--text3);font-size:12px">This project is not linked to a Tally cost centre or ledger yet${CU&&CU.isSuperAdmin?' — link it in <a href="#" onclick="ownerTab(18);return false" style="color:var(--navy)">Tally Live → Needs linking</a>':''}.</div>`; return; }
  const net=t.paid-t.received, shared=t.tx.some(x=>x.sh>1);
  const it=tvInterest(t.tx.map(x=>({d:x.d,amt:x.amt,nar:x.nar})));
  const attn=tvAttention(p,t);
  box.innerHTML=`<details data-toggle="tv-${id}" ${attn.length?'open':''}><summary style="cursor:pointer;list-style:none;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <div class="st" style="margin:0;border:none;padding:0">📒 Tally transactions <span style="font-size:11px;font-weight:500;color:var(--text3)">(${t.tx.length} entries · live from Tally${snap.last_sync?' · synced '+new Date(snap.last_sync.finished_at||snap.last_sync.started_at).toLocaleString('en-IN'):''})</span></div>
      ${attn.length?`<span class="badge bg-red">${attn.length} to confirm</span>`:''}<span style="margin-left:auto;font-size:11px;font-weight:600;color:var(--navy)">▼ Show / Hide</span></summary>
    <div style="margin-top:10px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:10px">
        ${[['Paid out (Dr)',t.paid],['Received (Cr)',t.received],['Net with RSR',net]].concat(it?[['Interest running (24%)',it.totalInterest],['Principal + interest',it.due]]:[]).map(x=>`<div style="background:var(--surface2);border-radius:8px;padding:8px"><div style="font-size:10px;color:var(--text3)">${x[0]}</div><div style="font-weight:700">₹ ${_tvN(x[1])}</div></div>`).join('')}</div>
      ${shared?`<div class="alert al-amber" style="font-size:12px">Some entries are shared with other projects (same cost centre / ledger). Each project shows an equal share; the full amount is in the second line.</div>`:''}
      <div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>Date</th><th>Voucher</th><th>Ledger / cost centre</th><th>Narration</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th></tr></thead><tbody>
      ${t.tx.map(x=>`<tr><td>${_tvD(x.d)}${x.src==='fy2425'?' <span style="font-size:9px;color:var(--text3)">·24-25</span>':''}</td><td>${_tvE(x.t)} ${_tvE(x.n)}</td><td>${_tvE(x.led)}${x.cc?`<div style="font-size:10px;color:var(--text3)">${_tvE(x.cc)}</div>`:''}</td><td style="max-width:260px">${_tvE(x.nar)}</td>
        <td style="text-align:right">${x.amt<0?_tvN(-x.amt):''}${x.sh>1&&x.amt<0?`<div style="font-size:9px;color:var(--text3)">of ${_tvN(-x.full)} ÷ ${x.sh}</div>`:''}</td><td style="text-align:right">${x.amt>0?_tvN(x.amt):''}${x.sh>1&&x.amt>0?`<div style="font-size:9px;color:var(--text3)">of ${_tvN(x.full)} ÷ ${x.sh}</div>`:''}</td></tr>`).join('')}
      <tr style="font-weight:700;background:var(--surface2)"><td colspan="4">Totals</td><td style="text-align:right">${_tvN(t.paid)}</td><td style="text-align:right">${_tvN(t.received)}</td></tr></tbody></table></div>
      <div style="font-size:11px;color:var(--text3);margin-top:6px">These numbers come straight from Tally and sit beside the old Fund Releases above; nothing above was changed. Interest here uses Tally entries only.</div></div></details>`;
  if(typeof rcRender==='function') rcRender(id);
  if(typeof applyToggleStates==='function') applyToggleStates();
}

// receipts that arrived in Tally after go-live and need Likith's decision
// receipts linked to a settlement: one settlement can hold several receipts (part-bill instalments), one receipt belongs to one settlement
function rcGuids(s){ const a=(s.tvGuids||[]).slice(); if(s.tvGuid && !a.includes(s.tvGuid)) a.unshift(s.tvGuid); return a; }
function rcLinkedMap(p){ const m=new Map(); (p.settlements||[]).filter(s=>!isArchived(s)).forEach(s=>rcGuids(s).forEach(g=>m.set(g,s))); return m; }
const RC_BAND = 0.10;   // a receipt within ±10% of the agreement amount is asked about (Final Bill / Part Bill / not a settlement)
function tvAttention(p,t){
  if(!TV.base) return [];                                            // baseline not frozen yet → flag nothing
  const ag=agAmt(p); if(!(ag>0)) return [];
  if(typeof _tlProjClosed==='function' && _tlProjClosed(p.tender).closed) return [];   // final bill already in: nothing left to ask
  const known=new Set(TV.base.guids||[]); const lm=rcLinkedMap(p);
  const out=[]; const seen=new Set();
  for(const x of t.tx){ if(x.amt<=0 || known.has(x.g) || seen.has(x.g)) continue; seen.add(x.g);
    if(Math.abs(x.amt-ag)>ag*RC_BAND) continue;                      // only a receipt near the agreement amount is likely a settlement
    if(_tvDec('r|'+p.tender+'|'+x.g)) continue;
    if(lm.has(x.g)) continue;
    out.push(x); }
  return out;
}
function tvAttentionHtml(p,list){
  const sets=(p.settlements||[]).filter(s=>!isArchived(s)); const ag=agAmt(p);
  return list.map(x=>{ const k=_tvE(x.g), pid=_tvE(p.id), amt=_tvN(x.amt);
    const pct=Math.round(Math.abs(x.amt-ag)/ag*1000)/10;
    const sc=sets.map(s=>({s,diff:Math.abs((s.amount||0)-x.amt),days:Math.abs((new Date(x.d)-new Date(s.date))/86400000)})).sort((a,b)=>a.diff-b.diff);
    const msg=`Tally shows a receipt of <b>₹ ${amt}</b> on ${_tvD(x.d)} (${_tvE(x.t)} ${_tvE(x.n)}) — within ${pct}% of this project's agreement amount (₹ ${_tvN(ag)}). Is it a settlement?`;
    const link=sc.map((z,i)=>`<button class="btn btn-sm${i===0&&z.diff<=Math.max(1000,(z.s.amount||0)*0.1)&&z.days<=30?' btn-primary':''}" onclick="rcLinkTo('${pid}','${k}','${_tvE(z.s.id)}')">Link to my ${_tvE(z.s.billType||'Final Bill')} ₹ ${_tvN(z.s.amount)} (${_tvD(z.s.date)})</button>`).join('');
    return `<div class="alert al-amber" style="font-size:12px;margin-bottom:8px">${msg}<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn btn-sm btn-primary" onclick="rcRecord('${pid}','${k}','Final Bill')">Yes — Final Bill</button><button class="btn btn-sm" onclick="rcRecord('${pid}','${k}','Part Bill')">Yes — Part Bill</button>${link}<button class="btn btn-sm" onclick="tvReceiptIgnore('${pid}','${k}')">Not a settlement (don't ask again)</button></div></div>`;
  }).join('');
}
function _tvTx(pid,g){ const p=GP(pid); const t=p&&TV.snap&&TV.snap.projects[String(p.tender)]; return {p, x:t&&t.tx.find(y=>y.g===g)}; }
async function tvReceiptIgnore(pid,g){ const {p}=_tvTx(pid,g); if(!p) return; await tvDecide('r|'+p.tender+'|'+g,'ignored'); tvProjectFill(pid); toast('Left as it is','ok'); }
async function tvReceiptAdd(pid,g){ return rcRecord(pid,g,'Final Bill'); }
async function tvReceiptReplace(pid,g,sid){ return rcLinkTo(pid,g,sid); }

// ───────── CONTRACTOR PAGE ─────────
function tvContractorShell(cid){
  const el=document.getElementById('cont-profile'); const c=GC(cid); if(!el||!c||document.getElementById('tv-cont-'+cid)) return;
  const html=`<div class="card" id="tv-cont-${cid}" style="margin:14px 0"><div style="color:var(--text3);font-size:12px">📒 Loading Tally ledger…</div></div>`;
  const first=el.querySelector('.card'); if(first) first.insertAdjacentHTML('afterend',html); else el.insertAdjacentHTML('afterbegin',html);
  tvContractorFill(cid);
}
async function tvContractorFill(cid){
  const box=document.getElementById('tv-cont-'+cid); const c=GC(cid); if(!box||!c) return;
  const snap=await tvLoad(); if(!document.getElementById('tv-cont-'+cid)) return;
  if(!snap){ box.innerHTML=`<div class="st">📒 Tally ledger</div><div style="font-size:12px;color:var(--text3)">Tally numbers could not be loaded (${_tvE(TV.err)}).</div>`; return; }
  const t=snap.contractors[c.name];
  if(!t){ box.innerHTML=`<div class="st">📒 Tally ledger</div><div style="font-size:12px;color:var(--text3)">No Tally ledger is linked to ${_tvE(c.name)} yet${CU&&CU.isSuperAdmin?' — link it in <a href="#" onclick="ownerTab(18);return false" style="color:var(--navy)">Tally Live → Linking</a>':''}.</div>`; return; }
  const it=tvInterest(t.tx); const closing=t.closing;
  box.innerHTML=`<div class="st">📒 Tally ledger <span style="font-size:11px;font-weight:500;color:var(--text3)">(live from Tally${snap.last_sync?' · synced '+new Date(snap.last_sync.finished_at||snap.last_sync.started_at).toLocaleString('en-IN'):''})</span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:8px">
      ${[[closing<0?'Contractor owes RSR (Dr)':'RSR owes contractor (Cr)',Math.abs(closing)]].concat(it?[['Principal incl. compounded interest',it.principal],['Interest not yet compounded',it.accrued],['Total due with interest',it.due],['Total interest charged',it.totalInterest]]:[]).map(x=>`<div style="background:var(--surface2);border-radius:8px;padding:8px"><div style="font-size:10px;color:var(--text3)">${x[0]}</div><div style="font-weight:700">₹ ${_tvN(x[1])}</div></div>`).join('')}</div>
    <div style="font-size:12px;color:var(--text2)">Ledgers: ${t.ledgers.map(l=>_tvE(l.name)+' <span style="color:var(--text3)">('+_tvE(l.role)+', '+_tvN(Math.abs(l.closing))+(l.closing<0?' Dr':' Cr')+')</span>').join(' · ')}</div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">Interest: 24% a year on the whole ledger, simple daily, added to the principal every 31 March, as on today. Calculation only — open <a href="#" onclick="ownerTab(18);return false" style="color:var(--navy)">Tally Live → Interest</a> for details.</div>`;
}

// hook into the existing screens without touching their code
(function(){
  if(typeof renderDetail==='function'){ const o=renderDetail; renderDetail=function(id){ const r=o.apply(this,arguments); try{ tvProjectShell(id); }catch(e){ console.warn('tally view',e); } return r; }; }
  if(typeof renderContractorProfile==='function'){ const o=renderContractorProfile; renderContractorProfile=function(cid){ const r=o.apply(this,arguments); try{ tvContractorShell(cid); }catch(e){ console.warn('tally view',e); } return r; }; }
})();

// keep the numbers fresh for owner / staff only (never for contractor logins: the snapshot covers every contractor)
(function(){ const wait=setInterval(()=>{ if(typeof CU!=='undefined' && CU){ clearInterval(wait); if(CU.role!=='owner'){ TV.snap=null; TV.sw=null; try{ localStorage.removeItem(TV_CACHE); }catch(e){} } if(CU.role==='owner'){ tvLoad(true).catch(()=>{}); setInterval(()=>{ if(document.visibilityState==='visible') tvLoad(true).catch(()=>{}); },5*60000); } } },1000); })();
