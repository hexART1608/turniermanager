<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { timer } from '../lib/timer.svelte';
  import { ui, openBeamer } from '../lib/ui.svelte';
  import TopBar from './TopBar.svelte';
  import Setup from './Setup.svelte';
  import Running from './Running.svelte';
  import Ceremony from './Ceremony.svelte';
  import Toasts from './Toasts.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import SoundSettings from './SoundSettings.svelte';
  import SchedulePanel from './SchedulePanel.svelte';
  import BeamerSetup from './BeamerSetup.svelte';
  import Icon from './Icon.svelte';
  import MusicPanel from './MusicPanel.svelte';
  import { music } from '../lib/music.svelte';
  import { spotify } from '../lib/spotify.svelte';

  onMount(() => {
    store.connect();
    timer.connect();
    void music.init();
    void spotify.init();
    return () => spotify.destroy();
  });

  function isTyping(el: EventTarget | null) {
    const e = el as HTMLElement | null;
    return !!e && (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.tagName === 'SELECT' || e.isContentEditable);
  }

  function onKey(e: KeyboardEvent) {
    if (e.defaultPrevented || ui.modalOpen) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !isTyping(e.target)) {
      e.preventDefault();
      store.undo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    if (e.code === 'Space' && store.t.phase === 'running') {
      // Leertaste = Timer, auch wenn gerade ein Knopf den Fokus hat (Enter löst Knöpfe aus)
      e.preventDefault();
      timer.toggle();
    } else if (e.key.toLowerCase() === 'b') {
      openBeamer();
    } else if (e.key.toLowerCase() === 'm') {
      music.panelOpen = !music.panelOpen;
    }
  }
  // Bei Knöpfen löst die Leertaste erst beim Loslassen einen Klick aus: das gehört dem Timer, nicht dem fokussierten Knopf
  function onKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space' && store.t.phase === 'running' && !ui.modalOpen && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) e.preventDefault();
  }
</script>

<svelte:window onkeydown={onKey} onkeyup={onKeyUp} />

<div class="shell">
  <TopBar />
  {#if store.otherControlWindow}
    <div class="banner">
      <Icon name="warning" /> Der Turniermanager ist noch in einem anderen Tab offen. Änderungen werden übernommen, aber bitte nur in einem Tab arbeiten.
    </div>
  {/if}
  <main>
    {#if store.t.phase === 'setup'}
      <Setup />
    {:else if store.t.phase === 'running'}
      <Running />
    {:else}
      <Ceremony />
    {/if}
  </main>
</div>

{#if ui.soundOpen}<SoundSettings />{/if}
{#if ui.beamerSetupOpen}<BeamerSetup />{/if}
{#if ui.scheduleOpen}<SchedulePanel />{/if}
{#if music.panelOpen}<MusicPanel />{/if}
<ConfirmDialog />
<Toasts />

<style>
  .shell { min-height: 100%; display: flex; flex-direction: column; }
  main { flex: 1; width: 100%; max-width: 1560px; margin: 0 auto; padding: 20px 24px 48px; }
  .banner {
    display: flex; align-items: center; gap: 10px; justify-content: center;
    padding: 9px 16px; background: var(--warning-soft); color: var(--warning); font-size: 14px; font-weight: 500;
  }
  @media (max-width: 700px) { main { padding: 14px 14px 40px; } }
</style>
