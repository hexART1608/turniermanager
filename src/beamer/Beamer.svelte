<script lang="ts">
  // Großanzeige für Beamer/TV. Liest nur – alle Änderungen kommen aus dem Steuerfenster
  // über das storage-Ereignis. Bedienung: Maus bewegen blendet die Leiste ein; Tasten 1–4.
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { parseTournament } from '../engine/io';
  import { type Tournament, newTournament, usesPools } from '../engine/types';
  import { playerMap } from '../lib/names';
  import { KEYS, readJson } from '../lib/storage';
  import { clock, formatClock, parseTimer, readTimer, remainingAt } from '../lib/timer.svelte';
  import Court from '../ui/Court.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';
  import ClubLogo from '../ui/ClubLogo.svelte';
  import WaitScreen from './WaitScreen.svelte';
  import { beamerPrefs } from '../lib/beamerPrefs.svelte';
  import Podium from '../ui/Podium.svelte';
  import RankingTable from '../ui/RankingTable.svelte';

  type View = 'auto' | 'courts' | 'timer' | 'ranking';
  const VIEWS: { id: View; label: string }[] = [
    { id: 'auto', label: 'Übersicht' },
    { id: 'courts', label: 'Felder' },
    { id: 'timer', label: 'Timer' },
    { id: 'ranking', label: 'Rangliste' },
  ];

  function load(): Tournament {
    try { return parseTournament(readJson(KEYS.state)); } catch { return newTournament(); }
  }

  const initial = new URLSearchParams(location.hash.split('?')[1] ?? '').get('view');
  let view = $state<View>(VIEWS.some(v => v.id === initial) ? (initial as View) : 'auto');
  let t = $state.raw<Tournament>(load());
  let tm = $state.raw(readTimer());
  let showBar = $state(true);
  let hideTimer: ReturnType<typeof setTimeout>;

  const map = $derived(playerMap(t));
  const pools = $derived(usesPools(t.settings));
  const current = $derived(t.rounds[t.rounds.length - 1]);
  const rem = $derived(remainingAt(tm, clock.now));
  const tstate = $derived(rem === 0 ? 'expired' : tm.running ? (rem <= 10_000 ? 'final' : 'running') : 'idle');
  const timeOfDay = $derived(new Date(clock.now).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
  const cols = $derived((current?.matches.length ?? 0) <= 2 ? 1 : (current?.matches.length ?? 0) <= 6 ? 2 : 3);
  const rows = $derived(Math.max(1, Math.ceil((current?.matches.length ?? 1) / cols)));

  onMount(() => {
    document.body.classList.add('beamer-mode');
    clock.start();
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEYS.state) t = load();
      if (e.key === KEYS.timer && e.newValue) tm = parseTimer(JSON.parse(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    const stopPrefs = beamerPrefs.listen();
    poke();
    return () => {
      window.removeEventListener('storage', onStorage);
      stopPrefs();
      document.body.classList.remove('beamer-mode');
    };
  });

  function poke() {
    showBar = true;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => (showBar = false), 2600);
  }

  function setView(v: View) {
    view = v;
    history.replaceState(null, '', `#/beamer?view=${v}`);
  }

  function fullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  }

  function onKey(e: KeyboardEvent) {
    const i = Number(e.key) - 1;
    if (VIEWS[i]) setView(VIEWS[i]!.id);
    if (e.key.toLowerCase() === 'f') fullscreen();
  }

  const names = (ids: number[]) => ids.map(id => map.get(id)).filter(p => p !== undefined);
</script>

<svelte:window onmousemove={poke} onkeydown={onKey} />

{#snippet clockBlock(size: 'md' | 'xl')}
  <div class="tclock tclock-{size} state-{tstate}">
    <span class="tlabel">{tstate === 'expired' ? 'Zeit!' : tstate === 'idle' ? (rem === tm.duration * 1000 ? 'Spielzeit' : 'Pause') : 'Restzeit'}</span>
    <span class="tval num display">{formatClock(rem, tstate === 'final')}</span>
    <div class="tbar"><div class="tfill" style:width="{tm.duration ? (rem / (tm.duration * 1000)) * 100 : 0}%"></div></div>
  </div>
{/snippet}

{#snippet courtsBlock(withTitle: boolean)}
  {#if current}
    {#if withTitle}
      <div class="sec-head"><span class="live"></span> Runde {current.no}<span class="faint"> / {t.settings.plannedRounds}</span></div>
    {/if}
    <div class="courts" style:--cols={cols} style:--rows={rows}>
      {#each current.matches as m (current.no * 100 + m.court)}
        <div class="bcourt" in:fade={{ duration: 400 }}>
          <span class="cno display">Feld {m.court}</span>
          <Court winner={m.winner}>
            {#snippet left()}
              <div class="bteam">{#each names(m.teamA) as p (p.id)}<span class="bn">{#if pools}<i class="dot dot-{p.pool}"></i>{/if}{p.name}</span>{/each}</div>
            {/snippet}
            {#snippet right()}
              <div class="bteam">{#each names(m.teamB) as p (p.id)}<span class="bn">{#if pools}<i class="dot dot-{p.pool}"></i>{/if}{p.name}</span>{/each}</div>
            {/snippet}
          </Court>
          {#if m.score}<span class="bscore num display">{m.score[0]} : {m.score[1]}</span>{/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="waiting"><ClubLogo height="14vh" /><p>Gleich geht’s los – Runde 1 wird gleich aufgerufen.</p></div>
  {/if}
{/snippet}

{#snippet nextBlock()}
  {#if t.draft && t.draft.matches.length && current}
    <div class="next">
      <div class="sec-head small">Als Nächstes · Runde {t.rounds.length + 1}</div>
      <ul>
        {#each t.draft.matches as m (m.court)}
          <li>
            <span class="ncourt display">Feld {m.court}</span>
            <span class="nteam">{names(m.teamA).map(p => p.name).join(' & ')}</span>
            <span class="nvs">vs</span>
            <span class="nteam">{names(m.teamB).map(p => p.name).join(' & ')}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
{/snippet}

<div class="beamer view-{view}" class:cursor-hidden={!showBar}>
  <header class="bhead">
    <div class="brand"><ClubLogo height="6.5vh" /><span class="title display">{t.settings.name}</span></div>
    <span class="tod num display">{timeOfDay}</span>
  </header>

  {#if t.phase === 'setup'}
    <WaitScreen {t} prefs={beamerPrefs.value} duration={tm.duration} />
  {:else if t.phase === 'finished'}
    <Confetti duration={45000} density={1.5} always />
    <div class="final">
      <div class="rays" aria-hidden="true"></div>
      <p class="eyebrow big-eyebrow">Siegerehrung</p>
      <Podium {t} big />
    </div>
  {:else if view === 'timer'}
    <div class="only-timer">{@render clockBlock('xl')}</div>
  {:else if view === 'ranking'}
    <div class="only-ranking">
      <div class="sec-head">Rangliste</div>
      <div class="rank-cols">
        <RankingTable {t} size="xl" limit={24} />
      </div>
    </div>
  {:else if view === 'courts'}
    <div class="only-courts">{@render courtsBlock(true)}{@render nextBlock()}</div>
  {:else}
    <div class="auto">
      <div class="left">{@render courtsBlock(true)}</div>
      <div class="right">
        {@render clockBlock('md')}
        {@render nextBlock()}
        <div class="rk">
          <div class="sec-head small">Rangliste</div>
          <RankingTable {t} size="xl" limit={current ? 5 : 10} />
        </div>
      </div>
    </div>
  {/if}

  {#if showBar}
    <nav class="bar" transition:fade={{ duration: 200 }}>
      {#each VIEWS as v, i (v.id)}
        <button class:on={view === v.id} onclick={() => setView(v.id)}><span class="k">{i + 1}</span>{v.label}</button>
      {/each}
      <button onclick={fullscreen}><Icon name="fullscreen" size={16} /> Vollbild <span class="k">F</span></button>
    </nav>
  {/if}
</div>

<style>
  /* nur im Beamer-Fenster: Svelte bündelt alles CSS in eine Datei, ein reines
     :global(body) würde sonst auch in der Steuerung das Scrollen abschalten */
  :global(body.beamer-mode) { overflow: hidden; }
  .beamer {
    position: fixed; inset: 0; display: flex; flex-direction: column;
    padding: 2.2vh 2.4vw 2.6vh; gap: 2vh;
    background:
      radial-gradient(80vw 60vh at 80% -20%, rgba(200, 245, 60, 0.1), transparent 60%),
      radial-gradient(70vw 70vh at -10% 120%, rgba(19, 122, 79, 0.35), transparent 60%),
      #050a14;
    color: #fff;
  }
  .cursor-hidden { cursor: none; }
  .bhead { display: flex; justify-content: space-between; align-items: center; }
  .brand { display: flex; align-items: center; gap: 1vw; }
  .title { font-size: 3.6vh; font-weight: 800; letter-spacing: 0.01em; }
  .tod { font-size: 3.4vh; font-weight: 700; color: rgba(255, 255, 255, 0.6); }

  .sec-head { display: flex; align-items: center; gap: 0.8vw; font-family: var(--font-display); font-weight: 800; font-size: 4.4vh; line-height: 1; margin-bottom: 1.6vh; }
  .sec-head.small { font-size: 2.6vh; font-weight: 700; color: rgba(255, 255, 255, 0.75); margin-bottom: 1vh; text-transform: uppercase; letter-spacing: 0.08em; }
  .live { width: 1.4vh; height: 1.4vh; border-radius: 50%; background: var(--accent); box-shadow: 0 0 2vh var(--accent); animation: pulse 1.6s infinite; }
  @keyframes pulse { 50% { opacity: 0.35; } }

  .auto { flex: 1; min-height: 0; display: grid; grid-template-columns: fit-content(64%) minmax(30vw, 1fr); gap: 2.4vw; }
  .left, .right { min-height: 0; display: flex; flex-direction: column; }
  .right { gap: 2.4vh; }
  .courts { display: grid; grid-template-columns: repeat(var(--cols), 1fr); gap: 2.2vh 1.6vw; align-content: start; }
  .bcourt { position: relative; }
  /* Felder so groß wie möglich, ohne dass sie unten aus dem Bild laufen */
  .courts { --h: 70vh; width: calc(var(--cols) * (var(--h) - (var(--rows) - 1) * 2.2vh) / var(--rows) * 2.15 + (var(--cols) - 1) * 1.6vw); max-width: 100%; }
  .only-courts .courts { --h: 56vh; margin: 0 auto; }
  .cno {
    position: absolute; z-index: 2; top: -1.3vh; left: 1.2vw;
    padding: 0.4vh 1vw; border-radius: 0.9vh; background: var(--accent); color: var(--accent-fg);
    font-size: 2.3vh; font-weight: 800; letter-spacing: 0.04em; box-shadow: 0 0.6vh 2vh rgba(0, 0, 0, 0.4);
  }
  .bscore { position: absolute; bottom: 1vh; left: 50%; transform: translateX(-50%); padding: 0.3vh 1vw; border-radius: 1vh; background: rgba(0, 0, 0, 0.55); font-size: 2.6vh; font-weight: 800; }
  .bteam { display: flex; flex-direction: column; align-items: center; gap: 0.8vh; }
  .bn {
    display: inline-flex; align-items: center; gap: 0.6vw;
    font-family: var(--font-display); font-weight: 800; font-size: clamp(18px, 4.2vh, 64px); line-height: 1;
    text-shadow: 0 0.3vh 1vh rgba(0, 0, 0, 0.5); white-space: nowrap;
  }
  .courts[style*='--cols: 2'] .bn { font-size: clamp(16px, 3.1vh, 48px); }
  .courts[style*='--cols: 3'] .bn { font-size: clamp(14px, 2.4vh, 36px); }
  .dot { display: inline-block; width: 1.1vh; height: 1.1vh; border-radius: 50%; box-shadow: 0 0 0 0.25vh rgba(0, 0, 0, 0.3); }
  .dot-1 { background: var(--team-a); }
  .dot-2 { background: var(--team-b); }

  .tclock { display: flex; flex-direction: column; align-items: center; padding: 2vh 1.6vw 2.4vh; border-radius: 2.4vh; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); }
  .tlabel { font-family: var(--font-display); font-weight: 700; font-size: 2.2vh; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255, 255, 255, 0.6); }
  .tval { font-size: 13vh; font-weight: 800; line-height: 1; color: var(--accent); text-shadow: 0 0 4vh var(--accent-glow); }
  .tbar { width: 100%; height: 1vh; border-radius: 1vh; background: rgba(255, 255, 255, 0.1); overflow: hidden; margin-top: 1.4vh; }
  .tfill { height: 100%; background: var(--accent); border-radius: inherit; }
  .state-final .tval { color: var(--warning); text-shadow: 0 0 4vh rgba(255, 194, 71, 0.5); }
  .state-final .tfill { background: var(--warning); }
  .state-expired { background: rgba(255, 93, 108, 0.16); border-color: var(--danger); animation: alarm 1s infinite; }
  .state-expired .tval, .state-expired .tlabel { color: var(--danger); text-shadow: none; }
  @keyframes alarm { 50% { background: rgba(255, 93, 108, 0.04); } }
  .state-idle .tval { color: #fff; text-shadow: none; }
  .tclock-xl { padding: 4vh 4vw; width: 80vw; }
  .tclock-xl .tval { font-size: 38vh; }
  .tclock-xl .tlabel { font-size: 4vh; }
  .tclock-xl .tbar { height: 2vh; }

  .next ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.8vh; }
  .next li { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 0.8vw; align-items: center; padding: 1vh 1vw; border-radius: 1.4vh; background: rgba(255, 255, 255, 0.05); font-size: 2.2vh; }
  .ncourt { font-weight: 800; color: var(--accent); font-size: 2.2vh; }
  .nteam { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nteam:last-child { text-align: right; }
  .nvs { color: rgba(255, 255, 255, 0.45); font-size: 1.7vh; }
  .rk { flex: 1; min-height: 0; overflow: hidden; }

  .only-timer { flex: 1; display: grid; place-items: center; }
  .only-ranking { flex: 1; min-height: 0; max-width: 70vw; width: 100%; margin: 0 auto; overflow: hidden; }
  .only-courts { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 3vh; max-width: 150vh; width: 100%; margin: 0 auto; }

  .waiting { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3vh; text-align: center; }
  .waiting p { font-size: 3vh; color: rgba(255, 255, 255, 0.7); margin: 0; }
  .final { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2.4vh; }
  .big-eyebrow {
    position: relative; font-size: 3.4vh; letter-spacing: 0.5em; color: var(--accent);
    background: linear-gradient(100deg, var(--accent) 30%, #fff 50%, var(--accent) 70%) 0 / 250% 100%;
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    animation: drop 0.9s var(--ease) both, glint 3.5s 1.2s ease-in-out infinite;
  }
  @keyframes drop { from { opacity: 0; transform: translateY(-4vh) scale(1.3); letter-spacing: 1em; } }
  @keyframes glint { from { background-position: 100% 0; } to { background-position: -100% 0; } }
  .rays {
    position: absolute; left: 50%; top: 58%; width: 150vh; height: 150vh; translate: -50% -50%; z-index: 0; pointer-events: none;
    background: repeating-conic-gradient(from 0deg, rgba(255, 215, 90, 0.16) 0 8deg, transparent 8deg 24deg);
    -webkit-mask-image: radial-gradient(circle, #000 0, transparent 68%); mask-image: radial-gradient(circle, #000 0, transparent 68%);
    animation: spin 40s linear infinite, fadein 2s 1s both;
  }
  @keyframes spin { to { rotate: 360deg; } }
  @keyframes fadein { from { opacity: 0; } }
  .final > :global(*:not(.rays)) { position: relative; z-index: 1; }

  .bar {
    position: fixed; bottom: 2vh; left: 50%; transform: translateX(-50%); z-index: 60;
    display: flex; gap: 4px; padding: 5px; border-radius: 14px;
    background: rgba(15, 24, 40, 0.92); border: 1px solid rgba(255, 255, 255, 0.12); backdrop-filter: blur(10px);
  }
  .bar button { display: inline-flex; align-items: center; gap: 7px; border: 0; background: none; color: rgba(255, 255, 255, 0.75); padding: 8px 13px; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 14px; }
  .bar button:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
  .bar button.on { background: var(--accent); color: var(--accent-fg); }
  .k { display: inline-grid; place-items: center; min-width: 18px; height: 18px; border-radius: 4px; border: 1px solid currentColor; font-size: 11px; opacity: 0.6; }
</style>
