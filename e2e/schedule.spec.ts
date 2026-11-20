import { expect, test } from '@playwright/test';

test('Schleifchenturnier: Übersicht zeigt alle Runden, Plan änderbar, Turnier endet von selbst', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByPlaceholder('Name (Geübte) + Enter').fill('Marc, Anne, Jonas, Lea');
  await page.getByPlaceholder('Name (Geübte) + Enter').press('Enter');
  await page.getByPlaceholder('Name (Gäste) + Enter').fill('Ben, Clara, David, Emma');
  await page.getByPlaceholder('Name (Gäste) + Enter').press('Enter');
  await page.getByRole('button', { name: 'Turnier starten' }).click();
  await page.getByRole('button', { name: 'Los geht’s' }).click();

  // 4 × 4 Spieler, 2 Felder: 16 Partnerschaften = 8 Matches = 4 Runden
  await page.getByRole('button', { name: 'Übersicht' }).click();
  const dlg = page.getByRole('dialog', { name: 'Übersicht aller Spiele' });
  await expect(dlg.getByRole('heading', { name: /Runde \d/ })).toHaveCount(4);
  await expect(dlg.getByText('als Nächstes')).toBeVisible();

  // einen Namen in Runde 3 tauschen
  const round3 = dlg.locator('section.round', { has: page.getByRole('heading', { name: 'Runde 3' }) });
  const first = round3.locator('.pick').first();
  const before = (await first.textContent())!.trim();
  await first.click();
  const picker = page.getByRole('dialog', { name: 'Platz neu besetzen' });
  await picker.locator('.opt').first().click();
  await expect(dlg.getByText(/Von Hand angepasst/)).toBeVisible();
  expect(before.length).toBeGreaterThan(0);
  await dlg.getByRole('button', { name: 'Schließen' }).click();

  for (let r = 1; r <= 4; r++) {
    await page.getByRole('button', { name: new RegExp(`Runde ${r} starten`) }).click();
    const wins = page.getByRole('button', { name: /^Sieg für/ });
    const n = await wins.count();
    for (let i = 0; i < n; i += 2) await wins.nth(i).click();
  }
  // nach dem letzten Ergebnis ist das Turnier beendet
  await expect(page.getByRole('button', { name: 'Weiterspielen' })).toBeVisible({ timeout: 8000 });
});
