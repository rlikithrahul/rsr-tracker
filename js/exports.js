// ═══════════════════════════════════════════════════════
// exports.js — Excel / PDF downloads: Tally statements (ledger, cost centre, contractor, project), interest sheets,
// contractor cost-centre summary, and the one-page-per-project "Project Report" with the RSR logo.
// Read-only: builds files from data already on screen / in the Tally snapshot. Nothing is saved or sent anywhere.
// ═══════════════════════════════════════════════════════

const _xNum = n => Math.round((Number(n)||0)*100)/100;
function _xName(s){ return String(s||'report').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_').slice(0,60)||'report'; }
function _xD(d){ if(!d) return ''; const p=String(d).split('-'); return p.length===3?p[2]+'-'+p[1]+'-'+p[0]:d; }
function _xToday(){ return new Date().toISOString().split('T')[0]; }
function _xP(n){ return (typeof pdfFmt==='function')?pdfFmt(n):('Rs. '+(Number(n)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})); }
function _xPlain(n){ return (Number(n)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function _xCheckLibs(kind){
  if(kind==='xlsx' && typeof XLSX==='undefined'){ toast('Excel library did not load — refresh the page','error'); return false; }
  if(kind==='pdf' && (typeof window.jspdf==='undefined')){ toast('PDF library did not load — refresh the page','error'); return false; }
  return true;
}
function _xSheet(aoa, widths){ const ws=XLSX.utils.aoa_to_sheet(aoa); if(widths) ws['!cols']=widths.map(w=>({wch:w})); return ws; }

// RSR header band (same look as the BOQ PDF)
function _xPdfStart(title, sub, landscape){
  const { jsPDF } = window.jspdf; const doc=new jsPDF({unit:'pt',format:'a4',orientation:landscape?'landscape':'portrait'});
  const W=doc.internal.pageSize.getWidth(); const navy=[26,39,68], gold=[201,168,76];
  doc.setFillColor(...navy); doc.rect(0,0,W,70,'F');
  try{ if(typeof RSR_LOGO_B64!=='undefined') doc.addImage(RSR_LOGO_B64,'PNG',24,10,50,50); }catch(e){}
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.text('RSR CONSTRUCTIONS',86,32);
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(230,230,230); doc.text(String(title||'').toUpperCase(),86,48);
  doc.setTextColor(201,168,76); doc.setFontSize(9); doc.text('Generated '+_xD(_xToday())+(sub?'   |   '+sub:''),86,62);
  doc.setTextColor(20,20,20);
  return {doc,W,navy,gold,y:92};
}
function _xPdfFooter(doc){
  const n=doc.internal.getNumberOfPages(), W=doc.internal.pageSize.getWidth(), H=doc.internal.pageSize.getHeight();
  for(let i=1;i<=n;i++){ doc.setPage(i); doc.setFontSize(8); doc.setTextColor(130,130,130); doc.text('RSR Constructions — figures from Tally and the RSR Tracker. Interest is a calculation, not a posted entry.',40,H-18); doc.text('Page '+i+' of '+n,W-40,H-18,{align:'right'}); }
}
function _xKV(ctx, pairs){ // two-column key/value block
  const {doc}=ctx; doc.setFontSize(9);
  pairs.forEach(([k,v])=>{ doc.setFont('helvetica','bold'); doc.setTextColor(90,90,90); doc.text(String(k),40,ctx.y); doc.setFont('helvetica','normal'); doc.setTextColor(20,20,20);
    const lines=doc.splitTextToSize(String(v==null||v===''?'—':v),ctx.W-210); doc.text(lines,170,ctx.y); ctx.y+=Math.max(13,lines.length*11+2); });
  ctx.y+=4;
}
function _xHead(ctx,t){ const {doc}=ctx; doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...ctx.navy); doc.text(t,40,ctx.y); ctx.y+=6; doc.setTextColor(20,20,20); }

// ───────── Tally statement ─────────
function _xStmtLines(st){
  let bal=Number(st.opening)||0; const out=[]; let dr=0,cr=0;
  (st.rows||[]).forEach(r=>{ const a=Number(r.amount)||0; bal+=a; if(a<0) dr+=-a; else cr+=a;
    out.push({date:r.vch_date,type:r.vch_type||'',no:r.vch_number||'',ledger:r.ledger||r.ledger_name||'',cc:r.cc_name||'',nar:r.narration||r.party_ledger||'',dr:a<0?-a:0,cr:a>0?a:0,bal}); });
  return {lines:out,dr,cr,bal};
}
function tlDownloadStatement(kind){
  const st=TL&&TL.stmt; if(!st){ toast('Open a statement first','error'); return; } if(!_xCheckLibs(kind)) return;
  const s=_xStmtLines(st); const base=_xName(st.title)+'_'+_xToday();
  if(kind==='xlsx'){
    const aoa=[['RSR CONSTRUCTIONS'],[st.title||'Statement'],['Generated',_xD(_xToday())],['Dr = paid out · Cr = received'],[],['Date','Voucher type','Voucher no','Ledger','Cost centre','Narration','Debit','Credit','Balance (Dr -ve / Cr +ve)']];
    if(st.opening!=null) aoa.push([_xD(st.openingDate),'Opening balance','','','','','','',_xNum(st.opening)]);
    s.lines.forEach(l=>aoa.push([_xD(l.date),l.type,l.no,l.ledger,l.cc,l.nar,l.dr?_xNum(l.dr):'',l.cr?_xNum(l.cr):'',_xNum(l.bal)]));
    aoa.push([],['Totals','','','','','',_xNum(s.dr),_xNum(s.cr),_xNum(s.bal)]);
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,_xSheet(aoa,[12,14,12,26,24,40,14,14,18]),'Statement'); XLSX.writeFile(wb,base+'.xlsx');
  } else {
    const c=_xPdfStart('Statement',null,true); const {doc}=c; doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text(String(st.title||''),40,c.y); c.y+=14;
    const body=[]; if(st.opening!=null) body.push([_xD(st.openingDate),'Opening balance','','','','',{content:_xPlain(Math.abs(st.opening))+(st.opening<0?' Dr':' Cr'),styles:{halign:'right'}}]);
    s.lines.forEach(l=>body.push([_xD(l.date),(l.type+' '+l.no).trim(),l.ledger+(l.cc?'\n'+l.cc:''),l.nar,{content:l.dr?_xPlain(l.dr):'',styles:{halign:'right'}},{content:l.cr?_xPlain(l.cr):'',styles:{halign:'right'}},{content:_xPlain(Math.abs(l.bal))+(l.bal<0?' Dr':l.bal>0?' Cr':''),styles:{halign:'right'}}]));
    doc.autoTable({startY:c.y+4,head:[['Date','Voucher','Ledger / cost centre','Narration','Debit','Credit','Balance']],body,
      styles:{font:'helvetica',fontSize:7.5,cellPadding:3.5},headStyles:{fillColor:c.navy,textColor:[255,255,255]},columnStyles:{4:{halign:'right'},5:{halign:'right'},6:{halign:'right'}},alternateRowStyles:{fillColor:[247,248,251]},margin:{left:40,right:40},
      foot:[[{content:'Totals',colSpan:4,styles:{halign:'right'}},{content:_xPlain(s.dr),styles:{halign:'right'}},{content:_xPlain(s.cr),styles:{halign:'right'}},{content:_xPlain(Math.abs(s.bal))+(s.bal<0?' Dr':' Cr'),styles:{halign:'right'}}]],footStyles:{fillColor:c.navy,textColor:[255,255,255]}});
    _xPdfFooter(doc); doc.save(base+'.pdf');
  }
}

// ───────── Interest sheet ─────────
function tlDownloadInterest(kind){
  const li=TL&&TL.lastInt; if(!li){ toast('Calculate interest first','error'); return; } if(!_xCheckLibs(kind)) return;
  const {st,sel,res,asOn,rate,useOpen}=li; const base=_xName(st.title)+'_interest_'+asOn;
  if(kind==='xlsx'){
    const sum=[['RSR CONSTRUCTIONS — INTEREST CALCULATION'],[st.title||''],[],['As on',_xD(asOn)],['Rate',rate+'% per annum, simple daily on the running balance'],['Compounding','Accrued interest added to the principal every 31 March until received'],['Rows used',sel.length+(useOpen?' + opening balance':'')],[],
      ['Principal (incl. compounded interest)',_xNum(res.principal)],['Interest not yet compounded',_xNum(res.accrued)],['Total due',_xNum(res.due)],['Total interest charged',_xNum(res.totalInterest)],[],
      ['Financial year','Interest accrued','Added to principal on 31 Mar','Principal after']];
    res.fy.forEach(f=>sum.push([f.fy,_xNum(f.interest),f.capitalised?_xNum(f.capitalised):'',_xNum(f.endPrincipal)]));
    const tx=[['Date','Voucher','Ledger / cost centre','Narration','Paid out (adds to principal)','Received (reduces principal)']];
    sel.slice().sort((a,b)=>a.vch_date<b.vch_date?-1:1).forEach(r=>{ const a=Number(r.amount)||0; tx.push([_xD(r.vch_date),((r.vch_type||'')+' '+(r.vch_number||'')).trim(),(r.ledger||r.ledger_name||'')+(r.cc_name?' / '+r.cc_name:''),r.narration||'',a<0?_xNum(-a):'',a>0?_xNum(a):'']); });
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,_xSheet(sum,[38,22,28,18]),'Interest'); XLSX.utils.book_append_sheet(wb,_xSheet(tx,[12,18,34,40,22,22]),'Transactions used'); XLSX.writeFile(wb,base+'.xlsx');
  } else {
    const c=_xPdfStart('Interest calculation',null,false); const {doc}=c; doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text(doc.splitTextToSize(String(st.title||''),c.W-80),40,c.y); c.y+=18;
    _xKV(c,[['As on',_xD(asOn)],['Rate',rate+'% a year, simple daily on the running balance'],['Compounding','Interest accrued is added to the principal every 31 March until payment is received'],['Rows used',sel.length+(useOpen?' + opening balance':'')]]);
    _xHead(c,'Result'); doc.autoTable({startY:c.y,body:[['Principal (incl. compounded interest)',_xP(res.principal)],['Interest not yet compounded',_xP(res.accrued)],['Total due',_xP(res.due)],['Total interest charged',_xP(res.totalInterest)]],styles:{fontSize:9,cellPadding:4},columnStyles:{1:{halign:'right',fontStyle:'bold'}},theme:'grid',margin:{left:40,right:40}});
    c.y=doc.lastAutoTable.finalY+16; _xHead(c,'Year by year');
    doc.autoTable({startY:c.y,head:[['Financial year','Interest accrued','Added to principal (31 Mar)','Principal after']],body:res.fy.map(f=>[f.fy,_xP(f.interest),f.capitalised?_xP(f.capitalised):'—',_xP(f.endPrincipal)]),styles:{fontSize:8.5,cellPadding:4},headStyles:{fillColor:c.navy,textColor:[255,255,255]},columnStyles:{1:{halign:'right'},2:{halign:'right'},3:{halign:'right'}},margin:{left:40,right:40}});
    c.y=doc.lastAutoTable.finalY+16; _xHead(c,'Transactions used');
    doc.autoTable({startY:c.y,head:[['Date','Voucher','Ledger / cost centre','Paid out','Received']],body:sel.slice().sort((a,b)=>a.vch_date<b.vch_date?-1:1).map(r=>{ const a=Number(r.amount)||0; return [_xD(r.vch_date),((r.vch_type||'')+' '+(r.vch_number||'')).trim(),(r.ledger||r.ledger_name||'')+(r.cc_name?'\n'+r.cc_name:''),a<0?_xPlain(-a):'',a>0?_xPlain(a):'']; }),styles:{fontSize:7.5,cellPadding:3},headStyles:{fillColor:c.navy,textColor:[255,255,255]},columnStyles:{3:{halign:'right'},4:{halign:'right'}},margin:{left:40,right:40}});
    _xPdfFooter(doc); doc.save(base+'.pdf');
  }
}

// ───────── Contractor cost-centre summary ─────────
// rows: [{name, projects:[{tender,name}], agreement, maxFund, paid, received, net, headroom, n}]
function tlDownloadCCSummary(key, kind){
  const g=(TL._ccSum||{})[key]; if(!g){ toast('Nothing to download','error'); return; } if(!_xCheckLibs(kind)) return;
  const base=_xName('CostCentres_'+g.title)+'_'+_xToday(); const T=g.rows.reduce((a,r)=>({agreement:a.agreement+r.agreement,maxFund:a.maxFund+r.maxFund,paid:a.paid+r.paid,received:a.received+r.received,net:a.net+r.net,headroom:a.headroom+r.headroom}),{agreement:0,maxFund:0,paid:0,received:0,net:0,headroom:0});
  if(kind==='xlsx'){
    const aoa=[['RSR CONSTRUCTIONS — COST CENTRE SUMMARY'],[g.title],['Generated',_xD(_xToday())],['Max fundable = 70% of the linked projects\' agreement amount. Net with RSR = paid out − received. Where a cost centre is shared, its projects\' agreements are added together.'],[],
      ['Cost centre','Projects','Agreement amount','Max fundable (70%)','Deployed (paid out)','Receipts','Net with RSR (closing)','Still fundable','Entries']];
    g.rows.forEach(r=>aoa.push([r.name,r.projects.map(p=>'#'+p.tender+' '+p.name).join('; '),_xNum(r.agreement),_xNum(r.maxFund),_xNum(r.paid),_xNum(r.received),_xNum(r.net),_xNum(r.headroom),r.n]));
    aoa.push([],['TOTAL','',_xNum(T.agreement),_xNum(T.maxFund),_xNum(T.paid),_xNum(T.received),_xNum(T.net),_xNum(T.headroom),'']);
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,_xSheet(aoa,[30,48,18,18,18,16,20,16,8]),'Cost centres'); XLSX.writeFile(wb,base+'.xlsx');
  } else {
    const c=_xPdfStart('Cost centre summary',null,true); const {doc}=c; doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text(String(g.title),40,c.y); c.y+=8;
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(110,110,110); doc.text('Max fundable = 70% of the linked projects\' agreement amount. Net with RSR = paid out - received.',40,c.y+8); doc.setTextColor(20,20,20);
    doc.autoTable({startY:c.y+18,head:[['Cost centre / projects','Agreement','Max fundable (70%)','Deployed','Receipts','Net with RSR','Still fundable']],
      body:g.rows.map(r=>[r.name+(r.projects.length?'\n'+r.projects.map(p=>'#'+p.tender+' '+p.name).join('\n'):''),_xPlain(r.agreement),_xPlain(r.maxFund),_xPlain(r.paid),_xPlain(r.received),_xPlain(r.net),_xPlain(r.headroom)]),
      styles:{fontSize:7.5,cellPadding:3.5},headStyles:{fillColor:c.navy,textColor:[255,255,255]},alternateRowStyles:{fillColor:[247,248,251]},columnStyles:{1:{halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'},5:{halign:'right'},6:{halign:'right'}},margin:{left:40,right:40},
      foot:[['TOTAL',_xPlain(T.agreement),_xPlain(T.maxFund),_xPlain(T.paid),_xPlain(T.received),_xPlain(T.net),_xPlain(T.headroom)]],footStyles:{fillColor:c.navy,textColor:[255,255,255],halign:'right'}});
    _xPdfFooter(doc); doc.save(base+'.pdf');
  }
}

// ───────── Project report PDF ─────────
async function downloadProjectReport(pid){
  const p=GP(pid); if(!p) return; if(!_xCheckLibs('pdf')) return;
  try{ if(typeof setBusy==='function') setBusy(true,'Preparing project report…'); }catch(e){}
  try{
    let snap=null; try{ snap=await tvLoad(); }catch(e){}
    const t=snap&&snap.projects[String(p.tender)];
    const c=GC(p.contractorId)||{}; const sets=(p.settlements||[]).filter(s=>!isArchived(s));
    const state=sets.length?'Check received / settled':(p.jvDate?'Check pending':'Work in progress');
    const dep=totPayments(p), rec=(typeof totReceipts==='function')?totReceipts(p):0, net=totRel(p), max=maxF(p);
    // interest the same way as the Tally Live Interest section: payments add, confirmed settlements reduce, 24% compounded every 31 March
    let ires=null; if(typeof tlInterest==='function'){ const ev=[]; relList(p).filter(r=>r.txType!=='receipt').forEach(r=>ev.push({date:r.date,delta:r.amount})); sets.forEach(s2=>ev.push({date:s2.date,delta:-s2.amount})); if(ev.length) ires=tlInterest(ev,0,ev.map(e=>e.date).sort()[0],_xToday(),24); }
    const ctx=_xPdfStart('Project report',p.tender?'Tender '+p.tender:'',false); const {doc}=ctx;
    doc.setFont('helvetica','bold'); doc.setFontSize(13); const nl=doc.splitTextToSize(p.name||'—',ctx.W-80); doc.text(nl,40,ctx.y); ctx.y+=nl.length*16+4;
    _xKV(ctx,[['Tender ID',p.tender],['EA number',typeof getEANumber==='function'?getEANumber(p):''],['Gen code',typeof getGenCode==='function'?getGenCode(p):''],['Firm',p.firm||'RSR Constructions'],['Contractor',c.name],['Type / location',[p.type,p.location].filter(Boolean).join(' · ')],['Status',(p.status||'active')+' — '+state],
      ['Agreement amount',_xP(agAmt(p))],['Max fundable (70%)',_xP(max)],['JV',p.jvDate?(_xD(p.jvDate)+(p.jvNumber?'  #'+p.jvNumber:'')+(p.jvAmount?'  '+_xP(p.jvAmount):'')):'—']]);
    _xHead(ctx,'Money summary');
    const mrows=[['Deployed (paid out to contractor)',_xP(dep)],['Received back / settled',_xP(rec)],['Net with RSR',_xP(net)],['Cap used',max>0?Math.round(net/max*100)+'%':'—']];
    if(ires) mrows.push(['Interest charged so far (24%, compounded)',_xP(ires.totalInterest)],['Principal incl. compounded interest',_xP(ires.principal)],['Total due today (principal + interest)',_xP(ires.due)]);
    if(t) mrows.push(['Tally: paid / received (this project\'s share)',_xP(t.paid)+'  /  '+_xP(t.received)]);
    doc.autoTable({startY:ctx.y,body:mrows,theme:'grid',styles:{fontSize:9,cellPadding:4},columnStyles:{0:{cellWidth:230,fontStyle:'bold'},1:{halign:'right'}},margin:{left:40,right:40}});
    ctx.y=doc.lastAutoTable.finalY+14;
    if(sets.length){ _xHead(ctx,'Settlements / checks received');
      doc.autoTable({startY:ctx.y,head:[['Date','Amount','Mode','Reference','Notes']],body:sets.map(s=>[_xD(s.date),_xP(s.amount),s.mode||'',s.ref||'',s.notes||'']),styles:{fontSize:8,cellPadding:3.5},headStyles:{fillColor:ctx.navy,textColor:[255,255,255]},columnStyles:{1:{halign:'right'}},margin:{left:40,right:40}}); ctx.y=doc.lastAutoTable.finalY+14; }
    // transactions: Tally when linked (all entries), else the app's fund releases
    _xHead(ctx,t?'Transactions (from Tally)':'Fund releases (from the app)');
    const rows=t?t.tx.map(x=>[_xD(x.d),(x.t+' '+x.n).trim(),(x.led||'')+(x.cc?'\n'+x.cc:''),x.nar||'',x.amt<0?_xPlain(-x.amt)+(x.sh>1?'\n(1/'+x.sh+' share)':''):'',x.amt>0?_xPlain(x.amt)+(x.sh>1?'\n(1/'+x.sh+' share)':''):'']):
      relList(p).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(r=>[_xD(r.date),(r.method||'')+' '+(r.ref||''),r.costCentre||'',r.notes||'',r.txType==='receipt'?'':_xPlain(r.amount),r.txType==='receipt'?_xPlain(r.amount):'']);
    doc.autoTable({startY:ctx.y,head:[['Date','Voucher','Ledger / cost centre','Narration','Paid out','Received']],body:rows.length?rows:[['','','No transactions','','','']],styles:{fontSize:7.5,cellPadding:3},headStyles:{fillColor:ctx.navy,textColor:[255,255,255]},alternateRowStyles:{fillColor:[247,248,251]},columnStyles:{4:{halign:'right'},5:{halign:'right'}},margin:{left:40,right:40}});
    ctx.y=doc.lastAutoTable.finalY+14;
    if(ires){ _xHead(ctx,'Interest year by year (24%, compounded every 31 March)');
      doc.autoTable({startY:ctx.y,head:[['Financial year','Interest accrued','Added to principal','Principal after']],body:ires.fy.map(f=>[f.fy,_xP(f.interest),f.capitalised?_xP(f.capitalised):'—',_xP(f.endPrincipal)]),styles:{fontSize:8.5,cellPadding:4},headStyles:{fillColor:ctx.navy,textColor:[255,255,255]},columnStyles:{1:{halign:'right'},2:{halign:'right'},3:{halign:'right'}},margin:{left:40,right:40},
        foot:[['Total due today',{content:_xP(ires.due),colSpan:3,styles:{halign:'right'}}]],footStyles:{fillColor:ctx.navy,textColor:[255,255,255]}}); }
    _xPdfFooter(doc); doc.save(_xName('Project_Report_'+(p.tender||'')+'_'+p.name)+'_'+_xToday()+'.pdf');
  }catch(e){ console.error(e); toast('Could not build the report: '+e.message,'error'); }
  finally{ try{ if(typeof setBusy==='function') setBusy(false); }catch(e){} }
}
