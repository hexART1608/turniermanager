<script lang="ts">
  // Kleines Konfetti auf Canvas, ohne Bibliothek. Läuft einige Sekunden und hört dann auf.
  import { onMount } from 'svelte';

  let { duration = 6000, density = 1 }: { duration?: number; density?: number } = $props();
  let canvas: HTMLCanvasElement;

  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d')!;
    const colors = ['#c8f53c', '#ffe58a', '#f2b630', '#4cc9ff', '#ff8b5c', '#ffffff'];
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const N = Math.round(Math.min(260, (w * h) / 6000) * density);
    const parts = Array.from({ length: N }, () => ({
      x: Math.random() * w,
      y: -20 - Math.random() * h * 0.8,
      vx: (Math.random() - 0.5) * 1.6,
      vy: 1.6 + Math.random() * 2.6,
      r: 4 + Math.random() * 6,
      a: Math.random() * Math.PI,
      va: (Math.random() - 0.5) * 0.25,
      c: colors[Math.floor(Math.random() * colors.length)]!,
      shuttle: Math.random() < 0.08,
    }));
    const t0 = performance.now();
    const frame = (now: number) => {
      const age = now - t0;
      ctx.clearRect(0, 0, w, h);
      let alive = 0;
      for (const p of parts) {
        p.x += p.vx + Math.sin((now + p.r * 100) / 600) * 0.6;
        p.y += p.vy;
        p.a += p.va;
        if (p.y > h + 20) {
          if (age < duration) { p.y = -20; p.x = Math.random() * w; } else continue;
        }
        alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);
        ctx.fillStyle = p.c;
        if (p.shuttle) {
          ctx.beginPath(); ctx.moveTo(-p.r, -p.r * 1.4); ctx.lineTo(p.r, -p.r * 1.4); ctx.lineTo(p.r * 0.45, p.r * 0.4); ctx.lineTo(-p.r * 0.45, p.r * 0.4); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, p.r * 0.7, p.r * 0.5, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        }
        ctx.restore();
      }
      if (alive) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 50; }
</style>
