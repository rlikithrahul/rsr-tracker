// ═══════════════════════════════════════════════════════
// tallylive.js — Tally Live (READ-ONLY mirror of TallyPrime)
// Day Book, contractor statements, ledger list, and (Super Admin) the Linking page.
// All data comes through the tally-api Edge Function; nothing is ever written to Tally.
// The tally_* tables are not readable with the app's public key — this page asks for the
// password once and keeps a short-lived signed token in memory only (never stored).
// ═══════════════════════════════════════════════════════

const TL_API = SB_URL + '/functions/v1/tally-api';
let TL = { token:null, admin:false, tab:'daybook', ledgers:null, cc:null, ccLinks:null, dbq:{from:'',to:'',type:'',text:''}, led:'', cont:'', ccsel:'', linkq:'', linkkind:'ledgers' };

function _tlE(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function _tlA(s){ return _tlE(s).replace(/`/g,'&#96;'); }
function _tlAmt(n){ n=Number(n)||0; const a=Math.abs(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); return a+(n<0?' Dr':n>0?' Cr':''); }
function _tlDate(d){ if(!d) return ''; const p=String(d).split('-'); return p[2]+'-'+p[1]+'-'+p[0]; }

async function tlCall(body){
  const r = await fetch(TL_API, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_KEY,'apikey':SB_KEY}, body:JSON.stringify(body) });
  let j={}; try{ j=await r.json(); }catch(e){}
  if(r.status===401 && body.action!=='login'){ TL.token=null; throw new Error('SESSION'); }
  if(!r.ok) throw new Error(j.error||('Error '+r.status));
  return j;
}
const tlApi = (action, extra) => tlCall(Object.assign({action, token:TL.token}, extra||{}));

async function renderTallyLive(){
  const el = document.getElementById('sec-tally'); if(!el) return;
  if(!TL.token){ _tlLoginView(el); return; }
  _tlShell(el);
  _tlTab(TL.tab);
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
  const pw = (document.getElementById('tl-pw')||{}).value||'';
  const er = document.getElementById('tl-err'); if(er) er.textContent='Checking…';
  try{
    const j = await tlCall({action:'login', password:pw});
    TL.token=j.token; TL.admin=!!j.admin; TL.ledgers=null; TL.cc=null;
    renderTallyLive();
  }catch(e){ if(er) er.textContent = e.message; }
}

function _tlShell(el){
  const tabs=[['daybook','Day Book'],['contractor','Contractor'],['ledgers','Ledgers'],['cc','Cost Centres']];
  if(TL.admin) tabs.push(['linking','🔗 Linking']);
  el.innerHTML = `<div class="wrap">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
      <div style="font-size:18px;font-weight:700">📒 Tally Live</div>
      <span id="tl-sync" style="font-size:12px;color:var(--text3)">…</span>
      <button class="btn btn-sm" style="margin-left:auto" onclick="tlSyncNow()">⟳ Sync now</button>
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
async function tlSyncNow(){
  try{ await tlApi('sync_now'); toast('Sync requested — the office PC picks it up within a minute (if the sync program is running in Watch mode).'); }catch(e){ _tlErr(e); }
}
function _tlErr(e){
  if(e && e.message==='SESSION'){ const el=document.getElementById('sec-tally'); _tlLoginView(el,'Session expired — enter your password again.'); return; }
  const b=document.getElementById('tl-body'); const m='⚠️ '+(e&&e.message||e);
  if(b) b.innerHTML=`<div class="card" style="padding:16px;color:#c0392b">${_tlE(m)}</div>`; else toast(m,'error');
}
function _tlTab(t){
  TL.tab=t; const el=document.getElementById('sec-tally'); _tlShell(el);
  ({daybook:_tlDaybook, contractor:_tlContractor, ledgers:_tlLedgers, cc:_tlCC, linking:_tlLinking})[t]();
}
function _tlBusy(){ const b=document.getElementById('tl-body'); if(b) b.innerHTML='<div style="padding:30px;text-align:center;color:var(--text3)">⏳ Loading…</div>'; return b; }
async function _tlLoadLedgers(){ if(!TL.ledgers){ TL.ledgers=(await tlApi('ledgers')).ledgers; } return TL.ledgers; }
async function _tlLoadCC(){ if(!TL.cc){ const r=await tlApi('cost_centres'); TL.cc=r.cost_centres; TL.ccLinks=r.links; } return TL.cc; }

// ───────── Day Book ─────────
async function _tlDaybook(){
  const q=TL.dbq; const b=document.getElementById('tl-body');
  b.innerHTML = `<div class="card" style="padding:12px;margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:end">
    <label style="font-size:11px">From<br><input type="date" id="tl-f" value="${_tlA(q.from)}"></label>
    <label style="font-size:11px">To<br><input type="date" id="tl-t" value="${_tlA(q.to)}"></label>
    <label style="font-size:11px">Type<br><select id="tl-ty"><option value="">All</option><option${q.type==='Payment'?' selected':''}>Payment</option><option${q.type==='Receipt'?' selected':''}>Receipt</option></select></label>
    <label style="font-size:11px">Search name / narration<br><input id="tl-x" value="${_tlA(q.text)}" style="min-width:180px" onkeydown="if(event.key==='Enter')_tlDbGo()"></label>
    <button class="btn btn-primary btn-sm" onclick="_tlDbGo()">Show</button></div>
    <div id="tl-db"></div>`;
  _tlDbRun();
}
function _tlDbGo(){ TL.dbq={from:tlv('tl-f'),to:tlv('tl-t'),type:tlv('tl-ty'),text:tlv('tl-x')}; _tlDbRun(); }
function tlv(id){ const e=document.getElementById(id); return e?e.value:''; }
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

// ───────── statements (shared table) ─────────
function _tlStmtTable(rows, opening, showLedger){
  let bal=Number(opening)||0, dr=0, cr=0;
  const body=rows.map(r=>{ const a=Number(r.amount)||0; bal+=a; if(a<0) dr+=-a; else cr+=a;
    return `<tr><td>${_tlDate(r.vch_date)}</td><td>${_tlE(r.vch_type)} ${_tlE(r.vch_number)}</td>${showLedger?`<td>${_tlE(r.ledger||'')}</td>`:''}<td style="max-width:320px">${_tlE(r.narration||r.party_ledger||'')}</td><td style="text-align:right">${a<0?_tlAmt(-a).replace(' Cr',''):''}</td><td style="text-align:right">${a>0?_tlAmt(a).replace(' Cr',''):''}</td><td style="text-align:right;white-space:nowrap">${_tlAmt(bal)}</td></tr>`; }).join('');
  return `<div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>Date</th><th>Voucher</th>${showLedger?'<th>Ledger</th>':''}<th>Narration</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th></tr></thead><tbody>
    ${opening!=null?`<tr style="background:var(--surface2)"><td colspan="${showLedger?6:5}"><b>Opening balance (start of Tally books)</b></td><td style="text-align:right">${_tlAmt(opening)}</td></tr>`:''}
    ${body}<tr style="font-weight:700;background:var(--surface2)"><td colspan="${showLedger?4:3}">Totals</td><td style="text-align:right">${_tlAmt(dr).replace(' Cr','')}</td><td style="text-align:right">${_tlAmt(cr).replace(' Cr','')}</td><td style="text-align:right">${_tlAmt(bal)}</td></tr></tbody></table></div>`;
}

// ───────── Contractor (combined linked ledgers) ─────────
async function _tlContractor(){
  const b=_tlBusy();
  const names=[...new Set((D.contractors||[]).map(c=>c.name).filter(Boolean))].sort();
  b.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:end">
    <label style="font-size:11px">Contractor<br><select id="tl-c" style="min-width:240px"><option value="">— choose —</option>${names.map(n=>`<option${TL.cont===n?' selected':''}>${_tlE(n)}</option>`).join('')}</select></label>
    <button class="btn btn-primary btn-sm" onclick="_tlContGo()">Show</button></div><div id="tl-cs"></div>`;
  if(TL.cont) _tlContGo();
}
async function _tlContGo(){
  TL.cont=tlv('tl-c'); const d=document.getElementById('tl-cs'); if(!TL.cont){ d.innerHTML=''; return; }
  d.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">⏳ Loading…</div>';
  try{
    const r=await tlApi('contractor_statement',{contractor:TL.cont});
    if(!r.ledgers.length){ d.innerHTML='<div class="card" style="padding:16px;color:var(--text3)">No Tally ledgers are linked to this contractor yet'+(TL.admin?' — use the 🔗 Linking tab.':'.')+'</div>'; return; }
    const open=r.ledgers.reduce((s,l)=>s+Number(l.opening_balance||0),0), close=r.ledgers.reduce((s,l)=>s+Number(l.closing_balance||0),0);
    d.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px;font-size:13px"><b>Linked ledgers:</b> ${r.ledgers.map(l=>`${_tlE(l.name)} <span style="color:var(--text3)">(${_tlE(l.link_role)})</span>`).join(' · ')}<br>
      <b>Combined closing balance in Tally:</b> ${_tlAmt(close)} <span style="color:var(--text3);font-size:11px">(Dr = contractor owes RSR · Cr = RSR owes contractor)</span></div>`+_tlStmtTable(r.rows, open, true);
  }catch(e){ _tlErr(e); }
}

// ───────── Ledgers ─────────
async function _tlLedgers(){
  const b=_tlBusy(); try{ await _tlLoadLedgers(); }catch(e){ return _tlErr(e); }
  b.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px"><input id="tl-lq" placeholder="Search ledger name…" value="${_tlA(TL.led)}" oninput="TL.led=this.value;_tlLedList()" style="width:100%;max-width:360px"></div><div id="tl-ll"></div><div id="tl-ls"></div>`;
  _tlLedList();
}
function _tlLedList(){
  const q=TL.led.toLowerCase(); const rows=TL.ledgers.filter(l=>!q||l.name.toLowerCase().includes(q)).slice(0,200);
  document.getElementById('tl-ll').innerHTML=`<div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>Ledger</th><th>Group</th><th>Linked to</th><th style="text-align:right">Closing</th></tr></thead><tbody>${rows.map((l,i)=>`<tr style="cursor:pointer" onclick="_tlLedOpen(${TL.ledgers.indexOf(l)})"><td>${_tlE(l.name)}</td><td>${_tlE(l.parent_group)}</td><td>${l.link_role!=='none'?_tlE(l.contractor_name||l.link_tender_id||l.link_role):''}</td><td style="text-align:right;white-space:nowrap">${_tlAmt(l.closing_balance)}</td></tr>`).join('')}</tbody></table></div>`;
}
async function _tlLedOpen(i){
  const l=TL.ledgers[i]; const d=document.getElementById('tl-ls'); d.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">⏳ Loading…</div>';
  try{ const r=await tlApi('ledger_statement',{ledger:l.name});
    d.innerHTML=`<div style="margin:14px 0 6px;font-weight:700">${_tlE(l.name)}</div>`+_tlStmtTable(r.rows, r.ledger?r.ledger.opening_balance:0, false);
    d.scrollIntoView({behavior:'smooth'});
  }catch(e){ _tlErr(e); }
}

// ───────── Cost centres ─────────
async function _tlCC(){
  const b=_tlBusy(); try{ await _tlLoadCC(); }catch(e){ return _tlErr(e); }
  const projName=t=>{ const p=(D.projects||[]).find(x=>String(x.tender)===String(t)); return p?(p.name||t):t; };
  b.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px"><select id="tl-cs" onchange="_tlCCGo()" style="min-width:300px"><option value="">— choose a cost centre —</option>${TL.cc.map(c=>{ const ps=TL.ccLinks.filter(l=>l.cc_guid===c.guid).map(l=>l.tender_id); return `<option value="${_tlA(c.name)}"${TL.ccsel===c.name?' selected':''}>${_tlE(c.name)}${ps.length?' — #'+ps.join(', #'):''}</option>`; }).join('')}</select></div><div id="tl-cr"></div>`;
  if(TL.ccsel) _tlCCGo();
}
async function _tlCCGo(){
  TL.ccsel=tlv('tl-cs'); const d=document.getElementById('tl-cr'); if(!TL.ccsel){ d.innerHTML=''; return; }
  d.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">⏳ Loading…</div>';
  try{ const r=await tlApi('cc_statement',{cost_centre:TL.ccsel}); d.innerHTML=_tlStmtTable(r.rows.map(x=>({...x,ledger:x.ledger_name})), null, true); }catch(e){ _tlErr(e); }
}

// ───────── Linking (Super Admin) ─────────
async function _tlLinking(){
  const b=_tlBusy(); try{ await _tlLoadLedgers(); await _tlLoadCC(); }catch(e){ return _tlErr(e); }
  b.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px;font-size:12px;color:var(--text3)">Links live only in this app — changing them never changes Tally. Every change is logged.</div>
   <div style="display:flex;gap:6px;margin-bottom:10px"><button class="btn btn-sm${TL.linkkind==='ledgers'?' btn-primary':''}" onclick="TL.linkkind='ledgers';_tlLinking()">Ledgers → Contractors</button><button class="btn btn-sm${TL.linkkind==='cc'?' btn-primary':''}" onclick="TL.linkkind='cc';_tlLinking()">Cost centres → Projects</button><button class="btn btn-sm" onclick="_tlLinkLog()">Change log</button></div>
   <input placeholder="Search…" value="${_tlA(TL.linkq)}" oninput="TL.linkq=this.value;_tlLinkList()" style="width:100%;max-width:360px;margin-bottom:10px"><div id="tl-lk"></div>`;
  _tlLinkList();
}
function _tlLinkList(){
  const q=TL.linkq.toLowerCase(); const el=document.getElementById('tl-lk');
  if(TL.linkkind==='ledgers'){
    const rows=TL.ledgers.map((l,i)=>[l,i]).filter(([l])=>!q||l.name.toLowerCase().includes(q)||(l.contractor_name||'').toLowerCase().includes(q)).slice(0,150);
    el.innerHTML=`<div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>Ledger</th><th>Contractor</th><th>Role</th><th></th></tr></thead><tbody>${rows.map(([l,i])=>`<tr><td>${_tlE(l.name)}<div style="color:var(--text3);font-size:10px">${_tlE(l.parent_group)} · ${_tlAmt(l.closing_balance)}</div></td>
      <td><select id="lc-${i}" style="max-width:190px"><option value="">—</option>${[...new Set((D.contractors||[]).map(c=>c.name))].sort().map(n=>`<option${l.contractor_name===n?' selected':''}>${_tlE(n)}</option>`).join('')}</select></td>
      <td><select id="lr-${i}">${['none','main','also_keep','project_only','not_used'].map(r=>`<option${l.link_role===r?' selected':''}>${r}</option>`).join('')}</select></td>
      <td><button class="btn btn-sm" onclick="_tlSaveLedger(${i})">Save</button></td></tr>`).join('')}</tbody></table></div>`;
  } else {
    const rows=TL.cc.filter(c=>!q||c.name.toLowerCase().includes(q)||(c.alias_text||'').toLowerCase().includes(q)).slice(0,150);
    el.innerHTML=`<div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>Cost centre</th><th>Type</th><th>Tender ID(s), comma separated</th><th></th></tr></thead><tbody>${rows.map(c=>{ const i=TL.cc.indexOf(c); const ts=TL.ccLinks.filter(l=>l.cc_guid===c.guid).map(l=>l.tender_id).join(', ');
      return `<tr><td>${_tlE(c.name)}<div style="color:var(--text3);font-size:10px">${_tlE(c.alias_text||'')}</div></td>
      <td><select id="ct-${i}">${['unmapped','project','contractor_pool','general','ignore','closed_no_cc'].map(r=>`<option${c.cc_type===r?' selected':''}>${r}</option>`).join('')}</select></td>
      <td><input id="ci-${i}" value="${_tlA(ts)}" style="width:150px"></td><td><button class="btn btn-sm" onclick="_tlSaveCC(${i})">Save</button></td></tr>`; }).join('')}</tbody></table></div>`;
  }
}
async function _tlSaveLedger(i){
  const l=TL.ledgers[i], role=tlv('lr-'+i), cn=tlv('lc-'+i);
  if(role!=='none' && !cn && role!=='not_used'){ toast('Choose a contractor for this role','error'); return; }
  try{ await tlApi('set_ledger_link',{guid:l.guid,name:l.name,contractor_name:cn,link_role:role,link_tender_id:l.link_tender_id,link_note:l.link_note});
    l.contractor_name=role==='none'?null:cn; l.link_role=role; toast('Saved'); }catch(e){ _tlErr(e); }
}
async function _tlSaveCC(i){
  const c=TL.cc[i], t=tlv('ct-'+i), ids=tlv('ci-'+i).split(',').map(x=>x.trim()).filter(Boolean);
  try{ await tlApi('set_cc_link',{guid:c.guid,name:c.name,cc_type:t,tender_ids:ids,contractor_name:c.contractor_name});
    c.cc_type=t; TL.ccLinks=TL.ccLinks.filter(l=>l.cc_guid!==c.guid).concat(ids.map(x=>({cc_guid:c.guid,tender_id:x}))); toast('Saved'); }catch(e){ _tlErr(e); }
}
async function _tlLinkLog(){
  const b=_tlBusy(); try{ const r=await tlApi('link_log');
    b.innerHTML=`<div style="overflow:auto"><table class="tbl" style="width:100%;font-size:11px"><thead><tr><th>When</th><th>Who</th><th>Item</th><th>Was</th><th>Now</th></tr></thead><tbody>${r.log.map(x=>`<tr><td>${new Date(x.changed_at).toLocaleString('en-IN')}</td><td>${_tlE(x.changed_by)}</td><td>${_tlE(x.item_name)}</td><td style="max-width:200px;overflow:hidden">${_tlE(x.old_value)}</td><td style="max-width:200px;overflow:hidden">${_tlE(x.new_value)}</td></tr>`).join('')}</tbody></table></div>`; }catch(e){ _tlErr(e); }
}
