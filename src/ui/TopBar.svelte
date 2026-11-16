<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { ui, openBeamer, exportTournament, importTournament, startNewTournament } from '../lib/ui.svelte';
  import Logo from './Logo.svelte';
  import Icon from './Icon.svelte';
  import Menu from './Menu.svelte';
  import MiniPlayer from './MiniPlayer.svelte';
  import { music } from '../lib/music.svelte';

  const t = $derived(store.t);
  const phaseLabel = $derived(t.phase === 'setup' ? 'Vorbereitung' : t.phase === 'running' ? 'Läuft' : 'Beendet');
</script>

<header class="top">
  <div class="brand">
    <Logo size={38} />
    <div class="titles">
      <span class="app">Turniermanager <span class="ver" title="Versionsstand dieser Seite">{__APP_VERSION__}</span></span>
      <span class="name">{t.settings.name}</span>
    </div>
    <span class="phase phase-{t.phase}">{#if t.phase === 'running'}<span class="live"></span>{/if}{phaseLabel}</span>
  </div>

  <div class="mid"><MiniPlayer /></div>

  <div class="actions">
    <button
      class="btn btn-ghost"
      disabled={!store.canUndo}
      onclick={() => store.undo()}
      title={store.canUndo ? `Rückgängig: ${store.undoLabel} (Strg+Z)` : 'Nichts rückgängig zu machen'}>
      <Icon name="undo" /> <span class="hide-sm">Rückgängig</span>
    </button>
    <button
      class="btn music-btn"
      class:on={music.panelOpen}
      aria-pressed={music.panelOpen}
      onclick={() => (music.panelOpen = !music.panelOpen)}
      title={music.current ? `Musik: ${music.current.name} (M)` : 'Musik (M)'}>
      {#if music.playing}<span class="eq" class:ducked={music.ducked} aria-hidden="true"><i></i><i></i><i></i></span>{:else}<Icon name="music" />{/if}
      <span class="hide-sm">Musik</span>
    </button>
    <button class="btn" onclick={() => openBeamer()} title="Großanzeige für Beamer oder TV öffnen (B)">
      <Icon name="screen" /> <span class="hide-sm">Beamer</span>
    </button>
    <button class="btn btn-ghost btn-icon" onclick={() => ui.toggleTheme()} title={ui.theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}>
      <Icon name={ui.theme === 'dark' ? 'sun' : 'moon'} />
    </button>
    <Menu
      items={[
        { icon: 'sound', label: 'Töne & Timer-Signale', run: () => (ui.soundOpen = true) },
        { icon: 'screen', label: 'Nur Timer im Fenster', run: () => openBeamer('timer') },
        { icon: 'trophy', label: 'Nur Rangliste im Fenster', run: () => openBeamer('ranking') },
        { icon: 'list', label: 'Nur Spielplan im Fenster', run: () => openBeamer('courts') },
        { divider: true },
        { icon: 'download', label: 'Turnier exportieren', run: exportTournament },
        { icon: 'upload', label: 'Turnier importieren …', run: importTournament },
        { divider: true },
        { icon: 'restart', label: 'Neues Turnier …', run: startNewTournament, danger: true },
      ]} />
  </div>
</header>

<style>
  .top {
    position: sticky; top: 0; z-index: 20;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 10px 24px;
    background: color-mix(in srgb, var(--bg) 78%, transparent);
    backdrop-filter: blur(14px) saturate(1.4);
    border-bottom: 1px solid var(--border);
  }
  .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .titles { display: flex; flex-direction: column; min-width: 0; }
  .app { font-family: var(--font-display); font-weight: 600; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--fg-muted); }
  .ver { margin-left: 6px; font-weight: 500; letter-spacing: 0.04em; text-transform: none; opacity: 0.75; font-variant-numeric: tabular-nums; }
  .name { font-family: var(--font-display); font-weight: 700; font-size: 21px; line-height: 1.05; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .phase {
    display: inline-flex; align-items: center; gap: 7px;
    margin-left: 6px; padding: 4px 10px; border-radius: 999px;
    font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    background: var(--surface-3); color: var(--fg-muted);
  }
  .phase-running { background: var(--accent-soft); color: var(--accent); }
  .phase-finished { background: var(--warning-soft); color: var(--warning); }
  .live { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 0 var(--accent-glow); animation: live 1.8s infinite; }
  @keyframes live { 0% { box-shadow: 0 0 0 0 var(--accent-glow); } 70% { box-shadow: 0 0 0 9px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
  .mid { flex: 1; min-width: 0; display: flex; justify-content: center; }
  .actions { display: flex; align-items: center; gap: 6px; }
  .music-btn.on { border-color: var(--accent); }
  .eq { display: inline-flex; gap: 2px; align-items: flex-end; width: 18px; height: 16px; justify-content: center; }
  .eq i { width: 3px; background: var(--accent); border-radius: 1px; animation: eq 0.9s ease-in-out infinite; }
  .eq i:nth-child(2) { animation-delay: -0.3s; }
  .eq i:nth-child(3) { animation-delay: -0.6s; }
  .eq.ducked i { background: var(--warning); animation-duration: 1.8s; }
  @keyframes eq { 0%, 100% { height: 4px; } 50% { height: 16px; } }
  @media (max-width: 800px) {
    .top { padding: 8px 14px; }
    .hide-sm { display: none; }
    .phase { display: none; }
  }
</style>
