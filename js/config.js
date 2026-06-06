// ═══════════════════════════════════════════════════════
// config.js — RSR Constructions Tracker
// All constants and configuration in one place
// ═══════════════════════════════════════════════════════

const SB_URL = 'https://qflczjaugzaryfcfcqor.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbGN6amF1Z3phcnlmY2ZjcW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNzM1MDQsImV4cCI6MjA5NDc0OTUwNH0.IrBrqM-VSIBeOGUzBqjmZmEcKUseuJhIE3koCSNnc5g';
const OPW_KEY = 'rsr_owner_pw_v1';
const APP_VERSION = 'v21d';

// ─── CLOUDFLARE R2 — PUBLIC READ URLS ONLY ───────────
// Secret keys are now in the Cloudflare Worker (server-side)
// Browser only needs the public URLs for displaying files
const R2_PHOTOS_PUBLIC   = 'https://pub-9793fd0e3ba345e6ab8318412ebf7b81.r2.dev';
const R2_DOCS_PUBLIC     = 'https://pub-117d558fb16541eebc01e9a91c4bc547.r2.dev';
const R2_PHOTOS_BUCKET   = 'rsr-photos';
const R2_DOCS_BUCKET     = 'rsr-documents';

// ─── UPLOAD WORKER URL ────────────────────────────────
// All uploads go through this Cloudflare Worker
// The Worker holds the secret keys — browser never sees them
// After deploying worker.js, replace this URL with your worker URL
const UPLOAD_WORKER_URL = 'https://rsr-upload-worker.likithrahul-rlr.workers.dev';

// Photo auto-delete after this many days (1 year)
const PHOTO_RETENTION_DAYS = 365;

// ─── GLOBAL STATE ─────────────────────────────────────
let D = { contractors: [], projects: [], ownerPw: 'RSR@2024', customWorkTypes: [] };
let CU = null;
let bqc = 0, atab = 0, dpid = null, rfpid = null, vpid = null;
let notesPid = null, changePwContractorId = null;
let reviewUpdPid = null, reviewUpdId = null, settlePid = null;
let editReleasePid = null, editReleaseId = null;
let photos = [], gpsData = null;
let dbOK = false, autoRefreshTimer = null, deferredInstallPrompt = null;
let tallyUnmatched = [];
let tallyUnmatchedReceipts = []; // NEW: unmatched receipts from Tally

// ─── PERSIST UNMATCHED TO SUPABASE SETTINGS ──────────
// So they survive page refresh and mobile opening
const UNMATCHED_KEY = 'rsr_tally_unmatched_v1';
let dashFilter = 'attn'; // NEW: dashboard filter state
let dashContractorFilter = ''; // NEW: contractor filter
let calViewYear = new Date().getFullYear();
let calViewMonth = new Date().getMonth();
const projectCache = {};
