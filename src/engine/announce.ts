// Text für die Sprachansage einer Runde. Reine Funktion, damit sie sich testen lässt.
import { sittingOut } from './ranking';
import type { Match, Tournament } from './types';

function names(t: Tournament, ids: readonly number[]): string {
  const list = ids.map(id => t.players.find(p => p.id === id)?.name ?? 'Unbekannt');
  return list.length <= 1 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} und ${list[list.length - 1]}`;
}

/** „Runde 3. Feld 1: Anne und Finn gegen Jonas und David. … Pause haben Sophie und Ben.“ */
export function announcement(t: Tournament, matches: readonly Match[], no: number, opts: { pause: boolean }): string {
  const parts = [`Runde ${no}.`];
  for (const m of matches) parts.push(`Feld ${m.court}: ${names(t, m.teamA)} gegen ${names(t, m.teamB)}.`);
  if (opts.pause) {
    const rest = sittingOut(t, { matches: [...matches] });
    if (rest.length) parts.push(`Pause ${rest.length === 1 ? 'hat' : 'haben'} ${names(t, rest.map(p => p.id))}.`);
  }
  return parts.join(' ');
}
