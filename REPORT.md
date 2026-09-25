# Rewrite report

**From:** `sekhmet-react` v4 — React 18 front end served by a Java 17 / Spring Boot 3.2
application with PostgreSQL, built into a Docker image and deployed to AWS Elastic Beanstalk.

**To:** `sekhmet-vercel` v5 — a static React 19 / Vite build on Vercel's CDN, two small
Vercel Functions, one ArcGIS map centred on the device's own location, an installable PWA.

---

## 1. What the brief asked for, and where it landed

| Requirement | Where it is |
|---|---|
| Serve itself from Vercel | `vercel.json`, static `dist/` + `api/` Functions |
| Remove Java 17 / Spring Boot, replace with something Vercel-compatible | `api/geo.js`, `api/health.js` (Node.js Functions, Web-standard handlers) |
| Strip everything except the ArcGIS map | Seven pages, two languages, newsletter, REST API, database and restaurant layer removed |
| Location by GPS / web locator | `src/location/useDeviceLocation.js` — three sources, best wins |
| Map appears centred on the device | `src/components/MapCanvas.jsx` — the map is built only once a position exists |
| Hamburger menu, top right: About, Legal, Contact | `src/components/TopBar.jsx`, content in `src/content.jsx` |
| Black on white, IBM Plex Mono or similar | `src/styles.css`, font self-hosted via `@fontsource/ibm-plex-mono` |
| Testable locally on Windows 11 | `npm run dev` / `npm run preview`, plus `vite/local-api.js` so `/api/*` works locally too |
| Progressive Web App | `vite-plugin-pwa` (manifest + Workbox service worker), new icons |
| Downloadable source, report, manual | This archive, this file, `MANUAL.md` |

---

## 2. What was removed

The old repository had 86 files. Everything below is gone:

- **The whole Java backend** — `pom.xml`, `SekhmetApplication`, `SpaController`, `RouteMeta`,
  the `User` and `Restaurant` entities, repositories, services, the three REST controllers,
  the JUnit test, Flyway migration `V1__create_schema.sql`, `application.properties`.
- **PostgreSQL**, Spring Data JPA, Actuator, Thymeleaf leftovers.
- **Container and AWS deployment**: `Dockerfile`, `docker-compose.yml`, `Dockerrun.aws.json`,
  `.ebextensions/*`, `.dockerignore`, the GitHub Actions workflow that deployed to Elastic Beanstalk.
- **Front-end features**: Home page, About/Privacy in two languages, the EN/CN language switcher,
  the newsletter subscribe form, the footer and its colophon, the ASCII rule component,
  the client-side SEO module and the built `src/main/resources/static/` bundle.
- **The restaurants feature around the map**: the Esri Netherlands "Eten en Drinken" FeatureLayer,
  the Rotterdam municipality filter, the venue list, the search box and the popup template.

### One judgement call

"Keep the ArcGIS map" was read as *the map*, not *the restaurant finder that used a map*. The
FeatureLayer, the search and the venue list are therefore gone. If you want that layer back, it is
roughly fifteen lines in `MapCanvas.jsx`: import `@arcgis/core/layers/FeatureLayer.js`, construct it
with the old service URL and `definitionExpression`, and add it to the map's `layers` array. The old
code is in the archive you supplied, in `frontend/src/pages/Restaurants.jsx`.

---

## 3. What replaced Spring Boot

The Java layer did three things: serve the React shell, inject per-route SEO metadata, and expose a
REST API over PostgreSQL. With the database features stripped, only the first was still needed by the
map — and **the map never called the backend at all**. It talks to Esri and OpenStreetMap directly.
So the replacement is mostly "nothing": Vercel's CDN serves the built files, and `vercel.json` rewrites
unknown paths to `index.html` so `/about`, `/legal` and `/contact` survive a reload or a shared link.

Two Node.js Functions remain, in `/api`, using the Web-standard `export function GET(request)` signature
that Vercel supports for non-framework projects:

- **`/api/geo`** — reads Vercel's `x-vercel-ip-*` request headers and returns a city-level position.
  Nothing is looked up, stored or logged; the values are echoed from the request. The response carries
  `Cache-Control: private, no-store`, because a cached answer would hand one visitor another visitor's
  city. When the headers are absent — locally, or on a plan or region that does not supply them — it
  answers `{ "available": false }` and the app moves on to its default centre.
- **`/api/health`** — replaces Spring Boot Actuator's `/actuator/health` for uptime monitors.

`vite/local-api.js` loads those same two files inside Vite's dev and preview servers and calls them with
a real `Request`, so local behaviour matches production without the Vercel CLI. Set `MOCK_IP_LOCATION`
to simulate the IP headers locally (see MANUAL.md § 4).

---

## 4. The map: a deliberate version jump

The old page loaded ArcGIS 4.30 from a CDN `<script>` tag and used the AMD `require()` loader with the
`Home`, `ScaleBar`, `Expand` and `Legend` widgets.

**Esri deprecated both of those at SDK 5.0 (February 2026) and plans to remove them at 6.0, as early as
Q1 2027.** Carrying that code forward would have shipped a known expiry date. This rewrite therefore:

- bundles **`@arcgis/core` 5.1** from npm, pinned in `package-lock.json`, instead of a floating CDN tag;
- uses **only the core API** — `Map`, `MapView`, `WebTileLayer`, `GraphicsLayer`, `Graphic`, `Point`,
  `Circle` — none of which is deprecated;
- draws **its own controls** (locate, zoom in, zoom out) as plain buttons, which also makes them match
  the black-and-white design instead of fighting Esri's default styling;
- keeps the original's no-login strategy: no API key, `basemap` built from a plain `WebTileLayer`
  pointed at `tile.openstreetmap.org`, so no Esri credentials are needed at any point.

The SDK modules are imported dynamically, so the top bar, menu and panels are interactive before the
map code arrives.

---

## 5. How the location works

Three sources run in parallel, and the best answer wins:

1. **Device** — `navigator.geolocation.watchPosition` with `enableHighAccuracy`. The operating system
   decides how to answer: GPS on a phone, Wi-Fi positioning on a laptop, cell towers, or a mix. Needs
   permission and a secure context. Drawn as a **solid dot inside a circle showing the reported accuracy**.
2. **Network** — `/api/geo`, answering in milliseconds with a city-level position. Drawn as a
   **hollow ring**, because it is an estimate and is wrong behind a VPN.
3. **Default** — Rotterdam, the original app's centre, used only when neither answers within five seconds.

The map is not created until one of them has answered, so it opens *at* the right place rather than
flying there from somewhere else. If the device fix arrives later (the permission prompt takes as long
as the user takes), the map animates to it — unless the user has already started panning, in which case
it leaves them alone and waits for the locate button.

The readout in the bottom-left corner always says which of the three you are looking at, and how far to
trust it: `Device location, within 18 m`, or `Approximate, from your internet connection (Rotterdam, NL)`.
When location is refused or unavailable it explains what to do about it — including the Windows-specific
case, where the browser is allowed but the system Location service is off.

---

## 6. Design

The brief fixed the palette and the typeface, so the decisions left were structural.

- **Two colours only.** `#000000` on `#ffffff`. No greys standing in for hierarchy: size, weight and
  2px rules do that work. Hover states invert to black-on-white rather than tinting.
- **One typeface, IBM Plex Mono**, self-hosted from npm (SIL Open Font License) rather than pulled from
  Google Fonts — one fewer third party, and it renders offline. Latin and Latin-Extended subsets are
  precached; the browser fetches only the subset it needs. Fallbacks are Windows-first:
  `ui-monospace, 'Cascadia Mono', Consolas, 'Courier New'`.
- **The coordinate readout is the one loud element.** 18px, 600 weight, tabular figures, in a bordered
  slab pinned to the map — a survey tag. Everything else is quiet: 2px frames, no shadows, no radii,
  no accent colour.
- **One piece of motion**: a blinking block cursor while locating. Everything else animates only in
  response to an action (menu opening, map recentring), and `prefers-reduced-motion` turns it all off.
- The map's own attribution is restyled into IBM Plex Mono so it reads as part of the design rather than
  as a widget bolted on.

Accessibility: 44px minimum touch targets, visible focus rings (black outline on a white halo, so they
show against both the map and inverted buttons), the menu is a disclosure pattern with Escape and
click-outside handling and focus returning to the button, the panel moves focus to its heading, live
regions announce location changes, and the map container carries keyboard instructions.

---

## 7. Progressive Web App

`vite-plugin-pwa` generates the manifest and a Workbox service worker. New icons were drawn for this
version in the app's own typeface: 192, 512, a separate maskable 512 with a 20 % safe zone, an
apple-touch icon, and an SVG favicon.

The interesting decision is **what not to precache**. `@arcgis/core` builds into roughly a thousand
lazily loaded chunks totalling 14 MB, most of which a 2D map never requests — 3D, video layers, editing
tools, charts. Precaching the lot would have made every install and every update download 14 MB. Instead
`shellOnly()` in `vite.config.js` reduces the precache to the shell: **23 entries, 364 KB** (HTML, entry
script, stylesheet, fonts, icons, manifest). The SDK chunks that the map actually loads are cached at
runtime on first use, hashed and therefore cache-first forever. Map tiles get a bounded, seven-day
stale-while-revalidate cache, in line with the OpenStreetMap tile usage policy, so recently viewed areas
still draw when the connection drops. `/api/*` is never cached.

---

## 8. What was verified

Tested in Chromium (headless, with the ArcGIS CDN assets and OSM tiles served from local copies, since
this build environment has no route to those hosts):

- Map builds and centres on a simulated device position with the accuracy circle drawn, with no console
  errors and no SDK deprecation warnings.
- Permission-refused path: map opens on the `/api/geo` position, hollow ring, and the readout explains
  how to re-enable location.
- Full fallback path (no IP headers, permission refused): Rotterdam after ~4 s, with an explanation.
- Menu opens and closes, keyboard and pointer, focus returns to the button; About/Legal/Contact open,
  Escape and Close dismiss them, Back behaves, `document.title` follows.
- Deep links `/about`, `/legal`, `/contact` load directly, in dev and in preview.
- `/api/geo` returns real values from mocked Vercel headers, `{available:false}` without them;
  `/api/health` answers; an unknown `/api/*` path gives a 404 rather than the HTML shell.
- Service worker installs and takes control; **offline reload works** — shell, map code and deep links
  all load from cache with the network switched off.
- Mobile viewport (390×844) layout, and the self-hosted font actually loading (`document.fonts.check`).
- First load costs about **1.0 MB gzipped** (3.3 MB uncompressed) across 271 files; repeat visits are
  served from cache.

### Not verifiable here, please check once deployed

1. **Real map tiles and real basemap rendering.** This sandbox cannot reach `tile.openstreetmap.org` or
   `js.arcgis.com`, so tiles were stubbed. The code paths are exercised, but the first thing to do after
   deploying is confirm that real tiles draw.
2. **Vercel's `x-vercel-ip-*` headers on your plan and region.** If they are not supplied, `/api/geo`
   returns `{available:false}` and the app degrades to the default centre — no error, just a less useful
   first frame.
3. **Real GPS accuracy** on an actual phone, and the iOS install flow (Share → Add to Home Screen).
4. **Cross-origin runtime caching** of SDK assets and tiles. It is configured and the same-origin part
   was proven offline, but the cross-origin part could not be exercised behind the test harness.

---

## 9. Things to decide before this goes public

- **The Legal page is written, not lawyered.** It describes what the app actually does — location stays
  on the device, no cookies, no analytics, third parties are Vercel, Esri and the OSM Foundation, with
  attribution and a no-warranty clause. For a live EU-facing site you will want to add the controller's
  legal identity and address, and have someone qualified read it.
- **E-mail addresses** `hello@sekhmet.quest` and `privacy@sekhmet.quest` are carried over from the old
  site. Confirm they still receive mail.
- **OpenStreetMap tiles** are fine at this scale, but their usage policy expects heavy consumers to move
  to their own tile source or a commercial provider. If this gets traffic, switch the `urlTemplate` in
  `src/components/arcgis.js`.
- **Content-Security-Policy** is deliberately not set. The ArcGIS SDK needs `wasm-unsafe-eval` plus
  `blob:` workers, and a wrong CSP silently breaks the map. It can be added to `vercel.json` later,
  tested against a preview deployment first.
- The old site's server-rendered per-route SEO is gone with the Java layer. For a one-screen app that
  is a fair trade; if you want it back, the Vite build can prerender the three panel routes.
