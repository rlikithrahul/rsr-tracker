// ═══════════════════════════════════════════════════════
// tasks.js — Team Tasks (Daily Workflow Tracker)
// Replaces the Google Sheet + Apps Script workflow log.
// Two data sets, both settings-table blobs (merge-safe on save):
//   rsr_task_templates — recurring task definitions (Super Admin managed)
//   rsr_task_log       — one row per generated task instance per due date
// ═══════════════════════════════════════════════════════

const TASK_TEMPLATES_KEY = 'rsr_task_templates';
const TASK_LOG_KEY = 'rsr_task_log';
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ─── LOAD / SAVE ──────────────────────────────────────
async function loadTaskTemplates(){
  if(D.taskTemplates) return D.taskTemplates;
  D.taskTemplates = await getSetting(TASK_TEMPLATES_KEY, []);
  return D.taskTemplates;
}
async function saveTaskTemplates(){
  D.taskTemplates = await mergeAndSaveSetting(TASK_TEMPLATES_KEY, D.taskTemplates||[], true);
}
async function loadTaskLog(){
  if(D.taskLog) return D.taskLog;
  D.taskLog = await getSetting(TASK_LOG_KEY, []);
  return D.taskLog;
}
async function saveTaskLog(){
  D.taskLog = await mergeAndSaveSetting(TASK_LOG_KEY, D.taskLog||[], true);
}

// ─── EVERY NAME A TASK CAN BE ASSIGNED TO ────────────
// Staff logins plus the Super Admin owner themselves (several recurring
// checks in the original sheet — e.g. monthly reconciliation reviews —
// are the owner's own responsibility, not staff's).
function getAllAssignableNames(){
  const names = (D.staffMembers||[]).map(s=>s.name);
  if(CU && CU.isSuperAdmin && !names.includes(CU.name)) names.push(CU.name);
  else if(!names.includes('Likith')) names.push('Likith');
  return names;
}

// ─── DAILY AUTO-GENERATION ────────────────────────────
// Idempotent — safe to call every time someone logs in or opens this tab.
// For each active template, checks whether today is a due date, and if a
// log row doesn't already exist for (template, today), creates one.
async function generateTodaysTasks(){
  await loadTaskTemplates(); await loadTaskLog();
  const templates = (D.taskTemplates||[]).filter(t=>t.active!==false);
  if(!templates.length) return;
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dow = DAY_NAMES[today.getDay()];
  const dom = today.getDate();
  const existingKeys = new Set((D.taskLog||[]).map(l=>l.templateId+'|'+l.dueDate));
  let added = false;

  templates.forEach(t=>{
    let due = false;
    if(t.frequency==='daily') due = true;
    else if(t.frequency==='weekly') due = (t.daysOfWeek||[]).includes(dow);
    else if(t.frequency==='monthly') due = Number(t.dayOfMonth)===dom;
    if(!due) return;
    const key = t.id+'|'+todayStr;
    if(existingKeys.has(key)) return;
    D.taskLog.push({
      id:'task_'+uid(), templateId:t.id, taskName:t.name, assignedTo:t.assignedTo,
      dueDate:todayStr, status:false, completedAt:null, notes:'', createdAt:new Date().toISOString()
    });
    added = true;
  });

  if(added){ try{ await saveTaskLog(); }catch(e){ console.error('Task generation save failed:',e); } }
}

// ─── COMPLETE / REOPEN ────────────────────────────────
async function completeTask(logId, notes){
  const t = (D.taskLog||[]).find(x=>x.id===logId); if(!t) return;
  const backup = {...t};
  t.status = true; t.completedAt = new Date().toISOString(); t.notes = notes||'';
  t.completedBy = CU?CU.name:'';
  try{
    await saveTaskLog();
    renderTasksTab();
    toast('✓ Task marked done','ok');
  }catch(e){ Object.assign(t, backup); toast('Save failed — try again','error'); }
}
async function reopenTask(logId){
  const t = (D.taskLog||[]).find(x=>x.id===logId); if(!t) return;
  const backup = {...t};
  t.status = false; t.completedAt = null;
  try{
    await saveTaskLog();
    renderTasksTab();
    toast('Reopened','ok');
  }catch(e){ Object.assign(t, backup); toast('Save failed — try again','error'); }
}

// ─── ONE-TIME SEED FROM THE ORIGINAL GOOGLE SHEET ─────
// Recreates the 24 tasks from MasterTasks exactly as they were, so
// nothing needs retyping. "RAHUL" in the original sheet is mapped to
// "Likith" (the Super Admin's actual login name). Multi-day tasks (like
// "Monday, Thursday" for EMI checks) are preserved as a single task with
// both days selected, rather than split into duplicates. Only runs once,
// automatically, if no templates exist yet — never overwrites anything
// you've already set up or changed.
const TASK_SEED = [
  {name:'Tally', frequency:'daily', assignedTo:'Satish'},
  {name:'CASH BOOK', frequency:'daily', assignedTo:'Satish'},
  {name:'Bank Book', frequency:'daily', assignedTo:'Satish'},
  {name:'Tender Book', frequency:'weekly', assignedTo:'Satish', daysOfWeek:['Monday']},
  {name:'DSP GST BIILS', frequency:'monthly', assignedTo:'Satish', dayOfMonth:1},
  {name:'CASH FLOW', frequency:'daily', assignedTo:'Satish'},
  {name:'RUNNING WORKS', frequency:'weekly', assignedTo:'Satish', daysOfWeek:['Monday']},
  {name:'CHEQUE PENDING', frequency:'monthly', assignedTo:'Seshadri', dayOfMonth:2},
  {name:'CHECK MAILS', frequency:'daily', assignedTo:'Satish'},
  {name:'SHEETS LEDGERS', frequency:'daily', assignedTo:'Satish'},
  {name:'PREBIDS AMOUNTS', frequency:'weekly', assignedTo:'Satish', daysOfWeek:['Wednesday']},
  {name:'TENDER FILES', frequency:'weekly', assignedTo:'Kailash', daysOfWeek:['Monday']},
  {name:'UNSUCCESS EMD REFUNDS', frequency:'weekly', assignedTo:'Seshadri', daysOfWeek:['Monday']},
  {name:'WORK EXPERIENCE', frequency:'weekly', assignedTo:'Seshadri', daysOfWeek:['Tuesday']},
  {name:'EMD AND FSD REFUNDS', frequency:'weekly', assignedTo:'Seshadri', daysOfWeek:['Tuesday']},
  {name:'PREV MONTH ALL TENDERS CHECKING', frequency:'monthly', assignedTo:'Likith', dayOfMonth:4},
  {name:'PREV MONTH ALL BANK BOOK CHECKING', frequency:'monthly', assignedTo:'Likith', dayOfMonth:3},
  {name:'PREV MONTH ALL CASH BOOK CHECKING', frequency:'monthly', assignedTo:'Likith', dayOfMonth:2},
  {name:'PREV MONTH ALL GST BILLS CHECKING', frequency:'monthly', assignedTo:'Likith', dayOfMonth:5},
  {name:'TODAY ALL TRANSACTIONS NOTED', frequency:'daily', assignedTo:'Satish'},
  {name:'CHECK ALL GST INPUTS', frequency:'monthly', assignedTo:'Seshadri', dayOfMonth:17},
  {name:'ALL LEDGERS TENDERS IN COST CENTER', frequency:'daily', assignedTo:'Satish'},
  {name:'VERIFY BANK,CASH BOOKS MONTHWISE', frequency:'daily', assignedTo:'Satish'},
  {name:'CHECK EMIS AND CREDIT CARDS', frequency:'weekly', assignedTo:'Satish', daysOfWeek:['Monday','Thursday']},
];
async function seedTaskTemplatesIfEmpty(){
  await loadTaskTemplates();
  if(D.taskTemplates && D.taskTemplates.length) return; // already set up — never overwrite
  D.taskTemplates = TASK_SEED.map(t=>({
    id:'tmpl_'+uid(), active:true, createdAt:new Date().toISOString(),
    daysOfWeek:t.daysOfWeek||[], dayOfMonth:t.dayOfMonth||null, ...t
  }));
  try{ await saveTaskTemplates(); }catch(e){ console.error('Task seed save failed:', e); }
}

// ─── MAIN RENDER ───────────────────────────────────────
async function renderTasks(){
  const el = document.getElementById('sec-tasks');
  if(!el) return;
  el.innerHTML = '<div class="wrap"><div class="loading" style="padding:40px;text-align:center;color:var(--text3)">⏳ Loading tasks…</div></div>';
  try{
    await loadTaskTemplates();
    await seedTaskTemplatesIfEmpty();
    await loadTaskLog();
    if(typeof loadStaff==='function' && !D.staffMembers) await loadStaff();
    await generateTodaysTasks();
  }catch(e){ console.error('Task load failed:', e); }
  renderTasksTab();
}

function renderTasksTab(){
  const el = document.getElementById('sec-tasks');
  if(!el) return;
  const isSuperAdmin = CU && CU.isSuperAdmin;
  el.innerHTML = `<div class="wrap">
    <div class="pg-hdr">
      <div><div class="pg-title">✅ Team Tasks</div>
        <div style="font-size:12px;color:var(--text3)">Daily workflow — replaces the Google Sheet tracker</div></div>
      ${isSuperAdmin?`<button class="btn btn-navy" onclick="openTaskTemplateModal()">+ New Task Template</button>`:''}
    </div>
    <div id="my-tasks-section">${renderMyTasksSection(CU.name)}</div>
    ${isSuperAdmin?`<div id="team-overview-section" style="margin-top:20px">${renderTeamOverview()}</div>`:''}
  </div>`;
}

// ─── MY TASKS (any logged-in person, staff or owner) ─
function renderMyTasksSection(name){
  const log = D.taskLog||[];
  const todayStr = new Date().toISOString().split('T')[0];
  const mine = log.filter(t=>t.assignedTo===name);
  const overdue = mine.filter(t=>!t.status && t.dueDate<todayStr).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  const today = mine.filter(t=>!t.status && t.dueDate===todayStr);
  const doneToday = mine.filter(t=>t.status && t.dueDate===todayStr);

  const taskRow = (t, isOverdue)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--surface2)">
      <input type="checkbox" onclick="_openCompleteTask('${t.id}')" style="width:18px;height:18px;cursor:pointer;flex-shrink:0">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--navy)">${t.taskName}</div>
        <div style="font-size:11px;color:${isOverdue?'var(--red)':'var(--text3)'}">${isOverdue?'⚠️ Overdue since '+fmtDate(t.dueDate):'Due today'}</div>
      </div>
    </div>`;

  return `<div class="card">
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">📋 My Tasks — ${name}</div>
    ${overdue.length?`<div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--red);margin-bottom:4px">⚠️ Overdue (${overdue.length})</div>
      ${overdue.map(t=>taskRow(t,true)).join('')}
    </div>`:''}
    <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:4px">Today</div>
    ${today.length?today.map(t=>taskRow(t,false)).join(''):'<div style="font-size:12px;color:var(--text3);font-style:italic;padding:10px 0">Nothing pending for today 🎉</div>'}
    ${doneToday.length?`<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:700;color:var(--green);margin-bottom:4px">✓ Completed today (${doneToday.length})</div>
      ${doneToday.map(t=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;font-size:12px;color:var(--text2)">
        <span style="text-decoration:line-through">${t.taskName}</span>
        <button onclick="reopenTask('${t.id}')" style="background:none;border:none;color:var(--text3);font-size:11px;cursor:pointer">Undo</button>
      </div>`).join('')}
    </div>`:''}
  </div>`;
}

function _openCompleteTask(logId){
  const t = (D.taskLog||[]).find(x=>x.id===logId); if(!t) return;
  const notes = prompt('Mark "'+t.taskName+'" as done.\nHandover note (optional — leave blank if none):','');
  if(notes===null) { renderTasksTab(); return; } // cancelled — re-render to uncheck the box
  completeTask(logId, notes);
}

// ─── TEAM OVERVIEW (Super Admin) ──────────────────────
function renderTeamOverview(){
  const log = D.taskLog||[];
  const todayStr = new Date().toISOString().split('T')[0];
  const names = getAllAssignableNames();
  const perPerson = names.map(name=>{
    const mine = log.filter(t=>t.assignedTo===name);
    const overdue = mine.filter(t=>!t.status && t.dueDate<todayStr).length;
    const todayPending = mine.filter(t=>!t.status && t.dueDate===todayStr).length;
    const todayDone = mine.filter(t=>t.status && t.dueDate===todayStr).length;
    return {name, overdue, todayPending, todayDone};
  });

  const templates = D.taskTemplates||[];

  return `<div class="card" style="margin-bottom:16px">
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">👥 Team Overview — Today</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
      ${perPerson.map(p=>`<div style="border:1px solid var(--border);border-radius:var(--rs);padding:10px 12px">
        <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:6px">${p.name}</div>
        <div style="font-size:11px;color:${p.overdue?'var(--red)':'var(--text3)'}">⚠️ ${p.overdue} overdue</div>
        <div style="font-size:11px;color:var(--text3)">${p.todayPending} pending today</div>
        <div style="font-size:11px;color:var(--green)">✓ ${p.todayDone} done today</div>
      </div>`).join('')}
    </div>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em">🗂️ Task Templates (${templates.length})</div>
    </div>
    ${!templates.length?'<div style="font-size:12px;color:var(--text3);font-style:italic;padding:10px 0">No task templates yet — click "+ New Task Template" above to add your first recurring task.</div>':`
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="border-bottom:1px solid var(--border)">
        <th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:11px">Task</th>
        <th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:11px">Frequency</th>
        <th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:11px">Assigned To</th>
        <th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:11px">Schedule</th>
        <th></th>
      </tr></thead>
      <tbody>${templates.map(t=>`<tr style="border-bottom:1px solid var(--surface2)${t.active===false?';opacity:.45':''}">
        <td style="padding:6px 8px;font-weight:600">${t.name}</td>
        <td style="padding:6px 8px;text-transform:capitalize">${t.frequency}</td>
        <td style="padding:6px 8px">${t.assignedTo}</td>
        <td style="padding:6px 8px;color:var(--text3)">${t.frequency==='weekly'?(t.daysOfWeek||[]).join(', '):t.frequency==='monthly'?'Day '+t.dayOfMonth:'Every day'}</td>
        <td style="padding:6px 8px;text-align:right;white-space:nowrap">
          <button onclick="openTaskTemplateModal('${t.id}')" style="background:none;border:none;color:var(--navy);cursor:pointer;font-size:12px" title="Edit">✏️</button>
          <button onclick="toggleTaskTemplateActive('${t.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px" title="${t.active===false?'Reactivate':'Pause'}">${t.active===false?'▶️':'⏸️'}</button>
          <button onclick="deleteTaskTemplate('${t.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:12px" title="Delete">🗑️</button>
        </td>
      </tr>`).join('')}</tbody>
    </table>`}
  </div>`;
}

// ─── TASK TEMPLATE CRUD (Super Admin) ──────────────────
function openTaskTemplateModal(id){
  const t = id ? (D.taskTemplates||[]).find(x=>x.id===id) : null;
  const names = getAllAssignableNames();
  let modal = document.getElementById('modal-task-template');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-task-template'; document.body.appendChild(modal); }
  modal.innerHTML = `<div class="mbox" style="max-width:480px">
    <div class="mhdr"><h2>${t?'Edit':'New'} Task Template</h2><button class="mx" onclick="CM('modal-task-template')">✕</button></div>
    <div class="fg"><label>Task Name</label><input type="text" id="tt-name" value="${t?.name||''}" placeholder="e.g. Tally, Cheque Pending"></div>
    <div class="fg"><label>Assigned To</label>
      <select id="tt-assigned">${names.map(n=>`<option value="${n}" ${t?.assignedTo===n?'selected':''}>${n}</option>`).join('')}</select>
    </div>
    <div class="fg"><label>Frequency</label>
      <select id="tt-freq" onchange="_ttFreqChanged()">
        <option value="daily" ${t?.frequency==='daily'?'selected':''}>Daily</option>
        <option value="weekly" ${t?.frequency==='weekly'?'selected':''}>Weekly</option>
        <option value="monthly" ${t?.frequency==='monthly'?'selected':''}>Monthly</option>
      </select>
    </div>
    <div class="fg" id="tt-weekly-wrap" style="display:${t?.frequency==='weekly'?'block':'none'}">
      <label>Day(s) of Week (select one or more)</label>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${DAY_NAMES.filter(d=>d!=='Sunday').map(d=>`<label style="display:flex;align-items:center;gap:4px;font-size:12px;background:var(--surface2);padding:4px 10px;border-radius:14px;cursor:pointer">
          <input type="checkbox" class="tt-dow" value="${d}" ${(t?.daysOfWeek||[]).includes(d)?'checked':''}> ${d.substring(0,3)}
        </label>`).join('')}
      </div>
    </div>
    <div class="fg" id="tt-monthly-wrap" style="display:${t?.frequency==='monthly'?'block':'none'}">
      <label>Day of Month (1–31)</label>
      <input type="number" id="tt-dom" min="1" max="31" value="${t?.dayOfMonth||''}" placeholder="e.g. 17">
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn" onclick="CM('modal-task-template')">Cancel</button>
      <button class="btn btn-navy" onclick="saveTaskTemplateFromModal('${t?.id||''}')">✓ Save</button>
    </div>
  </div>`;
  modal.classList.add('open');
}
function _ttFreqChanged(){
  const freq = document.getElementById('tt-freq')?.value;
  document.getElementById('tt-weekly-wrap').style.display = freq==='weekly'?'block':'none';
  document.getElementById('tt-monthly-wrap').style.display = freq==='monthly'?'block':'none';
}
async function saveTaskTemplateFromModal(existingId){
  const name = document.getElementById('tt-name')?.value.trim();
  if(!name){ toast('Enter a task name','error'); return; }
  const assignedTo = document.getElementById('tt-assigned')?.value;
  const frequency = document.getElementById('tt-freq')?.value;
  const daysOfWeek = Array.from(document.querySelectorAll('.tt-dow:checked')).map(el=>el.value);
  const dayOfMonth = parseInt(document.getElementById('tt-dom')?.value)||null;
  if(frequency==='weekly' && !daysOfWeek.length){ toast('Select at least one day of the week','error'); return; }
  if(frequency==='monthly' && !dayOfMonth){ toast('Enter a day of month','error'); return; }

  if(!D.taskTemplates) D.taskTemplates=[];
  if(existingId){
    const t = D.taskTemplates.find(x=>x.id===existingId);
    if(t) Object.assign(t, {name, assignedTo, frequency, daysOfWeek, dayOfMonth});
  } else {
    D.taskTemplates.push({id:'tmpl_'+uid(), name, assignedTo, frequency, daysOfWeek, dayOfMonth, active:true, createdAt:new Date().toISOString()});
  }
  try{
    await saveTaskTemplates();
    await generateTodaysTasks();
    CM('modal-task-template');
    renderTasksTab();
    toast('✓ Task template saved','ok');
  }catch(e){ toast('Save failed — try again','error'); }
}
async function toggleTaskTemplateActive(id){
  const t = (D.taskTemplates||[]).find(x=>x.id===id); if(!t) return;
  t.active = t.active===false ? true : false;
  try{ await saveTaskTemplates(); renderTasksTab(); }
  catch(e){ t.active = !t.active; toast('Save failed','error'); }
}
async function deleteTaskTemplate(id){
  const t = (D.taskTemplates||[]).find(x=>x.id===id); if(!t) return;
  const ok = await showConfirm({title:'Delete Task Template?',message:'This stops future occurrences of "'+t.name+'" from being generated. Past completed/pending entries in the log are kept.',confirmLabel:'Yes, Delete'});
  if(!ok) return;
  const backup = [...D.taskTemplates];
  D.taskTemplates = D.taskTemplates.filter(x=>x.id!==id);
  try{ await saveTaskTemplates(); renderTasksTab(); toast('✓ Template deleted','ok'); }
  catch(e){ D.taskTemplates = backup; toast('Save failed','error'); }
}
