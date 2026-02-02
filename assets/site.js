/**
 * UTCH Website - Frontend JavaScript
 * University of Tennessee Canoe & Hiking Club
 */

// ============================================
// Configuration Helpers
// ============================================

function getConfig() {
  return window.UTCH_CONFIG || {};
}

function getRequiredConfig(key) {
  const value = (getConfig() || {})[key];
  if (!value || typeof value !== "string") return "";
  return value.trim();
}

// ============================================
// Utility Functions
// ============================================

function setStatus(el, kind, text) {
  if (!el) return;
  el.classList.remove("ok", "err");
  if (kind) el.classList.add(kind);
  el.textContent = text;
  el.hidden = false;
}

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || "";
}

function toIsoDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

// ============================================
// API Communication
// ============================================

async function postToAppsScript(action, payload) {
  const baseUrl = getRequiredConfig("appsScriptWebAppUrl");
  if (!baseUrl) {
    throw new Error("Missing Apps Script URL. Set UTCH_CONFIG.appsScriptWebAppUrl in assets/config.js.");
  }

  const url = new URL(baseUrl);
  url.searchParams.set("action", action);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Unexpected response (${response.status}): ${text.slice(0, 200)}`);
  }

  if (!response.ok || !data || data.ok !== true) {
    throw new Error(data && data.error ? data.error : `Request failed (${response.status})`);
  }
  return data;
}

function submitViaRedirect(action, fields) {
  const baseUrl = getRequiredConfig("appsScriptWebAppUrl");
  if (!baseUrl) throw new Error("Missing Apps Script URL. Set UTCH_CONFIG.appsScriptWebAppUrl in assets/config.js.");

  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${baseUrl}?action=${encodeURIComponent(action)}`;
  form.target = "_self";

  // Return to the current page after submission result.
  const returnTo = `${window.location.pathname}${window.location.search}`;
  const returnInput = document.createElement("input");
  returnInput.type = "hidden";
  returnInput.name = "returnTo";
  returnInput.value = returnTo;
  form.appendChild(returnInput);

  for (const [key, value] of Object.entries(fields || {})) {
    if (Array.isArray(value)) {
      for (const v of value) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = String(v);
        form.appendChild(input);
      }
    } else if (value !== undefined && value !== null) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = String(value);
      form.appendChild(input);
    }
  }

  document.body.appendChild(form);
  form.submit();
}

function submitViaIframe(action, fields, onResult) {
  const baseUrl = getRequiredConfig("appsScriptWebAppUrl");
  if (!baseUrl) {
    onResult({ ok: false, error: "Missing Apps Script URL. Set UTCH_CONFIG.appsScriptWebAppUrl in assets/config.js." });
    return;
  }

  const requestId = `utch_${Math.random().toString(36).slice(2)}`;
  const iframe = document.createElement("iframe");
  iframe.name = `utch_iframe_${requestId}`;
  iframe.style.display = "none";
  document.body.appendChild(iframe);

  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${baseUrl}?action=${encodeURIComponent(action)}`;
  form.target = iframe.name;

  const modeInput = document.createElement("input");
  modeInput.type = "hidden";
  modeInput.name = "mode";
  modeInput.value = "iframe";
  form.appendChild(modeInput);

  const requestInput = document.createElement("input");
  requestInput.type = "hidden";
  requestInput.name = "requestId";
  requestInput.value = requestId;
  form.appendChild(requestInput);

  for (const [key, value] of Object.entries(fields || {})) {
    if (Array.isArray(value)) {
      for (const v of value) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = String(v);
        form.appendChild(input);
      }
    } else if (value !== undefined && value !== null) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = String(value);
      form.appendChild(input);
    }
  }

  let done = false;
  const timeout = setTimeout(() => {
    if (done) return;
    done = true;
    cleanup();
    onResult({ ok: false, error: "Timed out. Please try again." });
  }, 15000);

  function cleanup() {
    clearTimeout(timeout);
    window.removeEventListener("message", handleMessage);
    try { form.remove(); } catch (_) {}
    try { iframe.remove(); } catch (_) {}
  }

  function isTrustedOrigin(origin) {
    return origin.includes("script.google.com") || origin.includes("script.googleusercontent.com");
  }

  function handleMessage(event) {
    if (!event || !event.data || event.data.type !== "utchResult") return;
    if (event.data.requestId !== requestId) return;
    if (!isTrustedOrigin(String(event.origin || ""))) return;
    if (done) return;
    done = true;
    cleanup();
    onResult(event.data.result || { ok: false, error: "Invalid response." });
  }

  window.addEventListener("message", handleMessage);
  document.body.appendChild(form);
  form.submit();
 }

// ============================================
// Navigation & Header
// ============================================

function initCurrentNav() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  for (const link of document.querySelectorAll(".nav a")) {
    const href = (link.getAttribute("href") || "").split("/").pop();
    if (href && href === path) {
      link.setAttribute("aria-current", "page");
    }
  }
}

function initMobileMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav");

  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.classList.toggle("active", isOpen);
    toggle.setAttribute("aria-expanded", isOpen);

    // Prevent body scroll when menu is open
    document.body.style.overflow = isOpen ? "hidden" : "";
  });

  // Close menu when clicking a link
  nav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.classList.remove("active");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    });
  });

  // Close menu on escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("open")) {
      nav.classList.remove("open");
      toggle.classList.remove("active");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }
  });
}

function initHeaderScroll() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  let lastScroll = 0;

  const handleScroll = () => {
    const currentScroll = window.scrollY;

    if (currentScroll > 10) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }

    lastScroll = currentScroll;
  };

  // Use passive listener for better scroll performance
  window.addEventListener("scroll", handleScroll, { passive: true });

  // Check initial state
  handleScroll();
}

// ============================================
// Calendar
// ============================================

function initCalendarEmbed() {
  const iframe = document.querySelector("[data-calendar-embed]");
  if (!iframe) return;

  const embedUrl = getRequiredConfig("calendarEmbedUrl");
  if (embedUrl) {
    iframe.src = embedUrl;
  } else {
    const placeholder = document.querySelector("[data-calendar-placeholder]");
    if (placeholder) placeholder.hidden = false;
  }

  const icsLink = document.querySelector("[data-calendar-ics]");
  if (icsLink) {
    const icsUrl = getRequiredConfig("calendarIcsUrl");
    if (icsUrl) {
      icsLink.href = icsUrl;
      icsLink.target = "_blank";
      icsLink.rel = "noopener noreferrer";
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
  const form = document.querySelector("[data-suggest-form]");
  if (!form) return;

  const statusEl = document.querySelector("[data-form-status]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(statusEl, "", "Redirecting...");

    const honeypot = form.querySelector('input[name="website"]')?.value || "";
    if (honeypot) {
      setStatus(statusEl, "ok", "Thanks! (ignored)");
      form.reset();
      return;
    }

    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      willingToLead: form.willingToLead.value,
      idea: form.idea.value.trim(),
      location: form.location.value.trim(),
      timing: form.timing.value.trim(),
      notes: form.notes.value.trim()
    };

    submitViaRedirect("suggest", payload);
  });
}

function initRsvpForm() {
  const form = document.querySelector("[data-rsvp-form]");
  if (!form) return;

  const statusEl = document.querySelector("[data-form-status]");
  const tripIdFromUrl = getQueryParam("tripId");
  const tripSelect = form.tripId;
  const gearField = form.querySelector("[data-gear-field]");
  const gearOptions = form.querySelector("[data-gear-options]");

  const tripById = new Map();

  function formatTripLabel(trip) {
    const start = new Date(trip.start);
    const date = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const parts = [date, `— ${trip.title}`];
    if (!trip.isAllDay) {
      const time = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      parts[0] = `${date} ${time}`;
    }
    if (trip.location) parts.push(`(${trip.location})`);
    return parts.join(" ");
  }

  function renderGearForTrip(tripId) {
    if (!gearField || !gearOptions) return;
    gearOptions.innerHTML = "";

    const trip = tripById.get(tripId);
    const available = Array.isArray(trip?.gearAvailable) ? trip.gearAvailable : [];
    if (!available.length) {
      gearField.hidden = true;
      return;
    }

    gearField.hidden = false;
    for (const item of available) {
      const id = `gear-${item.replace(/\\s+/g, "-")}`;
      const label = document.createElement("label");
      label.className = "checkbox";
      label.setAttribute("for", id);

      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "gearNeeded";
      input.value = item;
      input.id = id;

      const text = document.createElement("span");
      text.textContent = item.replace(/\b\w/g, (c) => c.toUpperCase());

      label.appendChild(input);
      label.appendChild(text);
      gearOptions.appendChild(label);
    }
  }

  async function loadTrips() {
    if (!tripSelect) return;
    tripSelect.disabled = true;
    tripSelect.innerHTML = '<option value="" selected disabled>Loading trips…</option>';

    try {
      const trips = await loadTripsJsonp();
      tripSelect.innerHTML = '<option value="" selected disabled>Select a trip…</option>';

      for (const trip of trips) {
        tripById.set(trip.tripId, trip);
        const opt = document.createElement("option");
        opt.value = trip.tripId;
        opt.textContent = formatTripLabel(trip);
        tripSelect.appendChild(opt);
      }

      if (tripIdFromUrl && tripById.has(tripIdFromUrl)) {
        tripSelect.value = tripIdFromUrl;
        renderGearForTrip(tripIdFromUrl);
      } else {
        renderGearForTrip("");
      }

      tripSelect.disabled = false;
    } catch (err) {
      tripSelect.innerHTML = '<option value="" selected disabled>Unable to load trips</option>';
      setStatus(statusEl, "err", String(err?.message || err));
    }
  }

  function loadTripsJsonp() {
    const baseUrl = getRequiredConfig("appsScriptWebAppUrl");
    if (!baseUrl) throw new Error("Missing Apps Script URL. Set UTCH_CONFIG.appsScriptWebAppUrl in assets/config.js.");
    return new Promise((resolve, reject) => {
      const callbackName = `utchTripsCb_${Math.random().toString(36).slice(2)}`;
      const url = new URL(baseUrl);
      url.searchParams.set("action", "listTrips");
      url.searchParams.set("callback", callbackName);

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out loading trips."));
      }, 8000);

      function cleanup() {
        clearTimeout(timer);
        try { delete window[callbackName]; } catch (_) {}
        try { script.remove(); } catch (_) {}
      }

      window[callbackName] = (data) => {
        cleanup();
        if (!data || data.ok !== true) {
          reject(new Error((data && data.error) ? data.error : "Unable to load trips."));
          return;
        }
        resolve(Array.isArray(data.trips) ? data.trips : []);
      };

      const script = document.createElement("script");
      script.src = url.toString();
      script.async = true;
      script.onerror = () => {
        cleanup();
        reject(new Error("Failed to load trips script."));
      };
      document.head.appendChild(script);
    });
  }

  if (tripSelect) {
    tripSelect.addEventListener("change", () => {
      renderGearForTrip(tripSelect.value);
    });
  }

  loadTrips();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(statusEl, "", "Redirecting...");

    const honeypot = form.querySelector('input[name="website"]')?.value || "";
    if (honeypot) {
      setStatus(statusEl, "ok", "Thanks! (ignored)");
      form.reset();
      return;
    }

    const payload = {
      tripId: form.tripId.value.trim(),
      name: form.name.value.trim(),
      contact: form.contact.value.trim(),
      carpool: form.carpool.value,
      gearNeeded: Array.from(form.querySelectorAll('input[name="gearNeeded"]:checked')).map((el) => el.value),
      notes: form.notes.value.trim()
    };

    if (!payload.tripId) {
      setStatus(statusEl, "err", "Please select a trip.");
      return;
    }

    if (!payload.contact) {
      setStatus(statusEl, "err", "Contact is required.");
      return;
    }

    submitViaRedirect("rsvp", payload);
  });
}

function initOfficerPortal() {
  const loginSection = document.querySelector("[data-officer-login]");
  const dashboard = document.querySelector("[data-officer-dashboard]");
  if (!loginSection || !dashboard) return;

  const loginForm = loginSection.querySelector("[data-officer-login-form]");
  const loginStatus = loginSection.querySelector("[data-officer-login-status]");

  const createForm = dashboard.querySelector("[data-officer-create-form]");
  const createStatus = dashboard.querySelector("[data-officer-create-status]");
  const editForm = dashboard.querySelector("[data-officer-edit-form]");
  const editStatus = dashboard.querySelector("[data-officer-edit-status]");
  const deleteForm = dashboard.querySelector("[data-officer-delete-form]");
  const deleteStatus = dashboard.querySelector("[data-officer-delete-status]");

  const editSelect = dashboard.querySelector("[data-edit-trip-select]");
  const deleteSelect = dashboard.querySelector("[data-delete-trip-select]");

  let officerSecret = "";
  const tripsById = new Map();

  function showDashboard() {
    loginSection.hidden = true;
    dashboard.hidden = false;
    if (window.location.hash !== "#manage") {
      window.location.hash = "manage";
    }
  }

  function formatTripLabel(trip) {
    const start = trip.start ? new Date(trip.start) : null;
    const date = start && !Number.isNaN(start.getTime())
      ? start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
      : "Unknown date";
    const parts = [date, `— ${trip.title || "Trip"}`];
    if (start && !trip.isAllDay) {
      const time = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      parts[0] = `${date} ${time}`;
    }
    if (trip.location) parts.push(`(${trip.location})`);
    return parts.join(" ");
  }

  function toDateInput(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }

  function toTimeInput(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(11, 16);
  }

  function setGearCheckboxes(form, values) {
    const selected = new Set((values || []).map((item) => String(item).toLowerCase()));
    form.querySelectorAll('input[name="gearAvailable"]').forEach((input) => {
      input.checked = selected.has(String(input.value).toLowerCase());
    });
  }

  function populateSelect(select, trips) {
    if (!select) return;
    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = trips.length ? "Select a trip…" : "No trips found";
    select.appendChild(placeholder);

    for (const trip of trips) {
      const opt = document.createElement("option");
      opt.value = trip.tripId;
      opt.textContent = formatTripLabel(trip);
      select.appendChild(opt);
    }
    select.disabled = !trips.length;
  }

  function loadAdminTrips() {
    if (!officerSecret) return;
    if (editSelect) {
      editSelect.disabled = true;
      editSelect.innerHTML = '<option value="" selected disabled>Loading trips…</option>';
    }
    if (deleteSelect) {
      deleteSelect.disabled = true;
      deleteSelect.innerHTML = '<option value="" selected disabled>Loading trips…</option>';
    }

    submitViaIframe("listTripsAdmin", { officerSecret }, (result) => {
      if (!result || result.ok !== true) {
        const message = result && result.error ? result.error : "Unable to load trips.";
        if (editStatus) setStatus(editStatus, "err", message);
        if (deleteStatus) setStatus(deleteStatus, "err", message);
        return;
      }

      tripsById.clear();
      const trips = Array.isArray(result.trips) ? result.trips : [];
      for (const trip of trips) {
        tripsById.set(trip.tripId, trip);
      }

      populateSelect(editSelect, trips);
      populateSelect(deleteSelect, trips);
    });
  }

  function collectTripPayload(form) {
    const gearAvailable = Array.from(form.querySelectorAll('input[name="gearAvailable"]:checked')).map((el) => el.value);
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
      gearAvailable
    };
  }

  function fillEditForm(trip) {
    if (!editForm || !trip) return;
    editForm.title.value = trip.title || "";
    editForm.activity.value = trip.activity || "";
    editForm.location.value = trip.location || "";
    editForm.difficulty.value = trip.difficulty || "";
    editForm.meetTime.value = trip.meetTime || "";
    editForm.meetPlace.value = trip.meetPlace || "";
    editForm.leaderName.value = trip.leaderName || "";
    editForm.leaderContact.value = trip.leaderContact || "";
    editForm.notes.value = trip.notes || "";

    const startDate = trip.start ? new Date(trip.start) : null;
    const endDate = trip.end ? new Date(trip.end) : null;

    if (trip.isAllDay) {
      editForm.startDate.value = toDateInput(startDate);
      if (endDate && !Number.isNaN(endDate.getTime())) {
        const inclusiveEnd = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        editForm.endDate.value = toDateInput(inclusiveEnd);
      } else {
        editForm.endDate.value = "";
      }
      editForm.startTime.value = "";
      editForm.endTime.value = "";
    } else {
      editForm.startDate.value = toDateInput(startDate);
      editForm.startTime.value = toTimeInput(startDate);
      editForm.endDate.value = toDateInput(endDate || startDate);
      editForm.endTime.value = toTimeInput(endDate);
    }

    setGearCheckboxes(editForm, trip.gearAvailable || []);
  }

  if (editSelect) {
    editSelect.addEventListener("change", () => {
      const trip = tripsById.get(editSelect.value);
      fillEditForm(trip);
    });
  }

  loginForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const secret = loginForm.officerSecret.value.trim();
    if (!secret) {
      setStatus(loginStatus, "err", "Passcode is required.");
      return;
    }
    setStatus(loginStatus, "", "Checking…");

    submitViaIframe("verifyOfficer", { officerSecret: secret }, (result) => {
      if (!result || result.ok !== true) {
        setStatus(loginStatus, "err", result && result.error ? result.error : "Not authorized.");
        return;
      }
      officerSecret = secret;
      setStatus(loginStatus, "ok", "Access granted.");
      showDashboard();
      loadAdminTrips();
    });
  });

  createForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!officerSecret) return;
    setStatus(createStatus, "", "Submitting…");

    const payload = collectTripPayload(createForm);
    payload.officerSecret = officerSecret;

    submitViaIframe("createTrip", payload, (result) => {
      if (!result || result.ok !== true) {
        setStatus(createStatus, "err", result && result.error ? result.error : "Trip submission failed.");
        return;
      }
      setStatus(createStatus, "ok", "Trip Submitted Successfully");
      createForm.reset();
      loadAdminTrips();
    });
  });

  editForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!officerSecret) return;
    if (!editSelect || !editSelect.value) {
      setStatus(editStatus, "err", "Select a trip to edit.");
      return;
    }
    setStatus(editStatus, "", "Saving…");

    const payload = collectTripPayload(editForm);
    payload.officerSecret = officerSecret;
    payload.tripId = editSelect.value;

    submitViaIframe("updateTrip", payload, (result) => {
      if (!result || result.ok !== true) {
        setStatus(editStatus, "err", result && result.error ? result.error : "Update failed.");
        return;
      }
      setStatus(editStatus, "ok", "Changes saved.");
      loadAdminTrips();
    });
  });

  deleteForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!officerSecret) return;
    if (!deleteSelect || !deleteSelect.value) {
      setStatus(deleteStatus, "err", "Select a trip to delete.");
      return;
    }
    const ok = window.confirm("Delete this trip? This cannot be undone.");
    if (!ok) return;
    setStatus(deleteStatus, "", "Deleting…");

    submitViaIframe("deleteTrip", { officerSecret, tripId: deleteSelect.value }, (result) => {
      if (!result || result.ok !== true) {
        setStatus(deleteStatus, "err", result && result.error ? result.error : "Delete failed.");
        return;
      }
      setStatus(deleteStatus, "ok", "Trip deleted.");
      loadAdminTrips();
    });
  });
}

// ============================================
// Initialize Everything
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  // Navigation
  initCurrentNav();
  initMobileMenu();
  initHeaderScroll();

  // Page-specific
  initCalendarEmbed();
  initSuggestForm();
  initRsvpForm();
  initOfficerPortal();
});
