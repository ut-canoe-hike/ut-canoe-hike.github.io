import type { ApiResponse } from './types';

export function jsonResponse<T>(data: ApiResponse<T>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function success<T>(data: T): Response {
  return jsonResponse({ ok: true, data });
}

export function error(message: string, status = 400): Response {
  return jsonResponse({ ok: false, error: message }, status);
}

export function requiredString(value: unknown, name: string): string {
  const s = String(value ?? '').trim();
  if (!s) throw new Error(`${name} is required`);
  return s;
}

export function optionalString(value: unknown): string {
  return String(value ?? '').trim();
}

export function normalizeGearList(value: unknown): string[] {
  const allowed = new Set(['tent', 'sleeping bag', 'sleeping pad', 'stove', 'headlamp']);
  const result: string[] = [];

  const items = Array.isArray(value) ? value : String(value ?? '').split(',');
  for (const item of items) {
    const normalized = String(item).trim().toLowerCase();
    if (allowed.has(normalized) && !result.includes(normalized)) {
      result.push(normalized);
    }
  }
  return result;
}

function getTimeZoneOffset(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }

  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return (asUtc - date.getTime()) / 60000;
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  let offset = getTimeZoneOffset(utcGuess, timeZone);
  let adjusted = new Date(utcGuess.getTime() - offset * 60000);
  const offset2 = getTimeZoneOffset(adjusted, timeZone);
  if (offset2 !== offset) {
    adjusted = new Date(utcGuess.getTime() - offset2 * 60000);
  }
  return adjusted;
}

export function generateTripId(startDate: Date, title: string): string {
  const datePart = startDate.toISOString().slice(0, 10);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'trip';
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${datePart}-${slug}-${suffix}`;
}

export function parseDateOnly(value: string, timeZone = 'America/New_York'): Date {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Invalid date: ${value}`);
  return zonedTimeToUtc(+match[1], +match[2], +match[3], 0, 0, timeZone);
}

export function parseDateAndTime(
  dateValue: string,
  timeValue: string,
  timeZone = 'America/New_York'
): Date {
  const dm = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = timeValue.match(/^(\d{2}):(\d{2})$/);
  if (!dm) throw new Error(`Invalid date: ${dateValue}`);
  if (!tm) throw new Error(`Invalid time: ${timeValue}`);
  return zonedTimeToUtc(+dm[1], +dm[2], +dm[3], +tm[1], +tm[2], timeZone);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function addDaysToDateString(dateValue: string, days: number): string {
  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Invalid date: ${dateValue}`);
  const base = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function getDateTimePartsInTimeZone(date: Date, timeZone: string): { date: string; time: string } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}
