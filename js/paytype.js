// ═══════════════════════════════════════════════════════
// paytype.js — "Payment types" tab inside Tally Live (READ-ONLY mirror: nothing is ever written to Tally)
// Tally posts every payment / receipt as "cash". Here each voucher line of a contractor's ledger is given its REAL type, stored in the app only
// (settings key rsr_paytype_v1). Types: Cash (by us / outside UPI or cash) · Online transfer (which firm's account) · Material (cement / steel / other + supplier)
// · Other · Received from GVMC / department. A voucher can be split into parts. Totals per type / bank are shown with total paid, total received and the difference.
// Saves are merged with the latest stored copy so two people tagging at once never overwrite each other.
// ═══════════════════════════════════════════════════════
const PT_KEY='rsr_paytype_v1';
const PT_TYPES={cash:'Cash',online:'Online transfer',material:'Material payment',other:'Other',govt:'Received from GVMC / department'};
const PT_SUBS={cash:{own:'Cash given by us',outside:'Outside UPI / cash payment'},online:{'RSR CONSTRUCTIONS':'RSR CONSTRUCTIONS','R SADHU RAO':'R SADHU RAO','R LIKITH RAHUL':'R LIKITH RAHUL'},material:{cement:'Cement',steel:'Steel',other:'Other material'},other:{},govt:{}};
let PT={cont:'',data:null,lines:[],tags:null,sel:new Set(),f:{led:'',type:'',q:''}};

async function _ptLoadTags(force){ if(PT.tags&&!force) return PT.tags; let v=null; try{ v=await getSetting(PT_KEY,null); }catch(e){} PT.tags=(v&&v.v&&typeof v.v==='object')?v.v:{}; return PT.tags; }
async function _ptSave(changes){      // changes: {key: record|null}
  let v=null; try{ v=await getSetting(PT_KEY,null); }catch(e){ throw new Error('Could not read the saved types, nothing was changed'); }
  const base=(v&&v.v&&typeof v.v==='object')?v.v:{};
  Object.keys(changes).forEach(k=>{ if(changes[k]===null) delete base[k]; else base[k]=changes[k]; });
  await saveSetting(PT_KEY,{v:base}); PT.tags=base;
}
const _ptKey=x=>x.g+'|'+x.led;
function _ptSuppliers(){ const s=new Set(); Object.values(PT.tags||{}).forEach(r=>(r.p||[]).forEach(p=>{ if(p.u) s.add(p.u); })); return [...s].sort(); }
function _ptDesc(p){ let s=PT_TYPES[p.t]||p.t; const sub=(PT_SUBS[p.t]||{})[p.s]; if(sub) s+=' · '+sub; if(p.u) s+=' · '+p.u; return s; }
const _ptColor={cash:'#b45309',online:'#1d4ed8',material:'#047857',other:'#6b7280',govt:'#7c3aed'};

// ───────── tab ─────────
async function _tlPayType(){
  const b=_tlBusy(); const names=_tlContractors();
  b.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:end">
    <label style="font-size:11px">Contractor<br><input id="pt-c" list="pt-cl" value="${_tlA(PT.cont)}" placeholder="Type to search…" style="min-width:260px" onchange="_ptGo()"></label><datalist id="pt-cl">${names.map(n=>`<option value="${_tlA(n)}">`).join('')}</datalist>
    <button class="btn btn-primary btn-sm" onclick="_ptGo()">Show</button>
    <span style="font-size:11px;color:var(--text3);max-width:560px">Tally shows everything as cash. Mark how each payment or receipt really happened. Only this app stores it; Tally is never changed.</span></div><div id="pt-body"></div><div id="pt-modal"></div>`;
  if(PT.cont) _ptGo();
}
async function _ptGo(){
  PT.cont=tlv('pt-c').trim(); const d=document.getElementById('pt-body'); if(!d) return; PT.sel=new Set(); if(!PT.cont){ d.innerHTML=''; return; }
  d.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">⏳ Loading…</div>';
  try{
    await _ptLoadTags(true);
    let r; try{ r=await tlApi('contractor_cc_statement',{contractor:PT.cont,history:true}); }catch(e){ if(e&&/unknown action/i.test(e.message||'')) r=await tlApi('contractor_statement',{contractor:PT.cont,history:true}); else throw e; }
    if(!r.ledgers||!r.ledgers.length){ d.innerHTML='<div class="card" style="padding:16px;color:var(--text3)">No Tally ledgers are linked to this contractor yet.</div>'; return; }
    PT.data=r; PT.lines=r.rows.map((x,i)=>({g:x.guid||('s'+i),d:x.vch_date,t:x.vch_type||'',n:x.vch_number||'',led:x.ledger||x.ledger_name||'',nar:x.narration||'',cc:(x.ccs||[]).map(c=>c.cc).filter(Boolean).join(', '),amt:Number(x.amount)||0})).filter(x=>Math.abs(x.amt)>=0.005&&x.d).sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0);
    PT.f={led:'',type:'',q:''}; _ptDraw();
  }catch(e){ _tlErr(e); }
}

// ───────── totals ─────────
function _ptTotals(lines){
  const T={paid:0,rec:0,P:{},R:{}};
  const add=(side,t,s,a)=>{ const o=T[side]; const k=t+'|'+(s||''); o[k]=(o[k]||0)+a; };
  lines.forEach(x=>{
    const side=x.amt<0?'P':'R', tot=Math.abs(x.amt); if(side==='P') T.paid+=tot; else T.rec+=tot;
    const tg=PT.tags[_ptKey(x)];
    if(!tg||!tg.p||!tg.p.length) add(side,'none','',tot); else tg.p.forEach(p=>add(side,p.t,p.s,Number(p.a)||0));
  });
  return T;
}
function _ptBreak(o){
  const rows=[]; const sum=t=>Object.keys(o).filter(k=>k.startsWith(t+'|')).reduce((s,k)=>s+o[k],0);
  ['cash','online','material','other','govt'].forEach(t=>{ const tot=sum(t); if(tot<0.005) return;
    rows.push(`<tr style="font-weight:700;background:var(--surface2)"><td style="padding:5px 8px">${PT_TYPES[t]}</td><td style="padding:5px 8px;text-align:right">${_tlN(tot)}</td></tr>`);
    Object.keys(o).filter(k=>k.startsWith(t+'|')&&k.split('|')[1]).sort().forEach(k=>rows.push(`<tr><td style="padding:3px 8px 3px 22px;color:var(--text2)">${_tlE(PT_SUBS[t][k.split('|')[1]]||k.split('|')[1])}</td><td style="padding:3px 8px;text-align:right">${_tlN(o[k])}</td></tr>`)); });
  const none=sum('none'); if(none>=0.005) rows.push(`<tr style="font-weight:700;color:#c0392b"><td style="padding:5px 8px">Not yet marked</td><td style="padding:5px 8px;text-align:right">${_tlN(none)}</td></tr>`);
  return rows.join('')||'<tr><td colspan="2" style="padding:6px 8px;color:var(--text3)">None</td></tr>';
}

// ───────── draw ─────────
function _ptVis(){
  const f=PT.f, q=f.q.toLowerCase();
  return PT.lines.filter(x=>{ if(f.led&&x.led!==f.led) return false; const tg=PT.tags[_ptKey(x)];
    if(f.type==='none'&&tg&&tg.p&&tg.p.length) return false;
    if(f.type&&f.type!=='none'&&!(tg&&tg.p&&tg.p.some(p=>p.t===f.type))) return false;
    if(q&&!((x.nar+' '+x.n+' '+x.cc+' '+x.led).toLowerCase().includes(q))) return false; return true; });
}
function _ptDraw(){
  const d=document.getElementById('pt-body'); if(!d||!PT.data) return;
  const leds=[...new Set(PT.lines.map(x=>x.led))];
  const base=PT.f.led?PT.lines.filter(x=>x.led===PT.f.led):PT.lines;
  const T=_ptTotals(base), vis=_ptVis();
  const unt=base.filter(x=>{ const t=PT.tags[_ptKey(x)]; return !(t&&t.p&&t.p.length); }).length;
  const tbl=(title,o,tot)=>`<div class="card" style="padding:10px;flex:1;min-width:260px"><div style="font-weight:800;margin-bottom:6px">${title}</div><table style="width:100%;font-size:12px;border-collapse:collapse"><tbody>${_ptBreak(o)}</tbody><tfoot><tr style="border-top:2px solid var(--navy);font-weight:800"><td style="padding:6px 8px">Total</td><td style="padding:6px 8px;text-align:right">${_tlN(tot)}</td></tr></tfoot></table></div>`;
  const rows=vis.map(x=>{ const k=_ptKey(x), tg=PT.tags[k], ps=(tg&&tg.p)||[];
    const badge=ps.length?ps.map(p=>`<div style="font-size:11px"><span style="display:inline-block;padding:1px 7px;border-radius:9px;background:${_ptColor[p.t]||'#6b7280'};color:#fff;font-weight:700">${_tlE(_ptDesc(p))}</span>${ps.length>1?' ₹'+_tlN(p.a):''}${p.n?`<div style="color:var(--text3)">${_tlE(p.n)}</div>`:''}</div>`).join(''):'<span style="color:#c0392b;font-size:11px">Not marked</span>';
    return `<tr style="border-top:1px solid var(--border)"><td style="padding:6px"><input type="checkbox" ${PT.sel.has(k)?'checked':''} onchange="_ptTick('${_tlA(k)}',this.checked)"></td>
      <td style="padding:6px;white-space:nowrap">${_tlDate(x.d)}</td><td style="padding:6px;font-size:11px">${_tlE(x.t)} ${_tlE(x.n)}</td><td style="padding:6px;font-size:11px">${_tlE(x.led)}</td>
      <td style="padding:6px;font-size:11px;max-width:260px">${_tlE(x.nar)}${x.cc?`<div style="color:var(--text3)">CC: ${_tlE(x.cc)}</div>`:''}</td>
      <td style="padding:6px;text-align:right;color:#c0392b">${x.amt<0?_tlN(-x.amt):''}</td><td style="padding:6px;text-align:right;color:#047857">${x.amt>0?_tlN(x.amt):''}</td>
      <td style="padding:6px">${badge}</td><td style="padding:6px;white-space:nowrap"><button class="btn btn-sm" onclick="_ptOpen('${_tlA(k)}')">Set / split</button>${ps.length?` <button class="btn btn-sm" onclick="_ptClear('${_tlA(k)}')" title="Back to not marked">✕</button>`:''}</td></tr>`; }).join('');
  d.innerHTML=`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
      <div class="card" style="padding:12px;min-width:240px"><div style="font-size:11px;color:var(--text3)">TOTAL PAID (Dr)</div><div style="font-size:20px;font-weight:800;color:#c0392b">₹${_tlN(T.paid)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:6px">TOTAL RECEIVED (Cr)</div><div style="font-size:20px;font-weight:800;color:#047857">₹${_tlN(T.rec)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:6px">DIFFERENCE (paid − received)</div><div style="font-size:20px;font-weight:800">₹${_tlN(T.paid-T.rec)}</div><div style="font-size:10px;color:var(--text3)">${T.paid-T.rec>=0?'still with the contractor / RSR out':'received more than paid'}</div></div>
      ${tbl('Paid out, by type',T.P,T.paid)}${tbl('Received, by type',T.R,T.rec)}</div>
    <div class="card" style="padding:10px;margin-bottom:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      ${leds.length>1?`<select onchange="PT.f.led=this.value;_ptDraw()"><option value="">All his ledgers</option>${leds.map(l=>`<option ${PT.f.led===l?'selected':''}>${_tlE(l)}</option>`).join('')}</select>`:''}
      <select onchange="PT.f.type=this.value;_ptDraw()"><option value="">All types</option><option value="none" ${PT.f.type==='none'?'selected':''}>Not marked yet (${unt})</option>${Object.keys(PT_TYPES).map(t=>`<option value="${t}" ${PT.f.type===t?'selected':''}>${PT_TYPES[t]}</option>`).join('')}</select>
      <input placeholder="Search narration / cost centre…" value="${_tlA(PT.f.q)}" onchange="PT.f.q=this.value;_ptDraw()" style="min-width:200px">
      <span style="font-size:12px;color:var(--text3)">${vis.length} entries · ${unt} not marked</span>
      <button class="btn btn-sm" style="margin-left:auto" onclick="_ptExcel()">⬇ Excel</button></div>
    <div class="card" style="padding:10px;margin-bottom:8px;background:#fffbeb;display:flex;gap:8px;flex-wrap:wrap;align-items:end"><b style="font-size:12px">Mark <span id="pt-seln">${PT.sel.size}</span> ticked:</b>${_ptFieldsHtml('pa',null)}<button class="btn btn-primary btn-sm" onclick="_ptApply()">Apply to ticked</button>
      <button class="btn btn-sm" onclick="_ptTickAll(true)">Tick all shown</button><button class="btn btn-sm" onclick="_ptTickAll(false)">Clear ticks</button></div>
    <div class="card" style="padding:0;overflow:auto"><table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr style="text-align:left;color:var(--text3);font-size:10px;text-transform:uppercase"><th style="padding:6px"></th><th style="padding:6px">Date</th><th style="padding:6px">Voucher</th><th style="padding:6px">Ledger</th><th style="padding:6px">Narration · cost centre</th><th style="padding:6px;text-align:right">Paid</th><th style="padding:6px;text-align:right">Received</th><th style="padding:6px">Type</th><th style="padding:6px"></th></tr></thead><tbody>${rows||'<tr><td colspan="9" style="padding:16px;color:var(--text3)">Nothing matches.</td></tr>'}</tbody></table></div>
    <datalist id="pt-sup">${_ptSuppliers().map(s=>`<option value="${_tlA(s)}">`).join('')}</datalist>`;
}
function _ptTick(k,on){ if(on) PT.sel.add(k); else PT.sel.delete(k); const b=document.getElementById('pt-seln'); if(b) b.textContent=PT.sel.size; }
function _ptTickAll(on){ PT.sel=new Set(on?_ptVis().map(_ptKey):[]); _ptDraw(); }

// ───────── type fields (shared by the apply bar and the split dialog) ─────────
function _ptFieldsHtml(id,v){
  v=v||{}; const t=v.t||'cash';
  return `<select id="${id}-t" onchange="_ptSubs('${id}')">${Object.keys(PT_TYPES).map(k=>`<option value="${k}" ${t===k?'selected':''}>${PT_TYPES[k]}</option>`).join('')}</select>
    <span id="${id}-sw">${_ptSubHtml(id,t,v.s)}</span>
    <input id="${id}-u" list="pt-sup" placeholder="Supplier (optional)" value="${_tlA(v.u||'')}" style="width:150px;${t==='material'?'':'display:none'}">
    <input id="${id}-n" placeholder="Note (optional)" value="${_tlA(v.n||'')}" style="width:160px">`;
}
function _ptSubHtml(id,t,s){ const o=PT_SUBS[t]||{}; const ks=Object.keys(o); if(!ks.length) return ''; return `<select id="${id}-s">${ks.map(k=>`<option value="${_tlA(k)}" ${s===k?'selected':''}>${_tlE(o[k])}</option>`).join('')}</select>`; }
function _ptSubs(id){ const t=document.getElementById(id+'-t').value; document.getElementById(id+'-sw').innerHTML=_ptSubHtml(id,t,''); const u=document.getElementById(id+'-u'); if(u) u.style.display=t==='material'?'':'none'; }
function _ptRead(id,amt){ const t=document.getElementById(id+'-t').value; const se=document.getElementById(id+'-s'); const u=(document.getElementById(id+'-u').value||'').trim(); const n=(document.getElementById(id+'-n').value||'').trim();
  const p={t,a:Math.round(amt*100)/100}; if(se) p.s=se.value; if(t==='material'&&u) p.u=u; if(n) p.n=n; return p; }
const _ptRec=ps=>({p:ps,by:(typeof CU!=='undefined'&&CU&&CU.name)||'',at:new Date().toISOString()});

async function _ptApply(){
  if(!PT.sel.size){ toast('Tick the entries first','error'); return; }
  const ch={}; PT.sel.forEach(k=>{ const x=PT.lines.find(l=>_ptKey(l)===k); if(x) ch[k]=_ptRec([_ptRead('pa',Math.abs(x.amt))]); });
  try{ await _ptSave(ch); toast('✓ '+Object.keys(ch).length+' entries marked','ok'); PT.sel=new Set(); _ptDraw(); }catch(e){ toast('Not saved: '+e.message,'error'); }
}
async function _ptClear(k){ try{ await _ptSave({[k]:null}); _ptDraw(); }catch(e){ toast('Not saved: '+e.message,'error'); } }

// split / single dialog
function _ptOpen(k){
  const x=PT.lines.find(l=>_ptKey(l)===k); if(!x) return; const tot=Math.abs(x.amt); const ex=(PT.tags[k]&&PT.tags[k].p)||[{t:'cash',a:tot}];
  PT._m={k,tot,n:ex.length,parts:ex};
  document.getElementById('pt-modal').innerHTML=`<div class="mov" style="display:flex;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;align-items:center;justify-content:center"><div class="mbox" style="background:#fff;border-radius:12px;padding:16px;max-width:760px;width:94%;max-height:90vh;overflow:auto">
    <div style="font-weight:800;margin-bottom:4px">${_tlDate(x.d)} · ${_tlE(x.t)} ${_tlE(x.n)} · ₹${_tlN(tot)} ${x.amt<0?'paid':'received'}</div><div style="font-size:11px;color:var(--text3);margin-bottom:10px">${_tlE(x.nar)}</div>
    <div id="ptm-parts">${ex.map((p,i)=>_ptPartHtml(i,p)).join('')}</div>
    <div style="margin:8px 0"><button class="btn btn-sm" onclick="_ptAddPart()">+ Split into another part</button></div>
    <div id="ptm-err" style="color:#c0392b;font-size:12px;min-height:16px"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" onclick="document.getElementById('pt-modal').innerHTML=''">Cancel</button><button class="btn btn-primary" onclick="_ptSaveParts()">Save</button></div></div></div>`;
}
const _ptPartHtml=(i,p)=>`<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px" id="ptm-row${i}">${_ptFieldsHtml('pm'+i,p)}<input id="pm${i}-a" type="number" step="0.01" value="${p.a}" style="width:110px" title="Amount of this part"></div>`;
function _ptAddPart(){ const m=PT._m, i=m.n++; document.getElementById('ptm-parts').insertAdjacentHTML('beforeend',_ptPartHtml(i,{t:'cash',a:0})); }
async function _ptSaveParts(){
  const m=PT._m, ps=[]; for(let i=0;i<m.n;i++){ if(!document.getElementById('pm'+i+'-t')) continue; const a=parseFloat(document.getElementById('pm'+i+'-a').value)||0; if(a<=0) continue; ps.push(_ptRead('pm'+i,a)); }
  const sum=ps.reduce((s,p)=>s+p.a,0), err=document.getElementById('ptm-err');
  if(!ps.length){ err.textContent='Enter at least one amount.'; return; }
  if(Math.abs(sum-m.tot)>1){ err.textContent='The parts add up to ₹'+_tlN(sum)+' but the entry is ₹'+_tlN(m.tot)+'. They must match.'; return; }
  try{ await _ptSave({[m.k]:_ptRec(ps)}); document.getElementById('pt-modal').innerHTML=''; _ptDraw(); toast('✓ Saved','ok'); }catch(e){ err.textContent='Not saved: '+e.message; }
}

// ───────── Excel ─────────
function _ptExcel(){
  if(!_xCheckLibs('xlsx')) return; const base=PT.f.led?PT.lines.filter(x=>x.led===PT.f.led):PT.lines; const T=_ptTotals(base);
  const sumRows=(o)=>{ const r=[]; Object.keys(o).sort().forEach(k=>{ const [t,s]=k.split('|'); r.push([t==='none'?'Not marked yet':(PT_TYPES[t]||t),t==='none'?'':((PT_SUBS[t]||{})[s]||s),_xNum(o[k])]); }); return r; };
  const a1=[['RSR CONSTRUCTIONS'],[PT.cont+' — payment types'],['Generated',_xD(_xToday())],[],['TOTAL PAID (Dr)',_xNum(T.paid)],['TOTAL RECEIVED (Cr)',_xNum(T.rec)],['DIFFERENCE (paid − received)',_xNum(T.paid-T.rec)],[],['PAID OUT BY TYPE'],['Type','Detail','Amount'],...sumRows(T.P),[],['RECEIVED BY TYPE'],['Type','Detail','Amount'],...sumRows(T.R)];
  const a2=[['Date','Voucher','Ledger','Narration','Cost centre','Paid','Received','Type','Detail','Part amount','Supplier','Note']];
  base.forEach(x=>{ const tg=PT.tags[_ptKey(x)]; const ps=(tg&&tg.p&&tg.p.length)?tg.p:[null];
    ps.forEach((p,i)=>a2.push([_xD(x.d),(x.t+' '+x.n).trim(),x.led,x.nar,x.cc,i===0&&x.amt<0?_xNum(-x.amt):'',i===0&&x.amt>0?_xNum(x.amt):'',p?PT_TYPES[p.t]:'Not marked yet',p?((PT_SUBS[p.t]||{})[p.s]||p.s||''):'',p?_xNum(p.a):'',p&&p.u||'',p&&p.n||''])); });
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,_xSheet(a1,[34,30,16]),'Summary'); XLSX.utils.book_append_sheet(wb,_xSheet(a2,[12,14,24,40,22,14,14,22,26,14,18,24]),'Entries'); XLSX.writeFile(wb,_xName(PT.cont+' payment types')+'_'+_xToday()+'.xlsx');
}
