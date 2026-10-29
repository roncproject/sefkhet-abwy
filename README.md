# SEFKHET-ABWY Map

A web map that opens centred on your location and shows the Dutch national monuments
(rijksmonumenten) nearby.
It is a Progressive Web App: it can be installed on a phone or desktop and keeps
working with a weak connection.

## What it does

- Asks the browser for the device position (GPS, Wi-Fi or cell) and centres the map on it.
- Shows an approximate position from the visitor's IP address while waiting, or when
  location access is refused. Falls back to Rotterdam if neither is available.
- From street level (zoom 14) inward, marks the rijksmonumenten within 2 km of the map
  centre, up to 300, loaded from a Supabase database. Tapping one shows its name or type,
  address and a link to the official register.
- Has About, Legal and Contact panels, each with its own URL.
- Stores no accounts, cookies or analytics. Only the map centre is sent to the server,
  to look up monuments.

## Stack

| Layer | Technology |
|---|---|
| Front end | React 19, Vite 8 |
| Map | ArcGIS Maps SDK for JavaScript 5.1, core API only, no API key |
| Map tiles | OpenStreetMap |
| Back end | Vercel Functions in `api/` |
| Data | Supabase (Postgres + PostGIS), read server-side only |
| Monuments | Rijksdienst voor het Cultureel Erfgoed, via PDOK and RCE Linked Data (CC BY 4.0) |
| PWA | Web app manifest, Workbox service worker (`vite-plugin-pwa`) |
| Hosting | Vercel |

## Getting started

Requires Node.js 24 (see `.nvmrc`; at least 20.19).

```powershell
npm install
copy .env.example .env.local   # then fill in the Supabase values
npm run dev                     # http://localhost:5173
```

| Command | Result |
|---|---|
| `npm run dev` | Development server with live reload |
| `npm run build` | Production build in `dist/` |
| `npm run preview` | Serves the build, with the service worker, on port 4173 |
| `npm run test:e2e` | Builds the app and runs the Playwright end-to-end tests in `e2e/` |
| `npm run import:monuments` | Syncs the monuments table with the register (`-- --dry-run` writes nothing) |

The end-to-end tests need Chromium once: `npx playwright install chromium`. They
also run on GitHub Actions for every push and pull request to `main`.

The API functions also run locally, inside Vite. To simulate the IP-based position,
set `MOCK_IP_LOCATION` before starting, for example
`$env:MOCK_IP_LOCATION = "51.9225,4.4792,Rotterdam,NL"`.

## Configuration

| Variable | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL` | `api/places.js`, import script | Supabase project URL |
| `SUPABASE_SECRET_KEY` | `api/places.js`, import script | Secret key, server-side only |
| `MOCK_IP_LOCATION` | local development | Fake IP position, `lat,lon[,city[,country]]` |

## Monument data

The database schema is in `supabase/schema.sql`: run it once in the Supabase SQL
Editor. It creates the `monuments` table and the `monuments_near` function that
`/api/places` calls.

`scripts/import-monuments.js` fills the table. It reads the current register from the
PDOK WFS, adds names, addresses and types from the RCE Linked Data SPARQL endpoint,
upserts every monument and deletes the ones no longer in the register. If it finds
fewer than 95% of the monuments already stored, it deletes nothing. A full run takes
about a minute.

## API

| Endpoint | Returns |
|---|---|
| `GET /api/geo` | Approximate position from the visitor's IP (Vercel headers) |
| `GET /api/places?lat=..&lon=..` | Rijksmonumenten within 2 km, nearest first, at most 300 |
| `GET /api/health` | Status, region and environment |

## Layout

```
api/            Vercel Functions: geo, places (monuments), health
public/         icons, robots.txt
scripts/        import-monuments.js
supabase/       schema.sql
src/
  App.jsx       top-level layout and URL handling
  content.jsx   About, Legal and Contact text
  components/   map, top bar, panels, location readout
  location/     device, IP and default position logic
vite/           runs api/ locally during development
vercel.json     routing, security headers, caching
```

## Deployment

With the GitHub repository connected to Vercel, each push deploys. Set the Supabase
variables in the Vercel project settings. Step-by-step instructions are in
[MANUAL.md](MANUAL.md).
