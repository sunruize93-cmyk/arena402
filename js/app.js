/* ============================================================
   arena402 — App Controller
   Global A namespace: navigation, filtering, init sequence.
   Entry point: A.init() runs on DOMContentLoaded.
   ============================================================ */

console.log('♟ arena402 booting...');

// ---- global API ----
var A = window.A = {

  nav: function (p) {
    state.page = p;
    window.scrollTo(0, 0);
    render();
    if (p === 'arena')   A.fetchLB();
    if (p === 'market')  A.fetchListings();
    if (p === 'agents')  A.fetchAgents();
  },

  filter: function (f) {
    state.filter = f;
    if (state.page === 'arena')  A.fetchLB(f);
    if (state.page === 'market') A.fetchListings(f);
  },

  // data access (implementations in supabase.js)
  fetchLB:       fetchLB,
  fetchBattles:  fetchBattles,
  fetchAgents:   fetchAgents,
  fetchListings: fetchListings,

  init: function () {
    // Paint shell immediately — never wait on network for first render
    render();

    function tryInit() {
      var s = getSB();
      if (!s) {
        console.log('⚠️ Supabase not loaded — showing static page');
        return;
      }
      try {
        s.channel('live')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'battles' }, function (p) {
            state.liveBattles = [p.new].concat(state.liveBattles).slice(0, 8);
            render();
          })
          .subscribe();
      } catch (e) { console.warn('realtime subscribe failed', e); }

      Promise.all([
        Promise.resolve(A.fetchLB()),
        Promise.resolve(A.fetchBattles()),
        Promise.resolve(A.fetchAgents()),
        Promise.resolve(A.fetchListings())
      ]).then(function () {
        render();
        console.log('♟ arena402 ready');
      }).catch(function (e) {
        console.warn('data fetch failed — keeping static shell', e);
        render();
      });
    }

    if (window.SB_READY) {
      tryInit();
    } else {
      var attempts = 0;
      var iv = setInterval(function () {
        attempts++;
        if (window.SB_READY) { clearInterval(iv); tryInit(); }
        else if (attempts > 20) { clearInterval(iv); tryInit(); }
      }, 500);
    }
  }
};

A.init();
