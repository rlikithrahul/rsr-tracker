// ═══════════════════════════════════════
// receipts.js — Tally receipts on the project page
//
//  • "Receipts from Tally" list: every receipt shows Linked / Not linked, with Link and Unlink.
//    Not every receipt is a settlement (EMD refunds, money from a contractor…), so a receipt stays a
//    plain receipt unless Likith links it.
//  • A receipt within ±10% of the agreement amount is asked about at the TOP of the project page:
//    Final Bill / Part Bill / link to a settlement already recorded / not a settlement.
//  • One settlement can hold several receipts (part-bill instalments); one receipt belongs to only one settlement.
//  • Amounts: a tiny difference (under ₹ 1, i.e. paise) takes the Tally figure silently; anything larger asks.
//    The amount typed by hand is kept in "amountManual" — nothing is ever deleted.
// Settlements, statuses and part bills are never changed except by the buttons below.
// ═══════════════════════════════════════

const RC_PAISE = 1;   // differences below ₹ 1 are treated as paise rounding

function _rcAmt(p,g){ const t=TV.snap&&TV.snap.projects&&TV.snap.projects[String(p.tender)]; const x=t&&t.tx.find(y=>y.g===g); return x||null; }
function _rcBillLabel(s){ return _tvE(s.billType||'Final Bill'); }

// ───────── rendering ─────────
function rcRender(id){
  if(!CU || CU.role!=='owner') return;
  const p=GP(id); const t=p&&TV.snap&&TV.snap.projects&&TV.snap.projects[String(p.tender)]; if(!p||!t) return;
  const anchor=document.getElementById('tv-proj-'+id); if(!anchor) return;
  let card=document.getElementById('tv-rc-'+id);
  if(!card){ anchor.insertAdjacentHTML('afterend',`<div class="card" id="tv-rc-${id}" style="margin-bottom:14px"></div>`); card=document.getElementById('tv-rc-'+id); }
  card.innerHTML=_rcCardHtml(p,t);
  // question banner at the very top of the page
  let ban=document.getElementById('rc-ban-'+id); const attn=tvAttention(p,t);
  if(!attn.length){ if(ban) ban.remove(); }
  else{
    const grid=document.querySelector('#detail-wrap .detail-main-grid');
    if(!ban && grid){ grid.insertAdjacentHTML('beforebegin',`<div id="rc-ban-${id}" style="margin-bottom:12px"></div>`); ban=document.getElementById('rc-ban-'+id); }
    if(ban) ban.innerHTML=`<div style="font-size:13px;font-weight:700;margin-bottom:6px">🧾 A Tally receipt needs your answer</div>`+tvAttentionHtml(p,attn);
  }
  if(typeof applyToggleStates==='function') applyToggleStates();
}
function _rcCardHtml(p,t){
  const lm=rcLinkedMap(p); const rec=t.tx.filter(x=>x.amt>0).sort((a,b)=>String(b.d).localeCompare(String(a.d)));
  if(!rec.length) return `<div class="st" style="margin:0">🧾 Receipts from Tally <span style="font-size:11px;font-weight:500;color:var(--text3)">(none yet)</span></div>`;
  const nl=rec.filter(x=>lm.has(x.g)).length;
  const pid=_tvE(p.id);
  return `<details data-toggle="rc-${pid}"><summary style="cursor:pointer;list-style:none;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <div class="st" style="margin:0;border:none;padding:0">🧾 Receipts from Tally <span style="font-size:11px;font-weight:500;color:var(--text3)">(${rec.length} · ${nl} linked to a settlement · ${rec.length-nl} not linked)</span></div>
      <span style="margin-left:auto;font-size:11px;font-weight:600;color:var(--navy)">▼ Show / Hide</span></summary>
    <div style="font-size:11px;color:var(--text3);margin:8px 0">Not every receipt is a settlement (refunds, money from a contractor…). Link a receipt only when it is payment against a bill. One settlement can take several receipts.</div>
    <div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>Date</th><th>Voucher</th><th>Narration</th><th style="text-align:right">Amount</th><th>Settlement</th><th></th></tr></thead><tbody>
    ${rec.map(x=>{ const s=lm.get(x.g); const k=_tvE(x.g);
      return `<tr><td>${_tvD(x.d)}</td><td>${_tvE(x.t)} ${_tvE(x.n)}</td><td>${_tvE(x.nar||'')}</td><td style="text-align:right">${_tvN(x.amt)}${x.sh>1?`<div style="font-size:9px;color:var(--text3)">share of ${_tvN(x.full)}</div>`:''}</td>
        <td>${s?`<span style="color:var(--green);font-weight:600">✓ ${_rcBillLabel(s)} ₹ ${_tvN(s.amount)}</span><div style="font-size:10px;color:var(--text3)">${_tvD(s.date)}</div>`:'<span style="color:var(--text3)">Not linked</span>'}</td>
        <td style="white-space:nowrap">${s?`<button class="btn btn-sm" onclick="rcUnlink('${pid}','${k}')">Unlink</button>`:`<button class="btn btn-sm" onclick="rcLinkPick('${pid}','${k}')">Link…</button>`}</td></tr>`; }).join('')}
    </tbody></table></div></details>`;
}

// ───────── saving ─────────
async function _rcSave(p,meta,undo){
  try{ await saveProjectDB(p,meta); return true; }
  catch(e){ try{ undo(); }catch(_){} toast('Save failed — nothing was changed','error'); return false; }
}

// ───────── link a receipt to a settlement already recorded ─────────
async function rcLinkTo(pid,g,sid){
  const p=GP(pid); const x=p&&_rcAmt(p,g); if(!p||!x) return;
  const s=(p.settlements||[]).find(z=>z.id===sid&&!isArchived(z)); if(!s) return;
  if(rcLinkedMap(p).has(g)){ toast('This receipt is already linked to a settlement','error'); return; }
  const guids=rcGuids(s).concat([g]);
  const L=guids.reduce((sum,gg)=>{ const y=_rcAmt(p,gg); return sum+(y?y.amt:0); },0);
  const A=Number(s.amount)||0, diff=Math.abs(L-A);
  let useTally=true;
  if(diff>=RC_PAISE){
    const n=guids.length;
    const ch=await tlModal('Amounts do not match',
      `Your ${_rcBillLabel(s)} settlement is <b>₹ ${_tvN(A)}</b> (${_tvD(s.date)}).<br>The linked Tally receipt${n>1?'s total':''} <b>₹ ${_tvN(L)}</b>${n>1?` (${n} receipts)`:''}.<br>Difference: <b>₹ ${_tvN(diff)}</b>.<br><br>Which amount should the settlement use?`,
      [{label:'Cancel',value:'no'},{label:'Keep my ₹ '+_tvN(A),value:'keep'},{label:'Use Tally ₹ '+_tvN(L),value:'tally',primary:true}]);
    if(!ch||ch==='no') return; useTally=ch==='tally';
  }
  const old={tvGuid:s.tvGuid,tvGuids:s.tvGuids?s.tvGuids.slice():undefined,amount:s.amount,amountManual:s.amountManual,tvDate:s.tvDate,tallyRef:s.tallyRef};
  s.tvGuids=guids; if(!s.tvGuid) s.tvGuid=g; if(!s.tvDate) s.tvDate=x.d; if(!s.tallyRef) s.tallyRef=x.n||'';
  if(useTally && Math.abs(L-A)>0.004){ if(s.amountManual==null) s.amountManual=s.amount; s.amount=Math.round(L*100)/100; }
  const ok=await _rcSave(p,{type:'settlement_tally_link',amount:x.amt,ref:x.n||'',meta:{tvGuid:g,settlement:s.id,was:old.amount}},()=>Object.assign(s,old));
  if(!ok) return;
  try{ await tvDecide('r|'+p.tender+'|'+g,'linked'); }catch(e){}
  renderDetail(pid); toast('Receipt linked to the settlement','ok');
}

// ───────── unlink ─────────
async function rcUnlink(pid,g){
  const p=GP(pid); if(!p) return; const s=rcLinkedMap(p).get(g); if(!s) return;
  if(!confirm(`Unlink this receipt from the ${s.billType||'Final Bill'} settlement of ₹ ${_tvN(s.amount)}?\n\nThe settlement itself and its amount stay exactly as they are; only the link is removed.`)) return;
  const old={tvGuid:s.tvGuid,tvGuids:s.tvGuids?s.tvGuids.slice():undefined};
  const rest=rcGuids(s).filter(z=>z!==g);
  s.tvGuids=rest; s.tvGuid=rest[0]||undefined; if(!rest.length){ delete s.tvGuid; }
  const ok=await _rcSave(p,{type:'settlement_tally_unlink',amount:0,ref:'',meta:{tvGuid:g,settlement:s.id}},()=>{ s.tvGuid=old.tvGuid; s.tvGuids=old.tvGuids; });
  if(!ok) return;
  renderDetail(pid); toast('Receipt unlinked','ok');
}

// ───────── pick what to link to ─────────
async function rcLinkPick(pid,g){
  const p=GP(pid); const x=p&&_rcAmt(p,g); if(!p||!x) return;
  const sets=(p.settlements||[]).filter(s=>!isArchived(s));
  const btns=[{label:'Cancel',value:'no'}]
    .concat(sets.map(s=>({label:`Link to ${s.billType||'Final Bill'} ₹ ${_tvN(s.amount)} (${_tvD(s.date)})`,value:'s:'+s.id})))
    .concat([{label:'New Part Bill',value:'part'},{label:'New Final Bill',value:'final',primary:true}]);
  const ch=await tlModal('Link this receipt',
    `Receipt of <b>₹ ${_tvN(x.amt)}</b> on ${_tvD(x.d)} (${_tvE(x.t)} ${_tvE(x.n)}).<br>Link it to a settlement you already recorded, or record a new one from it.`,btns);
  if(!ch||ch==='no') return;
  if(ch==='part') return rcRecord(pid,g,'Part Bill');
  if(ch==='final') return rcRecord(pid,g,'Final Bill');
  if(ch.startsWith('s:')) return rcLinkTo(pid,g,ch.slice(2));
}

// ───────── record a new settlement from a receipt ─────────
async function rcRecord(pid,g,bill){
  const p=GP(pid); const x=p&&_rcAmt(p,g); if(!p||!x) return;
  if(rcLinkedMap(p).has(g)){ toast('This receipt is already linked to a settlement','error'); return; }
  const sets=(p.settlements||[]).filter(s=>!isArchived(s));
  // never create a second entry for money that is already recorded
  const near=sets.find(s=>Math.abs((s.amount||0)-x.amt)<=RC_PAISE && Math.abs((new Date(x.d)-new Date(s.date))/86400000)<=5);
  if(near){
    const ch=await tlModal('Already recorded?',
      `You already have a settlement of <b>₹ ${_tvN(near.amount)}</b> on ${_tvD(near.date)}. This receipt is ₹ ${_tvN(x.amt)} on ${_tvD(x.d)} — it looks like the same money.`,
      [{label:'Cancel',value:'no'},{label:'Record a separate settlement anyway',value:'new'},{label:'Link to the one I have',value:'link',primary:true}]);
    if(!ch||ch==='no') return; if(ch==='link') return rcLinkTo(pid,g,near.id);
  }
  let billType=bill;
  if(bill==='Part Bill'){ const n=sets.filter(s=>/^Part Bill/.test(s.billType||'')).length+1; billType='Part Bill '+Math.min(n,3); }
  if(!confirm(`Record a ${billType} settlement of ₹ ${_tvN(x.amt)} dated ${_tvD(x.d)} (Tally ${x.t} ${x.n}) on "${p.name}"?`)) return;
  if(!p.settlements) p.settlements=[];
  const s={id:uid(),amount:x.amt,date:x.d,mode:'Tally receipt',ref:x.n||'',tallyRef:x.n||'',tvGuid:g,tvGuids:[g],tvDate:x.d,billType,notes:'Confirmed from Tally receipt'+(x.sh>1?' (equal share of ₹ '+_tvN(x.full)+')':''),recordedAt:new Date().toISOString()};
  p.settlements.push(s);
  try{
    await saveProjectDB(p,{type:'settlement',amount:x.amt,ref:x.n||'',meta:{mode:'Tally receipt',notes:s.notes,tvGuid:g,billType}});
    try{ logSettlement(p,x.amt,x.n||'',x.d); }catch(e){}
    if(typeof registerGrowthPoolCollection==='function'){ try{ await registerGrowthPoolCollection(p,s); }catch(e){} }
    try{ await tvDecide('r|'+p.tender+'|'+g,'recorded'); }catch(e){}
    renderDetail(pid); toast('Settlement recorded','ok');
  }catch(e){ p.settlements=p.settlements.filter(z=>z.id!==s.id); toast('Save failed — nothing was changed','error'); }
}
