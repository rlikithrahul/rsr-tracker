// ═══════════════════════════════════════════════════════
// access.js — which dashboards each staff member can open (Super Admin controls it in Settings → 🔐 Staff Access)
// • Staff with nothing configured keep what they could already open (Tally Live now needs to be switched on for them).
// • Pages marked ⚠ (Settings, GST Split, Board Meeting, Growth Pool, Cheque Printing) are the owner's own: off for staff unless the Super Admin switches them on.
// • If staff reach a dashboard they are not allowed (from a link or a button) they can send a request; the Super Admin sees it
//   in Settings (red badge on Settings) and approves or declines it there.
// • Tally Live additionally needs the staff member's OWN Tally Live password (set here), separate from the app login.
// ═══════════════════════════════════════════════════════
const ACCESS_REQ_KEY = 'rsr_access_requests_v1';
const ACCESS_ADMIN_ONLY = [6,10,12,16,19];
let ACC = { reqs:[], sig:'' };

function accessGrantable(){ // [{i,icon,label}] — what the Super Admin can switch on/off for a staff member
  const base=(typeof SIDEBAR_TABS!=='undefined'?SIDEBAR_TABS:[]).slice(); const have=new Set(base.map(t=>t.i));
  [{i:11,icon:'📐',label:'Work Experience'},{i:13,icon:'🏦',label:'Deposit Refunds'},{i:6,icon:'⚙️',label:'Settings'},{i:10,icon:'🧾',label:'GST Split'},{i:12,icon:'📋',label:'Board Meeting'},{i:16,icon:'🌱',label:'Growth Pool'},{i:19,icon:'🖨️',label:'Cheque Printing'}].forEach(t=>{ if(!have.has(t.i)) base.push(t); });
  return base.filter(t=>t.i!==0);                                   // the Dashboard is always open
}
function ownerPwList(){ return [D.ownerPw,D.ownerTallyPw,D.ownerRecoveryPw].filter(Boolean); }
function accessLabel(i){ const t=accessGrantable().find(x=>x.i===i); return t?(t.icon+' '+t.label):('Dashboard '+i); }
function accessStaffRec(){ if(!CU) return null; return (D.staffMembers||[]).find(s=>(CU.staffId&&s.id===CU.staffId)||s.name===CU.name)||null; }
function accessDefaultTabs(){ return accessGrantable().map(t=>t.i).filter(i=>i!==18&&!ACCESS_ADMIN_ONLY.includes(i)); }
function accessTabsOf(rec){ return rec&&rec.access&&Array.isArray(rec.access.tabs)?rec.access.tabs:accessDefaultTabs(); }
// true for the Super Admin, or for a staff member the Super Admin has switched this page on for
function ownerOrGranted(i){ return !!(CU && (CU.isSuperAdmin || (CU.role==='owner' && canTab(i)))); }
function canTab(i){
  if(!CU) return false; if(CU.isSuperAdmin||CU.role!=='owner') return true; if(i===0) return true;
  return accessTabsOf(accessStaffRec()).includes(i);
}

// ── staff side: "no access" → ask the Super Admin ──
function accessDenied(i){
  const old=document.getElementById('acc-modal'); if(old) old.remove();
  const pending=(ACC.reqs||[]).find(r=>r.status==='pending'&&r.tab===i&&r.staff===CU.name);
  const adminOnly=false;
  const d=document.createElement('div'); d.id='acc-modal'; d.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';
  d.innerHTML=`<div style="background:var(--surface,#fff);color:var(--text,#111);border-radius:14px;max-width:420px;width:100%;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.35)">
    <div style="font-size:30px;text-align:center">🔒</div>
    <div style="font-size:16px;font-weight:700;text-align:center;margin:6px 0">${accessLabel(i)} is not switched on for you</div>
    <div style="font-size:13px;color:var(--text2);text-align:center;margin-bottom:12px">${adminOnly?'This page is for the Super Admin only.':pending?'You already asked — the Super Admin has not answered yet.':'You can ask the Super Admin to switch it on. He will see your request in Settings.'}</div>
    ${adminOnly||pending?'':`<input id="acc-note" placeholder="Why do you need it? (optional)" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;margin-bottom:10px;box-sizing:border-box">`}
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">${adminOnly||pending?'':`<button class="btn btn-primary" onclick="accessSendRequest(${i})">Request access</button>`}<button class="btn" onclick="accessRecheck(${i})">I was just given access — check again</button><button class="btn" onclick="document.getElementById('acc-modal').remove()">Close</button></div></div>`;
  document.body.appendChild(d);
}
async function accessSendRequest(i){
  const note=(document.getElementById('acc-note')||{}).value||'';
  try{ const cur=await getSetting(ACCESS_REQ_KEY,[])||[];
    if(!cur.some(r=>r.status==='pending'&&r.tab===i&&r.staff===CU.name)) cur.push({id:uid(),staff:CU.name,staffId:CU.staffId||'',tab:i,label:accessLabel(i),note,at:new Date().toISOString(),status:'pending'});
    ACC.reqs=await mergeAndSaveSetting(ACCESS_REQ_KEY,cur,true); }catch(e){ toast('Could not send the request: '+e.message,'error'); return; }
  const m=document.getElementById('acc-modal'); if(m) m.remove(); toast('Request sent to the Super Admin','ok');
}
async function accessRecheck(i){
  try{ D.staffMembers=await getSetting('rsr_staff_v1',[])||[]; }catch(e){}
  const m=document.getElementById('acc-modal'); if(m) m.remove();
  if(canTab(i)){ if(typeof buildSidebar==='function') buildSidebar(false); toast('Access is on — opening','ok'); ownerTab(i); } else toast('Not switched on yet','error');
}

// ── Super Admin side: Settings card ──
function accessCardHtml(){
  const staff=D.staffMembers||[]; const reqs=(ACC.reqs||[]).filter(r=>r.status==='pending');
  const tabs=accessGrantable();
  const reqHtml=reqs.length?`<div style="background:#fff7e0;border:1px solid #e6c453;border-radius:10px;padding:10px 12px;margin-bottom:12px"><div style="font-weight:700;margin-bottom:6px">🔔 ${reqs.length} access request${reqs.length>1?'s':''} waiting</div>
    ${reqs.map(r=>`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:5px 0;border-top:1px solid #f0dc96;font-size:13px"><span><b>${_aE(r.staff)}</b> wants <b>${_aE(r.label||accessLabel(r.tab))}</b>${r.note?' — “'+_aE(r.note)+'”':''}<span style="color:var(--text3);font-size:11px"> · ${fmtDateTime(r.at)}</span></span><span style="margin-left:auto"></span><button class="btn btn-sm btn-primary" onclick="accessDecide('${r.id}',true)">Approve</button><button class="btn btn-sm" onclick="accessDecide('${r.id}',false)">Decline</button></div>`).join('')}</div>`:'';
  return `<div class="card" id="acc-card" style="border-top:3px solid var(--navy);margin-bottom:16px">
    <div class="st" style="margin-bottom:4px">🔐 Staff Access — who can open which dashboard</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px">Switch dashboards on or off for each staff member. The Dashboard is always open. ⚠ pages (Settings, GST Split, Board Meeting, Growth Pool, Cheque Printing) are off unless you switch them on. Switching on Settings gives that person full control of Settings, including staff logins and this page. For <b>Tally Live</b> give the person their <b>own password</b> as well. Staff who open a page they don't have can ask you for it, and you will see it here.</div>
    ${reqHtml}
    ${staff.length?staff.map((s,si)=>{ const on=new Set(accessTabsOf(s)); return `<div style="border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><b style="font-size:14px">${_aE(s.name)}</b><span style="font-size:11px;color:var(--text3)">${on.size} of ${tabs.length} dashboards on${s.access&&Array.isArray(s.access.tabs)?'':' (default)'}</span><span style="margin-left:auto"></span>
        <button class="btn btn-sm" onclick="accessPreset(${si},'all')">All on</button><button class="btn btn-sm" onclick="accessPreset(${si},'none')">All off</button><button class="btn btn-sm" onclick="accessPreset(${si},'default')">Reset</button></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px">${tabs.map(t=>`<label style="display:flex;align-items:center;gap:7px;padding:7px 9px;border:1px solid ${on.has(t.i)?'var(--navy)':'var(--border)'};background:${on.has(t.i)?'rgba(26,39,68,.08)':'transparent'};border-radius:9px;cursor:pointer;font-size:12px"><input type="checkbox" data-s="${si}" data-t="${t.i}" ${on.has(t.i)?'checked':''} onchange="accessToggleStyle(this)"> ${t.icon} ${_aE(t.label)}${ACCESS_ADMIN_ONLY.includes(t.i)?' <span style="color:#b45309">⚠</span>':''}</label>`).join('')}</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px"><label style="font-size:12px">📒 Tally Live password<br><input type="text" id="acc-tp-${si}" value="${_aE(s.tallyPw||'')}" placeholder="${on.has(18)?'set a password for this person':'switch Tally Live on first'}" style="min-width:220px;padding:7px 9px;border:1px solid var(--border);border-radius:8px" autocomplete="off"></label><span style="margin-left:auto"></span><button class="btn btn-primary btn-sm" onclick="accessSave(${si})">Save ${_aE(s.name)}'s access</button></div></div>`; }).join(''):'<div style="font-size:13px;color:var(--text3);font-style:italic">No staff members yet — add them in Staff Logins above.</div>'}
    ${(ACC.reqs||[]).filter(r=>r.status!=='pending').length?`<details style="margin-top:6px"><summary style="cursor:pointer;font-size:12px;color:var(--text3)">Earlier requests (${(ACC.reqs||[]).filter(r=>r.status!=='pending').length})</summary>${(ACC.reqs||[]).filter(r=>r.status!=='pending').slice(-20).reverse().map(r=>`<div style="font-size:12px;padding:3px 0">${_aE(r.staff)} · ${_aE(r.label||'')} · <i>${_aE(r.status)}</i> · ${fmtDate(r.at)}</div>`).join('')}</details>`:''}
  </div>`;
}
function _aE(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function accessToggleStyle(cb){ const l=cb.closest('label'); l.style.borderColor=cb.checked?'var(--navy)':'var(--border)'; l.style.background=cb.checked?'rgba(26,39,68,.08)':'transparent'; }
function accessPreset(si,kind){
  document.querySelectorAll(`#acc-card input[data-s="${si}"]`).forEach(cb=>{ const t=+cb.dataset.t; cb.checked=kind==='all'?true:kind==='none'?false:accessDefaultTabs().includes(t); accessToggleStyle(cb); });
}
async function accessSave(si){
  const s=D.staffMembers[si]; if(!s) return;
  const tabs=[...document.querySelectorAll(`#acc-card input[data-s="${si}"]`)].filter(c=>c.checked).map(c=>+c.dataset.t);
  const tp=(document.getElementById('acc-tp-'+si)||{}).value.trim();
  if(tabs.includes(18) && !tp){ toast('Tally Live is on — give '+s.name+' a Tally Live password too','error'); return; }
  if(tp){ if(tp.length<4){ toast('Tally Live password must be at least 4 characters','error'); return; }
    let used = await pwAnyMatch(tp, ownerPwList());
    for(let j=0;j<D.staffMembers.length && !used;j++){ const x=D.staffMembers[j]; if(await pwCheck(tp,x.tallyPw) || (j!==si && await pwCheck(tp,x.password))) used = true; }
    if(used){ toast('That Tally Live password is already used by someone else','error'); return; } }
  s.access={tabs}; if(tp){ if(!(s.tallyPw && await pwCheck(tp,s.tallyPw))) s.tallyPw = await pwStore(tp,true); } else delete s.tallyPw;
  try{ await saveStaff(); await writeActivityLog('staff_access',`Access for ${s.name}: ${tabs.length} dashboards${tabs.includes(18)?', Tally Live on':''}`); toast('✓ Saved — '+s.name+' sees the change next time the page refreshes (within a couple of minutes)','ok'); const c=document.getElementById('acc-card'); if(c){ c.outerHTML=accessCardHtml(); } }
  catch(e){ toast('Save failed','error'); }
}
async function accessDecide(id,ok){
  const r=(ACC.reqs||[]).find(x=>x.id===id); if(!r) return; const s=(D.staffMembers||[]).find(x=>x.id===r.staffId||x.name===r.staff);
  try{
    if(ok && s){ const cur=new Set(accessTabsOf(s)); cur.add(r.tab); s.access={tabs:[...cur]}; await saveStaff(); }
    r.status=ok?'approved':'declined'; r.decidedAt=new Date().toISOString(); ACC.reqs=await mergeAndSaveSetting(ACCESS_REQ_KEY,ACC.reqs,true);
    if(ok && r.tab===18) toast('Approved. Remember to give '+r.staff+' a Tally Live password below.','ok',6000); else toast(ok?'Approved':'Declined','ok');
    const c=document.getElementById('acc-card'); if(c) c.outerHTML=accessCardHtml(); accessBadge();
  }catch(e){ toast('Could not save: '+e.message,'error'); }
}
function accessBadge(){
  if(!CU||!CU.isSuperAdmin) return; const n=(ACC.reqs||[]).filter(r=>r.status==='pending').length; const b=document.getElementById('sbl-6'); if(!b) return;
  let dot=b.querySelector('.acc-dot'); if(!n){ if(dot) dot.remove(); return; } if(!dot){ dot=document.createElement('span'); dot.className='acc-dot'; dot.style.cssText='margin-left:auto;background:#d32f2f;color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;font-weight:700'; b.appendChild(dot); } dot.textContent=n;
}
async function accessPoll(first){
  if(!CU||CU.role!=='owner'||window.__EMBED) return;   // internal tabs leave this to the main tab
  try{
    const reqs=await getSetting(ACCESS_REQ_KEY,[])||[]; const before=(ACC.reqs||[]).filter(r=>r.status==='pending').length; ACC.reqs=reqs;
    if(CU.isSuperAdmin){ accessBadge(); const n=reqs.filter(r=>r.status==='pending').length; if(n&&(first||n>before)) toast('🔔 '+n+' access request'+(n>1?'s':'')+' waiting — see Settings','ok',5000); }
    else { const old=JSON.stringify(accessTabsOf(accessStaffRec())); D.staffMembers=await getSetting('rsr_staff_v1',[])||D.staffMembers; if(JSON.stringify(accessTabsOf(accessStaffRec()))!==old){ if(typeof buildSidebar==='function') buildSidebar(false); toast('Your dashboard access was updated','ok'); } }
  }catch(e){}
}

// ── hook in without touching the existing screens ──
(function(){
  if(typeof ownerTab==='function'){ const o=ownerTab; ownerTab=function(i){ if(CU && CU.role==='owner' && !canTab(i)){ accessDenied(i); return; } return o.apply(this,arguments); }; }
  if(typeof openDetail==='function'){ const o=openDetail; openDetail=function(){ if(CU && CU.role==='owner' && !canTab(1)){ accessDenied(1); return; } return o.apply(this,arguments); }; }
  if(typeof buildSidebar==='function'){ const o=buildSidebar; buildSidebar=function(){ const r=o.apply(this,arguments); try{ document.querySelectorAll('#sidebar-links .sidebar-link').forEach(b=>{ const i=+String(b.id).replace('sbl-',''); if(CU&&CU.role==='owner'&&!canTab(i)) b.remove(); }); accessBadge(); }catch(e){} return r; }; }
  if(typeof renderSettings==='function'){ const o=renderSettings; renderSettings=async function(){ const r=await o.apply(this,arguments); try{ await accessPoll(); const host=document.getElementById('staff-list'); const anchor=host&&(host.closest('.set-sec')||host.closest('.card')); if(anchor&&!document.getElementById('acc-card')){ const pend=(ACC.reqs||[]).some(r=>r.status==='pending'); anchor.insertAdjacentHTML('afterend',anchor.classList.contains('set-sec')?`<div class="set-sec${pend?' open':''}" id="set-access"><div class="set-hd" onclick="setToggle('access')" role="button" tabindex="0"><span class="set-ic" style="background:#e0e7ff">🔐</span><span class="set-tt"><span class="set-t1">Staff Access</span><span class="set-t2">Which dashboards each staff member can open · Tally Live passwords</span></span><svg class="set-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg></div><div class="set-bd"><div class="set-bdi"><div class="set-pad">${accessCardHtml()}</div></div></div></div>`:accessCardHtml()); } if(typeof aboutCardHtml==='function'){ const el=document.getElementById('sec-settings'); if(el&&!document.getElementById('about-card')) el.insertAdjacentHTML('beforeend',aboutCardHtml()); if(typeof aboutCheck==='function') aboutCheck(); } }catch(e){ console.warn('settings extras',e); } return r; }; }
  const wait=setInterval(()=>{ if(typeof CU!=='undefined'&&CU&&CU.role==='owner'){ clearInterval(wait); setTimeout(()=>accessPoll(true),3000); setInterval(()=>{ if(document.visibilityState==='visible') accessPoll(false); },120000); } },1500);
})();
