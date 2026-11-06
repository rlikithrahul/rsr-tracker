// ═══════════════════════════════════════════════════════
// appinfo.js — "About this app": which version is running, whether a newer one is already deployed, and what changed.
// Also shows the version in the sidebar footer so you always know what you are looking at.
// ═══════════════════════════════════════════════════════
const APP_BUILD_DATE = '5 Nov 2026';
const APP_CHANGELOG = [
  ['v27q','Receipts from Tally on every project: Link / Unlink to settlements (one settlement can take several receipts, one receipt only one settlement); a receipt within 10% of the agreement amount asks Final Bill / Part Bill at the top of the project page; paise differences take the Tally amount, bigger ones ask. Health check rebuilt for Tally (links, last sync, settlements without receipts, contractor ledgers) with Ignore / Undo. Quick Access row replaced by on-hold / need-attention counts under Active Projects. Fund Releases and Site Documents open by default. Needs-attention count fixed.'],
  ['v27t','Net Deployed now = payments minus settlements minus any other receipts in Tally on the project (a receipt already linked to a settlement is counted once). A new line "Other receipts in Tally" shows on the project page and Settle box. Outstanding no longer takes settlements off twice (project page, Settle box, My Funds, backup Excel, meeting summary). EMI / Payments & Bills: every due date now has a Paid tick; if the due date passes without a tick it stays on the dashboard as a red "not marked paid" warning; a Recently marked paid list with Undo is on the EMI page.'],
  ['v27s','Work Experience: Find by Quantity now handles tenders that ask for several quantities (e.g. steel AND concrete): add a quantity for each, each with its own types, required amount, financial year and projects. New Word statements — "Statement as Word" in Find by Value (similar/civil works) and in Find by Quantity (physical quantities) — pre-filled from your records, ending with the signature of the tenderer, and you choose plain A4 or the firm letterhead when you download.'],
  ['v27r','Projects now count as linked to Tally by their link, not by having entries (a new project with a linked cost centre shows "linked, no transactions yet"). Automatic linking every 5 minutes: tender ID in the cost centre second row first, then the typed cost centre name; a project with no cost centre typed goes to its contractor main ledger; contractors link to the ledger with the same name. Two new health checks: names/tender IDs that do not match between app and Tally, and linked receipts that changed or disappeared in Tally. Contractor logins now see real Tally numbers of their own projects (never Excel) when Settings > Contractor Finance View is ON; OFF shows contact the RSR office. Tally links added to the daily backup. Tally cache cleared on logout. Settings page redone as tap-to-open rows, all closed by default.'],
  ['v27p','Alerts clean-up: duplicate-voucher alert and health check removed (Excel imports are gone), no 70% cap alerts for settled / final-bill projects, alerts use Tally numbers. Fix Tally Dates button removed. Mobile menu points to Tally Live.'],
  ['v27o','Tally is now the only source of payments and receipts for owner and staff: Excel-imported entries stay stored but are never shown, and projects not linked to Tally show nothing (with a link prompt). The last synced Tally numbers are kept if a refresh fails. The Use Tally numbers switch is retired. Settlements, statuses and part bills untouched.'],
  ['v27n','Full code check done. Old interest calculator file removed (nothing used it any more). Contractor profile page fix from v27m included.'],
  ['v27m','Fix: contractor profile page not opening after v27l (a leftover reference to the old interest calculation). The per-year interest table now uses the Tally ledger.'],
  ['v27l','All interest now comes from Tally, calculated the Tally way. Project page shows the interest of its Tally cost centre (0 and interest closed once settled; not linked shows a link prompt). Backup Excel, integrity check and contractor Interest box no longer use the old calculator. Nothing deleted.'],
  ['v27k','Tally Import page and old Interest tracker removed from the menu for everyone (nothing deleted - Excel entries stay stored but hidden). Tally Cost Centre Reference moved to the Action Centre. Numbers now always come from Tally Live. No status, settlement or part-bill was changed.'],
  ['v27j','Interest settings like Tally: payment day / receipt day counted, 365-day or calendar year, debit / credit / all balances, compounding on 31 March, last day, stop at nil, recognise posted interest vouchers · saved defaults on the Interest page (Super Admin) used by every interest figure · per-calculation settings box wherever interest is calculated · settings printed on the sheet'],
  ['v27i','Audit fixes: interest vouchers already posted in Tally (31 March or at settlement, e.g. "int for fy 25-26") are no longer charged twice in contractor / project boxes and reports; credit balances shown correctly; dates use India time. Interest now matches Tally to the paisa: both first and last day counted, a receipt day is charged on the old balance, credit balances are kept (no phantom interest after settlement), 31-March interest voucher recognised ("int for fy…"); wrong opening balance fixed (needs the new tally-api)'],
  ['v27g','Interest sheet in Tally style (day-by-day periods, balance, days, interest, year subtotals, totals) with a per-year "already posted in Tally" tick, as-on date, and an Interest + statement download · Cost Centres: Still fundable now follows the project page maths (settled = 0, part bill = 70% of unbilled amount, else 70% minus net deployed) with a State column · Settle picks receipts from Tally Live (not Excel) when the switch is on · mark a project Settled / Active / Completed from the ⋮ menu · change a settlement between Part Bill and Final Bill'],
  ['v27e','Staff access control (per-person dashboards, Tally Live own password, access requests) · multi-select quick filters on Projects · About panel · Excel/PDF downloads (statements, interest sheet, cost-centre summary) · Project Report PDF · receipt-vs-settlement hints'],
  ['v27d','"Use Tally numbers" switch: linked projects use Tally payments, Excel entries hidden (not deleted)'],
  ['v27c','Tally numbers inside Projects and Contractors · Interest section · Needs linking tab · receipt-confirmation prompts'],
  ['v27b','Linking upgrades: ledger→projects, cost centre→contractor, warning popups · cost-centre search · interest calculator'],
  ['v27a','Tally Live (read-only mirror) · Cheque Printing'],
];
let ABOUT = { latest:null, msg:'' };

function _abE(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function aboutCardHtml(){
  const sw=(typeof SW_VERSION!=='undefined')?SW_VERSION:'—';
  return `<div class="card" id="about-card" style="border-top:3px solid var(--gold);margin-top:16px">
    <div class="st" style="margin-bottom:4px">ℹ️ About this app</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:10px 0">
      <div style="background:var(--surface2);border-radius:10px;padding:10px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase">Running in this browser</div><div style="font-size:22px;font-weight:800">${_abE(APP_VERSION)}</div><div style="font-size:11px;color:var(--text3)">built ${_abE(APP_BUILD_DATE)}</div></div>
      <div style="background:var(--surface2);border-radius:10px;padding:10px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase">Latest uploaded to the website</div><div id="about-latest" style="font-size:22px;font-weight:800">…</div><div id="about-msg" style="font-size:11px;color:var(--text3)">checking</div></div>
      <div style="background:var(--surface2);border-radius:10px;padding:10px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase">Offline cache</div><div style="font-size:13px;font-weight:700;word-break:break-all">${_abE(sw)}</div><div style="font-size:11px;color:var(--text3)">should match the version</div></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn btn-sm" onclick="aboutCheck(true)">🔄 Check again</button><button class="btn btn-sm btn-primary" onclick="aboutReload()">⬆ Load the latest version now</button></div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:6px"><b>How to read this:</b> if “Running” and “Latest uploaded” are the same, you are up to date. If Latest is higher, the new version is on the website and “Load the latest version now” switches this browser to it. If they are the same but lower than the zip you downloaded, the upload to GitHub did not finish — upload again. (A zip you have downloaded but not uploaded cannot be seen from here; check its file name against “Running”.)</div>
    <details><summary style="cursor:pointer;font-size:12px;font-weight:600">What changed in each version</summary>${APP_CHANGELOG.map(c=>`<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)"><b>${_abE(c[0])}</b> — ${_abE(c[1])}</div>`).join('')}</details></div>`;
}
async function aboutCheck(manual){
  const a=document.getElementById('about-latest'), m=document.getElementById('about-msg'); if(!a) return; a.textContent='…'; if(m) m.textContent='checking';
  try{
    const r=await fetch(location.pathname.replace(/[^\/]*$/,'')+'index.html?vcheck='+Date.now(),{cache:'no-store'}); const t=await r.text();
    const x=t.match(/js\/config\.js\?v=([0-9a-z]+)/i); ABOUT.latest=x?('v'+x[1]):null;
    a.textContent=ABOUT.latest||'unknown';
    if(m){ if(!ABOUT.latest) m.textContent='could not read it'; else if(ABOUT.latest===APP_VERSION) m.innerHTML='<span style="color:#2e7d32">✓ you are up to date</span>'; else m.innerHTML='<span style="color:#c0392b;font-weight:700">A newer version is on the website — press “Load the latest version now”</span>'; }
  }catch(e){ a.textContent='unknown'; if(m) m.textContent='offline or blocked'; }
}
async function aboutReload(){
  if(!confirm('Reload this browser with the latest version? Your data is safe — it is stored in Supabase.')) return;
  try{ const regs=await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r=>r.unregister())); }catch(e){}
  try{ const ks=await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k))); }catch(e){}
  location.reload();
}
// version shown at the bottom of the sidebar, always
(function(){ if(typeof buildSidebar!=='function') return; const o=buildSidebar; buildSidebar=function(){ const r=o.apply(this,arguments); try{ const f=document.getElementById('sidebar-footer'); if(f && !f.querySelector('.ver-tag')){ const d=document.createElement('div'); d.className='ver-tag'; d.style.cssText='font-size:10px;opacity:.6;text-align:center;padding:4px 0'; d.textContent='RSR Tracker '+APP_VERSION; f.appendChild(d); } }catch(e){} return r; }; })();
