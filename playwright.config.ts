import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5181/turnier/',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    locale: 'de-DE',
  },
  webServer: {
    command: 'npx vite build && npx vite preview',
    url: 'http://localhost:5181/turnier/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
