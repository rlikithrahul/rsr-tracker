
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
    .sort((a,b)=>(a.name||'').localeCompare(b.name||''));

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
      p.agreeDate||'—',
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
      p.jvDate||'—',
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
        c?c.name:'—', getSettlementDate(p)||'—',
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
        p.jvDate||'—', getJVNumber(p), getEANumber(p),
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
