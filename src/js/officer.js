/**
 * officer.js — Officer portal: trip tools and request roster management
 * Loaded only on officer and officer-settings pages
 */

import {
  api,
  getDisplayTimeZone,
  getDateTimePartsForInput,
  formatDateLabel,
  formatTimeLabel,
  setStatus,
  escapeHTML
} from './core.js';

function getErrorMessage(err, fallback) {
  return err instanceof Error && err.message ? err.message : fallback;
}

function summarizeWarnings(warnings) {
  if (!Array.isArray(warnings) || !warnings.length) return '';
  const list = warnings
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  if (!list.length) return '';
  if (list.length === 1) return `Warning: ${list[0]}`;
  return `Warnings (${list.length}): ${list.slice(0, 2).join(' | ')}${list.length > 2 ? ' | ...' : ''}`;
}

function normalizeSignupStatus(value) {
  const status = String(value || '').trim().toUpperCase();
  if (status === 'REQUEST_OPEN') return 'REQUEST_OPEN';
  if (status === 'MEETING_ONLY') return 'MEETING_ONLY';
  if (status === 'FULL') return 'FULL';
  throw new Error(`Invalid signup status: ${status || '(missing)'}`);
}

const SITE_SETTINGS_FIELDS = [
  'contactEmail',
  'volLinkUrl',
  'groupMeUrl',
  'meetingSchedule',
  'meetingLocation',
  'meetingNote',
  'requestIntroMessage',
  'meetingOnlyMessage',
  'fullTripMessage',
  'requestReceivedMessage',
];

function initOfficerPortal() {
  const loginSection = document.querySelector('[data-officer-login]');
  const dashboard = document.querySelector('[data-officer-dashboard]');
  if (!loginSection || !dashboard) return;

  const loginForm = loginSection.querySelector('[data-officer-login-form]');
  const loginStatus = loginSection.querySelector('[data-officer-login-status]');

  const tripForm = dashboard.querySelector('[data-officer-trip-form]');
  const tripStatus = dashboard.querySelector('[data-officer-trip-status]');
  const tripModeSelect = dashboard.querySelector('[data-trip-mode-select]');
  const tripSelectRow = dashboard.querySelector('[data-trip-select-row]');
  const tripSelect = dashboard.querySelector('[data-trip-select]');
  const tripSubmitLabel = dashboard.querySelector('[data-trip-submit-label]');

  const deleteForm = dashboard.querySelector('[data-officer-delete-form]');
  const deleteStatus = dashboard.querySelector('[data-officer-delete-status]');
  const settingsForm = dashboard.querySelector('[data-officer-settings-form]');
  const settingsStatus = dashboard.querySelector('[data-officer-settings-status]');
  const syncButton = dashboard.querySelector('[data-officer-sync-button]');
  const syncStatus = dashboard.querySelector('[data-officer-sync-status]');

  const deleteSelect = dashboard.querySelector('[data-delete-trip-select]');
  const requestsTripSelect = dashboard.querySelector('[data-requests-trip-select]');
  const requestsStatus = dashboard.querySelector('[data-officer-requests-status]');
  const requestsBoard = dashboard.querySelector('[data-officer-requests-board]');
  const pendingList = dashboard.querySelector('[data-requests-pending]');
  const approvedList = dashboard.querySelector('[data-requests-approved]');
  const declinedList = dashboard.querySelector('[data-requests-declined]');

  const timeZone = getDisplayTimeZone();

  let officerSecret = '';
  let activeRequestsTripId = '';
  const tripsById = new Map();
  const dashboardHash = dashboard.dataset.officerHash || 'manage';
  const shouldLoadTrips = Boolean(tripForm || deleteForm || requestsTripSelect);
  const shouldLoadSettings = Boolean(settingsForm);

  function getTripMode() {
    return tripModeSelect?.value === 'EDIT' ? 'EDIT' : 'CREATE';
  }

  function showDashboard() {
    loginSection.classList.add('is-hidden');
    dashboard.classList.remove('is-hidden');
    if (window.location.hash !== `#${dashboardHash}`) {
      window.location.hash = dashboardHash;
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

  function populateSelect(select, trips, placeholderText = 'Select a trip...') {
    if (!select) return;
    const previousValue = select.value;

    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = trips.length ? placeholderText : 'No trips found';
    select.appendChild(placeholder);

    for (const trip of trips) {
      const opt = document.createElement('option');
      opt.value = trip.tripId;
      opt.textContent = formatTripLabel(trip);
      select.appendChild(opt);
    }

    select.disabled = !trips.length;

    if (previousValue && trips.some((trip) => trip.tripId === previousValue)) {
      select.value = previousValue;
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
      signupStatus: normalizeSignupStatus(form.signupStatus?.value),
      gearAvailable,
      officerSecret,
    };
  }

  function clearTripForm() {
    if (!tripForm) return;
    tripForm.reset();
    if (tripForm.signupStatus) {
      tripForm.signupStatus.value = 'REQUEST_OPEN';
    }
    setGearCheckboxes(tripForm, []);
  }

  function fillTripForm(trip) {
    if (!tripForm || !trip) return;

    tripForm.title.value = trip.title || '';
    tripForm.activity.value = trip.activity || '';
    tripForm.location.value = trip.location || '';
    tripForm.difficulty.value = trip.difficulty || '';
    tripForm.meetTime.value = trip.meetTime || '';
    tripForm.meetPlace.value = trip.meetPlace || '';
    tripForm.leaderName.value = trip.leaderName || '';
    tripForm.leaderContact.value = trip.leaderContact || '';
    tripForm.notes.value = trip.notes || '';
    tripForm.signupStatus.value = normalizeSignupStatus(trip.signupStatus);

    const startDate = trip.start ? new Date(trip.start) : null;
    const endDate = trip.end ? new Date(trip.end) : null;

    if (trip.isAllDay) {
      tripForm.startDate.value = toDateInput(startDate);
      if (endDate && !Number.isNaN(endDate.getTime())) {
        const inclusiveEnd = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        tripForm.endDate.value = toDateInput(inclusiveEnd);
      } else {
        tripForm.endDate.value = '';
      }
      tripForm.startTime.value = '';
      tripForm.endTime.value = '';
    } else {
      tripForm.startDate.value = toDateInput(startDate);
      tripForm.startTime.value = toTimeInput(startDate);
      tripForm.endDate.value = toDateInput(endDate || startDate);
      tripForm.endTime.value = toTimeInput(endDate);
    }

    setGearCheckboxes(tripForm, trip.gearAvailable || []);
  }

  function updateTripFormMode() {
    if (!tripModeSelect) return;
    const mode = getTripMode();

    if (tripSubmitLabel) {
      tripSubmitLabel.textContent = mode === 'EDIT' ? 'Save Changes' : 'Create Trip';
    }

    if (tripSelectRow) {
      tripSelectRow.hidden = mode !== 'EDIT';
    }

    if (tripSelect) {
      tripSelect.required = mode === 'EDIT';
    }

    if (mode === 'CREATE') {
      clearTripForm();
      if (tripSelect) {
        tripSelect.value = '';
      }
    } else if (tripSelect?.value && tripsById.has(tripSelect.value)) {
      fillTripForm(tripsById.get(tripSelect.value));
    }

    if (tripStatus) {
      tripStatus.hidden = true;
    }
  }

  function fillSiteSettingsForm(settings) {
    if (!settingsForm || !settings || typeof settings !== 'object') return;
    for (const key of SITE_SETTINGS_FIELDS) {
      const field = settingsForm.elements.namedItem(key);
      if (!field || !('value' in field)) continue;
      const value = settings[key];
      field.value = typeof value === 'string' ? value : '';
    }
  }

  function collectSiteSettingsPayload(form) {
    const settings = {};
    for (const key of SITE_SETTINGS_FIELDS) {
      const field = form.elements.namedItem(key);
      if (!field || !('value' in field)) continue;
      settings[key] = field.value.trim();
    }
    return settings;
  }

  function validateHttpsSettingUrl(value, fieldLabel) {
    const trimmed = String(value || '').trim();
    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch {
      return `${fieldLabel} must be a valid URL.`;
    }
    if (parsed.protocol !== 'https:') {
      return `${fieldLabel} must start with https://`;
    }
    return '';
  }

  function formatRequestSubmittedAt(value) {
    if (!value) return 'Unknown time';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
    });
  }

  function renderRequestList(listEl, requests, kind) {
    if (!listEl) return;

    if (!requests.length) {
      const emptyMessage = kind === 'pending'
        ? 'No pending requests.'
        : kind === 'approved'
          ? 'No approved members yet.'
          : 'No declined requests.';
      listEl.innerHTML = `<li class="requests-empty">${emptyMessage}</li>`;
      return;
    }

    listEl.innerHTML = requests.map((request) => {
      if (!request?.requestId) {
        throw new Error('Request data is missing requestId.');
      }
      if (!Array.isArray(request.gearNeeded)) {
        throw new Error(`Request ${request.requestId} has invalid gearNeeded format.`);
      }
      const safeRequestId = escapeHTML(String(request.requestId));
      const gear = request.gearNeeded.length
        ? request.gearNeeded.map(item => escapeHTML(String(item))).join(', ')
        : 'None listed';
      const notes = request.notes ? escapeHTML(String(request.notes)) : 'No notes';
      const carpool = request.carpool ? escapeHTML(String(request.carpool)) : 'Not specified';
      const submittedAt = formatRequestSubmittedAt(request.submittedAt);
      const name = request.name ? escapeHTML(String(request.name)) : 'Unnamed request';
      const contact = request.contact ? escapeHTML(String(request.contact)) : 'None provided';

      const actions = kind === 'pending'
        ? `
          <button class="btn btn-primary btn-sm" type="button" data-request-id="${safeRequestId}" data-next-status="APPROVED">Approve</button>
          <button class="btn btn-outline btn-sm" type="button" data-request-id="${safeRequestId}" data-next-status="DECLINED">Decline</button>
        `
        : kind === 'approved'
          ? `
            <button class="btn btn-secondary btn-sm" type="button" data-request-id="${safeRequestId}" data-next-status="PENDING">Move to Pending</button>
            <button class="btn btn-outline btn-sm" type="button" data-request-id="${safeRequestId}" data-next-status="DECLINED">Decline</button>
          `
          : `
            <button class="btn btn-primary btn-sm" type="button" data-request-id="${safeRequestId}" data-next-status="APPROVED">Approve</button>
            <button class="btn btn-secondary btn-sm" type="button" data-request-id="${safeRequestId}" data-next-status="PENDING">Move to Pending</button>
          `;

      return `
        <li class="request-item">
          <div class="request-item-head">
            <strong>${name}</strong>
            <span>${submittedAt}</span>
          </div>
          <p><strong>Contact:</strong> ${contact}</p>
          <p><strong>Carpool:</strong> ${carpool}</p>
          <p><strong>Gear Needed:</strong> ${gear}</p>
          <p><strong>Notes:</strong> ${notes}</p>
          <div class="request-actions">
            ${actions}
          </div>
        </li>
      `;
    }).join('');
  }

  async function loadTripRequests(tripId) {
    if (!officerSecret || !requestsTripSelect) return;

    activeRequestsTripId = tripId || '';

    if (!tripId) {
      if (pendingList) pendingList.innerHTML = '<li class="requests-empty">Select a trip to view requests.</li>';
      if (approvedList) approvedList.innerHTML = '<li class="requests-empty">Select a trip to view roster.</li>';
      if (declinedList) declinedList.innerHTML = '<li class="requests-empty">Select a trip to view declined requests.</li>';
      if (requestsStatus) requestsStatus.hidden = true;
      return;
    }

    setStatus(requestsStatus, '', 'Loading requests...');

    try {
      const data = await api('POST', '/api/requests/by-trip', { officerSecret, tripId });
      if (!Array.isArray(data.requests)) {
        throw new Error('Invalid API response: requests list is missing.');
      }

      const pending = data.requests.filter((req) => req.status === 'PENDING');
      const approved = data.requests.filter((req) => req.status === 'APPROVED');
      const declined = data.requests.filter((req) => req.status === 'DECLINED');

      renderRequestList(pendingList, pending, 'pending');
      renderRequestList(approvedList, approved, 'approved');
      renderRequestList(declinedList, declined, 'declined');
      setStatus(
        requestsStatus,
        'ok',
        `Loaded ${pending.length} pending, ${approved.length} approved, and ${declined.length} declined.`
      );
    } catch (err) {
      setStatus(requestsStatus, 'err', getErrorMessage(err, 'Unable to load trip requests.'));
      if (pendingList) pendingList.innerHTML = '<li class="requests-empty">Unable to load pending requests.</li>';
      if (approvedList) approvedList.innerHTML = '<li class="requests-empty">Unable to load roster.</li>';
      if (declinedList) declinedList.innerHTML = '<li class="requests-empty">Unable to load declined requests.</li>';
    }
  }

  async function loadEditableSiteSettings() {
    if (!officerSecret || !settingsForm) return;
    setStatus(settingsStatus, '', 'Loading site settings...');
    try {
      const data = await api('GET', '/api/site-settings');
      if (!data?.settings || typeof data.settings !== 'object') {
        throw new Error('Invalid site settings response.');
      }
      fillSiteSettingsForm(data.settings);
      const warningSummary = summarizeWarnings(data.warnings);
      setStatus(
        settingsStatus,
        'ok',
        warningSummary ? `Site settings loaded. ${warningSummary}` : 'Site settings loaded.'
      );
    } catch (err) {
      setStatus(settingsStatus, 'err', getErrorMessage(err, 'Unable to load site settings.'));
    }
  }

  async function loadAdminTrips() {
    if (!officerSecret) return;

    if (tripSelect) {
      tripSelect.disabled = true;
      tripSelect.innerHTML = '<option value="" selected disabled>Loading trips...</option>';
    }
    if (deleteSelect) {
      deleteSelect.disabled = true;
      deleteSelect.innerHTML = '<option value="" selected disabled>Loading trips...</option>';
    }
    if (requestsTripSelect) {
      requestsTripSelect.disabled = true;
      requestsTripSelect.innerHTML = '<option value="" selected disabled>Loading trips...</option>';
    }

    try {
      const data = await api('POST', '/api/trips/admin', { officerSecret });
      tripsById.clear();
      if (!Array.isArray(data.trips)) {
        throw new Error('Invalid API response: trips list is missing.');
      }

      const trips = data.trips;
      for (const trip of trips) {
        trip.signupStatus = normalizeSignupStatus(trip.signupStatus);
        tripsById.set(trip.tripId, trip);
      }

      populateSelect(tripSelect, trips);
      populateSelect(deleteSelect, trips);
      populateSelect(requestsTripSelect, trips);

      if (getTripMode() === 'EDIT' && tripSelect?.value && tripsById.has(tripSelect.value)) {
        fillTripForm(tripsById.get(tripSelect.value));
      }

      if (activeRequestsTripId && tripsById.has(activeRequestsTripId) && requestsTripSelect) {
        requestsTripSelect.value = activeRequestsTripId;
        await loadTripRequests(activeRequestsTripId);
      } else if (requestsTripSelect && requestsTripSelect.value) {
        await loadTripRequests(requestsTripSelect.value);
      } else {
        await loadTripRequests('');
      }
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to load trips.');
      if (tripStatus) setStatus(tripStatus, 'err', message);
      if (deleteStatus) setStatus(deleteStatus, 'err', message);
      if (requestsStatus) setStatus(requestsStatus, 'err', message);
    }
  }

  tripModeSelect?.addEventListener('change', () => {
    updateTripFormMode();
  });

  tripSelect?.addEventListener('change', () => {
    const trip = tripsById.get(tripSelect.value);
    fillTripForm(trip);
  });

  updateTripFormMode();

  requestsTripSelect?.addEventListener('change', () => {
    loadTripRequests(requestsTripSelect.value);
  });

  requestsBoard?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-request-id][data-next-status]');
    if (!button || !officerSecret || !activeRequestsTripId) return;

    const requestId = button.dataset.requestId;
    const nextStatus = button.dataset.nextStatus;
    if (!requestId || !nextStatus) return;

    button.disabled = true;
    setStatus(requestsStatus, '', 'Updating request...');

    try {
      await api('PATCH', `/api/requests/${encodeURIComponent(requestId)}/status`, {
        officerSecret,
        status: nextStatus,
      });
      await loadTripRequests(activeRequestsTripId);
      setStatus(requestsStatus, 'ok', 'Request updated.');
    } catch (err) {
      setStatus(requestsStatus, 'err', getErrorMessage(err, 'Unable to update request.'));
      button.disabled = false;
    }
  });

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
    } catch (err) {
      setStatus(loginStatus, 'err', getErrorMessage(err, 'Not authorized.'));
      return;
    }

    officerSecret = secret;
    setStatus(loginStatus, 'ok', 'Access granted.');
    showDashboard();
    updateTripFormMode();

    const loaders = [];
    if (shouldLoadTrips) loaders.push(loadAdminTrips());
    if (shouldLoadSettings) loaders.push(loadEditableSiteSettings());
    await Promise.allSettled(loaders);
  });

  settingsForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!officerSecret) return;
    setStatus(settingsStatus, '', 'Saving settings...');

    const settingsPayload = collectSiteSettingsPayload(settingsForm);
    const volLinkUrlError = validateHttpsSettingUrl(settingsPayload.volLinkUrl, 'VOLlink URL');
    if (volLinkUrlError) {
      setStatus(settingsStatus, 'err', volLinkUrlError);
      return;
    }
    const groupMeUrlError = validateHttpsSettingUrl(settingsPayload.groupMeUrl, 'GroupMe URL');
    if (groupMeUrlError) {
      setStatus(settingsStatus, 'err', groupMeUrlError);
      return;
    }

    try {
      const data = await api('POST', '/api/site-settings', {
        officerSecret,
        settings: settingsPayload,
      });
      if (!data?.settings || typeof data.settings !== 'object') {
        throw new Error('Invalid settings response.');
      }
      fillSiteSettingsForm(data.settings);
      const warningSummary = summarizeWarnings(data.warnings);
      setStatus(
        settingsStatus,
        'ok',
        warningSummary ? `Site settings saved. ${warningSummary}` : 'Site settings saved.'
      );
    } catch (err) {
      setStatus(settingsStatus, 'err', getErrorMessage(err, 'Unable to save site settings.'));
    }
  });

  tripForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!officerSecret) return;

    const mode = getTripMode();
    if (mode === 'EDIT' && !tripSelect?.value) {
      setStatus(tripStatus, 'err', 'Select a trip to edit.');
      return;
    }

    setStatus(tripStatus, '', mode === 'EDIT' ? 'Saving...' : 'Submitting...');

    try {
      if (mode === 'EDIT') {
        await api('PATCH', `/api/trips/${encodeURIComponent(tripSelect.value)}`, collectTripPayload(tripForm));
        setStatus(tripStatus, 'ok', 'Changes saved.');
      } else {
        const data = await api('POST', '/api/trips', collectTripPayload(tripForm));
        setStatus(tripStatus, 'ok', `Trip created! Join link: ${data.requestUrl}`);
        clearTripForm();
      }
      await loadAdminTrips();
    } catch (err) {
      setStatus(
        tripStatus,
        'err',
        getErrorMessage(err, mode === 'EDIT' ? 'Update failed.' : 'Trip submission failed.')
      );
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
      await loadAdminTrips();
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
      await loadAdminTrips();
    } catch (err) {
      setStatus(syncStatus, 'err', getErrorMessage(err, 'Sync failed.'));
    } finally {
      syncButton.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initOfficerPortal();
});
