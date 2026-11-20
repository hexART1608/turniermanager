<script lang="ts">
  // Wartebild des Beamers vor dem Turnierstart. Die Darstellung wählt das Beamer-Setup
  // (Startseite → „Beamer-Setup“). Alle Maße in Container-Einheiten (cqh/cqw): derselbe Code füllt den
  // Beamer und die kleinen Vorschaukacheln im Setup.
  import { usesPools, type Tournament } from '../engine/types';
  import { ribbonRounds } from '../engine/actions';
  import { type BeamerPrefs } from '../lib/beamerPrefs.svelte';
  import { formatClock } from '../lib/timer.svelte';
  import ClubLogo from '../ui/ClubLogo.svelte';
  import Logo from '../ui/Logo.svelte';
  import Aurora from './Aurora.svelte';
  import CourtRally from './CourtRally.svelte';
  import InfoCards from './InfoCards.svelte';
  import NeonCourt from './NeonCourt.svelte';
  import PlayerWall from './PlayerWall.svelte';

  let { t, prefs, duration = 240, demo = false }: { t: Tournament; prefs: BeamerPrefs; duration?: number; demo?: boolean } = $props();

  const DEMO = ['Marc', 'Anne', 'Jonas', 'Lea', 'Tim', 'Sophie', 'Ben', 'Mia'];
  const real = $derived(t.players.filter(p => p.active).map(p => ({ id: p.id, name: p.name, pool: p.pool })));
  const players = $derived(demo && real.length < 4 ? DEMO.map((name, i) => ({ id: -i - 1, name, pool: ((i % 2) + 1) as 1 | 2 })) : real);
  const s = $derived(t.settings);
  const pools = $derived(usesPools(s));
  const style = $derived(prefs.style);
  const side = $derived(style !== 'simple' && style !== 'aurora');
  const names = $derived(players.map(p => p.name));
  const showTicker = $derived(prefs.ticker && names.length > 0 && style !== 'simple' && style !== 'wall');
  const showSoon = $derived(prefs.soon && style !== 'simple');
  // Laufband: genug Kopien, damit es die ganze Breite füllt (gerade Zahl, die Hälfte ist eine Schleife)
  const copies = $derived(Array.from({ length: 2 * Math.max(1, Math.ceil(1600 / (Math.max(1, names.length) * 170))) }, (_, i) => i));

  const formLabel = $derived(
    s.discipline === 'singles' ? 'Einzel – eins gegen eins'
      : s.pairing === 'fixed' ? 'Feste Doppel – die Teams bleiben das ganze Turnier zusammen'
      : s.pairing === 'random' ? 'Doppel mit wechselnden Partnern – jede Runde neu gelost'
      : s.ribbon ? `Schleifchenturnier – jeder aus „${s.poolLabels[0]}“ spielt mit jedem aus „${s.poolLabels[1]}“`
      : `Jedes Doppel: ${s.poolLabels[0]} + ${s.poolLabels[1]}`,
  );
  const rounds = $derived(s.ribbon && pools ? ribbonRounds(t) : s.plannedRounds);
  const cards = $derived([
    { icon: 'users' as const, title: 'Spielform', text: formLabel },
    { icon: 'clock' as const, title: 'Felder, Runden, Spielzeit', text: 'So ist das Turnier aufgebaut.', facts: [
      { label: s.courts === 1 ? 'Feld' : 'Felder', value: String(s.courts) },
      { label: 'Runden', value: String(rounds) },
      { label: 'Spielzeit', value: formatClock(duration * 1000) },
    ] },
    { icon: 'flag' as const, title: 'Angemeldet', text: pools ? 'Verteilt auf die beiden Töpfe.' : 'Schön, dass ihr dabei seid!', facts: pools
      ? [1, 2].map(p => ({ label: s.poolLabels[p - 1]!, value: String(players.filter(x => x.pool === p).length) }))
      : [{ label: 'Spieler', value: String(players.length) }] },
    { icon: 'whistle' as const, title: 'So läuft es ab', text: 'Runde wird ausgelost und hier gezeigt – Signalton zum Start, zur Halbzeit und zum Ende – danach Ergebnisse eintragen.' },
  ]);
</script>

<div class="wait style-{style}" data-style={style}>
  {#if style === 'aurora'}<Aurora />{/if}

  <div class="main" class:side>
    <div class="intro">
      <div class="logo">
        {#if prefs.clubLogo}<ClubLogo variant="full" height={style === 'simple' ? '40cqh' : '34cqh'} />{:else}<Logo size={style === 'simple' ? '30cqh' : '24cqh'} />{/if}
      </div>
      <h1 class="display">{s.name}</h1>
      <p class="count">{players.length} Spieler angemeldet · {s.courts} {s.courts === 1 ? 'Feld' : 'Felder'}</p>
      {#if showSoon}
        <div class="soon" aria-live="polite"><span class="beacon"><i></i><i></i><b></b></span><span class="soon-text">Gleich geht’s los<span class="dots"><i>.</i><i>.</i><i>.</i></span></span></div>
      {/if}
    </div>

    {#if style === 'neon'}<div class="stage"><NeonCourt /></div>
    {:else if style === 'rally'}<div class="stage"><CourtRally /></div>
    {:else if style === 'wall'}<div class="stage wall-stage"><PlayerWall {players} {pools} /></div>
    {:else if style === 'cards'}<div class="stage"><InfoCards {cards} /></div>
    {/if}
  </div>

  {#if showTicker}
    <div class="ticker" aria-hidden="true">
      <div class="track" style:animation-duration="{Math.max(20, names.length * (copies.length / 2) * 3)}s">
        {#each copies as _}
          <span class="seg">{#each names as n}<span class="tn">{n}</span><span class="sep">·</span>{/each}</span>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .wait { position: relative; flex: 1; min-height: 0; width: 100%; height: 100%; container-type: size; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; }
  /* Abstand unten fürs Laufband (Container-Einheiten gelten nur für Kinder, nicht für den Container selbst) */
  .wait::after { content: ''; flex: 0 0 14cqh; }
  .wait > :not(:global(.aurora)) { position: relative; z-index: 1; }
  .main { display: flex; align-items: center; justify-content: center; width: 100%; box-sizing: border-box; padding: 0 4cqw; }
  .main:not(.side) { flex-direction: column; }
  .main.side { gap: 4cqw; }

  .intro { display: flex; flex-direction: column; align-items: center; gap: 2.8cqh; text-align: center; min-width: 0; }
  .side .intro { flex: 0 1 31cqw; }
  .intro h1 { margin: 0; font-size: 10cqh; line-height: 1.05; font-weight: 800; text-wrap: balance; }
  .side .intro h1 { font-size: 8.2cqh; }
  .count { margin: 0; font-size: 4.4cqh; color: rgba(255, 255, 255, 0.72); }
  .logo { position: relative; }
  .logo::before { content: ''; position: absolute; inset: -3cqh; border-radius: 4cqh; background: radial-gradient(closest-side, rgba(200, 245, 60, 0.20), transparent); z-index: -1; }

  .stage { flex: 1 1 56cqw; max-width: 60cqw; min-width: 0; }
  .wall-stage { max-height: 70cqh; display: flex; align-items: center; }

  /* „Gleich geht’s los“ */
  .soon { display: inline-flex; align-items: center; gap: 1.6cqh; padding: 1.3cqh 3cqh 1.3cqh 2.4cqh; border-radius: 99px; background: rgba(200, 245, 60, 0.12); border: 1px solid rgba(200, 245, 60, 0.35); }
  .soon-text { font-size: 4cqh; font-weight: 700; color: var(--accent); letter-spacing: 0.02em; white-space: nowrap; }
  .beacon { position: relative; width: 2.8cqh; height: 2.8cqh; flex: none; }
  .beacon b, .beacon i { position: absolute; inset: 0; border-radius: 50%; background: var(--accent); }
  .beacon i { opacity: 0; animation: ring 2.2s ease-out infinite; will-change: transform, opacity; }
  .beacon i:nth-child(2) { animation-delay: 1.1s; }
  .beacon b { animation: beat 1.1s ease-in-out infinite; will-change: transform; }
  @keyframes ring { 0% { transform: scale(1); opacity: 0.55; } 100% { transform: scale(3.2); opacity: 0; } }
  @keyframes beat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }
  .dots i { display: inline-block; font-style: normal; animation: hop 1.2s ease-in-out infinite; will-change: transform; }
  .dots i:nth-child(2) { animation-delay: 0.15s; }
  .dots i:nth-child(3) { animation-delay: 0.3s; }
  @keyframes hop { 0%, 60%, 100% { transform: translate3d(0, 0, 0); } 30% { transform: translate3d(0, -0.9cqh, 0); } }

  /* Laufband mit den Namen */
  .ticker { position: absolute !important; left: 0; right: 0; bottom: 3.5cqh; overflow: hidden; white-space: nowrap; mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
  .track { display: inline-flex; animation: ticker linear infinite; will-change: transform; }
  .seg { display: inline-flex; align-items: center; }
  .tn { font-size: 4.2cqh; font-weight: 600; color: rgba(255, 255, 255, 0.82); padding: 0 1.6cqw; }
  .sep { color: var(--accent); font-size: 4.2cqh; }
  @keyframes ticker { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(-50%, 0, 0); } }

  @media (prefers-reduced-motion: reduce) { .track, .beacon i, .beacon b, .dots i { animation: none; } }
</style>
