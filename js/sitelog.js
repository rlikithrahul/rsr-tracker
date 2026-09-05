// ═══════════════════════════════════════════════════════
// sitelog.js — RSR Site Log (standalone quick-entry page)
// Deliberately independent of the main app's JS bundle — this page
// exists specifically to load fast on a site supervisor's phone. Talks
// to Supabase directly via REST, same project, same tables, just a much
// lighter door into a narrow slice of the data (one project only).
// ═══════════════════════════════════════════════════════

const SB_URL = 'https://qflczjaugzaryfcfcqor.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbGN6amF1Z3phcnlmY2ZjcW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNzM1MDQsImV4cCI6MjA5NDc0OTUwNH0.IrBrqM-VSIBeOGUzBqjmZmEcKUseuJhIE3koCSNnc5g';
const UPLOAD_WORKER_URL = 'https://rsr-upload-worker.likithrahul-rlr.workers.dev';
const R2_DOCS_BUCKET = 'rsr-documents';

let DEFAULT_MATERIAL_TYPES = ['Sand','20mm Metal','40mm Metal','Cement','Steel','Bricks','Water Tanker'];
let DEFAULT_EXPENSE_TYPES = ['Labour Wages','Fuel','Tea/Refreshments','Transport','Tools/Hardware','Misc'];

let siteId = null;       // from URL
let projectId = null;
let projectName = '';
let customTypes = { materials: [], expenses: [] };
let selectedType = { materials: null, expenses: null, labour: {} };

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const todayStr = () => new Date().toISOString().split('T')[0];

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}
function show(id){
  ['screen-pin','screen-hub','screen-labour','screen-materials','screen-expenses','screen-notes','screen-loading','screen-error'].forEach(s=>{
    document.getElementById(s).classList.toggle('hidden', s!==id);
  });
  document.getElementById('topbarBack').classList.toggle('hidden', id==='screen-pin'||id==='screen-loading'||id==='screen-error');
  document.getElementById('topbarTitle').textContent = id==='screen-hub' ? projectName.substring(0,28) :
    id==='screen-labour' ? 'Labour' : id==='screen-materials' ? 'Materials' : id==='screen-expenses' ? 'Expenses' : id==='screen-notes' ? 'Notes' : 'Site Log';
}
function goHub(){ show('screen-hub'); }

// ─── SUPABASE HELPERS ──────────────────────────────────
async function sbReq(path, method, body){
  const opts = { method, headers: { 'apikey': SB_KEY, 'Authorization':'Bearer '+SB_KEY, 'Content-Type':'application/json', 'Prefer':'return=representation' } };
  if(body) opts.body = JSON.stringify(body);
  const res = await fetch(SB_URL+'/rest/v1/'+path, opts);
  if(!res.ok) throw new Error('Request failed: '+res.status);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
async function getProject(pid){
  const rows = await sbReq('projects?id=eq.'+pid+'&select=*', 'GET');
  if(!rows || !rows[0]) return null;
  return { ...rows[0].data, id: rows[0].id };
}
async function saveProjectPatch(pid, updater){
  // Fetch fresh, apply the change, write back — small footprint, no
  // merge-safety machinery needed here since this page only ever adds
  // one record at a time (append-only), not editing existing arrays.
  const p = await getProject(pid);
  if(!p) throw new Error('Project not found');
  updater(p);
  const { id, ...data } = p;
  await sbReq('projects?id=eq.'+pid, 'PATCH', { data });
  return p;
}
async function getSetting(key, fallback){
  try{
    const rows = await sbReq('settings?key=eq.'+encodeURIComponent(key)+'&select=value', 'GET');
    if(!rows || !rows.length) return fallback;
    return JSON.parse(rows[0].value);
  }catch(e){ return fallback; }
}

// ─── INIT: read URL, validate site link ───────────────
async function init(){
  const params = new URLSearchParams(location.search);
  siteId = params.get('s');
  if(!siteId){ showError('No site specified — use the link given to you by the office.'); return; }

  try{
    const pins = await getSetting('rsr_sitelog_pins', []);
    const entry = pins.find(x=>x.id===siteId);
    if(!entry){ showError('This site link is not recognized.'); return; }
    if(entry.active===false){ showError('This site link has been deactivated. Contact the office for a new one.'); return; }

    projectId = entry.projectId;
    const p = await getProject(projectId);
    if(!p){ showError('Project not found.'); return; }
    projectName = p.name || 'Site';

    window._sitePin = entry.pin;
    document.getElementById('pin-project-name').textContent = projectName.substring(0,40);
    document.getElementById('hub-project-name').textContent = projectName;
    document.title = 'RSR — '+projectName.substring(0,25);

    // Manifest for "Add to Home Screen" naming/icon
    const manifest = {
      name: projectName.substring(0,40), short_name: projectName.substring(0,14),
      start_url: location.pathname+location.search, display: 'standalone',
      background_color:'#1A2744', theme_color:'#1A2744',
      icons: [{ src: 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231A2744"/><text x="50" y="62" font-size="42" fill="%23C9A84C" text-anchor="middle" font-family="sans-serif" font-weight="bold">RSR</text></svg>'), sizes:'100x100', type:'image/svg+xml' }]
    };
    const blob = new Blob([JSON.stringify(manifest)], {type:'application/json'});
    document.getElementById('sitelog-manifest').href = URL.createObjectURL(blob);

    customTypes = await getSetting('rsr_sitelog_custom_'+projectId, {materials:[],expenses:[]});
    const adminDefaults = await getSetting('rsr_sitelog_defaults', null);
    if(adminDefaults){
      if(adminDefaults.materials && adminDefaults.materials.length) DEFAULT_MATERIAL_TYPES = adminDefaults.materials;
      if(adminDefaults.expenses && adminDefaults.expenses.length) DEFAULT_EXPENSE_TYPES = adminDefaults.expenses;
    }

    show('screen-pin');
    setTimeout(()=>document.getElementById('pinInput').focus(), 300);
  }catch(e){
    console.error(e);
    showError('Could not load this site right now. Check your connection and reload.');
  }
}
function showError(msg){
  document.getElementById('error-text').textContent = msg;
  show('screen-error');
}

// ─── PIN ENTRY ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', ()=>{
  init();
  const pinInput = document.getElementById('pinInput');
  pinInput.addEventListener('input', ()=>{
    const val = pinInput.value.replace(/\D/g,'').slice(0,4);
    pinInput.value = val;
    document.querySelectorAll('.pin-dot').forEach((d,i)=>d.classList.toggle('filled', i<val.length));
    document.getElementById('pinError').style.display = 'none';
    if(val.length===4) checkPin(val);
  });
});
function checkPin(val){
  if(val === window._sitePin){
    document.getElementById('pinInput').value='';
    document.querySelectorAll('.pin-dot').forEach(d=>d.classList.remove('filled'));
    goHub();
  } else {
    document.getElementById('pinError').style.display='block';
    setTimeout(()=>{
      document.getElementById('pinInput').value='';
      document.querySelectorAll('.pin-dot').forEach(d=>d.classList.remove('filled'));
    }, 500);
  }
}

// ─── SECTION SWITCHING ─────────────────────────────────
async function openSection(section){
  show('screen-'+section);
  if(section==='labour'){ document.getElementById('lab-date').value = todayStr(); renderLabourTypes(); loadLabourHistory(); loadMestriDatalist(); }
  if(section==='materials'){ renderTypeGrid('materials'); loadMaterialHistory(); loadSupplierDatalist(); }
  if(section==='expenses'){ renderTypeGrid('expenses'); loadExpenseHistory(); }
  if(section==='notes'){ loadNotes(); }
}
async function loadSupplierDatalist(){
  const p = await getProject(projectId);
  let dl = document.getElementById('supplier-datalist');
  if(!dl){ dl = document.createElement('datalist'); dl.id='supplier-datalist'; document.body.appendChild(dl); document.getElementById('mat-supplier').setAttribute('list','supplier-datalist'); }
  dl.innerHTML = (p.supplierNames||[]).map(n=>`<option value="${n}">`).join('');
}

// ─── TYPE GRIDS (materials/expenses) ──────────────────
function renderTypeGrid(kind){
  const defaults = kind==='materials' ? DEFAULT_MATERIAL_TYPES : DEFAULT_EXPENSE_TYPES;
  const custom = customTypes[kind]||[];
  const all = [...defaults, ...custom];
  const el = document.getElementById(kind==='materials'?'mat-types':'exp-types');
  el.innerHTML = all.map(t=>`<div class="tap-item" data-t="${t}" onclick="selectType('${kind}','${t.replace(/'/g,"\\'")}')">${t}</div>`).join('');
  selectedType[kind] = null;
}
function selectType(kind, t){
  selectedType[kind] = t;
  document.querySelectorAll('#'+(kind==='materials'?'mat-types':'exp-types')+' .tap-item').forEach(el=>{
    el.classList.toggle('sel', el.dataset.t===t);
  });
}
async function addCustomType(kind){
  const name = prompt('Add a custom '+(kind==='materials'?'material':'expense category')+' for this site:');
  if(!name || !name.trim()) return;
  customTypes[kind] = customTypes[kind]||[];
  customTypes[kind].push(name.trim());
  try{
    await sbReq('settings', 'POST', { key:'rsr_sitelog_custom_'+projectId, value: JSON.stringify(customTypes) });
  }catch(e){
    // key might already exist — try PATCH instead
    try{ await sbReq('settings?key=eq.'+encodeURIComponent('rsr_sitelog_custom_'+projectId), 'PATCH', { value: JSON.stringify(customTypes) }); }
    catch(e2){ toast('Could not save custom item — try again'); return; }
  }
  renderTypeGrid(kind);
  selectType(kind, name.trim());
}

// ─── LABOUR ────────────────────────────────────────────
const LABOUR_ROLES = [
  {id:'mestri',label:'Mestri'},{id:'nmr_m',label:'NMR (Male)'},{id:'nmr_f',label:'NMR (Female)'},
  {id:'rod_bender',label:'Rod Bender'},{id:'centering',label:'Centering'},{id:'carpenter',label:'Carpenter'},
  {id:'plumber',label:'Plumber'},{id:'painter',label:'Painter'}
];
function renderLabourTypes(){
  const el = document.getElementById('lab-types');
  el.innerHTML = LABOUR_ROLES.map(r=>`
    <div style="grid-column:span 1">
      <div style="font-size:12px;font-weight:600;margin-bottom:4px">${r.label}</div>
      <input type="number" min="0" id="lab-${r.id}" value="0" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:var(--rs);font-size:16px;text-align:center">
    </div>`).join('');
}
async function saveLabourEntry(){
  const date = document.getElementById('lab-date').value || todayStr();
  const counts = {};
  LABOUR_ROLES.forEach(r=>{
    const v = parseInt(document.getElementById('lab-'+r.id).value)||0;
    if(v>0) counts[r.id]=v;
  });
  const mestriName = document.getElementById('lab-mestri').value.trim();
  if(!Object.keys(counts).length){ toast('Enter at least one labour count'); return; }

  try{
    // Same place (p.labourLog on the project itself) that the main app's
    // contractor login now writes to — always a new array entry, never
    // overwriting an existing date, which is what allows two mestris to
    // both log labour for the same day as separate entries.
    await saveProjectPatch(projectId, (proj)=>{
      if(!proj.labourLog) proj.labourLog=[];
      if(!proj.mestriNames) proj.mestriNames=[];
      proj.labourLog.push({ id: uid(), date, mestriName, counts, addedBy:'Site Log (PIN)', createdAt:new Date().toISOString(), source:'sitelog' });
      if(mestriName && !proj.mestriNames.includes(mestriName)) proj.mestriNames.push(mestriName);
    });
    toast('✓ Labour entry saved');
    LABOUR_ROLES.forEach(r=>document.getElementById('lab-'+r.id).value=0);
    document.getElementById('lab-mestri').value='';
    loadLabourHistory();
    loadMestriDatalist();
  }catch(e){ toast('Save failed — check connection'); }
}
async function loadLabourHistory(){
  const el = document.getElementById('lab-history');
  el.innerHTML = '<div style="color:var(--text3);font-size:13px">Loading…</div>';
  const p = await getProject(projectId);
  const log = (p.labourLog||[]).filter(e=>!e._archived).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)).slice(0,10);
  if(!log.length){ el.innerHTML = '<div style="color:var(--text3);font-size:13px">No entries yet.</div>'; return; }
  el.innerHTML = log.map(e=>{
    const total = Object.values(e.counts||{}).reduce((s,v)=>s+v,0);
    return `<div class="hist-row"><span>${e.date}${e.mestriName?' · 👤 '+e.mestriName:''}</span><span style="font-weight:700">${total} total</span></div>`;
  }).join('');
}
async function loadMestriDatalist(){
  const p = await getProject(projectId);
  let dl = document.getElementById('mestri-datalist');
  if(!dl){ dl = document.createElement('datalist'); dl.id='mestri-datalist'; document.body.appendChild(dl); document.getElementById('lab-mestri').setAttribute('list','mestri-datalist'); }
  dl.innerHTML = (p.mestriNames||[]).map(n=>`<option value="${n}">`).join('');
}

// ─── MATERIALS ─────────────────────────────────────────
async function saveMaterialEntry(){
  const materialName = selectedType.materials;
  if(!materialName){ toast('Select a material first'); return; }
  const qty = parseFloat(document.getElementById('mat-qty').value);
  if(!qty||qty<=0){ toast('Enter a quantity'); return; }
  const bill = parseFloat(document.getElementById('mat-bill').value)||0;
  const paid = parseFloat(document.getElementById('mat-paid').value)||0;
  const supplier = document.getElementById('mat-supplier').value.trim();
  const notes = document.getElementById('mat-notes').value.trim();

  try{
    const p = await saveProjectPatch(projectId, (proj)=>{
      if(!proj.materialRegister) proj.materialRegister=[];
      if(!proj.supplierNames) proj.supplierNames=[];
      if(supplier && !proj.supplierNames.includes(supplier)) proj.supplierNames.push(supplier);
      proj.materialRegister.push({
        id: uid(), materialId: materialName.toLowerCase().replace(/\s+/g,'_'), materialName,
        qty, unit:'', date: todayStr(), supplierName: supplier, amount: bill||null, notes,
        addedBy: 'Site Log (PIN)', createdAt: new Date().toISOString(), source:'sitelog'
      });
      if(bill>0){
        if(!proj.materialCredits) proj.materialCredits=[];
        proj.materialCredits.push({
          id: uid(), supplierName: supplier||materialName, invoiceNo:'', invoiceDate: todayStr(),
          invoiceAmount: bill, status: paid>=bill?'cleared':'pending',
          clearedAmount: paid, clearedDate: paid>0?todayStr():null,
          clearedNotes: notes, createdAt: new Date().toISOString(), source:'sitelog',
          materialName
        });
      }
    });
    toast('✓ Material entry saved'+(bill>0&&bill>paid?' — ₹'+(bill-paid).toLocaleString('en-IN')+' pending':''));
    document.getElementById('mat-qty').value=''; document.getElementById('mat-bill').value='';
    document.getElementById('mat-paid').value=''; document.getElementById('mat-supplier').value='';
    document.getElementById('mat-notes').value='';
    selectType('materials', null);
    loadMaterialHistory();
    loadSupplierDatalist();
  }catch(e){ toast('Save failed — check connection'); }
}
async function loadMaterialHistory(){
  const el = document.getElementById('mat-history');
  el.innerHTML = '<div style="color:var(--text3);font-size:13px">Loading…</div>';
  const p = await getProject(projectId);
  const entries = (p.materialRegister||[]).filter(e=>!e._archived).slice().reverse().slice(0,8);
  if(!entries.length){ el.innerHTML = '<div style="color:var(--text3);font-size:13px">No entries yet.</div>'; return; }
  el.innerHTML = entries.map(e=>`<div class="hist-row"><span>${e.date} · ${e.materialName} — ${e.qty}${e.supplierName?' · 👤 '+e.supplierName:''}</span><span style="font-weight:700">${e.amount?'₹'+e.amount.toLocaleString('en-IN'):''}</span></div>`).join('');
}

// ─── EXPENSES ──────────────────────────────────────────
async function saveExpenseEntry(){
  const category = selectedType.expenses;
  if(!category){ toast('Select a category first'); return; }
  const amount = parseFloat(document.getElementById('exp-amount').value);
  if(!amount||amount<=0){ toast('Enter an amount'); return; }
  const notes = document.getElementById('exp-notes').value.trim();

  try{
    await saveProjectPatch(projectId, (proj)=>{
      if(!proj.siteExpenses) proj.siteExpenses=[];
      proj.siteExpenses.push({
        id: uid(), category, amount, notes, date: todayStr(),
        addedBy: 'Site Log (PIN)', createdAt: new Date().toISOString(), source:'sitelog'
      });
    });
    toast('✓ Expense saved');
    document.getElementById('exp-amount').value=''; document.getElementById('exp-notes').value='';
    selectType('expenses', null);
    loadExpenseHistory();
  }catch(e){ toast('Save failed — check connection'); }
}
async function loadExpenseHistory(){
  const el = document.getElementById('exp-history');
  el.innerHTML = '<div style="color:var(--text3);font-size:13px">Loading…</div>';
  const p = await getProject(projectId);
  const entries = (p.siteExpenses||[]).filter(e=>!e._archived).slice().reverse().slice(0,8);
  if(!entries.length){ el.innerHTML = '<div style="color:var(--text3);font-size:13px">No entries yet.</div>'; return; }
  el.innerHTML = entries.map(e=>`<div class="hist-row"><span>${e.date} · ${e.category}</span><span style="font-weight:700">₹${e.amount.toLocaleString('en-IN')}</span></div>`).join('');
}

// ─── NOTES ─────────────────────────────────────────────
// Reuses the exact same p.contractorNotes structure the main app's
// contractor login writes to — a note added here shows up there, and
// vice versa, same as Materials already does.
async function saveNote(){
  const text = document.getElementById('note-text').value.trim();
  if(!text){ toast('Write something first'); return; }
  const date = document.getElementById('note-date').value || '';
  try{
    await saveProjectPatch(projectId, (proj)=>{
      if(!proj.contractorNotes) proj.contractorNotes=[];
      proj.contractorNotes.push({ id: uid(), text, date, createdAt: new Date().toISOString(), by:'Site Log (PIN)', contractorId:null });
    });
    toast('✓ Note saved');
    document.getElementById('note-text').value=''; document.getElementById('note-date').value='';
    loadNotes();
  }catch(e){ toast('Save failed — check connection'); }
}
async function loadNotes(){
  const el = document.getElementById('notes-list');
  el.innerHTML = '<div style="color:var(--text3);font-size:13px">Loading…</div>';
  const p = await getProject(projectId);
  const notes = (p.contractorNotes||[]).filter(n=>!n._archived).slice().reverse().slice(0,10);
  if(!notes.length){ el.innerHTML = '<div style="color:var(--text3);font-size:13px">No notes yet.</div>'; return; }
  el.innerHTML = notes.map(n=>`<div style="border-left:3px solid var(--gold);padding:8px 10px;margin-bottom:8px;background:var(--bg);border-radius:0 var(--rs) var(--rs) 0">
    ${n.date?`<div style="font-size:11px;color:var(--text3);font-weight:600">📅 ${n.date}</div>`:''}
    <div style="font-size:13px">${n.text.replace(/</g,'&lt;')}</div>
    <div style="font-size:10px;color:var(--text3);margin-top:2px">${new Date(n.createdAt).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
  </div>`).join('');
}
