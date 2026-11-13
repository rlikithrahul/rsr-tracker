// ═══════════════════════════════════════════════════════
// embed.js — loaded first. When this page is running INSIDE one of the app's own
// internal tabs (an iframe opened by tabs.js), give it a private "browser history"
// so Back / ← Back buttons work per tab and never touch the browser's real history
// (which belongs to the main tab). Does nothing in the main window.
// ═══════════════════════════════════════════════════════
window.__EMBED = '';
try{ if(window.parent!==window && /^rsrtab-/.test(window.name||'')) window.__EMBED = window.name; }catch(e){}
(function(){
  if(!window.__EMBED || typeof History==='undefined') return;
  const H = History.prototype;
  let stack = [{state:null}], idx = 0;
  const fire = ()=>{ try{ window.dispatchEvent(new PopStateEvent('popstate',{state:stack[idx].state})); }catch(e){} };
  try{
    Object.defineProperty(H,'state',{get(){ return stack[idx].state; }, configurable:true});
    H.pushState    = function(s){ stack = stack.slice(0,idx+1); stack.push({state:s}); idx++; };
    H.replaceState = function(s){ stack[idx] = {state:s}; };
    H.back    = function(){ if(idx>0){ idx--; fire(); } };
    H.forward = function(){ if(idx<stack.length-1){ idx++; fire(); } };
    H.go      = function(n){ const t=idx+(n||0); if(t>=0 && t<stack.length && n){ idx=t; fire(); } };
    Object.defineProperty(H,'length',{get(){ return stack.length; }, configurable:true});
  }catch(e){ console.warn('embed history shim failed', e); }
})();
