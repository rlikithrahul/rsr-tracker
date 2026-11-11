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
  dbq:{mode:'range',from:'',to:'',type:'',text:''}, led:'', cont:'', ccq:'', ccc:'', ccsel:null, prq:'', prsel:null,
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
    d.innerHTML=`<div style="background:var(--surface,#fff);color:var(--text,#111);border-radius:12px;max-width:900px;width:100%;max-height:88vh;overflow:auto;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.35)">
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
// ───────── interest engine ─────────
// Settings (all changeable; defaults copy the way Tally calculates it for RSR):
//   rate %, payDay (count the day of a payment), recDay (count the day of a receipt = the old balance is still charged that day),
//   style '365' | 'cal' (365-day year / calendar year 365-366), balances 'debit'|'credit'|'all', compound (add each year's interest to the
//   principal at the end of 31 March), lastDay (count the "as on" day), stopNil (stop for good once the balance first reaches nil / flips),
//   autoInt (a voucher whose narration says "int"/"interest" is interest already posted in Tally, not new capital).
const TL_INT_DEFAULT={rate:24,payDay:true,recDay:true,style:'365',balances:'debit',compound:true,lastDay:true,stopNil:false,autoInt:true};
function tlIntSet(over){ return Object.assign({},TL_INT_DEFAULT,(typeof TL!=='undefined'&&TL.intDef)||{},over||{}); }
function tlSetSummary(S){ S=Object.assign({},TL_INT_DEFAULT,S||{});
  return S.rate+'% a year · '+(S.style==='cal'?'calendar year (365/366 days)':'365-day year')+' · payment day '+(S.payDay?'counted':'not counted')+' · receipt day '+(S.recDay?'counted (old balance charged that day)':'not counted')+' · '+({debit:'debit balances only',credit:'credit balances only',all:'all balances'}[S.balances]||'debit balances only')+' · '+(S.compound?'interest added to the principal every 31 March':'simple interest, not compounded')+' · last day '+(S.lastDay?'counted':'not counted')+(S.stopNil?' · stops when the balance first reaches nil':''); }
function _tlLeap(y){ return (y%4===0&&y%100!==0)||y%400===0; }
function _tlAmtFor(base,from,to,rate,style){      // interest on `base` for the days [from, to)
  const d=_tlDays(from,to); if(d<=0||!base) return 0;
  if(style!=='cal') return base*rate*d/365;
  let tot=0, cur=from; while(cur<to){ const y=+cur.slice(0,4), nxt=(y+1)+'-01-01'; const e=nxt<to?nxt:to; tot+=base*rate*_tlDays(cur,e)/(_tlLeap(y)?366:365); cur=e; } return tot;
}
// txs: [{date, delta, desc, isInt}]  delta>0 = paid out (adds to the debt), delta<0 = received.  Returns totals + .sched (the day-by-day schedule for the sheet).
// Rules: a day's NET movement decides how that day is treated (net paid out -> payDay rule, net received -> recDay rule); a balance is charged from its
// first to its last day, both counted; the balance may go negative (contractor in credit) and later payments first wipe that out.
function tlInterest(txs, opening, startDate, asOn, ratePct, opts){
  opts=opts||{}; const S=tlIntSet(opts.set); const rate=(ratePct!=null&&ratePct!==''?ratePct:S.rate)/100; const posted=opts.posted||{};
  const chargeable=b=>S.balances==='all'?b!==0:(S.balances==='credit'?b<0:b>0);
  txs=txs.filter(t=>t.date<=asOn);                    // entries after the "calculate up to" date never count
  const byDay={}; txs.forEach(t=>{ const o=byDay[t.date]||(byDay[t.date]={date:t.date,net:0,items:[]}); o.net+=t.delta; o.items.push(t); });
  const ev=[]; Object.values(byDay).forEach(d=>{ const nxt=d.net<0?S.recDay:S.payDay; ev.push({eff:nxt?(d.net<0?_tlNextDay(d.date):d.date):(d.net<0?d.date:_tlNextDay(d.date)),date:d.date,net:d.net,items:d.items,k:0}); });
  const end=S.lastDay?_tlNextDay(asOn):asOn; const startY=+startDate.slice(0,4), endY=+asOn.slice(0,4);
  for(let y=startY;y<=endY;y++){ const d=y+'-03-31'; if(d>=startDate && d<=asOn) ev.push({eff:_tlNextDay(d),date:d,k:S.compound?-1:-2}); }   // every 31 March closes a financial year (compound: interest is added to the principal; otherwise it only splits the schedule by year)   // k:-1 = the 31-March capitalisation comes first on 1 April (it belongs to the end of 31 March)
  ev.sort((a,b)=>a.eff<b.eff?-1:a.eff>b.eff?1:a.k-b.k);
  let bal=Number(opening)||0, late=0, acc=0, prev=startDate, total=0, stopped=false, seen=chargeable(bal); const fy={}; const sched=[]; let seg=null;
  const F=l=>fy[l]||(fy[l]={fy:l,interest:0,capitalised:0,endPrincipal:0,calc:0,postedAmt:0,posted:false});
  const open=(date,text,dr,cr,kind)=>{ if(!seg||seg.from!==date){ seg={from:date,to:date,days:0,evs:[],dr:0,cr:0,bal:0,interest:0,fy:_tlFY(date),kind:kind||'tx'}; sched.push(seg); } if(text) seg.evs.push(text); seg.dr+=dr; seg.cr+=cr; if(kind&&kind!=='tx') seg.kind=kind; };
  const accrue=(to)=>{ if(to>prev){ let i=0; if(!stopped&&chargeable(bal)) i=Math.round(_tlAmtFor(Math.abs(bal),prev,to,rate,S.style)*100)/100;
      if(seg&&seg.from===prev){ seg.days=_tlDays(prev,to); seg.interest=i; seg.to=_tlPrevDay(to); seg.bal=bal; }
      if(i>0){ acc+=i; total+=i; F(_tlFY(prev)).interest+=i; } prev=to; } };
  const grow=x=>{ if(S.balances==='credit') bal-=x; else if(S.balances==='all'&&bal<0) bal-=x; else bal+=x; };   // interest joins the principal on the side it was charged on (debit-only: always adds to what he owes)
  if(Number(opening)) { open(startDate,'Opening balance',Number(opening)>0?Number(opening):0,Number(opening)<0?-Number(opening):0,'open'); seg.bal=bal; }
  for(let ei=0;ei<ev.length;ei++){ const e=ev[ei];
    if(e.eff>end){ if(e.k===0&&e.date<=asOn) late+=e.net; continue; }   // entries whose effect starts after the last charged day still count in the closing principal (added after the last accrual)
    accrue(e.eff);
    if(e.k===-2){ const f=F(_tlFY(e.date)); f.endPrincipal=bal; open(e.eff,'',0,0,'fy'); seg.bal=bal; continue; }
    if(e.k===-1){ if(stopped) continue; const f=F(_tlFY(e.date));
      if(posted[f.fy]){ f.posted=true; f.calc=f.interest; acc=0; f.endPrincipal=bal;
        open(e.eff,'Interest for '+f.fy+' already posted in Tally (our calculation '+_tlN(f.calc)+')',0,0,'posted'); }
      else { f.capitalised+=acc; grow(acc); open(e.eff,'Interest added to principal on 31 March ('+f.fy+')',acc,0,'cap'); acc=0; f.endPrincipal=bal; }
    } else {
      e.items.forEach(t=>{ let note='';
        // an interest voucher already posted in Tally moves interest from "accrued" into the ledger balance: it reduces the accrued interest, it is not new capital
        if(S.autoInt&&t.isInt&&t.delta>0&&acc>0){ const used=Math.min(acc,t.delta); acc-=used; note=' — interest posted in Tally (accrued interest reduced by '+_tlN(used)+')'; }
        open(e.eff,(t.desc||(t.delta>0?'Paid out':'Received'))+note+(e.eff!==e.date?' [on '+e.date.split('-').reverse().join('-')+']':''),Math.max(0,t.delta),Math.max(0,-t.delta)); });
      bal+=e.net;
    }
    if(!(ev[ei+1]&&ev[ei+1].eff===e.eff)){ if(chargeable(bal)) seen=true; else if(S.stopNil&&seen) stopped=true; }   // judged after all of that day's entries
    seg.bal=bal; prev=e.eff>prev?e.eff:prev;
  }
  accrue(end); bal+=late; const last=F(_tlFY(asOn)); if(!last.endPrincipal) last.endPrincipal=bal;
  for(const t of txs){ if(t.isInt&&t.delta>0&&t.date.slice(5)==='03-31'){ const f=fy[_tlFY(t.date)]; if(f) f.postedAmt+=t.delta; } }
  return { fy:Object.values(fy).sort((a,b)=>a.fy<b.fy?-1:1), principal:bal, accrued:acc, totalInterest:total, due:bal<0&&S.balances!=='debit'?bal-acc:bal+acc, sched, asOn, startDate, set:S };
}
// years whose interest was already posted in Tally as a 31-March payment ("int for fy 25-26" etc.): txs [{date,delta,isInt}], delta>0 = paid out
function tlIsIntText(t){ return /\bint(erest)?\b/i.test(String(t||'')); }
function tlAutoPosted(txs){ const m={}; (txs||[]).forEach(t=>{ if(t.isInt&&t.delta>0&&String(t.date).slice(5)==='03-31') m[_tlFY(t.date)]=true; }); return m; }
function _tlPrevDay(d){ const t=new Date(_tlMs(d)-86400000); return t.getUTCFullYear()+'-'+String(t.getUTCMonth()+1).padStart(2,'0')+'-'+String(t.getUTCDate()).padStart(2,'0'); }

// ───────── page shell / login ─────────
async function renderTallyLive(){
  const el = document.getElementById('sec-tally'); if(!el) return;
  if(!TL.token){ _tlLoginView(el); return; }
  tlLoadIntSet(); _tlShell(el); _tlTab(TL.tab);
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
  _tlStyle();
  const groups=[['Books',[['daybook','📅','Day Book'],['ledgers','📚','Ledgers'],['creditors','🧾','Creditors List'],['contractor','👷','Contractor'],['ccledger','🗂️','Contractor · cost centres'],['paytype','💳','Payment types'],['cc','🏗️','Cost Centres'],['projects','📁','Projects']]],['Analysis',[['interest','💰','Interest']]]];
  if(TL.admin) groups.push(['Admin',[['needs','⚠️','Needs linking'],['linking','🔗','Linking']]]);
  el.innerHTML = `<div class="wrap">
    <div class="tl-head">
      <div class="tl-title"><span class="tl-logo">📒</span><div><div style="font-size:18px;font-weight:700;line-height:1.1">Tally Live</div><div id="tl-sync" class="tl-syncchip">…</div></div></div>
      <div style="margin-left:auto;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <label style="font-size:12px;display:flex;gap:5px;align-items:center" title="Also use the old FY2024-25 company (1-Apr-2024 to 31-Mar-2025) in statements, totals and interest"><input type="checkbox" ${TL.hist?'checked':''} onchange="TL.hist=this.checked;TL.totals=null;if(typeof CR!=='undefined'){CR.stm={};CR.res={};}_tlTab(TL.tab)"> Include FY2024-25 history</label>
        <button class="btn btn-sm" onclick="tlSyncNow()">⟳ Sync now</button></div></div>
    <div class="tl-nav">${groups.map(g=>`<div class="tl-ng"><div class="tl-gl">${g[0]}</div><div class="tl-gp">${g[1].map(t=>`<button class="tl-pill${TL.tab===t[0]?' on':''}" onclick="_tlTab('${t[0]}')"><span>${t[1]}</span> ${t[2]}</button>`).join('')}</div></div>`).join('')}</div>
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
  ({daybook:_tlDaybook, contractor:_tlContractor, ledgers:_tlLedgers, creditors:_tlCreditors, ccledger:_tlCCLedger, paytype:_tlPayType, cc:_tlCC, projects:_tlProjectsTab, interest:_tlInterestTab, needs:_tlNeeds, switch:_tlSwitch, linking:_tlLinking})[t]();
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
  const q=TL.dbq; const b=document.getElementById('tl-body'); const day=q.mode==='day';
  b.innerHTML = `<div class="card" style="padding:12px;margin-bottom:10px">
    <div style="display:flex;gap:6px;margin-bottom:10px"><button class="tl-pill${day?'':' on'}" onclick="_tlDbMode('range')">📆 Date range</button><button class="tl-pill${day?' on':''}" onclick="_tlDbMode('day')">📍 One day</button></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
    ${day?`<label style="font-size:11px">Date<br><input type="date" id="tl-d" value="${_tlA(q.from&&q.from===q.to?q.from:(q.from||_tlToday()))}" onchange="_tlDbGo()"></label>
      <button class="btn btn-sm" onclick="_tlDbStep(-1)" title="Previous day">◀</button><button class="btn btn-sm" onclick="_tlDbStep(1)" title="Next day">▶</button>
      <button class="btn btn-sm" onclick="_tlDbSet(_tlToday())">Today</button><button class="btn btn-sm" onclick="_tlDbSet(_tlPrev(_tlToday()))">Yesterday</button>`
    :`<label style="font-size:11px">From<br><input type="date" id="tl-f" value="${_tlA(q.from)}"></label>
      <label style="font-size:11px">To<br><input type="date" id="tl-t" value="${_tlA(q.to)}"></label>`}
    <label style="font-size:11px">Type<br><select id="tl-ty"><option value="">All</option><option${q.type==='Payment'?' selected':''}>Payment</option><option${q.type==='Receipt'?' selected':''}>Receipt</option></select></label>
    <label style="font-size:11px">Search name / narration<br><input id="tl-x" value="${_tlA(q.text)}" style="min-width:180px" onkeydown="if(event.key==='Enter')_tlDbGo()"></label>
    <button class="btn btn-primary btn-sm" onclick="_tlDbGo()">Show</button></div></div><div id="tl-db"></div>`;
  _tlDbRun();
}
function _tlPrev(d){ const t=new Date(_tlMs(d)-86400000); return t.getUTCFullYear()+'-'+String(t.getUTCMonth()+1).padStart(2,'0')+'-'+String(t.getUTCDate()).padStart(2,'0'); }
function _tlDbMode(m){ const q=TL.dbq; q.mode=m; if(m==='day'){ q.from=q.to=(q.to||q.from||_tlToday()); } _tlDaybook(); }
function _tlDbSet(d){ TL.dbq.from=TL.dbq.to=d; _tlDaybook(); }
function _tlDbStep(n){ const d=tlv('tl-d')||_tlToday(); _tlDbSet(n>0?_tlNextDay(d):_tlPrev(d)); }
function _tlDbGo(){ const day=TL.dbq.mode==='day'; const f=day?tlv('tl-d'):tlv('tl-f'), t=day?f:tlv('tl-t'); TL.dbq={mode:TL.dbq.mode||'range',from:f,to:t,type:tlv('tl-ty'),text:tlv('tl-x')}; _tlDbRun(); }
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
  target.innerHTML=`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0 6px"><div style="font-weight:700">${_tlE(st.title||'')}</div><span style="margin-left:auto"></span><button class="btn btn-sm" onclick="tlDownloadStatement('xlsx')">⬇ Excel</button><button class="btn btn-sm" onclick="tlDownloadStatement('pdf')">⬇ PDF</button></div>
   ${st.interest?`<div class="card" style="padding:10px;margin-bottom:8px;font-size:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:end">
     <b>Interest</b>
     <label>Calculate up to<br><input type="date" id="ti-asof" value="${_tlToday()}" title="Interest runs up to this date (for example a settlement date)"></label>
     ${hasOpen?`<label style="display:flex;gap:4px;align-items:end"><input type="checkbox" id="ti-open" checked> include opening balance</label>`:''}
     <label>Tick rows from<br><input type="date" id="ti-f"></label><label>to<br><input type="date" id="ti-t"></label>
     <button class="btn btn-sm" onclick="_tlTickRange()">Tick range</button><button class="btn btn-sm" onclick="_tlTickAll(true)">All</button><button class="btn btn-sm" onclick="_tlTickAll(false)">None</button>
     <button class="btn btn-sm btn-primary" onclick="_tlCalcInterest()">Calculate interest on ticked rows</button></div>
   <details class="card" style="padding:10px;margin-bottom:8px;font-size:12px"><summary style="cursor:pointer;font-weight:600">⚙ Interest settings for this calculation <span style="font-weight:400;color:var(--text3)">— start from the defaults; changes here apply only to this sheet</span></summary>
     <div style="margin-top:10px">${_tlSetFields('is',tlIntSet())}</div><div style="margin-top:8px"><button class="btn btn-sm" onclick="_tlSetReset('is')">Reset to the default settings</button> <span style="color:var(--text3)">Default: ${_tlE(tlSetSummary(tlIntSet()))}</span></div></details>`:''}
   <div style="overflow:auto"><table class="tbl${st.interest?'':' tl-noint'}" style="width:100%;font-size:12px"><thead><tr><th></th><th>Date</th><th>Voucher</th>${showL?'<th>Ledger / cost centre</th>':''}<th>Narration</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th></tr></thead><tbody>
    ${hasOpen?`<tr style="background:var(--surface2)"><td></td><td colspan="${showL?6:5}"><b>Opening balance (${_tlDate(st.openingDate)})</b></td><td style="text-align:right">${_tlAmt(st.opening)}</td></tr>`:''}
    ${body}<tr style="font-weight:700;background:var(--surface2)"><td></td><td colspan="${showL?4:3}">Totals</td><td style="text-align:right">${_tlN(dr)}</td><td style="text-align:right">${_tlN(cr)}</td><td style="text-align:right">${_tlAmt(bal)}</td></tr></tbody></table></div>
   <div style="font-size:11px;color:var(--text3);margin-top:6px">Dr = paid out (adds to what the party owes RSR) · Cr = received (reduces it).${st.interest?' Tick only the rows that should carry interest.':''}</div>`;
  target.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function _tlTickAll(v){ document.querySelectorAll('.tl-ck').forEach(c=>c.checked=v); }
function _tlTickRange(){ const f=tlv('ti-f'), t=tlv('ti-t'); const rows=TL.stmt.rows;
  document.querySelectorAll('.tl-ck').forEach(c=>{ const d=rows[+c.dataset.i].vch_date; c.checked=(!f||d>=f)&&(!t||d<=t); }); }
// ───────── interest settings: defaults (Interest page) and per-calculation copy (wherever interest is calculated) ─────────
const TL_SET_KEY='rsr_tally_intset_v1';
async function tlLoadIntSet(){ try{ const v=await getSetting(TL_SET_KEY,null); TL.intDef=(v&&typeof v==='object')?v:null; }catch(e){} }
function _tlSetFields(p,S){
  S=Object.assign({},TL_INT_DEFAULT,S||{}); const yn=(id,v,t,h)=>`<label style="font-size:11px" title="${_tlA(h)}">${t}<br><select id="${p}-${id}"><option value="1" ${v?'selected':''}>Yes</option><option value="0" ${v?'':'selected'}>No</option></select></label>`;
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;align-items:end">
   <label style="font-size:11px" title="Interest rate per year">Rate % a year<br><input type="number" step="0.25" id="${p}-rate" value="${S.rate}" style="width:90px"></label>
   ${yn('payDay',S.payDay,'Count the day of a payment','Yes = money paid out starts earning interest on the same day (Tally: include transaction date for amounts added)')}
   ${yn('recDay',S.recDay,'Count the day of a receipt','Yes = on the day money comes back the old balance is still charged and the lower balance starts the next day (Tally: include transaction date for amounts deducted)')}
   <label style="font-size:11px" title="365-day year = every year counted as 365 days (Tally default). Calendar year = 366 in leap years">Year style<br><select id="${p}-style"><option value="365" ${S.style==='cal'?'':'selected'}>365-day year</option><option value="cal" ${S.style==='cal'?'selected':''}>Calendar year (365/366)</option></select></label>
   <label style="font-size:11px" title="Which balances earn interest. Debit = the contractor owes RSR">Interest on<br><select id="${p}-balances"><option value="debit" ${S.balances==='debit'?'selected':''}>Debit balances only</option><option value="credit" ${S.balances==='credit'?'selected':''}>Credit balances only</option><option value="all" ${S.balances==='all'?'selected':''}>All balances</option></select></label>
   ${yn('compound',S.compound,'Compound every 31 March','Yes = each financial year interest is added to the principal at the end of 31 March. No = plain simple interest all the way')}
   ${yn('lastDay',S.lastDay,'Count the last day','Yes = interest runs up to and including the date you calculate to')}
   ${yn('stopNil',S.stopNil,'Stop when balance reaches nil','Yes = once the balance first reaches nil (or goes into credit) interest stops for good, even if more payments come later')}
   ${yn('autoInt',S.autoInt,'Recognise interest vouchers','Yes = a voucher whose narration says "int" or "interest" (already posted in Tally) is treated as interest, not new money paid out')}
  </div>`;
}
function _tlSetRead(p){
  const g=id=>{ const e=document.getElementById(p+'-'+id); return e?e.value:null; }; const b=id=>g(id)==='1';
  const r=parseFloat(g('rate')); return {rate:isFinite(r)&&r>=0?r:TL_RATE,payDay:b('payDay'),recDay:b('recDay'),style:g('style')==='cal'?'cal':'365',balances:['debit','credit','all'].includes(g('balances'))?g('balances'):'debit',compound:b('compound'),lastDay:b('lastDay'),stopNil:b('stopNil'),autoInt:b('autoInt')};
}
function _tlSetReset(p){ const S=tlIntSet(); const set=(id,v)=>{ const e=document.getElementById(p+'-'+id); if(e) e.value=v; };
  set('rate',S.rate); ['payDay','recDay','compound','lastDay','stopNil','autoInt'].forEach(k=>set(k,S[k]?'1':'0')); set('style',S.style); set('balances',S.balances); }
async function _tlSetSaveDefault(){
  if(!TL.admin){ toast('Only the Super Admin can change the default settings','error'); return; }
  const S=_tlSetRead('ds'); if(!confirm('Save these as the default interest settings?\n\nEvery interest figure in the app (projects, contractors, cost centres, reports) will use them from now on.\n\n'+tlSetSummary(S))) return;
  try{ await saveSetting(TL_SET_KEY,S); TL.intDef=S; toast('Default interest settings saved','ok'); const el=document.getElementById('ds-sum'); if(el) el.textContent=tlSetSummary(S); }catch(e){ toast('Could not save: '+e.message,'error'); }
}
function _tlSetRestoreTally(){ const S=TL_INT_DEFAULT; const set=(id,v)=>{ const e=document.getElementById('ds-'+id); if(e) e.value=v; };
  set('rate',S.rate); ['payDay','recDay','compound','lastDay','stopNil','autoInt'].forEach(k=>set(k,S[k]?'1':'0')); set('style',S.style); set('balances',S.balances); toast('Tally-style values filled in — press Save to keep them','ok'); }
function _tlIntPostedFor(st, rows, auto){   // per financial year: was the interest already posted in Tally? (saved choice, else auto-suggested from a 31-March "interest" voucher)
  TL.intPosted=TL.intPosted||{}; const k=st.title||''; const m=TL.intPosted[k]=TL.intPosted[k]||{};
  if(auto!==false) rows.forEach(r=>{ if(r.vch_date&&r.vch_date.slice(5)==='03-31'&&(Number(r.amount)||0)<0&&/\bint(erest)?\b/i.test((r.narration||'')+' '+(r.ledger||''))){ const f=_tlFY(r.vch_date); if(!(f in m)) m[f]=true; } });
  return m;
}
function _tlIntPost(fy,v){ const li=TL.lastInt; if(!li) return; TL.intPosted[li.st.title||'']=TL.intPosted[li.st.title||'']||{}; TL.intPosted[li.st.title||''][fy]=!!v; }
function _tlCalcInterest(again){
  const st=TL.stmt, rows=st.rows; let sel, asOn, rate, useOpen, S;
  if(again===true && TL.lastInt){ ({sel,asOn,useOpen,S}=TL.lastInt); S=S||tlIntSet(); }
  else {
    sel=[...document.querySelectorAll('.tl-ck')].filter(c=>c.checked).map(c=>rows[+c.dataset.i]);
    asOn=tlv('ti-asof')||_tlToday(); S=document.getElementById('is-rate')?_tlSetRead('is'):tlIntSet();
    useOpen=!!document.getElementById('ti-open') && document.getElementById('ti-open').checked && st.opening!=null;
  }
  if(!sel.length && !useOpen){ toast('Tick at least one row','error'); return; }
  const txs=sel.map(r=>({date:r.vch_date, delta:-(Number(r.amount)||0), desc:((r.vch_type||'')+' '+(r.vch_number||'')).trim()+(r.narration?' — '+String(r.narration).slice(0,60):''), isInt:/\bint(erest)?\b/i.test((r.narration||'')+' '+(r.ledger||''))}));
  const opening=useOpen?-(Number(st.opening)||0):0;                // Dr balance (negative in Tally) = money out = positive principal
  const start=useOpen?st.openingDate:(sel.map(r=>r.vch_date).sort()[0]);
  rate=S.rate; const posted=_tlIntPostedFor(st, sel, S.autoInt);
  const res=tlInterest(txs, opening, start, asOn, S.rate, {posted, set:S});
  const sums=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:10px">
     ${[[res.principal<0?'Principal (negative = RSR owes him)':'Principal (incl. compounded interest)',res.principal],['Interest not yet compounded',res.accrued],['Total due',res.due],['Total interest charged',res.totalInterest]].map(x=>`<div class="card" style="padding:8px"><div style="font-size:10px;color:var(--text3)">${x[0]}</div><div style="font-size:15px;font-weight:700">₹ ${_tlN(x[1])}</div></div>`).join('')}</div>`;
  TL.lastInt={st,sel,res,asOn,rate,useOpen,S};
  const tbl=`<table class="tbl" style="width:100%;font-size:12px"><thead><tr><th style="text-align:left">Financial year</th><th style="text-align:right">Interest accrued</th><th style="text-align:right">Added to principal on 31 Mar</th><th style="text-align:right">Principal after</th><th style="text-align:center" title="Tick if you already posted this year's interest as a payment voucher in Tally on 31 March">Already posted in Tally?</th></tr></thead><tbody>${res.fy.map(f=>{ const can=f.capitalised>0||f.posted||f.postedAmt>0; return `<tr><td>${_tlE(f.fy)}</td><td style="text-align:right">${_tlN(f.interest)}</td><td style="text-align:right">${f.posted?'<span style="color:var(--text3)">posted in Tally</span>':(f.capitalised?_tlN(f.capitalised):'—')}</td><td style="text-align:right">${_tlN(f.endPrincipal)}</td><td style="text-align:center">${can?`<input type="checkbox" ${f.posted?'checked':''} onchange="_tlIntPost('${_tlA(f.fy)}',this.checked)">${f.posted&&f.postedAmt>0?`<div style="font-size:10px;color:var(--text3)">voucher ${_tlN(f.postedAmt)} · ours ${_tlN(f.calc)}${Math.abs(f.postedAmt-f.calc)>1?`<br><b style="color:#c0392b">difference ${_tlN(f.postedAmt-f.calc)}</b>`:' ✓'}</div>`:(f.posted?`<div style="font-size:10px;color:var(--text3)">ours ${_tlN(f.calc)}</div>`:(f.postedAmt>0?'<div style="font-size:10px;color:#b26a00">interest voucher found on 31 Mar</div>':''))}`:'—'}</td></tr>`; }).join('')}</tbody></table>`;
  tlModal('Interest — '+_tlE(st.title||''), `<div style="color:var(--text3);margin-bottom:8px"><b>Settings used:</b> ${_tlE(tlSetSummary(S))}. Calculated up to ${S.lastDay?'and including ':'(not including) '}${_tlDate(asOn)} · ${sel.length} rows${useOpen?' + opening balance':''}.</div>`+sums+tbl+
    `<div style="font-size:11px;color:var(--text3);margin-top:8px">Tick a year if its interest is already in Tally as a 31-March payment (then we do not add it again), then press ↻ Recalculate. Receipts reduce the principal; no interest runs while the balance is nil. Nothing is saved or posted to Tally.</div>`,
    [{label:'↻ Recalculate',value:'r'},{label:'⬇ Interest sheet · Excel',value:'x'},{label:'⬇ Interest sheet · PDF',value:'p'},{label:'⬇ Interest + statement · Excel',value:'xs'},{label:'⬇ Interest + statement · PDF',value:'ps'},{label:'Close',value:1,primary:true}]).then(v=>{
      if(v==='r') _tlCalcInterest(true); else if(v==='x') tlDownloadInterest('xlsx'); else if(v==='p') tlDownloadInterest('pdf'); else if(v==='xs') tlDownloadInterest('xlsx',true); else if(v==='ps') tlDownloadInterest('pdf',true); });
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
function _tlAgree(tender){ const p=(D.projects||[]).find(x=>String(x.tender)===String(tender)); if(!p) return 0; try{ return Number(agAmt(p))||0; }catch(e){ return 0; } }
// A project is CLOSED for funding only when SETTLED (status settled) or a Final Bill has been received. Completed work still has headroom. Closed = nothing more to fund.
// (Part bills do not close it: those keep the normal "70% of agreement minus net deployed" headroom.)
function _tlProjClosed(tender){
  const p=(D.projects||[]).find(x=>String(x.tender)===String(tender)); if(!p) return {known:false,closed:false,label:''};
  const sets=(p.settlements||[]).filter(s=>!isArchived(s)); const final=sets.some(s=>s.billType==='Final Bill');
  const st=p.status||'active'; const closed=st==='settled'||final;   // completed-but-not-settled stays OPEN: a little spending may still be needed
  const label=closed?'Settled':sets.length?'Part bill received':p.jvDate?'Check pending':st==='completed'?'Completed (not settled)':st==='onhold'?'On hold':'Active';
  return {known:true,closed,label};
}
// "Still fundable" for ONE project, same rules as the project page:
//  settled / Final Bill received -> 0
//  part bill received            -> the project-page figure (70% of unbilled + under-funding) MINUS net still with RSR (paid - received)  [Tally Live only; the project page itself is unchanged]
//  otherwise                     -> 70% of agreement - net deployed (payments - receipts)
function _tlProjFundable(tender){
  const p=(D.projects||[]).find(x=>String(x.tender)===String(tender)); if(!p) return null;
  const ci=_tlProjClosed(tender); if(ci.closed) return 0;
  let ag=0,rec=0,paid=0; try{ ag=Number(agAmt(p))||0; rec=totReceipts(p); paid=totPayments(p); }catch(e){ return null; }
  if(rec>0) return Math.max(0,ag-rec)*0.7+Math.max(0,rec*0.7-paid)-Math.max(0,paid-rec);   // Tally Live: the project-page figure MINUS what RSR still has out (net)
  return ag*0.7-Math.max(0,paid-rec);
}
function _tlCCList(){
  const q=TL.ccq.toLowerCase().trim(), cq=TL.ccc.toLowerCase().trim(), T=TL.totals||{}; const groups={};
  TL.cc.forEach((c,i)=>{
    const tot=T[c.name.toLowerCase()]; if(!tot && c.cc_type==='unmapped' && !q && !cq) return;          // skip cost centres with no activity unless searched
    const ps=_tlCCProjects(c).map(t=>_tlProj(t)).filter(Boolean); const con=_tlCCContractor(c);
    const hay=(c.name+' '+(c.alias_text||'')+' '+ps.map(p=>p.name+' '+p.tender).join(' ')).toLowerCase();
    if(q && !hay.includes(q)) return; if(cq && !(con.name||'unassigned').toLowerCase().includes(cq)) return;
    const t0=tot||{paid:0,received:0,n:0}; const tl=_tlCCProjects(c); const agreement=tl.reduce((s,t)=>s+_tlAgree(t),0); const maxFund=agreement*0.7, net=t0.paid-t0.received;
    const info=tl.map(_tlProjClosed).filter(x=>x.known); const allClosed=info.length>0&&info.every(x=>x.closed);
    const maxOpen=tl.filter(t=>!_tlProjClosed(t).closed).reduce((s,t)=>s+_tlAgree(t),0)*0.7;
    // closed work: nothing more can be funded (even if the 70% maths says otherwise). Mixed: only the still-open projects' 70% counts.
    const pf=tl.map(_tlProjFundable); const headroom=allClosed?0:(pf.length&&pf.every(v=>v!==null)?pf.reduce((s,v)=>s+v,0):(info.some(x=>x.closed)?maxOpen-net:maxFund-net));
    const state=allClosed?'Settled':[...new Set(info.map(x=>x.label))].join(' / ');
    const k=con.name||'— No contractor set —'; (groups[k]=groups[k]||[]).push({c,i,tot:t0,con,ps,agreement,maxFund,net,headroom,allClosed,state});
  });
  const names=Object.keys(groups).sort(); const el=document.getElementById('tl-ccl');
  TL._ccSum={}; const all=[];
  names.forEach(n=>{ const rows=groups[n].map(x=>({name:x.c.name,projects:x.ps.map(p=>({tender:p.tender,name:p.name})),agreement:x.agreement,maxFund:x.maxFund,paid:x.tot.paid,received:x.tot.received,net:x.net,headroom:x.headroom,state:x.state,n:x.tot.n}));
    TL._ccSum[n]={title:n,rows}; rows.forEach(r=>all.push({...r,name:n+' / '+r.name})); });
  TL._ccSum['__all__']={title:'All contractors (as filtered)',rows:all};
  if(!names.length){ el.innerHTML='<div class="card" style="padding:16px;color:var(--text3)">Nothing matches.</div>'; return; }
  el.innerHTML=`<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap"><span style="font-size:12px;color:var(--text3)">${names.length} contractor group(s)</span><span style="margin-left:auto"></span><button class="btn btn-sm" onclick="tlDownloadCCSummary('__all__','xlsx')">⬇ All as Excel</button><button class="btn btn-sm" onclick="tlDownloadCCSummary('__all__','pdf')">⬇ All as PDF</button></div>`+names.map(n=>{ const g=groups[n]; const paid=g.reduce((s,x)=>s+x.tot.paid,0), rec=g.reduce((s,x)=>s+x.tot.received,0), mx=g.reduce((s,x)=>s+x.maxFund,0), sf=g.reduce((s,x)=>s+x.headroom,0);
    return `<div class="card" style="padding:0;margin-bottom:12px;overflow:hidden"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:10px 12px;background:var(--surface2)">
      <b>${_tlE(n)}</b><span style="font-size:12px;color:var(--text3)">${g.length} cost centres</span>
      <span style="margin-left:auto;font-size:12px">Max fundable <b>${_tlN(mx)}</b> · Paid <b>${_tlN(paid)}</b> · Received <b>${_tlN(rec)}</b> · Net with RSR <b>${_tlN(paid-rec)}</b> · Still fundable <b style="color:${sf<0?'#c0392b':'#2e7d32'}">${_tlN(sf)}</b></span>
      <button class="btn btn-sm" onclick='tlDownloadCCSummary(${JSON.stringify(n)},"xlsx")'>⬇ Excel</button><button class="btn btn-sm" onclick='tlDownloadCCSummary(${JSON.stringify(n)},"pdf")'>⬇ PDF</button>
      <button class="btn btn-sm btn-primary" onclick='_tlCCOpen(${JSON.stringify(g.map(x=>x.i))},${JSON.stringify(n)})'>Statement — all his cost centres</button></div>
      <div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th style="text-align:left">Cost centre</th><th style="text-align:left">Projects</th><th style="text-align:right">Max fundable (70%)</th><th style="text-align:right">Paid (Dr)</th><th style="text-align:right">Received (Cr)</th><th style="text-align:right">Net with RSR</th><th style="text-align:right">Still fundable</th><th>State</th><th>Entries</th></tr></thead><tbody>
      ${g.map(x=>`<tr style="cursor:pointer" onclick='_tlCCOpen([${x.i}],${JSON.stringify(x.c.name)})'><td>${_tlE(x.c.name)}${x.con.how==='several'?' <span title="linked projects belong to different contractors" style="color:#c0392b">⚠</span>':''}</td><td style="font-size:11px;color:var(--text3)">${x.ps.map(p=>'#'+_tlE(p.tender)+' '+_tlE(p.name.slice(0,40))).join('<br>')||_tlE(x.c.alias_text||'')}</td><td style="text-align:right">${x.maxFund?_tlN(x.maxFund):'—'}</td><td style="text-align:right">${_tlN(x.tot.paid)}</td><td style="text-align:right">${_tlN(x.tot.received)}</td><td style="text-align:right;font-weight:600">${_tlN(x.net)}</td><td style="text-align:right;color:${x.headroom<0?'#c0392b':'inherit'}">${x.maxFund?_tlN(x.headroom):'—'}</td><td style="font-size:11px">${x.allClosed?`<span style="background:#e8f5e9;color:#1b5e20;padding:2px 8px;border-radius:10px;font-weight:600">${_tlE(x.state)}</span>${x.net<0?'<div style="color:var(--text3);margin-top:2px">RSR owes contractor</div>':''}`:_tlE(x.state)}</td><td style="text-align:center">${x.tot.n}</td></tr>`).join('')}
      <tr style="font-weight:700;background:var(--surface2)"><td colspan="2">Total</td><td style="text-align:right">${_tlN(mx)}</td><td style="text-align:right">${_tlN(paid)}</td><td style="text-align:right">${_tlN(rec)}</td><td style="text-align:right">${_tlN(paid-rec)}</td><td style="text-align:right">${_tlN(sf)}</td><td></td><td></td></tr></tbody></table></div></div>`; }).join('');
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
    l.contractor_name=s.role==='none'?null:s.contractor; l.link_role=s.role; TL.ledgerProj[l.guid]=s.tenders.slice(); toast('Saved','ok'); TV.at=0; _tlLinkList();
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
    c.cc_type=s.type; c.contractor_name=s.contractor||null; TL.ccLinks=TL.ccLinks.filter(l=>l.cc_guid!==c.guid).concat(s.tenders.map(x=>({cc_guid:c.guid,tender_id:x}))); toast('Saved','ok'); TV.at=0; _tlLinkList();
  }catch(e){ _tlErr(e); }
}
async function _tlLinkLog(){
  const b=_tlBusy(); try{ const r=await tlApi('link_log');
    b.innerHTML=`<div style="overflow:auto"><table class="tbl" style="width:100%;font-size:11px"><thead><tr><th>When</th><th>Who</th><th>Kind</th><th>Item</th><th>Was</th><th>Now</th></tr></thead><tbody>${r.log.map(x=>`<tr><td>${new Date(x.changed_at).toLocaleString('en-IN')}</td><td>${_tlE(x.changed_by)}</td><td>${_tlE(x.kind)}</td><td>${_tlE(x.item_name)}</td><td style="max-width:200px;overflow:hidden">${_tlE(x.old_value)}</td><td style="max-width:200px;overflow:hidden">${_tlE(x.new_value)}</td></tr>`).join('')}</tbody></table></div>`; }catch(e){ _tlErr(e); }
}


// ───────── look & feel (scoped to this page only) ─────────
function _tlStyle(){
  if(document.getElementById('tl-style')) return; const st=document.createElement('style'); st.id='tl-style';
  st.textContent=`
  #sec-tally .card{border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
  #sec-tally .tbl{border-collapse:separate;border-spacing:0}
  #sec-tally .tbl thead th{position:sticky;top:0;background:var(--surface2);z-index:1;font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:var(--text3);padding:8px 8px;border-bottom:1px solid var(--border)}
  #sec-tally .tbl td{padding:7px 8px;border-bottom:1px solid var(--border);vertical-align:top}
  #sec-tally .tbl tbody tr:nth-child(even){background:rgba(127,127,127,.04)}
  #sec-tally .tbl tbody tr[onclick]:hover{background:rgba(212,160,23,.12)}
  #sec-tally .tl-noint th:first-child,#sec-tally .tl-noint td:first-child{display:none}
  #sec-tally .btn-sm{border-radius:20px}
  #sec-tally input,#sec-tally select{border:1px solid var(--border);border-radius:8px;padding:6px 9px;font-size:13px;background:var(--surface);color:var(--text)}
  #sec-tally .tl-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;padding:12px 14px;background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;border-radius:16px}
  #sec-tally .tl-head label,#sec-tally .tl-head .btn{color:#fff}
  #sec-tally .tl-head .btn{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28)}
  #sec-tally .tl-head .btn:hover{background:rgba(255,255,255,.25)}
  #sec-tally .tl-title{display:flex;align-items:center;gap:10px}
  #sec-tally .tl-logo{font-size:26px;background:rgba(255,255,255,.14);border-radius:12px;width:42px;height:42px;display:flex;align-items:center;justify-content:center}
  #sec-tally .tl-syncchip{font-size:11px;color:rgba(255,255,255,.75);margin-top:2px}
  #sec-tally .tl-nav{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:14px;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:14px}
  #sec-tally .tl-gl{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--text3);margin:0 0 4px 6px;font-weight:600}
  #sec-tally .tl-gp{display:flex;gap:4px;flex-wrap:wrap}
  #sec-tally .tl-pill{border:0;background:transparent;padding:7px 12px;border-radius:10px;font-size:13px;cursor:pointer;color:var(--text);font-family:inherit;transition:background .15s,color .15s}
  #sec-tally .tl-pill:hover{background:var(--surface2)}
  #sec-tally .tl-pill.on{background:var(--navy);color:#fff;font-weight:600}
  @keyframes tlfade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
  #sec-tally #tl-body>*{animation:tlfade .18s ease}
  #sec-tally .btn{transition:background .15s,box-shadow .15s}
  #sec-tally .tl-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px}
  #sec-tally .tl-kpi>div{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 12px}
  #sec-tally .tl-kpi .l{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em}
  #sec-tally .tl-kpi .v{font-size:17px;font-weight:700;margin-top:2px}`;
  document.head.appendChild(st);
}

// ───────── Interest (its own section) ─────────
const TL_ILEVELS=[['c_total','Contractor — whole ledger (all his linked ledgers)'],['c_ledger','Contractor — one of his ledgers'],['c_cc','Contractor — all his cost centres'],['cc','One cost centre'],['proj','One project']];
async function _tlInterestTab(){
  const b=_tlBusy(); try{ await _tlLoadCC(); await _tlLoadLedgers(); await tvLoad(); await tlLoadIntSet(); }catch(e){ return _tlErr(e); }
  if(!TV.snap) return _tlErr(new Error('Could not load the Tally snapshot: '+TV.err));
  b.innerHTML=`<div class="card" style="padding:14px;margin-bottom:10px">
     <div style="font-weight:700;margin-bottom:4px">💰 Interest</div>
     <div style="font-size:12px;color:var(--text3);margin-bottom:10px">Interest on the running balance with the settings below (open ⚙ Default interest settings to see or change them; the standard is 24% a year, added to the principal every 31 March until the money is received). Pick what you want to look at, tick the transactions, and calculate. Nothing is saved or posted to Tally.</div>
     <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">
       <label style="font-size:11px">Look at<br><select id="ti-lv" onchange="_tlIntLevel()">${TL_ILEVELS.map(l=>`<option value="${l[0]}">${_tlE(l[1])}</option>`).join('')}</select></label>
       <label style="font-size:11px" id="ti-l1">Contractor<br><input id="ti-a" list="ti-dl" placeholder="Type to search…" style="min-width:260px" oninput="_tlIntLedgers()"></label>
       <label style="font-size:11px;display:none" id="ti-l2">Ledger<br><select id="ti-b" style="min-width:220px"></select></label>
       <datalist id="ti-dl"></datalist>
       <button class="btn btn-primary btn-sm" onclick="_tlIntShow()">Show transactions</button></div></div>
     <details class="card" style="padding:12px;margin-bottom:10px"><summary style="cursor:pointer;font-weight:700">⚙ Default interest settings <span style="font-weight:400;font-size:12px;color:var(--text3)">— used everywhere unless you change them for one calculation</span></summary>
       <div id="ds-sum" style="font-size:12px;color:var(--text3);margin:8px 0">${_tlE(tlSetSummary(tlIntSet()))}</div>
       ${_tlSetFields('ds',tlIntSet())}
       <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">${TL.admin?`<button class="btn btn-sm btn-primary" onclick="_tlSetSaveDefault()">Save as default for everything</button>`:`<span style="font-size:12px;color:var(--text3)">Only the Super Admin can change the defaults.</span>`}<button class="btn btn-sm" onclick="_tlSetRestoreTally()">Fill in the Tally-style values</button></div>
       <div style="font-size:11px;color:var(--text3);margin-top:8px">Tally-style = 24%, payment day counted, receipt day counted (old balance charged that day), 365-day year, debit balances only, compounded every 31 March, last day counted. Every interest figure in the app — project and contractor boxes, cost-centre sheets, reports — follows these defaults. When you calculate interest anywhere you can change the settings for that one sheet without touching these.</div></details><div id="ti-out"></div>`;
  _tlIntLevel();
}
function _tlIntLevel(){
  const lv=tlv('ti-lv')||'c_total'; const dl=document.getElementById('ti-dl'); const a=document.getElementById('ti-a'); a.value='';
  const lab=a.closest('label'); let opts=[];
  if(lv==='c_total'||lv==='c_ledger'||lv==='c_cc'){ lab.firstChild.textContent='Contractor'; opts=Object.keys(TV.snap.contractors).concat(_tlContractors()); if(lv==='c_cc') opts=_tlContractors(); }
  else if(lv==='cc'){ lab.firstChild.textContent='Cost centre'; opts=TL.cc.map(c=>c.name); }
  else { lab.firstChild.textContent='Project'; opts=_tlProjects().map(p=>'#'+p.tender+' '+p.name); }
  dl.innerHTML=[...new Set(opts)].sort().map(o=>`<option value="${_tlA(o)}">`).join('');
  document.getElementById('ti-l2').style.display=lv==='c_ledger'?'':'none'; document.getElementById('ti-b').innerHTML='';
}
function _tlIntLedgers(){
  if(tlv('ti-lv')!=='c_ledger') return; const t=TV.snap.contractors[tlv('ti-a')]; const sel=document.getElementById('ti-b');
  sel.innerHTML=t?t.ledgers.map(l=>`<option>${_tlE(l.name)}</option>`).join(''):'';
}
function _tlSnapRows(tx, filt){ return tx.filter(filt||(()=>true)).map(x=>({vch_date:x.d,vch_type:x.t,vch_number:x.n,narration:x.nar||'',amount:x.amt,ledger:x.l||x.led||'',cc_name:x.cc||'',synthetic:/^open/.test(x.g||''),source:x.src||'main'})); }
async function _tlIntShow(){
  const lv=tlv('ti-lv'), a=tlv('ti-a').trim(), out=document.getElementById('ti-out'); if(!a){ toast('Choose something first','error'); return; }
  out.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">⏳ Loading…</div>';
  try{
    if(lv==='c_total'){ const t=TV.snap.contractors[a]; if(!t){ out.innerHTML='<div class="card" style="padding:16px;color:var(--text3)">No Tally ledger is linked to this contractor yet.</div>'; return; }
      _tlStatement({rows:_tlSnapRows(t.tx),opening:null,title:a+' — whole ledger',interest:true}, out); }
    else if(lv==='c_ledger'){ const t=TV.snap.contractors[a], l=tlv('ti-b'); if(!t||!l){ toast('Choose the contractor and ledger','error'); out.innerHTML=''; return; }
      _tlStatement({rows:_tlSnapRows(t.tx,x=>x.l===l),opening:null,title:a+' — ledger '+l,interest:true}, out); }
    else if(lv==='c_cc'){ const names=TL.cc.filter(c=>(_tlCCContractor(c).name||'')===a).map(c=>c.name); if(!names.length){ out.innerHTML='<div class="card" style="padding:16px;color:var(--text3)">This contractor has no cost centres linked yet.</div>'; return; }
      const r=await tlApi('cc_statement',{cost_centres:names}); _tlStatement({rows:r.rows.map(x=>({...x,ledger:x.ledger_name})),opening:null,title:a+' — '+names.length+' cost centres',interest:true}, out); }
    else if(lv==='cc'){ const c=TL.cc.find(x=>x.name.toLowerCase()===a.toLowerCase()); if(!c){ out.innerHTML='<div class="card" style="padding:16px;color:var(--text3)">No such cost centre.</div>'; return; }
      const r=await tlApi('cc_statement',{cost_centres:[c.name]}); _tlStatement({rows:r.rows.map(x=>({...x,ledger:x.ledger_name})),opening:null,title:'Cost centre '+c.name,interest:true}, out); }
    else { const m=a.match(/^#?(\S+)/); const t=m&&TV.snap.projects[m[1]]; if(!t){ out.innerHTML='<div class="card" style="padding:16px;color:var(--text3)">'+((m&&tvLinked({tender:m[1]}))?'This project is linked in Tally but has no transactions yet.':'This project has no Tally transactions (not linked yet).')+'</div>'; return; }
      _tlStatement({rows:_tlSnapRows(t.tx),opening:null,title:'Project '+a+(t.shared?' (shared entries split equally)':''),interest:true}, out); }
  }catch(e){ _tlErr(e); }
}

// ───────── Needs linking ─────────
function _tlUnhide(id){ TV.dec=(TV.dec||[]).filter(d=>d.id!==id); mergeAndSaveSetting(TV_DEC_KEY,TV.dec.concat([{id,action:'reset',by:(CU&&CU.name)||'',at:new Date().toISOString()}]),true).then(r=>{ TV.dec=r.filter(d=>d.action!=='reset'); _tlNeeds(); }).catch(e=>toast(e.message,'error')); }
async function _tlNeedsDecide(id,action){ await tvDecide(id,action); _tlNeeds(); }
async function _tlNeeds(){
  const b=_tlBusy(); try{ await _tlLoadCC(); await _tlLoadLedgers(); await _tlLoadTotals(); await tvLoad(true); }catch(e){ return _tlErr(e); }
  if(!TV.snap) return _tlErr(new Error('Could not load the Tally snapshot: '+TV.err));
  const dec=id=>{ const d=_tvDec(id); return d&&d.action!=='reset'?d:null; };
  const projs=_tlProjects().filter(p=>!tvLinked(p));
  const shown=projs.filter(p=>!dec('p|'+p.tender)), hidden=projs.filter(p=>dec('p|'+p.tender));
  const conts=_tlContractors().filter(n=>!TV.snap.contractors[n]); const cshown=conts.filter(n=>!dec('c|'+n));
  const T=TL.totals||{}; const ccs=TL.cc.filter(c=>T[c.name.toLowerCase()] && !_tlCCProjects(c).length && !c.contractor_name && !['ignore','general','closed_no_cc'].includes(c.cc_type) && !dec('k|'+c.guid));
  const st=p=>{ const full=(D.projects.find(x=>String(x.tender)===p.tender)||{}); const sets=(full.settlements||[]).filter(s=>!isArchived(s)).length; return sets?'Check received':full.jvDate?'Check pending':(p.status||''); };
  b.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px;font-size:12px;color:var(--text3)">Everything here has no Tally link yet, so the app can't show Tally numbers for it. For each one choose <b>Link</b>, <b>OK as it is</b> (settled or dealt with outside Tally — it stops showing here) or <b>Not in Tally</b>. Nothing you choose changes any status or amount.</div>
   <div class="tl-kpi"><div><div class="l">Projects not linked</div><div class="v">${shown.length}</div></div><div><div class="l">Contractors without a ledger</div><div class="v">${cshown.length}</div></div><div><div class="l">Cost centres with entries, no project</div><div class="v">${ccs.length}</div></div><div><div class="l">Hidden by you</div><div class="v">${hidden.length}</div></div></div>
   <div class="card" style="padding:0;margin-bottom:12px;overflow:hidden"><div style="padding:10px 12px;background:var(--surface2);font-weight:700">Projects not linked</div><div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th style="text-align:left">Project</th><th>Contractor</th><th>Status</th><th></th></tr></thead><tbody>
   ${shown.map(p=>`<tr><td>#${_tlE(p.tender)} ${_tlE(p.name)}</td><td>${_tlE(p.contractor)}</td><td>${_tlE(st(p))}</td><td style="white-space:nowrap"><button class="btn btn-sm btn-primary" onclick='_tlLinkProject(${JSON.stringify(p.tender)})'>Link…</button> <button class="btn btn-sm" onclick='_tlNeedsDecide(${JSON.stringify("p|"+p.tender)},"ok")'>OK as it is</button> <button class="btn btn-sm" onclick='_tlNeedsDecide(${JSON.stringify("p|"+p.tender)},"none")'>Not in Tally</button></td></tr>`).join('')||'<tr><td colspan="4" style="padding:14px;color:var(--text3)">All projects are linked or dealt with. 🎉</td></tr>'}</tbody></table></div></div>
   <div class="card" style="padding:0;margin-bottom:12px;overflow:hidden"><div style="padding:10px 12px;background:var(--surface2);font-weight:700">Contractors with no Tally ledger</div><div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><tbody>
   ${cshown.map(n=>`<tr><td>${_tlE(n)}</td><td style="white-space:nowrap"><button class="btn btn-sm btn-primary" onclick='TL.linkkind="ledgers";TL.linkq=${JSON.stringify(n.split(" ")[0])};_tlTab("linking")'>Link…</button> <button class="btn btn-sm" onclick='_tlNeedsDecide(${JSON.stringify("c|"+n)},"ok")'>OK as it is</button> <button class="btn btn-sm" onclick='_tlNeedsDecide(${JSON.stringify("c|"+n)},"none")'>Not in Tally</button></td></tr>`).join('')||'<tr><td style="padding:14px;color:var(--text3)">None.</td></tr>'}</tbody></table></div></div>
   <div class="card" style="padding:0;margin-bottom:12px;overflow:hidden"><div style="padding:10px 12px;background:var(--surface2);font-weight:700">Cost centres with entries but no project or contractor</div><div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><tbody>
   ${ccs.map(c=>`<tr><td>${_tlE(c.name)}</td><td style="text-align:right">${_tlN((T[c.name.toLowerCase()]||{}).paid)} paid · ${_tlN((T[c.name.toLowerCase()]||{}).received)} received</td><td style="white-space:nowrap"><button class="btn btn-sm btn-primary" onclick='TL.linkkind="cc";TL.linkq=${JSON.stringify(c.name)};_tlTab("linking")'>Link…</button> <button class="btn btn-sm" onclick='_tlNeedsDecide(${JSON.stringify("k|"+c.guid)},"ok")'>OK as it is</button></td></tr>`).join('')||'<tr><td style="padding:14px;color:var(--text3)">None.</td></tr>'}</tbody></table></div></div>
   ${hidden.length?`<details class="card" style="padding:10px 12px"><summary style="cursor:pointer">Hidden by you (${hidden.length})</summary>${hidden.map(p=>`<div style="font-size:12px;padding:4px 0">#${_tlE(p.tender)} ${_tlE(p.name)} — <i>${_tlE((dec('p|'+p.tender)||{}).action==='none'?'Not in Tally':'OK as it is')}</i> <button class="btn btn-sm" onclick='_tlUnhide(${JSON.stringify("p|"+p.tender)})'>Show again</button></div>`).join('')}</details>`:''}`;
}
// link one project straight to a cost centre or a ledger, using the normal Linking checks and warnings
function _tlLinkProject(tender){
  const p=_tlProj(tender); const old=document.getElementById('tl-modal'); if(old) old.remove();
  const d=document.createElement('div'); d.id='tl-modal'; d.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  d.innerHTML=`<div style="background:var(--surface,#fff);color:var(--text,#111);border-radius:12px;max-width:640px;width:100%;max-height:88vh;display:flex;flex-direction:column;padding:18px">
    <div style="font-weight:700;margin-bottom:6px">Link #${_tlE(tender)} ${_tlE(p?p.name:'')}</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px">Search a Tally cost centre or ledger. Try the project name, tender number or the contractor's name.</div>
    <input id="tl-lp-q" placeholder="Search…" value="${_tlA(p?p.name.split(' ').slice(0,2).join(' '):'')}" style="margin-bottom:8px"><div id="tl-lp-l" style="overflow:auto;flex:1;border:1px solid var(--border);border-radius:8px;min-height:160px"></div>
    <div style="text-align:right;margin-top:10px"><button class="btn btn-sm" onclick="document.getElementById('tl-modal').remove()">Close</button></div></div>`;
  document.body.appendChild(d);
  const draw=()=>{ const q=tlv('tl-lp-q').toLowerCase(); const T=TL.totals||{};
    const a=TL.cc.map((c,i)=>({c,i})).filter(x=>!q||(x.c.name+' '+(x.c.alias_text||'')).toLowerCase().includes(q)).slice(0,25);
    const b2=TL.ledgers.map((l,i)=>({l,i})).filter(x=>!q||(x.l.name+' '+(x.l.contractor_name||'')).toLowerCase().includes(q)).slice(0,25);
    document.getElementById('tl-lp-l').innerHTML=`<div style="padding:6px 10px;font-size:11px;font-weight:700;background:var(--surface2)">Cost centres</div>`+(a.map(x=>`<div style="padding:7px 10px;border-bottom:1px solid var(--border);cursor:pointer;font-size:12px" onclick="_tlDoLink('cc',${x.i},'${_tlA(tender)}')">${_tlE(x.c.name)} <span style="color:var(--text3)">· ${_tlN((T[x.c.name.toLowerCase()]||{}).paid)} paid</span></div>`).join('')||'<div style="padding:8px 10px;color:var(--text3);font-size:12px">none</div>')+
      `<div style="padding:6px 10px;font-size:11px;font-weight:700;background:var(--surface2)">Ledgers</div>`+(b2.map(x=>`<div style="padding:7px 10px;border-bottom:1px solid var(--border);cursor:pointer;font-size:12px" onclick="_tlDoLink('led',${x.i},'${_tlA(tender)}')">${_tlE(x.l.name)} <span style="color:var(--text3)">· ${_tlE(x.l.parent_group)}</span></div>`).join('')||'<div style="padding:8px 10px;color:var(--text3);font-size:12px">none</div>'); };
  document.getElementById('tl-lp-q').oninput=draw; draw();
}
async function _tlDoLink(kind,i,tender){
  const m=document.getElementById('tl-modal'); if(m) m.remove();
  if(kind==='cc'){ const c=TL.cc[i], s=_tlCCState(c); if(!s.tenders.includes(tender)) s.tenders.push(tender); if(s.type==='unmapped') s.type='project'; await _tlSaveCC(i); }
  else { const l=TL.ledgers[i], s=_tlLedState(l); if(!s.tenders.includes(tender)) s.tenders.push(tender); if(s.role==='none') s.role='project_only'; await _tlSaveLedger(i); }
  TV.at=0; _tlNeeds();
}

// ───────── "Use Tally numbers" switch ─────────
async function _tlSwitch(){
  const b=_tlBusy(); try{ await tvLoad(true); }catch(e){ return _tlErr(e); }
  if(!TV.snap) return _tlErr(new Error('Could not load the Tally snapshot: '+TV.err));
  const on=!!(TV.sw&&TV.sw.on), im=tvImpact(), n=x=>_tlN(x);
  b.innerHTML=`<div class="card" style="padding:16px;margin-bottom:12px;border-left:4px solid ${on?'#2e7d32':'var(--gold,#d4a017)'}">
     <div style="font-size:16px;font-weight:700">🔀 Use Tally numbers in the app — currently <span style="color:${on?'#2e7d32':'#b26a00'}">${on?'ON':'OFF'}</span></div>
     <div style="font-size:13px;margin:8px 0;line-height:1.5">When <b>ON</b>, for every project that is linked in Tally, the deployed amount, cap used, available, interest and the Fund Releases list come from <b>Tally payments</b>. The old Excel-imported entries are <b>hidden, not deleted</b>, and are never used. Projects not linked yet, manual entries and your settlements (check received / pending) are <b>left exactly as they are</b>. Money received still counts only through your settlements. Turning it OFF brings the old numbers back instantly.</div>
     <button class="btn btn-primary" onclick="_tlSwitchGo(${!on})">${on?'Turn OFF (back to Excel numbers)':'Turn ON'}</button></div>
   <div class="tl-kpi"><div><div class="l">Projects linked (will use Tally)</div><div class="v">${im.linked}</div></div><div><div class="l">Not linked (stay as they are)</div><div class="v">${im.unlinked}</div></div><div><div class="l">Projects whose deployed amount changes</div><div class="v">${im.rows.length}</div></div><div><div class="l">Total deployed: now → with Tally</div><div class="v" style="font-size:13px">${n(im.oldT)}<br>→ ${n(im.newT)}</div></div></div>
   <div class="card" style="padding:0;overflow:hidden"><div style="padding:10px 12px;background:var(--surface2);font-weight:700">What would change (largest first) — differences are expected where the Excel data had duplicates or missed edits</div><div style="overflow:auto;max-height:520px"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th style="text-align:left">Project</th><th>Contractor</th><th>Status</th><th style="text-align:right">Deployed now (Excel)</th><th style="text-align:right">With Tally</th><th style="text-align:right">Difference</th></tr></thead><tbody>
   ${im.rows.slice(0,200).map(r=>{ const sets=(r.p.settlements||[]).filter(s=>!isArchived(s)).length; return `<tr style="cursor:pointer" onclick="ownerTab(1);openDetail('${_tlA(r.p.id)}')"><td>#${_tlE(r.p.tender)} ${_tlE(r.p.name)}</td><td>${_tlE(_tlContractorName(r.p))}</td><td>${sets?'Check received':r.p.jvDate?'Check pending':''}</td><td style="text-align:right">${n(r.oldV)}</td><td style="text-align:right">${n(r.newV)}</td><td style="text-align:right;font-weight:600;color:${r.diff<0?'#c0392b':'#2e7d32'}">${r.diff>0?'+':''}${n(r.diff)}</td></tr>`; }).join('')||'<tr><td colspan="6" style="padding:14px;color:var(--text3)">No project changes.</td></tr>'}</tbody></table></div></div>`;
}
async function _tlSwitchGo(on){
  if(!confirm(on?'Turn ON: linked projects will use Tally numbers (Excel entries hidden, not deleted). You can turn it OFF any time. Continue?':'Turn OFF: back to the Excel-imported numbers. Continue?')) return;
  try{ await tvSwitchSet(on); toast(on?'Tally numbers are ON':'Back to Excel numbers','ok'); _tlTab('switch'); }catch(e){ toast('Could not save: '+e.message,'error'); }
}
