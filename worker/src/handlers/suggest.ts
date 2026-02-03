import type { Env, SuggestionInput } from '../types';
import { getAccessToken } from '../auth';
import { appendRow } from '../sheets';
import { success, error, requiredString, optionalString } from '../utils';

const SUGGESTIONS_HEADERS = [
  'submittedAt',
  'name',
  'email',
  'willingToLead',
  'idea',
  'location',
  'timing',
  'notes',
];

export async function submitSuggestion(env: Env, body: SuggestionInput): Promise<Response> {
  try {
    const name = requiredString(body.name, 'name');
    const idea = requiredString(body.idea, 'idea');
    const email = optionalString(body.email);
    const willingToLead = optionalString(body.willingToLead);
    const location = optionalString(body.location);
    const timing = optionalString(body.timing);
    const notes = optionalString(body.notes);

    const token = await getAccessToken(env);

    await appendRow(token, env.SHEET_ID, 'Suggestions', SUGGESTIONS_HEADERS, {
      submittedAt: new Date(),
      name,
      email,
      willingToLead,
      idea,
      location,
      timing,
      notes,
    });

    return success({});
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Failed to submit suggestion', 500);
  }
}
