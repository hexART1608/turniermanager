// Rangliste wie in der alten App: mehr Siege vorn, bei gleichen Siegen weniger Spiele vorn.
// Werden Punkte erfasst, entscheidet danach die Punktdifferenz. Gleichstand = gleicher Rang.

import { type Player, type Pool, type Round, type Tournament } from './types';

export interface Standing {
  player: Player;
  rank: number;
  wins: number;
  losses: number;
  games: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  /** Siegquote 0..1, null ohne gewertetes Spiel */
  rate: number | null;
}

export function standings(t: Tournament, pool?: Pool): Standing[] {
  const usePoints = t.settings.scoreTracking;
  const map = new Map<number, Standing>();
  for (const p of t.players) {
    map.set(p.id, { player: p, rank: 0, wins: 0, losses: 0, games: 0, pointsFor: 0, pointsAgainst: 0, diff: 0, rate: null });
  }
  for (const r of t.rounds) for (const m of r.matches) {
    if (!m.winner) continue;
    const win = m.winner === 'A' ? m.teamA : m.teamB;
    const lose = m.winner === 'A' ? m.teamB : m.teamA;
    const [pw, pl] = m.score ? (m.winner === 'A' ? m.score : [m.score[1], m.score[0]]) : [0, 0];
    for (const id of win) {
      const s = map.get(id);
      if (s) { s.wins++; s.games++; s.pointsFor += pw; s.pointsAgainst += pl; }
    }
    for (const id of lose) {
      const s = map.get(id);
      if (s) { s.losses++; s.games++; s.pointsFor += pl; s.pointsAgainst += pw; }
    }
  }
  let list = [...map.values()];
  if (pool) list = list.filter(s => s.player.pool === pool);
  for (const s of list) {
    s.diff = s.pointsFor - s.pointsAgainst;
    s.rate = s.games ? s.wins / s.games : null;
  }
  const cmp = (a: Standing, b: Standing) =>
    b.wins - a.wins || a.games - b.games || (usePoints ? b.diff - a.diff : 0);
  list.sort((a, b) => cmp(a, b) || a.player.name.localeCompare(b.player.name, 'de'));
  list.forEach((s, i) => {
    const prev = list[i - 1];
    s.rank = prev && cmp(prev, s) === 0 ? prev.rank : i + 1;
  });
  return list;
}

export interface Stats {
  rounds: number;
  matches: number;
  decided: number;
  open: number;
  activePlayers: number;
  minGames: number;
  maxGames: number;
  balanced: boolean;
}

export function stats(t: Tournament): Stats {
  const matches = t.rounds.reduce((n, r) => n + r.matches.length, 0);
  const decided = t.rounds.reduce((n, r) => n + r.matches.filter(m => m.winner).length, 0);
  const counts = new Map<number, number>();
  const active = t.players.filter(p => p.active);
  active.forEach(p => counts.set(p.id, 0));
  for (const r of t.rounds) for (const m of r.matches) for (const id of [...m.teamA, ...m.teamB]) {
    if (counts.has(id)) counts.set(id, counts.get(id)! + 1);
  }
  const values = [...counts.values()];
  const minGames = values.length ? Math.min(...values) : 0;
  const maxGames = values.length ? Math.max(...values) : 0;
  return {
    rounds: t.rounds.length,
    matches,
    decided,
    open: matches - decided,
    activePlayers: active.length,
    minGames,
    maxGames,
    balanced: maxGames - minGames <= 1,
  };
}

/** Aktive Spieler, die in einer Runde nicht auf dem Feld stehen. */
export function sittingOut(t: Tournament, round: Pick<Round, 'matches'>): Player[] {
  const playing = new Set(round.matches.flatMap(m => [...m.teamA, ...m.teamB]));
  return t.players.filter(p => p.active && !playing.has(p.id));
}
