<script lang="ts">
  // Schwebendes Musikfenster: verschiebbar, nicht modal – die Steuerung bleibt bedienbar.
  // Schließen blendet nur das Fenster aus, die Musik läuft weiter.
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { canPickFolder, formatTime, music } from '../lib/music.svelte';
  import { dialogs } from '../lib/dialog.svelte';
  import { KEYS, readJson, writeJson } from '../lib/storage';
  import Icon from './Icon.svelte';
  import SpotifyPanel from './SpotifyPanel.svelte';
  import { spotify } from '../lib/spotify.svelte';

  let panel: HTMLElement;
  let fileInput = $state<HTMLInputElement>();
  let folderInput = $state<HTMLInputElement>();
  let query = $state('');
  let seeking = $state<number | null>(null);
  // Mini-Modus: nur Titel + Steuerung (gemerkt)
  let mini = $state(readJson(`${KEYS.music}.mini`) === true);
  function toggleMini() { mini = !mini; writeJson(`${KEYS.music}.mini`, mini); if (pos) pos = clamp(pos); }

  // Quelle: Spotify oder lokale Dateien (gemerkt; ohne Spotify-Einrichtung zuerst lokal)
  type Source = 'spotify' | 'local';
  const savedSource = readJson(`${KEYS.music}.source`);
  let source = $state<Source>(savedSource === 'spotify' || savedSource === 'local' ? savedSource : (spotify.configured ? 'spotify' : 'local'));
  function setSource(s: Source) { source = s; writeJson(`${KEYS.music}.source`, s); }

  // ---------- Position (verschiebbar, gemerkt) ----------
  const saved = readJson(`${KEYS.music}.pos`) as { x: number; y: number } | null;
  let pos = $state<{ x: number; y: number } | null>(saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : null);
  let drag: { dx: number; dy: number } | null = null;

  function clamp(p: { x: number; y: number }) {
    const w = panel?.offsetWidth ?? 380, h = 60;
    return { x: Math.min(Math.max(8, p.x), innerWidth - w - 8), y: Math.min(Math.max(8, p.y), innerHeight - h) };
  }
  function down(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return;
    const r = panel.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!drag) return;
    pos = clamp({ x: e.clientX - drag.dx, y: e.clientY - drag.dy });
  }
  function up() {
    if (drag && pos) writeJson(`${KEYS.music}.pos`, pos);
    drag = null;
  }
  onMount(() => {
    if (pos) pos = clamp(pos);
    const onResize = () => { if (pos) pos = clamp(pos); };
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  });

  // ---------- Liste ----------
  const filtered = $derived.by(() => {
    const q = query.trim().toLocaleLowerCase('de');
    const list = music.tracks.map((t, i) => ({ t, i }));
    return q ? list.filter(x => x.t.name.toLocaleLowerCase('de').includes(q)) : list;
  });
  const MAX_ROWS = 400;
  const currentIndex = $derived(music.tracks.findIndex(t => t.id === music.currentId));

  function scrollToCurrent(node: HTMLElement, id: string | null) {
    const go = () => node.querySelector('.cur')?.scrollIntoView({ block: 'nearest' });
    queueMicrotask(go);
    return { update: () => queueMicrotask(go) };
  }

  async function clearAll() {
    const ok = await dialogs.confirm({ title: 'Playlist leeren?', text: `Alle ${music.tracks.length} Titel werden aus der Liste entfernt. Die Dateien auf dem Laptop bleiben natürlich erhalten.`, confirm: 'Leeren', danger: true });
    if (ok) await music.clear();
  }

  function pickFolder() {
    if (canPickFolder) void music.pickFolder();
    else folderInput?.click();
  }
</script>

<section
  class="music card"
  bind:this={panel}
  style:left={pos ? `${pos.x}px` : null}
  style:top={pos ? `${pos.y}px` : null}
  aria-label="Musik"
  transition:fly={{ y: -10, duration: 180 }}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <header onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
    <span class="grip"><Icon name="grip" size={16} /></span>
    <Icon name="music" size={17} />
    <strong>Musik</strong>
    {#if music.ducked}<span class="chip chip-warning">Signal – leiser</span>{/if}
    <button class="btn btn-ghost btn-icon btn-sm close" aria-label={mini ? 'Playlist zeigen' : 'Auf Mini-Player verkleinern'} title={mini ? 'Playlist zeigen' : 'Verkleinern'} aria-pressed={mini} onclick={toggleMini}><Icon name={mini ? 'arrowDown' : 'arrowUp'} size={16} /></button>
    <button class="btn btn-ghost btn-icon btn-sm" aria-label="Musikfenster schließen (Musik läuft weiter)" title="Schließen – Musik läuft weiter" onclick={() => (music.panelOpen = false)}><Icon name="x" size={16} /></button>
  </header>

  <nav class="tabs" aria-label="Musikquelle">
    <button class:on={source === 'spotify'} aria-pressed={source === 'spotify'} onclick={() => setSource('spotify')}>
      <span class="sdot" class:live={spotify.playing}></span> Spotify
    </button>
    <button class:on={source === 'local'} aria-pressed={source === 'local'} onclick={() => setSource('local')}>
      {#if music.playing}<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>{:else}<Icon name="folder" size={14} />{/if} Dieser Rechner
    </button>
  </nav>

  {#if source === 'spotify'}
    <SpotifyPanel {mini} />
  {:else}
  <div class="now">
    <div class="title" title={music.current?.name}>{music.current?.name ?? 'Kein Titel gewählt'}</div>
    <div class="sub faint num">
      {#if currentIndex >= 0}Titel {currentIndex + 1} von {music.tracks.length}{:else}{music.tracks.length} Titel in der Playlist{/if}
    </div>
    <div class="seek">
      <span class="t num">{formatTime(seeking ?? music.position)}</span>
      <input
        type="range" min="0" max={music.duration || 0} step="0.5" aria-label="Position im Titel"
        value={seeking ?? music.position}
        disabled={!music.duration}
        oninput={e => (seeking = Number(e.currentTarget.value))}
        onchange={e => { music.seek(Number(e.currentTarget.value)); seeking = null; }} />
      <span class="t num">{formatTime(music.duration)}</span>
    </div>
  </div>

  <div class="controls">
    <button class="btn btn-ghost btn-icon" class:on={music.prefs.shuffle} aria-pressed={music.prefs.shuffle} title="Zufällige Reihenfolge" aria-label="Zufällige Reihenfolge" onclick={() => music.setShuffle(!music.prefs.shuffle)}><Icon name="shuffle" /></button>
    <button class="btn btn-ghost btn-icon" title="Vorheriger Titel" aria-label="Vorheriger Titel" disabled={!music.tracks.length} onclick={() => music.prev()}><Icon name="skipBack" /></button>
    <button class="btn btn-primary play" aria-label={music.playing ? 'Pause' : 'Abspielen'} disabled={!music.tracks.length} onclick={() => music.toggle()}><Icon name={music.playing ? 'pause' : 'play'} size={22} /></button>
    <button class="btn btn-ghost btn-icon" title="Nächster Titel" aria-label="Nächster Titel" disabled={!music.tracks.length} onclick={() => music.next()}><Icon name="skipForward" /></button>
    <button class="btn btn-ghost btn-icon" title="Stopp" aria-label="Stopp" disabled={!music.tracks.length} onclick={() => music.stop()}><Icon name="stop" /></button>
  </div>

  {#if !mini}
  <label class="vol">
    <Icon name={music.prefs.volume === 0 ? 'mute' : 'sound'} size={16} />
    <input type="range" min="0" max="1" step="0.02" value={music.prefs.volume} aria-label="Lautstärke Musik" oninput={e => music.setVolume(Number(e.currentTarget.value))} />
    <span class="v num">{Math.round(music.prefs.volume * 100)} %</span>
  </label>
  {#if music.locked.length}
    <div class="alert alert-warning unlock">
      <Icon name="lock" size={16} />
      <span>Nach dem Neuladen braucht {music.locked.length === 1 ? `der Ordner „${music.locked[0]!.name}“` : `${music.locked.length} Ordner`} einmal deine Freigabe.</span>
      <button class="btn btn-sm" onclick={() => music.unlock()}>Freigeben</button>
    </div>
  {/if}

  <div class="add">
    <button class="btn btn-sm" onclick={pickFolder}><Icon name="folder" size={15} /> Ordner wählen …</button>
    <button class="btn btn-sm" onclick={() => fileInput?.click()}><Icon name="filePlus" size={15} /> Titel hinzufügen …</button>
    <input class="sr-only" type="file" multiple accept="audio/*,.mp3,.m4a,.ogg,.wav,.flac" bind:this={fileInput} onchange={e => { const f = [...(e.currentTarget.files ?? [])]; e.currentTarget.value = ''; void music.addFiles(f); }} />
    <input class="sr-only" type="file" webkitdirectory multiple bind:this={folderInput} onchange={e => { const f = [...(e.currentTarget.files ?? [])]; e.currentTarget.value = ''; music.addSessionFolder(f); }} />
  </div>

  {#if music.tracks.length}
    <div class="pl-head">
      <span class="eyebrow">Playlist</span>
      {#if music.tracks.length > 8}
        <input class="input search" placeholder="Titel suchen …" aria-label="Titel suchen" bind:value={query} />
      {/if}
    </div>
    <ol class="list" use:scrollToCurrent={music.currentId}>
      {#each filtered.slice(0, MAX_ROWS) as { t, i } (t.id)}
        <li class:cur={t.id === music.currentId} class:locked={music.isLocked(t)}>
          <button class="row" onclick={() => music.play(t.id)} title="Abspielen">
            <span class="no num">{#if t.id === music.currentId && music.playing}<span class="eq"><i></i><i></i><i></i></span>{:else}{i + 1}{/if}</span>
            <span class="nm">{t.name}</span>
            {#if t.kind === 'session'}<span class="chip" title="Nur bis zum Schließen der Seite">temporär</span>{/if}
          </button>
          <button class="rm" aria-label="„{t.name}“ entfernen" title="Aus der Playlist entfernen" onclick={() => music.remove(t.id)}><Icon name="x" size={14} /></button>
        </li>
      {/each}
    </ol>
    {#if filtered.length > MAX_ROWS}<p class="faint more">… und {filtered.length - MAX_ROWS} weitere (Suche benutzen)</p>{/if}
    <div class="pl-foot">
      <span class="faint num">{music.tracks.length} Titel</span>
      <button class="btn btn-ghost btn-sm danger" onclick={clearAll}><Icon name="trash" size={14} /> Liste leeren</button>
    </div>
  {:else}
    <p class="empty muted">Noch keine Musik. Wähle einen Ordner mit MP3s oder füge einzelne Titel hinzu – die Dateien bleiben auf diesem Laptop.</p>
  {/if}
  {/if}
  {/if}

  {#if !mini}
  <div class="duck">
    <div class="duck-head">
      <label class="duck-sw"><input type="checkbox" class="mini-switch" checked={music.prefs.duck} onchange={e => music.setDuck({ duck: e.currentTarget.checked })} /> <span>Bei Signalen leiser</span></label>
      <span class="faint duck-note">Start-, Halbzeit- und Endton</span>
    </div>
    <label class="vol" class:off={!music.prefs.duck}>
      <Icon name="sound" size={16} />
      <input type="range" min="0" max="0.6" step="0.05" value={music.prefs.duckLevel} disabled={!music.prefs.duck} aria-label="Musiklautstärke während eines Signals" oninput={e => music.setDuck({ duckLevel: Number(e.currentTarget.value) })} />
      <span class="v num">{Math.round(music.prefs.duckLevel * 100)} %</span>
    </label>
    <label class="vol t" class:off={!music.prefs.duck}>
      <span class="lbl">Vorher</span>
      <input type="range" min="0" max="20" step="0.5" value={music.prefs.duckBefore} disabled={!music.prefs.duck} aria-label="Sekunden leiser vor dem Signal" oninput={e => music.setDuck({ duckBefore: Number(e.currentTarget.value) })} />
      <span class="v num">{music.prefs.duckBefore.toLocaleString('de')} s</span>
    </label>
    <label class="vol t" class:off={!music.prefs.duck}>
      <span class="lbl">Nachher</span>
      <input type="range" min="0" max="20" step="0.5" value={music.prefs.duckAfter} disabled={!music.prefs.duck} aria-label="Sekunden leiser nach dem Signal" oninput={e => music.setDuck({ duckAfter: Number(e.currentTarget.value) })} />
      <span class="v num">{music.prefs.duckAfter.toLocaleString('de')} s</span>
    </label>
  </div>
  {/if}
</section>

<style>
  .music {
    position: fixed; z-index: 45; top: 70px; right: 20px;
    width: min(390px, calc(100vw - 16px)); max-height: calc(100vh - 86px);
    display: flex; flex-direction: column; gap: 12px; padding: 0 14px 14px;
    box-shadow: var(--shadow-pop); overflow-x: hidden; overflow-y: auto;
  }
  @media (min-width: 1101px) { .music { right: 372px; } }
  header {
    display: flex; align-items: center; gap: 8px; margin: 0 -14px; padding: 9px 8px 9px 10px;
    border-bottom: 1px solid var(--border); cursor: grab; user-select: none; touch-action: none;
    background: var(--surface-2); position: sticky; top: 0; z-index: 2; flex: none;
  }
  header:active { cursor: grabbing; }
  header strong { font-family: var(--font-display); font-size: 18px; }
  .grip { color: var(--fg-faint); display: grid; }
  .close { margin-left: auto; }
  .now { display: flex; flex-direction: column; gap: 2px; flex: none; }
  .controls, .add, .pl-head, .pl-foot { flex: none; }
  .title { font-family: var(--font-display); font-weight: 700; font-size: 22px; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: 12px; }
  .seek { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
  .seek input { flex: 1; }
  .t { font-size: 12px; color: var(--fg-muted); min-width: 34px; }
  .t:last-child { text-align: right; }
  input[type='range'] { accent-color: var(--accent); min-width: 0; }
  .controls { display: flex; align-items: center; justify-content: center; gap: 6px; }
  .controls .on { color: var(--accent); background: var(--accent-soft); }
  .play { width: 54px; height: 54px; border-radius: 50%; padding: 0; }
  .vol { display: grid; grid-template-columns: 20px 1fr 40px; align-items: center; gap: 8px; color: var(--fg-muted); }
  .vol.off { opacity: 0.45; }
  .vol.t { grid-template-columns: 52px 1fr 40px; font-size: 13px; }
  .v { text-align: right; font-size: 12px; }
  .mini-switch { width: 16px; height: 16px; accent-color: var(--accent); margin: 0; }
  .tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 12px; background: var(--surface-2); flex: none; }
  .tabs button {
    display: flex; align-items: center; justify-content: center; gap: 7px; padding: 8px 10px;
    border: 0; border-radius: 9px; background: none; color: var(--fg-muted); font-weight: 600; font-size: 14px; cursor: pointer;
    transition: background 0.15s var(--ease), color 0.15s var(--ease);
  }
  .tabs button:hover { color: var(--fg); }
  .tabs button.on { background: var(--surface); color: var(--fg); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25); }
  .sdot { width: 8px; height: 8px; border-radius: 50%; background: var(--fg-faint); }
  .sdot.live { background: #1db954; box-shadow: 0 0 0 3px color-mix(in srgb, #1db954 25%, transparent); }
  .tabs .eq { height: 13px; }
  .duck { display: flex; flex-direction: column; gap: 8px; padding: 11px 12px; border-radius: 12px; background: var(--surface-2); flex: none; }
  .duck-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .duck-sw { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .duck-note { font-size: 11px; }
  .unlock { align-items: center; font-size: 13px; }
  .unlock span { flex: 1; }
  .add { display: flex; gap: 6px; }
  .add .btn { flex: 1; }
  .pl-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .search { min-height: 32px; max-width: 200px; font-size: 13px; }
  .list { list-style: none; margin: 0 -6px; padding: 0; overflow-y: auto; min-height: 160px; flex: 1; }
  .list li { display: flex; align-items: center; border-radius: 9px; }
  .list li:hover { background: var(--surface-2); }
  .list li.cur { background: var(--accent-soft); }
  .list li.locked { opacity: 0.5; }
  .row { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 6px 8px; border: 0; background: none; cursor: pointer; text-align: left; }
  .no { width: 28px; flex: none; text-align: right; font-size: 12px; color: var(--fg-faint); }
  .nm { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 14px; }
  .cur .nm { color: var(--accent); font-weight: 600; }
  .rm { border: 0; background: none; color: var(--fg-faint); cursor: pointer; padding: 6px; border-radius: 7px; display: grid; opacity: 0; }
  li:hover .rm, .rm:focus-visible { opacity: 1; }
  .rm:hover { color: var(--danger); background: var(--danger-soft); }
  .eq { display: inline-flex; gap: 2px; align-items: flex-end; height: 12px; }
  .eq i { width: 3px; background: var(--accent); border-radius: 1px; animation: eq 0.9s ease-in-out infinite; }
  .eq i:nth-child(2) { animation-delay: -0.3s; }
  .eq i:nth-child(3) { animation-delay: -0.6s; }
  @keyframes eq { 0%, 100% { height: 3px; } 50% { height: 12px; } }
  .more { font-size: 12px; margin: 0; }
  .pl-foot { display: flex; justify-content: space-between; align-items: center; }
  .danger:hover { color: var(--danger); }
  .empty { font-size: 14px; margin: 0; }
</style>
