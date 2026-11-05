// ═══════════════════════════════════════════════════════
// tallylive.js — Tally Live (READ-ONLY mirror of TallyPrime)
// Day Book, contractor / ledger / cost-centre / project views with interest, and (Super Admin) the Linking page.
// All data comes through the tally-api Edge Function; nothing is ever written to Tally.
// The tally_* tables are not readable with the app's public key — this page asks for the
// password once and keeps a short-lived signed token in memory only (never stored).
// ═══════════════════════════════════════════════════════

const TL_API = SB_URL + '/functions/v1/tally-api';
const TL_RATE = 24;                                   // % per annum
let TL = { token:null, admin:false, tab:'daybook', hist:false,
  ledgers:null, ledgerProj:{}, cc:null, ccLinks:null, totals:null,
  dbq:{from:'',to:'',type:'',text:''}, led:'', cont:'', ccq:'', ccc:'', ccsel:null, prq:'', prsel:null,
  linkq:'', linkkind:'ledgers', ledEdit:{}, ccEdit:{}, stmt:null };

function _tlE(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function _tlA(s){ return _tlE(s).replace(/`/g,'&#96;'); }
function _tlN(n){ return (Number(n)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function _tlAmt(n){ n=Number(n)||0; const a=Math.abs(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); return a+(n<0?' Dr':n>0?' Cr':''); }
function _tlDate(d){ if(!d) return ''; const p=String(d).split('-'); return p[2]+'-'+p[1]+'-'+p[0]; }
function _tlToday(){ const t=new Date(); return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); }
function tlv(id){ const e=document.getElementById(id); return e?e.value:''; }

async function tlCall(body){
  const r = await fetch(TL_API, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_KEY,'apikey':SB_KEY}, body:JSON.stringify(body) });
  let j={}; try{ j=await r.json(); }catch(e){}
  if(r.status===401 && body.action!=='login'){ TL.token=null; throw new Error('SESSION'); }
  if(!r.ok) throw new Error((j.error||('Error '+r.status))+(j.owner_row_found===false?' (server could not find the owner password record)':''));
  return j;
}
const tlApi = (action, extra) => tlCall(Object.assign({action, token:TL.token, history:TL.hist}, extra||{}));

// ───────── projects & contractors known to the app ─────────
function _tlContractorName(p){ const c=(D.contractors||[]).find(x=>x.id===p.contractorId); return (c&&c.name)||p.contractorName||p.contractor||''; }
function _tlProjects(){
  return (D.projects||[]).filter(p=>p.tender && !(typeof isArchived==='function' && isArchived(p)))
    .map(p=>({tender:String(p.tender), name:p.name||'(no name)', contractor:_tlContractorName(p), status:p.status||''}));
}
function _tlProj(t){ return _tlProjects().find(p=>p.tender===String(t)); }
function _tlContractors(){ return [...new Set((D.contractors||[]).map(c=>c.name).filter(Boolean))].sort(); }

// ───────── small modal helpers ─────────
function tlModal(title, html, buttons){
  return new Promise(res=>{
    const old=document.getElementById('tl-modal'); if(old) old.remove();
    const d=document.createElement('div'); d.id='tl-modal';
    d.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    d.innerHTML=`<div style="background:var(--surface,#fff);color:var(--text,#111);border-radius:12px;max-width:680px;width:100%;max-height:88vh;overflow:auto;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.35)">
      <div style="font-size:16px;font-weight:700;margin-bottom:10px">${title}</div><div style="font-size:13px;line-height:1.5">${html}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:14px">${buttons.map((b,i)=>`<button class="btn btn-sm${b.primary?' btn-primary':''}" data-i="${i}">${_tlE(b.label)}</button>`).join('')}</div></div>`;
    document.body.appendChild(d);
    d.querySelectorAll('button[data-i]').forEach(bt=>bt.onclick=()=>{ const v=buttons[+bt.dataset.i].value; const pick=d._pick; d.remove(); res(v==='__pick'?pick:v); });
  });
}
// searchable multi-select of the app's projects; resolves to an array of tender ids, or null if cancelled
function tlPickProjects(selected, title){
  return new Promise(res=>{
    const sel=new Set((selected||[]).map(String)); const all=_tlProjects();
    const old=document.getElementById('tl-modal'); if(old) old.remove();
    const d=document.createElement('div'); d.id='tl-modal';
    d.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    d.innerHTML=`<div style="background:var(--surface,#fff);color:var(--text,#111);border-radius:12px;max-width:720px;width:100%;max-height:90vh;display:flex;flex-direction:column;padding:18px">
      <div style="font-size:16px;font-weight:700;margin-bottom:8px">${_tlE(title||'Choose projects')}</div>
      <input id="tl-pp-q" placeholder="Search project name, tender no. or contractor…" style="width:100%;margin-bottom:8px">
      <div id="tl-pp-list" style="overflow:auto;flex:1;border:1px solid var(--border);border-radius:8px;min-height:200px"></div>
      <div id="tl-pp-n" style="font-size:12px;color:var(--text3);margin:6px 0"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-sm" id="tl-pp-x">Cancel</button><button class="btn btn-sm btn-primary" id="tl-pp-ok">Use selected</button></div></div>`;
    document.body.appendChild(d);
    const draw=()=>{ const q=tlv('tl-pp-q').toLowerCase();
      const rows=all.filter(p=>!q||(p.name+' '+p.tender+' '+p.contractor).toLowerCase().includes(q)).sort((a,b)=>(sel.has(b.tender)?1:0)-(sel.has(a.tender)?1:0)||a.name.localeCompare(b.name)).slice(0,200);
      document.getElementById('tl-pp-list').innerHTML=rows.map(p=>`<label style="display:flex;gap:8px;padding:6px 10px;border-bottom:1px solid var(--border);cursor:pointer;font-size:12px;align-items:flex-start"><input type="checkbox" data-t="${_tlA(p.tender)}" ${sel.has(p.tender)?'checked':''}><span><b>#${_tlE(p.tender)}</b> ${_tlE(p.name)}<br><span style="color:var(--text3)">${_tlE(p.contractor||'no contractor')} ${p.status?'· '+_tlE(p.status):''}</span></span></label>`).join('')||'<div style="padding:14px;color:var(--text3)">No project matches.</div>';
      document.getElementById('tl-pp-n').textContent=sel.size+' selected';
      document.querySelectorAll('#tl-pp-list input[data-t]').forEach(c=>c.onchange=()=>{ c.checked?sel.add(c.dataset.t):sel.delete(c.dataset.t); document.getElementById('tl-pp-n').textContent=sel.size+' selected'; }); };
    document.getElementById('tl-pp-q').oninput=draw; draw();
    document.getElementById('tl-pp-x').onclick=()=>{ d.remove(); res(null); };
    document.getElementById('tl-pp-ok').onclick=()=>{ d.remove(); res([...sel]); };
  });
}

// ───────── interest (24% simple daily on the running balance, compounded every 31 March) ─────────
// Same rules as the app's Interest tab: interest accrues daily on the running balance; every 31 March the year's
// accrued interest is added to the principal; receipts reduce the balance; no interest while the balance is nil.
function _tlMs(d){ const p=d.split('-'); return Date.UTC(+p[0],+p[1]-1,+p[2]); }
function _tlDays(a,b){ return Math.max(0,Math.round((_tlMs(b)-_tlMs(a))/86400000)); }
function _tlNextDay(d){ const t=new Date(_tlMs(d)+86400000); return t.getUTCFullYear()+'-'+String(t.getUTCMonth()+1).padStart(2,'0')+'-'+String(t.getUTCDate()).padStart(2,'0'); }
function _tlFY(d){ const p=d.split('-'); const y=+p[1]>=4?+p[0]:+p[0]-1; return 'FY '+y+'-'+String(y+1).slice(-2); }
// txs: [{date, delta}] delta>0 = money paid out (adds to principal), delta<0 = money received (reduces it)
function tlInterest(txs, opening, startDate, asOn, ratePct){
  const rate=ratePct/100, ev=txs.map(t=>({date:t.date,delta:t.delta,k:0})).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  const startY=+startDate.slice(0,4), endY=+asOn.slice(0,4);
  for(let y=startY;y<=endY;y++){ const d=y+'-03-31'; if(d>=startDate && d<asOn) ev.push({date:d,delta:0,k:1}); }
  ev.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.k-b.k);
  let bal=Number(opening)||0, acc=0, prev=startDate, total=0; const fy={};
  const F=l=>fy[l]||(fy[l]={fy:l,interest:0,capitalised:0,endPrincipal:0});
  const accrue=(to)=>{ if(bal>0 && to>prev){ let cur=prev; // split so each day is attributed to its own FY
      const d=_tlDays(cur,to); const i=bal*rate*d/365; acc+=i; total+=i; F(_tlFY(_tlNextDay(cur))).interest+=i; } };
  for(const e of ev){
    if(e.date>asOn) break;
    accrue(e.date); prev=e.date>prev?e.date:prev;
    if(e.k===1){ const f=F(_tlFY(e.date)); f.capitalised+=acc; bal+=acc; acc=0; f.endPrincipal=bal; }
    else if(e.delta>0) bal+=e.delta; else bal=Math.max(0,bal+e.delta);
  }
  accrue(asOn); const last=F(_tlFY(asOn)); if(!last.endPrincipal) last.endPrincipal=bal;
  return { fy:Object.values(fy).sort((a,b)=>a.fy<b.fy?-1:1), principal:bal, accrued:acc, totalInterest:total, due:bal+acc };
}

// ───────── page shell / login ─────────
async function renderTallyLive(){
  const el = document.getElementById('sec-tally'); if(!el) return;
  if(!TL.token){ _tlLoginView(el); return; }
  _tlShell(el); _tlTab(TL.tab);
}
function _tlLoginView(el, msg){
  el.innerHTML = `<div class="wrap" style="max-width:420px;margin:40px auto">
    <div class="card" style="padding:24px">
      <div style="font-size:18px;font-weight:700;margin-bottom:6px">📒 Tally Live</div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:14px">Read-only copy of your Tally books. Enter your password once to unlock it.</div>
      <input id="tl-pw" type="password" placeholder="Your password" onkeydown="if(event.key==='Enter')tlLogin()" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--rs);font-size:14px;box-sizing:border-box">
      <div id="tl-err" style="color:#c0392b;font-size:12px;margin-top:8px;min-height:16px">${_tlE(msg||'')}</div>
      <button class="btn btn-primary" onclick="tlLogin()" style="margin-top:6px;width:100%">Unlock</button>
    </div></div>`;
  setTimeout(()=>{ const i=document.getElementById('tl-pw'); if(i) i.focus(); },50);
}
async function tlLogin(){
  const pw = tlv('tl-pw'); const er = document.getElementById('tl-err'); if(er) er.textContent='Checking…';
  try{ const j = await tlCall({action:'login', password:pw});
    TL.token=j.token; TL.admin=!!j.admin; TL.ledgers=null; TL.cc=null; TL.totals=null; renderTallyLive();
  }catch(e){ if(er) er.textContent = e.message; }
}
function _tlShell(el){
  const tabs=[['daybook','Day Book'],['contractor','Contractor'],['ledgers','Ledgers'],['cc','Cost Centres'],['projects','Projects']];
  if(TL.admin) tabs.push(['linking','🔗 Linking']);
  el.innerHTML = `<div class="wrap">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
      <div style="font-size:18px;font-weight:700">📒 Tally Live</div>
      <span id="tl-sync" style="font-size:12px;color:var(--text3)">…</span>
      <label style="font-size:12px;display:flex;gap:5px;align-items:center;margin-left:auto" title="Also use the old FY2024-25 company (1-Apr-2024 to 31-Mar-2025) in statements, totals and interest"><input type="checkbox" ${TL.hist?'checked':''} onchange="TL.hist=this.checked;TL.totals=null;_tlTab(TL.tab)"> Include FY2024-25 history</label>
      <button class="btn btn-sm" onclick="tlSyncNow()">⟳ Sync now</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
      ${tabs.map(t=>`<button class="btn btn-sm${TL.tab===t[0]?' btn-primary':''}" onclick="_tlTab('${t[0]}')">${t[1]}</button>`).join('')}
    </div>
    <div id="tl-body"></div></div>`;
  tlApi('overview').then(o=>{
    const s=o.last_sync, e=document.getElementById('tl-sync'); if(!e) return;
    e.textContent = s ? `Last sync ${new Date(s.finished_at||s.started_at).toLocaleString('en-IN')} · ${s.status} · ${o.vouchers} vouchers` : 'No sync yet';
  }).catch(_tlErr);
}
async function tlSyncNow(){ try{ await tlApi('sync_now'); toast('Sync requested — the office PC picks it up within a minute.'); }catch(e){ _tlErr(e); } }
function _tlErr(e){
  if(e && e.message==='SESSION'){ _tlLoginView(document.getElementById('sec-tally'),'Session expired — enter your password again.'); return; }
  const b=document.getElementById('tl-body'); const m='⚠️ '+(e&&e.message||e);
  if(b) b.innerHTML=`<div class="card" style="padding:16px;color:#c0392b">${_tlE(m)}</div>`; else toast(m,'error');
}
function _tlTab(t){
  TL.tab=t; _tlShell(document.getElementById('sec-tally'));
  ({daybook:_tlDaybook, contractor:_tlContractor, ledgers:_tlLedgers, cc:_tlCC, projects:_tlProjectsTab, linking:_tlLinking})[t]();
}
function _tlBusy(){ const b=document.getElementById('tl-body'); if(b) b.innerHTML='<div style="padding:30px;text-align:center;color:var(--text3)">⏳ Loading…</div>'; return b; }
async function _tlLoadLedgers(){
  if(!TL.ledgers){ const r=await tlApi('ledgers'); TL.ledgers=r.ledgers; TL.ledgerProj={};
    (r.ledger_projects||[]).forEach(x=>{ (TL.ledgerProj[x.ledger_guid]=TL.ledgerProj[x.ledger_guid]||[]).push(String(x.tender_id)); }); }
  return TL.ledgers;
}
async function _tlLoadCC(){ if(!TL.cc){ const r=await tlApi('cost_centres'); TL.cc=r.cost_centres; TL.ccLinks=r.links; } return TL.cc; }
async function _tlLoadTotals(){
  if(!TL.totals){ const r=await tlApi('cc_totals'); const m={};
    r.rows.forEach(x=>{ const k=x.cc_name.toLowerCase(); const o=m[k]||(m[k]={paid:0,received:0,n:0,first:x.first,last:x.last}); o.paid+=x.paid; o.received+=x.received; o.n+=x.n; if(x.first<o.first)o.first=x.first; if(x.last>o.last)o.last=x.last; });
    TL.totals=m; }
  return TL.totals;
}
function _tlCCProjects(c){ return (TL.ccLinks||[]).filter(l=>l.cc_guid===c.guid).map(l=>String(l.tender_id)); }
// the contractor of a cost centre: the one set on it, else the contractor of its linked projects
function _tlCCContractor(c){
  if(c.contractor_name) return {name:c.contractor_name, how:'set'};
  const names=[...new Set(_tlCCProjects(c).map(t=>(_tlProj(t)||{}).contractor).filter(Boolean))];
  if(names.length===1) return {name:names[0], how:'from project'};
  if(names.length>1) return {name:names[0], how:'several', all:names};
  return {name:'', how:'none'};
}

// ───────── Day Book ─────────
async function _tlDaybook(){
  const q=TL.dbq; const b=document.getElementById('tl-body');
  b.innerHTML = `<div class="card" style="padding:12px;margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:end">
    <label style="font-size:11px">From<br><input type="date" id="tl-f" value="${_tlA(q.from)}"></label>
    <label style="font-size:11px">To<br><input type="date" id="tl-t" value="${_tlA(q.to)}"></label>
    <label style="font-size:11px">Type<br><select id="tl-ty"><option value="">All</option><option${q.type==='Payment'?' selected':''}>Payment</option><option${q.type==='Receipt'?' selected':''}>Receipt</option></select></label>
    <label style="font-size:11px">Search name / narration<br><input id="tl-x" value="${_tlA(q.text)}" style="min-width:180px" onkeydown="if(event.key==='Enter')_tlDbGo()"></label>
    <button class="btn btn-primary btn-sm" onclick="_tlDbGo()">Show</button></div><div id="tl-db"></div>`;
  _tlDbRun();
}
function _tlDbGo(){ TL.dbq={from:tlv('tl-f'),to:tlv('tl-t'),type:tlv('tl-ty'),text:tlv('tl-x')}; _tlDbRun(); }
async function _tlDbRun(){
  const d=document.getElementById('tl-db'); d.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">⏳ Loading…</div>';
  try{
    const q=TL.dbq; const r=await tlApi('daybook',{from:q.from,to:q.to,vch_type:q.type,text:q.text,limit:300});
    if(!r.vouchers.length){ d.innerHTML='<div class="card" style="padding:16px;color:var(--text3)">No vouchers match.</div>'; return; }
    d.innerHTML = `<div style="font-size:12px;color:var(--text3);margin-bottom:6px">${r.vouchers.length} vouchers (newest first, max 300)</div>`+
      r.vouchers.map(v=>`<div class="card" style="padding:10px 12px;margin-bottom:6px">
        <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px"><b>${_tlDate(v.vch_date)}</b><span style="background:var(--surface2);border-radius:6px;padding:1px 7px">${_tlE(v.vch_type)} ${_tlE(v.vch_number)}</span></div>
        ${v.lines.sort((a,c)=>a.line_no-c.line_no).map(l=>`<div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-top:3px"><span>${_tlE(l.ledger_name)}${v.allocs.filter(a=>a.line_no===l.line_no).map(a=>`<span style="color:var(--text3);font-size:11px"> · ${_tlE(a.cc_name)}</span>`).join('')}</span><span style="white-space:nowrap">${_tlAmt(l.amount)}</span></div>`).join('')}
        ${v.narration?`<div style="font-size:12px;color:var(--text3);margin-top:4px">${_tlE(v.narration)}</div>`:''}</div>`).join('');
  }catch(e){ _tlErr(e); }
}

// ───────── statement table with tick-boxes + interest ─────────
// st = {rows:[{vch_date,vch_type,vch_number,narration,ledger,amount,synthetic}], opening, openingDate, title}
function _tlStatement(st, target){
  TL.stmt=st; const rows=st.rows; let bal=Number(st.opening)||0, dr=0, cr=0;
  const showL=rows.some(r=>r.ledger||r.ledger_name);
  const body=rows.map((r,i)=>{ const a=Number(r.amount)||0; bal+=a; if(a<0) dr+=-a; else cr+=a;
    return `<tr${r.synthetic?' style="background:var(--surface2)"':''}><td><input type="checkbox" class="tl-ck" data-i="${i}" checked></td><td>${_tlDate(r.vch_date)}${r.source==='fy2425'?' <span title="FY2024-25 company" style="font-size:9px;color:var(--text3)">·24-25</span>':''}</td><td>${_tlE(r.vch_type)} ${_tlE(r.vch_number||'')}</td>${showL?`<td>${_tlE(r.ledger||r.ledger_name||'')}${r.cc_name?`<div style="font-size:10px;color:var(--text3)">${_tlE(r.cc_name)}</div>`:''}</td>`:''}<td style="max-width:300px">${_tlE(r.narration||r.party_ledger||'')}</td><td style="text-align:right">${a<0?_tlN(-a):''}</td><td style="text-align:right">${a>0?_tlN(a):''}</td><td style="text-align:right;white-space:nowrap">${_tlAmt(bal)}</td></tr>`; }).join('');
  const hasOpen=st.opening!=null;
  target.innerHTML=`<div style="font-weight:700;margin:12px 0 6px">${_tlE(st.title||'')}</div>
   <div class="card" style="padding:10px;margin-bottom:8px;font-size:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:end">
     <b>Interest</b>
     <label>As on<br><input type="date" id="ti-asof" value="${_tlToday()}"></label>
     <label>Rate % p.a.<br><input type="number" step="0.5" id="ti-rate" value="${TL_RATE}" style="width:64px"></label>
     ${hasOpen?`<label style="display:flex;gap:4px;align-items:end"><input type="checkbox" id="ti-open" checked> include opening balance</label>`:''}
     <label>Tick rows from<br><input type="date" id="ti-f"></label><label>to<br><input type="date" id="ti-t"></label>
     <button class="btn btn-sm" onclick="_tlTickRange()">Tick range</button><button class="btn btn-sm" onclick="_tlTickAll(true)">All</button><button class="btn btn-sm" onclick="_tlTickAll(false)">None</button>
     <button class="btn btn-sm btn-primary" onclick="_tlCalcInterest()">Calculate interest on ticked rows</button></div>
   <div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th></th><th>Date</th><th>Voucher</th>${showL?'<th>Ledger / cost centre</th>':''}<th>Narration</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th></tr></thead><tbody>
    ${hasOpen?`<tr style="background:var(--surface2)"><td></td><td colspan="${showL?6:5}"><b>Opening balance (${_tlDate(st.openingDate)})</b></td><td style="text-align:right">${_tlAmt(st.opening)}</td></tr>`:''}
    ${body}<tr style="font-weight:700;background:var(--surface2)"><td></td><td colspan="${showL?4:3}">Totals</td><td style="text-align:right">${_tlN(dr)}</td><td style="text-align:right">${_tlN(cr)}</td><td style="text-align:right">${_tlAmt(bal)}</td></tr></tbody></table></div>
   <div style="font-size:11px;color:var(--text3);margin-top:6px">Dr = paid out (adds to what the party owes RSR) · Cr = received (reduces it). Tick only the rows that should carry interest.</div>`;
  target.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function _tlTickAll(v){ document.querySelectorAll('.tl-ck').forEach(c=>c.checked=v); }
function _tlTickRange(){ const f=tlv('ti-f'), t=tlv('ti-t'); const rows=TL.stmt.rows;
  document.querySelectorAll('.tl-ck').forEach(c=>{ const d=rows[+c.dataset.i].vch_date; c.checked=(!f||d>=f)&&(!t||d<=t); }); }
function _tlCalcInterest(){
  const st=TL.stmt, rows=st.rows; const sel=[...document.querySelectorAll('.tl-ck')].filter(c=>c.checked).map(c=>rows[+c.dataset.i]);
  const asOn=tlv('ti-asof')||_tlToday(), rate=parseFloat(tlv('ti-rate'))||TL_RATE;
  const useOpen=!!document.getElementById('ti-open') && document.getElementById('ti-open').checked && st.opening!=null;
  if(!sel.length && !useOpen){ toast('Tick at least one row','error'); return; }
  const txs=sel.map(r=>({date:r.vch_date, delta:-(Number(r.amount)||0)}));
  const opening=useOpen?-(Number(st.opening)||0):0;                // Dr balance (negative in Tally) = money out = positive principal
  const start=useOpen?st.openingDate:(sel.map(r=>r.vch_date).sort()[0]);
  const res=tlInterest(txs, opening, start, asOn, rate);
  const sums=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:10px">
     ${[['Principal (incl. compounded interest)',res.principal],['Interest not yet compounded',res.accrued],['Total due',res.due],['Total interest charged',res.totalInterest]].map(x=>`<div class="card" style="padding:8px"><div style="font-size:10px;color:var(--text3)">${x[0]}</div><div style="font-size:15px;font-weight:700">₹ ${_tlN(x[1])}</div></div>`).join('')}</div>`;
  const tbl=`<table class="tbl" style="width:100%;font-size:12px"><thead><tr><th style="text-align:left">Financial year</th><th style="text-align:right">Interest accrued</th><th style="text-align:right">Added to principal on 31 Mar</th><th style="text-align:right">Principal after</th></tr></thead><tbody>${res.fy.map(f=>`<tr><td>${_tlE(f.fy)}</td><td style="text-align:right">${_tlN(f.interest)}</td><td style="text-align:right">${f.capitalised?_tlN(f.capitalised):'—'}</td><td style="text-align:right">${_tlN(f.endPrincipal)}</td></tr>`).join('')}</tbody></table>`;
  tlModal('Interest — '+_tlE(st.title||''), `<div style="color:var(--text3);margin-bottom:8px">${rate}% p.a. simple daily on the running balance, added to the principal every 31 March. As on ${_tlDate(asOn)} · ${sel.length} rows${useOpen?' + opening balance':''}.</div>`+sums+tbl+
    `<div style="font-size:11px;color:var(--text3);margin-top:8px">Receipts reduce the principal; no interest runs while the balance is nil. Same rules as the Interest tab. This is a calculation only — nothing is saved.</div>`, [{label:'Close',value:1,primary:true}]);
}

// build a statement (rows + opening) from the API response, bridging FY2024-25 → FY2025-26 openings when history is on
function _tlBridge(ledgerInfos, rows){
  const out=rows.slice(); let opening=0, openingDate=TL.hist?'2024-04-01':'2025-04-01';
  for(const l of ledgerInfos){
    const mainOpen=Number(l.opening_balance)||0;
    if(TL.hist){ const h=l.hist; const ho=h?Number(h.opening_balance)||0:0, hc=h?Number(h.closing_balance)||0:0; opening+=ho;
      const diff=Math.round((mainOpen-hc)*100)/100;
      if(Math.abs(diff)>0.5) out.push({vch_date:'2025-04-01',vch_type:'Brought forward',vch_number:'',narration:'Balance carried from the FY2024-25 company into FY2025-26'+(h?'':' (ledger did not exist in FY2024-25)'),ledger:l.name,amount:diff,synthetic:true,source:'main'}); }
    else opening+=mainOpen;
  }
  out.sort((a,b)=>a.vch_date<b.vch_date?-1:a.vch_date>b.vch_date?1:(a.synthetic?-1:0)-(b.synthetic?-1:0));
  return {rows:out, opening, openingDate};
}

// ───────── Contractor (combined linked ledgers) ─────────
async function _tlContractor(){
  const b=_tlBusy(); const names=_tlContractors();
  b.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:end">
    <label style="font-size:11px">Contractor<br><input id="tl-c" list="tl-cl" value="${_tlA(TL.cont)}" placeholder="Type to search…" style="min-width:260px" onchange="_tlContGo()"></label><datalist id="tl-cl">${names.map(n=>`<option value="${_tlA(n)}">`).join('')}</datalist>
    <button class="btn btn-primary btn-sm" onclick="_tlContGo()">Show</button>
    <button class="btn btn-sm" onclick="TL.ccc=tlv('tl-c');_tlTab('cc')">His cost centres →</button></div><div id="tl-cs"></div>`;
  if(TL.cont) _tlContGo();
}
async function _tlContGo(){
  TL.cont=tlv('tl-c').trim(); const d=document.getElementById('tl-cs'); if(!TL.cont){ d.innerHTML=''; return; }
  d.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">⏳ Loading…</div>';
  try{
    const r=await tlApi('contractor_statement',{contractor:TL.cont});
    if(!r.ledgers.length){ d.innerHTML='<div class="card" style="padding:16px;color:var(--text3)">No Tally ledgers are linked to this contractor yet'+(TL.admin?' — use the 🔗 Linking tab.':'.')+'</div>'; return; }
    const close=r.ledgers.reduce((s,l)=>s+Number(l.closing_balance||0),0);
    const br=_tlBridge(r.ledgers, r.rows);
    d.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px;font-size:13px"><b>Linked ledgers:</b> ${r.ledgers.map(l=>`${_tlE(l.name)} <span style="color:var(--text3)">(${_tlE(l.link_role)})</span>`).join(' · ')}<br>
      <b>Combined closing balance in Tally:</b> ${_tlAmt(close)} <span style="color:var(--text3);font-size:11px">(Dr = contractor owes RSR · Cr = RSR owes contractor)</span></div><div id="tl-st"></div>`;
    _tlStatement({rows:br.rows, opening:br.opening, openingDate:br.openingDate, title:TL.cont+' — all linked ledgers'}, document.getElementById('tl-st'));
  }catch(e){ _tlErr(e); }
}

// ───────── Ledgers ─────────
async function _tlLedgers(){
  const b=_tlBusy(); try{ await _tlLoadLedgers(); }catch(e){ return _tlErr(e); }
  b.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px"><input id="tl-lq" placeholder="Search ledger name or contractor…" value="${_tlA(TL.led)}" oninput="TL.led=this.value;_tlLedList()" style="width:100%;max-width:380px"></div><div id="tl-ll"></div><div id="tl-ls"></div>`;
  _tlLedList();
}
function _tlLedList(){
  const q=TL.led.toLowerCase(); const rows=TL.ledgers.map((l,i)=>[l,i]).filter(([l])=>!q||(l.name+' '+(l.contractor_name||'')).toLowerCase().includes(q)).slice(0,200);
  document.getElementById('tl-ll').innerHTML=`<div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>Ledger</th><th>Group</th><th>Linked to</th><th style="text-align:right">Closing</th></tr></thead><tbody>${rows.map(([l,i])=>`<tr style="cursor:pointer" onclick="_tlLedOpen(${i})"><td>${_tlE(l.name)}</td><td>${_tlE(l.parent_group)}</td><td>${l.link_role!=='none'?_tlE((l.contractor_name||'')+' ('+l.link_role+')'):''}${(TL.ledgerProj[l.guid]||[]).length?' <span style="color:var(--text3)">'+(TL.ledgerProj[l.guid]||[]).map(t=>'#'+_tlE(t)).join(' ')+'</span>':''}</td><td style="text-align:right;white-space:nowrap">${_tlAmt(l.closing_balance)}</td></tr>`).join('')}</tbody></table></div>`;
}
async function _tlLedOpen(i){
  const l=TL.ledgers[i]; const d=document.getElementById('tl-ls'); d.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">⏳ Loading…</div>';
  try{ const r=await tlApi('ledger_statement',{ledger:l.name});
    const info={name:l.name, opening_balance:r.ledger?r.ledger.opening_balance:0, closing_balance:r.ledger?r.ledger.closing_balance:0, hist:r.hist};
    const br=_tlBridge([info], r.rows); _tlStatement({rows:br.rows,opening:br.opening,openingDate:br.openingDate,title:l.name}, d);
  }catch(e){ _tlErr(e); }
}

// ───────── Cost centres: search, by contractor, totals ─────────
async function _tlCC(){
  const b=_tlBusy(); try{ await _tlLoadCC(); await _tlLoadTotals(); await _tlLoadLedgers(); }catch(e){ return _tlErr(e); }
  b.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px;display:flex;gap:10px;flex-wrap:wrap;align-items:end">
    <label style="font-size:11px">Search cost centre / project / tender no.<br><input id="tl-ccq" value="${_tlA(TL.ccq)}" oninput="TL.ccq=this.value;_tlCCList()" style="min-width:260px"></label>
    <label style="font-size:11px">Contractor<br><input id="tl-ccc" list="tl-cl2" value="${_tlA(TL.ccc)}" oninput="TL.ccc=this.value;_tlCCList()" placeholder="Type to search…" style="min-width:230px"></label><datalist id="tl-cl2">${_tlContractors().map(n=>`<option value="${_tlA(n)}">`).join('')}</datalist>
    <button class="btn btn-sm" onclick="TL.ccq='';TL.ccc='';_tlCC()">Clear</button></div><div id="tl-ccl"></div><div id="tl-ccs"></div>`;
  _tlCCList();
}
function _tlCCList(){
  const q=TL.ccq.toLowerCase().trim(), cq=TL.ccc.toLowerCase().trim(), T=TL.totals||{}; const groups={};
  TL.cc.forEach((c,i)=>{
    const tot=T[c.name.toLowerCase()]; if(!tot && c.cc_type==='unmapped' && !q && !cq) return;          // skip cost centres with no activity unless searched
    const ps=_tlCCProjects(c).map(t=>_tlProj(t)).filter(Boolean); const con=_tlCCContractor(c);
    const hay=(c.name+' '+(c.alias_text||'')+' '+ps.map(p=>p.name+' '+p.tender).join(' ')).toLowerCase();
    if(q && !hay.includes(q)) return; if(cq && !(con.name||'unassigned').toLowerCase().includes(cq)) return;
    const k=con.name||'— No contractor set —'; (groups[k]=groups[k]||[]).push({c,i,tot:tot||{paid:0,received:0,n:0},con,ps});
  });
  const names=Object.keys(groups).sort(); const el=document.getElementById('tl-ccl');
  if(!names.length){ el.innerHTML='<div class="card" style="padding:16px;color:var(--text3)">Nothing matches.</div>'; return; }
  el.innerHTML=names.map(n=>{ const g=groups[n]; const paid=g.reduce((s,x)=>s+x.tot.paid,0), rec=g.reduce((s,x)=>s+x.tot.received,0);
    return `<div class="card" style="padding:0;margin-bottom:10px;overflow:hidden"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:10px 12px;background:var(--surface2)">
      <b>${_tlE(n)}</b><span style="font-size:12px;color:var(--text3)">${g.length} cost centres</span>
      <span style="margin-left:auto;font-size:12px">Paid <b>${_tlN(paid)}</b> · Received <b>${_tlN(rec)}</b> · Net with RSR <b>${_tlN(paid-rec)}</b></span>
      <button class="btn btn-sm" onclick='_tlCCOpen(${JSON.stringify(g.map(x=>x.i))},${JSON.stringify(n)})'>Statement &amp; interest — all of his cost centres</button></div>
      <div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th style="text-align:left">Cost centre</th><th style="text-align:left">Projects</th><th style="text-align:right">Paid (Dr)</th><th style="text-align:right">Received (Cr)</th><th style="text-align:right">Net with RSR</th><th>Entries</th></tr></thead><tbody>
      ${g.map(x=>`<tr style="cursor:pointer" onclick='_tlCCOpen([${x.i}],${JSON.stringify(x.c.name)})'><td>${_tlE(x.c.name)}${x.con.how==='several'?' <span title="linked projects belong to different contractors" style="color:#c0392b">⚠</span>':''}</td><td style="font-size:11px;color:var(--text3)">${x.ps.map(p=>'#'+_tlE(p.tender)+' '+_tlE(p.name.slice(0,40))).join('<br>')||_tlE(x.c.alias_text||'')}</td><td style="text-align:right">${_tlN(x.tot.paid)}</td><td style="text-align:right">${_tlN(x.tot.received)}</td><td style="text-align:right;font-weight:600">${_tlN(x.tot.paid-x.tot.received)}</td><td style="text-align:center">${x.tot.n}</td></tr>`).join('')}</tbody></table></div></div>`; }).join('');
}
async function _tlCCOpen(idxs, label){
  const d=document.getElementById('tl-ccs'); d.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">⏳ Loading…</div>';
  try{ const names=idxs.map(i=>TL.cc[i].name); const r=await tlApi('cc_statement',{cost_centres:names});
    _tlStatement({rows:r.rows.map(x=>({...x,ledger:x.ledger_name})), opening:null, title:label+(names.length>1?' — '+names.length+' cost centres':'')}, d);
  }catch(e){ _tlErr(e); }
}

// ───────── Projects: everything Tally knows about one project ─────────
async function _tlProjectsTab(){
  const b=_tlBusy(); try{ await _tlLoadCC(); await _tlLoadTotals(); await _tlLoadLedgers(); }catch(e){ return _tlErr(e); }
  b.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px"><input id="tl-prq" placeholder="Search project name, tender no. or contractor…" value="${_tlA(TL.prq)}" oninput="TL.prq=this.value;_tlPrList()" style="width:100%;max-width:420px"></div><div id="tl-prl"></div><div id="tl-prs"></div>`;
  _tlPrList();
}
function _tlPrList(){
  const q=TL.prq.toLowerCase(); const rows=_tlProjects().filter(p=>!q||(p.name+' '+p.tender+' '+p.contractor).toLowerCase().includes(q)).slice(0,60);
  document.getElementById('tl-prl').innerHTML=`<div style="overflow:auto;max-height:260px;border:1px solid var(--border);border-radius:8px"><table class="tbl" style="width:100%;font-size:12px"><tbody>${rows.map(p=>`<tr style="cursor:pointer" onclick='_tlPrOpen(${JSON.stringify(p.tender)})'><td>#${_tlE(p.tender)}</td><td>${_tlE(p.name)}</td><td>${_tlE(p.contractor)}</td><td>${_tlE(p.status)}</td></tr>`).join('')||'<tr><td style="padding:14px;color:var(--text3)">No project matches.</td></tr>'}</tbody></table></div>`;
}
async function _tlPrOpen(tender){
  const p=_tlProj(tender); const d=document.getElementById('tl-prs'); if(!p) return;
  const ccs=TL.cc.map((c,i)=>({c,i})).filter(x=>_tlCCProjects(x.c).includes(tender));
  const leds=TL.ledgers.map((l,i)=>({l,i})).filter(x=>(TL.ledgerProj[x.l.guid]||[]).includes(tender)||(x.l.link_role==='project_only'&&String(x.l.link_tender_id)===tender));
  const T=TL.totals||{}; const paid=ccs.reduce((s,x)=>s+((T[x.c.name.toLowerCase()]||{}).paid||0),0), rec=ccs.reduce((s,x)=>s+((T[x.c.name.toLowerCase()]||{}).received||0),0);
  d.innerHTML=`<div class="card" style="padding:12px;margin:12px 0"><div style="font-weight:700">#${_tlE(p.tender)} ${_tlE(p.name)}</div><div style="font-size:12px;color:var(--text3)">${_tlE(p.contractor||'no contractor')} ${p.status?'· '+_tlE(p.status):''}</div>
    <div style="margin-top:8px;font-size:13px"><b>Cost centres:</b> ${ccs.length?ccs.map(x=>_tlE(x.c.name)).join(' · '):'<span style="color:var(--text3)">none linked</span>'}
     ${ccs.length?`<br>Paid <b>${_tlN(paid)}</b> · Received <b>${_tlN(rec)}</b> · Net with RSR <b>${_tlN(paid-rec)}</b> <span style="font-size:11px;color:var(--text3)">(if a cost centre is shared with other projects, its totals are shared too)</span><br><button class="btn btn-sm btn-primary" style="margin-top:6px" onclick='_tlCCOpen(${JSON.stringify(ccs.map(x=>x.i))},${JSON.stringify('#'+p.tender+' '+p.name)})'>Statement &amp; interest — cost centres</button>`:''}</div>
    <div style="margin-top:8px;font-size:13px"><b>Ledgers linked to this project:</b> ${leds.length?leds.map(x=>`<button class="btn btn-sm" style="margin:2px" onclick="_tlLedOpenIn(${x.i},'tl-prs2')">${_tlE(x.l.name)}</button>`).join(''):'<span style="color:var(--text3)">none</span>'}</div></div><div id="tl-prs2"></div>`;
  if(ccs.length) _tlCCOpenIn(ccs.map(x=>x.i), '#'+p.tender+' '+p.name, 'tl-prs2');
}
async function _tlCCOpenIn(idxs,label,id){ const d=document.getElementById(id); try{ const names=idxs.map(i=>TL.cc[i].name); const r=await tlApi('cc_statement',{cost_centres:names}); _tlStatement({rows:r.rows.map(x=>({...x,ledger:x.ledger_name})),opening:null,title:label},d);}catch(e){_tlErr(e);} }
async function _tlLedOpenIn(i,id){ const l=TL.ledgers[i]; const d=document.getElementById(id); try{ const r=await tlApi('ledger_statement',{ledger:l.name}); const info={name:l.name,opening_balance:r.ledger?r.ledger.opening_balance:0,closing_balance:r.ledger?r.ledger.closing_balance:0,hist:r.hist}; const br=_tlBridge([info],r.rows); _tlStatement({rows:br.rows,opening:br.opening,openingDate:br.openingDate,title:l.name},d);}catch(e){_tlErr(e);} }

// ───────── Linking (Super Admin) ─────────
async function _tlLinking(){
  const b=_tlBusy(); try{ await _tlLoadLedgers(); await _tlLoadCC(); }catch(e){ return _tlErr(e); }
  b.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px;font-size:12px;color:var(--text3)">Links live only in this app — changing them never changes Tally. Every change is logged. If a link looks odd (for example a ledger tied to a project of a different contractor) you will get a warning before anything is saved.</div>
   <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap"><button class="btn btn-sm${TL.linkkind==='ledgers'?' btn-primary':''}" onclick="TL.linkkind='ledgers';_tlLinking()">Ledgers → Contractor &amp; Projects</button><button class="btn btn-sm${TL.linkkind==='cc'?' btn-primary':''}" onclick="TL.linkkind='cc';_tlLinking()">Cost centres → Projects &amp; Contractor</button><button class="btn btn-sm" onclick="_tlLinkLog()">Change log</button></div>
   <input placeholder="Search…" value="${_tlA(TL.linkq)}" oninput="TL.linkq=this.value;_tlLinkList()" style="width:100%;max-width:360px;margin-bottom:10px"><div id="tl-lk"></div>`;
  _tlLinkList();
}
function _tlChips(ts){ return ts.length?ts.map(t=>{ const p=_tlProj(t); return `<span style="display:inline-block;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:1px 7px;margin:1px;font-size:11px" title="${_tlA(p?p.name+' — '+p.contractor:'not in the app')}">#${_tlE(t)}${p?'':' ⚠'}</span>`; }).join(''):'<span style="color:var(--text3);font-size:11px">none</span>'; }
function _tlLedState(l){ return TL.ledEdit[l.guid]||(TL.ledEdit[l.guid]={contractor:l.contractor_name||'',role:l.link_role,tenders:(TL.ledgerProj[l.guid]||(l.link_tender_id?[String(l.link_tender_id)]:[])).slice()}); }
function _tlCCState(c){ return TL.ccEdit[c.guid]||(TL.ccEdit[c.guid]={type:c.cc_type,contractor:c.contractor_name||'',tenders:_tlCCProjects(c)}); }
function _tlLinkList(){
  const q=TL.linkq.toLowerCase(); const el=document.getElementById('tl-lk'); const cons=_tlContractors();
  const opt=(v)=>`<option value="">—</option>`+cons.map(n=>`<option${v===n?' selected':''}>${_tlE(n)}</option>`).join('');
  if(TL.linkkind==='ledgers'){
    const rows=TL.ledgers.map((l,i)=>[l,i]).filter(([l])=>!q||(l.name+' '+(l.contractor_name||'')).toLowerCase().includes(q)).slice(0,120);
    el.innerHTML=`<div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th style="text-align:left">Ledger</th><th>Contractor</th><th>Role</th><th style="text-align:left">Projects</th><th></th></tr></thead><tbody>${rows.map(([l,i])=>{ const s=_tlLedState(l); return `<tr><td>${_tlE(l.name)}<div style="color:var(--text3);font-size:10px">${_tlE(l.parent_group)} · ${_tlAmt(l.closing_balance)}</div></td>
      <td><select style="max-width:180px" onchange="_tlLedState(TL.ledgers[${i}]).contractor=this.value">${opt(s.contractor)}</select></td>
      <td><select onchange="_tlLedState(TL.ledgers[${i}]).role=this.value">${['none','main','also_keep','project_only','not_used'].map(r=>`<option${s.role===r?' selected':''}>${r}</option>`).join('')}</select></td>
      <td>${_tlChips(s.tenders)} <button class="btn btn-sm" onclick="_tlEditLedProjects(${i})">Edit</button></td>
      <td><button class="btn btn-sm" onclick="_tlSaveLedger(${i})">Save</button></td></tr>`; }).join('')}</tbody></table></div>
      <div style="font-size:11px;color:var(--text3);margin-top:6px">Roles: <b>main</b> = the contractor's current ledger · <b>also_keep</b> = older/extra ledger still counted · <b>project_only</b> = belongs only to the projects listed · <b>not_used</b> = ignore.</div>`;
  } else {
    const rows=TL.cc.map((c,i)=>[c,i]).filter(([c])=>!q||(c.name+' '+(c.alias_text||'')).toLowerCase().includes(q)).slice(0,120);
    el.innerHTML=`<div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th style="text-align:left">Cost centre</th><th>Type</th><th>Contractor</th><th style="text-align:left">Projects</th><th></th></tr></thead><tbody>${rows.map(([c,i])=>{ const s=_tlCCState(c), der=_tlCCContractor({...c,contractor_name:'',guid:c.guid}); return `<tr><td>${_tlE(c.name)}<div style="color:var(--text3);font-size:10px">${_tlE(c.alias_text||'')}</div></td>
      <td><select onchange="_tlCCState(TL.cc[${i}]).type=this.value">${['unmapped','project','contractor_pool','general','ignore','closed_no_cc'].map(r=>`<option${s.type===r?' selected':''}>${r}</option>`).join('')}</select></td>
      <td><select style="max-width:180px" onchange="_tlCCState(TL.cc[${i}]).contractor=this.value">${opt(s.contractor)}</select>${!s.contractor&&der.name?`<div style="font-size:10px;color:var(--text3)">from projects: ${_tlE(der.name)}</div>`:''}</td>
      <td>${_tlChips(s.tenders)} <button class="btn btn-sm" onclick="_tlEditCCProjects(${i})">Edit</button></td>
      <td><button class="btn btn-sm" onclick="_tlSaveCC(${i})">Save</button></td></tr>`; }).join('')}</tbody></table></div>`;
  }
}
async function _tlEditLedProjects(i){ const l=TL.ledgers[i], s=_tlLedState(l); const r=await tlPickProjects(s.tenders,'Projects for ledger: '+l.name); if(r){ s.tenders=r; _tlLinkList(); } }
async function _tlEditCCProjects(i){ const c=TL.cc[i], s=_tlCCState(c); const r=await tlPickProjects(s.tenders,'Projects for cost centre: '+c.name); if(r){ s.tenders=r; _tlLinkList(); } }

// ---- save with sanity checks: each warning explains what is odd and lets Likith decide ----
async function _tlSaveLedger(i){
  const l=TL.ledgers[i], s=_tlLedState(l); const proj=s.tenders.map(t=>({t,p:_tlProj(t)}));
  if(s.role!=='none' && s.role!=='not_used' && !s.contractor && !(s.role==='project_only' && s.tenders.length)){ toast('Choose a contractor (or give project_only some projects)','error'); return; }
  if(s.role==='project_only' && !s.tenders.length){ toast('project_only needs at least one project','error'); return; }
  // 1) ledger kind
  if(s.role!=='none' && s.role!=='not_used' && !/debtor|creditor|loan|advance|sundry/i.test(l.parent_group||'')){
    const a=await tlModal('⚠ Unusual ledger', `“${_tlE(l.name)}” is in the group <b>${_tlE(l.parent_group)}</b>, not a Sundry Debtors/Creditors-type group. Contractor ledgers are normally in those groups.<br>Link it anyway?`, [{label:'Cancel',value:'no'},{label:'Link anyway',value:'ok',primary:true}]); if(a!=='ok') return; }
  // 2) project belongs to a different contractor
  for(const x of proj){ const pc=x.p?x.p.contractor:''; if(!x.p){ const a=await tlModal('⚠ Project not found', `Tender #${_tlE(x.t)} is not in the app's project list.`, [{label:'Cancel',value:'no'},{label:'Keep it',value:'ok',primary:true}]); if(a!=='ok') return; continue; }
    if(s.contractor && pc && pc!==s.contractor){
      const a=await tlModal('⚠ Different contractor', `Ledger <b>${_tlE(l.name)}</b> is linked to contractor <b>${_tlE(s.contractor)}</b>, but project <b>#${_tlE(x.t)} ${_tlE(x.p.name)}</b> belongs to <b>${_tlE(pc)}</b>.<br><br>What do you want to do?`,
        [{label:'Cancel',value:'no'},{label:'Remove this project from the ledger',value:'drop'},{label:'Keep both as they are',value:'keep'},{label:'Move ledger to '+pc+' (keep-alive ledger)',value:'move',primary:true}]);
      if(a==='no') return; if(a==='drop'){ s.tenders=s.tenders.filter(t=>t!==x.t); _tlLinkList(); return _tlSaveLedger(i); }
      if(a==='move'){ s.contractor=pc; if(s.role==='main'||s.role==='none') s.role='also_keep'; }
    } else if(!s.contractor && pc && s.role!=='none'){
      const a=await tlModal('Link ledger to the project’s contractor?', `Ledger <b>${_tlE(l.name)}</b> has no contractor, and project <b>#${_tlE(x.t)}</b> belongs to <b>${_tlE(pc)}</b>.`,
        [{label:'Cancel',value:'no'},{label:'Leave contractor empty',value:'keep'},{label:'Link to '+pc+' (keep-alive ledger)',value:'move',primary:true}]);
      if(a==='no') return; if(a==='move'){ s.contractor=pc; if(s.role==='project_only'||s.role==='none') s.role=s.role==='none'?'also_keep':s.role; } } }
  // 3) two main ledgers for one contractor
  if(s.role==='main' && s.contractor){ const other=TL.ledgers.find(o=>o.guid!==l.guid && o.contractor_name===s.contractor && o.link_role==='main');
    if(other){ const a=await tlModal('⚠ Two main ledgers', `<b>${_tlE(s.contractor)}</b> already has a main ledger: <b>${_tlE(other.name)}</b>. Going forward each contractor should have only one.`,
      [{label:'Cancel',value:'no'},{label:'Keep both as main',value:'both'},{label:'Make “'+other.name+'” a keep-alive ledger',value:'demote',primary:true}]);
      if(a==='no') return; if(a==='demote'){ try{ await tlApi('set_ledger_link',{guid:other.guid,name:other.name,contractor_name:other.contractor_name,link_role:'also_keep',link_tender_id:other.link_tender_id,link_note:other.link_note}); other.link_role='also_keep'; if(TL.ledEdit[other.guid]) TL.ledEdit[other.guid].role='also_keep'; }catch(e){ return _tlErr(e); } } } }
  try{
    await tlApi('set_ledger_link',{guid:l.guid,name:l.name,contractor_name:s.contractor,link_role:s.role,link_tender_id:l.link_tender_id,link_note:l.link_note});
    await tlApi('set_ledger_projects',{guid:l.guid,name:l.name,tender_ids:s.tenders});
    l.contractor_name=s.role==='none'?null:s.contractor; l.link_role=s.role; TL.ledgerProj[l.guid]=s.tenders.slice(); toast('Saved','ok'); _tlLinkList();
  }catch(e){ _tlErr(e); }
}
async function _tlSaveCC(i){
  const c=TL.cc[i], s=_tlCCState(c); const proj=s.tenders.map(t=>({t,p:_tlProj(t)}));
  if(s.type==='contractor_pool' && !s.contractor){ toast('A contractor pool needs a contractor','error'); return; }
  if(s.type==='project' && !s.tenders.length){ const a=await tlModal('⚠ No project', `Cost centre “${_tlE(c.name)}” is marked as a project but no project is linked to it.`, [{label:'Cancel',value:'no'},{label:'Save anyway',value:'ok',primary:true}]); if(a!=='ok') return; }
  const unk=proj.filter(x=>!x.p); if(unk.length){ const a=await tlModal('⚠ Project not found', `Tender ${unk.map(x=>'#'+_tlE(x.t)).join(', ')} is not in the app's project list.`, [{label:'Cancel',value:'no'},{label:'Keep',value:'ok',primary:true}]); if(a!=='ok') return; }
  const cons=[...new Set(proj.filter(x=>x.p&&x.p.contractor).map(x=>x.p.contractor))];
  if(cons.length>1){ const a=await tlModal('⚠ Projects of different contractors', `This cost centre is linked to projects of <b>${cons.length} different contractors</b>: ${cons.map(_tlE).join(', ')}. A cost centre normally belongs to one contractor.`, [{label:'Cancel',value:'no'},{label:'Save anyway',value:'ok',primary:true}]); if(a!=='ok') return; }
  else if(cons.length===1 && s.contractor && s.contractor!==cons[0]){
    const a=await tlModal('⚠ Contractor mismatch', `You set contractor <b>${_tlE(s.contractor)}</b> on cost centre “${_tlE(c.name)}”, but its linked projects belong to <b>${_tlE(cons[0])}</b>.`,
      [{label:'Cancel',value:'no'},{label:'Keep '+s.contractor,value:'keep'},{label:'Use '+cons[0],value:'use',primary:true}]);
    if(a==='no') return; if(a==='use') s.contractor=cons[0]; }
  // a project already carried by another cost centre
  for(const x of proj){ const others=TL.cc.filter(o=>o.guid!==c.guid && _tlCCProjects(o).includes(x.t)).map(o=>o.name);
    if(others.length){ const a=await tlModal('Project already linked', `Project <b>#${_tlE(x.t)} ${_tlE(x.p?x.p.name:'')}</b> is already linked to cost centre <b>${others.map(_tlE).join(', ')}</b>. A project with two cost centres is fine if that is how it was booked in Tally.`, [{label:'Cancel',value:'no'},{label:'Link anyway',value:'ok',primary:true}]); if(a!=='ok') return; } }
  try{ await tlApi('set_cc_link',{guid:c.guid,name:c.name,cc_type:s.type,tender_ids:s.tenders,contractor_name:s.contractor});
    c.cc_type=s.type; c.contractor_name=s.contractor||null; TL.ccLinks=TL.ccLinks.filter(l=>l.cc_guid!==c.guid).concat(s.tenders.map(x=>({cc_guid:c.guid,tender_id:x}))); toast('Saved','ok'); _tlLinkList();
  }catch(e){ _tlErr(e); }
}
async function _tlLinkLog(){
  const b=_tlBusy(); try{ const r=await tlApi('link_log');
    b.innerHTML=`<div style="overflow:auto"><table class="tbl" style="width:100%;font-size:11px"><thead><tr><th>When</th><th>Who</th><th>Kind</th><th>Item</th><th>Was</th><th>Now</th></tr></thead><tbody>${r.log.map(x=>`<tr><td>${new Date(x.changed_at).toLocaleString('en-IN')}</td><td>${_tlE(x.changed_by)}</td><td>${_tlE(x.kind)}</td><td>${_tlE(x.item_name)}</td><td style="max-width:200px;overflow:hidden">${_tlE(x.old_value)}</td><td style="max-width:200px;overflow:hidden">${_tlE(x.new_value)}</td></tr>`).join('')}</tbody></table></div>`; }catch(e){ _tlErr(e); }
}
