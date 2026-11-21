// Bilder für docs/ANLEITUNG.md erzeugen: DOCS=1 npx playwright test docs-shots
import { test } from '@playwright/test';

const OUT = 'docs/img';
test.skip(!process.env.DOCS, 'nur auf Anfrage');
test.setTimeout(180_000);

test('Anleitung fotografieren', async ({ page, context }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const shot = (name: string, full = false) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  const dlgShot = async (title: string, name: string) => page.getByRole('dialog', { name: title }).screenshot({ path: `${OUT}/${name}.png` });

  // Vorbereitung
  const g = page.getByPlaceholder('Name (Geübte) + Enter');
  await g.fill('Marc, Anne, Jonas, Lea, Tim, Sophie');
  await g.press('Enter');
  const h = page.getByPlaceholder('Name (Gäste) + Enter');
  await h.fill('Ben, Clara, David, Emma, Finn, Greta');
  await h.press('Enter');
  await page.waitForTimeout(7000); // Hinweise ausblenden lassen
  await shot('01-vorbereitung', true);
  await page.getByRole('button', { name: 'Beamer-Setup' }).click();
  await page.waitForTimeout(700);
  await dlgShot('Beamer-Setup', '02-beamer-setup');
  await page.getByRole('dialog', { name: 'Beamer-Setup' }).getByRole('button', { name: 'Fertig' }).click();

  // Start
  await page.getByRole('button', { name: 'Turnier starten' }).click();
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  await page.waitForTimeout(500);
  await shot('03-bereit', true);
  await page.getByRole('button', { name: /Runde 1 starten/ }).click();
  await page.getByRole('button', { name: /^Sieg für/ }).first().click();
  await page.keyboard.press('Space');
  await page.waitForTimeout(7000); // Hinweis ausblenden lassen
  await shot('04-spielbetrieb', true);
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Ändern' }).click();
  await page.waitForTimeout(500);
  await dlgShot('Runde 2 bearbeiten', '04b-naechste-runde-aendern');
  await page.getByRole('dialog', { name: 'Runde 2 bearbeiten' }).getByRole('button', { name: 'Fertig' }).click();

  // Übersicht
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.waitForTimeout(600);
  await page.getByRole('dialog', { name: 'Übersicht aller Spiele' }).screenshot({ path: `${OUT}/05-uebersicht.png` });
  await page.getByRole('dialog', { name: 'Übersicht aller Spiele' }).getByRole('button', { name: 'Schließen' }).click();

  // Töne
  await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
  await page.waitForTimeout(300);
  await shot('06-menue');
  await page.getByRole('menuitem', { name: /Töne/ }).click();
  await page.waitForTimeout(500);
  await dlgShot('Töne & Signale', '07-toene');
  await page.getByRole('dialog', { name: 'Töne & Signale' }).getByRole('button', { name: 'Fertig' }).click();

  // Musik
  await page.getByRole('button', { name: /^Musik/ }).click();
  await page.waitForTimeout(500);
  await shot('08-musik');
  await page.getByRole('button', { name: 'Musikfenster schließen (Musik läuft weiter)' }).click();

  // weitere Runden spielen, damit Rangliste und Treppchen gefüllt sind
  const decide = async (skip = 0) => {
    const wins = page.getByRole('button', { name: /^Sieg für/ });
    const n = await wins.count();
    for (let i = skip; i < n; i += 2) await wins.nth(i).click({ timeout: 2000 }).catch(() => {});
  };
  await decide(0);
  for (const r of [2, 3]) {
    await page.getByRole('button', { name: new RegExp(`Runde ${r} starten`) }).click();
    await page.getByRole('button', { name: 'Starten', exact: true }).click({ timeout: 2000 }).catch(() => {});
    await decide(r % 2 ? 1 : 0);
  }
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Bereits gespielt' }).click();
  await page.waitForTimeout(500);
  await dlgShot('Bereits gespielt', '04c-bereits-gespielt');
  await page.getByRole('dialog', { name: 'Bereits gespielt' }).getByRole('button', { name: 'Fertig' }).click();
  await page.getByRole('button', { name: /Rangliste · Top 8/ }).click();
  await page.waitForTimeout(500);
  await dlgShot('Rangliste · Top 8', '04d-top8');
  await page.getByRole('dialog', { name: 'Rangliste · Top 8' }).getByRole('button', { name: 'Fertig' }).click();
  await page.getByRole('button', { name: 'Rangliste', exact: true }).first().click();
  await page.waitForTimeout(600);
  await shot('09-rangliste', true);
  await page.getByRole('button', { name: 'Spieler', exact: true }).first().click();
  await page.waitForTimeout(300);
  await shot('10-spieler', true);
  await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  await page.waitForTimeout(300);
  await shot('11-verlauf', true);
  await page.getByRole('button', { name: 'Statistik', exact: true }).click();
  await page.waitForTimeout(300);
  await shot('12-statistik', true);

  // Beamer
  const b = await context.newPage();
  await b.setViewportSize({ width: 1920, height: 1080 });
  await b.goto('./#/beamer');
  await b.waitForTimeout(1500);
  for (const [key, name] of [['1', '13-beamer-uebersicht'], ['2', '14-beamer-felder'], ['3', '15-beamer-timer'], ['4', '16-beamer-rangliste']] as const) {
    await b.keyboard.press(key);
    await b.waitForTimeout(1200);
    await b.screenshot({ path: `${OUT}/${name}.png` });
  }

  // Siegerehrung
  await page.bringToFront();
  await page.getByRole('button', { name: 'Spielbetrieb', exact: true }).click();
  await page.getByRole('button', { name: 'Turnier beenden' }).click();
  await page.getByRole('button', { name: 'Zur Siegerehrung' }).click();
  await page.waitForTimeout(3500);
  await shot('17-siegerehrung');
  await b.goto('./#/beamer');
  await b.waitForTimeout(5500);
  await b.screenshot({ path: `${OUT}/18-beamer-siegerehrung.png` });
});
