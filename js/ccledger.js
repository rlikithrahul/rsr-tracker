// ═══════════════════════════════════════════════════════
// ccledger.js — "Contractor by cost centre" tab inside Tally Live (READ-ONLY mirror; nothing is ever written to Tally)
// One contractor's ledger broken into his cost centres. Any cost centre (or any one of his ledgers) can be HIDDEN: it then drops out of the
// summary, the statement, every total and the Excel / PDF download, and waits in a "Hidden" list under the totals until shown again.
// Use: a cost centre settled outside Tally's books (talks, cash...) can be set aside so the rest of his ledger reads cleanly.
// The hidden choices are kept per contractor in the app's settings table (key rsr_ccledger_v1). Nothing is deleted, nothing in Tally changes.
// Needs the tally-api action "contractor_cc_statement" (v27w).
// ═══════════════════════════════════════════════════════
const CL_KEY = 'rsr_ccledger_v1';
const CL_NONE = '';                                    // key of "no cost centre" (also brought-forward / opening amounts)
const CL_NONE_LABEL = '(No cost centre · brought forward)';
let CL = { cont:'', cfg:null, data:null, lines:[], vis:[], hidden:[] };

async function _clLoadCfg(){
  if(CL.cfg) return CL.cfg;
  let v=null; try{ v=await getSetting(CL_KEY,null); }catch(e){}
  CL.cfg=(v&&typeof v==='object'&&v.c&&typeof v.c==='object')?v:{c:{}};
  return CL.cfg;
}
function _clH(){ const k=CL.cont; if(!CL.cfg.c[k]) CL.cfg.c[k]={cc:{},led:{}}; const o=CL.cfg.c[k]; if(!o.cc) o.cc={}; if(!o.led) o.led={}; return o; }
let _clSaveT=null;
function _clSave(){ clearTimeout(_clSaveT); _clSaveT=setTimeout(async()=>{ try{ await saveSetting(CL_KEY,CL.cfg); }catch(e){ toast('Could not save the hidden list: '+e.message,'error'); } },400); }
function _clCan(){ if(!TL.admin){ toast('Only the Super Admin can hide or show cost centres','error'); return false; } return true; }
function _clLabel(k){ return k===CL_NONE?CL_NONE_LABEL:k; }

// ───────── the tab ─────────
async function _tlCCLedger(){
  const b=_tlBusy(); const names=_tlContractors();
  b.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:end">
    <label style="font-size:11px">Contractor<br><input id="cl-c" list="cl-cl" value="${_tlA(CL.cont)}" placeholder="Type to search…" style="min-width:260px" onchange="_clGo()"></label><datalist id="cl-cl">${names.map(n=>`<option value="${_tlA(n)}">`).join('')}</datalist>
    <button class="btn btn-primary btn-sm" onclick="_clGo()">Show</button>
    <span style="font-size:11px;color:var(--text3);max-width:520px">His ledger split by cost centre. Hide the ones that are settled or not needed; they leave every number and download until you show them again.</span></div><div id="cl-body"></div>`;
  if(CL.cont) _clGo();
}
async function _clGo(){
  CL.cont=tlv('cl-c').trim(); const d=document.getElementById('cl-body'); if(!d) return; if(!CL.cont){ d.innerHTML=''; return; }
  d.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">⏳ Loading…</div>';
  try{
    await _clLoadCfg();
    const r=await tlApi('contractor_cc_statement',{contractor:CL.cont,history:true});
    if(!r.ledgers||!r.ledgers.length){ d.innerHTML='<div class="card" style="padding:16px;color:var(--text3)">No Tally ledgers are linked to this contractor yet'+(TL.admin?' — use the 🔗 Linking tab.':'.')+'</div>'; return; }
    CL.data=r; _clBuild(); _clDraw();
  }catch(e){
    if(e&&/unknown action/i.test(e.message||'')){ d.innerHTML='<div class="card" style="padding:16px;color:#c0392b;font-size:13px">⚠️ This view needs the updated <b>tally-api</b> function (v27w). Open Supabase → Edge Functions → tally-api, paste the new tally-api.ts and Deploy. Nothing else changes.</div>'; return; }
    _tlErr(e);
  }
}

// every voucher of every ledger of the contractor becomes one line per cost centre it was posted to
function _clBuild(){
  const r=CL.data, out=[]; const h0=TL.hist; TL.hist=true;
  try{
    for(const l of r.ledgers){
      const own=r.rows.filter(x=>x.ledger===l.name);
      const br=_tlBridge([l],own);
      if(Math.abs(Number(br.opening)||0)>=0.005) out.push({d:br.openingDate,t:'Opening balance',n:'',led:l.name,nar:'',cc:CL_NONE,amt:Number(br.opening),g:'op:'+l.name,syn:true});
      br.rows.forEach((x,i)=>{
        const parts=(x.ccs&&x.ccs.length)?x.ccs:[{cc:CL_NONE,amount:Number(x.amount)||0}];
        parts.forEach(p=>out.push({d:x.vch_date,t:x.vch_type||'',n:x.vch_number||'',led:x.ledger||x.ledger_name||l.name,nar:x.narration||'',cc:p.cc||CL_NONE,amt:Number(p.amount)||0,g:x.guid||('s'+i+l.name),syn:!!x.synthetic}));
      });
    }
  } finally { TL.hist=h0; }
  out.sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0);
  CL.lines=out;
}

function _clDraw(){
  const d=document.getElementById('cl-body'); if(!d||!CL.data) return;
  const H=_clH(), r=CL.data;
  const shown=CL.lines.filter(x=>!H.led[x.led]&&!H.cc[x.cc]);
  // summary per cost centre (shown ones only)
  const g=new Map(); shown.forEach(x=>{ let e=g.get(x.cc); if(!e){ e={cc:x.cc,ids:new Set(),dr:0,cr:0}; g.set(x.cc,e); } e.ids.add(x.g); if(x.amt<0) e.dr+=-x.amt; else e.cr+=x.amt; });
  CL.vis=[...g.values()].sort((a,b)=>(a.cc===CL_NONE)-(b.cc===CL_NONE)||a.cc.localeCompare(b.cc));
  const tdr=CL.vis.reduce((s,e)=>s+e.dr,0), tcr=CL.vis.reduce((s,e)=>s+e.cr,0);
  // hidden list (only things that exist in his ledger)
  const allCC=new Set(CL.lines.map(x=>x.cc)); const allLed=new Set(r.ledgers.map(l=>l.name));
  const hCC=[...allCC].filter(k=>H.cc[k]).sort(), hLed=[...allLed].filter(k=>H.led[k]).sort();
  CL.hidden=hCC.map(k=>({t:'cc',k})).concat(hLed.map(k=>({t:'led',k})));
  const cnt=k=>new Set(CL.lines.filter(x=>x.cc===k).map(x=>x.g)).size;
  // statement of shown lines
  let bal=0;
  const body=shown.map((x,i)=>{ bal+=x.amt;
    return `<tr${x.syn?' style="background:var(--surface2)"':''}><td>${_tlDate(x.d)}</td><td>${_tlE(x.t)} ${_tlE(x.n)}</td><td>${_tlE(x.led)}</td><td>${_tlE(_clLabel(x.cc))}</td><td style="max-width:280px">${_tlE(x.nar)}</td><td style="text-align:right">${x.amt<0?_tlN(-x.amt):''}</td><td style="text-align:right">${x.amt>0?_tlN(x.amt):''}</td><td style="text-align:right">${_tlAmt(bal)}</td></tr>`; }).join('');
  const sumRows=CL.vis.map((e,i)=>`<tr><td>${_tlE(_clLabel(e.cc))}</td><td style="text-align:right">${e.ids.size}</td><td style="text-align:right">${_tlN(e.dr)}</td><td style="text-align:right">${_tlN(e.cr)}</td><td style="text-align:right">${_tlAmt(e.cr-e.dr)}</td><td style="text-align:right"><button class="btn btn-sm" onclick="_clHide('cc',${i})" title="Hide this cost centre from this ledger and its downloads">Hide</button></td></tr>`).join('');
  const ledChips=r.ledgers.length>1?`<div style="margin-top:8px;font-size:12px"><b>His ledgers:</b> ${r.ledgers.map((l,i)=>H.led[l.name]?'':`<span style="display:inline-block;margin:2px 6px 2px 0;padding:2px 8px;background:var(--surface2);border-radius:10px">${_tlE(l.name)} <a href="#" onclick="event.preventDefault();_clHide('led',${i})" style="margin-left:4px;color:var(--text3)" title="Hide this ledger">hide</a></span>`).join('')}</div>`:'';
  const hid=CL.hidden.length?`<div class="card" style="padding:12px;margin-top:12px"><div style="font-weight:700;margin-bottom:6px">🙈 Hidden — left out of the numbers above and of the downloads</div>
      ${CL.hidden.map((h,i)=>`<div style="display:flex;gap:8px;align-items:center;padding:4px 0;border-top:1px solid var(--border);font-size:12px"><span style="flex:1">${h.t==='cc'?'Cost centre':'Ledger'}: <b>${_tlE(h.t==='cc'?_clLabel(h.k):h.k)}</b>${h.t==='cc'?` <span style="color:var(--text3)">· ${cnt(h.k)} entries</span>`:''}</span><button class="btn btn-sm" onclick="_clShow(${i})">Show again</button></div>`).join('')}
      ${CL.hidden.length>1?'<div style="margin-top:8px"><button class="btn btn-sm" onclick="_clShowAll()">Show all again</button></div>':''}</div>`:'';
  TL.stmt={rows:shown.map(x=>({vch_date:x.d,vch_type:x.t,vch_number:x.n,ledger:x.led,cc_name:_clLabel(x.cc),narration:x.nar,amount:x.amt})),opening:null,title:CL.cont+' — ledger (selected cost centres)'};
  d.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px;font-size:13px"><b>${_tlE(CL.cont)}</b> — ${r.ledgers.length} Tally ledger${r.ledgers.length>1?'s':''}, ${CL.vis.length} cost centre${CL.vis.length===1?'':'s'} shown${CL.hidden.length?`, ${CL.hidden.length} hidden`:''}${ledChips}</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0"><div style="font-weight:700">Cost centres</div><span style="margin-left:auto"></span><button class="btn btn-sm" onclick="_clDownload('xlsx')">⬇ Excel</button><button class="btn btn-sm" onclick="_clDownload('pdf')">⬇ PDF</button></div>
    <div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>Cost centre</th><th style="text-align:right">Entries</th><th style="text-align:right">Paid out (Dr)</th><th style="text-align:right">Received (Cr)</th><th style="text-align:right">Net</th><th></th></tr></thead><tbody>${sumRows||'<tr><td colspan="6" style="color:var(--text3);padding:12px">Nothing to show — every cost centre is hidden.</td></tr>'}
      <tr style="font-weight:700;background:var(--surface2)"><td>Total of the cost centres shown</td><td></td><td style="text-align:right">${_tlN(tdr)}</td><td style="text-align:right">${_tlN(tcr)}</td><td style="text-align:right">${_tlAmt(tcr-tdr)}</td><td></td></tr></tbody></table></div>
    <div style="font-weight:700;margin:14px 0 6px">Ledger — shown cost centres only</div>
    <div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>Date</th><th>Voucher</th><th>Ledger</th><th>Cost centre</th><th>Narration</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th></tr></thead><tbody>${body}
      <tr style="font-weight:700;background:var(--surface2)"><td colspan="5">Totals</td><td style="text-align:right">${_tlN(tdr)}</td><td style="text-align:right">${_tlN(tcr)}</td><td style="text-align:right">${_tlAmt(tcr-tdr)}</td></tr></tbody></table></div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">Dr = paid out · Cr = received. The balance runs only over the cost centres shown, so it is not Tally's closing balance. A voucher shared between cost centres shows only the part that belongs to the cost centres shown.</div>
    ${hid}`;
}

function _clHide(kind,i){
  if(!_clCan()) return; const H=_clH();
  if(kind==='cc'){ const e=CL.vis[i]; if(!e) return; H.cc[e.cc]=true; }
  else { const l=CL.data.ledgers[i]; if(!l) return; H.led[l.name]=true; }
  _clSave(); _clDraw();
}
function _clShow(i){ if(!_clCan()) return; const h=CL.hidden[i]; if(!h) return; const H=_clH(); if(h.t==='cc') delete H.cc[h.k]; else delete H.led[h.k]; _clSave(); _clDraw(); }
function _clShowAll(){ if(!_clCan()) return; const H=_clH(); H.cc={}; H.led={}; _clSave(); _clDraw(); }
function _clDownload(kind){ if(typeof tlDownloadStatement==='function') tlDownloadStatement(kind); }   // TL.stmt was set by _clDraw to the shown lines only
