// ═══════════════════════════════════════
// db.js
// RSR Constructions Tracker v17
// ═══════════════════════════════════════

// ═══════════════════════════════════════════════════════
// SUPABASE REST API
// ═══════════════════════════════════════════════════════
async function sbReq(table, method, body, extra) {
  const url = SB_URL + '/rest/v1/' + table;
  const h = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  if (method === 'POST') h['Prefer'] = 'resolution=merge-duplicates,return=minimal';
  if (extra && extra.prefer) h['Prefer'] = extra.prefer;
  const cfg = { method: method || 'GET', headers: h };
  if (body) cfg.body = JSON.stringify(body);
  const r = await fetch(url, cfg);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || ('HTTP ' + r.status));
  }
  if (method === 'GET') return r.json();
  return true;
}

// ═══════════════════════════════════════════════════════
// SUPABASE STORAGE (photo uploads)
// ═══════════════════════════════════════════════════════
// ─── UPLOAD VIA CLOUDFLARE WORKER ────────────────────
// All uploads go through the Worker — no secret keys in browser
// Worker URL is set in config.js as UPLOAD_WORKER_URL

async function r2UploadViaWorker(file, bucket, key) {
  const response = await fetch(UPLOAD_WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-Bucket': bucket,
      'X-Key': key,
    },
    body: file,
  });
  if (!response.ok) {
    const err = await response.json().catch(()=>({error: response.statusText}));
    throw new Error('Upload failed: ' + (err.error || response.status));
  }
  const result = await response.json();
  return result.url;
}

async function uploadPhoto(file, projId, updateId) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const key = `photos/${projId}/${updateId}_${Date.now()}.${ext}`;
  return await r2UploadViaWorker(file, R2_PHOTOS_BUCKET, key);
}

async function uploadDocument(file, projId, docType) {
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `docs/${projId}/${docType}_${Date.now()}_${safeName}`;
  return await r2UploadViaWorker(file, R2_DOCS_BUCKET, key);
}


// ═══════════════════════════════════════════════════════
// DATA LOAD / SAVE
// ═══════════════════════════════════════════════════════
// ─── LAZY FETCH ARCHITECTURE ─────────────────────────
// On login: fetch contractor list + project summaries (lightweight)
// On project open: fetch full project data (heavy: updates, photos, releases)

async function loadDB() {
  // Full load for initial/refresh — kept for compatibility
  const [c, p, s] = await Promise.all([
    sbReq('contractors?order=created_at', 'GET'),
    sbReq('projects?order=created_at', 'GET'),
    sbReq('settings', 'GET')
  ]);
  D.contractors = (c||[]).map(r => ({...r.data, id:r.id}));
  D.projects = (p||[]).map(r => ({...r.data, id:r.id}));
  // Clear cache on full reload so fresh data is fetched on next project open
  Object.keys(projectCache).forEach(k => delete projectCache[k]);
  const pw = (s||[]).find(x => x.key === OPW_KEY);
  if (pw) D.ownerPw = pw.value;
}

async function loadDBSummary() {
  // LAZY: Only load what we need for the dashboard and list views
  // Contractors: always small, load fully
  // Projects: load full data but skip contractorUpdates photos (we strip them server-side by not sending photo arrays... 
  //   actually Supabase sends everything in data blob. So we fetch all but cache and re-use on project open.
  //   True lazy load: on project open, re-fetch single project fresh from DB.
  const [c, p, s] = await Promise.all([
    sbReq('contractors?order=created_at', 'GET'),
    sbReq('projects?order=created_at', 'GET'),
    sbReq('settings', 'GET')
  ]);
  D.contractors = (c||[]).map(r => ({...r.data, id:r.id}));
  // Store lightweight summary (strip heavy arrays for initial render)
  D.projects = (p||[]).map(r => {
    const proj = {...r.data, id:r.id};
    // Keep releases and verifications (needed for financials on dashboard)
    // Strip contractorUpdates photos from summary to reduce memory
    if(proj.contractorUpdates) {
      proj.contractorUpdates = proj.contractorUpdates.map(u => ({
        ...u,
        photos: u.photos ? u.photos.map(ph => ({...ph, _lazy:true})) : [] // mark as lazy
      }));
    }
    return proj;
  });
  Object.keys(projectCache).forEach(k => delete projectCache[k]);
  const pw = (s||[]).find(x => x.key === OPW_KEY);
  if (pw) D.ownerPw = pw.value;
}

async function fetchProjectFull(id) {
  // Fetch fresh full data for one project (called when opening detail view)
  if(!dbOK) return GP(id); // offline: use cached
  try {
    const rows = await sbReq(`projects?id=eq.${id}`, 'GET');
    if(rows && rows[0]) {
      const fresh = {...rows[0].data, id:rows[0].id};
      // Update in D.projects
      const idx = D.projects.findIndex(p=>p.id===id);
      if(idx>=0) D.projects[idx]=fresh;
      else D.projects.push(fresh);
      projectCache[id] = fresh;
      return fresh;
    }
  } catch(e) { console.error('fetchProjectFull failed:', e); }
  return GP(id);
}

async function saveContractorDB(c) {
  setBusy(true,'Saving contractor…');
  try {
    await sbReq('contractors', 'POST', {id:c.id, data:c, created_at:new Date().toISOString()});
  } finally { setBusy(false); }
}

async function saveProjectDB(p) {
  setBusy(true,'Saving…');
  try {
    await sbReq('projects', 'POST', {id:p.id, data:p, created_at:new Date().toISOString()});
  } finally { setBusy(false); }
}

async function savePwDB(val) {
  await sbReq('settings', 'POST', {key:OPW_KEY, value:val});
}