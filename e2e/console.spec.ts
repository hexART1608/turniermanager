// Keine Konsolenfehler (z. B. CSP-Verstöße) in Steuerung und Beamer
import { expect, test } from '@playwright/test';

test('keine Konsolen- oder CSP-Fehler', async ({ page, context }) => {
  const errors: string[] = [];
  const watch = (p: typeof page) => {
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('pageerror', e => errors.push(String(e)));
  };
  watch(page);
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const g = page.getByPlaceholder('Name (Geübte) + Enter');
  await g.fill('A1, A2');
  await g.press('Enter');
  const h = page.getByPlaceholder('Name (Gäste) + Enter');
  await h.fill('B1, B2');
  await h.press('Enter');
  await page.getByRole('button', { name: 'Turnier starten' }).click();
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  await page.getByRole('button', { name: /Runde 1 starten/ }).click();
  await page.getByRole('button', { name: /^Start/ }).click();
  await page.getByRole('button', { name: 'Töne einstellen' }).click();
  await page.getByRole('button', { name: 'Testen' }).first().click();
  await page.getByRole('button', { name: 'Fertig' }).click();
  const beamer = await context.newPage();
  watch(beamer);
  await beamer.goto('./#/beamer');
  await expect(beamer.locator('.cno')).toHaveCount(1);
  await expect(beamer.locator('.bn').first()).toHaveCSS('font-family', /Barlow Condensed/);
  const fontsOk = await beamer.evaluate(async () => { await document.fonts.ready; return document.fonts.check('800 40px "Barlow Condensed"'); });
  expect(fontsOk).toBe(true);
  await page.getByRole('button', { name: /^Pause/ }).click();
  expect(errors).toEqual([]);
});

test('Beamer-Knopf öffnet das Fenster mit der Großanzeige', async ({ page }) => {
  await page.goto('./');
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Beamer', exact: true }).click();
  const win = await popup;
  await expect(win.locator('.bhead')).toBeVisible();
  expect(win.url()).toContain('#/beamer?view=auto');
  await win.screenshot({ path: 'test-results/live-beamer.png' });
});
