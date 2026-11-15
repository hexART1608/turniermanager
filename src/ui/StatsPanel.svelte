<script lang="ts">
  import { buildHistory, scheduledCounts } from '../engine/pairing';
  import { stats } from '../engine/ranking';
  import { teamSize } from '../engine/types';
  import { playerMap } from '../lib/names';
  import { store } from '../lib/store.svelte';
  import Icon from './Icon.svelte';

  const t = $derived(store.t);
  const st = $derived(stats(t));
  const map = $derived(playerMap(t));
  const minutes = $derived(Math.round((Date.now() - (t.startedAt ?? Date.now())) / 60000));

  // Partnerschaften, die öfter als einmal vorkamen
  const repeats = $derived.by(() => {
    if (teamSize(t.settings) < 2) return [];
    const hist = buildHistory(t.rounds);
    const out: { a: string; b: string; n: number }[] = [];
    const ids = t.players.map(p => p.id);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const n = hist.with(ids[i]!, ids[j]!);
      if (n > 1) out.push({ a: map.get(ids[i]!)!.name, b: map.get(ids[j]!)!.name, n });
    }
    return out.sort((x, y) => y.n - x.n).slice(0, 8);
  });

  const games = $derived.by(() => {
    const c = scheduledCounts(t.rounds);
    return t.players.filter(p => p.active).map(p => ({ p, n: c.get(p.id) ?? 0 })).sort((a, b) => a.n - b.n || a.p.name.localeCompare(b.p.name, 'de'));
  });
</script>

<section class="card panel">
  <h2>Statistik</h2>
  <div class="tiles">
    <div class="tile"><span class="v num display">{st.rounds}</span><span class="l">Runden</span></div>
    <div class="tile"><span class="v num display">{st.decided}<span class="faint">/{st.matches}</span></span><span class="l">Matches mit Ergebnis</span></div>
    <div class="tile"><span class="v num display">{st.activePlayers}</span><span class="l">aktive Spieler</span></div>
    <div class="tile" class:warn={!st.balanced}>
      <span class="v num display">{st.minGames}–{st.maxGames}</span><span class="l">Spiele pro Spieler</span>
    </div>
    <div class="tile"><span class="v num display">{minutes}</span><span class="l">Minuten seit Start</span></div>
  </div>

  {#if !st.balanced}
    <p class="alert alert-warning"><Icon name="info" size={17} /> Die Spielanzahl ist ungleich verteilt. Das kommt von Pausen, Nachmeldungen, ungleich großen Töpfen oder von Hand geänderten Runden. Die Auslosung gleicht es in den nächsten Runden aus.</p>
  {/if}

  <div class="two">
    <div>
      <h3 class="eyebrow">Spiele je Spieler</h3>
      <ul class="games">
        {#each games as g (g.p.id)}
          <li><span>{g.p.name}</span><span class="num strong">{g.n}</span></li>
        {/each}
      </ul>
    </div>
    {#if teamSize(t.settings) === 2}
      <div>
        <h3 class="eyebrow">Wiederholte Partnerschaften</h3>
        {#if repeats.length}
          <ul class="games">
            {#each repeats as r}
              <li><span>{r.a} &amp; {r.b}</span><span class="num strong">{r.n}×</span></li>
            {/each}
          </ul>
        {:else}
          <p class="muted">Bisher hat niemand zweimal mit demselben Partner gespielt.</p>
        {/if}
      </div>
    {/if}
  </div>
</section>

<style>
  .panel { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
  h2 { font-size: 30px; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .tile { display: flex; flex-direction: column; gap: 2px; padding: 14px; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--border); }
  .tile.warn { border-color: color-mix(in srgb, var(--warning) 45%, var(--border)); }
  .tile.warn .v { color: var(--warning); }
  .v { font-size: 34px; font-weight: 800; line-height: 1; }
  .l { font-size: 13px; color: var(--fg-muted); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  @media (max-width: 700px) { .two { grid-template-columns: 1fr; } }
  h3 { margin-bottom: 8px; }
  .games { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 16px; }
  .games li { display: flex; justify-content: space-between; gap: 10px; padding: 5px 2px; border-bottom: 1px solid var(--border); break-inside: avoid; font-size: 14px; }
  .strong { font-weight: 700; }
</style>
