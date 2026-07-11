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
// ROBUST SETTINGS KEY-VALUE STORE
// ═══════════════════════════════════════════════════════
// Every "global setting" (staff list, custom work types, WEX custom types,
// WEX data, meetings, EMI data, unmatched Tally cache, etc.) is stored as
// one row per key in the `settings` table.
//
// HISTORY OF WHY THIS IS WRITTEN THE WAY IT IS (read before changing):
// Earlier versions relied on POST-as-upsert or PATCH, both of which
// silently do nothing useful if a row for that key doesn't exist and no
// DB-level unique constraint enforces one-row-per-key — every failed
// save attempt across many past sessions has very likely left the
// `settings` table with SEVERAL duplicate rows for the same key, holding
// different (often stale/empty) values. Without an explicit ORDER BY on a
// reliable column, Postgres does not guarantee which duplicate a plain
// SELECT returns first — so a save could genuinely succeed, verify
// correctly in the same request, and still "disappear" moments later
// because the very next read (e.g. after logout/login) happened to land
// on a different, older duplicate row. That is almost certainly what was
// happening. The fix has two parts:
//   1. saveSetting INSERTS a fresh row first (never assumes an update will
//      hit anything), confirms it landed correctly, and only THEN deletes
//      every other row for that key that doesn't hold the new value — so
//      every save actively cleans up whatever mess came before it,
//      converging to exactly one row per key over time.
//   2. getSetting, until that cleanup has fully happened, picks the most
//      complete-looking duplicate rather than an arbitrary "first" one, as
//      the safest available guess (real data here only grows over time —
//      types get added, rarely removed — so the fullest duplicate is the
//      best bet while stale rows still linger).

async function getSettingRows(key){
  // Deliberately no try/catch swallowing errors into []. A failed request
  // and a genuinely empty result must never look the same to whatever
  // called this — see the note above the service worker's fetch handler
  // in offline.js for why that distinction matters here specifically.
  const rows = await sbReq('settings?key=eq.'+encodeURIComponent(key),'GET');
  return rows||[];
}

function _settingRowSize(row){
  try{
    const v = JSON.parse(row.value);
    if(Array.isArray(v)) return v.length;
    if(v && typeof v==='object') return Object.keys(v).length;
    return String(row.value||'').length;
  }catch(e){ return String(row.value||'').length; }
}

// Returns the parsed value for a key, or fallback if not present. If
// several duplicate rows exist for the key, picks the most complete one.
async function getSetting(key, fallback){
  const rows = await getSettingRows(key);
  if(!rows.length) return fallback;
  let best = rows[0];
  if(rows.length>1){
    let bestSize = _settingRowSize(best);
    for(const r of rows.slice(1)){
      const size = _settingRowSize(r);
      if(size>bestSize){ best=r; bestSize=size; }
    }
  }
  try{ return JSON.parse(best.value); }catch(e){ return fallback; }
}

// Writes value (any JSON-serializable data) for key.
//
// CRITICAL: always INSERTS a new row, then verifies a row holding the
// exact value now exists, THEN deletes every other row for the same key
// that doesn't hold that value. Never trust "the request didn't error" as
// proof the data is actually there and correctly the only copy — verify,
// then clean up, every single time.
async function saveSetting(key, value){
  const json = JSON.stringify(value);

  // Step 1: insert a correct row (never assumes an update will hit
  // anything — always adds fresh).
  await sbReq('settings', 'POST', {key, value: json});

  // Step 2: verify a row with the correct value now actually exists.
  let rows = await getSettingRows(key);
  if(!rows.some(r=>r.value===json)){
    throw new Error(`Save did not actually persist for "${key}" — the database did not confirm the write (this can happen if a permissions/RLS rule is silently blocking it, or if the table rejected the insert). Nothing was lost locally, but it will NOT survive a reload until this is fixed.`);
  }

  // Step 3: if there's more than one row for this key (leftover
  // duplicates from before this fix, or from this insert landing
  // alongside old ones), collapse down to exactly one. We deliberately
  // never put the full value in a URL filter here — some of these
  // payloads (WEX data, for instance) can be large, and a value=eq.<huge
  // JSON> filter can silently fail on URL length alone. Instead: delete
  // every row for this key (cheap, key-only filter), then insert the
  // correct value fresh once more. There's a brief moment with zero rows
  // for this key between those two calls, which is an acceptable
  // trade-off for a cleanup path that only runs when duplicates exist —
  // far safer than leaving ambiguous duplicates around indefinitely.
  if(rows.length>1){
    try{
      await sbReq('settings?key=eq.'+encodeURIComponent(key), 'DELETE');
      await sbReq('settings', 'POST', {key, value: json});
      rows = await getSettingRows(key);
      if(!rows.some(r=>r.value===json)){
        throw new Error(`Cleanup of duplicate rows for "${key}" left no correct row behind — please retry this save immediately.`);
      }
    }catch(e){
      // Escalate — a failed cleanup that leaves the key empty is exactly
      // the kind of silent data loss that must never pass unnoticed.
      throw e;
    }
  }
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

// Picks the most recently-created row for a key out of a bulk settings
// fetch — guards against the same duplicate-row issue described above for
// the couple of places that still bulk-fetch the whole settings table.
function _pickLatestSettingRow(rows, key){
  const matches = (rows||[]).filter(x => x.key === key);
  if(!matches.length) return null;
  matches.sort((a,b) => (b.id||0) - (a.id||0));
  return matches[0];
}

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
  const pw = _pickLatestSettingRow(s, OPW_KEY);
  if (pw) D.ownerPw = pw.value;
  const staffRow = _pickLatestSettingRow(s, 'rsr_staff_v1');
  D.staffMembers = staffRow ? JSON.parse(staffRow.value||'[]') : [];
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
  const pw = _pickLatestSettingRow(s, OPW_KEY);
  if (pw) D.ownerPw = pw.value;
  const staffRow2 = _pickLatestSettingRow(s, 'rsr_staff_v1');
  D.staffMembers = staffRow2 ? JSON.parse(staffRow2.value||'[]') : [];
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

// Safe accessor for quick-action buttons that live in LIST views (Action
// Centre, Deposit Refunds, Dashboard alerts) rather than a project's own
// detail page. Those pages load a lightweight summary of every project
// (contractorUpdates photos stripped to placeholders, to keep the initial
// load fast) — GP(id) alone would return that stripped version if the
// project's full detail was never opened this session. Blindly mutating
// and saving that stripped object would permanently overwrite the real
// photos on the server with placeholders. This always fetches the true,
// full, current record first, so a one-field "Mark as X" click from a list
// can never destroy unrelated data — and as a side benefit, it also always
// starts from the very latest server state, so it can't clobber a change
// someone else just made either.
async function GPFull(pid){
  if(typeof dbOK!=='undefined' && dbOK){
    try{ const fresh = await fetchProjectFull(pid); if(fresh) return fresh; }catch(e){}
  }
  return GP(pid);
}

async function saveContractorDB(c) {
  setBusy(true,'Saving contractor…');
  try {
    await sbReq('contractors', 'POST', {id:c.id, data:c, created_at:new Date().toISOString()});
  } finally { setBusy(false); }
}

async function saveProjectDB(p, eventMeta) {
  // Personal projects (contractor's own work, not linked to RSR) save via contractor record
  if(p._isPersonal && p._ownerContractorId){
    const c = D.contractors.find(x=>x.id===p._ownerContractorId);
    if(c){
      const idx = (c.personalProjects||[]).findIndex(x=>x.id===p.id);
      if(idx>=0) c.personalProjects[idx]=p;
      await saveContractorDB(c);
    }
    return;
  }
  setBusy(true,'Saving…');
  try {
    // Migrate schema before saving
    migrateProject(p);
    await sbReq('projects', 'POST', {id:p.id, data:p, created_at:new Date().toISOString()});
    // Append-only event ledger write (fire-and-forget, non-blocking)
    if(eventMeta && dbOK){
      appendLedgerEvent({
        projectId: p.id,
        contractorId: p.contractorId,
        ...eventMeta,
        ts: new Date().toISOString(),
        user: CU ? CU.name : 'system'
      }).catch(e => console.warn('Ledger event write failed:', e));
    }
  } finally { setBusy(false); }
}

// ─── APPEND-ONLY EVENT LEDGER ─────────────────────────
// One row per event — never updated, never deleted
// Table: ledger_events (id, project_id, contractor_id, type, amount, ref, user, ts, meta)
async function appendLedgerEvent(ev){
  try{
    await sbReq('ledger_events','POST',{
      id: uid(),
      project_id: ev.projectId||null,
      contractor_id: ev.contractorId||null,
      type: ev.type||'unknown',
      amount: ev.amount||0,
      ref: ev.ref||null,
      user_name: ev.user||null,
      ts: ev.ts||new Date().toISOString(),
      meta: JSON.stringify(ev.meta||{})
    });
  }catch(e){
    // Non-critical — log but don't fail
    console.warn('ledger_events write skipped (table may not exist yet):', e.message);
  }
}

// Helper to write a ledger event directly (for non-project events)
async function writeLedgerEvent(type, projectId, contractorId, amount, ref, meta){
  if(!dbOK) return;
  appendLedgerEvent({
    projectId, contractorId, type, amount, ref,
    ts: new Date().toISOString(),
    user: CU ? CU.name : 'system',
    meta: meta||{}
  }).catch(()=>{});
}

async function savePwDB(val) {
  await sbReq('settings', 'POST', {key:OPW_KEY, value:val});
}