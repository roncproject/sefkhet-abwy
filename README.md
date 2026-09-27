# SEFKHET-ABWY Map

A web map that opens centred on your location and shows public places nearby.
It is a Progressive Web App: it can be installed on a phone or desktop and keeps
working with a weak connection.

## What it does

- Asks the browser for the device position (GPS, Wi-Fi or cell) and centres the map on it.
- Shows an approximate position from the visitor's IP address while waiting, or when
  location access is refused. Falls back to Rotterdam if neither is available.
- Marks public places within 2 km of the map centre, loaded from a Supabase database.
- Has About, Legal and Contact panels, each with its own URL.
- Stores no accounts, cookies or analytics. The position stays in the browser.

## Stack

| Layer | Technology |
|---|---|
| Front end | React 19, Vite 8 |
| Map | ArcGIS Maps SDK for JavaScript 5.1, core API only, no API key |
| Map tiles | OpenStreetMap |
| Back end | Vercel Functions in `api/` |
| Data | Supabase (Postgres), read server-side only |
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

The API functions also run locally, inside Vite. To simulate the IP-based position,
set `MOCK_IP_LOCATION` before starting, for example
`$env:MOCK_IP_LOCATION = "51.9225,4.4792,Rotterdam,NL"`.

## Configuration

| Variable | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL` | `api/places.js` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | `api/places.js` | Secret key, server-side only |
| `MOCK_IP_LOCATION` | local development | Fake IP position, `lat,lon[,city[,country]]` |

The database needs a `places_near(lat, lon, radius_m)` function that returns only
public places.

## API

| Endpoint | Returns |
|---|---|
| `GET /api/geo` | Approximate position from the visitor's IP (Vercel headers) |
| `GET /api/places?lat=..&lon=..` | Public places within 2 km |
| `GET /api/health` | Status, region and environment |

## Layout

```
api/            Vercel Functions: geo, places, health
public/         icons, robots.txt
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
