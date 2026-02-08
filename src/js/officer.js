/**
 * officer.js — Officer portal: login, create/edit/delete trips, calendar sync
 * Loaded only on officer.html
 */

import {
  api,
  getDisplayTimeZone,
  getDateTimePartsForInput,
  formatDateLabel,
  formatTimeLabel,
  setStatus
} from './core.js';

function getErrorMessage(err, fallback) {
  return err instanceof Error && err.message ? err.message : fallback;
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
      const message = getErrorMessage(err, 'Unable to load trips.');
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
      setStatus(loginStatus, 'err', getErrorMessage(err, 'Not authorized.'));
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
      setStatus(createStatus, 'err', getErrorMessage(err, 'Trip submission failed.'));
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
      setStatus(editStatus, 'err', getErrorMessage(err, 'Update failed.'));
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
      setStatus(deleteStatus, 'err', getErrorMessage(err, 'Delete failed.'));
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
      setStatus(syncStatus, 'err', getErrorMessage(err, 'Sync failed.'));
    } finally {
      syncButton.disabled = false;
    }
  });
}

// ============================================
// Initialize Officer Module
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initOfficerPortal();
});
