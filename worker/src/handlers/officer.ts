import type { Env } from '../types';
import { success, error } from '../utils';

// Simple in-memory rate limiter (resets when worker instance recycles)
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000; // 1 minute

function isRateLimited(ip: string): boolean {
  const record = failedAttempts.get(ip);
  if (!record) return false;

  // Reset if lockout period has passed
  if (Date.now() - record.lastAttempt > LOCKOUT_MS) {
    failedAttempts.delete(ip);
    return false;
  }

  return record.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const record = failedAttempts.get(ip);
  if (record) {
    record.count++;
    record.lastAttempt = Date.now();
  } else {
    failedAttempts.set(ip, { count: 1, lastAttempt: Date.now() });
  }
}

function clearFailedAttempts(ip: string): void {
  failedAttempts.delete(ip);
}

export async function verifyOfficer(
  env: Env,
  body: { officerSecret?: string },
  clientIp: string
): Promise<Response> {
  // Check rate limit
  if (isRateLimited(clientIp)) {
    return error('Too many attempts. Please wait a minute.', 429);
  }

  const secret = body.officerSecret?.trim();
  if (!secret) {
    return error('Passcode is required', 400);
  }

  if (secret !== env.OFFICER_PASSCODE) {
    recordFailedAttempt(clientIp);
    return error('Not authorized', 403);
  }

  // Success - clear failed attempts
  clearFailedAttempts(clientIp);
  return success({});
}
