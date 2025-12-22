// animations.js — Enhanced UI animations and micro-interactions
// - Staggered reveal for content
// - Subtle 3D tilt on product cards
// - Hero parallax on pointer and scroll
// - Respects prefers-reduced-motion

(function(){
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function safeRaf(fn){ let raf = null; return function(...args){ if(raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(()=>fn(...args)); }; }

  function cssVarMs(el, name, fallback) {
    try {
      const raw = getComputedStyle(el || document.documentElement).getPropertyValue(name).trim();
      if (!raw) return fallback;
      // raw may be like "80ms" or "0.08s"
      if (raw.endsWith('ms')) return parseFloat(raw.replace('ms',''));
      if (raw.endsWith('s')) return parseFloat(raw.replace('s','')) * 1000;
      return parseFloat(raw) || fallback;
    } catch (e) { return fallback; }
  }

  function staggerReveal() {
    if (prefersReduced) return;
    const selectors = ['.product-card', '.product', '.feature-card', '.step', '.hero-content', '.app-badge'];
    const elements = Array.from(document.querySelectorAll(selectors.join(',')));
    if (!elements.length) return;

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const container = entry.target;
        // find children to stagger (cards inside grids) or animate the element itself
        const children = container.querySelectorAll ? container.querySelectorAll('.product-card, .product, .feature-card, .step, .app-badge') : [];
        const baseStep = cssVarMs(container, '--stagger-step', 80);
        const baseOffset = cssVarMs(container, '--stagger-base', 40);
        if (children && children.length > 1) {
          children.forEach((c, i) => {
            const step = cssVarMs(c, '--stagger-step', baseStep);
            const delay = Math.round(baseOffset + (i * step));
            c.style.animationDelay = delay + 'ms';
            c.classList.add('animate-in');
          });
        } else {
          // allow container-level override
          const delay = Math.round(cssVarMs(container, '--stagger-base', baseOffset));
          container.style.animationDelay = delay + 'ms';
          container.classList.add('animate-in');
        }
        obs.unobserve(container);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    // Observe higher-level containers first for better stagger control
    const containers = document.querySelectorAll('.products-grid, .features-grid, .installation-steps, .hero-content, .smart-control-grid');
    containers.forEach(c => observer.observe(c));

    // Fallback: observe individual elements if no containers
    if (!containers.length) elements.forEach(el => observer.observe(el));
  }

  // 3D tilt on hover for product cards (desktop only)
  function enableTilt() {
    if (prefersReduced) return;
    const cards = document.querySelectorAll('.product-card, .product');
    if (!cards.length) return;

    cards.forEach(card => {
      let bounds = null;
      const onMove = safeRaf((e) => {
        if (!bounds) bounds = card.getBoundingClientRect();
        const px = (e.clientX - bounds.left) / bounds.width;
        const py = (e.clientY - bounds.top) / bounds.height;
        const rx = (py - 0.5) * -6; // rotateX
        const ry = (px - 0.5) * 8;  // rotateY
        const tz = 8; // slight pop
        card.style.transform = `perspective(900px) translateZ(${tz}px) rotateX(${rx}deg) rotateY(${ry}deg)`;
        card.style.transition = 'transform 180ms ease-out';
        card.style.willChange = 'transform';
      });

      const reset = () => {
        card.style.transform = '';
        card.style.transition = 'transform 260ms cubic-bezier(.2,.9,.2,1)';
      };

      card.addEventListener('pointerenter', () => { bounds = card.getBoundingClientRect(); card.style.transition = 'transform 200ms ease-out'; });
      card.addEventListener('pointermove', onMove);
      card.addEventListener('pointerleave', reset);
      card.addEventListener('pointercancel', reset);
    });
  }

  // Hero parallax: subtle movement of background on pointer move & parallax scroll
  function heroParallax() {
    if (prefersReduced) return;
    const hero = document.querySelector('.hero');
    const bg = document.querySelector('.hero-background');
    const pattern = document.querySelector('.hero-pattern');
    if (!hero || !bg) return;

    const onPointer = safeRaf((e) => {
      const rect = hero.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      const tx = x * 10;
      const ty = y * 8;
      bg.style.transform = `translate3d(${ -tx }px, ${ -ty }px, 0) scale(1.02)`;
      if (pattern) pattern.style.transform = `translate3d(${ tx * 0.6 }px, ${ ty * 0.6 }px, 0)`;
    });

    const onScroll = safeRaf(() => {
      const scrolled = window.scrollY / 6;
      bg.style.transform = `translate3d(0px, ${ -scrolled }px, 0) scale(1.02)`;
    });

    // Only enable pointer parallax on large viewports and pointer fine
    const mq = window.matchMedia('(pointer:fine) and (min-width: 800px)');
    if (mq.matches) {
      hero.addEventListener('pointermove', onPointer);
      hero.addEventListener('pointerleave', () => { bg.style.transform = ''; if (pattern) pattern.style.transform = ''; });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Micro-interaction: button press ripple-ish (subtle scale) for .btn
  function microInteractions() {
    if (prefersReduced) return;
    document.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('pointerdown', () => { btn.style.transform = 'translateY(1px) scale(0.996)'; btn.style.transition = 'transform 120ms linear'; });
      btn.addEventListener('pointerup', () => { btn.style.transform = ''; });
      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });
  }

  function init() {
    // Defensive: wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }
    try {
      staggerReveal();
      enableTilt();
      heroParallax();
      microInteractions();
    } catch (e) {
      console.warn('animations.js init error', e);
    }
  }

  // Expose for debugging
  window.PoshPearlAnimations = { init };

  init();
})();
