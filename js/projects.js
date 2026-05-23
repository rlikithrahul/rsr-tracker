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
  const lv=(p.verifications||[]).slice(-1)[0];
  const pend=(p.contractorUpdates||[]).filter(u=>!u.reviewed);
  const allUpdates=(p.contractorUpdates||[]).slice().reverse();
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
      <div style="font-size:12px;color:var(--text3)">#${p.tender} · ${p.type} · ${c?c.name:'—'} · ${p.location||''}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="openVer('${p.id}')">📋 Verify</button>
        <button class="btn btn-green btn-sm" onclick="openSettle('${p.id}')">🏦 Settle</button>
        <button class="btn btn-sm" onclick="openEditBOQ('${p.id}')">📊 Edit BOQ</button>
        <button class="btn btn-sm" onclick="openOwnerNotes('${p.id}')" title="Private owner notes">📝 Notes${p.ownerNotes?` <span style="width:7px;height:7px;background:var(--gold);border-radius:50%;display:inline-block;margin-left:2px"></span>`:''}</button>
        <div class="amenu-wrap">
          <button class="amenu-btn" onclick="event.stopPropagation();toggleMenu('detail-menu')">⋮</button>
          <div class="amenu" id="detail-menu">
            <button class="amenu-item" onclick="changeProjectStatus('${p.id}','onhold')">⏸ Mark On Hold</button>
            <button class="amenu-item success" onclick="changeProjectStatus('${p.id}','completed')">✓ Mark Completed</button>
            <button class="amenu-item" onclick="changeProjectStatus('${p.id}','active')">▶ Mark Active</button>
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
        <div class="fr"><span class="fl">Interest Accrued</span><span class="int-val">${fmt(intr(p))}</span></div>
        ${p.costCentre?`<div class="fr"><span class="fl" style="font-size:11px">Tally Cost Centre</span><span style="font-family:monospace;font-size:11px;color:var(--text3)">${p.costCentre}</span></div>`:''}
      </div>
      <div class="card">
        <div class="st">Fund Releases</div>${relLog}
        ${settleLog?`<div class="st" style="margin-top:14px">Government Payments Received</div>${settleLog}`:''}
      </div>
    </div>
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div class="st" style="margin:0;border:none;padding:0">BOQ Progress ${lv?`<span style="font-weight:400;text-transform:none;color:var(--text3);font-size:11px">— Last verified: ${lv.date}</span>`:''}</div>
        <div style="display:flex;gap:12px;font-size:11px;font-weight:600">
          <span style="color:var(--amber)">🟡 Contractor Reported</span>
          <span style="color:var(--navy)">🔵 RSR Verified</span>
        </div>
      </div>
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
    ${renderDocVault(p, true)}`;
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