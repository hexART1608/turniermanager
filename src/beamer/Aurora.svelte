<script lang="ts">
  // Wartebild: weich wandernde Farbflächen in den Vereinsfarben. Nur Verschiebung (GPU), keine Filter.
</script>

<div class="aurora" aria-hidden="true">
  <i class="b b1"></i><i class="b b2"></i><i class="b b3"></i><i class="b b4"></i>
</div>

<style>
  .aurora { position: absolute; inset: 0; overflow: hidden; background: radial-gradient(120% 90% at 50% 100%, #0d1830, #060b16); }
  .b { position: absolute; border-radius: 50%; will-change: transform; }
  .b1 { width: 95cqh; height: 95cqh; left: -12cqw; top: -25cqh; background: radial-gradient(closest-side, rgba(225, 38, 45, 0.55), transparent); animation: d1 26s ease-in-out infinite alternate; }
  .b2 { width: 110cqh; height: 110cqh; right: -14cqw; top: 5cqh; background: radial-gradient(closest-side, rgba(200, 245, 60, 0.34), transparent); animation: d2 32s ease-in-out infinite alternate; }
  .b3 { width: 90cqh; height: 90cqh; left: 28cqw; bottom: -40cqh; background: radial-gradient(closest-side, rgba(31, 183, 166, 0.42), transparent); animation: d3 38s ease-in-out infinite alternate; }
  .b4 { width: 80cqh; height: 80cqh; left: 52cqw; top: -30cqh; background: radial-gradient(closest-side, rgba(76, 120, 255, 0.34), transparent); animation: d4 29s ease-in-out infinite alternate; }
  @keyframes d1 { from { transform: translate3d(0, 0, 0) scale(1); } to { transform: translate3d(36cqw, 24cqh, 0) scale(1.25); } }
  @keyframes d2 { from { transform: translate3d(0, 0, 0) scale(1.1); } to { transform: translate3d(-40cqw, 10cqh, 0) scale(0.85); } }
  @keyframes d3 { from { transform: translate3d(0, 0, 0) scale(0.9); } to { transform: translate3d(-30cqw, -26cqh, 0) scale(1.2); } }
  @keyframes d4 { from { transform: translate3d(0, 0, 0) scale(1); } to { transform: translate3d(-22cqw, 34cqh, 0) scale(1.3); } }
  @media (prefers-reduced-motion: reduce) { .b { animation: none; } }
</style>
