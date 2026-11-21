<script lang="ts">
  import * as A from '../engine/actions';
  import { dialogs } from '../lib/dialog.svelte';
  import { store } from '../lib/store.svelte';
  import { timer } from '../lib/timer.svelte';
  import { ui, type Tab } from '../lib/ui.svelte';
  import { usesPools, type Pool } from '../engine/types';
  import Icon, { type IconName } from './Icon.svelte';
  import PlayBoard from './PlayBoard.svelte';
  import TimerPanel from './TimerPanel.svelte';
  import RankingTable from './RankingTable.svelte';
  import PlayersPanel from './PlayersPanel.svelte';
  import HistoryPanel from './HistoryPanel.svelte';
  import StatsPanel from './StatsPanel.svelte';

  const t = $derived(store.t);
  const tabs: { id: Tab; label: string; icon: IconName }[] = [
    { id: 'play', label: 'Spielbetrieb', icon: 'whistle' },
    { id: 'ranking', label: 'Rangliste', icon: 'trophy' },
    { id: 'players', label: 'Spieler', icon: 'users' },
    { id: 'history', label: 'Verlauf', icon: 'list' },
    { id: 'stats', label: 'Statistik', icon: 'chart' },
  ];
  async function finish() {
    const open = t.rounds.reduce((n, r) => n + r.matches.filter(m => !m.winner).length, 0);
    const ok = await dialogs.confirm({
      title: 'Turnier beenden?',
      text: `Danach folgt die Siegerehrung.${open ? `\n\nAchtung: ${open} Ergebnis${open === 1 ? '' : 'se'} fehlen noch.` : ''}\n\nMit „Weiterspielen“ geht es jederzeit zurück.`,
      confirm: 'Zur Siegerehrung',
    });
    if (ok) { timer.pause(); store.run('Turnier beenden', x => A.finish(x)); }
  }

  let rankPool = $state<Pool | undefined>(undefined);
  const pools = $derived(usesPools(t.settings));
</script>

<div class="layout">
  <div class="main">
    <nav class="tabs" aria-label="Bereiche">
      {#each tabs as tab (tab.id)}
        <button class="tab" class:on={ui.tab === tab.id} aria-current={ui.tab === tab.id ? 'page' : undefined} onclick={() => (ui.tab = tab.id)}>
          <Icon name={tab.icon} size={17} /> {tab.label}
        </button>
      {/each}
      <button class="tab finish" onclick={finish} title="Turnier beenden und zur Siegerehrung"><Icon name="flag" size={17} /> Turnier beenden</button>
    </nav>

    {#if ui.tab === 'play'}
      <PlayBoard />
    {:else if ui.tab === 'ranking'}
      <section class="card panel">
        <div class="panel-head">
          <h2>Rangliste</h2>
          {#if pools}
            <div class="seg" role="tablist">
              <button role="tab" aria-selected={rankPool === undefined} class:on={rankPool === undefined} onclick={() => (rankPool = undefined)}>Alle</button>
              <button role="tab" aria-selected={rankPool === 1} class:on={rankPool === 1} onclick={() => (rankPool = 1)}>{t.settings.poolLabels[0]}</button>
              <button role="tab" aria-selected={rankPool === 2} class:on={rankPool === 2} onclick={() => (rankPool = 2)}>{t.settings.poolLabels[1]}</button>
            </div>
          {/if}
        </div>
        <p class="muted rule">Wertung: mehr Siege vor weniger Spielen{t.settings.scoreTracking ? ' vor besserer Punktdifferenz' : ''}. Gleichstand = gleicher Platz.</p>
        <RankingTable {t} pool={rankPool} />
      </section>
    {:else if ui.tab === 'players'}
      <PlayersPanel />
    {:else if ui.tab === 'history'}
      <HistoryPanel />
    {:else}
      <StatsPanel />
    {/if}
  </div>

  <aside class="side">
    <TimerPanel />
    <section class="card mini">
      <div class="mini-head">
        <span class="eyebrow"><Icon name="trophy" size={14} /> Top 8</span>
        <button class="btn btn-ghost btn-sm" onclick={() => (ui.tab = 'ranking')}>alle <Icon name="chevronRight" size={14} /></button>
      </div>
      <RankingTable {t} limit={8} size="sm" />
    </section>
  </aside>
</div>

<style>
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 20px; align-items: start; }
  .side { position: sticky; top: 76px; display: flex; flex-direction: column; gap: 12px; }
  @media (max-width: 1100px) {
    .layout { grid-template-columns: minmax(0, 1fr); }
    .side { position: static; order: -1; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  }
  @media (max-width: 700px) {
    /* Handy: Timer oben, dann Spielbetrieb, Top 8 ganz unten */
    .side { display: contents; }
    .side > :global(.timer) { order: -1; }
    .mini { order: 1; }
  }
  .tabs { display: flex; gap: 4px; margin-bottom: 16px; padding: 4px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); overflow-x: auto; }
  .tab {
    display: inline-flex; align-items: center; gap: 8px; padding: 9px 15px; border-radius: 10px;
    border: 0; background: none; color: var(--fg-muted); font-weight: 600; cursor: pointer; white-space: nowrap;
  }
  .finish { margin-left: auto; }
  .tab:hover { color: var(--fg); background: var(--surface-2); }
  .tab.on { background: var(--surface-3); color: var(--fg); box-shadow: inset 0 -2px 0 var(--accent); }
  .panel { padding: 20px; }
  .panel-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 4px; }
  .panel-head h2 { font-size: 30px; }
  .rule { margin: 0 0 10px; font-size: 13px; }
  .seg { display: inline-flex; padding: 3px; border-radius: 11px; background: var(--surface-2); border: 1px solid var(--border); }
  .seg button { border: 0; background: none; padding: 6px 13px; border-radius: 8px; font-weight: 600; color: var(--fg-muted); cursor: pointer; }
  .seg button.on { background: var(--surface-3); color: var(--fg); }
  .mini { padding: 12px; }
  .mini-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .mini-head .eyebrow { display: inline-flex; gap: 6px; align-items: center; }
</style>
