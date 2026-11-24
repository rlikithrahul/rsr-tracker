// ═══════════════════════════════════════════════════════
// settlement.js — "Settlement by bills": its own page, opened from the contractor profile (Super Admin only, switched on per contractor)
//
// For contractors whose old payments carry no cost centres. For every bill received, in date order, his payments (minus the other receipts —
// refunds, transfers, cheques) are fetched oldest-first until they make up the bill's % (70% to start, changeable per bill) of the BILL AMOUNT
// (nothing is clubbed into the bill amount). Interest is added to each payment (24%, compounded on 31 March, payment day and bill day counted,
// 365-day year) up to the bill date. Due to contractor = bill amount − net payments fetched − interest.
// Tender cost centres can be left out or included. Pending JVs take the payments of their own cost centres only.
// Payments/receipts nobody needs yet are "Open". New Tally entries drop into place by date; only what you move by hand stays pinned.
//
// READ-ONLY on Tally and on cost centres: lines are read through tlApi('contractor_cc_statement'); nothing is written back.
// Everything you decide is kept in the settings table, key rsr_settlement_v1. Nothing is destructive: "Reset my moves" keeps a one-step undo.
// ═══════════════════════════════════════════════════════
const SETL_KEY = 'rsr_settlement_v1';
let SETL = { cfg:null, cid:null, lines:[], loaded:false, loading:false, err:'', openBlk:{}, shown:{} };

// ───────── pure engine (no DOM) ─────────
function stParse(d){ const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(d||''); return m?Date.UTC(+m[1],+m[2]-1,+m[3]):null; }
function stDayDiff(a,b){ return Math.round((b-a)/864e5); }
function stFyEnd(t){ const dt=new Date(t); const y=dt.getUTCFullYear(), m=dt.getUTCMonth(); return Date.UTC(m>=3?y+1:y,2,31); }
// interest on amount a from payment date to bill date. comp=true: each FY's interest joins the principal on 31 March.
function stInterest(a, from, to, rate, comp){
  const f=stParse(from), t=stParse(to); if(f==null||t==null||t<f||!(a>0)) return 0;
  let cur=f, P=a, tot=0;
  while(cur<=t){ const fy=stFyEnd(cur), end=Math.min(t,fy), days=stDayDiff(cur,end)+1;
    const i=P*rate*days/365; tot+=i; if(comp && end===fy && end<t) P+=i; cur=end+864e5; }
  return tot;
}
const stR2 = n => Math.round((Number(n)||0)*100)/100;
function stCfgDefault(){ return { on:false, rate:0.24, pct:0.7, comp:true, manual:[], date:{}, jvAmt:{}, recv:{}, alloc:{}, hold:{}, notBill:{}, pcts:{}, incTender:false, tenderCC:{}, ownCC:false, known:null, prev:null }; }

// a settlement recorded in a project but not linked to a Tally receipt: find his ledger credit of the same amount (nearest date) so it is not counted twice
function stMatchReceipt(lines,claimed,amt,date){
  if(!(amt>0)) return null; const sums=new Map(), dt=new Map();
  lines.forEach(l=>{ if(l.dir!=='cr') return; sums.set(l.g,(sums.get(l.g)||0)+l.a); dt.set(l.g,l.d); });
  let best=null, bd=Infinity; const t=stParse(date);
  sums.forEach((v,g)=>{ if(claimed.has(g)||Math.abs(v-amt)>1) return; const dd=(t!=null&&stParse(dt.get(g))!=null)?Math.abs(stParse(dt.get(g))-t):0; if(dd<bd){ bd=dd; best=g; } });
  return best;
}
// blocks of one contractor: one per project with settlements (bill), one per project with a JV and no receipt yet (pending JV), plus manual ones
function stBlocksOf(cid, cfg, lines){
  lines=lines||[]; const out=[];
  const claimed=new Set(); (cfg.manual||[]).forEach(m=>{ if(m.g) claimed.add(m.g); });
  (D.projects||[]).forEach(p=>(p.settlements||[]).forEach(s=>{ if(typeof rcGuids==='function') rcGuids(s).forEach(g=>claimed.add(g)); })); const projs=(D.projects||[]).filter(p=>p.contractorId===cid && !(typeof isArchived==='function' && isArchived(p)));
  for(const p of projs){
    const sets=(p.settlements||[]).filter(s=>!(typeof isArchived==='function' && isArchived(s)));
    const names=(typeof tvLinkInfo==='function' && tvLinkInfo(p)) ? tvLinkInfo(p).names : [];
    if(sets.length){
      const id='b'+p.id, guids=new Set(); let virt=0, last='';
      sets.forEach(s=>{ const g=(typeof rcGuids==='function')?rcGuids(s):[]; g.forEach(x=>guids.add(x)); const d=s.date||s.tvDate||''; if(d>last) last=d;
        if(!g.length){ const m=stMatchReceipt(lines,claimed,Number(s.amount)||0,d); if(m){ guids.add(m); claimed.add(m); } else virt+=Number(s.amount)||0; } });
      out.push({id, type:'bill', pid:p.id, label:p.name||'(project)', date:cfg.date[id]||last, ccs:names, guids, virt});
    }
    const settled=sets.reduce((s,x)=>s+(Number(x.amount)||0),0), left=(Number(p.jvAmount)||0)-settled;
    if((Number(p.jvAmount)||0)>0 && p.jvDate && left>1){
      const id='j'+p.id; out.push({id, type:'jv', pid:p.id, label:'JV · '+(p.name||'')+(sets.length?' (balance)':''), date:cfg.date[id]||'', ccs:names, amt:cfg.jvAmt[id]!=null?Number(cfg.jvAmt[id]):left, guids:new Set(), virt:0});
    }
  }
  (cfg.manual||[]).forEach(m=>out.push({id:m.id, type:m.type, pid:null, label:m.label, date:cfg.date[m.id]||m.date||'', ccs:m.ccs||[], amt:cfg.jvAmt[m.id]!=null?Number(cfg.jvAmt[m.id]):Number(m.amt)||0, guids:new Set(m.g?[m.g]:[]), virt:0, manual:true}));
  out.sort((a,b)=>(a.type==='jv')-(b.type==='jv') || (a.date||'9999').localeCompare(b.date||'9999') || a.label.localeCompare(b.label));
  return out;
}

function stIsTender(cfg,cc){ if(!cc) return false; if(cfg.tenderCC&&cfg.tenderCC[cc]!=null) return !!cfg.tenderCC[cc]; return /tender|\bemd\b|\bfsd\b/i.test(cc); }

// ───────── THE RULE (as his father wants it) ─────────
// For every bill received, in date order:  target = bill amount × the bill's %  (70% to start with).
// Walk his payments and the other receipts (refunds, transfers, cheques) in DATE ORDER from the oldest one not used yet; payments add to the
// running net, receipts reduce it, until payments − receipts = target (the last payment is split). A bigger % fetches more, going forward
// into the next bills' payments if needed. Interest (compounded each 31 March) runs from each payment's date to the bill's date; a receipt
// earns negative interest the same way. Nothing from the bill's own period is clubbed into the bill amount.
//   due to contractor = bill amount − (payments − receipts counted) − interest
// Tender cost centres are left out unless cfg.incTender. Pending JVs take only the payments of their own cost centres.
// What you move by hand (cfg.alloc / cfg.recv) is pinned and never touched; cfg.hold keeps a payment out of the walk.
function stCompute(lines, blocks, cfg){
  const byId=new Map(blocks.map(b=>[b.id,b])); const billG=new Set(); blocks.forEach(b=>b.guids.forEach(g=>billG.add(g)));
  const byDate=(a,b)=>a.d.localeCompare(b.d)||a.k.localeCompare(b.k);
  const bills=blocks.filter(b=>b.type==='bill'&&b.date).sort((x,y)=>x.date.localeCompare(y.date)||x.label.localeCompare(y.label)), jvs=blocks.filter(b=>b.type==='jv');
  const pays=lines.filter(l=>l.dir==='dr').sort(byDate), recs=lines.filter(l=>l.dir==='cr'&&!billG.has(l.g)).sort(byDate);
  const billAmt=new Map(blocks.map(b=>[b.id,b.virt||0]));
  lines.forEach(l=>{ if(l.dir==='cr'&&billG.has(l.g)){ const b=blocks.find(x=>x.guids.has(l.g)); if(b) billAmt.set(b.id,(billAmt.get(b.id)||0)+l.a); } });
  const pct=b=>(cfg.pcts&&cfg.pcts[b.id]!=null)?cfg.pcts[b.id]:cfg.pct;
  const amtOf=b=>b.type==='bill'?(billAmt.get(b.id)||0):(b.amt||0);
  const target=b=>stR2(amtOf(b)*pct(b));
  const tenderOK=l=>cfg.incTender||!stIsTender(cfg,l.cc);
  const pcs=[], payRem=new Map(), recUsed=new Set();
  pays.forEach(l=>{ let used=0; (cfg.alloc[l.k]||[]).forEach(e=>{ if(!byId.has(e.b)) return; const a=Math.min(e.a,l.a-used); if(a>0.004){ used+=a; pcs.push({k:l.k,l,a,sign:1,b:e.b,pin:true}); } }); payRem.set(l.k,stR2(l.a-used)); });
  recs.forEach(l=>{ const v=cfg.recv[l.k]; if(v&&byId.has(v)){ pcs.push({k:l.k,l,a:l.a,sign:-1,b:v,pin:true}); recUsed.add(l.k); } });
  const net=new Map(blocks.map(b=>[b.id,0])); pcs.forEach(p=>net.set(p.b,net.get(p.b)+p.sign*p.a));
  const jvCC=new Set(); jvs.forEach(b=>(b.ccs||[]).forEach(c=>jvCC.add(c)));
  const canPay=l=>!(cfg.hold&&cfg.hold[l.k])&&tenderOK(l)&&payRem.get(l.k)>0.004;
  const canRec=l=>cfg.recv[l.k]!=='-'&&!recUsed.has(l.k)&&tenderOK(l);
  const addP=(l,b,a)=>{ pcs.push({k:l.k,l,a,sign:1,b:b.id,pin:false}); payRem.set(l.k,stR2(payRem.get(l.k)-a)); net.set(b.id,net.get(b.id)+a); };
  const addR=(l,b)=>{ pcs.push({k:l.k,l,a:l.a,sign:-1,b:b.id,pin:false}); recUsed.add(l.k); net.set(b.id,net.get(b.id)-l.a); };
  const ownPass=b=>{ const s=new Set(b.ccs||[]); if(!s.size) return; for(const l of pays){ const t=target(b)-net.get(b.id); if(t<=0.004) break; if(canPay(l)&&s.has(l.cc)) addP(l,b,Math.min(payRem.get(l.k),t)); } };
  jvs.forEach(ownPass); if(cfg.ownCC) bills.forEach(ownPass);
  bills.forEach(b=>{
    const items=[...pays.filter(l=>canPay(l)&&!jvCC.has(l.cc)).map(l=>({l,s:1})),...recs.filter(canRec).map(l=>({l,s:-1}))].sort((x,y)=>byDate(x.l,y.l));
    for(const it of items){ const t=target(b)-net.get(b.id); if(t<=0.004) break;
      if(it.s===1){ if(canPay(it.l)) addP(it.l,b,Math.min(payRem.get(it.l.k),t)); } else if(canRec(it.l)) addR(it.l,b); } });
  const rows=blocks.map(b=>{
    const mine=pcs.filter(p=>p.b===b.id).sort((x,y)=>byDate(x.l,y.l)); const bd=b.date;
    mine.forEach(p=>{ p.int=(bd&&p.l.d<=bd)?stInterest(p.a,p.l.d,bd,cfg.rate,cfg.comp):0; });
    const pay=mine.filter(p=>p.sign>0).reduce((s,p)=>s+p.a,0), rec=mine.filter(p=>p.sign<0).reduce((s,p)=>s+p.a,0), ints=mine.reduce((s,p)=>s+p.sign*p.int,0);
    const amt=amtOf(b), tg=target(b), n=pay-rec;
    return {b, bill:amt, pct:pct(b), target:tg, pay, rec, net:n, gap:stR2(tg-n), interest:stR2(ints), due:b.type==='bill'?stR2(amt-n-ints):null, canFund:b.type==='jv'?Math.max(0,stR2(tg-n)):null, pieces:mine};
  });
  const openPays=pays.filter(l=>payRem.get(l.k)>0.004).map(l=>({l,rem:payRem.get(l.k)}));
  const openRecs=recs.filter(l=>!recUsed.has(l.k));
  return {rows, openPays, openRecs, openPayTotal:openPays.reduce((s,x)=>s+x.rem,0), openRecTotal:openRecs.reduce((s,l)=>s+l.a,0),
    allPaid:pays.reduce((s,l)=>s+l.a,0), allOther:recs.reduce((s,l)=>s+l.a,0), allBills:[...billAmt.values()].reduce((s,v)=>s+v,0)};
}

// ───────── persistence ─────────
async function stLoad(){
  if(SETL.cfg) return SETL.cfg; let v=null; try{ v=await getSetting(SETL_KEY,null); }catch(e){ throw e; }
  SETL.cfg=(v&&typeof v==='object'&&v.c&&typeof v.c==='object')?v:{c:{}}; return SETL.cfg;
}
function stC(cid){ const o=SETL.cfg.c[cid]=Object.assign(stCfgDefault(),SETL.cfg.c[cid]||{}); if(!o.hold) o.hold={}; if(!o.notBill) o.notBill={}; if(!o.pcts) o.pcts={}; if(!o.tenderCC) o.tenderCC={}; return o; }
let _stSaveT=null;
function stSave(){ clearTimeout(_stSaveT); _stSaveT=setTimeout(async()=>{ try{ await saveSetting(SETL_KEY,SETL.cfg); }catch(e){ toast('Could not save the settlement choices: '+e.message,'error'); } },500); }
function stIsAdmin(){ return !!(typeof CU!=='undefined' && CU && CU.isSuperAdmin); }
const stE = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stN = n => (Number(n)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const stD = d => d ? (typeof fmtDate==='function'?fmtDate(d):d) : '—';

// ───────── the profile card (just a door) and the separate page ─────────
function renderSettlementCard(cid){
  if(!stIsAdmin()) return '';
  setTimeout(()=>stFill(cid),0);
  return `<div id="cont-settle-${cid}" class="card" style="margin-bottom:14px;border-left:4px solid var(--navy)"><div class="st">⚖️ Settlement by bills</div><div style="font-size:12px;color:var(--text3)">Loading…</div></div>`;
}
async function stFill(cid){
  const el=document.getElementById('cont-settle-'+cid); if(!el) return;
  try{ await stLoad(); }catch(e){ el.innerHTML='<div class="st">⚖️ Settlement by bills</div><div style="color:var(--red);font-size:12px">Could not load the settings — reload the page.</div>'; return; }
  const cfg=stC(cid);
  el.innerHTML=`<div class="st" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">⚖️ Settlement by bills
    <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;margin-left:auto"><input type="checkbox" ${cfg.on?'checked':''} onchange="stToggle('${cid}',this.checked)"> Use for this contractor</label></div>
    ${cfg.on?`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn btn-primary btn-sm" onclick="stOpenPage('${cid}')">Open the settlement page →</button><span style="font-size:12px;color:var(--text3)">His bills closed at ${Math.round(cfg.pct*100)}% with interest, pending JVs, move payments between bills.</span></div>`
      :`<div style="font-size:12px;color:var(--text3)">Off. Switch it on for contractors whose old payments have no cost centres. It never changes Tally or cost centres; it is a separate account kept only in this app.</div>`}`;
}
function stToggle(cid,on){ const cfg=stC(cid); cfg.on=!!on; stSave(); stFill(cid); }
function stOpenPage(cid){
  const c=(D.contractors||[]).find(x=>x.id===cid); if(!c) return; SETL.cid=cid;
  const prof=document.getElementById('cont-profile'); if(prof) prof.classList.add('hidden');
  let pg=document.getElementById('cont-settle-page');
  if(!pg){ pg=document.createElement('div'); pg.id='cont-settle-page'; (prof?prof.parentNode:document.getElementById('sec-cont')).appendChild(pg); }
  pg.classList.remove('hidden');
  pg.innerHTML=`<div style="margin:6px 0 14px"><button class="btn btn-sm" onclick="stClosePage('${cid}')">← Back to ${stE(c.name)}</button></div>
    <div style="font-size:22px;font-weight:800;margin-bottom:2px">⚖️ Settlement by bills — ${stE(c.name)}</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:14px">Part 1: bills already received, each closed at ${Math.round(stC(cid).pct*100)}% with interest. Part 2: pending JVs. Move payments between blocks, fetch from the next bill, add receipts. Read-only on Tally; nothing here changes cost centres.</div>
    <div id="st-body-${cid}"></div>`;
  window.scrollTo(0,0);
  if(SETL.loaded && SETL.loadedCid===cid) stDraw(); else stReload(cid);
}
function stClosePage(cid){ const pg=document.getElementById('cont-settle-page'); if(pg) pg.classList.add('hidden'); if(typeof openContractorProfile==='function') openContractorProfile(cid,false); }

async function stReload(cid){
  const body=document.getElementById('st-body-'+cid); if(!body) return; const c=(D.contractors||[]).find(x=>x.id===cid); if(!c) return;
  if(typeof TL==='undefined' || !TL.token){
    body.innerHTML=`<div style="font-size:12px;color:var(--text3);margin-bottom:8px">Unlock Tally Live once to read his ledger (read-only).</div>
      <div style="display:flex;gap:8px;max-width:420px"><input id="st-pw" type="password" placeholder="Your password" onkeydown="if(event.key==='Enter')stUnlock('${cid}')" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:var(--rs)"><button class="btn btn-primary btn-sm" onclick="stUnlock('${cid}')">Unlock</button></div><div id="st-err" style="color:var(--red);font-size:12px;margin-top:6px"></div>`; return; }
  body.innerHTML='<div style="padding:16px;text-align:center;color:var(--text3)">⏳ Reading his Tally ledger…</div>'; SETL.loading=true;
  try{
    const r=await tlApi('contractor_cc_statement',{contractor:c.name,history:true});
    if(!r.ledgers||!r.ledgers.length){ body.innerHTML='<div style="font-size:12px;color:var(--text3)">No Tally ledgers are linked to this contractor yet (Tally Live → Linking).</div>'; SETL.loading=false; return; }
    const out=[]; const h0=TL.hist; TL.hist=true;
    try{ for(const l of r.ledgers){ const own=r.rows.filter(x=>x.ledger===l.name); const br=_tlBridge([l],own);
      br.rows.forEach((x,i)=>{ if(x.synthetic) return; const parts=(x.ccs&&x.ccs.length)?x.ccs:[{cc:'',amount:Number(x.amount)||0}];
        parts.forEach((p,j)=>{ const amt=Number(p.amount)||0; if(Math.abs(amt)<0.005) return; const g=x.guid||('s'+i+l.name);
          out.push({k:g+'|'+(p.cc||'')+'|'+j, g, d:x.vch_date, t:x.vch_type||'', n:x.vch_number||'', led:x.ledger||l.name, nar:x.narration||'', cc:p.cc||'', a:Math.abs(amt), dir:amt<0?'dr':'cr'}); }); }); } }
    finally{ TL.hist=h0; }
    out.sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0); SETL.lines=out; SETL.loaded=true; SETL.loadedCid=cid; SETL.loading=false; SETL.err='';
    const cfg=stC(cid); if(!cfg.known){ cfg.known=out.map(l=>l.k); stSave(); }
    stDraw();
  }catch(e){ SETL.loading=false; if(e&&e.message==='SESSION'){ stReload(cid); return; } body.innerHTML='<div style="color:var(--red);font-size:12px">'+stE(e.message||e)+'</div>'; }
}
async function stUnlock(cid){
  const er=document.getElementById('st-err'); if(er) er.textContent='Checking…';
  try{ const j=await tlCall({action:'login',password:tlv('st-pw')}); TL.token=j.token; TL.admin=!!j.admin; stReload(cid); }catch(e){ if(er) er.textContent=e.message; }
}

// ───────── drawing ─────────
function stModel(){ const cid=SETL.cid, cfg=stC(cid); const blocks=stBlocksOf(cid,cfg,SETL.lines); return {cfg,blocks,res:stCompute(SETL.lines,blocks,cfg)}; }
function stDraw(){
  const cid=SETL.cid, body=document.getElementById('st-body-'+cid); if(!body) return; _stIds();
  const {cfg,blocks,res}=stModel(); const known=new Set(cfg.known||[]);
  const blkOpts=(sel)=>`<option value="">Open (not counted)</option>`+blocks.map(b=>`<option value="${stE(b.id)}" ${sel===b.id?'selected':''}>${b.type==='jv'?'JV':'Bill'} · ${stE(b.label.substring(0,40))}</option>`).join('');
  const pctPct=x=>Math.round(x*1000)/10;
  const bills=res.rows.filter(r=>r.b.type==='bill'), jvs=res.rows.filter(r=>r.b.type==='jv');
  const sum=(rows,f)=>rows.reduce((s,r)=>s+(f(r)||0),0);
  const tr=r=>{ const b=r.b, jv=b.type==='jv'; const open=!!SETL.openBlk[b.id];
    const amtCell=jv?`<input type="number" value="${stE(b.amt)}" onchange="stSetAmt('${b.id}',this.value)" style="width:110px;font-size:12px;text-align:right">`:stN(r.bill);
    return `<tr style="${open?'background:var(--surface2)':''}"><td><a href="#" onclick="event.preventDefault();stOpenBlk('${b.id}')" style="font-weight:700">${open?'▾':'▸'} ${stE(b.label.substring(0,46))}</a>${b.date?'':' <span style="color:var(--amber);font-size:11px">· no date</span>'}</td>
      <td><input type="date" value="${stE(b.date)}" onchange="stSetDate('${b.id}',this.value)" style="width:128px;font-size:12px"></td>
      <td style="text-align:right">${amtCell}</td>
      <td style="text-align:center"><input type="number" step="0.5" min="0" max="100" value="${pctPct(r.pct)}" onchange="stSetPct('${b.id}',this.value)" style="width:58px;font-size:12px;text-align:right">%</td>
      <td style="text-align:right">${stN(r.target)}</td><td style="text-align:right">${stN(r.pay)}</td><td style="text-align:right">${stN(r.rec)}</td>
      <td style="text-align:right;font-weight:600">${stN(r.net)}</td><td style="text-align:right;${r.gap>0.5?'color:var(--amber)':''}" title="${r.gap>0.5?'Short: not enough eligible payments to reach the target':''}">${stN(r.gap)}</td>
      <td style="text-align:right">${stN(r.interest)}</td>
      <td style="text-align:right;font-weight:700;color:${jv?'var(--text)':(r.due>0.5?'var(--green)':'var(--text2)')}">${jv?stN(r.canFund)+' <span style="font-weight:400;font-size:10px">can fund</span>':stN(r.due)}</td></tr>
      ${open?`<tr><td colspan="11" style="padding:0">${stLinesHtml(r,blkOpts)}</td></tr>`:''}`; };
  const linkedG=new Set(); blocks.forEach(b=>b.guids.forEach(g=>linkedG.add(g)));
  const cand=SETL.lines.filter(l=>l.dir==='cr'&&!linkedG.has(l.g)&&l.a>=100000&&/bill|gen\s*code|gvmc|cheque|check recei|part pay/i.test(l.nar||'')&&!cfg.notBill[l.k]);
  const newOpen=res.openPays.filter(x=>!known.has(x.l.k)), newRec=res.openRecs.filter(l=>!known.has(l.k));
  const ccs=[...new Set(SETL.lines.map(l=>l.cc).filter(Boolean))].sort();
  const counted=sum(res.rows,r=>r.net);
  body.innerHTML=`
    <div style="display:flex;gap:10px 14px;flex-wrap:wrap;align-items:end;margin-bottom:10px;font-size:12px">
      <label>Interest % a year<br><input type="number" step="0.01" value="${stR2(cfg.rate*100)}" onchange="stSetting('rate',this.value/100)" style="width:70px"></label>
      <label>Payments to fetch for a bill, % of the bill<br><input type="number" step="0.5" value="${pctPct(cfg.pct)}" onchange="stSetting('pct',this.value/100)" style="width:70px"> <span style="color:var(--text3)">(any bill can have its own % below)</span></label>
      <label style="display:flex;gap:4px;align-items:end"><input type="checkbox" ${cfg.comp?'checked':''} onchange="stSetting('comp',this.checked)"> add interest to principal every 31 March</label>
      <label style="display:flex;gap:4px;align-items:end" title="Tender cost centres (EMD / FSD / tender money) are left out unless you tick this"><input type="checkbox" ${cfg.incTender?'checked':''} onchange="stSetting('incTender',this.checked)"> include tender cost centres</label>
      <label style="display:flex;gap:4px;align-items:end" title="Before the date walk, each bill first takes the payments of its own cost centre"><input type="checkbox" ${cfg.ownCC?'checked':''} onchange="stSetting('ownCC',this.checked)"> own cost centre first</label>
      <span style="margin-left:auto"></span>
      <button class="btn btn-sm" onclick="stReload('${cid}')">↻ Refresh from Tally</button>
      <button class="btn btn-sm" onclick="stResetMoves()" title="Forget every payment/receipt you moved by hand; everything goes back to the by-date rule">↺ Reset my moves</button>
      <button class="btn btn-sm" onclick="stUndoBtn()" ${cfg.prev?'':'disabled'}>↩ Undo last reset</button>
      <button class="btn btn-sm" onclick="stAddBlock()">＋ Add block</button>
      <button class="btn btn-sm" onclick="stExcel()">⬇ Excel</button></div>
    <details style="margin-bottom:8px;font-size:12px"><summary style="cursor:pointer;font-weight:600">Which cost centres are tender cost centres? (${ccs.filter(c=>stIsTender(cfg,c)).length} marked)</summary>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:2px 12px;margin-top:6px">${ccs.map(c=>`<label style="display:flex;gap:6px"><input type="checkbox" ${stIsTender(cfg,c)?'checked':''} onchange="stTenderCC(this.getAttribute('data-c'),this.checked)" data-c="${stE(c)}"> ${stE(c)}</label>`).join('')||'<span style="color:var(--text3)">No cost centres in his ledger.</span>'}</div></details>
    ${cand.length?`<div class="card" style="padding:10px;margin-bottom:10px;border-left:4px solid var(--amber);font-size:12px"><b>These receipts look like bills received, but no project is linked to them:</b>${cand.map(l=>`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:4px 0;border-top:1px solid var(--border)"><span style="min-width:90px">${stD(l.d)}</span><span style="min-width:110px;text-align:right"><b>${stN(l.a)}</b></span><span style="flex:1;min-width:200px">${stE(l.t)} ${stE(l.n)} · ${stE(l.cc||'no cost centre')} · ${stE((l.nar||'').substring(0,90))}</span><button class="btn btn-sm btn-primary" onclick="stRecToBill('${stE(l.k)}')">Make a bill</button><button class="btn btn-sm" onclick="stNotBill('${stE(l.k)}')">Not a bill</button></div>`).join('')}</div>`:''}
    <div style="font-size:11px;color:var(--text3);margin-bottom:8px">For each bill, in date order: his payments and the other receipts are taken oldest first until <b>payments − receipts = the bill's %</b> of the bill amount (going forward into later payments if needed); interest runs from each payment to the bill date. The bill amount is never topped up with other receipts. Estimated, because his old payments have no cost centres. Read-only on Tally; nothing here changes cost centres.</div>
    <div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>Block</th><th>Bill date</th><th style="text-align:right">Bill / JV amount</th><th>Fetch %</th><th style="text-align:right">Target (amount × %)</th><th style="text-align:right">Payments fetched</th><th style="text-align:right">Receipts fetched</th><th style="text-align:right">Net counted</th><th style="text-align:right">Gap to target</th><th style="text-align:right">Interest</th><th style="text-align:right">Due to contractor</th></tr></thead>
    <tbody><tr><td colspan="11" style="background:var(--navy);color:#fff;font-weight:700">PART 1 — Bills already received</td></tr>${bills.map(tr).join('')}${bills.length?`<tr style="font-weight:700;background:var(--surface2)"><td>Bills received</td><td></td><td style="text-align:right">${stN(sum(bills,r=>r.bill))}</td><td></td><td style="text-align:right">${stN(sum(bills,r=>r.target))}</td><td style="text-align:right">${stN(sum(bills,r=>r.pay))}</td><td style="text-align:right">${stN(sum(bills,r=>r.rec))}</td><td style="text-align:right">${stN(sum(bills,r=>r.net))}</td><td></td><td style="text-align:right">${stN(sum(bills,r=>r.interest))}</td><td style="text-align:right">${stN(sum(bills,r=>r.due))}</td></tr>`:'<tr><td colspan="11" style="color:var(--text3)">No project of this contractor has a recorded settlement yet. Use ＋ Add block, or "Make a bill" on a receipt.</td></tr>'}
    <tr><td colspan="11" style="background:var(--navy);color:#fff;font-weight:700">PART 2 — Pending JVs (check pending) · only the payments of their own cost centres</td></tr>${jvs.map(tr).join('')}${jvs.length?`<tr style="font-weight:700;background:var(--surface2)"><td>Pending JVs</td><td></td><td style="text-align:right">${stN(sum(jvs,r=>r.b.amt))}</td><td></td><td style="text-align:right">${stN(sum(jvs,r=>r.target))}</td><td style="text-align:right">${stN(sum(jvs,r=>r.pay))}</td><td style="text-align:right">${stN(sum(jvs,r=>r.rec))}</td><td style="text-align:right">${stN(sum(jvs,r=>r.net))}</td><td></td><td style="text-align:right">${stN(sum(jvs,r=>r.interest))}</td><td style="text-align:right">${stN(sum(jvs,r=>r.canFund))} can fund</td></tr>`:''}</tbody></table></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:8px;margin:12px 0;font-size:12px">
      <div class="card" style="padding:10px"><b>Position</b><br>All payments to / for him: <b>${stN(res.allPaid)}</b><br>Bills received: <b>${stN(res.allBills)}</b> · other receipts: <b>${stN(res.allOther)}</b><br>Counted in blocks (payments − receipts): <b>${stN(counted)}</b><br>Still open: payments <b>${stN(res.openPayTotal)}</b> · receipts <b>${stN(res.openRecTotal)}</b>
        <br><span style="color:${Math.abs(counted+res.openPayTotal-res.openRecTotal-(res.allPaid-res.allOther))<0.5?'var(--green)':'var(--red)'}">Check: counted + open payments − open receipts − (all payments − other receipts) = ${stN(counted+res.openPayTotal-res.openRecTotal-(res.allPaid-res.allOther))}</span></div>
      <div class="card" style="padding:10px"><b>We owe him on bills received</b><br><span style="font-size:18px;font-weight:800">${stN(sum(bills,r=>r.due))}</span><br>after the fetched payments, receipts and interest<br><span style="color:var(--text3)">Can still fund on pending JVs: <b>${stN(sum(jvs,r=>r.canFund))}</b></span></div></div>
    ${newOpen.length||newRec.length?`<div class="card" style="padding:10px;margin-bottom:10px;border-left:4px solid var(--amber);font-size:12px">🆕 ${newOpen.length} new open payment${newOpen.length===1?'':'s'} and ${newRec.length} new open receipt${newRec.length===1?'':'s'} since you last marked things seen (they are already placed by date). <button class="btn btn-sm" onclick="stSeen()">Mark all seen</button></div>`:''}
    <details ${SETL.shown.open?'open':''} ontoggle="SETL.shown.open=this.open"><summary style="cursor:pointer;font-weight:700">Open payments — not needed by any bill yet (${res.openPays.length} · ${stN(res.openPayTotal)})</summary>
      <div style="overflow:auto;max-height:420px"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>Date</th><th>Voucher</th><th>Cost centre</th><th>Narration</th><th style="text-align:right">Open amount</th><th>Count it in</th></tr></thead><tbody>${res.openPays.slice(0,600).map(x=>`<tr><td>${stD(x.l.d)}${known.has(x.l.k)?'':' 🆕'}</td><td>${stE(x.l.t)} ${stE(x.l.n)}</td><td>${stE(x.l.cc||'—')}${(!cfg.incTender&&stIsTender(cfg,x.l.cc))?' <span style="font-size:10px;color:var(--amber)">tender · left out</span>':''}${cfg.hold[x.l.k]?' <span style="font-size:10px;color:var(--text3)">kept out by you</span>':''}</td><td style="max-width:260px">${stE(x.l.nar)}</td><td style="text-align:right">${stN(x.rem)}</td><td><select onchange="stMoveOpen('${stE(x.l.k)}',this.value);this.value=''" style="font-size:11px;max-width:180px">${blkOpts('')}</select></td></tr>`).join('')}</tbody></table></div></details>
    <details ${SETL.shown.rec?'open':''} ontoggle="SETL.shown.rec=this.open" style="margin-top:6px"><summary style="cursor:pointer;font-weight:700">Other receipts not used (${res.openRecs.length} · ${stN(res.openRecTotal)})</summary>
      <div style="font-size:11px;color:var(--text3);margin:4px 0">Refunds, transfers, cheques that are not bills. A bill uses them (oldest first) when it needs more room for payments; the rest wait here. Choose a block to use one for that bill, or "Not counted" to keep it out.</div>
      <div style="overflow:auto;max-height:360px"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>Date</th><th>Voucher</th><th>Cost centre</th><th>Narration</th><th style="text-align:right">Amount</th><th>Use for</th></tr></thead><tbody>${res.openRecs.map(l=>`<tr><td>${stD(l.d)}${known.has(l.k)?'':' 🆕'}</td><td>${stE(l.t)} ${stE(l.n)}</td><td>${stE(l.cc||'—')}${(!cfg.incTender&&stIsTender(cfg,l.cc))?' <span style="font-size:10px;color:var(--amber)">tender · left out</span>':''}</td><td style="max-width:260px">${stE(l.nar)}</td><td style="text-align:right">${stN(l.a)}</td><td><select onchange="stRecv('${stE(l.k)}',this.value)" style="font-size:11px;max-width:180px"><option value="">Automatic (by date)</option><option value="-" ${cfg.recv[l.k]==='-'?'selected':''}>Not counted</option>${blocks.map(b=>`<option value="${stE(b.id)}">${b.type==='jv'?'JV':'Bill'} · ${stE(b.label.substring(0,40))}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div></details>`;
}
function stLinesHtml(r,blkOpts){
  const rows=r.pieces.map(p=>`<tr style="${p.sign<0?'background:#eef6ee':''}"><td>${stD(p.l.d)}</td><td>${stE(p.l.t)} ${stE(p.l.n)}</td><td>${stE(p.l.cc||'—')}</td><td style="max-width:240px">${stE(p.l.nar)}${p.pin?' <span style="background:var(--navy);color:#fff;border-radius:6px;padding:0 6px;font-size:10px">moved by you</span>':''}${(r.b.date&&p.l.d>r.b.date)?' <span style="background:var(--amber);color:#fff;border-radius:6px;padding:0 6px;font-size:10px">after the bill date · no interest</span>':''}</td>
    <td>${p.sign<0?'Receipt':'Payment'}</td><td style="text-align:right">${p.sign<0?'−':''}${stN(p.a)}</td><td style="text-align:right">${p.sign<0?'−':''}${stN(p.int)}</td>
    <td>${p.sign<0?`<select onchange="stRecv('${stE(p.k)}',this.value)" style="font-size:11px;max-width:170px"><option value="">Automatic (by date)</option><option value="-">Not counted</option>${(SETL._blocks||[]).map(b=>`<option value="${stE(b.id)}" ${b.id===r.b.id?'selected':''}>${b.type==='jv'?'JV':'Bill'} · ${stE(b.label.substring(0,40))}</option>`).join('')}</select>`
      :`<select onchange="stMovePiece('${stE(p.k)}','${stE(r.b.id)}',this.value,${p.pin?'true':'false'},${stR2(p.a)})" style="font-size:11px;max-width:170px">${blkOpts(r.b.id)}</select>`}</td></tr>`);
  return `<div style="overflow:auto;max-height:380px;padding:6px 10px"><table class="tbl" style="width:100%;font-size:11.5px"><thead><tr><th>Date</th><th>Voucher</th><th>Cost centre</th><th>Narration</th><th>Role</th><th style="text-align:right">Amount</th><th style="text-align:right">Interest</th><th>Move to</th></tr></thead><tbody>${rows.join('')||'<tr><td colspan="8" style="color:var(--text3)">Nothing fetched for this block.</td></tr>'}</tbody></table></div>`;
}
const _stIds=()=>{ const {blocks,res}=stModel(); SETL._res=res; SETL._blocks=blocks; SETL._byId={}; blocks.forEach(b=>SETL._byId[b.id]=b.label.substring(0,28)); };

// ───────── actions ─────────
function stRedraw(){ _stIds(); stSave(); stDraw(); }
function stOpenBlk(id){ SETL.openBlk[id]=!SETL.openBlk[id]; _stIds(); stDraw(); }
function stSetting(k,v){ const cfg=stC(SETL.cid); if(typeof v==='number'&&!isFinite(v)) return; cfg[k]=v; stRedraw(); }
function stSetPct(id,v){ const cfg=stC(SETL.cid); const n=Number(v); if(!isFinite(n)||n<0) return; cfg.pcts=cfg.pcts||{}; cfg.pcts[id]=n/100; stRedraw(); }
function stTenderCC(cc,on){ const cfg=stC(SETL.cid); cfg.tenderCC=cfg.tenderCC||{}; cfg.tenderCC[cc]=!!on; stRedraw(); }
function stSetDate(id,v){ const cfg=stC(SETL.cid); if(v) cfg.date[id]=v; else delete cfg.date[id]; stRedraw(); }
function stSetAmt(id,v){ const cfg=stC(SETL.cid); cfg.jvAmt[id]=Number(v)||0; stRedraw(); }
function stRecv(k,b){ const cfg=stC(SETL.cid); if(b) cfg.recv[k]=b; else delete cfg.recv[k]; stRedraw(); }
function stRecToBill(k){ const l=SETL.lines.find(x=>x.k===k); if(!l) return; const lab=prompt('Name for this bill (e.g. the work it belongs to; leave blank if unknown):',(l.cc?l.cc+' · ':'')+'bill received '+stD(l.d)+' · '+l.t+' '+l.n); if(lab===null) return;
  const cfg=stC(SETL.cid); const id='m'+Date.now().toString(36); cfg.manual.push({id,type:'bill',label:(lab.trim()||('Bill '+l.d)),date:l.d,amt:0,ccs:l.cc?[l.cc]:[],g:l.g}); stRedraw(); }
function stSnap(){ const cfg=stC(SETL.cid); cfg.prev=JSON.stringify({alloc:cfg.alloc,hold:cfg.hold,recv:cfg.recv}); }
// Open payment → a block: pinned there (a manual move)
function stMoveOpen(k,b){ if(!b) return; const cfg=stC(SETL.cid); const x=SETL._res&&SETL._res.openPays.find(o=>o.l.k===k); if(!x) return; const rem=stR2(x.rem); if(rem<=0) return;
  const arr=cfg.alloc[k]=cfg.alloc[k]||[]; const e=arr.find(z=>z.b===b); if(e) e.a=stR2(e.a+rem); else arr.push({b,a:rem}); delete cfg.hold[k]; stRedraw(); }
// a counted payment → another block (pinned) or Open (kept out of the automatic rule)
function stMovePiece(k,from,to,pin,amt){ const cfg=stC(SETL.cid); const arr=cfg.alloc[k]=cfg.alloc[k]||[];
  if(pin){ const i=arr.findIndex(x=>x.b===from); if(i>=0){ amt=arr[i].a; arr.splice(i,1); } }
  if(to){ const e=arr.find(x=>x.b===to); if(e) e.a=stR2(e.a+amt); else arr.push({b:to,a:stR2(amt)}); }
  else cfg.hold[k]=true;
  if(!arr.length) delete cfg.alloc[k]; stRedraw(); }
function stResetMoves(){ if(!confirm('Forget every payment and receipt you moved by hand? Everything goes back to the by-date rule. You can undo this once.')) return; const cfg=stC(SETL.cid); stSnap(); cfg.alloc={}; cfg.hold={}; cfg.recv={}; stRedraw(); }
function stUndoBtn(){ const cfg=stC(SETL.cid); if(!cfg.prev) return; const o=JSON.parse(cfg.prev); cfg.alloc=o.alloc||{}; cfg.hold=o.hold||{}; cfg.recv=o.recv||{}; cfg.prev=null; stRedraw(); }
function stSeen(){ const cfg=stC(SETL.cid); cfg.known=SETL.lines.map(l=>l.k); stRedraw(); }
function stNotBill(k){ const cfg=stC(SETL.cid); cfg.notBill[k]=true; stRedraw(); }
async function stAddBlock(){
  const label=prompt('Name of the new block (a bill or a JV not found in the projects):'); if(!label||!label.trim()) return;
  const t=(prompt('Type "bill" (money received) or "jv" (JV expected):','bill')||'').trim().toLowerCase(); if(t!=='bill'&&t!=='jv') { toast('Type must be bill or jv','error'); return; }
  const date=prompt('Date received / expected (YYYY-MM-DD), blank if not known:','')||''; const amt=Number(prompt(t==='jv'?'Expected JV amount:':'Bill amount received:','0'))||0;
  const cfg=stC(SETL.cid); cfg.manual.push({id:'m'+Date.now().toString(36),type:t,label:label.trim(),date:date.trim(),amt,ccs:[]}); stRedraw();
}

// ───────── Excel ─────────
function stExcel(){
  const {cfg,blocks,res}=stModel(); const c=(D.contractors||[]).find(x=>x.id===SETL.cid)||{name:''}; const wb=XLSX.utils.book_new();
  const sheet=(aoa,w)=>{ const ws=XLSX.utils.aoa_to_sheet(aoa); ws['!cols']=w.map(x=>({wch:x})); return ws; };
  const s=[[c.name+' — settlement by bills (interest '+(cfg.rate*100)+'%'+(cfg.comp?', compounded each 31 March':', simple')+(cfg.incTender?', tender cost centres included':', tender cost centres left out')+')'],[],['Block','Type','Bill date','Bill / JV amount','Fetch %','Target','Payments fetched','Receipts fetched','Net counted','Gap','Interest','Due to contractor / can fund']];
  res.rows.forEach(r=>s.push([r.b.label,r.b.type==='jv'?'Pending JV':'Bill',r.b.date,stR2(r.bill),r.pct*100,r.target,stR2(r.pay),stR2(r.rec),stR2(r.net),r.gap,stR2(r.interest),r.b.type==='jv'?r.canFund:r.due]));
  s.push([],['Open payments',,,,,,,,stR2(res.openPayTotal)],['Other receipts not used',,,,,,,,stR2(res.openRecTotal)]);
  XLSX.utils.book_append_sheet(wb,sheet(s,[48,12,12,18,9,14,16,16,16,14,14,22]),'Summary');
  const used=new Set(['Summary']);
  res.rows.forEach(r=>{ let nm=(r.b.type==='jv'?'JV ':'')+r.b.label.replace(/[\\\/\?\*\[\]:]/g,' ').substring(0,26); let n=nm,i=2; while(used.has(n)) n=nm.substring(0,24)+'~'+(i++); used.add(n);
    const a=[[r.b.label+' — '+stD(r.b.date)],['Bill amount',stR2(r.bill),'Fetch %',r.pct*100,'Target',r.target,'Net counted',stR2(r.net),'Interest',stR2(r.interest),'Due',r.due==null?r.canFund:r.due],[],['Date','Voucher','Cost centre','Narration','Role','Amount','Interest','Note']];
    r.pieces.forEach(p=>a.push([p.l.d,p.l.t+' '+p.l.n,p.l.cc,p.l.nar,p.sign<0?'Receipt':'Payment',p.sign*stR2(p.a),p.sign*stR2(p.int),(p.pin?'moved by you ':'')+((r.b.date&&p.l.d>r.b.date)?'after bill date, no interest':'')]));
    XLSX.utils.book_append_sheet(wb,sheet(a,[12,20,34,50,10,16,14,28]),n); });
  const o=[['Date','Voucher','Cost centre','Narration','Role','Open amount']]; res.openPays.forEach(x=>o.push([x.l.d,x.l.t+' '+x.l.n,x.l.cc,x.l.nar,'Payment',stR2(x.rem)])); res.openRecs.forEach(l=>o.push([l.d,l.t+' '+l.n,l.cc,l.nar,'Receipt',-stR2(l.a)]));
  XLSX.utils.book_append_sheet(wb,sheet(o,[12,20,34,50,10,16]),'Open');
  XLSX.writeFile(wb,'Settlement_'+c.name.replace(/[^A-Za-z0-9]+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.xlsx');
}
