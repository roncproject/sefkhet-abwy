/**
 * local-api.js — runs the Vercel Functions in /api inside Vite, locally.
 *
 * On Vercel, every file in /api becomes a Function automatically. Locally,
 * `npm run dev` and `npm run preview` only serve the front end, so without
 * this plugin /api/geo would fall through to index.html. The plugin loads
 * the same files Vercel deploys and calls their exported GET/POST/... handler
 * with a standard Web Request, so local behaviour matches production without
 * needing the Vercel CLI or a Vercel account.
 *
 * Testing the IP fallback locally
 * ───────────────────────────────
 * Vercel's x-vercel-ip-* headers do not exist on localhost. To simulate them,
 * set MOCK_IP_LOCATION before starting Vite:
 *
 *   PowerShell:  $env:MOCK_IP_LOCATION = "51.9225,4.4792,Rotterdam,NL"
 *   cmd.exe:     set MOCK_IP_LOCATION=51.9225,4.4792,Rotterdam,NL
 *
 * Format: latitude,longitude[,city[,country]]. Unset it to test the "no IP
 * location" path.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

function mockGeoHeaders(headers) {
  const raw = process.env.MOCK_IP_LOCATION;
  if (!raw || headers.has('x-vercel-ip-latitude')) return;
  const [lat, lon, city, country] = raw.split(',').map((s) => s.trim());
  if (lat) headers.set('x-vercel-ip-latitude', lat);
  if (lon) headers.set('x-vercel-ip-longitude', lon);
  if (city) headers.set('x-vercel-ip-city', encodeURIComponent(city));
  if (country) headers.set('x-vercel-ip-country', country);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
    req.on('error', reject);
  });
}

function createMiddleware(root) {
  return async function localApi(req, res, next) {
    const url = new URL(req.url, 'http://localhost');
    const match = url.pathname.match(/^\/api\/([A-Za-z0-9_-]+)\/?$/);
    if (!match) return next();

    const send = (status, obj) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(obj));
    };

    const file = path.join(root, 'api', `${match[1]}.js`);
    if (!fs.existsSync(file)) return send(404, { error: 'Not found' });

    try {
      // The modification time in the query string re-imports the file after
      // an edit, so changes to /api are picked up without restarting Vite.
      const version = fs.statSync(file).mtimeMs;
      const mod = await import(`${pathToFileURL(file).href}?v=${version}`);

      const method = (req.method || 'GET').toUpperCase();
      const handler = mod[method] || (method === 'HEAD' ? mod.GET : null) || mod.default?.fetch;
      if (typeof handler !== 'function') {
        res.setHeader('Allow', METHODS.filter((m) => typeof mod[m] === 'function').join(', '));
        return send(405, { error: 'Method not allowed' });
      }

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
      }
      mockGeoHeaders(headers);

      const hasBody = !['GET', 'HEAD'].includes(method);
      const request = new Request(url, {
        method,
        headers,
        body: hasBody ? await readBody(req) : undefined,
      });

      const response = await handler(request);
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      console.error(`[local-api] /api/${match[1]} failed:`, err);
      send(500, { error: 'Function error', detail: String(err?.message || err) });
    }
  };
}

export default function localVercelApi() {
  return {
    name: 'local-vercel-api',
    configureServer(server) {
      server.middlewares.use(createMiddleware(server.config.root));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware(server.config.root));
    },
  };
}
