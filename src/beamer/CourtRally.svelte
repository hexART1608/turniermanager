<script lang="ts">
  // Wartebild: Badminton-Feld von oben, zwei Spieler spielen einen endlosen, einstudierten Ballwechsel.
  // Der Ablauf wird einmal berechnet und als SVG-Animation (SMIL) abgespielt: keine Skripte im Betrieb,
  // keine Layout-Arbeit – daher ruhig und ohne Ruckeln.
  type P = { x: number; y: number };
  const FPS = 30;
  const T = 1.3;            // Sekunden je Schlag
  const START = 0.9;        // erster Schlag (Aufschlag)
  const HOLD = 1.7;         // Pause nach dem letzten Schlag, dann beginnt der Wechsel von vorn
  const HOME: Record<'A' | 'B', P> = { A: { x: 150, y: 150 }, B: { x: 450, y: 150 } };

  // Schlagpunkte: gerade Nummern spielt A (links), ungerade B (rechts); der letzte Schlag ist ein Smash ins Leere
  const HIT: P[] = [
    { x: 205, y: 205 }, { x: 425, y: 92 }, { x: 150, y: 68 }, { x: 485, y: 222 },
    { x: 235, y: 140 }, { x: 395, y: 62 }, { x: 120, y: 215 },
  ];
  const LAND: P = { x: 490, y: 236 };
  const n = HIT.length;
  const hitT = HIT.map((_, i) => START + i * T);
  const landT = START + n * T;
  const L = landT + HOLD;

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const smooth = (v: number) => { const c = clamp01(v); return c * c * (3 - 2 * c); };
  const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
  const uid = Math.random().toString(36).slice(2, 7);

  // ---------- Spieler ----------
  function waypoints(side: 'A' | 'B'): { t: number; p: P }[] {
    const home = HOME[side];
    const w: { t: number; p: P }[] = [{ t: 0, p: home }];
    const mine = HIT.map((p, i) => ({ p, t: hitT[i]!, i })).filter(h => (h.i % 2 === 0) === (side === 'A'));
    for (const h of mine) {
      w.push({ t: Math.max(0, h.t - 1.1), p: home }, { t: h.t - 0.05, p: h.p }, { t: h.t + 0.2, p: h.p }, { t: h.t + 0.8, p: home });
    }
    if (side === 'B') w.push({ t: hitT[n - 1]! + 0.25, p: home }, { t: landT - 0.08, p: { x: 452, y: 206 } }, { t: landT + 0.5, p: { x: 452, y: 206 } });
    w.push({ t: L - 0.4, p: home }, { t: L, p: home });
    const out: { t: number; p: P }[] = [];
    for (const k of w.sort((a, b) => a.t - b.t)) if (!out.length || k.t > out[out.length - 1]!.t + 0.001) out.push(k);
    return out;
  }
  const wp = { A: waypoints('A'), B: waypoints('B') };
  function playerAt(side: 'A' | 'B', t: number): P {
    const w = wp[side];
    for (let i = 1; i < w.length; i++) {
      if (t <= w[i]!.t) {
        const a = w[i - 1]!, b = w[i]!;
        const u = smooth((t - a.t) / (b.t - a.t));
        return { x: lerp(a.p.x, b.p.x, u), y: lerp(a.p.y, b.p.y, u) };
      }
    }
    return w[w.length - 1]!.p;
  }

  // Schlagarm: Ruhelage, Ausholen, Schlag, Zurück
  function swingAt(side: 'A' | 'B', t: number): number {
    const rest = 12;
    let best = rest;
    for (let i = 0; i < n; i++) {
      if ((i % 2 === 0) !== (side === 'A')) continue;
      const d = t - hitT[i]!;
      const smash = i === n - 1;
      const back = smash ? -95 : -62, fwd = smash ? 62 : 42;
      if (d >= -0.5 && d < -0.12) best = lerp(rest, back, smooth((d + 0.5) / 0.38));
      else if (d >= -0.12 && d < 0.04) best = lerp(back, fwd, smooth((d + 0.12) / 0.16));
      else if (d >= 0.04 && d < 0.45) best = lerp(fwd, rest, smooth((d - 0.04) / 0.41));
    }
    return best;
  }

  // ---------- Federball ----------
  const peak = (i: number) => (i === n - 1 ? 0 : [78, 38, 58][i % 3]!);
  function shuttleAt(t: number): { g: P; h: number; vis: number } {
    if (t < hitT[0]! || t > landT + 0.7) return { g: HIT[0]!, h: 0, vis: 0 };
    if (t >= landT) return { g: LAND, h: 0, vis: t < landT + 0.45 ? 1 : 1 - (t - landT - 0.45) / 0.25 };
    const i = Math.min(n - 1, Math.floor((t - START) / T));
    const u = (t - hitT[i]!) / T;
    const a = HIT[i]!, b = i === n - 1 ? LAND : HIT[i + 1]!;
    const h = i === n - 1 ? 64 * Math.pow(1 - u, 1.6) : peak(i) * 4 * u * (1 - u) + 6 * (1 - u);
    return { g: { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) }, h, vis: 1 };
  }

  // ---------- Abtasten ----------
  const steps = Math.round(L * FPS);
  const ts = Array.from({ length: steps + 1 }, (_, k) => (k / steps) * L);
  const f = (v: number) => v.toFixed(1);
  const join = (a: string[]) => a.join(';');

  const posA = join(ts.map(t => { const p = playerAt('A', t); return `${f(p.x)},${f(p.y)}`; }));
  const posB = join(ts.map(t => { const p = playerAt('B', t); return `${f(p.x)},${f(p.y)}`; }));
  const armA = join(ts.map(t => f(swingAt('A', t))));
  const armB = join(ts.map(t => f(swingAt('B', t))));
  const sh = ts.map(t => shuttleAt(t));
  const sprite = sh.map(s => ({ x: s.g.x, y: s.g.y - s.h }));
  let ang = 0;
  const angles = sprite.map((p, k) => {
    const q = sprite[Math.min(sprite.length - 1, k + 1)]!;
    const dx = q.x - p.x, dy = q.y - p.y;
    if (Math.hypot(dx, dy) > 0.15) {
      let a = (Math.atan2(dy, dx) * 180) / Math.PI;
      while (a - ang > 180) a -= 360;
      while (a - ang < -180) a += 360;
      ang = a;
    }
    return ang;
  });
  const spritePos = join(sprite.map(p => `${f(p.x)},${f(p.y)}`));
  const spriteAng = join(angles.map(f));
  const spriteScale = join(sh.map(s => (1.7 + s.h / 90).toFixed(2)));
  const shadowPos = join(sh.map(s => `${f(s.g.x)},${f(s.g.y)}`));
  const shadowOp = join(sh.map(s => (s.vis * 0.45 * (1 - Math.min(1, s.h / 110))).toFixed(2)));
  const visOp = join(sh.map(s => s.vis.toFixed(2)));
  const ringR = join(ts.map(t => f(t < landT ? 0 : 4 + 46 * smooth((t - landT) / 0.9))));
  const ringOp = join(ts.map(t => (t < landT ? 0 : 0.85 * (1 - smooth((t - landT) / 0.9))).toFixed(2)));
  const dur = `${L.toFixed(2)}s`;
</script>

<div class="court" aria-hidden="true">
  <svg viewBox="0 0 600 300" role="img">
    <defs>
      <linearGradient id="turf-{uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#16875a" />
        <stop offset="1" stop-color="#0c5d3b" />
      </linearGradient>
      <radialGradient id="shade-{uid}" cx="0.5" cy="0.5" r="0.75">
        <stop offset="0.55" stop-color="#000" stop-opacity="0" />
        <stop offset="1" stop-color="#000" stop-opacity="0.45" />
      </radialGradient>
      <linearGradient id="skirt-{uid}" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0" stop-color="#fff" />
        <stop offset="1" stop-color="#dfe9c8" stop-opacity="0.8" />
      </linearGradient>
    </defs>

    <rect width="600" height="300" fill="#0a3d28" />
    <rect x="30" y="30" width="540" height="240" fill="url(#turf-{uid})" />
    <g fill="none" stroke="#fff" stroke-opacity="0.92" stroke-width="2.4">
      <rect x="30" y="30" width="540" height="240" />
      <path d="M30 48H570M30 252H570" />
      <path d="M220 48V252M380 48V252" />
      <path d="M30 150H220M380 150H570" />
      <path d="M61 30V270M539 30V270" />
    </g>
    <rect width="600" height="300" fill="url(#shade-{uid})" />

    <rect x="298" y="26" width="4" height="248" fill="#000" fill-opacity="0.25" transform="translate(6 4)" />
    <path d="M300 22V278" stroke="#fff" stroke-width="3.2" stroke-dasharray="3 3" stroke-opacity="0.95" />
    <circle cx="300" cy="22" r="5" fill="#e8edf5" /><circle cx="300" cy="278" r="5" fill="#e8edf5" />

    <circle cx={LAND.x} cy={LAND.y} r="0" fill="none" stroke="#c8f53c" stroke-width="3">
      <animate attributeName="r" values={ringR} dur={dur} repeatCount="indefinite" />
      <animate attributeName="stroke-opacity" values={ringOp} dur={dur} repeatCount="indefinite" />
    </circle>

    <ellipse rx="11" ry="5" fill="#000">
      <animateTransform attributeName="transform" type="translate" values={shadowPos} dur={dur} repeatCount="indefinite" />
      <animate attributeName="opacity" values={shadowOp} dur={dur} repeatCount="indefinite" />
    </ellipse>

    {#each [{ side: 'A', pos: posA, arm: armA, color: '#4cc9ff', flip: 1 }, { side: 'B', pos: posB, arm: armB, color: '#ff8b5c', flip: -1 }] as pl}
      <g>
        <animateTransform attributeName="transform" type="translate" values={pl.pos} dur={dur} repeatCount="indefinite" />
        <g transform="scale({pl.flip * 1.55} 1.55)">
          <ellipse cx="0" cy="3" rx="15" ry="16" fill="#000" fill-opacity="0.28" />
          <g transform="translate(4 -9)">
            <g>
              <animateTransform attributeName="transform" type="rotate" values={pl.arm} dur={dur} repeatCount="indefinite" />
              <line x1="0" y1="0" x2="22" y2="0" stroke="#f1f3f6" stroke-width="2.6" stroke-linecap="round" />
              <ellipse cx="33" cy="0" rx="11.5" ry="8" fill="#fff" fill-opacity="0.14" stroke="#fff" stroke-width="2.2" />
              <path d="M24 0H42M33 -6.5V6.5" stroke="#fff" stroke-opacity="0.55" stroke-width="0.9" />
              <circle cx="0" cy="0" r="3.6" fill={pl.color} stroke="#fff" stroke-opacity="0.7" stroke-width="1" />
            </g>
          </g>
          <ellipse cx="0" cy="0" rx="9" ry="16" fill={pl.color} stroke="#fff" stroke-opacity="0.85" stroke-width="1.6" />
          <circle cx="2" cy="0" r="7" fill="#2a2c38" />
          <circle cx="5.2" cy="-1.6" r="1.1" fill="#f3d3b8" /><circle cx="5.2" cy="1.8" r="1.1" fill="#f3d3b8" />
        </g>
      </g>
    {/each}

    <g>
      <animateTransform attributeName="transform" type="translate" values={spritePos} dur={dur} repeatCount="indefinite" />
      <animate attributeName="opacity" values={visOp} dur={dur} repeatCount="indefinite" />
      <g>
        <animateTransform attributeName="transform" type="rotate" values={spriteAng} dur={dur} repeatCount="indefinite" />
        <g>
          <animateTransform attributeName="transform" type="scale" values={spriteScale} dur={dur} repeatCount="indefinite" />
          <path d="M5 -4 L-15 -12.5 L-18 0 L-15 12.5 L5 4 Z" fill="url(#skirt-{uid})" stroke="#fff" stroke-opacity="0.6" stroke-width="0.6" />
          <path d="M5 -4 L-16 -6 M5 0 L-18 0 M5 4 L-16 6" stroke="#6f7a5c" stroke-opacity="0.6" stroke-width="0.7" />
          <circle cx="8" cy="0" r="4.6" fill="#fff" stroke="#c4cdb4" stroke-width="0.7" />
        </g>
      </g>
    </g>
  </svg>
</div>

<style>
  .court { width: 100%; border-radius: 2.2cqh; overflow: hidden; box-shadow: 0 0 0 0.35cqh rgba(255, 255, 255, 0.12), 0 3cqh 8cqh rgba(0, 0, 0, 0.55); aspect-ratio: 2 / 1; }
  svg { display: block; width: 100%; height: 100%; }
</style>
