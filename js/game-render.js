/* ============================================================
   arena402 — Game View renderer (倒爷黑市)
   FRONTEND_GUIDE §11 render side:
   step 2 skeleton+top bar · 3 agent list · 4 market board ·
   5 negotiation viewer · 7 animations · 8 result · 9 lobby.
   Pure view over gameState — no game logic here.
   ============================================================ */

function renderGameView(s) {
  gameEnsureStarted();
  if (gameState.view === 'lobby')  return gmLobby();
  if (gameState.view === 'result') return gmResult();

  // #7: K-line ticker with live prices
  var gKline = '';
  var gKlineGoods = [
    { sym: '◆RUBY', base: 9.2, vol: 0.25 },
    { sym: '●GOLD', base: 11.0, vol: 0.35 },
    { sym: '🌾GRAIN', base: 2.0, vol: 0.06 },
    { sym: '💎GEMS', base: 4.2, vol: 0.15 }
  ];
  for (var ki = 0; ki < 2; ki++) {
    gKlineGoods.forEach(function(gg) {
      var price = gg.base + (Math.random() - 0.5) * gg.vol * 2;
      var delta = ((price - gg.base) / gg.base * 100);
      var dir = delta >= 0 ? 'up' : 'down';
      var spark = '';
      for (var si = 0; si < 12; si++) {
        var hh = 4 + Math.random() * 10;
        spark += '<rect x="' + (si * 3) + '" y="' + (14 - hh) + '" width="2" height="' + hh + '" fill="' + (delta >= 0 ? '#9fbf9b' : '#bf8f8b') + '" opacity="' + (0.4 + Math.random() * 0.6) + '"/>';
      }
      gKline += '<span class="kline-item">' +
        '<span class="kline-sym">' + gg.sym + '</span>' +
        '<span class="kline-price">' + price.toFixed(2) + '</span>' +
        '<span class="kline-delta ' + dir + '">' + (delta >= 0 ? '+' : '') + delta.toFixed(2) + '%</span>' +
        '<svg class="kline-spark" viewBox="0 0 36 14">' + spark + '</svg>' +
      '</span>';
    });
  }

  return '' +
    '<section class="gm">' +
      '<button type="button" class="back-btn" onclick="A.nav(\'home\')">← Back</button>' +
      '<div class="kline-ticker" style="margin:8px 0 8px"><div class="kline-ticker-inner">' + gKline + gKline + '</div></div>' +
      gmHead() +
      '<div class="gm-grid">' +
        '<div class="gm-col gm-col-agents">' + gmAgents() + '</div>' +
        '<div class="gm-col gm-col-market">' + gmMarket() + '</div>' +
        '<div class="gm-col gm-col-neg">' + gmNegotiation() + '</div>' +
      '</div>' +
      gmLog() +
    '</section>';
}

/* ============================================================
   STEP 9 — LOBBY (#/game)
   ============================================================ */

function gmLobby() {
  gameLobbyFetch(); // idempotent — guarded by lobbyLoaded/_gameLobbyFetching
  var rows = gameState.lobbyGames.map(function (g) {
    var st = g.status === 'playing' ? 'LIVE' : g.status === 'finished' ? 'ENDED' : 'WAITING';
    return '<button type="button" class="gm-lobby-row" onclick="location.hash=\'#/game/' + g.id + (g.status === 'finished' ? '/result' : '') + '\'">' +
      '<span class="gm-lobby-id">' + escHtml(String(g.id).slice(0, 8)) + '</span>' +
      '<span class="label">R ' + g.current_round + '/' + g.total_rounds + '</span>' +
      '<span class="gm-lobby-status is-' + g.status + '">' + st + '</span>' +
    '</button>';
  }).join('');

  return '<section class="gm gm-lobby">' +
    '<button type="button" class="back-btn" onclick="A.nav(\'home\')">← Back</button>' +
    '<header class="gm-head">' +
      '<div>' +
        '<p class="label">Black Market &nbsp;•&nbsp; Lobby</p>' +
        '<h1 class="display gm-title">The Bazaar</h1>' +
      '</div>' +
    '</header>' +
    '<div class="gm-lobby-grid">' +
      '<div class="gm-lobby-panel">' +
        '<p class="label gm-col-head">One-line rules</p>' +
        '<p class="gm-rule">“你的 AI 是个倒爷。每回合决定买、卖、还是观望，进市场配对砍价 2-3 轮，N 回合后按结算价清算，谁钱多谁赢。”</p>' +
        '<div class="gm-rule-points">' +
          '<p><span class="label">Equal start</span>同额本金 + 同样初始货 — 胜负 100% 来自 agent 设计</p>' +
          '<p><span class="label">FCFS</span>决策越快越先配对 — 速度也是竞争力</p>' +
          '<p><span class="label">x402</span>每笔成交点对点链上结算（Injective）— 平台不碰钱</p>' +
          '<p><span class="label">Credit</span>谈崩次数公开可见 — 是强硬还是菜，对手自己判断</p>' +
        '</div>' +
        '<div class="gm-lobby-actions">' +
          '<button class="btn" onclick="gameCreate()">+ Create Game</button>' +
          '<button class="btn ghost" onclick="location.hash=\'#/game/demo\'">▶ Watch Demo Match</button>' +
        '</div>' +
      '</div>' +
      '<div class="gm-lobby-panel">' +
        '<p class="label gm-col-head">Open tables</p>' +
        '<div class="gm-lobby-list">' +
          (rows || '<p class="empty">' + (gameState.lobbyLoaded ? 'No games yet — create one or watch the demo' : 'Loading tables…') + '</p>') +
        '</div>' +
      '</div>' +
    '</div>' +
  '</section>';
}

/* ============================================================
   STEP 2 — TOP BAR: round, phase machine, clock, event marquee
   ============================================================ */

function gmHead() {
  var g = gameState;
  var strip = GAME_PHASES.map(function (p) {
    return '<span class="gm-phase' + (p === g.phase ? ' active' : '') + '">' + GAME_PHASE_LABEL[p] + '</span>';
  }).join('<span class="gm-phase-arrow" aria-hidden="true">→</span>');

  var lastEv = g.events[g.events.length - 1];
  var marquee = lastEv
    ? '<div class="gm-ticker"><div class="gm-ticker-inner">' +
        new Array(5).join('<span>' + escHtml(lastEv.text) + ' &nbsp;•&nbsp; </span>') +
      '</div></div>'
    : '';

  return '<header class="gm-head">' +
    '<div>' +
      '<p class="label">Black Market &nbsp;•&nbsp; Game ' + escHtml(g.gameId || '—') + (g.demo ? ' &nbsp;•&nbsp; Demo Feed' : '') + '</p>' +
      '<h1 class="display gm-title">Round ' + gmPad(g.round) + '<span class="gm-title-total">/ ' + gmPad(g.totalRounds) + '</span></h1>' +
    '</div>' +
    '<div class="gm-machine">' + strip + '</div>' +
    '<div class="gm-clock">' +
      '<p class="label">Phase clock</p>' +
      '<p class="gm-clock-time' + (g.countdown <= 5 && g.countdown > 0 ? ' warn' : '') + '" id="gm-countdown">' + gameFmtCountdown() + '</p>' +
    '</div>' +
  '</header>' + marquee;
}

/* ============================================================
   STEP 3 — AGENT LIST (decision status, credit, focus)
   ============================================================ */

function gmAgents() {
  var rows = gameState.agents.map(function (a) {
    var hold = Object.keys(a.holdings).map(function (good) {
      var gd = gameState.goods[good];
      return a.holdings[good] + (gd ? gd.sym : good);
    }).join(' ');

    var dec = '';
    if (gameState.phase !== 'IDLE') {
      if (a.decision === 'pass') dec = 'PASS';
      else if (a.decision) dec = a.decision.dir.toUpperCase() + ' ' + (gameState.goods[a.decision.good] ? gameState.goods[a.decision.good].label : a.decision.good);
      else if (gameState.phase === 'DECIDE') dec = 'DECIDING…';
    }

    var focused = gameState.focusAgent === a.id;
    return '<button type="button" class="gm-agent is-' + a.status + (focused ? ' focused' : '') + '" onclick="gmFocusAgent(\'' + a.id + '\')">' +
      '<span class="gm-agent-dot" aria-hidden="true"></span>' +
      '<div class="gm-agent-main">' +
        '<p class="gm-agent-name">' + escHtml(a.name) + (a.kind === 'rule' ? ' <small class="gm-agent-kind">RULE</small>' : '') + '</p>' +
        '<p class="gm-agent-meta">' + a.cash.toFixed(1) + ' USDC · ' + hold + (dec ? ' · <em>' + dec + '</em>' : '') + '</p>' +
      '</div>' +
      '<span class="gm-agent-failed" title="failed negotiations">' + a.failed + '×</span>' +
    '</button>';
  }).join('');

  return '<p class="label gm-col-head">Agents · ' + gameState.agents.length + '</p>' +
    '<div class="gm-agent-list">' + (rows || '<p class="empty">Waiting for agents</p>') + '</div>';
}

function gmFocusAgent(id) {
  gameState.focusAgent = gameState.focusAgent === id ? null : id;
  // focusing an agent auto-selects its live pairing
  if (gameState.focusAgent) {
    for (var i = 0; i < gameState.pairings.length; i++) {
      var pg = gameState.pairings[i];
      if (pg.buyerId === id || pg.sellerId === id) { gameState.selectedPairing = pg.id; break; }
    }
  }
  render();
}

/* ============================================================
   STEP 4 — MARKET BOARD (prices+trend, events, pools, pairings)
   ============================================================ */

function gmMarket() {
  var g = gameState;

  var goods = Object.keys(g.goods).map(function (k) {
    var gd = g.goods[k];
    var up = gd.ref > gd.prev, down = gd.ref < gd.prev;
    var arrow = up ? '<span class="gm-trend up">↑</span>' : down ? '<span class="gm-trend down">↓</span>' : '';
    var pool = g.pools[k];
    var poolInfo = (pool && (pool.buy.length || pool.sell.length))
      ? '<span class="gm-good-pools label">B' + pool.buy.length + ' / S' + pool.sell.length + '</span>' : '';
    return '<div class="gm-good">' +
      '<span class="gm-good-sym">' + gd.sym + '</span>' +
      '<span class="gm-good-name">' + gd.label + poolInfo + '</span>' +
      '<span class="gm-good-ref">' + gd.ref.toFixed(1) + arrow + '<small> ref</small></span>' +
    '</div>';
  }).join('');

  var evStart = Math.max(0, g.events.length - 3);
  var evSeen = g._seenEvents || 0;
  var evs = g.events.slice(evStart).map(function (e, i) {
    var isNew = (evStart + i) >= evSeen;
    var probBar = (e.kind === 'prob' && e.prob && !e.revealed)
      ? '<span class="gm-event-prob"><span class="gm-event-prob-fill" style="width:' + Math.round(e.prob * 100) + '%"></span></span>'
      : '';
    return '<p class="gm-event' + (e.revealed ? ' revealed' : '') + (isNew ? ' is-pinned' : '') + '">' +
      '<span class="label">' + (e.kind === 'prob' ? 'PROB' : 'CERTAIN') + ' · R' + e.round + '</span><br>' +
      escHtml(e.text) + probBar + '</p>';
  }).reverse().join('') || '<p class="gm-event dim">No events yet — opening prices are reference only</p>';
  g._seenEvents = g.events.length;

  var pools = Object.keys(g.pools).map(function (k) {
    var p = g.pools[k];
    if (!p.buy.length && !p.sell.length) return '';
    function side(list, dir) {
      return '<div class="gm-pool-side"><p class="label">' + dir + ' · ' + list.length + '</p>' +
        list.map(function (id, i) {
          var a = gameAgent(id);
          return '<span class="gm-pool-chip">' + (i + 1) + '. ' + escHtml(a ? a.name : id) + '</span>';
        }).join('') + '</div>';
    }
    return '<div class="gm-pool">' +
      '<p class="gm-pool-good">' + g.goods[k].sym + ' ' + g.goods[k].label + ' <small>FCFS</small></p>' +
      '<div class="gm-pool-sides">' + side(p.buy, 'Buy') + side(p.sell, 'Sell') + '</div>' +
    '</div>';
  }).join('');

  // pairing progress bar (settled / total)
  var done = g.pairings.filter(function (pg) { return pg.status !== 'live'; }).length;
  var progress = g.pairings.length
    ? '<div class="gm-progress"><span class="label">' + done + ' / ' + g.pairings.length + ' settled</span>' +
      '<span class="gm-progress-bar"><span class="gm-progress-fill" style="width:' + Math.round(done / g.pairings.length * 100) + '%"></span></span></div>'
    : '';

  var pairs = g.pairings.map(function (pg) {
    var b = gameAgent(pg.buyerId), sl = gameAgent(pg.sellerId);
    var focused = g.focusAgent && (pg.buyerId === g.focusAgent || pg.sellerId === g.focusAgent);
    var mark = pg.status === 'deal' ? '<span class="gm-pair-mark deal">✓</span>'
             : pg.status === 'bust' ? '<span class="gm-pair-mark bust">✕</span>'
             : '<span class="gm-pair-mark live">⇄</span>';
    return '<button type="button" class="gm-pair is-' + pg.status + (g.selectedPairing === pg.id ? ' selected' : '') + (focused ? ' focused' : '') + '"' +
      ' onclick="gameState.selectedPairing=\'' + pg.id + '\';render()">' +
      '<span class="gm-pair-name gm-slide-l">' + escHtml(b ? b.name : '?') + '</span>' + mark +
      '<span class="gm-pair-name r gm-slide-r">' + escHtml(sl ? sl.name : '?') + '</span>' +
      '<span class="label gm-pair-good">' + (g.goods[pg.good] ? g.goods[pg.good].label : pg.good) + '</span>' +
    '</button>';
  }).join('');

  return '<p class="label gm-col-head">Market</p>' +
    '<div class="gm-goods">' + goods + '</div>' +
    '<p class="label gm-sub-head">Events</p>' + evs +
    (pools ? '<p class="label gm-sub-head">Pools</p>' + pools : '') +
    '<p class="label gm-sub-head">Pairings · ' + g.pairings.length + '</p>' + progress +
    '<div class="gm-pairs">' + (pairs || '<p class="empty">Pairs form after DECIDE</p>') + '</div>';
}

/* ============================================================
   STEP 5 — NEGOTIATION VIEWER (turns, timestamps, verdicts, tx)
   ============================================================ */

function gmNegotiation() {
  var g = gameState;
  var pid = g.selectedPairing;
  var head = '<p class="label gm-col-head">Negotiation · Terminal</p>';

  if (!pid || !g.negotiations[pid]) {
    return head + '<div class="gm-neg-empty"><p class="empty">Select a pairing to open the channel<br><span class="label">max 3 turns · buyer opens · ≤100 chars per line</span></p></div>';
  }

  var pg = gamePairingById(pid);
  var buyer = pg && gameAgent(pg.buyerId), seller = pg && gameAgent(pg.sellerId);

  return head +
    '<div class="gm-neg-parties">' +
      '<span>' + escHtml(buyer ? buyer.name : '—') + ' <small class="label">buyer</small></span>' +
      '<span class="r"><small class="label">seller</small> ' + escHtml(seller ? seller.name : '—') + '</span>' +
    '</div>' +
    termHtml(pid);
}

/* ============================================================
   STEP 8 — GAME RESULT (#/game/{id}/result)
   ============================================================ */

function gmResult() {
  var g = gameState;
  if (!g.rankings.length && g.agents.length) gameComputeRankings();

  var podium = g.rankings.slice(0, 3).map(function (r, i) {
    return '<div class="gm-podium-slot p' + (i + 1) + '">' +
      '<p class="gm-podium-rank">' + ['I', 'II', 'III'][i] + '</p>' +
      '<p class="gm-podium-name">' + escHtml(r.name) + '</p>' +
      '<p class="gm-podium-worth">' + r.netWorth.toFixed(1) + '<small> USDC</small></p>' +
    '</div>';
  }).join('');

  var rows = g.rankings.map(function (r) {
    return '<div class="row">' +
      '<span class="rank' + (r.rank <= 3 ? '' : ' dim') + '">' + gmPad(r.rank) + '</span>' +
      '<div style="min-width:0"><p class="name">' + escHtml(r.name) + '</p>' +
      '<p class="meta">cash ' + (r.cash != null ? r.cash.toFixed(1) : '—') + (r.goodsValue != null ? ' · goods ' + r.goodsValue.toFixed(1) : '') + (r.failed != null ? ' · failed ' + r.failed + '×' : '') + '</p></div>' +
      '<div class="elo">' + r.netWorth.toFixed(1) + '<small>NET</small></div>' +
    '</div>';
  }).join('');

  var prices = Object.keys(g.settlePrices).map(function (k) {
    var gd = g.goods[k] || { label: k, sym: '', ref: 0 };
    var d = gd.ref ? ((g.settlePrices[k] - gd.ref) / gd.ref * 100) : 0;
    return '<div class="gm-good">' +
      '<span class="gm-good-sym">' + gd.sym + '</span>' +
      '<span class="gm-good-name">' + gd.label + '</span>' +
      '<span class="gm-good-ref">' + g.settlePrices[k].toFixed(1) +
        '<small> settle' + (d ? ' · ' + (d > 0 ? '+' : '') + d.toFixed(0) + '% vs ref' : '') + '</small></span>' +
    '</div>';
  }).join('') || '<p class="empty">Settle table pending</p>';

  return '<section class="gm gm-result">' +
    '<header class="gm-head">' +
      '<div>' +
        '<p class="label">Black Market &nbsp;•&nbsp; Game ' + escHtml(g.gameId || '—') + ' &nbsp;•&nbsp; Final</p>' +
        '<h1 class="display gm-title">Clearing</h1>' +
      '</div>' +
      '<div class="gm-clock"><p class="label">Rounds played</p><p class="gm-clock-time">' + gmPad(g.round) + '</p></div>' +
    '</header>' +
    '<div class="gm-podium">' + (podium || '<p class="empty">Computing ranks…</p>') + '</div>' +
    '<div class="gm-result-grid">' +
      '<div class="gm-lobby-panel"><p class="label gm-col-head">Net worth ranking</p><div class="rows">' + rows + '</div></div>' +
      '<div class="gm-lobby-panel"><p class="label gm-col-head">Settle price table</p><div class="gm-goods">' + prices + '</div>' +
        '<p class="gm-rule-points" style="margin-top:20px"><span class="label">Formula</span>net worth = cash + Σ(holdings × settle price)</p>' +
        '<div class="gm-lobby-actions"><button class="btn ghost" onclick="location.hash=\'#/game\'">← Back to lobby</button></div>' +
      '</div>' +
    '</div>' +
  '</section>';
}

/* ---- bottom log stream ---- */

function gmLog() {
  var lines = gameState.log.slice(-14).map(function (l) {
    return '<p class="gm-log-line ' + l.cls + '"><span class="gm-log-t">' + l.t + '</span>' + escHtml(l.text) + '</p>';
  }).join('');
  return '<div class="gm-log" id="gm-log">' +
    '<p class="label gm-log-head">$ arena402 --tail log</p>' + lines +
  '</div>';
}

function gmPad(n) { return n < 10 ? '0' + n : '' + n; }

/* Keep feeds pinned to the latest entry after each render */
(function () {
  if (typeof render === 'function' && !render.__gmWrapped) {
    var _origRender = render;
    render = function () {
      _origRender();
      var log = document.getElementById('gm-log');
      if (log) log.scrollTop = log.scrollHeight;
      if (typeof termAfterRender === 'function') termAfterRender();
      if (typeof entranceMaybePlay === 'function') entranceMaybePlay();
    };
    render.__gmWrapped = true;
  }
})();
