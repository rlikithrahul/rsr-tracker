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
  const mine=D.projects.filter(p=>p.contractorId===CU.id);
  const activeFilter = document.getElementById('cont-proj-filter')?.value || 'active';
  const el=document.getElementById('cp-home');

  // Check offline queue count asynchronously and update UI
  getOfflineQueue().then(q=>{
    const pendingEl = document.getElementById('offline-pending-banner');
    if(pendingEl && q.length>0){
      pendingEl.style.display='block';
      pendingEl.innerHTML=`<div class="alert al-amber" style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px">
        <span>📥 ${q.length} update${q.length>1?'s':''} saved offline — not yet synced</span>
        ${navigator.onLine&&dbOK?`<button class="btn btn-sm btn-navy" onclick="syncOfflineQueue().then(renderCHome)">Sync Now</button>`:'<span style="font-size:12px;color:var(--amber)">Connect internet to sync</span>'}
      </div>`;
    }
  }).catch(()=>{});

  if(!mine.length){
    el.innerHTML=`<div id="offline-pending-banner"></div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button onclick="triggerInstall()" style="background:var(--navy);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif">📲 Install App</button>
    </div>
    <div class="empty"><div class="empty-icon">🏗️</div><div class="empty-text">No projects assigned yet.<br>Contact RSR office.</div></div>`;
    return;
  }
  el.innerHTML=`
    <div id="offline-pending-banner"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:8px">
      <h2 style="font-size:20px;font-weight:700;color:var(--navy)">My Projects</h2>
      <button onclick="triggerInstall()" id="install-app-btn" style="background:var(--navy);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;font-family:'Inter',sans-serif">📲 Install App</button>
    </div>
    <p style="font-size:13px;color:var(--text3);margin-bottom:20px">Tap a project to update progress or upload photos.</p>`+
  mine.map(p=>`<div class="ppill" onclick="cOpenProj('${p.id}')">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;gap:8px;flex-wrap:wrap">
      <div><div style="font-size:15px;font-weight:700;color:var(--navy);margin-bottom:3px">${p.name}</div>
      <div style="font-size:12px;color:var(--text3)">${p.type} · ${p.location||''} · #${p.tender}</div></div>
      ${sBadge(pStat(p),p)}
    </div>
    <div class="prog" style="margin:0"><div class="prog-lbl"><span>Work verified by RSR</span><span>${pct(verPct(p))}</span></div><div class="prog-track"><div class="prog-fill pf-navy" style="width:${Math.min(verPct(p),100)}%"></div></div></div>
  </div>`).join('');

  // Async: update offline banner after render
  setTimeout(()=>{
    getOfflineQueue().then(q=>{
      const pendingEl = document.getElementById('offline-pending-banner');
      if(pendingEl){
        if(q.length>0){
          pendingEl.innerHTML=`<div class="alert al-amber" style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <span>📥 ${q.length} update${q.length>1?'s':''} saved offline — not yet synced</span>
            ${navigator.onLine&&dbOK?`<button class="btn btn-sm btn-navy" onclick="syncOfflineQueue().then(()=>renderCHome())">Sync Now</button>`:'<span style="font-size:12px">Connect internet to sync</span>'}
          </div>`;
        } else {
          pendingEl.innerHTML='';
        }
      }
    }).catch(()=>{});
  }, 100);
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
    <button class="btn btn-gold btn-full" style="padding:16px;font-size:15px;margin-bottom:16px" onclick="cOpenUpd('${id}')">
      📸 Update Progress + Upload Photos
    </button>
    ${capAlert(p)}
    <div class="card" style="margin-bottom:12px">
      <div class="st" style="margin-bottom:10px">📊 Bill of Quantities</div>
      ${renderBOQContractorView(p)}
    </div>
    <!-- Update History -->
    <div class="card" style="margin-bottom:12px">
      <div class="st" style="margin-bottom:10px">📋 My Update History</div>
      ${renderUpdateHistory(p.id)}
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
