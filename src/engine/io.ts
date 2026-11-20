// Export/Import und Prüfung gespeicherter Stände. Alles, was von außen kommt (Datei,
// localStorage), läuft durch parseTournament: unbekannte oder kaputte Felder werden
// verworfen statt die App zum Absturz zu bringen. Exporte der alten Einzeldatei-App
// werden erkannt und umgewandelt.

import {
  type DoublesPairing,
  type Match,
  type Phase,
  type Player,
  type Round,
  type Settings,
  type Side,
  type Tournament,
  LIMITS,
  defaultSettings,
  newTournament,
} from './types';
import { clampInt, cleanName } from './actions';

export const EXPORT_APP = 'turniermanager';

export interface ExportFile {
  app: typeof EXPORT_APP;
  format: 1;
  exportedAt: string;
  tournament: Tournament;
}

export function toExport(t: Tournament, now = new Date()): ExportFile {
  return { app: EXPORT_APP, format: 1, exportedAt: now.toISOString(), tournament: t };
}

export class ImportError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : null);

function parseSide(v: unknown): Side | null {
  return v === 'A' || v === 'B' ? v : null;
}

function parseScore(v: unknown, winner: Side | null): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const a = int(v[0]), b = int(v[1]);
  if (a === null || b === null || a === b || a > LIMITS.scoreMax || b > LIMITS.scoreMax) return null;
  if (winner && (a > b ? 'A' : 'B') !== winner) return null;
  return [a, b];
}

function parseTeam(v: unknown, ids: Set<number>, size: number): number[] | null {
  if (!Array.isArray(v) || v.length !== size) return null;
  const team = v.map(int);
  if (team.some(id => id === null || !ids.has(id))) return null;
  return team as number[];
}

function parseMatches(v: unknown, ids: Set<number>, size: number, courts: number): Match[] {
  if (!Array.isArray(v)) return [];
  const out: Match[] = [];
  const used = new Set<number>();
  const usedCourts = new Set<number>();
  v.forEach((raw, i) => {
    if (!isObj(raw)) return;
    const teamA = parseTeam(raw.teamA, ids, size);
    const teamB = parseTeam(raw.teamB, ids, size);
    if (!teamA || !teamB) return;
    const all = [...teamA, ...teamB];
    if (new Set(all).size !== all.length || all.some(id => used.has(id))) return;
    all.forEach(id => used.add(id));
    const winner = parseSide(raw.winner);
    let court = int(raw.court) ?? int(raw.field) ?? i + 1;
    if (court < 1 || court > courts || usedCourts.has(court)) {
      const free = Array.from({ length: courts }, (_, c) => c + 1).find(c => !usedCourts.has(c));
      if (free === undefined) return; // mehr Matches als Felder: Rest verwerfen
      court = free;
    }
    usedCourts.add(court);
    out.push({ court, teamA, teamB, winner, score: parseScore(raw.score, winner) });
  });
  return out;
}

function parseSettings(v: unknown): Settings {
  const d = defaultSettings();
  if (!isObj(v)) return d;
  const labels = Array.isArray(v.poolLabels) ? v.poolLabels : [];
  const pairing: DoublesPairing = v.pairing === 'random' || v.pairing === 'fixed' ? v.pairing : 'pools';
  return {
    name: typeof v.name === 'string' && cleanName(v.name) ? cleanName(v.name) : d.name,
    discipline: v.discipline === 'singles' ? 'singles' : 'doubles',
    pairing,
    poolLabels: [
      typeof labels[0] === 'string' && cleanName(labels[0]) ? cleanName(labels[0]) : d.poolLabels[0],
      typeof labels[1] === 'string' && cleanName(labels[1]) ? cleanName(labels[1]) : d.poolLabels[1],
    ],
    courts: clampInt(int(v.courts) ?? d.courts, LIMITS.courtsMin, LIMITS.courtsMax),
    plannedRounds: clampInt(int(v.plannedRounds) ?? d.plannedRounds, LIMITS.roundsMin, LIMITS.roundsMax),
    scoreTracking: v.scoreTracking === true,
    ribbon: typeof v.ribbon === 'boolean' ? v.ribbon : pairing === 'pools' && !(labels[0] === 'Damen' && labels[1] === 'Herren'),
  };
}

function parsePlayers(v: unknown): Player[] {
  if (!Array.isArray(v)) return [];
  const out: Player[] = [];
  const seenIds = new Set<number>();
  const seenNames = new Set<string>();
  for (const raw of v) {
    if (!isObj(raw)) continue;
    const id = int(raw.id);
    let name = typeof raw.name === 'string' ? cleanName(raw.name) : '';
    if (id === null || id < 1 || seenIds.has(id) || !name) continue;
    // doppelte Namen eindeutig machen statt Spieler zu verlieren
    for (let n = 2; seenNames.has(name.toLocaleLowerCase('de')); n++) name = `${cleanName(String(raw.name)).slice(0, LIMITS.nameMax - 3)} ${n}`;
    seenIds.add(id);
    seenNames.add(name.toLocaleLowerCase('de'));
    const active = raw.active === undefined ? raw.isActive !== false : raw.active !== false;
    out.push({ id, name, pool: raw.pool === 2 || raw.pool === '2' ? 2 : 1, active, fairnessOffset: Math.max(0, int(raw.fairnessOffset) ?? 0) });
  }
  return out;
}

function finishParse(base: { settings: Settings; players: Player[]; rawRounds: unknown; rawDraft: unknown; rawPlan?: unknown; rawFixed: unknown; phase: unknown; times: Obj }): Tournament {
  const { settings, players } = base;
  const ids = new Set(players.map(p => p.id));
  const size = settings.discipline === 'singles' ? 1 : 2;
  const rounds: Round[] = [];
  if (Array.isArray(base.rawRounds)) {
    for (const raw of base.rawRounds) {
      if (!isObj(raw)) continue;
      const matches = parseMatches(raw.matches, ids, size, settings.courts);
      if (matches.length) rounds.push({ no: rounds.length + 1, matches, calledAt: int(raw.calledAt) ?? 0 });
    }
  }
  let draft: Tournament['draft'] = null;
  if (isObj(base.rawDraft)) {
    draft = { matches: parseMatches(base.rawDraft.matches, ids, size, settings.courts).map(m => ({ ...m, winner: null, score: null })), edited: base.rawDraft.edited === true };
  }
  let plan: Tournament['plan'] = null;
  if (Array.isArray(base.rawPlan)) {
    plan = base.rawPlan
      .map(r => parseMatches(isObj(r) ? r.matches : r, ids, size, settings.courts).map(m => ({ ...m, winner: null, score: null })))
      .filter(r => r.length);
  }
  const fixedTeams: [number, number][] = [];
  if (Array.isArray(base.rawFixed)) {
    const used = new Set<number>();
    for (const raw of base.rawFixed) {
      const team = parseTeam(raw, ids, 2);
      if (team && team[0] !== team[1] && !used.has(team[0]!) && !used.has(team[1]!)) {
        fixedTeams.push([team[0]!, team[1]!]);
        used.add(team[0]!); used.add(team[1]!);
      }
    }
  }
  let phase: Phase = base.phase === 'running' || base.phase === 'finished' ? base.phase : 'setup';
  if (phase === 'setup' && rounds.length) phase = 'running';
  const t = newTournament(int(base.times.createdAt) ?? Date.now());
  return {
    ...t,
    phase,
    settings,
    players,
    nextPlayerId: Math.max(int(base.times.nextPlayerId) ?? 1, ...players.map(p => p.id + 1), 1),
    fixedTeams,
    rounds,
    draft: phase === 'setup' ? null : draft,
    plan: phase === 'setup' || !settings.ribbon ? null : plan,
    planEdited: phase !== 'setup' && base.times.planEdited === true,
    startedAt: phase === 'setup' ? null : int(base.times.startedAt) ?? t.createdAt,
    finishedAt: phase === 'finished' ? int(base.times.finishedAt) ?? Date.now() : null,
  };
}

/** Stand aus eigenem Format lesen (localStorage oder Export). */
export function parseTournament(v: unknown): Tournament {
  if (!isObj(v) || v.version !== 1 || !isObj(v.settings)) throw new ImportError('Unbekanntes Datenformat.');
  return finishParse({
    settings: parseSettings(v.settings),
    players: parsePlayers(v.players),
    rawRounds: v.rounds,
    rawDraft: v.draft,
    rawPlan: v.plan,
    rawFixed: v.fixedTeams,
    phase: v.phase,
    times: v,
  });
}

/** Export der alten Einzeldatei-App (Felder mode/teamType/poolCount, Runden mit id). */
export function isLegacy(v: unknown): v is Obj {
  return isObj(v) && Array.isArray(v.players) && Array.isArray(v.rounds) && ('mode' in v || 'teamType' in v);
}

export function fromLegacy(v: Obj): Tournament {
  const singles = v.mode === '1v1';
  const pairing: DoublesPairing = v.teamType === 'fixed' ? 'fixed' : int(v.poolCount) === 1 ? 'random' : 'pools';
  const legacyRounds = v.rounds as unknown[];
  const maxMatches = Math.max(1, ...legacyRounds.map(r => (isObj(r) && Array.isArray(r.matches) ? r.matches.length : 0)));
  const settings: Settings = {
    ...defaultSettings(),
    discipline: singles ? 'singles' : 'doubles',
    pairing,
    courts: clampInt(Math.max(2, maxMatches), LIMITS.courtsMin, LIMITS.courtsMax),
    plannedRounds: clampInt(Math.max(int(v.roundCount) ?? 0, (v.rounds as unknown[]).length, 1), LIMITS.roundsMin, LIMITS.roundsMax),
    scoreTracking: v.scoreTracking === true,
  };
  // In der alten App standen alle Spieler einer Runde zusammen; Feldnummern waren frei.
  const rounds = (v.rounds as unknown[]).map(r => (isObj(r) && Array.isArray(r.matches)
    ? { matches: r.matches.map((m, i) => (isObj(m) ? { ...m, court: i + 1 } : m)) }
    : r));
  return finishParse({
    settings,
    players: parsePlayers(v.players),
    rawRounds: rounds,
    rawDraft: null,
    rawFixed: v.fixedTeams,
    phase: (v.rounds as unknown[]).length ? 'running' : 'setup',
    times: { nextPlayerId: v.nextPlayerId },
  });
}

/** Inhalt einer importierten Datei in ein Turnier verwandeln. */
export function importText(text: string): { tournament: Tournament; legacy: boolean; timerSeconds: number | null } {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new ImportError('Die Datei ist kein gültiges JSON.'); }
  if (isObj(data) && data.app === EXPORT_APP) {
    return { tournament: parseTournament(data.tournament), legacy: false, timerSeconds: null };
  }
  if (isLegacy(data)) {
    const secs = int(data.timerDuration);
    return { tournament: fromLegacy(data), legacy: true, timerSeconds: secs && secs > 0 ? secs : null };
  }
  throw new ImportError('Die Datei stammt nicht vom Turniermanager.');
}
