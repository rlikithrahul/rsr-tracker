// ═══════════════════════════════════════
// projects.js
// RSR Constructions Tracker v17
// ═══════════════════════════════════════

async function openDetail(id){
  saveNavState(); // remember where we came from
  dpid=id;
  const p = GP(id);
  if(p){
    logProjectView(p);
    if(typeof pushDetailHistory === 'function') pushDetailHistory(id, p.name);
    if(typeof saveSessionState === 'function') saveSessionState();
  }
  document.querySelectorAll('.osec').forEach(e=>e.classList.add('hidden'));
  document.querySelectorAll('.nav-link').forEach(e=>e.classList.remove('active'));
  document.getElementById('sec-detail').classList.remove('hidden');
  // Show loading state immediately
  document.getElementById('detail-wrap').innerHTML='<div class="loading" style="padding:40px;text-align:center;color:var(--text3)"><div style="font-size:24px;margin-bottom:8px">⏳</div>Loading project…</div>';
  // If project already in cache, render immediately
  if(GP(id)){
    renderDetail(id);
    // Then fetch fresh in background silently
    fetchProjectFull(id).then(()=>renderDetail(id)).catch(()=>{});
  } else {
    // Fetch with timeout — if it takes more than 5s, render from cache anyway
    const timeout = new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),5000));
    try{
      await Promise.race([fetchProjectFull(id), timeout]);
    }catch(e){
      console.warn('fetchProjectFull slow/failed, using cache:', e.message);
    }
    renderDetail(id);
  }
}

function renderDetail(id){
  const p=GP(id); if(!p)return;
  const c=GC(p.contractorId);
  const rel=totRel(p),max=maxF(p),el=eligR(p),hw=hdroom(p),s=pStat(p);
  const lv=(p.verifications||[]).filter(v=>!isArchived(v)).slice(-1)[0];
  const pend=(p.contractorUpdates||[]).filter(u=>!u.reviewed&&!isArchived(u));
  const allUpdates=(p.contractorUpdates||[]).filter(u=>!isArchived(u)).slice().reverse();
  let ah='';
  if(s==='red') ah=`<div class="alert al-red">🚨 Warning: Funding is at ${Math.round(totRel(p)/maxF(p)*100)}% of agreement cap. Tally imports continue but review urgently.</div>`;
  else if(s==='amber') ah=`<div class="alert al-amber">🟡 Caution: ${Math.round(totRel(p)/maxF(p)*100)}% of funding cap used. Monitor closely.</div>`;
  else ah=`<div class="alert al-green">🟢 On Track — ${Math.round(totRel(p)/maxF(p)*100)}% of cap used. Available: ${fmt(hw)}</div>`;

  // Pending (unreviewed) block — full review controls
  const pendHtml=pend.length?`<div class="card" style="border-color:var(--navy);border-top:3px solid var(--gold)">
    <div class="st" style="color:var(--navy)">📸 Contractor Updates — Needs Review (${pend.length})</div>
    ${pend.map(u=>`<div style="background:var(--surface2);border-radius:var(--rs);padding:12px;margin-bottom:8px;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;flex-wrap:wrap;gap:8px">
        <div><span style="font-weight:700;font-size:13px">${u.date}</span> <span style="font-size:12px;color:var(--text3)">by ${u.submittedBy||'contractor'}</span></div>
      </div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:8px">${u.notes||'No notes'}</div>
      ${u.quantities&&Object.keys(u.quantities).length?`<div style="font-size:12px;margin-bottom:8px;font-weight:600;color:var(--navy)">Claimed: ${(p.boq||[]).filter(i=>u.quantities[i.id]).map(i=>`${i.desc}: ${u.quantities[i.id]} ${i.unit}`).join(' · ')}</div>`:''}
      ${u.photos&&u.photos.length?`<div class="pgrid">${u.photos.map(ph=>`<div class="pitem" onclick="lightbox('${ph.url}')"><img src="${ph.url}" loading="lazy" alt=""><div class="pcap">${ph.gps?'📍 '+ph.gps.area+' · '+(ph.captureTime||ph.gps.time):ph.captureTime?'🕐 '+ph.captureTime:'photo'}${ph.source==='camera'?' · 📷':ph.source==='gallery'?' · 🖼️':''}</div></div>`).join('')}</div>`:'<div style="font-size:12px;color:var(--text3)">No photos</div>'}
      <div class="upd-actions">
        <button class="btn btn-gold btn-sm" onclick="openReviewUpd('${id}','${u.id}')">📋 Review & Approve</button>
        <button class="btn-reject" onclick="(()=>{reviewUpdPid='${id}';reviewUpdId='${u.id}';document.getElementById('ru-notes').value='';rejectUpdate();})()">✗ Quick Reject</button>
        <button class="btn btn-sm" onclick="deleteUpdate('${id}','${u.id}')">🗑️ Delete</button>
      </div>
    </div>`).join('')}</div>`:'';

  // All updates log (permanent — never disappears)
  const allUpdHtml=allUpdates.length?`<div class="card"><div class="st">All Site Updates (${allUpdates.length} total)</div>
    ${allUpdates.map(u=>`<div style="padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px">
        <div><span style="font-weight:700;font-size:13px">${u.date}</span> <span style="font-size:12px;color:var(--text3)">by ${u.submittedBy||'contractor'}</span></div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="badge ${u.rejected?'bg-red':u.reviewed?'bg-green':'bg-navy'}">${u.rejected?'✗ Rejected':u.reviewed?'✓ Approved':'⏳ Pending'}</span>
          <div class="amenu-wrap">
            <button class="amenu-btn" onclick="event.stopPropagation();toggleMenu('um-${u.id}')">⋮</button>
            <div class="amenu" id="um-${u.id}">
              ${!u.reviewed?`<button class="amenu-item success" onclick="openReviewUpd('${id}','${u.id}')">📋 Review</button>`:''}
              <button class="amenu-item danger" onclick="deleteUpdate('${id}','${u.id}')">🗑️ Delete</button>
            </div>
          </div>
        </div>
      </div>
      ${u.reviewNotes?`<div style="font-size:12px;color:var(--text3);margin-bottom:4px;font-style:italic">RSR note: ${u.reviewNotes}</div>`:''}
      ${u.notes?`<div style="font-size:13px;color:var(--text2);margin-bottom:6px">${u.notes}</div>`:''}
      ${u.quantities&&Object.keys(u.quantities).length&&!u.rejected?`<div style="font-size:12px;margin-bottom:6px;font-weight:600;color:${u.approvedQty?'var(--green)':'var(--navy)'}">
        ${u.approvedQty?'Approved:':'Reported:'} ${(p.boq||[]).filter(i=>(u.approvedQty||u.quantities)[i.id]).map(i=>`${i.desc}: ${(u.approvedQty||u.quantities)[i.id]} ${i.unit}`).join(' · ')}
      </div>`:''}
      ${u.photos&&u.photos.length?`<div class="pgrid" style="grid-template-columns:repeat(4,1fr)">${u.photos.map(ph=>`<div class="pitem" onclick="lightbox('${ph.url}')"><img src="${ph.url}" loading="lazy" alt=""><div class="pcap">${ph.name||'photo'}</div></div>`).join('')}</div>`:''}
    </div>`).join('')}
  </div>`:'';

  const brows=(p.boq||[]).map(item=>{
    const rd = (p.reportedItems||{})[item.id]||0; // contractor reported (after review)
    const vd = lv?((lv.items||lv.quantities||{})[item.id]||0):0;        // RSR physically verified
    const rpct = item.qty?Math.round(rd/item.qty*100):0;
    const vpct = item.qty?Math.round(vd/item.qty*100):0;
    return `<tr>
      <td><strong>${item.desc}</strong></td>
      <td style="text-align:center">${item.unit}</td>
      <td style="text-align:center;font-weight:600">${item.qty}</td>
      <td style="text-align:center">
        <div style="font-weight:700;color:var(--amber)">${rd}</div>
        <div style="font-size:10px;color:var(--amber);margin-top:1px">${rpct}%</div>
      </td>
      <td style="text-align:center">
        <div style="font-weight:700;color:var(--navy)">${vd}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:1px">${vpct}%</div>
      </td>
      <td style="min-width:120px">
        <div style="margin-bottom:3px">
          <div style="display:flex;align-items:center;gap:4px">
            <div style="font-size:9px;color:var(--amber);width:52px">Reported</div>
            <div class="prog-track" style="flex:1;height:4px;background:rgba(176,96,0,.15)"><div style="height:100%;border-radius:4px;background:var(--amber);width:${rpct}%"></div></div>
          </div>
        </div>
        <div>
          <div style="display:flex;align-items:center;gap:4px">
            <div style="font-size:9px;color:var(--navy);width:52px">Verified</div>
            <div class="prog-track" style="flex:1;height:4px"><div class="prog-fill ${vpct>=90?'pf-green':vpct>=50?'pf-amber':'pf-red'}" style="width:${vpct}%"></div></div>
          </div>
        </div>
      </td>
      <td style="text-align:right;font-weight:700">${fmt(item.qty*item.rate)}</td>
    </tr>`;}).join('');
  const relLog=(p.releases||[]).slice().reverse().map(r=>`
    <div class="fr">
      <span class="fl">${r.date}<br>
        <span style="font-size:11px">${r.notes||''} · Vch #${r.ref||'—'} · ${r.method||''}</span><br>
        ${r.source==='tally'||r.source==='tally-manual'?'<span style="font-size:10px;background:rgba(26,39,68,.1);color:var(--navy);padding:1px 6px;border-radius:4px;font-weight:600">📂 Tally</span>':'<span style="font-size:10px;background:var(--amber-bg);color:var(--amber);padding:1px 6px;border-radius:4px;font-weight:600">✏️ Manual</span>'}
      </span>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="fv">${fmt(r.amount)}</span>
        ${(r.source!=='tally' || (CU && CU.isSuperAdmin))?`<div class="amenu-wrap">
          <button class="amenu-btn" onclick="event.stopPropagation();toggleMenu('rm-${r.id}')">⋮</button>
          <div class="amenu" id="rm-${r.id}">
            <button class="amenu-item" onclick="openEditRelease('${id}','${r.id}')">✏️ Edit</button>
            <button class="amenu-item danger" onclick="deleteRelease('${id}','${r.id}')">🗑️ Delete</button>
          </div>
        </div>`:''}
      </div>
    </div>`).join('')||'<div style="font-size:13px;color:var(--text3);padding:8px 0">No transactions yet. Import from Tally to populate.</div>';

  const settled=(p.settlements||[]).reduce((s,x)=>s+x.amount,0);
  const settleLog=(p.settlements||[]).filter(s=>!isArchived(s)).slice().reverse().map(s=>{
    const billBadge = s.billType && s.billType!=='Final Bill'
      ? `<span style="font-size:10px;background:#7c3aed;color:#fff;padding:1px 7px;border-radius:8px;font-weight:700;margin-left:4px">${s.billType}</span>`
      : '';
    return `<div class="settle-row" style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>🏦 ${s.date} · ${s.mode||''} ${s.ref?'· '+s.ref:''} ${s.notes?'· '+s.notes:''} ${billBadge}</span><div style="display:flex;align-items:center;gap:10px"><strong style="color:var(--green)">${fmt(s.amount)}</strong><button onclick="deleteSettlement('${id}','${s.id}')" title="Remove this settlement" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:13px;padding:2px 4px">🗑️</button></div></div>`;
  }).join('');

  const verLog=(p.verifications||[]).slice().reverse().map(v=>`
    <div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div>
        <div style="font-weight:700;font-size:13px">${v.date} <span style="font-size:12px;color:var(--text3)">by ${v.verifiedBy||'owner'}</span></div>
        <div style="font-size:13px;color:var(--text2)">${v.notes||'—'}</div>
      </div>
      <div class="amenu-wrap">
        <button class="amenu-btn" onclick="event.stopPropagation();toggleMenu('vm-${v.id}')">⋮</button>
        <div class="amenu" id="vm-${v.id}">
          <button class="amenu-item danger" onclick="deleteVerification('${id}','${v.id}')">🗑️ Delete</button>
        </div>
      </div>
    </div>`).join('')||'<div style="font-size:13px;color:var(--text3)">No verifications yet.</div>';
  const typeDisplay = (p.types&&p.types.length) ? p.types.join(' · ') : (p.type||'');

  // Build verHtml — verification history collapsible
  const verHtml = verLog && verLog !== '<div style="font-size:13px;color:var(--text3)">No verifications yet.</div>'
    ? `<div class="card" style="margin-bottom:12px">
        <details data-toggle="ver-${id}">
          <summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div class="st" style="margin:0;border:none;padding:0">📋 Verifications (${(p.verifications||[]).filter(v=>!isArchived(v)).length})</div>
            <span style="font-size:11px;font-weight:600;color:var(--navy)">▼ Show / Hide</span>
          </summary>
          <div style="margin-top:10px">${verLog}</div>
        </details>
      </div>` : '';

  // Build boqHtml — BOQ progress table
  const boqHtml = (()=>{
    if(!p.boq||!p.boq.length) return '<div style="font-size:13px;color:var(--text3);padding:8px">No BOQ items yet.</div>';
    return `<div class="tbl-wrap"><table><thead><tr>
      <th>Item</th><th>Unit</th><th style="text-align:right">BOQ Qty</th>
      <th style="text-align:right">Reported</th><th style="text-align:right">Verified</th>
      <th style="text-align:right">Value</th><th>Progress</th>
    </tr></thead><tbody>`+
    p.boq.map(item=>{
      const boqQty = item.qty||0;
      const reported = (p.reportedItems||{})[item.id]||0;
      const verified = (p.verifiedItems||{})[item.id]||0;
      const pct = boqQty>0?Math.round(verified/boqQty*100):0;
      const value = (item.rate||0)*(item.qty||0);
      return `<tr>
        <td style="font-size:12px">${item.desc||item.name||'—'}</td>
        <td style="font-size:12px">${item.unit||'—'}</td>
        <td style="text-align:right;font-size:12px">${boqQty}</td>
        <td style="text-align:right;font-size:12px;color:var(--amber)">${reported}</td>
        <td style="text-align:right;font-size:12px;color:var(--green);font-weight:700">${verified}</td>
        <td style="text-align:right;font-size:12px">${fmt(value)}</td>
        <td style="min-width:80px"><div style="background:var(--surface2);border-radius:4px;height:6px;overflow:hidden"><div style="height:100%;background:${pct>=100?'var(--green)':pct>=50?'var(--amber)':'var(--navy)'};width:${Math.min(pct,100)}%"></div></div><div style="font-size:10px;color:var(--text3);text-align:center">${pct}%</div></td>
      </tr>`;
    }).join('')+
    '</tbody></table></div>';
  })();
  document.getElementById('detail-wrap').innerHTML=`
    ${renderSettlementDetectionBanner(p)}
    ${isIncomplete(p) ? `<div style="background:#fff3cd;border:1.5px solid #ffc107;border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:flex-start;gap:10px">
      <div style="font-size:16px;line-height:1">🔴</div>
      <div style="flex:1">
        <div style="font-weight:700;color:#856404;font-size:12px;margin-bottom:4px">Incomplete — Missing: ${getMissingFields(p).join(', ')}</div>
        <div style="font-size:11px;color:#856404">Click ✏️ Edit to fill in missing details.</div>
      </div>
    </div>` : ''}

    ${(p.jvDate && (!p.jvNumber || !p.jvAmount)) ? `<div style="background:#fffbeb;border:1.5px solid var(--amber);border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:flex-start;gap:10px">
      <div style="font-size:16px;line-height:1">⚠️</div>
      <div style="flex:1">
        <div style="font-weight:700;color:#92400e;font-size:12px;margin-bottom:4px">JV Details Incomplete</div>
        <div style="font-size:11px;color:#92400e;margin-bottom:6px">JV received on ${fmtDate(p.jvDate)} but ${[!p.jvNumber?'JV Number':null,!p.jvAmount?'JV Amount':null].filter(Boolean).join(' and ')} not yet filled in.</div>
        <button onclick="openJVDetailsUpdate('${p.id}')" style="background:var(--amber);color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">Fill in JV Details →</button>
      </div>
    </div>` : ''}

    ${(p.documents?.billform && !p.billFormVerified) ? `<div style="background:#fffbeb;border:1.5px solid #f59e0b;border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:flex-start;gap:10px">
      <div style="font-size:16px;line-height:1">🧾</div>
      <div style="flex:1">
        <div style="font-weight:700;color:#92400e;font-size:12px;margin-bottom:4px">Bill Form Uploaded — JV Amount Not Verified</div>
        <div style="font-size:11px;color:#92400e;margin-bottom:6px">Please confirm whether the final JV amount on the Bill Form matches the recorded JV amount of ${fmt(p.jvAmount||0)}.</div>
        <button onclick="_showBillFormVerification('${p.id}')" style="background:#f59e0b;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">Verify JV Amount →</button>
      </div>
    </div>` : ''}

    <!-- NEW HEADER: compact back + meta + project name -->
    <div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="goBack()" style="flex-shrink:0;white-space:nowrap">← Back</button>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px">
          ${p.tender?`<span style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:2px 8px;font-weight:600;color:var(--text2)">#${p.tender}</span>`:''}
          <span style="background:#1a2744;color:var(--gold);border-radius:8px;padding:2px 8px;font-weight:700">${p.firm||'RSR'}</span>
          ${typeDisplay?`<span style="background:var(--surface2);border-radius:8px;padding:2px 8px;color:var(--text2)">${typeDisplay}</span>`:''}
          ${c?`<span style="background:var(--surface2);border-radius:8px;padding:2px 8px;color:var(--navy);font-weight:600;cursor:pointer" onclick="ownerTab(2)">👷 ${c.name}</span>`:''}
          ${p.location?`<span style="color:var(--text3)">📍 ${p.location}</span>`:''}
          ${statusBadge(p)}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-left:auto">
          <button class="btn btn-sm" onclick="openVer('${p.id}')">📋 Verify</button>
          <button class="btn btn-sm" style="background:var(--green);color:#fff;border:none;font-weight:700" onclick="openSettle('${p.id}')">🏦 Settle</button>
          <button class="btn btn-sm" onclick="openEditBOQ('${p.id}')">📊 Edit BOQ</button>
          <button class="btn btn-sm" onclick="openFullBOQModal('${p.id}')">👁 Full BOQ</button>
          <button class="btn btn-sm" onclick="openEditProject('${p.id}')">✏️ Edit</button>
          <button class="btn btn-sm" onclick="openOwnerNotes('${p.id}')">📝 Notes${p.ownerNotes?' ●':''}</button>
          <div class="amenu-wrap"><button class="amenu-btn" onclick="event.stopPropagation();toggleMenu('pdm-${p.id}')">⋮</button>
          <div class="amenu" id="pdm-${p.id}">
            <button class="amenu-item" onclick="openSettle('${p.id}')">🏦 Record Settlement</button>
            <button class="amenu-item" onclick="openExpectedJVMenu('${p.id}')">📅 Expected JV</button>
            <button class="amenu-item" onclick="changeProjectStatus('${p.id}','onhold')">⏸ Mark On Hold</button>
            <button class="amenu-item danger" onclick="deleteProject('${p.id}')">📦 Archive</button>
          </div></div>
        </div>
      </div>
      <div style="font-size:20px;font-weight:800;color:var(--navy);line-height:1.3;padding:4px 0 0">${p.name}</div>
    </div>

    ${ah}
    ${pendHtml}
    ${verHtml}

    <!-- MAIN CONTENT GRID: Financials + Lifecycle side by side on desktop -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px" class="detail-main-grid">

      <!-- LEFT: Financials -->
      <div class="card" style="padding:16px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">💰 Financials</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${[
            ['Estimated BOQ', fmt(p.estimated||0)],
            ['Bid %', (p.bidPct||0)+'%'],
            ['Agreement Amount', fmt(agAmt(p))],
            ['Max Fundable (70%)', fmt(max)],
            null, // separator
            ['Paid to Contractor', fmt(totPayments(p)), 'color:var(--navy)'],
            ...(totReceipts(p)>0 ? [['Received from Govt (Tally)', '− '+fmt(totReceipts(p)), 'color:var(--green);font-weight:700']] : []),
            ['Net Deployed (at risk)', fmt(rel), rel>max?'color:var(--red);font-weight:800':'color:var(--navy);font-weight:800'],
            ['Cap Used', Math.round(rel/Math.max(max,1)*100)+'%', rel/Math.max(max,1)>=0.85?'color:var(--red);font-weight:800':''],
            null, // separator
            ['Settled (govt payment)', fmt((p.settlements||[]).filter(s=>!isArchived(s)).reduce((s,x)=>s+x.amount,0)), 'color:var(--green)'],
            ['Outstanding', fmt(Math.max(0,rel-((p.settlements||[]).filter(s=>!isArchived(s)).reduce((s,x)=>s+x.amount,0)))), 'color:var(--red)'],
            ['Eligible (verified)', fmt(el)],
          ].filter(x=>x!==undefined).map(row=>row===null
            ? `<div style="border-top:1px solid var(--border);margin:4px 0"></div>`
            : `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--surface2)">
            <span style="font-size:12px;color:var(--text2)">${row[0]}</span>
            <span style="font-size:13px;font-weight:700;${row[2]||'color:var(--navy)'}">${row[1]}</span>
          </div>`).join('')}
          <div style="font-size:11px;color:var(--text3);margin-top:6px">
            <a href="#" onclick="ownerTab(4);return false" style="color:var(--navy)">📈 View interest in Interest tab →</a>
          </div>
          <div style="font-size:11px;color:var(--text3)">Tally Cost Centre: <strong>${p.costCentre||'—'}</strong></div>
        </div>
      </div>

      <!-- RIGHT: Project Lifecycle -->
      <div>${buildLifecycleTimeline(p,id)}</div>
    </div>

    <!-- SECOND ROW: Fund Releases + Material Credit (both collapsed by default) -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px" class="detail-main-grid">

      <!-- Fund Releases -->
      <div class="card">
        <details data-toggle="funds-${id}">
          <summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:4px">
            <div class="st" style="margin:0;border:none;padding:0">Fund Releases <span style="font-size:11px;font-weight:500;color:var(--text3)">(${(p.releases||[]).filter(r=>!isArchived(r)).length} entries)</span></div>
            <span style="font-size:11px;font-weight:600;color:var(--navy)">▼ Show / Hide</span>
          </summary>
          <div style="margin-top:12px">${relLog}</div>
          ${settleLog?`<div style="margin-top:14px"><div class="st">Government Payments Received</div>${settleLog}</div>`:''}
        </details>
      </div>

      <!-- Material Credit -->
      <div>${renderProjectMatCredit(p)}</div>
    </div>

    <!-- BOQ Progress (collapsed by default) -->
    <div class="card" style="margin-bottom:14px">
      <details data-toggle="boq-${id}">
        <summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div class="st" style="margin:0;border:none;padding:0">📊 BOQ Progress</div>
          <span style="font-size:11px;font-weight:600;color:var(--navy)">▼ Show / Hide</span>
        </summary>
        <div style="margin-top:14px">${boqHtml}</div>
      </details>
    </div>

    <!-- Settlement Detection -->
    ${renderSettlementDetectionBanner ? '' : ''}

    <!-- Document Vault -->
    <div id="doc-vault-${id}">${typeof renderDocVault==='function'?renderDocVault(p,true):''}</div>

    ${p.jvDate && typeof renderProjectWEXSection==='function' ? renderProjectWEXSection(p) : ''}

    <!-- Work Progress Photo Timeline (all contractor updates with dates + photos) -->
    ${(p.contractorUpdates&&p.contractorUpdates.filter(u=>!isArchived(u)).length>0)?`
    <div class="card" style="margin-bottom:14px">
      <details data-toggle="admin-progress-${id}">
        <summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div class="st" style="margin:0;border:none;padding:0">📸 Work Progress Photos (${p.contractorUpdates.filter(u=>!isArchived(u)).length})</div>
          <span style="font-size:11px;font-weight:600;color:var(--navy)">▼ Show / Hide</span>
        </summary>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:12px">
          ${p.contractorUpdates.filter(u=>!isArchived(u)).slice().reverse().map(u=>`
            <div style="background:var(--surface2);border-radius:var(--rs);padding:12px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px">
                <div style="font-size:12px;font-weight:700;color:var(--navy)">${fmtDate(u.date)}</div>
                <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:${u.reviewed?'var(--green)':'var(--amber)'};color:#fff">${u.reviewed?'✓ Reviewed':'⏳ Pending Review'}</span>
              </div>
              ${u.notes?`<div style="font-size:13px;color:var(--text2);margin-bottom:8px">${u.notes}</div>`:''}
              ${(u.photos&&u.photos.length)?`<div style="display:flex;gap:6px;flex-wrap:wrap">
                ${u.photos.map(ph=>`<img src="${ph.url}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;cursor:pointer;border:1px solid var(--border)" onclick="lightbox('${ph.url}')">`).join('')}
              </div>`:`<div style="font-size:11px;color:var(--text3)">No photos attached</div>`}
            </div>`).join('')}
        </div>
      </details>
    </div>`:''}

    <!-- Site Documents uploaded by contractor -->
    ${(p.siteDocuments&&p.siteDocuments.filter(d=>!isArchived(d)).length>0)?`
    <div class="card" style="margin-bottom:14px">
      <details data-toggle="admin-sitedocs-${id}">
        <summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div class="st" style="margin:0;border:none;padding:0">📁 Contractor Site Documents (${p.siteDocuments.filter(d=>!isArchived(d)).length})</div>
          <span style="font-size:11px;font-weight:600;color:var(--navy)">▼ Show / Hide</span>
        </summary>
        <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:10px">
          ${p.siteDocuments.filter(d=>!isArchived(d)).map(d=>`
            <div style="width:120px">
              ${d.type==='image'
                ? `<img src="${d.url}" style="width:120px;height:90px;object-fit:cover;border-radius:var(--rs);cursor:pointer;border:1px solid var(--border)" onclick="lightbox('${d.url}')">`
                : `<a href="${d.url}" target="_blank" style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:120px;height:90px;background:var(--surface2);border-radius:var(--rs);border:1px solid var(--border);text-decoration:none"><span style="font-size:28px">📄</span></a>`}
              <div style="font-size:10px;color:var(--text3);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.name}</div>
              <div style="font-size:10px;color:var(--text3)">${d.uploadedBy||''} · ${fmtDate(d.uploadedAt)}</div>
            </div>`).join('')}
        </div>
      </details>
    </div>`:''}

    <!-- Activity log for this project -->
    <div class="card" style="margin-bottom:14px">
      <details data-toggle="activity-${id}">
        <summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div class="st" style="margin:0;border:none;padding:0">📋 Project Activity</div>
          <span style="font-size:11px;font-weight:600;color:var(--navy)">▼ Show / Hide</span>
        </summary>
        <div style="margin-top:12px" id="proj-activity-${id}">
          <button onclick="loadProjActivity('${id}')" style="background:none;border:1px solid var(--border);border-radius:var(--rs);padding:6px 14px;font-size:12px;cursor:pointer;font-family:'Inter',sans-serif;color:var(--navy)">Load Activity Log</button>
        </div>
      </details>
    </div>
  `;

  // Restore toggle states for this project
  if(typeof applyToggleStates === 'function') applyToggleStates();

function buildLifecycleTimeline(p, id){
  const today = new Date();

  // ── Determine each stage ──────────────────────────
  const hasJV = !!p.jvDate;
  const hasEA = !!(p.eaNumber||(p.documents&&p.documents.ea));
  const wecApplied = !!p.wecApplied;
  // WEC is considered "done" if EITHER: formally marked received, OR the
  // certificate document is uploaded, OR work experience quantities have
  // been entered for this project. Any one of these is real evidence
  // the certificate was received — don't ask for it again.
  const wecDocUploaded = !!(p.documents && p.documents.wec);
  const wecHasWEXEntry = typeof getWEXEntries==='function' && getWEXEntries(p).length>0;
  const wecReceived = !!p.wecReceived || wecDocUploaded || wecHasWEXEntry;
  const checkCount = (p.settlements||[]).filter(s=>!isArchived(s)).length;
  const hasPayment = checkCount > 0;
  const gstFiled = !!(p.gstFiled);
  const refundApplied = !!p.refundApplied;
  const refundReceived = !!p.refundReceived;

  // ASD refund — eligible immediately after EA number
  const asdAmount = p.asd||0;
  const asdApplied = !!p.asdRefundApplied;
  const asdReceived = !!p.asdRefundReceived;
  const asdEligible = hasEA && asdAmount > 0;

  // EMD/FSD refund eligibility (2 years from JV)
  let refundDaysLeft = null;
  let refundEligible = false;
  if(p.jvDate){
    const twoYears = new Date(p.jvDate);
    twoYears.setFullYear(twoYears.getFullYear()+2);
    refundDaysLeft = Math.round((twoYears-today)/86400000);
    refundEligible = refundDaysLeft <= 0;
  }

  // WEC deadline (3 months from EA)
  let wecDaysLeft = null;
  if(hasEA && !wecReceived && p.eaDate){
    const wecDeadline = new Date(p.eaDate);
    wecDeadline.setMonth(wecDeadline.getMonth()+3);
    wecDaysLeft = Math.round((wecDeadline-today)/86400000);
  }

  // GST quarter from first settlement
  let gstQuarterLabel = '';
  if(hasPayment){
    const firstCheck = (p.settlements||[]).filter(s=>!isArchived(s))[0];
    if(firstCheck && firstCheck.date){
      const d = new Date(firstCheck.date);
      const m = d.getMonth()+1;
      const y = d.getFullYear();
      if(m>=4&&m<=6) gstQuarterLabel = 'Q1 Apr-Jun '+y;
      else if(m>=7&&m<=9) gstQuarterLabel = 'Q2 Jul-Sep '+y;
      else if(m>=10&&m<=12) gstQuarterLabel = 'Q3 Oct-Dec '+y;
      else gstQuarterLabel = 'Q4 Jan-Mar '+y;
    }
  }

  // ── Build stages ──────────────────────────────────
  const stages = [
    {
      icon:'🏗️', label:'Running / Active',
      done: true, // always done if we're viewing this project
      date: p.agreeDate ? 'From '+fmtDate(p.agreeDate) : '',
      action: null
    },
    {
      icon:'📄', label:'JV Received',
      done: hasJV,
      date: hasJV ? fmtDate(p.jvDate)+' · JV #'+(p.jvNumber||'—') : '',
      pending: !hasJV ? 'Waiting for JV from GVMC' : '',
      action: null
    },
    {
      icon:'🔢', label:'EA Number',
      done: hasEA,
      date: hasEA ? (p.eaNumber||(p.documents&&p.documents.ea)||'') : '',
      pending: hasJV && !hasEA ? 'Awaiting EA number (usually 2-2.5 months after JV)' : '',
      locked: !hasJV,
      action: null
    },
    {
      icon:'📜', label:'Work Experience Certificate',
      done: wecReceived,
      date: wecReceived ? 'Received '+(p.wecReceivedDate?fmtDate(p.wecReceivedDate):'') : wecApplied ? '⏳ Applied '+fmtDate(p.wecAppliedDate)+' — awaiting receipt' : '',
      pending: hasEA && !wecReceived && !wecApplied ? (wecDaysLeft!==null&&wecDaysLeft<30?'⚠️ Apply NOW — deadline in '+wecDaysLeft+' days':'Apply for WEC — EA number received') : '',
      warning: wecDaysLeft!==null&&wecDaysLeft<30&&!wecReceived,
      locked: !hasEA,
      actions: hasEA && !wecReceived ? (wecApplied
        ? '<button class="btn btn-sm btn-navy" onclick="markWECReceived(\''+id+'\')">✓ Mark WEC Received</button>'
          +'<button class="btn btn-sm" style="background:#e8f5e9;color:#16a34a;border:1px solid #86efac;font-weight:700" onclick="openLetterModal(\''+id+'\',\'wec\')">📄 Download WEC Letter</button>'
        : '<button class="btn btn-sm" style="background:#f59e0b;color:#fff;border:none;border-radius:var(--rs);padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif" onclick="markWECApplied(\''+id+'\')">✓ Mark WEC Applied</button>'
          +'<button class="btn btn-sm" style="background:#e8f5e9;color:#16a34a;border:1px solid #86efac;font-weight:700" onclick="openLetterModal(\''+id+'\',\'wec\')">📄 Download WEC Letter</button>') : ''
    },
    // ASD REFUND — eligible immediately after EA number
    ...(asdAmount > 0 ? [{
      icon:'💵', label:'ASD Refund',
      done: asdReceived,
      date: asdReceived ? 'Received — '+fmt(asdAmount) : asdApplied ? '⏳ Applied — awaiting refund of '+fmt(asdAmount) : hasEA ? '🟢 Eligible now — '+fmt(asdAmount)+' can be claimed' : '',
      pending: asdEligible && !asdApplied ? '⚠️ Apply for ASD refund — eligible after EA number' : '',
      warning: asdEligible && !asdApplied,
      locked: !hasEA,
      detail: 'ASD: '+fmt(asdAmount)+' · Eligible from day EA number received',
      actions: asdEligible && !asdApplied
        ? '<button class="btn btn-sm" style="background:#f59e0b;color:#fff;border:none;border-radius:var(--rs);padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif" onclick="markASDApplied(\''+id+'\')">✓ Mark ASD Applied</button>'
          +'<button class="btn btn-sm" style="background:#e8f5e9;color:#16a34a;border:1px solid #86efac;font-weight:700" onclick="openLetterModal(\''+id+'\',\'asd\')">📄 Download ASD Letter</button>'
        : asdApplied && !asdReceived ? '<button class="btn btn-sm btn-navy" onclick="markASDReceived(\''+id+'\')">✓ Mark ASD Received</button>' : ''
    }] : []),
    {
      icon:'💰', label:'Payment Received from GVMC',
      done: hasPayment,
      date: hasPayment ? checkCount+' payment'+(checkCount>1?'s':'')+' received · View in Fund Releases' : '',
      pending: !hasPayment ? 'Waiting for GVMC payment' : '',
      locked: false,
      action: null
    },
    {
      icon:'🧾', label:'GST Filing',
      done: gstFiled,
      date: gstFiled ? 'Filed — Q: '+(p.gstFiledQuarter||'') : hasPayment ? 'Quarter: '+gstQuarterLabel : '',
      pending: hasPayment && !gstFiled ? '⚠️ File GST for this quarter — '+gstQuarterLabel : '',
      warning: hasPayment && !gstFiled,
      locked: !hasPayment,
      actions: hasPayment ? '<button class="btn btn-sm" style="background:var(--navy);color:#fff;border:none;border-radius:var(--rs);padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif" onclick="openGSTProjectPanel(\''+id+'\')">🧾 Open GST Details</button>' : ''
    },
    {
      icon:'🏦', label:'EMD / FSD Refund',
      done: refundReceived,
      date: refundReceived ? 'Refund received' : refundApplied ? '⏳ Applied '+fmtDate(p.refundAppliedDate)+' — awaiting refund' :
        refundDaysLeft!==null ? (refundEligible ? '🔴 Eligible NOW — apply immediately' : 'Eligible in '+Math.max(0,refundDaysLeft)+' days ('+fmtDate(new Date(new Date(p.jvDate).setFullYear(new Date(p.jvDate).getFullYear()+2)))+')') : '',
      pending: refundEligible && !refundApplied ? '⚠️ 2 years since JV — apply for EMD/FSD refund NOW' : '',
      warning: refundEligible && !refundReceived,
      locked: !hasJV,
      detail: (p.emd||p.fsd) ? 'EMD: '+fmt(p.emd||0)+' · FSD: '+fmt(p.fsd||0) : '',
      actions: hasJV && refundEligible && !refundApplied
        ? '<button class="btn btn-sm" style="background:var(--red);color:#fff;border:none;border-radius:var(--rs);padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif" onclick="markRefundApplied(\''+id+'\')">✓ Mark Applied</button>'
          +'<button class="btn btn-sm" style="background:#e8f5e9;color:#16a34a;border:1px solid #86efac;font-weight:700" onclick="openLetterModal(\''+id+'\',\'emd_fsd\')">📄 Download EMD/FSD Letter</button>'
        : refundApplied && !refundReceived ? '<button class="btn btn-sm btn-navy" onclick="markRefundReceived(\''+id+'\')">✓ Mark Received</button>'
          +'<button class="btn btn-sm" style="background:#e8f5e9;color:#16a34a;border:1px solid #86efac;font-weight:700" onclick="openLetterModal(\''+id+'\',\'emd_fsd\')">📄 Re-Download Letter</button>' : ''
    },
    {
      icon:'✅', label:'Project Fully Closed',
      done: refundReceived && gstFiled && wecReceived,
      date: refundReceived && gstFiled && wecReceived ? 'All stages complete — data retained for 10 years' : '',
      pending: '',
      locked: !(refundReceived && gstFiled && wecReceived)
    }
  ];

  // ── Render timeline ───────────────────────────────
  const stagesHtml = stages.map((s,i)=>{
    const isDone = s.done;
    const isLocked = s.locked && !isDone;
    const isWarning = s.warning;
    const dotColor = isDone?'var(--green)':isWarning?'var(--red)':isLocked?'var(--border)':'var(--amber)';
    const dotBg = isDone?'#e8f5e9':isWarning?'#fef2f2':isLocked?'var(--surface2)':'#fffbeb';

    return '<div style="display:flex;gap:12px;margin-bottom:'+(i===stages.length-1?'0':'16px')+'">'
      // Dot + line
      +'<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">'
      +'<div style="width:28px;height:28px;border-radius:50%;background:'+dotBg+';border:2px solid '+dotColor+';display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">'
      +(isDone?'✓':isLocked?'○':s.icon)
      +'</div>'
      +(i<stages.length-1?'<div style="width:2px;flex:1;background:'+(isDone?'var(--green)':'var(--border)')+';min-height:16px;margin-top:2px"></div>':'')
      +'</div>'
      // Content
      +'<div style="flex:1;padding-bottom:4px">'
      +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
      +'<div style="font-size:13px;font-weight:700;color:'+(isLocked?'var(--text3)':isDone?'var(--text1)':'var(--navy)')+'">'+s.label+'</div>'
      +(isDone?'<span style="font-size:10px;font-weight:700;color:var(--green);background:#e8f5e9;padding:1px 6px;border-radius:8px">✓ DONE</span>':'')
      +(isWarning?'<span style="font-size:10px;font-weight:700;color:var(--red);background:#fef2f2;padding:1px 6px;border-radius:8px">⚠️ ACTION NEEDED</span>':'')
      +'</div>'
      +(s.date?'<div style="font-size:11px;color:var(--text2);margin-top:2px">'+s.date+'</div>':'')
      +(s.detail?'<div style="font-size:11px;color:var(--text3);margin-top:1px">'+s.detail+'</div>':'')
      +(s.pending?'<div style="font-size:11px;color:'+(isWarning?'var(--red)':'#92400e')+';margin-top:3px;font-weight:600">'+s.pending+'</div>':'')
      +(s.actions?'<div style="margin-top:8px">'+s.actions+'</div>':'')
      +'</div>'
      +'</div>';
  }).join('');

  return '<div class="card" style="margin-bottom:14px">'
    +'<details open>'
    +'<summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:0">'
    +'<div class="st" style="margin:0;border:none;padding:0">📋 Project Lifecycle</div>'
    +'<span style="font-size:11px;font-weight:600;color:var(--navy)">▼ Show / Hide</span>'
    +'</summary>'
    +'<div style="margin-top:16px">'+stagesHtml+'</div>'
    +'</details>'
    +'</div>';
}

// ═══════════════════════════════════════════════════════
// GST PROJECT PANEL
// ═══════════════════════════════════════════════════════
function openGSTProjectPanel(pid){
  const p = GP(pid); if(!p) return;

  // Calculate from settlements
  const settlements = (p.settlements||[]).filter(s=>!isArchived(s));
  const totalReceived = settlements.reduce((s,x)=>s+x.amount,0);

  // Base value = amount ÷ 1.16 (since 2% TDS already deducted)
  const baseValue = p.gstBaseOverride || Math.round(totalReceived/1.16);
  const gst18 = p.gstOutputOverride || Math.round(baseValue*0.18);
  const tdsCredit = p.gstTDSOverride || Math.round(baseValue*0.02);
  const cashGST = gst18 - tdsCredit;

  // Split
  const rsrPct = p.gstRSRPct !== undefined ? p.gstRSRPct : 35;
  const subPct = 100 - rsrPct;
  const rsrOutput = p.gstRSROutputOverride || Math.round(gst18*(rsrPct/100));
  const subOutput = p.gstSubOutputOverride || Math.round(gst18*(subPct/100));

  // ITC
  const rsrITC = p.gstRSRITC || 0;
  const subITC = p.gstSubITC || 0;
  const rsrITCFiled = !!p.gstRSRITCFiled;
  const subITCFiled = !!p.gstSubITCFiled;

  // Quarter
  let quarter = p.gstQuarter || '';
  if(!quarter && settlements.length){
    const d = new Date(settlements[0].date);
    const m = d.getMonth()+1; const y = d.getFullYear();
    if(m>=4&&m<=6) quarter='Q1 Apr-Jun '+y;
    else if(m>=7&&m<=9) quarter='Q2 Jul-Sep '+y;
    else if(m>=10&&m<=12) quarter='Q3 Oct-Dec '+y;
    else quarter='Q4 Jan-Mar '+y;
  }

  let modal = document.getElementById('modal-gst-proj');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-gst-proj'; document.body.appendChild(modal); }

  modal.innerHTML = '<div class="mbox" style="max-width:560px">'
    +'<div class="mhdr"><h2>🧾 GST — '+p.name.substring(0,40)+(p.name.length>40?'...':'')+'</h2><button class="mx" onclick="CM(\'modal-gst-proj\')">✕</button></div>'

    // Quarter info
    +'<div style="background:var(--surface2);border-radius:var(--rs);padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--text2)">'
    +'📅 Filing Quarter: <strong style="color:var(--navy)">'+quarter+'</strong>'
    +' &nbsp;·&nbsp; Total Received: <strong>'+fmt(totalReceived)+'</strong>'
    +'</div>'

    // Output tax section
    +'<div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Output Tax (from GVMC payment)</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">'
    +'<div class="fg"><label style="font-size:11px">Base Value (÷1.16)</label><input type="number" id="gp-base" value="'+baseValue+'" oninput="recalcGSTPanel()"></div>'
    +'<div class="fg"><label style="font-size:11px">GST 18% (₹)</label><input type="number" id="gp-gst18" value="'+gst18+'" oninput="recalcGSTPanel()"></div>'
    +'<div class="fg"><label style="font-size:11px">TDS Credit 2% (₹)</label><input type="number" id="gp-tds" value="'+tdsCredit+'" oninput="recalcGSTPanel()"></div>'
    +'</div>'
    +'<div style="background:#e8f5e9;border-radius:var(--rs);padding:10px 14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">'
    +'<span style="font-size:12px;color:var(--text2)">Net Cash GST to pay (18% - 2% TDS)</span>'
    +'<strong id="gp-net-cash" style="color:var(--red);font-size:14px">'+fmt(cashGST)+'</strong>'
    +'</div>'

    // Split section
    +'<div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Filing Split</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">'

    // RSR portion
    +'<div style="border:1.5px solid var(--border);border-radius:var(--rs);padding:12px">'
    +'<div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">🏢 RSR Files</div>'
    +'<div class="fg" style="margin-bottom:6px"><label style="font-size:11px">RSR % of work</label><input type="number" id="gp-rsr-pct" value="'+rsrPct+'" min="0" max="100" oninput="recalcGSTPanel()"></div>'
    +'<div class="fg" style="margin-bottom:6px"><label style="font-size:11px">RSR Output GST (₹)</label><input type="number" id="gp-rsr-output" value="'+rsrOutput+'"></div>'
    +'<div class="fg" style="margin-bottom:6px"><label style="font-size:11px">RSR ITC Claimed (₹)</label><input type="number" id="gp-rsr-itc" value="'+rsrITC+'"></div>'
    +'<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;margin-top:4px">'
    +'<input type="checkbox" id="gp-rsr-filed" '+(rsrITCFiled?'checked':'')+'>RSR portion filed in GSTR-1</label>'
    +'</div>'

    // Subcontractor portion
    +'<div style="border:1.5px solid var(--border);border-radius:var(--rs);padding:12px">'
    +'<div style="font-size:12px;font-weight:700;color:#7b3f00;margin-bottom:8px">👷 Contractor Files</div>'
    +'<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Auto = 100% - RSR%</div>'
    +'<div class="fg" style="margin-bottom:6px"><label style="font-size:11px">Contractor Output GST (₹)</label><input type="number" id="gp-sub-output" value="'+subOutput+'"></div>'
    +'<div class="fg" style="margin-bottom:6px"><label style="font-size:11px">Contractor ITC (₹) — if RSR pays</label><input type="number" id="gp-sub-itc" value="'+subITC+'"></div>'
    +'<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;margin-top:4px">'
    +'<input type="checkbox" id="gp-sub-filed" '+(subITCFiled?'checked':'')+'>Contractor filed in GSTR-1</label>'
    +'</div>'
    +'</div>'

    // Mark as fully filed
    +'<div style="background:'+(p.gstFiled?'#e8f5e9':'#fff3cd')+';border-radius:var(--rs);padding:10px 14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'
    +'<div>'
    +'<div style="font-size:12px;font-weight:700">GST Status: '+(p.gstFiled?'<span style="color:var(--green)">✅ Filed</span>':'<span style="color:var(--amber)">⏳ Pending</span>')+'</div>'
    +(p.gstFiledDate?'<div style="font-size:11px;color:var(--text3)">Filed on '+fmtDate(p.gstFiledDate)+'</div>':'')
    +'</div>'
    +(p.gstFiled
      ? '<button class="btn btn-sm" onclick="saveGSTProject(\''+pid+'\',false)">↩ Mark Unfiled</button>'
      : '<button class="btn btn-sm" style="background:var(--green);color:#fff;border:none;font-weight:700;border-radius:var(--rs);padding:6px 14px;font-size:12px;cursor:pointer;font-family:\'Inter\',sans-serif" onclick="saveGSTProject(\''+pid+'\',true)">✅ Mark GST as Filed</button>')
    +'</div>'

    +'<div style="display:flex;gap:8px;justify-content:flex-end">'
    +'<button class="btn" onclick="CM(\'modal-gst-proj\')">Cancel</button>'
    +'<button class="btn btn-navy" onclick="saveGSTProject(\''+pid+'\',null)">💾 Save GST Details</button>'
    +'</div>'
    +'</div>';

  modal.classList.add('open');
}

function recalcGSTPanel(){
  const base = parseFloat(document.getElementById('gp-base')?.value)||0;
  const gst18 = parseFloat(document.getElementById('gp-gst18')?.value)||(base*0.18);
  const tds = parseFloat(document.getElementById('gp-tds')?.value)||(base*0.02);
  const net = gst18-tds;
  const netEl = document.getElementById('gp-net-cash');
  if(netEl) netEl.textContent = '₹'+Math.round(net).toLocaleString('en-IN');
  // Auto-calc RSR output from %
  const rsrPct = parseFloat(document.getElementById('gp-rsr-pct')?.value)||35;
  const rsrOut = document.getElementById('gp-rsr-output');
  if(rsrOut) rsrOut.value = Math.round(gst18*(rsrPct/100));
  const subOut = document.getElementById('gp-sub-output');
  if(subOut) subOut.value = Math.round(gst18*((100-rsrPct)/100));
}

async function saveGSTProject(pid, markFiled){
  const p = GP(pid); if(!p) return;
  p.gstBaseOverride = parseFloat(document.getElementById('gp-base')?.value)||0;
  p.gstOutputOverride = parseFloat(document.getElementById('gp-gst18')?.value)||0;
  p.gstTDSOverride = parseFloat(document.getElementById('gp-tds')?.value)||0;
  p.gstRSRPct = parseFloat(document.getElementById('gp-rsr-pct')?.value)||35;
  p.gstRSROutputOverride = parseFloat(document.getElementById('gp-rsr-output')?.value)||0;
  p.gstRSRITC = parseFloat(document.getElementById('gp-rsr-itc')?.value)||0;
  p.gstRSRITCFiled = document.getElementById('gp-rsr-filed')?.checked||false;
  p.gstSubOutputOverride = parseFloat(document.getElementById('gp-sub-output')?.value)||0;
  p.gstSubITC = parseFloat(document.getElementById('gp-sub-itc')?.value)||0;
  p.gstSubITCFiled = document.getElementById('gp-sub-filed')?.checked||false;
  if(markFiled===true){ p.gstFiled=true; p.gstFiledDate=new Date().toISOString().split('T')[0]; }
  if(markFiled===false){ p.gstFiled=false; p.gstFiledDate=null; }
  try{
    await saveProjectDB(p,{type:'gst_update',amount:0,ref:null,meta:{filed:p.gstFiled}});
    CM('modal-gst-proj');
    renderDetail(pid);
    toast('✓ GST details saved','ok');
  }catch(e){ toast('Save failed','error'); }
}

async function markRefundReceived(pid){
  const p = GP(pid); if(!p) return;
  p.refundReceived = true;
  p.refundReceivedDate = new Date().toISOString().split('T')[0];
  try{
    await saveProjectDB(p,{type:'refund_received',amount:0,ref:null,meta:{}});
    renderDetail(pid);
    toast('✓ Refund marked as received','ok');
  }catch(e){ toast('Save failed','error'); }
}
}

// ─── PROJECT ACTIVITY LOG LOADER ──────────────────────
async function loadProjActivity(pid){
  const el = document.getElementById('proj-activity-'+pid);
  if(!el) return;
  el.innerHTML = '<div style="font-size:12px;color:var(--text3)">Loading…</div>';
  if(typeof renderActivityLog === 'function'){
    const wrapperId = 'proj-activity-log-'+pid;
    el.innerHTML = '<div id="'+wrapperId+'"></div>';
    await renderActivityLog(wrapperId, {projectId:pid, limit:50});
  } else {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3)">Activity log not available.</div>';
  }
}
