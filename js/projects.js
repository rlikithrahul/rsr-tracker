// ═══════════════════════════════════════
// projects.js
// RSR Constructions Tracker v17
// ═══════════════════════════════════════

async function openDetail(id){
  dpid=id;
  document.querySelectorAll('.osec').forEach(e=>e.classList.add('hidden'));
  document.querySelectorAll('.nav-link').forEach(e=>e.classList.remove('active'));
  document.getElementById('sec-detail').classList.remove('hidden');
  // Show loading state immediately
  document.getElementById('detail-wrap').innerHTML='<div class="loading" style="padding:40px;text-align:center;color:var(--text3)"><div style="font-size:24px;margin-bottom:8px">⏳</div>Loading project…</div>';
  // Lazy fetch full project data
  await fetchProjectFull(id);
  renderDetail(id);
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
  const settleLog=(p.settlements||[]).slice().reverse().map(s=>`<div class="settle-row"><span>🏦 ${s.date} · ${s.mode} ${s.ref?'· '+s.ref:''} · ${s.notes||''}</span><strong style="color:var(--green)">${fmt(s.amount)}</strong></div>`).join('');

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
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <button class="btn btn-sm" onclick="ownerTab(0)">← Dashboard</button>
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

      <!-- ACTION ITEMS: WEC + Refund -->
      ${buildActionItems(p,id)}

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

      <div class="card">
        <div class="st">Fund Releases</div>${relLog}
        ${settleLog?`<div class="st" style="margin-top:14px">Government Payments Received</div>${settleLog}`:''}
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
