import type { Env, RsvpInput } from '../types';
import { getAccessToken } from '../auth';
import { appendRow } from '../sheets';
import { success, error, requiredString, optionalString, normalizeGearList } from '../utils';

const RSVP_HEADERS = [
  'submittedAt',
  'tripId',
  'name',
  'contact',
  'carpool',
  'gearNeeded',
  'notes',
];

export async function submitRsvp(env: Env, body: RsvpInput): Promise<Response> {
  try {
    const tripId = requiredString(body.tripId, 'tripId');
    const name = requiredString(body.name, 'name');
    const contact = requiredString(body.contact, 'contact');
    const carpool = optionalString(body.carpool);
    const gearNeeded = normalizeGearList(body.gearNeeded);
    const notes = optionalString(body.notes);

    const token = await getAccessToken(env);

    await appendRow(token, env.SHEET_ID, 'RSVPs', RSVP_HEADERS, {
      submittedAt: new Date(),
      tripId,
      name,
      contact,
      carpool,
      gearNeeded: gearNeeded.join(','),
      notes,
    });

    return success({ tripId });
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Failed to submit RSVP', 500);
  }
}
