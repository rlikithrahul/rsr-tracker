// ═══════════════════════════════════════
// contractors.js
// RSR Constructions Tracker v17
// ═══════════════════════════════════════

// ═══════════════════════════════════════════════════════
// CONTRACTORS
// ═══════════════════════════════════════════════════════
function renderConts(){
  const el=document.getElementById('cont-list');
  if(!D.contractors.length){el.innerHTML='<div class="empty"><div class="empty-icon">👷</div><div class="empty-text">No contractors yet.</div></div>';return;}
  el.innerHTML=D.contractors.map(c=>{
    const pp=D.projects.filter(p=>p.contractorId===c.id);
    const cap=pp.reduce((s,p)=>s+totRel(p),0);
    return `<div class="card">
      <div class="card-hdr">
        <div><div class="card-title">${c.name}</div><div class="card-sub">📞 ${c.phone||'—'} · ${c.notes||'—'}</div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span class="badge bg-navy">${pp.length} project${pp.length!==1?'s':''}</span>
          <span class="badge bg-gold">${fmt(cap)} deployed</span>
          <div class="amenu-wrap">
            <button class="amenu-btn" onclick="event.stopPropagation();toggleMenu('cm-${c.id}')">⋮</button>
            <div class="amenu" id="cm-${c.id}">
              <button class="amenu-item" onclick="openChangeCPw('${c.id}')">🔑 Change Password</button>
              <button class="amenu-item danger" onclick="deleteContractor('${c.id}')">🗑️ Delete Contractor</button>
            </div>
          </div>
        </div>
      </div>
      ${pp.length?`<div class="tbl-wrap"><table><thead><tr><th>Project</th><th>Released</th><th>Verified</th><th>Status</th></tr></thead><tbody>
        ${pp.map(p=>`<tr><td><a href="#" onclick="openDetail('${p.id}');return false" style="color:var(--navy);font-weight:700">${p.name}</a></td><td class="fv">${fmt(totRel(p))}</td><td>${pct(verPct(p))}</td><td>${sBadge(pStat(p),p)}</td></tr>`).join('')}</tbody></table></div>`
      :'<div style="font-size:13px;color:var(--text3)">No projects assigned.</div>'}
    </div>`;}).join('');
}

function openChangeCPw(cid){
  const c = D.contractors.find(x=>x.id===cid);
  if(!c) return;
  changePwContractorId = cid;
  document.getElementById('cpw-name').textContent = c.name;
  document.getElementById('cpw-new').value = '';
  document.getElementById('cpw-confirm').value = '';
  document.getElementById('cpw-err').style.display = 'none';
  document.getElementById('modal-cpw').classList.add('open');
}

async function saveContractorPw(){
  const nw = document.getElementById('cpw-new').value;
  const conf = document.getElementById('cpw-confirm').value;
  const err = document.getElementById('cpw-err');
  if(nw.length < 4){ err.textContent='Password must be at least 4 characters.'; err.style.display='block'; return; }
  if(nw !== conf){ err.textContent='Passwords do not match.'; err.style.display='block'; return; }
  const c = D.contractors.find(x=>x.id===changePwContractorId);
  if(!c) return;
  c.password = nw;
  try {
    await saveContractorDB(c);
    CM('modal-cpw');
    toast(`✓ Password updated for ${c.name}`,'ok');
  } catch(e){ toast('Save failed','error'); }
}

// ═══════════════════════════════════════════════════════
// OWNER NOTES (private, per project, RSR admin only)
// ═══════════════════════════════════════════════════════

function openOwnerNotes(pid){
  const p = GP(pid); if(!p) return;
  notesPid = pid;
  document.getElementById('notes-project-name').textContent = p.name;
  document.getElementById('notes-text').value = p.ownerNotes || '';
  document.getElementById('modal-notes').classList.add('open');
}

async function saveOwnerNotes(){
  const p = GP(notesPid); if(!p) return;
  p.ownerNotes = document.getElementById('notes-text').value.trim();
  p.ownerNotesUpdated = new Date().toISOString();
  try {
    await saveProjectDB(p);
    CM('modal-notes');
    // Refresh detail if currently viewing this project
    if(dpid === notesPid) renderDetail(notesPid);
    toast('✓ Notes saved','ok');
  } catch(e){ toast('Save failed','error'); }
}

async function saveContractor(){
  const name=document.getElementById('nc-name').value.trim();
  const phone=document.getElementById('nc-phone').value.trim();
  const password=document.getElementById('nc-pw').value;
  const notes=document.getElementById('nc-notes').value.trim();
  if(!name||!phone||!password){alert('Name, phone, and password are required.');return;}
  if(password.length<4){alert('Password must be at least 4 characters.');return;}
  const c={id:uid(),name,phone,password,notes,createdAt:new Date().toISOString()};
  D.contractors.push(c);
  try {
    await saveContractorDB(c);
    CM('modal-nc');
    ['nc-name','nc-phone','nc-pw','nc-notes'].forEach(id=>document.getElementById(id).value='');
    renderConts();
    toast('✓ Contractor added','ok');
  } catch(e){ toast('Save failed','error'); }
}

// ═══════════════════════════════════════════════════════
// FUNDS LOG
// ═══════════════════════════════════════════════════════