<script lang="ts">
  import { fly } from 'svelte/transition';
  import { toasts } from '../lib/toast.svelte';
  import Icon from './Icon.svelte';

  const icons = { info: 'info', success: 'check', error: 'warning', warning: 'warning' } as const;
</script>

<div class="stack" aria-live="polite">
  {#each toasts.list as t (t.id)}
    <div class="toast toast-{t.kind}" in:fly={{ y: 16, duration: 220 }} out:fly={{ y: 8, duration: 160 }} role={t.kind === 'error' ? 'alert' : 'status'}>
      <Icon name={icons[t.kind]} />
      <span class="text">{t.text}</span>
      {#if t.action}
        <button class="btn btn-sm" onclick={() => { t.action!.run(); toasts.dismiss(t.id); }}>{t.action.label}</button>
      {/if}
      <button class="close" aria-label="Schließen" onclick={() => toasts.dismiss(t.id)}><Icon name="x" size={15} /></button>
    </div>
  {/each}
</div>

<style>
  .stack { position: fixed; bottom: 20px; right: 20px; z-index: 100; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; width: min(440px, calc(100vw - 28px)); pointer-events: none; }
  @media (max-width: 600px) { .stack { right: 14px; bottom: 14px; } }
  .toast {
    pointer-events: auto;
    display: flex; align-items: center; gap: 11px;
    padding: 12px 12px 12px 15px; border-radius: 14px;
    background: var(--surface-3); border: 1px solid var(--border-strong); box-shadow: var(--shadow-pop);
    font-size: 14px; font-weight: 500;
  }
  .text { flex: 1; white-space: pre-line; }
  .toast-error { border-color: color-mix(in srgb, var(--danger) 55%, transparent); }
  .toast-error :global(svg:first-child) { color: var(--danger); }
  .toast-success :global(svg:first-child) { color: var(--success); }
  .toast-warning :global(svg:first-child) { color: var(--warning); }
  .toast-info :global(svg:first-child) { color: var(--accent); }
  .close { border: 0; background: none; color: var(--fg-muted); cursor: pointer; padding: 4px; border-radius: 6px; display: grid; }
  .close:hover { color: var(--fg); background: var(--surface-2); }
</style>
