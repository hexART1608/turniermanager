// Spielbetrieb: Layout, Rundenstatus, Rundenwechsel, Tastenkürzel, Theme (ohne Pixelwerte)
import { expect, test, type Page } from '@playwright/test';

async function start(page: Page, courts = 2, big = false) {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const g = page.getByPlaceholder('Name (Geübte) + Enter');
  await g.fill(big ? 'Marc, Anne, Jonas, Lea, Tim, Sophie, Hanna, Igor' : 'Marc, Anne, Jonas, Lea, Tim, Sophie');
  await g.press('Enter');
  const h = page.getByPlaceholder('Name (Gäste) + Enter');
  await h.fill(big ? 'Ben, Clara, David, Emma, Finn, Greta, Karl, Lena' : 'Ben, Clara, David, Emma, Finn, Greta');
  await h.press('Enter');
  for (let c = 2; c < courts; c++) await page.getByRole('button', { name: 'Felder erhöhen' }).click();
  await page.getByRole('button', { name: 'Turnier starten' }).click();
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  await page.getByRole('button', { name: /Runde 1 starten/ }).click();
}

const live = (page: Page) => page.locator('section.now article.match');
const boxes = async (page: Page) => Promise.all((await live(page).all()).map(m => m.boundingBox()));

test('zwei Felder stehen auf dem Desktop nebeneinander, auf dem Handy untereinander', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page, 2);
  await expect(live(page)).toHaveCount(2);
  let [a, b] = await boxes(page);
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(3);
  expect(b!.x).toBeGreaterThan(a!.x + a!.width - 2);
  expect(Math.abs(a!.width - b!.width)).toBeLessThan(3);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  [a, b] = await boxes(page);
  expect(b!.y).toBeGreaterThan(a!.y + a!.height - 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('mehr Felder: Raster bleibt im Fenster', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await start(page, 4, true);
  await expect(live(page)).toHaveCount(4);
  const bs = await boxes(page);
  for (const b of bs) expect(b!.x + b!.width).toBeLessThanOrEqual(1600);
  expect(new Set(bs.map(b => Math.round(b!.y / 10))).size).toBe(2); // zwei Zeilen
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Rundenstatus, Sieger setzen und aufheben, Neuladen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page);
  const status = page.getByRole('status').filter({ hasText: 'Ergebnisse' });
  await expect(status).toContainText('0 von 2 Ergebnissen erfasst');
  const wins = page.getByRole('button', { name: /^Sieg für/ });
  await wins.first().click();
  await expect(status).toContainText('1 von 2');
  await expect(page.locator('section.now .cup')).toHaveCount(1);
  await page.reload();
  await expect(status).toContainText('1 von 2');
  await page.getByRole('button', { name: /^Sieg für/ }).first().click(); // erneut antippen hebt auf
  await expect(status).toContainText('0 von 2');
  await expect(page.locator('section.now .cup')).toHaveCount(0);
  for (const i of [0, 2]) await page.getByRole('button', { name: /^Sieg für/ }).nth(i).click();
  await expect(status).toContainText('alle 2 Ergebnisse erfasst');
});

test('Rundenwechsel fragt bei fehlenden Ergebnissen und laufendem Timer nach', async ({ page }) => {
  await start(page);
  await page.waitForTimeout(600); // Toast/Übergänge abwarten
  await page.keyboard.press('Space'); // Timer starten (nach dem Startton)
  await expect(page.getByText('läuft', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /Runde 2 starten/ }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('fehlen noch 2 Ergebnisse');
  await expect(dlg).toContainText('Timer läuft noch');
  await dlg.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('heading', { name: 'Runde 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Runde 2 starten/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Starten', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Runde 2', exact: true })).toBeVisible();
});

test('Leertaste startet den Timer, aber nicht beim Tippen in Eingabefeldern', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Spieler', exact: true }).first().click();
  const name = page.getByPlaceholder('Name des Nachzüglers');
  await name.focus();
  await page.keyboard.type('Max Muster');
  await expect(name).toHaveValue('Max Muster');
  await page.getByRole('button', { name: 'Spielbetrieb', exact: true }).click();
  await expect(page.getByText('bereit', { exact: true })).toBeVisible();
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('Space');
  await expect(page.getByText('läuft', { exact: true }).first()).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByText('pausiert', { exact: true })).toBeVisible();
});

test('nächste Runde: Namen tauschen und neu auslosen', async ({ page }) => {
  await start(page);
  const next = page.locator('section.next');
  await expect(next.locator('article.match')).toHaveCount(2);
  const before = await next.locator('article.match').allTextContents();
  await next.locator('.pick').first().click();
  await page.getByRole('dialog', { name: 'Platz neu besetzen' }).locator('.opt').first().click();
  await expect(next.getByText('von Hand angepasst')).toBeVisible();
  expect(await next.locator('article.match').allTextContents()).not.toEqual(before);
  await next.getByRole('button', { name: 'Neu auslosen' }).click();
  await expect(next.getByText('von Hand angepasst')).toHaveCount(0);
});

test('helles und dunkles Design: Felder und Timer bleiben sichtbar', async ({ page }) => {
  await start(page);
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const dark = await bg();
  await page.getByRole('button', { name: 'Helles Design' }).click();
  expect(await bg()).not.toBe(dark);
  await expect(live(page).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Start/ })).toBeVisible();
  await page.getByRole('button', { name: 'Dunkles Design' }).click();
  expect(await bg()).toBe(dark);
});

test('Beamer folgt der Steuerung', async ({ page, context }) => {
  await start(page);
  const beamer = await context.newPage();
  await beamer.goto('./#/beamer');
  await expect(beamer.locator('.cno')).toHaveCount(2);
  await page.bringToFront();
  await page.getByRole('button', { name: /^Sieg für/ }).first().click();
  await expect(beamer.locator('.cno')).toHaveCount(2);
});

test('Schleifchenturnier: neben der nächsten Runde steht die übernächste, sofern Platz ist', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await start(page, 2);
  const after = page.locator('section.next .after');
  await expect(after).toContainText('Danach · Runde 3');
  await expect(after.locator('.am')).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(after).toHaveCount(0); // zu schmal: keine zusätzliche Spalte
});
