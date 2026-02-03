# Handoff Context Document

**Project**: UT Canoe & Hiking Club Website
**Date**: 2026-02-02
**Previous Agent**: Claude Opus 4.5

---

## Project Overview

A static website for the University of Tennessee Canoe & Hiking Club, hosted on GitHub Pages with a Cloudflare Worker backend.

**Live URLs**:
- Frontend: `https://ut-canoe-hike.github.io/utch_website/`
- API: `https://utch-api.ut-canoe-hike.workers.dev`

---

## What Was Changed This Session

### Major Architectural Change: Replaced Google Apps Script with Cloudflare Worker

The original site used Google Apps Script as a backend, which caused persistent CORS issues when called from GitHub Pages. We replaced it entirely with a Cloudflare Worker that directly calls Google Sheets API and Calendar API using a service account.

**Old architecture** (removed):
```
GitHub Pages → JSONP → Apps Script → Google Sheets/Calendar
```

**New architecture**:
```
GitHub Pages → fetch() → Cloudflare Worker → Google Sheets/Calendar APIs
```

### Files Created (new `/worker` directory)

```
worker/
├── package.json          # Dependencies: wrangler, typescript, cloudflare types
├── wrangler.toml         # Worker config (name: utch-api)
├── tsconfig.json
├── README.md             # Setup instructions for the worker
└── src/
    ├── index.ts          # Main router, CORS handling
    ├── types.ts          # TypeScript interfaces
    ├── utils.ts          # Validation, date parsing, ID generation
    ├── auth.ts           # Google service account JWT auth
    ├── sheets.ts         # Google Sheets API wrapper
    ├── calendar.ts       # Google Calendar API wrapper
    └── handlers/
        ├── trips.ts      # CRUD for trips
        ├── rsvp.ts       # RSVP submission
        ├── suggest.ts    # Trip suggestion submission
        └── officer.ts    # Officer passcode verification + rate limiting
```

### Files Modified

| File | Changes |
|------|---------|
| `assets/site.js` | Rewrote from JSONP to clean fetch() calls. Reduced from ~850 to ~590 lines. |
| `assets/config.js` | Changed from `appsScriptWebAppUrl` to `apiBaseUrl` pointing to Worker |
| `officer.html` | Changed passcode input to `type="password"` |
| `README.md` | Rewrote for new architecture |
| `.gitignore` | Updated to exclude secrets, node_modules, service account files |

### Files Deleted

- `Code.js`, `appsscript.json`, `.clasp.json`, `.claspignore` (Apps Script)
- `apps-script/` directory
- `submit-result.html` (old JSONP redirect page)
- `docs/`, `calendar.txt`, `manuscript.pdf`, `AGENTS.md`, `history.md`
- Various .docx files

### Bug Fixes Applied

1. **sheets.ts**: Added error handling for `ensureHeaders()` and `createSheet()` - they were silently failing
2. **officer.html**: Passcode input changed from `type="text"` to `type="password"`
3. **Timezone fix**: Calendar events now use `America/New_York` timezone so times entered by officers display correctly (previously treated as UTC)

---

## Current State

### Deployment Status
- **Worker**: Deployed to `https://utch-api.ut-canoe-hike.workers.dev`
- **Secrets configured**: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, SHEET_ID, CALENDAR_ID, OFFICER_PASSCODE, ALLOWED_ORIGIN
- **Frontend**: NOT yet pushed to GitHub Pages

### Git Status
```
Changes not staged:
- Deleted old Apps Script files
- Modified: .gitignore, README.md, assets/config.js, assets/site.js, officer.html

Untracked:
- worker/ (entire new directory)
```

**Nothing has been committed or pushed yet.**

---

## What Needs to Happen Next

1. **Commit and push** all changes to deploy to GitHub Pages
2. **Test on live site** - CORS will work once frontend is on GitHub Pages (ALLOWED_ORIGIN is set to the GitHub Pages URL)
3. **Verify functionality**:
   - RSVP page loads trips from API
   - Suggest form submits successfully
   - Officer login works with passcode
   - Create/edit/delete trips work and appear on Google Calendar

---

## Key Technical Details

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/trips | Public | List upcoming trips |
| POST | /api/trips | Officer | Create a trip |
| PATCH | /api/trips/:id | Officer | Update a trip |
| DELETE | /api/trips/:id | Officer | Delete a trip |
| POST | /api/trips/admin | Officer | List all trips (admin view) |
| POST | /api/rsvp | Public | Submit RSVP |
| POST | /api/suggest | Public | Submit trip suggestion |
| POST | /api/officer/verify | Public | Verify officer passcode |
| GET | /health | Public | Health check |

Officer endpoints require `officerSecret` in request body.

### Google Sheets Structure

The Worker expects these sheet tabs (auto-created if missing):
- **Trips**: tripId, eventId, title, activity, start, end, location, etc.
- **RSVPs**: tripId, name, contact, carpool, gearNeeded, notes
- **Suggestions**: name, email, willingToLead, idea, location, timing, notes

### Environment Secrets (in Cloudflare)

```
GOOGLE_SERVICE_ACCOUNT_EMAIL  # From service account JSON
GOOGLE_PRIVATE_KEY            # From service account JSON (with newlines)
SHEET_ID                      # From Google Sheet URL
CALENDAR_ID                   # From Google Calendar settings
OFFICER_PASSCODE              # Shared passcode for officers
ALLOWED_ORIGIN                # https://ut-canoe-hike.github.io (no trailing slash)
```

### Local Development

To test the Worker locally:
```bash
cd worker
# Create .dev.vars with secrets (including ALLOWED_ORIGIN=http://localhost:8000)
npm run dev  # Starts at localhost:8787
```

Then update `assets/config.js` temporarily to point to `http://localhost:8787`.

---

## File Locations for Common Tasks

| Task | File(s) |
|------|---------|
| Modify API behavior | `worker/src/handlers/*.ts` |
| Change frontend forms | `rsvp.html`, `suggest.html`, `officer.html` |
| Update API URL | `assets/config.js` |
| Modify form handling JS | `assets/site.js` |
| Change styles | `assets/styles.css` |
| Deploy Worker changes | `cd worker && npm run deploy` |

---

## Known Limitations

1. **Rate limiter is per-instance**: The officer login rate limiter uses in-memory state, which doesn't persist across Worker instances. Acceptable for a club site.

2. **Sheet column limit**: The `updateCell` function only works for columns A-Z (1-26). Current schema uses 16 columns, so this is fine.

3. **All times are Eastern**: Hardcoded to `America/New_York` timezone in `worker/src/calendar.ts`.
