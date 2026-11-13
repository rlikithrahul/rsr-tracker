// ═══════════════════════════════════════════════════════
// pwhash.js — password hashing for Super Admin, staff and supervisor logins
//
// A stored password is either
//   • plain text (old)               → still accepted, so nobody is locked out, or
//   • "pbkdf2$100000$<salt>$<hash>"  → hashed (new).
// After a Super Admin login, plain ones are converted automatically (pwMigrateAll).
// Every conversion is checked (the hash must verify, and must read back from the
// database) before it is kept; if anything fails the old value is put back.
//
// Passwords the Tally Live function also reads (main/Tally/recovery owner passwords and
// staff Tally Live passwords) are only converted once the updated tally-api function
// is live (pwTallyReady), otherwise Tally Live login would stop working.
// ═══════════════════════════════════════════════════════
const PW_ITER = 100000;
const PW_FIRST_RUN_DEFAULT = 'RSR@2024';   // accepted ONLY while no owner password has ever been saved; forces a change at once

function pwIsHashed(v){ return typeof v==='string' && v.indexOf('pbkdf2$')===0; }
const _pwHex = u8 => Array.from(u8).map(b=>b.toString(16).padStart(2,'0')).join('');
async function _pwDerive(plain, salt, iter){
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey('raw', enc.encode(plain), {name:'PBKDF2'}, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2', salt:enc.encode(salt), iterations:iter, hash:'SHA-256'}, km, 256);
  return _pwHex(new Uint8Array(bits));
}
async function pwHash(plain){
  const salt = _pwHex(crypto.getRandomValues(new Uint8Array(16)));
  return 'pbkdf2$'+PW_ITER+'$'+salt+'$'+await _pwDerive(plain, salt, PW_ITER);
}
// does the typed password match the stored value (plain or hashed)?
async function pwCheck(plain, stored){
  if(!stored || plain==null || plain==='') return false;
  if(!pwIsHashed(stored)) return String(stored)===String(plain);
  const p = String(stored).split('$'); if(p.length!==4) return false;
  const h = await _pwDerive(String(plain), p[2], parseInt(p[1],10)||PW_ITER);
  let d = h.length ^ p[3].length; for(let i=0;i<h.length && i<p[3].length;i++) d |= h.charCodeAt(i)^p[3].charCodeAt(i);
  return d===0;
}
async function pwAnyMatch(plain, list){ for(const s of (list||[])) if(s && await pwCheck(plain, s)) return true; return false; }

// is the deployed tally-api able to read hashed passwords?  (cached for this page load)
let _pwTallyOk = null;
async function pwTallyReady(){
  if(_pwTallyOk!==null) return _pwTallyOk;
  try{
    const r = await fetch(SB_URL+'/functions/v1/tally-api',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_KEY,'apikey':SB_KEY},body:JSON.stringify({action:'caps'})});
    const j = await r.json().catch(()=>null);
    _pwTallyOk = !!(j && j.pwhash===1);
  }catch(e){ _pwTallyOk = false; }
  return _pwTallyOk;
}
// value to store for a newly typed password
async function pwStore(plain, tallyReadable){
  if(tallyReadable && !(await pwTallyReady())) return plain;
  return pwHash(plain);
}
// the current main password check (also accepts the first-run default while no password row exists)
async function pwOwnerOk(plain){
  if(!D.ownerPw) return plain===PW_FIRST_RUN_DEFAULT;
  return pwCheck(plain, D.ownerPw);
}

// ── convert stored plain passwords → hashed (Super Admin session only) ──
let _pwMigrating = false;
async function pwMigrateAll(){
  if(_pwMigrating || !(CU && CU.isSuperAdmin)) return;
  _pwMigrating = true;
  try{
    // 1) staff app passwords (only this app reads them)
    let staffChanged = false; const backup = JSON.stringify(D.staffMembers||[]);
    for(const s of (D.staffMembers||[])){
      if(s.password && !pwIsHashed(s.password)){ const h = await pwHash(s.password); if(await pwCheck(s.password,h)){ s.password = h; staffChanged = true; } }
    }
    if(staffChanged){
      try{ await saveStaff();
        const back = await getSetting('rsr_staff_v1', null);
        if(!Array.isArray(back) || back.some(b=>b.password && !pwIsHashed(b.password) && (D.staffMembers||[]).find(x=>x.id===b.id && pwIsHashed(x.password)))) throw new Error('staff read-back differs');
      }catch(e){ console.warn('pw staff migrate failed, restoring', e); D.staffMembers = JSON.parse(backup); try{ await saveStaff(); }catch(e2){} }
    }
    // 2) supervisor passwords inside contractor records
    for(const c of (D.contractors||[])){
      let ch = false; const old = JSON.stringify(c.supervisors||[]);
      for(const sv of (c.supervisors||[])){ if(sv.password && !pwIsHashed(sv.password)){ const h = await pwHash(sv.password); if(await pwCheck(sv.password,h)){ sv.password = h; ch = true; } } }
      if(ch){ try{ await saveContractorDB(c); }catch(e){ console.warn('supervisor pw migrate failed, restoring', e); c.supervisors = JSON.parse(old); } }
    }
    // 3) passwords the Tally Live function also reads — only when it knows about hashes
    if(await pwTallyReady()){
      const rows = [[OPW_KEY,'ownerPw'],[OPW_TALLY_KEY,'ownerTallyPw'],[OPW_RECOVERY_KEY,'ownerRecoveryPw']];
      for(const [key,f] of rows){
        const cur = D[f]; if(!cur || pwIsHashed(cur)) continue;
        const h = await pwHash(cur); if(!(await pwCheck(cur,h))) continue;
        try{
          await saveOwnerPwKey(key, h);
          const back = await sbReq('settings?select=value&key=eq.'+encodeURIComponent(key),'GET');
          if(!back || !back.length || back[0].value!==h) throw new Error('read-back differs');
          D[f] = h;
        }catch(e){ console.warn('pw migrate failed, restoring', key, e); try{ await saveOwnerPwKey(key, cur); }catch(e2){} D[f] = cur; }
      }
      let tch = false; const sb = JSON.stringify(D.staffMembers||[]);
      for(const s of (D.staffMembers||[])){ if(s.tallyPw && !pwIsHashed(s.tallyPw)){ const h = await pwHash(s.tallyPw); if(await pwCheck(s.tallyPw,h)){ s.tallyPw = h; tch = true; } } }
      if(tch){ try{ await saveStaff(); }catch(e){ console.warn('staff tally pw migrate failed, restoring', e); D.staffMembers = JSON.parse(sb); try{ await saveStaff(); }catch(e2){} } }
    }
  }catch(e){ console.warn('pwMigrateAll', e); }
  finally{ _pwMigrating = false; }
}
