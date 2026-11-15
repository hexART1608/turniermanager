<script lang="ts">
  import { dialogs } from '../lib/dialog.svelte';
  import Modal from './Modal.svelte';

  let checked = $state(false);
  const d = $derived(dialogs.current);
  $effect(() => { if (d?.checkbox) checked = d.checkbox.checked; });
</script>

{#if d}
  <Modal title={d.title} onclose={() => d.resolve({ ok: false, checked })} width={460}>
    {#if d.text}<p class="text">{d.text}</p>{/if}
    {#if d.checkbox}
      <label class="check"><input type="checkbox" bind:checked /> {d.checkbox.label}</label>
    {/if}
    {#snippet footer()}
      <button class="btn" onclick={() => d.resolve({ ok: false, checked })}>{d.cancel ?? 'Abbrechen'}</button>
      <button class="btn {d.danger ? 'btn-danger' : 'btn-primary'}" data-autofocus onclick={() => d.resolve({ ok: true, checked })}>{d.confirm}</button>
    {/snippet}
  </Modal>
{/if}

<style>
  .text { margin: 0 0 6px; color: var(--fg-muted); white-space: pre-line; }
  .check { display: flex; gap: 10px; align-items: center; margin-top: 14px; font-weight: 500; cursor: pointer; }
  .check input { width: 18px; height: 18px; accent-color: var(--accent); }
</style>
