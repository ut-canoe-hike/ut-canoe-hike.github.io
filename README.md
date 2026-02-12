# UT Canoe & Hiking Club Website

UTCH site frontend (Vite) + Cloudflare Worker backend + Google Sheets/Calendar sync.

## Project Structure

- `src/`: frontend source (pages, partials, JS, CSS, assets)
- `worker/`: Cloudflare Worker API and Google integrations
- `.github/workflows/deploy-pages.yml`: GitHub Pages deploy workflow

## Frontend Development

Install and run locally:

```bash
npm ci
npm run dev
```

Create a production build:

```bash
npm run build
```

Vite outputs compiled files to `dist/`.

## Frontend Config

Edit `src/public/assets/config.js`:

```javascript
window.UTCH_CONFIG = {
  calendarEmbedUrl: "https://calendar.google.com/calendar/embed?src=...",
  calendarIcsUrl: "",
  apiBaseUrl: "https://your-worker.workers.dev",
  timeZone: "America/New_York"
};
```

## Officer Workflow (No Code Changes)

### 1. Log in to Officer Portal

- Open `/officer.html`
- Enter the shared officer passcode

### 2. Manage Trips

- `Create Trip`: create a new trip and calendar event
- `Edit Trip`: update any trip field
- `Delete Trip`: remove trip and event
- `Signup Button Status`: set each trip to `Request to Join`, `Attend Meeting to Sign Up`, or `Trip Full`

### 3. Manage Rosters

In `Trip Requests`:

- Select a trip
- Review three lanes: `Pending`, `Approved`, `Declined`
- Move one request at a time between statuses using action buttons

Roster behavior is manual by design: requests are not auto-approved.

### 4. Manage Public Site Settings

In `Site Settings`:

- Update contact email, VOLlink URL, GroupMe URL
- Update meeting block copy shown on homepage
- Update request-panel copy shown during trip sign-up

This writes to Google Sheet tab `SiteSettings`, so officers can update messaging without editing code.

## Google Sheet Tabs Used

- `Trips`
- `Requests`
- `Suggestions`
- `SiteSettings`

`SiteSettings` columns must be:

- `key`
- `value`
- `updatedAt`

## GitHub Pages Deployment

Deployment is handled by GitHub Actions.

1. In GitHub repo settings, go to `Settings` -> `Pages`.
2. Set `Build and deployment` source to `GitHub Actions`.
3. Push to `main` to trigger deploy.

## Backend

See `worker/README.md` for Worker setup, secrets, and API details.
