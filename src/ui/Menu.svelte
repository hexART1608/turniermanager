<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';

  type Item = { icon: IconName; label: string; run: () => void; danger?: boolean } | { divider: true };
  let { items, label = 'Weitere Aktionen' }: { items: Item[]; label?: string } = $props();
  let open = $state(false);
  let root: HTMLDivElement;

  function onDocClick(e: MouseEvent) {
    if (open && !root.contains(e.target as Node)) open = false;
  }
  function onKey(e: KeyboardEvent) {
    if (open && e.key === 'Escape') { open = false; e.stopPropagation(); }
  }
</script>

<svelte:document onclick={onDocClick} onkeydown={onKey} />

<div class="menu" bind:this={root}>
  <button class="btn btn-ghost btn-icon" aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label} onclick={() => (open = !open)}>
    <Icon name="more" />
  </button>
  {#if open}
    <div class="pop card" role="menu">
      {#each items as item, i (i)}
        {#if 'divider' in item}
          <hr />
        {:else}
          <button role="menuitem" class="item" class:danger={item.danger} onclick={() => { open = false; item.run(); }}>
            <Icon name={item.icon} size={17} /> {item.label}
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .menu { position: relative; }
  .pop {
    position: absolute; right: 0; top: calc(100% + 8px); z-index: 40;
    min-width: 250px; padding: 6px; box-shadow: var(--shadow-pop);
    animation: pop 0.16s var(--ease);
  }
  @keyframes pop { from { opacity: 0; transform: translateY(-4px) scale(0.98); } }
  .item {
    display: flex; align-items: center; gap: 10px; width: 100%;
    padding: 9px 11px; border: 0; border-radius: 9px; background: none; cursor: pointer; text-align: left; font-size: 14px;
  }
  .item:hover { background: var(--surface-3); }
  .item.danger { color: var(--danger); }
  hr { border: 0; border-top: 1px solid var(--border); margin: 5px 4px; }
</style>
