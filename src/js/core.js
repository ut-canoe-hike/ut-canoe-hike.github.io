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
      const data = await api('GET', '/api/site-settings');
      const settings = data?.settings;
      if (!settings || typeof settings !== 'object') {
        throw new Error('Invalid site settings response.');
      }
      window.UTCH_SITE_SETTINGS = settings;
      applySiteSettings(settings);
      return settings;
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

function initPageLoad() {
  document.body.classList.add('is-loaded');
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
// Initialize Core
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('has-js');

  initCurrentNav();
  initMobileMenu();
  initHeaderScroll();
  initScrollProgress();
  initPageLoad();
  initPageTransitions();
  loadSiteSettings().catch((err) => {
    const message = err instanceof Error ? err.message : 'Failed to load site settings.';
    console.error(message);
  });
});
