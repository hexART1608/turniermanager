import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** kurze WAV-Datei (Sinuston) – echte Audiodatei, die Chrome abspielen kann */
function wav(seconds: number, freq: number): Buffer {
  const rate = 8000, n = Math.round(rate * seconds);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 8000), 44 + i * 2);
  return b;
}

async function fresh(page: Page) {
  await page.goto('./');
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise(r => { const q = indexedDB.deleteDatabase('turniermanager'); q.onsuccess = q.onerror = q.onblocked = r; });
  });
  await page.reload();
}

const panel = (page: Page) => page.getByRole('region', { name: 'Musik' });

test('Titel hinzufügen, abspielen, vor/zurück, entfernen, nach Neuladen noch da', async ({ page }, info) => {
  const dir = info.outputPath('mp3');
  mkdirSync(dir, { recursive: true });
  const files = ['01_Alpha.wav', '02_Beta.wav', '03_Gamma.wav'].map((n, i) => {
    const p = join(dir, n);
    writeFileSync(p, wav(30, 300 + i * 100));
    return p;
  });
  await fresh(page);
  await page.getByRole('button', { name: 'Musik', exact: true }).click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByText('Noch keine Musik')).toBeVisible();

  const chooser = page.waitForEvent('filechooser');
  await panel(page).getByRole('button', { name: /Titel hinzufügen/ }).click();
  await (await chooser).setFiles(files);
  await expect(panel(page).locator('.list li')).toHaveCount(3);
  await expect(panel(page).locator('.list .nm').first()).toHaveText('01 Alpha');

  await panel(page).getByRole('button', { name: 'Abspielen' }).click();
  await expect(panel(page).locator('.title')).toHaveText('01 Alpha');
  await expect(page.locator('.music-btn .eq')).toBeVisible(); // läuft
  await expect.poll(async () => Number((await panel(page).locator('.t').first().textContent())!.split(':')[1])).toBeGreaterThan(0);

  await panel(page).getByRole('button', { name: 'Nächster Titel' }).click();
  await expect(panel(page).locator('.title')).toHaveText('02 Beta');
  await panel(page).getByRole('button', { name: 'Vorheriger Titel' }).click();
  await expect(panel(page).locator('.title')).toHaveText('01 Alpha');
  await panel(page).getByRole('button', { name: 'Vorheriger Titel' }).click();
  await expect(panel(page).locator('.title')).toHaveText('03 Gamma'); // springt ans Ende

  await panel(page).getByRole('button', { name: 'Pause' }).click();
  await expect(page.locator('.music-btn .eq')).toHaveCount(0);

  // Lautstärke und Zufall werden gemerkt
  await panel(page).getByLabel('Lautstärke Musik').fill('0.3');
  await panel(page).getByRole('button', { name: 'Zufällige Reihenfolge' }).click();

  await panel(page).getByRole('button', { name: '„02 Beta“ entfernen' }).click({ force: true });
  await expect(panel(page).locator('.list li')).toHaveCount(2);

  // Mini-Player: Playlist eingeklappt, Steuerung bleibt
  await panel(page).getByRole('button', { name: 'Auf Mini-Player verkleinern' }).click();
  await expect(panel(page).locator('.list')).toHaveCount(0);
  await expect(panel(page).getByRole('button', { name: 'Nächster Titel' })).toBeVisible();
  await panel(page).getByRole('button', { name: 'Playlist zeigen' }).click();
  await expect(panel(page).locator('.list li')).toHaveCount(2);

  // Fenster schließen: Musik läuft weiter
  await panel(page).getByRole('button', { name: 'Abspielen' }).click();
  await panel(page).getByRole('button', { name: /Musikfenster schließen/ }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator('.music-btn .eq')).toBeVisible();

  await page.reload();
  await page.keyboard.press('m');
  await expect(panel(page).locator('.list li')).toHaveCount(2);
  await expect(panel(page).locator('.title')).toHaveText('03 Gamma');
  await expect(panel(page).getByLabel('Lautstärke Musik')).toHaveValue('0.3');
  await expect(panel(page).getByRole('button', { name: 'Zufällige Reihenfolge' })).toHaveAttribute('aria-pressed', 'true');
  await panel(page).getByRole('button', { name: 'Abspielen' }).click();
  await expect(page.locator('.music-btn .eq')).toBeVisible();
});

test('Ordner wählen (mit Unterordnern) und nach Neuladen wieder abspielen', async ({ page }) => {
  await fresh(page);
  // Ordnerauswahl durch einen Ordner im privaten Dateisystem des Browsers ersetzen
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const music = await root.getDirectoryHandle('Turniermusik', { create: true });
    const sub = await music.getDirectoryHandle('B-Seite', { create: true });
    const tone = (f: number) => {
      const rate = 8000, n = rate * 20, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      const s = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      s(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); s(8, 'WAVE'); s(12, 'fmt '); v.setUint32(16, 16, true);
      v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin((2 * Math.PI * f * i) / rate) * 8000, true);
      return new Blob([buf]);
    };
    const put = async (d: FileSystemDirectoryHandle, name: string, b: Blob) => {
      const w = await (await d.getFileHandle(name, { create: true })).createWritable();
      await w.write(b); await w.close();
    };
    await put(music, 'Track 10.wav', tone(400));
    await put(music, 'Track 2.wav', tone(500));
    await put(music, 'notizen.txt', new Blob(['keine Musik']));
    await put(sub, 'Zugabe.wav', tone(600));
  });
  const mock = () => {
    (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker =
      async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Turniermusik');
  };
  await page.addInitScript(mock);
  await page.reload();
  await page.getByRole('button', { name: 'Musik', exact: true }).click();
  await panel(page).getByRole('button', { name: /Ordner wählen/ }).click();
  // natürliche Sortierung: 2 vor 10, Unterordner zuerst nach Name
  await expect(panel(page).locator('.list .nm')).toHaveText(['B-Seite/Zugabe'.split('/').pop()!, 'Track 2', 'Track 10']);
  // gleicher Ordner nochmal = neu einlesen, keine Doppelten
  await panel(page).getByRole('button', { name: /Ordner wählen/ }).click();
  await expect(panel(page).locator('.list li')).toHaveCount(3);
  await page.reload();
  await page.keyboard.press('m');
  await expect(panel(page).locator('.list li')).toHaveCount(3);
  await panel(page).locator('.list .row').nth(1).click();
  await expect(panel(page).locator('.title')).toHaveText('Track 2');
  await expect(page.locator('.music-btn .eq')).toBeVisible();
});

test('Musik wird bei Signalen leiser', async ({ page }, info) => {
  const file = info.outputPath('lied.wav');
  writeFileSync(file, wav(40, 440));
  await fresh(page);
  await page.getByPlaceholder('Name (Geübte) + Enter').fill('A1, A2');
  await page.getByPlaceholder('Name (Geübte) + Enter').press('Enter');
  await page.getByPlaceholder('Name (Gäste) + Enter').fill('B1, B2');
  await page.getByPlaceholder('Name (Gäste) + Enter').press('Enter');
  await page.getByRole('button', { name: 'Turnier starten' }).click();
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  await page.getByRole('button', { name: /Runde 1 aufrufen/ }).click();

  await page.getByRole('button', { name: 'Musik', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await panel(page).getByRole('button', { name: /Titel hinzufügen/ }).click();
  await (await chooser).setFiles(file);
  await panel(page).getByRole('button', { name: 'Abspielen' }).click();
  await expect(page.locator('.music-btn .eq')).toBeVisible();
  await expect(panel(page).getByText('Signal – leiser')).toHaveCount(0);

  // Startsignal → Musik leiser, danach wieder normal
  await page.getByRole('button', { name: /^Start/ }).click();
  await expect(panel(page).getByText('Signal – leiser')).toBeVisible();
  await expect(panel(page).getByText('Signal – leiser')).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('.music-btn .eq')).toBeVisible(); // Musik läuft weiter

  // Ausgeschaltet → keine Absenkung
  await panel(page).getByLabel('Bei Signalen leiser').uncheck();
  await page.getByRole('button', { name: 'Töne einstellen' }).click();
  await page.getByRole('button', { name: 'Testen' }).first().click();
  await expect(panel(page).getByText('Signal – leiser')).toHaveCount(0);
  await page.getByRole('button', { name: 'Fertig' }).click();
  await panel(page).getByLabel('Bei Signalen leiser').check();
  await page.getByRole('button', { name: 'Töne einstellen' }).click();
  await page.getByRole('button', { name: 'Testen' }).nth(2).click();
  await expect(panel(page).getByText('Signal – leiser')).toBeVisible();
});
