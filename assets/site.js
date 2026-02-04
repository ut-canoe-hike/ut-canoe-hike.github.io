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

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || '';
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function getActivityClass(activity) {
  const map = {
    'Hike': 'activity-hike',
    'Backpacking': 'activity-hike',
    'Canoe/Kayak': 'activity-paddle',
    'Camping': 'activity-camp',
    'Climbing': 'activity-climb',
    'Other': 'activity-social'
  };
  return map[activity] || 'activity-hike';
}

function getActivityIcon(activity) {
  const icons = {
    'activity-hike': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20l6-9 5 7 4-6 3 8" /><path d="M3 20h18" /></svg>',
    'activity-paddle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12c2 2 4 2 6 0s4-2 6 0 4 2 6 0" /><path d="M12 3v18" /></svg>',
    'activity-climb': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 20l6-16 6 16" /><path d="M9 12h6" /></svg>',
    'activity-camp': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20l9-16 9 16" /><path d="M7 14h10" /></svg>',
    'activity-social': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="3" /><path d="M5 20c1.5-3 4-5 7-5s5.5 2 7 5" /></svg>'
  };
  return icons[activity] || icons['activity-hike'];
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
  const elements = document.querySelectorAll('.animate-in');
  if (!elements.length) return;

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

function initParallax() {
  const layers = document.querySelectorAll('[data-parallax]');
  if (!layers.length) return;

  // Check for reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const handle = () => {
    const scrollY = window.scrollY;
    layers.forEach(layer => {
      const speed = parseFloat(layer.dataset.parallax) || 0;
      const yPos = -(scrollY * speed);
      layer.style.transform = `translate3d(0, ${yPos}px, 0)`;
    });
  };

  window.addEventListener('scroll', handle, { passive: true });
  handle();
}

// ============================================
// Trip Card HTML Generator
// ============================================

function createTripCardHTML(trip, timeZone, includeRsvpBtn = false) {
  const start = new Date(trip.start);
  const dateStr = formatDateLabel(start, timeZone);
  const timeStr = trip.isAllDay ? 'All Day' : formatTimeLabel(start, timeZone);
  const activityClass = getActivityClass(trip.activity);
  const icon = getActivityIcon(activityClass);
  const difficultyClass = trip.difficulty
    ? `difficulty-badge difficulty-badge--${trip.difficulty.toLowerCase()}`
    : '';

  const dateParts = trip.isAllDay ? `<span>${dateStr}</span><span>•</span><span>${timeStr}</span>`
    : `<span>${dateStr}</span><span>•</span><span>${timeStr}</span>`;

  return `
    <article class="trip-card ${activityClass} animate-in" data-trip-id="${trip.tripId}">
      <div class="trip-card-header">
        <div class="trip-card-icon">${icon}</div>
        <div class="trip-card-title">
          <h3>${escapeHTML(trip.title)}</h3>
          <div class="trip-card-date">${dateParts}</div>
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
      const trips = data.trips.slice(0, 3); // First 3 trips

      if (!trips.length) {
        container.innerHTML = '<p class="trips-empty">No upcoming trips scheduled. Check back soon!</p>';
        return;
      }

      container.innerHTML = trips.map(trip => createTripCardHTML(trip, timeZone)).join('');

      // Trigger animations
      container.querySelectorAll('.trip-card').forEach((card, i) => {
        card.style.animationDelay = `${i * 0.1}s`;
        card.classList.add('animate-in');
      });
      initScrollAnimations();
      initMagneticElements();
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

      if (!data.trips.length) {
        container.innerHTML = '<p class="trips-empty">No upcoming trips. Check back soon or suggest one!</p>';
        return;
      }

      container.innerHTML = data.trips.map(trip => {
        tripMap.set(trip.tripId, trip);
        return createTripCardHTML(trip, timeZone, true); // true = include RSVP button
      }).join('');

      // Add click handlers for RSVP buttons
      container.querySelectorAll('[data-rsvp-trigger]').forEach(btn => {
        btn.addEventListener('click', () => {
          const tripId = btn.closest('[data-trip-id]').dataset.tripId;
          openRsvpPanel(tripMap.get(tripId));
        });
      });

      // Trigger animations
      initScrollAnimations();
      initMagneticElements();
    } catch (err) {
      container.innerHTML = '<p class="trips-error">Unable to load trips.</p>';
    }
  }

  loadTrips();

  // Expose tripMap for RSVP panel
  window.utchTripMap = tripMap;
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

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
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
      setStatus(statusEl, 'ok', 'Suggestion submitted! Thank you.');
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
  // Core
  initCurrentNav();
  initMobileMenu();
  initHeaderScroll();
  initScrollProgress();
  initScrollAnimations();
  initParallax();
  initPageLoad();
  initMagneticElements();
  initPageTransitions();

  // Page-specific
  initTripPreview();      // Homepage
  initTripsPage();        // Trips page
  initRsvpPanel();        // Trips page
  initCalendarEmbed();    // Trips page
  initSuggestForm();      // Suggest page
  initOfficerPortal();    // Officer page
});
