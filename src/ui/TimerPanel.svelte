<script lang="ts">
  import { formatClock, timer } from '../lib/timer.svelte';
  import { ui } from '../lib/ui.svelte';
  import { audio } from '../lib/sound';
  import Icon from './Icon.svelte';

  const rem = $derived(timer.remaining);
  const total = $derived(timer.data.duration * 1000);
  const progress = $derived(total ? rem / total : 0);
  const tstate = $derived(timer.expired ? 'expired' : timer.data.running ? (rem <= 10_000 ? 'final' : 'running') : 'idle');

  let editing = $state(false);
  let mm = $state(0);
  let ss = $state(0);
  function openEdit() {
    mm = Math.floor(timer.data.duration / 60);
    ss = timer.data.duration % 60;
    editing = true;
  }
  function saveEdit() {
    if (timer.setDuration((Number(mm) || 0) * 60 + (Number(ss) || 0))) editing = false;
  }

  const R = 92;
  const C = 2 * Math.PI * R;
</script>

<section class="timer card state-{tstate}">
  <div class="head">
    <span class="eyebrow"><Icon name="clock" size={14} /> Spielzeit</span>
    <button class="btn btn-ghost btn-sm" onclick={() => (ui.soundOpen = true)} title="Töne einstellen"><Icon name="sound" size={15} /></button>
  </div>

  <div class="dial">
    <svg viewBox="0 0 220 220" aria-hidden="true">
      <circle class="track" cx="110" cy="110" r={R} />
      <circle class="bar" cx="110" cy="110" r={R} stroke-dasharray={C} stroke-dashoffset={C * (1 - progress)} />
    </svg>
    <div class="readout">
      <span class="time num display">{formatClock(rem, tstate === 'final')}</span>
      <span class="sub">{tstate === 'expired' ? 'Zeit abgelaufen' : tstate === 'idle' ? (timer.fresh ? 'bereit' : 'pausiert') : 'läuft'}</span>
    </div>
  </div>

  <div class="controls">
    <button class="btn btn-primary btn-lg main" onclick={() => { audio(); timer.toggle(); }}>
      <Icon name={timer.data.running ? 'pause' : 'play'} size={20} />
      {timer.starting ? 'Gleich …' : timer.data.running ? 'Pause' : timer.expired ? 'Neu starten' : timer.fresh ? 'Start' : 'Weiter'}
      <span class="kbd">␣</span>
    </button>
    <button class="btn btn-lg btn-icon" title="Zurücksetzen" aria-label="Timer zurücksetzen" onclick={() => timer.reset()}><Icon name="reset" size={19} /></button>
  </div>
  <div class="fine">
    <button class="btn btn-sm btn-ghost" onclick={() => timer.adjust(-30)}>−30 s</button>
    <button class="btn btn-sm btn-ghost" onclick={() => timer.adjust(30)}>+30 s</button>
    <button class="btn btn-sm btn-ghost" onclick={openEdit}><Icon name="edit" size={14} /> {formatClock(total)}</button>
  </div>
  {#if editing}
    <form class="edit" onsubmit={e => { e.preventDefault(); saveEdit(); }}>
      <input class="input num" type="number" min="0" max="99" aria-label="Minuten" bind:value={mm} />
      <span>:</span>
      <input class="input num" type="number" min="0" max="59" aria-label="Sekunden" bind:value={ss} />
      <button class="btn btn-sm btn-primary" type="submit">Übernehmen</button>
      <button class="btn btn-sm btn-ghost" type="button" onclick={() => (editing = false)}>Abbrechen</button>
    </form>
  {/if}
</section>

<style>
  .timer { padding: 14px; display: flex; flex-direction: column; gap: 10px; position: relative; overflow: hidden; }
  .head { display: flex; justify-content: space-between; align-items: center; }
  .head .eyebrow { display: inline-flex; gap: 6px; align-items: center; }
  .dial { position: relative; width: min(190px, 100%); aspect-ratio: 1; margin: 0 auto; }
  .dial svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .track { fill: none; stroke: var(--surface-3); stroke-width: 12; }
  .bar { fill: none; stroke: var(--accent); stroke-width: 12; stroke-linecap: round; transition: stroke 0.3s; filter: drop-shadow(0 0 8px var(--accent-glow)); }
  .state-final .bar { stroke: var(--warning); filter: drop-shadow(0 0 10px var(--warning)); }
  .state-expired .bar { stroke: var(--danger); }
  .readout { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .time { font-size: 46px; font-weight: 800; letter-spacing: -0.01em; line-height: 1; }
  @media (max-width: 700px) {
    .dial { width: 150px; }
    .time { font-size: 36px; }
  }
  .state-final .time { color: var(--warning); }
  .state-expired .time { color: var(--danger); animation: blink 1s steps(2, start) infinite; }
  @keyframes blink { to { opacity: 0.35; } }
  .sub { margin-top: 4px; min-height: 1.2em; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--fg-muted); }
  .controls { display: flex; gap: 8px; }
  .main { flex: 1; }
  .main .kbd { margin-left: 4px; border-color: rgba(0, 0, 0, 0.25); color: inherit; opacity: 0.6; }
  .fine { display: flex; justify-content: center; gap: 4px; flex-wrap: wrap; }
  .edit { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .edit .input { width: 64px; min-height: 34px; text-align: center; }
  .state-expired { border-color: color-mix(in srgb, var(--danger) 50%, var(--border)); }
</style>
