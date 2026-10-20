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
  el.innerHTML=D.contractors.filter(c=>!isArchived(c)).map(c=>{
    const pp=D.projects.filter(p=>p.contractorId===c.id&&!isArchived(p));
    const cap=pp.reduce((s,p)=>s+totRel(p),0);
    const active=pp.filter(p=>projStatus(p)==='active'||projStatus(p)==='onhold').length;
    const completed=pp.filter(p=>projStatus(p)==='completed').length;
    return `<a href="#contractor-${c.id}" class="card" style="cursor:pointer;text-decoration:none;color:inherit;display:block" onclick="openContractorProfile('${c.id}');return false" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,.08)'" onmouseout="this.style.boxShadow=''">
      <div class="card-hdr">
        <div>
          <div class="card-title">${c.name}</div>
          <div class="card-sub">📞 ${c.phone||'—'}${c.username?' · Login: <strong>'+c.username+'</strong>':''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span class="badge bg-navy">${pp.length} project${pp.length!==1?'s':''}</span>
          <span class="badge bg-gold">${fmt(cap)} deployed</span>
          <span style="font-size:18px;color:var(--text3)">→</span>
        </div>
      </div>
      <div style="display:flex;gap:16px;margin-top:8px;font-size:12px;color:var(--text2)">
        <span>🟢 ${active} active</span>
        <span>✅ ${completed} completed</span>
        ${c.supervisors&&c.supervisors.length?`<span>👥 ${c.supervisors.length} supervisor${c.supervisors.length!==1?'s':''}</span>`:''}
      </div>
    </a>`;}).join('');
}

// ═══════════════════════════════════════════════════════
// CONTRACTOR PROFILE PAGE — full detail view
// ═══════════════════════════════════════════════════════
function openContractorProfile(cid, pushHistory=true){
  const c = D.contractors.find(x=>x.id===cid && !isArchived(x));
  if(!c) return;

  if(pushHistory && typeof pushContractorHistory === 'function') pushContractorHistory(cid);

  document.getElementById('cont-list').classList.add('hidden');
  let profileEl = document.getElementById('cont-profile');
  if(!profileEl){
    profileEl = document.createElement('div');
    profileEl.id = 'cont-profile';
    document.getElementById('cont-list').parentNode.appendChild(profileEl);
  }
  profileEl.classList.remove('hidden');

  renderContractorProfile(cid);
}

function backToContractorList(){
  const profileEl = document.getElementById('cont-profile');
  if(profileEl) profileEl.classList.add('hidden');
  document.getElementById('cont-list').classList.remove('hidden');
  renderConts();
}

function renderContractorProfile(cid){
  const c = D.contractors.find(x=>x.id===cid); if(!c) return;
  const el = document.getElementById('cont-profile');
  if(!el) return;

  const projects = D.projects.filter(p=>p.contractorId===cid && !isArchived(p));
  const active = projects.filter(p=>projStatus(p)==='active');
  const onHold = projects.filter(p=>projStatus(p)==='onhold');
  const completed = projects.filter(p=>projStatus(p)==='completed');
  const expectedJVs = projects.filter(p=>p.expectedJVMonth && !p.jvDate);
  // Deployed = total funds released to this contractor (gross). Checks
  // Received = confirmed payments back from the government. Outstanding =
  // released minus received — RSR's money still out. Received money is
  // subtracted exactly ONCE, in Outstanding. (An earlier version made
  // "Deployed" already net of receipts and then subtracted receipts again
  // for Outstanding, which pushed Outstanding toward zero.) The net is summed
  // across ALL projects first and floored once at the end, so an old
  // over-settled project offsets other work instead of being silently
  // floored to zero on its own.
  const totalDeployed  = projects.reduce((s,p)=>s+totPayments(p),0);
  const totalChecksRcv = projects.reduce((s,p)=>s+totReceipts(p),0);
  const rawNet         = totalDeployed - totalChecksRcv;
  const outstanding    = Math.max(0, rawNet);
  // Only JVs actually received (p.jvDate set) — p.jvAmount can exist
  // ahead of the JV actually landing, so this is the figure that
  // matches "JVs Received" literally rather than every known JV value.
  const jvProjects = projects.filter(p=>p.jvDate);
  const totalJVsValue  = jvProjects.reduce((s,p)=>s+(p.jvAmount||0),0);
  // Check Pending — total still owed by the government against JVs
  // already issued: for each project with a JV, whatever's left after
  // confirmed settlements, summed across all of this contractor's work.
  const checkPending = jvProjects.reduce((s,p)=>{
    const settled = (p.settlements||[]).filter(s2=>!isArchived(s2)).reduce((s3,s2)=>s3+s2.amount,0);
    return s + Math.max(0, (p.jvAmount||0) - settled);
  },0);
  const ledger = typeof calcContractorLedger==='function' ? calcContractorLedger(c) : {currentOutstanding:0, currentFYInterest:0};

  // Super Admin can edit any headline figure (and reset it to the app's own
  // calculation). Everyone else always sees the calculation. Figures derived
  // from others (Outstanding) follow an edit made upstream.
  if(typeof cxEnsureLoaded==='function') cxEnsureLoaded(c.id);
  const ef = (key, calc)=> (typeof cxEffective==='function') ? cxEffective(c.id, key, calc) : {value:calc, edited:false, calc};
  const eDeployed = ef('deployed', totalDeployed);
  const eJVs      = ef('jvs', totalJVsValue);
  const eChecks   = ef('checks', totalChecksRcv);
  const ePending  = ef('pending', checkPending);
  const eOutst    = ef('outstanding', Math.max(0, eDeployed.value - eChecks.value));
  const eInterest = ef('interest', ledger.currentFYInterest||0);

  el.innerHTML = `
    <div style="margin-bottom:16px">
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="btn btn-sm" onclick="history.back()" title="Go back to wherever you came from (e.g. the project you opened this from)">← Back</button>
        <button class="btn btn-sm" onclick="backToContractorList()">← All Contractors</button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:22px;font-weight:800;color:var(--navy)">${c.name}</div>
          <div style="font-size:13px;color:var(--text3);margin-top:4px">${c.type||'Contractor'}${c.notes?' · '+c.notes:''}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="openEditContractor('${c.id}')">✏️ Edit Details</button>
          <button class="btn btn-sm" onclick="openChangeCPw('${c.id}')">🔑 Change Password</button>
          <div class="amenu-wrap">
            <button class="amenu-btn" onclick="event.stopPropagation();toggleMenu('cpm-${c.id}')">⋮</button>
            <div class="amenu" id="cpm-${c.id}">
              <button class="amenu-item danger" onclick="deleteContractor('${c.id}')">🗑️ Delete Contractor</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Personal Details -->
    <div class="card" style="margin-bottom:14px">
      <div class="st">👤 Personal Details</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:10px">
        <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase">Full Name</div><div style="font-size:14px;font-weight:600">${c.name}</div></div>
        <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase">Phone</div><div style="font-size:14px;font-weight:600">${c.phone||'—'}</div></div>
        <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase">Login Username</div><div style="font-size:14px;font-weight:600">${c.username||'—'}</div></div>
        <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase">Type</div><div style="font-size:14px;font-weight:600">${c.type||'—'}</div></div>
        <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase">Email</div><div style="font-size:14px;font-weight:600">${c.email||'—'}</div></div>
        <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase">GST Number</div><div style="font-size:14px;font-weight:600">${c.gst||'—'}</div></div>
        <div style="grid-column:1/-1"><div style="font-size:11px;color:var(--text3);text-transform:uppercase">Address</div><div style="font-size:14px;font-weight:600">${c.address||'—'}</div></div>
      </div>
    </div>

    <!-- Supervisors -->
    ${(c.supervisors&&c.supervisors.length)?`
    <div class="card" style="margin-bottom:14px">
      <div class="st">👥 Supervisors (${c.supervisors.length})</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
        ${c.supervisors.map(s=>`<div style="display:flex;justify-content:space-between;padding:8px 10px;background:var(--surface2);border-radius:var(--rs);font-size:13px">
          <span style="font-weight:600">${s.name}</span><span style="color:var(--text3)">@${s.username}</span>
        </div>`).join('')}
      </div>
    </div>`:''}

    <!-- Financial Summary — 3 key figures + outstanding + interest -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px">
      ${[
        {k:'deployed',    e:eDeployed, l:'💰 Deployed to Contractor', c:'var(--navy)',
          sub:'Total funds released so far'},
        {k:'jvs',         e:eJVs,      l:'📋 JVs Received (value)', c:'#7c3aed',
          sub:'Sum of all JV amounts received'},
        {k:'checks',      e:eChecks,   l:'✅ Checks Received', c:'var(--green)',
          sub:'Total payment received'},
        {k:'pending',     e:ePending,  l:'🏦 Check Pending', c:(ePending.value>0?'var(--amber)':'var(--green)'),
          sub:'Owed by govt. against JVs issued'},
        {k:'outstanding', e:eOutst,    l:'⏳ Outstanding', c:(eOutst.value>0?'var(--red)':'var(--green)'),
          sub:'Released minus checks received'},
        {k:'interest',    e:eInterest, l:'📈 Interest (this FY)', c:'var(--amber)',
          sub:'Accrued this financial year (app calculation)'},
      ].map(x=>`<div class="card" style="text-align:center;padding:12px;border-top:3px solid ${x.c}">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:700;margin-bottom:4px">${x.l}${x.e.edited?' <span style="background:var(--amber);color:#fff;border-radius:6px;padding:0 5px;font-size:9px">EDITED</span>':''}</div>
        <div style="font-size:16px;font-weight:800;color:${x.c}">${(x.e.value||x.e.edited)?fmt(x.e.value):'—'}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:3px">${x.e.edited?'Calculated: '+fmt(x.e.calc)+(x.e.note?' · '+x.e.note:''):x.sub}</div>
        ${typeof cxStatControls==='function'?cxStatControls(c.id, x.k, x.l.replace(/^\S+\s/,''), x.e):''}
      </div>`).join('')}
    </div>

    <!-- Project counts -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:14px">
      ${[
        {l:'Total Projects',v:projects.length,c:'var(--navy)'},
        {l:'Active',v:active.length,c:'var(--green)'},
        {l:'On Hold',v:onHold.length,c:'var(--amber)'},
        {l:'Completed',v:completed.length,c:'#7c3aed'},
      ].map(x=>`<div class="card" style="text-align:center;padding:10px">
        <div style="font-size:18px;font-weight:800;color:${x.c}">${x.v}</div>
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:700">${x.l}</div>
      </div>`).join('')}
    </div>

    <!-- Tally reconciliation, earlier work, interest by FY (Super Admin only) -->
    ${typeof renderContractorExtrasBlock==='function'?renderContractorExtrasBlock(c.id, {appNet:rawNet, ledger}):''}

    <!-- Expected JVs -->
    ${expectedJVs.length?`
    <div class="card" style="margin-bottom:14px;border-left:4px solid #7c3aed">
      <div class="st">📅 Expected JVs (${expectedJVs.length})</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
        ${expectedJVs.map(p=>`<div onclick="openDetail('${p.id}')" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface2);border-radius:var(--rs);cursor:pointer;font-size:13px">
          <span style="font-weight:600;color:var(--navy)">${p.name.substring(0,45)}</span>
          <span style="color:#7c3aed;font-size:12px">${p.expectedJVMonthLabel||p.expectedJVMonth}</span>
        </div>`).join('')}
      </div>
    </div>`:''}

    <!-- Projects: Active -->
    ${renderContractorProjectGroup('🟢 Active Projects', active, false, 'running')}
    ${renderContractorProjectGroup('⏸ On Hold', onHold, false, 'running')}
    ${renderContractorProjectGroup('✅ Completed', completed, true, 'completed')}

    <!-- Bills received & GST filing (Super Admin only) — moved below the
         project lists so the work itself comes first, financial filing
         detail after. -->
    ${typeof renderContractorBillsSection==='function'?renderContractorBillsSection(c.id):''}

    <!-- Other Projects (non-RSR personal work) -->
    ${typeof renderContractorPersonalProjects==='function'?renderContractorPersonalProjects(c.id):''}
  `;
  if(typeof applyToggleStates==='function') applyToggleStates();
}

// kind 'running': what matters while work is live — agreement, what's been
// paid out, what's come back, what's still owed, and how much of the 70%
// cap is used / left. kind 'completed': the finished picture — released vs
// received side by side, the net of the two, anything still owed, and the
// JV / EA status, so a closed project can be judged from this table
// without opening it. Released = gross paid out (not net-of-receipts),
// Received = confirmed checks; Net = Received − Released.
function renderContractorProjectGroup(title, projects, collapsedByDefault, kind){
  if(!projects.length) return '';
  const toggleKey = 'contprofile-grp-'+title.replace(/[^a-z]/gi,'');
  const rowData = projects.map(p=>{
    const agreement = agAmt(p)||0;
    const released = totPayments(p);
    const received = totReceipts(p);
    const pending = p.jvDate ? Math.max(0,(p.jvAmount||0)-received) : 0;
    const cap = maxF(p)||0;
    const capUsed = cap>0 ? Math.min(999, totRel(p)/cap*100) : 0;
    const capLeft = Math.max(0, cap - totRel(p));
    const ea = p.eaNumber || (p.documents && p.documents.ea) || '';
    return {p, agreement, released, received, net: received-released, pending, capUsed, capLeft, ea};
  });
  const sum = k=>rowData.reduce((s,r)=>s+(r[k]||0),0);
  const cols = kind==='completed'
    ? ['Project','Agreement','Released','Received','Net (Rcvd − Rel)','Check Pending','JV date','EA','Status']
    : ['Project','Agreement','Released','Received','Check Pending','Cap Used','Cap Left','Status'];
  const numCols = new Set(['Agreement','Released','Received','Net (Rcvd − Rel)','Check Pending','Cap Left']);
  const td = (v,extra)=>`<td class="fv" style="text-align:right;${extra||''}">${v}</td>`;
  const rowHtml = ({p,agreement,released,received,net,pending,capUsed,capLeft,ea})=>{
    const name = `<td><a href="#project-${p.id}" onclick="openDetail('${p.id}');return false" style="color:var(--navy);font-weight:700">${p.name}</a></td>`;
    const pendTd = td(pending>0?fmt(pending):'—', pending>0?'color:var(--amber);font-weight:700':'');
    if(kind==='completed'){
      return `<tr>${name}${td(agreement?fmt(agreement):'—')}${td(fmt(released))}${td(received?fmt(received):'—')}
        ${td((released||received)?fmt(net):'—', 'font-weight:700;color:'+(net>=0?'var(--green)':'var(--red)'))}${pendTd}
        <td style="white-space:nowrap">${p.jvDate?fmtDate(p.jvDate):'—'}</td>
        <td style="white-space:nowrap">${ea?'✓ '+ea:'<span style="color:var(--text3)">—</span>'}</td>
        <td>${sBadge(pStat(p),p)}</td></tr>`;
    }
    return `<tr>${name}${td(agreement?fmt(agreement):'—')}${td(fmt(released))}${td(received?fmt(received):'—')}${pendTd}
      <td>${pct(capUsed)}</td>${td(fmt(capLeft))}<td>${sBadge(pStat(p),p)}</td></tr>`;
  };
  const totalsRow = kind==='completed'
    ? `<tr style="background:var(--surface2);font-weight:700"><td>Total (${rowData.length})</td>${td(fmt(sum('agreement')))}${td(fmt(sum('released')))}${td(fmt(sum('received')))}${td(fmt(sum('net')),'color:'+(sum('net')>=0?'var(--green)':'var(--red)'))}${td(sum('pending')?fmt(sum('pending')):'—')}<td colspan="3"></td></tr>`
    : `<tr style="background:var(--surface2);font-weight:700"><td>Total (${rowData.length})</td>${td(fmt(sum('agreement')))}${td(fmt(sum('released')))}${td(fmt(sum('received')))}${td(sum('pending')?fmt(sum('pending')):'—')}<td></td>${td(fmt(sum('capLeft')))}<td></td></tr>`;
  return `<div class="card" style="margin-bottom:14px">
    <details data-toggle="${toggleKey}" ${collapsedByDefault?'':'open'}>
      <summary style="cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center">
        <div class="st" style="margin:0;border:none;padding:0">${title} (${projects.length})</div>
        <span style="font-size:11px;font-weight:600;color:var(--navy)">▼ Show / Hide</span>
      </summary>
      <div class="tbl-wrap" style="margin-top:10px"><table style="min-width:${kind==='completed'?'860':'760'}px"><thead><tr>${cols.map(h=>`<th${numCols.has(h)?' style="text-align:right"':''}>${h}</th>`).join('')}</tr></thead><tbody>
        ${rowData.map(rowHtml).join('')}
        ${totalsRow}
      </tbody></table></div>
    </details>
  </div>`;
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
  // Hash new password before saving
  try{
    const {hash, salt} = await hashPassword(nw);
    c.passwordHash = hash;
    c.passwordSalt = salt;
    delete c.password; // remove any old plaintext
  }catch(e){
    c.password = nw; // fallback
  }
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

  // Hash password before storing — never store plaintext
  let pwData = {};
  try{
    const {hash, salt} = await hashPassword(password);
    pwData = {passwordHash: hash, passwordSalt: salt};
  }catch(e){
    // Fallback to plaintext if Web Crypto unavailable (very old browsers)
    console.warn('Password hashing failed, storing plaintext as fallback:', e);
    pwData = {password};
  }

  const username = document.getElementById('nc-username').value.trim().toLowerCase();
  // Check username uniqueness
  if(username && D.contractors.some(x=>x.username&&x.username.toLowerCase()===username)){
    toast('Username already taken — choose a different one','error'); return;
  }
  const c={id:uid(),name,phone,username:username||'', ...pwData,notes,createdAt:new Date().toISOString()};
  D.contractors.push(c);
  try {
    await saveContractorDB(c);
    CM('modal-nc');
    ['nc-name','nc-phone','nc-pw','nc-notes'].forEach(id=>document.getElementById(id).value='');
    renderConts();
    toast('✓ Contractor added','ok');
    if(typeof writeActivityLog==='function') writeActivityLog('contractor_add',`Contractor added: ${name}`).catch(()=>{});
  } catch(e){ toast('Save failed','error'); }
}

// ═══════════════════════════════════════════════════════
// FUNDS LOG
// ═══════════════════════════════════════════════════════
// ─── EDIT CONTRACTOR ─────────────────────────────────
let editContractorId = null;

function openEditContractor(cid){
  const c = D.contractors.find(x=>x.id===cid); if(!c) return;
  editContractorId = cid;
  document.getElementById('ec-username').value = c.username||'';
  document.getElementById('ec-name').value = c.name||'';
  document.getElementById('ec-phone').value = c.phone||'';
  document.getElementById('ec-type').value = c.type||'';
  document.getElementById('ec-email').value = c.email||'';
  document.getElementById('ec-gst').value = c.gst||'';
  document.getElementById('ec-address').value = c.address||'';
  document.getElementById('ec-notes').value = c.notes||'';
  OM('modal-edit-contractor');
}

async function saveEditContractor(){
  const c = D.contractors.find(x=>x.id===editContractorId); if(!c) return;
  const name = document.getElementById('ec-name').value.trim();
  const phone = document.getElementById('ec-phone').value.trim();
  if(!name){ toast('Name is required','error'); return; }
  const newUsername = (document.getElementById('ec-username').value||'').trim().toLowerCase();
  if(newUsername && D.contractors.some(x=>x.id!==editContractorId&&x.username&&x.username.toLowerCase()===newUsername)){
    toast('Username already taken — choose a different one','error'); return;
  }
  c.username = newUsername;
  c.name = name;
  c.phone = phone;
  c.type = document.getElementById('ec-type').value.trim();
  c.email = document.getElementById('ec-email').value.trim();
  c.gst = document.getElementById('ec-gst').value.trim();
  c.address = document.getElementById('ec-address').value.trim();
  c.notes = document.getElementById('ec-notes').value.trim();
  try{
    await saveContractorDB(c);
    CM('modal-edit-contractor');
    renderConts();
    renderContractorPerformance();
    // If the profile page for this contractor is currently open, refresh it too
    const profileEl = document.getElementById('cont-profile');
    if(profileEl && !profileEl.classList.contains('hidden')) renderContractorProfile(c.id);
    toast('✓ Contractor updated','ok');
  }catch(e){ toast('Save failed','error'); }
}
