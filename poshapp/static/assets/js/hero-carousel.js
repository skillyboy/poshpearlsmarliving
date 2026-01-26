/**
 * Lightweight hero carousel sliding under hero content.
 * - Auto-advances slides with smooth GPU-accelerated transform
 * - Pauses on hover/focus
 * - Respects prefers-reduced-motion
 * - No external deps
 */
(function () {
  'use strict';

  const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SELECTOR = '.hero-carousel';

  function q(sel, ctx = document) { return ctx.querySelector(sel); }
  function qa(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }

  function initCarousel(root) {
    if (!root) return;
    const track = q('.hero-carousel-track', root);
    const slides = qa('.hero-slide', root);
    if (!track || slides.length === 0) return;

    let idx = 0;
    let rafId = null;
    let animFrame = null;
    let autoplay = !REDUCE_MOTION;
    const spacing = 12;

    function applyPositions() {
      // Compute x offset to center active slide
      const viewport = root.clientWidth;
      const slideWidth = slides[0].getBoundingClientRect().width + spacing;
      const centerOffset = (viewport - slideWidth) / 2;
      const targetX = -(idx * slideWidth) + centerOffset;
      // Use transform on track for GPU acceleration
      track.style.transform = `translate3d(${Math.round(targetX)}px,0,0)`;
      slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    }

    function next() { idx = (idx + 1) % slides.length; applyPositions(); }
    function prev() { idx = (idx - 1 + slides.length) % slides.length; applyPositions(); }

    let autoTimer = null;
    function startAuto() {
      if (!autoplay || REDUCE_MOTION) return;
      stopAuto();
      autoTimer = setInterval(next, 4200);
    }
    function stopAuto() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } }

    // Pause on pointer/focus
    root.addEventListener('pointerenter', () => stopAuto());
    root.addEventListener('pointerleave', () => startAuto());
    root.addEventListener('focusin', () => stopAuto());
    root.addEventListener('focusout', () => startAuto());

    // Responsive: reapply positions on resize
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(applyPositions, 120);
    });

    // Make sure images/backgrounds are loaded/layout settled
    requestAnimationFrame(() => applyPositions());
    if (!REDUCE_MOTION) startAuto();

    // Expose controls if needed
    return { next, prev, startAuto, stopAuto, goTo: (n) => { idx = n % slides.length; applyPositions(); } };
  }

  function boot() {
    const root = document.querySelector(SELECTOR);
    if (!root) return;
    // defer init until next tick so CSS paints first
    requestAnimationFrame(() => initCarousel(root));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
