// ═══════════════════════════════════════════════════════
// keepalive-worker.js
// Deploy this as a SEPARATE Cloudflare Worker
// It runs once every 24 hours and pings Supabase
// to prevent the free tier from pausing after 7 days
//
// HOW TO DEPLOY:
// 1. Go to dash.cloudflare.com → Workers & Pages → Create Worker
// 2. Name it: rsr-keepalive
// 3. Paste this entire file as the worker code
// 4. Go to Settings → Triggers → Add Cron Trigger
// 5. Set cron: 0 6 * * *  (runs every day at 6 AM IST = 00:30 UTC)
// 6. Save and deploy
//
// That's it. Free forever. No credit card needed.
// ═══════════════════════════════════════════════════════

const SUPABASE_URL = 'https://qflczjaugzaryfcfcqor.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbGN6amF1Z3phcnlmY2ZjcW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNzM1MDQsImV4cCI6MjA5NDc0OTUwNH0.IrBrqM-VSIBeOGUzBqjmZmEcKUseuJhIE3koCSNnc5g';

export default {
  // Handles the cron trigger
  async scheduled(event, env, ctx) {
    ctx.waitUntil(pingSupabase());
  },

  // Also handles HTTP requests (for manual testing)
  async fetch(request, env, ctx) {
    const result = await pingSupabase();
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function pingSupabase() {
  const start = Date.now();
  try {
    // Lightweight read — just fetch one row from settings
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/settings?key=eq.owner_pw&select=key&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const ms = Date.now() - start;
    const status = res.status;

    console.log(`[RSR Keepalive] Supabase ping: ${status} in ${ms}ms at ${new Date().toISOString()}`);

    return {
      success: status === 200 || status === 206,
      status,
      ms,
      timestamp: new Date().toISOString(),
      message: status === 200 ? 'Supabase is awake ✅' : `Unexpected status: ${status}`
    };
  } catch (err) {
    console.error('[RSR Keepalive] Ping failed:', err.message);
    return {
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
      message: 'Ping failed — check worker logs'
    };
  }
}
