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
    setStatus(statusEl, "", "Sending...");

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

    try {
      await postToAppsScript("suggest", payload);
      setStatus(statusEl, "ok", "Sent! Thanks for the idea.");
      form.reset();
    } catch (err) {
      setStatus(statusEl, "err", String(err?.message || err));
    }
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
    const time = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const parts = [`${date} ${time}`, `— ${trip.title}`];
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
      const data = await postToAppsScript("listTrips", {});
      const trips = Array.isArray(data.trips) ? data.trips : [];
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

  if (tripSelect) {
    tripSelect.addEventListener("change", () => {
      renderGearForTrip(tripSelect.value);
    });
  }

  loadTrips();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(statusEl, "", "Sending...");

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

    try {
      await postToAppsScript("rsvp", payload);
      setStatus(statusEl, "ok", "RSVP received. See you out there!");
      form.reset();
      await loadTrips();
    } catch (err) {
      setStatus(statusEl, "err", String(err?.message || err));
    }
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
});
