<script lang="ts">
  import * as A from '../engine/actions';
  import { type Side } from '../engine/types';
  import { dialogs } from '../lib/dialog.svelte';
  import { playerMap, teamLabel } from '../lib/names';
  import { store } from '../lib/store.svelte';
  import Icon from './Icon.svelte';
  import MatchCard from './MatchCard.svelte';

  const t = $derived(store.t);
  const map = $derived(playerMap(t));
  const rounds = $derived([...t.rounds].reverse());
  let expanded = $state<number | null>(null);

  function toggle(no: number, idx: number, winner: Side | null, side: Side) {
    const next = winner === side ? null : side;
    store.run(next ? 'Sieger eintragen' : 'Ergebnis löschen', x => A.setWinner(x, no, idx, next));
  }

  async function delRound(no: number) {
    const ok = await dialogs.confirm({ title: `Runde ${no} löschen?`, text: 'Die Spiele und Ergebnisse dieser Runde zählen dann nicht mehr. Die folgenden Runden werden neu nummeriert. Mit „Rückgängig“ lässt sich das zurückholen.', confirm: 'Löschen', danger: true });
    if (ok) store.run(`Runde ${no} löschen`, x => A.deleteRound(x, no));
  }
</script>

<section class="card panel">
  <h2>Verlauf</h2>
  <p class="muted sub">Alle aufgerufenen Runden. Ergebnisse lassen sich hier nachtragen oder korrigieren.</p>

  {#each rounds as r (r.no)}
    {@const open = r.matches.filter(m => !m.winner).length}
    <article class="round">
      <header>
        <h3>Runde {r.no}</h3>
        {#if open}<span class="chip chip-warning">{open} offen</span>{/if}
        <div class="tools">
          <button class="btn btn-sm btn-ghost" onclick={() => (expanded = expanded === r.no ? null : r.no)}><Icon name="edit" size={14} /> {expanded === r.no ? 'Fertig' : 'Bearbeiten'}</button>
          <button class="btn btn-sm btn-ghost btn-icon del" aria-label="Runde {r.no} löschen" onclick={() => delRound(r.no)}><Icon name="trash" size={15} /></button>
        </div>
      </header>
      {#if expanded === r.no}
        <div class="cards">
          {#each r.matches as m, i (m.court)}
            <MatchCard {t} match={m} idx={i} roundRef={{ kind: 'round', no: r.no }} mode="result" />
          {/each}
        </div>
      {:else}
        <ul>
          {#each r.matches as m, i (m.court)}
            <li>
              <span class="court display">Feld {m.court}</span>
              <button class="side" class:win={m.winner === 'A'} class:lose={m.winner === 'B'} onclick={() => toggle(r.no, i, m.winner, 'A')}>{teamLabel(map, m.teamA)}</button>
              <span class="vs num">{m.score ? `${m.score[0]} : ${m.score[1]}` : 'vs'}</span>
              <button class="side right" class:win={m.winner === 'B'} class:lose={m.winner === 'A'} onclick={() => toggle(r.no, i, m.winner, 'B')}>{teamLabel(map, m.teamB)}</button>
            </li>
          {/each}
        </ul>
      {/if}
    </article>
  {:else}
    <p class="muted">Noch keine Runde aufgerufen.</p>
  {/each}
</section>

<style>
  .panel { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
  h2 { font-size: 30px; }
  .sub { margin: -6px 0 4px; font-size: 14px; }
  .round { padding: 12px; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--border); }
  header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  h3 { font-size: 20px; }
  .tools { margin-left: auto; display: flex; gap: 2px; }
  .del:hover { color: var(--danger); }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  li { display: grid; grid-template-columns: 64px 1fr auto 1fr; align-items: center; gap: 10px; }
  .court { font-weight: 700; color: var(--fg-muted); }
  .side { text-align: left; padding: 7px 10px; border-radius: 9px; border: 1px solid transparent; background: var(--surface); cursor: pointer; font-weight: 500; }
  .side.right { text-align: right; }
  .side:hover { border-color: var(--border-strong); }
  .side.win { background: var(--success-soft); color: var(--success); font-weight: 700; }
  .side.lose { color: var(--fg-muted); }
  .vs { font-size: 13px; color: var(--fg-faint); min-width: 54px; text-align: center; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
  @media (max-width: 600px) { li { grid-template-columns: 1fr; } .side.right { text-align: left; } }
</style>
