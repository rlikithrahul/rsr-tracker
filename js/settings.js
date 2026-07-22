// ═══════════════════════════════════════════════════════
// settings.js — RSR Constructions Tracker
// Super Admin only: Staff management, Activity Log
// ═══════════════════════════════════════════════════════

const STAFF_KEY = 'rsr_staff_v1';

// ─── LOAD STAFF FROM DB ───────────────────────────────
async function loadStaff(){
  D.staffMembers = await getSetting(STAFF_KEY, []);
}

async function saveStaff(){
  await saveSetting(STAFF_KEY, D.staffMembers||[]);
}

// ─── ACTIVITY LOG ─────────────────────────────────────
const ACT_KEY = 'rsr_activity_log';
const MAX_LOG_ENTRIES = 500;

async function writeActivityLog(type, description, projectId){
  if(!dbOK) return;
  try{
    const entry = {
      id: uid(),
      ts: new Date().toISOString(),
      type,
      description,
      user: CU ? CU.name : 'System',
      isSuperAdmin: CU ? !!CU.isSuperAdmin : false,
      projectId: projectId||null
    };
    // Append to ledger_events table
    await appendLedgerEvent({
      projectId: projectId||null,
      contractorId: null,
      type: 'activity_' + type,
      amount: 0,
      ref: null,
      ts: entry.ts,
      user: entry.user,
      meta: { description, isSuperAdmin: entry.isSuperAdmin }
    });
  }catch(e){
    // Non-critical — never fail on logging
    console.warn('[Activity] Log write failed:', e.message);
  }
}

async function loadActivityLog(){
  try{
    const rows = await sbReq('ledger_events?type=ilike.activity_*&order=ts.desc&limit=200','GET');
    return (rows||[]).map(r=>({
      id: r.id,
      ts: r.ts,
      type: (r.type||'').replace('activity_',''),
      description: (() => { try{ const m = typeof r.meta==='string'?JSON.parse(r.meta||'{}'):r.meta||{}; return m.description||r.ref||''; }catch(e){ return r.ref||'—'; } })(),
      user: r.user_name||r.user||'—',
      isSuperAdmin: (() => { try{ const m = typeof r.meta==='string'?JSON.parse(r.meta||'{}'):r.meta||{}; return !!m.isSuperAdmin; }catch(e){ return false; } })(),
      projectId: r.project_id
    }));
  }catch(e){ return []; }
}

// ─── RENDER SETTINGS PAGE ─────────────────────────────
async function renderSettings(){
  // Only Super Admin can access
  if(!CU || !CU.isSuperAdmin){
    toast('Access denied — Super Admin only','error');
    ownerTab(0);
    return;
  }

  try{
    await loadStaff();
    await loadCustomWorkTypes();
    await loadWEXCustomTypes(); await loadWEXOverrides(); await loadWEXGroupOrder();
  }catch(e){
    console.error('Settings data failed to load:', e);
    toast('⚠️ Some settings data failed to load — please refresh and try again before making changes here','error',6000);
  }

  const el = document.getElementById('sec-settings');
  if(!el) return;

  el.innerHTML = `
    <div class="pg-hdr"><div class="pg-title">⚙️ Settings</div></div>

    <!-- STAFF MANAGEMENT -->
    <div class="card" style="border-top:3px solid var(--gold);margin-bottom:16px">
      <div class="st" style="margin-bottom:4px">👥 Staff Logins</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:14px">
        Staff can log in and use all owner features. They cannot access Settings or Activity Log.
        You (Super Admin) are the master login — your password is set separately via the 🔑 Password button.
      </div>
      <div id="staff-list" style="margin-bottom:14px">${renderStaffList()}</div>
      <div style="border-top:1px solid var(--border);padding-top:14px">
        <div class="st" style="font-size:13px;margin-bottom:10px">Add New Staff Member</div>
        <div class="frow">
          <div class="fg"><label>Name</label><input type="text" id="new-staff-name" placeholder="e.g. Satish, Kailash"></div>
          <div class="fg"><label>Password</label><input type="password" id="new-staff-pw" placeholder="Set their login password" autocomplete="new-password"></div>
        </div>
        <button class="btn btn-navy" onclick="addStaffMember()" style="margin-top:8px">+ Add Staff Member</button>
      </div>
    </div>

    <!-- WORK TYPES -->
    <div class="card" style="border-top:3px solid var(--navy);margin-bottom:16px">
      <div class="st" style="margin-bottom:4px">🏷️ Work Types</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:14px">
        Add a new work type here once and it's immediately available when creating or editing <strong>any</strong> project — old or new. This is the single list used everywhere (project creation, Work Experience "Similar Works Value" grouping, etc.) so grouping always stays consistent.
      </div>
      <div id="worktypes-settings-list" style="margin-bottom:14px">${_renderWorkTypesSettingsList()}</div>
      <div style="display:flex;gap:8px;align-items:center;border-top:1px solid var(--border);padding-top:14px">
        <input type="text" id="new-worktype-input" placeholder="e.g. Park, Gym Equipment" style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:var(--rs);font-size:13px;font-family:'Inter',sans-serif" onkeydown="if(event.key==='Enter')addCustomWorkTypeFromSettings()">
        <button class="btn btn-navy" onclick="addCustomWorkTypeFromSettings()">+ Add Work Type</button>
      </div>
    </div>

    <!-- WORK EXPERIENCE QUANTITY TYPES -->
    <div class="card" style="border-top:3px solid var(--navy);margin-bottom:16px">
      <div class="st" style="margin-bottom:4px">📐 Work Experience Quantity Types</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:14px">
        Add a new quantity item here (e.g. under Steel: HYSD Steel, Fabricated Steel, SS 304 Steel) and it appears in the Work Experience entry form for <strong>every</strong> project, old and new.
      </div>
      <div id="wex-types-settings-list" style="margin-bottom:14px">${renderWEXTypesSettingsList()}</div>
      <div style="border-top:1px solid var(--border);padding-top:14px">
        <div class="frow">
          <div class="fg"><label>Quantity Name</label><input type="text" id="new-wextype-label" placeholder="e.g. SS 304 Steel"></div>
          <div class="fg"><label>Unit</label><input type="text" id="new-wextype-unit" placeholder="e.g. kg, cum, sqm, nos"></div>
          <div class="fg"><label>Group</label>
            <select id="new-wextype-group">
              ${getAllWEXGroups().map(g=>`<option value="${g}">${g}</option>`).join('')}
              <option value="__new__">+ New group…</option>
            </select>
          </div>
        </div>
        <button class="btn btn-navy" onclick="addWEXCustomTypeFromSettings()" style="margin-top:8px">+ Add Quantity Type</button>
      </div>
    </div>

    <!-- BACKUP HISTORY -->
    <div class="card" style="border-top:3px solid var(--green);margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div>
          <div class="st" style="margin-bottom:2px">💾 Automatic Daily Backup</div>
          <div style="font-size:12px;color:var(--text2)">Runs silently the first time anyone logs in each day — a full snapshot of every project, contractor, and everything else in the app (Work Experience, GST, EMI, staff, meetings, tasks, cash register, all of it). Kept for 90 days.</div>
        </div>
        <button onclick="renderBackupHistory()" style="padding:6px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--rs);font-size:12px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif">↻ Refresh</button>
      </div>
      <div id="backup-history-list"><div style="font-size:13px;color:var(--text3);text-align:center;padding:12px">Loading…</div></div>
    </div>

    <!-- DELETED BIN -->
    <div class="card" style="border-top:3px solid var(--amber);margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div>
          <div class="st" style="margin-bottom:2px">🗑️ Deleted Items (7-day recovery)</div>
          <div style="font-size:12px;color:var(--text2)">Items deleted by contractors or staff — recoverable within 7 days.</div>
        </div>
        <button onclick="renderDeletedBin()" style="padding:6px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--rs);font-size:12px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif">↻ Refresh</button>
      </div>
      <div id="deleted-bin-wrap"><div style="font-size:13px;color:var(--text3);text-align:center;padding:12px">Loading…</div></div>
    </div>

    <!-- ACTIVITY LOG -->
    <div class="card" style="border-top:3px solid var(--navy)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div>
          <div class="st" style="margin-bottom:2px">📋 Activity Log</div>
          <div style="font-size:12px;color:var(--text2)">Complete audit trail — every login, project view, edit, fund release, settlement, and import.</div>
        </div>
      </div>
      <div id="activity-filter-bar" style="margin-bottom:12px"></div>
      <div id="activity-log-full" style="max-height:600px;overflow-y:auto">
        <div style="color:var(--text3);font-size:13px;text-align:center;padding:20px">Loading…</div>
      </div>
    </div>`;

  // Load full activity log
  renderFullActivityLog();
  // Load deleted bin
  setTimeout(renderDeletedBin, 100);
  // Load backup history
  setTimeout(renderBackupHistory, 100);
}

function renderStaffList(){
  const staff = D.staffMembers||[];
  if(!staff.length) return '<div style="font-size:13px;color:var(--text3);font-style:italic">No staff members added yet.</div>';
  return staff.map((s,i)=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--surface2);border-radius:var(--rs);margin-bottom:6px;gap:8px;flex-wrap:wrap">
      <div>
        <div style="font-weight:700;font-size:13px">${s.name}</div>
        <div style="font-size:11px;color:var(--text3)">Staff login • Password: ${'•'.repeat(s.password.length)}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm" onclick="editStaffPassword(${i})">🔑 Change PW</button>
        <button class="btn btn-sm" style="color:var(--red)" onclick="removeStaffMember(${i})">🗑️ Remove</button>
      </div>
    </div>`).join('');
}

async function addStaffMember(){
  const name = document.getElementById('new-staff-name').value.trim();
  const pw = document.getElementById('new-staff-pw').value;
  if(!name){ toast('Enter staff name','error'); return; }
  if(!pw || pw.length<4){ toast('Password must be at least 4 characters','error'); return; }

  // Check no duplicate password (passwords must be unique to identify who logged in)
  if(pw === D.ownerPw){ toast('Cannot use the master password as staff password','error'); return; }
  if((D.staffMembers||[]).some(s=>s.password===pw)){ toast('Password already in use by another staff member','error'); return; }

  if(!D.staffMembers) D.staffMembers=[];
  D.staffMembers.push({id:uid(), name, password:pw, addedAt:new Date().toISOString()});

  try{
    await saveStaff();
    document.getElementById('new-staff-name').value='';
    document.getElementById('new-staff-pw').value='';
    document.getElementById('staff-list').innerHTML=renderStaffList();
    await writeActivityLog('staff_added', `Staff member added: ${name}`);
    toast(`✓ ${name} added as staff member`,'ok');
  }catch(e){ toast('Save failed','error'); }
}

async function removeStaffMember(i){
  const s = D.staffMembers[i];
  if(!confirm(`Remove ${s.name} from staff? They will no longer be able to log in.`)) return;
  D.staffMembers.splice(i,1);
  try{
    await saveStaff();
    document.getElementById('staff-list').innerHTML=renderStaffList();
    await writeActivityLog('staff_removed', `Staff member removed: ${s.name}`);
    toast(`✓ ${s.name} removed`,'ok');
  }catch(e){ toast('Save failed','error'); }
}

function editStaffPassword(i){
  const s = D.staffMembers[i];
  const newPw = prompt(`New password for ${s.name}:`);
  if(!newPw) return;
  if(newPw.length<4){ toast('Password must be at least 4 characters','error'); return; }
  if(newPw===D.ownerPw){ toast('Cannot use master password','error'); return; }
  if(D.staffMembers.some((x,j)=>j!==i&&x.password===newPw)){ toast('Password already in use','error'); return; }
  s.password = newPw;
  saveStaff().then(()=>{
    document.getElementById('staff-list').innerHTML=renderStaffList();
    toast(`✓ Password updated for ${s.name}`,'ok');
  }).catch(()=>toast('Save failed','error'));
}

async function refreshActivityLog(){
  const wrap = document.getElementById('activity-log-wrap');
  if(!wrap) return;
  wrap.innerHTML='<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px">Loading…</div>';

  const log = await loadActivityLog();

  if(!log.length){
    wrap.innerHTML='<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px">No activity recorded yet.</div>';
    return;
  }

  const icons = {
    login:'🔑', logout:'🚪', project_edit:'✏️', project_create:'🏗️',
    project_archive:'📦', status_change:'🔄', settlement:'🏦',
    payment:'💸', receipt:'📥', tally_import:'📤', verification:'🔍',
    staff_added:'👥', staff_removed:'🗑️', compound:'📅'
  };

  wrap.innerHTML=`<div class="tbl-wrap">
    <table>
      <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
      <tbody>
        ${log.map(e=>`<tr>
          <td style="white-space:nowrap;font-size:11px;color:var(--text3)">${fmtDateTime(e.ts)}</td>
          <td><span style="font-weight:600;font-size:12px;color:${e.isSuperAdmin?'var(--gold)':'var(--navy)'}">${e.user||'—'}</span>${e.isSuperAdmin?'<span style="font-size:9px;color:var(--gold);margin-left:4px">★</span>':''}</td>
          <td style="font-size:12px">${icons[e.type]||'📌'} ${e.type||'—'}</td>
          <td style="font-size:12px;color:var(--text2);max-width:250px">${e.description||'—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}
