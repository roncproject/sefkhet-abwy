/**
 * Shared test setup: stubs for everything the app fetches from the network,
 * so the tests are fast, repeatable and never load OpenStreetMap's servers.
 *
 * The ArcGIS SDK's own assets (js.arcgis.com) are not stubbed; they are
 * versioned static files and the map cannot start without them.
 */
import fs from 'node:fs';
import { test as base, expect } from '@playwright/test';

/** Hotel New York, Rotterdam: the test device position. */
export const DEVICE = { latitude: 51.9054, longitude: 4.4874, accuracy: 20 };

/** What /api/geo answers when the IP lookup works. */
export const IP_GEO = {
  available: true, source: 'ip', latitude: 52.3676, longitude: 4.9041,
  city: 'Amsterdam', region: 'NH', country: 'NL',
};

export const PLACES = [
  { id: 1, name: 'Hotel New York', kind: 'restaurant', latitude: 51.9054, longitude: 4.4874 },
  { id: 2, name: 'Museum Boijmans Van Beuningen', kind: 'museum', latitude: 51.9144, longitude: 4.4728 },
];

// Any valid PNG will do as a map tile; the app icon is already in the repo.
const TILE = fs.readFileSync(new URL('../public/icons/icon-192.png', import.meta.url));

export const test = base.extend({
  /**
   * Installs the network stubs on the browser context, so requests made by the
   * service worker are stubbed too. Call before page.goto():
   *
   *   const net = await stubNetwork({ geo: IP_GEO });
   *
   * `geo` is the /api/geo answer (default: no IP location).
   * `places` is the /api/places answer (default: PLACES).
   * Returns `placesRequests`, the parsed lat/lon of every /api/places call.
   */
  stubNetwork: async ({ context }, use) => {
    await use(async ({ geo = { available: false, source: 'ip' }, places = PLACES } = {}) => {
      const placesRequests = [];

      await context.route('https://tile.openstreetmap.org/**', (route) =>
        route.fulfill({ contentType: 'image/png', body: TILE }));

      await context.route('**/api/geo', (route) => route.fulfill({ json: geo }));

      await context.route('**/api/places?*', (route) => {
        const url = new URL(route.request().url());
        placesRequests.push({
          lat: Number(url.searchParams.get('lat')),
          lon: Number(url.searchParams.get('lon')),
        });
        return route.fulfill({ json: { places } });
      });

      return { placesRequests };
    });
  },
});

/** The map has finished loading when its controls appear. */
export async function waitForMap(page) {
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible({ timeout: 60_000 });
}

export { expect };
