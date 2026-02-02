# UT Canoe & Hiking Club Website (UTCH)

This site is designed so future officers can run it with **minimal technical work**.

## What this website does

- Shows the club website on **GitHub Pages**
- Shows upcoming trips using an embedded **Google Calendar**
- Lets members submit:
  - **RSVPs** (saved to a Google Sheet)
  - **Trip suggestions** (saved to a Google Sheet)
- Lets officers create trips through an **Officer Create Trip** page (creates a Google Calendar event + Trip ID)

The only “backend” is a Google **Apps Script** web app that writes to a Google **Sheet** and creates calendar events.

---

## How the pieces fit together (plain language)

- **GitHub Pages repo (this code):** the public website people visit and fill out.
- **Apps Script:** the “helper” that receives form submissions and writes data.
- **Google Sheets & Calendar:** where the data actually lives (Sheets = records, Calendar = public schedule).

---

## Quick links (once set up)

- Public site: `https://ut-canoe-hike.github.io/<repo>/`
- Calendar page: `https://ut-canoe-hike.github.io/<repo>/calendar.html`
- Officer trip creator: `https://ut-canoe-hike.github.io/<repo>/officer.html`
- Data spreadsheet (“UTCH Site Data”): `https://docs.google.com/spreadsheets/d/19bHgttW_rnmQXu8x8u4tDlT_RfsOpZgwjlgMh0JHefQ/edit`

---

## One-time setup (do this once per new officer team)

### 1) GitHub Pages

1. On GitHub, open the repo → **Settings** → **Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main` (or `master`) and **Folder:** `/ (root)`
4. Save, then wait for the “Your site is live at …” URL

### 2) Google Calendar (Trip calendar)

1. In Google Calendar, create (or use) the calendar for UTCH trips
2. Calendar settings → **Integrate calendar**:
   - Copy the **Embed code** `src` URL
   - (Optional) Copy the **iCal address** (helps Apple/Outlook users subscribe)
3. Put these into `assets/config.js`:
   - `calendarEmbedUrl`
   - `calendarIcsUrl` (optional)

### 3) Apps Script backend (forms + officer tools)

Recommended: use **clasp** to sync Apps Script with this repo (no copy/paste).

**If using clasp (recommended):**
1. Make sure `Code.js` + `appsscript.json` are present in the repo root (this is the Apps Script project).
2. Run: `clasp push`
3. Deploy: `clasp deploy`

**If not using clasp (manual copy/paste):**
1. Create a new Apps Script project at `https://script.google.com` (use the **club Google account**)
2. Copy/paste these repo files into the Apps Script project:
   - `Code.js`
   - `appsscript.json` (enable “Show appsscript.json” in Project Settings)
3. In Apps Script → **Project Settings** → **Script properties**, set:
   - `UTCH_SPREADSHEET_ID` = `19bHgttW_rnmQXu8x8u4tDlT_RfsOpZgwjlgMh0JHefQ`
   - `UTCH_CALENDAR_ID` = your calendar ID (ends with `@group.calendar.google.com`)
   - `UTCH_SITE_BASE_URL` = your GitHub Pages base URL (no trailing slash)
   - `UTCH_OFFICER_SECRET` = a strong shared passcode for officers (e.g., 20+ chars)
   - (Optional) `UTCH_NOTIFY_EMAIL` = email to notify when someone suggests a trip
4. Deploy: **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the Web app URL and put it into `assets/config.js`:
   - `appsScriptWebAppUrl`
6. Officer trip creation uses the passcode above (no Google Sign-In required).

---

## Weekly officer workflow (how to run trips)

### Create a trip (recommended)

1. Open the officer page: `https://ut-canoe-hike.github.io/<repo>/officer.html`
2. Enter the officer passcode
3. Fill out trip details and (optionally) select which **club gear** is available
4. Submit (you’ll be redirected briefly to a result page and then back)

This will:
- Create the Google Calendar event (consistent formatting)
- Create a Trip ID
- Make the trip show up in the RSVP dropdown on the website

### Check RSVPs

1. Open the spreadsheet
2. Go to the `RSVPs` tab
3. Filter by `tripId` to see signups for a specific trip

### Review trip suggestions

1. Open the spreadsheet
2. Go to the `Suggestions` tab

---

## Common edits

### Change meeting time / room

- Edit `index.html`, `about.html` (search for “AMB 27”)

### Update contact email

- Search the repo for `utch1968@gmail.com` and update where needed

### Change calendar embed

- Edit `assets/config.js` → `calendarEmbedUrl`

---

## Troubleshooting

- **RSVP dropdown says “Unable to load trips”**
  - `assets/config.js` is missing/incorrect `appsScriptWebAppUrl`
  - Apps Script isn’t deployed as a web app, or script properties aren’t set
  - No trips exist yet (create one via the officer page so the `Trips` tab is populated)

- **Officer trip creation says “Not authorized”**
  - Wrong `Officer passcode` (it must match the Apps Script `UTCH_OFFICER_SECRET` script property)
