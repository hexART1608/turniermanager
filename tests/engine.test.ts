import { describe, expect, it } from 'vitest';
import * as A from '../src/engine/actions';
import { buildHistory, checkStart, generateMatches, scheduledCounts } from '../src/engine/pairing';
import { standings, stats } from '../src/engine/ranking';
import { importText, parseTournament, toExport } from '../src/engine/io';
import { type Settings, type Tournament, matchPlayers, newTournament } from '../src/engine/types';

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setup(settings: Partial<Settings>, pool1: number, pool2 = 0, seed = 1): Tournament {
  const r = rng(seed);
  let t = A.updateSettings(newTournament(0), settings);
  for (let i = 0; i < pool1; i++) t = A.addPlayer(t, `G${i + 1}`, 1, r);
  for (let i = 0; i < pool2; i++) t = A.addPlayer(t, `Gast${i + 1}`, 2, r);
  return t;
}

function play(t: Tournament, rounds: number, seed = 7): Tournament {
  const r = rng(seed);
  let cur = t.phase === 'setup' ? A.start(t, r, 0) : t;
  for (let i = 0; i < rounds; i++) {
    cur = A.callRound(cur, r, i);
    const no = cur.rounds.length;
    cur.rounds[no - 1]!.matches.forEach((_, idx) => { cur = A.setWinner(cur, no, idx, r() < 0.5 ? 'A' : 'B'); });
  }
  return cur;
}

function assertRoundValid(t: Tournament) {
  for (const r of t.rounds) {
    const ids = r.matches.flatMap(matchPlayers);
    expect(new Set(ids).size).toBe(ids.length);
    expect(r.matches.length).toBeLessThanOrEqual(t.settings.courts);
    const courts = r.matches.map(m => m.court);
    expect(new Set(courts).size).toBe(courts.length);
    courts.forEach(c => expect(c).toBeGreaterThanOrEqual(1));
    courts.forEach(c => expect(c).toBeLessThanOrEqual(t.settings.courts));
  }
}

function spread(t: Tournament, pool?: 1 | 2) {
  const counts = scheduledCounts(t.rounds);
  const vals = t.players.filter(p => p.active && (!pool || p.pool === pool)).map(p => counts.get(p.id) ?? 0);
  return Math.max(...vals) - Math.min(...vals);
}

describe('Auslosung mit zwei Töpfen (Geübte + Gäste)', () => {
  it('paart immer einen Geübten mit einem Gast, 2 Felder, fair verteilt', () => {
    const t = play(setup({}, 7, 9), 15);
    assertRoundValid(t);
    const pool = new Map(t.players.map(p => [p.id, p.pool]));
    for (const r of t.rounds) {
      expect(r.matches.length).toBe(2);
      for (const m of r.matches) for (const team of [m.teamA, m.teamB]) {
        expect(team.map(id => pool.get(id)).sort()).toEqual([1, 2]);
      }
    }
    expect(spread(t, 1)).toBeLessThanOrEqual(1);
    expect(spread(t, 2)).toBeLessThanOrEqual(1);
  });

  it('wiederholt Partnerschaften erst, wenn es nicht anders geht', () => {
    // 4×4 Spieler, 1 Feld: 16 mögliche Paare, 6 Runden × 2 Teams = 12 Paare → keine Wiederholung nötig
    const t = play(setup({ courts: 1 }, 4, 4), 6);
    const hist = buildHistory(t.rounds);
    for (const a of t.players) for (const b of t.players) {
      if (a.id < b.id) expect(hist.with(a.id, b.id)).toBeLessThanOrEqual(1);
    }
  });

  it('weist Felder 1 und 2 zu', () => {
    const t = play(setup({}, 4, 4), 1);
    expect(t.rounds[0]!.matches.map(m => m.court)).toEqual([1, 2]);
  });
});

describe('andere Formate', () => {
  it('Einzel: 1 gegen 1, bis zu courts Matches', () => {
    const t = play(setup({ discipline: 'singles', courts: 3 }, 7), 10);
    assertRoundValid(t);
    t.rounds.forEach(r => { expect(r.matches.length).toBe(3); r.matches.forEach(m => expect(m.teamA.length).toBe(1)); });
    expect(spread(t)).toBeLessThanOrEqual(1);
  });

  it('Doppel mit einem Topf: wechselnde Partner', () => {
    const t = play(setup({ pairing: 'random', courts: 2 }, 10), 10);
    assertRoundValid(t);
    expect(spread(t)).toBeLessThanOrEqual(1);
  });

  it('feste Teams bleiben zusammen (Reihenfolge 1+2, 3+4 …)', () => {
    const t = play(setup({ pairing: 'fixed', courts: 2 }, 10), 8);
    assertRoundValid(t);
    const ids = t.players.map(p => p.id);
    expect(t.fixedTeams).toEqual([[ids[0], ids[1]], [ids[2], ids[3]], [ids[4], ids[5]], [ids[6], ids[7]], [ids[8], ids[9]]]);
    const teams = new Set(t.fixedTeams.map(x => x.join('-')));
    t.rounds.forEach(r => r.matches.forEach(m => {
      expect(teams.has(m.teamA.join('-'))).toBe(true);
      expect(teams.has(m.teamB.join('-'))).toBe(true);
    }));
  });

  it('mehr Felder als Spieler-Gruppen: nur belegbare Felder', () => {
    const t = setup({ courts: 4 }, 4, 4);
    expect(checkStart(t).matchesPerRound).toBe(2);
    expect(checkStart(t).warnings.join()).toMatch(/2 von 4 Feldern/);
  });
});

describe('Start-Prüfung und Sperre', () => {
  it('lehnt zu kleine Töpfe ab', () => {
    expect(checkStart(setup({}, 1, 5)).errors.length).toBe(1);
    expect(() => A.start(setup({}, 1, 5))).toThrow(A.ActionError);
  });

  it('lehnt ungerade Spielerzahl bei festen Teams ab', () => {
    expect(checkStart(setup({ pairing: 'fixed' }, 5)).errors.join()).toMatch(/gerade/);
  });

  it('Format ist nach dem Start gesperrt, Name und Rundenziel nicht', () => {
    const t = A.start(setup({}, 4, 4), rng(1));
    expect(() => A.updateSettings(t, { courts: 3 })).toThrow(/festgelegt/);
    expect(() => A.updateSettings(t, { discipline: 'singles' })).toThrow(/festgelegt/);
    expect(() => A.updateSettings(t, { scoreTracking: true })).toThrow(/festgelegt/);
    expect(A.updateSettings(t, { plannedRounds: 20, name: 'Jahresturnier' }).settings.plannedRounds).toBe(20);
    // unveränderter Wert ist erlaubt
    expect(() => A.updateSettings(t, { courts: 2 })).not.toThrow();
  });

  it('doppelte Namen werden abgelehnt (ohne Groß/klein)', () => {
    const t = setup({}, 1);
    expect(() => A.addPlayer(t, ' g1 ', 1)).toThrow(/gibt es schon/);
  });

  it('Liste einfügen legt mehrere Spieler an', () => {
    const { t, added, skipped } = A.addPlayers(newTournament(), 'Anna\nBen, Cleo;Anna', 2);
    expect(added).toBe(3);
    expect(skipped).toEqual(['Anna']);
    expect(t.players.every(p => p.pool === 2)).toBe(true);
  });
});

describe('Spielbetrieb', () => {
  it('Runde aufrufen übernimmt die Auslosung und lost die nächste aus', () => {
    let t = A.start(setup({}, 4, 4), rng(3));
    const drafted = t.draft!.matches;
    t = A.callRound(t, rng(4));
    expect(t.rounds[0]!.matches).toEqual(drafted);
    expect(t.draft!.matches.length).toBe(2);
  });

  it('Pause setzen lost die nächste Runde ohne diesen Spieler neu aus', () => {
    let t = A.start(setup({}, 5, 5), rng(3));
    const inDraft = t.draft!.matches.flatMap(matchPlayers)[0]!;
    t = A.setActive(t, inDraft, false, rng(5));
    expect(t.draft!.matches.flatMap(matchPlayers)).not.toContain(inDraft);
  });

  it('Späteinsteiger holt nicht alle verpassten Spiele am Stück nach', () => {
    let t = play(setup({ ribbon: false }, 4, 6), 6);
    t = A.addPlayer(t, 'Spät', 2, rng(9));
    const late = t.players.find(p => p.name === 'Spät')!;
    expect(late.fairnessOffset).toBeGreaterThan(0);
    t = play(t, 6, 11);
    const counts = scheduledCounts(t.rounds.slice(6));
    const others = t.players.filter(p => p.pool === 2 && p.id !== late.id).map(p => counts.get(p.id) ?? 0);
    expect(counts.get(late.id) ?? 0).toBeLessThanOrEqual(Math.max(...others) + 1);
  });

  it('Platz tauschen: niemand steht doppelt in einer Runde', () => {
    let t = A.start(setup({}, 4, 4), rng(3));
    const m0 = t.draft!.matches[0]!, m1 = t.draft!.matches[1]!;
    const a = m0.teamA[0]!, b = m1.teamB[1]!;
    t = A.placePlayer(t, { kind: 'draft' }, 0, 'A', 0, b);
    expect(t.draft!.matches[0]!.teamA[0]).toBe(b);
    expect(t.draft!.matches[1]!.teamB[1]).toBe(a);
    expect(t.draft!.edited).toBe(true);
    const ids = t.draft!.matches.flatMap(matchPlayers);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('pausierender Spieler als Ersatz ins Match', () => {
    let t = A.start(setup({}, 5, 4), rng(3));
    const out = t.players.find(p => !t.draft!.matches.flatMap(matchPlayers).includes(p.id))!;
    t = A.placePlayer(t, { kind: 'draft' }, 0, 'B', 0, out.id);
    expect(t.draft!.matches[0]!.teamB[0]).toBe(out.id);
  });

  it('Ergebnis: Punkte prüfen, Widerspruch verwerfen', () => {
    let t = A.callRound(A.start(setup({ scoreTracking: true }, 4, 4), rng(1)), rng(2));
    expect(() => A.setScore(t, 1, 0, 21, 21)).toThrow(/Unentschieden/);
    expect(() => A.setScore(t, 1, 0, -1, 3)).toThrow();
    expect(() => A.setScore(t, 1, 0, 2.5, 3)).toThrow();
    t = A.setScore(t, 1, 0, 21, 15);
    expect(t.rounds[0]!.matches[0]!.winner).toBe('A');
    t = A.setWinner(t, 1, 0, 'B');
    expect(t.rounds[0]!.matches[0]!.score).toBeNull();
    t = A.setWinner(t, 1, 0, null);
    expect(t.rounds[0]!.matches[0]!.winner).toBeNull();
  });

  it('Runde löschen nummeriert neu', () => {
    let t = play(setup({}, 4, 4), 3);
    t = A.deleteRound(t, 2);
    expect(t.rounds.map(r => r.no)).toEqual([1, 2]);
  });

  it('wer gespielt hat, kann nicht gelöscht werden', () => {
    const t = play(setup({}, 4, 4), 1);
    const id = t.rounds[0]!.matches[0]!.teamA[0]!;
    expect(() => A.removePlayer(t, id)).toThrow(/Pause/);
  });

  it('Neues Turnier mit denselben Spielern', () => {
    const t = A.freshTournament(play(setup({}, 4, 4), 2), true);
    expect(t.phase).toBe('setup');
    expect(t.players.map(p => p.name)).toEqual(['G1', 'G2', 'G3', 'G4', 'Gast1', 'Gast2', 'Gast3', 'Gast4']);
    expect(t.rounds).toEqual([]);
  });
});

describe('Rangliste', () => {
  it('Siege, dann weniger Spiele, Gleichstand = gleicher Rang', () => {
    let t = A.start(setup({ discipline: 'singles', courts: 2 }, 4), rng(1));
    t = A.callRound(t, rng(2));
    t = A.setWinner(t, 1, 0, 'A');
    t = A.setWinner(t, 1, 1, 'A');
    const s = standings(t);
    expect(s.map(x => x.rank)).toEqual([1, 1, 3, 3]);
    expect(s[0]!.wins).toBe(1);
    expect(stats(t)).toMatchObject({ rounds: 1, matches: 2, decided: 2, open: 0 });
  });

  it('mit Punkten entscheidet die Differenz', () => {
    let t = A.start(setup({ discipline: 'singles', courts: 2, scoreTracking: true }, 4), rng(1));
    t = A.callRound(t, rng(2));
    t = A.setScore(t, 1, 0, 21, 5);
    t = A.setScore(t, 1, 1, 21, 19);
    const s = standings(t);
    expect(s.map(x => x.rank)).toEqual([1, 2, 3, 4]);
    expect(s[0]!.diff).toBe(16);
  });

  it('nach Topf gefiltert', () => {
    const t = play(setup({}, 4, 4), 2);
    expect(standings(t, 2).every(s => s.player.pool === 2)).toBe(true);
    expect(standings(t, 2).length).toBe(4);
  });
});

describe('Import/Export', () => {
  it('Export → Import ergibt denselben Stand', () => {
    const t = play(setup({ scoreTracking: true }, 5, 5), 4);
    const back = importText(JSON.stringify(toExport(t))).tournament;
    expect(back).toEqual(t);
  });

  it('kaputte Daten werden bereinigt statt übernommen', () => {
    const t = play(setup({}, 4, 4), 1);
    const raw = JSON.parse(JSON.stringify(t));
    raw.rounds[0].matches[0].teamA = [999, 1];
    raw.settings.courts = 500;
    raw.players.push({ id: 'x', name: '<b>' });
    const back = parseTournament(raw);
    expect(back.rounds[0]!.matches.length).toBe(1);
    expect(back.settings.courts).toBe(12);
    expect(back.players.length).toBe(8);
  });

  it('liest Exporte der alten App', () => {
    const legacy = {
      mode: '2v2', teamType: 'random', poolCount: 2, roundCount: 3, scoreTracking: true, timerDuration: 300,
      nextPlayerId: 9,
      players: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `P${i + 1}`, pool: i < 4 ? 1 : 2, isActive: i !== 7 })),
      rounds: [
        { id: 1, matches: [
          { teamA: [1, 5], teamB: [2, 6], winner: 'A', score: [21, 10], field: '1' },
          { teamA: [3, 7], teamB: [4, 8], winner: null, score: null },
        ] },
        { id: 1, matches: [{ teamA: [1, 6], teamB: [2, 5], winner: 'B', score: [21, 10] }] },
      ],
    };
    const { tournament: t, legacy: isLegacy, timerSeconds } = importText(JSON.stringify(legacy));
    expect(isLegacy).toBe(true);
    expect(timerSeconds).toBe(300);
    expect(t.phase).toBe('running');
    expect(t.settings).toMatchObject({ discipline: 'doubles', pairing: 'pools', scoreTracking: true, courts: 2 });
    expect(t.rounds.map(r => r.no)).toEqual([1, 2]);
    expect(t.rounds[1]!.matches[0]!.score).toBeNull(); // 21:10 passt nicht zum Sieger B
    expect(t.players[7]!.active).toBe(false);
    expect(generateMatches(t, rng(1)).length).toBeGreaterThan(0);
  });

  it('fremde Dateien werden abgelehnt', () => {
    expect(() => importText('{"foo":1}')).toThrow(/nicht vom Turniermanager/);
    expect(() => importText('kein json')).toThrow(/JSON/);
  });
});

describe('Schleifchenturnier', () => {
  /** alle Runden eines gestarteten Turniers (gespielt, Entwurf, Plan) */
  const allRounds = (t: Tournament) => [...t.rounds.map(r => r.matches), ...(t.draft ? [t.draft.matches] : []), ...(t.plan ?? [])];

  it('Spiele verschieben: tauschen und einfügen über Rundengrenzen', () => {
    const t = A.start(setup({ pairing: 'pools', ribbon: true, courts: 2 }, 4, 4), rng(3), 0);
    const flat = (x: Tournament) => allRounds(x).flat().map(m => m.teamA.join() + '|' + m.teamB.join());
    const before = flat(t);
    const sw = A.moveMatch(t, { round: 0, idx: 0 }, { round: 2, idx: 1 }, 'swap');
    const a = flat(sw);
    expect(a[0]).toBe(before[5]);
    expect(a[5]).toBe(before[0]);
    expect(allRounds(sw).map(r => r.length)).toEqual(allRounds(t).map(r => r.length));
    const ins = A.moveMatch(t, { round: 2, idx: 0 }, { round: 0, idx: 0 }, 'insert');
    expect(flat(ins)).toEqual([before[4], ...before.slice(0, 4), ...before.slice(5)]);
    expect(ins.draft!.edited && ins.planEdited).toBe(true);
    expect(ins.draft!.matches.map(m => m.court)).toEqual([1, 2]);
  });

  it('plant jede Partnerschaft Topf 1 + Topf 2 genau einmal', () => {
    for (const [n1, n2, courts] of [[6, 6, 3], [6, 6, 2], [7, 6, 2], [8, 8, 4], [4, 6, 2], [5, 5, 1]] as const) {
      const t = A.start(setup({ pairing: 'pools', ribbon: true, courts }, n1, n2), rng(3), 0);
      const seen = new Map<string, number>();
      for (const matches of allRounds(t)) {
        const ids = matches.flatMap(matchPlayers);
        expect(new Set(ids).size).toBe(ids.length);
        expect(matches.length).toBeLessThanOrEqual(courts);
        for (const m of matches) for (const team of [m.teamA, m.teamB]) {
          const [a, b] = [...team].sort((x, y) => x - y);
          seen.set(`${a}-${b}`, (seen.get(`${a}-${b}`) ?? 0) + 1);
          const pools = team.map(id => t.players.find(p => p.id === id)!.pool).sort();
          expect(pools).toEqual([1, 2]);
        }
      }
      expect(Math.max(...seen.values())).toBe(1);
      // höchstens eine Partnerschaft bleibt übrig (ungerade Gesamtzahl)
      expect(n1 * n2 - seen.size).toBeLessThanOrEqual((n1 * n2) % 2);
      expect(t.settings.plannedRounds).toBe(allRounds(t).length);
    }
  });

  it('Rundenzahl ergibt sich aus Spielern und Feldern', () => {
    const t = setup({ pairing: 'pools', ribbon: true, courts: 3 }, 6, 6);
    expect(A.ribbonRounds(t)).toBe(6);
    expect(A.start(t, rng(1), 0).settings.plannedRounds).toBe(6);
    expect(A.ribbonRounds(setup({ pairing: 'pools', ribbon: true, courts: 2 }, 6, 6))).toBe(9);
  });

  it('das Turnier endet nach den letzten Ergebnissen von selbst', () => {
    let t = A.start(setup({ pairing: 'pools', ribbon: true, courts: 2 }, 4, 4), rng(1), 0);
    const total = t.settings.plannedRounds;
    expect(total).toBe(4);
    for (let i = 1; i <= total; i++) {
      expect(t.phase).toBe('running');
      t = A.callRound(t, rng(i), i);
      t.rounds[i - 1]!.matches.forEach((_, idx) => { t = A.setWinner(t, i, idx, 'A'); });
    }
    expect(t.draft).toBeNull();
    expect(t.phase).toBe('finished');
    expect(() => A.callRound(t)).toThrow();
  });

  it('der Plan lässt sich ändern; Spieler tauschen im Plan', () => {
    let t = A.start(setup({ pairing: 'pools', ribbon: true, courts: 2 }, 4, 4), rng(1), 0);
    const [a, b] = [t.plan![0]![0]!.teamA[0]!, t.plan![0]![0]!.teamA[1]!];
    t = A.placePlayer(t, { kind: 'plan', i: 0 }, 0, 'A', 0, b);
    expect(t.planEdited).toBe(true);
    expect(t.plan![0]![0]!.teamA).toEqual([b, a]);
    const ids = t.plan![0]!.flatMap(matchPlayers);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Plan überlebt Speichern und Laden', () => {
    const t = A.start(setup({ pairing: 'pools', ribbon: true, courts: 2 }, 4, 4), rng(1), 0);
    const back = parseTournament(JSON.parse(JSON.stringify(t)));
    expect(back.plan).toEqual(t.plan);
    expect(back.draft).toEqual(t.draft);
  });

  it('ohne Schleifchen bleibt die gewählte Rundenzahl und es wird einzeln ausgelost', () => {
    const t = A.start(setup({ pairing: 'pools', ribbon: false, plannedRounds: 3 }, 7, 6), rng(1), 0);
    expect(t.settings.plannedRounds).toBe(3);
    expect(t.plan).toBeNull();
  });
});
