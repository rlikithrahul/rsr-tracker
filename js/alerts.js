
// ─── OPEN PROJECT FROM ALERT ─────────────────────────
// Properly switches to project detail from any tab
function openProjectFromAlert(pid){
  CM('modal-alerts'); // close alerts modal if open
  ownerTab(1); // go to projects tab first
  setTimeout(()=>openDetail(pid), 100); // then open detail
}

// ═══════════════════════════════════════════════════════
// alerts.js — RSR Constructions Tracker
// Priority alert system — EA Number, WEC, Refund, Operations
// ═══════════════════════════════════════════════════════

// ─── ALERT DEFINITIONS ───────────────────────────────
// Returns all alerts for a project, priority sorted
function getProjectAlerts(p){
  const alerts = [];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // ── EA NUMBER ALERTS ──────────────────────────────
  if(p.jvDate && !p.eaNumber && !(p.docVault && p.docVault.ea)){
    const jvDate = new Date(p.jvDate);
    const daysSinceJV = Math.round((today - jvDate) / 86400000);
    const monthsSinceJV = daysSinceJV / 30;

    if(monthsSinceJV > 3){
      alerts.push({
        code: 'ea_overdue',
        type: 'red',
        priority: 1,
        project: p,
        msg: `🔴 EA Number overdue — ${Math.round(monthsSinceJV)} months since JV received for "${p.name}"`,
        shortMsg: `EA Number overdue (${Math.round(monthsSinceJV)}m)`,
        action: `Open project and enter EA Number immediately`,
        projectId: p.id
      });
    } else if(monthsSinceJV > 2){
      alerts.push({
        code: 'ea_urgent',
        type: 'red',
        priority: 2,
        project: p,
        msg: `🔴 EA Number not received — ${Math.round(daysSinceJV)} days since JV for "${p.name}"`,
        shortMsg: `EA Number not received (${Math.round(daysSinceJV)}d)`,
        action: `Enter EA Number in project`,
        projectId: p.id
      });
    } else if(monthsSinceJV > 1.5){
      alerts.push({
        code: 'ea_warning',
        type: 'amber',
        priority: 3,
        project: p,
        msg: `⚠️ EA Number not yet received — ${Math.round(daysSinceJV)} days since JV for "${p.name}"`,
        shortMsg: `EA Number pending (${Math.round(daysSinceJV)}d)`,
        action: `Follow up for EA Number`,
        projectId: p.id
      });
    }
  }

  // ── EMD/ASD/FSD REFUND ELIGIBILITY ───────────────
  if(p.jvDate && !p.refundApplied){
    const jvDate = new Date(p.jvDate);
    const twoYearsAfter = new Date(jvDate);
    twoYearsAfter.setFullYear(twoYearsAfter.getFullYear() + 2);
    const daysUntilRefund = Math.round((twoYearsAfter - today) / 86400000);

    if(daysUntilRefund <= 0){
      const hasDeposits = (p.emd||0) + (p.asd||0) + (p.fsd||0) > 0;
      alerts.push({
        code: 'refund_eligible',
        type: 'red',
        priority: 1,
        project: p,
        msg: `🔴 EMD/ASD/FSD Refund eligible — 2 years completed since JV for "${p.name}"${hasDeposits?' · Total deposits: '+fmt((p.emd||0)+(p.asd||0)+(p.fsd||0)):''}`,
        shortMsg: `Refund eligible — apply now`,
        action: `Apply for EMD/ASD/FSD refund`,
        projectId: p.id
      });
    } else if(daysUntilRefund <= 30){
      alerts.push({
        code: 'refund_soon',
        type: 'amber',
        priority: 3,
        project: p,
        msg: `⚠️ Refund eligibility in ${daysUntilRefund} days for "${p.name}" — prepare documents`,
        shortMsg: `Refund in ${daysUntilRefund} days`,
        action: `Prepare EMD/ASD/FSD refund documents`,
        projectId: p.id
      });
    }
  }

  // ── WORK EXPERIENCE CERTIFICATE ──────────────────
  const eaNumber = p.eaNumber || (p.docVault && p.docVault.ea) || '';
  if(eaNumber && !p.wecReceived){
    if(!p.wecApplied){
      alerts.push({
        code: 'wec_apply',
        type: 'amber',
        priority: 2,
        project: p,
        msg: `⚠️ Apply for Work Experience Certificate — EA Number received for "${p.name}"`,
        shortMsg: `Apply for WEC`,
        action: `Submit WEC application`,
        projectId: p.id
      });
    } else {
      alerts.push({
        code: 'wec_pending',
        type: 'info',
        priority: 5,
        project: p,
        msg: `🔵 WEC Applied on ${fmtDate(p.wecAppliedDate)} — awaiting receipt for "${p.name}"`,
        shortMsg: `WEC applied — awaiting`,
        action: `Upload WEC when received`,
        projectId: p.id
      });
    }
  }

  // ── OPERATIONAL ALERTS ────────────────────────────
  if((p.status||'active')==='active'){
    // No update alert — only if project has been active for 14+ days
    const updates = (p.contractorUpdates||[]).filter(u=>!isArchived(u));
    const projectAge = p.agreeDate
      ? Math.round((today - new Date(p.agreeDate)) / 86400000)
      : Math.round((today - new Date(p.createdAt||today)) / 86400000);

    if(projectAge > 14){
      if(updates.length){
        // Has had updates — check if last one was too long ago
        const lastUpd = updates.map(u=>u.date).sort().reverse()[0];
        const daysSince = Math.round((today - new Date(lastUpd)) / 86400000);
        if(daysSince > 14){
          alerts.push({
            code: 'no_update',
            type: 'amber',
            priority: 4,
            project: p,
            msg: `⚠️ No site update for ${daysSince} days — "${p.name}"`,
            shortMsg: `No update ${daysSince}d`,
            action: `Follow up with contractor`,
            projectId: p.id
          });
        }
      }
      // Don't alert if project never had updates — too noisy for 37 new projects
    }

    // Funding above 75%
    const rel = totRel(p), max = maxF(p);
    if(max > 0){
      const pct = rel / max;
      if(pct >= 0.85){
        alerts.push({
          code: 'cap_critical',
          type: 'red',
          priority: 2,
          project: p,
          msg: `🔴 ${Math.round(pct*100)}% of funding cap used — "${p.name}"`,
          shortMsg: `Cap ${Math.round(pct*100)}% used`,
          action: `Review releases urgently`,
          projectId: p.id
        });
      } else if(pct >= 0.75){
        alerts.push({
          code: 'cap_warning',
          type: 'amber',
          priority: 4,
          project: p,
          msg: `⚠️ ${Math.round(pct*100)}% of funding cap used — "${p.name}"`,
          shortMsg: `Cap ${Math.round(pct*100)}% used`,
          action: `Monitor releases`,
          projectId: p.id
        });
      }
    }
  }

  return alerts.sort((a,b)=>a.priority-b.priority);
}

// ─── GET ALL ALERTS ACROSS ALL PROJECTS ──────────────
function getAllAlerts(){
  const all = [];
  D.projects.filter(p=>!isArchived(p)).forEach(p=>{
    getProjectAlerts(p).forEach(a=>all.push(a));
  });
  return all.sort((a,b)=>a.priority-b.priority);
}

// ─── CONTRACTOR ALERTS (for their dashboard) ─────────
function getContractorAlerts(contractorId){
  const alerts = [];
  const myProjects = D.projects.filter(p=>p.contractorId===contractorId&&!isArchived(p));

  myProjects.forEach(p=>{
    // EA Number alert for contractor
    if(p.jvDate && !p.eaNumber && !(p.docVault&&p.docVault.ea)){
      const daysSinceJV = Math.round((new Date()-new Date(p.jvDate))/86400000);
      if(daysSinceJV > 45){
        alerts.push({
          type: daysSinceJV>60?'red':'amber',
          msg: `JV received for "${p.name}" — EA Number not yet received (${daysSinceJV} days). Contact RSR office.`
        });
      }
    }
    // WEC alert for contractor
    const eaNumber = p.eaNumber||(p.docVault&&p.docVault.ea)||'';
    if(eaNumber && !p.wecReceived && !p.wecApplied){
      alerts.push({
        type: 'amber',
        msg: `Work Experience Certificate pending for "${p.name}" — EA Number received.`
      });
    }
  });

  return alerts;
}

// ─── RENDER FULL ALERTS PANEL ─────────────────────────
function renderAlertsPanel(){
  const all = getAllAlerts();
  if(!all.length){
    return `<div style="text-align:center;padding:30px;color:var(--text3)">
      <div style="font-size:32px;margin-bottom:8px">✅</div>
      <div style="font-size:14px;font-weight:600">All clear — no alerts</div>
    </div>`;
  }

  const red = all.filter(a=>a.type==='red');
  const amber = all.filter(a=>a.type==='amber');
  const info = all.filter(a=>a.type==='info');

  const renderGroup = (items, label, color, bg) => items.length ? `
    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;padding:4px 10px;background:${bg};border-radius:4px;display:inline-block">${label} (${items.length})</div>
      ${items.map(a=>`
        <div style="padding:10px 12px;border-left:3px solid ${color};background:${bg};border-radius:0 var(--rs) var(--rs) 0;margin-bottom:6px;cursor:pointer" onclick="openProjectFromAlert('${a.projectId}')">
          <div style="font-size:13px;color:var(--text1);margin-bottom:3px">${a.msg}</div>
          <div style="font-size:11px;color:${color};font-weight:600">→ ${a.action}</div>
        </div>`).join('')}
    </div>` : '';

  return renderGroup(red,'🔴 Urgent','var(--red)','#fef2f2')
       + renderGroup(amber,'🟡 Action Needed','#92400e','#fffbeb')
       + renderGroup(info,'🔵 Info','#1a56db','#e8f0fe');
}

// ─── RENDER DASHBOARD ALERT STRIP ────────────────────
// Shows top 2 alerts + "View All" button
function renderDashAlertStrip(){
  const all = getAllAlerts();
  if(!all.length) return '';

  const top2 = all.slice(0,2);
  const remaining = all.length - 2;

  return `<div id="dash-alerts-strip" style="margin-bottom:14px">
    ${top2.map(a=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;
        border-left:3px solid ${a.type==='red'?'var(--red)':a.type==='amber'?'var(--amber)':'#1a56db'};
        background:${a.type==='red'?'#fef2f2':a.type==='amber'?'#fffbeb':'#e8f0fe'};
        border-radius:0 var(--rs) var(--rs) 0;margin-bottom:4px;cursor:pointer;gap:8px"
        onclick="openProjectFromAlert('${a.projectId}')">
        <span style="font-size:12px;color:var(--text1);flex:1">${a.msg}</span>
        <span style="font-size:11px;font-weight:700;color:${a.type==='red'?'var(--red)':'#92400e'};white-space:nowrap">View →</span>
      </div>`).join('')}
    ${remaining > 0 ? `
      <button onclick="showAllAlerts()" style="width:100%;padding:7px;background:var(--surface2);border:1px solid var(--border);
        border-radius:var(--rs);font-size:12px;font-weight:600;color:var(--navy);cursor:pointer;font-family:'Inter',sans-serif;margin-top:2px">
        + ${remaining} more alert${remaining>1?'s':''} — View All
      </button>` : all.length > 0 ? `
      <button onclick="showAllAlerts()" style="width:100%;padding:7px;background:var(--surface2);border:1px solid var(--border);
        border-radius:var(--rs);font-size:12px;font-weight:600;color:var(--navy);cursor:pointer;font-family:'Inter',sans-serif;margin-top:2px">
        View All Alerts
      </button>` : ''}
  </div>`;
}

// ─── SHOW ALL ALERTS MODAL ────────────────────────────
function showAllAlerts(){
  let modal = document.getElementById('modal-alerts');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'mov';
    modal.id = 'modal-alerts';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="mbox" style="max-width:560px">
    <div class="mhdr">
      <h2>🔔 All Alerts</h2>
      <button class="mx" onclick="CM('modal-alerts')">✕</button>
    </div>
    <div style="max-height:70vh;overflow-y:auto;padding-right:4px">
      ${renderAlertsPanel()}
    </div>
  </div>`;
  modal.classList.add('open');
}

// ─── WEC TRACKING FUNCTIONS ───────────────────────────
async function markWECApplied(pid){
  const p = GP(pid); if(!p) return;
  const date = prompt('Date of WEC application (YYYY-MM-DD):',
    new Date().toISOString().split('T')[0]);
  if(!date) return;
  p.wecApplied = true;
  p.wecAppliedDate = date;
  try{
    await saveProjectDB(p, {type:'wec_applied', amount:0, ref:null, meta:{date}});
    renderDetail(pid);
    toast('✓ WEC marked as applied','ok');
  }catch(e){ toast('Save failed','error'); }
}

async function markWECReceived(pid){
  const p = GP(pid); if(!p) return;
  p.wecReceived = true;
  p.wecReceivedDate = new Date().toISOString().split('T')[0];
  try{
    await saveProjectDB(p, {type:'wec_received', amount:0, ref:null, meta:{}});
    renderDetail(pid);
    toast('✓ WEC marked as received — upload the document in Documents section','ok',4000);
  }catch(e){ toast('Save failed','error'); }
}

async function markRefundApplied(pid){
  const p = GP(pid); if(!p) return;
  const date = prompt('Date of refund application (YYYY-MM-DD):',
    new Date().toISOString().split('T')[0]);
  if(!date) return;
  p.refundApplied = true;
  p.refundAppliedDate = date;
  try{
    await saveProjectDB(p, {type:'refund_applied', amount:0, ref:null, meta:{date}});
    renderDetail(pid);
    toast('✓ Refund marked as applied','ok');
  }catch(e){ toast('Save failed','error'); }
}
