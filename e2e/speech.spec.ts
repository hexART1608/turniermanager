// Sprachansage mit dem Sprachpaket: Laden, Offline-Betrieb, Ansage. Braucht public/voices (npm run voice:fetch).
import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';

test.skip(!existsSync('public/voices/manifest.json'), 'Sprachpaket fehlt (npm run voice:fetch)');
test.setTimeout(300_000);

test('Sprachpaket laden, offline ansagen, Runde ansagen', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  const g = page.getByPlaceholder('Name (Geübte) + Enter');
  await g.fill('Marc, Anne, Jonas, Lea'); await g.press('Enter');
  const h = page.getByPlaceholder('Name (Gäste) + Enter');
  await h.fill('Ben, Clara, David, Emma'); await h.press('Enter');
  await page.getByRole('button', { name: 'Turnier starten' }).click();
  await page.getByRole('button', { name: 'Los geht’s' }).click();

  await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
  await page.getByRole('menuitem', { name: /Töne/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Töne & Signale' });
  const box = dlg.getByLabel('Sprachansage');
  await expect(box.getByRole('button', { name: 'Sprachpaket laden' })).toBeVisible();
  await box.getByRole('button', { name: 'Sprachpaket laden' }).click();
  await expect(box.getByText('Bereit: Thorsten')).toBeVisible({ timeout: 120_000 });

  // nach dem Neuladen und ohne Netz: das Paket kommt aus dem Browser-Speicher
  await dlg.getByRole('button', { name: 'Fertig' }).click();
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20_000 }).catch(() => undefined);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
  await page.getByRole('menuitem', { name: /Töne/ }).click();
  await expect(box.getByText('Bereit: Thorsten')).toBeVisible();
  await box.getByRole('button', { name: 'Testen' }).click();
  await expect(box.getByText('spricht …')).toBeVisible({ timeout: 90_000 });
  await expect(box.getByText('Bereit: Thorsten')).toBeVisible({ timeout: 60_000 });
  await expect(box.getByRole('alert')).toHaveCount(0);

  // Ansage einschalten: beim Rundenstart gibt es den Knopf „nochmal ansagen“
  await box.getByLabel('Runden ansagen').check();
  await dlg.getByRole('button', { name: 'Fertig' }).click();
  await page.getByRole('button', { name: /Runde 1 starten/ }).click();
  await expect(page.getByRole('button', { name: 'Runde nochmal ansagen' })).toBeVisible();
  await context.setOffline(false);

  // Entfernen
  await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
  await page.getByRole('menuitem', { name: /Töne/ }).click();
  await box.getByRole('button', { name: 'Entfernen' }).click();
  await expect(box.getByRole('button', { name: 'Sprachpaket laden' })).toBeVisible();
});
