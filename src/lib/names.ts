import type { Player, Tournament } from '../engine/types';

export function playerMap(t: Tournament): Map<number, Player> {
  return new Map(t.players.map(p => [p.id, p]));
}

export function teamLabel(map: Map<number, Player>, ids: readonly number[]): string {
  return ids.map(id => map.get(id)?.name ?? 'Unbekannt').join(' & ');
}
