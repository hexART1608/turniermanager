// Echtes Scrollen mit dem Mausrad (Playwright-Klicks scrollen selbst und
// hätten eine gesperrte Seite nicht bemerkt)
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 560 } });

test('Steuerung lässt sich scrollen, Beamer nicht', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.mouse.move(300, 400);
  await page.mouse.wheel(0, 1500);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await expect(page.getByLabel('Punkte erfassen')).toBeInViewport();

  // auch nachdem das Beamer-Fenster im selben Browser offen war
  const beamer = await context.newPage();
  await beamer.goto('./#/beamer');
  expect(await beamer.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
  await page.bringToFront();
  await page.reload();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('visible');
  await page.mouse.move(300, 400);
  await page.mouse.wheel(0, 1500);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
});
