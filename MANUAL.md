# Manual

How to run and test the app on a **Windows 11 PC**, and how to put it on **Vercel**.

Part 1–5: local. Part 6–9: Vercel. Part 10: troubleshooting.

---

## 1. What you need

Only Node.js. There is no Java, no Maven, no Docker and no database any more.

Open **PowerShell** and check:

```powershell
node --version     # want v22.12 or newer; v24 LTS recommended
npm --version      # comes with Node
```

If Node is missing or too old:

```powershell
winget install OpenJS.NodeJS.LTS
```

Then **close and reopen PowerShell** so the `PATH` is refreshed.

A Chromium-based browser (Edge or Chrome) is the easiest to test with, because its DevTools can
fake a GPS position and simulate being offline.

---

## 2. Install and run

Unzip the project somewhere without spaces or OneDrive sync in the path — for example `C:\dev\sekhmet-vercel`.
OneDrive folders can make file watching unreliable.

```powershell
cd C:\dev\sekhmet-vercel
npm install
npm run dev
```

Open **<http://localhost:5173>**.

The browser will ask for permission to use your location. Allow it. Within a few seconds the map
should be centred on you, with a solid dot and a circle showing how accurate the reading is.

`npm run dev` has live reload: edit a file in `src\`, save, and the browser updates. Stop the server
with `Ctrl+C`.

> **Why localhost and not your LAN IP.** Browsers only hand out location on a secure origin: HTTPS, or
> `http://localhost`. `http://192.168.x.x:5173` will silently refuse. Part 5 covers testing on a phone.

---

## 3. Test the production build and the PWA

The service worker is deliberately switched off in `npm run dev` (a stale cache during development is
maddening). To test the real thing:

```powershell
npm run build
npm run preview
```

Open **<http://localhost:4173>**. This serves exactly the files that Vercel will serve.

### Checks worth doing

**Install it.** In Edge or Chrome, an install icon appears at the right of the address bar
(or ⋯ → Apps → Install this site as an app). Install it: it should open in its own window, with
no browser chrome, showing the black-and-white "S" icon.

**Offline.** With the app open, press `F12` → **Network** tab → set throttling to **Offline** →
reload. The shell and the map code load from cache. Tiles for areas you have not visited will be
blank, which is expected. Switch back to **No throttling** and the map fills in again.

**Service worker.** `F12` → **Application** tab → **Service Workers**: `sw.js` should be
"activated and running". Under **Cache Storage** you should see `workbox-precache-v2...` (about
23 entries), plus `app-chunks` and `osm-tiles` filling up as you use the map.

**Manifest.** Same tab → **Manifest**: name, icons and the three shortcuts should all resolve
with no errors flagged.

**Lighthouse.** `F12` → **Lighthouse** → check *Progressive Web App* and *Accessibility* → analyse.

---

## 4. Test the location logic, including the fallbacks

There are three sources of position. To see each one:

### a. Device location (the normal case)

Allow the permission prompt. The readout says `Device location, within N m`.

### b. Fake a different device position

`F12` → `Ctrl+Shift+P` → type **Sensors** → **Show Sensors** → under *Location*, pick a preset city
or enter your own latitude and longitude → reload. The map should open there. Setting *Location*
to **Location unavailable** exercises the error path.

### c. The IP fallback

Block location for the site (the padlock icon in the address bar → Location → Block), then reload.
The app falls back to `/api/geo`, drawing a **hollow ring** instead of a dot, and explains in the
readout how to switch location back on.

On your own machine there are no Vercel IP headers, so `/api/geo` answers `{"available":false}` and
you get the default centre instead. To simulate the header, start the server like this:

```powershell
$env:MOCK_IP_LOCATION = "51.9225,4.4792,Rotterdam,NL"
npm run dev
```

Format: `latitude,longitude,city,country`. It works for `npm run preview` too. To clear it:

```powershell
Remove-Item Env:\MOCK_IP_LOCATION
```

Check the endpoints directly at any time:

```powershell
curl.exe http://localhost:5173/api/geo
curl.exe http://localhost:5173/api/health
```

### d. Everything fails

No permission and no IP headers: after five seconds the map opens on Rotterdam and says so.

---

## 5. Testing on a phone

A phone is the only way to see real GPS accuracy, and browsers need HTTPS there. Two options:

**Easiest — deploy a preview first.** Do Part 6, then open the preview URL Vercel gives you on the
phone. Preview deployments are HTTPS, so location and installation both work.

**Without deploying — USB port forwarding.** Connect an Android phone by USB with USB debugging on,
open `chrome://inspect` on the PC, click **Port forwarding**, map port `4173` to `localhost:4173`,
then open `http://localhost:4173` *on the phone*. The phone treats it as localhost, so it counts as
secure. Run `npm run preview` on the PC first.

On iOS, install with Safari → Share → **Add to Home Screen**.

---

## 6. Deploy to Vercel — the quick way (CLI)

Good for a first deployment, and it does not need a Git repository.

```powershell
npm install --global vercel
vercel login
cd C:\dev\sekhmet-vercel
vercel
```

The CLI asks a few questions. Accept the defaults: it reads `vercel.json`, detects Vite, builds with
`npm run build` and publishes `dist`, and turns everything in `api\` into Functions. You get a preview
URL. When it looks right:

```powershell
vercel --prod
```

To run the whole thing locally exactly as Vercel does, including the real Functions runtime:

```powershell
vercel dev
```

---

## 7. Deploy to Vercel — the durable way (Git)

Every push then deploys itself, and every pull request gets its own preview URL.

1. Put the project in a Git repository and push it to GitHub, GitLab or Bitbucket:

   ```powershell
   cd C:\dev\sekhmet-vercel
   git init
   git add .
   git commit -m "SEKHMET map: Vercel rewrite"
   git branch -M main
   git remote add origin https://github.com/<you>/sekhmet-vercel.git
   git push -u origin main
   ```

   `.gitignore` already excludes `node_modules`, `dist` and `.vercel`. **Do commit
   `package-lock.json`** — Vercel builds with `npm ci`, which requires it.

2. Go to <https://vercel.com/new>, import the repository.

3. The settings should already be filled in from `vercel.json`. Confirm them:

   | Setting | Value |
   |---|---|
   | Framework preset | Vite |
   | Build command | `npm run build` |
   | Output directory | `dist` |
   | Install command | `npm ci` |
   | Node.js version | 22.x or 24.x |

4. **Deploy.** The first build takes two to four minutes, mostly bundling the ArcGIS SDK.

No environment variables are needed. There is nothing to configure for the Functions: any file in
`api\` is deployed automatically.

---

## 8. After deploying, check these

1. Open the URL on a phone over mobile data. You should get the permission prompt and then a
   well-centred map. **Real tiles must draw** — this is the one thing that cannot be tested offline.
2. `https://<your-app>.vercel.app/api/health` → `{"status":"UP","region":"...","environment":"production"}`.
3. `https://<your-app>.vercel.app/api/geo` → your city, roughly. If it says `{"available":false}`,
   your plan or region is not supplying the geolocation headers; the app still works, it just opens
   at the default centre until the device fix arrives.
4. Reload `https://<your-app>.vercel.app/legal` directly. It must render the panel, not a 404 —
   that is the rewrite in `vercel.json` doing its job.
5. Install the app from the phone browser and open it from the home screen.

### Custom domain

Vercel dashboard → your project → **Settings** → **Domains** → add `sekhmet.quest`. Vercel shows the
DNS records to create at your registrar (usually an `A` record for the apex and a `CNAME` for `www`).
The TLS certificate is issued automatically once DNS resolves.

---

## 9. Making changes

| You changed | Do this |
|---|---|
| Text in About, Legal or Contact | `src\content.jsx` |
| Colours, spacing, type | `src\styles.css` — the tokens are at the top |
| Default map centre | `DEFAULT_CENTRE` in `src\location\useDeviceLocation.js` |
| Zoom levels per accuracy | `zoomFor()` in `src\components\MapCanvas.jsx` |
| Tile source | `createBasemap()` in `src\components\arcgis.js` |
| Menu entries | `PAGES` and `PAGE_ORDER` in `src\content.jsx` |
| App name, icons, PWA behaviour | the `manifest` block in `vite.config.js` |
| Headers, caching, redirects | `vercel.json` |

After any change: `npm run build` locally before pushing, so a build error surfaces on your machine
and not in the deployment log.

---

## 10. Troubleshooting

**The map opens in the wrong city.** You are seeing the IP estimate (hollow ring), not a device fix.
Behind a VPN this is normal. Allow location access and press the locate button.

**The permission prompt never appears.** The site was refused before and the browser remembers.
Padlock icon in the address bar → Location → *Allow*, then reload. In the address bar of Edge/Chrome
you may also see a crossed-out location pin.

**"Location unavailable" on Windows even though the browser is allowed.** Windows itself has a master
switch: **Settings → Privacy & security → Location**. Both *Location services* and *Let apps access
your location* (including desktop apps) must be on. A desktop PC with no GPS and a wired connection
may still fail — that is the case the IP fallback exists for.

**Blank white screen after `npm run dev`.** Look at the PowerShell window for the real error. Usually
Node is too old; `node --version` must be 22.12 or newer.

**`npm install` fails with permission or path errors.** Avoid paths inside OneDrive, and avoid
spaces. A path longer than 260 characters can also break installs on Windows.

**Port already in use.** Vite picks the next free port and prints it; or specify one:
`npm run dev -- --port 5180`.

**Old version keeps loading after an update.** The service worker is serving its cache. `F12` →
Application → Service Workers → **Unregister**, then hard reload (`Ctrl+F5`). In production the
service worker updates itself on the next visit, so this only bites during development.

**The map is blank but the interface works.** The browser cannot reach `js.arcgis.com` or
`tile.openstreetmap.org`. Check a corporate proxy, a firewall or an ad blocker; both hosts must be
reachable.

**Vercel build fails on `npm ci`.** `package-lock.json` is missing from the repository or out of step
with `package.json`. Run `npm install` locally, commit the updated lock file, push again.
