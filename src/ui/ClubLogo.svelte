<script lang="ts">
  // Abteilungslogo der SGH: Wappen allein (klein, im Kopf) oder komplettes Logo mit Schriftzug
  import wappen from '../assets/sgh-wappen.png';
  import full from '../assets/sgh-badminton.png';

  let { variant = 'wappen', height = 40 }: { variant?: 'wappen' | 'full'; height?: number | string } = $props();
</script>

{#if variant === 'full'}
  <img class="club full" src={full} alt="Sportgemeinschaft Hochspeyer – Abteilung Badminton" style:height={typeof height === 'number' ? `${height}px` : height} />
{:else}
  <img class="club" src={wappen} alt="SG Hochspeyer" style:height={typeof height === 'number' ? `${height}px` : height} />
{/if}

<style>
  .club { display: block; width: auto; flex: none; object-fit: contain; }
  /* Das Gesamtlogo hat dunkle Schrift: auf weißer Fläche, damit es auch im dunklen Beamer lesbar bleibt */
  .full { background: #fff; padding: 1.4cqh 2cqh; border-radius: 2cqh; box-sizing: content-box; }
</style>
