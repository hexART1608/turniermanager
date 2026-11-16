<script lang="ts">
  // Minimale Steuerung in der Kopfzeile, solange das Musikfenster zu ist:
  // Titel + Stopp / Play-Pause / Weiter – für lokale Musik und Spotify.
  import { music } from '../lib/music.svelte';
  import { spotify } from '../lib/spotify.svelte';
  import Icon from './Icon.svelte';

  // Was läuft, hat Vorrang; sonst die zuletzt benutzte Quelle mit einem Titel
  const src = $derived<'local' | 'spotify' | null>(
    music.playing ? 'local'
    : spotify.playing ? 'spotify'
    : spotify.connected && spotify.current?.item ? 'spotify'
    : music.current ? 'local' : null,
  );
  const title = $derived(src === 'local' ? music.current?.name : spotify.current?.item?.name);
  const sub = $derived(src === 'spotify' ? spotify.artist : '');
  const playing = $derived(src === 'local' ? music.playing : spotify.playing);
  const safe = (job: () => Promise<void>) => () => void job().catch(err => { spotify.error = err instanceof Error ? err.message : 'Spotify-Aktion fehlgeschlagen.'; });

  function stop() { if (src === 'local') music.stop(); else void safe(() => spotify.stop())(); }
  function toggle() { if (src === 'local') music.toggle(); else void safe(() => spotify.toggle())(); }
  function next() { if (src === 'local') void music.next(); else void safe(() => spotify.next())(); }
</script>

{#if src && title && !music.panelOpen}
  <div class="mini" class:ducked={music.ducked} aria-label="Musiksteuerung">
    <button class="info" onclick={() => (music.panelOpen = true)} title="Musikfenster öffnen">
      {#if playing}<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>{:else}<Icon name="music" size={15} />{/if}
      <span class="txt"><span class="t">{title}</span>{#if sub}<span class="a">{sub}</span>{/if}</span>
    </button>
    <button class="btn btn-ghost btn-icon btn-sm" aria-label="Stopp" title="Stopp" onclick={stop}><Icon name="stop" size={15} /></button>
    <button class="btn btn-ghost btn-icon btn-sm pp" aria-label={playing ? 'Pause' : 'Abspielen'} title={playing ? 'Pause' : 'Abspielen'} onclick={toggle}><Icon name={playing ? 'pause' : 'play'} size={16} /></button>
    <button class="btn btn-ghost btn-icon btn-sm" aria-label="Nächster Titel" title="Nächster Titel" onclick={next}><Icon name="skipForward" size={15} /></button>
  </div>
{/if}

<style>
  .mini { display: flex; align-items: center; gap: 2px; min-width: 0; max-width: 420px; padding: 3px 4px 3px 10px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border); }
  .info { display: flex; align-items: center; gap: 8px; min-width: 0; border: 0; background: none; cursor: pointer; color: var(--fg-muted); padding: 0 6px 0 0; text-align: left; }
  .txt { display: flex; flex-direction: column; min-width: 0; line-height: 1.15; }
  .t { font-size: 13px; font-weight: 600; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
  .a { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
  .pp { color: var(--accent); }
  .eq { display: inline-flex; gap: 2px; align-items: flex-end; width: 15px; height: 14px; justify-content: center; flex: none; }
  .eq i { width: 3px; background: var(--accent); border-radius: 1px; animation: eq 0.9s ease-in-out infinite; }
  .eq i:nth-child(2) { animation-delay: -0.3s; }
  .eq i:nth-child(3) { animation-delay: -0.6s; }
  .ducked .eq i { background: var(--warning); animation-duration: 1.8s; }
  @keyframes eq { 0%, 100% { height: 3px; } 50% { height: 13px; } }
  @media (max-width: 1100px) { .a { display: none; } .t { max-width: 140px; } }
  @media (max-width: 800px) { .info .txt { display: none; } .mini { padding-left: 6px; } }
</style>
