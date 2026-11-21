<script lang="ts">
  // Ein Match als Spielfeld. mode=result: Hälfte antippen = Sieger; mode=draft: Namen antippen = umbesetzen.
  import * as A from '../engine/actions';
  import { type Match, type Side, type Tournament, usesPools } from '../engine/types';
  import { playerMap } from '../lib/names';
  import { store } from '../lib/store.svelte';
  import Court from './Court.svelte';
  import Icon from './Icon.svelte';
  import PlayerPicker from './PlayerPicker.svelte';

  let {
    t,
    match,
    idx,
    roundRef,
    mode,
    size = 'lg',
    live = false,
  }: { t: Tournament; match: Match; idx: number; roundRef: A.RoundRef; mode: 'result' | 'draft'; size?: 'lg' | 'sm'; live?: boolean } = $props();

  const map = $derived(playerMap(t));
  const pools = $derived(usesPools(t.settings));
  let editNames = $state(false);
  const pickable = $derived(mode === 'draft' || editNames);
  let picking = $state<{ side: Side; slot: number } | null>(null);

  const roundNo = $derived(roundRef.kind === 'round' ? roundRef.no : 0);

  function toggleWinner(side: Side) {
    if (mode !== 'result' || editNames) return;
    const next = match.winner === side ? null : side;
    store.run(next ? 'Sieger eintragen' : 'Ergebnis löschen', x => A.setWinner(x, roundNo, idx, next));
  }

  let scoreA = $state('');
  let scoreB = $state('');
  $effect(() => {
    scoreA = match.score ? String(match.score[0]) : '';
    scoreB = match.score ? String(match.score[1]) : '';
  });

  function commitScore() {
    if (scoreA === '' || scoreB === '') return;
    const a = Number(scoreA), b = Number(scoreB);
    if (match.score && match.score[0] === a && match.score[1] === b) return;
    store.run('Punkte eintragen', x => A.setScore(x, roundNo, idx, a, b));
  }

  async function remove() {
    store.run(mode === 'draft' ? 'Match entfernen' : `Match auf Feld ${match.court} löschen`, x => A.removeMatch(x, roundRef, idx));
  }
</script>

{#snippet team(side: Side, ids: number[])}
  <div class="team" class:won={match.winner === side} class:lost={!!match.winner && match.winner !== side}>
    {#if match.winner === side}<span class="cup" title="Sieger"><Icon name="trophy" size={size === 'sm' ? 15 : 20} /></span>{/if}
    {#each ids as id, slot (slot)}
      {@const p = map.get(id)}
      {#if pickable}
        <button class="name pick" class:paused={p && !p.active} onclick={() => (picking = { side, slot })} title="Platz neu besetzen">
          {#if pools && p}<span class="dot dot-{p.pool}"></span>{/if}{p?.name ?? 'Unbekannt'}<Icon name="edit" size={13} />
        </button>
      {:else}
        <span class="name" class:paused={p && !p.active}>{#if pools && p}<span class="dot dot-{p.pool}"></span>{/if}{p?.name ?? 'Unbekannt'}</span>
      {/if}
    {/each}
  </div>
{/snippet}

{#snippet half(side: Side, ids: number[])}
  {#if mode === 'result' && !editNames}
    <button class="half-btn" aria-pressed={match.winner === side} aria-label="Sieg für {ids.map(id => map.get(id)?.name).join(' und ')}" onclick={() => toggleWinner(side)}>
      {@render team(side, ids)}
    </button>
  {:else}
    {@render team(side, ids)}
  {/if}
{/snippet}

<article class="match" class:decided={!!match.winner} class:draft={mode === 'draft'} class:sm={size === 'sm'} class:live={live && !match.winner}>
  <header>
    <span class="court-no display">Feld {match.court}</span>
    {#if mode === 'result'}
      {#if match.winner}
        <span class="chip chip-success"><Icon name="check" size={13} /> entschieden</span>
      {:else if live}
        <span class="chip chip-live"><span class="pulse"></span> läuft gerade</span>
      {:else}
        <span class="chip">offen</span>
      {/if}
    {/if}
    <div class="tools">
      {#if mode === 'result'}
        <button class="btn btn-ghost btn-icon btn-sm" class:active={editNames} title={editNames ? 'Fertig' : 'Spieler ersetzen (z. B. Verletzung)'} onclick={() => (editNames = !editNames)}>
          <Icon name={editNames ? 'check' : 'edit'} size={15} />
        </button>
      {/if}
      {#if mode === 'draft' || editNames}
        <button class="btn btn-ghost btn-icon btn-sm danger" title="Match entfernen" onclick={remove}><Icon name="trash" size={15} /></button>
      {/if}
    </div>
  </header>

  <Court winner={match.winner}>
    {#snippet left()}{@render half('A', match.teamA)}{/snippet}
    {#snippet right()}{@render half('B', match.teamB)}{/snippet}
  </Court>

  {#if mode === 'result' && t.settings.scoreTracking}
    <form class="score" onsubmit={e => { e.preventDefault(); commitScore(); }}>
      <input class="input num" inputmode="numeric" aria-label="Punkte links" placeholder="–" bind:value={scoreA} onblur={commitScore} maxlength="2" />
      <span class="colon display">:</span>
      <input class="input num" inputmode="numeric" aria-label="Punkte rechts" placeholder="–" bind:value={scoreB} onblur={commitScore} maxlength="2" />
    </form>
  {:else if mode === 'result' && !editNames && size !== 'sm'}
    <p class="tap-hint faint">{match.winner ? 'Nochmal antippen hebt das Ergebnis auf' : 'Gewinnerseite antippen'}</p>
  {:else if editNames}
    <p class="tap-hint faint">Namen antippen, um Spieler zu ersetzen oder zu tauschen</p>
  {/if}
</article>

{#if picking}
  <PlayerPicker {t} {roundRef} {idx} side={picking.side} slot={picking.slot} onclose={() => (picking = null)} />
{/if}

<style>
  .match {
    display: flex; flex-direction: column; gap: 10px;
    padding: 12px; border-radius: var(--radius);
    background: var(--surface); border: 1px solid var(--border);
    box-shadow: var(--shadow);
    transition: border-color 0.2s;
  }
  .match.decided { border-color: color-mix(in srgb, var(--success) 35%, var(--border)); }
  .match.live {
    border-color: var(--accent); border-width: 2px; padding: 11px;
    box-shadow: 0 0 0 4px var(--accent-soft), 0 0 28px -6px var(--accent-glow);
  }
  .chip-live { display: inline-flex; align-items: center; gap: 7px; background: var(--accent); color: var(--accent-fg); font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; }
  .pulse { width: 8px; height: 8px; border-radius: 50%; background: currentColor; animation: blink 1.4s infinite; }
  @keyframes blink { 50% { opacity: 0.25; } }
  .match.sm { padding: 8px; gap: 6px; }
  .match:not(.sm) .name { font-size: clamp(18px, 1.9vw, 34px); }
  .match.sm .court-no { font-size: 16px; }
  .match.sm .name { font-size: clamp(14px, 1.2vw, 18px); }
  .match.sm .pick { padding: 2px 6px; }
  .match.draft { background: var(--surface-2); }
  header { display: flex; align-items: center; gap: 10px; padding: 0 2px; }
  .court-no { font-size: 22px; font-weight: 800; letter-spacing: 0.02em; }
  .tools { margin-left: auto; display: flex; gap: 2px; }
  .tools .active { background: var(--accent-soft); color: var(--accent); }
  .danger:hover { color: var(--danger); }

  .half-btn {
    width: 100%; height: 100%; display: grid; place-items: center;
    background: none; border: 0; padding: 0; cursor: pointer; border-radius: 10px;
    transition: background 0.15s;
  }
  .half-btn:hover { background: rgba(255, 255, 255, 0.07); }
  .half-btn:focus-visible { outline: 3px solid var(--accent); outline-offset: -3px; background: rgba(255, 255, 255, 0.07); }
  .team { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; min-width: 0; max-width: 100%; }
  .name {
    display: inline-flex; align-items: center; gap: 6px; max-width: 100%;
    font-family: var(--font-display); font-weight: 700; font-size: clamp(17px, 1.5vw, 22px); line-height: 1.1;
    color: #fff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .name.paused { text-decoration: line-through; opacity: 0.7; }
  .pick {
    background: rgba(0, 0, 0, 0.28); border: 1px dashed rgba(255, 255, 255, 0.45);
    padding: 4px 9px; border-radius: 8px; cursor: pointer;
  }
  .pick:hover { background: rgba(0, 0, 0, 0.45); border-color: #fff; }
  .pick :global(svg) { opacity: 0.7; flex: none; }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25); }
  .dot-1 { background: var(--team-a); }
  .dot-2 { background: var(--team-b); }
  .cup {
    display: inline-grid; place-items: center; color: #3a2600; padding: 5px; border-radius: 50%;
    background: var(--gold); box-shadow: 0 2px 8px rgba(242, 182, 48, 0.55); animation: popin 0.35s var(--ease);
  }
  .team.lost .name { opacity: 0.55; }
  @keyframes popin { from { transform: scale(0.5); opacity: 0; } }
  .score { display: flex; justify-content: center; align-items: center; gap: 8px; }
  .score .input { width: 70px; text-align: center; font-family: var(--font-display); font-size: 22px; font-weight: 700; }
  .colon { font-size: 26px; font-weight: 800; color: var(--fg-muted); }
  .tap-hint { margin: 0; text-align: center; font-size: 12.5px; }
</style>
