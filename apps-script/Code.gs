const CONFIG_KEYS = {
  spreadsheetId: "UTCH_SPREADSHEET_ID",
  calendarId: "UTCH_CALENDAR_ID",
  siteBaseUrl: "UTCH_SITE_BASE_URL",
  googleClientId: "UTCH_GOOGLE_CLIENT_ID",
  officerAllowlist: "UTCH_OFFICER_ALLOWLIST",
  notifyEmail: "UTCH_NOTIFY_EMAIL"
};

function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) ? String(e.parameter.page) : "";
  if (page === "officer") {
    const template = HtmlService.createTemplateFromFile("Officer");
    template.clientId = getProp_(CONFIG_KEYS.googleClientId) || "";
    template.siteBaseUrl = (getProp_(CONFIG_KEYS.siteBaseUrl) || "").replace(/\/+$/, "");
    return template
      .evaluate()
      .setTitle("UTCH Officer • Create Trip")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DENY);
  }

  return ContentService.createTextOutput(
    "UTCH Apps Script is deployed. Use ?page=officer for the officer trip-creation page, or POST with ?action=suggest|rsvp|createTrip."
  );
}

function doPost(e) {
  const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : "";
  try {
    const body = parseJsonBody_(e);
    if (action === "suggest") return json_(handleSuggest_(body));
    if (action === "rsvp") return json_(handleRsvp_(body));
    if (action === "listTrips") return json_(handleListTrips_(body));
    if (action === "createTrip") return json_(handleCreateTrip_(body));
    return json_({ ok: false, error: "Unknown action. Use ?action=suggest|rsvp|listTrips|createTrip." }, 400);
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
  }
}

function handleSuggest_(body) {
  const name = requiredString_(body.name, "name");
  const idea = requiredString_(body.idea, "idea");

  const spreadsheet = SpreadsheetApp.openById(requiredProp_(CONFIG_KEYS.spreadsheetId));
  const sheet = ensureSheet_(spreadsheet, "Suggestions", [
    "submittedAt",
    "name",
    "email",
    "willingToLead",
    "idea",
    "location",
    "timing",
    "notes"
  ]);

  sheet.appendRow([
    new Date(),
    name,
    optionalString_(body.email),
    optionalString_(body.willingToLead),
    idea,
    optionalString_(body.location),
    optionalString_(body.timing),
    optionalString_(body.notes)
  ]);

  const notifyEmail = (getProp_(CONFIG_KEYS.notifyEmail) || "").trim();
  if (notifyEmail) {
    const subject = `UTCH Trip Suggestion: ${idea}`.slice(0, 140);
    const message = [
      `Name: ${name}`,
      body.email ? `Email: ${body.email}` : "",
      `Willing to lead: ${optionalString_(body.willingToLead) || "n/a"}`,
      "",
      `Idea: ${idea}`,
      body.location ? `Location: ${body.location}` : "",
      body.timing ? `When: ${body.timing}` : "",
      "",
      body.notes ? `Notes:\n${body.notes}` : ""
    ]
      .filter(Boolean)
      .join("\n");
    MailApp.sendEmail(notifyEmail, subject, message);
  }

  return { ok: true };
}

function handleRsvp_(body) {
  const tripId = requiredString_(body.tripId, "tripId");
  const name = requiredString_(body.name, "name");
  const contact = requiredString_(body.contact, "contact");

  const spreadsheet = SpreadsheetApp.openById(requiredProp_(CONFIG_KEYS.spreadsheetId));
  const sheet = ensureSheet_(spreadsheet, "RSVPs", [
    "submittedAt",
    "tripId",
    "name",
    "contact",
    "carpool",
    "gearNeeded",
    "notes"
  ]);

  sheet.appendRow([
    new Date(),
    tripId,
    name,
    contact,
    optionalString_(body.carpool),
    normalizeGearList_(body.gearNeeded).join(","),
    optionalString_(body.notes)
  ]);

  return { ok: true };
}

function handleListTrips_(_body) {
  const spreadsheet = SpreadsheetApp.openById(requiredProp_(CONFIG_KEYS.spreadsheetId));
  const sheet = spreadsheet.getSheetByName("Trips");
  if (!sheet) return { ok: true, trips: [] };

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { ok: true, trips: [] };

  const header = values[0].map(String);
  const idx = {};
  header.forEach((name, i) => (idx[name] = i));

  const now = new Date();
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const trips = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const tripId = String(row[idx.tripId] || "").trim();
    if (!tripId) continue;

    const title = String(row[idx.title] || "").trim();
    const startRaw = row[idx.start];
    const start = startRaw ? new Date(startRaw) : null;
    if (!start || Number.isNaN(start.getTime())) continue;
    if (start.getTime() < windowStart.getTime()) continue;

    const location = idx.location !== undefined ? String(row[idx.location] || "").trim() : "";
    const difficulty = idx.difficulty !== undefined ? String(row[idx.difficulty] || "").trim() : "";
    const gearAvailableRaw = idx.gearAvailable !== undefined ? String(row[idx.gearAvailable] || "") : "";

    trips.push({
      tripId,
      title,
      start: start.toISOString(),
      location,
      difficulty,
      gearAvailable: normalizeGearList_(gearAvailableRaw)
    });
  }

  trips.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return { ok: true, trips };
}

function handleCreateTrip_(body) {
  const idToken = requiredString_(body.idToken, "idToken");
  const tokenInfo = verifyGoogleIdToken_(idToken);

  const allowlist = parseAllowlist_(requiredProp_(CONFIG_KEYS.officerAllowlist));
  if (!tokenInfo.email || !allowlist.has(tokenInfo.email.toLowerCase())) {
    return { ok: false, error: "Not authorized (officer allowlist)." };
  }

  const calendarId = requiredProp_(CONFIG_KEYS.calendarId);
  const siteBaseUrl = requiredProp_(CONFIG_KEYS.siteBaseUrl).replace(/\/+$/, "");

  const title = requiredString_(body.title, "title");
  const activity = optionalString_(body.activity);
  const location = optionalString_(body.location);
  const leaderName = optionalString_(body.leaderName);
  const leaderContact = optionalString_(body.leaderContact);
  const difficulty = optionalString_(body.difficulty);
  const meetTime = optionalString_(body.meetTime);
  const meetPlace = optionalString_(body.meetPlace);
  const notes = optionalString_(body.notes);
  const gearAvailable = normalizeGearList_(body.gearAvailable);

  const start = parseDateTime_(requiredString_(body.start, "start"));
  const end = parseDateTime_(requiredString_(body.end, "end"));
  if (end.getTime() <= start.getTime()) throw new Error("end must be after start");

  const tripId = generateTripId_(start, title);
  const rsvpUrl = `${siteBaseUrl}/rsvp.html?tripId=${encodeURIComponent(tripId)}`;

  const description = buildEventDescription_({
    tripId,
    activity,
    meetTime,
    meetPlace,
    leaderName,
    leaderContact,
    difficulty,
    gearAvailable,
    rsvpUrl,
    notes
  });

  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) throw new Error("Calendar not found. Check UTCH_CALENDAR_ID.");

  const event = calendar.createEvent(title, start, end, {
    location: location || "",
    description
  });

  const spreadsheet = SpreadsheetApp.openById(requiredProp_(CONFIG_KEYS.spreadsheetId));
  const tripsSheet = ensureSheet_(spreadsheet, "Trips", [
    "createdAt",
    "tripId",
    "eventId",
    "title",
    "start",
    "end",
    "location",
    "leaderName",
    "difficulty",
    "gearAvailable"
  ]);
  tripsSheet.appendRow([
    new Date(),
    tripId,
    event.getId(),
    title,
    start.toISOString(),
    end.toISOString(),
    location || "",
    leaderName,
    difficulty,
    gearAvailable.join(",")
  ]);

  return {
    ok: true,
    tripId,
    eventId: event.getId(),
    rsvpUrl
  };
}

function buildEventDescription_(data) {
  const lines = [];
  lines.push("UTCH Trip");
  lines.push("");
  lines.push(`Trip ID: ${data.tripId}`);
  if (data.activity) lines.push(`Activity: ${data.activity}`);
  if (data.difficulty) lines.push(`Difficulty: ${data.difficulty}`);
  if (data.gearAvailable && data.gearAvailable.length) {
    lines.push(`Club gear available: ${data.gearAvailable.join(", ")}`);
  }
  lines.push("");
  if (data.meetTime) lines.push(`Meet time: ${data.meetTime}`);
  if (data.meetPlace) lines.push(`Meet place: ${data.meetPlace}`);
  if (data.leaderName) lines.push(`Leader: ${data.leaderName}`);
  if (data.leaderContact) lines.push(`Leader contact: ${data.leaderContact}`);
  lines.push("");
  lines.push(`RSVP: ${data.rsvpUrl}`);
  if (data.notes) {
    lines.push("");
    lines.push("Notes:");
    lines.push(data.notes);
  }
  return lines.join("\n");
}

function normalizeGearList_(value) {
  const allowed = new Set(["tent", "sleeping bag", "sleeping pad", "stove", "headlamp"]);
  const out = [];

  if (Array.isArray(value)) {
    for (const item of value) {
      const s = String(item || "").trim().toLowerCase();
      if (allowed.has(s)) out.push(s);
    }
  } else if (typeof value === "string") {
    for (const raw of value.split(",")) {
      const s = String(raw || "").trim().toLowerCase();
      if (allowed.has(s)) out.push(s);
    }
  } else if (value) {
    const s = String(value).trim().toLowerCase();
    if (allowed.has(s)) out.push(s);
  }

  return Array.from(new Set(out));
}

function verifyGoogleIdToken_(idToken) {
  const clientId = requiredProp_(CONFIG_KEYS.googleClientId);
  const url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken);
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const text = res.getContentText();
  if (res.getResponseCode() !== 200) {
    throw new Error("Invalid Google sign-in token.");
  }
  const info = JSON.parse(text);
  if (info.aud !== clientId) throw new Error("Google token audience mismatch.");
  if (info.email && info.email_verified !== "true") throw new Error("Google email not verified.");
  return info;
}

function parseAllowlist_(value) {
  const set = new Set();
  for (const raw of String(value).split(",")) {
    const email = raw.trim().toLowerCase();
    if (email) set.add(email);
  }
  return set;
}

function generateTripId_(startDate, title) {
  const tz = Session.getScriptTimeZone() || "America/New_York";
  const datePart = Utilities.formatDate(startDate, tz, "yyyy-MM-dd");
  const slug = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "trip";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${datePart}-${slug}-${suffix}`;
}

function parseDateTime_(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid datetime: " + value);
  return d;
}

function parseJsonBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  const raw = String(e.postData.contents || "");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

function json_(obj, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  // Note: Apps Script web apps do not allow setting arbitrary headers from ContentService.
  // In practice, this endpoint is commonly callable from browsers. If you hit CORS issues,
  // we can switch the site forms to submit via a redirect flow.
  return output;
}

function ensureSheet_(spreadsheet, name, header) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  const firstRow = sheet.getRange(1, 1, 1, header.length).getValues()[0];
  const matches = header.every((h, idx) => String(firstRow[idx] || "") === h);
  if (!matches) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function requiredString_(value, name) {
  const s = String(value || "").trim();
  if (!s) throw new Error(`${name} is required`);
  return s;
}

function optionalString_(value) {
  const s = String(value || "").trim();
  return s || "";
}

function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function requiredProp_(key) {
  const v = getProp_(key);
  if (!v || !String(v).trim()) throw new Error(`Missing script property: ${key}`);
  return String(v).trim();
}
