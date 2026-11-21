<script lang="ts">
  import { flip } from 'svelte/animate';
  import { standings } from '../engine/ranking';
  import { type Pool, type Tournament, usesPools } from '../engine/types';

  let { t, pool, limit, size = 'md' }: { t: Tournament; pool?: Pool; limit?: number; size?: 'sm' | 'md' | 'xl' } = $props();

  const rows = $derived(standings(t, pool).filter(s => s.player.active || s.games > 0));
  const shown = $derived(limit ? rows.slice(0, limit) : rows);
  const pools = $derived(usesPools(t.settings));
  const points = $derived(t.settings.scoreTracking);
  const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)} %`);
</script>

<div class="wrap size-{size}">
  <table>
    <thead>
      <tr>
        <th class="rank">#</th>
        <th>Spieler</th>
        <th class="n">Siege</th>
        {#if size === 'md'}<th class="n">Spiele</th>{/if}
        {#if size === 'md'}<th class="n">Quote</th>{/if}
        {#if points && size !== 'sm'}<th class="n">Punkte</th>{/if}
      </tr>
    </thead>
    <tbody>
      {#each shown as s (s.player.id)}
        <tr animate:flip={{ duration: 450 }} class:top={s.rank <= 3 && s.games > 0} class:paused={!s.player.active}>
          <td class="rank"><span class="medal num medal-{s.games > 0 && s.rank <= 3 ? s.rank : 0}">{s.rank}</span></td>
          <td class="pl">
            {#if pools}<span class="dot dot-{s.player.pool}" title={t.settings.poolLabels[s.player.pool - 1]}></span>{/if}
            <span class="nm">{s.player.name}</span>
            {#if !s.player.active && size !== 'xl'}<span class="chip">Pause</span>{/if}
          </td>
          <td class="n wins num">{s.wins}</td>
          {#if size === 'md'}<td class="n num muted">{s.games}</td>{/if}
          {#if size === 'md'}<td class="n num muted">{pct(s.rate)}</td>{/if}
          {#if points && size !== 'sm'}<td class="n num" class:pos={s.diff > 0} class:neg={s.diff < 0}>{s.diff > 0 ? '+' : ''}{s.diff}</td>{/if}
        </tr>
      {:else}
        <tr><td colspan="6" class="empty muted">Noch keine Spieler</td></tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: separate; border-spacing: 0 4px; }
  th { text-align: left; font-size: 11.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-faint); padding: 0 10px 2px; }
  td { padding: 8px 10px; background: var(--surface-2); }
  td:first-child { border-radius: 10px 0 0 10px; }
  td:last-child { border-radius: 0 10px 10px 0; }
  .n { text-align: right; width: 1%; white-space: nowrap; }
  .rank { width: 1%; }
  .medal {
    display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 50%;
    font-family: var(--font-display); font-weight: 800; font-size: 16px;
    background: var(--surface-3); color: var(--fg-muted);
  }
  .medal-1 { background: var(--gold); color: #4a3300; box-shadow: 0 0 18px -2px rgba(242, 182, 48, 0.6); }
  .medal-2 { background: var(--silver); color: #2c3440; }
  .medal-3 { background: var(--bronze); color: #3a1f08; }
  .pl { display: flex; align-items: center; gap: 8px; min-width: 0; }
  td.pl { display: table-cell; }
  .pl > * { vertical-align: middle; }
  .nm { font-weight: 600; margin-right: 6px; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
  .dot-1 { background: var(--team-a); }
  .dot-2 { background: var(--team-b); }
  .wins { font-family: var(--font-display); font-weight: 800; font-size: 19px; color: var(--accent); }
  .pos { color: var(--success); }
  .neg { color: var(--danger); }
  tr.paused td { opacity: 0.6; }
  .empty { text-align: center; padding: 20px; }

  .size-sm table { border-spacing: 0 3px; }
  .size-sm td { padding: 3px 8px; font-size: 14px; }
  .size-sm .medal { width: 23px; height: 23px; font-size: 13px; }
  .size-sm .wins { font-size: 16px; }

  .size-xl table { border-spacing: 0 0.55vh; }
  .size-xl th { font-size: 1.1vh; padding-bottom: 0.4vh; }
  .size-xl td { padding: 0.75vh 1vw; background: rgba(255, 255, 255, 0.05); font-size: 2.1vh; }
  .size-xl .medal { width: 3.6vh; height: 3.6vh; font-size: 2vh; }
  .size-xl .nm { font-family: var(--font-display); font-weight: 700; font-size: 2.6vh; }
  .size-xl .wins { font-size: 3vh; }
  .size-xl .dot { width: 1vh; height: 1vh; }
</style>
