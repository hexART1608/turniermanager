// Spotify wird hier komplett simuliert (Web-API per route, Player-SDK als Attrappe):
// Läuft ein Titel, der nicht in der Playlist steht (Autoplay), erscheint er als „Autoplay“
// und lässt sich per Schalter automatisch in die Playlist aufnehmen.
import { expect, test } from '@playwright/test';

const track = (n: number) => ({ uri: `spotify:track:t${n}`, name: `Lied ${n}`, artists: [{ name: `Band ${n}` }], album: { images: [] } });

test('Autoplay-Titel werden angezeigt und in die Playlist aufgenommen', async ({ page }) => {
  const playlist = [track(1), track(2)];
  let playing = track(1);
  const posts: string[] = [];

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
    if (url.includes('/me/player') && req.method() === 'GET') {
      return route.fulfill({ json: { is_playing: true, progress_ms: 1000, item: playing, device: { id: 'dev', name: 'Test', volume_percent: 50 }, shuffle_state: false } });
    }
    if (url.includes('/playlists/PL123/items') && req.method() === 'GET') {
      return route.fulfill({ json: { items: playlist.map(t => ({ track: t })), next: null } });
    }
    if (url.includes('/playlists/PL123/items') && req.method() === 'POST') {
      const { uris } = req.postDataJSON() as { uris: string[] };
      posts.push(...uris);
      for (const u of uris) if (u === playing.uri) playlist.push(playing);
      return route.fulfill({ status: 201, json: { snapshot_id: 's' } });
    }
    return route.fulfill({ status: 204, body: '' });
  });

  await page.goto('./');
  await page.getByRole('button', { name: /Musik/ }).first().click();
  const list = page.locator('.plist');
  await expect(list.getByText('Lied 2')).toBeVisible();
  await expect(list.getByText('Autoplay', { exact: true })).toHaveCount(0);

  // Spotify spielt nach dem Ende der Playlist von selbst weiter
  playing = track(9);
  await expect(list.getByText('Lied 9')).toHaveCount(1, { timeout: 8000 });
  await expect(list.getByText('Lied 9')).toBeVisible({ timeout: 8000 });
  await expect(list.getByText('Autoplay', { exact: true })).toHaveCount(1);
  await expect(page.getByText('+ 1 Autoplay')).toBeVisible();
  expect(posts).toEqual([]);

  // Automatisch aufnehmen
  await page.getByLabel(/Autoplay-Titel automatisch/).check();
  await expect.poll(() => posts).toEqual(['spotify:track:t9']);
  await expect(list.getByText('Autoplay', { exact: true })).toHaveCount(0);
  await expect(list.locator('li')).toHaveCount(3);

  // nächster Autoplay-Titel wird jetzt gleich aufgenommen
  playing = track(10);
  await expect.poll(() => posts, { timeout: 8000 }).toEqual(['spotify:track:t9', 'spotify:track:t10']);
  await expect(list.locator('li')).toHaveCount(4);
});
