import type { Env, TripInput, RequestInput, SuggestionInput } from './types';
import { error } from './utils';
import {
  listTrips,
  listTripsAdmin,
  createTrip,
  updateTrip,
  deleteTrip,
  syncTripsWithCalendar,
  syncTripsRequest,
} from './handlers/trips';
import { createRequest, listRequestsByTrip, updateRequestStatus } from './handlers/requests';
import { submitSuggestion } from './handlers/suggest';
import { verifyOfficer } from './handlers/officer';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse(env, new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Get client IP for rate limiting
    const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';

    // Derive site base URL from allowed origin
    const siteBaseUrl = (env.SITE_BASE_URL || env.ALLOWED_ORIGIN).replace(/\/$/, '');

    try {
      let response: Response;

      // Route requests
      if (path === '/api/trips' && method === 'GET') {
        response = await listTrips(env);
      } else if (path === '/api/trips' && method === 'POST') {
        const body = await parseJson<TripInput>(request);
        response = await createTrip(env, body, siteBaseUrl);
      } else if (path.match(/^\/api\/trips\/[^/]+$/) && method === 'PATCH') {
        const tripId = path.split('/')[3];
        const body = await parseJson<TripInput>(request);
        response = await updateTrip(env, tripId, body, siteBaseUrl);
      } else if (path.match(/^\/api\/trips\/[^/]+$/) && method === 'DELETE') {
        const tripId = path.split('/')[3];
        const body = await parseJson<{ officerSecret: string }>(request);
        response = await deleteTrip(env, tripId, body);
      } else if (path === '/api/trips/admin' && method === 'POST') {
        const body = await parseJson<{ officerSecret: string }>(request);
        response = await listTripsAdmin(env, body);
      } else if ((path === '/api/rsvp' || path === '/api/requests') && method === 'POST') {
        const body = await parseJson<RequestInput>(request);
        response = await createRequest(env, body);
      } else if (path === '/api/requests/by-trip' && method === 'POST') {
        const body = await parseJson<{ officerSecret?: string; tripId?: string }>(request);
        response = await listRequestsByTrip(env, body);
      } else if (path.match(/^\/api\/requests\/[^/]+\/status$/) && method === 'PATCH') {
        const requestId = path.split('/')[3];
        const body = await parseJson<{ officerSecret?: string; status?: string }>(request);
        response = await updateRequestStatus(env, requestId, body);
      } else if (path === '/api/suggest' && method === 'POST') {
        const body = await parseJson<SuggestionInput>(request);
        response = await submitSuggestion(env, body);
      } else if (path === '/api/officer/verify' && method === 'POST') {
        const body = await parseJson<{ officerSecret: string }>(request);
        response = await verifyOfficer(env, body, clientIp);
      } else if (path === '/api/sync' && method === 'POST') {
        const body = await parseJson<{ officerSecret?: string }>(request);
        response = await syncTripsRequest(env, body, siteBaseUrl);
      } else if (path === '/health') {
        response = new Response(JSON.stringify({ ok: true, timestamp: Date.now() }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        response = error('Not found', 404);
      }

      const shouldAutoSync = response.ok && (
        (path === '/api/trips' && method === 'POST') ||
        (path.match(/^\/api\/trips\/[^/]+$/) && (method === 'PATCH' || method === 'DELETE'))
      );

      if (shouldAutoSync) {
        ctx.waitUntil(syncTripsWithCalendar(env, siteBaseUrl));
      }

      return corsResponse(env, response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      return corsResponse(env, error(message, 500));
    }
  },
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const siteBaseUrl = (env.SITE_BASE_URL || env.ALLOWED_ORIGIN).replace(/\/$/, '');
    event.waitUntil(syncTripsWithCalendar(env, siteBaseUrl));
  },
};

function corsResponse(env: Env, response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', env.ALLOWED_ORIGIN);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function parseJson<T>(request: Request): Promise<T> {
  const text = await request.text();
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Invalid JSON body');
  }
}
