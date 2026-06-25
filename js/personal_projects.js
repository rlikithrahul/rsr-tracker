// ═══════════════════════════════════════════════════════
// personal_projects.js — RSR Constructions Tracker
// "My Other Projects" — contractor's own work, NOT linked to RSR
// Lets contractors track non-RSR projects using the same tools:
// Work Progress (photos+notes), Labour, Material, Expenses, Site Docs
// Visible to Super Admin only on the admin side
// ═══════════════════════════════════════════════════════

// ─── CONTRACTOR SIDE: LIST VIEW ───────────────────────
function renderPersonalProjectsTab(){
  const el = document.getElementById('cp-personal');
  if(!el) return;
  const c = D.contractors.find(x=>x.id===CU.id);
  const projects = (c.personalProjects||[]).filter(p=>!isArchived(p));

  el.innerHTML = `
    <div style="margin-bottom:14px">
      <div style="font-size:18px;font-weight:800;color:var(--navy);margin-bottom:4px">📁 My Other Projects</div>
      <div style="font-size:12px;color:var(--text3)">Track your own work outside RSR — material, labour, expenses, photos &amp; documents. Only you and RSR admin can see this.</div>
    </div>

    <button onclick="openAddPersonalProject()" style="width:100%;background:var(--navy);color:#fff;border:none;border-radius:var(--rs);padding:14px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;margin-bottom:16px">
      + Add New Project
    </button>

    ${projects.length===0
      ? '<div class="empty"><div class="empty-icon">📁</div><div class="empty-text">No other projects added yet.<br>Tap + Add New Project to start tracking.</div></div>'
      : projects.map(p=>{
          const lastUpdate = (p.workProgress||[]).filter(w=>!isArchived(w)).slice(-1)[0];
          return `<div class="card" style="margin-bottom:10px;cursor:pointer" onclick="openPersonalProject('${p.id}')">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
              <div style="flex:1;min-width:0">
                <div style="font-size:15px;font-weight:700;color:var(--navy)">${p.name}</div>
                <div style="font-size:12px;color:var(--text3);margin-top:2px">${p.clientName?'For: '+p.clientName:''}${p.location?' · 📍 '+p.location:''}</div>
                ${lastUpdate?`<div style="font-size:11px;color:var(--text3);margin-top:4px">Last update: ${fmtDate(lastUpdate.date)}</div>`:''}
              </div>
              <div style="font-size:18px;color:var(--text3)">→</div>
            </div>
          </div>`;
        }).join('')}
  `;
}

// ─── ADD NEW PERSONAL PROJECT ─────────────────────────
function openAddPersonalProject(){
  let modal = document.getElementById('modal-add-pp');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-add-pp'; document.body.appendChild(modal); }

  modal.innerHTML = `<div class="mbox" style="max-width:420px">
    <div class="mhdr"><h2>📁 New Project</h2><button class="mx" onclick="CM('modal-add-pp')">✕</button></div>
    <div class="fg"><label>Project Name *</label><input type="text" id="pp-name" placeholder="e.g. House construction at Madhurawada"></div>
    <div class="fg"><label>Client / Firm Name</label><input type="text" id="pp-client" placeholder="Who is this work for?"></div>
    <div class="fg"><label>Location</label><input type="text" id="pp-location" placeholder="Site location"></div>
    <div class="fg"><label>Notes</label><textarea id="pp-desc" rows="2" placeholder="Any details about this project"></textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn" onclick="CM('modal-add-pp')">Cancel</button>
      <button class="btn btn-navy" onclick="saveNewPersonalProject()">✓ Create Project</button>
    </div>
  </div>`;
  modal.classList.add('open');
}

async function saveNewPersonalProject(){
  const name = document.getElementById('pp-name')?.value?.trim();
  const client = document.getElementById('pp-client')?.value?.trim();
  const location = document.getElementById('pp-location')?.value?.trim();
  const desc = document.getElementById('pp-desc')?.value?.trim();
  if(!name){ toast('Enter a project name','error'); return; }

  const c = D.contractors.find(x=>x.id===CU.id);
  if(!c.personalProjects) c.personalProjects=[];

  const pp = {
    id: 'pp_'+uid(),
    _isPersonal: true,
    _ownerContractorId: CU.id,
    name, clientName: client||'', location: location||'', description: desc||'',
    createdAt: new Date().toISOString(),
    workProgress: [],
    materialRegister: [],
    siteDocuments: []
  };
  c.personalProjects.push(pp);

  try{
    await saveContractorDB(c);
    logActivity({category:'contractor',action:'personal_project_created',projectId:pp.id,projectName:pp.name,description:CU.name+' created personal project: '+pp.name});
    CM('modal-add-pp');
    renderPersonalProjectsTab();
    toast('✓ Project created','ok');
    if(typeof haptic==='function') haptic('success');
  }catch(e){ toast('Failed to create project','error'); }
}

async function deletePersonalProject(pid){
  const c = D.contractors.find(x=>x.id===CU.id);
  const pp = (c.personalProjects||[]).find(x=>x.id===pid);
  if(!pp) return;
  const ok = await showConfirm({title:'Delete Project?',message:'<strong>'+pp.name+'</strong><br><br>This will remove the project and all its records (material, labour, expenses, documents, photos). Can be restored within 7 days.',confirmLabel:'Yes, Delete'});
  if(!ok) return;
  saveToBin('personal_project', {...pp}, pid, pp.name);
  logActivity({category:'contractor',action:'personal_project_deleted',projectId:pid,projectName:pp.name,description:CU.name+' deleted personal project: '+pp.name});
  pp._archived = true;
  await saveContractorDB(c);
  renderPersonalProjectsTab();
  cBackToPersonalList();
  toast('Project moved to deleted bin','ok');
}

// ─── PERSONAL PROJECT DETAIL ──────────────────────────
function openPersonalProject(pid){
  const p = GP(pid); if(!p) return;
  document.getElementById('cp-personal').classList.add('hidden');
  let detail = document.getElementById('cp-personal-detail');
  if(!detail){
    detail = document.createElement('div');
    detail.id = 'cp-personal-detail';
    document.getElementById('cp-personal').parentNode.appendChild(detail);
  }
  detail.classList.remove('hidden');

  detail.innerHTML = `
    <div style="margin-bottom:14px">
      <button class="btn btn-sm" onclick="cBackToPersonalList()" style="margin-bottom:10px">← Back</button>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
        <div>
          <div style="font-size:18px;font-weight:800;color:var(--navy)">${p.name}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">${p.clientName?'For: '+p.clientName:''}${p.location?' · 📍 '+p.location:''}</div>
          ${p.description?`<div style="font-size:12px;color:var(--text2);margin-top:4px">${p.description}</div>`:''}
        </div>
        <button onclick="openEditPersonalProject('${pid}')" style="background:var(--navy);color:#fff;border:none;border-radius:var(--rs);padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;flex-shrink:0">✏️ Edit</button>
      </div>
    </div>

    <!-- BOQ Document -->
    <div id="pp-boq-section-${pid}">${renderPersonalBOQ(pid)}</div>

    <!-- Work Progress -->
    <div class="card" style="margin-bottom:12px;border-top:3px solid var(--navy)">
      <details data-toggle="pp-progress-${pid}" open>
        <summary style="cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px">
          <div class="st" style="margin:0;border:none;padding:0">📸 Work Progress</div>
          <span style="font-size:11px;font-weight:600;color:var(--navy)">▼ Show / Hide</span>
        </summary>
        <div id="pp-progress-content-${pid}">${renderWorkProgress(pid)}</div>
      </details>
    </div>

    <!-- Site Documents -->
    <div id="site-docs-section-${pid}">${renderSiteDocuments(pid)}</div>

    <!-- Labour / Material / Expense tabs -->
    <div style="display:flex;gap:0;margin-bottom:0;border-radius:var(--rs) var(--rs) 0 0;overflow:hidden;border:1px solid var(--border)">
      <button id="tab-btn-labour-${pid}" onclick="switchContractorTab('${pid}','labour')"
        style="flex:1;padding:10px;font-size:12px;font-weight:700;cursor:pointer;border:none;font-family:'Inter',sans-serif;background:var(--navy);color:#fff;border-right:1px solid rgba(255,255,255,.2)">
        👷 Labour
      </button>
      <button id="tab-btn-material-${pid}" onclick="switchContractorTab('${pid}','material')"
        style="flex:1;padding:10px;font-size:12px;font-weight:700;cursor:pointer;border:none;font-family:'Inter',sans-serif;background:var(--surface2);color:var(--navy);border-right:1px solid var(--border)">
        🧱 Materials
      </button>
      <button id="tab-btn-expense-${pid}" onclick="switchContractorTab('${pid}','expense')"
        style="flex:1;padding:10px;font-size:12px;font-weight:700;cursor:pointer;border:none;font-family:'Inter',sans-serif;background:var(--surface2);color:var(--navy)">
        💸 Expenses
      </button>
    </div>
    <div class="card" style="border-radius:0 0 var(--rs) var(--rs);margin-bottom:16px" id="contractor-tab-content-${pid}">
      <div id="labour-tab-wrap">${renderLabourTab(pid)}</div>
    </div>

    <!-- Delete project -->
    <button onclick="deletePersonalProject('${pid}')" style="width:100%;background:none;border:1px solid var(--red);color:var(--red);border-radius:var(--rs);padding:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;margin-bottom:20px">
      🗑️ Delete This Project
    </button>
  `;
  if(typeof applyToggleStates==='function') applyToggleStates();
}

function cBackToPersonalList(){
  const detail = document.getElementById('cp-personal-detail');
  if(detail) detail.classList.add('hidden');
  document.getElementById('cp-personal').classList.remove('hidden');
  renderPersonalProjectsTab();
}

function openEditPersonalProject(pid){
  const p = GP(pid); if(!p) return;
  let modal = document.getElementById('modal-edit-pp');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-edit-pp'; document.body.appendChild(modal); }

  modal.innerHTML = `<div class="mbox" style="max-width:420px">
    <div class="mhdr"><h2>✏️ Edit Project</h2><button class="mx" onclick="CM('modal-edit-pp')">✕</button></div>
    <div class="fg"><label>Project Name *</label><input type="text" id="epp-name" value="${p.name.replace(/"/g,'&quot;')}"></div>
    <div class="fg"><label>Client / Firm Name</label><input type="text" id="epp-client" value="${(p.clientName||'').replace(/"/g,'&quot;')}"></div>
    <div class="fg"><label>Location</label><input type="text" id="epp-location" value="${(p.location||'').replace(/"/g,'&quot;')}"></div>
    <div class="fg"><label>Notes / Description</label><textarea id="epp-desc" rows="2">${p.description||''}</textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn" onclick="CM('modal-edit-pp')">Cancel</button>
      <button class="btn btn-navy" onclick="saveEditPersonalProject('${pid}')">✓ Save Changes</button>
    </div>
  </div>`;
  modal.classList.add('open');
}

async function saveEditPersonalProject(pid){
  const p = GP(pid); if(!p) return;
  const name = document.getElementById('epp-name')?.value?.trim();
  if(!name){ toast('Project name is required','error'); return; }

  p.name = name;
  p.clientName = document.getElementById('epp-client')?.value?.trim()||'';
  p.location = document.getElementById('epp-location')?.value?.trim()||'';
  p.description = document.getElementById('epp-desc')?.value?.trim()||'';

  try{
    await saveProjectDB(p);
    logActivity({category:'contractor',action:'personal_project_edited',projectId:pid,projectName:p.name,description:(CU?CU.name:'Contractor')+' edited personal project: '+p.name});
    CM('modal-edit-pp');
    openPersonalProject(pid); // refresh the detail view with new data
    toast('✓ Project updated','ok');
    if(typeof haptic==='function') haptic('success');
  }catch(e){ toast('Save failed — try again','error'); }
}

// ─── BOQ DOCUMENT (file upload — PDF/Excel/image) ────
function renderPersonalBOQ(pid){
  const p = GP(pid); if(!p) return '';
  const boq = p.boqFile;

  return `<div class="card" style="margin-bottom:12px;border-top:3px solid var(--gold)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="st" style="margin:0;border:none;padding:0">📊 Bill of Quantities (BOQ)</div>
    </div>
    ${boq ? `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--surface2);border-radius:var(--rs)">
        ${boq.type==='image'
          ? `<img src="${boq.url}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="lightbox('${boq.url}')">`
          : `<div style="width:56px;height:56px;background:var(--navy);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">📄</div>`}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${boq.name}</div>
          <div style="font-size:11px;color:var(--text3)">Uploaded ${fmtDate(boq.uploadedAt)}</div>
        </div>
        <a href="${boq.url}" target="_blank" style="background:var(--navy);color:#fff;border-radius:var(--rs);padding:6px 12px;font-size:11px;font-weight:700;text-decoration:none;flex-shrink:0">↓ View</a>
        <button onclick="deletePersonalBOQ('${pid}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:18px;padding:4px;flex-shrink:0">🗑️</button>
      </div>
      <div style="margin-top:10px">
        <button onclick="triggerPPBOQ('${pid}','replace')" style="width:100%;background:none;border:1px solid var(--border);border-radius:var(--rs);padding:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;color:var(--navy)">🔄 Replace BOQ File</button>
      </div>
    ` : `
      <div style="font-size:12px;color:var(--text3);margin-bottom:10px">No BOQ uploaded yet. Add a PDF, Excel sheet, or photo of the BOQ.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="triggerPPBOQ('${pid}','camera')" style="flex:1;min-width:100px;padding:9px;border:1.5px solid var(--border);border-radius:var(--rs);background:#fff;cursor:pointer;font-size:12px;font-weight:600;font-family:'Inter',sans-serif">📷 Camera</button>
        <button onclick="triggerPPBOQ('${pid}','image')" style="flex:1;min-width:100px;padding:9px;border:1.5px solid var(--border);border-radius:var(--rs);background:#fff;cursor:pointer;font-size:12px;font-weight:600;font-family:'Inter',sans-serif">🖼️ Photo</button>
        <button onclick="triggerPPBOQ('${pid}','file')" style="flex:1;min-width:100px;padding:9px;border:1.5px solid var(--border);border-radius:var(--rs);background:#fff;cursor:pointer;font-size:12px;font-weight:600;font-family:'Inter',sans-serif">📄 PDF/Excel</button>
      </div>
    `}
    <input type="file" id="pp-boq-input-${pid}" accept="*/*" style="display:none" onchange="uploadPersonalBOQ('${pid}',this)">
    <div id="pp-boq-uploading-${pid}" style="display:none;font-size:12px;color:var(--navy);margin-top:8px">⏳ Uploading…</div>
  </div>`;
}

function triggerPPBOQ(pid, mode){
  const inp = document.getElementById('pp-boq-input-'+pid);
  if(!inp) return;
  if(mode==='camera'){ inp.setAttribute('accept','image/*'); inp.setAttribute('capture','environment'); }
  else if(mode==='image'){ inp.setAttribute('accept','image/*'); inp.removeAttribute('capture'); }
  else { inp.setAttribute('accept','.pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png'); inp.removeAttribute('capture'); }
  inp.click();
}

async function uploadPersonalBOQ(pid, input){
  const file = input.files[0]; if(!file) return;
  const p = GP(pid); if(!p) return;

  const uploadingEl = document.getElementById('pp-boq-uploading-'+pid);
  if(uploadingEl) uploadingEl.style.display='block';

  try{
    const boqId = uid();
    let url = '';
    if(typeof uploadPhoto === 'function'){
      url = await uploadPhoto(file, pid, 'boq-'+boqId);
    } else {
      url = await new Promise(res=>{ const r=new FileReader(); r.onload=e=>res(e.target.result); r.readAsDataURL(file); });
    }
    const isImage = file.type.startsWith('image/');
    p.boqFile = {
      id: boqId, name: file.name, url,
      type: isImage?'image':'file',
      uploadedAt: new Date().toISOString().split('T')[0]
    };
    await saveProjectDB(p);
    logActivity({category:'contractor',action:'boq_uploaded',projectId:pid,projectName:p.name,description:CU.name+' uploaded BOQ for '+p.name});
    const sect = document.getElementById('pp-boq-section-'+pid);
    if(sect) sect.innerHTML = renderPersonalBOQ(pid);
    toast('✓ BOQ uploaded','ok');
    if(typeof haptic==='function') haptic('success');
  }catch(e){
    toast('Upload failed — try again','error');
  }finally{
    if(uploadingEl) uploadingEl.style.display='none';
    input.value='';
  }
}

async function deletePersonalBOQ(pid){
  const p = GP(pid); if(!p||!p.boqFile) return;
  const ok = await showConfirm({title:'Delete BOQ?',message:'<strong>'+p.boqFile.name+'</strong><br><br>This will remove the BOQ file from this project.',confirmLabel:'Yes, Delete'});
  if(!ok) return;
  logActivity({category:'contractor',action:'boq_deleted',projectId:pid,projectName:p.name,description:CU.name+' deleted BOQ from '+p.name});
  p.boqFile = null;
  await saveProjectDB(p);
  const sect = document.getElementById('pp-boq-section-'+pid);
  if(sect) sect.innerHTML = renderPersonalBOQ(pid);
  toast('BOQ removed','ok');
}

// ─── WORK PROGRESS (photos + notes, no BOQ) ──────────
function renderWorkProgress(pid){
  const p = GP(pid); if(!p) return '';
  const entries = (p.workProgress||[]).filter(w=>!isArchived(w)).slice().reverse();

  return `
    <button onclick="openAddWorkProgress('${pid}')" style="width:100%;background:var(--gold);color:var(--navy);border:none;border-radius:var(--rs);padding:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;margin-bottom:12px">
      📸 Add Progress Update
    </button>
    ${entries.length===0
      ? '<div style="font-size:13px;color:var(--text3);text-align:center;padding:12px 0">No updates yet. Add your first progress update with photos.</div>'
      : entries.map(e=>`
        <div style="background:var(--surface2);border-radius:var(--rs);padding:10px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div style="font-size:12px;font-weight:700;color:var(--navy)">${fmtDate(e.date)}</div>
            <button onclick="deleteWorkProgress('${pid}','${e.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px">🗑️</button>
          </div>
          ${e.notes?`<div style="font-size:13px;color:var(--text2);margin-bottom:8px">${e.notes}</div>`:''}
          ${(e.photos&&e.photos.length)?`<div style="display:flex;gap:6px;flex-wrap:wrap">
            ${e.photos.map(ph=>`<img src="${ph.url}" style="width:70px;height:70px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="lightbox('${ph.url}')">`).join('')}
          </div>`:''}
        </div>`).join('')}
  `;
}

let _ppProgressPhotos = []; // [{file, dataUrl}]

function openAddWorkProgress(pid){
  _ppProgressPhotos = [];
  let modal = document.getElementById('modal-pp-progress');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-pp-progress'; document.body.appendChild(modal); }

  modal.innerHTML = `<div class="mbox" style="max-width:460px">
    <div class="mhdr"><h2>📸 Progress Update</h2><button class="mx" onclick="CM('modal-pp-progress')">✕</button></div>
    <div class="fg"><label>Date</label><input type="date" id="ppw-date" value="${new Date().toISOString().split('T')[0]}"></div>
    <div class="fg"><label>What was done?</label><textarea id="ppw-notes" rows="3" placeholder="e.g. Foundation work completed, started column casting…"></textarea></div>
    <div class="fg">
      <label>Photos (optional, up to 5)</label>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <button onclick="triggerPPPhoto('camera')" style="flex:1;padding:10px;border:1.5px solid var(--border);border-radius:var(--rs);background:#fff;cursor:pointer;font-size:13px;font-weight:600;font-family:'Inter',sans-serif">📷 Camera</button>
        <button onclick="triggerPPPhoto('gallery')" style="flex:1;padding:10px;border:1.5px solid var(--border);border-radius:var(--rs);background:#fff;cursor:pointer;font-size:13px;font-weight:600;font-family:'Inter',sans-serif">🖼️ Gallery</button>
      </div>
      <input type="file" id="ppw-photo-input" accept="image/*" multiple style="display:none" onchange="previewPPPhotos(this)">
      <div id="ppw-photo-preview" style="display:flex;gap:6px;flex-wrap:wrap"></div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn" onclick="CM('modal-pp-progress')">Cancel</button>
      <button class="btn btn-navy" onclick="saveWorkProgress('${pid}')">✓ Save Update</button>
    </div>
  </div>`;
  modal.classList.add('open');
}

function triggerPPPhoto(source){
  const inp = document.getElementById('ppw-photo-input');
  if(!inp) return;
  if(source==='camera') inp.setAttribute('capture','environment');
  else inp.removeAttribute('capture');
  inp.click();
}

function previewPPPhotos(input){
  const files = Array.from(input.files||[]);
  if(_ppProgressPhotos.length+files.length>5){ toast('Maximum 5 photos','error'); return; }
  files.forEach(file=>{
    const reader = new FileReader();
    reader.onload = e=>{
      _ppProgressPhotos.push({file, dataUrl:e.target.result});
      renderPPPhotoPreview();
    };
    reader.readAsDataURL(file);
  });
}

function renderPPPhotoPreview(){
  const prev = document.getElementById('ppw-photo-preview');
  if(!prev) return;
  prev.innerHTML = _ppProgressPhotos.map((ph,i)=>
    `<div style="position:relative">
      <img src="${ph.dataUrl}" style="width:60px;height:60px;object-fit:cover;border-radius:6px">
      <button onclick="removePPPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:var(--red);color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:12px;cursor:pointer">✕</button>
    </div>`).join('');
}

function removePPPhoto(i){
  _ppProgressPhotos.splice(i,1);
  renderPPPhotoPreview();
}

async function saveWorkProgress(pid){
  const p = GP(pid); if(!p) return;
  const date = document.getElementById('ppw-date')?.value;
  const notes = document.getElementById('ppw-notes')?.value?.trim();
  if(!date){ toast('Select a date','error'); return; }
  if(!notes && _ppProgressPhotos.length===0){ toast('Add notes or at least one photo','error'); return; }

  setBusy(true,'Uploading photos…');
  const uploadedPhotos = [];
  try{
    for(let i=0;i<_ppProgressPhotos.length;i++){
      try{
        const url = await uploadPhoto(_ppProgressPhotos[i].file, pid, 'progress-'+Date.now()+'-'+i);
        uploadedPhotos.push({url});
      }catch(e){
        uploadedPhotos.push({url:_ppProgressPhotos[i].dataUrl, _localOnly:true});
      }
    }

    if(!p.workProgress) p.workProgress=[];
    p.workProgress.push({
      id: uid(), date, notes: notes||'',
      photos: uploadedPhotos,
      createdAt: new Date().toISOString()
    });

    await saveProjectDB(p);
    logActivity({category:'contractor',action:'progress_added',projectId:pid,projectName:p.name,description:CU.name+' added a progress update for '+p.name});
    CM('modal-pp-progress');
    const wrap = document.getElementById('pp-progress-content-'+pid);
    if(wrap) wrap.innerHTML = renderWorkProgress(pid);
    toast('✓ Progress update saved','ok');
    if(typeof haptic==='function') haptic('success');
  }catch(e){
    toast('Save failed — try again','error');
  }finally{
    setBusy(false);
  }
}

async function deleteWorkProgress(pid, entryId){
  const p = GP(pid); if(!p) return;
  const entry = (p.workProgress||[]).find(w=>w.id===entryId);
  if(!entry) return;
  const ok = await showConfirm({title:'Delete Update?',message:'Progress update from <strong>'+fmtDate(entry.date)+'</strong><br><br>Can be restored within 7 days.',confirmLabel:'Yes, Delete'});
  if(!ok) return;
  saveToBin('work_progress', {...entry}, pid, p.name);
  logActivity({category:'contractor',action:'progress_deleted',projectId:pid,projectName:p.name,description:CU.name+' deleted a progress update from '+p.name});
  entry._archived = true;
  await saveProjectDB(p);
  const wrap = document.getElementById('pp-progress-content-'+pid);
  if(wrap) wrap.innerHTML = renderWorkProgress(pid);
  toast('Update moved to deleted bin','ok');
}

// ═══════════════════════════════════════════════════════
// ADMIN SIDE: View contractor's personal projects
// Super Admin only — read-only
// ═══════════════════════════════════════════════════════
function renderContractorPersonalProjects(cid){
  if(!CU || !CU.isSuperAdmin) return '';
  const c = GC(cid); if(!c) return '';
  const projects = (c.personalProjects||[]).filter(p=>!isArchived(p));
  if(!projects.length) return '';

  return `<div class="card" style="margin-bottom:14px;border-top:3px solid #7c3aed">
    <details data-toggle="cont-personal-${cid}">
      <summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div class="st" style="margin:0;border:none;padding:0">📁 Other Projects (${projects.length}) <span style="font-size:10px;background:#7c3aed;color:#fff;padding:2px 8px;border-radius:8px;font-weight:700;margin-left:6px">SUPER ADMIN VIEW</span></div>
        <span style="font-size:11px;font-weight:600;color:var(--navy)">▼ Show / Hide</span>
      </summary>
      <div style="margin-top:12px;font-size:12px;color:var(--text3);margin-bottom:10px">Projects this contractor is tracking outside RSR. Read-only.</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${projects.map(p=>{
          const lastUpdate = (p.workProgress||[]).filter(w=>!isArchived(w)).slice(-1)[0];
          const matCount = (p.materialRegister||[]).filter(m=>!isArchived(m)).length;
          const docCount = (p.siteDocuments||[]).filter(d=>!isArchived(d)).length;
          return `<div onclick="viewContractorPersonalProject('${p.id}')" style="background:var(--surface2);border-radius:var(--rs);padding:10px 12px;cursor:pointer" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='var(--surface2)'">
            <div style="font-size:13px;font-weight:700;color:var(--navy)">${p.name}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${p.clientName?'For: '+p.clientName:''}${p.location?' · 📍 '+p.location:''}</div>
            <div style="display:flex;gap:10px;margin-top:6px;font-size:11px;color:var(--text3)">
              ${lastUpdate?'<span>📸 Last update: '+fmtDate(lastUpdate.date)+'</span>':''}
              ${matCount?'<span>🧱 '+matCount+' material entries</span>':''}
              ${docCount?'<span>📄 '+docCount+' documents</span>':''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </details>
  </div>`;
}

function viewContractorPersonalProject(pid){
  const p = GP(pid); if(!p) return;

  let modal = document.getElementById('modal-view-pp');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-view-pp'; document.body.appendChild(modal); }

  const progress = (p.workProgress||[]).filter(w=>!isArchived(w)).slice().reverse();
  const materials = (p.materialRegister||[]).filter(m=>!isArchived(m)).slice().reverse();
  const docs = (p.siteDocuments||[]).filter(d=>!isArchived(d));

  modal.innerHTML = `<div class="mbox" style="max-width:600px;max-height:85vh;overflow-y:auto">
    <div class="mhdr"><h2>📁 ${p.name}</h2><button class="mx" onclick="CM('modal-view-pp')">✕</button></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:14px">${p.clientName?'For: '+p.clientName:''}${p.location?' · 📍 '+p.location:''}</div>

    <div class="st" style="margin-bottom:8px">📸 Work Progress</div>
    ${progress.length?progress.map(e=>`<div style="background:var(--surface2);border-radius:var(--rs);padding:10px;margin-bottom:8px">
      <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:4px">${fmtDate(e.date)}</div>
      ${e.notes?`<div style="font-size:13px;margin-bottom:6px">${e.notes}</div>`:''}
      ${(e.photos&&e.photos.length)?`<div style="display:flex;gap:6px;flex-wrap:wrap">${e.photos.map(ph=>`<img src="${ph.url}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="lightbox('${ph.url}')">`).join('')}</div>`:''}
    </div>`).join(''):'<div style="font-size:12px;color:var(--text3);margin-bottom:12px">No updates yet.</div>'}

    <div class="st" style="margin:14px 0 8px">🧱 Material Register</div>
    ${materials.length?materials.map(m=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 8px;background:var(--surface2);border-radius:4px;margin-bottom:4px">
      <span>${m.materialName} — ${m.date}</span><span style="font-weight:700">${m.qty} ${m.unit}</span>
    </div>`).join(''):'<div style="font-size:12px;color:var(--text3);margin-bottom:12px">No material entries.</div>'}

    <div class="st" style="margin:14px 0 8px">📄 Documents</div>
    ${docs.length?`<div style="display:flex;flex-wrap:wrap;gap:8px">${docs.map(d=>d.type==='image'
      ?`<img src="${d.url}" style="width:70px;height:70px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="lightbox('${d.url}')">`
      :`<a href="${d.url}" target="_blank" style="display:flex;align-items:center;justify-content:center;width:70px;height:70px;background:var(--surface2);border-radius:6px;font-size:24px;text-decoration:none">📄</a>`
    ).join('')}</div>`:'<div style="font-size:12px;color:var(--text3)">No documents.</div>'}
  </div>`;
  modal.classList.add('open');
}
