// ═══════════════════════════════════════════════════════
// premium.js — RSR Constructions Tracker
// Premium UX: history management, session restore, 
// haptic feedback, pull-to-refresh, keyboard shortcuts,
// better toasts, auto-save drafts, smart alerts
// ═══════════════════════════════════════════════════════

// ─── 1. BROWSER HISTORY / BACK BUTTON ────────────────
// Every navigation registers a history entry
// Android back / browser back → goes to previous screen

let _historyEnabled = false;

function initHistory(){
  if(_historyEnabled) return;
  _historyEnabled = true;

  // Handle browser back/forward
  window.addEventListener('popstate', e=>{
    const state = e.state;
    if(!state) return;

    if(state.view === 'detail' && state.pid){
      // Going back to project detail
      dpid = state.pid;
      const p = GP(state.pid);
      if(p){
        document.querySelectorAll('.osec').forEach(el=>el.classList.add('hidden'));
        document.getElementById('sec-detail')?.classList.remove('hidden');
        renderDetail(state.pid);
      }
    } else if(state.view === 'tab'){
      // Going back to a tab
      ownerTabSilent(state.tab);
    }
  });
}

// Push a tab navigation to browser history
function pushTabHistory(tabIndex){
  const state = { view:'tab', tab:tabIndex };
  const tabNames = ['dashboard','projects','contractors','tally','interest','emi','settings','gst','material-credit'];
  const name = tabNames[tabIndex] || 'tab-'+tabIndex;
  history.pushState(state, '', '#'+name);
}

// Push a project detail to browser history
function pushDetailHistory(pid, pname){
  const state = { view:'detail', pid };
  history.pushState(state, '', '#project-'+pid);
}

// Silent tab switch (no history push — used by popstate handler)
function ownerTabSilent(i){
  atab=i; dpid=null;
  const mainSecs = ['sec-dash','sec-proj','sec-cont','sec-funds','sec-interest','sec-emi','sec-settings','sec-gst','sec-matcredit'];
  document.querySelectorAll('.osec').forEach(e=>e.classList.add('hidden'));
  const targetId = mainSecs[i];
  if(targetId) document.getElementById(targetId)?.classList.remove('hidden');
  updateSidebarActive(i);
  if(i===0) renderDash();
  else if(i===1) renderProjects();
  else if(i===2){ renderConts(); renderContractorPerformance(); }
  else if(i===3) loadUnmatchedFromCloud().then(()=>renderFunds()).catch(()=>renderFunds());
  else if(i===4) renderInterest();
  else if(i===5) renderEMI();
  else if(i===6) renderSettings();
  else if(i===7) renderGST();
  else if(i===8) renderMatCredit();
}

// ─── 2. SESSION RESTORE ON REFRESH ───────────────────
const SESSION_KEY = 'rsr_session_state_v2';

function saveSessionState(){
  try{
    const state = {
      tab: atab,
      pid: dpid,
      projFilter: document.getElementById('proj-status-filter')?.value||'all',
      firmFilter: document.getElementById('proj-firm-filter')?.value||'all',
      projView: projViewMode,
      ts: Date.now()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  }catch(e){}
}

function restoreSessionState(){
  try{
    const raw = sessionStorage.getItem(SESSION_KEY);
    if(!raw) return false;
    const state = JSON.parse(raw);
    // Only restore if less than 2 hours old
    if(Date.now() - state.ts > 7200000) return false;

    if(state.pid){
      // Was viewing a project detail
      setTimeout(()=>{
        openDetail(state.pid);
      }, 300);
      return true;
    } else if(state.tab && state.tab !== 0){
      setTimeout(()=>{
        ownerTab(state.tab);
      }, 300);
      return true;
    }
  }catch(e){}
  return false;
}

// Auto-save session state on every navigation
const _origOwnerTab = typeof ownerTab === 'function' ? ownerTab : null;

// ─── 3. HAPTIC FEEDBACK ───────────────────────────────
function haptic(type){
  if(!navigator.vibrate) return;
  // type: 'light' | 'medium' | 'success' | 'error'
  const patterns = {
    light: [8],
    medium: [15],
    success: [10, 50, 10],
    error: [30, 50, 30],
    warning: [20]
  };
  navigator.vibrate(patterns[type] || patterns.light);
}

// Auto-apply haptic to all buttons on mobile
function initHaptics(){
  if(!navigator.vibrate) return;
  document.addEventListener('click', e=>{
    const btn = e.target.closest('button, .ppill, .proj-card, .qfilter-pill');
    if(!btn) return;
    if(btn.classList.contains('danger') || btn.style.color?.includes('red')){
      haptic('warning');
    } else {
      haptic('light');
    }
  }, {passive:true});
}

// ─── 4. PREMIUM TOAST SYSTEM ─────────────────────────
let _toastQueue = [];
let _toastEl = null;

function initToasts(){
  _toastEl = document.createElement('div');
  _toastEl.id = 'toast-container';
  _toastEl.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:360px';
  document.body.appendChild(_toastEl);
}

function toast(msg, type='ok', duration=3500){
  if(!_toastEl) initToasts();

  const icons = { ok:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const colors = {
    ok: { bg:'#f0fdf4', border:'#86efac', text:'#166534', progress:'#16a34a' },
    error: { bg:'#fef2f2', border:'#fca5a5', text:'#991b1b', progress:'#dc2626' },
    warning: { bg:'#fffbeb', border:'#fde68a', text:'#92400e', progress:'#f59e0b' },
    info: { bg:'#eff6ff', border:'#93c5fd', text:'#1e40af', progress:'#3b82f6' }
  };
  const c = colors[type] || colors.ok;
  const id = 'toast-'+Date.now()+Math.random().toString(36).slice(2);

  const el = document.createElement('div');
  el.id = id;
  el.style.cssText = `background:${c.bg};border:1.5px solid ${c.border};border-radius:10px;padding:12px 14px;
    display:flex;align-items:flex-start;gap:10px;box-shadow:0 4px 16px rgba(0,0,0,.12);
    pointer-events:all;cursor:pointer;transform:translateX(120%);transition:transform .25s cubic-bezier(.34,1.56,.64,1);
    position:relative;overflow:hidden;min-width:240px;max-width:360px`;

  el.innerHTML = `<span style="font-size:16px;line-height:1.2;flex-shrink:0">${icons[type]||'ℹ️'}</span>
    <div style="flex:1;font-size:13px;font-weight:600;color:${c.text};line-height:1.4">${msg}</div>
    <button onclick="dismissToast('${id}')" style="background:none;border:none;cursor:pointer;font-size:14px;color:${c.text};opacity:.5;padding:0;flex-shrink:0;line-height:1">✕</button>
    <div class="toast-progress" style="position:absolute;bottom:0;left:0;height:2px;background:${c.progress};width:100%;transform-origin:left;transition:transform ${duration}ms linear"></div>`;

  _toastEl.appendChild(el);

  // Slide in
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      el.style.transform = 'translateX(0)';
      // Start progress bar
      setTimeout(()=>{
        const bar = el.querySelector('.toast-progress');
        if(bar) bar.style.transform = 'scaleX(0)';
      }, 50);
    });
  });

  // Haptic on error/warning
  if(type==='error') haptic('error');
  else if(type==='warning') haptic('warning');
  else if(type==='ok') haptic('success');

  // Click to dismiss
  el.addEventListener('click', ()=>dismissToast(id));

  // Auto-dismiss
  setTimeout(()=>dismissToast(id), duration);

  return id;
}

function dismissToast(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.style.transform = 'translateX(120%)';
  el.style.opacity = '0';
  setTimeout(()=>el.remove(), 300);
}

// ─── 5. KEYBOARD SHORTCUTS ───────────────────────────
function initKeyboardShortcuts(){
  document.addEventListener('keydown', e=>{
    // Escape → close topmost modal
    if(e.key === 'Escape'){
      const modals = document.querySelectorAll('.mov.open');
      if(modals.length){
        const top = modals[modals.length-1];
        top.classList.remove('open');
        return;
      }
      // Close search
      const search = document.getElementById('gsearch-wrap');
      if(search && search.classList.contains('open')){
        search.classList.remove('open');
        return;
      }
    }

    // Don't fire shortcuts when typing in inputs
    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    // Ctrl/Cmd + K → global search
    if((e.ctrlKey || e.metaKey) && e.key === 'k'){
      e.preventDefault();
      const searchInput = document.getElementById('gsearch-input');
      if(searchInput){ searchInput.focus(); toggleGlobalSearch(); }
      return;
    }

    // Ctrl/Cmd + S → save current open modal
    if((e.ctrlKey || e.metaKey) && e.key === 's'){
      e.preventDefault();
      // Find active save button in open modal
      const modal = document.querySelector('.mov.open');
      if(modal){
        const saveBtn = modal.querySelector('.btn-navy, [onclick*="save"], [onclick*="Save"]');
        if(saveBtn) saveBtn.click();
      }
      return;
    }

    // Number shortcuts for tabs (when not in modal)
    const modal = document.querySelector('.mov.open');
    if(modal) return;
    if(e.altKey){
      const map = {'1':0,'2':1,'3':2,'4':3,'5':4,'6':5,'7':7,'8':8};
      if(map[e.key] !== undefined){ e.preventDefault(); ownerTab(map[e.key]); }
    }
  });
}

// ─── 6. PULL TO REFRESH (MOBILE) ─────────────────────
function initPullToRefresh(){
  if(!('ontouchstart' in window)) return;

  let startY = 0;
  let pulling = false;
  let indicator = null;

  const createIndicator = ()=>{
    if(indicator) return;
    indicator = document.createElement('div');
    indicator.id = 'ptr-indicator';
    indicator.style.cssText = 'position:fixed;top:-60px;left:50%;transform:translateX(-50%);background:var(--navy);color:#fff;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:18px;z-index:9000;transition:top .2s;box-shadow:0 2px 8px rgba(0,0,0,.3)';
    indicator.textContent = '↓';
    document.body.appendChild(indicator);
  };

  document.addEventListener('touchstart', e=>{
    if(window.scrollY === 0) { startY = e.touches[0].clientY; pulling = true; }
  }, {passive:true});

  document.addEventListener('touchmove', e=>{
    if(!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if(dy > 60){
      createIndicator();
      if(indicator) indicator.style.top = '10px';
    }
  }, {passive:true});

  document.addEventListener('touchend', e=>{
    if(!pulling) return;
    pulling = false;
    const dy = e.changedTouches[0].clientY - startY;
    if(dy > 80 && indicator){
      indicator.textContent = '↻';
      indicator.style.animation = 'spin .6s linear infinite';
      haptic('medium');
      // Refresh current tab
      setTimeout(()=>{
        ownerTabSilent(atab);
        if(indicator){ indicator.style.top = '-60px'; setTimeout(()=>{ indicator?.remove(); indicator=null; }, 300); }
      }, 600);
    } else if(indicator){
      indicator.style.top = '-60px';
      setTimeout(()=>{ indicator?.remove(); indicator=null; }, 300);
    }
  }, {passive:true});
}

// ─── 7. BACKDROP CLICK TO CLOSE MODALS ───────────────
function initModalBackdrop(){
  document.addEventListener('click', e=>{
    if(e.target.classList.contains('mov') && e.target.classList.contains('open')){
      e.target.classList.remove('open');
    }
  });
}

// ─── 8. AUTO-SAVE NEW PROJECT DRAFT ──────────────────
const NP_DRAFT_KEY = 'rsr_np_draft_v1';

function saveNPDraft(){
  try{
    const fields = ['np-name','np-tender','np-loc','np-est','np-bid','np-cc','np-date'];
    const draft = {};
    fields.forEach(id=>{ const el=document.getElementById(id); if(el) draft[id]=el.value; });
    const firm = document.getElementById('np-firm')?.value;
    const cont = document.getElementById('np-cont')?.value;
    const types = typeof getSelectedTypes==='function' ? getSelectedTypes('np-type-chips') : [];
    if(Object.values(draft).some(v=>v)) {
      localStorage.setItem(NP_DRAFT_KEY, JSON.stringify({...draft, firm, cont, types, ts:Date.now()}));
    }
  }catch(e){}
}

function restoreNPDraft(){
  try{
    const raw = localStorage.getItem(NP_DRAFT_KEY);
    if(!raw) return;
    const draft = JSON.parse(raw);
    if(Date.now() - draft.ts > 86400000){ localStorage.removeItem(NP_DRAFT_KEY); return; } // 24hr
    ['np-name','np-tender','np-loc','np-est','np-bid','np-cc','np-date'].forEach(id=>{
      const el=document.getElementById(id); if(el && draft[id]) el.value=draft[id];
    });
    if(draft.firm) { const el=document.getElementById('np-firm'); if(el) el.value=draft.firm; }
    if(draft.cont) { const el=document.getElementById('np-cont'); if(el) el.value=draft.cont; }
    if(draft.types && draft.types.length && typeof renderTypeChips==='function'){
      setTimeout(()=>renderTypeChips('np-type-chips', draft.types), 100);
    }
    toast('📝 Draft restored — continue where you left off', 'info', 4000);
  }catch(e){}
}

function clearNPDraft(){
  localStorage.removeItem(NP_DRAFT_KEY);
}

function initNPDraftAutoSave(){
  const modal = document.getElementById('modal-np');
  if(!modal) return;
  // Restore draft when modal opens
  const observer = new MutationObserver(mutations=>{
    mutations.forEach(m=>{
      if(m.attributeName==='class'){
        if(modal.classList.contains('open')) restoreNPDraft();
      }
    });
  });
  observer.observe(modal, {attributes:true});

  // Auto-save every 20 seconds while modal is open
  setInterval(()=>{
    if(modal.classList.contains('open')) saveNPDraft();
  }, 20000);

  // Save on any input change
  modal.addEventListener('input', ()=>saveNPDraft(), {passive:true});
}

// ─── 9. OFFLINE BANNER ───────────────────────────────
function initOfflineBanner(){
  const banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;height:28px;background:#dc2626;color:#fff;font-size:12px;font-weight:700;display:none;align-items:center;justify-content:center;z-index:8000;letter-spacing:.03em';
  banner.textContent = '⚡ No internet connection — changes will sync when reconnected';
  document.body.appendChild(banner);

  const show = ()=>{ banner.style.display='flex'; document.body.style.paddingTop='28px'; haptic('warning'); };
  const hide = ()=>{ banner.style.display='none'; document.body.style.paddingTop=''; };

  window.addEventListener('online', ()=>{ hide(); toast('Back online — syncing...','ok'); });
  window.addEventListener('offline', show);
  if(!navigator.onLine) show();
}

// ─── 10. ACTIVE TAP STATES (MOBILE) ──────────────────
function initTapStates(){
  const style = document.createElement('style');
  style.textContent = `
    .btn:active, button:active { transform: scale(0.97); opacity: 0.85; }
    .ppill:active, .proj-card:active { transform: scale(0.98); box-shadow: none; }
    .qfilter-pill:active { transform: scale(0.95); }
    @keyframes spin { to { transform: translateX(-50%) rotate(360deg); } }
  `;
  document.head.appendChild(style);
}

// ─── 11. SMART ALERT GROUPING ────────────────────────
function renderSmartAlertStrip(){
  const all = typeof getAllAlerts === 'function' ? getAllAlerts() : [];
  if(!all.length) return '';

  // Group by alert code/type
  const groups = {};
  all.forEach(a=>{
    const key = a.code || a.type || 'general';
    if(!groups[key]) groups[key] = { items:[], type:a.type, label:a.shortLabel||key };
    groups[key].items.push(a);
  });

  const redCount = all.filter(a=>a.type==='red').length;
  const amberCount = all.filter(a=>a.type==='amber').length;

  // Show max 2 most critical inline, rest summarised
  const critical = all.filter(a=>a.type==='red').slice(0,2);
  const rest = all.length - critical.length;

  let html = '';
  critical.forEach(a=>{
    html += `<div class="alert al-red" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="openDetail('${a.projectId||''}')">
      <span>🚨 ${a.msg||a.description||''}</span>
      ${a.projectId?`<span style="font-size:11px;opacity:.7">View →</span>`:''}
    </div>`;
  });

  if(rest > 0){
    html += `<div class="alert" style="background:#fffbeb;border:1px solid #fde68a;cursor:pointer;display:flex;justify-content:space-between;align-items:center" onclick="ownerTab(0);setDashFilter('attn')">
      <span>⚠️ ${redCount} urgent · ${amberCount} warnings — ${all.length} total alerts</span>
      <span style="font-size:11px;color:#92400e;font-weight:700">View All →</span>
    </div>`;
  }

  return html;
}

// ─── 12. LAST ACTIVITY ON PROJECT CARDS ──────────────
function getProjectLastActivity(p){
  const events = [];
  (p.releases||[]).forEach(r=>{ if(r.date) events.push(new Date(r.date)); });
  (p.verifications||[]).forEach(v=>{ if(v.date) events.push(new Date(v.date)); });
  (p.settlements||[]).forEach(s=>{ if(s.date) events.push(new Date(s.date)); });
  if(p.jvDate) events.push(new Date(p.jvDate));
  if(!events.length) return null;
  return new Date(Math.max(...events));
}

function formatLastActivity(date){
  if(!date) return 'No activity';
  const diff = Math.round((new Date()-date)/86400000);
  if(diff===0) return 'Today';
  if(diff===1) return 'Yesterday';
  if(diff<=7) return diff+'d ago';
  if(diff<=30) return Math.round(diff/7)+'w ago';
  if(diff<=365) return Math.round(diff/30)+'mo ago';
  return Math.round(diff/365)+'y ago';
}

// ─── INIT ALL PREMIUM FEATURES ───────────────────────
function initPremium(){
  initToasts();
  initHaptics();
  initKeyboardShortcuts();
  initPullToRefresh();
  initModalBackdrop();
  initOfflineBanner();
  initTapStates();
  initHistory();
  // NP draft auto-save — init after DOM ready
  setTimeout(initNPDraftAutoSave, 1000);
  // Session state save on visibility change
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden) saveSessionState();
  });
}
