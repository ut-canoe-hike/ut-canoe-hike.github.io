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
// Calendar
// ============================================

function initCalendarEmbed() {
  const iframe = document.querySelector('[data-calendar-embed]');
  if (!iframe) return;

  const embedUrl = getConfig().calendarEmbedUrl;
  if (embedUrl) {
    iframe.src = embedUrl;
  } else {
    const placeholder = document.querySelector('[data-calendar-placeholder]');
    if (placeholder) placeholder.hidden = false;
  }

  const icsLink = document.querySelector('[data-calendar-ics]');
  if (icsLink) {
    const icsUrl = getConfig().calendarIcsUrl;
    if (icsUrl) {
      icsLink.href = icsUrl;
      icsLink.target = '_blank';
      icsLink.rel = 'noopener noreferrer';
      icsLink.hidden = false;
    } else {
      icsLink.hidden = true;
    }
  }
}

// ============================================
// Forms
// ============================================

function initSuggestForm() {
  const form = document.querySelector('[data-suggest-form]');
  if (!form) return;

  const statusEl = document.querySelector('[data-form-status]');

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
    } catch (err) {
      setStatus(statusEl, 'err', err.message);
    }
  });
}

function initRsvpForm() {
  const form = document.querySelector('[data-rsvp-form]');
  if (!form) return;

  const statusEl = document.querySelector('[data-form-status]');
  const tripIdFromUrl = getQueryParam('tripId');
  const tripSelect = form.tripId;
  const gearField = form.querySelector('[data-gear-field]');
  const gearOptions = form.querySelector('[data-gear-options]');
  const timeZone = getDisplayTimeZone();

  const tripById = new Map();

  function formatTripLabel(trip) {
    const start = new Date(trip.start);
    const date = formatDateLabel(start, timeZone);
    const parts = [date, `— ${trip.title}`];
    if (!trip.isAllDay) {
      const time = formatTimeLabel(start, timeZone);
      parts[0] = `${date} ${time}`;
    }
    if (trip.location) parts.push(`(${trip.location})`);
    return parts.join(' ');
  }

  function renderGearForTrip(tripId) {
    if (!gearField || !gearOptions) return;
    gearOptions.innerHTML = '';

    const trip = tripById.get(tripId);
    const available = Array.isArray(trip?.gearAvailable) ? trip.gearAvailable : [];
    if (!available.length) {
      gearField.hidden = true;
      return;
    }

    gearField.hidden = false;
    for (const item of available) {
      const id = `gear-${item.replace(/\s+/g, '-')}`;
      const label = document.createElement('label');
      label.className = 'checkbox';
      label.setAttribute('for', id);

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'gearNeeded';
      input.value = item;
      input.id = id;

      const text = document.createElement('span');
      text.textContent = item.replace(/\b\w/g, c => c.toUpperCase());

      label.appendChild(input);
      label.appendChild(text);
      gearOptions.appendChild(label);
    }
  }

  async function loadTrips() {
    if (!tripSelect) return;
    tripSelect.disabled = true;
    tripSelect.innerHTML = '<option value="" selected disabled>Loading trips...</option>';

    try {
      const data = await api('GET', '/api/trips');
      tripSelect.innerHTML = '<option value="" selected disabled>Select a trip...</option>';

      for (const trip of data.trips) {
        tripById.set(trip.tripId, trip);
        const opt = document.createElement('option');
        opt.value = trip.tripId;
        opt.textContent = formatTripLabel(trip);
        tripSelect.appendChild(opt);
      }

      if (tripIdFromUrl && tripById.has(tripIdFromUrl)) {
        tripSelect.value = tripIdFromUrl;
        renderGearForTrip(tripIdFromUrl);
      } else {
        renderGearForTrip('');
      }

      tripSelect.disabled = false;
    } catch (err) {
      tripSelect.innerHTML = '<option value="" selected disabled>Unable to load trips</option>';
      setStatus(statusEl, 'err', err.message);
    }
  }

  if (tripSelect) {
    tripSelect.addEventListener('change', () => {
      renderGearForTrip(tripSelect.value);
    });
  }

  loadTrips();

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

    const tripId = form.tripId.value.trim();
    if (!tripId) {
      setStatus(statusEl, 'err', 'Please select a trip.');
      return;
    }

    try {
      await api('POST', '/api/rsvp', {
        tripId,
        name: form.name.value.trim(),
        contact: form.contact.value.trim(),
        carpool: form.carpool.value,
        gearNeeded: Array.from(form.querySelectorAll('input[name="gearNeeded"]:checked')).map(el => el.value),
        notes: form.notes.value.trim(),
      });
      setStatus(statusEl, 'ok', 'RSVP submitted! See you on the trip.');
      form.reset();
      renderGearForTrip('');
    } catch (err) {
      setStatus(statusEl, 'err', err.message);
    }
  });
}

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
}

// ============================================
// Initialize Everything
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initCurrentNav();
  initMobileMenu();
  initHeaderScroll();
  initCalendarEmbed();
  initSuggestForm();
  initRsvpForm();
  initOfficerPortal();
});
