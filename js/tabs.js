// ═══════════════════════════════════════════════════════
// tabs.js — internal tabs (like Chrome tabs) for the owner / staff screens
//
// The tab bar sits across the very top. The first tab is the app you are already in.
// "+" opens another tab: a complete, independent copy of the app in its own frame
// (same login), so whatever you are doing in one tab — a half-filled form, an open
// project, a filter — stays exactly as it is while you work in another.
//
// Rules that keep it safe:
//  • each tab has its own memory, so tabs can never mix up "the current project" or a form;
//  • only the tab you are looking at refreshes data in the background (no extra data use);
//  • closing a tab that still has an open form asks first;
//  • the list of open tabs survives a page refresh (each reopens on the same page, forms are not kept).
// ═══════════════════════════════════════════════════════
const TABS_MAX = 8;
const TABS_KEY = 'rsr_tabs_v1';
const TABS = { list:[{id:'main', title:'Dashboard', frame:null}], active:'main', n:0, on:false };
window.__tabsActive = 'main';

function _tbMain(){ return TABS.list[0]; }
function _tbSave(){
  try{
    sessionStorage.setItem(TABS_KEY, JSON.stringify(TABS.list.slice(1).map(t=>({id:t.id, start:t.start||null}))));
  }catch(e){}
}
function tabsInit(){
  if(window.__EMBED || TABS.on || !CU || CU.role!=='owner') return;
  TABS.on = true;
  document.body.classList.add('has-tabs');
  let bar = document.getElementById('tabbar');
  if(!bar){ bar = document.createElement('div'); bar.id='tabbar'; bar.setAttribute('role','tablist'); document.body.appendChild(bar); }
  let host = document.getElementById('tab-frames');
  if(!host){ host = document.createElement('div'); host.id='tab-frames'; document.body.appendChild(host); }
  // reopen tabs from before a refresh (lazy: a tab's page is only loaded when you click it)
  try{
    const saved = JSON.parse(sessionStorage.getItem(TABS_KEY)||'[]');
    saved.slice(0,TABS_MAX-1).forEach(s=>{ TABS.n = Math.max(TABS.n, parseInt(String(s.id).replace(/\D/g,''),10)||0); TABS.list.push({id:s.id, title:'…', frame:null, start:s.start||null}); });
  }catch(e){}
  tabsDraw();
  setInterval(tabsPoll, 1500);
}
function tabsNew(start){
  if(!TABS.on) return;
  if(TABS.list.length>=TABS_MAX){ toast('Up to '+TABS_MAX+' tabs at a time — close one first.','error'); return; }
  const id = 't'+(++TABS.n);
  TABS.list.push({id, title:'New tab', frame:null, start:start||null});
  _tbSave(); tabsActivate(id);
}
function _tbMakeFrame(t){
  const f = document.createElement('iframe');
  f.name = 'rsrtab-'+t.id; f.className='tab-frame'; f.title = 'Tab';
  f.setAttribute('allow','clipboard-read; clipboard-write; fullscreen');
  f.src = location.pathname + (location.search||'');
  document.getElementById('tab-frames').appendChild(f);
  t.frame = f;
  if(t.start){ _tbStartAt(f, t.start); }
}
// after the new page has signed itself in, take it to a specific page (used when restoring tabs)
function _tbStartAt(f, st){
  let tries = 0;
  const iv = setInterval(()=>{
    tries++; if(tries>60){ clearInterval(iv); return; }
    try{
      const w = f.contentWindow;
      if(w && _tbG(w,'typeof CU!=="undefined" && !!CU') && typeof w.ownerTab==='function' && w.document.getElementById('sidebar-links') && w.document.getElementById('sidebar-links').children.length){
        clearInterval(iv);
        setTimeout(()=>{ try{
          if(st.pid && w.GP && w.GP(st.pid)) w.openDetail(st.pid);
          else if(st.cid && w.GC && w.GC(st.cid)){ w.ownerTab(2,true); w.openContractorProfile(st.cid,false); }
          else if(st.tab) w.ownerTab(st.tab,true);
        }catch(e){} }, 700);
      }
    }catch(e){}
  }, 500);
}
function tabsActivate(id){
  const t = TABS.list.find(x=>x.id===id); if(!t) return;
  TABS.active = id; window.__tabsActive = id==='main' ? 'main' : 'rsrtab-'+id;
  if(id!=='main' && !t.frame) _tbMakeFrame(t);
  TABS.list.forEach(x=>{ if(x.frame) x.frame.style.display = (x.id===id)?'block':'none'; });
  document.body.classList.toggle('tab-frame-open', id!=='main');
  tabsDraw();
  // the tab you just came back to catches up on any changes made elsewhere
  try{ if(id==='main'){ if(typeof _arWake==='function') _arWake(); } else if(t.frame.contentWindow && t.frame.contentWindow._arWake) t.frame.contentWindow._arWake(); }catch(e){}
  if(id==='main'){ try{ window.focus(); }catch(e){} }
}
function tabsClose(id, ev){
  if(ev){ ev.stopPropagation(); ev.preventDefault(); }
  if(id==='main') return;
  const i = TABS.list.findIndex(x=>x.id===id); if(i<1) return;
  const t = TABS.list[i];
  try{
    const d = t.frame && t.frame.contentDocument;
    if(d && (d.querySelector('.mov.open') || d.querySelector('.modal.open'))){
      if(!confirm('This tab has a form or dialog open. Close the tab anyway? Anything not saved will be lost.')) return;
    }
  }catch(e){}
  if(t.frame) t.frame.remove();
  TABS.list.splice(i,1);
  _tbSave();
  if(TABS.active===id){ const nxt = TABS.list[Math.min(i, TABS.list.length-1)] || TABS.list[0]; tabsActivate(nxt.id); }
  else tabsDraw();
}
function _tbEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function tabsDraw(){
  const bar = document.getElementById('tabbar'); if(!bar) return;
  bar.innerHTML = TABS.list.map(t=>`
    <div class="tb-tab${t.id===TABS.active?' on':''}" role="tab" aria-selected="${t.id===TABS.active}" tabindex="0" data-id="${t.id}"
         onclick="tabsActivate('${t.id}')" onauxclick="if(event.button===1)tabsClose('${t.id}',event)"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tabsActivate('${t.id}')}" title="${_tbEsc(t.title)}">
      <span class="tb-ttl">${_tbEsc(t.title)}</span>
      ${t.id==='main'?'':`<button class="tb-x" title="Close tab" aria-label="Close tab" onclick="tabsClose('${t.id}',event)">×</button>`}
    </div>`).join('')
    + `<button class="tb-new" onclick="tabsNew()" title="Open a new tab" aria-label="New tab">+</button>`;
  const on = bar.querySelector('.tb-tab.on'); if(on && on.scrollIntoView) try{ on.scrollIntoView({block:'nearest',inline:'nearest'}); }catch(e){}
}
// where is a window right now (for the tab's name and for restoring)
// (the app keeps its state in top-level `let` variables, which another window can only read through eval)
function _tbG(w, expr){ try{ return w.eval(expr); }catch(e){ return undefined; } }
function _tbWhere(w){
  try{
    if(!w || !_tbG(w,'typeof CU!=="undefined" && !!CU')) return null;
    const st = w.history && w.history.state;
    const dp = _tbG(w,'typeof dpid!=="undefined" ? dpid : null'), at = _tbG(w,'typeof atab!=="undefined" ? atab : 0');
    if(dp && w.document.getElementById('sec-detail') && !w.document.getElementById('sec-detail').classList.contains('hidden')){
      const p = w.GP && w.GP(dp); return {title:(p&&p.name)||'Project', start:{pid:dp}};
    }
    if(st && st.view==='contractor' && st.cid){ const c = w.GC && w.GC(st.cid); return {title:(c&&c.name)||'Contractor', start:{cid:st.cid}}; }
    const a = w.document.querySelector('#sidebar-links .sidebar-link.active');
    const lbl = a ? a.textContent.replace(/\s+/g,' ').replace(/^[^A-Za-z0-9]+/,'').trim() : 'Dashboard';
    return {title:lbl, start:(at?{tab:at}:null)};
  }catch(e){ return null; }
}
function tabsPoll(){
  let ch = false;
  TABS.list.forEach(t=>{
    const w = t.id==='main' ? window : (t.frame && t.frame.contentWindow);
    const r = _tbWhere(w); if(!r) return;
    const title = (r.title||'').slice(0,40) || 'Dashboard';
    if(title!==t.title){ t.title = title; ch = true; }
    if(t.id!=='main'){ const s = JSON.stringify(r.start||null); if(s!==JSON.stringify(t.start||null)){ t.start = r.start||null; _tbSave(); } }
  });
  if(ch) tabsDraw();
}
