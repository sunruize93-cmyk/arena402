/* ============================================================
   arena402 — Game State (倒爷黑市 / GAME_DESIGN v1)
   Implements FRONTEND_GUIDE §11 steps 1–6, 8–9 (state side):
   routes (lobby / live / result), snapshot fetch, Supabase
   Realtime channels, phase machine, demo engine fallback.

   Views:  gameState.view = 'lobby' | 'live' | 'result'
   Routes: #/game  ·  #/game/{id}  ·  #/game/{id}/result
   Phases: IDLE → DECIDE → PAIRING → NEGOTIATING → SETTLING
   ============================================================ */

var GAME_PHASES = ['IDLE', 'DECIDE', 'PAIRING', 'NEGOTIATING', 'SETTLING'];

var GAME_PHASE_LABEL = {
  IDLE: 'Idle', DECIDE: 'Decide', PAIRING: 'Pairing',
  NEGOTIATING: 'Negotiating', SETTLING: 'Settling'
};

/* DB phase → UI phase */
var GAME_PHASE_FROM_DB = {
  idle: 'IDLE', decide: 'DECIDE', pairing: 'PAIRING',
  negotiate: 'NEGOTIATING', settle: 'SETTLING'
};

var gameState = {
  view: 'lobby',              // lobby | live | result
  gameId: null,
  demo: true,                 // demo engine vs live Supabase feed
  started: false,
  lobbyGames: [],             // [{id, status, current_round, total_rounds}]
  lobbyLoaded: false,

  phase: 'IDLE',
  round: 0,
  totalRounds: 8,
  countdown: 0,

  goods: {
    ruby: { label: 'Ruby', sym: '◆', ref: 9.2, prev: 9.2 },
    gold: { label: 'Gold', sym: '●', ref: 11.0, prev: 11.0 }
  },

  events: [],                 // [{round, kind, text, prob?, revealed?}]
  agents: [],                 // [{id,name,cash,holdings,failed,status,decision,kind}]
  pools: {},                  // good -> {buy:[ids], sell:[ids]} FCFS order
  pairings: [],               // [{id,good,buyerId,sellerId,status}]
  negotiations: {},           // pairingId -> {turns:[{turn,from,type,price,message,t}], result?, price?}
  settlements: [],            // [{pairingId,amount,tx,status}]
  rankings: [],               // result page: [{agentId,name,netWorth,rank,cash,goodsValue}]
  settlePrices: {},           // good -> final price
  log: [],

  selectedPairing: null,
  focusAgent: null,
  seenMsgCount: {},
  _negToPairing: {},          // live mode: negotiation_id -> pairing_id
  _roundIds: {}               // live mode: round_id -> round_no
};

/* ---- helpers ---- */

function gameNow() {
  var d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) { return n < 10 ? '0' + n : n; }).join(':');
}

function gameLog(text, cls) {
  gameState.log.push({ t: gameNow(), text: text, cls: cls || '' });
  if (gameState.log.length > 80) gameState.log.shift();
}

function gameAgent(id) {
  for (var i = 0; i < gameState.agents.length; i++) if (gameState.agents[i].id === id) return gameState.agents[i];
  return null;
}

function gameSetPhase(phase, seconds) {
  gameState.phase = phase;
  gameState.countdown = seconds || 0;
  gameLog('phase → ' + phase + (seconds ? ' (' + seconds + 's)' : ''), 'phase');
  if (state.page === 'game') render();
}

function gameRender() { if (state.page === 'game') render(); }

/* ---- countdown ticker (cheap DOM patch; red flash ≤5s) ---- */

var gameTickIv = null;
function gameTickStart() {
  if (gameTickIv) return;
  gameTickIv = setInterval(function () {
    if (gameState.countdown > 0) {
      gameState.countdown--;
      var el = document.getElementById('gm-countdown');
      if (el) {
        el.textContent = gameFmtCountdown();
        el.classList.toggle('warn', gameState.countdown <= 5);
      }
    }
  }, 1000);
}
function gameFmtCountdown() {
  var s = gameState.countdown;
  return (s < 10 ? '0' : '') + Math.floor(s / 60) + ':' + ((s % 60) < 10 ? '0' : '') + (s % 60);
}

/* ============================================================
   ROUTING — #/game · #/game/{id} · #/game/{id}/result
   ============================================================ */

function gameHandleHash() {
  var h = window.location.hash || '';
  var mResult = h.match(/^#\/game\/([\w-]+)\/result/);
  var mLive   = h.match(/^#\/game\/([\w-]+)$/);
  var mLobby  = /^#\/game\/?$/.test(h);

  if (mResult)     { gameOpen(mResult[1], 'result'); }
  else if (mLive)  { gameOpen(mLive[1], 'live'); }
  else if (mLobby) { gameOpenLobby(); }
}
window.addEventListener('hashchange', gameHandleHash);

function gameOpenLobby() {
  gameState.view = 'lobby';
  if (state.page !== 'game') state.page = 'game';
  gameLobbyFetch();
  render();
}

function gameOpen(id, view) {
  var switching = gameState.gameId !== id;
  gameState.gameId = id;
  gameState.view = view || 'live';
  if (switching) { gameState.started = false; gameResetMatchState(); }
  if (state.page !== 'game') state.page = 'game';
  render();
}

function gameResetMatchState() {
  gameState.phase = 'IDLE'; gameState.round = 0; gameState.countdown = 0;
  gameState.events = []; gameState.agents = []; gameState.pools = {};
  gameState.pairings = []; gameState.negotiations = {}; gameState.settlements = [];
  gameState.rankings = []; gameState.settlePrices = {}; gameState.log = [];
  gameState.selectedPairing = null; gameState.focusAgent = null;
  gameState.seenMsgCount = {}; gameState._negToPairing = {}; gameState._roundIds = {};
}

/* ---- entry, called by the render layer ---- */

function gameEnsureStarted() {
  if (gameState.started || gameState.view === 'lobby') return;
  gameState.started = true;
  gameTickStart();
  gameState.demo = (gameState.gameId === 'demo' || !gameState.gameId);
  if (!gameState.demo) {
    var ok = false;
    try { ok = gameRealtimeInit(); } catch (e) { console.warn('game realtime init failed', e); }
    if (!ok) { gameState.demo = true; }
  }
  if (gameState.demo && gameState.view !== 'result') gameDemoStart();
  if (gameState.demo && gameState.view === 'result') gameDemoResultOnly();
}

/* ============================================================
   STEP 9 (data) — LOBBY: list waiting/playing games, create/join
   ============================================================ */

var _gameLobbyFetching = false;
var _gameLobbyRetries = 0;
function gameLobbyFetch() {
  if (_gameLobbyFetching || gameState.lobbyLoaded) return;
  var sb = getSB();
  if (!sb) {
    // Supabase script is deferred — retry until ready (max ~15s)
    if (_gameLobbyRetries++ < 15) setTimeout(gameLobbyFetch, 1000);
    else { gameState.lobbyLoaded = true; gameRender(); }
    return;
  }
  _gameLobbyFetching = true;
  sb.from('games').select('*').order('created_at', { ascending: false }).limit(12)
    .then(function (r) {
      gameState.lobbyGames = r.data || [];
      gameState.lobbyLoaded = true;
      gameRender();
    })
    .catch(function () { gameState.lobbyLoaded = true; gameRender(); });
}

function gameCreate() {
  var sb = getSB();
  if (!sb) { gameLog('Supabase not loaded — cannot create game', 'bust'); render(); return; }
  sb.from('games').insert({ status: 'waiting', total_rounds: 8 }).select().single()
    .then(function (r) {
      if (r.error || !r.data) {
        console.warn('create game failed', r.error);
        gameLog('create game failed — run db/migrations/002_game_tables.sql first', 'bust');
        gameRender();
        return;
      }
      window.location.hash = '#/game/' + r.data.id;
    });
}

/* ============================================================
   STEPS 3–5 — SNAPSHOT FETCH (game_players/holdings, rounds/
   pools/events, negotiations/neg_messages, settlements)
   ============================================================ */

function gameFetchSnapshot(gid) {
  var sb = getSB();
  if (!sb) return;

  sb.from('games').select('*').eq('id', gid).single().then(function (r) {
    if (!r.data) return;
    gameState.totalRounds = r.data.total_rounds;
    gameState.round = r.data.current_round;
    if (r.data.status === 'finished' && gameState.view === 'live') gameState.view = 'result';
    gameRender();
  });

  // Step 3: agent list = game_players + holdings (+ agents for names)
  Promise.all([
    sb.from('game_players').select('*').eq('game_id', gid),
    sb.from('holdings').select('*').eq('game_id', gid),
    sb.from('agents').select('id,name')
  ]).then(function (rs) {
    var players = rs[0].data || [], holds = rs[1].data || [], agents = rs[2].data || [];
    var names = {};
    agents.forEach(function (a) { names[a.id] = a.name; });
    gameState.agents = players.map(function (p) {
      var h = {};
      holds.forEach(function (row) { if (row.agent_id === p.agent_id) h[row.good] = row.qty; });
      return {
        id: p.agent_id, name: names[p.agent_id] || ('Agent ' + String(p.agent_id).slice(0, 6)),
        cash: +p.current_cash, holdings: h, failed: p.failed_count,
        status: 'idle', decision: null, kind: 'ai'
      };
    });
    gameRender();
  }).catch(function (e) { console.warn('players snapshot failed', e); });

  // Step 4: current round + pools + events
  sb.from('rounds').select('*').eq('game_id', gid).order('round_no', { ascending: false }).limit(1)
    .then(function (r) {
      var row = (r.data || [])[0];
      if (!row) return;
      gameState._roundIds[row.id] = row.round_no;
      gameState.round = row.round_no;
      gameState.phase = GAME_PHASE_FROM_DB[row.phase] || 'IDLE';
      return Promise.all([
        sb.from('pools').select('*').eq('round_id', row.id).order('entered_at'),
        sb.from('game_events').select('*').eq('round_id', row.id),
        sb.from('pairings').select('*').eq('round_id', row.id)
      ]).then(function (rs) {
        (rs[0].data || []).forEach(gameApplyPool);
        (rs[1].data || []).forEach(function (e) { gameApplyEvent(e, row.round_no); });
        (rs[2].data || []).forEach(gameApplyPairing);
        gameRender();
      });
    }).catch(function (e) { console.warn('round snapshot failed', e); });

  // Step 8 data (if finished): rankings + settle prices
  sb.from('game_rankings').select('*').eq('game_id', gid).order('rank').then(function (r) {
    if (r.data && r.data.length) {
      gameState.rankings = r.data.map(function (row) {
        var a = gameAgent(row.agent_id);
        return { agentId: row.agent_id, name: a ? a.name : String(row.agent_id).slice(0, 6),
                 netWorth: +row.net_worth, rank: row.rank };
      });
      gameRender();
    }
  });
  sb.from('settle_prices').select('*').eq('game_id', gid).then(function (r) {
    (r.data || []).forEach(function (row) { gameState.settlePrices[row.good] = +row.final_price; });
    gameRender();
  });
}

/* ---- row → state appliers (shared by snapshot & realtime) ---- */

function gameApplyPool(row) {
  var g = row.good;
  if (!gameState.pools[g]) gameState.pools[g] = { buy: [], sell: [] };
  var arr = gameState.pools[g][row.direction];
  if (arr && arr.indexOf(row.agent_id) === -1) {
    arr.push(row.agent_id);
    var a = gameAgent(row.agent_id);
    if (a) { a.status = 'pooled'; a.decision = { dir: row.direction, good: g }; }
    gameLog((a ? a.name : row.agent_id) + ' → ' + row.direction.toUpperCase() + ' ' + g + ' pool (#' + arr.length + ')', 'pool');
  }
}

function gameApplyEvent(row, roundNo) {
  gameState.events.push({
    round: roundNo || gameState.round,
    kind: row.type === 'probabilistic' ? 'prob' : 'certain',
    text: row.description,
    prob: row.params && row.params.probability,
    revealed: !!row.revealed_result
  });
  gameLog('event: ' + row.description, 'event');
}

function gameApplyPairing(row) {
  for (var i = 0; i < gameState.pairings.length; i++) {
    if (gameState.pairings[i].id === row.id) {
      gameState.pairings[i].status = row.result === 'done' ? gameState.pairings[i].status : 'live';
      return;
    }
  }
  gameState.pairings.push({ id: row.id, good: row.good, buyerId: row.buyer_id, sellerId: row.seller_id, status: 'live' });
  gameState.negotiations[row.id] = gameState.negotiations[row.id] || { turns: [] };
  var b = gameAgent(row.buyer_id), s = gameAgent(row.seller_id);
  if (b) b.status = 'paired';
  if (s) s.status = 'paired';
  if (!gameState.selectedPairing) gameState.selectedPairing = row.id;
  gameLog((b ? b.name : '?') + ' ⇄ ' + (s ? s.name : '?') + ' matched on ' + row.good + ' (FCFS)', 'pair');
}

/* ============================================================
   STEP 6 — REALTIME: subscribe all game channels
   rounds · pools · pairings · negotiations · neg_messages ·
   settlements · game_events (+ games row for status)
   ============================================================ */

function gameRealtimeInit() {
  var sb = getSB();
  var gid = gameState.gameId;
  if (!sb || !gid) return false;

  gameFetchSnapshot(gid);

  function sub(ch, table, filter, handler) {
    ch.on('postgres_changes', { event: '*', schema: 'public', table: table, filter: filter }, function (payload) {
      try { handler(payload.new || payload.old || {}); } catch (e) { console.warn(table + ' handler failed', e); }
      gameRender();
    });
  }

  var ch = sb.channel('game-' + gid);

  sub(ch, 'games', 'id=eq.' + gid, function (row) {
    gameState.round = row.current_round;
    gameState.totalRounds = row.total_rounds;
    if (row.status === 'finished') {
      gameState.view = 'result';
      gameLog('game finished — final clearing', 'deal');
    }
  });

  sub(ch, 'rounds', 'game_id=eq.' + gid, function (row) {
    gameState._roundIds[row.id] = row.round_no;
    var newRound = row.round_no > gameState.round;
    gameState.round = row.round_no;
    if (newRound) {
      gameState.pools = {}; gameState.pairings = []; gameState.selectedPairing = null;
      gameState.agents.forEach(function (a) { a.status = 'idle'; a.decision = null; });
    }
    gameState.phase = GAME_PHASE_FROM_DB[row.phase] || 'IDLE';
    gameLog('round ' + row.round_no + ' · phase → ' + gameState.phase, 'phase');
  });

  sub(ch, 'pools', null, function (row) { if (gameState._roundIds[row.round_id] != null) gameApplyPool(row); });
  sub(ch, 'game_events', null, function (row) { if (gameState._roundIds[row.round_id] != null) gameApplyEvent(row); });
  sub(ch, 'pairings', null, function (row) { if (gameState._roundIds[row.round_id] != null) gameApplyPairing(row); });

  sub(ch, 'negotiations', null, function (row) {
    gameState._negToPairing[row.id] = row.pairing_id;
    var neg = gameState.negotiations[row.pairing_id];
    if (!neg) return;
    if (row.result === 'dealt') { neg.result = 'deal'; neg.price = +row.final_price; gamePairingStatus(row.pairing_id, 'deal'); }
    if (row.result === 'broke' || row.result === 'timeout') { neg.result = 'bust'; gamePairingStatus(row.pairing_id, 'bust'); }
  });

  sub(ch, 'neg_messages', null, function (row) {
    var pid = gameState._negToPairing[row.negotiation_id];
    if (!pid || !gameState.negotiations[pid]) return;
    gameState.negotiations[pid].turns.push({
      turn: row.turn, from: row.from_role, type: row.type,
      price: row.price != null ? +row.price : null,
      message: row.message || '', t: gameNow()
    });
    if (row.type === 'propose') {
      var pg = gamePairingById(pid);
      var who = pg && gameAgent(row.from_role === 'buyer' ? pg.buyerId : pg.sellerId);
      gameLog((who ? who.name : row.from_role) + ' offers ' + row.price + ' — “' + (row.message || '') + '”', 'neg');
    }
  });

  sub(ch, 'settlements', null, function (row) {
    var pid = gameState._negToPairing[row.negotiation_id];
    gameState.settlements.push({ pairingId: pid, amount: +row.amount, tx: row.x402_tx_hash || '…', status: row.status });
    gameLog('x402 settlement ' + (row.x402_tx_hash || '') + ' · ' + row.status, 'deal');
  });

  ch.subscribe(function (status) {
    if (status === 'SUBSCRIBED') gameLog('realtime connected — game ' + gid, 'sys');
  });

  return true;
}

function gamePairingById(pid) {
  for (var i = 0; i < gameState.pairings.length; i++) if (gameState.pairings[i].id === pid) return gameState.pairings[i];
  return null;
}

function gamePairingStatus(pid, st) {
  var pg = gamePairingById(pid);
  if (!pg) return;
  pg.status = st;
  var b = gameAgent(pg.buyerId), s = gameAgent(pg.sellerId);
  if (st === 'deal') { if (b) b.status = 'dealt'; if (s) s.status = 'dealt'; }
  if (st === 'bust') {
    if (b) { b.status = 'busted'; b.failed++; }
    if (s) { s.status = 'busted'; s.failed++; }
  }
}

/* ============================================================
   DEMO ENGINE — scripted match for expo / no-backend preview.
   ============================================================ */

var GAME_DEMO_NAMES = ['Kasparov-9', 'Marketmaker', 'Coldhand', 'Bazaar Fox', 'Deep Pawn', 'Silk刀', 'Ledger Monk', 'Gambit'];

function gameDemoStart() {
  if (gameState.agents.length) return;
  gameState.gameId = gameState.gameId || 'demo';
  gameState.agents = GAME_DEMO_NAMES.map(function (n, i) {
    return { id: 'a' + i, name: n, cash: 100, holdings: { ruby: 5, gold: 2 },
             failed: 0, status: 'idle', decision: null, kind: i < 6 ? 'ai' : 'rule' };
  });
  gameLog('8 agents seated · bankroll 100 USDC · holdings 5◆ 2●', 'sys');
  gameLog('settlement: on-chain x402 (Injective) — platform never touches funds', 'sys');
  gameDemoRound();
}

function gameDemoRound() {
  if (state.page !== 'game' && gameState.round >= 1) { setTimeout(gameDemoRound, 2000); return; }
  if (gameState.round >= gameState.totalRounds) { gameDemoFinish(); return; }

  gameState.round++;

  // drift reference prices; keep prev for trend arrows
  Object.keys(gameState.goods).forEach(function (k) {
    var gd = gameState.goods[k];
    gd.prev = gd.ref;
    gd.ref = +(gd.ref * (0.97 + Math.random() * 0.06)).toFixed(1);
  });

  var ev = gameDemoEvent(gameState.round);
  if (ev) { gameState.events.push(ev); gameLog('event: ' + ev.text, 'event'); }

  gameSetPhase('DECIDE', 12);
  gameState.pairings = [];
  gameState.selectedPairing = null;
  gameState.pools = { ruby: { buy: [], sell: [] }, gold: { buy: [], sell: [] } };
  gameState.agents.forEach(function (a) { a.status = 'idle'; a.decision = null; });

  var order = gameState.agents.slice().sort(function () { return Math.random() - 0.5; });
  order.forEach(function (a, i) {
    setTimeout(function () {
      var r = Math.random();
      if (r < 0.25) { a.decision = 'pass'; gameLog(a.name + ' passes', 'dim'); gameRender(); return; }
      var good = Math.random() < 0.6 ? 'ruby' : 'gold';
      var dir = Math.random() < 0.5 ? 'buy' : 'sell';
      gameState.pools[good][dir].push(a.id);
      a.status = 'pooled';
      a.decision = { dir: dir, good: good };
      gameLog(a.name + ' → ' + dir.toUpperCase() + ' ' + gameState.goods[good].label + ' pool (#' + gameState.pools[good][dir].length + ')', 'pool');
      gameRender();
    }, 600 + i * 700);
  });

  setTimeout(function () {
    gameSetPhase('PAIRING', 6);
    Object.keys(gameState.pools).forEach(function (good) {
      var p = gameState.pools[good];
      var n = Math.min(p.buy.length, p.sell.length);
      for (var i = 0; i < n; i++) {
        var pid = 'r' + gameState.round + '-' + good + '-' + i;
        gameState.pairings.push({ id: pid, good: good, buyerId: p.buy[i], sellerId: p.sell[i], status: 'live' });
        gameState.negotiations[pid] = { turns: [] };
        gameAgent(p.buy[i]).status = 'paired';
        gameAgent(p.sell[i]).status = 'paired';
        gameLog(gameAgent(p.buy[i]).name + ' ⇄ ' + gameAgent(p.sell[i]).name + ' matched on ' + gameState.goods[good].label + ' (FCFS)', 'pair');
      }
      var un = Math.abs(p.buy.length - p.sell.length);
      if (un) gameLog(un + ' agent(s) unmatched in ' + gameState.goods[good].label + ' pool — no penalty', 'dim');
    });
    if (!gameState.pairings.length) gameLog('no pairs this round', 'dim');
    if (gameState.pairings.length) gameState.selectedPairing = gameState.pairings[0].id;
    gameRender();
  }, 600 + order.length * 700 + 800);

  var negStartAt = 600 + order.length * 700 + 800 + 2500;
  setTimeout(function () {
    gameSetPhase('NEGOTIATING', 30);
    gameState.pairings.forEach(function (pg, idx) { gameDemoNegotiate(pg, idx * 1200); });
  }, negStartAt);

  setTimeout(function () {
    gameSetPhase('SETTLING', 8);
    setTimeout(function () {
      gameLog('round ' + gameState.round + ' settled · leaderboard refreshed', 'sys');
      gameDemoRound();
    }, 4000);
  }, negStartAt + 14000);
}

function gameDemoEvent(round) {
  var evs = [
    null,
    { round: 1, kind: 'certain', text: '👑 Palace shortage — buying 15 Ruby @ 15, this round only' },
    null,
    { round: 3, kind: 'prob', prob: 0.4, text: '⚔️ War rumour — 40% Ruby −20% / Gold +20%, reveals in R5' },
    null,
    { round: 5, kind: 'prob', text: '⚔️ War revealed: DID NOT happen — prices return to baseline', revealed: true },
    { round: 6, kind: 'certain', text: '⛏️ Mine flood — Gold circulating supply −10%' },
    null
  ];
  return evs[round] || null;
}

var GAME_DEMO_LINES = {
  open:   ['这批成色好，{p} 今天就能交割', '急出，{p} 一口价，过时不候', '{p}，看在你信用不错的份上', '市面都在抛，{p} 已经是友情价'],
  counter:['{p} 太狠了，{q} 才有得谈', '王宫在收货，你这价说不过去，{q}', '{q}，再低我就等下回合', '成色一般，{q} 顶天了'],
  final:  ['{q}，最后一口，成不成', '就 {q}，我还有别的买家在等', '{q}，链上现结，不墨迹']
};

function gameDemoNegotiate(pg, delay) {
  var neg = gameState.negotiations[pg.id];
  var ref = gameState.goods[pg.good].ref;
  var buyer = gameAgent(pg.buyerId), seller = gameAgent(pg.sellerId);
  var bust = Math.random() < 0.3;
  var p1 = +(ref * (0.82 + Math.random() * 0.08)).toFixed(1);
  var p2 = +(ref * (1.05 + Math.random() * 0.1)).toFixed(1);
  var p3 = +((p1 + p2) / 2).toFixed(1);

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function say(turn, from, type, price, tmpl) {
    setTimeout(function () {
      var msg = tmpl ? tmpl.replace('{p}', price).replace('{q}', price) : '';
      neg.turns.push({ turn: turn, from: from, type: type, price: price, message: msg, t: gameNow() });
      if (type === 'propose') gameLog((from === 'buyer' ? buyer.name : seller.name) + ' offers ' + price + ' — “' + msg + '”', 'neg');
      gameRender();
    }, delay);
    delay += 2200 + Math.random() * 800;
  }

  say(1, 'buyer', 'propose', p1, pick(GAME_DEMO_LINES.open));
  say(1, 'seller', 'propose', p2, pick(GAME_DEMO_LINES.counter));
  say(2, 'buyer', 'propose', p3, pick(GAME_DEMO_LINES.final));

  setTimeout(function () {
    if (bust) {
      neg.turns.push({ turn: 2, from: 'seller', type: 'reject', message: '不卖了', t: gameNow() });
      neg.result = 'bust';
      gamePairingStatus(pg.id, 'bust');
      gameLog(buyer.name + ' × ' + seller.name + ' — BUST · failed count +1 both sides', 'bust');
    } else {
      neg.turns.push({ turn: 2, from: 'seller', type: 'accept', t: gameNow() });
      neg.result = 'deal';
      neg.price = p3;
      gamePairingStatus(pg.id, 'deal');
      buyer.cash = +(buyer.cash - p3).toFixed(1);
      seller.cash = +(seller.cash + p3).toFixed(1);
      buyer.holdings[pg.good] = (buyer.holdings[pg.good] || 0) + 1;
      seller.holdings[pg.good] = (seller.holdings[pg.good] || 0) - 1;
      var tx = '0x' + Math.random().toString(16).slice(2, 10) + '…';
      gameState.settlements.push({ pairingId: pg.id, amount: p3, tx: tx, status: 'confirmed' });
      gameLog(buyer.name + ' ✓ ' + seller.name + ' — DEAL @ ' + p3 + ' · x402 ' + tx, 'deal');
    }
    gameRender();
  }, delay);
}

/* ---- STEP 8 (demo) — final clearing → result view ---- */

function gameDemoFinish() {
  gameSetPhase('IDLE', 0);
  gameState.settlePrices = { ruby: 10.5, gold: 12.4 };
  gameLog('final clearing — holdings × settle table → net worth ranking', 'deal');
  gameComputeRankings();
  gameState.view = 'result';
  window.location.hash = '#/game/' + gameState.gameId + '/result';
  gameRender();
}

function gameDemoResultOnly() {
  // Deep link straight to a finished demo match
  if (!gameState.agents.length) {
    gameState.agents = GAME_DEMO_NAMES.map(function (n, i) {
      return {
        id: 'a' + i, name: n,
        cash: +(60 + Math.random() * 90).toFixed(1),
        holdings: { ruby: Math.floor(Math.random() * 9), gold: Math.floor(Math.random() * 5) },
        failed: Math.floor(Math.random() * 4),
        status: 'idle', decision: null, kind: i < 6 ? 'ai' : 'rule'
      };
    });
  }
  gameState.round = gameState.totalRounds;
  gameState.settlePrices = { ruby: 10.5, gold: 12.4 };
  gameComputeRankings();
}

function gameComputeRankings() {
  var rows = gameState.agents.map(function (a) {
    var goodsValue = 0;
    Object.keys(a.holdings).forEach(function (g) {
      goodsValue += (a.holdings[g] || 0) * (gameState.settlePrices[g] || gameState.goods[g].ref);
    });
    return { agentId: a.id, name: a.name, cash: a.cash, goodsValue: +goodsValue.toFixed(1),
             netWorth: +(a.cash + goodsValue).toFixed(1), failed: a.failed };
  }).sort(function (x, y) { return y.netWorth - x.netWorth; });
  rows.forEach(function (r, i) { r.rank = i + 1; });
  gameState.rankings = rows;
}

/* boot: honor deep link on first load */
gameHandleHash();
