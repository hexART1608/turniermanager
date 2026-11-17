// „Als nächstes abspielen“ zeigt den Titel in der Liste, ohne ihn in die Playlist zu schreiben;
// „Direkt abspielen“ reiht ein und springt zum nächsten Titel. Spotify wird simuliert.
import { expect, test } from '@playwright/test';

const track = (n: number) => ({ uri: `spotify:track:t${n}`, name: `Lied ${n}`, artists: [{ name: `Band ${n}` }], album: { images: [] } });

test('Als Nächstes und Direkt abspielen', async ({ page }) => {
  const playlist = [track(1), track(2)];
  let playing = track(1);
  const calls: string[] = [];

  await page.addInitScript(() => {
    (window as unknown as { Spotify: unknown }).Spotify = {
      Player: class { addListener() {} connect() { return Promise.resolve(true); } disconnect() {} setVolume() { return Promise.resolve(); } },
    };
    localStorage.setItem('turniermanager.v1.spotify.tokens', JSON.stringify({ access: 'x', expiresAt: Date.now() + 3600_000 }));
    localStorage.setItem('turniermanager.v1.spotify.clientId', JSON.stringify('cid'));
    localStorage.setItem('turniermanager.v1.spotify.playlist', JSON.stringify('https://open.spotify.com/playlist/PL123'));
    localStorage.setItem('turniermanager.v1.music.source', JSON.stringify('spotify'));
  });
  await page.route('https://api.spotify.com/**', async route => {
    const req = route.request();
    const url = req.url();
    if (url.includes('/search')) {
      return route.fulfill({ json: { tracks: { items: [{ ...track(7), album: { images: [] } }] } } });
    }
    if (url.includes('/me/player') && req.method() === 'GET') {
      return route.fulfill({ json: { is_playing: true, progress_ms: 1000, item: playing, device: { id: 'dev', name: 'Test', volume_percent: 50 }, shuffle_state: false } });
    }
    if (url.includes('/playlists/PL123/items') && req.method() === 'GET') {
      return route.fulfill({ json: { items: playlist.map(t => ({ track: t })), next: null } });
    }
    calls.push(`${req.method()} ${new URL(url).pathname}`);
    if (url.includes('/me/player/next')) playing = track(7);
    return route.fulfill({ status: 204, body: '' });
  });

  await page.goto('./');
  await page.getByRole('button', { name: /Musik/ }).first().click();
  const list = page.locator('.plist');
  await expect(list.getByText('Lied 2')).toBeVisible();

  await page.getByLabel('Lied suchen', { exact: true }).fill('sieben');
  await page.getByRole('button', { name: 'Suchen' }).click();
  await expect(page.getByRole('button', { name: /an Playlist anhängen/ })).toBeVisible();

  // Als nächstes: sichtbar in der Liste, aber nicht in die Playlist geschrieben
  await page.getByRole('button', { name: /„Lied 7“ als nächstes abspielen/ }).click();
  await expect(list.getByText('Als Nächstes', { exact: true })).toBeVisible();
  await expect(list.getByText('Lied 7')).toBeVisible();
  // direkt unter dem laufenden Titel (Lied 1), vor Lied 2
  await expect(list.locator('li').nth(1)).toContainText('Lied 7');
  await expect(list.locator('li').nth(2)).toContainText('Lied 2');
  expect(calls.some(c => c.startsWith('POST') && c.includes('/playlists/'))).toBe(false);
  expect(calls).toContain('POST /v1/me/player/queue');

  // Läuft der Titel, bleibt er markiert; danach verschwindet er aus der Liste
  playing = track(7);
  await expect(list.locator('li.cur').getByText('Lied 7')).toBeVisible({ timeout: 8000 });
  playing = track(2);
  await expect(list.getByText('Als Nächstes', { exact: true })).toHaveCount(0, { timeout: 8000 });

  // Direkt abspielen: einreihen und zum nächsten Titel springen
  calls.length = 0;
  await page.getByRole('button', { name: /„Lied 7“ direkt abspielen/ }).click();
  await expect.poll(() => calls).toEqual(['POST /v1/me/player/queue', 'POST /v1/me/player/next']);

  // Aus Playlist entfernen
  calls.length = 0;
  await page.getByRole('button', { name: /„Lied 2“ aus Playlist entfernen/ }).click();
  await expect.poll(() => calls).toContain('DELETE /v1/playlists/PL123/items');
});
