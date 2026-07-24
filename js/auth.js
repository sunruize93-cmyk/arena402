/* ============================================================
   arena402 — Auth Module
   GitHub OAuth via Supabase Auth. Session persistence + UI sync.
   ============================================================ */

function initAuth() {
  var client = getSB();
  if (!client) { console.warn('⚠️ Auth init skipped — Supabase not loaded'); return; }

  // Restore existing session (page reload, OAuth callback)
  client.auth.getSession().then(function (_a) {
    var session = _a.data.session;
    if (session) {
      state.user = session.user;
      console.log('♟ Session restored — ' + (state.user.user_metadata?.user_name || state.user.email));
      render();
    }
  });

  // Listen for login / logout events
  client.auth.onAuthStateChange(function (event, session) {
    console.log('♟ Auth event: ' + event);
    if (session) {
      state.user = session.user;
    } else {
      state.user = null;
    }
    render();
    // Refresh agent list on login (so user sees their own agents)
    if (event === 'SIGNED_IN') { A.fetchAgents(); }
  });
}

function signInWithGitHub() {
  var client = getSB();
  if (!client) { console.warn('⚠️ Cannot sign in — Supabase not loaded'); return; }
  client.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
}

function signOut() {
  var client = getSB();
  if (!client) return;
  client.auth.signOut().then(function () {
    state.user = null;
    state.agents = [];
    render();
  });
}
