/* ============================================================
   arena402 — CRT Terminal Renderer (设计方案 v2 §4/§12)
   Renders negotiations inside a CRT terminal window:
   typewriter printing, blinking cursor, scanlines (css),
   thinking progress, trade confirmed / channel closed states.

   Survives full render() wipes: per-line typed progress is kept
   in _termTyped (key -> chars typed | true), so re-renders resume
   typing instead of restarting.
   ============================================================ */

var _termTyped = {};      // lineKey -> chars typed (number) or true (done)
var _termQueue = [];      // [{key, text, el}] rebuilt after each render
var _termIv = null;

/* Build the stable line list for a pairing's negotiation.
   Text must be deterministic across renders (no "now" timestamps). */
function termBuildLines(pid) {
  var g = gameState;
  var pg = gamePairingById(pid);
  var neg = g.negotiations[pid];
  if (!neg) return [];
  var buyer = pg && gameAgent(pg.buyerId), seller = pg && gameAgent(pg.sellerId);
  var goodLabel = (pg && g.goods[pg.good]) ? g.goods[pg.good].label.toUpperCase() : 'GOODS';
  var t0 = (neg.turns[0] && neg.turns[0].t) || '--:--:--';
  var L = [];
  function push(key, cls, text) { L.push({ key: pid + ':' + key, cls: cls, text: text }); }

  push('h1', 'sys', '[' + t0 + '] BUYER connected — ' + (buyer ? buyer.name : '?'));
  push('h2', 'sys', '[' + t0 + '] SELLER connected — ' + (seller ? seller.name : '?'));
  push('h3', 'sys', 'CHANNEL: ' + goodLabel + ' ──────────────────');

  for (var i = 0; i < neg.turns.length; i++) {
    var t = neg.turns[i];
    var who = t.from === 'buyer' ? 'BUYER' : 'SELLER';
    if (t.type === 'accept') {
      push('t' + i, 'ok', '$ ' + who + ' > ACCEPT ' + t.price + ' USDC  ✓');
      push('t' + i + 'c', 'ok hl', '═══ TRADE CONFIRMED ═══');
    } else if (t.type === 'reject') {
      push('t' + i, 'bad', '$ ' + who + ' > REJECT  ✗');
      push('t' + i + 'c', 'bad hl', '═══ CHANNEL CLOSED — NO DEAL ═══');
    } else {
      var verb = t.type === 'propose' ? 'propose' : 'counter';
      push('t' + i, t.from, '$ ' + who + ' > ' + verb + ' ' + t.price + ' USDC   [TURN ' + t.turn + '/3]');
      if (t.message) push('t' + i + 'm', t.from + ' quote', '│ “' + t.message + '”');
    }
  }

  if (neg.result === 'deal') {
    for (var j = 0; j < g.settlements.length; j++) {
      if (g.settlements[j].pairingId === pid) {
        push('tx', 'ok', 'TX: ' + g.settlements[j].tx + '  ✓  x402 · ' + g.settlements[j].status);
        break;
      }
    }
  }
  if (neg.result) push('end', 'sys', 'SESSION CLOSED');
  return L;
}

/* HTML shell for the terminal (called from gmNegotiation). */
function termHtml(pid) {
  var g = gameState;
  var pg = gamePairingById(pid);
  var neg = g.negotiations[pid];
  var buyer = pg && gameAgent(pg.buyerId), seller = pg && gameAgent(pg.sellerId);
  var lines = termBuildLines(pid);

  var body = lines.map(function (l) {
    var done = _termTyped[l.key] === true;
    return '<div class="crt-line ' + l.cls + '" data-key="' + l.key + '">' +
      (done ? escHtml(l.text) : '') + '</div>';
  }).join('');

  // waiting for next turn → thinking indicator (not typed, pure CSS)
  var thinking = '';
  if (neg && !neg.result && pg && pg.status === 'live' && neg.turns.length) {
    var next = neg.turns[neg.turns.length - 1].from === 'buyer' ? 'SELLER' : 'BUYER';
    thinking = '<div class="crt-line think">$ ' + next + ' > ...thinking...' +
      '<span class="crt-progress"><span class="crt-progress-fill"></span></span></div>';
  }
  if (neg && !neg.turns.length) {
    thinking = '<div class="crt-line think">$ BUYER > awaiting opening offer' +
      '<span class="crt-progress"><span class="crt-progress-fill"></span></span></div>';
  }

  var turnNo = neg && neg.turns.length ? neg.turns[neg.turns.length - 1].turn : 0;
  var rep = 'REP: ' + (buyer ? buyer.failed : 0) + '× / ' + (seller ? seller.failed : 0) + '× failed';

  return '<div class="crt" data-pid="' + pid + '">' +
    '<div class="crt-bar"><span class="crt-dots"><i></i><i></i><i></i></span>' +
      '<span class="crt-bar-title">THE KING&rsquo;S PAWNHOUSE — NEGOTIATION</span></div>' +
    '<div class="crt-meta label"><span>[TURN ' + turnNo + '/3]</span><span>' + escHtml(rep) + '</span></div>' +
    '<div class="crt-body" id="gm-crt-body">' + body + thinking +
      '<span class="crt-cursor" aria-hidden="true">▊</span></div>' +
  '</div>';
}

/* Post-render: hook DOM elements into the typing queue and run it. */
function termAfterRender() {
  var el = document.querySelector('.crt[data-pid]');
  if (!el) { _termQueue = []; return; }
  var pid = el.getAttribute('data-pid');
  var lines = termBuildLines(pid);
  _termQueue = [];
  for (var i = 0; i < lines.length; i++) {
    var node = el.querySelector('[data-key="' + lines[i].key + '"]');
    if (node && _termTyped[lines[i].key] !== true) {
      _termQueue.push({ key: lines[i].key, text: lines[i].text, cls: lines[i].cls, el: node });
    }
  }
  termScroll();
  if (_termQueue.length && !_termIv) _termIv = setInterval(termTick, 22);
}

function termTick() {
  if (!_termQueue.length) { clearInterval(_termIv); _termIv = null; return; }
  var l = _termQueue[0];
  if (!document.body.contains(l.el)) { // stale after re-render; will re-hook next render
    _termQueue.shift(); return;
  }
  var n = (_termTyped[l.key] || 0) + 1;
  _termTyped[l.key] = n;
  l.el.textContent = l.text.slice(0, n);
  if (n >= l.text.length) {
    _termTyped[l.key] = true;
    _termQueue.shift();
    if (l.cls.indexOf('hl') >= 0) termVerdictFx(l.cls.indexOf('ok') >= 0);
  }
  termScroll();
}

function termScroll() {
  var b = document.getElementById('gm-crt-body');
  if (b) b.scrollTop = b.scrollHeight;
}

/* 成交：全屏微闪；谈崩：终端抖动 (v2 §5.2) */
function termVerdictFx(isDeal) {
  var el = document.querySelector('.crt');
  if (isDeal) {
    document.body.classList.add('gm-flash');
    setTimeout(function () { document.body.classList.remove('gm-flash'); }, 450);
  } else if (el) {
    el.classList.add('crt-shake');
    setTimeout(function () { el.classList.remove('crt-shake'); }, 500);
  }
}
