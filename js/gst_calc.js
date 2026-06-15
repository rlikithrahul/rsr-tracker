// ═══════════════════════════════════════════════════════
// gst_calc.js — RSR Constructions Tracker
// GST Settlement Calculator — Super Admin only
// FULLY MANUAL — no links to projects, transactions or credits
// Likith enters everything himself to verify calculations
// ═══════════════════════════════════════════════════════

// ─── GST MATH (from real JV analysis) ─────────────────
// Gross includes 18% GST
// Base = Gross / 1.18
// CGST TDS = 1% of Base (Code 206) — RSR keeps 100%
// SGST TDS = 1% of Base (Code 207) — RSR keeps 100%
// 16% GST cash = included in net payment
// Contractor has ZERO claim on 2% TDS

function calcGSTFromGross(gross){
  const base = gross / 1.18;
  const gst18 = gross - base;
  const cgstTDS = base * 0.01;
  const sgstTDS = base * 0.01;
  const tds2pct = cgstTDS + sgstTDS;
  const gst16cash = gst18 - tds2pct;
  return {
    base: Math.round(base),
    gst18: Math.round(gst18),
    cgstTDS: Math.round(cgstTDS),
    sgstTDS: Math.round(sgstTDS),
    tds2pct: Math.round(tds2pct),
    gst16cash: Math.round(gst16cash)
  };
}

// ─── SPLIT OPTIMIZER ──────────────────────────────────
// Given list of {name, gst16cash}, find best assignment
// where RSR = targetMin–targetMax % of total 16% GST
function optimizeSplit(rows, minPct, maxPct){
  const total = rows.reduce((s,r)=>s+r.gst16cash, 0);
  if(!total) return null;
  const n = Math.min(rows.length, 20);
  let best = { diff: Infinity, rsrIdx: [] };

  for(let mask=0; mask<(1<<n); mask++){
    let rsrTotal = 0;
    const rsrIdx = [];
    for(let i=0;i<n;i++){
      if(mask&(1<<i)){ rsrTotal+=rows[i].gst16cash; rsrIdx.push(i); }
    }
    const pct = rsrTotal/total;
    const midTarget = (minPct+maxPct)/2;
    if(pct>=minPct && pct<=maxPct){
      const diff = Math.abs(pct-midTarget);
      if(diff<best.diff){ best={diff,rsrIdx,rsrPct:pct}; }
    }
  }
  // fallback: closest to midpoint
  if(best.diff===Infinity){
    for(let mask=0; mask<(1<<n); mask++){
      let rsrTotal=0; const rsrIdx=[];
      for(let i=0;i<n;i++){
        if(mask&(1<<i)){ rsrTotal+=rows[i].gst16cash; rsrIdx.push(i); }
      }
      const pct=rsrTotal/total;
      const diff=Math.abs(pct-(minPct+maxPct)/2);
      if(diff<best.diff){ best={diff,rsrIdx,rsrPct:pct}; }
    }
  }
  return { rsrIdx: best.rsrIdx, rsrPct: best.rsrPct||0, total };
}

// ─── STATE ────────────────────────────────────────────
let _calcRows = []; // [{id, name, gross, matInvoice}]
let _calcCommPct = 6;
let _calcMinPct = 30;
let _calcMaxPct = 35;
let _calcRowId = 0;

function renderGSTCalc(){
  if(!CU||!CU.isSuperAdmin){
    document.getElementById('sec-gst-calc').innerHTML =
      '<div class="wrap"><div class="empty"><div class="empty-icon">🔒</div><div class="empty-text">Access restricted to Super Admin only.</div></div></div>';
    return;
  }
  const el = document.getElementById('sec-gst-calc');
  if(!el) return;

  el.innerHTML = `<div class="wrap">
    <div class="pg-hdr">
      <div>
        <div class="pg-title">🧮 GST Settlement Calculator
          <span style="font-size:11px;background:#7c3aed;color:#fff;padding:2px 10px;border-radius:8px;font-weight:700;vertical-align:middle;margin-left:8px">SUPER ADMIN ONLY</span>
        </div>
        <div style="font-size:12px;color:var(--text3)">Manual calculator — enter values yourself. No links to any project data.</div>
      </div>
    </div>

    <!-- Settings -->
    <div class="card" style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Settings</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;align-items:end">
        <div class="fg">
          <label>Material Commission %</label>
          <input type="number" id="gc-comm" value="${_calcCommPct}" min="0" max="20" step="0.5"
            style="width:100%;box-sizing:border-box;padding:8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px">
        </div>
        <div class="fg">
          <label>RSR Target Min %</label>
          <input type="number" id="gc-min" value="${_calcMinPct}" min="10" max="50" step="1"
            style="width:100%;box-sizing:border-box;padding:8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px">
        </div>
        <div class="fg">
          <label>RSR Target Max %</label>
          <input type="number" id="gc-max" value="${_calcMaxPct}" min="10" max="50" step="1"
            style="width:100%;box-sizing:border-box;padding:8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px">
        </div>
        <div style="display:flex;align-items:flex-end">
          <button class="btn btn-navy" onclick="gcApplySettings()" style="width:100%">Apply</button>
        </div>
      </div>
    </div>

    <!-- Project rows -->
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">Projects / Bills</div>
        <button onclick="gcAddRow()" style="background:var(--navy);color:#fff;border:none;border-radius:var(--rs);padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">+ Add Project</button>
      </div>

      <!-- Table header -->
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 40px;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase">
        <div>Project / Bill Name</div>
        <div>Gross Amount (₹)</div>
        <div>Mat. Invoice on RSR (₹)</div>
        <div></div>
      </div>
      <div id="gc-rows">
        ${_calcRows.length===0?'<div style="font-size:13px;color:var(--text3);padding:16px 0;text-align:center">No projects added yet. Click + Add Project.</div>':''}
      </div>
    </div>

    <!-- Results -->
    <div id="gc-results"></div>
  </div>`;

  gcRenderRows();
  if(_calcRows.length>0) gcCalculate();
}

function gcApplySettings(){
  _calcCommPct = parseFloat(document.getElementById('gc-comm')?.value)||6;
  _calcMinPct = parseFloat(document.getElementById('gc-min')?.value)||30;
  _calcMaxPct = parseFloat(document.getElementById('gc-max')?.value)||35;
  if(_calcRows.length>0) gcCalculate();
}

function gcAddRow(){
  _calcRowId++;
  _calcRows.push({ id:_calcRowId, name:'', gross:0, matInvoice:0 });
  gcRenderRows();
}

function gcRemoveRow(id){
  _calcRows = _calcRows.filter(r=>r.id!==id);
  gcRenderRows();
  if(_calcRows.length>0) gcCalculate();
  else document.getElementById('gc-results').innerHTML='';
}

function gcRenderRows(){
  const el = document.getElementById('gc-rows');
  if(!el) return;
  if(_calcRows.length===0){
    el.innerHTML='<div style="font-size:13px;color:var(--text3);padding:16px 0;text-align:center">No projects added yet. Click + Add Project.</div>';
    return;
  }
  el.innerHTML = _calcRows.map(r=>`
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 40px;gap:8px;padding:8px 0;border-bottom:1px solid var(--surface2);align-items:center" id="gcrow-${r.id}">
      <input type="text" placeholder="Project name" value="${r.name}"
        onchange="gcUpdateRow(${r.id},'name',this.value)"
        style="padding:7px 10px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px;width:100%;box-sizing:border-box">
      <input type="number" placeholder="0" value="${r.gross||''}"
        onchange="gcUpdateRow(${r.id},'gross',parseFloat(this.value)||0)"
        style="padding:7px 10px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px;width:100%;box-sizing:border-box;text-align:right">
      <input type="number" placeholder="0" value="${r.matInvoice||''}"
        onchange="gcUpdateRow(${r.id},'matInvoice',parseFloat(this.value)||0)"
        style="padding:7px 10px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px;width:100%;box-sizing:border-box;text-align:right">
      <button onclick="gcRemoveRow(${r.id})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:18px;padding:4px">🗑️</button>
    </div>`).join('');
}

function gcUpdateRow(id, field, val){
  const row = _calcRows.find(r=>r.id===id);
  if(row) row[field]=val;
}

function gcCalculate(){
  gcApplySettings();

  const el = document.getElementById('gc-results');
  if(!el) return;

  const rows = _calcRows.filter(r=>r.gross>0);
  if(!rows.length){
    el.innerHTML='<div style="font-size:13px;color:var(--text3);text-align:center;padding:20px">Enter gross amounts to see calculations.</div>';
    return;
  }

  // Calculate GST for each row
  const computed = rows.map(r=>{
    const g = calcGSTFromGross(r.gross);
    const commission = Math.round(r.matInvoice * (_calcCommPct/100));
    return { ...r, ...g, commission };
  });

  // Totals
  const totGross = computed.reduce((s,r)=>s+r.gross,0);
  const totBase = computed.reduce((s,r)=>s+r.base,0);
  const totGST18 = computed.reduce((s,r)=>s+r.gst18,0);
  const totTDS = computed.reduce((s,r)=>s+r.tds2pct,0);
  const tot16 = computed.reduce((s,r)=>s+r.gst16cash,0);
  const totMatInv = computed.reduce((s,r)=>s+(r.matInvoice||0),0);
  const totComm = computed.reduce((s,r)=>s+r.commission,0);

  // Split optimizer
  const split = optimizeSplit(computed, _calcMinPct/100, _calcMaxPct/100);
  const rsrRows = split ? computed.filter((_,i)=>split.rsrIdx.includes(i)) : [];
  const contrRows = split ? computed.filter((_,i)=>!split.rsrIdx.includes(i)) : computed;
  const rsrGST = rsrRows.reduce((s,r)=>s+r.gst16cash,0);
  const contrGST = contrRows.reduce((s,r)=>s+r.gst16cash,0);
  const rsrPct = split ? Math.round(split.rsrPct*1000)/10 : 0;
  const contrPct = Math.round((1-split.rsrPct)*1000)/10;

  el.innerHTML = `
  <!-- Summary -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:16px">
    ${[
      {l:'Total Gross',v:fmt(totGross),c:'var(--navy)'},
      {l:'Total GST 18%',v:fmt(totGST18),c:'var(--navy)'},
      {l:'2% TDS → RSR keeps',v:fmt(totTDS),c:'var(--green)'},
      {l:'16% GST (cash)',v:fmt(tot16),c:'#7c3aed'},
      {l:'Mat. Commission owed',v:fmt(totComm),c:'var(--amber)'},
    ].map(x=>`<div class="card" style="text-align:center;padding:12px;border-top:3px solid ${x.c}">
      <div style="font-size:10px;color:var(--text3);margin-bottom:4px;text-transform:uppercase;font-weight:700">${x.l}</div>
      <div style="font-size:17px;font-weight:800;color:${x.c}">${x.v}</div>
    </div>`).join('')}
  </div>

  <!-- Per-project breakdown -->
  <div class="card" style="margin-bottom:16px">
    <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">Per-Project GST Breakdown</div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:700px">
        <thead>
          <tr style="background:var(--navy);color:#fff">
            <th style="padding:8px 10px;text-align:left">Project</th>
            <th style="padding:8px 10px;text-align:right">Gross</th>
            <th style="padding:8px 10px;text-align:right">Base (÷1.18)</th>
            <th style="padding:8px 10px;text-align:right">GST 18%</th>
            <th style="padding:8px 10px;text-align:right;color:#86efac">2% TDS (RSR)</th>
            <th style="padding:8px 10px;text-align:right;color:#c4b5fd">16% GST Cash</th>
            <th style="padding:8px 10px;text-align:right">Mat Invoice</th>
            <th style="padding:8px 10px;text-align:right">Commission ${_calcCommPct}%</th>
          </tr>
        </thead>
        <tbody>
          ${computed.map((r,i)=>`<tr style="background:${i%2?'var(--surface2)':'#fff'}">
            <td style="padding:7px 10px">${r.name||'Project '+(i+1)}</td>
            <td style="padding:7px 10px;text-align:right">${fmt(r.gross)}</td>
            <td style="padding:7px 10px;text-align:right;color:var(--text3)">${fmt(r.base)}</td>
            <td style="padding:7px 10px;text-align:right">${fmt(r.gst18)}</td>
            <td style="padding:7px 10px;text-align:right;font-weight:700;color:var(--green)">${fmt(r.tds2pct)}</td>
            <td style="padding:7px 10px;text-align:right;font-weight:700;color:#7c3aed">${fmt(r.gst16cash)}</td>
            <td style="padding:7px 10px;text-align:right">${r.matInvoice?fmt(r.matInvoice):'—'}</td>
            <td style="padding:7px 10px;text-align:right;color:var(--amber);font-weight:700">${r.commission?fmt(r.commission):'—'}</td>
          </tr>`).join('')}
          <tr style="background:var(--navy);color:#fff;font-weight:700">
            <td style="padding:8px 10px">TOTAL</td>
            <td style="padding:8px 10px;text-align:right">${fmt(totGross)}</td>
            <td style="padding:8px 10px;text-align:right">${fmt(totBase)}</td>
            <td style="padding:8px 10px;text-align:right">${fmt(totGST18)}</td>
            <td style="padding:8px 10px;text-align:right">${fmt(totTDS)}</td>
            <td style="padding:8px 10px;text-align:right">${fmt(tot16)}</td>
            <td style="padding:8px 10px;text-align:right">${fmt(totMatInv)}</td>
            <td style="padding:8px 10px;text-align:right">${fmt(totComm)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- GST Split -->
  <div class="card" style="margin-bottom:16px;border-left:4px solid #7c3aed">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div style="font-size:14px;font-weight:700">🧮 Optimal GST Split</div>
      <div style="display:flex;gap:8px">
        <span style="font-size:12px;background:#7c3aed22;color:#7c3aed;padding:3px 10px;border-radius:10px;font-weight:700">RSR: ${rsrPct}%</span>
        <span style="font-size:12px;background:#e8f5e9;color:var(--green);padding:3px 10px;border-radius:10px;font-weight:700">Contractor: ${contrPct}%</span>
      </div>
    </div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px">Target: RSR ${_calcMinPct}–${_calcMaxPct}%. Best project-level assignment found by calculator.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="background:#e8edf8;border-radius:var(--rs);padding:12px">
        <div style="font-size:12px;font-weight:800;color:var(--navy);margin-bottom:8px">🏢 RSR Files</div>
        ${rsrRows.length ? rsrRows.map(r=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 8px;background:#fff;border-radius:4px;margin-bottom:4px">
          <span style="color:var(--navy);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.name||'—'}</span>
          <span style="font-weight:700;color:var(--navy);margin-left:8px">${fmt(r.gst16cash)}</span>
        </div>`).join('')+`<div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px;text-align:right;font-size:13px;font-weight:800;color:var(--navy)">${fmt(rsrGST)}</div>`
        : '<div style="font-size:12px;color:var(--text3)">None</div>'}
      </div>
      <div style="background:#f0fdf4;border-radius:var(--rs);padding:12px">
        <div style="font-size:12px;font-weight:800;color:var(--green);margin-bottom:8px">👷 Contractor Files</div>
        ${contrRows.length ? contrRows.map(r=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 8px;background:#fff;border-radius:4px;margin-bottom:4px">
          <span style="color:var(--navy);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.name||'—'}</span>
          <span style="font-weight:700;color:var(--navy);margin-left:8px">${fmt(r.gst16cash)}</span>
        </div>`).join('')+`<div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px;text-align:right;font-size:13px;font-weight:800;color:var(--green)">${fmt(contrGST)}</div>`
        : '<div style="font-size:12px;color:var(--text3)">None</div>'}
      </div>
    </div>
  </div>

  <!-- Material adjustment -->
  ${totMatInv>0?`<div class="card" style="border-left:4px solid var(--amber)">
    <div style="font-size:14px;font-weight:700;margin-bottom:8px">🧱 Material Input Adjustment</div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:#fffbeb;border-radius:var(--rs)">
      <div>
        <div style="font-size:13px;font-weight:700">Total material invoices on RSR's name</div>
        <div style="font-size:11px;color:var(--text3)">Commission owed to contractor @ ${_calcCommPct}% of invoice amount</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:16px;font-weight:800;color:var(--amber)">${fmt(totMatInv)}</div>
        <div style="font-size:14px;font-weight:800;color:var(--red)">Owe: ${fmt(totComm)}</div>
      </div>
    </div>
  </div>`:''}

  <!-- Calculate button -->
  <div style="margin-top:14px;text-align:center">
    <button onclick="gcCalculate()" style="background:var(--navy);color:#fff;border:none;border-radius:var(--rs);padding:10px 28px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">🔄 Recalculate</button>
    <button onclick="gcClear()" style="background:none;border:1px solid var(--border);border-radius:var(--rs);padding:10px 20px;font-size:12px;cursor:pointer;font-family:'Inter',sans-serif;color:var(--text3);margin-left:8px">Clear All</button>
  </div>`;
}

function gcClear(){
  _calcRows = [];
  _calcRowId = 0;
  renderGSTCalc();
}
