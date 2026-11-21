<script lang="ts">
  // Siegertreppchen: Plätze 1–3 (bei Gleichstand stehen mehrere auf einer Stufe).
  import { standings, type Standing } from '../engine/ranking';
  import Icon from './Icon.svelte';
  import type { Pool, Tournament } from '../engine/types';

  let { t, pool, big = false }: { t: Tournament; pool?: Pool; big?: boolean } = $props();

  const rows = $derived(standings(t, pool).filter(s => s.wins > 0));
  // die drei besten Ranggruppen; bei Gleichstand stehen mehrere auf einer Stufe
  // und die Stufe zeigt den echten Rang (z. B. 1, 3, 4)
  const steps = $derived.by(() => {
    const ranks = [...new Set(rows.map(s => s.rank))].slice(0, 3);
    return ranks.map((rank, i) => ({ rank, level: i + 1, who: rows.filter(s => s.rank === rank) as Standing[] }));
  });
  const order = $derived([steps[1], steps[0], steps[2]]);
  const MAX_NAMES = 4;
</script>

<div class="podium" class:big>
  {#each order as s, i (i)}
    {#if s}
      <div class="place place-{s.level}" style:--delay="{[0.5, 1.1, 0][i]}s">
        {#if big && s.level === 1}
          <div class="trophy" aria-hidden="true">
            <Icon name="trophy" size={64} />
            {#each [0, 1, 2, 3, 4] as k}<i class="spark s{k}"></i>{/each}
          </div>
        {/if}
        <div class="names">
          {#each s.who.slice(0, MAX_NAMES) as w (w.player.id)}
            <span class="nm" style:--i={i} class:many={s.who.length > 2}>{w.player.name}</span>
          {/each}
          {#if s.who.length > MAX_NAMES}<span class="more">+ {s.who.length - MAX_NAMES} weitere</span>{/if}
          <span class="wins num">{s.who[0]!.wins} {s.who[0]!.wins === 1 ? 'Sieg' : 'Siege'}</span>
        </div>
        <div class="block">
          <span class="rank display">{s.rank}</span>
        </div>
      </div>
    {:else}
      <div class="place empty"></div>
    {/if}
  {/each}
</div>

<style>
  .podium { display: grid; grid-template-columns: 1fr 1.15fr 1fr; align-items: end; gap: 12px; max-width: 760px; margin: 0 auto; }
  .place { display: flex; flex-direction: column; align-items: stretch; gap: 12px; animation: rise 0.9s var(--ease) both; animation-delay: var(--delay); }
  @keyframes rise { from { opacity: 0; transform: translateY(40px); } }
  .names { display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; min-height: 40px; justify-content: flex-end; }
  .nm { font-family: var(--font-display); font-weight: 800; font-size: 24px; line-height: 1.05; }
  .place-1 .nm { font-size: 32px; }
  .nm.many { font-size: 20px !important; }
  .more { font-size: 13px; color: var(--fg-muted); font-weight: 600; }
  .wins { font-size: 13px; color: var(--fg-muted); font-weight: 600; margin-top: 2px; }
  .block {
    display: grid; place-items: start center; padding-top: 14px;
    border-radius: 14px 14px 4px 4px;
    box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.5), 0 20px 50px -20px rgba(0, 0, 0, 0.7);
  }
  .place-1 .block { height: 190px; background: var(--gold); }
  .place-2 .block { height: 140px; background: var(--silver); }
  .place-3 .block { height: 105px; background: var(--bronze); }
  .rank { font-size: 64px; font-weight: 800; color: rgba(0, 0, 0, 0.55); line-height: 1; }
  .place-1 .rank { font-size: 84px; }

  .block { position: relative; overflow: hidden; animation: grow 1.1s var(--ease) both; animation-delay: var(--delay); transform-origin: bottom; }
  @keyframes grow { from { transform: scaleY(0.05); } }
  .place-1 .block::after {
    content: ''; position: absolute; inset: 0; transform: translateX(-130%) skewX(-20deg);
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.75), transparent); animation: shine 3.2s 2.4s ease-in-out infinite;
  }
  @keyframes shine { 0% { transform: translateX(-130%) skewX(-20deg); } 45%, 100% { transform: translateX(130%) skewX(-20deg); } }
  .nm { animation: pop 0.8s cubic-bezier(0.2, 1.6, 0.4, 1) both; animation-delay: calc(var(--delay) + 0.7s); }
  @keyframes pop { from { opacity: 0; transform: scale(0.3) translateY(20px); } }
  .place-1 .nm { text-shadow: 0 0 24px rgba(255, 215, 90, 0.7); }
  .trophy { align-self: center; position: relative; color: var(--gold); filter: drop-shadow(0 0 18px rgba(255, 200, 60, 0.8)); animation: trophy-in 1.2s calc(var(--delay) + 1s) cubic-bezier(0.2, 1.8, 0.4, 1) both, bob 2.6s calc(var(--delay) + 2.3s) ease-in-out infinite; }
  .trophy :global(svg) { width: 9vh; height: 9vh; color: #f2b630; stroke: #f2b630; fill: rgba(242, 182, 48, 0.35); stroke-width: 1.6; }
  @keyframes trophy-in { from { opacity: 0; transform: translateY(-12vh) scale(0.2) rotate(-25deg); } }
  @keyframes bob { 50% { transform: translateY(-1.2vh) rotate(3deg); } }
  .spark { position: absolute; width: 1vh; height: 1vh; background: #fff; border-radius: 50%; box-shadow: 0 0 10px 3px #ffe58a; opacity: 0; animation: twinkle 2.2s infinite; }
  .s0 { left: -20%; top: 10%; animation-delay: 2.6s; } .s1 { right: -20%; top: 0; animation-delay: 3.1s; }
  .s2 { left: 10%; top: -25%; animation-delay: 3.6s; } .s3 { right: 5%; bottom: 10%; animation-delay: 4.0s; } .s4 { left: -30%; bottom: 20%; animation-delay: 4.4s; }
  @keyframes twinkle { 0%, 100% { opacity: 0; transform: scale(0.2); } 50% { opacity: 1; transform: scale(1.6); } }
  @media (prefers-reduced-motion: reduce) { .block, .nm, .trophy, .spark, .place-1 .block::after { animation: none; } .spark { opacity: 0; } }

  .big { width: min(76vw, 135vh); max-width: none; gap: 2vw; }
  .big .nm { font-size: 4.6vh; }
  .big .place-1 .nm { font-size: 6.4vh; }
  .big .wins { font-size: 2vh; }
  .big .place-1 .block { height: 27vh; }
  .big .place-2 .block { height: 19vh; }
  .big .place-3 .block { height: 13vh; }
  .big .rank { font-size: 9vh; }
  .big .place-1 .rank { font-size: 12vh; }
  .big .nm.many { font-size: 2.8vh !important; }
  .big .more { font-size: 1.8vh; }
</style>
