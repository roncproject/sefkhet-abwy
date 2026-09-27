/**
 * Where the map opens: device position first, IP position second,
 * Rotterdam when neither is available (src/location/useDeviceLocation.js).
 */
import { test, expect, waitForMap, DEVICE, IP_GEO } from './fixtures.js';

const readout = (page) => page.getByRole('region', { name: 'Your position' });

test.describe('device position allowed', () => {
  test.use({ permissions: ['geolocation'], geolocation: DEVICE });

  test('opens on the device position', async ({ page, stubNetwork }) => {
    await stubNetwork();
    await page.goto('/');
    await waitForMap(page);

    await expect(readout(page)).toContainText('51.90540° N');
    await expect(readout(page)).toContainText('4.48740° E');
    await expect(readout(page)).toContainText('Device location, within 20 m');
  });
});

test.describe('device position refused', () => {
  test.use({ permissions: [] });

  test('uses the IP position when /api/geo has one', async ({ page, stubNetwork }) => {
    await stubNetwork({ geo: IP_GEO });
    await page.goto('/');
    await waitForMap(page);

    await expect(readout(page)).toContainText('52.36760° N');
    await expect(readout(page)).toContainText('4.90410° E');
    await expect(readout(page)).toContainText('Approximate, from your internet connection (Amsterdam, NL)');
  });

  test('falls back to Rotterdam when there is no position at all', async ({ page, stubNetwork }) => {
    await stubNetwork();
    await page.goto('/');
    await waitForMap(page);

    await expect(readout(page)).toContainText('Location unavailable. Showing Rotterdam.');
    await expect(readout(page)).toContainText('Location access is blocked for this site.');
  });
});
