import { describe, expect, it } from 'vitest';
import * as A from '../src/engine/actions';
import { announcement } from '../src/engine/announce';
import { newTournament } from '../src/engine/types';

function tournament() {
  let t = A.updateSettings(newTournament(0), { courts: 2, pairing: 'pools', ribbon: false });
  for (const n of ['Anne', 'Marc', 'Lea', 'Jonas', 'Tim']) t = A.addPlayer(t, n, 1, () => 0.5);
  for (const n of ['Ben', 'Clara', 'David', 'Emma', 'Finn', 'Greta']) t = A.addPlayer(t, n, 2, () => 0.5);
  return A.start(t, () => 0.3, 0);
}

describe('Sprachansage', () => {
  it('nennt Runde, Felder und Teams', () => {
    const t = tournament();
    const m = t.draft!.matches;
    const text = announcement(t, m, 4, { pause: false });
    expect(text.startsWith('Runde 4. Feld 1: ')).toBe(true);
    expect(text).toContain(' gegen ');
    expect(text).toContain(`Feld ${m[1]!.court}: `);
    expect(text).not.toContain('Pause');
    // jedes Team: „A und B“
    expect(text).toMatch(/Feld 1: \S+ und \S+ gegen \S+ und \S+\./);
  });

  it('sagt auf Wunsch die Pause an', () => {
    const t = tournament();
    const text = announcement(t, t.draft!.matches, 1, { pause: true });
    expect(text).toMatch(/Pause haben .+ und .+\.$/);
  });

  it('Einzelner Pausierender: „hat“', () => {
    let t = tournament();
    // 11 Spieler, 2 Felder → 3 pausieren; mit einem weiteren Match pausiert niemand mehr als nötig
    const text = announcement(t, [t.draft!.matches[0]!], 1, { pause: true });
    expect(text).toContain('Pause haben');
    t = A.updateSettings(t, {});
    expect(announcement(t, t.draft!.matches, 1, { pause: true }).length).toBeGreaterThan(20);
  });
});

import { normalizeSpeech, PEAK_LIMIT, TARGET_RMS } from '../src/lib/voice/level';

describe('Lautheit der Sprache', () => {
  it('hebt leise Sprache auf die Ziellautheit', () => {
    const x = Float32Array.from({ length: 2000 }, (_, i) => 0.05 * Math.sin(i / 7));
    const k = normalizeSpeech(x);
    const rms = Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
    expect(k).toBeGreaterThan(2);
    expect(Math.max(...x.map(Math.abs))).toBeLessThanOrEqual(PEAK_LIMIT + 1e-6);
    expect(rms).toBeLessThanOrEqual(TARGET_RMS + 1e-3);
  });
  it('übersteuert Spitzen nie und lässt Stille in Ruhe', () => {
    const spiky = Float32Array.from({ length: 1000 }, (_, i) => (i === 500 ? 0.9 : 0.001));
    normalizeSpeech(spiky);
    expect(Math.max(...spiky)).toBeLessThanOrEqual(PEAK_LIMIT + 1e-6);
    expect(normalizeSpeech(new Float32Array(100))).toBe(1);
  });
});
