// ═══════════════════════════════════════════════════════
// settlement.js — "Settlement by bills" on the contractor profile (Super Admin only, switched on per contractor)
//
// For contractors whose old payments carry no cost centres. Every bill received (one block per project; part bills = one block) is closed:
//   70% of the receipts in the block  ←  the contractor's payments counted against it  +  interest on each payment (24%, compounded on 31 March,
//   payment day to bill day, both counted, 365-day year)  →  what is still due to the contractor (or over-paid).
// Pending JVs (JV known, money not received) are blocks too: only their 70% can still be funded.
// Payments that are not counted anywhere are "Open". New Tally entries land as Open and are flagged 🆕.
//
// READ-ONLY on Tally and on cost centres: lines are read through tlApi('contractor_cc_statement'); nothing is written back.
// Everything you decide (which block a payment is counted in, fetch switches, dates) is kept in the settings table, key rsr_settlement_v1.
// Moves are never destructive: "Open" and "Move to" simply change the assignment; "Reset" keeps a one-step undo.
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
function stCfgDefault(){ return { on:false, rate:0.24, pct:0.7, comp:true, manual:[], date:{}, jvAmt:{}, recv:{}, alloc:{}, fetch:{}, known:null, prev:null }; }

// blocks of one contractor: one per project with settlements (bill), one per project with a JV and no receipt yet (pending JV), plus manual ones
function stBlocksOf(cid, cfg){
  const out=[]; const projs=(D.projects||[]).filter(p=>p.contractorId===cid && !(typeof isArchived==='function' && isArchived(p)));
  for(const p of projs){
    const sets=(p.settlements||[]).filter(s=>!(typeof isArchived==='function' && isArchived(s)));
    const names=(typeof tvLinkInfo==='function' && tvLinkInfo(p)) ? tvLinkInfo(p).names : [];
    if(sets.length){
      const id='b'+p.id, guids=new Set(); let virt=0, last='';
      sets.forEach(s=>{ const g=(typeof rcGuids==='function')?rcGuids(s):[]; g.forEach(x=>guids.add(x)); if(!g.length) virt+=Number(s.amount)||0; const d=s.date||s.tvDate||''; if(d>last) last=d; });
      out.push({id, type:'bill', pid:p.id, label:p.name||'(project)', date:cfg.date[id]||last, ccs:names, guids, virt});
    } else if((Number(p.jvAmount)||0)>0 && p.jvDate){
      const id='j'+p.id; out.push({id, type:'jv', pid:p.id, label:'JV · '+(p.name||''), date:cfg.date[id]||'', ccs:names, amt:cfg.jvAmt[id]!=null?Number(cfg.jvAmt[id]):Number(p.jvAmount)||0, guids:new Set(), virt:0});
    }
  }
  (cfg.manual||[]).forEach(m=>out.push({id:m.id, type:m.type, pid:null, label:m.label, date:cfg.date[m.id]||m.date||'', ccs:m.ccs||[], amt:cfg.jvAmt[m.id]!=null?Number(cfg.jvAmt[m.id]):Number(m.amt)||0, guids:new Set(), virt:0, manual:true}));
  out.sort((a,b)=>(a.type==='jv')-(b.type==='jv') || (a.date||'9999').localeCompare(b.date||'9999') || a.label.localeCompare(b.label));
  return out;
}

// the whole calculation. lines: [{k,g,d,t,n,led,nar,cc,a,dir:'dr'|'cr'}]
function stCompute(lines, blocks, cfg){
  const byId=new Map(blocks.map(b=>[b.id,b])); const guidBlk=new Map(); blocks.forEach(b=>b.guids.forEach(g=>guidBlk.set(g,b.id)));
  const pays=lines.filter(l=>l.dir==='dr').sort((a,b)=>a.d.localeCompare(b.d)||a.k.localeCompare(b.k));
  const recs=lines.filter(l=>l.dir==='cr');
  // receipts → blocks
  const rBlk=new Map(); const unRec=[];
  recs.forEach(r=>{ const b=guidBlk.get(r.g)||(cfg.recv[r.k]&&byId.has(cfg.recv[r.k])?cfg.recv[r.k]:null); if(b) rBlk.set(r.k,b); else unRec.push(r); });
  const recTot=new Map(blocks.map(b=>[b.id,b.virt||0])); rBlk.forEach((b,k)=>{ const r=recs.find(x=>x.k===k); recTot.set(b,(recTot.get(b)||0)+r.a); });
  // base pieces from the saved assignment
  const pcs=[]; const openRem=new Map();
  pays.forEach(l=>{ let used=0; (cfg.alloc[l.k]||[]).forEach(e=>{ if(!byId.has(e.b)) return; const a=Math.min(e.a, l.a-used); if(a>0.004){ used+=a; pcs.push({k:l.k,l,a,b:e.b,orig:e.b,from:null}); } });
    const rem=stR2(l.a-used); if(rem>0.004) openRem.set(l.k,rem); });
  const bills=blocks.filter(b=>b.type==='bill');
  const dateOf=id=>{ const b=byId.get(id); return b?b.date:''; };
  const intOf=(p,id)=>stInterest(p.a,p.l.d,dateOf(id),cfg.rate,cfg.comp);
  // fetch stages: block k pulls the oldest whole payments of the next bill until its due is ~0
  for(let i=0;i<bills.length-1;i++){
    const B=bills[i], N=bills[i+1]; if(!cfg.fetch[B.id]) continue;
    const mine=pcs.filter(p=>p.b===B.id); const total=(recTot.get(B.id)||0);
    const need=Math.max(0, total-mine.reduce((s,p)=>s+p.a,0)-mine.reduce((s,p)=>s+intOf(p,B.id),0));
    let cum=0; pcs.filter(p=>p.b===N.id).sort((a,b)=>a.l.d.localeCompare(b.l.d)||a.k.localeCompare(b.k)).forEach(p=>{
      const c=p.a+intOf(p,B.id); if(cum+c<=need+0.005){ cum+=c; p.b=B.id; p.from=N.id; } });
  }
  const res=blocks.map(b=>{
    const mine=pcs.filter(p=>p.b===b.id).sort((x,y)=>x.l.d.localeCompare(y.l.d)||x.k.localeCompare(y.k));
    const total=b.type==='bill'?(recTot.get(b.id)||0):(b.amt||0)+(recTot.get(b.id)||0);
    const counted=mine.reduce((s,p)=>s+p.a,0);
    const interest=mine.reduce((s,p)=>s+(p.int=intOf(p,b.id)),0);
    const target=stR2(total*cfg.pct);
    return {b, total, target, counted, gap:stR2(target-counted), interest, due:b.type==='bill'?stR2(total-counted-interest):null, canFund:b.type==='jv'?Math.max(0,stR2(target-counted)):null,
      pieces:mine, receipts:recs.filter(r=>rBlk.get(r.k)===b.id), fetchedIn:mine.filter(p=>p.from).reduce((s,p)=>s+p.a,0), fetchedOut:0};
  });
  pcs.filter(p=>p.from).forEach(p=>{ const r=res.find(x=>x.b.id===p.from); if(r) r.fetchedOut+=p.a; });
  const open=pays.map(l=>({l,rem:openRem.get(l.k)||0})).filter(x=>x.rem>0.004);
  return {rows:res, open, unRec, openTotal:open.reduce((s,x)=>s+x.rem,0), allPaid:pays.reduce((s,l)=>s+l.a,0), allRec:recs.reduce((s,l)=>s+l.a,0)};
}

// auto-assign what is Open: own cost centre first (all blocks), then oldest-first for bills (JV-reserved cost centres untouched). Splits the last payment.
function stAutoAssign(lines, blocks, cfg){
  const byId=new Map(blocks.map(b=>[b.id,b])); const guidBlk=new Map(); blocks.forEach(b=>b.guids.forEach(g=>guidBlk.set(g,b.id)));
  const pays=lines.filter(l=>l.dir==='dr').sort((a,b)=>a.d.localeCompare(b.d)||a.k.localeCompare(b.k));
  const rem=new Map(); pays.forEach(l=>{ const u=(cfg.alloc[l.k]||[]).filter(e=>byId.has(e.b)).reduce((s,e)=>s+e.a,0); rem.set(l.k,stR2(l.a-u)); });
  const tot=new Map(blocks.map(b=>[b.id,b.type==='bill'?(b.virt||0):(b.amt||0)]));
  lines.filter(l=>l.dir==='cr').forEach(r=>{ const id=guidBlk.get(r.g)||(cfg.recv[r.k]&&byId.has(cfg.recv[r.k])?cfg.recv[r.k]:null); if(id) tot.set(id,(tot.get(id)||0)+r.a); });
  const left=new Map(); blocks.forEach(b=>{ const c=pays.reduce((s,l)=>s+(cfg.alloc[l.k]||[]).filter(e=>e.b===b.id).reduce((x,e)=>x+e.a,0),0); left.set(b.id,stR2((tot.get(b.id)||0)*cfg.pct-c)); });
  const put=(l,b,a)=>{ const arr=cfg.alloc[l.k]=cfg.alloc[l.k]||[]; const e=arr.find(x=>x.b===b.id); if(e) e.a=stR2(e.a+a); else arr.push({b:b.id,a:stR2(a)}); rem.set(l.k,stR2(rem.get(l.k)-a)); left.set(b.id,stR2(left.get(b.id)-a)); };
  const ccSet=b=>new Set(b.ccs||[]); const jvCC=new Set(); blocks.filter(b=>b.type==='jv').forEach(b=>(b.ccs||[]).forEach(c=>jvCC.add(c)));
  const take=(b,filter)=>{ for(const l of pays){ if(left.get(b.id)<=0.004) break; const r=rem.get(l.k); if(r<=0.004||!filter(l)) continue; put(l,b,Math.min(r,left.get(b.id))); } };
  blocks.forEach(b=>{ const s=ccSet(b); if(!s.size) return; take(b,l=>s.has(l.cc)&&(b.type==='jv'||!b.date||l.d<=b.date)); });
  blocks.filter(b=>b.type==='bill').forEach(b=>take(b,l=>!jvCC.has(l.cc)&&(!b.date||l.d<=b.date)));
}

// ───────── persistence ─────────
async function stLoad(){
  if(SETL.cfg) return SETL.cfg; let v=null; try{ v=await getSetting(SETL_KEY,null); }catch(e){ throw e; }
  SETL.cfg=(v&&typeof v==='object'&&v.c&&typeof v.c==='object')?v:{c:{}}; return SETL.cfg;
}
function stC(cid){ const o=SETL.cfg.c[cid]=Object.assign(stCfgDefault(),SETL.cfg.c[cid]||{}); return o; }
let _stSaveT=null;
function stSave(){ clearTimeout(_stSaveT); _stSaveT=setTimeout(async()=>{ try{ await saveSetting(SETL_KEY,SETL.cfg); }catch(e){ toast('Could not save the settlement choices: '+e.message,'error'); } },500); }
function stIsAdmin(){ return !!(typeof CU!=='undefined' && CU && CU.isSuperAdmin); }
const stE = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stN = n => (Number(n)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const stD = d => d ? (typeof fmtDate==='function'?fmtDate(d):d) : '—';

// ───────── the profile card ─────────
function renderSettlementCard(cid){
  if(!stIsAdmin()) return '';
  setTimeout(()=>stFill(cid),0);
  return `<div id="cont-settle-${cid}" class="card" style="margin-bottom:14px;border-left:4px solid var(--navy)"><div class="st">⚖️ Settlement by bills</div><div style="font-size:12px;color:var(--text3)">Loading…</div></div>`;
}
async function stFill(cid){
  const el=document.getElementById('cont-settle-'+cid); if(!el) return;
  try{ await stLoad(); }catch(e){ el.innerHTML='<div class="st">⚖️ Settlement by bills</div><div style="color:var(--red);font-size:12px">Could not load the settings — reload the page.</div>'; return; }
  const cfg=stC(cid);
  const head=`<div class="st" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">⚖️ Settlement by bills
    <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;margin-left:auto"><input type="checkbox" ${cfg.on?'checked':''} onchange="stToggle('${cid}',this.checked)"> Use for this contractor</label></div>`;
  if(!cfg.on){ el.innerHTML=head+`<div style="font-size:12px;color:var(--text3)">Off. Switch it on for contractors whose old payments have no cost centres. It never changes Tally or cost centres; it is a separate account kept only in this app.</div>`; return; }
  SETL.cid=cid; el.innerHTML=head+`<div id="st-body-${cid}"></div>`;
  if(SETL.loaded && SETL.loadedCid===cid) stDraw(); else stReload(cid);
}
function stToggle(cid,on){ const cfg=stC(cid); cfg.on=!!on; stSave(); stFill(cid); }

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
function stModel(){ const cid=SETL.cid, cfg=stC(cid); const blocks=stBlocksOf(cid,cfg); return {cfg,blocks,res:stCompute(SETL.lines,blocks,cfg)}; }
function stDraw(){
  const cid=SETL.cid, body=document.getElementById('st-body-'+cid); if(!body) return; _stIds();
  const {cfg,blocks,res}=stModel(); const known=new Set(cfg.known||[]);
  const blkOpts=(sel)=>`<option value="">Open (not counted)</option>`+blocks.map(b=>`<option value="${stE(b.id)}" ${sel===b.id?'selected':''}>${b.type==='jv'?'JV':'Bill'} · ${stE(b.label.substring(0,40))}</option>`).join('');
  const bills=res.rows.filter(r=>r.b.type==='bill'), jvs=res.rows.filter(r=>r.b.type==='jv');
  const nextOf=id=>{ const i=bills.findIndex(r=>r.b.id===id); return i>=0&&i<bills.length-1; };
  const tr=r=>{ const b=r.b, jv=b.type==='jv'; const open=!!SETL.openBlk[b.id];
    const dateCell=`<input type="date" value="${stE(b.date)}" onchange="stSetDate('${b.id}',this.value)" style="width:128px;font-size:12px">`;
    const totCell=jv?`<input type="number" value="${stE(b.amt)}" onchange="stSetAmt('${b.id}',this.value)" style="width:110px;font-size:12px;text-align:right">`:stN(r.total);
    return `<tr style="${open?'background:var(--surface2)':''}"><td><a href="#" onclick="event.preventDefault();stOpenBlk('${b.id}')" style="font-weight:700">${open?'▾':'▸'} ${stE(b.label.substring(0,46))}</a>${b.date?'':' <span style="color:var(--amber);font-size:11px">· no date</span>'}</td>
      <td>${dateCell}</td><td style="text-align:right">${totCell}</td><td style="text-align:right">${stN(r.target)}</td><td style="text-align:right">${stN(r.counted)}</td>
      <td style="text-align:right;${r.gap<-0.005?'color:var(--red)':''}">${stN(r.gap)}</td><td style="text-align:right">${stN(r.interest)}</td>
      <td style="text-align:right;font-weight:700;color:${jv?'var(--text)':(r.due>0.5?'var(--green)':'var(--text2)')}">${jv?stN(r.canFund)+' <span style="font-weight:400;font-size:10px">can fund</span>':stN(r.due)}</td>
      <td style="text-align:center">${(!jv&&nextOf(b.id))?`<input type="checkbox" title="Pull the oldest payments of the NEXT bill into this bill until its due is ~0" ${cfg.fetch[b.id]?'checked':''} onchange="stFetch('${b.id}',this.checked)">`:''}${r.fetchedIn>0?`<div style="font-size:10px;color:var(--text3)">in ${stN(r.fetchedIn)}</div>`:''}${r.fetchedOut>0?`<div style="font-size:10px;color:var(--text3)">out ${stN(r.fetchedOut)}</div>`:''}</td></tr>
      ${open?`<tr><td colspan="9" style="padding:0">${stLinesHtml(r,blkOpts)}</td></tr>`:''}`; };
  const sum=(rows,f)=>rows.reduce((s,r)=>s+(f(r)||0),0);
  const unRec=res.unRec;
  const newOpen=res.open.filter(x=>!known.has(x.l.k)), newRec=unRec.filter(l=>!known.has(l.k));
  body.innerHTML=`
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;font-size:12px">
      <label>Interest % <input type="number" step="0.01" value="${(cfg.rate*100)}" onchange="stSetting('rate',this.value/100)" style="width:64px"></label>
      <label>Close at % <input type="number" step="1" value="${Math.round(cfg.pct*100)}" onchange="stSetting('pct',this.value/100)" style="width:56px"></label>
      <label><input type="checkbox" ${cfg.comp?'checked':''} onchange="stSetting('comp',this.checked)"> add interest to principal each 31 March</label>
      <span style="margin-left:auto"></span>
      <button class="btn btn-sm" onclick="stReload('${cid}')">↻ Refresh from Tally</button>
      <button class="btn btn-sm" onclick="stAutoBtn()">⚙️ Auto-assign open payments</button>
      <button class="btn btn-sm" onclick="stUndoBtn()" ${cfg.prev?'':'disabled'}>↩ Undo last bulk change</button>
      <button class="btn btn-sm" onclick="stAddBlock()">＋ Add block</button>
      <button class="btn btn-sm" onclick="stExcel()">⬇ Excel</button></div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Each bill = one project (part bills together). Estimated at ${Math.round(cfg.pct*100)}% of what was received, because his old payments have no cost centres. Read-only on Tally; nothing here changes cost centres.</div>
    <div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>Block</th><th>Received on / expected</th><th style="text-align:right">Received / JV amount</th><th style="text-align:right">${Math.round(cfg.pct*100)}% to close</th><th style="text-align:right">Payments counted</th><th style="text-align:right">Gap (− = over)</th><th style="text-align:right">Interest</th><th style="text-align:right">Due to contractor</th><th title="Pull payments of the next bill into this one">Fetch</th></tr></thead>
    <tbody>${bills.map(tr).join('')}${bills.length?`<tr style="font-weight:700;background:var(--surface2)"><td>Bills received</td><td></td><td style="text-align:right">${stN(sum(bills,r=>r.total))}</td><td style="text-align:right">${stN(sum(bills,r=>r.target))}</td><td style="text-align:right">${stN(sum(bills,r=>r.counted))}</td><td></td><td style="text-align:right">${stN(sum(bills,r=>r.interest))}</td><td style="text-align:right">${stN(sum(bills,r=>r.due))}</td><td></td></tr>`:'<tr><td colspan="9" style="color:var(--text3)">No project of this contractor has a recorded settlement yet. Use ＋ Add block.</td></tr>'}
    ${jvs.map(tr).join('')}${jvs.length?`<tr style="font-weight:700;background:var(--surface2)"><td>Pending JVs</td><td></td><td style="text-align:right">${stN(sum(jvs,r=>r.b.amt))}</td><td style="text-align:right">${stN(sum(jvs,r=>r.target))}</td><td style="text-align:right">${stN(sum(jvs,r=>r.counted))}</td><td></td><td style="text-align:right">${stN(sum(jvs,r=>r.interest))}</td><td style="text-align:right">${stN(sum(jvs,r=>r.canFund))} can fund</td><td></td></tr>`:''}</tbody></table></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin:12px 0;font-size:12px">
      <div class="card" style="padding:10px"><b>Position</b><br>Paid to / for him (all payments): <b>${stN(res.allPaid)}</b><br>Received for him (all receipts): <b>${stN(res.allRec)}</b><br>Counted in blocks: <b>${stN(sum(res.rows,r=>r.counted))}</b> · Open: <b>${stN(res.openTotal)}</b>
        <br><span style="color:${Math.abs(sum(res.rows,r=>r.counted)+res.openTotal-res.allPaid)<0.5?'var(--green)':'var(--red)'}">Check: counted + open − all payments = ${stN(sum(res.rows,r=>r.counted)+res.openTotal-res.allPaid)}</span></div>
      <div class="card" style="padding:10px"><b>We owe him on bills received</b><br><span style="font-size:18px;font-weight:800">${stN(sum(bills,r=>r.due))}</span><br>after ${Math.round(cfg.pct*100)}% payments and interest<br><span style="color:var(--text3)">Can still fund on pending JVs: <b>${stN(sum(jvs,r=>r.canFund))}</b></span></div></div>
    ${newOpen.length||newRec.length?`<div class="card" style="padding:10px;margin-bottom:10px;border-left:4px solid var(--amber);font-size:12px">🆕 ${newOpen.length} new open payment${newOpen.length===1?'':'s'} and ${newRec.length} new receipt${newRec.length===1?'':'s'} since you last marked things seen. <button class="btn btn-sm" onclick="stSeen()">Mark all seen</button></div>`:''}
    <details ${res.open.length&&SETL.shown.open?'open':''} ontoggle="SETL.shown.open=this.open"><summary style="cursor:pointer;font-weight:700">Open payments — not counted in any block (${res.open.length} · ${stN(res.openTotal)})</summary>
      <div style="overflow:auto;max-height:420px"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>Date</th><th>Voucher</th><th>Cost centre</th><th>Narration</th><th style="text-align:right">Open amount</th><th>Count it in</th></tr></thead><tbody>${res.open.slice(0,600).map(x=>`<tr><td>${stD(x.l.d)}${known.has(x.l.k)?'':' 🆕'}</td><td>${stE(x.l.t)} ${stE(x.l.n)}</td><td>${stE(x.l.cc||'—')}</td><td style="max-width:260px">${stE(x.l.nar)}</td><td style="text-align:right">${stN(x.rem)}</td><td><select onchange="stMoveOpen('${stE(x.l.k)}',this.value);this.value=''" style="font-size:11px;max-width:180px">${blkOpts('')}</select></td></tr>`).join('')}</tbody></table></div></details>
    <details ${SETL.shown.rec?'open':''} ontoggle="SETL.shown.rec=this.open" style="margin-top:6px"><summary style="cursor:pointer;font-weight:700">Receipts not linked to a bill (${unRec.length} · ${stN(unRec.reduce((s,l)=>s+l.a,0))})</summary>
      <div style="font-size:11px;color:var(--text3);margin:4px 0">These are credits in his ledger that no project settlement is linked to (refunds, transfers…). Choose a block only if the receipt really belongs to that bill; it then adds to that block's total.</div>
      <div style="overflow:auto;max-height:360px"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>Date</th><th>Voucher</th><th>Cost centre</th><th>Narration</th><th style="text-align:right">Amount</th><th>Belongs to</th></tr></thead><tbody>${unRec.map(l=>`<tr><td>${stD(l.d)}${known.has(l.k)?'':' 🆕'}</td><td>${stE(l.t)} ${stE(l.n)}</td><td>${stE(l.cc||'—')}</td><td style="max-width:260px">${stE(l.nar)}</td><td style="text-align:right">${stN(l.a)}</td><td><select onchange="stRecv('${stE(l.k)}',this.value)" style="font-size:11px;max-width:180px"><option value="">Not counted</option>${blocks.map(b=>`<option value="${stE(b.id)}" ${cfg.recv[l.k]===b.id?'selected':''}>${b.type==='jv'?'JV':'Bill'} · ${stE(b.label.substring(0,40))}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div></details>`;
}
function stLinesHtml(r,blkOpts){
  const rows=[]; r.receipts.forEach(x=>rows.push(`<tr style="background:#eef6ee"><td>${stD(x.d)}</td><td>${stE(x.t)} ${stE(x.n)}</td><td>${stE(x.cc||'—')}</td><td>Receipt</td><td style="text-align:right">${stN(x.a)}</td><td style="text-align:right">—</td><td></td></tr>`));
  r.pieces.forEach(p=>rows.push(`<tr><td>${stD(p.l.d)}</td><td>${stE(p.l.t)} ${stE(p.l.n)}</td><td>${stE(p.l.cc||'—')}</td><td style="max-width:240px">${stE(p.l.nar)}${p.from?` <span style="background:var(--amber);color:#fff;border-radius:6px;padding:0 6px;font-size:10px">fetched from ${stE((SETL._byId&&SETL._byId[p.from])||'next bill')}</span>`:''}</td><td style="text-align:right">${stN(p.a)}</td><td style="text-align:right">${stN(p.int)}</td>
    <td><select onchange="stMovePiece('${stE(p.k)}','${stE(p.orig)}',this.value)" style="font-size:11px;max-width:170px">${blkOpts(p.orig)}</select></td></tr>`));
  return `<div style="overflow:auto;max-height:380px;padding:6px 10px"><table class="tbl" style="width:100%;font-size:11.5px"><thead><tr><th>Date</th><th>Voucher</th><th>Cost centre</th><th>Narration</th><th style="text-align:right">Amount</th><th style="text-align:right">Interest</th><th>Move to</th></tr></thead><tbody>${rows.join('')||'<tr><td colspan="7" style="color:var(--text3)">Nothing counted here yet.</td></tr>'}</tbody></table></div>`;
}
const _stIds=()=>{ const {blocks}=stModel(); SETL._byId={}; blocks.forEach(b=>SETL._byId[b.id]=b.label.substring(0,28)); };

// ───────── actions ─────────
function stRedraw(){ _stIds(); stSave(); stDraw(); }
function stOpenBlk(id){ SETL.openBlk[id]=!SETL.openBlk[id]; _stIds(); stDraw(); }
function stSetting(k,v){ const cfg=stC(SETL.cid); if(typeof v==='number'&&!isFinite(v)) return; cfg[k]=v; stRedraw(); }
function stSetDate(id,v){ const cfg=stC(SETL.cid); if(v) cfg.date[id]=v; else delete cfg.date[id]; stRedraw(); }
function stSetAmt(id,v){ const cfg=stC(SETL.cid); cfg.jvAmt[id]=Number(v)||0; stRedraw(); }
function stFetch(id,on){ const cfg=stC(SETL.cid); if(on) cfg.fetch[id]=true; else delete cfg.fetch[id]; stRedraw(); }
function stRecv(k,b){ const cfg=stC(SETL.cid); if(b) cfg.recv[k]=b; else delete cfg.recv[k]; stRedraw(); }
function stSnap(){ const cfg=stC(SETL.cid); cfg.prev=JSON.stringify(cfg.alloc); }
function stMoveOpen(k,b){ if(!b) return; const cfg=stC(SETL.cid); const l=SETL.lines.find(x=>x.k===k); if(!l) return;
  const used=(cfg.alloc[k]||[]).reduce((s,e)=>s+e.a,0); const rem=stR2(l.a-used); if(rem<=0) return;
  const arr=cfg.alloc[k]=cfg.alloc[k]||[]; const e=arr.find(x=>x.b===b); if(e) e.a=stR2(e.a+rem); else arr.push({b,a:rem}); stRedraw(); }
function stMovePiece(k,from,to){ const cfg=stC(SETL.cid); const arr=cfg.alloc[k]||[]; const i=arr.findIndex(x=>x.b===from); if(i<0) return; const a=arr[i].a; arr.splice(i,1);
  if(to){ const e=arr.find(x=>x.b===to); if(e) e.a=stR2(e.a+a); else arr.push({b:to,a}); } if(!arr.length) delete cfg.alloc[k]; else cfg.alloc[k]=arr; stRedraw(); }
function stAutoBtn(){ const cfg=stC(SETL.cid); const blocks=stBlocksOf(SETL.cid,cfg); stSnap(); stAutoAssign(SETL.lines,blocks,cfg); toast('Open payments assigned by the 70% rule (own cost centre first, then oldest first). You can move any of them, or press Undo.','ok',5000); stRedraw(); }
function stUndoBtn(){ const cfg=stC(SETL.cid); if(!cfg.prev) return; cfg.alloc=JSON.parse(cfg.prev); cfg.prev=null; stRedraw(); }
function stSeen(){ const cfg=stC(SETL.cid); cfg.known=SETL.lines.map(l=>l.k); stRedraw(); }
async function stAddBlock(){
  const label=prompt('Name of the new block (a bill or a JV not found in the projects):'); if(!label||!label.trim()) return;
  const t=(prompt('Type "bill" (money received) or "jv" (JV expected):','bill')||'').trim().toLowerCase(); if(t!=='bill'&&t!=='jv') { toast('Type must be bill or jv','error'); return; }
  const date=prompt('Date received / expected (YYYY-MM-DD), blank if not known:','')||''; const amt=t==='jv'?Number(prompt('Expected JV amount:','0'))||0:0;
  const cfg=stC(SETL.cid); cfg.manual.push({id:'m'+Date.now().toString(36),type:t,label:label.trim(),date:date.trim(),amt,ccs:[]}); stRedraw();
}

// ───────── Excel ─────────
function stExcel(){
  const {cfg,blocks,res}=stModel(); const c=(D.contractors||[]).find(x=>x.id===SETL.cid)||{name:''}; const wb=XLSX.utils.book_new();
  const sheet=(aoa,w)=>{ const ws=XLSX.utils.aoa_to_sheet(aoa); ws['!cols']=w.map(x=>({wch:x})); return ws; };
  const s=[[c.name+' — settlement by bills ('+Math.round(cfg.pct*100)+'%, interest '+(cfg.rate*100)+'%'+(cfg.comp?', compounded each 31 March':', simple')+')'],[],['Block','Type','Date','Received / JV amount','To close','Counted','Gap','Interest','Due to contractor / can fund']];
  res.rows.forEach(r=>s.push([r.b.label,r.b.type==='jv'?'Pending JV':'Bill',r.b.date,stR2(r.total),r.target,stR2(r.counted),r.gap,stR2(r.interest),r.b.type==='jv'?r.canFund:r.due]));
  s.push([],['Open payments (not counted)',,,,,stR2(res.openTotal)]);
  XLSX.utils.book_append_sheet(wb,sheet(s,[48,12,12,18,14,14,14,14,22]),'Summary');
  const used=new Set(['Summary']);
  res.rows.forEach(r=>{ let nm=(r.b.type==='jv'?'JV ':'')+r.b.label.replace(/[\\\/\?\*\[\]:]/g,' ').substring(0,26); let n=nm,i=2; while(used.has(n)) n=nm.substring(0,24)+'~'+(i++); used.add(n);
    const a=[[r.b.label+' — '+stD(r.b.date)],['Total',stR2(r.total),'To close',r.target,'Counted',stR2(r.counted),'Interest',stR2(r.interest),'Due',r.due==null?r.canFund:r.due],[],['Date','Voucher','Cost centre','Narration','Role','Amount counted','Interest','Fetched from']];
    r.receipts.forEach(x=>a.push([x.d,x.t+' '+x.n,x.cc,x.nar,'Receipt',x.a,'','']));
    r.pieces.forEach(p=>a.push([p.l.d,p.l.t+' '+p.l.n,p.l.cc,p.l.nar,'Payment',stR2(p.a),stR2(p.int),p.from?(SETL._byId&&SETL._byId[p.from]||'next bill'):'']));
    XLSX.utils.book_append_sheet(wb,sheet(a,[12,20,34,50,10,16,14,22]),n); });
  const o=[['Date','Voucher','Cost centre','Narration','Open amount']]; res.open.forEach(x=>o.push([x.l.d,x.l.t+' '+x.l.n,x.l.cc,x.l.nar,stR2(x.rem)]));
  XLSX.utils.book_append_sheet(wb,sheet(o,[12,20,34,50,16]),'Open payments');
  XLSX.writeFile(wb,'Settlement_'+c.name.replace(/[^A-Za-z0-9]+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.xlsx');
}
