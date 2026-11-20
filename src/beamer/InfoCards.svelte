<script lang="ts">
  // Wartebild: Wechselnde Infokarten zum Turnier (Spielform, Felder & Runden, Spieler, Ablauf).
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import Icon, { type IconName } from '../ui/Icon.svelte';

  let { cards }: { cards: { icon: IconName; title: string; big?: string; text: string; facts?: { label: string; value: string }[] }[] } = $props();
  const EVERY = 6500;
  let idx = $state(0);

  onMount(() => {
    const id = setInterval(() => { idx = (idx + 1) % Math.max(1, cards.length); }, EVERY);
    return () => clearInterval(id);
  });
  const card = $derived(cards[idx % Math.max(1, cards.length)]);
</script>

<div class="cards" aria-hidden="true">
  <div class="stack">
    {#key idx}
      {#if card}
        <div class="card-big" in:fly={{ x: 60, duration: 650, delay: 200 }} out:fade={{ duration: 250 }}>
          <div class="ic"><Icon name={card.icon} size="100%" /></div>
          <p class="eyebrow">{card.title}</p>
          {#if card.big}<p class="big display">{card.big}</p>{/if}
          <p class="txt">{card.text}</p>
          {#if card.facts}
            <div class="facts">
              {#each card.facts as ft}<div class="fact"><span class="v display num">{ft.value}</span><span class="l">{ft.label}</span></div>{/each}
            </div>
          {/if}
        </div>
      {/if}
    {/key}
  </div>
  <div class="dots">
    {#each cards as _, i}<span class="dot" class:on={i === idx}>{#if i === idx}{#key idx}<i style:animation-duration="{EVERY}ms"></i>{/key}{/if}</span>{/each}
  </div>
</div>

<style>
  .cards { display: flex; flex-direction: column; align-items: center; gap: 3cqh; width: 100%; }
  .stack { display: grid; width: 100%; }
  .card-big { grid-area: 1 / 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.6cqh; text-align: center; padding: 4cqh 3cqw; min-height: 62cqh; border-radius: 3cqh; background: linear-gradient(160deg, rgba(200, 245, 60, 0.10), rgba(15, 24, 40, 0.9) 55%); border: 1px solid rgba(200, 245, 60, 0.28); box-shadow: 0 0 6cqh rgba(200, 245, 60, 0.12); }
  .ic { width: 11cqh; height: 11cqh; color: var(--accent); }
  .eyebrow { margin: 0; font-size: 3.4cqh; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); }
  .big { margin: 0; font-size: 11cqh; font-weight: 800; line-height: 1; color: #fff; }
  .txt { margin: 0; font-size: 4.6cqh; line-height: 1.35; color: rgba(255, 255, 255, 0.82); max-width: 40ch; }
  .facts { display: flex; gap: 3.5cqw; margin-top: 1cqh; }
  .fact { display: flex; flex-direction: column; align-items: center; gap: 0.4cqh; }
  .fact .v { font-size: 12cqh; font-weight: 800; line-height: 1; color: #fff; }
  .fact .l { font-size: 3.2cqh; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-muted); }
  .dots { display: flex; gap: 1cqw; }
  .dot { position: relative; width: 4cqw; height: 0.7cqh; border-radius: 9px; background: rgba(255, 255, 255, 0.16); overflow: hidden; }
  .dot i { position: absolute; inset: 0; background: var(--accent); transform-origin: left; animation: fill linear forwards; will-change: transform; }
  @keyframes fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
</style>
