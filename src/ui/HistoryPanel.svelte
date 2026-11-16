<script lang="ts">
  import * as A from '../engine/actions';
  import { type Side } from '../engine/types';
  import { dialogs } from '../lib/dialog.svelte';
  import { playerMap, teamLabel } from '../lib/names';
  import { store } from '../lib/store.svelte';
  import Icon from './Icon.svelte';
  import MatchCard from './MatchCard.svelte';
  import ResultsTable from './ResultsTable.svelte';

  const t = $derived(store.t);
  const map = $derived(playerMap(t));
  const rounds = $derived([...t.rounds].reverse());
  let expanded = $state<number | null>(null);
  let query = $state('');
  const shown = $derived.by(() => {
    const q = query.trim().toLocaleLowerCase('de');
    if (!q) return rounds;
    return rounds.filter(r => r.matches.some(m => [...m.teamA, ...m.teamB].some(id => map.get(id)?.name.toLocaleLowerCase('de').includes(q))));
  });

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
  <p class="muted sub">Alle aufgerufenen Runden mit Feld, Punkten und Sieger. Teams antippen trägt den Sieger ein oder hebt ihn auf; Punkte lassen sich direkt in der Zeile ändern.</p>
  {#if rounds.length > 2}
    <input class="input search" placeholder="Spieler suchen – zeigt nur seine Runden …" aria-label="Spieler suchen" bind:value={query} />
  {/if}

  {#each shown as r (r.no)}
    {@const open = r.matches.filter(m => !m.winner).length}
    <article class="round">
      <header>
        <h3>Runde {r.no}</h3>
        {#if open}<span class="chip chip-warning">{open} offen</span>{/if}
        <div class="tools">
          <button class="btn btn-sm btn-ghost" onclick={() => (expanded = expanded === r.no ? null : r.no)}><Icon name="edit" size={14} /> {expanded === r.no ? 'Fertig' : 'Paarung ändern'}</button>
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
        <ResultsTable {t} rounds={[r]} heading={false} highlight={query} onscore={(no, i, a, b) => store.run('Ergebnis ändern', x => A.setScore(x, no, i, a, b))} onwinner={(no, i, side) => toggle(no, i, t.rounds.find(x => x.no === no)?.matches[i]?.winner ?? null, side)} />
      {/if}
    </article>
  {:else}
    <p class="muted">{rounds.length ? 'Kein Treffer.' : 'Noch keine Runde aufgerufen.'}</p>
  {/each}
</section>

<style>
  .panel { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
  h2 { font-size: 30px; }
  .sub { margin: -6px 0 4px; font-size: 14px; }
  .search { max-width: 360px; }
  .round { padding: 12px; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--border); }
  header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  h3 { font-size: 20px; }
  .tools { margin-left: auto; display: flex; gap: 2px; }
  .del:hover { color: var(--danger); }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
</style>
