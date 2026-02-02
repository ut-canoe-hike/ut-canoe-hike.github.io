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

function getRequiredGoogleClientId() {
  const value = getRequiredConfig("googleClientId");
  return value;
}

function initCrossOriginResultListener() {
  window.addEventListener("message", (event) => {
    const data = event?.data;
    if (!data || data.utchSubmitResult !== true || !data.payload) return;
    window.dispatchEvent(new CustomEvent("utch:submitResult", { detail: data.payload }));
  });
}

function submitViaIframe(action, fields) {
  const baseUrl = getRequiredConfig("appsScriptWebAppUrl");
  if (!baseUrl) throw new Error("Missing Apps Script URL. Set UTCH_CONFIG.appsScriptWebAppUrl in assets/config.js.");

  const frameName = `utch-submit-${Math.random().toString(36).slice(2)}`;
  const iframe = document.createElement("iframe");
  iframe.name = frameName;
  iframe.style.display = "none";
  document.body.appendChild(iframe);

  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${baseUrl}?action=${encodeURIComponent(action)}`;
  form.target = frameName;

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

  // Cleanup later; allow time for redirect + postMessage.
  setTimeout(() => {
    try { form.remove(); } catch (_) {}
    try { iframe.remove(); } catch (_) {}
  }, 60_000);
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

    const onResult = (event) => {
      const detail = event.detail || {};
      if (detail.action !== "suggest") return;
      window.removeEventListener("utch:submitResult", onResult);
      if (detail.ok === "1") {
        setStatus(statusEl, "ok", "Sent! Thanks for the idea.");
        form.reset();
      } else {
        setStatus(statusEl, "err", detail.error || "Submission failed.");
      }
    };
    window.addEventListener("utch:submitResult", onResult);
    submitViaIframe("suggest", payload);
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
      const onResult = (event) => {
        const detail = event.detail || {};
        if (detail.action !== "rsvp") return;
        window.removeEventListener("utch:submitResult", onResult);
        if (detail.ok === "1") {
          setStatus(statusEl, "ok", "RSVP received. See you out there!");
          form.reset();
          loadTrips();
        } else {
          setStatus(statusEl, "err", detail.error || "RSVP failed.");
        }
      };
      window.addEventListener("utch:submitResult", onResult);
      submitViaIframe("rsvp", payload);
    } catch (err) {
      setStatus(statusEl, "err", String(err?.message || err));
    }
  });
}

function initOfficerCreateTrip() {
  const signinMount = document.querySelector("[data-officer-signin]");
  const authStatus = document.querySelector("[data-officer-auth-status]");
  const formCard = document.querySelector("[data-officer-form-card]");
  const form = document.querySelector("[data-officer-form]");
  const formStatus = document.querySelector("[data-officer-form-status]");

  if (!signinMount || !formCard || !form) return;

  const clientId = getRequiredGoogleClientId();
  if (!clientId) {
    setStatus(authStatus, "err", "Missing googleClientId in assets/config.js.");
    return;
  }

  let idToken = "";

  function onCredentialResponse(response) {
    if (!response || !response.credential) {
      setStatus(authStatus, "err", "Sign-in failed.");
      return;
    }
    idToken = response.credential;
    setStatus(authStatus, "ok", "Signed in. You can create trips now.");
    formCard.hidden = false;
  }

  function ensureGsiScriptLoaded() {
    if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve(true);

    return new Promise((resolve) => {
      // Avoid injecting multiple times.
      if (document.querySelector('script[data-gsi-client]')) {
        resolve(false);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.setAttribute("data-gsi-client", "true");
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  function initGsi() {
    if (!window.google || !google.accounts || !google.accounts.id) return false;
    try {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: onCredentialResponse,
        auto_select: false
      });
      google.accounts.id.renderButton(signinMount, {
        theme: "outline",
        size: "large",
        type: "standard",
        shape: "pill",
        text: "signin_with"
      });
      return true;
    } catch (err) {
      setStatus(authStatus, "err", String(err?.message || err));
      return true;
    }
  }

  // The GSI script may be blocked by extensions or network policies; inject + wait briefly.
  (async function bootOfficerAuth() {
    const injected = await ensureGsiScriptLoaded();

    (function waitForGsi(attemptsLeft) {
      if (initGsi()) return;
      if (attemptsLeft <= 0) {
        const origin = window.location.origin || "(unknown origin)";
        const msg = injected
          ? `Google Sign-In failed to initialize. Check console errors. (origin: ${origin})`
          : `Google Sign-In failed to load. Your browser/network may be blocking accounts.google.com. (origin: ${origin})`;
        setStatus(authStatus, "err", msg);
        return;
      }
      setTimeout(() => waitForGsi(attemptsLeft - 1), 250);
    })(20);
  })();

  function toIsoFromLocalDatetime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(formStatus, "", "Creating...");

    if (!idToken) {
      setStatus(formStatus, "err", "Sign in first.");
      return;
    }

    const gearAvailable = Array.from(form.querySelectorAll('input[name="gearAvailable"]:checked')).map((el) => el.value);

    const payload = {
      idToken,
      title: form.title.value.trim(),
      activity: form.activity.value,
      start: toIsoFromLocalDatetime(form.start.value),
      end: toIsoFromLocalDatetime(form.end.value),
      location: form.location.value.trim(),
      difficulty: form.difficulty.value,
      meetTime: form.meetTime.value.trim(),
      meetPlace: form.meetPlace.value.trim(),
      leaderName: form.leaderName.value.trim(),
      leaderContact: form.leaderContact.value.trim(),
      notes: form.notes.value.trim(),
      gearAvailable
    };

    const onResult = (event) => {
      const detail = event.detail || {};
      if (detail.action !== "createTrip") return;
      window.removeEventListener("utch:submitResult", onResult);
      if (detail.ok === "1") {
        const tripId = detail.tripId || "(unknown)";
        const rsvpUrl = detail.rsvpUrl || "";
        setStatus(formStatus, "ok", `Created. Trip ID: ${tripId}. RSVP URL: ${rsvpUrl}`);
        form.reset();
      } else {
        setStatus(formStatus, "err", detail.error || "Create trip failed.");
      }
    };
    window.addEventListener("utch:submitResult", onResult);
    submitViaIframe("createTrip", payload);
  });
}

// ============================================
// Initialize Everything
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  initCrossOriginResultListener();
  // Navigation
  initCurrentNav();
  initMobileMenu();
  initHeaderScroll();

  // Page-specific
  initCalendarEmbed();
  initSuggestForm();
  initRsvpForm();
  initOfficerCreateTrip();
});
