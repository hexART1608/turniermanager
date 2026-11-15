<script lang="ts">
  // Badmintonfeld von oben (maßstäblich 13,40 × 6,10 m), links Team A, rechts Team B.
  import type { Snippet } from 'svelte';

  let {
    left,
    right,
    winner = null,
    dim = false,
    compact = false,
  }: { left: Snippet; right: Snippet; winner?: 'A' | 'B' | null; dim?: boolean; compact?: boolean } = $props();
</script>

<div class="court" class:dim class:compact class:win-a={winner === 'A'} class:win-b={winner === 'B'}>
  <svg class="lines" viewBox="-12 -12 1364 634" preserveAspectRatio="none" aria-hidden="true">
    <rect x="0" y="0" width="1340" height="610" />
    <path d="M0 46H1340M0 564H1340M472 0V610M868 0V610M76 0V610M1264 0V610M0 305H472M868 305H1340" />
    <path class="net" d="M670 -12V622" />
  </svg>
  <div class="half half-a">{@render left()}</div>
  <div class="half half-b">{@render right()}</div>
</div>

<style>
  .court {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    aspect-ratio: 1364 / 634;
    border-radius: 12px;
    overflow: hidden;
    background:
      radial-gradient(120% 90% at 50% 0%, rgba(255, 255, 255, 0.12), transparent 55%),
      repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.025) 0 40px, transparent 40px 80px),
      linear-gradient(180deg, var(--court), var(--court-deep));
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 -30px 60px -30px rgba(0, 0, 0, 0.45);
    transition: filter 0.3s, opacity 0.3s;
  }
  .court.compact { aspect-ratio: auto; min-height: 120px; }
  .dim { filter: saturate(0.35) brightness(0.8); }
  .lines {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .lines rect, .lines path {
    fill: none;
    stroke: var(--court-line);
    stroke-width: 5;
    vector-effect: non-scaling-stroke;
  }
  .lines rect, .lines path { stroke-width: 2; }
  .lines .net { stroke: #ffffff; stroke-width: 4; stroke-dasharray: 2 5; opacity: 0.95; }
  .half {
    position: relative;
    display: grid;
    place-items: center;
    padding: 6% 7%;
    min-width: 0;
    transition: background 0.3s;
  }
  .win-a .half-a, .win-b .half-b {
    background: radial-gradient(closest-side, rgba(200, 245, 60, 0.28), transparent);
  }
  .win-a .half-b, .win-b .half-a { filter: saturate(0.5); opacity: 0.75; }
</style>
