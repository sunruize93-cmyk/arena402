/* ============================================================
   arena402 — Application State
   Single source of truth for all page data.
   ============================================================ */

var state = {
  page: 'home',
  user: null,       // Supabase auth user — { id, email, user_metadata: { avatar_url, full_name, user_name } }
  leaderboard: [],
  battles: [],
  liveBattles: [],
  agents: [],
  listings: [],
  filter: ''
};
