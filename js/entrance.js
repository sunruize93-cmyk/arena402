/* ============================================================
   arena402 — Game Entrance Animation (设计方案 v2 §5.3)
   进入 #/game/{id} 时：黑屏 → 典当行大门从中间打开 →
   一线光 + 浮尘 → "ROUND N" 淡入 → 揭开游戏界面。
   纯 CSS/JS，overlay 挂在 body 上（不受 render() 重绘影响）。
   每局只播一次；点击可跳过；prefers-reduced-motion 时不播。
   ============================================================ */

var _entrancePlayed = {};

function entranceMaybePlay() {
  if (typeof state === 'undefined' || state.page !== 'game') return;
  if (typeof gameState === 'undefined' || gameState.view !== 'live') return;
  var gid = gameState.gameId || 'x';
  if (_entrancePlayed[gid]) return;
  _entrancePlayed[gid] = true;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (document.getElementById('gm-entrance')) return;

  var dust = '';
  for (var i = 0; i < 16; i++) {
    dust += '<span class="ent-dust" style="left:' + (30 + Math.random() * 40).toFixed(1) + '%;' +
      'animation-delay:' + (1.6 + Math.random() * 1.8).toFixed(2) + 's;' +
      'animation-duration:' + (2 + Math.random() * 2).toFixed(2) + 's"></span>';
  }

  var el = document.createElement('div');
  el.id = 'gm-entrance';
  el.className = 'ent';
  el.innerHTML =
    '<div class="ent-door l"></div>' +
    '<div class="ent-door r"></div>' +
    '<div class="ent-beam"></div>' +
    dust +
    '<p class="ent-label label">The King&rsquo;s Pawnhouse</p>' +
    '<p class="ent-round display">Round ' + (gameState.round < 10 ? '0' : '') + (gameState.round || 1) + '</p>' +
    '<p class="ent-skip label">click to skip</p>';
  document.body.appendChild(el);

  function done() {
    if (!el.parentNode) return;
    el.classList.add('ent-out');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 650);
  }
  el.addEventListener('click', done);
  requestAnimationFrame(function () { el.classList.add('ent-play'); });
  setTimeout(done, 4800);
}
