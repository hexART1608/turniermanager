<script lang="ts">
  // Kompakte Ergebnisliste: Runde, Feld, beide Teams, Punkte, Sieger.
  // Mit onwinner werden die Teams anklickbar (Ergebnis nachtragen/korrigieren).
  import type { Round, Side, Tournament } from '../engine/types';
  import { playerMap, teamLabel } from '../lib/names';
  import Icon from './Icon.svelte';

  let { t, rounds, onwinner, onscore, heading = true, highlight = '', compact = false }: {
    t: Tournament;
    rounds: Round[];
    heading?: boolean;
    highlight?: string;
    compact?: boolean;
    onwinner?: (roundNo: number, idx: number, side: Side) => void;
    onscore?: (roundNo: number, idx: number, a: number, b: number) => void;
  } = $props();

  const map = $derived(playerMap(t));
  const points = $derived(t.settings.scoreTracking);
  const q = $derived(highlight.trim().toLocaleLowerCase('de'));
  /** Punkte direkt in der Zeile ändern: erst wenn beide Felder gefüllt sind, wird gespeichert. */
  function commitScore(e: Event, no: number, idx: number) {
    const box = (e.currentTarget as HTMLElement).closest('.score-edit')!;
    const [a, b] = [...box.querySelectorAll('input')].map(i => i.value.trim());
    if (a === '' || b === '' || a === undefined || b === undefined) return;
    onscore?.(no, idx, Number(a), Number(b));
  }
  const hit = (ids: number[]) => !!q && teamLabel(map, ids).toLocaleLowerCase('de').includes(q);
</script>

{#each rounds as r (r.no)}
  {@const open = r.matches.filter(m => !m.winner).length}
  <section class="round" class:compact>
    {#if heading}<h3 class="display">Runde {r.no}{#if open} <span class="chip chip-warning">{open} offen</span>{/if}</h3>{/if}
    <div class="table" role="table" aria-label="Ergebnisse Runde {r.no}" class:points>
      <div class="row head" role="row">
        <span role="columnheader">Feld</span>
        <span role="columnheader">Team 1</span>
        {#if points}<span role="columnheader" class="c">Punkte</span>{/if}
        <span role="columnheader">Team 2</span>
        <span role="columnheader">Sieger</span>
      </div>
      {#each r.matches as m, i (m.court)}
        <div class="row" role="row">
          <span role="cell" class="court display">{m.court}</span>
          {#each [['A', m.teamA], ['B', m.teamB]] as [side, ids] (side)}
            {#if side === 'B' && points}
              {#if onscore}
                <span role="cell" class="score-edit c">
                  <input class="sc num" type="number" min="0" inputmode="numeric" aria-label="Punkte Team 1" value={m.score?.[0] ?? ''} onchange={e => commitScore(e, r.no, i)} />
                  <span>:</span>
                  <input class="sc num" type="number" min="0" inputmode="numeric" aria-label="Punkte Team 2" value={m.score?.[1] ?? ''} onchange={e => commitScore(e, r.no, i)} />
                </span>
              {:else}
                <span role="cell" class="score num c">{m.score ? `${m.score[0]} : ${m.score[1]}` : '–'}</span>
              {/if}
            {/if}
            {#if onwinner}
              <button role="cell" class="team btn-team" class:win={m.winner === side} class:lose={m.winner && m.winner !== side} class:hit={hit(ids as number[])} onclick={() => onwinner(r.no, i, side as Side)} title="Als Sieger eintragen / aufheben">
                {teamLabel(map, ids as number[])}
              </button>
            {:else}
              <span role="cell" class="team" class:win={m.winner === side} class:lose={m.winner && m.winner !== side} class:hit={hit(ids as number[])}>{teamLabel(map, ids as number[])}</span>
            {/if}
          {/each}
          <span role="cell" class="winner">
            {#if m.winner}
              <Icon name="trophy" size={14} /> {teamLabel(map, m.winner === 'A' ? m.teamA : m.teamB)}
            {:else}
              <span class="faint">offen</span>
            {/if}
          </span>
        </div>
      {/each}
    </div>
  </section>
{/each}

<style>
  .round { margin-bottom: 14px; }
  .round.compact { margin-bottom: 6px; }
  .compact .row { padding: 3px 10px; }
  .compact h3 { font-size: 15px; margin-bottom: 3px; }
  .compact .table { gap: 2px; }
  h3 { font-size: 18px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
  .table { display: flex; flex-direction: column; gap: 3px; }
  .row {
    display: grid; grid-template-columns: 44px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.1fr);
    align-items: center; gap: 10px; padding: 6px 10px; border-radius: 10px; background: var(--surface-2); font-size: 14px;
  }
  .points .row { grid-template-columns: 44px minmax(0, 1fr) 92px minmax(0, 1fr) minmax(0, 1.1fr); }
  .row.head { background: none; padding-top: 0; padding-bottom: 0; font-size: 11.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-faint); }
  .court { font-size: 18px; font-weight: 800; color: var(--fg-muted); }
  .team { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; background: none; border: 0; padding: 3px 0; color: inherit; }
  .btn-team { cursor: pointer; border-radius: 6px; padding: 3px 6px; margin: 0 -6px; }
  .btn-team:hover { background: var(--surface-3); }
  .team.hit { text-decoration: underline; text-decoration-color: var(--accent); text-underline-offset: 3px; text-decoration-thickness: 2px; }
  .team.win { font-weight: 700; color: var(--success); }
  .team.lose { color: var(--fg-muted); }
  .c { text-align: center; }
  .score-edit { display: flex; align-items: center; justify-content: center; gap: 3px; color: var(--fg-faint); }
  .sc { width: 32px; padding: 3px 0; text-align: center; font-family: var(--font-display); font-size: 16px; font-weight: 700; color: var(--fg); background: var(--surface); border: 1px solid var(--border); border-radius: 7px; appearance: textfield; -moz-appearance: textfield; }
  .sc::-webkit-outer-spin-button, .sc::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .sc:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .score { font-family: var(--font-display); font-size: 18px; font-weight: 700; }
  .winner { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: var(--success); }
  .winner :global(svg) { flex: none; }
  @media (max-width: 760px) {
    .row, .points .row { grid-template-columns: 34px 1fr; row-gap: 2px; }
    .row.head { display: none; }
    .row > :not(.court) { grid-column: 2; }
    .court { grid-row: 1 / span 4; align-self: start; }
    .points .court { grid-row: 1 / span 5; }
    .score { text-align: left; }
    .score-edit { justify-content: flex-start; }
  }
</style>
