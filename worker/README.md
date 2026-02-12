# UTCH API Worker

Cloudflare Worker backend for the UT Canoe & Hiking Club website.

## Prerequisites

- Node.js 18+
- Cloudflare account (free tier works)
- Google Cloud project with Sheets API and Calendar API enabled
- Service account with access to your Sheet and Calendar

## Setup

### 1. Install dependencies

```bash
cd worker
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

This opens a browser for OAuth. After authorizing, you're logged in.

### 3. Add secrets

From your Google service account JSON file, you need:
- `client_email` → GOOGLE_SERVICE_ACCOUNT_EMAIL
- `private_key` → GOOGLE_PRIVATE_KEY

Run these commands (you'll be prompted to paste the values):

```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
# Paste the email (e.g., utch-worker@project-id.iam.gserviceaccount.com)

npx wrangler secret put GOOGLE_PRIVATE_KEY
# Paste the entire private key INCLUDING the -----BEGIN/END PRIVATE KEY----- lines

npx wrangler secret put SHEET_ID
# The ID from your Google Sheet URL: docs.google.com/spreadsheets/d/SHEET_ID/edit

npx wrangler secret put CALENDAR_ID
# The calendar ID (e.g., abc123@group.calendar.google.com)

npx wrangler secret put OFFICER_PASSCODE
# Your officer passcode

npx wrangler secret put ALLOWED_ORIGIN
# Your GitHub Pages URL (e.g., https://your-username.github.io)

npx wrangler secret put SITE_BASE_URL
# Full site base URL for trip join links (e.g., https://your-username.github.io/your-repo)
```

### 4. Deploy

```bash
npm run deploy
```

This outputs your Worker URL (e.g., `https://utch-api.your-subdomain.workers.dev`).

### 5. Update frontend config

Edit `src/public/assets/config.js` and set `apiBaseUrl` to your Worker URL.

## Development

Run locally:

```bash
npm run dev
```

This starts a local server at `http://localhost:8787`.

Note: For local testing with secrets, create a `.dev.vars` file:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SHEET_ID=...
CALENDAR_ID=...
OFFICER_PASSCODE=...
ALLOWED_ORIGIN=http://localhost:8000
SITE_BASE_URL=http://localhost:8000
```

## Sync (Sheets → Calendar)

The Worker runs a scheduled sync every hour to keep Calendar events aligned
with the Trips sheet. If you edit or delete a trip directly in the sheet, the
sync will update or remove the calendar event automatically (for events within
the next year and up to 30 days in the past).

You can also trigger a manual sync from the Officer page (Sync Calendar button),
which calls `POST /api/sync` with the officer passcode.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/trips | Public | List upcoming trips |
| POST | /api/trips | Officer | Create a trip |
| PATCH | /api/trips/:id | Officer | Update a trip |
| DELETE | /api/trips/:id | Officer | Delete a trip |
| POST | /api/trips/admin | Officer | List all trips (admin view) |
| POST | /api/requests | Public | Submit trip join request |
| POST | /api/requests/by-trip | Officer | List requests for one trip |
| PATCH | /api/requests/:id/status | Officer | Update request status |
| POST | /api/suggest | Public | Submit trip suggestion |
| POST | /api/officer/verify | Public | Verify officer passcode |
| GET | /health | Public | Health check |

Officer endpoints require `officerSecret` in the request body.
Officer auth is a shared passcode (no Google OAuth).

## Troubleshooting

**"Failed to get access token"**
- Check that GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are set correctly
- Make sure the private key includes newlines (the actual `\n` characters, not escaped)

**"Sheets API error" or "Calendar not found"**
- Verify the Sheet/Calendar is shared with the service account email
- Check SHEET_ID and CALENDAR_ID are correct

**CORS errors**
- Make sure ALLOWED_ORIGIN matches your site exactly (including https://)
- No trailing slash
