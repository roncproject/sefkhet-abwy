import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests (WISH-03).
 *
 * The tests run against the production build (`vite preview`), not the dev
 * server, so they exercise the same bundle Vercel deploys. Chromium only for
 * now: the ArcGIS SDK needs WebGL2, which headless Firefox and WebKit do not
 * provide reliably.
 */
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Each browser renders the map in software WebGL, which is CPU-heavy; more
  // than two at once makes map loading slow enough to time out.
  workers: 2,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 90_000,

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // A service worker would answer fetches before page.route() sees them.
    // Only the PWA test turns it back on.
    serviceWorkers: 'block',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Software WebGL for machines and CI runners without a GPU.
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],

  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
