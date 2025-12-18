/// <reference types="node" />

import { defineConfig, devices } from '@playwright/test';

const isDemo = process.env.E2E_DEMO === '1' || process.env.E2E_DEMO === 'true';
const slowMo = isDemo ? Number(process.env.E2E_SLOWMO ?? 300) : 0;

const viewportWidth = Number(process.env.E2E_VIEWPORT_WIDTH ?? 1920);
const viewportHeight = Number(process.env.E2E_VIEWPORT_HEIGHT ?? 1080);
const deviceScaleFactor = Number(process.env.E2E_DEVICE_SCALE_FACTOR ?? 1);

export default defineConfig({
  testDir: './tests',
  fullyParallel: !isDemo,
  workers: isDemo ? 1 : undefined,
  timeout: isDemo ? 180_000 : 60_000,
  expect: { timeout: isDemo ? 30_000 : 10_000 },

  // Paths are relative to this config file (apps/web-e2e).
  outputDir: 'test-results',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4200',
    headless: process.env.E2E_HEADLESS
      ? process.env.E2E_HEADLESS === '1' || process.env.E2E_HEADLESS === 'true'
      : !isDemo,
    viewport: { width: viewportWidth, height: viewportHeight },
    actionTimeout: isDemo ? 30_000 : 10_000,
    navigationTimeout: isDemo ? 120_000 : 30_000,
    trace: isDemo ? 'on' : 'retain-on-failure',
    screenshot: isDemo ? 'on' : 'only-on-failure',
    video: isDemo
      ? { mode: 'on', size: { width: viewportWidth, height: viewportHeight } }
      : {
          mode: 'retain-on-failure',
          size: { width: viewportWidth, height: viewportHeight },
        },
    launchOptions: {
      slowMo,
      args: [
        `--force-device-scale-factor=${deviceScaleFactor}`,
        `--window-size=${viewportWidth},${viewportHeight}`,
      ],
    },
  },

  // Start dev servers for local + CI runs.
  // If you already have them running, Playwright will reuse them.
  webServer: [
    {
      command: 'pnpm -F api serve',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm -F web serve',
      port: 4200,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: viewportWidth, height: viewportHeight },
        deviceScaleFactor,
      },
    },
  ],
});
