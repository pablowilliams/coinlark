import { defineConfig, devices } from '@playwright/test';

const PORT = 5193;

/** Performance measurements (feed virtualisation, web vitals). Serial, desktop Chromium, production build. */
export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/perf.spec.ts'],
  workers: 1,
  timeout: 600_000,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    baseURL: `http://localhost:${PORT}/`,
  },
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
