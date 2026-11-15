<script lang="ts">
  import * as A from '../engine/actions';
  import { type Player, type Side, type Tournament, matchPlayers, usesPools } from '../engine/types';
  import { scheduledCounts } from '../engine/pairing';
  import { playerMap } from '../lib/names';
  import { store } from '../lib/store.svelte';
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';

  let { t, roundRef, idx, side, slot, onclose }: {
    t: Tournament; roundRef: A.RoundRef; idx: number; side: Side; slot: number; onclose: () => void;
  } = $props();

  const map = $derived(playerMap(t));
  const matches = $derived(roundRef.kind === 'draft' ? (t.draft?.matches ?? []) : (t.rounds.find(r => r.no === roundRef.no)?.matches ?? []));
  const match = $derived(matches[idx]);
  const currentId = $derived(match ? (side === 'A' ? match.teamA : match.teamB)[slot] : undefined);
  const current = $derived(currentId !== undefined ? map.get(currentId) : undefined);
  const inRound = $derived(new Set(matches.flatMap(matchPlayers)));
  const counts = $derived(scheduledCounts(t.rounds));
  const pools = $derived(usesPools(t.settings));

  let query = $state('');
  const filter = (p: Player) => !query.trim() || p.name.toLocaleLowerCase('de').includes(query.trim().toLocaleLowerCase('de'));
  const sortFn = (a: Player, b: Player) => (pools && current ? Number(b.pool === current.pool) - Number(a.pool === current.pool) : 0) || (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0) || a.name.localeCompare(b.name, 'de');

  const resting = $derived(t.players.filter(p => p.active && !inRound.has(p.id) && filter(p)).sort(sortFn));
  const playing = $derived(t.players.filter(p => p.id !== currentId && inRound.has(p.id) && filter(p)).sort(sortFn));

  function choose(p: Player) {
    if (store.run(inRound.has(p.id) ? 'Spieler tauschen' : 'Spieler ersetzen', x => A.placePlayer(x, roundRef, idx, side, slot, p.id))) onclose();
  }
</script>

{#snippet entry(p: Player, swap: boolean)}
  <li>
    <button class="opt" onclick={() => choose(p)}>
      {#if pools}<span class="dot dot-{p.pool}"></span>{/if}
      <span class="n">{p.name}</span>
      {#if pools && current && p.pool !== current.pool}<span class="chip chip-warning">{t.settings.poolLabels[p.pool - 1]}</span>{/if}
      <span class="meta num faint">{counts.get(p.id) ?? 0} Sp.</span>
      <Icon name={swap ? 'swap' : 'chevronRight'} size={16} />
    </button>
  </li>
{/snippet}

<Modal title="Platz neu besetzen" {onclose} width={480}>
  <p class="cur muted">Statt <strong>{current?.name ?? '–'}</strong> auf Feld {match?.court}:</p>
  <input class="input" placeholder="Name suchen …" bind:value={query} data-autofocus />
  <div class="lists">
    <section>
      <h3 class="eyebrow">Pausiert gerade · ersetzt {current?.name}</h3>
      <ul>
        {#each resting as p (p.id)}{@render entry(p, false)}{:else}<li class="none faint">niemand</li>{/each}
      </ul>
    </section>
    <section>
      <h3 class="eyebrow">In dieser Runde · Plätze tauschen</h3>
      <ul>
        {#each playing as p (p.id)}{@render entry(p, true)}{:else}<li class="none faint">niemand</li>{/each}
      </ul>
    </section>
  </div>
</Modal>

<style>
  .cur { margin: 0 0 10px; }
  .lists { display: flex; flex-direction: column; gap: 14px; margin-top: 14px; }
  h3 { margin-bottom: 6px; font-size: 12px; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
  .opt {
    display: flex; align-items: center; gap: 9px; width: 100%;
    padding: 9px 11px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface-2);
    cursor: pointer; text-align: left;
  }
  .opt:hover { border-color: var(--accent); background: var(--accent-soft); }
  .n { flex: 1; font-weight: 600; }
  .meta { font-size: 12.5px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; }
  .dot-1 { background: var(--team-a); }
  .dot-2 { background: var(--team-b); }
  .none { padding: 6px 11px; font-size: 14px; }
</style>
