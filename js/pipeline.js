// ═══════════════════════════════════════════════════════
// pipeline.js — RSR Constructions Tracker
// Project Pipeline / Action Centre
// Shows all projects grouped by what action is needed
// Based on project lifecycle stages
// ═══════════════════════════════════════════════════════

function renderPipeline(){
  const el = document.getElementById('sec-pipeline');
  if(!el) return;

  const today = new Date();
  const projects = D.projects.filter(p=>!isArchived(p));

  // ── CATEGORISE EACH PROJECT ───────────────────────
  const stages = {
    ea_pending:      [], // JV received, no EA number yet
    asd_to_apply:    [], // EA received, ASD exists, not applied
    wec_to_apply:    [], // EA received, WEC not applied
    wec_applied:     [], // WEC applied, awaiting certificate
    payment_pending: [], // WEC received, awaiting GVMC payment
    gst_pending:     [], // Payment received, GST not filed
    emd_overdue:     [], // Past 2yr from JV, refund not applied
    emd_to_apply:    [], // Within 90 days of 2yr mark
    emd_applied:     [], // Applied, awaiting refund
    all_clear:       [], // Everything done
  };

  projects.forEach(p=>{
    const hasJV = !!p.jvDate;
    const hasEA = !!(p.eaNumber||(p.docVault&&p.docVault.ea));
    const hasPayment = (p.settlements||[]).filter(s=>!isArchived(s)).length > 0;
    const wecApplied = !!p.wecApplied;
    const wecReceived = !!p.wecReceived;
    const gstFiled = !!p.gstFiled;
    const refundApplied = !!p.refundApplied;
    const refundReceived = !!p.refundReceived;
    const asdAmt = p.asd||0;
    const asdApplied = !!p.asdRefundApplied;
    const asdReceived = !!p.asdRefundReceived;

    // Days until/since 2-year mark
    let daysTo2yr = null;
    if(p.jvDate){
      const twoYrs = new Date(p.jvDate);
      twoYrs.setFullYear(twoYrs.getFullYear()+2);
      daysTo2yr = Math.round((twoYrs-today)/86400000);
    }

    if(!hasJV) return; // Running projects — skip, not in pipeline

    // Stage 1: JV received, waiting for EA
    if(hasJV && !hasEA){
      stages.ea_pending.push(p);
      return;
    }

    // Stage 2+3: EA received
    if(hasEA){
      let placed = false;

      // ASD refund to apply
      if(asdAmt>0 && !asdApplied && !asdReceived){
        stages.asd_to_apply.push(p);
        placed = true;
      }

      // WEC to apply (if not done)
      if(!wecReceived && !wecApplied){
        stages.wec_to_apply.push(p);
        placed = true;
      } else if(!wecReceived && wecApplied){
        stages.wec_applied.push(p);
        placed = true;
      }

      if(placed) return;
    }

    // Stage 5: WEC done, waiting for payment
    if(wecReceived && !hasPayment){
      stages.payment_pending.push(p);
      return;
    }

    // Stage 6: Payment received, GST not filed
    if(hasPayment && !gstFiled){
      stages.gst_pending.push(p);
      return;
    }

    // Stage 7/8: EMD/FSD refund
    if(hasJV && !refundReceived){
      if(daysTo2yr!==null && daysTo2yr<=0 && !refundApplied){
        stages.emd_overdue.push(p);
        return;
      }
      if(daysTo2yr!==null && daysTo2yr<=90 && daysTo2yr>0 && !refundApplied){
        stages.emd_to_apply.push(p);
        return;
      }
      if(refundApplied && !refundReceived){
        stages.emd_applied.push(p);
        return;
      }
    }

    // All clear
    if(gstFiled && wecReceived && (refundReceived || daysTo2yr>90)){
      stages.all_clear.push(p);
    }
  });

  // ── STAGE DEFINITIONS ────────────────────────────
  const stageDefs = [
    {
      key:'ea_pending',
      icon:'🔢',
      title:'Awaiting EA Number',
      color:'#6366f1',
      bg:'#eef2ff',
      desc:'JV received — waiting for EA/Accounts number from department',
      action:'Enter EA number once received'
    },
    {
      key:'asd_to_apply',
      icon:'💵',
      title:'Apply for ASD Refund',
      color:'#f59e0b',
      bg:'#fffbeb',
      desc:'EA number received — ASD deposit is now eligible for refund',
      action:'Submit ASD refund application to department',
      urgent:true
    },
    {
      key:'wec_to_apply',
      icon:'📜',
      title:'Apply for Work Experience Certificate',
      color:'#f59e0b',
      bg:'#fffbeb',
      desc:'EA number received — apply for WEC immediately',
      action:'Submit WEC application to department',
      urgent:true
    },
    {
      key:'wec_applied',
      icon:'⏳',
      title:'WEC Applied — Awaiting Certificate',
      color:'#0891b2',
      bg:'#ecfeff',
      desc:'WEC application submitted — waiting for department to issue certificate',
      action:'Follow up with department'
    },
    {
      key:'payment_pending',
      icon:'💰',
      title:'Awaiting GVMC Payment',
      color:'#7c3aed',
      bg:'#f5f3ff',
      desc:'WEC received — waiting for payment from GVMC',
      action:'Follow up with GVMC accounts section'
    },
    {
      key:'gst_pending',
      icon:'🧾',
      title:'GST Filing Pending',
      color:'#dc2626',
      bg:'#fef2f2',
      desc:'Payment received — GST must be filed this quarter',
      action:'Give CA the payment details for GST filing',
      urgent:true
    },
    {
      key:'emd_overdue',
      icon:'🚨',
      title:'EMD / FSD Refund — OVERDUE',
      color:'#dc2626',
      bg:'#fef2f2',
      desc:'More than 2 years since JV date — apply for EMD/FSD refund immediately',
      action:'Submit refund application to department NOW',
      urgent:true
    },
    {
      key:'emd_to_apply',
      icon:'🏦',
      title:'EMD / FSD Refund — Apply Soon',
      color:'#92400e',
      bg:'#fffbeb',
      desc:'Approaching 2-year mark from JV date',
      action:'Prepare and submit refund application'
    },
    {
      key:'emd_applied',
      icon:'⏳',
      title:'EMD/FSD Refund Applied — Awaiting',
      color:'#0891b2',
      bg:'#ecfeff',
      desc:'Refund application submitted — waiting for department',
      action:'Follow up with department'
    },
  ];

  // ── COUNT SUMMARY ─────────────────────────────────
  const urgentCount = ['asd_to_apply','wec_to_apply','gst_pending','emd_overdue']
    .reduce((s,k)=>s+stages[k].length, 0);
  const totalPending = stageDefs.reduce((s,d)=>s+stages[d.key].length, 0);

  // ── RENDER ────────────────────────────────────────
  let html = '<div class="wrap">';

  // Header
  html += '<div class="pg-hdr">'
    +'<div>'
    +'<div class="pg-title">⚡ Action Centre</div>'
    +'<div style="font-size:12px;color:var(--text3)">All pending project actions in one place — sorted by urgency</div>'
    +'</div>'
    +'</div>';

  // Summary bar
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:20px">'
    +'<div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:12px;text-align:center">'
    +'<div style="font-size:22px;font-weight:800;color:var(--red)">'+(urgentCount||'0')+'</div>'
    +'<div style="font-size:11px;font-weight:700;color:var(--red)">Urgent Actions</div>'
    +'</div>'
    +'<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:12px;text-align:center">'
    +'<div style="font-size:22px;font-weight:800;color:#92400e">'+(totalPending||'0')+'</div>'
    +'<div style="font-size:11px;font-weight:700;color:#92400e">Total Pending</div>'
    +'</div>'
    +'<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:12px;text-align:center">'
    +'<div style="font-size:22px;font-weight:800;color:var(--green)">'+(stages.all_clear.length||'0')+'</div>'
    +'<div style="font-size:11px;font-weight:700;color:var(--green)">All Clear</div>'
    +'</div>'
    +'<div style="background:var(--surface2);border:1.5px solid var(--border);border-radius:10px;padding:12px;text-align:center">'
    +'<div style="font-size:22px;font-weight:800;color:var(--navy)">'+projects.filter(p=>!!p.jvDate).length+'</div>'
    +'<div style="font-size:11px;font-weight:700;color:var(--text3)">In Pipeline</div>'
    +'</div>'
    +'</div>';

  if(totalPending === 0){
    html += '<div class="empty"><div class="empty-icon">🎉</div><div class="empty-text">All clear! No pending actions right now.</div></div>';
    html += '</div>';
    el.innerHTML = html;
    return;
  }

  // Each stage
  stageDefs.forEach(def=>{
    const list = stages[def.key];
    if(!list.length) return;

    html += '<div class="card" style="margin-bottom:16px;border-top:3px solid '+def.color+'">'
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">'
      +'<div style="width:36px;height:36px;border-radius:50%;background:'+def.bg+';display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">'+def.icon+'</div>'
      +'<div style="flex:1">'
      +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
      +'<div style="font-size:14px;font-weight:800;color:var(--navy)">'+def.title+'</div>'
      +(def.urgent?'<span style="font-size:10px;font-weight:800;background:var(--red);color:#fff;padding:2px 8px;border-radius:8px">URGENT</span>':'')
      +'<span style="font-size:11px;background:'+def.bg+';color:'+def.color+';padding:2px 8px;border-radius:8px;font-weight:700">'+list.length+' project'+(list.length>1?'s':'')+'</span>'
      +'</div>'
      +'<div style="font-size:11px;color:var(--text3);margin-top:2px">'+def.desc+'</div>'
      +'</div>'
      +'</div>'

      // Action banner
      +'<div style="background:'+def.bg+';border-radius:var(--rs);padding:8px 12px;margin-bottom:12px;font-size:12px;font-weight:600;color:'+def.color+'">'
      +'👉 '+def.action
      +'</div>'

      // Project list
      +'<div style="display:flex;flex-direction:column;gap:8px">'
      +list.map(p=>{
        const c = GC(p.contractorId);
        const firmShort = (p.firm||'RSR')==='RSR Constructions'?'RSR':(p.firm||'RSR')==='R Sadhu Rao'?'RS Rao':'RLR';
        const firmBg = (p.firm||'RSR')==='RSR Constructions'?'var(--navy)':(p.firm||'RSR')==='R Sadhu Rao'?'#7b3f00':'#1b5e20';

        // Stage-specific detail line
        let detail = '';
        if(def.key==='ea_pending' && p.jvDate) detail = 'JV: '+fmtDate(p.jvDate);
        if(def.key==='asd_to_apply') detail = 'ASD: '+fmt(p.asd||0)+' · EA: '+(p.eaNumber||(p.docVault&&p.docVault.ea)||'—');
        if(def.key==='wec_to_apply'||def.key==='wec_applied') detail = 'EA: '+(p.eaNumber||(p.docVault&&p.docVault.ea)||'—')+(p.wecAppliedDate?' · Applied: '+fmtDate(p.wecAppliedDate):'');
        if(def.key==='payment_pending') detail = 'WEC received: '+(p.wecReceivedDate?fmtDate(p.wecReceivedDate):'—');
        if(def.key==='gst_pending'){
          const firstCheck = (p.settlements||[]).filter(s=>!isArchived(s))[0];
          detail = 'Payment: '+(firstCheck?fmt(firstCheck.amount)+' on '+fmtDate(firstCheck.date):'—');
        }
        if(def.key==='emd_overdue'||def.key==='emd_to_apply'){
          const twoYrs = new Date(p.jvDate); twoYrs.setFullYear(twoYrs.getFullYear()+2);
          const days = Math.round((twoYrs-today)/86400000);
          detail = 'JV: '+fmtDate(p.jvDate)+' · '+(days<=0?Math.abs(days)+'d overdue':days+'d remaining')+' · EMD: '+fmt(p.emd||0)+' FSD: '+fmt(p.fsd||0);
        }
        if(def.key==='emd_applied') detail = 'Applied: '+(p.refundAppliedDate?fmtDate(p.refundAppliedDate):'—')+' · EMD: '+fmt(p.emd||0)+' FSD: '+fmt(p.fsd||0);

        return '<div onclick="openDetail(\''+p.id+'\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:var(--rs);cursor:pointer;transition:background .15s;flex-wrap:wrap;gap:8px" onmouseover="this.style.background=\'var(--border)\'" onmouseout="this.style.background=\'var(--surface2)\'">'
          +'<div style="flex:1;min-width:0">'
          +'<div style="font-size:13px;font-weight:700;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+p.name+'</div>'
          +'<div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap">'
          +'<span style="font-size:10px;font-weight:700;background:'+firmBg+';color:#fff;padding:1px 6px;border-radius:6px">'+firmShort+'</span>'
          +(c?'<span style="font-size:11px;color:var(--text2)">👷 '+c.name+'</span>':'')
          +(p.tender?'<span style="font-size:10px;color:var(--text3)">#'+p.tender+'</span>':'')
          +'</div>'
          +(detail?'<div style="font-size:11px;color:'+def.color+';margin-top:3px;font-weight:600">'+detail+'</div>':'')
          +'<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">'
          +(def.key==='wec_to_apply'||def.key==='wec_applied'?'<button onclick="event.stopPropagation();openLetterModal(\''+p.id+'\',\'wec\')" style="background:#e8f5e9;color:#16a34a;border:1px solid #86efac;border-radius:var(--rs);padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif">📄 WEC Letter</button>':'')
          +(def.key==='asd_to_apply'?'<button onclick="event.stopPropagation();openLetterModal(\''+p.id+'\',\'asd\')" style="background:#e8f5e9;color:#16a34a;border:1px solid #86efac;border-radius:var(--rs);padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif">📄 ASD Letter</button>':'')
          +(def.key==='emd_overdue'||def.key==='emd_to_apply'||def.key==='emd_applied'?'<button onclick="event.stopPropagation();openLetterModal(\''+p.id+'\',\'emd_fsd\')" style="background:#e8f5e9;color:#16a34a;border:1px solid #86efac;border-radius:var(--rs);padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif">📄 EMD/FSD Letter</button>':'')
          +'</div>'
          +'</div>'
          +'<div style="font-size:12px;color:var(--navy);font-weight:700;flex-shrink:0">Open →</div>'
          +'</div>';
      }).join('')
      +'</div>'
      +'</div>';
  });

  // All clear projects (collapsed)
  if(stages.all_clear.length>0){
    html += '<div class="card" style="margin-bottom:16px;border-top:3px solid var(--green)">'
      +'<details data-toggle="pipeline-allclear">'
      +'<summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px">'
      +'<div style="display:flex;align-items:center;gap:10px">'
      +'<div style="width:36px;height:36px;border-radius:50%;background:#f0fdf4;display:flex;align-items:center;justify-content:center;font-size:18px">✅</div>'
      +'<div>'
      +'<div style="font-size:14px;font-weight:800;color:var(--green)">All Clear</div>'
      +'<div style="font-size:11px;color:var(--text3)">'+stages.all_clear.length+' project'+(stages.all_clear.length>1?'s':'')+' — everything done</div>'
      +'</div>'
      +'</div>'
      +'<span style="font-size:11px;font-weight:600;color:var(--green)">▼ Show</span>'
      +'</summary>'
      +'<div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">'
      +stages.all_clear.map(p=>{
        const c = GC(p.contractorId);
        return '<div onclick="openDetail(\''+p.id+'\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:var(--rs);cursor:pointer" onmouseover="this.style.background=\'var(--border)\'" onmouseout="this.style.background=\'var(--surface2)\'">'
          +'<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--navy)">'+p.name+'</div>'
          +(c?'<div style="font-size:11px;color:var(--text3)">'+c.name+'</div>':'')
          +'</div>'
          +'<span style="font-size:11px;color:var(--green);font-weight:700">✅ Done</span>'
          +'</div>';
      }).join('')
      +'</div>'
      +'</details>'
      +'</div>';
  }

  html += '</div>';
  el.innerHTML = html;
  if(typeof applyToggleStates==='function') applyToggleStates();
}

// ─── DASHBOARD ALERT ─────────────────────────────────
function getPipelineDashboardAlert(){
  const projects = D.projects.filter(p=>!isArchived(p));
  const today = new Date();

  let urgent = 0, warning = 0;
  projects.forEach(p=>{
    const hasJV = !!p.jvDate;
    if(!hasJV) return;
    const hasEA = !!(p.eaNumber||(p.docVault&&p.docVault.ea));
    const hasPayment = (p.settlements||[]).filter(s=>!isArchived(s)).length>0;
    const wecReceived = !!p.wecReceived;
    const gstFiled = !!p.gstFiled;
    const refundApplied = !!p.refundApplied;

    // GST pending after payment
    if(hasPayment && !gstFiled) urgent++;
    // EMD overdue
    if(p.jvDate && !refundApplied){
      const twoYrs = new Date(p.jvDate); twoYrs.setFullYear(twoYrs.getFullYear()+2);
      const days = Math.round((twoYrs-today)/86400000);
      if(days<=0) urgent++;
      else if(days<=90) warning++;
    }
    // WEC pending
    if(hasEA && !wecReceived && !p.wecApplied) warning++;
    // ASD pending
    if(hasEA && (p.asd||0)>0 && !p.asdRefundApplied) warning++;
  });

  if(!urgent && !warning) return '';

  return '<div class="card" style="border-top:3px solid '+(urgent?'var(--red)':'var(--amber)')+';padding:12px;margin-bottom:14px">'
    +'<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">⚡ Pipeline Actions</div>'
    +(urgent?'<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--surface2)">'
      +'<div style="font-size:12px;font-weight:600;color:var(--red)">🚨 '+urgent+' urgent action'+(urgent>1?'s':'')+' needed</div>'
      +'</div>':'')
    +(warning?'<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--surface2)">'
      +'<div style="font-size:12px;font-weight:600;color:var(--amber)">⚠️ '+warning+' action'+(warning>1?'s':'')+' pending</div>'
      +'</div>':'')
    +'<button onclick="ownerTab(9)" style="margin-top:8px;background:none;border:none;font-size:11px;color:var(--navy);font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif">View Action Centre →</button>'
    +'</div>';
}
