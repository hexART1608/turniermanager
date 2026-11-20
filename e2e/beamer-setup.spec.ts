// Beamer-Setup: Standard ist die einfache Anzeige; die Wahl wird gespeichert und im Beamer-Fenster übernommen.
import { expect, test } from '@playwright/test';

test('Beamer-Setup wählt das Wartebild und der Beamer folgt', async ({ page, context }) => {
  const beamer = await context.newPage();
  await beamer.goto('./#/beamer');
  await expect(beamer.locator('.wait')).toHaveAttribute('data-style', 'simple');
  await expect(beamer.locator('.soon, .ticker')).toHaveCount(0);

  await page.goto('./');
  await page.getByRole('button', { name: 'Beamer-Setup' }).click();
  const dlg = page.getByRole('dialog', { name: 'Beamer-Setup' });
  await expect(dlg.getByRole('radio')).toHaveCount(6);
  await expect(dlg.getByRole('radio', { name: 'Einfach' })).toHaveAttribute('aria-checked', 'true');

  for (const [name, key] of [['Laserfeld', 'neon'], ['Ballwechsel', 'rally'], ['Spielerwand', 'wall'], ['Infokarten', 'cards'], ['Nordlicht', 'aurora']] as const) {
    await dlg.getByRole('radio', { name }).click();
    await expect(dlg.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');
    await expect(beamer.locator('.wait')).toHaveAttribute('data-style', key);
  }

  // Kapsel lässt sich abschalten
  await expect(beamer.locator('.soon')).toHaveCount(1);
  await dlg.getByLabel(/Gleich geht’s los/).uncheck();
  await expect(beamer.locator('.soon')).toHaveCount(0);

  // bleibt nach Neuladen erhalten
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'Beamer-Setup' }).click();
  await expect(page.getByRole('radio', { name: 'Nordlicht' })).toHaveAttribute('aria-checked', 'true');
});
