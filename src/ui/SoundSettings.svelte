<script lang="ts">
  import { SOUND_LABELS, type SoundKind, type SoundSource, deleteCustom, saveCustom, schedule, audio, setVolume } from '../lib/sound';
  import { timer } from '../lib/timer.svelte';
  import { music } from '../lib/music.svelte';
  import { speech } from '../lib/speech.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { ui } from '../lib/ui.svelte';
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';

  const kinds: SoundKind[] = ['start', 'half', 'end'];
  const MAX_BYTES = 8 * 1024 * 1024;

  function test(k: SoundKind) {
    audio();
    setVolume(timer.sound.volume);
    music.duck(0, schedule(k, timer.sound.sources[k], 0).duration);
  }

  const mb = (n: number) => `${Math.round(n / 1e6)} MB`;
  function testSpeech() {
    void speech.speak('Runde 3. Feld 1: Anne und Finn gegen Jonas und David. Feld 2: Marc und Greta gegen Lea und Tim.');
  }

  function setSource(k: SoundKind, v: SoundSource) {
    timer.setSound({ sources: { ...timer.sound.sources, [k]: v } });
  }

  async function upload(k: SoundKind, input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) { toasts.show('error', 'Die Datei ist größer als 8 MB. Bitte eine kürzere Audiodatei nehmen.'); return; }
    try {
      await saveCustom(k, file);
      timer.customNames = { ...timer.customNames, [k]: file.name };
      setSource(k, 'custom');
      toasts.show('success', `„${file.name}“ ist jetzt der Ton für ${SOUND_LABELS[k]}.`);
    } catch (err) {
      console.error(err);
      toasts.show('error', 'Die Datei konnte nicht als Audio gelesen werden (MP3, WAV oder OGG verwenden).');
    }
  }

  async function remove(k: SoundKind) {
    await deleteCustom(k);
    timer.customNames = { ...timer.customNames, [k]: undefined };
    setSource(k, 'builtin');
  }
</script>

<Modal title="Töne & Signale" onclose={() => (ui.soundOpen = false)} width={600}>
  <p class="muted intro">Die Töne kommen aus dem Steuer-Laptop. Eingebaute Signale funktionieren sofort, eigene Dateien bleiben in diesem Browser gespeichert.</p>

  <div class="vol">
    <Icon name={timer.sound.volume === 0 ? 'mute' : 'sound'} />
    <input type="range" min="0" max="1" step="0.05" value={timer.sound.volume} aria-label="Lautstärke" oninput={e => timer.setSound({ volume: Number(e.currentTarget.value) })} />
    <span class="num">{Math.round(timer.sound.volume * 100)} %</span>
  </div>

  <div class="snd speech" aria-label="Sprachansage">
    <div class="snd-head">
      <strong>Sprachansage</strong>
      <small class="muted">Beim Start einer Runde: „Runde 3. Feld 1: Anne und Finn gegen …“ – mit der Stimme „Thorsten“, unabhängig vom Browser und ohne Internet.</small>
    </div>
    {#if speech.status === 'checking'}
      <p class="muted sp-line">Prüfe Sprachpaket …</p>
    {:else if speech.status === 'missing'}
      <p class="muted sp-line">Auf diesem Server liegt kein Sprachpaket. Es lässt sich mit <code>npm run voice:fetch</code> bereitstellen.</p>
    {:else if speech.status === 'available' || speech.status === 'error'}
      {#if speech.status === 'error'}<p class="alert alert-warning"><Icon name="warning" size={16} /> {speech.error}</p>{/if}
      <div class="sp-row">
        <span class="muted sp-line">Sprachpaket nicht geladen ({speech.manifest ? mb(speech.manifest.total) : '≈ 93 MB'}, einmalig mit Internet).</span>
        <button class="btn btn-sm btn-primary" onclick={() => speech.install()}><Icon name="download" size={14} /> Sprachpaket laden</button>
      </div>
    {:else if speech.status === 'installing'}
      <div class="sp-row">
        <progress class="sp-bar" max="1" value={speech.progress} aria-label="Sprachpaket wird geladen"></progress>
        <span class="num">{Math.round(speech.progress * 100)} %</span>
      </div>
    {:else}
      <div class="sp-row">
        <label class="sp-sw"><input type="checkbox" class="mini-switch" checked={speech.prefs.enabled} onchange={e => speech.setPrefs({ enabled: e.currentTarget.checked })} /> <span>Runden ansagen</span></label>
        <label class="sp-sw"><input type="checkbox" class="mini-switch" checked={speech.prefs.pause} onchange={e => speech.setPrefs({ pause: e.currentTarget.checked })} /> <span>Pause mit ansagen</span></label>
      </div>
      <div class="sp-row">
        <span class="muted sp-line" role="status">{speech.speaking ? 'spricht …' : `Bereit: ${speech.manifest?.name ?? 'Thorsten'}, läuft offline.`}</span>
        <span class="sp-btns">
          <button class="btn btn-sm" onclick={testSpeech} disabled={speech.speaking}><Icon name="play" size={13} /> Testen</button>
          <button class="btn btn-sm btn-ghost" onclick={() => speech.remove()}><Icon name="trash" size={14} /> Entfernen</button>
        </span>
      </div>
      {#if speech.error}<p class="alert alert-warning"><Icon name="warning" size={16} /> {speech.error}</p>{/if}
    {/if}
  </div>

  {#each kinds as k (k)}
    <div class="snd">
      <div class="snd-head">
        <strong>{SOUND_LABELS[k]}</strong>
        <small class="muted">{k === 'start' ? 'beim Start aus der vollen Zeit' : k === 'half' ? 'bei der Hälfte der Spielzeit' : 'zum Ablauf'}</small>
      </div>
      <div class="opts">
        <div class="seg">
          <button class:on={timer.sound.sources[k] === 'builtin'} onclick={() => setSource(k, 'builtin')}>Eingebaut</button>
          <button class:on={timer.sound.sources[k] === 'custom'} disabled={!timer.customNames[k]} onclick={() => setSource(k, 'custom')}>Eigene Datei</button>
          <button class:on={timer.sound.sources[k] === 'off'} onclick={() => setSource(k, 'off')}>Aus</button>
        </div>
        <button class="btn btn-sm" onclick={() => test(k)} disabled={timer.sound.sources[k] === 'off'}><Icon name="play" size={13} /> Testen</button>
      </div>
      <div class="file">
        <label class="btn btn-sm btn-ghost">
          <Icon name="upload" size={14} /> {timer.customNames[k] ? 'Andere Datei …' : 'Datei wählen …'}
          <input class="sr-only" type="file" accept="audio/*" onchange={e => upload(k, e.currentTarget)} />
        </label>
        {#if timer.customNames[k]}
          <span class="fname muted">{timer.customNames[k]}</span>
          <button class="btn btn-sm btn-ghost btn-icon" aria-label="Eigene Datei entfernen" onclick={() => remove(k)}><Icon name="trash" size={14} /></button>
        {/if}
      </div>
      {#if k === 'end'}
        <label class="offset">
          Schon <input class="input num" type="number" min="0" max="10" value={timer.sound.endOffset} onchange={e => timer.setSound({ endOffset: Number(e.currentTarget.value) })} /> Sekunden vor Ablauf abspielen
        </label>
      {/if}
    </div>
  {/each}

  {#snippet footer()}
    <button class="btn btn-primary" onclick={() => (ui.soundOpen = false)}>Fertig</button>
  {/snippet}
</Modal>

<style>
  .intro { margin: 0 0 14px; font-size: 14px; }
  .sp-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .sp-line { margin: 0; font-size: 13px; }
  .sp-btns { display: inline-flex; gap: 6px; }
  .sp-bar { flex: 1; height: 10px; accent-color: var(--accent); }
  .sp-sw { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
  code { font-size: 12px; }
  .vol { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .vol input { flex: 1; accent-color: var(--accent); }
  .snd { padding: 13px; border-radius: 13px; background: var(--surface-2); border: 1px solid var(--border); margin-bottom: 9px; display: flex; flex-direction: column; gap: 9px; }
  .snd-head { display: flex; flex-direction: column; }
  .opts { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .seg { display: inline-flex; padding: 3px; border-radius: 10px; background: var(--surface); border: 1px solid var(--border); }
  .seg button { border: 0; background: none; padding: 5px 11px; border-radius: 7px; font-weight: 600; font-size: 13px; color: var(--fg-muted); cursor: pointer; }
  .seg button.on { background: var(--accent); color: var(--accent-fg); }
  .seg button:disabled { opacity: 0.4; cursor: not-allowed; }
  .file { display: flex; align-items: center; gap: 6px; }
  .fname { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .offset { display: flex; align-items: center; gap: 8px; font-size: 14px; }
  .offset .input { width: 64px; min-height: 34px; text-align: center; }
</style>
