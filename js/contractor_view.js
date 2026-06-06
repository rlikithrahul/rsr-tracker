// ═══════════════════════════════════════
// contractor_view.js
// RSR Constructions Tracker v17
// ═══════════════════════════════════════

// ═══════════════════════════════════════════════════════
// CONTRACTOR VIEWS
// ═══════════════════════════════════════════════════════
function renderCHome(){
  document.getElementById('cp-home').classList.remove('hidden');
  document.getElementById('cp-proj').classList.add('hidden');
  document.getElementById('cp-upd').classList.add('hidden');
  document.getElementById('cp-funds').classList.add('hidden');

  // Supervisor check — hide funds tab if supervisor
  const isSupervisor = CU.isSupervisor === true;
  const cbnFunds = document.getElementById('cbn-1');
  if(cbnFunds) cbnFunds.style.display = isSupervisor ? 'none' : 'flex';

  const mine = D.projects.filter(p=>p.contractorId===CU.id);
  const el = document.getElementById('cp-home');

  // Get filters
  const statusFilter = document.getElementById('cont-status-filter')?.value || 'active';
  const firmFilter = document.getElementById('cont-firm-filter')?.value || 'all';

  // Filter projects
  let filtered = mine.filter(p=>{
    const status = p.status||'active';
    const matchStatus = statusFilter==='all' || status===statusFilter;
    const matchFirm = firmFilter==='all' || (p.firm||'RSR Constructions')===firmFilter;
    return matchStatus && matchFirm && !isArchived(p);
  });

  // Counts for tabs
  const activeCount = mine.filter(p=>!isArchived(p)&&(p.status||'active')==='active').length;
  const completedCount = mine.filter(p=>!isArchived(p)&&p.status==='completed').length;

  // Build alerts
  const cAlerts = (typeof getContractorAlerts === 'function') ? getContractorAlerts(CU.id) : [];
  const alertsHtml = cAlerts.length ? '<div style="margin-bottom:14px">'
    +cAlerts.map(a=>'<div style="padding:10px 12px;border-left:3px solid '+(a.type==='red'?'var(--red)':'var(--amber)')+';background:'+(a.type==='red'?'#fef2f2':'#fffbeb')+';border-radius:0 var(--rs) var(--rs) 0;margin-bottom:6px;font-size:13px">'+a.msg+'</div>').join('')
    +'</div>' : '';

  if(!mine.length){
    el.innerHTML='<div id="offline-pending-banner"></div><div class="empty"><div class="empty-icon">🏗️</div><div class="empty-text">No projects assigned yet.<br>Contact RSR office.</div></div>';
    return;
  }

  el.innerHTML = '<div id="offline-pending-banner"></div>'
    +alertsHtml
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">'
    +'<h2 style="font-size:18px;font-weight:700;color:var(--navy)">My Projects</h2>'
    +'<button onclick="triggerInstall()" style="background:var(--navy);color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif">📲 Install App</button>'
    +'</div>'
    // Status quick tabs
    +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">'
    +'<button onclick="setCContFilter(\'active\')" style="padding:5px 14px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif;border:1.5px solid '+(statusFilter==='active'?'var(--navy)':'var(--border)')+';background:'+(statusFilter==='active'?'var(--navy)':'#fff')+';color:'+(statusFilter==='active'?'#fff':'var(--text2)')+'">🟢 Active ('+activeCount+')</button>'
    +'<button onclick="setCContFilter(\'completed\')" style="padding:5px 14px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif;border:1.5px solid '+(statusFilter==='completed'?'var(--navy)':'var(--border)')+';background:'+(statusFilter==='completed'?'var(--navy)':'#fff')+';color:'+(statusFilter==='completed'?'#fff':'var(--text2)')+'">✅ Completed ('+completedCount+')</button>'
    +'<button onclick="setCContFilter(\'all\')" style="padding:5px 14px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif;border:1.5px solid '+(statusFilter==='all'?'var(--navy)':'var(--border)')+';background:'+(statusFilter==='all'?'var(--navy)':'#fff')+';color:'+(statusFilter==='all'?'#fff':'var(--text2)')+'">All ('+mine.filter(p=>!isArchived(p)).length+')</button>'
    // Firm filter
    +'<select id="cont-firm-filter" onchange="renderCHome()" style="padding:5px 10px;border-radius:16px;font-size:12px;font-weight:600;border:1.5px solid var(--border);background:#fff;font-family:\'Inter\',sans-serif;cursor:pointer">'
    +'<option value="all">All Firms</option>'
    +'<option value="RSR Constructions" '+(firmFilter==='RSR Constructions'?'selected':'')+'>RSR</option>'
    +'<option value="R Sadhu Rao" '+(firmFilter==='R Sadhu Rao'?'selected':'')+'>RS Rao</option>'
    +'<option value="R Likith Rahul" '+(firmFilter==='R Likith Rahul'?'selected':'')+'>RLR</option>'
    +'</select>'
    +'<input type="hidden" id="cont-status-filter" value="'+statusFilter+'">'
    +'</div>'
    // Project list
    +(filtered.length===0 ? '<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">No projects in this filter.</div></div>' :
      filtered.map(p=>{
        const status = p.status||'active';
        const statusColor = status==='active'?'var(--green)':status==='completed'?'#0c5460':'var(--text3)';
        const statusLabel = status==='active'?'🟢 Active':status==='completed'?'✅ Completed':'⏸ On Hold';
        const vp = verPct(p);
        const types = (p.types&&p.types.length) ? p.types.join(', ') : (p.type||'');
        return '<div class="ppill" onclick="cOpenProj(\'' + p.id + '\')">'
          +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:8px;flex-wrap:wrap">'
          +'<div style="flex:1"><div style="font-size:14px;font-weight:700;color:var(--navy);margin-bottom:3px">'+p.name+'</div>'
          +'<div style="font-size:11px;color:var(--text3)">'+types+(p.location?' · '+p.location:'')+(p.tender?' · #'+p.tender:'')+'</div></div>'
          +'<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:'+statusColor+'22;color:'+statusColor+'">'+statusLabel+'</span>'
          +'</div>'
          +'<div class="prog" style="margin:0"><div class="prog-lbl"><span>RSR verified</span><span>'+pct(vp)+'</span></div><div class="prog-track"><div class="prog-fill pf-navy" style="width:'+Math.min(vp,100)+'%"></div></div></div>'
          +'</div>';
      }).join(''));

  // Offline banner
  getOfflineQueue().then(q=>{
    const pendingEl = document.getElementById('offline-pending-banner');
    if(pendingEl && q.length>0){
      pendingEl.innerHTML='<div class="alert al-amber" style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><span>📥 '+q.length+' update'+(q.length>1?'s':'')+' saved offline — not yet synced</span>'+(navigator.onLine&&dbOK?'<button class="btn btn-sm btn-navy" onclick="syncOfflineQueue().then(renderCHome)">Sync Now</button>':'<span style="font-size:12px;color:var(--amber)">Connect internet to sync</span>')+'</div>';
    }
  }).catch(()=>{});
}

function setCContFilter(status){
  const el = document.getElementById('cont-status-filter');
  if(el) el.value = status; else {
    // Create hidden field if not exists
    const h = document.createElement('input');
    h.type='hidden'; h.id='cont-status-filter'; h.value=status;
    document.getElementById('cp-home').appendChild(h);
  }
  renderCHome();
}


function toggleCBOQ(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.style.display = el.style.display==='none' ? 'block' : 'none';
}

// ─── SWITCH CONTRACTOR PROJECT TAB ───────────────────
function switchContractorTab(pid, tab){
  const labourBtn = document.getElementById('tab-btn-labour-'+pid);
  const expenseBtn = document.getElementById('tab-btn-expense-'+pid);
  const content = document.getElementById('contractor-tab-content-'+pid);
  if(!content) return;

  if(tab==='labour'){
    labourBtn.style.background='var(--navy)'; labourBtn.style.color='#fff';
    expenseBtn.style.background='var(--surface2)'; expenseBtn.style.color='var(--navy)';
    content.innerHTML='<div id="labour-tab-wrap">'+renderLabourTab(pid)+'</div>';
  } else {
    expenseBtn.style.background='var(--navy)'; expenseBtn.style.color='#fff';
    labourBtn.style.background='var(--surface2)'; labourBtn.style.color='var(--navy)';
    content.innerHTML='<div id="expense-tab-wrap">'+renderExpenseTab(pid)+'</div>';
  }
}

async function cOpenProj(id){
  // Lazy fetch full project data before opening
  if (dbOK) { try { await fetchProjectFull(id); } catch(e){} }
  const p=GP(id);
  document.getElementById('cp-home').classList.add('hidden');
  document.getElementById('cp-upd').classList.add('hidden');
  const el=document.getElementById('cp-proj');
  el.classList.remove('hidden');
  const lv=(p.verifications||[]).slice(-1)[0];
  const myUpd=(p.contractorUpdates||[]).filter(u=>u.contractorId===CU.id).slice().reverse();
  el.innerHTML=`
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <button class="btn btn-sm" onclick="renderCHome()">← Back</button>
      <div style="flex:1;min-width:150px"><div style="font-size:16px;font-weight:700;color:var(--navy)">${p.name}</div>
      <div style="font-size:12px;color:var(--text3)">#${p.tender} · ${p.type}</div></div>
    </div>
    <button class="btn btn-gold btn-full" style="padding:16px;font-size:15px;margin-bottom:14px" onclick="cOpenUpd('${id}')">
      📸 Update Progress + Upload Photos
    </button>
    ${capAlert(p)}

    <!-- Project Financials for Contractor -->
    <div class="card" style="margin-bottom:12px;padding:14px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">💰 Project Financials</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:var(--surface2);padding:10px;border-radius:var(--rs)">
          <div style="font-size:10px;color:var(--text3);margin-bottom:3px">Agreement Amount</div>
          <div style="font-size:14px;font-weight:700;color:var(--navy)">${fmt(agAmt(p))}</div>
        </div>
        <div style="background:var(--surface2);padding:10px;border-radius:var(--rs)">
          <div style="font-size:10px;color:var(--text3);margin-bottom:3px">Max Fundable (70%)</div>
          <div style="font-size:14px;font-weight:700;color:var(--navy)">${fmt(maxF(p))}</div>
        </div>
        <div style="background:var(--surface2);padding:10px;border-radius:var(--rs)">
          <div style="font-size:10px;color:var(--text3);margin-bottom:3px">Total Received</div>
          <div style="font-size:14px;font-weight:700;color:var(--green)">${fmt(totRel(p))}</div>
        </div>
        <div style="background:var(--surface2);padding:10px;border-radius:var(--rs)">
          <div style="font-size:10px;color:var(--text3);margin-bottom:3px">Cap Used</div>
          <div style="font-size:14px;font-weight:700;color:${maxF(p)>0&&totRel(p)/maxF(p)>=0.85?'var(--red)':maxF(p)>0&&totRel(p)/maxF(p)>=0.70?'var(--amber)':'var(--navy)'}">${maxF(p)>0?Math.round(totRel(p)/maxF(p)*100):0}%</div>
        </div>
      </div>
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-size:12px">
        <span style="color:var(--text2)">Estimated BOQ: <strong>${fmt(p.estimated||0)}</strong></span>
        <span style="color:var(--text2)">Bid: <strong>${p.bidPct||0}%</strong></span>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0">
        <div class="st" style="margin:0;border:none;padding:0">📊 Bill of Quantities</div>
        <button onclick="toggleCBOQ('cboq-${id}')" style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--rs);padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;color:var(--navy)">View Full BOQ</button>
      </div>
      <div id="cboq-${id}" style="display:none;margin-top:12px">
        ${renderBOQContractorView(p)}
      </div>
    </div>
    <!-- Update History -->
    <div class="card" style="margin-bottom:12px">
      <div class="st" style="margin-bottom:10px">📋 My Update History</div>
      ${renderUpdateHistory(p.id)}
    </div>

    <!-- RSR Project Documents (JV, EA, Gen Code, WEC) -->
    <div class="card" style="margin-bottom:12px">
      <div class="st" style="margin-bottom:10px">📋 Project Documents (RSR)</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${[
          {label:'JV Date', value: p.jvDate ? fmtDate(p.jvDate) : null, icon:'📄'},
          {label:'JV Number', value: p.jvNumber||null, icon:'🔢'},
          {label:'JV Amount', value: p.jvAmount ? fmt(p.jvAmount) : null, icon:'💰'},
          {label:'EA / Accounts Number', value: p.eaNumber||(p.docVault&&p.docVault.ea)||null, icon:'🔑'},
          {label:'Gen Code', value: p.genCode||(p.docVault&&p.docVault.gencode)||null, icon:'🏷️'},
          {label:'Tender ID', value: p.tender||null, icon:'📑'},
          {label:'Agreement Date', value: p.agreeDate ? fmtDate(p.agreeDate) : null, icon:'📅'},
        ].map(d=>'<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface2);border-radius:var(--rs)">'
          +'<span style="font-size:12px;color:var(--text2)">'+d.icon+' '+d.label+'</span>'
          +'<span style="font-size:13px;font-weight:700;color:'+(d.value?'var(--navy)':'var(--text3)')+'">'+  (d.value||'—')+'</span>'
          +'</div>').join('')}
        ${(p.docVault&&p.docVault.wec&&p.docVault.wec.url)?'<a href="'+p.docVault.wec.url+'" target="_blank" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#e8f5e9;border-radius:var(--rs);font-size:12px;font-weight:700;color:var(--green);text-decoration:none">📜 View Work Experience Certificate →</a>':''}
        ${(p.documents&&p.documents.ea&&p.docVault&&p.docVault.ea_doc&&p.docVault.ea_doc.url)?'<a href="'+p.docVault.ea_doc.url+'" target="_blank" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#e3f2fd;border-radius:var(--rs);font-size:12px;font-weight:700;color:var(--navy);text-decoration:none">🔑 View EA Document →</a>':''}
      </div>
    </div>

    <!-- Site Documents -->
    <div id="cont-docs-wrap-${id}">${renderContractorDocs('${id}')}</div>

    <!-- Labour & Expense Tabs -->
    <div style="display:flex;gap:0;margin-bottom:0;border-radius:var(--rs) var(--rs) 0 0;overflow:hidden;border:1px solid var(--border)">
      <button id="tab-btn-labour-${id}" onclick="switchContractorTab('${id}','labour')"
        style="flex:1;padding:10px;font-size:12px;font-weight:700;cursor:pointer;border:none;font-family:'Inter',sans-serif;background:var(--navy);color:#fff;border-right:1px solid rgba(255,255,255,.2)">
        👷 Labour Register
      </button>
      <button id="tab-btn-expense-${id}" onclick="switchContractorTab('${id}','expense')"
        style="flex:1;padding:10px;font-size:12px;font-weight:700;cursor:pointer;border:none;font-family:'Inter',sans-serif;background:var(--surface2);color:var(--navy)">
        💸 Site Expenses
      </button>
    </div>
    <div id="contractor-tab-content-${id}" style="border:1px solid var(--border);border-top:none;border-radius:0 0 var(--rs) var(--rs);margin-bottom:16px;background:#fff">
      <div id="labour-tab-wrap">${(typeof renderLabourTab==='function')?renderLabourTab('${id}'):''}</div>
    </div>
    <!-- Notes Diary -->
    <div id="contractor-notes-${p.id}">
      ${renderContractorNotes(p.id)}
    </div>
    <div class="card"><div class="st">Work Status</div>
      <div class="tbl-wrap"><table><thead><tr><th>Item</th><th>Total</th><th style="color:var(--amber)">You Reported</th><th style="color:var(--navy)">RSR Verified</th><th>Progress</th></tr></thead><tbody>
      ${(p.boq||[]).map(item=>{
        const rd=(p.reportedItems||{})[item.id]||0;
        const vd=lv?(lv.items[item.id]||0):0;
        const vpct=item.qty?Math.round(vd/item.qty*100):0;
        return`<tr>
          <td>${item.desc}</td>
          <td style="text-align:center">${item.qty} ${item.unit}</td>
          <td style="text-align:center;font-weight:700;color:var(--amber)">${rd} ${item.unit}</td>
          <td style="text-align:center;font-weight:700;color:var(--navy)">${vd} ${item.unit}</td>
          <td><div style="display:flex;align-items:center;gap:6px"><div class="prog-track" style="flex:1;height:5px"><div class="prog-fill pf-navy" style="width:${vpct}%"></div></div><span style="font-size:11px;font-weight:700">${vpct}%</span></div></td>
        </tr>`;}).join('')}
      </tbody></table></div>
      <div style="font-size:11px;color:var(--text3);margin-top:8px"><span style="color:var(--amber);font-weight:600">You Reported</span> = quantities RSR has accepted from your updates. &nbsp;<span style="color:var(--navy);font-weight:600">RSR Verified</span> = physically confirmed on site — controls your funding.</div>
    </div>
    <div class="card"><div class="st">Your Previous Updates</div>
      ${myUpd.length?myUpd.map(u=>`<div style="padding:12px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:6px"><span style="font-weight:700">${u.date}</span><span class="badge ${u.reviewed?'bg-green':'bg-navy'}">${u.reviewed?'✓ Reviewed by RSR':'⏳ Pending review'}</span></div>
        ${u.notes?`<div style="font-size:13px;color:var(--text2);margin-bottom:6px">${u.notes}</div>`:''}
        ${u.quantities&&Object.keys(u.quantities).length?`<div style="font-size:12px;color:var(--navy);font-weight:600;margin-bottom:6px">Reported: ${(p.boq||[]).filter(i=>u.quantities[i.id]).map(i=>`${i.desc}: ${u.quantities[i.id]} ${i.unit}`).join(' · ')}</div>`:''}
        ${u.photos&&u.photos.length?`<div class="pgrid" style="grid-template-columns:repeat(3,1fr)">${u.photos.map(ph=>`<div class="pitem" onclick="lightbox('${ph.url}')"><img src="${ph.url}" loading="lazy" alt=""><div class="pcap">${ph.name||'photo'}</div></div>`).join('')}</div>`:'<div style="font-size:12px;color:var(--text3)">No photos attached</div>'}
      </div>`).join(''):'<div style="font-size:13px;color:var(--text3)">No updates yet. Tap the button above to submit your first update.</div>'}
    </div>`;
}


// ═══════════════════════════════════════════════════════
// GPS CAPTURE
// ═══════════════════════════════════════════════════════
function captureGPS(){
  const tag=document.getElementById('gps-tag');
  gpsData=null;
  if(!navigator.geolocation){
    if(tag){tag.textContent='📍 Location unavailable on this device';tag.className='gps-tag fail';}
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async(pos)=>{
      const lat=pos.coords.latitude,lng=pos.coords.longitude,acc=Math.round(pos.coords.accuracy);
      const time=new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
      let area=lat.toFixed(4)+', '+lng.toFixed(4);
      try{
        const r=await fetch('https://nominatim.openstreetmap.org/reverse?lat='+lat+'&lon='+lng+'&format=json');
        const d=await r.json();
        const a=d.address;
        const sub=a.suburb||a.neighbourhood||a.village||a.town||a.city||'';
        const city=a.city||a.town||'';
        area=sub&&city&&sub!==city?sub+', '+city:sub||city||area;
      }catch(e){}
      gpsData={lat,lng,acc,area,time};
      if(tag){tag.textContent='📍 '+area+' · '+time+' · ±'+acc+'m';tag.className='gps-tag got';}
    },
    (err)=>{
      gpsData=null;
      if(tag){tag.textContent='📍 Location denied — photos will not have GPS';tag.className='gps-tag fail';}
    },
    {enableHighAccuracy:true,timeout:15000,maximumAge:60000}
  );
}

function cOpenUpd(id){
  const p=GP(id);
  document.getElementById('cp-proj').classList.add('hidden');
  const el=document.getElementById('cp-upd');
  el.classList.remove('hidden');
  photos=[];
  gpsData=null;
  el.innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <button class="btn btn-sm" onclick="cOpenProj('${id}')">← Back</button>
      <div style="font-size:16px;font-weight:700;color:var(--navy)">Update Progress</div>
    </div>
    <div class="card">
      <div class="fg"><label>Date</label><input type="date" id="cu-date" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="fg"><label>Notes — What was done today?</label><textarea id="cu-notes" rows="3" placeholder="e.g. Excavation completed, RCC work started…"></textarea></div>
    </div>
    <div class="card">
      <div class="st">Today's Work Quantities</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:12px">Enter <strong>today's quantity only</strong>. App totals automatically.</div>
      ${(p.boq||[]).map(item=>{
        const alreadyReported=(p.reportedItems||{})[item.id]||0;
        const remaining=Math.max(0,item.qty-alreadyReported);
        return`<div class="vrow">
          <div class="vdesc"><strong>${item.desc}</strong>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">Total: ${item.qty} ${item.unit} · Done: ${alreadyReported} · Left: ${remaining}</div>
          </div>
          <input type="number" class="vinput" id="cu-q-${item.id}" placeholder="0" min="0" max="${remaining}" step="0.1">
        </div>`;}).join('')}
    </div>
    <div class="card">
      <div class="st">📸 Site Photos <span style="color:var(--red);font-weight:800">* Required</span></div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:8px">At least 1 photo is required. RSR reviews before releasing funds.</div>
      <div class="photo-req" id="photo-req-msg">⚠️ You must add at least 1 photo before submitting.</div>
      <div style="margin-bottom:10px">
        <span class="gps-tag" id="gps-tag">📍 Getting your location…</span>
      </div>
      <div class="pgrid" id="cu-pgrid">
        <label class="padd" onclick="triggerCamera()" style="min-height:90px;border-color:var(--navy)" onclick="triggerCamera()">
          <div class="padd-icon">📷</div>
          <div style="font-weight:600;color:var(--navy)">Take Photo</div>
          <div style="font-size:11px">Open Camera</div>
        </label>
        <label class="padd" onclick="triggerGallery()" style="min-height:90px" onclick="triggerGallery()">
          <div class="padd-icon">🖼️</div>
          <div style="font-weight:600">From Gallery</div>
          <div style="font-size:11px">Choose File</div>
        </label>
      </div>
      <!-- Separate inputs for better iOS/Android compatibility -->
      <input type="file" id="cu-photo-camera" accept="image/*" capture="environment" style="display:none;position:fixed;top:-9999px">
      <input type="file" id="cu-photo-gallery" accept="image/*" multiple style="display:none;position:fixed;top:-9999px">
    </div>
    <button class="btn btn-navy btn-full" style="padding:16px;font-size:16px;margin-bottom:16px" id="cu-submit-btn" onclick="submitUpd('${id}')">
      ✅ Submit Update to RSR
    </button>`;
  captureGPS();
}

function triggerCamera(){
  const input = document.getElementById('cu-photo-camera');
  if(!input) return;
  // Reset input so same photo can be selected again
  input.value = '';
  input.onchange = (e) => handlePhotos(e, 'camera');
  input.click();
}

function triggerGallery(){
  const input = document.getElementById('cu-photo-gallery');
  if(!input) return;
  input.value = '';
  input.onchange = (e) => handlePhotos(e, 'gallery');
  input.click();
}

async function handlePhotos(evt, source='unknown'){
  const files=Array.from(evt.target.files);
  if(photos.length+files.length>5){alert('Maximum 5 photos per update.');return;}
  const captureTime=new Date().toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  for(const file of files){
    if(file.size>20*1024*1024){alert(file.name+' is too large. Max 20MB.');continue;}
    setBusy(true,'Compressing photo…');
    try{
      const compressed=await compressImage(file);
      const r=new FileReader();
      const dataUrl=await new Promise(res=>{r.onload=e=>res(e.target.result);r.readAsDataURL(compressed);});
      photos.push({
        name:file.name, file:compressed, dataUrl, captureTime,
        source, // 'camera' or 'gallery'
        gps:gpsData?{lat:gpsData.lat,lng:gpsData.lng,area:gpsData.area,time:gpsData.time}:null
      });
    }catch(e){console.error(e);}
    setBusy(false);
  }
  const req=document.getElementById('photo-req-msg');
  if(req&&photos.length>0)req.classList.remove('show');
  renderPhotoPreview();
  evt.target.value='';
}

function renderPhotoPreview(){
  const g=document.getElementById('cu-pgrid');if(!g)return;
  const addBtns=photos.length<5?`
    <label class="padd" onclick="triggerCamera()" style="min-height:70px;border-color:var(--navy)">
      <div style="font-size:18px">📷</div><div style="font-size:11px;font-weight:600;color:var(--navy)">Camera</div>
    </label>
    <label class="padd" onclick="triggerGallery()" style="min-height:70px">
      <div style="font-size:18px">🖼️</div><div style="font-size:11px;font-weight:600">Gallery</div>
    </label>`:'';
  g.innerHTML=photos.map((ph,i)=>`
    <div class="pitem" style="position:relative" onclick="lightbox('${ph.dataUrl}')">
      <img src="${ph.dataUrl}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--rs)">
      <button onclick="event.stopPropagation();removePhoto(${i})" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:12px">✕</button>
      <div style="font-size:9px;margin-top:2px;text-align:center">
        <span style="background:${ph.source==='camera'?'var(--navy)':'#e9ecef'};color:${ph.source==='camera'?'#fff':'#666'};padding:1px 5px;border-radius:3px">${ph.source==='camera'?'📷 Live':'🖼️ Gallery'}</span>
        <div style="color:var(--text3)">${ph.captureTime}</div>
      </div>
    </div>`).join('')+addBtns;
}

function lightbox(src){
  document.getElementById('lb-img').src=src;
  OM('modal-lb');
}

document.querySelectorAll('.mov').forEach(ov=>{
  ov.addEventListener('click',e=>{if(e.target===ov)CM(ov.id);});
});

// ═══════════════════════════════════════════════════════
// PWA — MANIFEST + OFFLINE QUEUE + SERVICE WORKER
// ═══════════════════════════════════════════════════════

// Inject manifest dynamically (since we're a single HTML file)

async function submitUpd(pid){
  const p=GP(pid);

  // Photo check
  if(photos.length===0){
    const req=document.getElementById('photo-req-msg');
    if(req){req.classList.add('show');req.scrollIntoView({behavior:'smooth',block:'center'});}
    toast('📸 Please add at least 1 site photo','error',3000);
    return;
  }

  // Duplicate update check
  const todayStr=new Date().toISOString().split('T')[0];
  const todayUpds=(p.contractorUpdates||[]).filter(u=>u.contractorId===CU.id&&u.date===todayStr&&!u.rejected);
  if(todayUpds.length>0){
    if(!confirm('⚠️ You already submitted an update today ('+todayStr+').\nPrevious: "'+( todayUpds[todayUpds.length-1].notes||'No notes')+'".\nSubmit another?')) return;
  }

  const date=document.getElementById('cu-date').value;
  const notes=document.getElementById('cu-notes').value;
  const quantities={};
  (p.boq||[]).forEach(item=>{
    const todayDelta=parseFloat(document.getElementById('cu-q-'+item.id)?.value)||0;
    if(todayDelta>0)quantities[item.id]=todayDelta;
  });
  const btn=document.getElementById('cu-submit-btn');
  btn.disabled=true; btn.textContent='Submitting…';
  const updateId=uid();

  // If offline or no internet, save to offline queue
  if(!navigator.onLine || !dbOK){
    const offlinePhotos=photos.map(ph=>({name:ph.name,dataUrl:ph.dataUrl,captureTime:ph.captureTime,gps:ph.gps}));
    const update={id:updateId,date,notes,quantities,reviewed:false,submittedBy:CU.name,contractorId:CU.id,submittedGPS:gpsData?{...gpsData}:null,_offline:true};
    await addToOfflineQueue({type:'projectUpdate',projectId:pid,updateId,update,photos:offlinePhotos});
    if(!p.contractorUpdates)p.contractorUpdates=[];
    p.contractorUpdates.push({...update,photos:offlinePhotos.map(ph=>({...ph,url:ph.dataUrl}))});
    photos=[];gpsData=null;
    btn.textContent='📥 Saved Offline';
    setTimeout(()=>cOpenProj(pid),1200);
    return;
  }

  try{
    const uploadedPhotos=[];
    for(let i=0;i<photos.length;i++){
      setBusy(true,`Uploading photo ${i+1}/${photos.length}…`);
      try{
        const url=await uploadPhoto(photos[i].file,pid,updateId);
        uploadedPhotos.push({url,name:photos[i].name,captureTime:photos[i].captureTime,gps:photos[i].gps});
      }catch(photoErr){
        // Photo upload failed — store as dataURL and continue
        console.warn('Photo upload failed, storing locally:', photoErr.message);
        uploadedPhotos.push({url:photos[i].dataUrl,name:photos[i].name,captureTime:photos[i].captureTime,gps:photos[i].gps,_localOnly:true});
      }
    }
    setBusy(false);
    if(!p.contractorUpdates)p.contractorUpdates=[];
    p.contractorUpdates.push({id:updateId,date,notes,quantities,photos:uploadedPhotos,reviewed:false,
      submittedBy:CU.name,contractorId:CU.id,
      submittedGPS:gpsData?{lat:gpsData.lat,lng:gpsData.lng,area:gpsData.area,time:gpsData.time}:null});
    await saveProjectDB(p);
    photos=[];gpsData=null;
    toast('✅ Update submitted to RSR!','ok',3000);
    setTimeout(()=>cOpenProj(pid),1200);
  }catch(e){
    setBusy(false);
    // If DB save failed, save offline
    const offlinePhotos=photos.map(ph=>({name:ph.name,dataUrl:ph.dataUrl,captureTime:ph.captureTime,gps:ph.gps}));
    const update={id:updateId,date,notes,quantities,reviewed:false,submittedBy:CU.name,contractorId:CU.id,_offline:true};
    await addToOfflineQueue({type:'projectUpdate',projectId:pid,updateId,update,photos:offlinePhotos});
    photos=[];gpsData=null;
    btn.textContent='📥 Saved — will sync when online';
    toast('⚠️ Saved offline — will sync when internet is available','ok',5000);
    setTimeout(()=>cOpenProj(pid),1500);
  }
}

// ─── CONTRACTOR NOTES DIARY ───────────────────────────
function renderContractorNotes(pid){
  const p = GP(pid); if(!p) return '';
  const notes = p.contractorNotes || [];
  
  return `<div class="card" style="margin-top:12px">
    <div class="st">📓 My Notes</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">Write anything you want to remember for this project.</div>
    
    <!-- Add new note -->
    <div style="background:var(--surface2);border-radius:var(--rs);padding:12px;margin-bottom:14px">
      <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;flex-wrap:wrap">
        <label style="font-size:12px;font-weight:600;color:var(--text2)">Date (optional):</label>
        <input type="date" id="note-date-${pid}" style="padding:5px 8px;font-size:12px;border:1px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif">
      </div>
      <textarea id="note-text-${pid}" placeholder="Write your note here… e.g. Paid laborer ₹500, bought cement bags, engineer visited site…"
        style="width:100%;min-height:80px;padding:8px;border:1px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px;resize:vertical;box-sizing:border-box"></textarea>
      <button class="btn btn-navy btn-sm" onclick="saveContractorNote('${pid}')" style="margin-top:8px;width:100%">💾 Save Note</button>
    </div>
    
    <!-- Existing notes -->
    ${notes.length ? notes.slice().reverse().map(n=>`
      <div style="border-left:3px solid var(--gold);padding:8px 12px;margin-bottom:8px;background:var(--surface);border-radius:0 var(--rs) var(--rs) 0">
        ${n.date?`<div style="font-size:11px;color:var(--text3);font-weight:600;margin-bottom:4px">📅 ${n.date}</div>`:''}
        <div style="font-size:13px;color:var(--text)">${n.text.replace(/\n/g,'<br>')}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:4px">${new Date(n.createdAt).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
      </div>`).join('') : '<div style="font-size:13px;color:var(--text3);text-align:center;padding:16px 0">No notes yet. Add your first note above.</div>'}
  </div>`;
}

async function saveContractorNote(pid){
  const p = GP(pid); if(!p) return;
  const text = document.getElementById(`note-text-${pid}`)?.value?.trim();
  if(!text){ toast('Write something first','error'); return; }
  const date = document.getElementById(`note-date-${pid}`)?.value || '';
  if(!p.contractorNotes) p.contractorNotes = [];
  p.contractorNotes.push({
    id: uid(), text, date,
    createdAt: new Date().toISOString(),
    by: CU.name, contractorId: CU.id
  });
  try {
    await saveProjectDB(p);
    toast('✅ Note saved','ok');
    // Re-render notes section
    const notesEl = document.getElementById(`contractor-notes-${pid}`);
    if(notesEl) notesEl.innerHTML = renderContractorNotes(pid);
  } catch(e){ toast('Save failed','error'); }
}

// ─── UPDATE HISTORY FOR CONTRACTOR ────────────────────
function renderUpdateHistory(pid){
  const p = GP(pid); if(!p) return '';
  const updates = (p.contractorUpdates||[]).filter(u=>u.contractorId===CU.id);
  if(!updates.length) return `<div style="font-size:13px;color:var(--text3);text-align:center;padding:16px">No updates submitted yet.</div>`;
  
  return updates.slice().reverse().map(u=>{
    const status = u.reviewed ? (u.rejected ? '❌ Rejected' : '✅ Approved') : '⏳ Pending Review';
    const statusColor = u.reviewed ? (u.rejected ? 'var(--red)' : 'var(--green)') : 'var(--amber)';
    const totalQty = Object.values(u.quantities||{}).reduce((s,v)=>s+v,0);
    return `<div style="border:1px solid var(--border);border-radius:var(--rs);padding:12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px">
        <div style="font-size:13px;font-weight:700;color:var(--navy)">${u.date}</div>
        <span style="font-size:11px;font-weight:700;color:${statusColor};background:${u.reviewed?(u.rejected?'#fde8e8':'#d4edda'):'#fff3cd'};padding:2px 8px;border-radius:10px">${status}</span>
      </div>
      ${u.notes?`<div style="font-size:12px;color:var(--text2);margin-bottom:6px">${u.notes}</div>`:''}
      ${totalQty>0?`<div style="font-size:12px;color:var(--text3)">Quantities reported: ${totalQty} units across ${Object.keys(u.quantities||{}).length} items</div>`:''}
      ${u.rejected&&u.reviewNotes?`<div style="margin-top:8px;padding:8px;background:#fde8e8;border-radius:var(--rs);font-size:12px;color:var(--red)"><strong>Reason:</strong> ${u.reviewNotes}</div>`:''}
      ${u.photos&&u.photos.length?`<div style="font-size:11px;color:var(--text3);margin-top:4px">📷 ${u.photos.length} photo${u.photos.length>1?'s':''} submitted</div>`:''}
    </div>`;
  }).join('');
}

// ─── CONTRACTOR DOCUMENT UPLOADS ─────────────────────
// 3 upload slots per project — RSR can view these
const CONT_DOC_SLOTS = [
  { id:'drawing',  label:'Site Drawing / Plan',   icon:'📐' },
  { id:'estimate', label:'Work Estimate',          icon:'📋' },
  { id:'other',    label:'Other Document',         icon:'📎' },
];

function renderContractorDocs(pid){
  const p = GP(pid); if(!p) return '';
  const docs = p.contractorDocs || {};

  let html = '<div class="card" style="margin-bottom:14px">';
  html += '<div class="st" style="margin-bottom:12px">📁 Site Documents</div>';
  html += '<div style="display:flex;flex-direction:column;gap:10px">';

  CONT_DOC_SLOTS.forEach(slot=>{
    const existing = docs[slot.id];
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;background:var(--surface2);border-radius:var(--rs);flex-wrap:wrap">';
    html += '<div style="font-size:13px;font-weight:600">' + slot.icon + ' ' + slot.label + '</div>';
    if(existing && existing.url){
      html += '<div style="display:flex;gap:6px;align-items:center">';
      html += '<a href="' + existing.url + '" target="_blank" style="font-size:12px;color:var(--navy);font-weight:600;text-decoration:underline">View File</a>';
      html += '<button onclick="uploadContractorDoc(\'' + pid + '\',\'' + slot.id + '\')" style="font-size:11px;padding:4px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--rs);cursor:pointer">Replace</button>';
      html += '</div>';
    } else {
      html += '<label style="cursor:pointer">';
      html += '<input type="file" style="display:none" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onchange="handleContractorDocUpload(event,\'' + pid + '\',\'' + slot.id + '\')">';
      html += '<span style="font-size:12px;padding:6px 12px;background:var(--navy);color:#fff;border-radius:var(--rs);font-weight:600">+ Upload</span>';
      html += '</label>';
    }
    html += '</div>';
  });

  html += '</div></div>';
  return html;
}

async function handleContractorDocUpload(evt, pid, slotId){
  const file = evt.target.files[0];
  if(!file) return;
  if(file.size > 10*1024*1024){ toast('File too large — max 10MB','error'); return; }
  toast('Uploading...','info');
  try{
    const url = await uploadDocument(file, pid, 'contractor_'+slotId);
    const p = GP(pid);
    if(!p){ toast('Project not found','error'); return; }
    if(!p.contractorDocs) p.contractorDocs = {};
    p.contractorDocs[slotId] = {
      url, name: file.name, size: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: CU ? CU.name : 'Contractor'
    };
    await saveProjectDB(p);
    toast('✓ Document uploaded','ok');
    // Re-render docs section
    const wrap = document.getElementById('cont-docs-wrap-'+pid);
    if(wrap) wrap.innerHTML = renderContractorDocs(pid);
  }catch(e){ toast('Upload failed: '+e.message,'error'); }
}

function uploadContractorDoc(pid, slotId){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';
  input.onchange = (e) => handleContractorDocUpload(e, pid, slotId);
  input.click();
}

// ═══════════════════════════════════════════════════════
// SUPERVISOR LOGIN SYSTEM
// Contractors can create sub-logins for their supervisors
// Supervisors: everything except Funds/Finance tab
// ═══════════════════════════════════════════════════════

function renderSupervisorPanel(){
  const c = D.contractors.find(x=>x.id===CU.id);
  if(!c) return '';
  const supervisors = c.supervisors||[];

  return '<div class="card" style="margin-bottom:14px">'
    +'<div class="st" style="margin-bottom:12px">👥 My Supervisors</div>'
    +'<div style="font-size:12px;color:var(--text2);margin-bottom:12px">Supervisors can view all project details and submit updates. They cannot see funds or interest.</div>'
    +(supervisors.length
      ? supervisors.map((s,i)=>'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--surface2);border-radius:var(--rs);margin-bottom:8px;gap:8px;flex-wrap:wrap">'
          +'<div><div style="font-size:13px;font-weight:700">'+s.name+'</div>'
          +'<div style="font-size:11px;color:var(--text3)">Login: '+s.username+' · Password: ••••••</div></div>'
          +'<button onclick="deleteSupervisor(\''+s.id+'\')" style="background:none;border:1px solid var(--border);border-radius:var(--rs);padding:4px 10px;font-size:11px;color:var(--red);cursor:pointer;font-family:\'Inter\',sans-serif">Remove</button>'
          +'</div>').join('')
      : '<div style="font-size:13px;color:var(--text3);padding:12px 0">No supervisors added yet.</div>')
    +'<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">'
    +'<div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px">Add New Supervisor</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<input type="text" id="sv-name" placeholder="Full name" style="flex:1;min-width:130px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);font-family:\'Inter\',sans-serif;font-size:13px">'
    +'<input type="text" id="sv-user" placeholder="Username (to login)" style="flex:1;min-width:130px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);font-family:\'Inter\',sans-serif;font-size:13px">'
    +'<input type="password" id="sv-pw" placeholder="Password" style="flex:1;min-width:130px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);font-family:\'Inter\',sans-serif;font-size:13px">'
    +'<button onclick="addSupervisor()" style="background:var(--navy);color:#fff;border:none;border-radius:var(--rs);padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif">+ Add</button>'
    +'</div>'
    +'</div>'
    +'</div>';
}

async function addSupervisor(){
  const name = document.getElementById('sv-name')?.value?.trim();
  const username = document.getElementById('sv-user')?.value?.trim();
  const pw = document.getElementById('sv-pw')?.value?.trim();
  if(!name||!username||!pw){ toast('Fill in name, username and password','error'); return; }

  const c = D.contractors.find(x=>x.id===CU.id);
  if(!c) return;
  if(!c.supervisors) c.supervisors=[];

  // Check username unique
  if(c.supervisors.find(s=>s.username===username)){ toast('Username already exists','error'); return; }

  c.supervisors.push({ id:uid(), name, username, password:pw, createdAt:new Date().toISOString() });
  try{
    await saveContractorDB(c);
    toast('✓ Supervisor '+name+' added','ok');
    // Re-render supervisor panel
    const svEl = document.getElementById('sv-panel');
    if(svEl) svEl.innerHTML = renderSupervisorPanel();
  }catch(e){ toast('Save failed','error'); }
}

async function deleteSupervisor(svId){
  if(!confirm('Remove this supervisor?')) return;
  const c = D.contractors.find(x=>x.id===CU.id);
  if(!c) return;
  c.supervisors = (c.supervisors||[]).filter(s=>s.id!==svId);
  try{
    await saveContractorDB(c);
    const svEl = document.getElementById('sv-panel');
    if(svEl) svEl.innerHTML = renderSupervisorPanel();
    toast('Supervisor removed','ok');
  }catch(e){ toast('Save failed','error'); }
}

// Supervisor login — called from contLogin in auth.js
function checkSupervisorLogin(name, pw){
  for(const c of D.contractors){
    const sups = c.supervisors||[];
    const sv = sups.find(s=>s.username===name && s.password===pw);
    if(sv) return { supervisor:sv, contractor:c };
  }
  return null;
}
