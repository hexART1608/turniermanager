import { expect, test } from '@playwright/test';

test('Bereits gespielt und Verlauf zeigen Feld, Punkte, Sieger', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByPlaceholder('Name (Geübte) + Enter').fill('Marc, Anne, Jonas, Lea');
  await page.getByPlaceholder('Name (Geübte) + Enter').press('Enter');
  await page.getByPlaceholder('Name (Gäste) + Enter').fill('Ben, Clara, David, Emma');
  await page.getByPlaceholder('Name (Gäste) + Enter').press('Enter');
  await page.getByLabel('Punkte erfassen').click();
  await page.getByRole('button', { name: 'Turnier starten' }).click();
  await page.getByRole('button', { name: 'Los geht’s' }).click();

  await page.getByRole('button', { name: /Runde 1 starten/ }).click();
  await expect(page.getByText('Bereits gespielt')).toHaveCount(0);
  const a = page.getByLabel('Punkte links'), b = page.getByLabel('Punkte rechts');
  await a.nth(0).fill('21'); await b.nth(0).fill('15'); await b.nth(0).blur();
  await a.nth(1).fill('12'); await b.nth(1).fill('21'); await b.nth(1).blur();
  await page.getByRole('button', { name: /Runde 2 starten/ }).click();

  const earlier = page.locator('section.earlier');
  await expect(earlier.getByRole('heading', { name: 'Bereits gespielt' })).toBeVisible();
  // Punkte sind hier direkt änderbar
  await expect(earlier.getByLabel('Punkte Team 1').nth(0)).toHaveValue('21');
  await expect(earlier.getByLabel('Punkte Team 2').nth(1)).toHaveValue('21');
  await expect(earlier.locator('.winner')).toHaveCount(2);
  await expect(earlier.locator('.court')).toHaveText(['1', '2']);

  await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  const first = page.locator('article.round').last(); // neueste Runde steht oben, Runde 1 unten
  // Punkte stehen im Verlauf als Eingabefelder (direkt änderbar)
  await expect(first.getByLabel('Punkte Team 1').nth(0)).toHaveValue('21');
  await expect(first.getByLabel('Punkte Team 2').nth(0)).toHaveValue('15');
  await expect(first.getByRole('heading', { name: 'Runde 1' })).toBeVisible();
  await expect(first.locator('.winner').first()).not.toHaveText('offen');
  await expect(first.locator('.team.win')).toHaveCount(2);
  // Spielersuche
  // Punkte direkt in der Tabelle korrigieren: 21:15 → 19:21 dreht den Sieger
  await first.getByLabel('Punkte Team 1').nth(0).fill('19');
  await first.getByLabel('Punkte Team 2').nth(0).fill('21');
  await first.getByLabel('Punkte Team 2').nth(0).blur();
  await expect(first.getByLabel('Punkte Team 1').nth(0)).toHaveValue('19');
  await expect(first.locator('.team.win')).toHaveCount(2);
  await page.getByLabel('Spieler suchen').count();
});
