/**
 * animations.js — GSAP hero entrance, parallax, scroll reveals, card hovers
 * Loaded on pages with animated content.
 */

import './core.js';

// ============================================
// GSAP Helpers
// ============================================

function getGsapScroll() {
  if (!window.gsap || !window.ScrollTrigger) return null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  return { gsap, ScrollTrigger };
}

function getCssNumber(variableName, fallback = 0) {
  const rawValue = getComputedStyle(document.documentElement).getPropertyValue(variableName);
  const parsed = parseFloat(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getParallaxDepth(element) {
  if (!element) return 0;
  const depth = parseFloat(getComputedStyle(element).getPropertyValue('--parallax-depth'));
  return Number.isFinite(depth) ? depth : 0;
}

function getParallaxOffset(element) {
  if (!element) return 0;
  const offset = parseFloat(getComputedStyle(element).getPropertyValue('--parallax-offset'));
  return Number.isFinite(offset) ? offset : 0;
}

function applyParallax(gsap, elements, options) {
  const { trigger, start, end, scrub, getShift } = options;
  elements.forEach((element) => {
    const depth = getParallaxDepth(element);
    if (!depth) return;
    const offset = getParallaxOffset(element);
    gsap.set(element, { y: offset });
    gsap.to(element, {
      y: () => offset + getShift() * depth,
      ease: 'none',
      overwrite: 'auto',
      scrollTrigger: {
        trigger,
        start,
        end,
        scrub,
        invalidateOnRefresh: true
      }
    });
  });
}

// ============================================
// Hero Entrance Animation
// ============================================

function initHeroEntrance() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  if (!window.gsap) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const { gsap } = window;
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  // Sky fade in
  const sky = hero.querySelector('.hero-sky');
  if (sky) {
    tl.fromTo(sky, { opacity: 0 }, { opacity: 1, duration: 0.9 }, 0);
  }

  // Sun rises
  const sun = hero.querySelector('.hero-sun-wrapper');
  if (sun) {
    tl.fromTo(sun,
      { y: 80, opacity: 0, scale: 0.8 },
      { y: 0, opacity: 1, scale: 1, duration: 1.1, ease: 'power2.out' },
      0.2
    );
  }

  // Mountains slide in
  const mountains = hero.querySelectorAll('.mountain-layer');
  if (mountains.length) {
    tl.fromTo(mountains,
      { yPercent: 15, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.95, stagger: 0.1, ease: 'power2.out' },
      0.3
    );
  }

  // Trees slide up
  const trees = hero.querySelector('.hero-trees');
  if (trees) {
    tl.fromTo(trees,
      { yPercent: 30, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.8, ease: 'power2.out' },
      0.6
    );
  }

  // Hero content entrance — animate as single unit (no word-by-word)
  const heroContent = hero.querySelector('.hero-content');
  if (heroContent) {
    tl.fromTo(heroContent,
      { y: 50, opacity: 0, scale: 0.96 },
      { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out' },
      0.5
    );

    // Eyebrow
    const eyebrow = heroContent.querySelector('.eyebrow');
    if (eyebrow) {
      tl.fromTo(eyebrow,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5 },
        0.6
      );
    }

    // Paragraphs
    const paragraphs = heroContent.querySelectorAll('p');
    if (paragraphs.length) {
      tl.fromTo(paragraphs,
        { y: 25, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, stagger: 0.08 },
        0.9
      );
    }

    // CTA buttons
    const buttons = heroContent.querySelectorAll('.btn');
    if (buttons.length) {
      tl.fromTo(buttons,
        { y: 20, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.08, ease: 'back.out(1.5)' },
        1.1
      );
    }
  }
}

// ============================================
// Hero Parallax
// ============================================

function initHeroMotion() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const gsapContext = getGsapScroll();
  if (!gsapContext) return;
  const { gsap } = gsapContext;

  const mountainShift = () => getCssNumber('--hero-parallax-range', 90);
  const mountainLayers = Array.from(hero.querySelectorAll('.mountain-layer'));
  if (mountainLayers.length) {
    applyParallax(gsap, mountainLayers, {
      trigger: hero,
      start: 'top top',
      end: 'bottom top',
      scrub: 0.3,
      getShift: mountainShift
    });
  }

  // Sun rises slightly as you scroll
  const sun = hero.querySelector('.hero-sun-wrapper');
  if (sun) {
    gsap.to(sun, {
      y: -40,
      scale: 1.08,
      ease: 'none',
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.8
      }
    });
  }

  // Hero content parallax
  const heroContent = hero.querySelector('.hero-content');
  if (heroContent) {
    gsap.to(heroContent, {
      yPercent: -10,
      ease: 'none',
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.3
      }
    });
  }
}

// ============================================
// Scroll-Triggered Animations
// ============================================

export function initScrollAnimations() {
  const allElements = Array.from(document.querySelectorAll('.animate-in'));
  if (!allElements.length) return;

  const gsapContext = getGsapScroll();
  if (gsapContext) {
    const { gsap } = gsapContext;

    // Filter: section-header and bento-grid elements handled by initSectionReveals
    const elements = allElements.filter(
      (el) => !el.closest('.section-header') && !el.closest('.bento-grid')
    );

    elements.forEach((el) => {
      if (el.dataset.animScrollInit === '1') return;
      el.dataset.animScrollInit = '1';

      const parent = el.parentElement;
      const siblings = parent
        ? Array.from(parent.querySelectorAll('.animate-in')).filter(
          (node) => !node.closest('.section-header') && !node.closest('.bento-grid')
        )
        : [];
      const siblingIndex = siblings.indexOf(el);
      const staggerDelay = siblingIndex > 0 ? siblingIndex * 0.08 : 0;

      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 32, scale: 0.98 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          delay: staggerDelay,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 92%',
            toggleActions: 'play none none none'
          }
        }
      );
    });
    return;
  }

  // Fallback: IntersectionObserver — handle ALL .animate-in elements
  // (no filter needed; without GSAP, initSectionReveals is a no-op)
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  allElements.forEach(el => observer.observe(el));
}

// ============================================
// Section Reveal Animations
// ============================================

function initSectionReveals() {
  const gsapContext = getGsapScroll();
  if (!gsapContext) return;
  const { gsap } = gsapContext;

  // Section headers
  const sectionHeaders = document.querySelectorAll('.section-header');
  sectionHeaders.forEach(header => {
    const kicker = header.querySelector('.section-kicker');
    const h2 = header.querySelector('h2');
    const p = header.querySelector('p');
    const icon = header.querySelector('.section-icon');

    const elementsToAnimate = [icon, kicker, h2, p].filter(Boolean);
    gsap.set(elementsToAnimate, { autoAlpha: 0 });

    if (icon) gsap.set(icon, { scale: 0, rotation: -180 });
    if (kicker) gsap.set(kicker, { y: 30 });
    if (h2) gsap.set(h2, { y: 40 });
    if (p) gsap.set(p, { y: 30 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: header,
        start: 'top 88%',
        toggleActions: 'play none none none'
      }
    });

    if (icon) {
      tl.to(icon, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.8)' }, 0);
    }
    if (kicker) {
      tl.to(kicker, { y: 0, autoAlpha: 1, duration: 0.45 }, 0.1);
    }
    if (h2) {
      tl.to(h2, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out' }, 0.2);
    }
    if (p) {
      tl.to(p, { y: 0, autoAlpha: 1, duration: 0.5 }, 0.35);
    }
  });

  // Bento grid items
  const bentoGrids = document.querySelectorAll('.bento-grid');
  bentoGrids.forEach(grid => {
    const cards = grid.querySelectorAll('.card');
    if (!cards.length) return;

    gsap.set(cards, { autoAlpha: 0, y: 60, scale: 0.95 });

    gsap.to(cards, {
      y: 0,
      autoAlpha: 1,
      scale: 1,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: grid,
        start: 'top 90%',
        toggleActions: 'play none none none'
      }
    });
  });
}

// ============================================
// Card Hover Effects
// ============================================

export function initCardHoverEffects() {
  if (!window.gsap) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const { gsap } = window;

  const tripCards = document.querySelectorAll('.trip-card');
  tripCards.forEach((card, index) => {
    if (card.dataset.hoverInit === '1') return;
    card.dataset.hoverInit = '1';

    const rotations = [-1.2, 0.8, -0.5, 1.1, -0.9, 0.4, -0.7, 1.3];
    const rotation = rotations[index % rotations.length];

    gsap.set(card, {
      rotation,
      transformOrigin: 'center center',
      clearProps: 'boxShadow'
    });

    card.addEventListener('mouseenter', () => {
      gsap.to(card, {
        rotation: 0,
        scale: 1.02,
        y: -8,
        duration: 0.4,
        ease: 'power2.out'
      });
    });

    card.addEventListener('mouseleave', () => {
      gsap.to(card, {
        rotation,
        scale: 1,
        y: 0,
        duration: 0.5,
        ease: 'power2.out'
      });
    });
  });
}

// ============================================
// Footer Parallax
// ============================================

function initFooterParallax() {
  const footer = document.querySelector('.site-footer');
  if (!footer) return;
  const gsapContext = getGsapScroll();
  if (!gsapContext) return;
  const { gsap } = gsapContext;

  const footerMountains = footer.querySelectorAll('.footer-mountain-layer');
  const mountainShift = () => getCssNumber('--footer-parallax-range', 70);

  if (footerMountains.length) {
    applyParallax(gsap, Array.from(footerMountains), {
      trigger: footer,
      start: 'top bottom',
      end: 'bottom bottom',
      scrub: 0.5,
      getShift: mountainShift
    });
  }
}

// ============================================
// Initialize Animations
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (window.gsap && window.ScrollTrigger && !prefersReducedMotion) {
    document.documentElement.classList.add('has-gsap');
  }

  initHeroEntrance();
  initHeroMotion();
  initSectionReveals();
  initScrollAnimations();
  initFooterParallax();

  setTimeout(initCardHoverEffects, 500);
});
