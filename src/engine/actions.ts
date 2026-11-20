// Alle Änderungen am Turnier als reine Funktionen: Sie bekommen einen Stand und liefern einen
// neuen (der alte bleibt unverändert, das macht Rückgängig trivial). Unzulässiges wird mit
// einer deutschen Meldung als ActionError abgelehnt.

import {
  type Match,
  type Player,
  type Pool,
  type Settings,
  type Side,
  type Tournament,
  LIMITS,
  LOCKED_SETTINGS,
  matchPlayers,
  newTournament,
  teamSize,
  usesFixedTeams,
  usesPools,
} from './types';
import { type Rng, catchUpOffset, checkStart, completeFixedTeams, generateMatches, matchesPerRound } from './pairing';
import { sittingOut } from './ranking';
import { buildRibbonPlan, openPairCount } from './ribbon';

export class ActionError extends Error {}

const fail = (msg: string): never => { throw new ActionError(msg); };

function clone(t: Tournament): Tournament {
  return structuredClone(t);
}

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, LIMITS.nameMax);
}

function assertUniqueName(t: Tournament, name: string, exceptId?: number) {
  const key = name.toLocaleLowerCase('de');
  if (t.players.some(p => p.id !== exceptId && p.name.toLocaleLowerCase('de') === key)) {
    fail(`„${name}“ gibt es schon. Bitte den Namen unterscheidbar machen (z. B. „${name} B.“).`);
  }
}

function findPlayer(t: Tournament, id: number): Player {
  return t.players.find(p => p.id === id) ?? fail('Spieler nicht gefunden.');
}

function isScheduled(t: Tournament, id: number): boolean {
  return t.rounds.some(r => r.matches.some(m => matchPlayers(m).includes(id)));
}

// ---------- Einstellungen ----------

export function updateSettings(t: Tournament, patch: Partial<Settings>): Tournament {
  const next = clone(t);
  if (t.phase !== 'setup') {
    for (const key of LOCKED_SETTINGS) {
      if (key in patch && JSON.stringify(patch[key]) !== JSON.stringify(t.settings[key])) {
        fail('Das Turnierformat ist seit dem Start festgelegt und kann nicht mehr geändert werden.');
      }
    }
  }
  const s = { ...next.settings, ...patch };
  s.name = cleanName(s.name) || 'Turnier';
  s.courts = clampInt(s.courts, LIMITS.courtsMin, LIMITS.courtsMax);
  s.plannedRounds = clampInt(s.plannedRounds, LIMITS.roundsMin, LIMITS.roundsMax);
  s.poolLabels = [cleanName(s.poolLabels[0]) || 'Topf 1', cleanName(s.poolLabels[1]) || 'Topf 2'];
  next.settings = s;
  return next;
}

export function clampInt(v: number, min: number, max: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

// ---------- Spieler ----------

export function addPlayer(t: Tournament, rawName: string, pool: Pool, rng: Rng = Math.random): Tournament {
  const name = cleanName(rawName);
  if (!name) fail('Bitte einen Namen eingeben.');
  assertUniqueName(t, name);
  const next = clone(t);
  const player: Player = { id: next.nextPlayerId++, name, pool: usesPools(t.settings) ? pool : 1, active: true, fairnessOffset: 0 };
  next.players.push(player);
  if (next.phase !== 'setup') {
    player.fairnessOffset = catchUpOffset(next, player);
    if (usesFixedTeams(next.settings)) next.fixedTeams = completeFixedTeams(next.players, next.fixedTeams);
    return refreshDraft(next, rng);
  }
  return next;
}

/** Mehrere Namen auf einmal (eingefügte Liste, eine Zeile oder Komma je Name). */
export function addPlayers(t: Tournament, raw: string, pool: Pool, rng: Rng = Math.random): { t: Tournament; added: number; skipped: string[] } {
  const names = raw.split(/[\n,;\t]+/).map(cleanName).filter(Boolean);
  let cur = t;
  let added = 0;
  const skipped: string[] = [];
  for (const n of names) {
    try { cur = addPlayer(cur, n, pool, rng); added++; } catch (e) {
      if (e instanceof ActionError) skipped.push(n); else throw e;
    }
  }
  return { t: cur, added, skipped };
}

export function removePlayer(t: Tournament, id: number, rng: Rng = Math.random): Tournament {
  findPlayer(t, id);
  if (isScheduled(t, id)) fail('Wer schon gespielt hat, kann nicht gelöscht werden – bitte stattdessen auf „Pause“ setzen.');
  const next = clone(t);
  next.players = next.players.filter(p => p.id !== id);
  next.fixedTeams = next.fixedTeams.filter(team => !team.includes(id));
  if (next.phase !== 'setup') {
    if (usesFixedTeams(next.settings)) next.fixedTeams = completeFixedTeams(next.players, next.fixedTeams);
    resetEdits(next, id);
    return refreshDraft(next, rng);
  }
  return next;
}

export function renamePlayer(t: Tournament, id: number, rawName: string): Tournament {
  const name = cleanName(rawName);
  if (!name) fail('Der Name darf nicht leer sein.');
  assertUniqueName(t, name, id);
  const next = clone(t);
  findPlayer(next, id).name = name;
  return next;
}

export function setPool(t: Tournament, id: number, pool: Pool, rng: Rng = Math.random): Tournament {
  const next = clone(t);
  const p = findPlayer(next, id);
  if (p.pool === pool) return t;
  p.pool = pool;
  if (next.phase !== 'setup') {
    p.fairnessOffset = catchUpOffset(next, p);
    return refreshDraft(next, rng);
  }
  return next;
}

/** Reihenfolge ändern (bestimmt im Setup die festen Teams: 1+2, 3+4 …). */
export function movePlayer(t: Tournament, id: number, delta: number): Tournament {
  if (t.phase !== 'setup') fail('Die Reihenfolge ist nur vor dem Start änderbar.');
  const next = clone(t);
  const i = next.players.findIndex(p => p.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= next.players.length) return t;
  const [p] = next.players.splice(i, 1);
  next.players.splice(j, 0, p!);
  return next;
}

export function setActive(t: Tournament, id: number, active: boolean, rng: Rng = Math.random): Tournament {
  const next = clone(t);
  const p = findPlayer(next, id);
  if (p.active === active) return t;
  p.active = active;
  if (next.phase === 'setup') return next;
  if (active) p.fairnessOffset = catchUpOffset(next, p);
  resetEdits(next, id);
  return refreshDraft(next, rng);
}

/** Steht der Spieler in einer Auslosung, die von Hand geändert wurde, wird sie neu berechnet. */
function resetEdits(t: Tournament, id: number) {
  if (t.draft && t.draft.matches.some(m => matchPlayers(m).includes(id))) t.draft.edited = false;
  if (t.plan?.some(r => r.some(m => matchPlayers(m).includes(id)))) t.planEdited = false;
}

// ---------- Ablauf ----------

/** Schleifchenturnier: Rundenzahl, bis jeder aus Topf 1 mit jedem aus Topf 2 gespielt hat (hängt von Spielern und Feldern ab). */
export function ribbonRounds(t: Tournament): number {
  const n = buildRibbonPlan({ ...t, rounds: [] }, () => 0.5).length;
  return clampInt(n, LIMITS.roundsMin, LIMITS.roundsMax);
}

const isRibbon = (t: Tournament) => t.settings.ribbon && usesPools(t.settings);

/** Spielplan neu berechnen: erste Runde wird der Entwurf, der Rest der Plan. Danach passt die Rundenzahl. */
function rebuildPlan(t: Tournament, rng: Rng): Tournament {
  const rounds = buildRibbonPlan(t, rng);
  const first = rounds.shift();
  const next = { ...t, draft: first ? { matches: first, edited: false } : null, plan: rounds, planEdited: false };
  return syncPlanned(next);
}

function syncPlanned(t: Tournament): Tournament {
  if (t.plan === null) return t;
  const n = t.rounds.length + (t.draft ? 1 : 0) + t.plan.length;
  t.settings = { ...t.settings, plannedRounds: clampInt(n, LIMITS.roundsMin, LIMITS.roundsMax) };
  return t;
}

/** Der Spielplan ist ganz gespielt: keine Runde mehr offen. */
export function planDone(t: Tournament): boolean {
  return t.plan !== null && t.draft === null;
}

/** Schleifchenturnier: Sind in der letzten Runde alle Ergebnisse da, endet das Turnier von selbst. */
function maybeFinish(t: Tournament): Tournament {
  if (t.phase !== 'running' || !planDone(t)) return t;
  const last = t.rounds[t.rounds.length - 1];
  if (!last || last.matches.some(m => !m.winner)) return t;
  return finish(t);
}

export function start(t: Tournament, rng: Rng = Math.random, now = Date.now()): Tournament {
  if (t.phase !== 'setup') fail('Das Turnier läuft bereits.');
  const check = checkStart(t);
  if (check.errors.length) fail(check.errors.join('\n'));
  const next = clone(t);
  next.phase = 'running';
  next.startedAt = now;
  next.rounds = [];
  next.players.forEach(p => { p.fairnessOffset = 0; });
  next.fixedTeams = usesFixedTeams(next.settings) ? completeFixedTeams(next.players.filter(p => p.active), []) : [];
  next.draft = null;
  next.plan = null;
  next.planEdited = false;
  if (isRibbon(next)) return rebuildPlan(next, rng);
  return refreshDraft(next, rng);
}

/** Nächste Runde neu auslosen – automatisch nur, solange niemand sie von Hand geändert hat. */
export function refreshDraft(t: Tournament, rng: Rng = Math.random, force = false): Tournament {
  if (t.phase === 'setup') return t;
  if (t.plan !== null) {
    if ((t.draft?.edited || t.planEdited) && !force) return t;
    return rebuildPlan(t, rng);
  }
  if (t.draft?.edited && !force) return t;
  const next = { ...t };
  next.draft = { matches: generateMatches(next, rng), edited: false };
  return next;
}

export function reroll(t: Tournament, rng: Rng = Math.random): Tournament {
  if (t.phase !== 'running') fail('Das Turnier läuft nicht.');
  const next = refreshDraft(clone(t), rng, true);
  if (!next.draft?.matches.length) fail('Mit den aktiven Spielern ist keine Paarung möglich.');
  return next;
}

export function draftProblems(t: Tournament): string[] {
  if (planDone(t)) return [];
  const d = t.draft;
  if (!d || !d.matches.length) return ['Für die nächste Runde gibt es keine Paarung (zu wenige aktive Spieler?).'];
  const byId = new Map(t.players.map(p => [p.id, p]));
  const paused = d.matches.flatMap(matchPlayers).filter(id => !byId.get(id)?.active).map(id => byId.get(id)?.name ?? '?');
  return paused.length ? [`In der Auslosung stehen pausierende Spieler: ${paused.join(', ')}.`] : [];
}

/** Ausgeloste Runde auf die Felder rufen. */
export function callRound(t: Tournament, rng: Rng = Math.random, now = Date.now()): Tournament {
  if (t.phase !== 'running') fail('Das Turnier läuft nicht.');
  if (planDone(t)) fail('Alle Paarungen sind gespielt.');
  const problems = draftProblems(t);
  if (problems.length) fail(problems.join('\n'));
  const next = clone(t);
  next.rounds.push({ no: next.rounds.length + 1, matches: next.draft!.matches, calledAt: now });
  if (next.plan !== null) {
    const upcoming = next.plan.shift();
    next.draft = upcoming ? { matches: upcoming, edited: false } : null;
    return syncPlanned(next);
  }
  next.draft = null;
  return refreshDraft(next, rng);
}

export function finish(t: Tournament, now = Date.now()): Tournament {
  if (t.phase !== 'running') fail('Das Turnier läuft nicht.');
  const next = clone(t);
  next.phase = 'finished';
  next.finishedAt = now;
  return next;
}

export function resume(t: Tournament, rng: Rng = Math.random): Tournament {
  if (t.phase !== 'finished') return t;
  const next = clone(t);
  next.phase = 'running';
  next.finishedAt = null;
  if (next.plan !== null) {
    // fehlen noch Partnerschaften (z. B. neue Spieler), geht der Plan weiter; sonst wird frei weitergelost
    if (openPairCount(next) > 0) return rebuildPlan(next, rng);
    next.plan = null;
    next.planEdited = false;
    next.draft = null;
  }
  return refreshDraft(next, rng);
}

/** Neues Turnier; auf Wunsch mit denselben Spielern und Einstellungen (z. B. fürs nächste Jahr). */
export function freshTournament(t: Tournament, keepPlayers: boolean, now = Date.now()): Tournament {
  const next = newTournament(now);
  next.settings = { ...structuredClone(t.settings) };
  if (keepPlayers) {
    next.players = t.players.map((p, i) => ({ id: i + 1, name: p.name, pool: p.pool, active: true, fairnessOffset: 0 }));
    next.nextPlayerId = next.players.length + 1;
  }
  return next;
}

// ---------- Ergebnisse ----------

function findMatch(t: Tournament, roundNo: number, idx: number): Match {
  const r = t.rounds.find(r => r.no === roundNo) ?? fail(`Runde ${roundNo} nicht gefunden.`);
  return r.matches[idx] ?? fail('Match nicht gefunden.');
}

export function setWinner(t: Tournament, roundNo: number, idx: number, winner: Side | null): Tournament {
  const next = clone(t);
  const m = findMatch(next, roundNo, idx);
  m.winner = winner;
  if (!winner || (m.score && (m.score[0] > m.score[1] ? 'A' : 'B') !== winner)) m.score = null;
  return maybeFinish(next);
}

export function setScore(t: Tournament, roundNo: number, idx: number, a: number, b: number): Tournament {
  if (!t.settings.scoreTracking) fail('Punkte werden in diesem Turnier nicht erfasst.');
  for (const v of [a, b]) {
    if (!Number.isInteger(v) || v < 0 || v > LIMITS.scoreMax) fail(`Punkte bitte als ganze Zahl von 0 bis ${LIMITS.scoreMax}.`);
  }
  if (a === b) fail('Unentschieden gibt es nicht – bitte den Sieger mit einem Punkt Vorsprung eintragen.');
  const next = clone(t);
  const m = findMatch(next, roundNo, idx);
  m.score = [a, b];
  m.winner = a > b ? 'A' : 'B';
  return maybeFinish(next);
}

// ---------- Paarungen von Hand ändern ----------

export type RoundRef = { kind: 'draft' } | { kind: 'plan'; i: number } | { kind: 'round'; no: number };

function matchesOf(t: Tournament, ref: RoundRef): Match[] {
  if (ref.kind === 'draft') return t.draft?.matches ?? fail('Keine Auslosung vorhanden.');
  if (ref.kind === 'plan') return t.plan?.[ref.i] ?? fail('Runde nicht gefunden.');
  return (t.rounds.find(r => r.no === ref.no) ?? fail(`Runde ${ref.no} nicht gefunden.`)).matches;
}

/**
 * Setzt einen Spieler auf einen Platz. Steht er in derselben Runde schon woanders,
 * tauschen beide die Plätze – so kann niemand doppelt in einer Runde stehen.
 */
export function placePlayer(t: Tournament, ref: RoundRef, idx: number, side: Side, slot: number, playerId: number): Tournament {
  findPlayer(t, playerId);
  const next = clone(t);
  const matches = matchesOf(next, ref);
  const m = matches[idx] ?? fail('Match nicht gefunden.');
  const team = side === 'A' ? m.teamA : m.teamB;
  if (slot < 0 || slot >= team.length) fail('Ungültiger Platz.');
  const current = team[slot]!;
  if (current === playerId) return t;
  for (const other of matches) {
    for (const ot of [other.teamA, other.teamB]) {
      const j = ot.indexOf(playerId);
      if (j >= 0) ot[j] = current;
    }
  }
  team[slot] = playerId;
  markEdited(next, ref);
  return next;
}

function markEdited(t: Tournament, ref: RoundRef) {
  if (ref.kind === 'draft') t.draft!.edited = true;
  else if (ref.kind === 'plan') t.planEdited = true;
}

export function removeMatch(t: Tournament, ref: RoundRef, idx: number): Tournament {
  const next = clone(t);
  const matches = matchesOf(next, ref);
  if (!matches[idx]) fail('Match nicht gefunden.');
  matches.splice(idx, 1);
  if (ref.kind === 'plan' && matches.length === 0) next.plan!.splice(ref.i, 1);
  markEdited(next, ref);
  if (ref.kind === 'round' && matches.length === 0) return deleteRound(next, ref.no);
  return syncPlanned(next);
}

/** Zusätzliches Match in der Auslosung aus pausierenden Spielern, falls ein Feld frei ist. */
export function addDraftMatch(t: Tournament): Tournament {
  const d = t.draft ?? fail('Keine Auslosung vorhanden.');
  const used = new Set(d.matches.map(m => m.court));
  const court = Array.from({ length: t.settings.courts }, (_, i) => i + 1).find(c => !used.has(c));
  if (court === undefined) fail('Alle Felder sind schon belegt.');
  const free = sittingOut(t, d).map(p => p.id);
  const n = teamSize(t.settings);
  if (free.length < 2 * n) fail('Es pausieren nicht genug Spieler für ein weiteres Match.');
  const next = clone(t);
  next.draft!.matches.push({ court: court!, teamA: free.slice(0, n), teamB: free.slice(n, 2 * n), winner: null, score: null });
  next.draft!.matches.sort((a, b) => a.court - b.court);
  next.draft!.edited = true;
  return next;
}

export function deleteRound(t: Tournament, no: number): Tournament {
  const next = clone(t);
  if (!next.rounds.some(r => r.no === no)) fail(`Runde ${no} nicht gefunden.`);
  next.rounds = next.rounds.filter(r => r.no !== no);
  next.rounds.forEach((r, i) => { r.no = i + 1; });
  return next;
}

export function freeCourts(t: Tournament): number {
  return t.draft ? t.settings.courts - t.draft.matches.length : 0;
}

export { matchesPerRound };
