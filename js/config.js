// ═══════════════════════════════════════════════════════
// config.js — RSR Constructions Tracker
// All constants and configuration in one place
// ═══════════════════════════════════════════════════════

const SB_URL = 'https://qflczjaugzaryfcfcqor.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbGN6amF1Z3phcnlmY2ZjcW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNzM1MDQsImV4cCI6MjA5NDc0OTUwNH0.IrBrqM-VSIBeOGUzBqjmZmEcKUseuJhIE3koCSNnc5g';
const OPW_KEY = 'rsr_owner_pw_v1';
const APP_VERSION = 'v18';

// ─── CLOUDFLARE R2 STORAGE ────────────────────────────
// Photos: stored here, auto-deleted after 1 year
// Documents: stored here permanently (JV, Work Orders, etc)
const R2_ACCOUNT_ID  = '2d8b06280bdb1c8c345fa99ab28fcdc7';
const R2_ACCESS_KEY  = 'e0afbd2575ed181f98fc8dc7e0be6f20';
const R2_SECRET_KEY  = '64907ee5291d1980edc06fcd859bd41dec6b02252924d9820f6b6fe73c31f4bc';
const R2_ENDPOINT    = 'https://2d8b06280bdb1c8c345fa99ab28fcdc7.r2.cloudflarestorage.com';
const R2_PHOTOS_BUCKET    = 'rsr-photos';
const R2_DOCS_BUCKET      = 'rsr-documents';
const R2_PHOTOS_PUBLIC    = 'https://pub-9793fd0e3ba345e6ab8318412ebf7b81.r2.dev';
const R2_DOCS_PUBLIC      = 'https://pub-117d558fb16541eebc01e9a91c4bc547.r2.dev';
// Photo auto-delete after this many days (1 year)
const PHOTO_RETENTION_DAYS = 365;

// ─── GLOBAL STATE ─────────────────────────────────────
let D = { contractors: [], projects: [], ownerPw: 'RSR@2024' };
let CU = null;
let bqc = 0, atab = 0, dpid = null, rfpid = null, vpid = null;
let notesPid = null, changePwContractorId = null;
let reviewUpdPid = null, reviewUpdId = null, settlePid = null;
let editReleasePid = null, editReleaseId = null;
let photos = [], gpsData = null;
let dbOK = false, autoRefreshTimer = null, deferredInstallPrompt = null;
let tallyUnmatched = [];
let calViewYear = new Date().getFullYear();
let calViewMonth = new Date().getMonth();
const projectCache = {};
