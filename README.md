# UT Canoe & Hiking Club Website

A simple website for the University of Tennessee Canoe & Hiking Club.

## Architecture

- **Frontend**: Static HTML/CSS/JS hosted on GitHub Pages
- **Backend**: Cloudflare Worker API (in `/worker`)
- **Data**: Google Sheets (RSVPs, Trips, Suggestions) + Google Calendar

## Features

- Public trip calendar (embedded Google Calendar)
- RSVP form for upcoming trips
- Trip suggestion form
- Officer portal for creating/editing/deleting trips

## Quick Links

- Public site: `https://ut-canoe-hike.github.io/utch_website/`
- Officer portal: `https://ut-canoe-hike.github.io/utch_website/officer.html`

## Setup

### 1. GitHub Pages

1. Go to repo **Settings** → **Pages**
2. Source: Deploy from branch `main`, folder `/ (root)`
3. Save and wait for deployment

### 2. Backend API

See [`worker/README.md`](worker/README.md) for full setup instructions.

Summary:
1. Create a Google Cloud service account with Sheets + Calendar API access
2. Share your Google Sheet and Calendar with the service account email
3. Deploy the Cloudflare Worker with `npm run deploy`
4. Add secrets (service account credentials, sheet ID, calendar ID, officer passcode)

### 3. Frontend Config

Edit `assets/config.js`:

```javascript
window.UTCH_CONFIG = {
  calendarEmbedUrl: "https://calendar.google.com/calendar/embed?src=...",
  calendarIcsUrl: "",  // optional
  apiBaseUrl: "https://your-worker.workers.dev"
};
```

## Officer Workflow

### Create a Trip

1. Go to `officer.html`
2. Enter the officer passcode
3. Fill out trip details
4. Submit — creates a calendar event and adds to the Trips sheet

### Check RSVPs

Open the Google Sheet → `RSVPs` tab

### Review Suggestions

Open the Google Sheet → `Suggestions` tab

## Common Edits

| Task | File(s) |
|------|---------|
| Change meeting time/room | `index.html`, `about.html` |
| Update contact email | Search for `utch1968@gmail.com` |
| Change calendar embed | `assets/config.js` |
| Change API URL | `assets/config.js` |
| Modify backend logic | `worker/src/` |

## Troubleshooting

**"Unable to load trips"**
- Check `assets/config.js` has correct `apiBaseUrl`
- Verify the Worker is deployed and secrets are set
- Check browser console for errors

**"Not authorized" on officer page**
- Wrong passcode (must match `OFFICER_PASSCODE` secret in Worker)

**CORS errors**
- Check `ALLOWED_ORIGIN` secret matches your GitHub Pages URL exactly (including `https://`, no trailing slash)
