// ═══════════════════════════════════════════════════════
// alerts.js — RSR Constructions Tracker
// RULES:
// - ONE alert per project per issue (no duplicates between systems)
// - Only the most severe threshold fires (90% cap = red only, not amber too)
// - Completed projects: skip BOQ, cost centre, no-update, verification warnings
// - Active projects: mild warnings only for missing operational data
// ═══════════════════════════════════════════════════════

function openProjectFromAlert(pid){
  CM('modal-alerts');
  ownerTab(1);
  setTimeout(()=>openDetail(pid), 100);
}

// ─── SINGLE SOURCE OF TRUTH: ALL ALERTS ──────────────
function getAllAlerts(){
  const all = [];
  const today = new Date();

  D.projects.filter(p=>!isArchived(p)).forEach(p=>{
    const isActive = (p.status||'active') === 'active';
    const isCompleted = (p.status||'active') === 'completed';

    // 1. CAP USAGE — one alert per project at highest threshold only
    if(isActive){
      const rel = totRel(p), max = maxF(p);
      if(max > 0){
        const capPct = rel / max;
        if(capPct >= 1.0){
          all.push({ code:'cap_over', type:'red', priority:1, projectId:p.id,
            msg:`🔴 ${Math.round(capPct*100)}% of cap used — OVER LIMIT — "${p.name}"`,
            shortMsg:`${Math.round(capPct*100)}% cap — over limit`, action:'Review fund releases immediately' });
        } else if(capPct >= 0.85){
          all.push({ code:'cap_critical', type:'red', priority:2, projectId:p.id,
            msg:`🔴 ${Math.round(capPct*100)}% of cap used — urgent review — "${p.name}"`,
            shortMsg:`${Math.round(capPct*100)}% cap used`, action:'Review releases urgently' });
        } else if(capPct >= 0.75){
          all.push({ code:'cap_warning', type:'amber', priority:4, projectId:p.id,
            msg:`⚠️ ${Math.round(capPct*100)}% of cap used — "${p.name}"`,
            shortMsg:`${Math.round(capPct*100)}% cap used`, action:'Monitor releases' });
        }
      }
    }

    // 2. EA NUMBER (after JV received)
    if(p.jvDate && !p.eaNumber && !(p.documents && p.documents.ea)){
      const daysSinceJV = Math.round((today - new Date(p.jvDate)) / 86400000);
      const months = daysSinceJV / 30;
      if(months > 3){
        all.push({ code:'ea_overdue', type:'red', priority:1, projectId:p.id,
          msg:`🔴 EA Number overdue — ${Math.round(months)}m since JV — "${p.name}"`,
          shortMsg:`EA overdue (${Math.round(months)}m)`, action:'Enter EA Number now' });
      } else if(months > 2){
        all.push({ code:'ea_urgent', type:'red', priority:2, projectId:p.id,
          msg:`🔴 EA Number not received — ${daysSinceJV}d since JV — "${p.name}"`,
          shortMsg:`EA pending (${daysSinceJV}d)`, action:'Enter EA Number' });
      } else if(months > 1.5){
        all.push({ code:'ea_warning', type:'amber', priority:3, projectId:p.id,
          msg:`⚠️ EA Number not yet received — ${daysSinceJV}d since JV — "${p.name}"`,
          shortMsg:`EA pending (${daysSinceJV}d)`, action:'Follow up for EA Number' });
      }
    }

    // 3. WEC (after EA number received)
    const eaNumber = p.eaNumber || (p.documents && p.documents.ea) || '';
    if(eaNumber && !p.wecReceived){
      if(!p.wecApplied){
        all.push({ code:'wec_apply', type:'amber', priority:2, projectId:p.id,
          msg:`⚠️ Apply for WEC — EA Number received — "${p.name}"`,
          shortMsg:'Apply for WEC', action:'Submit WEC application' });
      } else {
        all.push({ code:'wec_pending', type:'info', priority:5, projectId:p.id,
          msg:`🔵 WEC applied — awaiting receipt — "${p.name}"`,
          shortMsg:'WEC applied — awaiting', action:'Upload WEC when received' });
      }
    }

    // 4. EMD/FSD/ASD REFUND
    if(p.jvDate && !p.refundReceived){
      const twoYears = new Date(p.jvDate);
      twoYears.setFullYear(twoYears.getFullYear() + 2);
      const daysUntil = Math.round((twoYears - today) / 86400000);
      if(daysUntil <= 0){
        all.push({ code:'refund_overdue', type:'red', priority:1, projectId:p.id,
          msg:`🔴 Refund OVERDUE — ${Math.abs(daysUntil)}d past 2yr — "${p.name}"`,
          shortMsg:'Refund overdue — apply now', action:'Apply for EMD/ASD/FSD refund' });
      } else if(daysUntil <= 30 && !p.refundApplied){
        all.push({ code:'refund_soon', type:'amber', priority:3, projectId:p.id,
          msg:`⚠️ Refund eligible in ${daysUntil} days — "${p.name}"`,
          shortMsg:`Refund in ${daysUntil} days`, action:'Prepare refund documents' });
      }
    }

    // 5. GST FILING (after payment received)
    const hasPayment = (p.settlements||[]).filter(s=>!isArchived(s)).length > 0;
    if(hasPayment && !p.gstFiled){
      const firstSettlement = (p.settlements||[]).filter(s=>!isArchived(s))[0];
      let qLabel = '';
      if(firstSettlement?.date){
        const d=new Date(firstSettlement.date), m=d.getMonth()+1, y=d.getFullYear();
        if(m>=4&&m<=6) qLabel='Q1 FY'+y; else if(m>=7&&m<=9) qLabel='Q2 FY'+y;
        else if(m>=10&&m<=12) qLabel='Q3 FY'+y; else qLabel='Q4 FY'+y;
      }
      all.push({ code:'gst_pending', type:'amber', priority:3, projectId:p.id,
        msg:`🧾 GST filing pending — ${qLabel} — "${p.name}"`,
        shortMsg:`GST pending — ${qLabel}`, action:'Open GST tab' });
    }

    // 6. PENDING CONTRACTOR REVIEWS (active only)
    if(isActive){
      const pending = (p.contractorUpdates||[]).filter(u=>!u.reviewed&&!isArchived(u)).length;
      if(pending > 0){
        all.push({ code:'pending_review', type:'info', priority:5, projectId:p.id,
          msg:`📸 ${pending} update${pending>1?'s':''} awaiting review — "${p.name}"`,
          shortMsg:`${pending} update${pending>1?'s':''} pending`, action:'Open project to review' });
      }
    }

    // 7. JV DETAILS INCOMPLETE
    if(p.jvDate && (!p.jvNumber || !p.jvAmount)){
      all.push({ code:'jv_incomplete', type:'amber', priority:3, projectId:p.id,
        msg:`⚠️ JV details incomplete — "${p.name}"`,
        shortMsg:'JV details missing', action:'Fill in JV Number and Amount' });
    }

    // 8. STALE UPDATE — only if contractor previously submitted updates
    if(isActive){
      const updates = (p.contractorUpdates||[]).filter(u=>!isArchived(u));
      if(updates.length > 0){
        const lastUpd = updates.map(u=>u.date).sort().reverse()[0];
        const daysSince = Math.round((today - new Date(lastUpd)) / 86400000);
        if(daysSince > 14){
          all.push({ code:'stale_update', type:'amber', priority:4, projectId:p.id,
            msg:`⚠️ No update for ${daysSince} days — "${p.name}"`,
            shortMsg:`No update ${daysSince}d`, action:'Follow up with contractor' });
        }
      }
    }
  });

  return all.sort((a,b)=>(a.priority||5)-(b.priority||5));
}

// ─── COMPATIBILITY SHIMS ───────────────────────────────
function getProjectAlerts(p){ return getAllAlerts().filter(a=>a.projectId===p.id); }
function getAutoWarnings(p){ return []; } // all logic now in getAllAlerts — no duplicates

// ─── CONTRACTOR ALERTS ─────────────────────────────────
function getContractorAlerts(contractorId){
  const alerts = [];
  D.projects.filter(p=>p.contractorId===contractorId&&!isArchived(p)).forEach(p=>{
    if(p.jvDate && !p.eaNumber && !(p.documents&&p.documents.ea)){
      const daysSinceJV = Math.round((new Date()-new Date(p.jvDate))/86400000);
      if(daysSinceJV > 45){
        alerts.push({ type:daysSinceJV>60?'red':'amber',
          msg:`JV received for "${p.name}" — EA Number not yet received (${daysSinceJV} days).` });
      }
    }
    const eaNumber = p.eaNumber||(p.documents&&p.documents.ea)||'';
    if(eaNumber && !p.wecReceived && !p.wecApplied){
      alerts.push({ type:'amber', msg:`WEC pending for "${p.name}" — EA Number received.` });
    }
  });
  return alerts;
}

// ─── DASHBOARD ALERT STRIP ────────────────────────────
function renderDashAlertStrip(){
  const all = getAllAlerts();
  if(!all.length) return '';
  const red = all.filter(a=>a.type==='red');
  const top = red.length >= 2 ? red.slice(0,2) : all.slice(0,2);
  const remaining = all.length - top.length;
  return `<div id="dash-alerts-strip" style="margin-bottom:14px">
    ${top.map(a=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;
        border-left:3px solid ${a.type==='red'?'var(--red)':a.type==='amber'?'var(--amber)':'#1a56db'};
        background:${a.type==='red'?'#fef2f2':a.type==='amber'?'#fffbeb':'#e8f0fe'};
        border-radius:0 var(--rs) var(--rs) 0;margin-bottom:4px;cursor:pointer;gap:8px"
        onclick="openProjectFromAlert('${a.projectId}')">
        <span style="font-size:12px;color:var(--text1);flex:1">${a.msg}</span>
        <span style="font-size:11px;font-weight:700;color:${a.type==='red'?'var(--red)':'#92400e'};white-space:nowrap">View →</span>
      </div>`).join('')}
    ${remaining > 0
      ? `<button onclick="showAllAlerts()" style="width:100%;padding:7px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--rs);font-size:12px;font-weight:600;color:var(--navy);cursor:pointer;font-family:'Inter',sans-serif;margin-top:2px">+ ${remaining} more alert${remaining>1?'s':''} — View All</button>`
      : `<button onclick="showAllAlerts()" style="width:100%;padding:7px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--rs);font-size:12px;font-weight:600;color:var(--navy);cursor:pointer;font-family:'Inter',sans-serif;margin-top:2px">View All Alerts</button>`}
  </div>`;
}

// ─── ALL ALERTS MODAL ─────────────────────────────────
function showAllAlerts(){
  let modal = document.getElementById('modal-alerts');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-alerts'; document.body.appendChild(modal); }
  const all = getAllAlerts();
  const groups = [
    { key:'red',   label:'🔴 Urgent Action',  color:'var(--red)',  bg:'#fef2f2' },
    { key:'amber', label:'🟡 Action Needed',   color:'#92400e',     bg:'#fffbeb' },
    { key:'info',  label:'🔵 Information',     color:'#1a56db',     bg:'#e8f0fe' },
  ];
  modal.innerHTML = `<div class="mbox" style="max-width:560px">
    <div class="mhdr"><h2>🔔 Alerts <span style="font-size:13px;font-weight:500;color:var(--text3)">(${all.length} total)</span></h2>
      <button class="mx" onclick="CM('modal-alerts')">✕</button></div>
    <div style="max-height:70vh;overflow-y:auto;padding-right:4px">
      ${groups.map(g=>{
        const items = all.filter(a=>a.type===g.key);
        if(!items.length) return '';
        return `<div style="margin-bottom:16px">
          <div style="font-size:11px;font-weight:800;color:${g.color};text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;padding:4px 10px;background:${g.bg};border-radius:4px;display:inline-block">${g.label} (${items.length})</div>
          ${items.map(a=>`<div style="padding:10px 12px;border-left:3px solid ${g.color};background:${g.bg};border-radius:0 var(--rs) var(--rs) 0;margin-bottom:6px;cursor:pointer" onclick="openProjectFromAlert('${a.projectId}')">
            <div style="font-size:13px;color:var(--text1);margin-bottom:3px">${a.msg}</div>
            ${a.action?`<div style="font-size:11px;color:${g.color};font-weight:600">→ ${a.action}</div>`:''}
          </div>`).join('')}
        </div>`;
      }).join('')}
    </div>
  </div>`;
  modal.classList.add('open');
}

// ─── LIFECYCLE ACTION HELPERS ─────────────────────────
async function markWECApplied(pid){
  const p=GP(pid); if(!p) return;
  const date=prompt('Date of WEC application (YYYY-MM-DD):',new Date().toISOString().split('T')[0]);
  if(!date) return;
  p.wecApplied=true; p.wecAppliedDate=date;
  try{ await saveProjectDB(p,{type:'wec_applied',amount:0,ref:null,meta:{date}}); renderDetail(pid); toast('✓ WEC marked as applied','ok'); }
  catch(e){ toast('Save failed','error'); }
}
async function markWECReceived(pid){
  const p=GP(pid); if(!p) return;
  p.wecReceived=true; p.wecReceivedDate=new Date().toISOString().split('T')[0];
  try{ await saveProjectDB(p,{type:'wec_received',amount:0,ref:null,meta:{}}); renderDetail(pid); toast('✓ WEC received','ok'); }
  catch(e){ toast('Save failed','error'); }
}
async function markRefundApplied(pid){
  const p=GP(pid); if(!p) return;
  const date=prompt('Date of refund application (YYYY-MM-DD):',new Date().toISOString().split('T')[0]);
  if(!date) return;
  p.refundApplied=true; p.refundAppliedDate=date;
  try{ await saveProjectDB(p,{type:'refund_applied',amount:0,ref:null,meta:{date}}); renderDetail(pid); toast('✓ Refund application recorded','ok'); }
  catch(e){ toast('Save failed','error'); }
}
async function markASDApplied(pid){
  const p=GP(pid); if(!p) return;
  p.asdRefundApplied=true; p.asdRefundAppliedDate=new Date().toISOString().split('T')[0];
  try{ await saveProjectDB(p,{type:'asd_refund_applied',amount:p.asd||0,ref:null,meta:{}}); renderDetail(pid); toast('✓ ASD refund marked applied','ok'); }
  catch(e){ toast('Save failed','error'); }
}
async function markASDReceived(pid){
  const p=GP(pid); if(!p) return;
  p.asdRefundReceived=true; p.asdRefundReceivedDate=new Date().toISOString().split('T')[0];
  try{ await saveProjectDB(p,{type:'asd_refund_received',amount:p.asd||0,ref:null,meta:{}}); renderDetail(pid); toast('✓ ASD refund received','ok'); }
  catch(e){ toast('Save failed','error'); }
}
