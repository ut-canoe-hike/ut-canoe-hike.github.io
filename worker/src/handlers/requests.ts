import type { Env, RequestInput, RequestStatus } from '../types';
import { getAccessToken } from '../auth';
import { appendRow, findRowByColumn, getColumnIndex, getRows, updateCell } from '../sheets';
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
        const statusRaw = row.status?.trim().toUpperCase() || 'PENDING';
        const status: RequestStatus = isValidRequestStatus(statusRaw) ? statusRaw : 'PENDING';
        return {
          requestId: row.requestId?.trim() || `legacy-${index + 1}`,
          submittedAt: row.submittedAt || '',
          tripId: row.tripId?.trim() || '',
          name: row.name?.trim() || '',
          contact: row.contact?.trim() || '',
          carpool: row.carpool?.trim() || '',
          gearNeeded: normalizeGearList(row.gearNeeded),
          notes: row.notes?.trim() || '',
          status,
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
    if (updatedAtColIndex > 0) {
      await updateCell(token, env.SHEET_ID, REQUESTS_SHEET, found.rowIndex, updatedAtColIndex, new Date().toISOString());
    }

    return success({ requestId, status: nextStatus });
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Failed to update request status', 500);
  }
}
