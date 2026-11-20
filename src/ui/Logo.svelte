<script lang="ts">
  // Federball, schräg im Flug – eigene Zeichnung
  let { size = 40, glow = true }: { size?: number | string; glow?: boolean } = $props();
  const uid = Math.random().toString(36).slice(2, 8);
</script>

<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" class:glow>
  <defs>
    <linearGradient id="fb-{uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3ffd0" />
      <stop offset="1" stop-color="#c8f53c" />
    </linearGradient>
    <radialGradient id="cork-{uid}" cx="0.35" cy="0.35" r="0.8">
      <stop offset="0" stop-color="#ffffff" />
      <stop offset="1" stop-color="#d9dfe8" />
    </radialGradient>
  </defs>
  <g transform="rotate(-38 32 32)">
    <!-- Federkranz -->
    <path d="M20 8 L44 8 L37.5 38 L26.5 38 Z" fill="url(#fb-{uid})" opacity="0.95" />
    <path d="M20 8 L26.5 38 M26 8 L29 38 M32 8 L32 38 M38 8 L35 38 M44 8 L37.5 38" stroke="#0b1400" stroke-opacity="0.35" stroke-width="1.3" fill="none" />
    <path d="M21.5 17 H42.5 M23.4 27 H40.6" stroke="#0b1400" stroke-opacity="0.45" stroke-width="1.6" fill="none" />
    <!-- Ring + Kork -->
    <rect x="25.5" y="37" width="13" height="4" rx="1.5" fill="#0b1400" fill-opacity="0.55" />
    <path d="M25.5 41 h13 v2 a6.5 6.5 0 0 1 -13 0 z" fill="url(#cork-{uid})" />
  </g>
  <!-- Fluglinien -->
  <path d="M8 50 L18 42 M5 42 L13 36 M14 57 L22 50" stroke="#c8f53c" stroke-width="2.4" stroke-linecap="round" opacity="0.7" />
</svg>

<style>
  svg { display: block; flex: none; }
  .glow { filter: drop-shadow(0 4px 14px rgba(200, 245, 60, 0.35)); }
</style>
