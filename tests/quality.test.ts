import { describe, expect, it } from 'vitest';
import * as A from '../src/engine/actions';
import { buildHistory, scheduledCounts } from '../src/engine/pairing';
import { type Tournament, matchPlayers, newTournament } from '../src/engine/types';

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function run(p1: number, p2: number, rounds: number, seed: number): Tournament {
  const r = rng(seed);
  let t = A.updateSettings(newTournament(0), { ribbon: false });
  for (let i = 0; i < p1; i++) t = A.addPlayer(t, `G${i}`, 1, r);
  for (let i = 0; i < p2; i++) t = A.addPlayer(t, `H${i}`, 2, r);
  t = A.start(t, r, 0);
  for (let i = 0; i < rounds; i++) t = A.callRound(t, r, i);
  return t;
}

function metrics(t: Tournament) {
  const hist = buildHistory(t.rounds);
  let maxPartner = 0, repeats = 0;
  for (const a of t.players) for (const b of t.players) if (a.id < b.id) {
    const w = hist.with(a.id, b.id);
    maxPartner = Math.max(maxPartner, w);
    if (w > 1) repeats += w - 1;
  }
  let b2b = 0;
  for (let i = 1; i < t.rounds.length; i++) {
    const prev = new Set(t.rounds[i - 1]!.matches.flatMap(matchPlayers));
    b2b += t.rounds[i]!.matches.flatMap(matchPlayers).filter(id => prev.has(id)).length;
  }
  const c = scheduledCounts(t.rounds);
  const spread = (pool: number) => {
    const v = t.players.filter(p => p.pool === pool).map(p => c.get(p.id) ?? 0);
    return Math.max(...v) - Math.min(...v);
  };
  return { maxPartner, repeats, b2b, spread1: spread(1), spread2: spread(2) };
}

describe('Qualität über viele Läufe', () => {
  for (const [p1, p2, rounds] of [[8, 8, 12], [6, 9, 14], [5, 5, 10], [4, 12, 16]] as const) {
    it(`${p1} Geübte + ${p2} Gäste, ${rounds} Runden`, () => {
      const all = Array.from({ length: 30 }, (_, s) => metrics(run(p1, p2, rounds, s + 1)));
      const max = (k: keyof ReturnType<typeof metrics>) => Math.max(...all.map(m => m[k]));
      const avg = (k: keyof ReturnType<typeof metrics>) => (all.reduce((n, m) => n + m[k], 0) / all.length).toFixed(1);
      console.log(`${p1}+${p2}/${rounds}: maxPartner=${max('maxPartner')} Wdh∅=${avg('repeats')} Folgespiele∅=${avg('b2b')} spread=${max('spread1')}/${max('spread2')}`);
      expect(max('spread1')).toBeLessThanOrEqual(1);
      expect(max('spread2')).toBeLessThanOrEqual(1);
    });
  }
});
