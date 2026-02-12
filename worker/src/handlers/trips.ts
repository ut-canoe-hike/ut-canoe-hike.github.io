import type { Env, Trip, TripInput, TripSignupStatus } from '../types';
import { getAccessToken } from '../auth';
import { getRows, appendRow, findRowByColumn, updateCell, deleteRow, getColumnIndex } from '../sheets';
import {
  createEvent,
  deleteEvent,
  updateEvent,
  listEvents,
  buildEventDescription,
  formatDateTime,
  TIMEZONE,
  type CalendarEvent,
} from '../calendar';
import {
  success,
  error,
  requiredString,
  optionalString,
  normalizeGearList,
  generateTripId,
  parseDateOnly,
  parseDateAndTime,
  addDays,
  addDaysToDateString,
  getDateTimePartsInTimeZone,
} from '../utils';

const TRIPS_HEADERS = [
  'createdAt',
  'tripId',
  'eventId',
  'title',
  'activity',
  'start',
  'end',
  'location',
  'leaderName',
  'leaderContact',
  'difficulty',
  'meetTime',
  'meetPlace',
  'notes',
  'gearAvailable',
  'isAllDay',
  'signupStatus',
];

const SYNC_PAST_DAYS = 30;
const SYNC_FUTURE_DAYS = 365;

function getTripJoinUrl(siteBaseUrl: string, tripId: string): string {
  return `${siteBaseUrl}/trips.html?tripId=${encodeURIComponent(tripId)}`;
}

function normalizeSignupStatus(value: unknown): TripSignupStatus {
  const status = String(value ?? '').trim().toUpperCase();
  if (status === 'REQUEST_OPEN') return 'REQUEST_OPEN';
  if (status === 'MEETING_ONLY') return 'MEETING_ONLY';
  if (status === 'FULL') return 'FULL';
  throw new Error(`Invalid signupStatus: ${status || '(missing)'}`);
}

// Public: list upcoming trips
export async function listTrips(env: Env): Promise<Response> {
  try {
    const token = await getAccessToken(env);
    const rows = await getRows(token, env.SHEET_ID, 'Trips');

    const now = Date.now();
    const windowStart = now - 7 * 24 * 60 * 60 * 1000; // 7 days ago

    const trips: Trip[] = [];

    for (const row of rows) {
      const tripId = row.tripId?.trim();
      if (!tripId) continue;

      const start = row.start ? new Date(row.start) : null;
      if (!start || isNaN(start.getTime())) continue;
      if (start.getTime() < windowStart) continue;

      trips.push({
        tripId,
        title: row.title?.trim() ?? '',
        start: start.toISOString(),
        location: row.location?.trim() ?? '',
        difficulty: row.difficulty?.trim() ?? '',
        gearAvailable: normalizeGearList(row.gearAvailable),
        isAllDay: row.isAllDay === '1' || row.isAllDay?.toLowerCase() === 'true',
        signupStatus: normalizeSignupStatus(row.signupStatus),
      });
    }

    trips.sort((a, b) => a.start.localeCompare(b.start));

    return success({ trips });
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Failed to list trips', 500);
  }
}

// Officer: list all trips (for admin)
export async function listTripsAdmin(env: Env, body: { officerSecret: string }): Promise<Response> {
  try {
    if (body.officerSecret !== env.OFFICER_PASSCODE) {
      return error('Not authorized', 403);
    }

    const token = await getAccessToken(env);
    const rows = await getRows(token, env.SHEET_ID, 'Trips');

    const trips: Trip[] = rows
      .filter(row => row.tripId?.trim())
      .map(row => ({
        tripId: row.tripId.trim(),
        eventId: row.eventId?.trim(),
        title: row.title?.trim() ?? '',
        activity: row.activity?.trim() ?? '',
        start: row.start ?? '',
        end: row.end ?? '',
        location: row.location?.trim() ?? '',
        leaderName: row.leaderName?.trim() ?? '',
        leaderContact: row.leaderContact?.trim() ?? '',
        difficulty: row.difficulty?.trim() ?? '',
        meetTime: row.meetTime?.trim() ?? '',
        meetPlace: row.meetPlace?.trim() ?? '',
        notes: row.notes?.trim() ?? '',
        gearAvailable: normalizeGearList(row.gearAvailable),
        isAllDay: row.isAllDay === '1' || row.isAllDay?.toLowerCase() === 'true',
        signupStatus: normalizeSignupStatus(row.signupStatus),
      }));

    trips.sort((a, b) => a.start.localeCompare(b.start));

    return success({ trips });
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Failed to list trips', 500);
  }
}

// Officer: create a trip
export async function createTrip(env: Env, body: TripInput, siteBaseUrl: string): Promise<Response> {
  try {
    if (body.officerSecret !== env.OFFICER_PASSCODE) {
      return error('Not authorized', 403);
    }

    const title = requiredString(body.title, 'title');
    const activity = optionalString(body.activity);
    const location = optionalString(body.location);
    const leaderName = optionalString(body.leaderName);
    const leaderContact = optionalString(body.leaderContact);
    const difficulty = optionalString(body.difficulty);
    const meetTime = optionalString(body.meetTime);
    const meetPlace = optionalString(body.meetPlace);
    const notes = optionalString(body.notes);
    const gearAvailable = normalizeGearList(body.gearAvailable);
    const signupStatus = normalizeSignupStatus(body.signupStatus);

    const startDate = requiredString(body.startDate, 'startDate');
    const endDate = optionalString(body.endDate) || startDate;
    const startTime = optionalString(body.startTime);
    const endTime = optionalString(body.endTime);

    let start: Date;
    let end: Date;
    let isAllDay = false;

    if (!startTime) {
      isAllDay = true;
      start = parseDateOnly(startDate, TIMEZONE);
      end = parseDateOnly(endDate, TIMEZONE);
      if (end < start) throw new Error('endDate must be on/after startDate');
      end = addDays(end, 1); // Calendar all-day events use exclusive end
    } else {
      start = parseDateAndTime(startDate, startTime, TIMEZONE);
      if (endTime) {
        end = parseDateAndTime(endDate, endTime, TIMEZONE);
      } else {
        end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours
      }
      if (end <= start) throw new Error('end must be after start');
    }

    const tripId = generateTripId(start, title);
    const requestUrl = getTripJoinUrl(siteBaseUrl, tripId);

    const description = buildEventDescription({
      tripId,
      activity,
      meetTime,
      meetPlace,
      leaderName,
      leaderContact,
      difficulty,
      gearAvailable,
      requestUrl,
      notes,
    });

    const token = await getAccessToken(env);

    // Create calendar event
    // For timed events, use the user's input with Eastern timezone
    // For all-day events, just use the date portion
    const endParts = endTime
      ? { date: endDate, time: endTime }
      : getDateTimePartsInTimeZone(end, TIMEZONE);
    const calendarEvent: CalendarEvent = {
      summary: title,
      description,
      location: location || undefined,
      start: isAllDay
        ? { date: startDate }
        : { dateTime: formatDateTime(startDate, startTime), timeZone: TIMEZONE },
      end: isAllDay
        ? { date: addDaysToDateString(endDate, 1) }
        : { dateTime: formatDateTime(endParts.date, endParts.time), timeZone: TIMEZONE },
    };

    const eventId = await createEvent(token, env.CALENDAR_ID, calendarEvent);

    // Add row to sheet
    await appendRow(token, env.SHEET_ID, 'Trips', TRIPS_HEADERS, {
      createdAt: new Date(),
      tripId,
      eventId,
      title,
      activity,
      start: start.toISOString(),
      end: end.toISOString(),
      location: location || '',
      leaderName,
      leaderContact,
      difficulty,
      meetTime,
      meetPlace,
      notes,
      gearAvailable: gearAvailable.join(','),
      isAllDay: isAllDay ? '1' : '0',
      signupStatus,
    });

    return success({ tripId, eventId, requestUrl });
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Failed to create trip', 500);
  }
}

// Officer: update a trip
export async function updateTrip(
  env: Env,
  tripId: string,
  body: TripInput,
  siteBaseUrl: string
): Promise<Response> {
  try {
    if (body.officerSecret !== env.OFFICER_PASSCODE) {
      return error('Not authorized', 403);
    }

    const token = await getAccessToken(env);
    const found = await findRowByColumn(token, env.SHEET_ID, 'Trips', 'tripId', tripId);
    if (!found) {
      return error('Trip not found', 404);
    }

    const title = requiredString(body.title, 'title');
    const activity = optionalString(body.activity);
    const location = optionalString(body.location);
    const leaderName = optionalString(body.leaderName);
    const leaderContact = optionalString(body.leaderContact);
    const difficulty = optionalString(body.difficulty);
    const meetTime = optionalString(body.meetTime);
    const meetPlace = optionalString(body.meetPlace);
    const notes = optionalString(body.notes);
    const gearAvailable = normalizeGearList(body.gearAvailable);
    const signupStatus = normalizeSignupStatus(body.signupStatus);

    const startDate = requiredString(body.startDate, 'startDate');
    const endDate = optionalString(body.endDate) || startDate;
    const startTime = optionalString(body.startTime);
    const endTime = optionalString(body.endTime);

    let start: Date;
    let end: Date;
    let isAllDay = false;

    if (!startTime) {
      isAllDay = true;
      start = parseDateOnly(startDate, TIMEZONE);
      end = parseDateOnly(endDate, TIMEZONE);
      if (end < start) throw new Error('endDate must be on/after startDate');
      end = addDays(end, 1);
    } else {
      start = parseDateAndTime(startDate, startTime, TIMEZONE);
      if (endTime) {
        end = parseDateAndTime(endDate, endTime, TIMEZONE);
      } else {
        end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      }
      if (end <= start) throw new Error('end must be after start');
    }

    const requestUrl = getTripJoinUrl(siteBaseUrl, tripId);

    const description = buildEventDescription({
      tripId,
      activity,
      meetTime,
      meetPlace,
      leaderName,
      leaderContact,
      difficulty,
      gearAvailable,
      requestUrl,
      notes,
    });

    // Delete old calendar event if it exists
    const oldEventId = found.row.eventId;
    if (oldEventId) {
      await deleteEvent(token, env.CALENDAR_ID, oldEventId);
    }

    // Create new calendar event
    // For timed events, use the user's input with Eastern timezone
    const endParts = endTime
      ? { date: endDate, time: endTime }
      : getDateTimePartsInTimeZone(end, TIMEZONE);
    const calendarEvent: CalendarEvent = {
      summary: title,
      description,
      location: location || undefined,
      start: isAllDay
        ? { date: startDate }
        : { dateTime: formatDateTime(startDate, startTime), timeZone: TIMEZONE },
      end: isAllDay
        ? { date: addDaysToDateString(endDate, 1) }
        : { dateTime: formatDateTime(endParts.date, endParts.time), timeZone: TIMEZONE },
    };

    const newEventId = await createEvent(token, env.CALENDAR_ID, calendarEvent);

    // Update sheet row
    const rowIndex = found.rowIndex;
    const updates: Record<string, string> = {
      title,
      activity,
      start: start.toISOString(),
      end: end.toISOString(),
      location: location || '',
      leaderName,
      leaderContact,
      difficulty,
      meetTime,
      meetPlace,
      notes,
      gearAvailable: gearAvailable.join(','),
      isAllDay: isAllDay ? '1' : '0',
      signupStatus,
      eventId: newEventId,
    };

    for (const [col, val] of Object.entries(updates)) {
      const colIndex = await getColumnIndex(token, env.SHEET_ID, 'Trips', col);
      if (colIndex > 0) {
        await updateCell(token, env.SHEET_ID, 'Trips', rowIndex, colIndex, val);
      }
    }

    return success({ tripId, eventId: newEventId, requestUrl });
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Failed to update trip', 500);
  }
}

// Officer: delete a trip
export async function deleteTrip(
  env: Env,
  tripId: string,
  body: { officerSecret: string }
): Promise<Response> {
  try {
    if (body.officerSecret !== env.OFFICER_PASSCODE) {
      return error('Not authorized', 403);
    }

    const token = await getAccessToken(env);
    const found = await findRowByColumn(token, env.SHEET_ID, 'Trips', 'tripId', tripId);
    if (!found) {
      return error('Trip not found', 404);
    }

    // Delete calendar event
    const eventId = found.row.eventId;
    if (eventId) {
      await deleteEvent(token, env.CALENDAR_ID, eventId);
    }

    // Delete sheet row
    await deleteRow(token, env.SHEET_ID, 'Trips', found.rowIndex);

    return success({ tripId });
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Failed to delete trip', 500);
  }
}

export async function syncTripsWithCalendar(env: Env, siteBaseUrl: string): Promise<void> {
  const token = await getAccessToken(env);
  const rows = await getRows(token, env.SHEET_ID, 'Trips');

  const trips: Array<{ rowIndex: number; row: Record<string, string> }> = rows.map((row, index) => ({
    rowIndex: index + 2,
    row,
  }));

  const tripIds = new Set(trips.map(t => t.row.tripId).filter(Boolean));

  const now = new Date();
  const timeMin = new Date(now.getTime() - SYNC_PAST_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + SYNC_FUTURE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const calendarEvents = await listEvents(token, env.CALENDAR_ID, timeMin, timeMax);
  const eventsByTripId = new Map<string, string[]>();

  for (const event of calendarEvents) {
    const tripId = extractTripId(event.description);
    if (!tripId) continue;
    if (!eventsByTripId.has(tripId)) {
      eventsByTripId.set(tripId, []);
    }
    if (event.id) {
      eventsByTripId.get(tripId)?.push(event.id);
    }
  }

  // Delete calendar events that no longer exist in the sheet
  for (const [tripId, eventIds] of eventsByTripId.entries()) {
    if (!tripIds.has(tripId)) {
      for (const eventId of eventIds) {
        await deleteEvent(token, env.CALENDAR_ID, eventId);
      }
      continue;
    }
    if (eventIds.length > 1) {
      for (const dupId of eventIds.slice(1)) {
        await deleteEvent(token, env.CALENDAR_ID, dupId);
      }
    }
  }

  // Ensure each sheet row has a matching calendar event
  for (const trip of trips) {
    const row = trip.row;
    const tripId = row.tripId?.trim();
    if (!tripId) continue;

    const startIso = row.start?.trim();
    if (!startIso) continue;

    const startDate = new Date(startIso);
    if (Number.isNaN(startDate.getTime())) continue;

    const isAllDay = row.isAllDay === '1' || row.isAllDay?.toLowerCase() === 'true';
    const startParts = getDateTimePartsInTimeZone(startDate, TIMEZONE);

    let endParts = startParts;
    if (row.end) {
      const endDate = new Date(row.end);
      if (!Number.isNaN(endDate.getTime())) {
        endParts = getDateTimePartsInTimeZone(endDate, TIMEZONE);
      }
    }

    const inclusiveEndDate = isAllDay
      ? addDaysToDateString(endParts.date, -1)
      : endParts.date;

    const requestUrl = getTripJoinUrl(siteBaseUrl, tripId);
    const description = buildEventDescription({
      tripId,
      activity: row.activity,
      meetTime: row.meetTime,
      meetPlace: row.meetPlace,
      leaderName: row.leaderName,
      leaderContact: row.leaderContact,
      difficulty: row.difficulty,
      gearAvailable: normalizeGearList(row.gearAvailable),
      requestUrl,
      notes: row.notes,
    });

    const calendarEvent: CalendarEvent = {
      summary: requiredString(row.title, `title for trip ${tripId}`),
      description,
      location: row.location || undefined,
      start: isAllDay
        ? { date: startParts.date }
        : { dateTime: formatDateTime(startParts.date, startParts.time), timeZone: TIMEZONE },
      end: isAllDay
        ? { date: addDaysToDateString(inclusiveEndDate, 1) }
        : { dateTime: formatDateTime(endParts.date, endParts.time), timeZone: TIMEZONE },
    };

    let eventId = row.eventId?.trim() || '';
    let updated = false;

    if (eventId) {
      updated = await updateEvent(token, env.CALENDAR_ID, eventId, calendarEvent);
    }

    if (!eventId || !updated) {
      eventId = await createEvent(token, env.CALENDAR_ID, calendarEvent);
      const colIndex = await getColumnIndex(token, env.SHEET_ID, 'Trips', 'eventId');
      if (colIndex > 0) {
        await updateCell(token, env.SHEET_ID, 'Trips', trip.rowIndex, colIndex, eventId);
      }
    }
  }
}

export async function syncTripsRequest(
  env: Env,
  body: { officerSecret?: string },
  siteBaseUrl: string
): Promise<Response> {
  try {
    if (body.officerSecret !== env.OFFICER_PASSCODE) {
      return error('Not authorized', 403);
    }
    await syncTripsWithCalendar(env, siteBaseUrl);
    return success({});
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Failed to sync trips', 500);
  }
}

function extractTripId(description?: string): string | null {
  if (!description) return null;
  const match = description.match(/Trip ID:\s*([^\n]+)/i);
  return match ? match[1].trim() : null;
}
