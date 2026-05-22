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
// ─── CLOUDFLARE R2 UPLOAD ─────────────────────────────
// Uses AWS Signature v4 for R2 authentication
async function r2Upload(file, bucket, key) {
  // Build the S3-compatible signed URL request
  const datetime = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0,15) + 'Z';
  const date = datetime.slice(0,8);
  const region = 'auto';
  const service = 's3';
  const host = R2_ENDPOINT.replace('https://','') + '/' + bucket;
  const uploadUrl = `${R2_ENDPOINT}/${bucket}/${key}`;

  // For browser-based uploads, use presigned URL approach via a simple PUT
  // R2 supports direct PUT with access key auth via Authorization header
  // We use a simple HMAC-SHA256 signing
  const encoder = new TextEncoder();

  async function hmac(key, data) {
    const k = typeof key === 'string' ? encoder.encode(key) : key;
    const cryptoKey = await crypto.subtle.importKey('raw', k, {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data)));
  }

  async function sha256hex(data) {
    const buf = typeof data === 'string' ? encoder.encode(data) : data;
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  const fileBuffer = await file.arrayBuffer();
  const payloadHash = await sha256hex(fileBuffer);
  const contentType = file.type || 'application/octet-stream';

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${datetime}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `PUT\n/${key}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${datetime}\n${credentialScope}\n${await sha256hex(canonicalRequest)}`;

  const signingKey = await hmac(
    await hmac(await hmac(await hmac('AWS4' + R2_SECRET_KEY, date), region), service),
    'aws4_request'
  );
  const sigArr = await hmac(signingKey, stringToSign);
  const signature = Array.from(sigArr).map(b=>b.toString(16).padStart(2,'0')).join('');

  const authHeader = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${credentialScope},SignedHeaders=${signedHeaders},Signature=${signature}`;

  const r = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': authHeader,
      'Content-Type': contentType,
      'x-amz-date': datetime,
      'x-amz-content-sha256': payloadHash
    },
    body: file
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error('R2 upload failed: ' + r.status + ' ' + t.slice(0,200));
  }
  return key;
}

async function uploadPhoto(file, projId, updateId) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const key = `photos/${projId}/${updateId}_${Date.now()}.${ext}`;
  await r2Upload(file, R2_PHOTOS_BUCKET, key);
  return `${R2_PHOTOS_PUBLIC}/${key}`;
}

async function uploadDocument(file, projId, docType) {
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  const key = `docs/${projId}/${docType}_${Date.now()}_${safeName}`;
  await r2Upload(file, R2_DOCS_BUCKET, key);
  return `${R2_DOCS_PUBLIC}/${key}`;
}

// Compress image client-side before upload — keeps photos small/fast
async function compressImage(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = e => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1200;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          const f = new File([blob], file.name.replace(/\.[^.]+$/,'') + '.jpg', { type: 'image/jpeg' });
          resolve(f);
        }, 'image/jpeg', 0.75);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    r.onerror = () => resolve(file);
    r.readAsDataURL(file);
  });
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