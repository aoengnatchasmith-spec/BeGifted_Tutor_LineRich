# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Google Apps Script web app for BeGifted tutors to submit class cancellation requests. Deployed as a Google Apps Script Web App (not a standalone server).

## Deployment

This project uses the [clasp](https://github.com/google/clasp) CLI to push/pull code to Google Apps Script:

```bash
clasp push        # deploy code to Apps Script
clasp pull        # pull latest from Apps Script
clasp deploy      # create a new versioned deployment
clasp open        # open the Apps Script editor in browser
```

There is no local dev server — the app runs inside Google's infrastructure. Test by opening the deployed web app URL.

## Architecture

**`code.js`** — Server-side Apps Script (runs on Google's servers):
- `doGet()` — serves `Index.html` as the web app entry point
- `validateEmail(email)` — looks up a tutor in the Wise API by email; returns `{ ok, teacher }` or `{ ok: false, error }`
- `getSessions(teacherId)` — fetches upcoming sessions (next 7 days) from the Wise API
- `submitCancelRequest(payload)` — appends a row to the `CancelRequests` sheet in the bound Google Spreadsheet
- `setupSheets()` — one-time setup to create the sheet with headers (run manually from Apps Script editor)

**`Index.html`** — Client-side single-page app (vanilla JS, no framework):
- Four screens: login → loading → submit → success, toggled by `show(id)`
- Calls server functions via `google.script.run.withSuccessHandler(...).functionName(args)`
- LINE LIFF SDK loaded from CDN; `LIFF_ID` is an empty string (fill in to enable LINE user ID capture)
- State held in a single `state` object: `{ lineUserId, teacher, sessions }`

## External Integrations

**Wise API** (`https://api.wiseapp.live`): Auth is HTTP Basic using `userId:apiKey`, plus `x-wise-namespace` and `x-api-key` headers. All credentials are in the `CONFIG` object at the top of `code.js`.

**Google Sheets**: The script must be bound to a Google Spreadsheet. `SpreadsheetApp.getActiveSpreadsheet()` references that bound sheet — no Sheet ID needed.

**LINE LIFF**: Optional. Set `LIFF_ID` in `Index.html` to capture the LINE user's ID on submit.

## Config

All configuration lives in the `CONFIG` object at the top of `code.js`:

```js
var CONFIG = {
  baseUrl, userId, apiKey, instituteId, namespace,
  daysAhead   // Wise API max range is 7 days
};
```
