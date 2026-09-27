/**
 * The parts around the app: the server functions and the PWA install files.
 */
import { test, expect } from './fixtures.js';

test('/api/health answers UP', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBe(true);
  expect(await res.json()).toMatchObject({ status: 'UP' });
});

test('/api/geo answers without an IP position when Vercel headers are missing', async ({ request }) => {
  const res = await request.get('/api/geo');
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ available: false, source: 'ip' });
});

test.describe('installable app', () => {
  test.use({ serviceWorkers: 'allow' });

  test('serves the manifest and registers the service worker', async ({ page, request, stubNetwork }) => {
    await stubNetwork();
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({ name: 'SEFKHET-ABWY Map', short_name: 'SEFKHET', start_url: '/' });

    await page.goto('/');
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(scope).toBe(new URL('/', page.url()).href);
  });
});
