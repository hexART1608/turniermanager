<script lang="ts">
  // Übersicht aller Runden: gespielt, nächste und (beim Schleifchenturnier) der ganze Spielplan.
  // Kommende Paarungen lassen sich hier ansehen und ändern: Namen antippen = tauschen oder ersetzen.
  import * as A from '../engine/actions';
  import { sittingOut } from '../engine/ranking';
  import { type Match, type Side, usesPools } from '../engine/types';
  import { playerMap } from '../lib/names';
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';
  import PlayerPicker from './PlayerPicker.svelte';

  const t = $derived(store.t);
  const map = $derived(playerMap(t));
  const pools = $derived(usesPools(t.settings));
  const planned = $derived(t.plan !== null);
  const upcoming = $derived([
    ...(t.draft ? [{ ref: { kind: 'draft' } as A.RoundRef, no: t.rounds.length + 1, matches: t.draft.matches, next: true }] : []),
    ...(t.plan ?? []).map((matches, i) => ({ ref: { kind: 'plan', i } as A.RoundRef, no: t.rounds.length + 2 + i, matches, next: false })),
  ]);
  let picking = $state<{ ref: A.RoundRef; idx: number; side: Side; slot: number } | null>(null);

  const resting = (matches: Match[]) => sittingOut(t, { matches }).map(p => p.name).join(' · ');
  const edited = $derived(t.planEdited || !!t.draft?.edited);

  // Drag & Drop: Position = (Runde, Match) über alle kommenden Runden
  let mode = $state<'swap' | 'insert'>('swap');
  let drag = $state<A.MatchPos | null>(null);
  let over = $state<A.MatchPos | null>(null);
  const same = (a: A.MatchPos | null, b: A.MatchPos | null) => !!a && !!b && a.round === b.round && a.idx === b.idx;
  function drop(to: A.MatchPos) {
    const from = drag;
    drag = over = null;
    if (from && !same(from, to)) store.run(mode === 'swap' ? 'Spiele tauschen' : 'Spiel einfügen', x => A.moveMatch(x, from, to, mode));
  }

  function remove(ref: A.RoundRef, idx: number) {
    store.run('Match entfernen', x => A.removeMatch(x, ref, idx));
  }
</script>

{#snippet team(ref: A.RoundRef | null, idx: number, side: Side, ids: number[], won: boolean, lost: boolean)}
  <span class="team" class:won class:lost>
    {#each ids as id, slot (slot)}
      {@const p = map.get(id)}
      {#if ref}
        <button class="name pick" onclick={() => (picking = { ref, idx, side, slot })} title="Spieler tauschen oder ersetzen">
          {#if pools && p}<span class="dot dot-{p.pool}"></span>{/if}{p?.name ?? '?'}
        </button>
      {:else}
        <span class="name">{#if pools && p}<span class="dot dot-{p.pool}"></span>{/if}{p?.name ?? '?'}</span>
      {/if}
    {/each}
    {#if won}<span class="cup"><Icon name="trophy" size={12} /></span>{/if}
  </span>
{/snippet}

{#snippet matchRow(ref: A.RoundRef | null, m: Match, idx: number, ri = -1, dups: number[] = [])}
  {@const pos = { round: ri, idx }}
  <li class="match" class:decided={!!m.winner} class:dragging={ref && same(drag, pos)} class:over={ref && drag && same(over, pos) && !same(drag, pos)} class:insert={mode === 'insert'}
    draggable={ref ? 'true' : undefined}
    ondragstart={ref ? (e: DragEvent) => { drag = pos; e.dataTransfer?.setData('text/plain', 'match'); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; } : undefined}
    ondragend={ref ? () => (drag = over = null) : undefined}
    ondragover={ref ? (e: DragEvent) => { if (drag) { e.preventDefault(); over = pos; } } : undefined}
    ondrop={ref ? (e: DragEvent) => { e.preventDefault(); drop(pos); } : undefined}>
    <span class="court" title={ref ? 'Zum Verschieben ziehen' : undefined}>{#if ref}<span class="grip"><Icon name="grip" size={14} /></span>{/if}{m.court}</span>
    {@render team(ref, idx, 'A', m.teamA, m.winner === 'A', m.winner === 'B')}
    <span class="vs">gegen</span>
    {@render team(ref, idx, 'B', m.teamB, m.winner === 'B', m.winner === 'A')}
    {#if ref}<button class="btn btn-ghost btn-icon btn-sm del" title="Match entfernen" aria-label="Match entfernen" onclick={() => remove(ref, idx)}><Icon name="trash" size={14} /></button>{/if}
  </li>
{/snippet}

<Modal title="Übersicht aller Spiele" width={1180} onclose={() => (ui.scheduleOpen = false)}>
  <p class="muted lead">
    {#if planned}
      Der ganze Spielplan steht fest: {t.rounds.length + upcoming.length} Runden, danach endet das Turnier. Namen in kommenden Runden antippen, um Spieler zu tauschen oder zu ersetzen.
    {:else}
      Hier stehen die gespielten Runden und die nächste Auslosung. Weitere Runden werden nach jeder Runde neu ausgelost.
    {/if}
  </p>
  {#if upcoming.length}
    <div class="bar">
      <span class="seg" role="group" aria-label="Beim Ziehen">
        <span class="faint">Spiel auf ein anderes ziehen:</span>
        <button class="btn btn-sm" class:btn-primary={mode === 'swap'} aria-pressed={mode === 'swap'} onclick={() => (mode = 'swap')}><Icon name="swap" size={14} /> Ersetzen (tauschen)</button>
        <button class="btn btn-sm" class:btn-primary={mode === 'insert'} aria-pressed={mode === 'insert'} onclick={() => (mode = 'insert')}><Icon name="plus" size={14} /> Einfügen (Rest rückt nach)</button>
      </span>
    </div>
  {/if}
  {#if planned && upcoming.length}
    <div class="bar">
      <span class="faint">{edited ? 'Von Hand angepasst – wird bei Spieleränderungen nicht überschrieben.' : 'Wird bei Änderungen an der Spielerliste automatisch neu berechnet.'}</span>
      <button class="btn btn-sm" onclick={() => store.run('Spielplan neu auslosen', x => A.reroll(x))} title="Alle noch nicht gestarteten Runden neu auslosen"><Icon name="shuffle" size={15} /> Alle offenen Runden neu auslosen</button>
    </div>
  {/if}

  <div class="grid">
    {#each upcoming as u, ui_i (u.no)}
      {@const dups = A.doublePlayers(u.matches)}
      <section class="round" class:next={u.next}>
        <h3><span class="display">Runde {u.no}</span>{#if u.next}<span class="chip chip-accent">als Nächstes</span>{/if}</h3>
        <ul>{#each u.matches as m, i (m.court)}{@render matchRow(u.ref, m, i, ui_i, dups)}{/each}</ul>
        {#if dups.length}<p class="rest dup"><Icon name="warning" size={13} /> Doppelt in dieser Runde: {dups.map(id => map.get(id)?.name ?? '?').join(', ')}</p>{/if}
        {#if resting(u.matches)}<p class="rest faint"><Icon name="pausePerson" size={13} /> Pause: {resting(u.matches)}</p>{/if}
      </section>
    {/each}
    {#each [...t.rounds].reverse() as r (r.no)}
      <section class="round played">
        <h3><span class="display">Runde {r.no}</span><span class="chip">gespielt</span></h3>
        <ul>{#each r.matches as m, i (m.court)}{@render matchRow(null, m, i)}{/each}</ul>
        {#if resting(r.matches)}<p class="rest faint"><Icon name="pausePerson" size={13} /> Pause: {resting(r.matches)}</p>{/if}
      </section>
    {/each}
  </div>
  {#if !upcoming.length && planned}
    <p class="alert alert-info"><Icon name="flag" size={17} /> Alle Paarungen sind gespielt.</p>
  {/if}
</Modal>

{#if picking}
  <PlayerPicker {t} roundRef={picking.ref} idx={picking.idx} side={picking.side} slot={picking.slot} onclose={() => (picking = null)} />
{/if}

<style>
  .lead { margin: 0 0 10px; }
  .bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; align-items: start; }
  .round { padding: 10px 12px; border-radius: var(--radius); background: var(--surface-2); border: 1px solid var(--border); }
  .round.next { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .round.played { opacity: 0.85; }
  h3 { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 18px; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .match { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto minmax(0, 1fr) auto; align-items: center; gap: 6px; font-size: 14px; }
  .match:not(:has(.del)) { grid-template-columns: 22px minmax(0, 1fr) auto minmax(0, 1fr); }
  .court { font-family: var(--font-display); font-weight: 800; color: var(--fg-muted); }
  .vs { font-size: 11px; color: var(--fg-faint); text-transform: uppercase; letter-spacing: 0.06em; }
  .team { display: flex; flex-direction: column; gap: 2px; min-width: 0; position: relative; }
  .team.lost { opacity: 0.5; }
  .name { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .pick { background: var(--surface); border: 1px dashed var(--border-strong); border-radius: 7px; padding: 2px 7px; color: inherit; cursor: pointer; text-align: left; }
  .pick:hover { border-color: var(--accent); background: var(--accent-soft); }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .dot-1 { background: var(--team-a); }
  .dot-2 { background: var(--team-b); }
  .cup { position: absolute; right: 0; top: 0; display: grid; place-items: center; padding: 3px; border-radius: 50%; background: var(--gold); color: #3a2600; }
  .rest { display: flex; align-items: center; gap: 6px; margin: 6px 0 0; font-size: 12.5px; }
  .seg { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  li[draggable='true'] { cursor: grab; border-radius: 8px; border-top: 2px solid transparent; }
  .match.dragging { opacity: 0.4; }
  .match.over { background: var(--accent-soft); outline: 2px dashed var(--accent); outline-offset: 2px; }
  .match.over.insert { outline-style: solid; }
  .grip { color: var(--fg-faint); margin-right: 2px; }
  .court { display: inline-flex; align-items: center; }
  .dup { color: var(--danger); }
  .del:hover { color: var(--danger); }
</style>
