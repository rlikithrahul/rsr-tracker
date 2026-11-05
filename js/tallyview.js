// ═══════════════════════════════════════════════════════
// tallyview.js — Tally numbers inside the Projects and Contractors screens (stage 1: ADDED beside the old numbers)
// Nothing here changes Tally, and nothing here changes or deletes any existing project / settlement / release data
// unless Likith presses a confirm button on a "Tally receipt" prompt.
// Data: the tally-api "app_snapshot" action (read-only, built from cost-centre and ledger links; shared items are split equally).
// ═══════════════════════════════════════════════════════

const TV_BASE_KEY = 'rsr_tally_baseline_v1';     // receipts that already existed when this feature started — never flagged
const TV_DEC_KEY  = 'rsr_tally_decisions_v1';    // Likith's answers (confirmed / ignored / "ok as it is" / "not in Tally")
let TV = { snap:null, at:0, p:null, base:null, dec:[], err:'' };

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
      TV.snap=j; TV.at=Date.now(); TV.err='';
      try{ TV.dec=await getSetting(TV_DEC_KEY,[])||[]; }catch(e){ TV.dec=TV.dec||[]; }
      try{ TV.base=await getSetting(TV_BASE_KEY,null); }catch(e){ TV.base=null; }
      // first time ever: the owner freezes today's receipts as "already handled" so old check-received projects are never flagged
      if(!TV.base && CU && CU.isSuperAdmin){
        TV.base={at:new Date().toISOString(), guids:j.receipt_guids||[]};
        try{ await saveSetting(TV_BASE_KEY, TV.base); }catch(e){ TV.base=null; }
      }
    }catch(e){ TV.err=e.message; TV.snap=null; }
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
  const list=txs.map(t=>({date:t.d,delta:-(Number(t.amt)||0)})); const start=list.map(x=>x.date).sort()[0];
  return tlInterest(list,0,start,asOn||_tvToday(),24);
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
  const snap=await tvLoad(); if(!document.getElementById('tv-proj-'+id)) return;
  if(!snap){ box.innerHTML=`<div class="st">📒 Tally transactions</div><div style="color:var(--text3);font-size:12px">Tally numbers could not be loaded (${_tvE(TV.err)}). The rest of the page is unaffected.</div>`; return; }
  const t=snap.projects[String(p.tender)];
  if(!t){ box.innerHTML=`<div class="st">📒 Tally transactions</div><div style="color:var(--text3);font-size:12px">This project is not linked to a Tally cost centre or ledger yet${CU&&CU.isSuperAdmin?' — link it in <a href="#" onclick="ownerTab(18);return false" style="color:var(--navy)">Tally Live → Needs linking</a>':''}.</div>`; return; }
  const net=t.paid-t.received, shared=t.tx.some(x=>x.sh>1);
  const it=tvInterest(t.tx.map(x=>({d:x.d,amt:x.amt})));
  const attn=tvAttention(p,t);
  box.innerHTML=`<details data-toggle="tv-${id}" ${attn.length?'open':''}><summary style="cursor:pointer;list-style:none;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <div class="st" style="margin:0;border:none;padding:0">📒 Tally transactions <span style="font-size:11px;font-weight:500;color:var(--text3)">(${t.tx.length} entries · live from Tally${snap.last_sync?' · synced '+new Date(snap.last_sync.finished_at||snap.last_sync.started_at).toLocaleString('en-IN'):''})</span></div>
      ${attn.length?`<span class="badge bg-red">${attn.length} to confirm</span>`:''}<span style="margin-left:auto;font-size:11px;font-weight:600;color:var(--navy)">▼ Show / Hide</span></summary>
    <div style="margin-top:10px">${attn.length?tvAttentionHtml(p,attn):''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:10px">
        ${[['Paid out (Dr)',t.paid],['Received (Cr)',t.received],['Net with RSR',net]].concat(it?[['Interest running (24%)',it.totalInterest],['Principal + interest',it.due]]:[]).map(x=>`<div style="background:var(--surface2);border-radius:8px;padding:8px"><div style="font-size:10px;color:var(--text3)">${x[0]}</div><div style="font-weight:700">₹ ${_tvN(x[1])}</div></div>`).join('')}</div>
      ${shared?`<div class="alert al-amber" style="font-size:12px">Some entries are shared with other projects (same cost centre / ledger). Each project shows an equal share; the full amount is in the second line.</div>`:''}
      <div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>Date</th><th>Voucher</th><th>Ledger / cost centre</th><th>Narration</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th></tr></thead><tbody>
      ${t.tx.map(x=>`<tr><td>${_tvD(x.d)}${x.src==='fy2425'?' <span style="font-size:9px;color:var(--text3)">·24-25</span>':''}</td><td>${_tvE(x.t)} ${_tvE(x.n)}</td><td>${_tvE(x.led)}${x.cc?`<div style="font-size:10px;color:var(--text3)">${_tvE(x.cc)}</div>`:''}</td><td style="max-width:260px">${_tvE(x.nar)}</td>
        <td style="text-align:right">${x.amt<0?_tvN(-x.amt):''}${x.sh>1&&x.amt<0?`<div style="font-size:9px;color:var(--text3)">of ${_tvN(-x.full)} ÷ ${x.sh}</div>`:''}</td><td style="text-align:right">${x.amt>0?_tvN(x.amt):''}${x.sh>1&&x.amt>0?`<div style="font-size:9px;color:var(--text3)">of ${_tvN(x.full)} ÷ ${x.sh}</div>`:''}</td></tr>`).join('')}
      <tr style="font-weight:700;background:var(--surface2)"><td colspan="4">Totals</td><td style="text-align:right">${_tvN(t.paid)}</td><td style="text-align:right">${_tvN(t.received)}</td></tr></tbody></table></div>
      <div style="font-size:11px;color:var(--text3);margin-top:6px">These numbers come straight from Tally and sit beside the old Fund Releases above; nothing above was changed. Interest here uses Tally entries only.</div></div></details>`;
  if(typeof applyToggleStates==='function') applyToggleStates();
}

// receipts that arrived in Tally after go-live and need Likith's decision
function tvAttention(p,t){
  if(!TV.base) return [];                                            // baseline not frozen yet → flag nothing
  const known=new Set(TV.base.guids||[]); const sets=(p.settlements||[]).filter(s=>!isArchived(s));
  const out=[]; const seen=new Set();
  for(const x of t.tx){ if(x.amt<=0 || known.has(x.g) || seen.has(x.g)) continue; seen.add(x.g);
    if(_tvDec('r|'+p.tender+'|'+x.g)) continue;
    if(sets.some(s=>s.tvGuid===x.g)) continue;
    out.push(x); }
  return out;
}
function tvAttentionHtml(p,list){
  const sets=(p.settlements||[]).filter(s=>!isArchived(s)); const manual=sets.filter(s=>!s.tvGuid);
  const pending=!!p.jvDate && !sets.length;
  return list.map(x=>{ const k=_tvE(x.g), pid=_tvE(p.id), amt=_tvN(x.amt);
    let msg, btns='';
    if(pending){ msg=`Tally shows a receipt of <b>₹ ${amt}</b> on ${_tvD(x.d)} (${_tvE(x.t)} ${_tvE(x.n)}). This project is <b>check pending</b>. Is this the check received?`;
      btns=`<button class="btn btn-sm btn-primary" onclick="tvReceiptAdd('${pid}','${k}')">Yes — mark check received</button>`; }
    else if(manual.length){ msg=`Tally shows a receipt of <b>₹ ${amt}</b> on ${_tvD(x.d)} (${_tvE(x.t)} ${_tvE(x.n)}). You already recorded a settlement by hand. Replace your manual amount with the Tally receipt?`;
      btns=manual.map(s=>`<button class="btn btn-sm btn-primary" onclick="tvReceiptReplace('${pid}','${k}','${_tvE(s.id)}')">Yes — replace my ₹ ${_tvN(s.amount)} (${_tvD(s.date)})</button>`).join('')+`<button class="btn btn-sm" onclick="tvReceiptAdd('${pid}','${k}')">No — it is an additional receipt</button>`; }
    else { msg=`Tally shows a receipt of <b>₹ ${amt}</b> on ${_tvD(x.d)} (${_tvE(x.t)} ${_tvE(x.n)}).`; btns=`<button class="btn btn-sm" onclick="tvReceiptAdd('${pid}','${k}')">Record as a settlement</button>`; }
    return `<div class="alert al-amber" style="font-size:12px;margin-bottom:8px">${msg}<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${btns}<button class="btn btn-sm" onclick="tvReceiptIgnore('${pid}','${k}')">Leave it as it is (don't ask again)</button></div></div>`; }).join('');
}
function _tvTx(pid,g){ const p=GP(pid); const t=p&&TV.snap&&TV.snap.projects[String(p.tender)]; return {p, x:t&&t.tx.find(y=>y.g===g)}; }
async function tvReceiptIgnore(pid,g){ const {p}=_tvTx(pid,g); if(!p) return; await tvDecide('r|'+p.tender+'|'+g,'ignored'); tvProjectFill(pid); toast('Left as it is','ok'); }
async function tvReceiptAdd(pid,g){
  const {p,x}=_tvTx(pid,g); if(!p||!x) return;
  if(!confirm(`Record a settlement of ₹ ${_tvN(x.amt)} dated ${_tvD(x.d)} (Tally ${x.t} ${x.n}) on "${p.name}"?`)) return;
  if(!p.settlements) p.settlements=[];
  const s={id:uid(),amount:x.amt,date:x.d,mode:'Tally receipt',ref:x.n||'',tallyRef:x.n||'',tvGuid:g,billType:'Final Bill',notes:'Confirmed from Tally receipt'+(x.sh>1?' (equal share of ₹ '+_tvN(x.full)+')':''),recordedAt:new Date().toISOString()};
  p.settlements.push(s);
  try{ await saveProjectDB(p,{type:'settlement',amount:x.amt,ref:x.n||'',meta:{mode:'Tally receipt',notes:s.notes,tvGuid:g}});
    try{ logSettlement(p,x.amt,x.n||'',x.d); }catch(e){}
    if(typeof registerGrowthPoolCollection==='function'){ try{ await registerGrowthPoolCollection(p,s); }catch(e){} }
    await tvDecide('r|'+p.tender+'|'+g,'recorded'); renderDetail(pid); toast('Settlement recorded','ok');
  }catch(e){ p.settlements=p.settlements.filter(z=>z.id!==s.id); toast('Save failed — nothing was changed','error'); }
}
async function tvReceiptReplace(pid,g,sid){
  const {p,x}=_tvTx(pid,g); if(!p||!x) return; const s=(p.settlements||[]).find(z=>z.id===sid); if(!s) return;
  if(!confirm(`Replace your manual settlement of ₹ ${_tvN(s.amount)} (${_tvD(s.date)}) with the Tally receipt of ₹ ${_tvN(x.amt)} (${_tvD(x.d)}, ${x.t} ${x.n})?\n\nYour old amount is kept in the record as "amountManual".`)) return;
  const old={amount:s.amount,date:s.date,tallyRef:s.tallyRef,amountManual:s.amountManual,tvGuid:s.tvGuid,tvDate:s.tvDate};
  if(s.amountManual==null) s.amountManual=s.amount; s.amount=x.amt; s.tvGuid=g; s.tvDate=x.d; s.tallyRef=x.n||s.tallyRef||'';
  try{ await saveProjectDB(p,{type:'settlement_tally_replace',amount:x.amt,ref:x.n||'',meta:{was:old.amount,tvGuid:g}});
    await tvDecide('r|'+p.tender+'|'+g,'replaced'); renderDetail(pid); toast('Settlement now matches Tally','ok');
  }catch(e){ Object.assign(s,old); toast('Save failed — nothing was changed','error'); }
}

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
