import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function fresh(page: Page) {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function paste(page: Page, placeholder: string, text: string) {
  const input = page.getByPlaceholder(placeholder);
  await input.focus();
  await input.evaluate((el, t) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, text);
}

async function setupStandard(page: Page, guests = 'Ben\nClara\nDavid\nEmma\nFinn\nGreta') {
  await fresh(page);
  await paste(page, 'Name (Geübte) + Enter', 'Marc\nAnne\nJonas\nLea\nTim');
  await paste(page, 'Name (Gäste) + Enter', guests);
  await page.getByRole('button', { name: 'Turnier starten' }).click();
  await page.getByRole('button', { name: 'Los geht’s' }).click();
}

test('Liste einfügen, Start, Ergebnisse, Neuladen, Rückgängig', async ({ page }) => {
  await setupStandard(page);
  await expect(page.getByText('Läuft', { exact: true })).toBeVisible();
  // Format gesperrt: kein Setup mehr
  await expect(page.getByText('Turnier einrichten')).toHaveCount(0);

  await page.getByRole('button', { name: /Runde 1 starten/ }).click();
  await expect(page.getByRole('heading', { name: 'Runde 1' })).toBeVisible();
  const wins = page.getByRole('button', { name: /^Sieg für/ });
  await expect(wins).toHaveCount(4);
  await wins.nth(0).click();
  await expect(page.getByText(/1 von \d+ Ergebnissen erfasst/)).toBeVisible();

  // nach Neuladen ist alles noch da
  await page.reload();
  await expect(page.getByText(/1 von \d+ Ergebnissen erfasst/)).toBeVisible();

  await page.getByRole('button', { name: /^Sieg für/ }).nth(3).click();
  await expect(page.getByText(/alle \d+ Ergebnisse erfasst/)).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.getByText(/1 von \d+ Ergebnissen erfasst/)).toBeVisible();

  // Rangliste zeigt 2 Sieger mit 1 Sieg
  await page.getByRole('button', { name: 'Rangliste', exact: true }).click();
  await expect(page.locator('.panel td.wins', { hasText: '1' })).toHaveCount(2);
});

test('Jedes Doppel hat einen aus jedem Topf, Pause wird ausgelost', async ({ page }) => {
  await setupStandard(page);
  for (let r = 1; r <= 4; r++) {
    await page.getByRole('button', { name: new RegExp(`Runde ${r} starten`) }).click();
    const dlg = page.getByRole('button', { name: 'Starten', exact: true });
    if (await dlg.isVisible().catch(() => false)) await dlg.click();
  }
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('turniermanager.v1.state')!));
  const pool = new Map(state.players.map((p: { id: number; pool: number }) => [p.id, p.pool]));
  expect(state.rounds.length).toBe(4);
  for (const r of state.rounds) {
    expect(r.matches.length).toBe(2);
    for (const m of r.matches) for (const team of [m.teamA, m.teamB]) {
      expect(team.map((id: number) => pool.get(id)).sort()).toEqual([1, 2]);
    }
  }
});

test('Spieler ersetzen über die Auswahl', async ({ page }) => {
  await setupStandard(page);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('turniermanager.v1.state')!).draft.matches[0].teamA[0]);
  await page.locator('button.pick').first().click();
  await expect(page.getByRole('dialog', { name: 'Platz neu besetzen' })).toBeVisible();
  await page.getByRole('dialog').locator('button.opt').first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('turniermanager.v1.state')!).draft);
  expect(after.matches[0].teamA[0]).not.toBe(before);
  expect(after.edited).toBe(true);
  const ids = after.matches.flatMap((m: { teamA: number[]; teamB: number[] }) => [...m.teamA, ...m.teamB]);
  expect(new Set(ids).size).toBe(ids.length);
});

test('Beamer folgt Steuerung und Timer', async ({ page, context }) => {
  await setupStandard(page);
  const beamer = await context.newPage();
  await beamer.goto('./#/beamer');
  await expect(beamer.getByText('Gleich geht’s los', { exact: false })).toBeVisible();
  await page.bringToFront();
  await page.getByRole('button', { name: /Runde 1 starten/ }).click();
  await expect(beamer.locator('.cno')).toHaveCount(2);
  await expect(beamer.locator('.tval')).toHaveText('04:00');
  await page.getByRole('button', { name: /^Start/ }).click();
  await page.waitForTimeout(2200);
  const shown = await beamer.locator('.tval').textContent();
  expect(['03:58', '03:57']).toContain(shown);
  await page.getByRole('button', { name: /^Pause/ }).click();
  const paused = await beamer.locator('.tval').textContent();
  await page.waitForTimeout(1200);
  await expect(beamer.locator('.tval')).toHaveText(paused!);
  // Timer überlebt Neuladen
  await page.reload();
  await expect(page.locator('.time')).toHaveText(paused!);
});

test('Nachmelden und Pausieren während des Turniers', async ({ page }) => {
  await setupStandard(page);
  await page.getByRole('button', { name: /Runde 1 starten/ }).click();
  await page.getByRole('button', { name: 'Spieler', exact: true }).click();
  await page.getByPlaceholder('Name des Nachzüglers').fill('Zoe');
  await page.getByRole('button', { name: 'Nachmelden' }).click();
  await expect(page.getByRole('button', { name: 'Zoe', exact: true })).toBeVisible();
  const row = page.locator('li.row', { has: page.getByRole('button', { name: 'Marc', exact: true }) });
  await row.getByRole('button', { name: /spielt mit/ }).click();
  await expect(row.getByRole('button', { name: /Pause/ })).toBeVisible();
  const draft = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('turniermanager.v1.state')!);
    const marc = s.players.find((p: { name: string }) => p.name === 'Marc').id;
    return s.draft.matches.flatMap((m: { teamA: number[]; teamB: number[] }) => [...m.teamA, ...m.teamB]).includes(marc);
  });
  expect(draft).toBe(false);
});

test('Einstellungen nach dem Start gesperrt, Turnier beenden, Weiterspielen', async ({ page }) => {
  await setupStandard(page);
  await page.getByRole('button', { name: /Runde 1 starten/ }).click();
  await page.getByRole('button', { name: /^Sieg für/ }).first().click();
  await page.getByRole('button', { name: 'Turnier beenden' }).click();
  await page.getByRole('button', { name: 'Zur Siegerehrung' }).click();
  await expect(page.getByText('Siegerehrung', { exact: true })).toBeVisible();
  await expect(page.locator('.podium .place-1')).toBeVisible();
  await page.getByRole('button', { name: 'Weiterspielen' }).click();
  await expect(page.getByRole('heading', { name: 'Runde 1' })).toBeVisible();
});

test('Import einer Datei der alten App', async ({ page }, info) => {
  await fresh(page);
  const legacy = {
    mode: '2v2', teamType: 'random', poolCount: 2, roundCount: 3, scoreTracking: false, timerDuration: 300,
    players: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `P${i + 1}`, pool: i < 4 ? 1 : 2 })),
    rounds: [{ id: 1, matches: [{ teamA: [1, 5], teamB: [2, 6], winner: 'A', score: null }, { teamA: [3, 7], teamB: [4, 8], winner: null, score: null }] }],
  };
  const file = info.outputPath('alt.json');
  writeFileSync(file, JSON.stringify(legacy));
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importieren' }).click();
  await (await chooser).setFiles(file);
  await expect(page.getByRole('dialog', { name: 'Turnier importieren?' })).toBeVisible();
  await page.getByRole('button', { name: 'Importieren', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Runde 1' })).toBeVisible();
  await expect(page.locator('.time')).toHaveText('05:00');
  await expect(page.getByText(/1 von \d+ Ergebnissen erfasst/)).toBeVisible();
});

test('Neues Turnier übernimmt die Spieler, Sicherung lässt sich zurückholen', async ({ page }) => {
  await setupStandard(page);
  await page.getByRole('button', { name: /Runde 1 starten/ }).click();
  await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
  await page.getByRole('menuitem', { name: /Neues Turnier/ }).click();
  await page.getByRole('button', { name: 'Neues Turnier', exact: true }).click();
  await expect(page.getByText('Turnier einrichten')).toBeVisible();
  await expect(page.locator('.player')).toHaveCount(11);
  await page.getByRole('button', { name: 'Vorheriges Turnier' }).click();
  await page.getByRole('button', { name: 'Wiederherstellen' }).click();
  await expect(page.getByRole('heading', { name: 'Runde 1' })).toBeVisible();
});

test('Doppelte Namen und zu kleine Töpfe werden abgefangen', async ({ page }) => {
  await fresh(page);
  const g = page.getByPlaceholder('Name (Geübte) + Enter');
  await g.fill('Marc');
  await g.press('Enter');
  await g.fill('marc');
  await g.press('Enter');
  await expect(page.getByText('„marc“ gibt es schon', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Turnier starten' })).toBeDisabled();
  await expect(page.getByText(/Jeder Topf braucht mindestens 2 Spieler/)).toBeVisible();
});

test('läuft offline nach dem ersten Besuch', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Turniermanager').first()).toBeVisible();
  const beamer = await context.newPage();
  await beamer.goto('./#/beamer');
  await expect(beamer.locator('.bhead')).toBeVisible();
  await context.setOffline(false);
});
