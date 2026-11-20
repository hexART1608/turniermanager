<script lang="ts">
  // Beamer-Setup: Wartebild des Beamers wählen und einstellen. Die Kacheln zeigen die echte Darstellung live.
  import { WAIT_STYLES, beamerPrefs } from '../lib/beamerPrefs.svelte';
  import { store } from '../lib/store.svelte';
  import { timer } from '../lib/timer.svelte';
  import { openBeamer, ui } from '../lib/ui.svelte';
  import WaitScreen from '../beamer/WaitScreen.svelte';
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';

  const p = $derived(beamerPrefs.value);
  const simple = $derived(p.style === 'simple');
  const current = $derived(WAIT_STYLES.find(s => s.id === p.style));
</script>

<Modal title="Beamer-Setup" onclose={() => (ui.beamerSetupOpen = false)} width={880}>
  <p class="muted lead">Was soll der Beamer zeigen, solange das Turnier noch nicht läuft? Die Auswahl gilt sofort auch im geöffneten Beamer-Fenster.</p>

  <div class="tiles" role="radiogroup" aria-label="Wartebild">
    {#each WAIT_STYLES as s (s.id)}
      <button class="tile" class:on={p.style === s.id} role="radio" aria-checked={p.style === s.id} aria-label={s.title} onclick={() => beamerPrefs.set({ style: s.id })}>
        <span class="thumb" aria-hidden="true"><WaitScreen t={store.t} prefs={{ ...p, style: s.id }} duration={timer.data.duration} demo /></span>
        <span class="cap"><strong>{s.title}</strong>{#if s.id === 'simple'}<span class="std">Standard</span>{/if}</span>
        {#if p.style === s.id}<span class="check"><Icon name="check" size={14} /></span>{/if}
      </button>
    {/each}
  </div>
  <p class="desc">{current?.text}</p>

  <div class="opts">
    <label class="opt"><input type="checkbox" class="switch" checked={p.clubLogo} onchange={e => beamerPrefs.set({ clubLogo: e.currentTarget.checked })} /><span>Vereinslogo <small class="muted">(aus: Federball)</small></span></label>
    <label class="opt" class:off={simple}><input type="checkbox" class="switch" checked={p.soon} disabled={simple} onchange={e => beamerPrefs.set({ soon: e.currentTarget.checked })} /><span>„Gleich geht’s los …“-Kapsel</span></label>
    <label class="opt" class:off={simple || p.style === 'wall'}><input type="checkbox" class="switch" checked={p.ticker} disabled={simple || p.style === 'wall'} onchange={e => beamerPrefs.set({ ticker: e.currentTarget.checked })} /><span>Laufband mit Spielernamen</span></label>
  </div>
  {#if simple}<p class="hint muted">Kapsel und Laufband gibt es nur bei den Animationen.</p>{/if}

  {#snippet footer()}
    <button class="btn btn-ghost" onclick={() => openBeamer()}><Icon name="screen" size={16} /> Beamer öffnen</button>
    <button class="btn btn-primary" onclick={() => (ui.beamerSetupOpen = false)}>Fertig</button>
  {/snippet}
</Modal>

<style>
  .lead { margin: 0 0 14px; }
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .tile { position: relative; display: flex; flex-direction: column; gap: 8px; padding: 8px 8px 10px; border-radius: 14px; border: 2px solid var(--border); background: var(--surface-2, var(--surface)); color: inherit; cursor: pointer; text-align: left; transition: border-color 0.15s, transform 0.15s; }
  .tile:hover { border-color: var(--border-strong); }
  .tile.on { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .thumb { display: block; aspect-ratio: 16 / 10; border-radius: 9px; overflow: hidden; background: #070d18; pointer-events: none; position: relative; }
  .thumb > :global(.wait.wait) { position: absolute; inset: 0; width: auto; height: auto; }
  .cap { display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: 14px; }
  .std { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 2px 7px; border-radius: 99px; background: var(--accent-soft); color: var(--accent); }
  .check { position: absolute; top: 14px; right: 14px; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: var(--accent-fg); }
  .desc { margin: 12px 2px 0; color: var(--fg-muted); font-size: 14px; min-height: 2.6em; }
  .opts { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 10px; padding-top: 14px; border-top: 1px solid var(--border); }
  .opt { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; }
  .opt.off { opacity: 0.45; cursor: default; }
  .hint { margin: 8px 0 0; font-size: 13px; }

  .switch { appearance: none; width: 46px; height: 27px; border-radius: 999px; background: var(--surface-3); border: 1px solid var(--border-strong); position: relative; cursor: pointer; transition: background 0.2s; flex: none; }
  .switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 21px; height: 21px; border-radius: 50%; background: var(--fg-muted); transition: transform 0.2s var(--ease), background 0.2s; }
  .switch:checked { background: var(--accent); border-color: transparent; }
  .switch:disabled { cursor: default; }
  @media (max-width: 700px) { .tiles { grid-template-columns: repeat(2, 1fr); } }
</style>
