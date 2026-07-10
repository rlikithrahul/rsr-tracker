// ═══════════════════════════════════════════════════════
// meeting.js — RSR Weekly Board Meeting
// ═══════════════════════════════════════════════════════

const MEETING_KEY = 'rsr_meetings_v1';

// ─── LOAD / SAVE ─────────────────────────────────────
async function loadMeetings(){
  if(D.meetings) return D.meetings;
  try{
    const rows = await sbReq('settings?key=eq.'+MEETING_KEY,'GET');
    if(rows&&rows.length&&rows[0].value) D.meetings = JSON.parse(rows[0].value);
  }catch(e){}
  if(!D.meetings) D.meetings = [];
  return D.meetings;
}
async function saveMeetings(){
  await sbReq('settings','POST',{key:MEETING_KEY, value:JSON.stringify(D.meetings||[])});
}

// ─── MAIN TAB RENDER ─────────────────────────────────
async function renderMeeting(){
  const el = document.getElementById('sec-meeting');
  if(!el) return;
  if(!CU){
    el.innerHTML='<div class="wrap"><div class="empty"><div class="empty-icon">🔒</div><div class="empty-text">Please log in.</div></div></div>';
    return;
  }
  el.innerHTML='<div class="wrap"><div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading…</div></div>';
  await loadMeetings();
  _renderMeetingList(el);
}

function _renderMeetingList(el){
  const meetings = (D.meetings||[]).sort((a,b)=>b.date.localeCompare(a.date));
  const canEdit = CU&&CU.isSuperAdmin;

  el.innerHTML = `<div class="wrap">
    <div class="pg-hdr">
      <div>
        <div class="pg-title">📋 Board Meetings</div>
        <div style="font-size:12px;color:var(--text3)">${meetings.length} meeting${meetings.length!==1?'s':''} recorded · Click any meeting to view or add notes</div>
      </div>
      ${canEdit?`<button onclick="startNewMeeting()" style="background:var(--navy);color:#fff;border:none;border-radius:var(--rs);padding:9px 18px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">+ New Meeting</button>`:''}
    </div>

    ${meetings.length===0?`<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">No meetings yet.<br>Click "+ New Meeting" to create one with live project data.</div></div>`:''}

    <div style="display:flex;flex-direction:column;gap:10px">
      ${meetings.map(m=>`
        <div onclick="openMeeting('${m.id}')" style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px" onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,.08)'" onmouseout="this.style.boxShadow=''">
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--navy)">${m.title||'Meeting — '+fmtDate(m.date)}</div>
            <div style="font-size:12px;color:var(--text3);margin-top:3px">${fmtDate(m.date)} · ${m.attendees||'—'}</div>
            ${m.summary?`<div style="font-size:12px;color:var(--text2);margin-top:4px;max-width:500px">${m.summary.substring(0,120)}${m.summary.length>120?'…':''}</div>`:''}
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
            <span style="font-size:11px;background:var(--surface2);padding:3px 10px;border-radius:8px">${Object.keys(m.notes||{}).length} section${Object.keys(m.notes||{}).length!==1?'s':''} with notes</span>
            <span style="font-size:18px;color:var(--text3)">→</span>
          </div>
        </div>`).join('')}
    </div>
  </div>`;
}

// ─── START NEW MEETING ────────────────────────────────
async function startNewMeeting(){
  const today = new Date().toISOString().split('T')[0];
  const title = prompt('Meeting title (e.g. "Weekly Review — Jul 2026"):', `Weekly Review — ${new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'})}`);
  if(!title) return;
  const attendees = prompt('Attendees (e.g. "Likith, Ramu, Satya"):', '');

  const meeting = {
    id: 'mtg_'+uid(),
    date: today,
    title: title.trim(),
    attendees: attendees?.trim()||'',
    createdAt: new Date().toISOString(),
    createdBy: CU?.name||'Likith',
    notes: {},
    snapshot: await _buildMeetingSnapshot(),
  };

  if(!D.meetings) D.meetings=[];
  D.meetings.unshift(meeting);
  try{
    await saveMeetings();
    openMeeting(meeting.id);
  }catch(e){ toast('Failed to save meeting','error'); }
}

// ─── BUILD LIVE SNAPSHOT ─────────────────────────────
async function _buildMeetingSnapshot(){
  const today = new Date();
  const projects = D.projects.filter(p=>!isArchived(p));

  // Last meeting date (for "since last meeting" calculations)
  const prevMeeting = (D.meetings||[])[0];
  const sinceDate = prevMeeting ? new Date(prevMeeting.date) : new Date(today.getTime() - 30*86400000);
  const sinceDateStr = sinceDate.toISOString().split('T')[0];

  // JVs received since last meeting
  const jvsReceived = projects.filter(p=>p.jvDate && p.jvDate > sinceDateStr);

  // EA numbers received since last meeting
  const easReceived = projects.filter(p=>{
    if(!p.eaNumber && !(p.documents&&p.documents.ea)) return false;
    // Use EA date if available, else approximate from JV date
    return p.eaDate ? p.eaDate > sinceDateStr : false;
  });

  // Payments received since last meeting
  const paymentsReceived = [];
  projects.forEach(p=>{
    (p.settlements||[]).filter(s=>!isArchived(s)&&s.date>sinceDateStr).forEach(s=>{
      paymentsReceived.push({project:p, settlement:s});
    });
  });

  // Projects over 70% cap
  const overCap = projects.filter(p=>{
    const max=maxF(p); if(!max) return false;
    return totRel(p)/max >= 0.7;
  }).sort((a,b)=>{
    const pctA=totRel(a)/maxF(a), pctB=totRel(b)/maxF(b);
    return pctB-pctA;
  });

  // Action Centre summary
  const stageData = _buildStageData(projects, today);

  // Expected JVs this month
  const thisKey = today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0');
  const nextDate = new Date(today.getFullYear(), today.getMonth()+1, 1);
  const nextKey = nextDate.getFullYear()+'-'+String(nextDate.getMonth()+1).padStart(2,'0');
  const expectedThis = projects.filter(p=>p.expectedJVMonth&&!p.jvDate&&projStatus(p)!=='completed'&&(p.expectedJVMonth===thisKey||p.expectedJVMonth<thisKey));
  const expectedNext = projects.filter(p=>p.expectedJVMonth&&!p.jvDate&&projStatus(p)!=='completed'&&p.expectedJVMonth===nextKey);

  // Long-pending items
  const longPendingJV = projects.filter(p=>p.jvDate&&!p.eaNumber&&!(p.documents&&p.documents.ea)).map(p=>({
    project:p, days:Math.round((today-new Date(p.jvDate))/86400000)
  })).filter(x=>x.days>60).sort((a,b)=>b.days-a.days);

  // WEX pending
  await loadWEXData().catch(()=>{});
  const wexPending = projects.filter(p=>{
    if(!p.wecReceived) return false;
    const wecDoc=(p.documents||{}).wec;
    if(!wecDoc) return false;
    const gc=(getGenCode(p)||'').toUpperCase();
    return !(D.wexData?.records||[]).some(r=>r.projectId===p.id||(gc&&r.genCode===gc));
  });

  // Financial overview
  const totalDeployed = projects.reduce((s,p)=>s+totRel(p),0);
  const totalSettled = projects.reduce((s,p)=>s+(p.settlements||[]).filter(x=>!isArchived(x)).reduce((s2,x)=>s2+x.amount,0),0);
  const totalOutstanding = Math.max(0, totalDeployed-totalSettled);

  return {
    generatedAt: new Date().toISOString(),
    sinceDate: sinceDateStr,
    jvsReceived: jvsReceived.map(p=>({id:p.id,name:p.name,jvDate:p.jvDate,jvAmount:p.jvAmount,contractor:GC(p.contractorId)?.name||'—'})),
    paymentsReceived: paymentsReceived.map(x=>({projectId:x.project.id,projectName:x.project.name,amount:x.settlement.amount,date:x.settlement.date})),
    overCap: overCap.map(p=>({id:p.id,name:p.name,pct:Math.round(totRel(p)/maxF(p)*100),deployed:totRel(p),max:maxF(p)})),
    actionSummary: stageData,
    expectedThis: expectedThis.map(p=>({id:p.id,name:p.name,contractor:GC(p.contractorId)?.name||'—',agreeAmt:agAmt(p)})),
    expectedNext: expectedNext.map(p=>({id:p.id,name:p.name,contractor:GC(p.contractorId)?.name||'—',agreeAmt:agAmt(p)})),
    longPendingJV: longPendingJV.map(x=>({id:x.project.id,name:x.project.name,days:x.days,jvDate:x.project.jvDate})),
    wexPending: wexPending.map(p=>({id:p.id,name:p.name,contractor:GC(p.contractorId)?.name||'—'})),
    financials: {totalDeployed, totalSettled, totalOutstanding},
  };
}

function _buildStageData(projects, today){
  const counts = {
    completed_no_jv:0, jv_incomplete:0, asd_ea_pending:0, ea_pending:0,
    asd_to_apply:0, wec_to_apply:0, wec_applied:0, wex_pending:0,
    payment_pending:0, gst_pending:0, emd_overdue:0, emd_to_apply:0
  };
  projects.forEach(p=>{
    const hasJV=!!p.jvDate, hasEA=!!(p.eaNumber||(p.documents&&p.documents.ea));
    const hasPayment=(p.settlements||[]).filter(s=>!isArchived(s)).length>0;
    const asdEligible=Math.abs(p.bidPct||0)>25;
    if(!hasJV&&projStatus(p)==='completed'){counts.completed_no_jv++;return;}
    if(!hasJV) return;
    if(!p.jvNumber||!p.jvAmount) counts.jv_incomplete++;
    if(asdEligible&&!p.asdRefundReceived&&!hasEA){counts.asd_ea_pending++;return;}
    if(!hasEA){counts.ea_pending++;return;}
    if((p.asd||0)>0&&!p.asdRefundApplied&&!p.asdRefundReceived) counts.asd_to_apply++;
    if(!p.wecReceived&&!p.wecApplied) counts.wec_to_apply++;
    else if(!p.wecReceived&&p.wecApplied) counts.wec_applied++;
    if(p.wecReceived&&!hasPayment) counts.payment_pending++;
    if(hasPayment&&!p.gstFiled) counts.gst_pending++;
    if(p.jvDate){
      const t=new Date(p.jvDate);t.setFullYear(t.getFullYear()+2);
      const d=Math.round((t-today)/86400000);
      if(d<=0&&!p.refundReceived&&!p.refundApplied) counts.emd_overdue++;
      else if(d<=90&&d>0&&!p.refundReceived&&!p.refundApplied) counts.emd_to_apply++;
    }
  });
  return counts;
}

// ─── OPEN MEETING DETAIL ─────────────────────────────
function openMeeting(id){
  const m = (D.meetings||[]).find(x=>x.id===id);
  if(!m) return;
  const el = document.getElementById('sec-meeting');
  if(!el) return;

  const sn = m.snapshot||{};
  const canEdit = CU&&CU.isSuperAdmin;

  const sections = [
    {key:'action_overview', title:'⚡ Action Centre Overview', content:_renderActionOverview(sn)},
    {key:'jvs_received',    title:'📋 JVs Received Since Last Meeting', content:_renderJVsReceived(sn)},
    {key:'expected_jvs',    title:'📅 Expected JVs', content:_renderExpectedJVs(sn)},
    {key:'cap_watch',       title:'🔴 Cap Usage — Projects Over 70%', content:_renderCapWatch(sn)},
    {key:'long_pending',    title:'⏱ Long-Pending Items', content:_renderLongPending(sn)},
    {key:'payments',        title:'💰 Payments Received Since Last Meeting', content:_renderPayments(sn)},
    {key:'wex_status',      title:'📐 Work Experience Status', content:_renderWEXStatus(sn)},
    {key:'financials',      title:'📊 Financial Overview', content:_renderFinancialOverview(sn)},
  ];

  el.innerHTML = `<div class="wrap">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <button onclick="renderMeeting()" style="background:none;border:1px solid var(--border);border-radius:var(--rs);padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif">← All Meetings</button>
      <div style="display:flex;gap:8px">
        <button onclick="printMeeting('${m.id}')" style="background:var(--navy);color:#fff;border:none;border-radius:var(--rs);padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">🖨️ Print / PDF</button>
        ${canEdit?`<button onclick="deleteMeeting('${m.id}')" style="background:none;border:1px solid var(--red);border-radius:var(--rs);padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;color:var(--red);font-family:'Inter',sans-serif">🗑️ Delete</button>`:''}
      </div>
    </div>

    <!-- Header -->
    <div style="background:var(--navy);border-radius:12px;padding:20px;margin-bottom:16px;color:#fff">
      <div style="font-size:22px;font-weight:800;margin-bottom:6px">${m.title}</div>
      <div style="font-size:13px;opacity:.8">${fmtDate(m.date)} · Attendees: ${m.attendees||'—'} · Created by ${m.createdBy||'—'}</div>
      ${sn.sinceDate?`<div style="font-size:12px;opacity:.65;margin-top:4px">Data covers: ${fmtDate(sn.sinceDate)} → ${fmtDate(m.date)}</div>`:''}
    </div>

    <!-- Meeting summary notes -->
    <div class="card" style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">📝 Meeting Summary / Overall Notes</div>
      ${canEdit
        ? `<textarea id="mtg-summary" rows="3" onchange="saveMeetingNote('${m.id}','summary',this.value)"
            style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px;resize:vertical"
            placeholder="Overall meeting notes, decisions made, next steps…">${m.summary||''}</textarea>`
        : `<div style="font-size:13px;color:var(--text2);white-space:pre-wrap">${m.summary||'No summary recorded.'}</div>`
      }
    </div>

    <!-- Sections -->
    ${sections.map(s=>`
      <div class="card" style="margin-bottom:12px">
        <details open>
          <summary style="cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div style="font-size:13px;font-weight:700;color:var(--navy)">${s.title}</div>
            <span style="font-size:11px;color:var(--text3)">▼ collapse</span>
          </summary>
          <div style="margin-bottom:12px">${s.content}</div>
          <!-- Action taken / notes for this section -->
          <div style="border-top:1px solid var(--border);padding-top:10px">
            <div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:6px">ACTION TAKEN / NOTES</div>
            ${canEdit
              ? `<textarea rows="2" onchange="saveMeetingNote('${m.id}','${s.key}',this.value)"
                  style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:12px;resize:vertical"
                  placeholder="What was discussed? What action was decided?">${(m.notes||{})[s.key]||''}</textarea>`
              : `<div style="font-size:12px;color:var(--text2);font-style:${(m.notes||{})[s.key]?'normal':'italic'}">${(m.notes||{})[s.key]||'No notes recorded for this section.'}</div>`
            }
          </div>
        </details>
      </div>`).join('')}
  </div>`;
}

// ─── SECTION RENDERERS ────────────────────────────────
function _renderActionOverview(sn){
  const ac = sn.actionSummary||{};
  const items = [
    {l:'Completed — JV Not Uploaded', v:ac.completed_no_jv, c:'var(--red)'},
    {l:'ASD Eligible — EA Pending (urgent)', v:ac.asd_ea_pending, c:'var(--red)'},
    {l:'JV Details Incomplete', v:ac.jv_incomplete, c:'var(--amber)'},
    {l:'Awaiting EA Number', v:ac.ea_pending, c:'var(--amber)'},
    {l:'ASD Refund — Apply Now', v:ac.asd_to_apply, c:'var(--amber)'},
    {l:'Apply for WEC', v:ac.wec_to_apply, c:'var(--amber)'},
    {l:'WEC Applied — Awaiting', v:ac.wec_applied, c:'var(--amber)'},
    {l:'WEX Quantities Pending', v:ac.wex_pending, c:'#7c3aed'},
    {l:'Awaiting GVMC Payment', v:ac.payment_pending, c:'var(--amber)'},
    {l:'GST Filing Pending', v:ac.gst_pending, c:'var(--amber)'},
    {l:'EMD/FSD Refund Overdue', v:ac.emd_overdue, c:'var(--red)'},
    {l:'EMD/FSD Refund Due Soon', v:ac.emd_to_apply, c:'var(--amber)'},
  ].filter(x=>x.v>0);
  if(!items.length) return '<div style="color:var(--green);font-weight:600">✅ All clear — no pending actions</div>';
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
    ${items.map(x=>`<div style="padding:10px 12px;border-left:3px solid ${x.c};background:var(--surface2);border-radius:0 var(--rs) var(--rs) 0">
      <div style="font-size:20px;font-weight:800;color:${x.c}">${x.v}</div>
      <div style="font-size:11px;color:var(--text2)">${x.l}</div>
    </div>`).join('')}
  </div>`;
}

function _renderJVsReceived(sn){
  const jvs = sn.jvsReceived||[];
  if(!jvs.length) return '<div style="color:var(--text3);font-style:italic">No JVs received since last meeting.</div>';
  const total = jvs.reduce((s,j)=>s+(j.jvAmount||0),0);
  return `<div style="font-size:12px;color:var(--text3);margin-bottom:8px">${jvs.length} JV${jvs.length>1?'s':''} · Total value: <strong>${fmt(total)}</strong></div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:var(--surface2)"><th style="padding:5px 8px;text-align:left">Project</th><th style="padding:5px 8px;text-align:left">Contractor</th><th style="padding:5px 8px;text-align:left">JV Date</th><th style="padding:5px 8px;text-align:right">JV Amount</th></tr></thead>
      <tbody>${jvs.map(j=>`<tr style="border-bottom:1px solid var(--surface2)">
        <td style="padding:5px 8px;font-weight:600">${j.name.substring(0,45)}</td>
        <td style="padding:5px 8px">${j.contractor}</td>
        <td style="padding:5px 8px">${fmtDate(j.jvDate)}</td>
        <td style="padding:5px 8px;text-align:right;font-weight:700">${fmt(j.jvAmount||0)}</td>
      </tr>`).join('')}</tbody>
    </table>`;
}

function _renderExpectedJVs(sn){
  const thisM = sn.expectedThis||[], nextM = sn.expectedNext||[];
  const render = (list, label) => list.length
    ? `<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:6px">${label} (${list.length})</div>
       ${list.map(p=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--surface2);font-size:12px">
         <span style="font-weight:600">${p.name.substring(0,45)}</span>
         <span style="color:var(--text3)">${p.contractor}</span>
         <span style="font-weight:700;color:var(--navy)">${fmt(p.agreeAmt||0)}</span>
       </div>`).join('')}`
    : `<div style="font-size:12px;color:var(--text3);font-style:italic;margin-bottom:10px">${label}: None</div>`;
  return render(thisM,'This Month') + '<div style="margin-top:10px"></div>' + render(nextM,'Next Month');
}

function _renderCapWatch(sn){
  const over = sn.overCap||[];
  if(!over.length) return '<div style="color:var(--green);font-weight:600">✅ No projects over 70% cap</div>';
  return `<div style="font-size:12px;color:var(--text3);margin-bottom:8px">These projects need close monitoring — releases near cap limit.</div>
    ${over.map(p=>{
      const color = p.pct>=100?'var(--red)':p.pct>=85?'var(--red)':'var(--amber)';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface2);border-radius:var(--rs);margin-bottom:6px;border-left:3px solid ${color}">
        <div style="font-size:12px;font-weight:700">${p.name.substring(0,50)}</div>
        <div style="font-size:14px;font-weight:800;color:${color};white-space:nowrap">${p.pct}% used</div>
      </div>`;
    }).join('')}`;
}

function _renderLongPending(sn){
  const lp = sn.longPendingJV||[];
  if(!lp.length) return '<div style="color:var(--text3);font-style:italic">No projects with EA pending over 60 days.</div>';
  return `<div style="font-size:12px;color:var(--text3);margin-bottom:8px">These projects have had JV but no EA number for over 60 days — require follow-up.</div>
    ${lp.map(x=>`<div style="display:flex;justify-content:space-between;padding:6px 10px;background:#fef2f2;border-radius:var(--rs);margin-bottom:5px;border-left:3px solid var(--red)">
      <span style="font-size:12px;font-weight:600">${x.name.substring(0,50)}</span>
      <span style="font-size:12px;color:var(--red);font-weight:700">${x.days} days pending</span>
    </div>`).join('')}`;
}

function _renderPayments(sn){
  const pmts = sn.paymentsReceived||[];
  if(!pmts.length) return '<div style="color:var(--text3);font-style:italic">No payments received since last meeting.</div>';
  const total = pmts.reduce((s,x)=>s+x.amount,0);
  return `<div style="font-size:12px;color:var(--text3);margin-bottom:8px">${pmts.length} payment${pmts.length>1?'s':''} · Total: <strong style="color:var(--green)">${fmt(total)}</strong></div>
    ${pmts.map(x=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--surface2);font-size:12px">
      <span>${x.projectName.substring(0,45)}</span>
      <span style="color:var(--text3)">${fmtDate(x.date)}</span>
      <span style="font-weight:700;color:var(--green)">${fmt(x.amount)}</span>
    </div>`).join('')}`;
}

function _renderWEXStatus(sn){
  const pending = sn.wexPending||[];
  if(!pending.length) return '<div style="color:var(--green);font-weight:600">✅ All WEC-received projects have quantities entered</div>';
  return `<div style="font-size:12px;color:var(--text3);margin-bottom:8px">${pending.length} project${pending.length>1?'s':''} have WEC uploaded but quantities not entered.</div>
    ${pending.map(p=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--surface2);font-size:12px">
      <span style="font-weight:600">${p.name.substring(0,50)}</span>
      <span style="color:var(--text3)">${p.contractor}</span>
    </div>`).join('')}`;
}

function _renderFinancialOverview(sn){
  const f = sn.financials||{};
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
    ${[
      {l:'Total Deployed',v:fmt(f.totalDeployed||0),c:'var(--navy)'},
      {l:'Total Received Back',v:fmt(f.totalSettled||0),c:'var(--green)'},
      {l:'Total Outstanding',v:fmt(f.totalOutstanding||0),c:'var(--red)'},
    ].map(x=>`<div style="text-align:center;padding:12px;background:var(--surface2);border-radius:var(--rs);border-top:3px solid ${x.c}">
      <div style="font-size:16px;font-weight:800;color:${x.c}">${x.v}</div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;margin-top:3px">${x.l}</div>
    </div>`).join('')}
  </div>`;
}

// ─── SAVE NOTES ───────────────────────────────────────
async function saveMeetingNote(id, key, value){
  const m = (D.meetings||[]).find(x=>x.id===id); if(!m) return;
  if(key==='summary') m.summary = value;
  else { if(!m.notes) m.notes={}; m.notes[key]=value; }
  try{ await saveMeetings(); }catch(e){ toast('Failed to save note','error'); }
}

// ─── DELETE MEETING ───────────────────────────────────
async function deleteMeeting(id){
  const ok = await showConfirm({title:'Delete Meeting?',message:'This will permanently delete the meeting record and all notes.',confirmLabel:'Yes, Delete'});
  if(!ok) return;
  D.meetings = (D.meetings||[]).filter(x=>x.id!==id);
  await saveMeetings();
  renderMeeting();
  toast('Meeting deleted','ok');
}

// ─── PRINT / PDF ──────────────────────────────────────
function printMeeting(id){
  const m = (D.meetings||[]).find(x=>x.id===id); if(!m) return;
  const sn = m.snapshot||{};

  const sections = [
    {key:'action_overview', title:'⚡ Action Centre Overview', content:_renderActionOverview(sn)},
    {key:'jvs_received',    title:'📋 JVs Received Since Last Meeting', content:_renderJVsReceived(sn)},
    {key:'expected_jvs',    title:'📅 Expected JVs', content:_renderExpectedJVs(sn)},
    {key:'cap_watch',       title:'🔴 Projects Over 70% Cap', content:_renderCapWatch(sn)},
    {key:'long_pending',    title:'⏱ Long-Pending Items (EA > 60 days)', content:_renderLongPending(sn)},
    {key:'payments',        title:'💰 Payments Received', content:_renderPayments(sn)},
    {key:'wex_status',      title:'📐 Work Experience Status', content:_renderWEXStatus(sn)},
    {key:'financials',      title:'📊 Financial Overview', content:_renderFinancialOverview(sn)},
  ];

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>${m.title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#1a1a1a;padding:20px}
    .header{border-bottom:3px solid #1a2744;padding-bottom:14px;margin-bottom:20px}
    .header h1{font-size:20px;font-weight:800;color:#1a2744}
    .header .meta{font-size:11px;color:#666;margin-top:4px}
    .section{margin-bottom:20px;page-break-inside:avoid}
    .section-title{font-size:13px;font-weight:700;color:#1a2744;padding:6px 10px;background:#f0f2f8;border-left:4px solid #1a2744;margin-bottom:10px}
    .notes-box{margin-top:10px;padding:8px 10px;background:#f8f9fa;border:1px solid #e0e0e0;border-radius:4px;min-height:30px}
    .notes-label{font-size:9px;font-weight:700;text-transform:uppercase;color:#999;margin-bottom:4px}
    .notes-content{font-size:11px;color:#333;white-space:pre-wrap}
    table{width:100%;border-collapse:collapse;font-size:10.5px}
    th{padding:5px 8px;background:#1a2744;color:#fff;text-align:left;font-weight:600}
    td{padding:5px 8px;border-bottom:1px solid #f0f0f0}
    @media print{body{padding:10px}@page{margin:1.5cm;size:A4}}
  </style>
  </head><body>
  <div class="header">
    <h1>${m.title}</h1>
    <div class="meta">Date: ${fmtDate(m.date)} &nbsp;·&nbsp; Attendees: ${m.attendees||'—'} &nbsp;·&nbsp; Created by: ${m.createdBy||'—'}</div>
    ${sn.sinceDate?`<div class="meta">Period covered: ${fmtDate(sn.sinceDate)} — ${fmtDate(m.date)}</div>`:''}
  </div>
  ${m.summary?`<div class="section"><div class="section-title">📝 Meeting Summary</div><div style="font-size:12px;white-space:pre-wrap">${m.summary}</div></div>`:''}
  ${sections.map(s=>`
    <div class="section">
      <div class="section-title">${s.title}</div>
      ${s.content}
      <div class="notes-box">
        <div class="notes-label">Action Taken / Notes</div>
        <div class="notes-content">${(m.notes||{})[s.key]||'—'}</div>
      </div>
    </div>`).join('')}
  <div style="margin-top:24px;padding-top:10px;border-top:1px solid #e0e0e0;font-size:10px;color:#999;text-align:center">
    RSR Constructions Tracker · ${m.title} · ${fmtDate(m.date)} · For internal use only
  </div>
  </body></html>`;

  const win = window.open('','_blank');
  if(win){ win.document.write(html); win.document.close(); setTimeout(()=>win.print(),600); }
}
