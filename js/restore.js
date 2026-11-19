// ═══════════════════════════════════════════════════════
// restore.js — Settings → "Restore from backup" (Super Admin)
// Talks to the Supabase Edge Function `rsr-restore`, which reads the nightly backup files in Google Drive
// (folder "RSR Backups"). Steps: password → pick a backup → "what would change" check → confirm → restore.
// A restore NEVER deletes anything; a safety copy of today's data is saved to Drive first.
// ═══════════════════════════════════════════════════════
let _rsPw = '', _rsFiles = null, _rsFile = null, _rsPrev = null, _rsBusy = false;
const _rsE = s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const RS_TABLE_LABEL = {projects:'Projects', contractors:'Contractors', settings:'Settings (Work Experience, EMI, GST, letters, passwords…)', ledger_events:'Activity log'};

async function rsCall(body){
  const r = await fetch(SB_URL+'/functions/v1/rsr-restore', {method:'POST', headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'x-restore-password':_rsPw}, body:JSON.stringify(body)});
  let j = null; try{ j = await r.json(); }catch(e){}
  if(r.status===404) throw new Error('The restore function is not deployed yet (rsr-restore in Supabase).');
  if(r.status===403) { _rsPw = ''; throw new Error('Wrong restore password'); }
  if(!j) throw new Error('No answer from the restore function (HTTP '+r.status+')');
  if(j.ok===false && !j.problems) throw new Error(j.error||'Restore function error');
  return j;
}
function rsModal(html){
  let m = document.getElementById('rs-modal');
  if(!m){ m = document.createElement('div'); m.className='mov'; m.id='rs-modal'; document.body.appendChild(m); }
  m.innerHTML = '<div class="mbox" style="max-width:640px">'+html+'</div>'; OM('rs-modal');
}
function rsOpen(){
  if(!CU || !CU.isSuperAdmin){ toast('Only the Super Admin can restore','error'); return; }
  _rsFiles = null; _rsFile = null; _rsPrev = null;
  if(_rsPw) return rsList();
  rsModal(`<div class="mhdr"><h2>♻️ Restore from backup</h2><button class="mx" onclick="CM('rs-modal')">✕</button></div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:10px">Brings records back from a nightly backup kept in your Google Drive. Nothing is deleted by a restore, and a safety copy of today's data is saved first. Enter the <b>restore password</b> (the one saved in Supabase as <code>RESTORE_PASSWORD</code>).</div>
    <input type="password" id="rs-pw" placeholder="Restore password" autocomplete="off" style="width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:var(--rs)" onkeydown="if(event.key==='Enter')rsUnlock()">
    <div id="rs-err" style="color:var(--red);font-size:12px;margin-top:6px;display:none"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="btn" onclick="CM('rs-modal')">Cancel</button><button class="btn btn-navy" onclick="rsUnlock()">Continue</button></div>`);
}
function rsErr(t){ const e = document.getElementById('rs-err'); if(e){ e.textContent = t; e.style.display = 'block'; } else toast(t,'error',7000); }
async function rsUnlock(){ _rsPw = (document.getElementById('rs-pw').value||'').trim(); if(!_rsPw) return rsErr('Enter the password'); await rsList(); }
async function rsList(){
  rsModal('<div class="mhdr"><h2>♻️ Restore from backup</h2><button class="mx" onclick="CM(\'rs-modal\')">✕</button></div><div style="padding:24px;text-align:center;color:var(--text3)">Reading your Drive backups…</div>');
  try{ const j = await rsCall({action:'list'}); _rsFiles = (j.files||[]).sort((a,b)=>String(b.name).localeCompare(String(a.name))); rsShowList(); }
  catch(e){ const wrong = /password/i.test(e.message); if(wrong){ rsOpen(); setTimeout(()=>rsErr(e.message),50); } else rsModal('<div class="mhdr"><h2>♻️ Restore from backup</h2><button class="mx" onclick="CM(\'rs-modal\')">✕</button></div><div style="color:var(--red);font-size:13px">'+_rsE(e.message)+'</div><div style="text-align:right;margin-top:10px"><button class="btn" onclick="CM(\'rs-modal\')">Close</button></div>'); }
}
function rsShowList(){
  const fs = _rsFiles||[];
  rsModal(`<div class="mhdr"><h2>♻️ Choose a backup</h2><button class="mx" onclick="CM('rs-modal')">✕</button></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px">Pick the backup to restore from. “rsr-db” files are the nightly backups; “rsr-prerestore” files are safety copies saved just before an earlier restore.</div>
    <div style="max-height:46vh;overflow:auto;border:1px solid var(--border);border-radius:var(--rs)">${fs.length?fs.map(f=>`<div style="display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--border);font-size:13px"><span style="flex:1"><b>${_rsE(f.name.replace(/\.json\.gz$/,''))}</b> <span style="color:var(--text3)">${f.size?Math.max(1,Math.round(f.size/1024))+' KB':''}</span></span><button class="btn btn-sm btn-navy" onclick="rsPreview('${_rsE(f.id)}')">Check this one</button></div>`).join(''):'<div style="padding:14px;color:var(--text3);font-size:12px">No backups found in the “RSR Backups” folder.</div>'}</div>
    <div style="text-align:right;margin-top:10px"><button class="btn" onclick="CM('rs-modal')">Close</button></div>`);
}
async function rsPreview(id){
  _rsFile = (_rsFiles||[]).find(f=>f.id===id); if(!_rsFile) return;
  rsModal('<div class="mhdr"><h2>♻️ Checking…</h2></div><div style="padding:24px;text-align:center;color:var(--text3)">Comparing the backup with your live data (nothing is changed)…</div>');
  try{ _rsPrev = await rsCall({action:'preview', fileId:id}); rsShowPreview(); }
  catch(e){ rsModal('<div class="mhdr"><h2>♻️ Could not check</h2><button class="mx" onclick="CM(\'rs-modal\')">✕</button></div><div style="color:var(--red);font-size:13px">'+_rsE(e.message)+'</div><div style="text-align:right;margin-top:10px"><button class="btn" onclick="rsShowList()">Back</button></div>'); }
}
function rsRows(t, tb){ return `<tr><td style="padding:6px 8px">${_rsE(RS_TABLE_LABEL[t]||t)}</td><td style="text-align:right;padding:6px 8px">${tb.inBackup}</td><td style="text-align:right;padding:6px 8px">${tb.now}</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:${tb.missing?'#b45309':'var(--text3)'}">${tb.missing}</td><td style="text-align:right;padding:6px 8px;color:${tb.changed?'#b45309':'var(--text3)'}">${tb.changed}</td></tr>`; }
function rsShowPreview(){
  const p = _rsPrev, T = p.tables||{}, miss = Object.values(T).reduce((s,x)=>s+x.missing,0), chg = Object.values(T).reduce((s,x)=>s+x.changed,0);
  rsModal(`<div class="mhdr"><h2>♻️ ${_rsE(_rsFile.name.replace(/\.json\.gz$/,''))}</h2><button class="mx" onclick="CM('rs-modal')">✕</button></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:6px">Nothing has been changed yet. This is what a restore would do:</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid var(--border)"><thead><tr style="background:var(--surface2)"><th style="text-align:left;padding:6px 8px">What</th><th style="text-align:right;padding:6px 8px">In backup</th><th style="text-align:right;padding:6px 8px">Now</th><th style="text-align:right;padding:6px 8px">Gone now</th><th style="text-align:right;padding:6px 8px">Changed since</th></tr></thead><tbody>${Object.keys(T).map(t=>rsRows(t,T[t])).join('')}</tbody></table>
    <div style="margin:10px 0;font-size:13px"><label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;cursor:pointer;text-transform:none;letter-spacing:0;font-weight:500"><input type="radio" name="rs-mode" value="missing" checked> <span><b>Bring back only what is gone</b> (${miss} record${miss!==1?'s':''}). Everything that exists now is left exactly as it is. <i>Safest — start here.</i></span></label>
      <label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;text-transform:none;letter-spacing:0;font-weight:500"><input type="radio" name="rs-mode" value="all"> <span><b>Also put changed records back</b> (${chg} record${chg!==1?'s':''} go back to how the backup had them — edits made since are replaced by the backup's version).</span></label></div>
    <div style="font-size:12px;color:var(--text2);background:#f8fafc;border:1px solid var(--border);border-radius:var(--rs);padding:8px 10px;margin-bottom:8px">Records added after this backup are never touched. Before anything is changed, a safety copy of today's data is saved to Drive.${p.hasTallyLinks?'':' (This backup has no copy of the Tally links.)'}</div>
    <div class="fg"><label>Type <b>RESTORE</b> to confirm</label><input id="rs-confirm" autocomplete="off" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs)"></div>
    <div id="rs-err" style="color:var(--red);font-size:12px;margin-bottom:6px;display:none"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" onclick="rsShowList()">Back</button><button class="btn btn-navy" id="rs-go" onclick="rsRun()">Restore now</button></div>`);
}
async function rsRun(){
  if(_rsBusy) return;
  if((document.getElementById('rs-confirm').value||'').trim().toUpperCase()!=='RESTORE') return rsErr('Type RESTORE to confirm.');
  const mode = (document.querySelector('input[name="rs-mode"]:checked')||{}).value || 'missing';
  _rsBusy = true; document.getElementById('rs-go').disabled = true;
  rsModal('<div class="mhdr"><h2>♻️ Restoring…</h2></div><div style="padding:24px;text-align:center;color:var(--text3)">Saving a safety copy to Drive, then restoring. Please keep this window open — it can take a minute.</div>');
  try{
    const r = await rsCall({action:'restore', fileId:_rsFile.id, mode});
    const A = r.after||{}, B = r.before||{};
    rsModal(`<div class="mhdr"><h2>${r.ok?'✓ Restore finished':'⚠ Restore finished with problems'}</h2></div>
      <div style="font-size:13px;margin-bottom:8px">${r.ok?'Every record of the backup is now in your data.':'Some records are still different — details below.'} Safety copy of the data from before: <b>${_rsE(r.safetyCopy)}</b> (in Drive, folder “RSR Backups”).</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid var(--border)"><thead><tr style="background:var(--surface2)"><th style="text-align:left;padding:6px 8px">What</th><th style="text-align:right;padding:6px 8px">Was gone</th><th style="text-align:right;padding:6px 8px">Gone now</th></tr></thead><tbody>${Object.keys(A).map(t=>`<tr><td style="padding:6px 8px">${_rsE(RS_TABLE_LABEL[t]||t)}</td><td style="text-align:right;padding:6px 8px">${(B[t]||{}).missing||0}</td><td style="text-align:right;padding:6px 8px;color:${A[t].missing?'var(--red)':'var(--green,#15803d)'}">${A[t].missing}</td></tr>`).join('')}</tbody></table>
      ${(r.problems||[]).length?'<div style="color:var(--red);font-size:12px;margin-top:8px">'+r.problems.map(_rsE).join('<br>')+'</div>':''}
      <div style="font-size:12px;color:var(--text3);margin-top:8px">The app now reloads so everything shows the restored data.</div>
      <div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="btn btn-navy" onclick="location.reload()">Reload the app</button></div>`);
  }catch(e){
    rsModal('<div class="mhdr"><h2>⚠ Restore did not finish</h2><button class="mx" onclick="CM(\'rs-modal\')">✕</button></div><div style="color:var(--red);font-size:13px">'+_rsE(e.message)+'</div><div style="font-size:12px;color:var(--text3);margin-top:8px">Nothing is ever deleted by a restore, so your data is safe. If a safety copy was already saved, it is in Drive. Check the current data, then try again or tell Claude this message.</div><div style="text-align:right;margin-top:10px"><button class="btn" onclick="rsShowList()">Back</button></div>');
  }finally{ _rsBusy = false; }
}
