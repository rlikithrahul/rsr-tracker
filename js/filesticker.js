// ═══════════════════════════════════════════════════════
// filesticker.js — tender file sticker (Word .docx)
//
// One click on a project → a Word file with the details to stick on the
// front of the physical tender file (gen code, work name, contractor,
// agreement / JV / cheque dates, tender ID, ECV). A4 portrait, but the
// sticker occupies ONLY the top half: print, cut it off, then turn the sheet
// round and print the next sticker on the unused half.
//
// The .docx is built here with no library: a .docx is a zip of a few XML
// files, written with the "stored" (uncompressed) zip method.
// ═══════════════════════════════════════════════════════

// ─── tiny zip writer (stored, no compression) ──────────
const _stkCrcTable = (()=>{ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = (c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[n]=c>>>0; } return t; })();
function stkCrc32(b){ let c=0xFFFFFFFF; for(let i=0;i<b.length;i++) c=_stkCrcTable[(c^b[i])&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
function stkZip(files){   // files: [{name, data:Uint8Array}]
  const enc = new TextEncoder(), chunks = [], central = []; let offset = 0;
  const u16 = n=>[n&255,(n>>>8)&255], u32 = n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
  files.forEach(f=>{
    const name = enc.encode(f.name), crc = stkCrc32(f.data), sz = f.data.length;
    const local = new Uint8Array([0x50,0x4b,3,4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(name.length), ...u16(0)]);
    chunks.push(local, name, f.data);
    central.push({name, crc, sz, offset});
    offset += local.length + name.length + sz;
  });
  const cdStart = offset; let cdSize = 0;
  central.forEach(c=>{
    const h = new Uint8Array([0x50,0x4b,1,2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c.crc), ...u32(c.sz), ...u32(c.sz), ...u16(c.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(c.offset)]);
    chunks.push(h, c.name); cdSize += h.length + c.name.length;
  });
  chunks.push(new Uint8Array([0x50,0x4b,5,6, 0,0,0,0, ...u16(central.length), ...u16(central.length), ...u32(cdSize), ...u32(cdStart), 0,0]));
  return new Blob(chunks, {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}

// ─── content ───────────────────────────────────────────
function stkEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function stkDate(d){
  if(!d) return '';
  const x = new Date(d); if(isNaN(x)) return '';
  const M = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  return String(x.getDate()).padStart(2,'0')+'-'+M[x.getMonth()]+'-'+x.getFullYear();
}
function stkEcv(p){
  let v = Number(p.agreeAmt)||0;
  if(!(v>0)){ const bt=(p.boq||[]).reduce((s,x)=>s+(Number(x.amount)||0),0); if(bt>0) v = bt*(1+(Number(p.bidPct)||0)/100); }
  if(!(v>0)) return '';
  return '₹ '+Math.round(v).toLocaleString('en-IN');
}
function stkData(p){
  const c = (typeof GC==='function') ? GC(p.contractorId) : null;
  return {
    gen: (typeof getGenCode==='function' ? getGenCode(p) : '') || '',
    name: p.name||'', contractor: c?c.name:'',
    agree: stkDate(p.agreeDate), jv: stkDate(p.jvDate), cheque: '',
    tender: p.tender||'', ecv: stkEcv(p)
  };
}
// run helper: text, size in half-points, bold, underline
function _r(t, sz, b, u){ return `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${b?'<w:b/>':''}${u?'<w:u w:val="single"/>':''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${stkEsc(t)}</w:t></w:r>`; }
function _p(runs, jc){ return `<w:p><w:pPr><w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/>${jc?`<w:jc w:val="${jc}"/>`:''}</w:pPr>${runs}</w:p>`; }
function _tc(w, span, fill, content, h){ return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span>1?`<w:gridSpan w:val="${span}"/>`:''}${fill?`<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`:''}<w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar><w:vAlign w:val="${h||'top'}"/></w:tcPr>${content}</w:tc>`; }
function _tr(h, cells){ return `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${h}" w:hRule="atLeast"/></w:trPr>${cells}</w:tr>`; }

function stkDocumentXml(d){
  // A4 = 11906 x 16838 twips; side margins 720 → table 10466 wide
  const W = [5300,2000,1600,1566], T = W.reduce((a,b)=>a+b,0), G='F1F3F4';
  const rows =
    _tr(760, _tc(T,4,G, _p(_r('GEN CODE : ',30,true)+_r(d.gen,30,true)))) +
    _tr(1500, _tc(T,4,G, _p(_r('NAME OF THE WORK:',24,true,true)+_r(' '+d.name,26,false)))) +
    _tr(760, _tc(T,4,G, _p(_r('Contractor: ',26,true,true)+_r(d.contractor,30,false)))) +
    _tr(560, _tc(W[0],1,'', _p(_r('Agreement Date',26,true),'center'),'center') + _tc(W[1],1,'', _p(_r('JV Date',26,true),'center'),'center') + _tc(W[2]+W[3],2,'', _p(_r('Cheque Received Date',26,true),'center'),'center')) +
    _tr(900, _tc(W[0],1,'', _p(_r(d.agree,30,true),'center'),'center') + _tc(W[1],1,'', _p(_r(d.jv,24,true),'center'),'center') + _tc(W[2]+W[3],2,'', _p(_r(d.cheque,24,true),'center'),'center')) +
    _tr(800, _tc(W[0]+W[1],2,'', _p(_r('TENDER ID : ',28,true)+_r(d.tender,28,false)),'center') + _tc(W[2]+W[3],2,'', _p(_r('ECV : ',28,true)+_r(d.ecv,28,false)),'center'));
  const bd = k=>`<w:${k} w:val="single" w:sz="8" w:space="0" w:color="000000"/>`;
  const tbl = `<w:tbl><w:tblPr><w:tblW w:w="${T}" w:type="dxa"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(bd).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${W.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows}</w:tbl>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${tbl}<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="567" w:right="720" w:bottom="567" w:left="720" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}
function stkBuildBlob(p){
  const enc = new TextEncoder();
  const files = [
    {name:'[Content_Types].xml', data:enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')},
    {name:'_rels/.rels', data:enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')},
    {name:'word/document.xml', data:enc.encode(stkDocumentXml(stkData(p)))}
  ];
  return stkZip(files);
}
function downloadFileSticker(pid){
  const p = GP(pid); if(!p){ toast('Project not found','error'); return; }
  try{
    const blob = stkBuildBlob(p);
    const name = ('Sticker - '+(stkData(p).gen||p.tender||p.name)).replace(/[\\/:*?"<>|]+/g,' ').trim().slice(0,80)+'.docx';
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast('✓ Sticker downloaded — prints on the top half of an A4 sheet','ok');
  }catch(e){ console.error(e); toast('Could not build the sticker: '+(e&&e.message||e),'error'); }
}
