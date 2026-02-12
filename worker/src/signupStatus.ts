import type { TripSignupStatus } from './types';

const VALID_SIGNUP_STATUSES: TripSignupStatus[] = ['REQUEST_OPEN', 'MEETING_ONLY', 'FULL'];

export function parseSignupStatusInput(value: unknown, fieldName = 'signupStatus'): TripSignupStatus {
  const status = String(value ?? '').trim().toUpperCase();
  if (VALID_SIGNUP_STATUSES.includes(status as TripSignupStatus)) {
    return status as TripSignupStatus;
  }
  throw new Error(`Invalid ${fieldName}: ${status || '(missing)'}`);
}

// Legacy rows may be missing signupStatus because the column was added later.
// Treat empty as REQUEST_OPEN so existing trips remain usable until edited.
export function readSignupStatusFromRow(value: unknown, context = 'signupStatus'): TripSignupStatus {
  const status = String(value ?? '').trim().toUpperCase();
  if (!status) {
    return 'REQUEST_OPEN';
  }
  if (VALID_SIGNUP_STATUSES.includes(status as TripSignupStatus)) {
    return status as TripSignupStatus;
  }
  throw new Error(`Invalid ${context}: ${status}`);
}
