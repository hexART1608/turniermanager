<script lang="ts">
  import * as A from '../engine/actions';
  import { stats } from '../engine/ranking';
  import { type Pool, usesPools } from '../engine/types';
  import { store } from '../lib/store.svelte';
  import { exportTournament, openBeamer, startNewTournament } from '../lib/ui.svelte';
  import Confetti from './Confetti.svelte';
  import Icon from './Icon.svelte';
  import Podium from './Podium.svelte';
  import RankingTable from './RankingTable.svelte';

  const t = $derived(store.t);
  const pools = $derived(usesPools(t.settings));
  const st = $derived(stats(t));
  let pool = $state<Pool | undefined>(undefined);
  let burst = $state(0);
</script>

{#key burst}<Confetti />{/key}

<section class="cer">
  <div class="hero">
    <p class="eyebrow">Siegerehrung</p>
    <h1>{t.settings.name}</h1>
    <p class="muted facts num">{st.rounds} Runden · {st.decided} Matches · {st.activePlayers} Spieler</p>
  </div>

  {#if pools}
    <div class="seg" role="tablist">
      <button role="tab" aria-selected={pool === undefined} class:on={pool === undefined} onclick={() => (pool = undefined)}>Gesamt</button>
      <button role="tab" aria-selected={pool === 1} class:on={pool === 1} onclick={() => (pool = 1)}>{t.settings.poolLabels[0]}</button>
      <button role="tab" aria-selected={pool === 2} class:on={pool === 2} onclick={() => (pool = 2)}>{t.settings.poolLabels[1]}</button>
    </div>
  {/if}

  {#key pool}<Podium {t} {pool} />{/key}

  <div class="actions">
    <button class="btn" onclick={() => burst++}><Icon name="trophy" /> Nochmal Konfetti</button>
    <button class="btn" onclick={() => openBeamer()}><Icon name="screen" /> Auf dem Beamer zeigen</button>
    <button class="btn" onclick={exportTournament}><Icon name="download" /> Exportieren</button>
    <button class="btn" onclick={() => store.run('Weiterspielen', x => A.resume(x))}><Icon name="play" /> Weiterspielen</button>
    <button class="btn btn-ghost" onclick={startNewTournament}><Icon name="restart" /> Neues Turnier</button>
  </div>

  <div class="card table">
    <h2>Endstand{pool ? ` · ${t.settings.poolLabels[pool - 1]}` : ''}</h2>
    <RankingTable {t} {pool} />
  </div>
</section>

<style>
  .cer { display: flex; flex-direction: column; align-items: center; gap: 26px; padding-top: 10px; }
  .hero { text-align: center; }
  .hero h1 { font-size: clamp(40px, 6vw, 72px); font-weight: 800; background: linear-gradient(180deg, #fff, var(--accent)); -webkit-background-clip: text; background-clip: text; color: transparent; }
  :global([data-theme='light']) .hero h1 { background: linear-gradient(180deg, var(--fg), var(--accent)); -webkit-background-clip: text; background-clip: text; }
  .facts { margin: 6px 0 0; }
  .seg { display: inline-flex; padding: 3px; border-radius: 11px; background: var(--surface-2); border: 1px solid var(--border); }
  .seg button { border: 0; background: none; padding: 7px 15px; border-radius: 8px; font-weight: 600; color: var(--fg-muted); cursor: pointer; }
  .seg button.on { background: var(--surface-3); color: var(--fg); }
  :global(.cer .podium) { width: 100%; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .table { width: 100%; max-width: 860px; padding: 20px; }
  .table h2 { font-size: 26px; margin-bottom: 8px; }
</style>
