// ═══════════════════════════════════════════════════════
// agreement.js — Subcontract Agreement (Word .docx) for a project
//
// Button on every project (next to File Sticker). Fills the approved agreement text from the project (work name, gen code,
// amount) and the contractor's "Agreement details" (Contractors → Edit): firm, who represents it, address.
// Three versions of the security clause: cheque table to fill in / cheques already held from an earlier agreement / no cheques.
// The text is the agreement approved on 18 Nov 2026; everything shown in the dialog can be edited before downloading.
// Uses the zip writer from filesticker.js (no library).
// ═══════════════════════════════════════════════════════

const SAG_FIRST = {
  'RSR Constructions': 'RSR CONSTRUCTIONS, represented by its Managing Partner Sri R. Sadhurao, S/o Sanyasi Naidu, having its office at Dwarakanagar, Visakhapatnam',
  'R Sadhu Rao': 'R SADHU RAO, having his office at 47-9-28, Mukunda Suvasa Apartment, 3rd Lane, Dwaraka Nagar, Visakhapatnam – 530016',
  'R Likith Rahul': 'R LIKITH RAHUL, having his office at 47-9-28, Mukunda Suvasa Apartment, 3rd Lane, Dwaraka Nagar, Visakhapatnam – 530016'
};
const _sagE = s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const _sagV = id=>((document.getElementById(id)||{}).value||'').trim();

function sagSecondDefault(c){
  const a = (c && c.agr) || {};
  const firm = (a.firm || (c&&c.name) || '').toUpperCase();
  if(!firm && !a.repName && !a.agrAddress) return '';
  const rep = a.repName ? ', represented by its '+String(a.designation||'proprietor').toLowerCase()+' '+a.repName+(a.fatherName?', '+a.fatherName:'') : '';
  return firm+rep+(a.agrAddress?', '+a.agrAddress:'');
}
function sagAmount(p){
  let v = Number(p.agreeAmt)||0;
  if(!(v>0)){ const bt=(p.boq||[]).reduce((s,x)=>s+(Number(x.amount)||0),0); if(bt>0) v = bt*(1+(Number(p.bidPct)||0)/100); }
  return v>0 ? String(Math.round(v)) : '';
}
function sagOrd(n){ const s=['th','st','nd','rd'], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }

// ─── text building ─────────────────────────────────────
function _sagRun(t, b, u){ return t===''?'':`<w:r>${(b||u)?`<w:rPr>${b?'<w:b/><w:bCs/>':''}${u?'<w:u w:val="single"/>':''}</w:rPr>`:''}<w:t xml:space="preserve">${_sagE(t)}</w:t></w:r>`; }
function _sagP(parts, o){
  o = o||{};
  const runs = (Array.isArray(parts)?parts:[parts]).map(x=>typeof x==='string'?_sagRun(x,o.b,o.u):_sagRun(x[0],x[1],x[2])).join('');
  return `<w:p><w:pPr>${o.keep?'<w:keepNext/>':''}${o.pb?'<w:pageBreakBefore/>':''}<w:jc w:val="${o.jc||'both'}"/></w:pPr>${runs}</w:p>`;
}
const _sagH = t=>_sagP(t,{b:true,keep:true});
function _sagCell(w, inner){ return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${inner}</w:tc>`; }
function _sagChequeTable(){
  const W=[850,1650,2800,1900,1826], bd=['top','left','bottom','right','insideH','insideV'].map(k=>`<w:${k} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('');
  const cell=(t,w,b)=>_sagCell(w, `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>${_sagRun(t,b)}</w:p>`);
  let t = `<w:tbl><w:tblPr><w:tblW w:w="9026" w:type="dxa"/><w:tblBorders>${bd}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${W.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
  t += '<w:tr><w:trPr><w:cantSplit/></w:trPr>'+['S.No','Cheque No.','Bank and Branch','Cheque Date','Amount (₹)'].map((h,i)=>cell(h,W[i],true)).join('')+'</w:tr>';
  for(let i=1;i<=4;i++) t += '<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="400"/></w:trPr>'+cell(String(i),W[0])+W.slice(1).map(w=>cell('',w)).join('')+'</w:tr>';
  return t+'</w:tbl>'+_sagP('');
}
function _sagBoldHead(text){   // bold everything before the first comma (the firm name)
  const i = text.indexOf(','); return i<0 ? [[text,true]] : [[text.slice(0,i),true], text.slice(i)];
}
function _sagSign(firstName, secondName){
  const W=[4513,4513], nb='<w:tblBorders>'+['top','left','bottom','right','insideH','insideV'].map(k=>`<w:${k} w:val="nil"/>`).join('')+'</w:tblBorders>';
  const row = (a,b)=>`<w:tr>${_sagCell(W[0],a)}${_sagCell(W[1],b)}</w:tr>`;
  const L = (t,b)=>`<w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>${_sagRun(t,b)}</w:p>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="9026" w:type="dxa"/>${nb}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${W[0]}"/><w:gridCol w:w="${W[1]}"/></w:tblGrid>`+
    row(L('FIRST PARTY / MAIN CONTRACTOR',true), L('SECOND PARTY / SUBCONTRACTOR',true))+
    row(L(firstName,true), L(secondName,true))+
    row(L('Represented by:'), L('Represented by:'))+
    row(L('')+L('Signature: ______________________'), L('')+L('Signature: ______________________'))+
    row(L('Date: __________________________'), L('Date: __________________________'))+'</w:tbl>';
}

function sagBodyXml(o){
  // o: {day,month,year, first, second, work, gen, amount, cheque:'table'|'held'|'none'}
  const X = [];
  const dateTxt = o.date ? `this ${sagOrd(o.date.d)} day of ${o.date.m}, ${o.date.y}` : 'this           day of                    , 202  ';
  const money = chqAmount(o.amount);
  for(let i=0;i<8;i++) X.push('<w:p/>');
  X.push(_sagP([['SUBCONTRACT AGREEMENT',true,true]],{jc:'center'}));
  X.push(_sagP(`This Subcontract Agreement is made and executed on ${dateTxt}, at Visakhapatnam.`));
  X.push(_sagP('BETWEEN',{b:true}));
  X.push(_sagP([..._sagBoldHead(o.first), '. hereinafter referred to as the “', ['First Party / Main Contractor',true], '”;']));
  X.push(_sagP('AND',{b:true,jc:'center'}));
  X.push(_sagP([..._sagBoldHead(o.second), '. hereinafter referred to as the “', ['Second Party / Subcontractor.',true], '”']));
  X.push(_sagH('1. NAME OF WORK'));
  X.push(_sagP([['“'+o.work+'.”',true], (o.gen?' Gencode '+o.gen+'   ':'   ')+'The First Party hereby entrusts the execution of the above work to the Second Party on subcontract basis, subject to the terms and conditions of this Agreement.']));
  X.push(_sagH('2. ESTIMATED CONTRACT AMOUNT'));
  X.push(_sagP(['The estimated value of the work is: ', [money ? '₹'+money.figures+' ('+money.words.replace(/ Only$/,' only')+').' : '₹ ____________________ (Rupees ______________________________ only).', true]]));
  X.push(_sagP('The final payment shall be based on the actual quantities of work executed, measured and accepted, at the agreed rates and subject to the applicable terms and conditions.'));
  X.push(_sagH('3. SCOPE OF WORK'));
  X.push(_sagP('The Second Party shall execute the work in accordance with the approved drawings, technical specifications, quantities, quality standards and instructions issued by the First Party/competent authority.'));
  X.push(_sagP('The Second Party shall arrange the necessary labour, supervision, tools, equipment and other resources required for the execution of the work, as mutually agreed.'));
  X.push(_sagP('The Second Party alone shall be responsible for the execution of the work in all respects, including the engagement and payment of labour, execution of the work, getting the measurements recorded in the Measurement Book, preparation and submission of bills, and all dealings with the Department in connection with the work, in the name of and on behalf of the First Party, at his own cost and risk.'));
  X.push(_sagH('4. PAYMENT TERMS'));
  X.push(_sagP('Payments shall be made to the Second Party against the work actually executed and measured/accepted.'));
  X.push(_sagP('The First Party shall make payments based on certified measurements and bills, Cement & Steel, after deduction of applicable taxes, statutory deductions, retention amounts and other recoveries'));
  X.push(_sagH('5. QUALITY OF WORK'));
  X.push(_sagP('The Second Party shall maintain the required quality of construction and shall execute the work strictly according to the approved specifications and instructions.'));
  X.push(_sagP('Any defective work attributable to the Second Party shall be rectified by the Second Party at his own cost, as required under the contract.'));
  X.push(_sagH('6. LABOUR AND SAFETY'));
  X.push(_sagP('The Second Party shall be responsible for the labour engaged by him and shall comply with applicable labour and safety requirements.'));
  X.push(_sagP('The Second Party shall take all reasonable safety precautions during execution of the work.'));
  X.push(_sagH('7. MATERIALS'));
  X.push(_sagP('The responsibility for procurement and supply of materials shall be as mutually agreed between the Parties.'));
  X.push(_sagP('Materials supplied by the First Party Providing Cement & Steel shall be properly utilized and safeguarded by the Second Party.'));
  X.push(_sagH('8. STATUTORY DEDUCTIONS'));
  X.push(_sagP('All applicable statutory deductions, taxes and other recoveries shall be made in accordance with applicable laws and the terms of the main contract.'));
  X.push(_sagH('9. TERMINATION'));
  X.push(_sagP('If the Second Party fails to maintain the required quality, progress or other contractual obligations, the First Party may issue written notice requiring the default to be rectified.'));
  X.push(_sagP('If the default is not rectified within the period specified in the notice, the First Party may terminate the subcontract, subject to settlement of accounts for the work properly executed.'));
  X.push(_sagH('10. DISPUTE RESOLUTION'));
  X.push(_sagP('Any dispute arising between the Parties shall first be resolved through mutual discussion.'));
  X.push(_sagP('If the dispute cannot be resolved amicably, the Parties may seek appropriate legal remedy in accordance with applicable law.'));
  let n = 11;
  if(o.cheque!=='none'){
    X.push(_sagH(n+'. SECURITY CHEQUES')); n++;
    if(o.cheque==='table'){
      X.push(_sagP('The Second Party has handed over to the First Party the following cheques as security for the due performance of the work and for all amounts that may become due from him under this Agreement:',{keep:true}));
      X.push(_sagChequeTable());
    } else {
      X.push(_sagP('The Second Party has already handed over to the First Party security cheques, which are held by the First Party and shall also stand as security for the due performance of this work and for all amounts that may become due from him under this Agreement.'));
    }
    X.push(_sagP('If the Second Party fails to perform any obligation, or any amount due from him is not paid on demand, the First Party may present the cheque(s) for the amount due. The Second Party shall not stop payment of the cheques, and shall keep sufficient funds in the account. If a cheque is dishonoured, the First Party may proceed under Section 138 of the Negotiable Instruments Act, 1881 and any other law, in addition to civil recovery. The cheques shall be returned only after all deposits and amounts relating to the work have been received from the Department and all dues are settled, as stated in Clause 12.'));
  }
  X.push(_sagH(n+'. RESPONSIBILITY AND LIABILITY')); n++;
  X.push(_sagP('The Second Party is solely and completely responsible for everything that happens in connection with the work. If any problem, defect, claim, penalty, dispute or litigation arises regarding the work, at any time, the Second Party shall deal with it at his own cost, and shall indemnify the First Party against all resulting loss, cost and expense.'));
  if(o.cheque!=='none'){
    X.push(_sagP('The First Party shall hold the security cheques until the Earnest Money Deposit, Final Security Deposit and all other deposits and amounts relating to the work have been received from the Department and all accounts regarding the work are settled. The responsibility of the Second Party does not end with the return of the cheques or the settlement of accounts. It shall continue even afterwards, and if anything arises in future regarding the work, the Second Party shall remain responsible for it. These deposits shall be paid to the Second Party only if and when they are received from the Department, after deducting his dues.'));
    X.push(_sagP('The First Party may recover any amount payable by the Second Party under this Agreement from any amount due to him and by presenting the security cheques.'));
  } else {
    X.push(_sagP('The responsibility of the Second Party shall continue until the Earnest Money Deposit, Final Security Deposit and all other deposits and amounts relating to the work have been received from the Department and all accounts regarding the work are settled. It does not end there. It shall continue even afterwards, and if anything arises in future regarding the work, the Second Party shall remain responsible for it. These deposits shall be paid to the Second Party only if and when they are received from the Department, after deducting his dues.'));
    X.push(_sagP('The First Party may recover any amount payable by the Second Party under this Agreement from any amount due to him.'));
  }
  X.push(_sagH(n+'. AMENDMENT')); n++;
  X.push(_sagP('Any amendment or modification to this Agreement shall be made in writing and signed by both Parties.'));
  X.push(_sagH(n+'. ACCEPTANCE'));
  X.push(_sagP('Both Parties confirm that they have read and understood the terms and conditions of this Agreement and agree to execute the work accordingly.'));
  X.push(_sagP('IN WITNESS WHEREOF',{b:true,pb:true}));
  X.push(_sagP('The Parties have signed this Agreement on the date and place mentioned above.'));
  X.push(_sagSign(o.firstName, o.secondName));
  X.push(_sagP(''));
  X.push(_sagP('WITNESSES',{b:true,keep:true}));
  X.push(_sagP('1.  Name: ______________________________   Address: _________________________________',{jc:'left'}));
  X.push(_sagP('     Signature: ________________________________',{jc:'left'}));
  X.push(_sagP('2.  Name: ______________________________   Address: _________________________________',{jc:'left'}));
  X.push(_sagP('     Signature: ________________________________',{jc:'left'}));
  return X.join('');
}
function sagBuildBlob(o){
  const enc = new TextEncoder(), NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${sagBodyXml(o)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-IN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
  return stkZip([
    {name:'[Content_Types].xml', data:enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>')},
    {name:'_rels/.rels', data:enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')},
    {name:'word/_rels/document.xml.rels', data:enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')},
    {name:'word/styles.xml', data:enc.encode(styles)},
    {name:'word/document.xml', data:enc.encode(doc)}
  ]);
}

// ─── dialog ────────────────────────────────────────────
let _sagPid = null;
function sagOpen(pid){
  const p = GP(pid); if(!p){ toast('Project not found','error'); return; }
  _sagPid = pid;
  const c = (typeof GC==='function') ? GC(p.contractorId) : null;
  const second = sagSecondDefault(c), first = SAG_FIRST[p.firm||'RSR Constructions'] || SAG_FIRST['RSR Constructions'];
  let gen = (typeof getGenCode==='function' ? getGenCode(p) : '') || ''; if(/^[\s—–-]*$/.test(gen)) gen = '';
  let m = document.getElementById('sag-modal');
  if(!m){ m = document.createElement('div'); m.className = 'mov'; m.id = 'sag-modal'; document.body.appendChild(m); }
  const inp = 'width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);font-family:inherit;font-size:13px;box-sizing:border-box';
  m.innerHTML = `<div class="mbox" style="max-width:640px"><div class="mhdr"><h2>📑 Subcontract Agreement</h2><button class="mx" onclick="CM('sag-modal')">✕</button></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px">Filled from this project and the contractor's agreement details. Check each box — you can edit anything before downloading.</div>
    ${second?'':'<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:var(--rs);padding:7px 10px;font-size:12px;margin-bottom:8px">This contractor has no agreement details yet (Contractors → Edit → Agreement details). Fill the box below by hand, or add them there so it fills itself next time.</div>'}
    <div class="fg"><label>Date of agreement <span style="font-weight:400;color:var(--text3)">(leave empty to fill in by hand)</span></label><input type="date" id="sag-date" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs)"></div>
    <div class="fg"><label>First Party (main contractor)</label><textarea id="sag-first" rows="3" style="${inp}">${_sagE(first)}</textarea></div>
    <div class="fg"><label>Second Party (subcontractor)</label><textarea id="sag-second" rows="3" style="${inp}">${_sagE(second)}</textarea></div>
    <div class="fg"><label>Name of work</label><textarea id="sag-work" rows="2" style="${inp}">${_sagE(p.name||'')}</textarea></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><div class="fg" style="flex:1;min-width:200px"><label>Gen code</label><input id="sag-gen" value="${_sagE(gen)}" style="${inp}"></div>
      <div class="fg" style="flex:1;min-width:200px"><label>Estimated amount (₹)</label><input id="sag-amt" value="${_sagE(sagAmount(p))}" inputmode="numeric" style="${inp}" oninput="sagWords()"><div id="sag-words" style="font-size:11px;color:var(--text3);margin-top:2px"></div></div></div>
    <div class="fg"><label>Security cheques</label><select id="sag-chq" style="${inp}"><option value="table">Cheque table to fill in (new cheques taken with this agreement)</option><option value="held">Cheques already held from an earlier agreement</option><option value="none">No security cheques</option></select></div>
    <div id="sag-err" style="color:var(--red);font-size:12px;margin-bottom:6px;display:none"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" onclick="CM('sag-modal')">Cancel</button><button class="btn btn-navy" onclick="sagDownload()">⬇ Download Word file</button></div></div>`;
  OM('sag-modal'); sagWords();
}
function sagWords(){ const a = chqAmount(_sagV('sag-amt')), e = document.getElementById('sag-words'); if(e) e.textContent = a ? '₹'+a.figures+' — '+a.words : (_sagV('sag-amt')?'not a valid amount':'left blank in the agreement — fill in by hand'); }
function sagDownload(){
  const p = GP(_sagPid), err = document.getElementById('sag-err'); if(!p) return;
  const first = _sagV('sag-first'), second = _sagV('sag-second'), work = _sagV('sag-work');
  const bad = m=>{ err.textContent = m; err.style.display = 'block'; };
  if(!first) return bad('Fill in the First Party.'); if(!work) return bad('Fill in the name of work.');
  const amt = _sagV('sag-amt'); if(amt && !chqAmount(amt)) return bad('The amount is not valid.');
  const dv = _sagV('sag-date'); let date = null;
  if(dv){ const d = new Date(dv+'T00:00:00'); const M = ['January','February','March','April','May','June','July','August','September','October','November','December']; date = {d:d.getDate(), m:M[d.getMonth()], y:d.getFullYear()}; }
  const secondText = second || '______________________________________, represented by its ________________________, ____________________________________';
  const o = {date, first, second:secondText, work, gen:_sagV('sag-gen'), amount:amt, cheque:_sagV('sag-chq'),
    firstName:(first.split(',')[0]||'').toUpperCase(), secondName:(secondText.split(',')[0]||'').toUpperCase()};
  try{
    const blob = sagBuildBlob(o);
    const c = (typeof GC==='function') ? GC(p.contractorId) : null;
    const name = ('Subcontract Agreement - '+((c&&c.name)||'')+' - '+(o.gen||p.tender||p.name)).replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,90)+'.docx';
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    CM('sag-modal'); toast('✓ Agreement downloaded — print on stamp paper, fill the blanks and sign','ok');
  }catch(e){ console.error(e); bad('Could not build the agreement: '+(e&&e.message||e)); }
}
