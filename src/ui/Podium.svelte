<script lang="ts">
  // Siegertreppchen: Plätze 1–3 (bei Gleichstand stehen mehrere auf einer Stufe).
  import { standings, type Standing } from '../engine/ranking';
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
        <div class="names">
          {#each s.who.slice(0, MAX_NAMES) as w (w.player.id)}
            <span class="nm" class:many={s.who.length > 2}>{w.player.name}</span>
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

  .big { width: min(64vw, 110vh); max-width: none; gap: 2vw; }
  .big .nm { font-size: 4vh; }
  .big .place-1 .nm { font-size: 5.6vh; }
  .big .wins { font-size: 2vh; }
  .big .place-1 .block { height: 22vh; }
  .big .place-2 .block { height: 16vh; }
  .big .place-3 .block { height: 11vh; }
  .big .rank { font-size: 8vh; }
  .big .place-1 .rank { font-size: 10vh; }
  .big .nm.many { font-size: 2.8vh !important; }
  .big .more { font-size: 1.8vh; }
</style>
