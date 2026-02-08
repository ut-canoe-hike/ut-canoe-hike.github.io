/**
 * trips.js — Trip card rendering, RSVP panel, calendar, suggest form
 * Loaded on index.html and trips.html
 */

import {
  api,
  getDisplayTimeZone,
  formatDateLabel,
  formatTimeLabel,
  escapeHTML,
  setStatus
} from './core.js';
import { initScrollAnimations, initCardHoverEffects } from './animations.js';

// ============================================
// Activity Metadata
// ============================================

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

function getErrorMessage(err, fallback) {
  return err instanceof Error && err.message ? err.message : fallback;
}

// ============================================
// Skeleton Loading
// ============================================

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
          <div class="trip-card-date"><span>${dateStr}</span><span>&bull;</span><span>${timeStr}</span></div>
        </div>
      </div>
      <div class="trip-card-body">
        ${trip.location ? `<p>${escapeHTML(trip.location)}</p>` : '<p>Details shared after RSVP.</p>'}
      </div>
      ${(trip.difficulty || includeRsvpBtn) ? `
      <div class="trip-card-footer">
        ${trip.difficulty ? `<span class="${difficultyClass}">${escapeHTML(trip.difficulty)}</span>` : '<span></span>'}
        ${includeRsvpBtn ? '<button class="btn btn-primary" data-rsvp-trigger>RSVP</button>' : ''}
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
    } catch {
      container.innerHTML = '<p class="trips-error">Unable to load trips.</p>';
    }
  }

  loadPreview();
}

// ============================================
// Trips Page — Full Trip List
// ============================================

function initTripsPage() {
  const container = document.querySelector('[data-trips-list]');
  if (!container) return;

  const timeZone = getDisplayTimeZone();
  const tripMap = new Map();
  const requestedTripId = new URLSearchParams(window.location.search).get('tripId');

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

      if (requestedTripId && tripMap.has(requestedTripId)) {
        openRsvpPanel(tripMap.get(requestedTripId));
      }
    } catch {
      container.innerHTML = '<p class="trips-error">Unable to load trips.</p>';
    }
  }

  loadTrips();
}

// ============================================
// RSVP Slide-Out Panel
// ============================================

function openRsvpPanel(trip) {
  if (!trip) return;
  if (window._openRsvpPanel) {
    window._openRsvpPanel(trip);
  }
}

function initRsvpPanel() {
  const panel = document.querySelector('[data-rsvp-panel]');
  const backdrop = document.querySelector('[data-panel-backdrop]');
  const closeBtn = document.querySelector('[data-panel-close]');
  const form = document.querySelector('[data-rsvp-form]');

  if (!panel || !form) return;

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
      setStatus(statusEl, 'err', getErrorMessage(err, 'Unable to submit RSVP.'));
    }
  });

  // Expose open function
  window._openRsvpPanel = function(trip) {
    if (!trip) return;

    tripIdInput.value = trip.tripId;

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

    panel.classList.add('active');
    backdrop?.classList.add('active');
    document.body.style.overflow = 'hidden';
    form.querySelector('#rsvpName')?.focus();
  };
}

// ============================================
// Calendar Embed
// ============================================

function initCalendarEmbed() {
  const iframe = document.querySelector('[data-calendar-embed]');
  if (!iframe) return;
  const { calendarEmbedUrl } = window.UTCH_CONFIG || {};
  if (calendarEmbedUrl) {
    iframe.src = calendarEmbedUrl;
  }
}

// ============================================
// Suggest Form
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
      if (statusEl) {
        statusEl.classList.remove('ok', 'err');
        statusEl.textContent = '';
        statusEl.hidden = true;
      }
      form.reset();
      if (successEl) {
        form.hidden = true;
        successEl.hidden = false;
      }
    } catch (err) {
      setStatus(statusEl, 'err', getErrorMessage(err, 'Unable to send suggestion.'));
    }
  });
}

// ============================================
// Initialize Trips Module
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initTripPreview();
  initRsvpPanel();
  initTripsPage();
  initCalendarEmbed();
  initSuggestForm();
});
