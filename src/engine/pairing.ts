// Auslosung einer Runde. Eine Runde = ein Timer-Durchgang: höchstens so viele Matches wie
// Felder. Wer spielt, wird nach Fairness ausgewählt (wenigste Spiele zuerst, dann wer am
// längsten pausiert, dann Zufall). Danach werden aus vielen zufälligen Aufteilungen die mit
// den wenigsten Wiederholungen von Partnern und Gegnern genommen (Regeln der alten App).

import {
  type Match,
  type Player,
  type Round,
  type Settings,
  type Tournament,
  matchPlayers,
  usesFixedTeams,
  usesPools,
} from './types';

export type Rng = () => number;

/** Wie oft dieselbe Partnerschaft schwerer wiegt als dieselbe Gegnerschaft (alte App: 3). */
export const PARTNER_WEIGHT = 3;
const TRIES = 400;

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Angesetzte Spiele je Spieler – auch ohne Ergebnis, damit Vorausplanung fair bleibt. */
export function scheduledCounts(rounds: readonly Round[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const r of rounds) for (const m of r.matches) for (const id of matchPlayers(m)) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export interface History {
  with(a: number, b: number): number;
  against(a: number, b: number): number;
}

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export function buildHistory(rounds: readonly Round[]): History {
  const withMap = new Map<string, number>();
  const againstMap = new Map<string, number>();
  const inc = (map: Map<string, number>, a: number, b: number) => {
    const k = pairKey(a, b);
    map.set(k, (map.get(k) ?? 0) + 1);
  };
  for (const r of rounds) for (const m of r.matches) {
    for (const team of [m.teamA, m.teamB]) {
      for (let i = 0; i < team.length; i++) for (let j = i + 1; j < team.length; j++) inc(withMap, team[i]!, team[j]!);
    }
    for (const a of m.teamA) for (const b of m.teamB) inc(againstMap, a, b);
  }
  return {
    with: (a, b) => withMap.get(pairKey(a, b)) ?? 0,
    against: (a, b) => againstMap.get(pairKey(a, b)) ?? 0,
  };
}

export function matchCost(teamA: readonly number[], teamB: readonly number[], hist: History): number {
  let cost = 0;
  for (const team of [teamA, teamB]) {
    for (let i = 0; i < team.length; i++) for (let j = i + 1; j < team.length; j++) {
      cost += PARTNER_WEIGHT * hist.with(team[i]!, team[j]!);
    }
  }
  for (const a of teamA) for (const b of teamB) cost += hist.against(a, b);
  return cost;
}

/** Zweimal hintereinander spielen kostet etwas – weniger als eine wiederholte Partnerschaft. */
export const BACK_TO_BACK_WEIGHT = 1;

interface FairCtx {
  counts: Map<number, number>;
  /** wer in der zuletzt aufgerufenen Runde gespielt hat */
  previous: Set<number>;
}

function fairCtx(rounds: readonly Round[]): FairCtx {
  const lastRound = rounds[rounds.length - 1];
  return { counts: scheduledCounts(rounds), previous: new Set(lastRound ? lastRound.matches.flatMap(matchPlayers) : []) };
}

export function effectiveCount(p: Player, ctx: FairCtx): number {
  return (ctx.counts.get(p.id) ?? 0) + p.fairnessOffset;
}

/**
 * Die n fairsten: wer weniger Spiele hat, ist sicher dabei. Bei Gleichstand entscheidet der
 * Zufall – bei jedem Versuch neu, damit die Kostenrechnung die beste Auswahl finden kann.
 */
function pickFair<T>(items: readonly T[], countOf: (x: T) => number, n: number, rng: Rng): T[] {
  return items
    .map(x => ({ x, c: countOf(x), r: rng() }))
    .sort((a, b) => a.c - b.c || a.r - b.r)
    .slice(0, n)
    .map(t => t.x);
}

function backToBack(ids: readonly number[], ctx: FairCtx): number {
  return BACK_TO_BACK_WEIGHT * ids.filter(id => ctx.previous.has(id)).length;
}

function bestOf(buildFn: () => { matches: Match[]; cost: number }): Match[] {
  let best: { matches: Match[]; cost: number } | null = null;
  for (let t = 0; t < TRIES; t++) {
    const c = buildFn();
    if (!best || c.cost < best.cost) best = c;
    if (best.cost === 0) break;
  }
  return best ? best.matches : [];
}

const newMatch = (court: number, teamA: number[], teamB: number[]): Match =>
  ({ court, teamA, teamB, winner: null, score: null });

export function activePlayers(t: Tournament): Player[] {
  return t.players.filter(p => p.active);
}

/** Feste Teams, in denen beide Spieler aktiv sind. */
export function playableTeams(t: Tournament): [number, number][] {
  const active = new Set(activePlayers(t).map(p => p.id));
  return t.fixedTeams.filter(team => team.every(id => active.has(id)));
}

/** Wie viele Matches pro Runde mit den aktiven Spielern möglich sind. */
export function matchesPerRound(t: Tournament): number {
  const s = t.settings;
  const active = activePlayers(t);
  if (s.discipline === 'singles') return Math.min(s.courts, Math.floor(active.length / 2));
  if (usesFixedTeams(s)) return Math.min(s.courts, Math.floor(playableTeams(t).length / 2));
  if (usesPools(s)) {
    const p1 = active.filter(p => p.pool === 1).length;
    const p2 = active.filter(p => p.pool === 2).length;
    return Math.min(s.courts, Math.floor(p1 / 2), Math.floor(p2 / 2));
  }
  return Math.min(s.courts, Math.floor(active.length / 4));
}

/** Erzeugt die Matches der nächsten Runde auf Basis der bereits aufgerufenen Runden. */
export function generateMatches(t: Tournament, rng: Rng = Math.random): Match[] {
  const s = t.settings;
  const k = matchesPerRound(t);
  if (k === 0) return [];
  const ctx = fairCtx(t.rounds);
  const hist = buildHistory(t.rounds);
  const count = (p: Player) => effectiveCount(p, ctx);
  const active = activePlayers(t);
  const courts = shuffle(Array.from({ length: s.courts }, (_, i) => i + 1), rng).slice(0, k).sort((a, b) => a - b);

  if (s.discipline === 'singles') {
    return bestOf(() => {
      const x = shuffle(pickFair(active, count, 2 * k, rng), rng);
      const matches: Match[] = [];
      let cost = backToBack(x.map(p => p.id), ctx);
      for (let m = 0; m < k; m++) {
        const a = [x[2 * m]!.id], b = [x[2 * m + 1]!.id];
        matches.push(newMatch(courts[m]!, a, b));
        cost += matchCost(a, b, hist);
      }
      return { matches, cost };
    });
  }

  if (usesFixedTeams(s)) {
    const byId = new Map(t.players.map(p => [p.id, p]));
    const teamCount = (team: [number, number]) => Math.max(count(byId.get(team[0])!), count(byId.get(team[1])!));
    const teams = playableTeams(t);
    return bestOf(() => {
      const x = shuffle(pickFair(teams, teamCount, 2 * k, rng), rng);
      const matches: Match[] = [];
      let cost = backToBack(x.flat(), ctx);
      for (let m = 0; m < k; m++) {
        const a = [...x[2 * m]!], b = [...x[2 * m + 1]!];
        matches.push(newMatch(courts[m]!, a, b));
        cost += matchCost(a, b, hist);
      }
      return { matches, cost };
    });
  }

  if (usesPools(s)) {
    const pool1 = active.filter(p => p.pool === 1);
    const pool2 = active.filter(p => p.pool === 2);
    return bestOf(() => {
      const a = shuffle(pickFair(pool1, count, 2 * k, rng), rng);
      const b = shuffle(pickFair(pool2, count, 2 * k, rng), rng);
      const matches: Match[] = [];
      let cost = backToBack([...a, ...b].map(p => p.id), ctx);
      for (let m = 0; m < k; m++) {
        const x1 = a[2 * m]!.id, x2 = a[2 * m + 1]!.id, y1 = b[2 * m]!.id, y2 = b[2 * m + 1]!.id;
        const c1 = matchCost([x1, y1], [x2, y2], hist);
        const c2 = matchCost([x1, y2], [x2, y1], hist);
        const first = c1 < c2 || (c1 === c2 && rng() < 0.5);
        matches.push(first ? newMatch(courts[m]!, [x1, y1], [x2, y2]) : newMatch(courts[m]!, [x1, y2], [x2, y1]));
        cost += Math.min(c1, c2);
      }
      return { matches, cost };
    });
  }

  return bestOf(() => {
    const x = shuffle(pickFair(active, count, 4 * k, rng), rng);
    const matches: Match[] = [];
    let cost = backToBack(x.map(p => p.id), ctx);
    for (let m = 0; m < k; m++) {
      const a = [x[4 * m]!.id, x[4 * m + 1]!.id], b = [x[4 * m + 2]!.id, x[4 * m + 3]!.id];
      matches.push(newMatch(courts[m]!, a, b));
      cost += matchCost(a, b, hist);
    }
    return { matches, cost };
  });
}

/** Feste Teams aus der Spielerreihenfolge (1+2, 3+4 …); bestehende Teams bleiben erhalten. */
export function completeFixedTeams(players: readonly Player[], teams: readonly [number, number][]): [number, number][] {
  const exists = new Set(players.map(p => p.id));
  const kept = teams.filter(team => team.every(id => exists.has(id)));
  const inTeam = new Set(kept.flat());
  const unpaired = players.filter(p => !inTeam.has(p.id));
  const result = kept.map(t => [t[0], t[1]] as [number, number]);
  for (let i = 0; i + 1 < unpaired.length; i += 2) result.push([unpaired[i]!.id, unpaired[i + 1]!.id]);
  return result;
}

/** Ausgleich für einen Spieler, der (wieder) einsteigt: so viele Spiele wie der Schwächste seiner Gruppe. */
export function catchUpOffset(t: Tournament, player: Player): number {
  const ctx = fairCtx(t.rounds);
  const peers = activePlayers(t).filter(p => p.id !== player.id && (!usesPools(t.settings) || p.pool === player.pool));
  if (peers.length === 0) return player.fairnessOffset;
  const min = Math.min(...peers.map(p => effectiveCount(p, ctx)));
  const own = ctx.counts.get(player.id) ?? 0;
  return Math.max(player.fairnessOffset, min - own);
}

export interface StartCheck {
  errors: string[];
  warnings: string[];
  matchesPerRound: number;
  sittingOut: number;
}

export function checkStart(t: Tournament): StartCheck {
  const s: Settings = t.settings;
  const errors: string[] = [];
  const warnings: string[] = [];
  const active = activePlayers(t);
  const names = new Map<string, number>();
  for (const p of t.players) names.set(p.name.toLocaleLowerCase('de'), (names.get(p.name.toLocaleLowerCase('de')) ?? 0) + 1);
  const dupes = [...names.entries()].filter(([, n]) => n > 1).map(([n]) => n);
  if (dupes.length) errors.push(`Namen doppelt vergeben: ${dupes.join(', ')}`);

  if (s.discipline === 'singles') {
    if (active.length < 2) errors.push('Für Einzel werden mindestens 2 Spieler gebraucht.');
  } else if (usesPools(s)) {
    const p1 = active.filter(p => p.pool === 1).length;
    const p2 = active.filter(p => p.pool === 2).length;
    if (p1 < 2 || p2 < 2) {
      errors.push(`Jeder Topf braucht mindestens 2 Spieler (${s.poolLabels[0]}: ${p1}, ${s.poolLabels[1]}: ${p2}).`);
    } else if (p1 !== p2) {
      warnings.push(`Die Töpfe sind ungleich groß (${s.poolLabels[0]}: ${p1}, ${s.poolLabels[1]}: ${p2}) – aus dem größeren Topf pausieren öfter Spieler.`);
    }
  } else if (usesFixedTeams(s)) {
    if (active.length % 2 !== 0) errors.push(`Für feste Teams wird eine gerade Spielerzahl benötigt (aktuell ${active.length}).`);
    else if (active.length < 4) errors.push('Für feste Teams werden mindestens 4 Spieler (2 Teams) gebraucht.');
  } else if (active.length < 4) {
    errors.push('Für Doppel werden mindestens 4 Spieler gebraucht.');
  }

  const probe = usesFixedTeams(s) ? { ...t, fixedTeams: completeFixedTeams(active, t.fixedTeams) } : t;
  const k = errors.length ? 0 : matchesPerRound(probe);
  const playing = k * (s.discipline === 'singles' ? 2 : 4);
  const sittingOut = Math.max(0, active.length - playing);
  if (!errors.length && k < s.courts) {
    warnings.push(`Mit diesen Spielern sind nur ${k} von ${s.courts} Feldern pro Runde belegt.`);
  }
  return { errors, warnings, matchesPerRound: k, sittingOut };
}
