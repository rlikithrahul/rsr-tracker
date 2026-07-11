// ═══════════════════════════════════════
// offline.js
// RSR Constructions Tracker v17
// ═══════════════════════════════════════

// ═══════════════════════════════════════════════════════
// PWA — MANIFEST + OFFLINE QUEUE + SERVICE WORKER
// ═══════════════════════════════════════════════════════

// Inject manifest dynamically (since we're a single HTML file)
function setupPWAManifest(){
  const manifest = {
    name: 'RSR Constructions Tracker',
    short_name: 'RSR Tracker',
    description: 'Project and finance tracking for RSR Constructions',
    start_url: './',
    display: 'standalone',
    background_color: '#1a2744',
    theme_color: '#1a2744',
    orientation: 'portrait-primary',
    icons: [
      { src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><circle cx='96' cy='96' r='96' fill='%231a2744'/><text x='96' y='120' font-size='72' fill='%23c9a84c' text-anchor='middle' font-family='Georgia' font-weight='900'>RSR</text></svg>", sizes: '192x192', type: 'image/svg+xml' },
      { src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><circle cx='256' cy='256' r='256' fill='%231a2744'/><text x='256' y='320' font-size='192' fill='%23c9a84c' text-anchor='middle' font-family='Georgia' font-weight='900'>RSR</text></svg>", sizes: '512x512', type: 'image/svg+xml' }
    ]
  };
  const blob = new Blob([JSON.stringify(manifest)], {type:'application/manifest+json'});
  const url = URL.createObjectURL(blob);
  document.getElementById('pwa-manifest').href = url;
}

// ─── INDEXEDDB OFFLINE QUEUE ─────────────────────────
// Uses IndexedDB instead of localStorage — supports 50-500MB vs 5MB limit
// Each queue item stored as a separate record with its photos as blobs
// This means 50+ compressed photos (each ~100KB) = ~5MB total — no problem

const IDB_NAME = 'RSROfflineDB';
const IDB_VERSION = 1;
const IDB_STORE = 'offlineQueue';
let _idb = null; // cached db connection

function openIDB(){
  if(_idb) return Promise.resolve(_idb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains(IDB_STORE)){
        const store = db.createObjectStore(IDB_STORE, {keyPath:'id'});
        store.createIndex('queuedAt','queuedAt',{unique:false});
      }
    };
    req.onsuccess = e => { _idb = e.target.result; resolve(_idb); };
    req.onerror = e => { console.error('IDB open failed:', e); reject(e); };
  });
}

async function idbGetAll(){
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch(e) { console.error('idbGetAll failed:', e); return []; }
}

async function idbPut(item){
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const req = tx.objectStore(IDB_STORE).put(item);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch(e) { console.error('idbPut failed:', e); return false; }
}

async function idbDelete(id){
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch(e) { return false; }
}

async function idbClear(){
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch(e) { return false; }
}

// Public API — replaces old localStorage functions
async function getOfflineQueue(){
  return await idbGetAll();
}

async function addToOfflineQueue(item){
  const record = {...item, id: item.updateId || uid(), queuedAt: new Date().toISOString()};
  const ok = await idbPut(record);
  if(ok){
    toast('📥 Saved offline — will sync when you have internet','ok',4000);
  } else {
    // Fallback to localStorage if IDB fails (very rare)
    console.warn('IDB save failed, falling back to localStorage');
    try{
      const existing = JSON.parse(localStorage.getItem('rsr_offline_fallback')||'[]');
      existing.push(record);
      localStorage.setItem('rsr_offline_fallback', JSON.stringify(existing));
      toast('📥 Saved offline (fallback storage)','ok',4000);
    }catch(e){
      toast('⚠️ Could not save offline — storage full','error',5000);
    }
  }
}

async function syncOfflineQueue(){
  if(!dbOK) return;
  const q = await getOfflineQueue();
  // Also check localStorage fallback
  let fallback = [];
  try{ fallback = JSON.parse(localStorage.getItem('rsr_offline_fallback')||'[]'); }catch(e){}
  const allItems = [...q, ...fallback];
  if(!allItems.length) return;

  let synced=0, failed=0;
  for(const item of allItems){
    try{
      if(item.type==='projectUpdate'){
        // Re-fetch project to get latest state
        const p = await fetchProjectFull(item.projectId);
        if(!p){ failed++; continue; }

        // Check not already synced (duplicate guard)
        if((p.contractorUpdates||[]).find(u=>u.id===item.update.id)){
          await idbDelete(item.id);
          synced++;
          continue;
        }

        // Upload photos — stored as dataURLs, convert to blobs
        const uploadedPhotos=[];
        const photoCount = (item.photos||[]).length;
        for(let pi=0; pi<photoCount; pi++){
          const ph = item.photos[pi];
          setBusy(true,`Syncing photo ${pi+1}/${photoCount}…`);
          if(ph.dataUrl && !ph.url){
            try{
              const res = await fetch(ph.dataUrl);
              const blob = await res.blob();
              const file = new File([blob], ph.name||'photo.jpg', {type:'image/jpeg'});
              const url = await uploadPhoto(file, item.projectId, item.updateId||item.id);
              uploadedPhotos.push({url, name:ph.name, captureTime:ph.captureTime, gps:ph.gps});
            }catch(photoErr){
              console.error('Photo upload failed during sync:', photoErr);
              // Continue with other photos — don't lose the whole update
              uploadedPhotos.push({url:'', name:ph.name, captureTime:ph.captureTime, gps:ph.gps, _uploadFailed:true});
            }
          } else {
            uploadedPhotos.push(ph);
          }
        }
        setBusy(false);

        // Save update to project
        if(!p.contractorUpdates) p.contractorUpdates=[];
        p.contractorUpdates.push({...item.update, photos:uploadedPhotos, _syncedFrom:'offline'});
        await saveProjectDB(p);

        // Remove from IDB queue on success
        await idbDelete(item.id);
        synced++;
      }
    }catch(e){
      console.error('Sync failed for item:', item.id, e);
      failed++;
    }
  }
  setBusy(false);

  // Clear localStorage fallback if everything synced
  if(synced>0 && failed===0){
    localStorage.removeItem('rsr_offline_fallback');
  }

  if(synced>0){
    toast(`✅ ${synced} offline update${synced>1?'s':''} synced successfully!`,'ok',4000);
    // Reload project data to show synced updates
    try{ await loadDBSummary(); }catch(e){}
    if(CU?.role==='contractor') renderCHome();
  }
  if(failed>0 && synced===0){
    toast(`⚠️ Sync failed for ${failed} update${failed>1?'s':''} — will retry when reconnected`,'error',5000);
  }
}

async function checkOfflineQueue(){
  const q = await getOfflineQueue();
  let fallback = [];
  try{ fallback = JSON.parse(localStorage.getItem('rsr_offline_fallback')||'[]'); }catch(e){}
  const total = q.length + fallback.length;
  if(total>0){
    toast(`📥 ${total} update${total>1?'s':''} pending sync — connect to internet to upload`,'ok',5000);
  }
}

// Check connectivity and sync on coming back online
window.addEventListener('online', ()=>{
  dbOK=true;
  toast('🌐 Back online — syncing…','ok',2000);
  setTimeout(syncOfflineQueue, 1500);
});
window.addEventListener('offline', ()=>{
  dbOK=false;
  toast('📵 You are offline. Updates will be saved locally.','error',4000);
});


// checkOfflineQueue() defined above (line ~209) — correctly awaits getOfflineQueue().
// This duplicate (missing await, broke the sync notification) has been removed.

// ─── INSTALL PROMPT ───────────────────────────────────
window.addEventListener('beforeinstallprompt', e=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  // Show install button after login
  setTimeout(showInstallBanner, 2000);
});

function showInstallBanner(){
  if(!deferredInstallPrompt || !CU) return;
  const existing = document.getElementById('install-banner');
  if(existing) return;
  const banner = document.createElement('div');
  banner.id='install-banner';
  banner.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--navy);color:#fff;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:500;z-index:999;display:flex;align-items:center;gap:12px;box-shadow:0 4px 20px rgba(0,0,0,.3);max-width:320px;border:1px solid rgba(201,168,76,.3)';
  banner.innerHTML=`<span>📱 Install RSR App on your phone</span><button onclick="installPWA()" style="background:var(--gold);color:var(--navy);border:none;padding:6px 14px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px">Install</button><button onclick="this.parentElement.remove()" style="background:none;border:none;color:rgba(255,255,255,.5);cursor:pointer;font-size:18px">✕</button>`;
  document.body.appendChild(banner);
}

function triggerInstall(){
  if(deferredInstallPrompt){
    // Chrome/Android — use the native prompt
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(r=>{
      if(r.outcome==='accepted'){
        toast('✅ RSR App installed on your home screen!','ok',4000);
        document.getElementById('install-app-btn')?.remove();
      }
      deferredInstallPrompt=null;
    });
  } else {
    // iOS Safari or prompt already used — show manual instructions
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);
    let msg = '';
    if(isIOS){
      msg = '📱 To install on iPhone/iPad:\n\n1. Tap the Share button (box with arrow) at the bottom of Safari\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" — done!';
    } else {
      msg = '📱 To install on Android:\n\n1. Tap the 3-dot menu (⋮) at the top right of Chrome\n2. Tap "Add to Home screen" or "Install app"\n3. Tap "Add" — done!\n\nIf you don\'t see this option, the app may already be installed.';
    }
    alert(msg);
  }
}

// ─── SERVICE WORKER ───────────────────────────────────
// IMPORTANT: CACHE_NAME must change on every deploy that touches this
// file. A previous version of this service worker had a hardcoded cache
// name that never changed between app versions — since the browser only
// re-installs a service worker when its script bytes actually change, and
// this script's bytes were often identical across several recent fixes,
// the browser had no reason to ever refresh what it had cached. That
// means the app's HTML shell, cached on someone's very first visit, could
// keep being served indefinitely afterward regardless of how many new
// versions were deployed or how many times the page was hard-refreshed —
// invisible, because nothing about it looks like an error. Bumping this
// version string forces a real reinstall, a real cache purge, and a
// guaranteed fresh shell on the next load.
const SW_VERSION = 'rsr-tracker-v24q-1';

function registerServiceWorker(){
  if(!('serviceWorker' in navigator)) return;

  // Belt-and-braces: proactively unregister any existing service worker
  // and clear every cache this origin has, before registering the current
  // one — so anyone whose browser is stuck on an old cached version from
  // earlier testing gets a guaranteed clean slate on their very next load,
  // without needing to know to manually clear site data themselves.
  navigator.serviceWorker.getRegistrations().then(regs=>{
    regs.forEach(r=>r.unregister());
  }).catch(()=>{});
  if('caches' in window){
    caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).catch(()=>{});
  }

  // Inline service worker as a blob (since we're a single HTML file)
  const swCode = `
const CACHE_NAME = '${SW_VERSION}';

self.addEventListener('install', e => {
  // Deliberately does NOT pre-cache the HTML shell ('/') anymore — that
  // was the source of the stale-version problem above. This service
  // worker no longer caches anything that could ever go stale in a way
  // that silently hides a real update from the person using the app.
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Navigation (the HTML shell) and Supabase API calls: always go straight
  // to the network, no caching, no fallback substitution. A failed
  // request should fail visibly, not get silently replaced with cached or
  // fabricated data.
  if(e.request.mode === 'navigate' || e.request.url.includes('supabase.co')) {
    e.respondWith(fetch(e.request, {cache:'no-store'}));
    return;
  }
  // Cache-first for genuinely static third-party CDN resources only
  // (fonts, SheetJS) — nothing app-specific or data-bearing ever goes
  // through this path.
  if(e.request.url.includes('cdnjs.cloudflare.com') || e.request.url.includes('fonts.googleapis.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if(cached) return cached;
        return fetch(e.request).then(r => {
          const clone = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return r;
        });
      })
    );
    return;
  }
  // Everything else (the app's own JS/CSS files): network-only, no
  // caching. These are already cache-busted with a version query string,
  // so there is no benefit to caching them here and real risk in doing so.
  e.respondWith(fetch(e.request, {cache:'no-store'}));
});
`;
  const blob = new Blob([swCode], {type:'application/javascript'});
  const swUrl = URL.createObjectURL(blob);
  navigator.serviceWorker.register(swUrl, {scope:'/'})
    .then(reg => console.log('SW registered:', reg.scope))
    .catch(err => console.log('SW registration failed (normal for file:// protocol):', err.message));
}

// ═══════════════════════════════════════════════════════
// FULL DATA EXPORT (Excel — all projects, finance, updates)

// Alias for backwards compatibility with HTML onclick attributes
function installPWA(){ triggerInstall(); }
