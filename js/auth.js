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
  try { await loadDB(); } catch(e){}
  if(pw===D.ownerPw){ CU={role:'owner',name:'RSR Admin'}; saveSession(CU); enterOwner(); }
  else showErr('Incorrect password.');
}

async function contLogin(){
  if(!dbOK){ showErr('Database unreachable. Check your internet.'); return; }
  const name=document.getElementById('cl-name').value.trim();
  const pw=document.getElementById('cl-pw').value;
  if(!name||!pw){ showErr('Enter name and password.'); return; }
  try { await loadDB(); } catch(e){}

  const contractor = D.contractors.find(c=>c.name.trim().toLowerCase()===name.toLowerCase());
  if(!contractor){ showErr('Name or password incorrect. Contact RSR office.'); return; }

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
    saveSession(CU); enterCont();
  } else {
    showErr('Name or password incorrect. Contact RSR office.');
  }
}

function logout(){
  CU=null; clearSession(); stopAutoRefresh(); SP('page-login');
  document.getElementById('main-nav').style.display='none';
  document.getElementById('bnav').style.display='none';
  ['owner-pw','cl-name','cl-pw'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('lerr').style.display='none';
}

function enterOwner(){
  document.getElementById('main-nav').style.display='flex';
  const rb=document.getElementById('nav-role');
  rb.textContent='Owner'; rb.style.background='rgba(201,168,76,.2)'; rb.style.color='var(--gold)';
  document.getElementById('nav-uname').textContent='RSR Admin';
  document.getElementById('nav-links').innerHTML=
    ['Dashboard','Projects','Contractors','Tally','Interest'].map((t,i)=>
      `<div class="nav-link${i===0?' active':''}" id="nl${i}" onclick="ownerTab(${i})">${t}</div>`
    ).join('')+'<div class="nav-link" onclick="OM(\'modal-pw\')">🔑 Password</div>';
  // Show owner-only nav elements
  const gsw = document.getElementById('gsearch-wrap');
  if(gsw) gsw.style.display='flex';
  const backupBtn = document.getElementById('nav-backup-btn');
  if(backupBtn) backupBtn.style.display='inline-block';
  const offBadge = document.getElementById('offline-queue-badge');
  if(offBadge) offBadge.parentElement.style.display='flex';
  const bnav=document.getElementById('bnav');
  bnav.style.display='flex';
  bnav.innerHTML=`
    <button class="bn active" id="obn-0" onclick="ownerTab(0)"><div class="bn-icon">📊</div><div>Dashboard</div></button>
    <button class="bn" id="obn-1" onclick="ownerTab(1)"><div class="bn-icon">🏗️</div><div>Projects</div></button>
    <button class="bn" id="obn-2" onclick="ownerTab(2)"><div class="bn-icon">👷</div><div>Contractors</div></button>
    <button class="bn" id="obn-3" onclick="ownerTab(3)"><div class="bn-icon">📂</div><div>Tally</div></button>
    <button class="bn" id="obn-4" onclick="ownerTab(4)"><div class="bn-icon">📈</div><div>Interest</div></button>`;
  SP('page-owner'); ownerTab(0);
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
  // Show install app banner for contractors
  setTimeout(showInstallBanner, 1500);
  // Show contractor-specific bottom nav
  const bnav = document.getElementById('bnav');
  bnav.style.display='flex';
  bnav.innerHTML=`
    <button class="bn active" id="cbn-0" onclick="cTab(0)"><div class="bn-icon">🏗️</div><div>My Sites</div></button>
    <button class="bn" id="cbn-1" onclick="cTab(1)"><div class="bn-icon">💰</div><div>My Funds</div></button>`;
  SP('page-cont'); cTab(0);
  startAutoRefresh();
}

function cTab(i){
  document.querySelectorAll('[id^="cbn-"]').forEach((b,j)=>b.classList.toggle('active',j===i));
  if(i===0){ renderCHome(); document.getElementById('cp-funds').classList.add('hidden'); }
  if(i===1){ renderCFunds(); ['cp-home','cp-proj','cp-upd'].forEach(id=>document.getElementById(id).classList.add('hidden')); }
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
          <div><div class="card-title">${p.name}</div><div class="card-sub">${p.type} · #${p.tender}</div></div>
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