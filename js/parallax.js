/* ============================================================
   arena402 — Parallax / Scroll Engine (设计方案 v2 §5)
   - .scroll-parallax [data-parallax=speed] : 随滚动微位移
   - .scroll-reveal                          : 进入视口时钉入动画
   - [data-tilt]                             : 随鼠标 3D 倾斜
   - .hero .display                          : 字间距随滚动微增
   Vanilla JS, rAF-throttled. Honors prefers-reduced-motion.
   ============================================================ */

(function () {
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  var ticking = false;

  function applyScroll() {
    ticking = false;
    var y = window.scrollY || 0;
    document.documentElement.style.setProperty('--scroll-y', y + 'px');

    var els = document.querySelectorAll('.scroll-parallax');
    for (var i = 0; i < els.length; i++) {
      var speed = parseFloat(els[i].getAttribute('data-parallax') || '0.05');
      els[i].style.transform = 'translateY(' + (-y * speed).toFixed(1) + 'px)';
    }

    // Hero 大字：字间距随滚动增大 + 阴影加深（前 400px 内）
    var hero = document.querySelector('.hero .display');
    if (hero) {
      var t = Math.min(y / 400, 1);
      hero.style.letterSpacing = (t * 2.5).toFixed(2) + 'px';
      hero.style.textShadow = '0 ' + (t * 6).toFixed(1) + 'px ' + (t * 14).toFixed(1) + 'px rgba(0,0,0,' + (t * 0.35).toFixed(2) + ')';
    }
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(applyScroll); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // ---- reveal on enter viewport ----
  var io = ('IntersectionObserver' in window)
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in-view'); io.unobserve(en.target); }
        });
      }, { threshold: 0.15 })
    : null;

  function watchReveals() {
    if (!io) return;
    var els = document.querySelectorAll('.scroll-reveal:not(.in-view)');
    for (var i = 0; i < els.length; i++) io.observe(els[i]);
  }

  // ---- mouse tilt ----
  function onMove(e) {
    var els = document.querySelectorAll('[data-tilt]');
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      if (!r.width) continue;
      var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      var img = els[i].querySelector('img') || els[i];
      img.style.transform = 'perspective(900px) rotateY(' + (dx * 4).toFixed(2) + 'deg) rotateX(' + (-dy * 4).toFixed(2) + 'deg)';
    }
  }
  document.addEventListener('mousemove', onMove, { passive: true });

  // re-hook after every render() (innerHTML wipes)
  var origRender = window.render;
  if (typeof origRender === 'function') {
    window.render = function () {
      origRender.apply(this, arguments);
      watchReveals();
      applyScroll();
    };
  }
  watchReveals();
  applyScroll();
})();
