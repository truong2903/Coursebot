/* ==========================================================================
   FUTURE CAMPUS — LIGHTWEIGHT INTERACTIVE EFFECTS ENGINE
   Zero External Dependencies | Single Delegated rAF Spotlight | Touch-Safe
   ========================================================================== */

(function () {
  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (prefersReduced || isCoarsePointer) return;

  var SPOTLIGHT_SELECTOR = [
    '.ov-stat-card',
    '.reg-stat-card',
    '.sched-stat-card',
    '.hist-stat-card',
    '.tr-stat-card',
    '.cur-stat-card',
    '.lec-stat-card',
    '.lec-card',
    '.reg-course-card',
    '.ov-shortcut',
    '.workspace-stat'
  ].join(',');

  var activeCard = null;
  var pendingX = 0;
  var pendingY = 0;
  var rafId = 0;

  function flushSpotlight() {
    rafId = 0;
    if (!activeCard) return;
    var rect = activeCard.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var x = ((pendingX - rect.left) / rect.width) * 100;
    var y = ((pendingY - rect.top) / rect.height) * 100;
    activeCard.style.setProperty('--mx', x.toFixed(1) + '%');
    activeCard.style.setProperty('--my', y.toFixed(1) + '%');
    activeCard.style.setProperty('--spot-o', '1');
  }

  document.addEventListener('pointermove', function (e) {
    var target = e.target && e.target.closest ? e.target.closest(SPOTLIGHT_SELECTOR) : null;
    if (activeCard && activeCard !== target) {
      activeCard.style.setProperty('--spot-o', '0');
    }
    activeCard = target;
    if (!activeCard) return;
    pendingX = e.clientX;
    pendingY = e.clientY;
    if (!rafId) rafId = window.requestAnimationFrame(flushSpotlight);
  }, { passive: true });

  document.addEventListener('pointerleave', function () {
    if (activeCard) {
      activeCard.style.setProperty('--spot-o', '0');
      activeCard = null;
    }
  }, { passive: true });
})();
