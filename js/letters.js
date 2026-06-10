// ═══════════════════════════════════════════════════════
// letters.js — RSR Constructions Tracker
// Auto-generate application letters (WEC / ASD / EMD+FSD)
// Downloads as .docx — NO external CDN needed
// Pure browser-side DOCX generation via raw Office XML
// ═══════════════════════════════════════════════════════

const FIRM_DISPLAY = {
  'RSR Constructions': 'RSR CONSTRUCTIONS',
  'R Sadhu Rao':       'R. SADHU RAO',
  'R Likith Rahul':    'R. LIKITH RAHUL'
};

function getFirmDisplay(p){ return FIRM_DISPLAY[p.firm]||'RSR CONSTRUCTIONS'; }
function fmtINR(n){ if(!n||n<=0) return '0/-'; return Number(n).toLocaleString('en-IN')+'/-'; }
function todayLong(){ return new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'}); }

// ─── MODAL ────────────────────────────────────────────
function openLetterModal(pid, defaultType){
  const p = GP(pid); if(!p) return;
  const hasASD = (p.asd||0)>0;
  const hasEMDFSD = (p.emd||0)>0||(p.fsd||0)>0;
  const hasJV = !!p.jvDate;
  const hasEA = !!(p.eaNumber||(p.docVault&&p.docVault.ea));

  let modal = document.getElementById('modal-letters');
  if(!modal){ modal=document.createElement('div'); modal.className='mov'; modal.id='modal-letters'; document.body.appendChild(modal); }

  modal.innerHTML = `<div class="mbox" style="max-width:560px">
    <div class="mhdr"><h2>📄 Generate Letter</h2><button class="mx" onclick="CM('modal-letters')">✕</button></div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:14px">Auto-filled from project data. Edit any field before downloading.</div>

    <!-- Letter type -->
    <div class="fg" style="margin-bottom:12px">
      <label>Letter Type</label>
      <div style="display:flex;flex-direction:column;gap:7px">
        ${[
          {val:'wec', label:'📜 Work Experience Certificate', disabled:!hasEA, note: hasEA?'EA: '+(p.eaNumber||(p.docVault&&p.docVault.ea)):'⚠️ Needs EA number'},
          {val:'asd', label:'💵 ASD Refund Application', disabled:!hasASD||!hasEA, note:!hasEA?'⚠️ Needs EA number':!hasASD?'⚠️ No ASD amount':'ASD: ₹'+Number(p.asd).toLocaleString('en-IN')},
          {val:'emd_fsd', label:'🏦 EMD / FSD Refund Application', disabled:!hasEMDFSD||!hasJV, note:!hasJV?'⚠️ Needs JV date':!hasEMDFSD?'⚠️ No EMD/FSD amounts':'EMD: ₹'+Number(p.emd||0).toLocaleString('en-IN')+' · FSD: ₹'+Number(p.fsd||0).toLocaleString('en-IN')}
        ].map(t=>`<label style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--rs);cursor:pointer;opacity:${t.disabled?'0.5':'1'}">
          <input type="radio" name="ltr-type" value="${t.val}" onchange="updateLetterPreview('${pid}')" ${(defaultType||'wec')===t.val?'checked':''} ${t.disabled?'disabled':''}>
          <div><div style="font-weight:700;font-size:13px">${t.label}</div><div style="font-size:11px;color:var(--text3)">${t.note}</div></div>
        </label>`).join('')}
      </div>
    </div>

    <!-- Fields -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div class="fg"><label>Firm Name</label><input type="text" id="lf-firm" value="${getFirmDisplay(p)}" oninput="updateLetterPreview('${pid}')"></div>
      <div class="fg"><label>Date</label><input type="text" id="lf-date" value="${todayLong()}" oninput="updateLetterPreview('${pid}')"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
      <div class="fg"><label style="font-size:11px">EA / Accounts No.</label><input type="text" id="lf-ea" value="${p.eaNumber||(p.docVault&&p.docVault.ea)||''}" placeholder="—" oninput="updateLetterPreview('${pid}')"></div>
      <div class="fg"><label style="font-size:11px">Gen Code</label><input type="text" id="lf-gencode" value="${p.genCode||(p.docVault&&p.docVault.gencode)||''}" placeholder="—" oninput="updateLetterPreview('${pid}')"></div>
      <div class="fg"><label style="font-size:11px">Tender ID</label><input type="text" id="lf-tender" value="${p.tender||''}" placeholder="—" oninput="updateLetterPreview('${pid}')"></div>
    </div>
    <div class="fg" style="margin-bottom:10px"><label>Name of Work</label>
      <textarea id="lf-work" rows="2" style="width:100%;box-sizing:border-box;padding:8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px;resize:vertical" oninput="updateLetterPreview('${pid}')">${p.name}</textarea>
    </div>
    <div class="fg"><label>JV Amount (₹)</label><input type="number" id="lf-jv" value="${p.jvAmount||''}" oninput="updateLetterPreview('${pid}')"></div>

    <!-- Preview -->
    <div style="background:#fffef0;border:1px solid #e5e0c0;border-radius:var(--rs);padding:16px;margin-top:14px;font-family:'Times New Roman',serif;font-size:13px;line-height:1.9;max-height:320px;overflow-y:auto" id="ltr-preview"></div>

    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;align-items:center;flex-wrap:wrap">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;margin-right:auto;padding:8px 12px;background:var(--surface2);border-radius:var(--rs);border:1px solid var(--border)">
        <input type="checkbox" id="lf-letterhead" onchange="updateLetterPreview('${pid}')" style="width:16px;height:16px;cursor:pointer">
        <span>🖨️ Printing on letterhead <span style="font-size:11px;color:var(--text3)">(adds top space)</span></span>
      </label>
      <button class="btn" onclick="CM('modal-letters')">Cancel</button>
      <button class="btn btn-navy" onclick="downloadLetter('${pid}')">⬇️ Download .docx</button>
    </div>
  </div>`;

  modal.classList.add('open');
  setTimeout(()=>updateLetterPreview(pid), 100);
}

// ─── LIVE PREVIEW ─────────────────────────────────────
function updateLetterPreview(pid){
  const p = GP(pid); if(!p) return;
  const type = document.querySelector('input[name="ltr-type"]:checked')?.value||'wec';
  const firm = document.getElementById('lf-firm')?.value||'';
  const date = document.getElementById('lf-date')?.value||'';
  const ea = document.getElementById('lf-ea')?.value||'';
  const gc = document.getElementById('lf-gencode')?.value||'';
  const tid = document.getElementById('lf-tender')?.value||'';
  const work = document.getElementById('lf-work')?.value||'';
  const jv = document.getElementById('lf-jv')?.value||'';

  const refs = [];
  if(ea) refs.push('EA / Accounts No: '+ea);
  if(gc) refs.push('Gen Code: '+gc);
  if(tid) refs.push('Tender ID: '+tid);

  let subject='', body='';
  if(type==='wec'){
    subject='<u><b>Experience certificate.</b></u>';
    body=`I &nbsp;<b>${firm}</b>&nbsp; successfully complete the above work. So, I am requesting You to please arrange Quantity wise experience certificate for the above work as early as Possible.`;
  } else if(type==='asd'){
    subject='<u><b>Refund of Additional Security Deposit (ASD).</b></u>';
    body=`I &nbsp;<b>${firm}</b>&nbsp; have successfully completed the above work and the EA Number has been received. So, I am requesting You to please arrange the refund of ASD amount of <b>Rs. ${fmtINR(p.asd||0)}</b> for the above work as early as Possible.`;
  } else {
    const total=(Number(p.emd||0))+(Number(p.fsd||0));
    subject='<u><b>Refund of EMD and FSD deposits.</b></u>';
    body=`I &nbsp;<b>${firm}</b>&nbsp; have successfully completed the above work and it has been more than two years since the JV date of ${p.jvDate?fmtDate(p.jvDate):'—'}. So, I am requesting You to please arrange the refund of EMD <b>Rs.${fmtINR(p.emd||0)}</b> + FSD <b>Rs.${fmtINR(p.fsd||0)}</b> = Total <b>Rs.${fmtINR(total)}</b> as early as Possible.`;
  }

  const letterhead = document.getElementById('lf-letterhead')?.checked||false;

  // Show letterhead space in preview
  const topNote = letterhead
    ? '<div style="border:1px dashed #aaa;text-align:center;color:#aaa;font-size:11px;padding:28px 0;margin-bottom:12px;font-family:sans-serif">[ Letterhead area — ~4cm ]</div>'
    : '';

  document.getElementById('ltr-preview').innerHTML = topNote +
    `<div style="text-align:right">${date}</div>
     <br>To,<br>The Commissioner,<br>G.V.M.C,<br>Visakhapatnam.
     <br><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Respected Sir / Madam,
     <br><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Sub:-- ${subject}
     ${refs.length?'<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'+refs.map((r,i)=>`<b>${i===0?'Ref: - ':'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}${i+1}) ${r}</b>`).join('<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'):''}
     <br><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>NAME OF WORK-</b> ${work}
     <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>JV AMOUNT: ${fmtINR(jv)}</b>
     <br><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${body}
     <br><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Thanking you,
     <br><br><div style="text-align:right">Yours faithfully,<br><br><br><b>${firm}</b></div>`;
}

// ─── DOCX GENERATOR (pure XML, no CDN) ───────────────
function downloadLetter(pid){
  const p = GP(pid); if(!p) return;
  const type = document.querySelector('input[name="ltr-type"]:checked')?.value||'wec';
  const firm = document.getElementById('lf-firm')?.value||getFirmDisplay(p);
  const date = document.getElementById('lf-date')?.value||todayLong();
  const ea   = document.getElementById('lf-ea')?.value||'';
  const gc   = document.getElementById('lf-gencode')?.value||'';
  const tid  = document.getElementById('lf-tender')?.value||'';
  const work = document.getElementById('lf-work')?.value||p.name;
  const jv   = parseFloat(document.getElementById('lf-jv')?.value)||p.jvAmount||0;

  // Build ref items — only non-empty
  const refs = [];
  if(ea) refs.push('EA / Accounts No: '+ea);
  if(gc) refs.push('Gen Code: '+gc);
  if(tid) refs.push('Tender ID: '+tid);

  // Body text per type
  let subject='', body='', extraLines=[], fileName='';
  if(type==='wec'){
    subject='Experience certificate.';
    body=`I  ${firm}  successfully complete the above work.  So, I am requesting You to please arrange Quantity wise experience certificate for the above work as early as Possible.`;
    fileName=`WEC_Letter_${work.substring(0,25).replace(/[^a-z0-9]/gi,'_')}.docx`;
  } else if(type==='asd'){
    subject='Refund of Additional Security Deposit (ASD).';
    body=`I  ${firm}  have successfully completed the above work and the EA Number has been received.  So, I am requesting You to please arrange the refund of Additional Security Deposit (ASD) amount of Rs. ${fmtINR(p.asd||0)}  for the above work as early as Possible.`;
    fileName=`ASD_Refund_${work.substring(0,25).replace(/[^a-z0-9]/gi,'_')}.docx`;
  } else {
    const total=(Number(p.emd||0))+(Number(p.fsd||0));
    subject='Refund of EMD and FSD deposits.';
    body=`I  ${firm}  have successfully completed the above work and it has been more than two years since the Joint Verification (JV) date of ${p.jvDate?fmtDate(p.jvDate):'—'}.  So, I am requesting You to please arrange the refund of the following deposits for the above work as early as Possible:`;
    extraLines=[`EMD Amount    :  Rs. ${fmtINR(p.emd||0)}`,`FSD Amount    :  Rs. ${fmtINR(p.fsd||0)}`,`Total Amount  :  Rs. ${fmtINR(total)}`];
    fileName=`EMD_FSD_Refund_${work.substring(0,25).replace(/[^a-z0-9]/gi,'_')}.docx`;
  }

  // Build XML paragraphs
  const letterhead = document.getElementById('lf-letterhead')?.checked||false;
  // 4cm = 2268 twips, normal = 1440 twips (1 inch)
  const topMargin = letterhead ? 2268 : 1440;

  const xml = buildLetterXML({ firm, date, refs, work, jv, subject, body, extraLines });
  const docx = buildDOCX(xml, topMargin);
  triggerDownload(docx, fileName);

  logActivity({category:'project',action:'letter_generated',projectId:pid,projectName:p.name,
    description:(CU?CU.name:'Admin')+' downloaded '+type.toUpperCase()+' letter for '+p.name});
  CM('modal-letters');
  toast('✓ Letter downloaded — '+fileName,'ok');
  if(typeof haptic==='function') haptic('success');
}

// ─── XML BUILDER ─────────────────────────────────────
function xmlEsc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function wPara(runs, spacing){
  // runs: [{text, bold, underline}]
  // spacing: {before, after} in twips (1 line ≈ 240)
  const sp = spacing||{before:0,after:100};
  const rXml = runs.map(r=>{
    const rPr = [
      '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>',
      '<w:sz w:val="24"/><w:szCs w:val="24"/>',
      r.bold?'<w:b/>':'',
      r.underline?'<w:u w:val="single"/>':''
    ].join('');
    return `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${xmlEsc(r.text)}</w:t></w:r>`;
  }).join('');
  return `<w:p><w:pPr><w:spacing w:before="${sp.before}" w:after="${sp.after}"/><w:jc w:val="left"/></w:pPr>${rXml}</w:p>`;
}

function wParaRight(text, bold, spacing){
  const sp = spacing||{before:0,after:100};
  return `<w:p><w:pPr><w:spacing w:before="${sp.before}" w:after="${sp.after}"/><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/>${bold?'<w:b/>':''}</w:rPr><w:t>${xmlEsc(text)}</w:t></w:r></w:p>`;
}

function wBlank(){ return `<w:p><w:pPr><w:spacing w:before="0" w:after="80"/></w:pPr></w:p>`; }

function buildLetterXML({firm, date, refs, work, jv, subject, body, extraLines}){
  const paras = [];

  // Date — right aligned
  paras.push(wParaRight(date, false, {before:0,after:160}));

  // To block
  paras.push(wPara([{text:'To '}],{before:0,after:60}));
  paras.push(wPara([{text:'The Commissioner,'}],{before:0,after:60}));
  paras.push(wPara([{text:'G.V.M.C,'}],{before:0,after:60}));
  paras.push(wPara([{text:'Visakhapatnam.'}],{before:0,after:160}));

  // Salutation
  paras.push(wPara([{text:'\t\tRespected Sir / Madam,'}],{before:0,after:160}));

  // Subject
  paras.push(wPara([
    {text:'\t\tSub:-- ', bold:true},
    {text:subject, bold:true, underline:true}
  ],{before:0,after:80}));

  // References — first ref with "Ref: -", rest indented
  if(refs.length > 0){
    refs.forEach((r,i)=>{
      if(i===0){
        paras.push(wPara([{text:'\t\tRef: - 1) '+r+'.',bold:true}],{before:0,after:i<refs.length-1?40:120}));
      } else {
        paras.push(wPara([{text:'\t\t\t\t'+(i+1)+') '+r+'.',bold:true}],{before:0,after:i<refs.length-1?40:120}));
      }
    });
  }

  paras.push(wBlank());

  // Work name + JV
  paras.push(wPara([{text:'\t\tNAME OF WORK- ',bold:true},{text:work,bold:true}],{before:0,after:80}));
  paras.push(wPara([{text:'\t\tJV AMOUNT: ',bold:true},{text:fmtINR(jv),bold:true}],{before:0,after:160}));

  paras.push(wBlank());

  // Body
  paras.push(wPara([{text:'\t\t'+body}],{before:0,after:extraLines.length?80:200}));
  extraLines.forEach(line=>paras.push(wPara([{text:'\t\t'+line}],{before:0,after:80})));

  paras.push(wBlank());

  // Thanking
  paras.push(wPara([{text:'\t\t\t\t\t\tThanking you,'}],{before:0,after:200}));

  // Sign off
  paras.push(wParaRight('Yours faithfully,',false,{before:0,after:320}));
  paras.push(wParaRight(firm,true,{before:0,after:0}));

  return paras.join('\n');
}

// ─── DOCX ZIP BUILDER (no library needed) ────────────
function buildDOCX(bodyXml, topMargin){
  const top = topMargin||1440;
  // 4cm top margin = 2268 twips (1cm = 567 twips)
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
${bodyXml}
<w:sectPr>
  <w:pgSz w:w="11906" w:h="16838"/>
  <w:pgMar w:top="${top}" w:right="1440" w:bottom="1440" w:left="1800"/>
</w:sectPr>
</w:body>
</w:document>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
      <w:sz w:val="24"/><w:szCs w:val="24"/>
      <w:lang w:val="en-IN"/>
    </w:rPr></w:rPrDefault>
  </w:docDefaults>
</w:styles>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  // Build ZIP manually using fflate or JSZip if available, else use simple ZIP
  return { docXml, relsXml, stylesXml, contentTypes, rootRels };
}

function triggerDownload(parts, fileName){
  // Use JSZip if available, otherwise load it
  function doZip(JSZip){
    const zip = new JSZip();
    zip.file('[Content_Types].xml', parts.contentTypes);
    zip.file('_rels/.rels', parts.rootRels);
    zip.file('word/document.xml', parts.docXml);
    zip.file('word/_rels/document.xml.rels', parts.relsXml);
    zip.file('word/styles.xml', parts.stylesXml);
    zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
      .then(blob=>{
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href=url; a.download=fileName;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
  }

  if(typeof JSZip !== 'undefined'){
    doZip(JSZip);
  } else {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = ()=>doZip(JSZip);
    s.onerror = ()=>toast('Download failed — check internet connection','error');
    document.head.appendChild(s);
  }
}
