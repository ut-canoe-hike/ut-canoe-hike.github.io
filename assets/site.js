/**
 * UTCH Website - Frontend JavaScript
 * University of Tennessee Canoe & Hiking Club
 */

// ============================================
// Configuration & API Helpers
// ============================================

function getConfig() {
  return window.UTCH_CONFIG || {};
}

function getApiBaseUrl() {
  const url = getConfig().apiBaseUrl || '';
  return url.replace(/\/$/, '');
}

function getDisplayTimeZone() {
  return getConfig().timeZone || 'America/New_York';
}

function getDateTimePartsForInput(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function formatDateLabel(date, timeZone) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  });
}

function formatTimeLabel(date, timeZone) {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

async function api(method, path, body = null) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error('Missing API URL. Set UTCH_CONFIG.apiBaseUrl in assets/config.js.');
  }

  const options = {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, options);
  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data.data;
}

// ============================================
// Utility Functions
// ============================================

function setStatus(el, kind, text) {
  if (!el) return;
  el.classList.remove('ok', 'err');
  if (kind) el.classList.add(kind);
  el.textContent = text;
  el.hidden = false;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

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

const ACTIVITY_META = {
  Hike: {
    className: 'activity-hike',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20l6-9 5 7 4-6 3 8" /><path d="M3 20h18" /></svg>'
  },
  Backpacking: {
    className: 'activity-hike',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20l6-9 5 7 4-6 3 8" /><path d="M3 20h18" /></svg>'
  },
  'Canoe/Kayak': {
    className: 'activity-paddle',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12c2 2 4 2 6 0s4-2 6 0 4 2 6 0" /><path d="M12 3v18" /></svg>'
  },
  Camping: {
    className: 'activity-camp',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20l9-16 9 16" /><path d="M7 14h10" /></svg>'
  },
  Climbing: {
    className: 'activity-climb',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 20l6-16 6 16" /><path d="M9 12h6" /></svg>'
  },
  Other: {
    className: 'activity-social',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="3" /><path d="M5 20c1.5-3 4-5 7-5s5.5 2 7 5" /></svg>'
  }
};

function getActivityMeta(activity) {
  return ACTIVITY_META[activity] || ACTIVITY_META.Hike;
}

function renderSkeleton(container, count = 3) {
  if (!container) return;
  const card = `
    <div class="skeleton-card">
      <div class="skeleton-line short"></div>
      <div class="skeleton-line medium"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
    </div>
  `;
  container.innerHTML = Array.from({ length: count }, () => card).join('');
}

// ============================================
// Navigation & Header
// ============================================

function initCurrentNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  for (const link of document.querySelectorAll('.nav a')) {
    const href = (link.getAttribute('href') || '').split('/').pop();
    if (href && href === path) {
      link.setAttribute('aria-current', 'page');
    }
  }
}

function initMobileMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.classList.toggle('active', isOpen);
    toggle.setAttribute('aria-expanded', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) {
      nav.classList.remove('open');
      toggle.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });
}

function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const handleScroll = () => {
    if (window.scrollY > 10) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
}

// ============================================
// Scroll Effects
// ============================================

function initScrollProgress() {
  const progressBar = document.querySelector('[data-scroll-progress]');
  if (!progressBar) return;

  const handle = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? scrollTop / docHeight : 0;
    progressBar.style.setProperty('--scroll', progress.toString());
  };

  window.addEventListener('scroll', handle, { passive: true });
  handle();
}

function initScrollAnimations() {
  // Exclude elements handled by other animation systems:
  // - .section-header children (handled by initSectionReveals)
  // - .bento-grid .card (handled by bento grid animation in initSectionReveals)
  const elements = Array.from(document.querySelectorAll('.animate-in')).filter(
    (el) => !el.closest('.section-header') && !el.closest('.bento-grid')
  );
  if (!elements.length) return;

  const gsapContext = getGsapScroll();
  if (gsapContext) {
    const { gsap } = gsapContext;

    elements.forEach((el) => {
      // Check if element is inside a grid/flex container for stagger effect
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
        {
          autoAlpha: 0,
          y: 32,
          scale: 0.98
        },
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

  elements.forEach(el => observer.observe(el));
}

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

  // Trees stay grounded - no parallax animation

  // Sun rises slightly as you scroll down
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

  // Hero content parallax (moves up slower, creating depth)
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
// Advanced Hero Animations
// ============================================

function initHeroEntrance() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  if (!window.gsap) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const { gsap } = window;

  // Create a timeline for orchestrated entrance
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  // Animate sky gradient (fade in)
  const sky = hero.querySelector('.hero-sky');
  if (sky) {
    tl.fromTo(sky, { opacity: 0 }, { opacity: 1, duration: 0.9 }, 0);
  }

  // Sun entrance - rises from below
  const sun = hero.querySelector('.hero-sun-wrapper');
  if (sun) {
    tl.fromTo(sun,
      { y: 80, opacity: 0, scale: 0.8 },
      { y: 0, opacity: 1, scale: 1, duration: 1.1, ease: 'power2.out' },
      0.2
    );
  }

  // Mountain layers fade/slide in from bottom with stagger
  const mountains = hero.querySelectorAll('.mountain-layer');
  if (mountains.length) {
    tl.fromTo(mountains,
      { yPercent: 15, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration: 0.95,
        stagger: 0.1,
        ease: 'power2.out'
      },
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

  // Hero content entrance
  const heroContent = hero.querySelector('.hero-content');
  if (heroContent) {
    tl.fromTo(heroContent,
      { y: 50, opacity: 0, scale: 0.96 },
      { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out' },
      0.5
    );

    // Animate headline words
    const headline = heroContent.querySelector('h1');
    if (headline) {
      animateHeadline(headline, tl);
    }

    // Animate eyebrow
    const eyebrow = heroContent.querySelector('.eyebrow');
    if (eyebrow) {
      tl.fromTo(eyebrow,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5 },
        0.6
      );
    }

    // Animate paragraphs
    const paragraphs = heroContent.querySelectorAll('p');
    if (paragraphs.length) {
      tl.fromTo(paragraphs,
        { y: 25, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, stagger: 0.08 },
        0.9
      );
    }

    // Animate CTA buttons
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

function animateHeadline(headline, timeline) {
  if (!window.gsap) return;
  const { gsap } = window;

  // Store original HTML
  const originalHTML = headline.innerHTML;

  // Split text into words while preserving HTML structure
  const words = [];
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = originalHTML;

  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      const wordArray = text.split(/(\s+)/);
      return wordArray.map(word => {
        if (word.trim() === '') return word;
        return `<span class="word-wrap"><span class="word">${word}</span></span>`;
      }).join('');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const clone = node.cloneNode(false);
      clone.innerHTML = Array.from(node.childNodes).map(processNode).join('');
      return clone.outerHTML;
    }
    return '';
  }

  headline.innerHTML = Array.from(tempDiv.childNodes).map(processNode).join('');

  // Animate words (CSS for .word-wrap and .word is in styles.css)
  const wordElements = headline.querySelectorAll('.word');
  if (wordElements.length && timeline) {
    timeline.fromTo(wordElements,
      { yPercent: 110, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.04,
        ease: 'power3.out'
      },
      0.7
    );
  }
}

// ============================================
// Section Reveal Animations
// ============================================

function initSectionReveals() {
  const gsapContext = getGsapScroll();
  if (!gsapContext) return;
  const { gsap } = gsapContext;

  // Animate section headers with a special reveal
  const sectionHeaders = document.querySelectorAll('.section-header');
  sectionHeaders.forEach(header => {
    const kicker = header.querySelector('.section-kicker');
    const h2 = header.querySelector('h2');
    const p = header.querySelector('p');
    const icon = header.querySelector('.section-icon');

    // Immediately set initial hidden state to prevent flash
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
      tl.to(icon,
        { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.8)' },
        0
      );
    }

    if (kicker) {
      tl.to(kicker,
        { y: 0, autoAlpha: 1, duration: 0.45 },
        0.1
      );
    }

    if (h2) {
      tl.to(h2,
        { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out' },
        0.2
      );
    }

    if (p) {
      tl.to(p,
        { y: 0, autoAlpha: 1, duration: 0.5 },
        0.35
      );
    }
  });

  // Bento grid items with stagger
  const bentoGrids = document.querySelectorAll('.bento-grid');
  bentoGrids.forEach(grid => {
    const cards = grid.querySelectorAll('.card');
    if (!cards.length) return;

    // Immediately set initial hidden state
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

function initCardHoverEffects() {
  if (!window.gsap) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const { gsap } = window;

  // Apply organic rotation to trip cards
  const tripCards = document.querySelectorAll('.trip-card');
  tripCards.forEach((card, index) => {
    // Pseudo-random rotation based on index
    const rotations = [-1.2, 0.8, -0.5, 1.1, -0.9, 0.4, -0.7, 1.3];
    const rotation = rotations[index % rotations.length];

    gsap.set(card, {
      rotation: rotation,
      transformOrigin: 'center center'
    });

    // Enhanced hover effect
    card.addEventListener('mouseenter', () => {
      gsap.to(card, {
        rotation: 0,
        scale: 1.02,
        y: -8,
        boxShadow: '0 20px 40px rgba(61, 47, 36, 0.15)',
        duration: 0.4,
        ease: 'power2.out'
      });
    });

    card.addEventListener('mouseleave', () => {
      gsap.to(card, {
        rotation: rotation,
        scale: 1,
        y: 0,
        boxShadow: '0 4px 12px rgba(61, 47, 36, 0.1)',
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

  // Trees stay grounded - no parallax animation
}

// ============================================
// Background Gradient Shift on Scroll
// ============================================

function initGradientShift() {
  const gsapContext = getGsapScroll();
  if (!gsapContext) return;
  const { ScrollTrigger } = gsapContext;

  // Subtle body background shift as you scroll
  ScrollTrigger.create({
    trigger: 'body',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      const progress = self.progress;
      // Shift from warm cream to slightly cooler tone
      const warmth = 1 - (progress * 0.15);
      document.body.style.setProperty('--scroll-warmth', warmth.toString());
    }
  });
}

// ============================================
// Trip Card HTML Generator
// ============================================

function createTripCardHTML(trip, timeZone, includeRsvpBtn = false) {
  const start = new Date(trip.start);
  const dateStr = formatDateLabel(start, timeZone);
  const timeStr = trip.isAllDay ? 'All Day' : formatTimeLabel(start, timeZone);
  const activity = getActivityMeta(trip.activity);
  const difficultyClass = trip.difficulty
    ? `difficulty-badge difficulty-badge--${trip.difficulty.toLowerCase()}`
    : '';

  return `
    <article class="trip-card ${activity.className} animate-in" data-trip-id="${trip.tripId}">
      <div class="trip-card-header">
        <div class="trip-card-icon">${activity.icon}</div>
        <div class="trip-card-title">
          <h3>${escapeHTML(trip.title)}</h3>
          <div class="trip-card-date"><span>${dateStr}</span><span>•</span><span>${timeStr}</span></div>
        </div>
      </div>
      <div class="trip-card-body">
        ${trip.location ? `<p>${escapeHTML(trip.location)}</p>` : '<p>Details shared after RSVP.</p>'}
      </div>
      ${(trip.difficulty || includeRsvpBtn) ? `
      <div class="trip-card-footer">
        ${trip.difficulty ? `<span class="${difficultyClass}">${escapeHTML(trip.difficulty)}</span>` : '<span></span>'}
        ${includeRsvpBtn ? '<button class="btn btn-primary" data-rsvp-trigger data-magnetic>RSVP</button>' : ''}
      </div>` : ''}
    </article>
`;
}

function renderTrips(container, trips, timeZone, options = {}) {
  if (!container) return;
  const {
    includeRsvp = false,
    emptyMessage = 'No upcoming trips.',
    onRsvp,
    stagger = false
  } = options;

  if (!trips.length) {
    container.innerHTML = `<p class="trips-empty">${emptyMessage}</p>`;
    return;
  }

  container.innerHTML = trips.map(trip => createTripCardHTML(trip, timeZone, includeRsvp)).join('');

  if (stagger) {
    container.querySelectorAll('.trip-card').forEach((card, i) => {
      card.style.animationDelay = `${i * 0.1}s`;
    });
  }

  if (onRsvp) {
    container.querySelectorAll('[data-rsvp-trigger]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tripId = btn.closest('[data-trip-id]')?.dataset.tripId;
        if (tripId) onRsvp(tripId);
      });
    });
  }

  initScrollAnimations();
  initMagneticElements();
  initCardHoverEffects();
}

// ============================================
// Homepage Trip Preview
// ============================================

function initTripPreview() {
  const container = document.querySelector('[data-trip-preview]');
  if (!container) return;

  const timeZone = getDisplayTimeZone();

  async function loadPreview() {
    renderSkeleton(container, 3);
    try {
      const data = await api('GET', '/api/trips');
      const trips = data.trips.slice(0, 3);
      renderTrips(container, trips, timeZone, {
        emptyMessage: 'No upcoming trips scheduled. Check back soon!',
        stagger: true
      });
    } catch (err) {
      container.innerHTML = '<p class="trips-error">Unable to load trips.</p>';
    }
  }

  loadPreview();
}

// ============================================
// Trips Page - Full Trip List
// ============================================

function initTripsPage() {
  const container = document.querySelector('[data-trips-list]');
  if (!container) return;

  const timeZone = getDisplayTimeZone();
  const tripMap = new Map();

  async function loadTrips() {
    renderSkeleton(container, 6);
    try {
      const data = await api('GET', '/api/trips');
      tripMap.clear();

      data.trips.forEach(trip => {
        tripMap.set(trip.tripId, trip);
      });

      renderTrips(container, data.trips, timeZone, {
        includeRsvp: true,
        emptyMessage: 'No upcoming trips. Check back soon or suggest one!',
        onRsvp: (tripId) => openRsvpPanel(tripMap.get(tripId))
      });
    } catch (err) {
      container.innerHTML = '<p class="trips-error">Unable to load trips.</p>';
    }
  }

  loadTrips();
}

// ============================================
// RSVP Slide-Out Panel
// ============================================

function initRsvpPanel() {
  const panel = document.querySelector('[data-rsvp-panel]');
  const backdrop = document.querySelector('[data-panel-backdrop]');
  const closeBtn = document.querySelector('[data-panel-close]');
  const form = document.querySelector('[data-rsvp-form]');

  if (!panel || !form) return;

  // Close handlers
  function closePanel() {
    panel.classList.remove('active');
    backdrop?.classList.remove('active');
    document.body.style.overflow = '';
  }

  closeBtn?.addEventListener('click', closePanel);
  backdrop?.addEventListener('click', closePanel);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('active')) {
      closePanel();
    }
  });

  // Form submission
  const statusEl = form.querySelector('[data-form-status]');
  const tripIdInput = form.querySelector('[data-rsvp-trip-id]');
  const gearField = form.querySelector('[data-gear-field]');
  const gearOptions = form.querySelector('[data-gear-options]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus(statusEl, '', 'Submitting...');

    // Honeypot check
    if (form.querySelector('input[name="website"]')?.value) {
      setStatus(statusEl, 'ok', 'Thanks!');
      setTimeout(closePanel, 1500);
      return;
    }

    try {
      await api('POST', '/api/rsvp', {
        tripId: tripIdInput.value,
        name: form.name.value.trim(),
        contact: form.contact.value.trim(),
        carpool: form.carpool.value,
        gearNeeded: Array.from(form.querySelectorAll('input[name="gearNeeded"]:checked')).map(el => el.value),
        notes: form.notes.value.trim()
      });

      setStatus(statusEl, 'ok', 'RSVP submitted! See you on the trip.');
      form.reset();
      setTimeout(closePanel, 2000);
    } catch (err) {
      setStatus(statusEl, 'err', err.message);
    }
  });

  // Expose open function globally
  window.openRsvpPanel = function(trip) {
    if (!trip) return;

    // Set trip ID
    tripIdInput.value = trip.tripId;

    // Update panel title/info
    const infoEl = document.querySelector('[data-panel-trip-info]');
    if (infoEl) {
      const timeZone = getDisplayTimeZone();
      const start = new Date(trip.start);
      infoEl.innerHTML = `
        <h3>${escapeHTML(trip.title)}</h3>
        <p>${formatDateLabel(start, timeZone)} ${trip.isAllDay ? '' : '&bull; ' + formatTimeLabel(start, timeZone)}</p>
        ${trip.location ? `<p>${escapeHTML(trip.location)}</p>` : ''}
      `;
    }

    // Render gear options
    if (gearField && gearOptions) {
      const available = Array.isArray(trip.gearAvailable) ? trip.gearAvailable : [];
      if (available.length) {
        gearField.hidden = false;
        gearOptions.innerHTML = available.map(item => `
          <label class="checkbox">
            <input type="checkbox" name="gearNeeded" value="${item}" />
            <span>${item.replace(/\b\w/g, c => c.toUpperCase())}</span>
          </label>
        `).join('');
      } else {
        gearField.hidden = true;
      }
    }

    // Open panel
    panel.classList.add('active');
    backdrop?.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus first input
    form.querySelector('input')?.focus();
  };
}

// ============================================
// Calendar Embed
// ============================================

function initCalendarEmbed() {
  const iframe = document.querySelector('[data-calendar-embed]');
  if (!iframe) return;
  const src = getConfig().calendarEmbedUrl || '';
  if (src) {
    iframe.src = src;
  }
}

// ============================================
// Forms
// ============================================

function initSuggestForm() {
  const form = document.querySelector('[data-suggest-form]');
  if (!form) return;

  const statusEl = document.querySelector('[data-form-status]');
  const successEl = document.querySelector('[data-form-success]');

  if (statusEl) {
    statusEl.hidden = true;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (statusEl) statusEl.hidden = false;
    setStatus(statusEl, '', 'Submitting...');

    // Honeypot check
    const honeypot = form.querySelector('input[name="website"]')?.value || '';
    if (honeypot) {
      setStatus(statusEl, 'ok', 'Thanks!');
      form.reset();
      return;
    }

    try {
      await api('POST', '/api/suggest', {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        willingToLead: form.willingToLead.value,
        idea: form.idea.value.trim(),
        location: form.location.value.trim(),
        timing: form.timing.value.trim(),
        notes: form.notes.value.trim(),
      });
      setStatus(statusEl, '', '');
      if (statusEl) statusEl.hidden = true;
      form.reset();
      if (successEl) {
        form.hidden = true;
        successEl.hidden = false;
      }
    } catch (err) {
      setStatus(statusEl, 'err', err.message);
    }
  });
}

// ============================================
// UI Enhancements
// ============================================

function initPageLoad() {
  document.body.classList.add('is-loaded');
}

function initMagneticElements() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const targets = document.querySelectorAll('[data-magnetic]:not([data-magnetic-bound])');
  if (!targets.length) return;

  targets.forEach((target) => {
    target.dataset.magneticBound = 'true';
    target.addEventListener('mousemove', (event) => {
      const rect = target.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      target.style.setProperty('--mx', `${x * 0.02}px`);
      target.style.setProperty('--my', `${y * 0.02}px`);
    });

    target.addEventListener('mouseleave', () => {
      target.style.setProperty('--mx', `0px`);
      target.style.setProperty('--my', `0px`);
    });
  });
}

function initPageTransitions() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      link.target === '_blank'
    ) {
      return;
    }

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;

    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      document.body.classList.add('is-leaving');
      const destination = link.href;
      setTimeout(() => {
        window.location.href = destination;
      }, 200);
    });
  });

  window.addEventListener('pageshow', () => {
    document.body.classList.remove('is-leaving');
  });
}

// ============================================
// Officer Portal
// ============================================

function initOfficerPortal() {
  const loginSection = document.querySelector('[data-officer-login]');
  const dashboard = document.querySelector('[data-officer-dashboard]');
  if (!loginSection || !dashboard) return;

  const loginForm = loginSection.querySelector('[data-officer-login-form]');
  const loginStatus = loginSection.querySelector('[data-officer-login-status]');

  const createForm = dashboard.querySelector('[data-officer-create-form]');
  const createStatus = dashboard.querySelector('[data-officer-create-status]');
  const editForm = dashboard.querySelector('[data-officer-edit-form]');
  const editStatus = dashboard.querySelector('[data-officer-edit-status]');
  const deleteForm = dashboard.querySelector('[data-officer-delete-form]');
  const deleteStatus = dashboard.querySelector('[data-officer-delete-status]');
  const syncButton = dashboard.querySelector('[data-officer-sync-button]');
  const syncStatus = dashboard.querySelector('[data-officer-sync-status]');

  const editSelect = dashboard.querySelector('[data-edit-trip-select]');
  const deleteSelect = dashboard.querySelector('[data-delete-trip-select]');
  const timeZone = getDisplayTimeZone();

  let officerSecret = '';
  const tripsById = new Map();

  function showDashboard() {
    loginSection.classList.add('is-hidden');
    dashboard.classList.remove('is-hidden');
    if (window.location.hash !== '#manage') {
      window.location.hash = 'manage';
    }
  }

  function ensureLoginVisible() {
    loginSection.classList.remove('is-hidden');
    dashboard.classList.add('is-hidden');
  }

  ensureLoginVisible();

  function formatTripLabel(trip) {
    const start = trip.start ? new Date(trip.start) : null;
    const date = start && !Number.isNaN(start.getTime())
      ? formatDateLabel(start, timeZone)
      : 'Unknown date';
    const parts = [date, `— ${trip.title || 'Trip'}`];
    if (start && !trip.isAllDay) {
      const time = formatTimeLabel(start, timeZone);
      parts[0] = `${date} ${time}`;
    }
    if (trip.location) parts.push(`(${trip.location})`);
    return parts.join(' ');
  }

  function toDateInput(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return getDateTimePartsForInput(d, timeZone).date;
  }

  function toTimeInput(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return getDateTimePartsForInput(d, timeZone).time;
  }

  function setGearCheckboxes(form, values) {
    const selected = new Set((values || []).map(item => String(item).toLowerCase()));
    form.querySelectorAll('input[name="gearAvailable"]').forEach(input => {
      input.checked = selected.has(String(input.value).toLowerCase());
    });
  }

  function populateSelect(select, trips) {
    if (!select) return;
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = trips.length ? 'Select a trip...' : 'No trips found';
    select.appendChild(placeholder);

    for (const trip of trips) {
      const opt = document.createElement('option');
      opt.value = trip.tripId;
      opt.textContent = formatTripLabel(trip);
      select.appendChild(opt);
    }
    select.disabled = !trips.length;
  }

  async function loadAdminTrips() {
    if (!officerSecret) return;

    if (editSelect) {
      editSelect.disabled = true;
      editSelect.innerHTML = '<option value="" selected disabled>Loading trips...</option>';
    }
    if (deleteSelect) {
      deleteSelect.disabled = true;
      deleteSelect.innerHTML = '<option value="" selected disabled>Loading trips...</option>';
    }

    try {
      const data = await api('POST', '/api/trips/admin', { officerSecret });
      tripsById.clear();
      const trips = Array.isArray(data.trips) ? data.trips : [];
      for (const trip of trips) {
        tripsById.set(trip.tripId, trip);
      }
      populateSelect(editSelect, trips);
      populateSelect(deleteSelect, trips);
    } catch (err) {
      const message = err.message || 'Unable to load trips.';
      if (editStatus) setStatus(editStatus, 'err', message);
      if (deleteStatus) setStatus(deleteStatus, 'err', message);
    }
  }

  function collectTripPayload(form) {
    const gearAvailable = Array.from(form.querySelectorAll('input[name="gearAvailable"]:checked')).map(el => el.value);
    return {
      title: form.title.value.trim(),
      activity: form.activity.value,
      startDate: form.startDate.value,
      startTime: form.startTime.value,
      endDate: form.endDate.value,
      endTime: form.endTime.value,
      location: form.location.value.trim(),
      difficulty: form.difficulty.value,
      meetTime: form.meetTime.value.trim(),
      meetPlace: form.meetPlace.value.trim(),
      leaderName: form.leaderName.value.trim(),
      leaderContact: form.leaderContact.value.trim(),
      notes: form.notes.value.trim(),
      gearAvailable,
      officerSecret,
    };
  }

  function fillEditForm(trip) {
    if (!editForm || !trip) return;
    editForm.title.value = trip.title || '';
    editForm.activity.value = trip.activity || '';
    editForm.location.value = trip.location || '';
    editForm.difficulty.value = trip.difficulty || '';
    editForm.meetTime.value = trip.meetTime || '';
    editForm.meetPlace.value = trip.meetPlace || '';
    editForm.leaderName.value = trip.leaderName || '';
    editForm.leaderContact.value = trip.leaderContact || '';
    editForm.notes.value = trip.notes || '';

    const startDate = trip.start ? new Date(trip.start) : null;
    const endDate = trip.end ? new Date(trip.end) : null;

    if (trip.isAllDay) {
      editForm.startDate.value = toDateInput(startDate);
      if (endDate && !Number.isNaN(endDate.getTime())) {
        const inclusiveEnd = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        editForm.endDate.value = toDateInput(inclusiveEnd);
      } else {
        editForm.endDate.value = '';
      }
      editForm.startTime.value = '';
      editForm.endTime.value = '';
    } else {
      editForm.startDate.value = toDateInput(startDate);
      editForm.startTime.value = toTimeInput(startDate);
      editForm.endDate.value = toDateInput(endDate || startDate);
      editForm.endTime.value = toTimeInput(endDate);
    }

    setGearCheckboxes(editForm, trip.gearAvailable || []);
  }

  if (editSelect) {
    editSelect.addEventListener('change', () => {
      const trip = tripsById.get(editSelect.value);
      fillEditForm(trip);
    });
  }

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const secret = loginForm.officerSecret.value.trim();
    if (!secret) {
      setStatus(loginStatus, 'err', 'Passcode is required.');
      return;
    }
    setStatus(loginStatus, '', 'Checking...');

    try {
      await api('POST', '/api/officer/verify', { officerSecret: secret });
      officerSecret = secret;
      setStatus(loginStatus, 'ok', 'Access granted.');
      showDashboard();
      loadAdminTrips();
    } catch (err) {
      setStatus(loginStatus, 'err', err.message || 'Not authorized.');
    }
  });

  createForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!officerSecret) return;
    setStatus(createStatus, '', 'Submitting...');

    try {
      const data = await api('POST', '/api/trips', collectTripPayload(createForm));
      setStatus(createStatus, 'ok', `Trip created! RSVP link: ${data.rsvpUrl}`);
      createForm.reset();
      loadAdminTrips();
    } catch (err) {
      setStatus(createStatus, 'err', err.message || 'Trip submission failed.');
    }
  });

  editForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!officerSecret) return;
    if (!editSelect?.value) {
      setStatus(editStatus, 'err', 'Select a trip to edit.');
      return;
    }
    setStatus(editStatus, '', 'Saving...');

    try {
      await api('PATCH', `/api/trips/${encodeURIComponent(editSelect.value)}`, collectTripPayload(editForm));
      setStatus(editStatus, 'ok', 'Changes saved.');
      loadAdminTrips();
    } catch (err) {
      setStatus(editStatus, 'err', err.message || 'Update failed.');
    }
  });

  deleteForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!officerSecret) return;
    if (!deleteSelect?.value) {
      setStatus(deleteStatus, 'err', 'Select a trip to delete.');
      return;
    }
    const ok = window.confirm('Delete this trip? This cannot be undone.');
    if (!ok) return;
    setStatus(deleteStatus, '', 'Deleting...');

    try {
      await api('DELETE', `/api/trips/${encodeURIComponent(deleteSelect.value)}`, { officerSecret });
      setStatus(deleteStatus, 'ok', 'Trip deleted.');
      loadAdminTrips();
    } catch (err) {
      setStatus(deleteStatus, 'err', err.message || 'Delete failed.');
    }
  });

  syncButton?.addEventListener('click', async () => {
    if (!officerSecret) return;
    syncButton.disabled = true;
    setStatus(syncStatus, '', 'Syncing...');
    try {
      await api('POST', '/api/sync', { officerSecret });
      setStatus(syncStatus, 'ok', 'Calendar synced.');
      loadAdminTrips();
    } catch (err) {
      setStatus(syncStatus, 'err', err.message || 'Sync failed.');
    } finally {
      syncButton.disabled = false;
    }
  });
}

// ============================================
// Initialize Everything
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('has-js');
  if (window.gsap && window.ScrollTrigger && !prefersReducedMotion) {
    document.documentElement.classList.add('has-gsap');
  }

  // Core navigation and UI
  initCurrentNav();
  initMobileMenu();
  initHeaderScroll();
  initScrollProgress();
  initPageLoad();
  initMagneticElements();
  initPageTransitions();

  // GSAP Animations (order matters for visual effect)
  initHeroEntrance();     // Hero intro animation sequence
  initHeroMotion();       // Parallax scroll effects
  initSectionReveals();   // Section header animations
  initScrollAnimations(); // General scroll-triggered animations
  initFooterParallax();   // Footer mountain parallax
  initGradientShift();    // Background color shift on scroll

  // Page-specific
  initTripPreview();      // Homepage
  initTripsPage();        // Trips page
  initRsvpPanel();        // Trips page
  initCalendarEmbed();    // Trips page
  initSuggestForm();      // Suggest page
  initOfficerPortal();    // Officer page

  // Apply card effects after trips are loaded
  // (called again in renderTrips for dynamic content)
  setTimeout(initCardHoverEffects, 500);
});
