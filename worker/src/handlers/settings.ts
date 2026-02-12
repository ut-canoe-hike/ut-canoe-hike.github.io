import type { Env } from '../types';
import { appendRow, getColumnIndex, getRows, updateCell } from '../sheets';
import { getAccessToken } from '../auth';
import { error, requiredString, success } from '../utils';

const SITE_SETTINGS_SHEET = 'SiteSettings';
const SITE_SETTINGS_HEADERS = ['key', 'value', 'updatedAt'];

const DEFAULT_SITE_SETTINGS = {
  contactEmail: 'utch1968@gmail.com',
  volLinkUrl: 'https://utk.campuslabs.com/engage/organization/canoeandhiking',
  groupMeUrl: 'https://groupme.com/join_group/107532542/IWSaGazV',
  meetingSchedule: 'Every Week - 7:00 PM',
  meetingLocation: 'AMB 27',
  meetingNote:
    'We meet every week at 7pm in AMB27. This is where trips are discussed, gear is handed out and returned, and members connect before adventures. Meeting attendance is considered for limited-capacity trips.',
  requestIntroMessage:
    'Submit your request below. Officers review requests before confirming rosters.',
  meetingOnlyMessage:
    'This trip is meeting sign-up only. Please attend a weekly meeting to request a spot.',
  fullTripMessage:
    'This trip is currently full. We appreciate your interest and hope you can join a future trip.',
  requestReceivedMessage:
    'Request received. Officers will review it; this is not a confirmed spot.',
} as const;

type SiteSettingKey = keyof typeof DEFAULT_SITE_SETTINGS;
type SiteSettingsMap = Record<SiteSettingKey, string>;
interface ParsedSiteSettings {
  settings: SiteSettingsMap;
  warnings: string[];
}

const SITE_SETTING_KEYS = Object.keys(DEFAULT_SITE_SETTINGS) as SiteSettingKey[];
const SITE_SETTING_KEY_SET = new Set<string>(SITE_SETTING_KEYS);

function isMissingSheetError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /Unable to parse range/i.test(message) || /sheet.*not found/i.test(message);
}

function normalizeHttpsUrl(raw: unknown, key: SiteSettingKey): string {
  const value = requiredString(raw, key);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL`);
  }
  if (!['https:'].includes(parsed.protocol)) {
    throw new Error(`${key} must use https://`);
  }
  return parsed.toString();
}

function normalizeEmail(raw: unknown, key: SiteSettingKey): string {
  const value = requiredString(raw, key);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`${key} must be a valid email address`);
  }
  return value;
}

function normalizeMessage(raw: unknown, key: SiteSettingKey): string {
  const value = requiredString(raw, key);
  if (value.length > 800) {
    throw new Error(`${key} is too long (max 800 characters)`);
  }
  return value;
}

function normalizeSettingValue(key: SiteSettingKey, raw: unknown): string {
  if (key === 'contactEmail') {
    return normalizeEmail(raw, key);
  }
  if (key === 'volLinkUrl' || key === 'groupMeUrl') {
    return normalizeHttpsUrl(raw, key);
  }
  return normalizeMessage(raw, key);
}

function parseSiteSettingsRows(rows: Array<Record<string, string>>): ParsedSiteSettings {
  const settings: SiteSettingsMap = { ...DEFAULT_SITE_SETTINGS };
  const seen = new Set<string>();
  const warnings: string[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rawKey = String(row.key ?? '').trim();
    if (!rawKey) return;

    if (!SITE_SETTING_KEY_SET.has(rawKey)) {
      warnings.push(`Ignoring unsupported SiteSettings key "${rawKey}" at row ${rowNumber}.`);
      return;
    }
    if (seen.has(rawKey)) {
      warnings.push(`Ignoring duplicate SiteSettings key "${rawKey}" at row ${rowNumber}.`);
      return;
    }

    const key = rawKey as SiteSettingKey;
    let value: string;
    try {
      value = normalizeSettingValue(key, row.value);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'invalid value';
      warnings.push(`Ignoring invalid SiteSettings value for "${key}" at row ${rowNumber}: ${message}.`);
      return;
    }
    settings[key] = value;
    seen.add(rawKey);
  });

  return { settings, warnings };
}

export async function getSiteSettings(env: Env): Promise<Response> {
  try {
    const token = await getAccessToken(env);
    let rows: Array<Record<string, string>> = [];

    try {
      rows = await getRows(token, env.SHEET_ID, SITE_SETTINGS_SHEET);
    } catch (err) {
      if (!isMissingSheetError(err)) {
        throw err;
      }
    }

    const parsed = parseSiteSettingsRows(rows);
    if (parsed.warnings.length) {
      console.warn('Site settings warnings:', parsed.warnings.join(' | '));
    }
    return success(parsed);
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Failed to load site settings', 500);
  }
}

export async function updateSiteSettings(
  env: Env,
  body: { officerSecret?: string; settings?: Record<string, unknown> }
): Promise<Response> {
  try {
    if (body.officerSecret !== env.OFFICER_PASSCODE) {
      return error('Not authorized', 403);
    }

    if (!body.settings || typeof body.settings !== 'object') {
      return error('settings object is required', 400);
    }

    const incomingKeys = Object.keys(body.settings);
    if (!incomingKeys.length) {
      return error('settings must include at least one key', 400);
    }

    const validatedUpdates: Array<{ key: SiteSettingKey; value: string }> = [];
    for (const rawKey of incomingKeys) {
      if (!SITE_SETTING_KEY_SET.has(rawKey)) {
        return error(`Unsupported setting key: ${rawKey}`, 400);
      }
      const key = rawKey as SiteSettingKey;
      validatedUpdates.push({
        key,
        value: normalizeSettingValue(key, body.settings[key]),
      });
    }

    const token = await getAccessToken(env);

    let existingRows: Array<Record<string, string>> = [];
    try {
      existingRows = await getRows(token, env.SHEET_ID, SITE_SETTINGS_SHEET);
    } catch (err) {
      if (!isMissingSheetError(err)) {
        throw err;
      }
    }

    const rowIndexByKey = new Map<string, number>();
    existingRows.forEach((row, index) => {
      const key = String(row.key ?? '').trim();
      if (key) {
        rowIndexByKey.set(key, index + 2);
      }
    });

    const valueColIndex = await getColumnIndex(token, env.SHEET_ID, SITE_SETTINGS_SHEET, 'value');
    const updatedAtColIndex = await getColumnIndex(token, env.SHEET_ID, SITE_SETTINGS_SHEET, 'updatedAt');

    const hasExistingRowsToUpdate = validatedUpdates.some(({ key }) => rowIndexByKey.has(key));
    if (hasExistingRowsToUpdate && (valueColIndex < 1 || updatedAtColIndex < 1)) {
      throw new Error('SiteSettings sheet is missing required columns: value and updatedAt');
    }

    for (const { key, value } of validatedUpdates) {
      const existingRowIndex = rowIndexByKey.get(key);

      if (!existingRowIndex) {
        await appendRow(token, env.SHEET_ID, SITE_SETTINGS_SHEET, SITE_SETTINGS_HEADERS, {
          key,
          value,
          updatedAt: new Date().toISOString(),
        });
        continue;
      }

      await updateCell(token, env.SHEET_ID, SITE_SETTINGS_SHEET, existingRowIndex, valueColIndex, value);
      await updateCell(token, env.SHEET_ID, SITE_SETTINGS_SHEET, existingRowIndex, updatedAtColIndex, new Date().toISOString());
    }

    const refreshedRows = await getRows(token, env.SHEET_ID, SITE_SETTINGS_SHEET);
    const parsed = parseSiteSettingsRows(refreshedRows);
    if (parsed.warnings.length) {
      console.warn('Site settings warnings after update:', parsed.warnings.join(' | '));
    }

    return success(parsed);
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Failed to update site settings', 500);
  }
}
