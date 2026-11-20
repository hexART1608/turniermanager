<script lang="ts">
  // Wartebild: Ein Badmintonfeld in Perspektive zeichnet sich wie eine Neonröhre Linie für Linie selbst,
  // lädt sich auf, flackert kurz und lässt einen Lichtpunkt über den Rand laufen. Danach erlischt es und beginnt neu.
  // Alles SVG-Animation (SMIL) auf einer gemeinsamen Uhr, ohne Filter und ohne Layout-Arbeit.
  const L = 14;               // Länge eines Durchlaufs in Sekunden
  const FADE_AT = 12, FADE_END = 13.2;
  const dur = `${L}s`;

  // Perspektive: u = Länge (0 nah … 13,4 fern), v = Breite (0 … 6,1), h = Höhe in Metern
  const s = (u: number) => 1 / (1 + 0.026 * u);
  const sFar = s(13.4);
  const X = (u: number, v: number) => 300 + (v - 3.05) * 72 * s(u);
  const Y = (u: number, h = 0) => 310 - 205 * ((1 - s(u)) / (1 - sFar)) - h * 46 * s(u);
  const pt = (u: number, v: number, h = 0) => `${X(u, v).toFixed(1)} ${Y(u, h).toFixed(1)}`;
  const poly = (pts: [number, number][], close = false) => 'M' + pts.map(([u, v]) => pt(u, v)).join(' L') + (close ? ' Z' : '');

  type Line = { d: string; at: number; len: number; color?: string };
  const lines: Line[] = [
    { d: poly([[0, 0], [13.4, 0], [13.4, 6.1], [0, 6.1]], true), at: 0.3, len: 2.6 },
    { d: poly([[0, 0.46], [13.4, 0.46]]), at: 2.2, len: 1.5 },
    { d: poly([[0, 5.64], [13.4, 5.64]]), at: 2.5, len: 1.5 },
    { d: poly([[0.76, 0], [0.76, 6.1]]), at: 3.3, len: 1.0 },
    { d: poly([[12.64, 0], [12.64, 6.1]]), at: 3.5, len: 1.0 },
    { d: poly([[4.72, 0], [4.72, 6.1]]), at: 3.9, len: 1.0 },
    { d: poly([[8.68, 0], [8.68, 6.1]]), at: 4.1, len: 1.0 },
    { d: poly([[0, 3.05], [4.72, 3.05]]), at: 4.6, len: 0.9 },
    { d: poly([[13.4, 3.05], [8.68, 3.05]]), at: 4.7, len: 0.9 },
  ];
  // Netz: zwei Pfosten, Netzband oben, feine Maschen
  const NET_U = 6.7, NET_H = 1.55, V0 = -0.35, V1 = 6.45;
  const netLines: Line[] = [
    { d: `M${pt(NET_U, V0)} L${pt(NET_U, V0, NET_H)}`, at: 5.2, len: 0.7, color: '#4cc9ff' },
    { d: `M${pt(NET_U, V1)} L${pt(NET_U, V1, NET_H)}`, at: 5.2, len: 0.7, color: '#4cc9ff' },
    { d: `M${pt(NET_U, V0, NET_H)} L${pt(NET_U, V1, NET_H)}`, at: 5.8, len: 1.0, color: '#4cc9ff' },
    { d: `M${pt(NET_U, V0, 0)} L${pt(NET_U, V1, 0)}`, at: 5.8, len: 1.0, color: '#4cc9ff' },
  ];
  const mesh: string[] = [];
  for (let h = 0.4; h < NET_H; h += 0.4) mesh.push(`M${pt(NET_U, V0, h)} L${pt(NET_U, V1, h)}`);
  for (let v = 0.2; v < 6.1; v += 0.4) mesh.push(`M${pt(NET_U, v, 0)} L${pt(NET_U, v, NET_H)}`);
  const meshD = mesh.join(' ');

  const t = (sec: number) => (sec / L).toFixed(4);
  const draw = (l: Line) => {
    const a = l.at, b = l.at + l.len;
    return { values: '1.03;1.03;0;0', keyTimes: `0;${t(a)};${t(b)};1`, keySplines: '0 0 1 1; 0.45 0 0.2 1; 0 0 1 1' };
  };
  // Neon-Flackern direkt nach dem Aufbau, dann bis zum Ausblenden voll an
  const flicker = [[0, 1], [7.0, 1], [7.08, 0.3], [7.2, 1], [7.36, 0.5], [7.5, 1], [FADE_AT, 1], [FADE_END, 0], [L, 0]] as const;
  const fv = flicker.map(([, v]) => v).join(';');
  const fk = flicker.map(([x]) => t(x)).join(';');
  // Aufladen: der weiche Schein wird nach dem Zeichnen stärker und „atmet“
  const glowV = '0.05;0.05;0.26;0.15;0.26;0.15;0.22;0.22';
  const glowK = [0, 6.8, 7.6, 9, 10.2, 11.2, FADE_AT, L].map(t).join(';');
  const layers = [
    { w: 12, op: 0.1, color: '#c8f53c', glow: true },
    { w: 5, op: 0.3, color: '#c8f53c', glow: false },
    { w: 1.9, op: 1, color: '#f6ffd2', glow: false },
  ];
  // Lichtpunkt, der nach dem Zeichnen über den Spielfeldrand läuft
  const rim = lines[0]!.d;
  const pulseOp = `0;0;1;1;0;0`;
  const pulseK = [0, 7.6, 7.8, FADE_AT - 0.4, FADE_AT, L].map(t).join(';');
</script>

<div class="neon" aria-hidden="true">
  <svg viewBox="0 0 600 340" role="img">
    <defs>
      <radialGradient id="floor" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#c8f53c" stop-opacity="0.16" />
        <stop offset="1" stop-color="#c8f53c" stop-opacity="0" />
      </radialGradient>
    </defs>

    <ellipse cx="300" cy="215" rx="290" ry="125" fill="url(#floor)">
      <animate attributeName="opacity" values={flicker.map(([, v]) => v * 0.9).join(';')} keyTimes={fk} dur={dur} repeatCount="indefinite" />
    </ellipse>

    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <animate attributeName="opacity" values={fv} keyTimes={fk} dur={dur} repeatCount="indefinite" />

      <!-- Spielfeld -->
      {#each layers as ly}
        {#each lines as l}
          {@const a = draw(l)}
          <path d={l.d} pathLength="1" stroke={ly.color} stroke-width={ly.w} stroke-opacity={ly.op} stroke-dasharray="1 3">
            {#if ly.glow}<animate attributeName="stroke-opacity" values={glowV} keyTimes={glowK} dur={dur} repeatCount="indefinite" />{/if}
            <animate attributeName="stroke-dashoffset" values={a.values} keyTimes={a.keyTimes} keySplines={a.keySplines} calcMode="spline" dur={dur} repeatCount="indefinite" />
          </path>
        {/each}
      {/each}

      <!-- Netz -->
      {#each [{ w: 9, op: 0.1 }, { w: 4, op: 0.3 }, { w: 1.6, op: 1, core: true }] as ly}
        {#each netLines as l}
          {@const a = draw(l)}
          <path d={l.d} pathLength="1" stroke={ly.core ? '#d8f3ff' : l.color} stroke-width={ly.w} stroke-opacity={ly.op} stroke-dasharray="1 3">
            <animate attributeName="stroke-dashoffset" values={a.values} keyTimes={a.keyTimes} keySplines={a.keySplines} calcMode="spline" dur={dur} repeatCount="indefinite" />
          </path>
        {/each}
      {/each}
      <path d={meshD} stroke="#4cc9ff" stroke-width="1" stroke-opacity="0">
        <animate attributeName="stroke-opacity" values="0;0;0.5;0.5;0" keyTimes={[0, 6.4, 7.2, FADE_AT, FADE_END].map(t).join(';')} dur={dur} repeatCount="indefinite" />
      </path>

      <!-- Lichtpunkt am Rand -->
      {#each [{ w: 11, op: 0.3, color: '#c8f53c' }, { w: 3.2, op: 1, color: '#ffffff' }] as ly}
        <path d={rim} pathLength="1" stroke={ly.color} stroke-width={ly.w} stroke-dasharray="0.06 0.94" stroke-opacity="0">
          <animate attributeName="stroke-dashoffset" values="0;-1" dur="3.4s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values={pulseOp.split(';').map(v => Number(v) * ly.op).join(';')} keyTimes={pulseK} dur={dur} repeatCount="indefinite" />
        </path>
      {/each}
    </g>
  </svg>
</div>

<style>
  .neon { width: 100%; aspect-ratio: 600 / 340; }
  svg { display: block; width: 100%; height: 100%; overflow: visible; }
</style>
