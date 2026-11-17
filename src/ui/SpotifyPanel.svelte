<script lang="ts">
  import { type SearchTrack, spotify } from '../lib/spotify.svelte';
  import Icon from './Icon.svelte';

  let { mini = false }: { mini?: boolean } = $props();
  let query = $state('');
  let showSetup = $state(false);
  let showHelp = $state(false);
  const safe = (job: () => Promise<void>) => () => void job().catch(err => spotify.error = err instanceof Error ? err.message : 'Spotify-Aktion fehlgeschlagen.');
  // Titel der Playlist laden, sobald eine verbunden ist und der Link sich ändert
  $effect(() => {
    const id = spotify.playlistId;
    if (spotify.connected && id && spotify.playlistLoaded !== id && !spotify.playlistLoading) void spotify.loadPlaylist();
  });
  const playingUri = $derived(spotify.current?.item?.uri);
  const onBrowser = $derived(!!spotify.browserDeviceId && spotify.current?.device?.id === spotify.browserDeviceId);
</script>

<svelte:window onkeydown={e => { if (showHelp && e.key === 'Escape') { showHelp = false; e.stopPropagation(); } }} />

{#snippet queuedRow(t: SearchTrack)}
  <li class="extra" class:cur={t.uri === playingUri}>
    <span class="no"><Icon name="skipForward" size={12} /></span>
    <span class="r-meta"><span class="r-title">{t.name}</span><span class="r-artist">{t.artist}</span></span>
    <span class="chip" title="Wird nach dem aktuellen Titel gespielt und nicht in der Playlist gespeichert">Als Nächstes</span>
  </li>
{/snippet}

<div class="sp">
  <div class="status-row">
    <span class="dot" class:on={spotify.online}></span>
    <span class="st">{spotify.online ? 'Online' : 'Offline'}</span>
  </div>

  {#if !spotify.online}
    <p class="hint">Spotify braucht eine Internetverbindung. Deine lokale Musik bleibt nutzbar.</p>
  {:else if !spotify.configured || showSetup}
    <div class="setup">
      <label>Spotify Client-ID
        <input class="input" autocomplete="off" placeholder="Client-ID aus dem Spotify Dashboard" value={spotify.clientId} oninput={e => spotify.setClientId(e.currentTarget.value)} />
      </label>
      <p class="hint">Im Spotify Dashboard diese Redirect-URL hinterlegen: <code>{location.origin}{location.pathname}</code></p>
      <div class="row">
        <button class="btn btn-primary btn-sm" disabled={!spotify.configured} onclick={() => void spotify.login()}>Bei Spotify anmelden</button>
        {#if spotify.configured}<button class="btn btn-ghost btn-sm" onclick={() => showSetup = false}>Fertig</button>{/if}
      </div>
    </div>
  {:else if !spotify.connected || spotify.loading}
    <div class="connect"><span>{spotify.loading ? 'Spotify wird verbunden …' : 'Spotify noch nicht angemeldet.'}</span><button class="btn btn-primary btn-sm" onclick={() => void spotify.login()}>Anmelden</button></div>
  {:else}
    <div class="now">
      {#if spotify.artwork}<img src={spotify.artwork} alt="" />{:else}<div class="art"><Icon name="music" size={22} /></div>{/if}
      <div class="meta">
        <div class="title" title={spotify.title}>{spotify.title}</div>
        <div class="sub">{spotify.artist || (spotify.current?.device?.name ?? 'Kein Spotify-Gerät aktiv')}</div>
      </div>
    </div>

    <div class="controls">
      <button class="btn btn-ghost btn-icon" class:on={spotify.current?.shuffle_state} aria-pressed={spotify.current?.shuffle_state ?? false} title="Zufallswiedergabe" aria-label="Spotify: Zufallswiedergabe" onclick={safe(() => spotify.setShuffle(!spotify.current?.shuffle_state))}><Icon name="shuffle" /></button>
      <button class="btn btn-ghost btn-icon" title="Vorheriger Titel" aria-label="Spotify: vorheriger Titel" onclick={safe(() => spotify.previous())}><Icon name="skipBack" /></button>
      <button class="btn btn-primary play" title={spotify.playing ? 'Pause' : 'Abspielen'} aria-label={spotify.playing ? 'Spotify: Pause' : 'Spotify: Abspielen'} onclick={safe(() => spotify.toggle())}><Icon name={spotify.playing ? 'pause' : 'play'} size={22} /></button>
      <button class="btn btn-ghost btn-icon" title="Nächster Titel" aria-label="Spotify: nächster Titel" onclick={safe(() => spotify.next())}><Icon name="skipForward" /></button>
      <span class="spacer"></span>
    </div>

    {#if !mini}
    <label class="vol">
      <Icon name="sound" size={16} />
      <input type="range" min="0" max="1" step="0.02" aria-label="Spotify Lautstärke" value={spotify.volume} oninput={e => void spotify.setVolume(Number(e.currentTarget.value))} />
      <span class="v num">{Math.round(spotify.volume * 100)} %</span>
    </label>

    <div class="out">
      <div class="out-text">
        <strong>Ausgabe</strong>
        <span>{onBrowser ? 'Über diesen Rechner' : (spotify.current?.device?.name ?? 'Noch kein Gerät gewählt')}</span>
      </div>
      {#if onBrowser}
        <span class="chip chip-ok"><Icon name="check" size={13} /> aktiv</span>
      {:else}
        <button class="btn btn-sm" disabled={!spotify.playerReady} onclick={safe(() => spotify.useBrowser())}>{spotify.playerReady ? 'Diesen Rechner nutzen' : 'wird vorbereitet …'}</button>
      {/if}
    </div>

    <div class="playlist">
      <label for="spotify-playlist" class="eyebrow">Playlist starten</label>
      <div class="row">
        <input id="spotify-playlist" class="input" placeholder="Spotify-Playlist-Link einfügen …" aria-label="Spotify-Playlist-Link" bind:value={spotify.playlistUrl} />
        <button class="btn btn-sm" disabled={!spotify.hasOutput} title={spotify.hasOutput ? 'Playlist auf dem Spotify-Ausgabegerät starten' : 'Zuerst ein Spotify-Ausgabegerät bereitstellen'} onclick={safe(() => spotify.playPlaylist())}>Starten</button>
      </div>
    </div>

    {#if spotify.playlistTracks.length || spotify.extras.length || spotify.queued.length}
      <div class="pl">
        <div class="pl-head"><span class="eyebrow">In der Playlist</span><span class="faint num">{spotify.playlistTracks.length} Titel{spotify.extras.length ? ` + ${spotify.extras.length} Autoplay` : ''}</span></div>
        <ol class="plist">
          {#each spotify.queued.filter(q => q.after === null) as t (t.uri)}
            {@render queuedRow(t)}
          {/each}
          {#each spotify.playlistTracks as t, i (t.uri + i)}
            <li class="song" class:cur={t.uri === playingUri}>
              <button class="play" onclick={safe(() => spotify.playTrack(t))} title="Abspielen">
                <span class="no num">{i + 1}</span>
                <span class="r-meta"><span class="r-title">{t.name}</span><span class="r-artist">{t.artist}</span></span>
              </button>
              <button class="btn btn-sm btn-ghost btn-icon rm" title="Aus Playlist entfernen" aria-label="„{t.name}“ aus Playlist entfernen" onclick={safe(() => spotify.removeFromPlaylist(t))}><Icon name="trash" size={15} /></button>
            </li>
            {#each spotify.queued.filter(q => q.after === t.uri) as q (q.uri)}
              {@render queuedRow(q)}
            {/each}
          {/each}
          {#each spotify.extras as t (t.uri)}
            <li class="extra" class:cur={t.uri === playingUri}>
              <span class="no"><Icon name="music" size={12} /></span>
              <span class="r-meta"><span class="r-title">{t.name}</span><span class="r-artist">{t.artist}</span></span>
              <span class="chip" title="Von Spotify nach dem Ende der Playlist automatisch weitergespielt">Autoplay</span>
              {#if !spotify.autoAdd}
                <button class="btn btn-sm btn-ghost btn-icon" title="In die Playlist aufnehmen" aria-label="„{t.name}“ in die Playlist aufnehmen" onclick={safe(() => spotify.addToPlaylist(t))}><Icon name="plus" size={16} /></button>
              {/if}
            </li>
          {/each}
        </ol>
        <label class="auto"><input type="checkbox" class="chk" checked={spotify.autoAdd} onchange={e => spotify.setAutoAdd(e.currentTarget.checked)} /> Autoplay-Titel automatisch in die Playlist aufnehmen</label>
      </div>
    {:else if spotify.playlistLoading}
      <p class="hint">Playlist wird geladen …</p>
    {/if}

    <div class="search">
      <label for="spotify-search" class="eyebrow">Lied suchen</label>
      <form class="row" onsubmit={e => { e.preventDefault(); void spotify.search(query).catch(err => spotify.error = err instanceof Error ? err.message : 'Suche fehlgeschlagen.'); }}>
        <input id="spotify-search" class="input" type="search" placeholder="Titel oder Interpret …" aria-label="Lied suchen" bind:value={query} />
        <button class="btn btn-sm" type="submit" disabled={!query.trim() || spotify.searching}>{spotify.searching ? 'Suche …' : 'Suchen'}</button>
      </form>
      {#if spotify.results.length}
        <ul class="results">
          {#each spotify.results as r (r.uri)}
            <li>
              {#if r.image}<img src={r.image} alt="" />{:else}<span class="art-s"><Icon name="music" size={14} /></span>{/if}
              <span class="r-meta"><span class="r-title">{r.name}</span><span class="r-artist">{r.artist}</span></span>
              <button class="btn btn-sm btn-ghost btn-icon" title="An Playlist anhängen" aria-label="„{r.name}“ an Playlist anhängen" disabled={!spotify.playlistId} onclick={safe(() => spotify.addToPlaylist(r))}><Icon name="plus" size={16} /></button>
              <button class="btn btn-sm btn-ghost btn-icon" title="Als nächstes abspielen (nicht in der Playlist gespeichert)" aria-label="„{r.name}“ als nächstes abspielen" onclick={safe(() => spotify.queueTrack(r))}><Icon name="skipForward" size={16} /></button>
              <button class="btn btn-sm btn-ghost btn-icon" title="Direkt abspielen (aktueller Titel wird beendet)" aria-label="„{r.name}“ direkt abspielen" onclick={safe(() => spotify.playNow(r))}><Icon name="play" size={16} /></button>
            </li>
          {/each}
        </ul>
        {#if !spotify.playlistId}<p class="hint">Für „An Playlist anhängen“ oben den Playlist-Link eintragen.</p>{/if}
      {:else if spotify.searched}
        <p class="hint">Nichts gefunden für „{spotify.searched}“.</p>
      {/if}
    </div>

    <div class="foot">
      <button class="btn btn-ghost btn-sm" onclick={() => showSetup = true}>Einstellungen</button>
      <button class="btn btn-ghost btn-sm" onclick={() => spotify.logout()}>Abmelden</button>
    </div>
    {/if}
  {/if}
  {#if spotify.error}
    <p class="error"><span>{spotify.error}</span><button class="x" aria-label="Meldung schließen" onclick={() => spotify.error = null}><Icon name="x" size={14} /></button></p>
  {/if}

  <button class="help-toggle" aria-expanded={showHelp} onclick={() => showHelp = !showHelp}>
    <Icon name="info" size={15} /> {showHelp ? 'Anleitung schließen' : 'Spotify einrichten – Anleitung'}
  </button>
  {#if showHelp}
    <div class="helpbox">
      <div class="help-head"><h3>Spotify einrichten</h3><button class="btn btn-ghost btn-icon btn-sm" aria-label="Anleitung schließen" title="Schließen" onclick={() => showHelp = false}><Icon name="x" size={16} /></button></div>

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
        <li><b>Ohne Premium:</b> Die lokale MP3-Musik unten ist die zuverlässige Alternative: Sie läuft auch ohne Netz.</li>
      </ul>

      <p class="links"><a href="https://developer.spotify.com/documentation/web-playback-sdk/howtos/web-app-player/" target="_blank" rel="noreferrer">Offizielle Spotify-Anleitung zum Web Playback SDK ↗</a><a href="https://www.spotify.com/download/" target="_blank" rel="noreferrer">Spotify-App herunterladen ↗</a><a href="https://open.spotify.com/" target="_blank" rel="noreferrer">Spotify Web Player öffnen ↗</a></p>
      <p class="notice"><b>Hinweis zu Veranstaltungen:</b> Spotify beschränkt die Nutzung seiner Plattform, insbesondere nicht-interaktives Broadcasting. Prüfe für öffentliche Turniere außerdem die geltenden Musik- und Aufführungsrechte. <a href="https://developer.spotify.com/documentation/web-playback-sdk/reference" target="_blank" rel="noreferrer">Spotify Developer Policy ↗</a></p>
    </div>
  {/if}
</div>

<style>
  .sp { display: flex; flex-direction: column; gap: 12px; }
  .status-row { display: flex; align-items: center; gap: 7px; margin-bottom: -4px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--fg-faint); }
  .dot.on { background: #1db954; box-shadow: 0 0 0 3px color-mix(in srgb, #1db954 25%, transparent); }
  .st { font-size: 12px; color: var(--fg-muted); }

  .helpbox { max-height: min(420px, 50vh); overflow: auto; padding: 12px; border-radius: 10px; background: var(--surface-2); font-size: 12px; line-height: 1.45; }
  .help-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; position: sticky; top: -12px; margin: -12px -12px 0; padding: 8px 8px 8px 12px; background: var(--surface-2); z-index: 1; }
  .helpbox h3 { margin: 0; font-family: var(--font-display); font-size: 17px; }
  .helpbox h4 { margin: 13px 0 4px; font-size: 13px; }
  .helpbox p { margin: 5px 0; color: var(--fg-muted); }
  .helpbox ol, .helpbox ul { margin: 6px 0 6px 18px; padding: 0; }
  .helpbox li + li { margin-top: 5px; }
  .helpbox a { color: var(--accent); font-weight: 600; }
  .links { display: flex; flex-direction: column; gap: 4px; margin-top: 11px !important; }
  .helpbox .notice { margin-top: 11px; padding: 8px; border-left: 3px solid var(--warning); background: var(--warning-soft); color: var(--fg); }

  .hint, .error { margin: 0; font-size: 12px; color: var(--fg-muted); }
  .error { color: var(--danger); padding: 8px 10px; border-radius: 9px; background: var(--danger-soft); line-height: 1.4; }
  code { overflow-wrap: anywhere; }
  .setup { display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
  .setup label { display: flex; flex-direction: column; gap: 4px; }
  .row { display: flex; align-items: center; gap: 7px; }
  .connect { display: flex; align-items: center; gap: 8px; }
  .connect span { flex: 1; font-size: 13px; color: var(--fg-muted); }

  .now { display: flex; gap: 12px; align-items: center; }
  .now img, .art { width: 56px; height: 56px; flex: none; border-radius: 9px; object-fit: cover; box-shadow: 0 6px 16px -8px rgba(0, 0, 0, 0.6); }
  .art { display: grid; place-items: center; background: var(--surface-3); color: var(--fg-faint); }
  .meta { min-width: 0; }
  .title { font-family: var(--font-display); font-weight: 700; font-size: 18px; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: 13px; color: var(--fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }

  .controls { display: flex; align-items: center; justify-content: center; gap: 6px; }
  .controls .on { color: var(--accent); background: var(--accent-soft); }
  .controls .spacer { width: 0; }
  .play { width: 52px; height: 52px; border-radius: 50%; padding: 0; }

  .vol { display: grid; grid-template-columns: 20px 1fr 40px; align-items: center; gap: 8px; color: var(--fg-muted); }
  .vol input { accent-color: var(--accent); min-width: 0; }
  .v { text-align: right; font-size: 12px; }

  .out { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border-radius: 11px; background: var(--surface-2); }
  .out-text { display: flex; flex-direction: column; min-width: 0; }
  .out-text strong { font-size: 13px; }
  .out-text span { font-size: 12px; color: var(--fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .out .btn { flex: none; }
  .chip-ok { display: inline-flex; align-items: center; gap: 4px; background: var(--success-soft); color: var(--success); font-weight: 700; }

  .playlist { display: flex; flex-direction: column; gap: 6px; }
  .playlist .input { min-width: 0; flex: 1; }
  .pl { display: flex; flex-direction: column; gap: 6px; }
  .pl-head { display: flex; align-items: baseline; justify-content: space-between; }
  .pl-head .faint { font-size: 12px; }
  .plist { list-style: none; margin: 0 -6px; padding: 0; max-height: 220px; overflow-y: auto; }
  .plist li.song { display: flex; align-items: center; padding-right: 4px; }
  .plist li.song > .play { flex: 1; min-width: 0; }
  .plist li.song .rm { flex: none; opacity: 0.55; }
  .plist li.song:hover .rm, .plist li.song .rm:focus-visible { opacity: 1; }
  .plist li:not(.extra) > button.play { display: flex; align-items: center; gap: 10px; width: 100%; padding: 5px 8px; border: 0; border-radius: 9px; background: none; cursor: pointer; text-align: left; height: 44px; }
  .plist li:not(.extra) > button.play:hover { background: var(--surface-2); }
  .plist li.cur { background: var(--accent-soft); border-radius: 9px; }
  .plist li.cur .r-title { color: var(--accent); }
  .plist li.extra { display: flex; align-items: center; gap: 10px; padding: 0 4px 0 8px; height: 44px; }
  .plist li.extra .no { display: grid; place-items: center; }
  .auto { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--fg-muted); cursor: pointer; }
  .chk { width: 16px; height: 16px; accent-color: var(--accent); margin: 0; }
  .no { width: 24px; flex: none; text-align: right; font-size: 12px; color: var(--fg-faint); }
  .search { display: flex; flex-direction: column; gap: 6px; }
  .search .input { flex: 1; min-width: 0; }
  .results { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .results li { display: flex; align-items: center; gap: 9px; padding: 4px 4px 4px 6px; border-radius: 9px; }
  .results li:hover { background: var(--surface-2); }
  .results img, .art-s { width: 34px; height: 34px; flex: none; border-radius: 6px; object-fit: cover; }
  .art-s { display: grid; place-items: center; background: var(--surface-3); color: var(--fg-faint); }
  .r-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .r-title { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .r-artist { font-size: 12px; color: var(--fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .error { display: flex; align-items: flex-start; gap: 8px; }
  .error span { flex: 1; }
  .error .x { border: 0; background: none; color: inherit; cursor: pointer; padding: 2px; border-radius: 5px; display: grid; }
  .help-toggle { display: flex; align-items: center; gap: 7px; align-self: flex-start; border: 0; background: none; color: var(--fg-muted); font-size: 12px; font-weight: 600; cursor: pointer; padding: 4px 6px; margin: 0 -6px; border-radius: 7px; }
  .help-toggle:hover { color: var(--fg); background: var(--surface-2); }
  .foot { display: flex; justify-content: space-between; margin: 0 -6px -4px; }
</style>
