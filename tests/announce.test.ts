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
