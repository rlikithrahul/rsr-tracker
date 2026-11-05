// ═══════════════════════════════════════════════════════
// chequeprint.js — Cheque Printing (Super Admin)
// One layout engine for ANY bank's cheque: every field (date boxes, payee, amount in
// words, amount in figures, A/C Payee crossing, "or Bearer" strike) has a position in
// millimetres that is calibrated once per cheque design and saved as a "layout".
// Output is exact-size: browser print of an SVG page set to the cheque size, or a PDF
// with the page set to the cheque size. Nothing here touches existing app data: it only
// writes two NEW settings keys (layouts, print history).
// ═══════════════════════════════════════════════════════

const CHQ_PROFILES_KEY = 'rsr_cheque_profiles_v1';
const CHQ_LOG_KEY      = 'rsr_cheque_log_v1';
const CHQ_PT = 0.352778;           // 1 pt in mm

const CHQ_CROSSINGS = {
  none:      { label:'Cash / Bearer — no crossing',            lines:[] },
  acpayee:   { label:'Account Payee',                          lines:['A/C PAYEE'] },
  acpayeeo:  { label:'Account Payee Only',                     lines:['A/C PAYEE ONLY'] },
  acpayeenn: { label:'Account Payee – Not Negotiable',         lines:['A/C PAYEE ONLY','NOT NEGOTIABLE'] },
  andco:     { label:'& Co. (general crossing)',               lines:['& CO.'] }
};

// ───────── number → Indian words ─────────
const _CHQ_ONES = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const _CHQ_TENS = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
function _chqBelow1000(n){
  let s='';
  if(n>=100){ s+=_CHQ_ONES[Math.floor(n/100)]+' Hundred'; n%=100; if(n) s+=' '; }
  if(n>=20){ s+=_CHQ_TENS[Math.floor(n/10)]; n%=10; if(n) s+=' '+_CHQ_ONES[n]; }
  else if(n>0) s+=_CHQ_ONES[n];
  return s;
}
function _chqWholeWords(n){            // n integer 0 .. 9,99,99,99,999
  if(n===0) return 'Zero';
  const parts=[];
  const cr=Math.floor(n/10000000); n%=10000000;
  const lk=Math.floor(n/100000);   n%=100000;
  const th=Math.floor(n/1000);     n%=1000;
  if(cr) parts.push(_chqBelow1000(cr)+' Crore');
  if(lk) parts.push(_chqBelow1000(lk)+' Lakh');
  if(th) parts.push(_chqBelow1000(th)+' Thousand');
  if(n)  parts.push(_chqBelow1000(n));
  return parts.join(' ');
}
// returns {words, figures} or null when invalid.  amount is a number or numeric string.
function chqAmount(amount){
  const a = Number(String(amount).replace(/,/g,''));
  if(!isFinite(a) || a<=0 || a>=10000000000) return null;
  const total = Math.round(a*100);
  const rup = Math.floor(total/100), paise = total%100;
  let words;
  if(rup>0 && paise>0) words = 'Rupees '+_chqWholeWords(rup)+' and Paise '+_chqBelow1000(paise)+' Only';
  else if(rup>0)       words = 'Rupees '+_chqWholeWords(rup)+' Only';
  else                 words = 'Paise '+_chqBelow1000(paise)+' Only';
  // Indian digit grouping: 12,34,56,789
  let r=String(rup), last3=r.slice(-3), rest=r.slice(0,-3);
  if(rest) last3=','+last3;
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + last3;
  const figures = paise>0 ? grouped+'.'+String(paise).padStart(2,'0') : grouped+'/-';
  return {words, figures, rup, paise};
}

// ───────── layouts (profiles) ─────────
function chqNewProfile(name){
  return {
    id: (typeof uid==='function') ? uid() : Math.random().toString(36).slice(2),
    name: name || 'Standard cheque (202 × 92 mm)',
    w:202, h:92,
    mode:'cheque',            // 'cheque' = page is cheque-sized; 'a4' = cheque placed on an A4 sheet
    rotate:0,                 // 0 / 90 / 180 / 270 — how the cheque enters the printer
    a4x:0, a4y:0,             // position of the cheque's top-left corner on the A4 sheet (mm)
    offX:0, offY:0,           // overall shift for this printer (mm)
    dateStyle:'boxes',        // 'boxes' (DDMMYYYY into 8 boxes) or 'plain' (DD-MM-YYYY)
    datePitch:4.6,            // distance between date boxes (mm)
    fontSize:11,              // pt
    upper:true,               // print payee / words in capitals
    stars:true,               // **1,23,456/-**
    f:{
      date:  {x:151, y:12},
      payee: {x:30,  y:27, w:140},
      w1:    {x:30,  y:36, w:150},
      w2:    {x:12,  y:44, w:150},
      amt:   {x:160, y:47},
      cross: {x:10,  y:9,  w:42, h:9, angle:0},
      bearer:{x:140, y:27, w:25}
    },
    archived:false
  };
}

// ───────── layout engine: data → drawing primitives (mm / pt) ─────────
// measure(text, ptSize, bold) must return width in mm.
function chqLayout(P, d, measure){
  const items=[], warn=[];
  const F=P.f;
  let ox=(P.offX||0), oy=(P.offY||0);
  const T=(x,y,s,size,o)=>items.push(Object.assign({t:'text',x:x+ox,y:y+oy,s:s,size:size,bold:false,angle:0},o||{}));
  const L=(x1,y1,x2,y2,w)=>items.push({t:'line',x1:x1+ox,y1:y1+oy,x2:x2+ox,y2:y2+oy,w:w||0.35});
  const fs=P.fontSize||11;

  // date
  if(d.date){
    const [yy,mm,dd]=d.date.split('-');
    if(P.dateStyle==='boxes'){
      const digits=(dd+mm+yy).split(''), pitch=P.datePitch||4.6, dw=measure('0',fs,false);
      digits.forEach((c,i)=>T(F.date.x+i*pitch+(pitch-dw)/2, F.date.y, c, fs));
    } else T(F.date.x,F.date.y,dd+'-'+mm+'-'+yy,fs);
  }
  // payee
  if(d.payee){
    let s=P.upper?d.payee.toUpperCase():d.payee, size=fs;
    while(measure(s,size,false)>F.payee.w && size>7) size-=0.5;
    if(measure(s,size,false)>F.payee.w) warn.push('Payee name is too long for the payee line.');
    T(F.payee.x,F.payee.y,s,size);
  }
  // amount in words (wrap onto two lines) and figures
  const amt=chqAmount(d.amount);
  if(amt){
    let words=P.upper?amt.words.toUpperCase():amt.words, size=fs, lines;
    const wrap=(sz)=>{
      const ws=words.split(' '); const out=[]; let cur='', lim=[F.w1.w,F.w2.w], li=0;
      for(const w of ws){
        const t=cur?cur+' '+w:w;
        if(measure(t,sz,false)<=lim[li]) cur=t;
        else { out.push(cur); cur=w; li++; if(li>1) return null; if(measure(cur,sz,false)>lim[li]) return null; }
      }
      out.push(cur); return out;
    };
    lines=wrap(size);
    while(!lines && size>7){ size-=0.5; lines=wrap(size); }
    if(!lines){ warn.push('Amount in words does not fit — widen the words lines in the layout.'); lines=[words]; }
    T(F.w1.x,F.w1.y,lines[0],size);
    if(lines[1]) T(F.w2.x,F.w2.y,lines[1],size);
    const fig=(P.stars?'**':'')+amt.figures+(P.stars?'**':'');
    T(F.amt.x,F.amt.y,fig,fs+1,{bold:true});
  }
  // crossing: two parallel lines with the wording between them
  const cr=CHQ_CROSSINGS[d.crossing||'none'];
  if(cr && cr.lines.length){
    const c=F.cross, a=(c.angle||0)*Math.PI/180, cos=Math.cos(a), sin=Math.sin(a);
    const rot=(dx,dy)=>[c.x+dx*cos+dy*sin, c.y-dx*sin+dy*cos];   // ccw visual rotation about (c.x,c.y)
    let p1=rot(0,0), p2=rot(c.w,0), p3=rot(0,c.h), p4=rot(c.w,c.h);
    L(p1[0],p1[1],p2[0],p2[1],0.5); L(p3[0],p3[1],p4[0],p4[1],0.5);
    const n=cr.lines.length, sz=n>1?6.5:8;
    cr.lines.forEach((txt,i)=>{
      const tw=measure(txt,sz,true);
      const cy=(c.h/(n+1))*(i+1)+sz*CHQ_PT*0.35;
      const q=rot((c.w-tw)/2, cy);
      T(q[0],q[1],txt,sz,{bold:true,angle:c.angle||0,raw:true});
    });
  }
  // strike out the printed "or Bearer"
  if(d.strikeBearer){ const b=F.bearer; L(b.x,b.y-1.3,b.x+b.w,b.y-1.3,0.45); }
  // calibration test: outline + cross-hairs at every field anchor
  if(d.test){
    items.push({t:'rect',x:0+ox,y:0+oy,w:P.w,h:P.h});
    if(d.grid){   // millimetre ruler along the top and left edges + a 10 mm grid with labels
      for(let mm=0; mm<=P.w; mm++){ const len=mm%10===0?4:(mm%5===0?2.5:1.3); L(mm,0,mm,len,mm%10===0?0.25:0.12); }
      for(let mm=0; mm<=P.h; mm++){ const len=mm%10===0?4:(mm%5===0?2.5:1.3); L(0,mm,len,mm,mm%10===0?0.25:0.12); }
      for(let mm=10; mm<P.w; mm+=10){ L(mm,0,mm,P.h,0.06); T(mm+0.6,7,String(mm),5,{}); }
      for(let mm=10; mm<P.h; mm+=10){ L(0,mm,P.w,mm,0.06); T(5,mm-0.6,String(mm),5,{}); }
    }
    Object.keys(F).forEach(k=>{ const p=F[k]; L(p.x-2,p.y,p.x+2,p.y,0.15); L(p.x,p.y-2,p.x,p.y+2,0.15); T(p.x+2.5,p.y-1.2,k,5,{}); });
  }
  return {items, warn, amt};
}

// page geometry after mode/rotation
function chqPage(P){
  if(P.mode==='a4') return {PW:210, PH:297, rot:0, sx:P.a4x||0, sy:P.a4y||0};
  const r=((P.rotate||0)%360+360)%360;
  return (r===90||r===270) ? {PW:P.h, PH:P.w, rot:r, sx:0, sy:0} : {PW:P.w, PH:P.h, rot:r, sx:0, sy:0};
}
function _chqTx(pg,P,x,y){   // cheque coords → page coords
  x+=pg.sx; y+=pg.sy;
  switch(pg.rot){ case 90: return [P.h-y, x]; case 180: return [P.w-x, P.h-y]; case 270: return [y, P.w-x]; default: return [x,y]; }
}

// canvas-based text measure (Arial ≈ Helvetica metrics used by the PDF)
let _chqCtx=null;
function chqMeasure(s,pt,bold){
  if(!_chqCtx) _chqCtx=document.createElement('canvas').getContext('2d');
  _chqCtx.font=(bold?'bold ':'')+'100px Arial, Helvetica, sans-serif';
  return _chqCtx.measureText(s).width/100*pt*CHQ_PT;
}

// ───────── renderers ─────────
function chqSvg(P, d, opts){
  opts=opts||{};
  const pg=chqPage(P), lay=chqLayout(P,d,chqMeasure), esc=_chqE;
  let body='';
  lay.items.forEach(it=>{
    if(it.t==='line'){ const a=_chqTx(pg,P,it.x1,it.y1), b=_chqTx(pg,P,it.x2,it.y2); body+=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#000" stroke-width="${it.w}"/>`; }
    else if(it.t==='rect'){ const a=_chqTx(pg,P,it.x,it.y), b=_chqTx(pg,P,it.x+it.w,it.y+it.h); body+=`<rect x="${Math.min(a[0],b[0])}" y="${Math.min(a[1],b[1])}" width="${Math.abs(b[0]-a[0])}" height="${Math.abs(b[1]-a[1])}" fill="none" stroke="#000" stroke-width="0.2" stroke-dasharray="1.5 1"/>`; }
    else { const a=_chqTx(pg,P,it.x,it.y), ang=(it.angle||0)-pg.rot; body+=`<text x="${a[0]}" y="${a[1]}" font-size="${it.size*CHQ_PT}" font-family="Arial, Helvetica, sans-serif" font-weight="${it.bold?'bold':'normal'}"${ang?` transform="rotate(${-ang} ${a[0]} ${a[1]})"`:''}>${esc(it.s)}</text>`; }
  });
  let bg='';
  if(opts.bg && pg.rot===0 && P.mode!=='a4') bg=`<image href="${opts.bg}" x="0" y="0" width="${P.w}" height="${P.h}" preserveAspectRatio="none" opacity="0.9"/>`;
  else if(opts.paper) bg=`<rect x="0" y="0" width="${pg.PW}" height="${pg.PH}" fill="#fff" stroke="#bbb" stroke-width="0.3"/>`;
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pg.PW} ${pg.PH}" width="${opts.pxW||pg.PW+'mm'}" ${opts.pxW?'':`height="${pg.PH}mm"`} style="display:block;max-width:100%;height:auto">${bg}${body}${opts.extra||''}</svg>`, lay, pg};
}

function chqPdfDraw(doc,P,d){
  const pg=chqPage(P), lay=chqLayout(P,d,chqMeasure);
  lay.items.forEach(it=>{
    if(it.t==='line'){ const a=_chqTx(pg,P,it.x1,it.y1), b=_chqTx(pg,P,it.x2,it.y2); doc.setLineWidth(it.w); doc.line(a[0],a[1],b[0],b[1]); }
    else if(it.t==='rect'){ const a=_chqTx(pg,P,it.x,it.y), b=_chqTx(pg,P,it.x+it.w,it.y+it.h); doc.setLineWidth(0.2); doc.setLineDashPattern([1.5,1],0); doc.rect(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1])); doc.setLineDashPattern([],0); }
    else { const a=_chqTx(pg,P,it.x,it.y); doc.setFont('helvetica',it.bold?'bold':'normal'); doc.setFontSize(it.size); doc.text(it.s,a[0],a[1],{angle:(it.angle||0)-pg.rot}); }
  });
}
// one cheque per page; list = array of cheque data objects
function chqPdfMulti(P, list){
  const pg=chqPage(P), J=(window.jspdf&&window.jspdf.jsPDF)||window.jsPDF, ori=pg.PW>pg.PH?'l':'p';
  const doc=new J({unit:'mm', format:[pg.PW,pg.PH], orientation:ori, compress:true});
  list.forEach((d,i)=>{ if(i>0) doc.addPage([pg.PW,pg.PH],ori); chqPdfDraw(doc,P,d); });
  return doc;
}
function chqPdf(P, d){ return chqPdfMulti(P,[d]); }

function chqPrintSvg(P,d){ chqPrintSvgMulti(P,[d]); }
function chqPrintSvgMulti(P,list){
  const pg=chqPage(P);
  const pages=list.map(d=>`<div class="pg">${chqSvg(P,d,{}).svg}</div>`).join('');
  const f=document.createElement('iframe'); f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  const w=f.contentWindow.document; w.open();
  w.write(`<!doctype html><html><head><meta charset="utf-8"><title>Cheque</title><style>@page{size:${pg.PW}mm ${pg.PH}mm;margin:0}html,body{margin:0;padding:0}.pg{width:${pg.PW}mm;height:${pg.PH}mm;overflow:hidden;page-break-after:always;break-after:page}.pg:last-child{page-break-after:auto;break-after:auto}svg{display:block;width:${pg.PW}mm!important;height:${pg.PH}mm!important;max-width:none!important}</style></head><body>${pages}</body></html>`);
  w.close();
  setTimeout(()=>{ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ toast('Print failed: '+e.message,'error'); } setTimeout(()=>f.remove(),60000); },300);
}

// ───────── state / storage ─────────
let CHQ = { loaded:false, profiles:[], log:[], pid:null, tab:'print', calib:false, d:null, bg:{}, dirty:false, histq:'' };
function _chqE(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function _chqToday(){ const t=new Date(); return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); }
function _chqProfile(){ return CHQ.profiles.find(p=>p.id===CHQ.pid) || CHQ.profiles.filter(p=>!p.archived)[0]; }

async function chqLoad(){
  CHQ.profiles = (await getSetting(CHQ_PROFILES_KEY,[])) || [];
  CHQ.log      = (await getSetting(CHQ_LOG_KEY,[])) || [];
  if(!CHQ.profiles.length){ CHQ.profiles=[chqNewProfile()]; await mergeAndSaveSetting(CHQ_PROFILES_KEY, CHQ.profiles, true); }
  if(!CHQ.pid || !CHQ.profiles.find(p=>p.id===CHQ.pid)) CHQ.pid=CHQ.profiles.filter(p=>!p.archived)[0].id;
  if(!CHQ.d) CHQ.d={date:_chqToday(), payee:'', amount:'', crossing:'acpayee', strikeBearer:true, chqNo:'', memo:''};
  try{ CHQ.bg=JSON.parse(localStorage.getItem('rsr_cheque_bg')||'{}'); }catch(e){ CHQ.bg={}; }
  CHQ.loaded=true;
}
async function chqSaveProfiles(){
  try{ CHQ.profiles = await mergeAndSaveSetting(CHQ_PROFILES_KEY, CHQ.profiles, true); CHQ.dirty=false; toast('Layout saved','ok'); }
  catch(e){ toast('Could not save: '+e.message,'error'); }
}
async function chqAddLog(entry){
  CHQ.log.push(entry);
  try{ CHQ.log = await mergeAndSaveSetting(CHQ_LOG_KEY, CHQ.log, true); }catch(e){ toast('Printed, but the history entry could not be saved: '+e.message,'error'); }
}

// ───────── main page ─────────
async function renderChequePrint(){
  const el=document.getElementById('sec-cheque'); if(!el) return;
  if(!(CU&&CU.isSuperAdmin)){ el.innerHTML='<div class="wrap"><div class="card" style="padding:20px">Cheque printing is available to Super Admin only.</div></div>'; return; }
  el.innerHTML='<div class="wrap"><div style="padding:40px;text-align:center;color:var(--text3)">⏳ Loading…</div></div>';
  try{ if(!CHQ.loaded) await chqLoad(); }catch(e){ el.innerHTML='<div class="wrap"><div class="card" style="padding:20px;color:#c0392b">Could not load cheque settings: '+_chqE(e.message)+'</div></div>'; return; }
  _chqDraw();
}
function _chqDraw(){
  const el=document.getElementById('sec-cheque'); if(!el) return;
  const tabs=[['print','🖨️ Print cheque'],['batch','📚 Batch'],['layout','📐 Layouts & alignment'],['history','📜 History']];
  el.innerHTML=`<div class="wrap">
    <div style="font-size:18px;font-weight:700;margin-bottom:10px">🖨️ Cheque Printing</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${tabs.map(t=>`<button class="btn btn-sm${CHQ.tab===t[0]?' btn-primary':''}" onclick="CHQ.tab='${t[0]}';_chqDraw()">${t[1]}</button>`).join('')}</div>
    <div id="chq-body"></div></div>`;
  ({print:_chqPrintTab, batch:_chqBatchTab, layout:_chqLayoutTab, history:_chqHistoryTab})[CHQ.tab]();
}
function _chqv(id){ const e=document.getElementById(id); return e?e.value:''; }

// ───────── print tab ─────────
function _chqPrintTab(){
  const P=_chqProfile(), d=CHQ.d, b=document.getElementById('chq-body');
  const names=[...new Set([...(D.contractors||[]).map(c=>c.name), ...CHQ.log.map(l=>l.payee)].filter(Boolean))].sort();
  b.innerHTML=`<div style="display:grid;grid-template-columns:minmax(300px,380px) 1fr;gap:14px;align-items:start" class="chq-grid">
   <div class="card" style="padding:14px">
    <label style="font-size:11px;font-weight:600">Cheque layout</label>
    <select id="chq-prof" onchange="CHQ.pid=this.value;_chqPrintTab()" style="width:100%;margin-bottom:10px">${CHQ.profiles.filter(p=>!p.archived).map(p=>`<option value="${_chqE(p.id)}"${p.id===CHQ.pid?' selected':''}>${_chqE(p.name)}</option>`).join('')}</select>
    <label style="font-size:11px;font-weight:600">Date on cheque</label>
    <input type="date" id="chq-date" value="${_chqE(d.date)}" oninput="_chqSync()" style="width:100%;margin-bottom:10px">
    <label style="font-size:11px;font-weight:600">Pay to (payee name)</label>
    <input id="chq-payee" list="chq-names" value="${_chqE(d.payee)}" oninput="_chqSync()" placeholder="Name exactly as the bank should read it" style="width:100%;margin-bottom:10px"><datalist id="chq-names">${names.map(n=>`<option value="${_chqE(n)}">`).join('')}</datalist>
    <label style="font-size:11px;font-weight:600">Amount (₹)</label>
    <input id="chq-amt" inputmode="decimal" value="${_chqE(d.amount)}" oninput="_chqSync()" placeholder="e.g. 1234500 or 1234500.50" style="width:100%;margin-bottom:4px;font-size:16px;font-weight:700">
    <div id="chq-words" style="font-size:12px;color:var(--text2);min-height:34px;margin-bottom:10px"></div>
    <label style="font-size:11px;font-weight:600">Crossing</label>
    <select id="chq-cross" onchange="_chqSync()" style="width:100%;margin-bottom:6px">${Object.keys(CHQ_CROSSINGS).map(k=>`<option value="${k}"${d.crossing===k?' selected':''}>${_chqE(CHQ_CROSSINGS[k].label)}</option>`).join('')}</select>
    <label style="font-size:12px;display:flex;gap:6px;align-items:center;margin-bottom:10px"><input type="checkbox" id="chq-strike" ${d.strikeBearer?'checked':''} onchange="_chqSync()"> Strike out “or Bearer”</label>
    <div style="border-top:1px solid var(--border);margin:6px 0 10px;padding-top:8px;font-size:11px;color:var(--text3)">Kept in history only — not printed on the cheque</div>
    <input id="chq-no" value="${_chqE(d.chqNo)}" oninput="_chqSync()" placeholder="Cheque number (optional)" style="width:100%;margin-bottom:6px">
    <input id="chq-memo" value="${_chqE(d.memo)}" oninput="_chqSync()" placeholder="Purpose / project / memo (optional)" style="width:100%;margin-bottom:12px">
    <div id="chq-warn" style="font-size:12px;color:#c0392b;margin-bottom:8px"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="chqDoPrint('print')">🖨️ Print</button><button class="btn" onclick="chqDoPrint('pdf')">⬇ PDF</button><button class="btn btn-sm" onclick="chqClear()">Clear</button></div>
   </div>
   <div><div class="card" style="padding:12px"><div style="font-size:11px;color:var(--text3);margin-bottom:6px">Preview (the blank paper is where the cheque goes; print shows only the ink)</div><div id="chq-prev"></div></div>
    <div style="font-size:12px;color:var(--text3);margin-top:8px;line-height:1.5">Printing tip: in the print window choose <b>Scale 100%</b> (not “fit to page”) and <b>Margins: None</b>. Do the first print on plain paper and hold it against a real cheque to check, then fix any shift in <b>Layouts &amp; alignment</b>.</div></div></div>
   <style>@media(max-width:760px){.chq-grid{grid-template-columns:1fr!important}}</style>`;
  _chqSync(true);
}
function _chqSync(skipRead){
  const d=CHQ.d;
  if(!skipRead){ d.date=_chqv('chq-date'); d.payee=_chqv('chq-payee'); d.amount=_chqv('chq-amt'); d.crossing=_chqv('chq-cross'); d.strikeBearer=document.getElementById('chq-strike').checked; d.chqNo=_chqv('chq-no'); d.memo=_chqv('chq-memo'); }
  const P=_chqProfile(), a=chqAmount(d.amount), w=document.getElementById('chq-words');
  if(w) w.innerHTML = a ? '<b>'+_chqE(a.words)+'</b><br>₹ '+_chqE(a.figures) : (d.amount?'<span style="color:#c0392b">Enter a valid amount greater than zero</span>':'');
  const r=chqSvg(P,d,{bg:CHQ.bg[P.id],paper:true});
  const pv=document.getElementById('chq-prev'); if(pv) pv.innerHTML=r.svg;
  const warns=[...r.lay.warn, ..._chqChecks(d)];
  const wb=document.getElementById('chq-warn'); if(wb) wb.innerHTML=warns.map(x=>'⚠️ '+_chqE(x)).join('<br>');
}
// sanity checks shown before printing
function _chqChecks(d){
  const out=[];
  if(d.date){ const dt=new Date(d.date+'T00:00:00'), now=new Date(); now.setHours(0,0,0,0);
    const age=(now-dt)/86400000; if(age>92) out.push('This date is more than 3 months old — banks treat the cheque as stale.');
    if(age<-92) out.push('Post-dated by more than 3 months.'); }
  if(d.payee && d.amount){ const a=chqAmount(d.amount);
    if(a && CHQ.log.some(l=>!l.void && l.payee.toLowerCase()===d.payee.trim().toLowerCase() && Math.abs(l.amount-Number(String(d.amount).replace(/,/g,'')))<0.005 && l.date===d.date)) out.push('A cheque with the same payee, amount and date was already printed — check History to avoid a duplicate.'); }
  return out;
}
function chqClear(){ CHQ.d={date:_chqToday(), payee:'', amount:'', crossing:'acpayee', strikeBearer:true, chqNo:'', memo:''}; _chqPrintTab(); }

async function chqDoPrint(how){
  const d=CHQ.d, P=_chqProfile(), a=chqAmount(d.amount);
  if(!d.date){ toast('Enter the cheque date','error'); return; }
  if(!d.payee.trim()){ toast('Enter the payee name','error'); return; }
  if(!a){ toast('Enter a valid amount','error'); return; }
  const lay=chqLayout(P,d,chqMeasure); if(lay.warn.length){ toast(lay.warn[0],'error'); return; }
  const warns=_chqChecks(d);
  const msg='Print this cheque?\n\nPay: '+d.payee.trim()+'\nAmount: ₹ '+a.figures+'\n'+a.words+'\nDate: '+d.date.split('-').reverse().join('-')+'\nCrossing: '+CHQ_CROSSINGS[d.crossing].label+(warns.length?'\n\n⚠️ '+warns.join('\n⚠️ '):'');
  if(!confirm(msg)) return;
  const entry={ id:(typeof uid==='function'?uid():Date.now().toString()), at:new Date().toISOString(), by:(CU&&CU.name)||'', date:d.date, payee:d.payee.trim(), amount:Number(String(d.amount).replace(/,/g,'')), crossing:d.crossing, strikeBearer:!!d.strikeBearer, chqNo:d.chqNo||'', memo:d.memo||'', layout:P.name, how:how, void:false };
  if(how==='pdf'){
    const doc=chqPdf(P,d); doc.save('Cheque_'+d.payee.trim().replace(/[^a-z0-9]+/gi,'_').slice(0,30)+'_'+d.date+'.pdf');
  } else chqPrintSvg(P,d);
  await chqAddLog(entry);
  toast('Sent to print — logged in History','ok');
}

// ───────── layouts & alignment tab ─────────
const _CHQ_FIELDS=[['date','Date (first box)'],['payee','Payee line'],['w1','Words – line 1'],['w2','Words – line 2'],['amt','Amount figures'],['cross','Crossing box'],['bearer',"“or Bearer” strike"]];
function _chqLayoutTab(){
  const P=_chqProfile(), b=document.getElementById('chq-body');
  const sample={date:_chqToday(), payee:'SAMPLE PAYEE NAME', amount:'1234567.50', crossing:'acpayeenn', strikeBearer:true, test:true};
  const nm=(k,fld,step,lbl)=>`<input type="number" step="${step}" value="${P.f[k][fld]!=null?P.f[k][fld]:''}" oninput="chqSetF('${k}','${fld}',this.value)" style="width:64px">`;
  b.innerHTML=`<div style="display:grid;grid-template-columns:minmax(300px,420px) 1fr;gap:14px;align-items:start" class="chq-grid">
   <div class="card" style="padding:14px;font-size:12px">
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap"><select onchange="CHQ.pid=this.value;_chqLayoutTab()" style="flex:1;min-width:160px">${CHQ.profiles.filter(p=>!p.archived).map(p=>`<option value="${_chqE(p.id)}"${p.id===P.id?' selected':''}>${_chqE(p.name)}</option>`).join('')}</select><button class="btn btn-sm" onclick="chqNewLayout(false)">+ New</button><button class="btn btn-sm" onclick="chqNewLayout(true)">Copy</button><button class="btn btn-sm" onclick="chqArchive()">Remove</button></div>
    <label>Layout name (e.g. “SBI cheque book”, “HDFC”)</label><input value="${_chqE(P.name)}" oninput="chqSetP('name',this.value)" style="width:100%;margin-bottom:8px">
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><label>Cheque width mm<br><input type="number" step="0.5" value="${P.w}" oninput="chqSetP('w',+this.value)" style="width:78px"></label><label>Height mm<br><input type="number" step="0.5" value="${P.h}" oninput="chqSetP('h',+this.value)" style="width:78px"></label><label>Font pt<br><input type="number" step="0.5" value="${P.fontSize}" oninput="chqSetP('fontSize',+this.value)" style="width:64px"></label></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><label>Date style<br><select onchange="chqSetP('dateStyle',this.value)"><option value="boxes"${P.dateStyle==='boxes'?' selected':''}>8 boxes DDMMYYYY</option><option value="plain"${P.dateStyle==='plain'?' selected':''}>DD-MM-YYYY in one line (above/outside the boxes)</option></select></label><label>Box spacing mm<br><input type="number" step="0.1" value="${P.datePitch}" oninput="chqSetP('datePitch',+this.value)" style="width:70px"></label></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><label>Paper in printer<br><select onchange="chqSetP('mode',this.value);_chqLayoutTab()"><option value="cheque"${P.mode==='cheque'?' selected':''}>Cheque-sized page</option><option value="a4"${P.mode==='a4'?' selected':''}>A4 sheet (cheque placed on it)</option></select></label>
     ${P.mode==='a4'?`<label>Cheque at X mm<br><input type="number" step="0.5" value="${P.a4x}" oninput="chqSetP('a4x',+this.value)" style="width:64px"></label><label>Y mm<br><input type="number" step="0.5" value="${P.a4y}" oninput="chqSetP('a4y',+this.value)" style="width:64px"></label>`:`<label>Feeds into printer<br><select onchange="chqSetP('rotate',+this.value)">${[0,90,180,270].map(r=>`<option value="${r}"${P.rotate===r?' selected':''}>${r===0?'Normal (landscape)':'Rotated '+r+'°'}</option>`).join('')}</select></label>`}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><label>Shift all → X mm<br><input type="number" step="0.1" value="${P.offX}" oninput="chqSetP('offX',+this.value)" style="width:64px"></label><label>↓ Y mm<br><input type="number" step="0.1" value="${P.offY}" oninput="chqSetP('offY',+this.value)" style="width:64px"></label>
     <label style="display:flex;gap:4px;align-items:end"><input type="checkbox" ${P.upper?'checked':''} onchange="chqSetP('upper',this.checked)"> CAPITALS</label><label style="display:flex;gap:4px;align-items:end"><input type="checkbox" ${P.stars?'checked':''} onchange="chqSetP('stars',this.checked)"> **stars**</label></div>
    <table class="tbl" style="width:100%;font-size:12px;margin-bottom:8px"><thead><tr><th style="text-align:left">Field</th><th>X mm</th><th>Y mm</th><th>Width</th></tr></thead><tbody>
     ${_CHQ_FIELDS.map(([k,l])=>`<tr><td>${l}</td><td>${nm(k,'x',0.1)}</td><td>${nm(k,'y',0.1)}</td><td>${P.f[k].w!=null?nm(k,'w',0.5):''}</td></tr>`).join('')}
     <tr><td>Crossing height / angle°</td><td>${nm('cross','h',0.5)}</td><td>${nm('cross','angle',1)}</td><td></td></tr></tbody></table>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="chqSaveProfiles()">💾 Save layout</button><button class="btn" onclick="chqTestPrint(false)">Print alignment test</button><button class="btn" onclick="chqTestPrint(true)">Print grid + mm ruler</button></div>
    <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px"><b>Overlay a real cheque for aligning</b><div style="color:var(--text3);margin:4px 0">Scan or photograph the blank cheque flat and upload it: it appears behind the preview at true size so you can drag each field into place.</div>
     <input type="file" accept="image/*" onchange="chqBg(this)"> ${CHQ.bg[P.id]?'<button class="btn btn-sm" onclick="chqBgClear()">Remove image</button>':''}</div>
   </div>
   <div><div class="card" style="padding:12px"><label style="font-size:12px;display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" ${CHQ.calib?'checked':''} onchange="CHQ.calib=this.checked;_chqLayoutPreview()"> Drag mode: drag the blue dots to move each field</label><div id="chq-lp"></div></div>
    <div style="font-size:12px;color:var(--text3);margin-top:8px;line-height:1.5">How to set up a new bank's cheque: (1) enter the cheque size, (2) upload a scan of a blank cheque, (3) drag the dots onto the right places, (4) press <b>Print alignment test</b> on plain paper and hold it over a real cheque against a window, (5) nudge with the X/Y boxes, then <b>Save layout</b>. Do this once per cheque design; after that, printing is one click.</div></div></div>
   <style>@media(max-width:760px){.chq-grid{grid-template-columns:1fr!important}}</style>`;
  _chqLayoutPreview();
}
function chqSetP(k,v){ const P=_chqProfile(); P[k]=v; CHQ.dirty=true; _chqLayoutPreview(); }
function chqSetF(k,f,v){ const P=_chqProfile(); const n=parseFloat(v); if(!isFinite(n)) return; P.f[k][f]=n; CHQ.dirty=true; _chqLayoutPreview(); }
function _chqLayoutPreview(){
  const P=_chqProfile(); const el=document.getElementById('chq-lp'); if(!el) return;
  const d={date:_chqToday(), payee:'SAMPLE PAYEE NAME', amount:'1234567.50', crossing:'acpayeenn', strikeBearer:true, test:true};
  let extra='';
  if(CHQ.calib && P.mode!=='a4' && !P.rotate){
    Object.keys(P.f).forEach(k=>{ const p=P.f[k]; extra+=`<circle data-k="${k}" cx="${p.x+(P.offX||0)}" cy="${p.y+(P.offY||0)}" r="2.2" fill="#2563eb" fill-opacity="0.55" stroke="#fff" stroke-width="0.4" style="cursor:grab;touch-action:none"/>`; });
  }
  const r=chqSvg(P,d,{bg:CHQ.bg[P.id],paper:true,extra});
  el.innerHTML=r.svg;
  const svg=el.querySelector('svg'); if(!svg) return;
  svg.querySelectorAll('circle[data-k]').forEach(c=>{
    c.addEventListener('pointerdown',ev=>{ ev.preventDefault(); c.setPointerCapture(ev.pointerId); const k=c.dataset.k;
      const mv=e2=>{ const m=svg.getScreenCTM().inverse(); const pt=svg.createSVGPoint(); pt.x=e2.clientX; pt.y=e2.clientY; const q=pt.matrixTransform(m);
        P.f[k].x=Math.round((q.x-(P.offX||0))*10)/10; P.f[k].y=Math.round((q.y-(P.offY||0))*10)/10; c.setAttribute('cx',q.x); c.setAttribute('cy',q.y); CHQ.dirty=true; };
      const up=()=>{ c.removeEventListener('pointermove',mv); c.removeEventListener('pointerup',up); _chqLayoutTab(); };
      c.addEventListener('pointermove',mv); c.addEventListener('pointerup',up); });
  });
}
function chqTestPrint(grid){ const P=_chqProfile(); chqPrintSvg(P,{date:_chqToday(), payee:'SAMPLE PAYEE NAME', amount:'1234567.50', crossing:'acpayeenn', strikeBearer:true, test:true, grid:!!grid}); }
function chqNewLayout(copy){
  const base=_chqProfile(); const n=chqNewProfile(copy?base.name+' (copy)':'New cheque layout');
  if(copy){ Object.assign(n,JSON.parse(JSON.stringify(base)),{id:n.id,name:n.name,archived:false}); }
  CHQ.profiles.push(n); CHQ.pid=n.id; CHQ.dirty=true; chqSaveProfiles().then(()=>_chqLayoutTab());
}
function chqArchive(){
  const act=CHQ.profiles.filter(p=>!p.archived); if(act.length<=1){ toast('Keep at least one layout','error'); return; }
  const P=_chqProfile(); if(!confirm('Remove layout “'+P.name+'”? (It is hidden, not erased.)')) return;
  P.archived=true; CHQ.pid=CHQ.profiles.filter(p=>!p.archived)[0].id; chqSaveProfiles().then(()=>_chqLayoutTab());
}
function chqBg(inp){
  const f=inp.files&&inp.files[0]; if(!f) return; const P=_chqProfile(); const rd=new FileReader();
  rd.onload=()=>{ const im=new Image(); im.onload=()=>{ const s=Math.min(1,1600/im.width), c=document.createElement('canvas'); c.width=im.width*s; c.height=im.height*s; c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      CHQ.bg[P.id]=c.toDataURL('image/jpeg',0.8); try{ localStorage.setItem('rsr_cheque_bg',JSON.stringify(CHQ.bg)); }catch(e){ toast('Image is shown now but too large to remember on this browser','error'); } _chqLayoutTab(); }; im.src=rd.result; };
  rd.readAsDataURL(f);
}
function chqBgClear(){ const P=_chqProfile(); delete CHQ.bg[P.id]; try{ localStorage.setItem('rsr_cheque_bg',JSON.stringify(CHQ.bg)); }catch(e){} _chqLayoutTab(); }

// ───────── history tab ─────────
function _chqHistoryTab(){
  const b=document.getElementById('chq-body'); const q=(CHQ.histq||'').toLowerCase();
  const rows=CHQ.log.slice().sort((a,c)=>c.at<a.at?-1:1).filter(l=>!q||(l.payee+' '+l.memo+' '+l.chqNo).toLowerCase().includes(q));
  const tot=rows.filter(l=>!l.void).reduce((s,l)=>s+l.amount,0);
  b.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><input placeholder="Search payee / memo / cheque no…" value="${_chqE(CHQ.histq)}" oninput="CHQ.histq=this.value;_chqHistoryTab()" style="min-width:240px"><span style="font-size:12px;color:var(--text3)">${rows.length} entries · total (excluding void) ₹ ${tot.toLocaleString('en-IN')}</span></div>
   <div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>Printed</th><th>Cheque date</th><th>Payee</th><th style="text-align:right">Amount</th><th>Crossing</th><th>No.</th><th>Memo</th><th>By</th><th></th></tr></thead><tbody>
   ${rows.map(l=>`<tr style="${l.void?'opacity:.5;text-decoration:line-through':''}"><td>${new Date(l.at).toLocaleString('en-IN')}</td><td>${_chqE(l.date.split('-').reverse().join('-'))}</td><td>${_chqE(l.payee)}</td><td style="text-align:right">${l.amount.toLocaleString('en-IN',{minimumFractionDigits:2})}</td><td>${_chqE((CHQ_CROSSINGS[l.crossing]||{}).label||'')}</td><td>${_chqE(l.chqNo)}</td><td>${_chqE(l.memo)}</td><td>${_chqE(l.by)}</td><td style="white-space:nowrap"><button class="btn btn-sm" onclick="chqReuse('${_chqE(l.id)}')">Reprint</button> <button class="btn btn-sm" onclick="chqVoid('${_chqE(l.id)}')">${l.void?'Un-void':'Void'}</button></td></tr>`).join('')||'<tr><td colspan="9" style="padding:16px;color:var(--text3)">Nothing printed yet.</td></tr>'}</tbody></table></div>
   <div style="font-size:12px;color:var(--text3);margin-top:8px">“Void” is for a cheque that was spoilt or cancelled: it stays in the list (struck through) so the record is complete. Entries are never deleted.</div>`;
}
function chqReuse(id){ const l=CHQ.log.find(x=>x.id===id); if(!l) return; CHQ.d={date:l.date,payee:l.payee,amount:String(l.amount),crossing:l.crossing,strikeBearer:l.strikeBearer,chqNo:'',memo:l.memo}; CHQ.tab='print'; _chqDraw(); }
async function chqVoid(id){ const l=CHQ.log.find(x=>x.id===id); if(!l) return; l.void=!l.void; try{ CHQ.log=await mergeAndSaveSetting(CHQ_LOG_KEY,CHQ.log,true); }catch(e){ toast('Could not save: '+e.message,'error'); } _chqHistoryTab(); }

// ───────── batch tab ─────────
function _chqBatchRows(){ if(!CHQ.batch) CHQ.batch=[]; return CHQ.batch; }
function _chqBatchTab(){
  const P=_chqProfile(), rows=_chqBatchRows(), b=document.getElementById('chq-body');
  const names=[...new Set([...(D.contractors||[]).map(c=>c.name), ...CHQ.log.map(l=>l.payee)].filter(Boolean))].sort();
  b.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px;font-size:12px">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:8px">
     <label>Layout<br><select onchange="CHQ.pid=this.value">${CHQ.profiles.filter(p=>!p.archived).map(p=>`<option value="${_chqE(p.id)}"${p.id===P.id?' selected':''}>${_chqE(p.name)}</option>`).join('')}</select></label>
     <label>Date for all<br><input type="date" id="cb-date" value="${_chqToday()}"></label>
     <label>Crossing for all<br><select id="cb-cross">${Object.keys(CHQ_CROSSINGS).map(k=>`<option value="${k}"${k==='acpayee'?' selected':''}>${_chqE(CHQ_CROSSINGS[k].label)}</option>`).join('')}</select></label>
     <label style="display:flex;gap:4px;align-items:center"><input type="checkbox" id="cb-strike" checked> Strike “or Bearer”</label></div>
    <div style="margin-bottom:6px"><b>Paste from Excel:</b> two columns — payee, then amount (optionally a third column for memo)</div>
    <textarea id="cb-paste" rows="4" placeholder="U G NOOKARAJU&#9;250000&#10;SIRIKI SATYANARAYANA&#9;175000.50" style="width:100%;font-family:monospace"></textarea>
    <div style="margin-top:6px"><button class="btn btn-sm" onclick="chqBatchPaste()">Add pasted rows</button> <button class="btn btn-sm" onclick="chqBatchAdd()">+ Add one row</button> <button class="btn btn-sm" onclick="CHQ.batch=[];_chqBatchTab()">Clear all</button></div></div>
   <datalist id="cb-names">${names.map(n=>`<option value="${_chqE(n)}">`).join('')}</datalist>
   <div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th>#</th><th style="text-align:left">Payee</th><th>Amount</th><th style="text-align:left">Amount in words</th><th>Memo</th><th></th></tr></thead><tbody>
   ${rows.map((r,i)=>{ const a=chqAmount(r.amount); return `<tr><td>${i+1}</td><td><input list="cb-names" value="${_chqE(r.payee)}" oninput="CHQ.batch[${i}].payee=this.value" style="width:100%;min-width:180px"></td><td><input value="${_chqE(r.amount)}" oninput="CHQ.batch[${i}].amount=this.value;_chqBatchWords(${i},this)" style="width:110px;text-align:right"></td><td id="cbw-${i}" style="color:${a?'inherit':'#c0392b'}">${a?_chqE(a.words):'invalid amount'}</td><td><input value="${_chqE(r.memo||'')}" oninput="CHQ.batch[${i}].memo=this.value" style="width:140px"></td><td><button class="btn btn-sm" onclick="CHQ.batch.splice(${i},1);_chqBatchTab()">✕</button></td></tr>`; }).join('')||'<tr><td colspan="6" style="padding:16px;color:var(--text3)">No rows yet — paste from Excel or add a row.</td></tr>'}</tbody></table></div>
   <div id="cb-sum" style="margin:10px 0;font-size:13px;font-weight:600"></div>
   <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="chqBatchGo('print')">🖨️ Print all (one cheque per page)</button><button class="btn" onclick="chqBatchGo('pdf')">⬇ PDF of all</button></div>
   <div style="font-size:12px;color:var(--text3);margin-top:8px">Each cheque prints on its own page in the order shown. Load one cheque at a time unless your printer feeds several automatically. Every cheque is added to History.</div>`;
  _chqBatchSum();
}
function _chqBatchWords(i,inp){ const a=chqAmount(inp.value), e=document.getElementById('cbw-'+i); if(e){ e.textContent=a?a.words:'invalid amount'; e.style.color=a?'inherit':'#c0392b'; } _chqBatchSum(); }
function _chqBatchSum(){ const e=document.getElementById('cb-sum'); if(!e) return; const rows=_chqBatchRows(); const tot=rows.reduce((s,r)=>{const a=chqAmount(r.amount);return s+(a?a.rup+a.paise/100:0);},0); e.textContent=rows.length+' cheques · total ₹ '+tot.toLocaleString('en-IN',{minimumFractionDigits:2}); }
function chqBatchAdd(){ _chqBatchRows().push({payee:'',amount:'',memo:''}); _chqBatchTab(); }
function chqBatchPaste(){
  const t=_chqv('cb-paste'); const rows=_chqBatchRows(); let n=0;
  t.split(/\r?\n/).forEach(line=>{ if(!line.trim()) return; const c=line.split('\t'); if(c.length<2){ const m=line.match(/^(.*\S)\s+([\d,]+(?:\.\d+)?)\s*$/); if(m) c.splice(0,1,m[1],m[2]); }
    if(c.length>=2){ rows.push({payee:c[0].trim(),amount:c[1].trim().replace(/,/g,''),memo:(c[2]||'').trim()}); n++; } });
  if(!n) toast('Nothing recognised — use: payee, TAB, amount','error'); _chqBatchTab();
}
async function chqBatchGo(how){
  const P=_chqProfile(), rows=_chqBatchRows(); if(!rows.length){ toast('Add some rows first','error'); return; }
  const date=_chqv('cb-date'), crossing=_chqv('cb-cross'), strike=document.getElementById('cb-strike').checked;
  if(!date){ toast('Choose the date','error'); return; }
  const list=[], entries=[];
  for(let i=0;i<rows.length;i++){ const r=rows[i];
    if(!r.payee.trim()){ toast('Row '+(i+1)+': payee is empty','error'); return; }
    const a=chqAmount(r.amount); if(!a){ toast('Row '+(i+1)+': invalid amount','error'); return; }
    const d={date,payee:r.payee.trim(),amount:r.amount,crossing,strikeBearer:strike,chqNo:'',memo:r.memo||''};
    const lay=chqLayout(P,d,chqMeasure); if(lay.warn.length){ toast('Row '+(i+1)+': '+lay.warn[0],'error'); return; }
    list.push(d);
    entries.push({ id:(typeof uid==='function'?uid():Date.now().toString())+i, at:new Date().toISOString(), by:(CU&&CU.name)||'', date, payee:d.payee, amount:Number(String(r.amount).replace(/,/g,'')), crossing, strikeBearer:strike, chqNo:'', memo:d.memo, layout:P.name, how:how+'-batch', void:false });
  }
  const dup=list.filter(d=>_chqChecks(d).some(w=>w.startsWith('A cheque with the same'))).map(d=>d.payee);
  const tot=entries.reduce((s,e)=>s+e.amount,0);
  const msg='Print '+list.length+' cheques?\nDate: '+date.split('-').reverse().join('-')+'\nCrossing: '+CHQ_CROSSINGS[crossing].label+'\nTotal: ₹ '+tot.toLocaleString('en-IN',{minimumFractionDigits:2})+'\n\n'+list.map((d,i)=>(i+1)+'. '+d.payee+' — '+d.amount).join('\n')+(dup.length?'\n\n⚠️ Possible duplicates already printed: '+dup.join(', '):'');
  if(!confirm(msg)) return;
  if(how==='pdf') chqPdfMulti(P,list).save('Cheques_batch_'+date+'.pdf'); else chqPrintSvgMulti(P,list);
  for(const e of entries) CHQ.log.push(e);
  try{ CHQ.log=await mergeAndSaveSetting(CHQ_LOG_KEY,CHQ.log,true); }catch(e){ toast('Printed, but history could not be saved: '+e.message,'error'); }
  toast('Sent to print — '+list.length+' cheques logged','ok');
}
