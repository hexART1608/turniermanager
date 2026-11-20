// Bildschirmfotos zur Sichtprüfung (SHOTS=1 npx playwright test shots)
import { test } from '@playwright/test';

const OUT = process.env.SHOTS_DIR ?? 'test-results/shots';

test.skip(!process.env.SHOTS, 'nur auf Anfrage');

test('Ansichten fotografieren', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.screenshot({ path: `${OUT}/01-setup-leer.png`, fullPage: true });
  const g = page.getByPlaceholder('Name (Geübte) + Enter');
  await g.fill('Marc, Anne, Jonas, Lea, Tim, Sophie');
  await g.press('Enter');
  const h = page.getByPlaceholder('Name (Gäste) + Enter');
  await h.fill('Ben, Clara, David, Emma, Finn, Greta, Hanna, Igor');
  await h.press('Enter');
  await page.screenshot({ path: `${OUT}/02-setup-voll.png`, fullPage: true });
  await page.getByRole('button', { name: 'Turnier starten' }).click();
  await page.screenshot({ path: `${OUT}/03-start-dialog.png` });
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  await page.screenshot({ path: `${OUT}/04-bereit.png`, fullPage: true });
  await page.getByRole('button', { name: /Runde 1 starten/ }).click();
  await page.getByRole('button', { name: /^Sieg für/ }).first().click();
  await page.screenshot({ path: `${OUT}/05-runde1.png`, fullPage: true });
  const beamer = await context.newPage();
  await beamer.setViewportSize({ width: 1920, height: 1080 });
  await beamer.goto('./#/beamer');
  await page.bringToFront();
  await page.keyboard.press('Space');
  await page.waitForTimeout(1500);
  await beamer.screenshot({ path: `${OUT}/06-beamer.png` });
  await page.getByRole('button', { name: /Runde 2 starten/ }).click();
  await page.getByRole('button', { name: 'Starten', exact: true }).click();
  await page.getByRole('button', { name: /^Sieg für/ }).nth(1).click();
  await page.getByRole('button', { name: /^Sieg für/ }).nth(2).click();
  await page.getByRole('button', { name: 'Rangliste' }).first().click();
  await page.screenshot({ path: `${OUT}/07-rangliste.png`, fullPage: true });
  await beamer.goto('./#/beamer?view=ranking');
  await beamer.screenshot({ path: `${OUT}/08-beamer-rangliste.png` });
  await page.getByRole('button', { name: 'Spielbetrieb' }).click();
  await page.getByRole('button', { name: 'Turnier beenden' }).click();
  await page.getByRole('button', { name: 'Zur Siegerehrung' }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/09-siegerehrung.png`, fullPage: true });
  await beamer.waitForTimeout(1600);
  await beamer.screenshot({ path: `${OUT}/10-beamer-sieger.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Weiterspielen' }).click();
  await page.screenshot({ path: `${OUT}/11-handy.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Helles Design' }).click();
  await page.screenshot({ path: `${OUT}/12-hell.png`, fullPage: true });
});
