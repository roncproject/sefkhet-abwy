/**
 * The About, Legal and Contact panels: menu, direct links, Close and Back.
 */
import { test, expect } from './fixtures.js';

const panelHeading = (page, name) => page.getByRole('heading', { level: 1, name });

test.beforeEach(async ({ stubNetwork }) => {
  await stubNetwork();
});

for (const [path, title] of [['/about', 'About'], ['/legal', 'Legal'], ['/contact', 'Contact']]) {
  test(`${path} opens the ${title} panel directly`, async ({ page }) => {
    await page.goto(path);
    await expect(panelHeading(page, title)).toBeVisible();
    await expect(page).toHaveTitle(`${title} | SEFKHET-ABWY`);
  });
}

test('the menu opens a panel and Back closes it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'Legal' }).click();

  await expect(page).toHaveURL('/legal');
  await expect(panelHeading(page, 'Legal')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(panelHeading(page, 'Legal')).toBeHidden();
});

test('Close on a directly opened panel returns to the map', async ({ page }) => {
  await page.goto('/about');
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page).toHaveURL('/');
  await expect(panelHeading(page, 'About')).toBeHidden();
  await expect(page).toHaveTitle('SEFKHET-ABWY Map');
});
