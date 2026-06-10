// ═══════════════════════════════════════════════════════
// letters.js — RSR Constructions Tracker
// Auto-generate application letters for:
//   - Work Experience Certificate (WEC)
//   - ASD Refund
//   - EMD / FSD Refund
// Generates and downloads a .docx file instantly
// Uses docx.js loaded from CDN
// ═══════════════════════════════════════════════════════

// Firm display names
const FIRM_NAMES = {
  'RSR Constructions':  'RSR CONSTRUCTIONS',
  'R Sadhu Rao':        'R. SADHU RAO',
  'R Likith Rahul':     'R. LIKITH RAHUL'
};

function getFirmName(p){
  return FIRM_NAMES[p.firm] || 'RSR CONSTRUCTIONS';
}

function fmtAmtWords(n){
  // Format as Indian currency string e.g. 13,10,000/-
  if(!n||n<=0) return '0/-';
  return Number(n).toLocaleString('en-IN') + '/-';
}

function todayFormatted(){
  return new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'});
}

// ─── LETTER MODAL ────────────────────────────────────
function openLetterModal(pid, defaultType){
  const p = GP(pid); if(!p) return;

  const hasASD = (p.asd||0) > 0;
  const hasEMDFSD = (p.emd||0) > 0 || (p.fsd||0) > 0;
  const hasJV = !!p.jvDate;
  const hasEA = !!(p.eaNumber||(p.docVault&&p.docVault.ea));

  let modal = document.getElementById('modal-letters');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'mov';
    modal.id = 'modal-letters';
    document.body.appendChild(modal);
  }

  const refNo = p.eaNumber||(p.docVault&&p.docVault.ea)||p.tender||'';
  const firmName = getFirmName(p);

  modal.innerHTML = `<div class="mbox" style="max-width:540px">
    <div class="mhdr">
      <h2>📄 Generate Letter</h2>
      <button class="mx" onclick="CM('modal-letters')">✕</button>
    </div>

    <div style="font-size:12px;color:var(--text2);margin-bottom:16px">
      Generate a ready-to-print application letter for <strong>${p.name.substring(0,60)}</strong>
    </div>

    <!-- Letter Type Selection -->
    <div class="fg">
      <label>Letter Type</label>
      <div style="display:flex;flex-direction:column;gap:8px">
        <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid var(--border);border-radius:var(--rs);cursor:pointer;font-size:13px" id="lt-wec-wrap">
          <input type="radio" name="letter-type" value="wec" id="lt-wec" onchange="updateLetterPreview('${pid}')" ${defaultType==='wec'||!defaultType?'checked':''} ${!hasEA?'disabled':''}>
          <div>
            <div style="font-weight:700;color:${hasEA?'var(--navy)':'var(--text3)'}">📜 Work Experience Certificate</div>
            <div style="font-size:11px;color:var(--text3)">${hasEA?'EA Number: '+(p.eaNumber||(p.docVault&&p.docVault.ea)||'—'):'⚠️ Requires EA number first'}</div>
          </div>
        </label>
        <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid var(--border);border-radius:var(--rs);cursor:pointer;font-size:13px" id="lt-asd-wrap">
          <input type="radio" name="letter-type" value="asd" id="lt-asd" onchange="updateLetterPreview('${pid}')" ${defaultType==='asd'?'checked':''} ${!hasASD||!hasEA?'disabled':''}>
          <div>
            <div style="font-weight:700;color:${hasASD&&hasEA?'var(--navy)':'var(--text3)'}">💵 ASD Refund Application</div>
            <div style="font-size:11px;color:var(--text3)">${!hasEA?'⚠️ Requires EA number':!hasASD?'⚠️ No ASD amount on record':'ASD: ₹'+Number(p.asd).toLocaleString('en-IN')}</div>
          </div>
        </label>
        <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid var(--border);border-radius:var(--rs);cursor:pointer;font-size:13px" id="lt-emdfsd-wrap">
          <input type="radio" name="letter-type" value="emd_fsd" id="lt-emdfsd" onchange="updateLetterPreview('${pid}')" ${defaultType==='emd_fsd'?'checked':''} ${!hasEMDFSD||!hasJV?'disabled':''}>
          <div>
            <div style="font-weight:700;color:${hasEMDFSD&&hasJV?'var(--navy)':'var(--text3)'}">🏦 EMD / FSD Refund Application</div>
            <div style="font-size:11px;color:var(--text3)">${!hasJV?'⚠️ Requires JV date':!hasEMDFSD?'⚠️ No EMD/FSD amounts':'EMD: ₹'+Number(p.emd||0).toLocaleString('en-IN')+' · FSD: ₹'+Number(p.fsd||0).toLocaleString('en-IN')}</div>
          </div>
        </label>
      </div>
    </div>

    <!-- Editable fields -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px">
      <div class="fg">
        <label>Firm Name</label>
        <input type="text" id="ltr-firm" value="${firmName}">
      </div>
      <div class="fg">
        <label>Reference / EA Number</label>
        <input type="text" id="ltr-ref" value="${refNo}">
      </div>
    </div>
    <div class="fg">
      <label>Name of Work</label>
      <textarea id="ltr-work" rows="2" style="width:100%;box-sizing:border-box;padding:8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:'Inter',sans-serif;font-size:13px;resize:vertical">${p.name}</textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="fg">
        <label>JV Amount (₹)</label>
        <input type="number" id="ltr-jv" value="${p.jvAmount||''}">
      </div>
      <div class="fg">
        <label>Date</label>
        <input type="text" id="ltr-date" value="${todayFormatted()}">
      </div>
    </div>

    <!-- Preview box -->
    <div id="ltr-preview" style="background:var(--surface2);border-radius:var(--rs);padding:14px;margin-top:12px;font-size:12px;line-height:1.8;font-family:'Times New Roman',serif;border-left:3px solid var(--navy)"></div>

    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn" onclick="CM('modal-letters')">Cancel</button>
      <button class="btn btn-navy" onclick="generateAndDownloadLetter('${pid}')">
        ⬇️ Download Letter (.docx)
      </button>
    </div>
  </div>`;

  modal.classList.add('open');
  setTimeout(()=>updateLetterPreview(pid), 100);
}

function updateLetterPreview(pid){
  const p = GP(pid); if(!p) return;
  const type = document.querySelector('input[name="letter-type"]:checked')?.value||'wec';
  const firmName = document.getElementById('ltr-firm')?.value||getFirmName(p);
  const refNo = document.getElementById('ltr-ref')?.value||'';
  const workName = document.getElementById('ltr-work')?.value||p.name;
  const jvAmt = document.getElementById('ltr-jv')?.value||p.jvAmount||0;
  const date = document.getElementById('ltr-date')?.value||todayFormatted();

  const prev = document.getElementById('ltr-preview');
  if(!prev) return;

  let subj='', body='';
  if(type==='wec'){
    subj = 'Sub:-- <u><strong>Experience certificate.</strong></u>';
    body = `I &nbsp;<strong>${firmName}</strong>&nbsp; successfully complete the above work. So, I am requesting You to please arrange Quantity wise experience certificate for the above work as early as Possible.`;
  } else if(type==='asd'){
    subj = 'Sub:-- <u><strong>Refund of Additional Security Deposit (ASD).</strong></u>';
    body = `I &nbsp;<strong>${firmName}</strong>&nbsp; have successfully completed the above work and the EA Number has been received. So, I am requesting You to please arrange the refund of ASD amount of <strong>Rs. ${fmtAmtWords(p.asd||0)}</strong> as early as Possible.`;
  } else if(type==='emd_fsd'){
    const total = (Number(p.emd||0))+(Number(p.fsd||0));
    subj = 'Sub:-- <u><strong>Refund of EMD and FSD deposits.</strong></u>';
    body = `I &nbsp;<strong>${firmName}</strong>&nbsp; have successfully completed the above work and it has been more than two years since the JV date of ${p.jvDate?fmtDate(p.jvDate):'—'}. So, I am requesting You to please arrange the refund of EMD <strong>Rs. ${fmtAmtWords(p.emd||0)}</strong> + FSD <strong>Rs. ${fmtAmtWords(p.fsd||0)}</strong> = Total <strong>Rs. ${fmtAmtWords(total)}</strong> as early as Possible.`;
  }

  prev.innerHTML = `<div style="text-align:right;margin-bottom:8px">Date: ${date}</div>
    <div>To,</div>
    <div>The Commissioner,</div>
    <div>G.V.M.C, Visakhapatnam.</div>
    <div style="margin-top:8px">&nbsp;&nbsp;&nbsp;&nbsp;Respected Sir / Madam,</div>
    <div style="margin-top:6px">&nbsp;&nbsp;&nbsp;&nbsp;${subj}</div>
    <div>&nbsp;&nbsp;&nbsp;&nbsp;Ref: - 1) <strong>${refNo}.</strong></div>
    <div style="margin-top:6px">&nbsp;&nbsp;&nbsp;&nbsp;<strong>NAME OF WORK-</strong> ${workName}</div>
    <div>&nbsp;&nbsp;&nbsp;&nbsp;<strong>JV AMOUNT:</strong> ${fmtAmtWords(jvAmt)}</div>
    <div style="margin-top:10px">&nbsp;&nbsp;&nbsp;&nbsp;${body}</div>
    <div style="margin-top:10px">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Thanking you,</div>
    <div style="text-align:right;margin-top:16px">Yours faithfully,</div>
    <div style="text-align:right;margin-top:24px"><strong>${firmName}</strong></div>`;
}

// ─── DOCX GENERATION (client-side) ───────────────────
async function generateAndDownloadLetter(pid){
  const p = GP(pid); if(!p) return;
  const type = document.querySelector('input[name="letter-type"]:checked')?.value||'wec';
  const firmName = document.getElementById('ltr-firm')?.value||getFirmName(p);
  const refNo = document.getElementById('ltr-ref')?.value||p.eaNumber||p.tender||'';
  const workName = document.getElementById('ltr-work')?.value||p.name;
  const jvAmt = parseFloat(document.getElementById('ltr-jv')?.value)||p.jvAmount||0;
  const date = document.getElementById('ltr-date')?.value||todayFormatted();

  // Load docx.js from CDN if not loaded
  if(typeof docx === 'undefined'){
    await new Promise((res,rej)=>{
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/docx/9.0.2/docx.umd.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  try{
    const { Document, Packer, Paragraph, TextRun, AlignmentType, UnderlineType } = docx;

    const font = 'Times New Roman';
    const sz = 24; // 12pt

    const br = () => new Paragraph({ children:[new TextRun({text:'',size:sz,font})] });
    const ln = (text, opts={}) => new Paragraph({
      alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { before: opts.before||0, after: opts.after||120 },
      children:[new TextRun({
        text, font, size:sz,
        bold: opts.bold||false,
        underline: opts.underline?{type:UnderlineType.SINGLE}:undefined
      })]
    });
    const mixed = (runs, opts={}) => new Paragraph({
      alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { before: opts.before||0, after: opts.after||120 },
      children: runs.map(r => new TextRun({
        text:r.text, font, size:sz,
        bold:r.bold||false,
        underline:r.underline?{type:UnderlineType.SINGLE}:undefined
      }))
    });

    // Letter-specific content
    let subjectRun, refRun, bodyText;
    let extraBodyParagraphs = [];
    let fileName = '';

    if(type==='wec'){
      subjectRun = [{text:'\t\tSub:-- ',bold:true},{text:'Experience certificate.',bold:true,underline:true}];
      refRun = [{text:'\t\tRef: - 1) ',bold:true},{text:refNo+'.',bold:true}];
      bodyText = `\t\tI  ${firmName}  successfully complete the above work.  So, I am requesting You to please arrange Quantity wise experience certificate for the above work as early as Possible.`;
      fileName = `WEC_Letter_${workName.substring(0,25).replace(/[^a-zA-Z0-9]/g,'_')}.docx`;
    } else if(type==='asd'){
      subjectRun = [{text:'\t\tSub:-- ',bold:true},{text:'Refund of Additional Security Deposit (ASD).',bold:true,underline:true}];
      refRun = [{text:'\t\tRef: - 1) ',bold:true},{text:refNo+'.',bold:true}];
      bodyText = `\t\tI  ${firmName}  have successfully completed the above work and the EA Number has been received.  So, I am requesting You to please arrange the refund of Additional Security Deposit (ASD) amount of Rs. ${fmtAmtWords(p.asd||0)}  for the above work as early as Possible.`;
      fileName = `ASD_Refund_${workName.substring(0,25).replace(/[^a-zA-Z0-9]/g,'_')}.docx`;
    } else {
      const total = (Number(p.emd||0))+(Number(p.fsd||0));
      subjectRun = [{text:'\t\tSub:-- ',bold:true},{text:'Refund of EMD and FSD deposits.',bold:true,underline:true}];
      refRun = [{text:'\t\tRef: - 1) ',bold:true},{text:refNo+'.',bold:true}];
      bodyText = `\t\tI  ${firmName}  have successfully completed the above work and it has been more than two years since the Joint Verification (JV) date of ${p.jvDate?fmtDate(p.jvDate):'—'}.  So, I am requesting You to please arrange the refund of the following deposits for the above work as early as Possible:`;
      extraBodyParagraphs = [
        `\t\tEMD Amount   :  Rs. ${fmtAmtWords(p.emd||0)}`,
        `\t\tFSD Amount   :  Rs. ${fmtAmtWords(p.fsd||0)}`,
        `\t\tTotal Amount :  Rs. ${fmtAmtWords(total)}`,
      ];
      fileName = `EMD_FSD_Refund_${workName.substring(0,25).replace(/[^a-zA-Z0-9]/g,'_')}.docx`;
    }

    const doc = new Document({
      sections:[{
        properties:{
          page:{
            size:{width:11906,height:16838},
            margin:{top:1440,right:1440,bottom:1440,left:1800}
          }
        },
        children:[
          // Date
          new Paragraph({alignment:AlignmentType.RIGHT,spacing:{after:240},children:[new TextRun({text:'Date: '+date,font,size:sz})]}),
          // Address
          ln('To '),
          ln('The Commissioner,'),
          ln('G.V.M.C,'),
          ln('Visakhapatnam.'),
          br(),
          ln('\t\tRespected Sir / Madam,'),
          br(),
          // Subject
          mixed(subjectRun,{after:80}),
          // Ref
          mixed(refRun,{after:160}),
          br(),
          // Work name + JV
          mixed([{text:'\t\tNAME OF WORK- ',bold:true},{text:workName,bold:true}],{after:80}),
          mixed([{text:'\t\tJV AMOUNT: ',bold:true},{text:fmtAmtWords(jvAmt),bold:true}],{after:240}),
          br(),
          // Body
          ln(bodyText,{after:160}),
          ...extraBodyParagraphs.map(t=>ln(t,{after:120})),
          br(),
          ln('\t\t\t\t\t\tThanking you,',{after:80}),
          br(), br(),
          new Paragraph({alignment:AlignmentType.RIGHT,spacing:{after:80},children:[new TextRun({text:'Yours faithfully,',font,size:sz})]}),
          br(), br(), br(),
          new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:firmName,font,size:sz,bold:true})]})
        ]
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    const blob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    logActivity({category:'project',action:'letter_generated',projectId:pid,projectName:p.name,description:(CU?CU.name:'Admin')+' generated '+type.toUpperCase()+' letter for '+p.name});
    CM('modal-letters');
    toast('✓ Letter downloaded — '+fileName,'ok');
    if(typeof haptic==='function') haptic('success');

  }catch(err){
    console.error('Letter generation failed:', err);
    toast('Letter generation failed: '+err.message,'error');
  }
}
