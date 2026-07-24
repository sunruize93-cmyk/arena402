/* ============================================================
   arena402 — Game State (倒爷黑市 / GAME_DESIGN v1)
   State machine, round loop, demo engine, realtime stubs.

   OWNERSHIP (collaboration contract):
   - Cursor owns this file's STATE SHAPE + DEMO ENGINE + UI hooks.
   - Claude Code: to wire the real backend, implement the body of
     gameRealtimeInit() ONLY (marked below). Do not reshape
     gameState — render layer (js/game-render.js) reads it as-is.

   Phases (§2 of GAME_DESIGN):
     IDLE → DECIDE → PAIRING → NEGOTIATING → SETTLING → (next round)
   ============================================================ */

var GAME_PHASES = ['IDLE', 'DECIDE', 'PAIRING', 'NEGOTIATING', 'SETTLING'];

var GAME_PHASE_LABEL = {
  IDLE:        'Idle',
  DECIDE:      'Decide',
  PAIRING:     'Pairing',
  NEGOTIATING: 'Negotiating',
  SETTLING:    'Settling'
};

var gameState = {
  gameId: null,
  demo: true,                 // true until real channels are wired
  started: false,

  phase: 'IDLE',
  round: 0,
  totalRounds: 8,
  countdown: 0,               // seconds left in current phase

  goods: {
    ruby: { label: 'Ruby', sym: '◆', ref: 9.2 },
    gold: { label: 'Gold', sym: '●', ref: 11.0 }
  },

  events: [],                 // [{round, kind:'certain'|'prob', text, revealed?}]
  agents: [],                 // [{id, name, cash, holdings:{good:qty}, failed, status}]
  pools: {},                  // {good: {buy:[agentId...], sell:[agentId...]}}  FCFS order
  pairings: [],               // [{id, good, buyerId, sellerId, status:'live'|'deal'|'bust'}]
  negotiations: {},           // pairingId -> {turns:[{turn,from,type,price,message}], result?, price?}
  settlements: [],            // [{pairingId, amount, tx, status}]
  log: [],                    // bottom stream: [{t, text, cls}]

  selectedPairing: null,
  seenMsgCount: {}            // pairingId -> messages already typewritten (render bookkeeping)
};

/* ---- shared helpers ---- */

function gameLog(text, cls) {
  var d = new Date();
  var t = [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) { return n < 10 ? '0' + n : n; }).join(':');
  gameState.log.push({ t: t, text: text, cls: cls || '' });
  if (gameState.log.length > 60) gameState.log.shift();
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

/* ---- countdown ticker (UI only; cheap DOM patch, no full render) ---- */

var gameTickIv = null;
function gameTickStart() {
  if (gameTickIv) return;
  gameTickIv = setInterval(function () {
    if (gameState.countdown > 0) {
      gameState.countdown--;
      var el = document.getElementById('gm-countdown');
      if (el) el.textContent = gameFmtCountdown();
    }
  }, 1000);
}
function gameFmtCountdown() {
  var s = gameState.countdown;
  return (s < 10 ? '0' : '') + Math.floor(s / 60) + ':' + ((s % 60) < 10 ? '0' : '') + (s % 60);
}

/* ============================================================
   REALTIME WIRING — Claude Code implements THIS function only.
   Subscribe the 6 channels (§9 tables) and mutate gameState,
   then call render() (and gameLog() for the stream):
     rounds        → phase/round/countdown/events
     pools         → gameState.pools (keep FCFS array order)
     pairings      → gameState.pairings
     negotiations  → gameState.negotiations[pid].result/price
     neg_messages  → gameState.negotiations[pid].turns.push(...)
     settlements   → gameState.settlements.push(...)
   On success set gameState.demo = false BEFORE gameStart() runs
   so the demo engine stays off.
   ============================================================ */
function gameRealtimeInit() {
  // TODO(Claude Code): wire Supabase Realtime channels here.
  return false; // false = not wired yet, demo engine will run
}

/* ---- entry: called lazily by the render layer ---- */

function gameEnsureStarted() {
  if (gameState.started) return;
  gameState.started = true;
  gameTickStart();
  try { if (gameRealtimeInit()) gameState.demo = false; } catch (e) { console.warn('game realtime init failed', e); }
  if (gameState.demo) gameDemoStart();
}

/* ============================================================
   DEMO ENGINE — scripted match so the Game View is fully
   watchable at the expo with no backend. Removed from the flow
   automatically once gameRealtimeInit() returns true.
   ============================================================ */

var GAME_DEMO_NAMES = ['Kasparov-9', 'Marketmaker', 'Coldhand', 'Bazaar Fox', 'Deep Pawn', 'Silk刀', 'Ledger Monk', 'Gambit'];

function gameDemoStart() {
  if (gameState.agents.length) return;

  gameState.gameId = gameState.gameId || 'demo';
  gameState.agents = GAME_DEMO_NAMES.map(function (n, i) {
    return {
      id: 'a' + i, name: n,
      cash: 100,
      holdings: { ruby: 5, gold: 2 },
      failed: 0,
      status: 'idle' // idle | pooled | paired | dealt | busted
    };
  });
  gameLog('8 agents seated · bankroll 100 USDC · holdings 5◆ 2●', 'sys');
  gameLog('settlement: on-chain x402 (Injective) — platform never touches funds', 'sys');
  gameDemoRound();
}

function gameDemoRound() {
  if (state.page !== 'game' && gameState.round >= 1) {
    // Pause the script while the tab is elsewhere; resume on return
    setTimeout(gameDemoRound, 2000);
    return;
  }
  if (gameState.round >= gameState.totalRounds) {
    gameSetPhase('IDLE', 0);
    gameLog('final clearing — holdings × settle table → net worth ranking', 'deal');
    return;
  }

  gameState.round++;

  // — Step 0: broadcast event —
  var ev = gameDemoEvent(gameState.round);
  if (ev) { gameState.events.push(ev); gameLog('event: ' + ev.text, 'event'); }

  // — Step 1: DECIDE —
  gameSetPhase('DECIDE', 12);
  gameState.pairings = [];
  gameState.selectedPairing = null;
  gameState.pools = { ruby: { buy: [], sell: [] }, gold: { buy: [], sell: [] } };
  gameState.agents.forEach(function (a) { a.status = 'idle'; });

  var order = gameState.agents.slice().sort(function () { return Math.random() - 0.5; });
  order.forEach(function (a, i) {
    setTimeout(function () {
      var r = Math.random();
      if (r < 0.25) { gameLog(a.name + ' passes', 'dim'); return; }
      var good = Math.random() < 0.6 ? 'ruby' : 'gold';
      var dir = Math.random() < 0.5 ? 'buy' : 'sell';
      gameState.pools[good][dir].push(a.id);
      a.status = 'pooled';
      gameLog(a.name + ' → ' + dir.toUpperCase() + ' ' + gameState.goods[good].label + ' pool (#' + gameState.pools[good][dir].length + ')', 'pool');
      if (state.page === 'game') render();
    }, 600 + i * 700);
  });

  // — Step 2: PAIRING (FCFS) —
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
      var unmatched = Math.abs(p.buy.length - p.sell.length);
      if (unmatched) gameLog(unmatched + ' agent(s) unmatched in ' + gameState.goods[good].label + ' pool — no penalty', 'dim');
    });
    if (!gameState.pairings.length) gameLog('no pairs this round', 'dim');
    if (gameState.pairings.length) gameState.selectedPairing = gameState.pairings[0].id;
    if (state.page === 'game') render();
  }, 600 + order.length * 700 + 800);

  // — Step 3: NEGOTIATING —
  var negStartAt = 600 + order.length * 700 + 800 + 2500;
  setTimeout(function () {
    gameSetPhase('NEGOTIATING', 30);
    gameState.pairings.forEach(function (pg, idx) {
      gameDemoNegotiate(pg, idx * 1200);
    });
  }, negStartAt);

  // — Step 4: SETTLING → next round —
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
    { round: 3, kind: 'prob', text: '⚔️ War rumour — 40% Ruby −20% / Gold +20%, reveals in R5' },
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

  function say(turn, from, type, price, tmpl, after) {
    setTimeout(function () {
      var msg = tmpl ? tmpl.replace('{p}', price).replace('{q}', price) : '';
      neg.turns.push({ turn: turn, from: from, type: type, price: price, message: msg });
      if (type === 'propose') gameLog((from === 'buyer' ? buyer.name : seller.name) + ' offers ' + price + ' — “' + msg + '”', 'neg');
      if (state.page === 'game') render();
      if (after) after();
    }, delay);
    delay += 2200 + Math.random() * 800;
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  say(1, 'buyer', 'propose', p1, pick(GAME_DEMO_LINES.open));
  say(1, 'seller', 'propose', p2, pick(GAME_DEMO_LINES.counter));
  say(2, 'buyer', 'propose', p3, pick(GAME_DEMO_LINES.final));

  setTimeout(function () {
    if (bust) {
      neg.turns.push({ turn: 2, from: 'seller', type: 'reject', message: '不卖了' });
      neg.result = 'bust';
      pg.status = 'bust';
      buyer.failed++; seller.failed++;
      buyer.status = 'busted'; seller.status = 'busted';
      gameLog(buyer.name + ' × ' + seller.name + ' — BUST · failed count +1 both sides', 'bust');
    } else {
      neg.turns.push({ turn: 2, from: 'seller', type: 'accept' });
      neg.result = 'deal';
      neg.price = p3;
      pg.status = 'deal';
      buyer.status = 'dealt'; seller.status = 'dealt';
      buyer.cash = +(buyer.cash - p3).toFixed(1);
      seller.cash = +(seller.cash + p3).toFixed(1);
      buyer.holdings[pg.good]++; seller.holdings[pg.good]--;
      var tx = '0x' + Math.random().toString(16).slice(2, 10) + '…';
      gameState.settlements.push({ pairingId: pg.id, amount: p3, tx: tx, status: 'confirmed' });
      gameLog(buyer.name + ' ✓ ' + seller.name + ' — DEAL @ ' + p3 + ' · x402 ' + tx, 'deal');
    }
    if (state.page === 'game') render();
  }, delay);
}

/* ---- deep link: #/game/{id} (7-route plan; SPA-internal) ---- */

function gameHandleHash() {
  var m = (window.location.hash || '').match(/^#\/game\/([\w-]+)/);
  if (m) {
    gameState.gameId = m[1];
    if (state.page !== 'game') { state.page = 'game'; render(); }
  }
}
window.addEventListener('hashchange', gameHandleHash);
gameHandleHash();
