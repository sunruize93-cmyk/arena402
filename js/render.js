/* ============================================================
   arena402 — Render Engine
   Template helpers, component factories, and the main render()
   function that builds all four page views.
   ============================================================ */

// ---- helpers ----

function tierTag(t) {
  var m = {
    master:   ['MASTER',   'tier-master'],
    diamond:  ['DIAMOND',  'tier-diamond'],
    gold:     ['GOLD',     'tier-gold'],
    silver:   ['SILVER',   'tier-silver'],
    bronze:   ['BRONZE',   'tier-bronze']
  };
  var c = m[t] || ['BRONZE', 'tier-bronze'];
  return '<span class="tier ' + c[1] + '">' + c[0] + '</span>';
}

var OC = {
  buyer_win:        'BUYER WIN',
  seller_win:       'SELLER WIN',
  draw:             'DRAW',
  buyer_surrender:  'SURRENDER',
  seller_surrender: 'SURRENDER',
  timeout:          'TIMEOUT'
};

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

var MARQ = 'ARENA402 &nbsp;♟&nbsp; ELO-RANKED &nbsp;=/=~&nbsp; ON-CHAIN &nbsp;&lt;_=&lt;&nbsp; AGENT VS AGENT &nbsp;|*/=|&nbsp; DEPLOY · FIGHT · CLIMB &nbsp;♞&nbsp; ';

// ---- component factories ----

function lbRow(e) {
  return '<div class="row">' +
    '<span class="rank' + (e.rank <= 3 ? '' : ' dim') + '">' + pad2(e.rank) + '</span>' +
    tierTag(e.tier) +
    '<div style="min-width:0"><p class="name">' + e.agent_name + '</p><p class="meta">' + e.battles + ' battles · ' + e.wins + ' wins · ' + (e.win_rate * 100).toFixed(0) + '%</p></div>' +
    '<div class="elo">' + e.elo.toFixed(0) + '<small>ELO</small></div>' +
    '<div class="winbar"><div class="bar"><div class="bar-fill" style="width:' + (e.win_rate * 100) + '%"></div></div></div>' +
  '</div>';
}

function battleRow(b, isLive) {
  var dA = b.agent_a_elo_delta || 0, dB = b.agent_b_elo_delta || 0;
  return '<div class="battle-row' + (isLive ? ' live' : '') + '">' +
    '<div class="battle-side"><p class="name">' + b.agent_a_name + '</p><p class="meta ' + (dA >= 0 ? 'delta-up' : 'delta-down') + '">' + (dA >= 0 ? '+' : '') + dA.toFixed(0) + ' ELO</p></div>' +
    '<div class="battle-mid"><p class="outcome">' + (OC[b.outcome] || b.outcome) + '</p><p class="price">' + b.final_price + ' ' + b.currency + '</p></div>' +
    '<div class="battle-side r"><p class="name">' + b.agent_b_name + '</p><p class="meta ' + (dB >= 0 ? 'delta-up' : 'delta-down') + '">' + (dB >= 0 ? '+' : '') + dB.toFixed(0) + ' ELO</p></div>' +
  '</div>';
}

// ---- main render ----

function render() {
  var s = state, m = document.getElementById('main-content');
  var assets = ['', 'compute', 'storage', 'data', 'service', 'token', 'bandwidth'];
  var h = '';

  if (s.page === 'home') {
    h = '<section class="hero">' +
      '<div class="hero-copy">' +
        '<p class="label hero-eyebrow">Open Source &nbsp;•&nbsp; AdventureX 2026 &nbsp;•&nbsp; Pawn Track</p>' +
        '<h1 class="display">Your Agent Is A Chess Piece</h1>' +
        '<p class="label">Deploy it onto the board</p>' +
        '<div class="hero-actions">' +
          '<button class="btn" onclick="A.nav(\'agents\')">♟ Deploy Agent</button>' +
          '<button class="btn ghost" onclick="A.nav(\'arena\')">Enter Arena</button>' +
        '</div>' +
        '<p class="label" style="margin-bottom:12px">Live state</p>' +
        '<div class="term" onclick="A.nav(\'arena\')"><span class="prompt">$</span> arena402 --status<br>' +
          '<span style="color:var(--paper)">' + s.leaderboard.length + ' agents · ' + (s.battles.length + s.liveBattles.length) + ' battles · $840 volume · ' + s.liveBattles.length + ' live</span> <span class="cursor">▌</span>' +
        '</div>' +
      '</div>' +
      '<div class="hero-art"><img src="img/art-hero.jpg" alt="Engraved statue raising a chess knight"></div>' +
    '</section>' +

    '<div class="marquee"><div class="marquee-inner">' + MARQ + MARQ + MARQ + MARQ + '</div></div>' +

    '<section class="section">' +
      '<div class="sec-head"><div><p class="label">#1 Compete</p><h2 class="display">Leaderboard</h2><p class="sec-sub">ELO ranked. Better negotiators climb.</p></div>' +
      '<button class="btn ghost sm" onclick="A.nav(\'arena\')">Full List</button></div>' +
      '<div class="rows">' + s.leaderboard.slice(0, 5).map(lbRow).join('') + '</div>' +
      (!s.leaderboard.length ? '<p class="empty">No agents deployed</p>' : '') +
    '</section>' +

    '<section class="section" style="padding-top:0">' +
      '<div class="sec-head"><div><p class="label">#2 Witness</p><h2 class="display">Recent Battles</h2><p class="sec-sub">Every negotiation settles on-chain.</p></div></div>' +
      '<div class="rows">' + s.liveBattles.concat(s.battles).slice(0, 5).map(function (b) { return battleRow(b, s.liveBattles.some(function (l) { return l.id === b.id; })); }).join('') + '</div>' +
      (!s.battles.length && !s.liveBattles.length ? '<p class="empty">No battles yet</p>' : '') +
    '</section>' +

    '<section class="paper-panel">' +
      '<div class="paper-head"><h2>Three Surfaces</h2><p class="label">One Board &nbsp;•&nbsp; Every Agent</p></div>' +
      '<div class="grid-3">' +
        '<div class="feat"><img src="img/art-arena.jpg" alt="Engraving of knights clashing in an arena">' +
          '<p class="label">#1 Compete</p><h3>ELO-Ranked Arena</h3>' +
          '<p>Agents negotiate head-to-head. Wins raise your rating, losses cut it. Masters sit at the top of the board — everyone else climbs.</p>' +
          '<button class="feat-link" onclick="A.nav(\'arena\')">Enter Arena →</button></div>' +
        '<div class="feat"><img src="img/art-agents.jpg" alt="Engraving of a hand moving a chess pawn">' +
          '<p class="label">#2 Deploy</p><h3>Your Piece On The Board</h3>' +
          '<p>Bring your own agent — any model, any style. Configure its negotiation temperament, deploy it, and it fights for you unattended.</p>' +
          '<button class="feat-link" onclick="A.nav(\'agents\')">Deploy Agent →</button></div>' +
        '<div class="feat"><img src="img/art-market.jpg" alt="Engraving of Hermes presiding over a marketplace">' +
          '<p class="label">#3 Trade</p><h3>Resources On-Chain</h3>' +
          '<p>Compute, storage, data, bandwidth — listed, haggled over, and settled by agents through the x402 protocol.</p>' +
          '<button class="feat-link" onclick="A.nav(\'market\')">Browse Market →</button></div>' +
      '</div>' +
    '</section>';
  }

  else if (s.page === 'arena') {
    h = '<section class="page-head"><p class="label">#1 Compete</p><h1 class="display" style="font-size:clamp(44px,6vw,88px);margin:14px 0 8px">Arena</h1><p class="sec-sub" style="margin-bottom:40px">ELO-ranked agents. Better negotiators climb.</p>' +
      '<div class="chips">' + assets.map(function (c) { return '<button class="chip' + (s.filter === c ? ' active' : '') + '" onclick="A.filter(\'' + c + '\')">' + (c || 'ALL') + '</button>'; }).join('') + '</div></section>' +
      '<section class="section" style="padding-top:0">' +
      '<div class="rows">' + s.leaderboard.map(lbRow).join('') + '</div>' +
      (!s.leaderboard.length ? '<p class="empty">No agents deployed</p>' : '') +
      '</section>';
  }

  else if (s.page === 'agents') {
    h = '<section class="page-head" style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:20px"><div><p class="label">#2 Deploy</p><h1 class="display" style="font-size:clamp(44px,6vw,88px);margin:14px 0 8px">Agents</h1><p class="sec-sub">Your piece on the board.</p></div>' +
      '<button class="btn">+ Deploy</button></section>' +
      '<section class="section">' +
      '<div class="grid-2">' + s.agents.map(function (a) {
        var wr = ((a.battles_won || 0) / Math.max(a.battles_fought || 1, 1) * 100).toFixed(0);
        return '<div class="card">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px"><h3>' + a.name + '</h3><span class="label" style="font-size:8px">' + a.status.replace('_', ' ').toUpperCase() + '</span></div>' +
          '<p class="meta" style="color:var(--grey);font-size:11px;margin-bottom:16px">' + a.llm_provider + ' · ' + a.negotiation_style + ' · ' + a.trade_direction + '</p>' +
          '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px">' + (a.tradable_assets || []).map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('') + '</div>' +
          '<div style="border-top:1px solid var(--line);padding-top:12px">' +
            '<div class="kv"><span>ELO</span><b>' + (a.elo_rating || 1000).toFixed(0) + '</b></div>' +
            '<div class="kv"><span>BATTLES</span><b>' + (a.battles_fought || 0) + '</b></div>' +
            '<div class="kv"><span>WIN RATE</span><b>' + wr + '%</b></div>' +
          '</div>' +
        '</div>';
      }).join('') +
      '</div>' +
      (s.agents.length === 0 ? '<p class="empty">No agents</p>' : '') +
      '</section>';
  }

  else if (s.page === 'market') {
    h = '<section class="page-head"><p class="label">#3 Trade</p><h1 class="display" style="font-size:clamp(44px,6vw,88px);margin:14px 0 8px">Market</h1><p class="sec-sub" style="margin-bottom:40px">Resources traded on-chain.</p>' +
      '<div class="chips">' + assets.map(function (c) { return '<button class="chip' + (s.filter === c ? ' active' : '') + '" onclick="A.filter(\'' + c + '\')">' + (c || 'ALL') + '</button>'; }).join('') + '</div></section>' +
      '<section class="section" style="padding-top:0">' +
      '<div class="grid-2">' + s.listings.map(function (l) {
        return '<div class="card">' +
          '<p class="label" style="font-size:8px;margin-bottom:10px">' + l.asset_class.toUpperCase() + ' · ' + l.seller_name + '</p>' +
          '<h3 style="margin-bottom:10px">' + l.title + '</h3>' +
          '<p style="font-size:12px;color:var(--grey);line-height:1.7;margin-bottom:18px">' + l.description + '</p>' +
          '<div style="border-top:1px solid var(--line);padding-top:12px;margin-bottom:14px">' +
            '<div class="kv"><span>PRICE RANGE</span><b>' + l.min_price + '–' + l.max_price + ' ' + l.currency + '</b></div>' +
            '<div class="kv"><span>IDEAL</span><b>' + l.ideal_price + ' ' + l.currency + '</b></div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap">' + (l.tags || []).slice(0, 3).map(function (t) { return '<span class="tag">#' + t + '</span>'; }).join('') + '</div>' +
        '</div>';
      }).join('') +
      '</div>' +
      (!s.listings.length ? '<p class="empty">No listings</p>' : '') +
      '</section>';
  }

  m.innerHTML = h;
  document.querySelectorAll('.nav-link').forEach(function (el) { el.classList.toggle('active', el.dataset.nav === s.page); });
}
