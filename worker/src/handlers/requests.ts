import type { Env, RequestInput, RequestStatus } from '../types';
import { getAccessToken } from '../auth';
import { appendRow, findRowByColumn, getColumnIndex, getRows, updateCell } from '../sheets';
import { readSignupStatusFromRow } from '../signupStatus';
import { error, normalizeGearList, optionalString, requiredString, success } from '../utils';

const REQUESTS_SHEET = 'Requests';
const REQUEST_HEADERS = [
  'requestId',
  'submittedAt',
  'tripId',
  'name',
  'contact',
  'carpool',
  'gearNeeded',
  'notes',
  'status',
  'updatedAt',
];

function isValidRequestStatus(value: string): value is RequestStatus {
  return value === 'PENDING' || value === 'APPROVED' || value === 'DECLINED';
}

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createRequest(env: Env, body: RequestInput): Promise<Response> {
  try {
    const tripId = requiredString(body.tripId, 'tripId');
    const name = requiredString(body.name, 'name');
    const contact = requiredString(body.contact, 'contact');
    const carpool = optionalString(body.carpool);
    const gearNeeded = normalizeGearList(body.gearNeeded);
    const notes = optionalString(body.notes);

    const token = await getAccessToken(env);
    const trip = await findRowByColumn(token, env.SHEET_ID, 'Trips', 'tripId', tripId);
    if (!trip) {
      return error('Trip not found', 404);
    }

    const signupStatus = readSignupStatusFromRow(trip.row.signupStatus, `signupStatus for trip ${tripId}`);
    if (signupStatus === 'MEETING_ONLY') {
      return error('This trip is meeting sign-up only.', 400);
    }
    if (signupStatus === 'FULL') {
      return error('This trip is currently full.', 400);
    }

    const requestId = generateRequestId();

    await appendRow(token, env.SHEET_ID, REQUESTS_SHEET, REQUEST_HEADERS, {
      requestId,
      submittedAt: new Date(),
      tripId,
      name,
      contact,
      carpool,
      gearNeeded: gearNeeded.join(','),
      notes,
      status: 'PENDING',
      updatedAt: new Date(),
    });

    return success({ tripId, requestId });
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Failed to submit request', 500);
  }
}

export async function listRequestsByTrip(
  env: Env,
  body: { officerSecret?: string; tripId?: string }
): Promise<Response> {
  try {
    if (body.officerSecret !== env.OFFICER_PASSCODE) {
      return error('Not authorized', 403);
    }

    const tripId = requiredString(body.tripId, 'tripId');
    const token = await getAccessToken(env);
    const rows = await getRows(token, env.SHEET_ID, REQUESTS_SHEET);

    const requests = rows
      .filter(row => row.tripId?.trim() === tripId)
      .map((row, index) => {
        const rowNumber = index + 2;
        const statusRaw = String(row.status ?? '').trim().toUpperCase();
        if (!isValidRequestStatus(statusRaw)) {
          throw new Error(`Invalid request status at row ${rowNumber}`);
        }
        const requestId = requiredString(row.requestId, `requestId at row ${rowNumber}`);
        const name = requiredString(row.name, `name at row ${rowNumber}`);
        const contact = requiredString(row.contact, `contact at row ${rowNumber}`);
        return {
          requestId,
          submittedAt: requiredString(row.submittedAt, `submittedAt at row ${rowNumber}`),
          tripId: requiredString(row.tripId, `tripId at row ${rowNumber}`),
          name,
          contact,
          carpool: optionalString(row.carpool),
          gearNeeded: normalizeGearList(row.gearNeeded),
          notes: optionalString(row.notes),
          status: statusRaw as RequestStatus,
        };
      })
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

    return success({ requests });
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Failed to load requests', 500);
  }
}

export async function updateRequestStatus(
  env: Env,
  requestId: string,
  body: { officerSecret?: string; status?: string }
): Promise<Response> {
  try {
    if (body.officerSecret !== env.OFFICER_PASSCODE) {
      return error('Not authorized', 403);
    }

    const nextStatus = String(body.status ?? '').trim().toUpperCase();
    if (!isValidRequestStatus(nextStatus)) {
      return error('Invalid status', 400);
    }

    const token = await getAccessToken(env);
    const found = await findRowByColumn(token, env.SHEET_ID, REQUESTS_SHEET, 'requestId', requestId);
    if (!found) {
      return error('Request not found', 404);
    }

    const statusColIndex = await getColumnIndex(token, env.SHEET_ID, REQUESTS_SHEET, 'status');
    if (statusColIndex < 1) {
      return error('Requests sheet is missing status column', 500);
    }
    await updateCell(token, env.SHEET_ID, REQUESTS_SHEET, found.rowIndex, statusColIndex, nextStatus);

    const updatedAtColIndex = await getColumnIndex(token, env.SHEET_ID, REQUESTS_SHEET, 'updatedAt');
    if (updatedAtColIndex < 1) {
      return error('Requests sheet is missing updatedAt column', 500);
    }
    await updateCell(token, env.SHEET_ID, REQUESTS_SHEET, found.rowIndex, updatedAtColIndex, new Date().toISOString());

    return success({ requestId, status: nextStatus });
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Failed to update request status', 500);
  }
}
