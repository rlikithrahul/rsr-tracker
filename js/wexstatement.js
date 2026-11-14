// ═══════════════════════════════════════════════════════
// wexstatement.js — Word statements for tenders (from the Work Experience finders)
//
//  • Find by Value    → "Details of similar (civil) works completed … last ten financial years"
//                       Pre-filled: Sl. No, Name of the work, Total Value Of Work Done. The five
//                       columns in between are left empty to be completed in Word.
//  • Find by Quantity → "Physical quantities executed by the Tenderer …"
//                       Pre-filled: Sl. No, Financial year, Name of work, one column per quantity
//                       asked. Agreement No. is left empty. A project ticked under two quantities
//                       gets both columns; one ticked under one quantity gets only that column.
//  • Both end with the signature of the tenderer under the table, and are asked about the
//    firm's digital letterhead when the download is pressed.
//  • Built as a real .docx with the same builder the letters use (letters.js / letterhead.js).
// ═══════════════════════════════════════════════════════

const WXS_FONT = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>';
function wxsRun(text, o){
  o = o || {}; const sz = o.sz || 24;
  return String(text==null?'':text).split('\n').map((ln,i)=>`<w:r><w:rPr>${WXS_FONT}${o.b?'<w:b/>':''}${o.u?'<w:u w:val="single"/>':''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>${i?'<w:br/>':''}<w:t xml:space="preserve">${xmlEsc(ln)}</w:t></w:r>`).join('');
}
function wxsP(text, o){
  o = o || {};
  return `<w:p><w:pPr>${o.keep?'<w:keepNext/>':''}<w:spacing w:before="${o.before||0}" w:after="${o.after==null?120:o.after}"/><w:jc w:val="${o.jc||'left'}"/></w:pPr>${wxsRun(text,o)}</w:p>`;
}
// cells: [{t, span, b, jc}] per row; widths: grid column widths (twips)
function wxsTable(widths, rows, headerRows){
  const total = widths.reduce((a,b)=>a+b,0);
  const trs = rows.map((cells, ri)=>{
    let col = 0;
    const tcs = cells.map(c=>{
      const span = c.span || 1; const w = widths.slice(col, col+span).reduce((a,b)=>a+b,0); col += span;
      return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span>1?`<w:gridSpan w:val="${span}"/>`:''}<w:vAlign w:val="center"/></w:tcPr>${wxsP(c.t, {sz:c.sz||17, b:c.b, jc:c.jc||'center', before:30, after:30})}</w:tc>`;
    }).join('');
    return `<w:tr><w:trPr><w:cantSplit/>${ri<(headerRows||1)?'<w:tblHeader/>':''}</w:trPr>${tcs}</w:tr>`;
  }).join('');
  const bd = ['top','left','bottom','right','insideH','insideV'].map(k=>`<w:${k} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:tblBorders>${bd}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="60" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${trs}</w:tbl>`;
}
function wxsScale(base, avail){ const t = base.reduce((a,b)=>a+b,0); const w = base.map(x=>Math.floor(x*avail/t)); w[w.length-1] += avail - w.reduce((a,b)=>a+b,0); return w; }
function wxsNum(n){ return String(Number(Number(n||0).toFixed(2))); }       // 10573.81 · 57348 (no thousands commas, like the tender format)
function wxsName(x){
  const gc = String((x.rec&&x.rec.genCode)||'').trim(), nm = String((x.project&&x.project.name)||(x.rec&&x.rec.projectName)||'').trim();
  if(gc && nm) return nm.toLowerCase().startsWith(gc.toLowerCase()) ? nm : gc+'\n'+nm;
  return gc || nm || '—';
}
function wxsFyNum(a){ const m = String(a||'').match(/^(\d{4})/); return m ? +m[1] : 0; }

let _wxsSt = {variant:'none', address:false};   // stamp choice (Super Admin only)
async function _wxsChoose(firm){
  const key = lhKeyFor(firm), lhName = (LH_SETS[key] && LH_SETS[key].name) || firm;
  _wxsSt = {variant:'none', address:false};
  let stHtml = '';
  if(stAllowed()){ try{ await stAvailable(); }catch(e){} stHtml = stPickerHTML('wxs', key, '', _wxsSt); }
  const pr = tlModal('Download the statement',
    `<div>Put it on the <strong>${xmlEsc(lhName)}</strong> letterhead, or a plain A4 page?</div><div style="font-size:12px;color:var(--text3);margin-top:6px">It downloads as a Word file either way — you can still edit it. The letterhead is the firm this experience belongs to.</div>${stHtml}`,
    [{label:'Cancel', value:null}, {label:'Plain A4 page', value:'plain'}, {label:'On the letterhead', value:'digital', primary:true}]);
  const d = document.getElementById('tl-modal');
  if(d) d.addEventListener('click', e=>{ if(e.target.closest && e.target.closest('button[data-i]')) _wxsSt = stChoice('wxs'); }, true);
  return pr;
}
async function _wxsBuild(firm, makeBody, fileBase){
  const mode = await _wxsChoose(firm); if(!mode) return false;
  const key = lhKeyFor(firm), margins = lhMargins(key, mode);
  const avail = 11906 - margins.left - margins.right;
  let stBlk = null;
  try{ stBlk = stDocxBlock(await stResolve(key, _wxsSt), avail); }
  catch(e){ console.error(e); toast('Stamp could not be added — nothing was downloaded. '+e.message,'error',7000); return false; }
  const docx = buildDOCX(makeBody(avail, stBlk ? stBlk.xml + '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>' : ''), margins);
  if(stBlk) docx.stamps = stBlk.media;
  if(mode==='digital'){
    try{ docx.letterhead = await lhDocxPackage(key); }
    catch(e){ console.error(e); toast('Letterhead could not be loaded — nothing was downloaded. '+e.message,'error',7000); return false; }
  }
  triggerDownload(docx, fileBase.replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim()+'.docx');
  return true;
}

// ── Find by Value ──
async function wxsValueStatement(m, fy, kind){
  const rows = m.selRows.slice().sort((a,b)=>String(a.rec.genCode||'').localeCompare(String(b.rec.genCode||'')));
  const total = rows.reduce((s,x)=>s+x.total,0);
  const heading = `Details of ${kind==='civil'?'civil':'similar'} works completed in the name of the Tenderer during the last Ten financial years. ${fy||''}`;
  const rs = n => 'Rs '+wxfN(n)+'/-';
  const ok = await _wxsBuild(m.firm, (avail, stampXml)=>{
    const w = wxsScale([450,2250,1150,1150,1050,1150,1150,1350], avail);
    const head = ['Sl.\nNo.','Name of the work','Address of agreement concluding authority','Agreement number and date','Value of contract','Stipulated period of completion','Actual date of completion','Total Value Of Work Done ('+(fy||'')+')'].map(t=>({t,b:true}));
    const body = rows.map((x,i)=>[{t:String(i+1)},{t:wxsName(x),jc:'left'},{t:''},{t:''},{t:''},{t:''},{t:''},{t:rs(x.total),b:true}]);
    const tot = [{t:'Total Value Of Work Done ('+(fy||'')+')',span:7,b:true,jc:'right'},{t:rs(total),b:true}];
    return wxsP(heading,{b:true,after:160}) + wxsTable(w,[head,...body,tot],1) + wxsP('',{after:200}) + (stampXml||'') + wxsP('Signature of the Tenderer',{b:true,jc:'right',before:stampXml?40:480,after:0});
  }, m.firm+' - Statement of similar works - FY '+(fy||''));
  if(ok){
    toast('✓ Statement downloaded — fill the empty columns in Word','ok');
    try{ logActivity({category:'system', action:'wex_statement_downloaded', description:(CU?CU.name:'')+' downloaded the similar-works statement: FY '+fy+', '+rows.length+' work(s) ('+m.firm+')'}); }catch(e){}
  }
}

// ── Find by Quantity ── (ms = the quantity blocks that have ticked projects)
async function wxsQtyStatement(ms){
  const firm = ms[0].firm;
  const cols = ms.map(m=>({m, label:m.active.map(a=>a.label).join(' + '), unit:wxfUnit(m.unit), byId:new Map(m.selRows.map(x=>[x.id,x]))}));
  // one row per ticked project record, whatever number of quantities it was ticked under
  const rowMap = new Map();
  cols.forEach(c=>c.m.selRows.forEach(x=>{ if(!rowMap.has(x.id)) rowMap.set(x.id, x); }));
  const rows = [...rowMap.values()].sort((a,b)=> wxsFyNum(a.fy)-wxsFyNum(b.fy) || String(a.rec.genCode||'').localeCompare(String(b.rec.genCode||'')));
  const cell = (c,x)=>{ const h=c.byId.get(x.id); return h ? wxsNum(h.total)+' '+c.unit : ''; };
  const totals = cols.map(c=>c.m.selRows.reduce((s,x)=>s+x.total,0));
  const ok = await _wxsBuild(firm, (avail, stampXml)=>{
    const base = [540,1095,3765,1590, ...cols.map(()=>1500)];
    const w = wxsScale(base, avail);
    const head = [{t:'Sl.\nNo',b:true},{t:'Financial year',b:true},{t:'Name of work',b:true},{t:'Agt.\nNo',b:true}, ...cols.map(c=>({t:c.label,b:true}))];
    const nums = head.map((_,i)=>({t:String(i+1)}));
    const body = rows.map((x,i)=>[{t:String(i+1)},{t:String(x.fy||'')},{t:wxsName(x),jc:'left'},{t:''}, ...cols.map(c=>({t:cell(c,x),b:true}))]);
    const tot = [{t:'Total',span:4,b:true,jc:'right'}, ...cols.map((c,i)=>({t:wxsNum(totals[i])+' '+c.unit,b:true}))];
    return wxsP('Physical quantities executed by the Tenderer in the last ten financial years. [work wise/year wise].',{b:true,after:160})
      + wxsTable(w,[head,nums,...body,tot],2)
      + wxsP('Attach certificates in support of the above quantities issued by the Executive Engineer concerned and countersigned by the Superintending Engineer duly showing the quantities executed year wise.',{before:200,after:200})
      + (stampXml||'') + wxsP('Signature of the Tenderer',{b:true,jc:'right',before:stampXml?40:480,after:0});
  }, firm+' - Statement of physical quantities - '+cols.map(c=>c.label).join(' + '));
  if(ok){
    toast('✓ Statement downloaded — fill the empty columns in Word','ok');
    try{ logActivity({category:'system', action:'wex_statement_downloaded', description:(CU?CU.name:'')+' downloaded the physical-quantities statement: '+cols.map(c=>c.label+' FY '+c.m.bk.fy).join('; ')+', '+rows.length+' row(s) ('+firm+')'}); }catch(e){}
  }
}
