/**
 * The map itself: the nearby-places lookup and the map controls.
 *
 * Map symbols are drawn in a WebGL canvas and cannot be inspected in the DOM,
 * so these tests observe the /api/places requests the map makes each time it
 * settles. The request carries the map centre, which makes it the place to
 * catch swapped latitude and longitude.
 */
import { test, expect, waitForMap, DEVICE } from './fixtures.js';

test.use({ permissions: ['geolocation'], geolocation: DEVICE });

test('asks for nearby places at the map centre, latitude and longitude in order', async ({ page, stubNetwork }) => {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  const { placesRequests } = await stubNetwork();
  await page.goto('/');
  await waitForMap(page);

  await expect.poll(() => placesRequests.length).toBeGreaterThan(0);
  const { lat, lon } = placesRequests[0];
  expect(lat).toBeCloseTo(DEVICE.latitude, 4);
  expect(lon).toBeCloseTo(DEVICE.longitude, 4);

  expect(errors.filter((e) => e.includes('nearby places'))).toEqual([]);
});

test('zoom in and zoom out move the map', async ({ page, stubNetwork }) => {
  const { placesRequests } = await stubNetwork();
  await page.goto('/');
  await waitForMap(page);
  await expect.poll(() => placesRequests.length).toBeGreaterThan(0);

  // Every time the view settles after a change, the map asks for places again.
  let before = placesRequests.length;
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => placesRequests.length).toBeGreaterThan(before);

  before = placesRequests.length;
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect.poll(() => placesRequests.length).toBeGreaterThan(before);
});

test('"Centre on my location" returns to the device position after panning', async ({ page, stubNetwork }) => {
  const { placesRequests } = await stubNetwork();
  await page.goto('/');
  await waitForMap(page);
  await expect.poll(() => placesRequests.length).toBeGreaterThan(0);

  // Drag the map away.
  const box = await page.getByRole('application', { name: 'Map centred on your location' }).boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  let before = placesRequests.length;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 300, y - 200, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => placesRequests.length).toBeGreaterThan(before);
  expect(placesRequests.at(-1).lon).not.toBeCloseTo(DEVICE.longitude, 3);

  before = placesRequests.length;
  await page.getByRole('button', { name: 'Centre on my location' }).click();
  await expect.poll(() => placesRequests.length).toBeGreaterThan(before);
  await expect.poll(() => placesRequests.at(-1).lon).toBeCloseTo(DEVICE.longitude, 4);
  expect(placesRequests.at(-1).lat).toBeCloseTo(DEVICE.latitude, 4);
});
