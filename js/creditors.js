// ═══════════════════════════════════════════════════════
// creditors.js — Creditors List inside Tally Live (READ-ONLY mirror; nothing is ever written to Tally)
// Shows every ledger whose Tally group is "CREDITORS LIST" with its Debit / Credit closing balance (exactly as Tally's list),
// plus per-ledger interest controls (OFF by default), clubbing of several ledgers into one line, per-line amount adjustments
// and a "Reset to Tally values" button. Interest uses the app's one interest engine (tlInterest) with each ledger's own settings.
// Settings are kept in the app's settings table (key rsr_creditors_v1): switches, rates, clubs, adjustments. No Tally data is changed.
// ═══════════════════════════════════════════════════════
const CR_KEY = 'rsr_creditors_v1';
let CR = { cfg:null, res:{}, stm:{}, sel:new Set(), q:'', flt:'all', sort:'name', asOn:'', busy:false };

function _crIsCred(l){ return /^\s*creditors?\s*list\s*$/i.test(l.parent_group||''); }
function _crQ(s){ return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }   // for inline onclick strings (ids are escaped again by _tlA)
async function _crLoadCfg(){
  if(CR.cfg) return CR.cfg;
  let v=null; try{ v=await getSetting(CR_KEY,null); }catch(e){}
  CR.cfg={ led:(v&&v.led)||{}, clubs:(v&&Array.isArray(v.clubs))?v.clubs:[] };
  return CR.cfg;
}
let _crSaveT=null;
function _crSave(){ if(!TL.admin) return; clearTimeout(_crSaveT); _crSaveT=setTimeout(async()=>{ try{ await saveSetting(CR_KEY,CR.cfg); }catch(e){ toast('Could not save Creditors List settings: '+e.message,'error'); } },600); }
function _crCfg(id){ const c=CR.cfg.led[id]||{}; const d=tlIntSet();
  return { on:!!c.on, rate:(c.rate!=null&&c.rate!=='')?Number(c.rate):d.rate, compound:(c.compound!=null)?!!c.compound:d.compound, bal:c.bal||'auto', adv:c.adv||null, from:c.from||'', adj:Number(c.adj)||0, adjNote:c.adjNote||'' }; }
function _crPut(id,patch){ if(!TL.admin){ toast('Only the Super Admin can change these settings','error'); return false; } CR.cfg.led[id]=Object.assign({},CR.cfg.led[id]||{},patch); _crSave(); return true; }

function _crItems(){
  const leds=(TL.ledgers||[]).filter(_crIsCred); const inClub=new Set(); CR.cfg.clubs.forEach(c=>c.ledgers.forEach(n=>inClub.add(n)));
  const items=[];
  leds.forEach(l=>{ if(!inClub.has(l.name)) items.push({id:'L:'+l.name,name:l.name,names:[l.name],tally:Number(l.closing_balance)||0,club:false}); });
  CR.cfg.clubs.forEach(c=>{ const ms=leds.filter(l=>c.ledgers.includes(l.name)); if(!ms.length) return;
    items.push({id:'C:'+c.id,name:c.name,names:ms.map(l=>l.name),tally:ms.reduce((s,l)=>s+(Number(l.closing_balance)||0),0),club:true,cid:c.id}); });
  items.forEach(it=>{ it.c=_crCfg(it.id); it.bal=it.tally+it.c.adj; });
  return items;
}
function _crEng(it){ const c=it.c; let bal=c.bal; if(bal==='auto') bal=it.bal<0?'debit':(it.bal>0?'credit':'all');
  return Object.assign({},tlIntSet(),{rate:c.rate,compound:c.compound,balances:bal},c.adv||{}); }

// ───────── statements & interest ─────────
async function _crStmt(name){ if(!CR.stm[name]) CR.stm[name]=await tlApi('ledger_statement',{ledger:name}); return CR.stm[name]; }
async function _crBuild(it){
  const rs=[], infos=[];
  for(const n of it.names){ const r=await _crStmt(n); infos.push({name:n,opening_balance:r.ledger?r.ledger.opening_balance:0,closing_balance:r.ledger?r.ledger.closing_balance:0,hist:r.hist});
    r.rows.forEach(x=>rs.push(Object.assign({},x,{ledger:x.ledger||x.ledger_name||n}))); }
  return _tlBridge(infos,rs);
}
async function _crCalcOne(it,asOn){
  const S=_crEng(it), c=it.c; const br=await _crBuild(it);
  let rows=br.rows, open=Number(br.opening)||0, start=br.openingDate;
  if(c.from && c.from>start){ const prior=rows.filter(r=>r.vch_date<c.from).reduce((s,r)=>s+(Number(r.amount)||0),0); open=open+prior; start=c.from; rows=rows.filter(r=>r.vch_date>=c.from); }
  const txs=rows.map(r=>({date:r.vch_date,delta:-(Number(r.amount)||0),desc:((r.vch_type||'')+' '+(r.vch_number||'')).trim(),isInt:tlIsIntText((r.narration||'')+' '+(r.ledger||''))}));
  const posted=_tlIntPostedFor({title:'cr:'+it.id},rows,S.autoInt);
  const res=tlInterest(txs,-open,start,asOn,S.rate,{posted,set:S});
  return {interest:res.totalInterest, withInt:-res.due, principal:-res.principal, asOn, S:tlSetSummary(S)};
}
async function _crCalcAll(onlyIds){
  if(CR.busy) return; const items=_crItems().filter(it=>it.c.on&&(!onlyIds||onlyIds.includes(it.id))); if(!items.length){ toast('Switch interest ON for at least one ledger first','error'); return; }
  const asOn=tlv('cr-asof')||_tlToday(); CR.asOn=asOn; CR.busy=true; const st=document.getElementById('cr-prog'); let done=0, fail=0;
  const work=items.slice();
  const run=async()=>{ while(work.length){ const it=work.shift(); try{ CR.res[it.id]=await _crCalcOne(it,asOn); }catch(e){ fail++; if(e&&e.message==='SESSION'){ work.length=0; CR.busy=false; return _tlErr(e); } CR.res[it.id]={err:e.message}; }
      done++; if(st) st.textContent='Calculating '+done+' / '+items.length+'…'; } };
  await Promise.all([run(),run(),run(),run()]); CR.busy=false;
  toast('Interest calculated up to '+_tlDate(asOn)+(fail?' ('+fail+' failed)':''),fail?'error':'ok'); _crDraw();
}

// ───────── small dialog helper (fields are read before the dialog closes) ─────────
function _crDialog(title,html,okLabel,read){
  return new Promise(res=>{
    const old=document.getElementById('cr-dlg'); if(old) old.remove();
    const d=document.createElement('div'); d.id='cr-dlg'; d.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';
    d.innerHTML=`<div style="background:var(--surface);color:var(--text);border-radius:14px;max-width:640px;width:100%;max-height:88vh;overflow:auto;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.35)"><div style="font-size:16px;font-weight:700;margin-bottom:10px">${title}</div><div style="font-size:13px;line-height:1.5">${html}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn btn-sm" data-x>Cancel</button><button class="btn btn-sm btn-primary" data-ok>${_tlE(okLabel||'OK')}</button></div></div>`;
    document.body.appendChild(d);
    d.querySelector('[data-x]').onclick=()=>{ d.remove(); res(null); };
    d.querySelector('[data-ok]').onclick=()=>{ let v; try{ v=read(); }catch(e){ toast(e.message,'error'); return; } d.remove(); res(v); };
  });
}

// ───────── page ─────────
async function _tlCreditors(){
  const b=_tlBusy();
  try{ await _tlLoadLedgers(); await _crLoadCfg(); await tlLoadIntSet(); }catch(e){ return _tlErr(e); }
  CR.asOn=CR.asOn||_tlToday();
  const ro=!TL.admin;
  b.innerHTML=`<div class="card" style="padding:14px;margin-bottom:10px">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <div style="font-weight:700;font-size:15px">🧾 Creditors List</div>
      <span style="font-size:12px;color:var(--text3)">Tally group “CREDITORS LIST” · balances as of the last Tally sync · Debit = they owe us · Credit = we owe them</span>
      <span style="margin-left:auto"></span>
      <button class="btn btn-sm" onclick="_crReset()" title="Throw away all amount adjustments and calculated interest and show exactly what was last synced from Tally">↺ Reset to Tally values</button>
      <button class="btn btn-sm" onclick="_crExport('xlsx')">⬇ Excel</button><button class="btn btn-sm" onclick="_crExport('pdf')">⬇ PDF</button></div>
    <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-top:10px">
      <label style="font-size:11px">Search<br><input id="cr-q" value="${_tlA(CR.q)}" placeholder="Ledger name…" oninput="CR.q=this.value;_crDraw()" style="min-width:180px"></label>
      <label style="font-size:11px">Show<br><select id="cr-flt" onchange="CR.flt=this.value;_crDraw()">${[['all','All'],['dr','Debit balances'],['cr','Credit balances'],['on','Interest ON'],['club','Clubbed'],['adj','Adjusted']].map(o=>`<option value="${o[0]}"${CR.flt===o[0]?' selected':''}>${o[1]}</option>`).join('')}</select></label>
      <label style="font-size:11px">Sort<br><select id="cr-sort" onchange="CR.sort=this.value;_crDraw()">${[['name','Name'],['dr','Debit (largest first)'],['cr','Credit (largest first)'],['int','Interest (largest first)']].map(o=>`<option value="${o[0]}"${CR.sort===o[0]?' selected':''}>${o[1]}</option>`).join('')}</select></label>
      <label style="font-size:11px" title="Interest is calculated up to and including this date">Interest up to<br><input type="date" id="cr-asof" value="${_tlA(CR.asOn)}"></label>
      <button class="btn btn-primary btn-sm" onclick="_crCalcAll()" ${ro?'':''}>💰 Calculate interest (ledgers switched ON)</button><span id="cr-prog" style="font-size:12px;color:var(--text3)"></span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center">
      <span style="font-size:12px;color:var(--text3)">Tick ledgers →</span>
      <button class="btn btn-sm" onclick="_crClub()" ${ro?'disabled':''}>🔗 Club selected into one line</button>
      <button class="btn btn-sm" onclick="_crBulk()" ${ro?'disabled':''}>⚙ Interest settings for selected</button>
      <button class="btn btn-sm" onclick="_crTickAll(true)">Tick all shown</button><button class="btn btn-sm" onclick="_crTickAll(false)">Clear ticks</button>
      ${ro?'<span style="font-size:11px;color:var(--text3)">View only — the Super Admin sets interest, clubs and adjustments.</span>':''}</div></div>
    <div id="cr-kpi"></div><div id="cr-tbl"></div><div id="cr-st"></div>`;
  _crDraw();
}
function _crTickAll(v){ if(!v){ CR.sel.clear(); } else _crShown().forEach(it=>CR.sel.add(it.id)); _crDraw(); }
function _crShown(){
  const q=(CR.q||'').toLowerCase(); let items=_crItems();
  items=items.filter(it=>{ if(q&&!(it.name+' '+it.names.join(' ')).toLowerCase().includes(q)) return false;
    return CR.flt==='dr'?it.bal<0:CR.flt==='cr'?it.bal>0:CR.flt==='on'?it.c.on:CR.flt==='club'?it.club:CR.flt==='adj'?it.c.adj!==0:true; });
  const intOf=it=>{ const r=CR.res[it.id]; return r&&r.interest!=null?r.interest:0; };
  items.sort(CR.sort==='dr'?(a,b)=>a.bal-b.bal:CR.sort==='cr'?(a,b)=>b.bal-a.bal:CR.sort==='int'?(a,b)=>intOf(b)-intOf(a):(a,b)=>a.name.toLowerCase()<b.name.toLowerCase()?-1:1);
  return items;
}
function _crDraw(){
  const t=document.getElementById('cr-tbl'); if(!t) return; const items=_crShown(); const ro=!TL.admin;
  let dr=0,cr=0,ti=0,tw=0,nres=0;
  const rows=items.map(it=>{ const b=it.bal; if(b<0) dr+=-b; else cr+=b; const r=CR.res[it.id]; if(r&&r.interest!=null){ ti+=r.interest; tw+=r.withInt; nres++; } else tw+=b;
    const c=it.c, off=!c.on;
    const intCell=!c.on?'<span style="color:var(--text3)">—</span>':(r?(r.err?`<span style="color:#c0392b;font-size:11px" title="${_tlA(r.err)}">error</span>`:_tlN(r.interest)):'<span style="color:var(--text3);font-size:11px">not yet</span>');
    const wiCell=r&&r.withInt!=null&&c.on?_tlAmt(r.withInt):'';
    const id=_tlA(_crQ(it.id));
    return `<tr class="${it.club?'cr-club':''}${c.adj?' cr-adj':''}"><td><input type="checkbox" ${CR.sel.has(it.id)?'checked':''} onchange="_crTick('${id}',this.checked)"></td>
      <td><a style="cursor:pointer;font-weight:600" onclick="_crOpen('${id}')" title="Open the statement">${_tlE(it.name)}</a>${it.club?` <span class="cr-badge" title="${_tlA(it.names.join(' + '))}">clubbed ${it.names.length}</span> <a style="cursor:pointer;font-size:11px;color:var(--text3)" onclick="_crUnclub('${_tlA(_crQ(it.cid))}')" ${ro?'hidden':''}>✂ split</a>`:''}${c.adj?` <span class="cr-badge adj" title="${_tlA((c.adjNote||'')+' · Tally balance '+_tlAmt(it.tally))}">adjusted</span>`:''}</td>
      <td style="text-align:right">${b<0?_tlN(-b):''}</td><td style="text-align:right">${b>0?_tlN(b):''}</td>
      <td style="text-align:center"><label class="cr-sw"><input type="checkbox" ${c.on?'checked':''} ${ro?'disabled':''} onchange="_crOn('${id}',this.checked)"><span></span></label></td>
      <td style="${off?'opacity:.45':''}"><input type="number" step="0.25" min="0" value="${c.rate}" ${ro?'disabled':''} style="width:68px" onchange="_crRate('${id}',this.value)"></td>
      <td style="${off?'opacity:.45':''}"><select ${ro?'disabled':''} onchange="_crComp('${id}',this.value==='1')"><option value="1"${c.compound?' selected':''}>Compound</option><option value="0"${c.compound?'':' selected'}>Simple</option></select></td>
      <td style="white-space:nowrap"><button class="btn btn-sm" ${ro?'disabled':''} title="More interest options" onclick="_crMore('${id}')">⚙</button> <button class="btn btn-sm" ${ro?'disabled':''} title="Alter the amount for this list" onclick="_crAdjust('${id}')">✎</button></td>
      <td style="text-align:right">${intCell}</td><td style="text-align:right;white-space:nowrap">${wiCell}</td></tr>`; }).join('');
  document.getElementById('cr-kpi').innerHTML=`<div class="tl-kpi"><div><div class="l">Ledgers shown</div><div class="v">${items.length}</div></div><div><div class="l">Total debit</div><div class="v">₹ ${_tlN(dr)}</div></div><div><div class="l">Total credit</div><div class="v">₹ ${_tlN(cr)}</div></div><div><div class="l">Net</div><div class="v">${_tlAmt(cr-dr)}</div></div>${nres?`<div><div class="l">Interest (calculated)</div><div class="v">₹ ${_tlN(ti)}</div></div>`:''}</div>`;
  t.innerHTML=`<div class="card" style="padding:0;overflow:auto"><table class="tbl" style="width:100%;font-size:12.5px"><thead><tr><th style="width:26px"></th><th style="text-align:left;min-width:230px">Particulars</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th title="Interest ON / OFF for this ledger (OFF by default)">Interest</th><th>Rate % p.a.</th><th>Type</th><th></th><th style="text-align:right">Interest ₹</th><th style="text-align:right">Balance + interest</th></tr></thead><tbody>${rows||'<tr><td colspan="10" style="padding:16px;color:var(--text3)">No ledgers found.'+((TL.ledgers||[]).some(_crIsCred)?'':' None of the synced ledgers has the group “CREDITORS LIST”.')+'</td></tr>'}</tbody>
    <tfoot><tr style="font-weight:700;background:var(--surface2)"><td></td><td>Grand Total</td><td style="text-align:right">${_tlN(dr)}</td><td style="text-align:right">${_tlN(cr)}</td><td colspan="4"></td><td style="text-align:right">${nres?_tlN(ti):''}</td><td></td></tr></tfoot></table></div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">Compound = interest of each financial year is added to the principal on 31 March; Simple = never added. ⚙ has the rest (payment/receipt day, year style, which side earns interest, interest-from date…). ✎ changes the amount shown in this list only — it does not change Tally or the interest calculation. Nothing here is ever posted to Tally.</div>`;
}
function _crTick(id,v){ v?CR.sel.add(id):CR.sel.delete(id); }
function _crOn(id,v){ if(_crPut(id,{on:v})){ if(!v) delete CR.res[id]; _crDraw(); } else _crDraw(); }
function _crRate(id,v){ const r=parseFloat(v); if(!isFinite(r)||r<0){ toast('Enter a rate of 0 or more','error'); return _crDraw(); } if(_crPut(id,{rate:r})) delete CR.res[id]; _crDraw(); }
function _crComp(id,v){ if(_crPut(id,{compound:v})) delete CR.res[id]; _crDraw(); }

// ───────── more options for one ledger ─────────
async function _crMore(id){
  const it=_crItems().find(x=>x.id===id); if(!it) return; const c=it.c; const S=Object.assign({},_crEng(it),{balances:c.bal==='auto'?'__auto':c.bal});
  const html=`<div style="margin-bottom:8px;color:var(--text3)">${_tlE(it.name)} — settings for this ledger only. Anything you do not change follows the app's default interest settings.</div>`+
    _tlSetFields('cm',S).replace('<select id="cm-balances">','<select id="cm-balances"><option value="auto">Auto — the side the balance is on</option>')+
    `<label style="font-size:11px;display:block;margin-top:10px">Interest from (leave empty = from the start of the books)<br><input type="date" id="cm-from" value="${_tlA(c.from)}"></label>`;
  const v=await _crDialog('⚙ Interest options',html,'Save',()=>{ const s=_tlSetRead('cm'); const bal=tlv('cm-balances'); return {rate:s.rate,bal:bal==='auto'?'auto':s.balances,compound:s.compound,adv:{payDay:s.payDay,recDay:s.recDay,style:s.style,lastDay:s.lastDay,stopNil:s.stopNil,autoInt:s.autoInt},from:tlv('cm-from')}; });
  if(!v) return; if(_crPut(id,v)){ delete CR.res[id]; _crDraw(); }
}
// ───────── alter the amount (this list only) ─────────
async function _crAdjust(id){
  const it=_crItems().find(x=>x.id===id); if(!it) return; const c=it.c;
  const html=`<div style="margin-bottom:8px">Tally balance of <b>${_tlE(it.name)}</b>: <b>${_tlAmt(it.tally)}</b>. The amount below is <b>added</b> to it in this list only (it is not sent to Tally and does not change the interest calculation).</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end"><label style="font-size:11px">Amount<br><input type="number" step="0.01" id="ca-a" value="${Math.abs(c.adj)||''}" style="width:140px"></label>
    <label style="font-size:11px">Side<br><select id="ca-s"><option value="Cr"${c.adj>=0?' selected':''}>Credit (+)</option><option value="Dr"${c.adj<0?' selected':''}>Debit (−)</option></select></label>
    <label style="font-size:11px;flex:1">Note<br><input id="ca-n" value="${_tlA(c.adjNote)}" style="width:100%" placeholder="Why?"></label></div>
    <div style="font-size:11px;color:var(--text3);margin-top:8px">Leave the amount empty to remove the adjustment.</div>`;
  const v=await _crDialog('✎ Alter amount',html,'Save',()=>{ const a=parseFloat(tlv('ca-a')); const adj=isFinite(a)&&a!==0?(tlv('ca-s')==='Dr'?-a:a):0; return {adj,adjNote:adj?tlv('ca-n'):''}; });
  if(!v) return; if(_crPut(id,v)) _crDraw();
}
// ───────── clubbing ─────────
async function _crClub(){
  const items=_crItems().filter(it=>CR.sel.has(it.id)); if(items.length<2){ toast('Tick two or more ledgers first','error'); return; }
  const names=[]; items.forEach(it=>it.names.forEach(n=>names.push(n)));
  const nm=prompt('Show these '+names.length+' ledgers as ONE line.\nName for the clubbed line:',items[0].name); if(!nm||!nm.trim()) return;
  const cid='c'+Date.now().toString(36);
  const gone=new Set(items.filter(it=>it.club).map(it=>it.cid));
  CR.cfg.clubs=CR.cfg.clubs.filter(c=>!gone.has(c.id)); CR.cfg.clubs.push({id:cid,name:nm.trim(),ledgers:names});
  items.forEach(it=>{ delete CR.res[it.id]; });
  CR.sel.clear(); _crSave(); _crDraw(); toast('Clubbed into “'+nm.trim()+'”','ok');
}
function _crUnclub(cid){ if(!TL.admin) return; if(!confirm('Split this clubbed line back into its separate ledgers?')) return;
  CR.cfg.clubs=CR.cfg.clubs.filter(c=>c.id!==cid); delete CR.cfg.led['C:'+cid]; delete CR.res['C:'+cid]; CR.sel.delete('C:'+cid); _crSave(); _crDraw(); }
// ───────── settings for several ledgers at once ─────────
async function _crBulk(){
  const items=_crItems().filter(it=>CR.sel.has(it.id)); if(!items.length){ toast('Tick at least one ledger first','error'); return; }
  const d=tlIntSet();
  const html=`<div style="margin-bottom:8px">${items.length} ledger(s) selected. Only the boxes you fill are applied.</div><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">
    <label style="font-size:11px">Interest<br><select id="cb-on"><option value="">— leave as is —</option><option value="1">Switch ON</option><option value="0">Switch OFF</option></select></label>
    <label style="font-size:11px">Rate % a year<br><input type="number" step="0.25" min="0" id="cb-rate" placeholder="e.g. ${d.rate}" style="width:110px"></label>
    <label style="font-size:11px">Type<br><select id="cb-comp"><option value="">— leave as is —</option><option value="1">Compound</option><option value="0">Simple</option></select></label></div>`;
  const v=await _crDialog('⚙ Interest settings for selected',html,'Apply',()=>{ const p={}; if(tlv('cb-on')!=='') p.on=tlv('cb-on')==='1'; if(tlv('cb-rate')!==''){ const r=parseFloat(tlv('cb-rate')); if(!isFinite(r)||r<0) throw new Error('Enter a valid rate'); p.rate=r; } if(tlv('cb-comp')!=='') p.compound=tlv('cb-comp')==='1'; return p; });
  if(!v||!Object.keys(v).length) return; items.forEach(it=>{ CR.cfg.led[it.id]=Object.assign({},CR.cfg.led[it.id]||{},v); delete CR.res[it.id]; }); _crSave(); _crDraw(); toast('Applied to '+items.length+' ledger(s)','ok');
}
// ───────── reset ─────────
async function _crReset(){
  if(!confirm('Reset to Tally values?\n\n• every amount adjustment (✎) is removed\n• calculated interest is cleared\n• balances are re-read from the last Tally sync\n\nYour interest switches, rates and clubbed lines are kept.')) return;
  Object.keys(CR.cfg.led).forEach(k=>{ delete CR.cfg.led[k].adj; delete CR.cfg.led[k].adjNote; }); CR.res={}; CR.stm={}; TL.ledgers=null; CR.sel.clear(); _crSave();
  try{ await _tlLoadLedgers(); }catch(e){ return _tlErr(e); } _crDraw(); toast('Showing exactly the last synced Tally amounts','ok');
}
// ───────── open statement ─────────
async function _crOpen(id){
  const it=_crItems().find(x=>x.id===id); const d=document.getElementById('cr-st'); if(!it||!d) return;
  d.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">⏳ Loading…</div>';
  try{ const br=await _crBuild(it); _tlStatement({rows:br.rows,opening:br.opening,openingDate:br.openingDate,title:it.name+(it.club?' (clubbed: '+it.names.join(' + ')+')':''),interest:true},d); d.scrollIntoView({behavior:'smooth',block:'start'}); }catch(e){ _tlErr(e); }
}
// ───────── export ─────────
function _crExport(kind){
  if(!_xCheckLibs(kind)) return; const items=_crShown(); if(!items.length){ toast('Nothing to export','error'); return; }
  const base=_xName('Creditors_List')+'_'+_xToday();
  const line=it=>{ const r=CR.res[it.id], c=it.c; return [it.name+(it.club?' (clubbed)':''), it.bal<0?-it.bal:'', it.bal>0?it.bal:'', c.on?'ON':'off', c.on?c.rate:'', c.on?(c.compound?'Compound':'Simple'):'', c.on&&r&&r.interest!=null?r.interest:'', c.on&&r&&r.withInt!=null?r.withInt:'', c.adj?('adjusted: '+(c.adjNote||'')):'']; };
  const dr=items.reduce((s,it)=>s+(it.bal<0?-it.bal:0),0), cr=items.reduce((s,it)=>s+(it.bal>0?it.bal:0),0);
  if(kind==='xlsx'){
    const aoa=[['RSR CONSTRUCTIONS'],['Creditors List'],['Generated',_xD(_xToday())],['Interest calculated up to',CR.asOn?_xD(CR.asOn):'-'],['Debit = they owe us · Credit = we owe them · "Balance + interest" in Dr(-)/Cr(+)'],[],['Particulars','Debit','Credit','Interest','Rate %','Type','Interest amount','Balance + interest','Note']];
    items.forEach(it=>{ const l=line(it); aoa.push([l[0],l[1]!==''?_xNum(l[1]):'',l[2]!==''?_xNum(l[2]):'',l[3],l[4],l[5],l[6]!==''?_xNum(l[6]):'',l[7]!==''?_xNum(l[7]):'',l[8]]); });
    aoa.push([],['Grand Total',_xNum(dr),_xNum(cr)]);
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,_xSheet(aoa,[38,16,16,10,9,11,16,18,26]),'Creditors List'); XLSX.writeFile(wb,base+'.xlsx');
  } else {
    const c=_xPdfStart('Creditors List',null,true); const {doc}=c;
    const body=items.map(it=>{ const l=line(it); const R=v=>({content:v!==''?_xPlain(v):'',styles:{halign:'right'}}); return [l[0],R(l[1]),R(l[2]),l[3]==='ON'?(l[4]+'% '+l[5]):'',R(l[6]),{content:l[7]!==''?_xPlain(Math.abs(l[7]))+(l[7]<0?' Dr':' Cr'):'',styles:{halign:'right'}}]; });
    doc.autoTable({startY:c.y+4,head:[['Particulars','Debit','Credit','Interest','Interest amt','Balance + interest']],body,styles:{font:'helvetica',fontSize:8,cellPadding:3.5},headStyles:{fillColor:c.navy,textColor:[255,255,255]},columnStyles:{1:{halign:'right'},2:{halign:'right'},4:{halign:'right'},5:{halign:'right'}},alternateRowStyles:{fillColor:[247,248,251]},margin:{left:40,right:40},
      foot:[['Grand Total',{content:_xPlain(dr),styles:{halign:'right'}},{content:_xPlain(cr),styles:{halign:'right'}},'','','']],footStyles:{fillColor:c.navy,textColor:[255,255,255]}});
    _xPdfFooter(doc); doc.save(base+'.pdf');
  }
}
// small styles for this page
(function(){ if(document.getElementById('cr-style')) return; const s=document.createElement('style'); s.id='cr-style'; s.textContent=`
  #sec-tally .cr-badge{display:inline-block;font-size:10px;border-radius:10px;padding:1px 7px;background:var(--surface2);border:1px solid var(--border);color:var(--text2)}
  #sec-tally .cr-badge.adj{background:var(--amber-bg);color:var(--amber);border-color:#f0d9a8}
  #sec-tally tr.cr-club td:nth-child(2){border-left:3px solid var(--gold)}
  #sec-tally tr.cr-adj{background:var(--amber-bg)!important}
  #sec-tally .cr-sw{position:relative;display:inline-block;width:38px;height:22px}
  #sec-tally .cr-sw input{opacity:0;width:0;height:0}
  #sec-tally .cr-sw span{position:absolute;inset:0;background:#c9cfdc;border-radius:22px;transition:.2s;cursor:pointer}
  #sec-tally .cr-sw span:before{content:'';position:absolute;height:16px;width:16px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
  #sec-tally .cr-sw input:checked+span{background:var(--green)}
  #sec-tally .cr-sw input:checked+span:before{transform:translateX(16px)}
  #sec-tally .cr-sw input:disabled+span{opacity:.5;cursor:not-allowed}`; document.head.appendChild(s); })();
