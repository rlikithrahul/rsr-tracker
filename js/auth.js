// ─── PASSWORD HASHING ─────────────────────────────────
// SHA-256 + per-contractor salt using Web Crypto API
// Salt stored alongside hash in contractor record
async function hashPassword(password, salt){
  if(!salt) salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b=>b.toString(16).padStart(2,'0')).join('');
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), {name:'PBKDF2'}, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {name:'PBKDF2', salt:enc.encode(salt), iterations:10000, hash:'SHA-256'},
    keyMaterial, 256
  );
  const hash = Array.from(new Uint8Array(bits))
    .map(b=>b.toString(16).padStart(2,'0')).join('');
  return {hash, salt};
}

async function verifyPassword(password, storedHash, salt){
  if(!storedHash || !salt) return false;
  const {hash} = await hashPassword(password, salt);
  return hash === storedHash;
}

// ═══════════════════════════════════════
// auth.js
// RSR Constructions Tracker v17
// ═══════════════════════════════════════

// ─── SESSION PERSISTENCE ──────────────────────────────
// Keeps user logged in across page refreshes
function saveSession(u){
  try{ sessionStorage.setItem('rsr_session',JSON.stringify(u)); }catch(e){}
}
function loadSession(){
  try{ const s=sessionStorage.getItem('rsr_session'); return s?JSON.parse(s):null; }catch(e){return null;}
}
function clearSession(){
  try{ sessionStorage.removeItem('rsr_session'); }catch(e){}
}

// ═══════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════
function selRole(r){
  document.getElementById('rt-owner').classList.toggle('active',r==='owner');
  document.getElementById('rt-cont').classList.toggle('active',r==='contractor');
  document.getElementById('lf-owner').classList.toggle('hidden',r!=='owner');
  document.getElementById('lf-cont').classList.toggle('hidden',r==='owner');
  document.getElementById('lerr').style.display='none';
}

async function ownerLogin(){
  if(!dbOK){ showErr('Database unreachable. Check your internet.'); return; }
  const pw=document.getElementById('owner-pw').value;
  if(!pw){ showErr('Enter your password.'); return; }
  try { await loadDB(); } catch(e){}

  // Check master password first (Super Admin)
  if(pw === D.ownerPw){
    CU={role:'owner', name:'Likith', isSuperAdmin:true};
    saveSession(CU);
    logLogin('Likith', 'super_admin', null);
    await writeActivityLog('login', 'Likith logged in (Super Admin)');
    enterOwner();
    return;
  }

  // Check staff passwords
  const staff = (D.staffMembers||[]).find(s=>s.password===pw);
  if(staff){
    CU={role:'owner', name:staff.name, isSuperAdmin:false, staffId:staff.id};
    saveSession(CU);
    logLogin(staff.name, 'staff', null);
    await writeActivityLog('login', `${staff.name} logged in`);
    enterOwner();
    return;
  }

  showErr('Incorrect password.');
}

async function contLogin(){
  if(!dbOK){ showErr('Database unreachable. Check your internet.'); return; }
  const name=document.getElementById('cl-name').value.trim();
  const pw=document.getElementById('cl-pw').value;
  if(!name||!pw){ showErr('Enter name and password.'); return; }
  try { await loadDB(); } catch(e){}

  // Check supervisor login first
  if(typeof checkSupervisorLogin === 'function'){
    const svMatch = checkSupervisorLogin(name, pw);
    if(svMatch){
      CU={role:'contractor', id:svMatch.contractor.id, name:svMatch.supervisor.name, isSupervisor:true, supervisorId:svMatch.supervisor.id};
      saveSession(CU);
      logLogin(svMatch.supervisor.name, 'supervisor', svMatch.contractor.name);
      enterCont();
      return;
    }
  }

  // Match contractor by full name, username, or phone number
  const contractor = D.contractors.find(c=>{
    const nameMatch = c.name.trim().toLowerCase()===name.toLowerCase();
    const usernameMatch = c.username && c.username.trim().toLowerCase()===name.toLowerCase();
    const phoneMatch = c.phone && c.phone.trim()===name.trim();
    return nameMatch || usernameMatch || phoneMatch;
  });
  if(!contractor){ showErr('Name, username or phone not found. Contact RSR office.'); return; }

  let authenticated = false;

  if(contractor.passwordHash && contractor.passwordSalt){
    // Modern: hashed password
    authenticated = await verifyPassword(pw, contractor.passwordHash, contractor.passwordSalt);
  } else if(contractor.password){
    // Legacy: plaintext — verify then migrate to hash on the spot
    authenticated = (contractor.password === pw);
    if(authenticated){
      // Migrate to hashed storage silently
      try{
        const {hash, salt} = await hashPassword(pw);
        contractor.passwordHash = hash;
        contractor.passwordSalt = salt;
        delete contractor.password; // remove plaintext
        await saveContractorDB(contractor);
        console.log('[Auth] Password migrated to hash for:', contractor.name);
      }catch(e){ console.warn('[Auth] Hash migration failed:', e); }
    }
  }

  if(authenticated){
    CU={role:'contractor',id:contractor.id,name:contractor.name};
    saveSession(CU);
    logLogin(contractor.name, 'contractor', contractor.name);
    enterCont();
  } else {
    showErr('Name or password incorrect. Contact RSR office.');
  }
}

function logout(){
  if(CU) writeActivityLog('logout', `${CU.name} logged out`).catch(()=>{});
  CU=null; clearSession(); stopAutoRefresh();
  // Hide sidebar when logging out
  const sb = document.getElementById('sidebar');
  if(sb){ sb.style.display='none'; sb.classList.remove('open'); }
  const ov = document.getElementById('sidebar-overlay');
  if(ov) ov.style.display='none';
  SP('page-login');
  document.getElementById('main-nav').style.display='none';
  document.getElementById('bnav').style.display='none';
  ['owner-pw','cl-name','cl-pw'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('lerr').style.display='none';
}

function enterOwner(){
  document.getElementById('main-nav').style.display='flex';
  // Premium UX init
  if(typeof initPremium === 'function') initPremium();
  const rb=document.getElementById('nav-role');
  rb.textContent='Owner'; rb.style.background='rgba(201,168,76,.2)'; rb.style.color='var(--gold)';
  document.getElementById('nav-uname').textContent=(CU&&!CU.isSuperAdmin&&CU.name)?CU.name:'Likith';
  document.getElementById('nav-links').innerHTML='';
  const gsw=document.getElementById('gsearch-wrap'); if(gsw) gsw.style.display='flex';
  const backupBtn=document.getElementById('nav-backup-btn'); if(backupBtn) backupBtn.style.display='inline-block';
  const offBadge=document.getElementById('offline-queue-badge'); if(offBadge) offBadge.parentElement.style.display='flex';
  const bnav=document.getElementById('bnav'); if(bnav) bnav.style.display='none';
  showSidebar();
  buildSidebar(CU&&CU.isSuperAdmin);
  setTimeout(()=>{ requestNotificationPermission().catch(()=>{}); },2000);
  SP('page-owner');
  Promise.all([
    loadEMIData().catch(()=>{}),
    loadGSTData().catch(()=>{}),
    loadCustomWorkTypes().catch(()=>{})
  ]).then(()=>{
    // Try restoring previous session position
    if(typeof restoreSessionState === 'function' && restoreSessionState()) return;
    ownerTab(0);
  }).catch(()=>{ ownerTab(0); });
  startAutoRefresh();
}

function enterCont(){
  document.getElementById('main-nav').style.display='flex';
  const rb=document.getElementById('nav-role');
  rb.textContent='Contractor'; rb.style.background='rgba(255,255,255,.15)'; rb.style.color='#fff';
  document.getElementById('nav-uname').textContent=CU.name;
  document.getElementById('nav-links').innerHTML='';
  // Hide owner-only nav elements for contractors
  const gsw = document.getElementById('gsearch-wrap');
  if(gsw) gsw.style.display='none';
  const backupBtn = document.getElementById('nav-backup-btn');
  if(backupBtn) backupBtn.style.display='none';
  const refreshBtn = document.getElementById('refresh-btn');
  if(refreshBtn) refreshBtn.style.display='none';
  // Hide sidebar for contractors
  const sb = document.getElementById('sidebar');
  if(sb) sb.style.display='none';
  // Show install app banner for contractors
  setTimeout(showInstallBanner, 1500);
  // Show contractor-specific bottom nav
  const bnav = document.getElementById('bnav');
  bnav.style.display='flex';
  bnav.innerHTML=`
    <button class="bn active" id="cbn-0" onclick="cTab(0)"><div class="bn-icon">🏗️</div><div>My Sites</div></button>
    <button class="bn" id="cbn-1" onclick="cTab(1)" style="${CU.isSupervisor?'display:none':''}"><div class="bn-icon">💰</div><div>My Funds</div></button>
    <button class="bn" id="cbn-2" onclick="cTab(2)" style="${CU.isSupervisor?'display:none':''}"><div class="bn-icon">👥</div><div>Team</div></button>`;
  SP('page-cont'); cTab(0);
  startAutoRefresh();
}

function cTab(i){
  document.querySelectorAll('[id^="cbn-"]').forEach((b,j)=>b.classList.toggle('active',j===i));
  if(i===0){ renderCHome(); document.getElementById('cp-funds').classList.add('hidden'); }
  if(i===1){ renderCFunds(); ['cp-home','cp-proj','cp-upd'].forEach(id=>document.getElementById(id)?.classList.add('hidden')); }
  if(i===2){
    ['cp-home','cp-proj','cp-upd','cp-funds'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
    let svTab = document.getElementById('cp-supervisors');
    if(!svTab){ svTab=document.createElement('div'); svTab.id='cp-supervisors'; svTab.className='cp-section'; document.getElementById('page-cont').appendChild(svTab); }
    svTab.classList.remove('hidden');
    svTab.innerHTML = '<div style="padding:16px"><div id="sv-panel">'+renderSupervisorPanel()+'</div></div>';
  }
}

function renderCFunds(){
  const el=document.getElementById('cp-funds');
  el.classList.remove('hidden');
  const myProjects = D.projects.filter(p=>p.contractorId===CU.id);
  if(!myProjects.length){
    el.innerHTML='<div class="empty"><div class="empty-icon">💰</div><div class="empty-text">No projects assigned yet.</div></div>';
    return;
  }
  // Per-project fund summary — contractor sees amount deployed, not full transaction log
  let totalDeployed=0, totalSettled=0;
  myProjects.forEach(p=>{totalDeployed+=totRel(p);totalSettled+=(p.settlements||[]).reduce((s,x)=>s+x.amount,0);});
  const outstanding=Math.max(0,totalDeployed-totalSettled);

  el.innerHTML=`
    <h2 style="font-size:20px;font-weight:700;color:var(--navy);margin-bottom:6px">My Funds</h2>
    <p style="font-size:13px;color:var(--text3);margin-bottom:20px">Summary of funds deployed across your projects.</p>
    <div class="stats" style="grid-template-columns:1fr 1fr;margin-bottom:20px">
      <div class="stat"><div class="stat-lbl">Total Received</div><div class="stat-val" style="font-size:18px">${fmt(totalDeployed)}</div><div class="stat-sub">all projects</div></div>
      <div class="stat"><div class="stat-lbl">Outstanding</div><div class="stat-val" style="font-size:18px;color:${outstanding>0?'var(--red)':'var(--green)'}">${fmt(outstanding)}</div><div class="stat-sub">balance owed to RSR</div></div>
    </div>
    ${myProjects.map(p=>{
      const rel=totRel(p),max=maxF(p),settled=(p.settlements||[]).reduce((s,x)=>s+x.amount,0);
      const capPct=max>0?Math.round(rel/max*100):0;
      const alert=capAlert(p);
      return `<div class="card">
        <div class="card-hdr">
          <div onclick="cOpenProj('${p.id}')" style="cursor:pointer"><div class="card-title" style="color:var(--navy);text-decoration:underline">${p.name}</div><div class="card-sub">${p.type} · #${p.tender}</div></div>
          ${sBadge(pStat(p),p)}
        </div>
        ${alert}
        <div class="fr"><span class="fl">Funds Received</span><span class="fv">${fmt(rel)}</span></div>
        <div class="fr"><span class="fl">Max Allowed (70% of agreement)</span><span class="fv">${fmt(max)}</span></div>
        <div class="fr"><span class="fl">Cap Used</span><span class="fv" style="color:${capPct>=70?'var(--red)':capPct>=55?'var(--amber)':'var(--green)'}">${capPct}%</span></div>
        <div class="fr"><span class="fl">Government Payment Received</span><span class="fv" style="color:var(--green)">${fmt(settled)}</span></div>
        <div class="fr"><span class="fl">Balance Owed to RSR</span><span class="fv" style="color:${(rel-settled)>0?'var(--red)':'var(--green)'}">${fmt(Math.max(0,rel-settled))}</span></div>
        <div style="margin-top:10px">
          <div class="prog-lbl"><span style="font-size:12px">Funding used</span><span style="font-size:12px">${capPct}% of cap</span></div>
          <div class="prog-track" style="height:8px"><div class="prog-fill ${capPct>=85?'pf-red':capPct>=55?'pf-amber':'pf-green'}" style="width:${Math.min(capPct,100)}%"></div></div>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:8px">Contact RSR office for detailed transaction history.</div>
      </div>`;
    }).join('')}`;
}

// ═══════════════════════════════════════════════════════
// OWNER TABS
// ═══════════════════════════════════════════════════════