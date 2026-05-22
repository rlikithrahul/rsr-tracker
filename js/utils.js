// ═══════════════════════════════════════
// utils.js
// RSR Constructions Tracker v17
// ═══════════════════════════════════════

// ═══════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════
function toast(msg,type='',dur=2800){
  const el=document.getElementById('toast');
  el.textContent=msg;
  el.style.background=type==='error'?'#c0392b':type==='ok'?'#1a7a3a':'#1a2744';
  el.style.opacity='1';el.style.transform='translateX(-50%) translateY(0)';
  setTimeout(()=>{el.style.opacity='0';el.style.transform='translateX(-50%) translateY(20px)';},dur);
}
function setBusy(v,msg){
  const b=document.getElementById('busy');
  if(msg) document.getElementById('busy-text').textContent=msg;
  if(v) b.classList.add('show'); else b.classList.remove('show');
}

const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
const pct = n => (Math.round(n*10)/10) + '%';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
function GP(id){ return D.projects.find(p=>p.id===id)||null; }
function GC(id){ return D.contractors.find(c=>c.id===id)||null; }
function agAmt(p){ return p.estimated*(1+p.bidPct/100); }
function maxF(p){ return agAmt(p)*0.7; }
function totRel(p){ return (p.releases||[]).reduce((s,r)=>s+r.amount,0); }
function verPct(p){
  // Based on RSR physical verification only — controls funding
  const lv=(p.verifications||[]).slice(-1)[0]; if(!lv) return 0;
  const tv=(p.boq||[]).reduce((s,i)=>s+i.qty*i.rate,0); if(!tv) return 0;
  return (p.boq||[]).reduce((s,i)=>s+(lv.items[i.id]||0)*i.rate,0)/tv*100;
}
function reportedPct(p){
  // Based on contractor-reported quantities (from reviewed updates) — for display only
  const tv=(p.boq||[]).reduce((s,i)=>s+i.qty*i.rate,0); if(!tv) return 0;
  return (p.boq||[]).reduce((s,i)=>s+((p.reportedItems||{})[i.id]||0)*i.rate,0)/tv*100;
}
function eligR(p){ return Math.min(verPct(p)/100*maxF(p),maxF(p)); }
function hdroom(p){ return Math.max(0,eligR(p)-totRel(p)); }
function pStat(p){
  const rel=totRel(p),max=maxF(p);
  if(!max) return 'green';
  const pct=rel/max;
  if(pct>=1.0) return 'overcap';
  if(pct>=0.85) return 'red';
  if(pct>=0.70) return 'orange';
  if(pct>=0.65) return 'caution3';
  if(pct>=0.60) return 'caution2';
  if(pct>=0.55) return 'caution1';
  return 'green';
}
function sBadge(s,p){
  const rel=p?totRel(p):0,max=p?maxF(p):0;
  const pct=max>0?rel/max:0;
  const pp=Math.round(pct*100);
  if(pct>=1.0) return `<span class="badge bg-red">🚨 Over Cap (${pp}%)</span>`;
  if(pct>=0.85) return `<span class="badge bg-red">🔴 High Risk (${pp}%)</span>`;
  if(pct>=0.70) return `<span class="badge bg-amber">🟠 Cap Reached (${pp}%)</span>`;
  if(pct>=0.65) return `<span class="badge bg-amber">🟡 Caution 3 (${pp}%)</span>`;
  if(pct>=0.60) return `<span class="badge bg-amber">🟡 Caution 2 (${pp}%)</span>`;
  if(pct>=0.55) return `<span class="badge bg-amber">🟡 Caution 1 (${pp}%)</span>`;
  return `<span class="badge bg-green">🟢 On Track (${pp}%)</span>`;
}
function capAlert(p){
  const rel=totRel(p),max=maxF(p);
  if(!max) return '';
  const pct=rel/max,pp=Math.round(pct*100);
  if(pct>=1.0) return `<div class="alert al-red">🚨 Over Cap — ${pp}% used. Coordinate with RSR immediately.</div>`;
  if(pct>=0.85) return `<div class="alert al-red">🔴 High Risk — ${pp}% used. RSR monitoring closely.</div>`;
  if(pct>=0.70) return `<div class="alert al-amber">🟠 70% Cap Reached — ${pp}% used. Only verified work can justify further funding.</div>`;
  if(pct>=0.65) return `<div class="alert al-amber">🟡 Caution 3 — ${pp}% used. Work progress must keep pace with funds.</div>`;
  if(pct>=0.60) return `<div class="alert al-amber">🟡 Caution 2 — ${pp}% used. Review work completion vs funds deployed.</div>`;
  if(pct>=0.55) return `<div class="alert al-amber">🟡 Caution 1 — ${pp}% used. Early warning — ensure site is on schedule.</div>`;
  return '';
}
function intr(p){
  return (p.releases||[]).reduce((s,r)=>{
    const d=Math.max(0,Math.round((Date.now()-new Date(r.date).getTime())/86400000));
    return s+r.amount*0.24*d/365;
  },0);
}
function togglePw(id,btn){
  const el=document.getElementById(id);
  el.type=el.type==='password'?'text':'password';
  btn.textContent=el.type==='password'?'👁️':'🙈';
}
function SP(id){ document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); document.getElementById(id).classList.add('active'); }
function OM(id){ if(id==='modal-np') initNP(); document.getElementById(id).classList.add('open'); }
function CM(id){ document.getElementById(id).classList.remove('open'); }
function showErr(msg){ const e=document.getElementById('lerr'); e.textContent=msg; e.style.display='block'; }
// ─── PROJECT STATUS ────────────────────────────────────
function projStatus(p){ return p.status || 'active'; }
function statusBadge(p){
  const s = projStatus(p);
  if(s==='completed') return '<span class="badge status-completed">✓ Completed</span>';
  if(s==='onhold')    return '<span class="badge status-onhold">⏸ On Hold</span>';
  return ''; // active = no badge, just use cap badge
}

// ─── INTEREST — fixed to use outstanding only ──────────
function intr(p){
  const settled = (p.settlements||[]).reduce((s,x)=>s+x.amount,0);
  // Use compounded principal if it exists
  const basePrincipal = p.compoundedPrincipal || 0;
  return (p.releases||[]).reduce((s,r)=>{
    const d = Math.max(0, Math.round((Date.now()-new Date(r.date).getTime())/86400000));
    return s + r.amount * 0.24 * d / 365;
  }, 0) - (settled * 0.24 * 1); // rough reduction for settled portion
}

// Better interest calc — only on outstanding balance
function intrOutstanding(p){
  const settled = (p.settlements||[]).reduce((s,x)=>s+x.amount,0);
  const outstanding = Math.max(0, totRel(p) - settled);
  if(!outstanding) return 0;
  // Find earliest unreleased date
  const releases = (p.releases||[]);
  if(!releases.length) return 0;
  const earliest = releases.reduce((min,r)=>r.date<min?r.date:min, releases[0].date);
  const days = Math.max(0, Math.round((Date.now()-new Date(earliest).getTime())/86400000));
  return outstanding * 0.24 * days / 365;
}
