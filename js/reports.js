
// ─── FIRMS ────────────────────────────────────────────
const FIRMS = ['RSR Constructions', 'R Sadhu Rao', 'R Likith Rahul'];
function getProjectFirm(p){ return p.firm || 'RSR Constructions'; }

// ═══════════════════════════════════════════════════════
// reports.js — RSR Constructions Tracker v21d
// Five exportable reports using SheetJS (XLSX)
// ═══════════════════════════════════════════════════════

// ─── HELPERS ──────────────────────────────────────────
function getFYFromDate(dateStr){
  if(!dateStr) return null;
  const d = new Date(dateStr);
  const month = d.getMonth(); // 0=Jan, 3=Apr
  const year = d.getFullYear();
  const fyStart = month >= 3 ? year : year - 1;
  return `${fyStart}-${String(fyStart+1).slice(-2)}`;
}

function fmtAmt(n){
  if(!n || n===0) return '0';
  return Number(n).toLocaleString('en-IN');
}

function getGenCode(p){
  return p.genCode || (p.docVault && p.docVault.gencode) || '—';
}

function getEANumber(p){
  return p.eaNumber || (p.docVault && p.docVault.ea) || '—';
}

function getJVNumber(p){
  return p.jvNumber || '—';
}

function getSettlementDate(p){
  const settlements = (p.settlements||[]).filter(s=>!isArchived(s));
  if(!settlements.length) return null;
  return settlements.slice(-1)[0].date || null;
}

function getAmountReceived(p){
  const settlements = (p.settlements||[]).filter(s=>!isArchived(s));
  return settlements.reduce((s,x)=>s+x.amount,0);
}

// ─── MAIN EXPORT FUNCTION ─────────────────────────────
async function exportReport(){
  // Load SheetJS if not already loaded
  if(!window.XLSX){
    try{
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    }catch(e){
      toast('Failed to load export library. Check internet connection.','error',4000);
      return;
    }
  }

  const type = document.getElementById('report-type-select').value;
  const fy   = document.getElementById('report-fy-select').value;

  let wb, filename;

  switch(type){
    case 'running':
      wb = buildRunningWorks();
      filename = `RSR_Running_Works_${new Date().toISOString().split('T')[0]}.xlsx`;
      break;
    case 'checkpending':
      wb = buildCheckPending();
      filename = `RSR_Check_Pending_${new Date().toISOString().split('T')[0]}.xlsx`;
      break;
    case 'checkreceived':
      wb = buildCheckReceived();
      filename = `RSR_Check_Received_${new Date().toISOString().split('T')[0]}.xlsx`;
      break;
    case 'jvsheet':
      wb = buildJVSheet(fy);
      filename = `RSR_JV_Sheet_${fy==='all'?'AllYears':fy}_${new Date().toISOString().split('T')[0]}.xlsx`;
      break;
    case 'checkreceivedfy':
      wb = buildCheckReceivedFY(fy);
      filename = `RSR_CheckReceived_${fy==='all'?'AllYears':fy}_${new Date().toISOString().split('T')[0]}.xlsx`;
      break;
    case 'tobeagreement':
      wb = buildToBeAgreement();
      filename = `RSR_ToBeAgreement_${new Date().toISOString().split('T')[0]}.xlsx`;
      break;
    default:
      toast('Select a report type','error');
      return;
  }

  window.XLSX.writeFile(wb, filename);
  toast(`✅ ${filename} downloaded`,'ok',3000);
}

// ─── STYLE HELPERS ────────────────────────────────────
function headerStyle(){
  return {
    font:{bold:true, color:{rgb:'FFFFFF'}, sz:11},
    fill:{fgColor:{rgb:'1A2744'}},
    alignment:{horizontal:'center', vertical:'center', wrapText:true},
    border:{bottom:{style:'medium',color:{rgb:'C9A84C'}}}
  };
}
function altRowStyle(i){
  return i%2===0
    ? {fill:{fgColor:{rgb:'F4F6FA'}}, alignment:{vertical:'center'}}
    : {fill:{fgColor:{rgb:'FFFFFF'}}, alignment:{vertical:'center'}};
}
function amtStyle(i){
  return {
    ...(i%2===0?{fill:{fgColor:{rgb:'F4F6FA'}}}:{fill:{fgColor:{rgb:'FFFFFF'}}}),
    numFmt:'#,##0',
    alignment:{horizontal:'right', vertical:'center'}
  };
}
function titleStyle(){
  return {
    font:{bold:true, sz:14, color:{rgb:'1A2744'}},
    alignment:{horizontal:'left'}
  };
}

function makeSheet(headers, rows, title){
  const ws = {};
  const range = {s:{r:0,c:0}, e:{r:rows.length+2, c:headers.length-1}};

  // Title row
  ws[window.XLSX.utils.encode_cell({r:0,c:0})] = {
    v: title, t:'s',
    s: titleStyle()
  };
  ws[window.XLSX.utils.encode_cell({r:1,c:0})] = {
    v: `Generated: ${new Date().toLocaleDateString('en-IN')} | RSR Constructions`,
    t:'s',
    s:{font:{sz:9,color:{rgb:'888888'}}}
  };

  // Header row (row 3, index 2)
  headers.forEach((h,c)=>{
    ws[window.XLSX.utils.encode_cell({r:2,c})] = {v:h, t:'s', s:headerStyle()};
  });

  // Data rows
  rows.forEach((row,r)=>{
    row.forEach((val,c)=>{
      const isAmt = typeof val === 'number';
      ws[window.XLSX.utils.encode_cell({r:r+3,c})] = {
        v: val===null||val===undefined?'—':val,
        t: isAmt?'n':'s',
        s: isAmt ? amtStyle(r) : altRowStyle(r)
      };
    });
  });

  range.e.r = rows.length + 2;
  ws['!ref'] = window.XLSX.utils.encode_range(range);

  // Column widths
  ws['!cols'] = headers.map((_,i)=>({wch: i===0?6:i===1?45:i<=3?25:18}));

  // Freeze header rows
  ws['!freeze'] = {xSplit:0, ySplit:3, topLeftCell:'A4', activePane:'bottomLeft'};

  return ws;
}

// ─── SHEET 1: RUNNING WORKS ───────────────────────────
// Projects with NO JV date — still in execution
function buildRunningWorks(){
  const projects = D.projects
    .filter(p=>!isArchived(p) && !p.jvDate)
    .sort((a,b)=>{
      // Agreement date ascending — earliest agreement first.
      // Projects with no agreement date yet go to the bottom (still pending agreement).
      if(!a.agreeDate && !b.agreeDate) return (a.createdAt||'').localeCompare(b.createdAt||'');
      if(!a.agreeDate) return 1;
      if(!b.agreeDate) return -1;
      return a.agreeDate.localeCompare(b.agreeDate);
    });

  const headers = [
    'Sl No','Firm','Project Name','Tender ID','Contractor',
    'Agreement Date','Agreement Amount','Bid %',
    'Max Fundable (70%)','Total Deployed','Cap Used %','Status'
  ];

  const rows = projects.map((p,i)=>{
    const c = GC(p.contractorId);
    const rel = totRel(p);
    const max = maxF(p);
    const cap = max>0?Math.round(rel/max*100):0;
    const agAmt = agAmt_calc(p);
    return [
      i+1,
      getProjectFirm(p),
      p.name||'—',
      p.tender||'—',
      c?c.name:'—',
      fmtDate(p.agreeDate),
      agAmt||0,
      `${p.bidPct||0}%`,
      max||0,
      rel||0,
      `${cap}%`,
      (p.status||'active').toUpperCase()
    ];
  });

  const ws = makeSheet(headers, rows, 'RUNNING WORKS — RSR CONSTRUCTIONS');
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Running Works');
  return wb;
}

function agAmt_calc(p){
  return Math.round((p.estimated||0) * (1+(p.bidPct||0)/100));
}

// ─── SHEET 2: CHECK PENDING ───────────────────────────
// Projects with JV date but NO settlement
function buildCheckPending(){
  const projects = D.projects
    .filter(p=>!isArchived(p) && p.jvDate && !(p.settlements||[]).filter(s=>!isArchived(s)).length)
    .sort((a,b)=>(a.jvDate||'').localeCompare(b.jvDate||''));

  const headers = [
    'Sl No','Firm','Project Name','Tender ID','Gen Code','Contractor',
    'JV Date','JV Number','EA Number','EMD (₹)','ASD (₹)','FSD (₹)','JV Amount (₹)'
  ];

  const rows = projects.map((p,i)=>{
    const c = GC(p.contractorId);
    return [
      i+1,
      getProjectFirm(p),
      p.name||'—',
      p.tender||'—',
      getGenCode(p),
      c?c.name:'—',
      fmtDate(p.jvDate),
      getJVNumber(p),
      getEANumber(p),
      p.emd||0,
      p.asd||0,
      p.fsd||0,
      p.jvAmount||0
    ];
  });

  const ws = makeSheet(headers, rows, 'CHECK PENDING — RSR CONSTRUCTIONS');
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Check Pending');
  return wb;
}

// ─── SHEET 3: CHECK RECEIVED (3 sub-sheets by firm) ──
function buildCheckReceived(){
  const headers = [
    'Sl No','Project Name','Tender ID','Gen Code','Contractor',
    'Check Received Date','JV Amount (₹)','Amount Received (₹)'
  ];

  const wb = window.XLSX.utils.book_new();

  FIRMS.forEach(firm=>{
    const projects = D.projects
      .filter(p=>!isArchived(p) && getProjectFirm(p)===firm &&
        (p.settlements||[]).filter(s=>!isArchived(s)).length>0)
      .sort((a,b)=>(getSettlementDate(a)||'').localeCompare(getSettlementDate(b)||''));

    const rows = projects.map((p,i)=>{
      const c = GC(p.contractorId);
      return [
        i+1, p.name||'—', p.tender||'—', getGenCode(p),
        c?c.name:'—', fmtDate(getSettlementDate(p)),
        p.jvAmount||0, getAmountReceived(p)||0
      ];
    });

    const sheetName = firm==='RSR Constructions'?'RSR Constructions':
                      firm==='R Sadhu Rao'?'R Sadhu Rao':'R Likith Rahul';
    const ws = makeSheet(headers, rows, `CHECK RECEIVED — ${firm.toUpperCase()}`);
    window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  return wb;
}

// ─── SHEET 4: YEAR-WISE JV SHEET (3 sub-sheets) ──────
function buildJVSheet(fyFilter){
  const headers = [
    'Sl No','Project Name','Tender ID','Gen Code','Contractor',
    'Financial Year','JV Date','JV Number','EA Number',
    'EMD (₹)','ASD (₹)','FSD (₹)','JV Amount (₹)'
  ];

  const wb = window.XLSX.utils.book_new();

  FIRMS.forEach(firm=>{
    let projects = D.projects
      .filter(p=>!isArchived(p) && p.jvDate && getProjectFirm(p)===firm)
      .sort((a,b)=>(a.jvDate||'').localeCompare(b.jvDate||''));

    if(fyFilter && fyFilter!=='all'){
      projects = projects.filter(p=>getFYFromDate(p.jvDate)===fyFilter);
    }

    const rows = projects.map((p,i)=>{
      const c = GC(p.contractorId);
      return [
        i+1, p.name||'—', p.tender||'—', getGenCode(p),
        c?c.name:'—', getFYFromDate(p.jvDate)||'—',
        fmtDate(p.jvDate), getJVNumber(p), getEANumber(p),
        p.emd||0, p.asd||0, p.fsd||0, p.jvAmount||0
      ];
    });

    const fyLabel = fyFilter&&fyFilter!=='all'?`FY ${fyFilter}`:'All Years';
    const ws = makeSheet(headers, rows, `JV SHEET — ${firm.toUpperCase()} — ${fyLabel}`);
    const sheetName = firm==='RSR Constructions'?'RSR Constructions':
                      firm==='R Sadhu Rao'?'R Sadhu Rao':'R Likith Rahul';
    window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  return wb;
}

// ─── SHEET 5: YEAR-WISE CHECK RECEIVED (3 sub-sheets) ─
function buildCheckReceivedFY(fyFilter){
  const headers = [
    'Sl No','Project Name','Tender ID','Gen Code','Contractor',
    'Financial Year','Check Received Date','Amount Received (₹)'
  ];

  const wb = window.XLSX.utils.book_new();

  FIRMS.forEach(firm=>{
    let projects = D.projects
      .filter(p=>!isArchived(p) && getProjectFirm(p)===firm &&
        (p.settlements||[]).filter(s=>!isArchived(s)).length>0)
      .sort((a,b)=>(getSettlementDate(a)||'').localeCompare(getSettlementDate(b)||''));

    if(fyFilter && fyFilter!=='all'){
      projects = projects.filter(p=>getFYFromDate(getSettlementDate(p))===fyFilter);
    }

    const rows = projects.map((p,i)=>{
      const c = GC(p.contractorId);
      const settleDate = getSettlementDate(p);
      return [
        i+1, p.name||'—', p.tender||'—', getGenCode(p),
        c?c.name:'—', getFYFromDate(settleDate)||'—',
        settleDate||'—', getAmountReceived(p)||0
      ];
    });

    const fyLabel = fyFilter&&fyFilter!=='all'?`FY ${fyFilter}`:'All Years';
    const ws = makeSheet(headers, rows, `CHECK RECEIVED — ${firm.toUpperCase()} — ${fyLabel}`);
    const sheetName = firm==='RSR Constructions'?'RSR Constructions':
                      firm==='R Sadhu Rao'?'R Sadhu Rao':'R Likith Rahul';
    window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  return wb;
}

// ─── SHEET 6: TO BE AGREEMENT ─────────────────────────
// Projects where agreement date is NOT set AND status is not completed
// (completed projects already have a JV — agreement is implicitly done,
// even if the exact agreement date wasn't recorded for old/imported projects)
function buildToBeAgreement(){
  const projects = D.projects
    .filter(p=>!isArchived(p) && !p.agreeDate && p.status!=='completed')
    .sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));

  const headers = [
    'Sl No','Firm','Project Name','Tender ID','Contractor','Status','Created Date'
  ];

  const rows = projects.map((p,i)=>{
    const c = GC(p.contractorId);
    return [
      i+1, getProjectFirm(p), p.name||'—', p.tender||'—',
      c?c.name:'—', (p.status||'active').toUpperCase(),
      fmtDate(p.createdAt)
    ];
  });

  const ws = makeSheet(headers, rows, 'TO BE AGREEMENT — RSR CONSTRUCTIONS');
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'To Be Agreement');
  return wb;
}

// ─── VIEW REPORT IN APP ───────────────────────────────
function closeReportModal(){ CM('modal-report-view'); }

function viewReport(){
  const type = document.getElementById('report-type-select').value;
  const fy = document.getElementById('report-fy-select').value;

  let modal = document.getElementById('modal-report-view');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'mov';
    modal.id = 'modal-report-view';
    document.body.appendChild(modal);
  }

  if(!type){ toast('Please select a report type first','error'); return; }
  const data = getReportData(type, fy);
  if(!data){ toast('No data for this report','error'); return; }

  const { title, headers, rows } = data;

  // Identify amount columns
  const amtCols = new Set(headers.map((h,i)=>h.includes('₹')?i:-1).filter(i=>i>=0));

  // Project name lookup for clickable links
  const projNameMap = {};
  (D.projects||[]).forEach(p=>{ if(p.name) projNameMap[p.name]=p.id; });

  // Format a single cell
  const fmtCell = (v,i) => {
    if(typeof v === 'number'){
      if(amtCols.has(i)) return v===0?'₹0':'<strong>₹'+Number(v).toLocaleString('en-IN')+'</strong>';
      return String(v);
    }
    const str = String(v||'—');
    if(i===2 && projNameMap[str]){
      return '<span class="rpt-proj-link" data-pid="'+projNameMap[str]+'" style="color:var(--navy);font-weight:600;cursor:pointer;text-decoration:underline">'+str+'</span>';
    }
    return str;
  };

  // Format a row
  const fmtRow = (r,idx) => {
    return r.map((v,i)=>{
      const isAmt = typeof v==='number' && amtCols.has(i);
      const isSlNo = i===0;
      let style = 'padding:10px 12px;font-size:12px;border-bottom:1px solid var(--surface2);';
      if(isAmt) style += 'text-align:right;font-weight:700;color:var(--navy);white-space:nowrap;';
      if(isSlNo) style += 'color:var(--text3);width:40px;';
      return '<td style="'+style+'">'+fmtCell(v,i)+'</td>';
    }).join('');
  };

  // Calculate totals
  const totals = headers.map((_,i)=>{
    if(!amtCols.has(i)) return null;
    return rows.reduce((s,r)=>s+(typeof r[i]==='number'?r[i]:0),0);
  });
  const hasTotals = totals.some(t=>t!==null&&t>0);

  // Build HTML using string concatenation — no nested template literals
  let html = '';

  // Header bar
  html += '<div class="mbox" style="max-width:98vw;width:1100px;max-height:92vh;display:flex;flex-direction:column">';
  html += '<div style="background:var(--navy);padding:14px 18px;border-radius:var(--rs) var(--rs) 0 0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;flex-shrink:0">';
  html += '<div>';
  html += '<div style="font-size:16px;font-weight:700;color:#fff">'+title+'</div>';
  html += '<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:2px">'+rows.length+' record'+(rows.length!==1?'s':'')+' · '+fmtDate(new Date().toISOString())+' · RSR Constructions</div>';
  html += '</div>';
  html += '<div style="display:flex;gap:8px;align-items:center">';
  html += '<button onclick="exportReport()" style="background:var(--gold);color:var(--navy);border:none;border-radius:var(--rs);padding:7px 14px;font-weight:700;font-size:12px;cursor:pointer">⬇ Export Excel</button>';
  html += '<button class="mx" onclick="closeReportModal()" style="color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2)">✕</button>';
  html += '</div></div>';

  // Summary bar
  if(hasTotals){
    html += '<div style="background:var(--surface2);padding:10px 18px;display:flex;gap:20px;flex-wrap:wrap;border-bottom:1px solid var(--border);flex-shrink:0">';
    totals.forEach((t,i)=>{
      if(t!==null&&t>0){
        html += '<div style="font-size:12px"><span style="color:var(--text3)">'+headers[i].replace(' (₹)','')+': </span><strong style="color:var(--navy)">₹'+Number(t).toLocaleString('en-IN')+'</strong></div>';
      }
    });
    html += '</div>';
  }

  // Table area
  html += '<div style="overflow:auto;flex:1;padding:0">';

  if(rows.length){
    html += '<table style="width:100%;border-collapse:collapse;min-width:500px">';

    // Header row
    html += '<thead><tr style="background:var(--navy);position:sticky;top:0;z-index:1">';
    headers.forEach(h=>{
      html += '<th style="padding:10px 12px;font-size:11px;font-weight:700;color:rgba(255,255,255,.9);text-align:left;white-space:nowrap;border-right:1px solid rgba(255,255,255,.1)">'+h+'</th>';
    });
    html += '</tr></thead>';

    // Data rows
    html += '<tbody>';
    rows.forEach((r,i)=>{
      const bg = i%2===0?'#fff':'#f8f9fc';
      html += '<tr style="background:'+bg+'" onmouseover="this.style.background=\'#eef2ff\'" onmouseout="this.style.background=\''+bg+'\'">' + fmtRow(r,i) + '</tr>';
    });
    html += '</tbody>';

    // Totals footer
    if(hasTotals){
      html += '<tfoot><tr style="background:var(--navy);position:sticky;bottom:0">';
      totals.forEach((t,i)=>{
        let style = 'padding:10px 12px;font-size:12px;font-weight:800;border-top:2px solid var(--gold);';
        style += t!==null?'color:var(--gold);text-align:right;':'color:rgba(255,255,255,.5);';
        const val = i===0?'TOTAL':(t!==null&&t>0?'₹'+Number(t).toLocaleString('en-IN'):'');
        html += '<td style="'+style+'">'+val+'</td>';
      });
      html += '</tr></tfoot>';
    }

    html += '</table>';
  } else {
    html += '<div style="padding:40px;text-align:center;color:var(--text3)">';
    html += '<div style="font-size:32px;margin-bottom:12px">📋</div>';
    html += '<div style="font-size:14px;font-weight:600">No records found</div>';
    html += '<div style="font-size:12px;margin-top:6px">Try changing the filter or financial year</div>';
    html += '</div>';
  }

  html += '</div></div>';

  modal.innerHTML = html;
  modal.classList.add('open');

  // Wire clickable project links
  modal.querySelectorAll('.rpt-proj-link').forEach(el=>{
    el.addEventListener('click',()=>{
      CM('modal-report-view');
      openProjectFromAlert(el.dataset.pid);
    });
  });
}


// ─── GET REPORT DATA (shared between view and export) ─
function getReportData(type, fy){
  let title, headers, rows;

  switch(type){
    case 'running':
      title = 'Running Works';
      headers = ['Sl No','Firm','Project Name','Tender ID','Contractor','Agreement Date','Agreement Amount','Bid %','Max Fundable (70%)','Total Deployed','Cap Used %','Status'];
      rows = D.projects.filter(p=>!isArchived(p)&&!p.jvDate)
        .sort((a,b)=>{
          if(!a.agreeDate && !b.agreeDate) return (a.createdAt||'').localeCompare(b.createdAt||'');
          if(!a.agreeDate) return 1;
          if(!b.agreeDate) return -1;
          return a.agreeDate.localeCompare(b.agreeDate);
        })
        .map((p,i)=>{
          const c=GC(p.contractorId),rel=totRel(p),max=maxF(p);
          return [i+1,getProjectFirm(p),p.name||'—',p.tender||'—',c?c.name:'—',fmtDate(p.agreeDate),agAmt_calc(p)||0,`${p.bidPct||0}%`,max||0,rel||0,max>0?`${Math.round(rel/max*100)}%`:'0%',(p.status||'active').toUpperCase()];
        });
      break;

    case 'checkpending':
      title = 'Check Pending';
      headers = ['Sl No','Firm','Project Name','Tender ID','Gen Code','Contractor','JV Date','JV Number','EA Number','EMD (₹)','ASD (₹)','FSD (₹)','JV Amount (₹)'];
      rows = D.projects.filter(p=>!isArchived(p)&&p.jvDate&&!(p.settlements||[]).filter(s=>!isArchived(s)).length)
        .sort((a,b)=>(a.jvDate||'').localeCompare(b.jvDate||''))
        .map((p,i)=>{
          const c=GC(p.contractorId);
          return [i+1,getProjectFirm(p),p.name||'—',p.tender||'—',getGenCode(p),c?c.name:'—',fmtDate(p.jvDate),getJVNumber(p),getEANumber(p),p.emd||0,p.asd||0,p.fsd||0,p.jvAmount||0];
        });
      break;

    case 'checkreceived':
      title = 'Check Received';
      headers = ['Sl No','Firm','Project Name','Tender ID','Gen Code','Contractor','Check Received Date','JV Amount (₹)','Amount Received (₹)'];
      rows = D.projects.filter(p=>!isArchived(p)&&(p.settlements||[]).filter(s=>!isArchived(s)).length>0)
        .sort((a,b)=>(getSettlementDate(a)||'').localeCompare(getSettlementDate(b)||''))
        .map((p,i)=>{
          const c=GC(p.contractorId);
          return [i+1,getProjectFirm(p),p.name||'—',p.tender||'—',getGenCode(p),c?c.name:'—',fmtDate(getSettlementDate(p)),p.jvAmount||0,getAmountReceived(p)||0];
        });
      break;

    case 'tobeagreement':
      title = 'To Be Agreement';
      headers = ['Sl No','Firm','Project Name','Tender ID','Contractor','Status','Created Date'];
      rows = D.projects.filter(p=>!isArchived(p)&&!p.agreeDate&&p.status!=='completed')
        .sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''))
        .map((p,i)=>{
          const c=GC(p.contractorId);
          return [i+1,getProjectFirm(p),p.name||'—',p.tender||'—',c?c.name:'—',(p.status||'active').toUpperCase(),fmtDate(p.createdAt)];
        });
      break;

    case 'jvsheet':
    case 'checkreceivedfy':
      title = type==='jvsheet'?`Year-wise JV Sheet${fy!=='all'?' — '+fy:''}`:`Year-wise Check Received${fy!=='all'?' — '+fy:''}`;
      headers = type==='jvsheet'
        ? ['Sl No','Firm','Project Name','Tender ID','Gen Code','Contractor','FY','JV Date','JV Number','EA Number','EMD (₹)','ASD (₹)','FSD (₹)','JV Amount (₹)']
        : ['Sl No','Firm','Project Name','Tender ID','Gen Code','Contractor','FY','Check Received Date','Amount Received (₹)'];
      let projs = type==='jvsheet'
        ? D.projects.filter(p=>!isArchived(p)&&p.jvDate)
        : D.projects.filter(p=>!isArchived(p)&&(p.settlements||[]).filter(s=>!isArchived(s)).length>0);
      if(fy!=='all') projs = projs.filter(p=>getFYFromDate(type==='jvsheet'?p.jvDate:getSettlementDate(p))===fy);
      rows = projs.sort((a,b)=>{
        const da = type==='jvsheet'?a.jvDate:getSettlementDate(a);
        const db = type==='jvsheet'?b.jvDate:getSettlementDate(b);
        return (da||'').localeCompare(db||'');
      }).map((p,i)=>{
        const c=GC(p.contractorId);
        const fy_val = type==='jvsheet'?getFYFromDate(p.jvDate):getFYFromDate(getSettlementDate(p));
        return type==='jvsheet'
          ? [i+1,getProjectFirm(p),p.name||'—',p.tender||'—',getGenCode(p),c?c.name:'—',fy_val,fmtDate(p.jvDate),getJVNumber(p),getEANumber(p),p.emd||0,p.asd||0,p.fsd||0,p.jvAmount||0]
          : [i+1,getProjectFirm(p),p.name||'—',p.tender||'—',getGenCode(p),c?c.name:'—',fy_val,fmtDate(getSettlementDate(p)),getAmountReceived(p)||0];
      });
      break;

    default: return null;
  }
  return { title, headers, rows };
}
