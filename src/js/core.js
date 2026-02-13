/**
 * core.js — Config, API helpers, nav, scroll effects, page lifecycle
 * Loaded on every page.
 */

// ============================================
// Configuration & API Helpers
// ============================================

export function getConfig() {
  return window.UTCH_CONFIG || {};
}

export function getApiBaseUrl() {
  const url = getConfig().apiBaseUrl || '';
  return url.replace(/\/$/, '');
}

export function getDisplayTimeZone() {
  const timeZone = getConfig().timeZone;
  if (!timeZone) {
    throw new Error('Missing UTCH_CONFIG.timeZone in src/public/assets/config.js.');
  }
  return timeZone;
}

let siteSettingsPromise = null;
const warmedDocumentPaths = new Set();
const warmingDocumentPromises = new Map();

function getNavigableDocumentTarget(rawHref) {
  if (!rawHref) return null;

  let url;
  try {
    url = new URL(rawHref, window.location.href);
  } catch {
    return null;
  }

  if (url.origin !== window.location.origin) return null;
  if (url.hash && `${url.pathname}${url.search}` === `${window.location.pathname}${window.location.search}`) {
    return null;
  }
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;

  if (/\.(pdf|png|jpe?g|webp|avif|gif|svg|zip|mp4|webm|mp3)$/i.test(url.pathname)) {
    return null;
  }

  return {
    url,
    key: `${url.pathname}${url.search}`,
  };
}

function canPrefetch() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return true;
  if (connection.saveData) return false;
  const effectiveType = String(connection.effectiveType || '').toLowerCase();
  return !effectiveType.includes('2g');
}

function warmDocument(rawHref, { urgent = false } = {}) {
  const target = getNavigableDocumentTarget(rawHref);
  if (!target) return;
  const { key, url } = target;

  if (warmedDocumentPaths.has(key) || warmingDocumentPromises.has(key)) return;
  if (!canPrefetch()) return;

  const hint = document.createElement('link');
  hint.rel = 'prefetch';
  hint.as = 'document';
  hint.href = key;
  document.head.appendChild(hint);

  const priority = urgent ? 'high' : 'low';
  const request = fetch(url.href, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'force-cache',
    priority,
  }).catch(() => {
    // Ignore prefetch failures and let normal navigation handle fetch.
  }).finally(() => {
    warmingDocumentPromises.delete(key);
  });

  warmingDocumentPromises.set(key, request);
  request.then(() => {
    warmedDocumentPaths.add(key);
  });
}

function pageUsesSiteSettings() {
  return Boolean(
    document.querySelector('[data-setting-text], [data-setting-href], [data-setting-mailto]')
  );
}

function applySiteSettings(settings) {
  if (!settings || typeof settings !== 'object') return;

  document.querySelectorAll('[data-setting-text]').forEach((el) => {
    const key = el.getAttribute('data-setting-text');
    if (!key) return;
    const value = settings[key];
    if (typeof value === 'string' && value.trim()) {
      el.textContent = value;
    }
  });

  document.querySelectorAll('[data-setting-href]').forEach((el) => {
    const key = el.getAttribute('data-setting-href');
    if (!key) return;
    const value = settings[key];
    if (typeof value === 'string' && value.trim()) {
      el.setAttribute('href', value);
    }
  });

  document.querySelectorAll('[data-setting-mailto]').forEach((el) => {
    const key = el.getAttribute('data-setting-mailto');
    if (!key) return;
    const value = settings[key];
    if (typeof value === 'string' && value.trim()) {
      el.setAttribute('href', `mailto:${value}`);
      el.textContent = value;
    }
  });
}

export function getDateTimePartsForInput(date, timeZone) {
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

export function formatDateLabel(date, timeZone) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  });
}

export function formatTimeLabel(date, timeZone) {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

export async function api(method, path, body = null) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error('Missing API URL. Set UTCH_CONFIG.apiBaseUrl in src/public/assets/config.js.');
  }

  const options = {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Unexpected API response (${response.status}).`);
    }
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  if (!data?.ok) {
    throw new Error(data?.error || 'Malformed API response.');
  }

  return data.data;
}

export async function loadSiteSettings() {
  if (!siteSettingsPromise) {
    siteSettingsPromise = (async () => {
      try {
        const data = await api('GET', '/api/site-settings');
        const settings = data?.settings;
        if (!settings || typeof settings !== 'object') {
          throw new Error('Invalid site settings response.');
        }
        window.UTCH_SITE_SETTINGS = settings;
        applySiteSettings(settings);
        return settings;
      } catch (err) {
        // Allow retry after transient failures.
        siteSettingsPromise = null;
        throw err;
      }
    })();
  }
  return siteSettingsPromise;
}

export function getSiteSetting(key) {
  const settings = window.UTCH_SITE_SETTINGS;
  if (!settings || typeof settings !== 'object') return '';
  const value = settings[key];
  return typeof value === 'string' ? value : '';
}

// ============================================
// Utility Functions
// ============================================

export function setStatus(el, kind, text) {
  if (!el) return;
  el.classList.remove('ok', 'err');
  if (kind) el.classList.add(kind);
  el.textContent = text;
  el.hidden = false;
}

export function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

// ============================================
// Navigation & Header
// ============================================

function initCurrentNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  // Handle root path
  const currentPage = path === '' ? 'index.html' : path;
  for (const link of document.querySelectorAll('.nav a')) {
    const href = (link.getAttribute('href') || '').replace(/^\//, '');
    const linkPage = href === '' || href === '/' ? 'index.html' : href.split('/').pop();
    if (linkPage && linkPage === currentPage) {
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

// ============================================
// Page Lifecycle
// ============================================

function initLinkPrefetch() {
  document.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      anchor.target === '_blank' ||
      anchor.hasAttribute('download')
    ) {
      return;
    }

    const triggerPrefetch = () => warmDocument(anchor.href);
    const triggerUrgentWarm = () => warmDocument(anchor.href, { urgent: true });

    anchor.addEventListener('pointerenter', triggerPrefetch, { passive: true });
    anchor.addEventListener('focus', triggerPrefetch, { passive: true });
    anchor.addEventListener('touchstart', triggerUrgentWarm, { passive: true, once: true });
    anchor.addEventListener('pointerdown', triggerUrgentWarm, { passive: true });
  });

  const warmVisibleNavLinks = () => {
    document.querySelectorAll('.nav a[href]').forEach((anchor) => warmDocument(anchor.href));
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warmVisibleNavLinks, { timeout: 1200 });
  } else {
    window.setTimeout(warmVisibleNavLinks, 500);
  }
}

// ============================================
// Initialize Core
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('has-js');

  initCurrentNav();
  initMobileMenu();
  initHeaderScroll();
  initScrollProgress();
  initLinkPrefetch();
  if (pageUsesSiteSettings()) {
    loadSiteSettings().catch((err) => {
      const message = err instanceof Error ? err.message : 'Failed to load site settings.';
      console.error(message);
    });
  }
});
