/* ============================================================
   arena402 — Auth Module
   GitHub + Google OAuth via Supabase Auth.
   Session persistence, UI sync, OAuth return veil.
   Public surface used by app.js:
     initAuth, signInWithGitHub, signInWithGoogle, signOut
   ============================================================ */

function isOAuthReturn() {
  var h = window.location.hash || '';
  var q = window.location.search || '';
  return (
    h.indexOf('access_token') !== -1 ||
    h.indexOf('refresh_token') !== -1 ||
    h.indexOf('error=') !== -1 ||
    q.indexOf('code=') !== -1 ||
    q.indexOf('error=') !== -1
  );
}

function setAuthPending(on) {
  state.authPending = !!on;
  var veil = document.getElementById('auth-veil');
  if (!veil) return;
  veil.classList.toggle('is-on', !!on);
  veil.setAttribute('aria-hidden', on ? 'false' : 'true');
}

function clearOAuthUrlNoise() {
  try {
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } catch (e) { /* ignore */ }
}

function initAuth() {
  var client = getSB();
  if (!client) { console.warn('⚠️ Auth init skipped — Supabase not loaded'); setAuthPending(false); return; }

  // Restore existing session (page reload, OAuth callback)
  client.auth.getSession().then(function (_a) {
    var session = _a.data.session;
    if (session) {
      state.user = session.user;
      console.log('♟ Session restored — ' + (state.user.user_metadata?.user_name || state.user.email));
      if (state.page === 'signin') state.page = 'home';
      render();
    }
    setAuthPending(false);
    clearOAuthUrlNoise();
  }).catch(function (e) {
    console.warn('getSession failed', e);
    setAuthPending(false);
  });

  // Listen for login / logout events
  client.auth.onAuthStateChange(function (event, session) {
    console.log('♟ Auth event: ' + event);
    if (session) {
      state.user = session.user;
      if (event === 'SIGNED_IN' && state.page === 'signin') state.page = 'home';
    } else {
      state.user = null;
      state.userMenuOpen = false;
    }
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
      setAuthPending(false);
      clearOAuthUrlNoise();
    }
    render();
    // Refresh agent list on login (so user sees their own agents)
    if (event === 'SIGNED_IN') { A.fetchAgents(); }
  });
}

function signInWithProvider(provider) {
  var client = getSB();
  if (!client) { console.warn('⚠️ Cannot sign in — Supabase not loaded'); return; }
  setAuthPending(true);
  client.auth.signInWithOAuth({
    provider: provider,
    options: { redirectTo: window.location.origin + window.location.pathname }
  }).catch(function (e) {
    console.warn('OAuth start failed', e);
    setAuthPending(false);
  });
}

function signInWithGitHub() {
  signInWithProvider('github');
}

function signInWithGoogle() {
  signInWithProvider('google');
}

function signOut() {
  var client = getSB();
  if (!client) return;
  state.userMenuOpen = false;
  client.auth.signOut().then(function () {
    state.user = null;
    state.agents = [];
    render();
  });
}

function toggleUserMenu(force) {
  if (typeof force === 'boolean') state.userMenuOpen = force;
  else state.userMenuOpen = !state.userMenuOpen;
  render();
}

// Show veil ASAP if this load looks like an OAuth bounce (before SB ready)
if (isOAuthReturn()) {
  // Defer to DOMContent — scripts are at end of body so DOM is ready
  state.authPending = true;
  var earlyVeil = document.getElementById('auth-veil');
  if (earlyVeil) {
    earlyVeil.classList.add('is-on');
    earlyVeil.setAttribute('aria-hidden', 'false');
  }
}
