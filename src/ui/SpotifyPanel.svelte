<script lang="ts">
  import { spotify } from '../lib/spotify.svelte';
  import Icon from './Icon.svelte';

  let showSetup = $state(false);
  let showHelp = $state(false);
  const safe = (job: () => Promise<void>) => () => void job().catch(err => spotify.error = err instanceof Error ? err.message : 'Spotify-Aktion fehlgeschlagen.');
</script>

<section class="spotify" aria-label="Spotify">
  <div class="spotify-head">
    <span class="spotify-mark">●</span><strong>Spotify</strong>
    <button class="btn btn-ghost btn-icon btn-sm help" aria-label="Spotify einrichten: Anleitung" title="Spotify einrichten: Anleitung" aria-expanded={showHelp} onclick={() => showHelp = !showHelp}><Icon name="info" size={16} /></button>
    <span class:good={spotify.online} class="status">{spotify.online ? 'online' : 'offline'}</span>
  </div>

  {#if showHelp}
    <div class="helpbox">
      <h3>Spotify einrichten</h3>

      <p><b>Voraussetzung:</b> Die vollständige Spotify-Steuerung in dieser App benötigt eine aktive <b>Spotify-Premium-Mitgliedschaft</b>. Mit Spotify Free sind Anmeldung und Playlist-Link zwar möglich, Spotify verweigert aber die Wiedergabe- und Geräte-API (meist Fehler 403). Der Browser kann dann nicht als Ausgabegerät erscheinen.</p>

      <h4>Einmalig: Spotify-App anlegen</h4>
      <ol>
        <li>Öffne das <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">Spotify Developer Dashboard ↗</a> und melde dich mit dem Spotify-Premium-Konto an, das später Musik abspielt.</li>
        <li>Wähle <b>Create app</b>. Als Name passt beispielsweise <b>Turniermanager</b>, als Beschreibung <b>Private Spotify-Musiksteuerung für Badminton-Turniere</b>.</li>
        <li>Bei <b>Website</b> und bei <b>Redirect URI</b> trägst du jeweils exakt diese Adresse ein: <code>{location.origin}{location.pathname}</code>. Bei Redirect URI anschließend unbedingt <b>Add</b> drücken, bevor die App erstellt wird.</li>
        <li>Wähle <b>Web Playback SDK</b>. Ist <b>Web API</b> grau oder nicht auswählbar, ist das kein Problem – sie steht der App bereits zur Verfügung.</li>
        <li>Akzeptiere die Developer Terms und erstelle die App.</li>
        <li>Auf der Übersichtsseite der neuen App kopierst du die <b>Client ID</b> und fügst sie unten in dieses Musikfenster ein. <b>Nie das Client Secret kopieren oder hier eintragen.</b></li>
      </ol>

      <h4>Entwicklerzugriff freigeben</h4>
      <p>Neue Spotify-Apps laufen im Development Mode. Öffne im Dashboard deine App → <b>Settings</b> → <b>Users Management</b> und füge das Spotify-Konto hinzu, mit dem du dich hier anmeldest. Spotify erlaubt im Development Mode derzeit höchstens fünf freigegebene Nutzer. Details: <a href="https://developer.spotify.com/documentation/web-api/concepts/quota-modes" target="_blank" rel="noreferrer">Spotify: Development Mode und Nutzerfreigabe ↗</a>.</p>

      <h4>Im Turniermanager abspielen</h4>
      <ol>
        <li>Internetverbindung einschalten, die Client-ID einfügen und <b>Bei Spotify anmelden</b> wählen.</li>
        <li>Nach der Rückkehr zu dieser Seite auf <b>Diesen Browser verwenden</b> drücken. Der Rechner wird dann als Spotify-Connect-Ausgabegerät angelegt.</li>
        <li>In Spotify eine normale Playlist öffnen → <b>…</b> → <b>Teilen</b> → <b>Link zur Playlist kopieren</b>. Den Link hier einfügen und <b>Playlist starten</b> drücken.</li>
        <li>Wiedergabe, Pause, Vor/Zurück, Shuffle und Lautstärke lassen sich anschließend direkt hier steuern. Alternativ kann die Wiedergabe auf einem anderen aktiven Spotify-Connect-Gerät gesteuert werden.</li>
      </ol>

      <h4>Wenn etwas nicht klappt</h4>
      <ul>
        <li><b>„Spotify meldet Fehler 403“:</b> Premium fehlt oder das Konto ist nicht unter „Users Management“ freigegeben.</li>
        <li><b>„wird vorbereitet …“ beim Browsergerät:</b> Die Premium-Autorisierung ist nicht erfolgreich. Ohne Premium kann Spotify keinen Browser-Player anlegen.</li>
        <li><b>Anmeldung schlägt fehl:</b> Die Redirect-URL im Dashboard muss Zeichen für Zeichen mit der oben angezeigten Adresse übereinstimmen – einschließlich <code>https</code>, Pfad und abschließendem Schrägstrich.</li>
        <li><b>Playlist startet nicht:</b> Verwende einen Link, der mit <code>https://open.spotify.com/playlist/</code> beginnt. „Lieblingssongs“ (<code>/collection/tracks</code>) sind keine Playlist und können nicht gestartet werden.</li>
        <li><b>Ohne Premium:</b> Die lokale MP3-Musik unten ist die zuverlässige Alternative: Sie läuft auch ohne Netz und wird bei den Turniersignalen automatisch leiser. Spotify kann technisch nicht automatisch abgesenkt werden.</li>
      </ul>

      <p class="links"><a href="https://developer.spotify.com/documentation/web-playback-sdk/howtos/web-app-player/" target="_blank" rel="noreferrer">Offizielle Spotify-Anleitung zum Web Playback SDK ↗</a><a href="https://www.spotify.com/download/" target="_blank" rel="noreferrer">Spotify-App herunterladen ↗</a><a href="https://open.spotify.com/" target="_blank" rel="noreferrer">Spotify Web Player öffnen ↗</a></p>
      <p class="notice"><b>Hinweis zu Veranstaltungen:</b> Spotify beschränkt die Nutzung seiner Plattform, insbesondere nicht-interaktives Broadcasting. Prüfe für öffentliche Turniere außerdem die geltenden Musik- und Aufführungsrechte. <a href="https://developer.spotify.com/documentation/web-playback-sdk/reference" target="_blank" rel="noreferrer">Spotify Developer Policy ↗</a></p>
    </div>
  {/if}

  {#if !spotify.online}
    <p class="hint">Spotify steht nur mit Internetverbindung zur Verfügung. Deine lokale Musik bleibt weiterhin nutzbar.</p>
  {:else if !spotify.configured || showSetup}
    <div class="setup">
      <label>Spotify Client-ID
        <input class="input" autocomplete="off" placeholder="Client-ID aus dem Spotify Dashboard" value={spotify.clientId} oninput={e => spotify.setClientId(e.currentTarget.value)} />
      </label>
      <p class="hint">Im Spotify Dashboard diese Redirect-URL hinterlegen: <code>{location.origin}{location.pathname}</code></p>
      <div><button class="btn btn-primary btn-sm" disabled={!spotify.configured} onclick={() => void spotify.login()}>Bei Spotify anmelden</button>{#if spotify.configured}<button class="btn btn-ghost btn-sm" onclick={() => showSetup = false}>Fertig</button>{/if}</div>
    </div>
  {:else if !spotify.connected || spotify.loading}
    <div class="connect"><span>{spotify.loading ? 'Spotify wird verbunden …' : 'Spotify noch nicht angemeldet.'}</span><button class="btn btn-primary btn-sm" onclick={() => void spotify.login()}>Anmelden</button></div>
  {:else}
    <div class="now spotify-now">
      {#if spotify.artwork}<img src={spotify.artwork} alt="" />{/if}
      <div><div class="title">{spotify.title}</div>{#if spotify.artist}<div class="sub faint">{spotify.artist}</div>{/if}<div class="sub faint">{spotify.current?.device?.name ?? 'Kein Spotify-Gerät aktiv'}</div></div>
    </div>
    <div class="controls spotify-controls">
      <button class="btn btn-ghost btn-icon" title="Vorheriger Titel" aria-label="Spotify: vorheriger Titel" onclick={safe(() => spotify.previous())}><Icon name="skipBack" /></button>
      <button class="btn btn-primary play" title={spotify.playing ? 'Pause' : 'Abspielen'} aria-label={spotify.playing ? 'Spotify: Pause' : 'Spotify: Abspielen'} onclick={safe(() => spotify.toggle())}><Icon name={spotify.playing ? 'pause' : 'play'} size={22} /></button>
      <button class="btn btn-ghost btn-icon" title="Nächster Titel" aria-label="Spotify: nächster Titel" onclick={safe(() => spotify.next())}><Icon name="skipForward" /></button>
      <button class="btn btn-ghost btn-icon" class:on={spotify.current?.shuffle_state} aria-pressed={spotify.current?.shuffle_state ?? false} title="Zufallswiedergabe" aria-label="Spotify: Zufallswiedergabe" onclick={safe(() => spotify.setShuffle(!spotify.current?.shuffle_state))}><Icon name="shuffle" /></button>
    </div>
    <div class="playback-settings">
      <label class="volume"><Icon name="sound" size={16} /><span>Spotify-Lautstärke</span><input type="range" min="0" max="1" step="0.02" aria-label="Spotify Lautstärke" value={spotify.volume} oninput={e => void spotify.setVolume(Number(e.currentTarget.value))} /></label>
      <div class="browser"><div><strong>Ausgabegerät</strong><span>Musik über diesen Rechner ausgeben</span></div><button class="btn btn-sm" disabled={!spotify.playerReady} onclick={safe(() => spotify.useBrowser())}>{spotify.playerReady ? 'Diesen Browser verwenden' : 'wird vorbereitet …'}</button></div>
    </div>
    <div class="playlist">
      <label for="spotify-playlist">Playlist starten</label>
      <div class="playlist-row"><input id="spotify-playlist" class="input" placeholder="Spotify-Playlist-Link einfügen …" aria-label="Spotify-Playlist-Link" bind:value={spotify.playlistUrl} /><button class="btn btn-sm" disabled={!spotify.hasOutput} title={spotify.hasOutput ? 'Playlist auf dem Spotify-Ausgabegerät starten' : 'Zuerst ein Spotify-Ausgabegerät bereitstellen'} onclick={safe(() => spotify.playPlaylist())}>Starten</button></div>
    </div>
    <div class="spotify-foot"><button class="btn btn-ghost btn-sm" onclick={() => showSetup = true}>Einstellungen</button><button class="btn btn-ghost btn-sm" onclick={() => spotify.logout()}>Abmelden</button></div>
  {/if}
  {#if spotify.error}<p class="error">{spotify.error}</p>{/if}
</section>

<style>
  .spotify { border: 1px solid color-mix(in srgb, #1db954 38%, var(--border)); background: color-mix(in srgb, #1db954 7%, var(--surface-2)); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
  .spotify-head { display: flex; align-items: center; gap: 7px; } .spotify-mark { color: #1db954; font-size: 23px; line-height: 12px; } .help { margin-left: 1px; } .status { margin-left: auto; color: var(--fg-faint); font-size: 12px; } .status.good { color: #1b9a4c; }
  .helpbox { max-height: min(530px, 58vh); overflow: auto; padding: 11px; border-radius: 9px; background: var(--surface-1); font-size: 12px; line-height: 1.45; } .helpbox h3 { margin: 0; font-family: var(--font-display); font-size: 17px; } .helpbox h4 { margin: 13px 0 4px; font-size: 13px; } .helpbox p { margin: 5px 0; color: var(--fg-muted); } .helpbox ol, .helpbox ul { margin: 6px 0 6px 18px; padding: 0; } .helpbox li + li { margin-top: 5px; } .helpbox a { color: var(--accent); font-weight: 600; } .links { display: flex; flex-direction: column; gap: 4px; margin-top: 11px !important; } .helpbox .notice { margin-top: 11px; padding: 8px; border-left: 3px solid var(--warning); background: var(--warning-soft); color: var(--fg); }
  .hint, .error { margin: 0; font-size: 12px; color: var(--fg-muted); } .error { color: var(--danger); } code { overflow-wrap: anywhere; }
  .setup { display: flex; flex-direction: column; gap: 8px; font-size: 13px; } .setup label { display: flex; flex-direction: column; gap: 4px; }
  .connect, .spotify-foot { display: flex; align-items: center; gap: 7px; } .connect span { flex: 1; font-size: 13px; color: var(--fg-muted); }
  .spotify-now { display: flex; gap: 9px; align-items: center; } .spotify-now img { width: 46px; height: 46px; object-fit: cover; border-radius: 6px; } .spotify-now > div { min-width: 0; } .spotify-now .title { font-size: 16px; }
  .spotify-controls { margin: -2px 0; } .playback-settings { display: flex; flex-direction: column; gap: 9px; padding: 10px; border-radius: 9px; background: color-mix(in srgb, var(--surface-1) 72%, transparent); } .volume { display: grid; grid-template-columns: 20px 1fr; gap: 7px; align-items: center; font-size: 13px; color: var(--fg-muted); } .volume span { grid-column: 2; } .volume input { grid-column: 2; grid-row: 2; width: 100%; } .browser { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 9px; border-top: 1px solid var(--border); } .browser div { display: flex; flex-direction: column; min-width: 0; } .browser strong { font-size: 13px; } .browser span { font-size: 12px; color: var(--fg-muted); } .browser .btn { flex: none; }
  .playlist { display: flex; flex-direction: column; gap: 5px; } .playlist > label { font-size: 12px; font-weight: 700; color: var(--fg-muted); text-transform: uppercase; letter-spacing: .06em; } .playlist-row { display: flex; align-items: center; gap: 7px; } .playlist .input { min-width: 0; flex: 1; } .spotify-foot { justify-content: space-between; padding-top: 9px; border-top: 1px solid var(--border); }
</style>
