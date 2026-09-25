import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';
import localVercelApi from './vite/local-api.js';

const DAY = 60 * 60 * 24;

/**
 * Precache only the app shell.
 *
 * @arcgis/core is split into ~1,000 lazily loaded chunks (14 MB), most of
 * which this 2D map never requests (3D, video, editing, charts...). Precaching
 * all of them would make every install and every update download 14 MB.
 * Instead, the service worker precaches index.html, the files it references
 * directly (entry script, stylesheet), fonts and icons, and caches the SDK
 * chunks the map actually loads at runtime (see runtimeCaching below).
 */
function shellOnly(entries) {
  const html = fs.readFileSync(path.resolve('dist/index.html'), 'utf8');
  const referenced = new Set(
    [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)].map((m) => m[1]));
  const manifest = entries.filter((e) =>
    !e.url.startsWith('assets/') ||
    referenced.has(e.url) ||
    /ibm-plex-mono-latin-.*\.woff2$/.test(e.url));
  return { manifest, warnings: [] };
}

export default defineConfig(({ mode }) => {
  // Vite only loads .env values into import.meta.env for the client bundle
  // (VITE_-prefixed) and into its own config resolution — plugins and the
  // local API bridge below run in this same Node process but don't see them
  // otherwise. api/*.js reads process.env directly, exactly as Vercel does
  // in production (see api/places.js), so merge everything in .env.local
  // here too. Empty prefix: unlike import.meta.env, process.env here never
  // reaches the browser, so there is no need to restrict to VITE_.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

  return {
    plugins: [
      react(),

      // Serves /api/*.js locally exactly as Vercel will in production.
      localVercelApi(),

      // Progressive Web App: web app manifest + Workbox service worker.
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,          // registered in src/main.jsx

        manifest: {
          id: '/',
          name: 'SEKHMET.QUEST Map',
          short_name: 'SEKHMET',
          description: 'A map that opens where you are.',
          lang: 'en',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          background_color: '#ffffff',
          theme_color: '#ffffff',
          categories: ['navigation', 'travel', 'utilities'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: '/icons/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          ],
          shortcuts: [
            { name: 'About', url: '/about', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
            { name: 'Legal', url: '/legal', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
            { name: 'Contact', url: '/contact', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          ],
        },

        workbox: {
          // The app shell, the self-hosted IBM Plex Mono (Latin subsets) and
          // the icons are precached, so the installed app opens offline.
          // shellOnly() drops the SDK chunks from this list.
          globPatterns: [
            '**/*.{html,css,js,svg,png,webmanifest,txt}',
            '**/ibm-plex-mono-latin-*.woff2',
          ],
          manifestTransforms: [shellOnly],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
          clientsClaim: true,

          runtimeCaching: [
            {
              // Location answers are per visitor and must never come from a cache.
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly',
            },
            {
              // SDK chunks bundled with the app. File names contain a content
              // hash, so cache-first is always correct. After the map has loaded
              // once, it can load again without a connection.
              urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'app-chunks',
                expiration: { maxEntries: 400, maxAgeSeconds: 60 * DAY },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              // ArcGIS SDK workers, translations and styles. URLs contain the
              // exact SDK version, so a cached copy never goes stale.
              urlPattern: ({ url }) => url.hostname === 'js.arcgis.com',
              handler: 'CacheFirst',
              options: {
                cacheName: 'arcgis-sdk-assets',
                expiration: { maxEntries: 250, maxAgeSeconds: 30 * DAY },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              // Map tiles the user has already looked at, so recently viewed
              // areas still draw when the connection drops. Bounded and short
              // lived, in line with the OpenStreetMap tile usage policy.
              urlPattern: ({ url }) => url.hostname === 'tile.openstreetmap.org',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'osm-tiles',
                expiration: { maxEntries: 600, maxAgeSeconds: 7 * DAY },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
        },

        devOptions: { enabled: false },  // test the service worker with build + preview
      }),
    ],

    server: { port: 5173, strictPort: false },
    preview: { port: 4173, strictPort: false },

    build: {
      target: 'es2022',
      sourcemap: false,
      // @arcgis/core is split into many lazily loaded chunks; a few are large.
      chunkSizeWarningLimit: 3000,
    },
  };
});
