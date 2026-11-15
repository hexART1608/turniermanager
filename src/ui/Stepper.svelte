<script lang="ts">
  import Icon from './Icon.svelte';

  let {
    value,
    min,
    max,
    step = 1,
    onchange,
    format = (v: number) => String(v),
    label,
    disabled = false,
  }: {
    value: number;
    min: number;
    max: number;
    step?: number;
    onchange: (v: number) => void;
    format?: (v: number) => string;
    label: string;
    disabled?: boolean;
  } = $props();

  const set = (v: number) => onchange(Math.min(max, Math.max(min, v)));
</script>

<div class="stepper" class:disabled role="group" aria-label={label}>
  <button class="btn btn-ghost btn-icon btn-sm" aria-label="{label} verringern" disabled={disabled || value <= min} onclick={() => set(value - step)}><Icon name="minus" size={16} /></button>
  <output class="num display" aria-live="polite">{format(value)}</output>
  <button class="btn btn-ghost btn-icon btn-sm" aria-label="{label} erhöhen" disabled={disabled || value >= max} onclick={() => set(value + step)}><Icon name="plus" size={16} /></button>
</div>

<style>
  .stepper {
    display: inline-flex; align-items: center; gap: 2px;
    padding: 3px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--border);
  }
  output { min-width: 64px; text-align: center; font-size: 22px; font-weight: 700; }
  .disabled { opacity: 0.6; }
</style>
