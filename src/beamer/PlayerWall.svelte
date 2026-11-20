<script lang="ts">
  // Wartebild: Alle angemeldeten Namen als leuchtende Karten. Neue Spieler poppen auf,
  // dazu läuft eine sanfte Welle über die Karten. Animiert werden nur transform und opacity.
  let { players, pools }: { players: { id: number; name: string; pool: 1 | 2 }[]; pools: boolean } = $props();
  const MAX = 36;
  const shown = $derived(players.slice(0, MAX));
  const more = $derived(Math.max(0, players.length - MAX));
</script>

<div class="wall" class:dense={players.length > 16} class:denser={players.length > 26} aria-hidden="true">
  {#each shown as p, i (p.id)}
    <div class="chip-card pool-{pools ? p.pool : 0}" style:--i={i} style:--d="{Math.min(i, 24) * 70}ms">
      <span class="no">{i + 1}</span><span class="nm">{p.name}</span>
    </div>
  {/each}
  {#if more}<div class="chip-card more">+ {more} weitere</div>{/if}
  {#if !players.length}<p class="empty">Hier erscheinen gleich alle Spieler …</p>{/if}
</div>

<style>
  .wall { display: grid; grid-template-columns: repeat(auto-fill, minmax(23cqw, 1fr)); gap: 1.8cqh 1.3cqw; align-content: center; width: 100%; max-height: 100%; }
  .chip-card { --c: var(--accent); position: relative; display: flex; align-items: center; gap: 1.2cqw; min-width: 0; padding: 1.7cqh 1.6cqw; border-radius: 1.8cqh; background: color-mix(in srgb, var(--c) 14%, rgba(15, 24, 40, 0.92)); border: 1px solid color-mix(in srgb, var(--c) 55%, transparent); box-shadow: 0 0 2.6cqh color-mix(in srgb, var(--c) 28%, transparent); font-size: 4.6cqh; font-weight: 700; color: #fff; opacity: 0; animation: pop 0.7s cubic-bezier(0.2, 1.2, 0.3, 1) var(--d) both, wave 5s ease-in-out calc(0.9s + var(--i) * 0.16s) infinite; will-change: transform, opacity; }
  .pool-1 { --c: var(--team-a); }
  .pool-2 { --c: var(--team-b); }
  .no { flex: none; min-width: 2.4ch; text-align: center; font-size: 0.7em; font-variant-numeric: tabular-nums; color: var(--c); opacity: 0.9; }
  .nm { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .more { --c: var(--fg-muted); justify-content: center; opacity: 0.8; animation: none; opacity: 1; }
  .dense .chip-card { font-size: 3.6cqh; padding: 1.2cqh 1.2cqw; }
  .denser .chip-card { font-size: 2.9cqh; padding: 0.9cqh 1cqw; }
  .empty { grid-column: 1 / -1; text-align: center; font-size: 4cqh; color: var(--fg-muted); margin: 0; }
  @keyframes pop { 0% { opacity: 0; transform: translate3d(0, 3cqh, 0) scale(0.7); } 100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); } }
  @keyframes wave { 0%, 100% { transform: translate3d(0, 0, 0) scale(1); } 50% { transform: translate3d(0, -0.5cqh, 0) scale(1.035); } }
  @media (prefers-reduced-motion: reduce) { .chip-card { animation: pop 0.01s both; } }
</style>
