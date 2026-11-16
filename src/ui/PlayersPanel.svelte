<script lang="ts">
  import * as A from '../engine/actions';
  import { standings } from '../engine/ranking';
  import { type Player, type Pool, LIMITS, usesFixedTeams, usesPools } from '../engine/types';
  import { scheduledCounts } from '../engine/pairing';
  import { store } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import Icon from './Icon.svelte';

  const t = $derived(store.t);
  const s = $derived(t.settings);
  const pools = $derived(usesPools(s));
  const fixed = $derived(usesFixedTeams(s));
  const counts = $derived(scheduledCounts(t.rounds));
  const wins = $derived(new Map(standings(t).map(x => [x.player.id, x.wins])));
  const byId = $derived(new Map(t.players.map(p => [p.id, p])));

  let name = $state('');
  let pool = $state<Pool>(2);

  function add(e: SubmitEvent) {
    e.preventDefault();
    const field = (e.currentTarget as HTMLFormElement).querySelector('input');
    if (store.run('Spieler nachmelden', x => A.addPlayer(x, name, pool))) {
      toasts.show('success', `${name.trim()} ist dabei und wird ab der nächsten Auslosung berücksichtigt.`);
      name = '';
    }
    field?.focus();
  }

  function partner(p: Player): string | null {
    if (!fixed) return null;
    const team = t.fixedTeams.find(x => x.includes(p.id));
    if (!team) return 'wartet auf Partner';
    return 'mit ' + (byId.get(team[0] === p.id ? team[1] : team[0])?.name ?? '?');
  }

  let editing = $state<number | null>(null);
  let editValue = $state('');
  function commit(p: Player) {
    if (editing !== p.id) return;
    editing = null;
    if (editValue.trim() && editValue.trim() !== p.name) store.run('Umbenennen', x => A.renamePlayer(x, p.id, editValue));
  }
  function focusSelect(el: HTMLInputElement) { el.focus(); el.select(); }

  const sorted = $derived([...t.players].sort((a, b) => Number(b.active) - Number(a.active) || (pools ? a.pool - b.pool : 0) || a.name.localeCompare(b.name, 'de')));
</script>

<section class="card panel">
  <div class="head">
    <div>
      <h2>Spieler</h2>
      <p class="muted">Nachmelden, pausieren, umbenennen. Wer nachkommt, wird fair eingereiht und muss keine Spiele am Stück nachholen.</p>
    </div>
  </div>

  <form class="add" onsubmit={add}>
    <input class="input" placeholder="Name des Nachzüglers" maxlength={LIMITS.nameMax} bind:value={name} aria-label="Name" />
    {#if pools}
      <select class="input sel" bind:value={pool} aria-label="Topf">
        <option value={1}>{s.poolLabels[0]}</option>
        <option value={2}>{s.poolLabels[1]}</option>
      </select>
    {/if}
    <button class="btn btn-primary" type="submit" disabled={!name.trim()}><Icon name="plus" /> Nachmelden</button>
  </form>

  <ul class="list">
    {#each sorted as p (p.id)}
      {@const games = counts.get(p.id) ?? 0}
      <li class="row" class:paused={!p.active}>
        {#if pools}<span class="dot dot-{p.pool}"></span>{/if}
        <div class="who">
          {#if editing === p.id}
            <input class="input inline" bind:value={editValue} maxlength={LIMITS.nameMax} use:focusSelect onblur={() => commit(p)} onkeydown={e => { if (e.key === 'Enter') commit(p); if (e.key === 'Escape') { editing = null; e.stopPropagation(); } }} />
          {:else}
            <button class="nm" onclick={() => { editing = p.id; editValue = p.name; }} title="Umbenennen">{p.name}</button>
          {/if}
          <span class="meta faint">
            {#if pools}{s.poolLabels[p.pool - 1]} · {/if}{games} {games === 1 ? 'Spiel' : 'Spiele'} · {wins.get(p.id) ?? 0} Siege{#if partner(p)} · {partner(p)}{/if}
          </span>
        </div>
        {#if pools}
          <button class="btn btn-sm btn-ghost" title="Topf wechseln" onclick={() => store.run('Topf wechseln', x => A.setPool(x, p.id, p.pool === 1 ? 2 : 1))}><Icon name="swap" size={15} /></button>
        {/if}
        <button class="btn btn-sm state" class:on={p.active} onclick={() => store.run(p.active ? 'Pausieren' : 'Zurückholen', x => A.setActive(x, p.id, !p.active))}>
          {#if p.active}<Icon name="check" size={14} /> spielt mit{:else}<Icon name="pause" size={14} /> Pause{/if}
        </button>
        {#if games === 0}
          <button class="btn btn-sm btn-ghost btn-icon del" aria-label="{p.name} löschen" onclick={() => store.run('Spieler löschen', x => A.removePlayer(x, p.id))}><Icon name="trash" size={15} /></button>
        {:else}
          <span class="spacer"></span>
        {/if}
      </li>
    {/each}
  </ul>
</section>

<style>
  .panel { padding: 20px; }
  .head h2 { font-size: 30px; }
  .head p { margin: 4px 0 14px; font-size: 14px; }
  .add { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
  .add .input { flex: 1; min-width: 180px; }
  .add .sel { flex: 0 0 160px; min-width: 0; }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .row { display: flex; align-items: center; gap: 10px; padding: 7px 8px 7px 12px; border-radius: 12px; background: var(--surface-2); }
  .row.paused { opacity: 0.6; }
  .who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .nm { background: none; border: 0; padding: 0; text-align: left; font-weight: 600; font-size: 15px; cursor: text; }
  .inline { min-height: 32px; }
  .meta { font-size: 12.5px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
  .dot-1 { background: var(--team-a); }
  .dot-2 { background: var(--team-b); }
  .state { min-width: 116px; }
  .state.on { color: var(--success); }
  .del:hover { color: var(--danger); }
  .spacer { width: 32px; flex: none; }
</style>
