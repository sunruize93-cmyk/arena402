/* ============================================================
   arena402 — Game View renderer (倒爷黑市)
   Three-column layout: agents / market / negotiation viewer,
   plus phase strip + countdown on top and log stream below.
   Reads gameState (js/game-state.js) — pure view, no game logic.
   Owned by Cursor (CSS + templates). See CLAUDE.md.
   ============================================================ */

function renderGameView(s) {
  gameEnsureStarted();
  return '' +
    '<section class="gm">' +
      gmHead() +
      '<div class="gm-grid">' +
        '<div class="gm-col gm-col-agents">' + gmAgents() + '</div>' +
        '<div class="gm-col gm-col-market">' + gmMarket() + '</div>' +
        '<div class="gm-col gm-col-neg">' + gmNegotiation() + '</div>' +
      '</div>' +
      gmLog() +
    '</section>';
}

/* ---- head: round, phase machine strip, countdown ---- */

function gmHead() {
  var g = gameState;
  var strip = GAME_PHASES.map(function (p) {
    var cls = 'gm-phase' + (p === g.phase ? ' active' : '');
    return '<span class="' + cls + '">' + GAME_PHASE_LABEL[p] + '</span>';
  }).join('<span class="gm-phase-arrow" aria-hidden="true">→</span>');

  return '<header class="gm-head">' +
    '<div>' +
      '<p class="label">Black Market &nbsp;•&nbsp; Game ' + escHtml(g.gameId || '—') + (g.demo ? ' &nbsp;•&nbsp; Demo Feed' : '') + '</p>' +
      '<h1 class="display gm-title">Round ' + gmPad(g.round) + '<span class="gm-title-total">/ ' + gmPad(g.totalRounds) + '</span></h1>' +
    '</div>' +
    '<div class="gm-machine">' + strip + '</div>' +
    '<div class="gm-clock">' +
      '<p class="label">Phase clock</p>' +
      '<p class="gm-clock-time" id="gm-countdown">' + gameFmtCountdown() + '</p>' +
    '</div>' +
  '</header>';
}

/* ---- column 1: agent roster ---- */

function gmAgents() {
  var rows = gameState.agents.map(function (a) {
    var hold = Object.keys(a.holdings).map(function (good) {
      return a.holdings[good] + gameState.goods[good].sym;
    }).join(' ');
    return '<div class="gm-agent is-' + a.status + '">' +
      '<span class="gm-agent-dot" aria-hidden="true"></span>' +
      '<div class="gm-agent-main">' +
        '<p class="gm-agent-name">' + escHtml(a.name) + '</p>' +
        '<p class="gm-agent-meta">' + a.cash.toFixed(1) + ' USDC · ' + hold + '</p>' +
      '</div>' +
      '<span class="gm-agent-failed" title="failed negotiations">' + a.failed + '×</span>' +
    '</div>';
  }).join('');

  return '<p class="label gm-col-head">Agents · ' + gameState.agents.length + '</p>' +
    '<div class="gm-agent-list">' + (rows || '<p class="empty">Waiting for agents</p>') + '</div>';
}

/* ---- column 2: market panel (goods, events, pools, pairings) ---- */

function gmMarket() {
  var g = gameState;

  var goods = Object.keys(g.goods).map(function (k) {
    var gd = g.goods[k];
    return '<div class="gm-good">' +
      '<span class="gm-good-sym">' + gd.sym + '</span>' +
      '<span class="gm-good-name">' + gd.label + '</span>' +
      '<span class="gm-good-ref">' + gd.ref.toFixed(1) + '<small> ref</small></span>' +
    '</div>';
  }).join('');

  var evs = g.events.slice(-3).reverse().map(function (e) {
    return '<p class="gm-event' + (e.revealed ? ' revealed' : '') + '">' + escHtml(e.text) + '</p>';
  }).join('') || '<p class="gm-event dim">No events yet — opening prices are reference only</p>';

  var pools = Object.keys(g.pools).map(function (k) {
    var p = g.pools[k];
    if (!p.buy.length && !p.sell.length) return '';
    function side(list, dir) {
      return '<div class="gm-pool-side">' +
        '<p class="label">' + dir + ' · ' + list.length + '</p>' +
        list.map(function (id, i) {
          var a = gameAgent(id);
          return '<span class="gm-pool-chip">' + (i + 1) + '. ' + escHtml(a ? a.name : id) + '</span>';
        }).join('') +
      '</div>';
    }
    return '<div class="gm-pool">' +
      '<p class="gm-pool-good">' + g.goods[k].sym + ' ' + g.goods[k].label + ' <small>FCFS</small></p>' +
      '<div class="gm-pool-sides">' + side(p.buy, 'Buy') + side(p.sell, 'Sell') + '</div>' +
    '</div>';
  }).join('');

  var pairs = g.pairings.map(function (pg) {
    var b = gameAgent(pg.buyerId), sl = gameAgent(pg.sellerId);
    var mark = pg.status === 'deal' ? '<span class="gm-pair-mark deal">✓</span>'
             : pg.status === 'bust' ? '<span class="gm-pair-mark bust">✕</span>'
             : '<span class="gm-pair-mark live">⇄</span>';
    return '<button type="button" class="gm-pair is-' + pg.status + (g.selectedPairing === pg.id ? ' selected' : '') + '"' +
      ' onclick="gameState.selectedPairing=\'' + pg.id + '\';render()">' +
      '<span class="gm-pair-name">' + escHtml(b ? b.name : '?') + '</span>' + mark +
      '<span class="gm-pair-name r">' + escHtml(sl ? sl.name : '?') + '</span>' +
      '<span class="label gm-pair-good">' + g.goods[pg.good].label + '</span>' +
    '</button>';
  }).join('');

  return '<p class="label gm-col-head">Market</p>' +
    '<div class="gm-goods">' + goods + '</div>' +
    '<p class="label gm-sub-head">Events</p>' + evs +
    (pools ? '<p class="label gm-sub-head">Pools</p>' + pools : '') +
    '<p class="label gm-sub-head">Pairings · ' + g.pairings.length + '</p>' +
    '<div class="gm-pairs">' + (pairs || '<p class="empty">Pairs form after DECIDE</p>') + '</div>';
}

/* ---- column 3: negotiation viewer ---- */

function gmNegotiation() {
  var g = gameState;
  var pid = g.selectedPairing;
  var head = '<p class="label gm-col-head">Negotiation</p>';

  if (!pid || !g.negotiations[pid]) {
    return head + '<div class="gm-neg-empty"><p class="empty">Select a pairing to watch the haggle<br><span class="label">max 3 turns · buyer opens · ≤100 chars per line</span></p></div>';
  }

  var pg = null;
  for (var i = 0; i < g.pairings.length; i++) if (g.pairings[i].id === pid) pg = g.pairings[i];
  var neg = g.negotiations[pid];
  var buyer = pg && gameAgent(pg.buyerId), seller = pg && gameAgent(pg.sellerId);

  var seen = g.seenMsgCount[pid] || 0;
  var bubbles = neg.turns.map(function (t, idx) {
    var isNew = idx >= seen;
    var who = t.from === 'buyer' ? buyer : seller;
    var side = t.from === 'buyer' ? 'l' : 'r';
    if (t.type === 'accept') {
      return '<div class="gm-verdict deal' + (isNew ? ' is-new' : '') + '">✓ Accepted' + (neg.price ? ' @ ' + neg.price : '') + ' — settling on-chain (x402)</div>';
    }
    if (t.type === 'reject') {
      return '<div class="gm-verdict bust' + (isNew ? ' is-new' : '') + '">✕ Rejected — negotiation busted, failed +1 each</div>';
    }
    return '<div class="gm-bubble ' + side + (isNew ? ' is-new' : '') + '">' +
      '<p class="label">T' + t.turn + ' · ' + escHtml(who ? who.name : t.from) + '</p>' +
      '<p class="gm-bubble-price">' + t.price + '<small> USDC</small></p>' +
      (t.message ? '<p class="gm-bubble-msg">' + escHtml(t.message) + '</p>' : '') +
    '</div>';
  }).join('');
  g.seenMsgCount[pid] = neg.turns.length;

  var settle = '';
  if (neg.result === 'deal') {
    for (var j = 0; j < g.settlements.length; j++) {
      if (g.settlements[j].pairingId === pid) {
        settle = '<p class="gm-tx label">x402 tx ' + escHtml(g.settlements[j].tx) + ' · ' + g.settlements[j].status + '</p>';
      }
    }
  }

  return head +
    '<div class="gm-neg-parties">' +
      '<span>' + escHtml(buyer ? buyer.name : '—') + ' <small class="label">buyer · failed ' + (buyer ? buyer.failed : 0) + '×</small></span>' +
      '<span class="r"><small class="label">seller · failed ' + (seller ? seller.failed : 0) + '×</small> ' + escHtml(seller ? seller.name : '—') + '</span>' +
    '</div>' +
    '<div class="gm-neg-feed" id="gm-neg-feed">' + (bubbles || '<p class="empty">Waiting for the opening offer…</p>') + '</div>' +
    settle;
}

/* ---- bottom: terminal log stream ---- */

function gmLog() {
  var lines = gameState.log.slice(-14).map(function (l) {
    return '<p class="gm-log-line ' + l.cls + '"><span class="gm-log-t">' + l.t + '</span>' + escHtml(l.text) + '</p>';
  }).join('');
  return '<div class="gm-log" id="gm-log">' +
    '<p class="label gm-log-head">$ arena402 --tail log</p>' +
    lines +
  '</div>';
}

function gmPad(n) { return n < 10 ? '0' + n : '' + n; }

/* Keep feeds pinned to the latest entry after each render */
(function () {
  var _origRender = null;
  document.addEventListener('DOMContentLoaded', function () {});
  // render() is global; wrap once at load time (this file loads after render.js)
  if (typeof render === 'function' && !render.__gmWrapped) {
    _origRender = render;
    render = function () {
      _origRender();
      var feed = document.getElementById('gm-neg-feed');
      if (feed) feed.scrollTop = feed.scrollHeight;
      var log = document.getElementById('gm-log');
      if (log) log.scrollTop = log.scrollHeight;
    };
    render.__gmWrapped = true;
  }
})();
