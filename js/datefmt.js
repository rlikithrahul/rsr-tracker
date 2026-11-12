// ═══════════════════════════════════════════════════════
// datefmt.js — one date style everywhere: "05 Nov 2026"
// The app's own code uses fmtDate()/fmtDateTime() (utils.js). This file is the safety net so a date can never appear in
// another style: it converts any date-looking text that reaches the screen, an Excel export, a PDF table or a print page
// (2026-11-05, 05-11-2026, 05/11/2026 → 05 Nov 2026). Inputs, date pickers and stored data are never touched.
// Anything new added to the app later is covered automatically.
// ═══════════════════════════════════════════════════════
(function(){
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const pad = n => String(n).padStart(2,'0');
  // preceded by something that is not part of a word/number, followed by the same
  const ISO = /(^|[^\w.\/-])(\d{4})-(\d{2})-(\d{2})(?![\w\/-]|:\d|\.\d)/g;
  const DMY = /(^|[^\w.\/-])(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?![\w\/-]|\.\d)/g;
  function fmtDatesInText(t){
    if(typeof t!=='string' || t.length<8) return t;
    return t.replace(ISO,(m,pre,y,mo,d)=>(+mo>=1&&+mo<=12&&+d>=1&&+d<=31)?pre+pad(d)+' '+MON[+mo-1]+' '+y:m)
            .replace(DMY,(m,pre,d,mo,y)=>(+mo>=1&&+mo<=12&&+d>=1&&+d<=31)?pre+pad(d)+' '+MON[+mo-1]+' '+y:m);
  }
  window.fmtDatesInText = fmtDatesInText;
  // for HTML strings (print pages): only the text between tags
  window.fmtDatesInHtml = function(h){ return typeof h!=='string' ? h : h.replace(/>([^<>]+)</g,(m,t)=>'>'+fmtDatesInText(t)+'<'); };

  // ── on screen ──
  const SKIP = new Set(['SCRIPT','STYLE','TEXTAREA','INPUT','SELECT','CODE','PRE','NOSCRIPT']);
  function skipEl(el){ for(let e=el; e && e.nodeType===1; e=e.parentElement){ if(SKIP.has(e.tagName) || e.isContentEditable || (e.hasAttribute&&e.hasAttribute('data-nodatefmt'))) return true; } return false; }
  function fixNode(n){
    if(!n) return;
    if(n.nodeType===3){ const v=n.nodeValue; if(v && v.length>=8){ const r=fmtDatesInText(v); if(r!==v && !skipEl(n.parentElement)) n.nodeValue=r; } return; }
    if(n.nodeType!==1 || SKIP.has(n.tagName)) return;
    const w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT,null); let t; const list=[]; while((t=w.nextNode())) list.push(t);
    list.forEach(fixNode);
  }
  let queue=new Set(), sched=false;
  function flush(){ sched=false; const q=[...queue]; queue.clear(); q.forEach(n=>{ try{ if(n.isConnected!==false) fixNode(n); }catch(e){} }); }
  function enqueue(n){ queue.add(n); if(!sched){ sched=true; (window.requestAnimationFrame||setTimeout)(flush); } }
  function start(){
    if(!document.body) return;
    fixNode(document.body);
    new MutationObserver(ms=>{ for(const m of ms){ if(m.type==='childList') m.addedNodes.forEach(enqueue); else if(m.type==='characterData') enqueue(m.target); } })
      .observe(document.body,{childList:true,subtree:true,characterData:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();

  // ── Excel exports ──
  try{
    if(window.XLSX && XLSX.utils){
      const fixCell = v => (typeof v==='string') ? fmtDatesInText(v) : v;
      const a2s = XLSX.utils.aoa_to_sheet;
      XLSX.utils.aoa_to_sheet = function(rows, o){ try{ rows = (rows||[]).map(r=>Array.isArray(r)?r.map(fixCell):r); }catch(e){} return a2s.call(this, rows, o); };
      const j2s = XLSX.utils.json_to_sheet;
      XLSX.utils.json_to_sheet = function(rows, o){ try{ rows = (rows||[]).map(r=>{ const x={}; Object.keys(r||{}).forEach(k=>x[k]=fixCell(r[k])); return x; }); }catch(e){} return j2s.call(this, rows, o); };
    }
  }catch(e){ console.warn('[datefmt] xlsx',e); }

  // ── PDF tables ──
  try{
    const API = window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API;
    if(API && API.autoTable){
      const o = API.autoTable;
      const fixRows = rows => Array.isArray(rows) ? rows.map(r=>Array.isArray(r)?r.map(c=>typeof c==='string'?fmtDatesInText(c):(c&&typeof c==='object'&&typeof c.content==='string'?Object.assign({},c,{content:fmtDatesInText(c.content)}):c)):r) : rows;
      API.autoTable = function(opts){ try{ if(opts && typeof opts==='object'){ opts = Object.assign({},opts); ['head','body','foot'].forEach(k=>{ if(opts[k]) opts[k]=fixRows(opts[k]); }); arguments[0]=opts; } }catch(e){} return o.apply(this, arguments); };
    }
  }catch(e){ console.warn('[datefmt] pdf',e); }
})();
