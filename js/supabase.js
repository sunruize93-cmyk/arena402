/* ============================================================
   arena402 — Supabase Data Layer
   Client init + all read/write operations against the Supabase
   backend.  Attaches fetch functions to the global A namespace.
   ============================================================ */

var sb = null;

function getSB() {
  if (sb) return sb;
  if (window.supabase) {
    sb = window.supabase.createClient(window.SB_URL, window.SB_KEY);
    console.log('✅ Supabase connected');
    return sb;
  }
  return null;
}

// ---- fetch functions (attached to A later) ----

function fetchLB(asset, minBattles, limit) {
  var s = getSB(); if (!s) return;
  asset = asset || '';
  minBattles = minBattles || 0;
  limit = limit || 50;
  s.rpc('get_leaderboard', { p_asset_class: asset, p_min_battles: minBattles, p_limit: limit })
    .then(function (r) { if (r.data) { state.leaderboard = r.data; render(); } });
}

function fetchBattles(limit) {
  var s = getSB(); if (!s) return;
  limit = limit || 30;
  s.from('battles').select('*').order('ended_at', { ascending: false }).limit(limit)
    .then(function (r) { if (r.data) { state.battles = r.data; render(); } });
}

function fetchAgents() {
  var s = getSB(); if (!s) return;
  s.from('agents').select('*')
    .then(function (r) { if (r.data) { state.agents = r.data; render(); } });
}

function fetchListings(asset) {
  var s = getSB(); if (!s) return;
  asset = asset || '';
  var q = s.from('listings').select('*').eq('is_active', true).order('created_at', { ascending: false });
  if (asset) q = q.eq('asset_class', asset);
  q.then(function (r) { if (r.data) { state.listings = r.data; render(); } });
}
