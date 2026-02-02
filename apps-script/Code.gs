var CONFIG_KEYS = {
  spreadsheetId: "UTCH_SPREADSHEET_ID",
  calendarId: "UTCH_CALENDAR_ID",
  siteBaseUrl: "UTCH_SITE_BASE_URL",
  googleClientId: "UTCH_GOOGLE_CLIENT_ID",
  officerAllowlist: "UTCH_OFFICER_ALLOWLIST",
  notifyEmail: "UTCH_NOTIFY_EMAIL"
};

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) ? String(e.parameter.page) : "";
  var action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : "";

  if (action === "listTrips") {
    return handleListTripsGet_(e);
  }
  if (page === "officer") {
    var siteBaseUrl = String(getProp_(CONFIG_KEYS.siteBaseUrl) || "").replace(/\/+$/, "");
    var html = []
      .concat("<!doctype html><meta charset='utf-8'/>")
      .concat("<meta name='viewport' content='width=device-width, initial-scale=1'/>")
      .concat("<title>UTCH Officer</title>")
      .concat("<p>This officer page is hosted on the UTCH website.</p>")
      .concat("<p><a href='" + siteBaseUrl + "/officer.html'>Open Officer Create Trip</a></p>")
      .join("");
    return HtmlService.createHtmlOutput(html);
  }

  return ContentService.createTextOutput(
    "UTCH Apps Script is deployed. Use ?page=officer for the officer trip-creation page, or POST with ?action=suggest|rsvp|listTrips|createTrip."
  );
}

function doPost(e) {
  var action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : "";
  try {
    var body = parseBody_(e);
    // Used by redirectResult_ to send users back to the originating page.
    this._utchReturnTo = body && body.returnTo ? String(body.returnTo) : "";
    var result;

    if (action === "suggest") result = handleSuggest_(body);
    else if (action === "rsvp") result = handleRsvp_(body);
    else if (action === "listTrips") result = handleListTrips_(body);
    else if (action === "createTrip") result = handleCreateTrip_(body);
    else return json_({ ok: false, error: "Unknown action. Use ?action=suggest|rsvp|listTrips|createTrip." }, 400);

    // If request is JSON, respond JSON. Otherwise (form POST), redirect back to the site.
    if (isJsonRequest_(e)) return json_(result);
    return htmlPostMessageResult_(action, result, this._utchReturnTo);
  } catch (err) {
    if (isJsonRequest_(e)) {
      return json_({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
    }
    var rt = "";
    try { rt = (e && e.parameter && e.parameter.returnTo) ? String(e.parameter.returnTo) : ""; } catch (_) {}
    return htmlPostMessageResult_(action, { ok: false, error: String(err && err.message ? err.message : err) }, rt);
  }
}

function handleSuggest_(body) {
  var name = requiredString_(body.name, "name");
  var idea = requiredString_(body.idea, "idea");

  var spreadsheet = SpreadsheetApp.openById(requiredProp_(CONFIG_KEYS.spreadsheetId));
  var info = ensureSheetColumns_(spreadsheet, "Suggestions", [
    "submittedAt",
    "name",
    "email",
    "willingToLead",
    "idea",
    "location",
    "timing",
    "notes"
  ]);
  var sheet = info.sheet;

  appendRowByColumns_(sheet, info.colByName, {
    "submittedAt": new Date(),
    "name": name,
    "email": optionalString_(body.email),
    "willingToLead": optionalString_(body.willingToLead),
    "idea": idea,
    "location": optionalString_(body.location),
    "timing": optionalString_(body.timing),
    "notes": optionalString_(body.notes)
  });

  var notifyEmail = String(getProp_(CONFIG_KEYS.notifyEmail) || "").trim();
  if (notifyEmail) {
    var subject = ("UTCH Trip Suggestion: " + idea).slice(0, 140);
    var parts = [];
    parts.push("Name: " + name);
    if (body.email) parts.push("Email: " + body.email);
    parts.push("Willing to lead: " + (optionalString_(body.willingToLead) || "n/a"));
    parts.push("");
    parts.push("Idea: " + idea);
    if (body.location) parts.push("Location: " + body.location);
    if (body.timing) parts.push("When: " + body.timing);
    if (body.notes) {
      parts.push("");
      parts.push("Notes:\n" + body.notes);
    }
    MailApp.sendEmail(notifyEmail, subject, parts.join("\n"));
  }

  return { ok: true };
}

function handleRsvp_(body) {
  var tripId = requiredString_(body.tripId, "tripId");
  var name = requiredString_(body.name, "name");
  var contact = requiredString_(body.contact, "contact");

  var spreadsheet = SpreadsheetApp.openById(requiredProp_(CONFIG_KEYS.spreadsheetId));
  var info = ensureSheetColumns_(spreadsheet, "RSVPs", [
    "submittedAt",
    "tripId",
    "name",
    "contact",
    "carpool",
    "gearNeeded",
    "notes"
  ]);
  var sheet = info.sheet;

  appendRowByColumns_(sheet, info.colByName, {
    "submittedAt": new Date(),
    "tripId": tripId,
    "name": name,
    "contact": contact,
    "carpool": optionalString_(body.carpool),
    "gearNeeded": normalizeGearList_(body.gearNeeded).join(","),
    "notes": optionalString_(body.notes)
  });

  return { ok: true };
}

function handleListTripsGet_(e) {
  // JSONP-style GET for cross-origin usage from GitHub Pages.
  var callback = (e && e.parameter && e.parameter.callback) ? String(e.parameter.callback) : "";
  var data = handleListTrips_({});

  if (!callback) {
    // Plain JSON.
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  }

  // Very simple callback name validation.
  if (!/^[a-zA-Z0-9_$]+$/.test(callback)) {
    return ContentService.createTextOutput("/* invalid callback */").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(callback + "(" + JSON.stringify(data) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function handleListTrips_(_body) {
  var spreadsheet = SpreadsheetApp.openById(requiredProp_(CONFIG_KEYS.spreadsheetId));
  var info = ensureSheetColumns_(spreadsheet, "Trips", [
    "createdAt",
    "tripId",
    "eventId",
    "title",
    "start",
    "end",
    "location",
    "leaderName",
    "difficulty",
    "gearAvailable",
    "isAllDay"
  ]);
  var sheet = info.sheet;
  if (!sheet) return { ok: true, trips: [] };

  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, trips: [] };
  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  if (values.length < 2) return { ok: true, trips: [] };

  var header = [];
  for (var hi = 0; hi < values[0].length; hi++) header.push(String(values[0][hi]));
  var idx = {};
  for (var i = 0; i < header.length; i++) idx[header[i]] = i;

  var now = new Date();
  var windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  var trips = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var tripId = String(row[idx.tripId] || "").trim();
    if (!tripId) continue;

    var title = String(row[idx.title] || "").trim();
    var startRaw = row[idx.start];
    var start = startRaw ? new Date(startRaw) : null;
    if (!start || isNaN(start.getTime())) continue;
    if (start.getTime() < windowStart.getTime()) continue;

    var location = idx.location !== undefined ? String(row[idx.location] || "").trim() : "";
    var difficulty = idx.difficulty !== undefined ? String(row[idx.difficulty] || "").trim() : "";
    var gearAvailableRaw = idx.gearAvailable !== undefined ? String(row[idx.gearAvailable] || "") : "";
    var isAllDay = idx.isAllDay !== undefined ? String(row[idx.isAllDay] || "").trim() : "0";

    trips.push({
      tripId: tripId,
      title: title,
      start: start.toISOString(),
      location: location,
      difficulty: difficulty,
      gearAvailable: normalizeGearList_(gearAvailableRaw),
      isAllDay: isAllDay === "1" || isAllDay.toLowerCase() === "true"
    });
  }

  trips.sort(function (a, b) {
    return a.start < b.start ? -1 : a.start > b.start ? 1 : 0;
  });

  return { ok: true, trips: trips };
}

function handleCreateTrip_(body) {
  var idToken = requiredString_(body.idToken, "idToken");
  var tokenInfo = verifyGoogleIdToken_(idToken);

  var allowlist = parseAllowlist_(requiredProp_(CONFIG_KEYS.officerAllowlist));
  if (!tokenInfo.email || !allowlist[String(tokenInfo.email).toLowerCase()]) {
    return { ok: false, error: "Not authorized (officer allowlist)." };
  }

  var calendarId = requiredProp_(CONFIG_KEYS.calendarId);
  var siteBaseUrl = requiredProp_(CONFIG_KEYS.siteBaseUrl).replace(/\/+$/, "");

  var title = requiredString_(body.title, "title");
  var activity = optionalString_(body.activity);
  var location = optionalString_(body.location);
  var leaderName = optionalString_(body.leaderName);
  var leaderContact = optionalString_(body.leaderContact);
  var difficulty = optionalString_(body.difficulty);
  var meetTime = optionalString_(body.meetTime);
  var meetPlace = optionalString_(body.meetPlace);
  var notes = optionalString_(body.notes);
  var gearAvailable = normalizeGearList_(body.gearAvailable);

  var start;
  var end;
  var isAllDay = false;

  if (body.start) {
    // Backwards compatible (old datetime-local payload)
    start = parseDateTime_(requiredString_(body.start, "start"));
    end = parseDateTime_(requiredString_(body.end, "end"));
    if (end.getTime() <= start.getTime()) throw new Error("end must be after start");
  } else {
    var startDate = requiredString_(body.startDate, "startDate");
    var endDate = optionalString_(body.endDate) || startDate;
    var startTime = optionalString_(body.startTime);
    var endTime = optionalString_(body.endTime);

    if (!startTime) {
      // All-day event
      isAllDay = true;
      start = parseDateOnly_(startDate);
      end = parseDateOnly_(endDate);
      if (end.getTime() < start.getTime()) throw new Error("endDate must be on/after startDate");
      // Google Calendar all-day end is exclusive; treat officer end date as inclusive.
      end = addDays_(end, 1);
    } else {
      start = parseDateAndTime_(startDate, startTime);
      if (endTime) {
        end = parseDateAndTime_(endDate, endTime);
      } else {
        // Default to 2 hours if end time omitted.
        end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      }
      if (end.getTime() <= start.getTime()) throw new Error("end must be after start");
    }
  }

  var tripId = generateTripId_(start, title);
  var rsvpUrl = siteBaseUrl + "/rsvp.html?tripId=" + encodeURIComponent(tripId);

  var description = buildEventDescription_({
    tripId: tripId,
    activity: activity,
    meetTime: meetTime,
    meetPlace: meetPlace,
    leaderName: leaderName,
    leaderContact: leaderContact,
    difficulty: difficulty,
    gearAvailable: gearAvailable,
    rsvpUrl: rsvpUrl,
    notes: notes
  });

  var calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) throw new Error("Calendar not found. Check UTCH_CALENDAR_ID.");

  var event;
  if (isAllDay) {
    // If it's a single-day all-day event, use the single-date overload.
    if (end.getTime() === addDays_(start, 1).getTime()) {
      event = calendar.createAllDayEvent(title, start, { location: location || "", description: description });
    } else {
      event = calendar.createAllDayEvent(title, start, end, { location: location || "", description: description });
    }
  } else {
    event = calendar.createEvent(title, start, end, {
      location: location || "",
      description: description
    });
  }

  var spreadsheet = SpreadsheetApp.openById(requiredProp_(CONFIG_KEYS.spreadsheetId));
  var info = ensureSheetColumns_(spreadsheet, "Trips", [
    "createdAt",
    "tripId",
    "eventId",
    "title",
    "start",
    "end",
    "location",
    "leaderName",
    "difficulty",
    "gearAvailable",
    "isAllDay"
  ]);
  var tripsSheet = info.sheet;

  appendRowByColumns_(tripsSheet, info.colByName, {
    "createdAt": new Date(),
    "tripId": tripId,
    "eventId": event.getId(),
    "title": title,
    "start": start.toISOString(),
    "end": end.toISOString(),
    "location": location || "",
    "leaderName": leaderName,
    "difficulty": difficulty,
    "gearAvailable": gearAvailable.join(","),
    "isAllDay": isAllDay ? "1" : "0"
  });

  return {
    ok: true,
    tripId: tripId,
    eventId: event.getId(),
    rsvpUrl: rsvpUrl
  };
}

function buildEventDescription_(data) {
  var lines = [];
  lines.push("UTCH Trip");
  lines.push("");
  lines.push("Trip ID: " + data.tripId);
  if (data.activity) lines.push("Activity: " + data.activity);
  if (data.difficulty) lines.push("Difficulty: " + data.difficulty);
  if (data.gearAvailable && data.gearAvailable.length) {
    lines.push("Club gear available: " + data.gearAvailable.join(", "));
  }
  lines.push("");
  if (data.meetTime) lines.push("Meet time: " + data.meetTime);
  if (data.meetPlace) lines.push("Meet place: " + data.meetPlace);
  if (data.leaderName) lines.push("Leader: " + data.leaderName);
  if (data.leaderContact) lines.push("Leader contact: " + data.leaderContact);
  lines.push("");
  lines.push("RSVP: " + data.rsvpUrl);
  if (data.notes) {
    lines.push("");
    lines.push("Notes:");
    lines.push(data.notes);
  }
  return lines.join("\n");
}

function normalizeGearList_(value) {
  var allowed = {
    "tent": true,
    "sleeping bag": true,
    "sleeping pad": true,
    "stove": true,
    "headlamp": true
  };

  var out = [];

  if (isArray_(value)) {
    for (var i = 0; i < value.length; i++) {
      var s = String(value[i] || "").trim().toLowerCase();
      if (allowed[s]) out.push(s);
    }
  } else if (typeof value === "string") {
    var parts = value.split(",");
    for (var p = 0; p < parts.length; p++) {
      var s2 = String(parts[p] || "").trim().toLowerCase();
      if (allowed[s2]) out.push(s2);
    }
  } else if (value) {
    var s3 = String(value).trim().toLowerCase();
    if (allowed[s3]) out.push(s3);
  }

  var seen = {};
  var uniq = [];
  for (var u = 0; u < out.length; u++) {
    if (!seen[out[u]]) {
      seen[out[u]] = true;
      uniq.push(out[u]);
    }
  }
  return uniq;
}

function isArray_(value) {
  return Object.prototype.toString.call(value) === "[object Array]";
}

function verifyGoogleIdToken_(idToken) {
  var clientId = requiredProp_(CONFIG_KEYS.googleClientId);
  var url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var text = res.getContentText();
  if (res.getResponseCode() !== 200) {
    throw new Error("Invalid Google sign-in token.");
  }
  var info = JSON.parse(text);
  if (info.aud !== clientId) throw new Error("Google token audience mismatch.");
  if (info.email && info.email_verified !== "true") throw new Error("Google email not verified.");
  return info;
}

function parseAllowlist_(value) {
  var out = {};
  var parts = String(value).split(",");
  for (var i = 0; i < parts.length; i++) {
    var email = String(parts[i] || "").trim().toLowerCase();
    if (email) out[email] = true;
  }
  return out;
}

function generateTripId_(startDate, title) {
  var tz = Session.getScriptTimeZone() || "America/New_York";
  var datePart = Utilities.formatDate(startDate, tz, "yyyy-MM-dd");
  var slug = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "trip";
  var suffix = Math.random().toString(36).slice(2, 6);
  return datePart + "-" + slug + "-" + suffix;
}

function parseDateTime_(value) {
  var d = new Date(value);
  if (isNaN(d.getTime())) throw new Error("Invalid datetime: " + value);
  return d;
}

function parseDateOnly_(value) {
  // value: YYYY-MM-DD
  var m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error("Invalid date: " + value);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function parseDateAndTime_(dateValue, timeValue) {
  // dateValue: YYYY-MM-DD, timeValue: HH:MM
  var dm = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  var tm = String(timeValue).match(/^(\d{2}):(\d{2})$/);
  if (!dm) throw new Error("Invalid date: " + dateValue);
  if (!tm) throw new Error("Invalid time: " + timeValue);
  return new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]));
}

function addDays_(dateObj, days) {
  return new Date(dateObj.getTime() + Number(days) * 24 * 60 * 60 * 1000);
}

function parseJsonBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  var raw = String(e.postData.contents || "");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error("Invalid JSON body.");
  }
}

function parseBody_(e) {
  // Prefer JSON body if present.
  var json = {};
  try {
    json = parseJsonBody_(e);
  } catch (err) {
    json = {};
  }

  // For form POSTs, Apps Script populates e.parameter/e.parameters.
  var out = {};
  var k;
  for (k in json) out[k] = json[k];

  if (e && e.parameter) {
    for (k in e.parameter) {
      if (out[k] === undefined) out[k] = e.parameter[k];
    }
  }

  // Preserve multi-values (checkboxes) as arrays.
  if (e && e.parameters) {
    for (k in e.parameters) {
      if (e.parameters[k] && e.parameters[k].length > 1) out[k] = e.parameters[k];
    }
  }

  return out;
}

function isJsonRequest_(e) {
  return !!(e && e.postData && e.postData.type && String(e.postData.type).indexOf("application/json") === 0);
}

function htmlPostMessageResult_(action, result, returnTo) {
  // Backwards name kept to avoid editing all call sites; now does redirect.
  return redirectResult_(action, result, returnTo);
}

function redirectResult_(action, result, returnTo) {
  var siteBaseUrl = String(getProp_(CONFIG_KEYS.siteBaseUrl) || "").replace(/\/+$/, "");
  var base = siteBaseUrl + "/submit-result.html";

  var params = [];
  params.push("action=" + encodeURIComponent(String(action || "")));
  params.push("ok=" + encodeURIComponent(result && result.ok === true ? "1" : "0"));

  if (result) {
    if (result.error) params.push("error=" + encodeURIComponent(String(result.error)));
    if (result.tripId) params.push("tripId=" + encodeURIComponent(String(result.tripId)));
    if (result.rsvpUrl) params.push("rsvpUrl=" + encodeURIComponent(String(result.rsvpUrl)));
  }

  // Allow returning to a relative path on the same site.
  var rt = String(returnTo || "").trim();
  if (!rt && this && this._utchReturnTo) rt = String(this._utchReturnTo || "").trim();
  if (rt && rt.indexOf("://") === -1 && rt.charAt(0) === "/") {
    params.push("returnTo=" + encodeURIComponent(rt));
  }

  var url = base + "?" + params.join("&");

  var html = ""
    + "<!doctype html><meta charset='utf-8'/>"
    + "<meta name='viewport' content='width=device-width, initial-scale=1'/>"
    + "<meta http-equiv='refresh' content='0;url=" + url.replace(/'/g, "%27") + "'/>"
    + "<p>Redirecting…</p>";

  return HtmlService.createHtmlOutput(html);
}

function json_(obj, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function ensureSheet_(spreadsheet, name, header) {
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);

  var firstRow = sheet.getRange(1, 1, 1, header.length).getValues()[0];
  var matches = true;
  for (var i = 0; i < header.length; i++) {
    if (String(firstRow[i] || "") !== header[i]) {
      matches = false;
      break;
    }
  }

  if (!matches) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureSheetColumns_(spreadsheet, name, requiredHeaders) {
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);

  var existingLastCol = Math.max(sheet.getLastColumn(), 1);
  var existing = sheet.getRange(1, 1, 1, existingLastCol).getValues()[0];

  // Build map of existing header names -> column index (1-based).
  var colByName = {};
  var lastNamedCol = 0;
  for (var i = 0; i < existing.length; i++) {
    var nameCell = String(existing[i] || "").trim();
    if (!nameCell) continue;
    colByName[nameCell] = i + 1;
    if (i + 1 > lastNamedCol) lastNamedCol = i + 1;
  }

  // If header row is empty, initialize it.
  var headerEmpty = lastNamedCol === 0;
  if (headerEmpty) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    sheet.setFrozenRows(1);
    colByName = {};
    for (var h = 0; h < requiredHeaders.length; h++) colByName[requiredHeaders[h]] = h + 1;
    return { sheet: sheet, colByName: colByName };
  }

  // Append missing required headers at the end (do NOT rename/reorder existing columns).
  var col = sheet.getLastColumn();
  for (var r = 0; r < requiredHeaders.length; r++) {
    var req = requiredHeaders[r];
    if (!colByName[req]) {
      col += 1;
      sheet.getRange(1, col).setValue(req);
      colByName[req] = col;
    }
  }

  sheet.setFrozenRows(1);
  return { sheet: sheet, colByName: colByName };
}

function appendRowByColumns_(sheet, colByName, valuesByName) {
  var lastCol = sheet.getLastColumn();
  var row = [];
  for (var i = 0; i < lastCol; i++) row.push("");
  for (var key in valuesByName) {
    if (!valuesByName.hasOwnProperty(key)) continue;
    var col = colByName[key];
    if (!col) continue;
    row[col - 1] = valuesByName[key];
  }
  sheet.appendRow(row);
}

function requiredString_(value, name) {
  var s = String(value || "").trim();
  if (!s) throw new Error(name + " is required");
  return s;
}

function optionalString_(value) {
  var s = String(value || "").trim();
  return s || "";
}

function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function requiredProp_(key) {
  var v = getProp_(key);
  if (!v || !String(v).trim()) throw new Error("Missing script property: " + key);
  return String(v).trim();
}
