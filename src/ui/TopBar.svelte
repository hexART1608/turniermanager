<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { ui, openBeamer, exportTournament, importTournament, startNewTournament } from '../lib/ui.svelte';
  import ClubLogo from './ClubLogo.svelte';
  import Icon from './Icon.svelte';
  import Menu from './Menu.svelte';
  import MiniPlayer from './MiniPlayer.svelte';
  import { music } from '../lib/music.svelte';

  const t = $derived(store.t);
  let showInfo = $state(false);
  const phaseLabel = $derived(t.phase === 'setup' ? 'Vorbereitung' : t.phase === 'running' ? 'Läuft' : 'Beendet');
</script>

<header class="top">
  <div class="brand">
    <ClubLogo height={38} />
    <div class="titles">
      <span class="app">Turniermanager <span class="ver" title="Versionsstand dieser Seite">{__APP_VERSION__}</span></span>
      <span class="name">{t.settings.name}</span>
    </div>
    <span class="phase phase-{t.phase}">{#if t.phase === 'running'}<span class="live"></span>{/if}{phaseLabel}</span>
    {#if t.phase === 'setup'}
      <button class="info-btn" type="button" aria-label="Infos zur Offline-Nutzung" aria-expanded={showInfo} title="Infos zur Offline-Nutzung" onclick={() => (showInfo = !showInfo)}><Icon name="info" size={16} /></button>
    {/if}
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
    {#if store.t.phase === 'running'}
      <button class="btn" onclick={() => (ui.scheduleOpen = true)} title="Übersicht aller Spiele ansehen und ändern">
        <Icon name="list" /> <span class="hide-sm">Übersicht</span>
      </button>
    {/if}
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

<svelte:window onkeydown={e => { if (showInfo && e.key === 'Escape') showInfo = false; }} />

{#if showInfo && t.phase === 'setup'}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="info-backdrop" onclick={() => (showInfo = false)}></div>
  <div class="info-pop" role="dialog" aria-label="Offline nutzen">
    <header><h2>Offline nutzen</h2><button type="button" class="x" aria-label="Schließen" onclick={() => (showInfo = false)}>✕</button></header>
    <ol>
      <li>Seite <b>einmal mit Internet</b> öffnen – dabei legt der Browser alle Dateien im Cache ab. Danach startet sie auch ohne Netz.</li>
      <li><b>Chrome / Edge:</b> in der Adressleiste auf „Installieren“ klicken (oder Menü → „App installieren“). <b>Safari (Mac):</b> Datei → „Zum Dock hinzufügen“.</li>
      <li><b>Firefox</b> kann am PC/Mac nicht installieren, die Seite läuft aber auch dort offline (Lesezeichen/Adresse nutzen).</li>
    </ol>
    <ul>
      <li>Timer, Turnier, Beamer und lokale MP3-Töne laufen ohne Netz.</li>
      <li><b>Spotify</b> braucht Internet und verbindet sich nach Netzausfall selbst wieder.</li>
      <li>Neue Versionen werden automatisch geholt, sobald das Gerät online ist (siehe Versionsnummer im Header).</li>
      <li>Daten liegen <b>pro Gerät und Browser</b>. Zwischen Geräten per Export/Import übertragen. Beim Löschen der Browserdaten geht der Offline-Cache verloren.</li>
      <li>Eigene Töne und die Spotify-Anmeldung auf jedem Gerät einmal einrichten.</li>
    </ul>
  </div>
{/if}

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
  .info-btn { display: inline-grid; place-items: center; width: 28px; height: 28px; padding: 0; border-radius: 50%; border: 1px solid var(--border); background: transparent; color: var(--fg-muted); cursor: pointer; }
  .info-btn:hover, .info-btn[aria-expanded='true'] { color: var(--accent); border-color: var(--accent); }
  .info-backdrop { position: fixed; inset: 0; z-index: 29; }
  .info-pop { position: fixed; z-index: 30; top: 64px; left: 24px; width: min(440px, calc(100vw - 32px)); max-height: calc(100dvh - 84px); overflow-y: auto; padding: 14px 18px 16px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); font-size: 13px; line-height: 1.5; color: var(--fg-muted); }
  .info-pop header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; position: static; background: none; border: 0; padding: 0; backdrop-filter: none; }
  .info-pop h2 { margin: 0; font-size: 15px; color: var(--fg); }
  .info-pop .x { background: none; border: 0; color: var(--fg-muted); cursor: pointer; font-size: 14px; }
  .info-pop ol, .info-pop ul { margin: 6px 0; padding-left: 20px; }
  .info-pop li { margin: 4px 0; }
  .info-pop b { color: var(--fg); }
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
    .ver { display: none; }
    .app { display: none; }
  }
</style>
