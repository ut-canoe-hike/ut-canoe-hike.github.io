const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars';

// Knoxville, TN timezone
export const TIMEZONE = 'America/New_York';

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
}

// Format date and time for Google Calendar (local time, no Z suffix)
export function formatDateTime(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00`;
}

export async function createEvent(
  token: string,
  calendarId: string,
  event: CalendarEvent
): Promise<string> {
  const url = `${CALENDAR_API}/${encodeURIComponent(calendarId)}/events`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create calendar event: ${text}`);
  }

  const data = await response.json() as { id: string };
  return data.id;
}

export async function updateEvent(
  token: string,
  calendarId: string,
  eventId: string,
  event: CalendarEvent
): Promise<boolean> {
  const url = `${CALENDAR_API}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const text = await response.text();
    // If event doesn't exist, that's okay - we'll create a new one
    if (response.status === 404) return false;
    throw new Error(`Failed to update calendar event: ${text}`);
  }
  return true;
}

export async function deleteEvent(
  token: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const url = `${CALENDAR_API}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  // 404 or 410 means already deleted - that's fine
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const text = await response.text();
    throw new Error(`Failed to delete calendar event: ${text}`);
  }
}

export async function listEvents(
  token: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const url = `${CALENDAR_API}/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to list calendar events: ${text}`);
    }

    const data = await response.json() as { items?: CalendarEvent[]; nextPageToken?: string };
    events.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return events;
}

export function buildEventDescription(data: {
  tripId: string;
  activity?: string;
  meetTime?: string;
  meetPlace?: string;
  leaderName?: string;
  leaderContact?: string;
  difficulty?: string;
  gearAvailable?: string[];
  rsvpUrl: string;
  notes?: string;
}): string {
  const lines: string[] = ['UTCH Trip', '', `Trip ID: ${data.tripId}`];

  if (data.activity) lines.push(`Activity: ${data.activity}`);
  if (data.difficulty) lines.push(`Difficulty: ${data.difficulty}`);
  if (data.gearAvailable?.length) {
    lines.push(`Club gear available: ${data.gearAvailable.join(', ')}`);
  }

  lines.push('');
  if (data.meetTime) lines.push(`Meet time: ${data.meetTime}`);
  if (data.meetPlace) lines.push(`Meet place: ${data.meetPlace}`);
  if (data.leaderName) lines.push(`Leader: ${data.leaderName}`);
  if (data.leaderContact) lines.push(`Leader contact: ${data.leaderContact}`);

  lines.push('', `RSVP: ${data.rsvpUrl}`);

  if (data.notes) {
    lines.push('', 'Notes:', data.notes);
  }

  return lines.join('\n');
}
