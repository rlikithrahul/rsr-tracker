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
    const vd = lv?(lv.items[item.id]||0):0;        // RSR physically verified
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
        ${r.source!=='tally'?`<div class="amenu-wrap">
          <button class="amenu-btn" onclick="event.stopPropagation();toggleMenu('rm-${r.id}')">⋮</button>
          <div class="amenu" id="rm-${r.id}">
            <button class="amenu-item" onclick="openEditRelease('${id}','${r.id}')">✏️ Edit</button>
            <button class="amenu-item danger" onclick="deleteRelease('${id}','${r.id}')">🗑️ Delete</button>
          </div>
        </div>`:''}
      </div>
    </div>`).join('')||'<div style="font-size:13px;color:var(--text3);padding:8px 0">No transactions yet. Import from Tally to populate.</div>';

  const settled=(p.settlements||[]).reduce((s,x)=>s+x.amount,0);
  const settleLog=(p.settlements||[]).filter(s=>!isArchived(s)).slice().reverse().map(s=>`<div class="settle-row" style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>🏦 ${s.date} · ${s.mode||''} ${s.ref?'· '+s.ref:''} · ${s.notes||''}</span><div style="display:flex;align-items:center;gap:10px"><strong style="color:var(--green)">${fmt(s.amount)}</strong><button onclick="deleteSettlement('${id}','${s.id}')" title="Remove this settlement" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:13px;padding:2px 4px">🗑️</button></div></div>`).join('');

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
  document.getElementById('detail-wrap').innerHTML=`
    ${renderSettlementDetectionBanner(p)}
    ${isIncomplete(p) ? `<div style="background:#fff3cd;border:1.5px solid #ffc107;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:flex-start;gap:10px">
      <div style="font-size:18px;line-height:1">🔴</div>
      <div style="flex:1">
        <div style="font-weight:700;color:#856404;font-size:13px;margin-bottom:6px">Incomplete Project — Missing Fields</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${getMissingFields(p).map(f=>`<span style="background:#856404;color:#fff;border-radius:12px;padding:2px 10px;font-size:11px;font-weight:600">${f}</span>`).join('')}
        </div>
        <div style="font-size:11px;color:#856404;margin-top:8px">Click <strong>✏️ Edit</strong> to fill in missing details. This banner disappears once all fields are complete.</div>
      </div>
    </div>` : ''}
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <button class="btn btn-sm" onclick="goBack()">← Back</button>
      <div style="flex:1;min-width:200px"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div style="font-size:18px;font-weight:700;color:var(--navy)">${p.name}</div>${statusBadge(p)}</div>
      <div style="font-size:12px;color:var(--text3)">#${p.tender} · <span style="color:var(--gold);font-weight:600">${p.firm||'RSR Constructions'}</span> · ${p.type} · ${c?`<span onclick="ownerTab(2)" style="color:var(--navy);font-weight:600;cursor:pointer">${c.name}</span>`:'—'} · ${p.location||''}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="openVer('${p.id}')">📋 Verify</button>
        <button class="btn btn-green btn-sm" onclick="openSettle('${p.id}')">🏦 Settle</button>
        <button class="btn btn-sm" onclick="openEditBOQ('${p.id}')">📊 Edit BOQ</button>
        <button class="btn btn-sm" onclick="toggleFullBOQ('boq-full-${p.id}')" style="background:var(--surface2);color:var(--navy)">📋 View Full BOQ</button>
        <button class="btn btn-sm" onclick="openEditProject('${p.id}')">✏️ Edit</button>
        <button class="btn btn-sm" onclick="openOwnerNotes('${p.id}')" title="Private owner notes">📝 Notes${p.ownerNotes?` <span style="width:7px;height:7px;background:var(--gold);border-radius:50%;display:inline-block;margin-left:2px"></span>`:''}</button>
        <div class="amenu-wrap">
          <button class="amenu-btn" onclick="event.stopPropagation();toggleMenu('detail-menu')">⋮</button>
          <div class="amenu" id="detail-menu">
            <button class="amenu-item" onclick="openExpectedJVMenu('${p.id}')">📅 Expected JV${p.expectedJVMonth?' ✓':''}</button>
            ${(p.status||'active')==='active'?`<button class="amenu-item" onclick="changeProjectStatus('${p.id}','onhold')">⏸ Mark On Hold</button>`:''}
            ${(p.status||'active')==='onhold'?`<button class="amenu-item" style="color:var(--green)" onclick="changeProjectStatus('${p.id}','active')">▶ Mark Active</button>`:''}
            ${(p.status||'active')!=='completed'?`<button class="amenu-item" onclick="changeProjectStatus('${p.id}','completed')">✓ Mark Completed</button>`:''}
            <button class="amenu-item danger" onclick="deleteProject('${p.id}')">🗑️ Delete Project</button>
          </div>
        </div>
      </div>
    </div>
    ${ah}
    ${(()=>{const alerts=getProjectAlerts(p);return alerts.map(a=>`<div class="alert-banner ab-${a.type}">${a.msg}</div>`).join('');})()}
    ${pendHtml}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div class="card"><div class="st">Financials</div>
        <div class="fr"><span class="fl">Estimated BOQ</span><span class="fv">${fmt(p.estimated)}</span></div>
        <div class="fr"><span class="fl">Bid %</span><span class="fv">${p.bidPct>0?'+':''}${p.bidPct}%</span></div>
        <div class="fr"><span class="fl">Agreement Amount</span><span class="fv">${fmt(agAmt(p))}</span></div>
        <div class="fr"><span class="fl">Max Fundable (70%)</span><span class="fv">${fmt(max)}</span></div>
        <div class="fr"><span class="fl">Total Deployed</span><span class="fv">${fmt(rel)}</span></div>
        <div class="fr"><span class="fl">Cap Used</span><span class="fv" style="color:${rel/max>=0.85?'var(--red)':rel/max>=0.65?'var(--amber)':'var(--green)'}">${Math.round(rel/max*100)||0}%</span></div>
        <div class="fr"><span class="fl">Total Settled</span><span class="fv" style="color:var(--green)">${fmt(settled)}</span></div>
        <div class="fr"><span class="fl">Outstanding</span><span class="fv" style="color:${(rel-settled)>0?'var(--red)':'var(--green)'}">${fmt(Math.max(0,rel-settled))}</span></div>
        <div class="fr"><span class="fl">Eligible (verified work)</span><span class="fv" style="color:var(--green)">${fmt(el)}</span></div>
        <!-- Interest accrued — see Interest tab --><div style="font-size:11px;color:var(--text3);margin-top:4px"><a href="#" onclick="ownerTab(4);return false" style="color:var(--navy)">📈 View interest in Interest tab →</a></div>
        ${p.costCentre?`<div class="fr"><span class="fl" style="font-size:11px">Tally Cost Centre</span><span style="font-family:monospace;font-size:11px;color:var(--text3)">${p.costCentre}</span></div>`:''}
      </div>

      <!-- MATERIAL CREDIT -->
      ${renderProjectMatCredit(p)}

      <!-- LIFECYCLE TIMELINE -->
      ${buildLifecycleTimeline(p,id)}

      <!-- ACTION ITEMS: WEC + Refund (legacy fallback) -->

    <!-- Full BOQ (collapsible) -->
    <div class="card" id="boq-full-${id}" style="display:none">
      <div class="st" style="margin-bottom:12px">📋 Full BOQ — Items & Rates</div>
      ${(p.boq&&p.boq.length)?`<div class="tbl-wrap"><table>
        <thead><tr>
          <th>Item Description</th><th>Unit</th>
          <th style="text-align:right">Qty</th>
          <th style="text-align:right">Rate (₹)</th>
          <th style="text-align:right">Value (₹)</th>
        </tr></thead>
        <tbody>
          ${p.boq.map(item=>`<tr>
            <td style="font-size:12px">${item.desc||item.name||'—'}</td>
            <td style="font-size:12px">${item.unit||'—'}</td>
            <td style="text-align:right;font-size:12px">${item.qty||0}</td>
            <td style="text-align:right;font-size:12px">${fmt(item.rate||0)}</td>
            <td style="text-align:right;font-weight:600;font-size:12px">${fmt((item.qty||0)*(item.rate||0))}</td>
          </tr>`).join('')}
          <tr style="border-top:2px solid var(--border);background:var(--surface2)">
            <td colspan="4" style="font-weight:700;font-size:13px">Total BOQ Value</td>
            <td style="text-align:right;font-weight:800;font-size:13px;color:var(--navy)">${fmt(p.boq.reduce((s,i)=>s+(i.qty||0)*(i.rate||0),0))}</td>
          </tr>
        </tbody>
      </table></div>`:'<div style="color:var(--text3);font-size:13px">No BOQ items added yet.</div>'}
    </div>

      <!-- Contractor Uploaded Documents (visible to RSR) -->
      ${(p.contractorDocs&&Object.keys(p.contractorDocs).length)?`
      <div class="card" style="margin-bottom:14px">
        <div class="st" style="margin-bottom:10px">📁 Contractor Site Documents</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${[
            {id:'drawing',label:'Site Drawing / Plan',icon:'📐'},
            {id:'estimate',label:'Work Estimate',icon:'📋'},
            {id:'other',label:'Other Document',icon:'📎'}
          ].map(slot=>{
            const doc = (p.contractorDocs||{})[slot.id];
            if(!doc||!doc.url) return '';
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--surface2);border-radius:var(--rs);flex-wrap:wrap;gap:8px">'
              +'<div><div style="font-size:12px;font-weight:600">'+slot.icon+' '+slot.label+'</div>'
              +'<div style="font-size:11px;color:var(--text3)">'+doc.name+' · Uploaded '+fmtDate(doc.uploadedAt)+(doc.uploadedBy?' by '+doc.uploadedBy:'')+'</div></div>'
              +'<a href="'+doc.url+'" target="_blank" style="font-size:12px;padding:6px 12px;background:var(--navy);color:#fff;border-radius:var(--rs);font-weight:600;text-decoration:none">View →</a>'
              +'</div>';
          }).join('')}
        </div>
      </div>`:''}

      <div class="card">
        <details>
          <summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:4px">
            <div class="st" style="margin:0;border:none;padding:0">Fund Releases</div>
            <span style="font-size:11px;font-weight:600;color:var(--navy)">▼ Show / Hide</span>
          </summary>
          <div style="margin-top:12px">${relLog}</div>
          ${settleLog?'<div style="margin-top:14px"><div class="st">Government Payments Received</div>'+settleLog+'</div>':''} 
        </details>
      </div>
    </div>
    <div class="card">
      <details open>
        <summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:0">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="st" style="margin:0;border:none;padding:0">📊 BOQ Progress ${lv?`<span style="font-weight:400;text-transform:none;color:var(--text3);font-size:11px">— Last verified: ${lv.date}</span>`:''}</div>
          </div>
          <div style="display:flex;gap:12px;font-size:11px;font-weight:600">
            <span style="color:var(--amber)">🟡 Reported</span>
            <span style="color:var(--navy)">🔵 Verified</span>
            <span style="color:var(--text3);font-size:11px">▼</span>
          </div>
        </summary>
        <div style="margin-top:12px">
          <div class="tbl-wrap"><table><thead><tr>
            <th>Item</th><th>Unit</th>
            <th style="text-align:center">BOQ Qty</th>
            <th style="text-align:center;color:var(--amber)">Reported</th>
            <th style="text-align:center;color:var(--navy)">RSR Verified</th>
            <th>Progress</th>
            <th style="text-align:right">Value</th>
          </tr></thead><tbody>${brows}</tbody></table></div>
          <div style="margin-top:10px;font-size:12px;color:var(--text3);border-top:1px solid var(--border);padding-top:8px">
            <strong style="color:var(--amber)">Reported</strong> = accepted from contractor updates.&nbsp;&nbsp;
            <strong style="color:var(--navy)">RSR Verified</strong> = physically confirmed on site — controls funding.
          </div>
        </div>
      </details>
    </div>
    <div class="card"><div class="st">Verification Log</div>${verLog}</div>
    ${p.ownerNotes?`<div class="card" style="border-left:4px solid var(--gold)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div class="st" style="margin:0;border:none;padding:0;color:var(--gold)">📝 Owner Notes (Private)</div>
        <button class="btn btn-sm" onclick="openOwnerNotes('${p.id}')">Edit</button>
      </div>
      <div style="font-size:13px;color:var(--text2);white-space:pre-wrap;line-height:1.6">${p.ownerNotes}</div>
      ${p.ownerNotesUpdated?`<div style="font-size:11px;color:var(--text3);margin-top:8px">Last updated: ${new Date(p.ownerNotesUpdated).toLocaleString('en-IN')}</div>`:''}
    </div>`:''}
    ${allUpdHtml}
    <!-- Contractor Notes (visible to owner) -->
    ${(()=>{
      const notes = p.contractorNotes||[];
      if(!notes.length) return '';
      return `<div class="card" style="border-top:3px solid var(--gold)">
        <div class="st">📓 Contractor Notes (${notes.length})</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:10px">Notes written by ${GC(p.contractorId)?.name||'contractor'} for this project.</div>
        ${notes.slice().reverse().map(n=>`
          <div style="border-left:3px solid var(--gold);padding:8px 12px;margin-bottom:8px;background:var(--surface2);border-radius:0 var(--rs) var(--rs) 0">
            ${n.date?`<div style="font-size:11px;color:var(--text3);font-weight:600;margin-bottom:4px">📅 ${n.date}</div>`:''}
            <div style="font-size:13px">${n.text.replace(/\n/g,'<br>')}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:4px">${new Date(n.createdAt).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})} · by ${n.by||'contractor'}</div>
          </div>`).join('')}
      </div>`;
    })()}
    ${renderDocVault(p, true)}
    <div class="card">
      <div class="st">📅 Project Timeline</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:14px">Complete chronological log — every payment, receipt, update, verification and settlement.</div>
      ${renderTimeline(id)}
    </div>
  `;
}

async function markRev(pid,uid_val){
  const p=GP(pid); if(!p)return;
  const u=(p.contractorUpdates||[]).find(x=>x.id===uid_val);
  if(!u) return;
  u.reviewed=true;
  // Update reported quantities — take the maximum of existing reported and this update's quantities
  // (since contractor reports cumulative, we always take their latest claim)
  if(!p.reportedItems) p.reportedItems={};
  (p.boq||[]).forEach(item=>{
    const claimed = u.quantities?.[item.id]||0;
    const existing = p.reportedItems[item.id]||0;
    // Take the higher of the two (cumulative reporting — can only go up)
    p.reportedItems[item.id] = Math.max(claimed, existing);
  });
  try {
    await saveProjectDB(p);
    renderDetail(pid);
    toast('✓ Reviewed — reported quantities updated','ok');
  } catch(e){ toast('Save failed','error'); }
}

// ═══════════════════════════════════════════════════════
// VERIFY
// ═══════════════════════════════════════════════════════
function openVer(id){
  vpid=id; const p=GP(id); const lv=(p.verifications||[]).slice(-1)[0];
  document.getElementById('ver-body').innerHTML=`
    <div class="frow">
      <div class="fg"><label>Date</label><input type="date" id="vd-date" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="fg"><label>Verified By</label><input type="text" id="vd-by" placeholder="Name / supervisor" value="${CU.name}"></div>
    </div>
    <div class="fg"><label>Notes</label><textarea id="vd-notes" rows="2" placeholder="Observations at site…"></textarea></div>
    <div class="st" style="margin-top:4px">Measured Quantities (your physical measurement)</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Enter total cumulative quantity verified so far.</div>
    ${(p.boq||[]).map(item=>{const prev=lv?(lv.items[item.id]||0):0;return`<div class="vrow"><div class="vdesc">${item.desc}</div><div class="vmeta">of ${item.qty} ${item.unit}</div><input type="number" class="vinput" id="vi-${item.id}" value="${prev}" min="0" max="${item.qty}" step="0.1"></div>`;}).join('')}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn" onclick="CM('modal-ver')">Cancel</button>
      <button class="btn btn-navy" onclick="saveVer()">Save Verification</button>
    </div>`;
  OM('modal-ver');
}

async function saveVer(){
  const p=GP(vpid); if(!p)return;
  const date=document.getElementById('vd-date').value;
  const notes=document.getElementById('vd-notes').value;
  const verifiedBy=document.getElementById('vd-by').value;
  const items={};
  (p.boq||[]).forEach(item=>{const v=parseFloat(document.getElementById('vi-'+item.id)?.value)||0;items[item.id]=Math.min(v,item.qty);});
  if(!p.verifications) p.verifications=[];
  p.verifications.push({id:uid(),date,notes,verifiedBy,items});
  try {
    await saveProjectDB(p);
    CM('modal-ver');
    renderDetail(vpid);
    toast('✓ Verification saved — BOQ progress updated','ok');
  } catch(e){ toast('Save failed: '+e.message,'error'); }
}

// ═══════════════════════════════════════════════════════
// RELEASE FUNDS
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// CONTRACTORS
// ═══════════════════════════════════════════════════════
// ─── PROJECT TIMELINE ────────────────────────────────
function renderTimeline(pid){
  const p=GP(pid); if(!p) return '';
  const events=[];

  // Releases (payments + receipts)
  (p.releases||[]).filter(r=>!isArchived(r)).forEach(r=>{
    const isRec=r.txType==='receipt';
    events.push({
      date:r.date,
      icon:isRec?'📥':'💸',
      type:isRec?'receipt':'payment',
      title:isRec?`Receipt: ${fmt(r.amount)}`:`Payment: ${fmt(r.amount)}`,
      sub:`Vch #${r.ref||'—'} · ${r.notes||r.method||''}`,
      color:isRec?'var(--green)':'var(--navy)'
    });
  });

  // Contractor updates
  (p.contractorUpdates||[]).filter(u=>!isArchived(u)).forEach(u=>{
    events.push({
      date:u.date,
      icon:u.rejected?'✗':u.reviewed?'✓':'⏳',
      type:'update',
      title:`Site Update by ${u.submittedBy||'contractor'}`,
      sub:`${u.notes||'No notes'} · ${u.photos&&u.photos.length?u.photos.length+' photos':'no photos'} · ${u.rejected?'Rejected':u.reviewed?'Approved':'Pending review'}`,
      color:u.rejected?'var(--red)':u.reviewed?'var(--green)':'var(--amber)'
    });
  });

  // Verifications
  (p.verifications||[]).filter(v=>!isArchived(v)).forEach(v=>{
    events.push({
      date:v.date,
      icon:'🔍',
      type:'verification',
      title:`RSR Verification`,
      sub:`Verified by ${v.verifiedBy||'RSR'} · ${v.notes||''}`,
      color:'var(--navy)'
    });
  });

  // Settlements
  (p.settlements||[]).filter(s=>!isArchived(s)).forEach(s=>{
    events.push({
      date:s.date,
      icon:'🏦',
      type:'settlement',
      title:`Government Settlement: ${fmt(s.amount)}`,
      sub:`${s.mode||'—'} · Ref: ${s.ref||'—'} · ${s.notes||''}`,
      color:'var(--green)'
    });
  });

  // Status changes
  if(p.statusChangedAt) events.push({
    date:p.statusChangedAt.split('T')[0],
    icon:'📋',
    type:'status',
    title:`Status changed to ${p.status}`,
    sub:`By ${p.statusChangedBy||'owner'}`,
    color:'var(--text2)'
  });

  if(!events.length) return '<div style="color:var(--text3);font-size:13px;padding:20px 0;text-align:center">No activity recorded yet.</div>';

  events.sort((a,b)=>b.date.localeCompare(a.date));

  return `<div style="position:relative;padding-left:28px">
    <div style="position:absolute;left:10px;top:0;bottom:0;width:2px;background:var(--border)"></div>
    ${events.map(e=>`
      <div style="position:relative;margin-bottom:14px">
        <div style="position:absolute;left:-22px;width:22px;height:22px;border-radius:50%;background:${e.color};display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.15)">${e.icon}</div>
        <div style="background:var(--surface2);border-radius:var(--rs);padding:8px 12px;border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
            <div style="font-weight:700;font-size:13px;color:${e.color}">${e.title}</div>
            <div style="font-size:11px;color:var(--text3);white-space:nowrap">${e.date}</div>
          </div>
          ${e.sub?`<div style="font-size:12px;color:var(--text2);margin-top:2px">${e.sub}</div>`:''}
        </div>
      </div>`).join('')}
  </div>`;
}

// ─── ACTION ITEMS SECTION ────────────────────────────
function buildActionItems(p, id){
  const eaNum = p.eaNumber || (p.docVault && p.docVault.ea) || '';
  const today = new Date();

  let showRefund = false;
  let daysUntilRefund = null;
  if(p.jvDate){
    const twoYears = new Date(p.jvDate);
    twoYears.setFullYear(twoYears.getFullYear() + 2);
    daysUntilRefund = Math.round((twoYears - today) / 86400000);
    showRefund = daysUntilRefund <= 30 && !p.refundApplied;
  }

  const showWEC = eaNum && !p.wecReceived;

  if(!showWEC && !showRefund) return '';

  return `<div class="card" style="border-top:3px solid var(--amber);margin-bottom:0">
    <div class="st" style="margin-bottom:12px">📋 Action Items</div>
    ${showWEC ? `<div style="padding:12px;background:#fffbeb;border-radius:var(--rs);margin-bottom:10px;border:1px solid #f59e0b">
      <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:6px">📜 Work Experience Certificate</div>
      ${p.wecApplied
        ? `<div style="font-size:12px;color:var(--text2);margin-bottom:8px">✓ Applied on <strong>${fmtDate(p.wecAppliedDate)}</strong> — awaiting receipt from government</div>
           <button class="btn btn-sm btn-navy" onclick="markWECReceived('${id}')">✓ Mark as Received</button>`
        : `<div style="font-size:12px;color:var(--text2);margin-bottom:8px">EA Number received — apply for Work Experience Certificate now</div>
           <button class="btn btn-sm" style="background:#f59e0b;color:#fff;border:none" onclick="markWECApplied('${id}')">✓ Mark WEC as Applied</button>`
      }
    </div>` : ''}
    ${showRefund ? `<div style="padding:12px;background:#fef2f2;border-radius:var(--rs);border:1px solid var(--red)">
      <div style="font-size:13px;font-weight:700;color:var(--red);margin-bottom:6px">💰 ${daysUntilRefund<=0?'EMD/ASD/FSD Refund Eligible NOW':'EMD/ASD/FSD Refund Eligible Soon'}</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:6px">${daysUntilRefund<=0?'2 years completed since JV — apply for deposit refund immediately':`Refund eligibility in ${daysUntilRefund} days — prepare documents`}</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:8px">EMD: ${fmt(p.emd||0)} · ASD: ${fmt(p.asd||0)} · FSD: ${fmt(p.fsd||0)}</div>
      ${daysUntilRefund<=0?`<button class="btn btn-sm" style="background:var(--red);color:#fff;border:none" onclick="markRefundApplied('${id}')">✓ Mark Refund as Applied</button>`:''}
    </div>` : ''}
  </div>`;
}

// ═══════════════════════════════════════════════════════
// PROJECT LIFECYCLE TIMELINE
// ═══════════════════════════════════════════════════════
function buildLifecycleTimeline(p, id){
  const today = new Date();

  // ── Determine each stage ──────────────────────────
  const hasJV = !!p.jvDate;
  const hasEA = !!(p.eaNumber||(p.docVault&&p.docVault.ea));
  const wecApplied = !!p.wecApplied;
  const wecReceived = !!p.wecReceived;
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
      date: hasEA ? (p.eaNumber||(p.docVault&&p.docVault.ea)||'') : '',
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
        : '<button class="btn btn-sm" style="background:#f59e0b;color:#fff;border:none;border-radius:var(--rs);padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif" onclick="markWECApplied(\''+id+'\')">✓ Mark WEC Applied</button>') : ''
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
      actions: hasJV && refundEligible && !refundApplied ? '<button class="btn btn-sm" style="background:var(--red);color:#fff;border:none;border-radius:var(--rs);padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif" onclick="markRefundApplied(\''+id+'\')">✓ Mark Applied</button>' :
        refundApplied && !refundReceived ? '<button class="btn btn-sm btn-navy" onclick="markRefundReceived(\''+id+'\')">✓ Mark Received</button>' : ''
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
