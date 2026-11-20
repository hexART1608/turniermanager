// Schleifchenturnier: Jeder aus Topf 1 spielt einmal mit jedem aus Topf 2 als Partner.
// Der komplette Spielplan wird vorab berechnet; das Turnier endet, wenn er gespielt ist.

import { type Match, type Round, type Tournament, matchPlayers } from './types';
import { type Rng, activePlayers, buildHistory, matchCost, matchesPerRound, shuffle } from './pairing';

type Pair = [number, number];

/** Alle Partnerschaften (Topf 1 + Topf 2), die noch nicht gespielt wurden – in einer Reihenfolge, die Pausen gleichmäßig verteilt. */
function openPairs(t: Tournament, rng: Rng): Pair[] {
  const active = activePlayers(t);
  const p1 = shuffle(active.filter(p => p.pool === 1).map(p => p.id), rng);
  const p2 = shuffle(active.filter(p => p.pool === 2).map(p => p.id), rng);
  const played = new Set<string>();
  for (const r of t.rounds) for (const m of r.matches) for (const team of [m.teamA, m.teamB]) played.add(`${Math.min(...team)}-${Math.max(...team)}`);
  const small = p1.length <= p2.length ? p1 : p2;
  const large = p1.length <= p2.length ? p2 : p1;
  const swap = p1.length > p2.length;
  const out: Pair[] = [];
  // Schicht s: jeder aus dem kleineren Topf bekommt einen anderen Partner – in einer Schicht spielt also niemand doppelt
  for (let s = 0; s < large.length; s++) {
    for (let i = 0; i < small.length; i++) {
      const a = small[i]!, b = large[(i + s) % large.length]!;
      const pair: Pair = swap ? [b, a] : [a, b];
      if (!played.has(`${Math.min(...pair)}-${Math.max(...pair)}`)) out.push(pair);
    }
  }
  return out;
}

/** Alle noch ausstehenden Runden (die nächste eingeschlossen) für die aktiven Spieler. */
export function buildRibbonPlan(t: Tournament, rng: Rng = Math.random): Match[][] {
  const k = matchesPerRound(t);
  if (k === 0) return [];
  const queue = openPairs(t, rng);
  const rounds: Round[] = [];
  const plan: Match[][] = [];
  while (queue.length >= 2) {
    const used = new Set<number>();
    const take: number[] = [];
    for (let i = 0; i < queue.length && take.length < 2 * k; i++) {
      const [a, b] = queue[i]!;
      if (used.has(a) || used.has(b)) continue;
      used.add(a); used.add(b);
      take.push(i);
    }
    if (take.length % 2) take.pop();
    if (take.length < 2) break;
    const pairs = take.map(i => queue[i]!);
    for (let j = take.length - 1; j >= 0; j--) queue.splice(take[j]!, 1);

    // Gegner so zusammenstellen, dass möglichst wenige Gegnerschaften wiederholt werden
    const hist = buildHistory([...t.rounds, ...rounds]);
    let best: Pair[] | null = null;
    let bestCost = Infinity;
    for (let tries = 0; tries < 60 && bestCost > 0; tries++) {
      const order = shuffle(pairs, rng);
      let cost = 0;
      for (let m = 0; m < order.length; m += 2) cost += matchCost(order[m]!, order[m + 1]!, hist);
      if (cost < bestCost) { best = order; bestCost = cost; }
    }
    const order = best!;
    const matches: Match[] = [];
    for (let m = 0; m < order.length; m += 2) {
      matches.push({ court: m / 2 + 1, teamA: [...order[m]!], teamB: [...order[m + 1]!], winner: null, score: null });
    }
    plan.push(matches);
    rounds.push({ no: t.rounds.length + plan.length, matches, calledAt: 0 });
  }
  return plan;
}

/** Partnerschaften, die noch fehlen – 0 heißt: der Spielplan ist durch. */
export function openPairCount(t: Tournament): number {
  return openPairs(t, () => 0.5).length;
}

export const playersIn = (matches: readonly Match[]) => matches.flatMap(matchPlayers);
