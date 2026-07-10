// Cost Centre Reference — standalone module
// Loaded separately to avoid template literal conflicts in finance.js

var _ccS='',_ccC='',_ccSt='',_ccF='';

function showCCRef(){
  var modal=document.getElementById('modal-cc-ref');
  if(!modal){
    modal=document.createElement('div');
    modal.className='mov';
    modal.id='modal-cc-ref';
    document.body.appendChild(modal);
  }
  _ccS='';_ccC='';_ccSt='';_ccF='';
  _drawCCRef(modal);
  modal.classList.add('open');
}

function _drawCCRef(modal){
  var projs=D.projects.filter(function(p){return !isArchived(p);});
  var cons=[...new Set(projs.map(function(p){
    var c=GC(p.contractorId);return c?c.name:null;
  }).filter(Boolean))].sort();
  var firms=[...new Set(projs.map(function(p){return p.firm||'RSR Constructions';}))].sort();

  var fil=projs.filter(function(p){
    if(!p.costCentre) return false;
    var st=projStatus(p);
    var cn=GC(p.contractorId)?GC(p.contractorId).name:'';
    var fi=p.firm||'RSR Constructions';
    if(_ccSt&&st!==_ccSt) return false;
    if(_ccF&&fi!==_ccF) return false;
    if(_ccC&&cn!==_ccC) return false;
    if(_ccS){
      var q=_ccS.toLowerCase();
      if(p.costCentre.toLowerCase().indexOf(q)<0 &&
         p.name.toLowerCase().indexOf(q)<0 &&
         cn.toLowerCase().indexOf(q)<0) return false;
    }
    return true;
  }).sort(function(a,b){
    var ca=GC(a.contractorId)?GC(a.contractorId).name:'';
    var cb=GC(b.contractorId)?GC(b.contractorId).name:'';
    return ca!==cb?ca.localeCompare(cb):a.name.localeCompare(b.name);
  });

  var ST={
    active:{l:'Active',bg:'#dcfce7',c:'#166534'},
    onhold:{l:'On Hold',bg:'#fef9c3',c:'#92400e'},
    completed:{l:'Completed',bg:'#e8edf8',c:'var(--navy)'}
  };
  var noCnt=projs.filter(function(p){return !p.costCentre;}).length;
  var lastC='',body='';

  fil.forEach(function(p){
    var st=projStatus(p);
    var s=ST[st]||ST.active;
    var cn=GC(p.contractorId)?GC(p.contractorId).name:'--';
    var fi=(p.firm||'RSR Constructions')
      .replace('RSR Constructions','RSR')
      .replace('R Sadhu Rao','RS Rao')
      .replace('R Likith Rahul','RLR');

    if(cn!==lastC){
      lastC=cn;
      var cnt=fil.filter(function(x){
        return (GC(x.contractorId)?GC(x.contractorId).name:'--')===cn;
      }).length;
      body+='<tr style="background:var(--navy)">';
      body+='<td colspan="4" style="padding:8px 14px;font-size:11px;font-weight:800;color:#fff">';
      body+=cn.toUpperCase()+'&nbsp;<span style="opacity:.5;font-weight:400">'+cnt+' project'+(cnt>1?'s':'')+'</span>';
      body+='</td></tr>';
    }

    var ccId='cc_'+Math.random().toString(36).slice(2);
    body+='<tr id="'+ccId+'" style="border-bottom:1px solid var(--surface2);cursor:default">';
    body+='<td style="padding:9px 14px">';
    body+='<div id="ccn_'+ccId+'" style="font-family:monospace;font-size:12px;font-weight:700;color:#1e3a8a">'+p.costCentre+'</div>';
    body+='<div style="font-size:10px;color:var(--text3)">'+fi+'</div>';
    body+='</td>';
    body+='<td style="padding:9px 12px;font-size:12px;color:var(--text2)">'+p.name.substring(0,55)+(p.name.length>55?'...':'')+'</td>';
    body+='<td style="padding:9px 10px;text-align:center">';
    body+='<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:'+s.bg+';color:'+s.c+'">'+s.l+'</span>';
    body+='</td>';
    body+='<td style="padding:9px 12px;text-align:center">';
    body+='<button onclick="ccCopy(\'ccn_'+ccId+'\',this)" style="background:var(--navy);color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer">Copy</button>';
    body+='</td></tr>';
  });

  var h='<div class="mbox" style="max-width:900px;width:96vw;max-height:92vh;display:flex;flex-direction:column;padding:0">';
  h+='<div style="background:var(--navy);color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;flex-shrink:0;display:flex;justify-content:space-between;align-items:center">';
  h+='<div><div style="font-size:16px;font-weight:800">Tally Cost Centre Reference</div>';
  h+='<div style="font-size:11px;opacity:.7;margin-top:2px">Find the correct cost centre name while entering transactions in Tally</div></div>';
  h+='<button onclick="CM(\'modal-cc-ref\')" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:8px;padding:4px 12px;cursor:pointer;font-size:18px;line-height:1">&#215;</button>';
  h+='</div>';

  // Filters
  var stOpts='<option value="">All Statuses</option>'
    +'<option value="active"'+((_ccSt==='active')?' selected':'')+'>Active</option>'
    +'<option value="completed"'+((_ccSt==='completed')?' selected':'')+'>Completed</option>'
    +'<option value="onhold"'+((_ccSt==='onhold')?' selected':'')+'>On Hold</option>';
  var fOpts='<option value="">All Firms</option>'+firms.map(function(f){
    return '<option value="'+f+'"'+((_ccF===f)?' selected':'')+'>'+f+'</option>';
  }).join('');
  var cOpts='<option value="">All Contractors</option>'+cons.map(function(c){
    return '<option value="'+c+'"'+((_ccC===c)?' selected':'')+'>'+c+'</option>';
  }).join('');

  h+='<div style="padding:10px 14px;background:#f8faff;border-bottom:1px solid var(--border);flex-shrink:0">';
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap">';
  h+='<input id="cc-si" type="text" placeholder="Search cost centre, project or contractor..." value="'+_ccS+'" '
    +'oninput="_ccS=this.value;_drawCCRef(document.getElementById(\'modal-cc-ref\'))" '
    +'style="flex:1;min-width:180px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px">';
  h+='<select onchange="_ccSt=this.value;_drawCCRef(document.getElementById(\'modal-cc-ref\'))" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px">'+stOpts+'</select>';
  h+='<select onchange="_ccF=this.value;_drawCCRef(document.getElementById(\'modal-cc-ref\'))" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px">'+fOpts+'</select>';
  h+='<select onchange="_ccC=this.value;_drawCCRef(document.getElementById(\'modal-cc-ref\'))" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px">'+cOpts+'</select>';
  h+='</div>';
  h+='<div style="font-size:11px;color:var(--text3);margin-top:6px">Showing <strong>'+fil.length+'</strong> projects'
    +(noCnt?' &middot; <span style="color:var(--amber)">'+noCnt+' missing cost centre</span>':'')+'</div>';
  h+='</div>';

  if(fil.length===0){
    h+='<div style="text-align:center;padding:50px;color:var(--text3)">No projects match your search.</div>';
  } else {
    h+='<div style="overflow-y:auto;flex:1">';
    h+='<table style="width:100%;border-collapse:collapse">';
    h+='<thead style="position:sticky;top:0;background:#fff;box-shadow:0 1px 0 var(--border)">';
    h+='<tr>';
    h+='<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase">Cost Centre Name</th>';
    h+='<th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase">Project</th>';
    h+='<th style="padding:9px 10px;text-align:center;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase">Status</th>';
    h+='<th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase">Copy</th>';
    h+='</tr></thead>';
    h+='<tbody>'+body+'</tbody></table></div>';
  }
  h+='</div>';
  modal.innerHTML=h;
  setTimeout(function(){var el=document.getElementById('cc-si');if(el)el.focus();},100);
}

function ccCopy(elId,btn){
  var el=document.getElementById(elId);
  var text=el?el.textContent:'';
  navigator.clipboard.writeText(text).then(function(){
    var o=btn.textContent;
    btn.textContent='Copied!';
    btn.style.background='var(--green)';
    setTimeout(function(){btn.textContent=o;btn.style.background='var(--navy)';},1500);
  }).catch(function(){
    if(el){
      var r=document.createRange();
      r.selectNodeContents(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    }
    alert('Press Ctrl+C to copy');
  });
}
