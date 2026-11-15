<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { ui } from '../lib/ui.svelte';
  import Icon from './Icon.svelte';

  let {
    title,
    onclose,
    children,
    footer,
    width = 520,
  }: { title: string; onclose: () => void; children: Snippet; footer?: Snippet; width?: number } = $props();

  let box: HTMLDivElement;
  let previous: Element | null = null;

  onMount(() => {
    ui.modals++;
    previous = document.activeElement;
    const first = box.querySelector<HTMLElement>('[data-autofocus]') ?? box.querySelector<HTMLElement>('input, select, textarea, button:not(.x)');
    (first ?? box).focus();
    return () => {
      ui.modals--;
      (previous as HTMLElement | null)?.focus?.();
    };
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); onclose(); }
    if (e.key === 'Tab') {
      const f = [...box.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => !el.hasAttribute('disabled'));
      if (!f.length) return;
      const first = f[0]!, last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="backdrop" transition:fade={{ duration: 150 }} onclick={e => { if (e.target === e.currentTarget) onclose(); }} onkeydown={onKey}>
  <div class="box card" role="dialog" aria-modal="true" aria-label={title} tabindex="-1" bind:this={box} style:max-width="{width}px" transition:scale={{ start: 0.96, duration: 180 }}>
    <div class="head">
      <h2>{title}</h2>
      <button class="x btn btn-ghost btn-icon btn-sm" aria-label="Schließen" onclick={onclose}><Icon name="x" /></button>
    </div>
    <div class="body">{@render children()}</div>
    {#if footer}<div class="foot">{@render footer()}</div>{/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0; z-index: 60;
    display: grid; place-items: center; padding: 16px;
    background: rgba(3, 7, 14, 0.62); backdrop-filter: blur(4px);
  }
  .box { width: 100%; max-height: calc(100vh - 32px); display: flex; flex-direction: column; box-shadow: var(--shadow-pop); outline: none; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 20px 6px; }
  .head h2 { font-size: 24px; }
  .body { padding: 10px 20px 18px; overflow: auto; }
  .foot { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--border); }
</style>
