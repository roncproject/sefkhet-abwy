# SEKHMET.QUEST Map

A single-purpose Progressive Web App: an ArcGIS map that opens centred on wherever
the device thinks it is. Black on white, IBM Plex Mono, no accounts, no database.

Rewritten from the v4 React + Java 17 / Spring Boot application that ran in a Docker
container on AWS Elastic Beanstalk. The Java backend is gone; the app is a static
Vite build plus two small Vercel Functions.

- **What changed and why:** [REPORT.md](REPORT.md)
- **How to run it on Windows 11 and deploy it to Vercel:** [MANUAL.md](MANUAL.md)

## Stack

| Layer | Technology |
|---|---|
| Front end | React 19 + Vite 8, no UI framework, no router library |
| Map | ArcGIS Maps SDK for JavaScript 5.1 (`@arcgis/core`), core API only |
| Map data | OpenStreetMap raster tiles, no API key, no ArcGIS login |
| Location | Browser Geolocation API, with an IP-based fallback from Vercel |
| Back end | Two Vercel Functions (`/api/geo`, `/api/health`) |
| PWA | Web app manifest + Workbox service worker (`vite-plugin-pwa`) |
| Type | IBM Plex Mono, self-hosted from npm |
| Hosting | Vercel (static build on the CDN + Functions) |

## Quick start

```powershell
npm install
npm run dev          # http://localhost:5173, live reload
npm run build        # production build into dist/
npm run preview      # http://localhost:4173, the build + service worker
```

Location needs a secure context, which `http://localhost` counts as. Opening the dev
server over your LAN IP from a phone will not get a position; see MANUAL.md for how to
test on a phone.

## Layout

```
sekhmet-vercel/
├── api/
│   ├── geo.js              approximate location from the visitor's IP (Vercel headers)
│   └── health.js           liveness check, replaces /actuator/health
├── public/
│   ├── icons/              app icons, black on white
│   └── robots.txt
├── src/
│   ├── main.jsx            entry point, fonts, service-worker registration
│   ├── App.jsx             map + top bar + panel, URL handling
│   ├── content.jsx         About, Legal and Contact copy
│   ├── styles.css          the whole design system, ~350 lines
│   ├── components/
│   │   ├── TopBar.jsx      wordmark and the hamburger menu
│   │   ├── MapCanvas.jsx   the ArcGIS map, controls and centring logic
│   │   ├── LocationReadout.jsx  live coordinates and their provenance
│   │   ├── InfoPanel.jsx   the About / Legal / Contact sheet
│   │   └── arcgis.js       lazy loader for the SDK modules
│   └── location/
│       └── useDeviceLocation.js  GPS first, IP second, default third
├── vite/local-api.js       runs api/*.js locally, as Vercel does in production
├── vite.config.js          build, PWA and service-worker configuration
└── vercel.json             routing, headers and caching for Vercel
```

## Routes

| URL | What it is |
|---|---|
| `/` | The map |
| `/about`, `/legal`, `/contact` | The map with that panel open |
| `/api/geo` | `{ available, latitude, longitude, city, country }` |
| `/api/health` | `{ status: "UP", region, environment }` |
