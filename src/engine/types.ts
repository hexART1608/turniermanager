// Datenmodell des Turniers. Reine Daten (JSON-fähig), damit Speichern, Export und
// Beamer-Fenster denselben Stand ohne Umwandlung lesen können.

export type Discipline = 'doubles' | 'singles';

/**
 * Paarung im Doppel:
 * - pools:  je Team ein Spieler aus Topf 1 und einer aus Topf 2 (Geübt + Gast, Mixed …)
 * - random: ein Topf, Partner wechseln jede Runde
 * - fixed:  feste Teams für das ganze Turnier
 */
export type DoublesPairing = 'pools' | 'random' | 'fixed';

export type Pool = 1 | 2;
export type Side = 'A' | 'B';
export type Phase = 'setup' | 'running' | 'finished';

export interface Settings {
  name: string;
  discipline: Discipline;
  pairing: DoublesPairing;
  poolLabels: [string, string];
  courts: number;
  /** Ziel für die Rundenzahl, darf während des Turniers erhöht oder gesenkt werden. */
  plannedRounds: number;
  scoreTracking: boolean;
  /** Schleifchenturnier: jedes Paar aus Topf 1 + 2 spielt einmal, die Rundenzahl ergibt sich aus der Spielerzahl. */
  ribbon: boolean;
}

export interface Player {
  id: number;
  name: string;
  pool: Pool;
  active: boolean;
  /**
   * Ausgleich für spätere Einsteiger und Rückkehrer: zählt bei der Auslosung wie bereits
   * gespielte Spiele, damit niemand mehrere Runden am Stück „nachholen“ muss.
   * Fließt NICHT in die Rangliste ein.
   */
  fairnessOffset: number;
}

export interface Match {
  court: number;
  teamA: number[];
  teamB: number[];
  winner: Side | null;
  score: [number, number] | null;
}

export interface Round {
  no: number;
  matches: Match[];
  calledAt: number;
}

export interface Draft {
  matches: Match[];
  /** von Hand geändert – wird dann nicht mehr automatisch neu ausgelost */
  edited: boolean;
}

export interface Tournament {
  version: 1;
  phase: Phase;
  settings: Settings;
  players: Player[];
  nextPlayerId: number;
  fixedTeams: [number, number][];
  rounds: Round[];
  draft: Draft | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

/** Einstellungen, die nach dem Start nicht mehr geändert werden dürfen. */
export const LOCKED_SETTINGS = ['discipline', 'pairing', 'poolLabels', 'courts', 'scoreTracking', 'ribbon'] as const;

export const LIMITS = {
  courtsMin: 1,
  courtsMax: 12,
  roundsMin: 1,
  roundsMax: 99,
  nameMax: 40,
  scoreMax: 99,
  matchSecondsMin: 10,
  matchSecondsMax: 99 * 60 + 59,
} as const;

export function defaultSettings(): Settings {
  return {
    name: 'Badminton-Turnier',
    discipline: 'doubles',
    pairing: 'pools',
    poolLabels: ['Geübte', 'Gäste'],
    courts: 2,
    plannedRounds: 12,
    scoreTracking: false,
    ribbon: true,
  };
}

export function newTournament(now = Date.now()): Tournament {
  return {
    version: 1,
    phase: 'setup',
    settings: defaultSettings(),
    players: [],
    nextPlayerId: 1,
    fixedTeams: [],
    rounds: [],
    draft: null,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
  };
}

export function teamSize(s: Settings): number {
  return s.discipline === 'singles' ? 1 : 2;
}

export function usesPools(s: Settings): boolean {
  return s.discipline === 'doubles' && s.pairing === 'pools';
}

export function usesFixedTeams(s: Settings): boolean {
  return s.discipline === 'doubles' && s.pairing === 'fixed';
}

export function matchPlayers(m: Match): number[] {
  return [...m.teamA, ...m.teamB];
}
