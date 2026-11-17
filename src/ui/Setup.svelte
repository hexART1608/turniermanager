<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import * as A from '../engine/actions';
  import { checkStart } from '../engine/pairing';
  import { type Player, type Pool, type Settings, LIMITS, usesFixedTeams, usesPools } from '../engine/types';
  import { dialogs } from '../lib/dialog.svelte';
  import { store } from '../lib/store.svelte';
  import { formatClock, timer } from '../lib/timer.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { backupAvailable, importTournament, restoreBackup } from '../lib/ui.svelte';
  import Icon, { type IconName } from './Icon.svelte';
  import Stepper from './Stepper.svelte';

  const t = $derived(store.t);
  const s = $derived(t.settings);
  const pools = $derived(usesPools(s));
  const fixed = $derived(usesFixedTeams(s));
  const check = $derived(checkStart(t));
  const hasBackup = backupAvailable();

  type Preset = 'pools' | 'mixed' | 'random' | 'fixed' | 'singles';
  const presets: { id: Preset; icon: IconName; title: string; text: string; patch: Partial<Settings> }[] = [
    { id: 'pools', icon: 'users', title: 'Geübt + Gast', text: 'Jedes Doppel: ein Spieler aus Topf 1, einer aus Topf 2', patch: { discipline: 'doubles', pairing: 'pools', poolLabels: ['Geübte', 'Gäste'] } },
    { id: 'mixed', icon: 'users', title: 'Mixed', text: 'Jedes Doppel: eine Dame und ein Herr', patch: { discipline: 'doubles', pairing: 'pools', poolLabels: ['Damen', 'Herren'] } },
    { id: 'random', icon: 'shuffle', title: 'Doppel, freie Partner', text: 'Ein Topf, Partner wechseln jede Runde', patch: { discipline: 'doubles', pairing: 'random' } },
    { id: 'fixed', icon: 'lock', title: 'Feste Doppel', text: 'Teams bleiben das ganze Turnier zusammen', patch: { discipline: 'doubles', pairing: 'fixed' } },
    { id: 'singles', icon: 'pausePerson', title: 'Einzel', text: 'Eins gegen eins', patch: { discipline: 'singles' } },
  ];
  const preset = $derived<Preset>(
    s.discipline === 'singles' ? 'singles' : s.pairing === 'fixed' ? 'fixed' : s.pairing === 'random' ? 'random' : s.poolLabels[0] === 'Damen' && s.poolLabels[1] === 'Herren' ? 'mixed' : 'pools',
  );

  const update = (label: string, patch: Partial<Settings>) => store.run(label, x => A.updateSettings(x, patch));

  // ---------- Spieler eintragen ----------
  let inputs = $state<Record<Pool, string>>({ 1: '', 2: '' });

  function add(pool: Pool) {
    const raw = inputs[pool];
    if (!raw.trim()) return;
    if (/[\n,;\t]/.test(raw)) {
      let res: ReturnType<typeof A.addPlayers> | null = null;
      if (store.run('Spieler hinzufügen', x => (res = A.addPlayers(x, raw, pool)).t) && res) {
        const r = res as ReturnType<typeof A.addPlayers>;
        toasts.show(r.skipped.length ? 'warning' : 'success', `${r.added} Spieler hinzugefügt.${r.skipped.length ? `\nÜbersprungen (doppelt): ${r.skipped.join(', ')}` : ''}`);
      }
      inputs[pool] = '';
      return;
    }
    if (store.run('Spieler hinzufügen', x => A.addPlayer(x, raw, pool))) inputs[pool] = '';
  }

  function onPaste(e: ClipboardEvent, pool: Pool) {
    const text = e.clipboardData?.getData('text') ?? '';
    if (!/[\n,;\t]/.test(text.trim())) return;
    e.preventDefault();
    inputs[pool] = text;
    add(pool);
  }

  let editing = $state<number | null>(null);
  let editValue = $state('');
  function beginEdit(p: Player) { editing = p.id; editValue = p.name; }
  function commitEdit(p: Player) {
    if (editing !== p.id) return;
    editing = null;
    if (editValue.trim() && editValue.trim() !== p.name) store.run('Umbenennen', x => A.renamePlayer(x, p.id, editValue));
  }
  function focusSelect(el: HTMLInputElement) { el.focus(); el.select(); }

  const columns = $derived<{ pool: Pool; label: string; players: Player[] }[]>(
    pools
      ? [
          { pool: 1, label: s.poolLabels[0], players: t.players.filter(p => p.pool === 1) },
          { pool: 2, label: s.poolLabels[1], players: t.players.filter(p => p.pool === 2) },
        ]
      : [{ pool: 1, label: 'Spieler', players: t.players }],
  );

  function teamNo(p: Player): number | null {
    if (!fixed) return null;
    const active = t.players.filter(x => x.active);
    const i = active.findIndex(x => x.id === p.id);
    return i < 0 ? null : Math.floor(i / 2) + 1;
  }

  async function startTournament() {
    if (check.errors.length) return;
    const ok = await dialogs.confirm({
      title: 'Turnier starten?',
      text: `Format, Felder${s.scoreTracking ? ', Punkte-Erfassung' : ''} und ${pools ? 'Topf-Namen' : 'Paarungsart'} werden festgeschrieben und lassen sich danach nicht mehr ändern.\n\nSpieler können weiterhin nachgemeldet oder pausiert werden.`,
      confirm: 'Los geht’s',
    });
    if (ok) store.run('Turnier starten', x => A.start(x));
  }
</script>

<section class="setup">
  <div class="hero">
    <h1>Turnier einrichten</h1>
    <span class="lock-note"><Icon name="lock" size={14} /> Spielform, Felder und Punkte werden beim Start festgeschrieben</span>
    <div class="hero-actions">
      {#if hasBackup}
        <button class="btn btn-ghost btn-sm" onclick={restoreBackup}><Icon name="restart" size={16} /> Vorheriges Turnier</button>
      {/if}
      <button class="btn btn-ghost btn-sm" onclick={importTournament}><Icon name="upload" size={16} /> Importieren</button>
    </div>
  </div>

  <div class="grid">
    <!-- ---------- Format ---------- -->
    <div class="card format">
      <div class="f-row">
        <span class="step">1</span>
        <label class="field grow">
          <span class="eyebrow">Turniername</span>
          <input class="input name-input" value={s.name} maxlength={LIMITS.nameMax} onchange={e => update('Turniername', { name: e.currentTarget.value })} />
        </label>
        <div class="field"><span class="eyebrow">Felder</span><Stepper label="Felder" value={s.courts} min={LIMITS.courtsMin} max={LIMITS.courtsMax} onchange={v => update('Felder', { courts: v })} /></div>
        <div class="field"><span class="eyebrow">Runden</span><Stepper label="Runden" value={s.plannedRounds} min={LIMITS.roundsMin} max={LIMITS.roundsMax} onchange={v => update('Rundenzahl', { plannedRounds: v })} /></div>
        <div class="field"><span class="eyebrow">Spielzeit</span><Stepper label="Spielzeit" value={timer.data.duration} min={30} max={30 * 60} step={30} format={v => formatClock(v * 1000)} onchange={v => timer.setDuration(v)} /></div>
        <label class="field punkte" title="sonst nur Sieg/Niederlage">
          <span class="eyebrow">Punkte</span>
          <input type="checkbox" class="switch" aria-label="Punkte erfassen" checked={s.scoreTracking} onchange={e => update('Punkte erfassen', { scoreTracking: e.currentTarget.checked })} />
        </label>
      </div>

      <div class="f-row mode">
        <div class="presets" role="radiogroup" aria-label="Spielform">
          {#each presets as p (p.id)}
            <button role="radio" aria-checked={preset === p.id} class="preset" class:on={preset === p.id} title={p.text} onclick={() => update('Spielform', p.patch)}>
              <Icon name={p.icon} size={17} /> {p.title}
            </button>
          {/each}
        </div>
        <p class="preset-desc muted">{presets.find(p => p.id === preset)?.text}</p>
        {#if pools}
          <div class="pool-names" transition:fly={{ y: -6, duration: 150 }}>
            <span class="eyebrow">Töpfe</span>
            <input class="input" aria-label="Name Topf 1" value={s.poolLabels[0]} maxlength={LIMITS.nameMax} onchange={e => update('Topf-Name', { poolLabels: [e.currentTarget.value, s.poolLabels[1]] })} />
            <input class="input" aria-label="Name Topf 2" value={s.poolLabels[1]} maxlength={LIMITS.nameMax} onchange={e => update('Topf-Name', { poolLabels: [s.poolLabels[0], e.currentTarget.value] })} />
          </div>
        {/if}
      </div>
    </div>

    <!-- ---------- Spieler ---------- -->
    <div class="card players">
      <div class="players-head">
        <div class="ph">
          <span class="step">2</span>
          <h2>Spieler <span class="count num">{t.players.length}</span></h2>
        </div>
        <p class="hint muted"><Icon name="paste" size={15} /> Tipp: Eine ganze Namensliste einfügen (eine Zeile pro Name) legt alle auf einmal an.</p>
      </div>
      {#if fixed}
        <p class="alert alert-info"><Icon name="info" size={17} /> Feste Teams entstehen aus der Reihenfolge: 1.+2. Spieler, 3.+4. Spieler … Mit den Pfeilen umsortieren.</p>
      {/if}
      <div class="columns" class:two={pools}>
        {#each columns as col (col.pool)}
          <div class="col pool-{pools ? col.pool : 0}">
            <div class="col-head">
              <span class="col-title">{col.label}</span>
              <span class="chip num" class:chip-p1={pools && col.pool === 1} class:chip-p2={pools && col.pool === 2}>{col.players.filter(p => p.active).length}</span>
            </div>
            <form class="add" onsubmit={e => { e.preventDefault(); const field = e.currentTarget.querySelector('input'); add(col.pool); field?.focus(); }}>
              <input
                class="input"
                placeholder={pools ? `Name (${col.label}) + Enter` : 'Name + Enter'}
                aria-label="Neuer Spieler {col.label}"
                maxlength={2000}
                bind:value={inputs[col.pool]}
                onpaste={e => onPaste(e, col.pool)} />
              <button class="btn btn-primary btn-icon" aria-label="Hinzufügen" type="submit"><Icon name="plus" /></button>
            </form>
            <ul class="list">
              {#each col.players as p, i (p.id)}
                {@const team = teamNo(p)}
                <li class="player" class:paused={!p.active} class:team-start={fixed && team !== null && i > 0 && teamNo(col.players[i - 1]!) !== team} animate:flip={{ duration: 220 }} in:fly={{ y: -8, duration: 180 }}>
                  {#if fixed}
                    <span class="team-no num" title="Team {team ?? '–'}">{team ?? '–'}</span>
                  {/if}
                  {#if editing === p.id}
                    <input
                      class="input input-inline"
                      bind:value={editValue}
                      maxlength={LIMITS.nameMax}
                      use:focusSelect
                      onblur={() => commitEdit(p)}
                      onkeydown={e => { if (e.key === 'Enter') commitEdit(p); if (e.key === 'Escape') { editing = null; e.stopPropagation(); } }} />
                  {:else}
                    <button class="pname" title="Umbenennen" onclick={() => beginEdit(p)}>{p.name}</button>
                  {/if}
                  {#if !p.active}<span class="chip chip-warning">Pause</span>{/if}
                  <div class="row-actions">
                    {#if fixed}
                      <button class="btn btn-ghost btn-icon btn-sm" aria-label="Nach oben" disabled={i === 0} onclick={() => store.run('Reihenfolge', x => A.movePlayer(x, p.id, -1))}><Icon name="arrowUp" size={15} /></button>
                      <button class="btn btn-ghost btn-icon btn-sm" aria-label="Nach unten" disabled={i === col.players.length - 1} onclick={() => store.run('Reihenfolge', x => A.movePlayer(x, p.id, 1))}><Icon name="arrowDown" size={15} /></button>
                    {/if}
                    {#if pools}
                      <button class="btn btn-ghost btn-icon btn-sm" title="In „{s.poolLabels[col.pool === 1 ? 1 : 0]}“ verschieben" aria-label="Topf wechseln" onclick={() => store.run('Topf wechseln', x => A.setPool(x, p.id, col.pool === 1 ? 2 : 1))}><Icon name="swap" size={15} /></button>
                    {/if}
                    <button class="btn btn-ghost btn-icon btn-sm" title={p.active ? 'Nimmt nicht teil (Pause)' : 'Nimmt teil'} aria-label={p.active ? 'Pausieren' : 'Aktivieren'} onclick={() => store.run(p.active ? 'Pausieren' : 'Aktivieren', x => A.setActive(x, p.id, !p.active))}><Icon name={p.active ? 'pause' : 'play'} size={15} /></button>
                    <button class="btn btn-ghost btn-icon btn-sm del" aria-label="{p.name} entfernen" onclick={() => store.run('Spieler entfernen', x => A.removePlayer(x, p.id))}><Icon name="x" size={15} /></button>
                  </div>
                </li>
              {:else}
                <li class="empty muted">Noch niemand eingetragen</li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- ---------- Start ---------- -->
  <div class="startbar card">
    <div class="summary">
      <div class="facts">
        <span><strong class="num">{t.players.filter(p => p.active).length}</strong> Spieler</span>
        <span><strong class="num">{s.courts}</strong> {s.courts === 1 ? 'Feld' : 'Felder'}</span>
        {#if !check.errors.length}
          <span><strong class="num">{check.matchesPerRound * (s.discipline === 'singles' ? 2 : 4)}</strong> spielen pro Runde</span>
          <span><strong class="num">{check.sittingOut}</strong> pausieren</span>
        {/if}
      </div>
      {#each check.errors as e}<p class="msg err"><Icon name="warning" size={15} /> {e}</p>{/each}
      {#each check.warnings as w}<p class="msg warn"><Icon name="info" size={15} /> {w}</p>{/each}
    </div>
    <button class="btn btn-primary btn-lg" disabled={check.errors.length > 0} onclick={startTournament}>
      <Icon name="whistle" size={20} /> Turnier starten
    </button>
  </div>
</section>

<style>
  .setup { display: flex; flex-direction: column; gap: 12px; }
  .hero { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
  .hero h1 { font-size: clamp(26px, 3vw, 34px); font-weight: 800; }
  .hero-actions { display: flex; gap: 6px; }
  .hero .lock-note { margin-left: auto; }
  @media (max-width: 899px) { .hero .lock-note { display: none; } }
  .grid { display: flex; flex-direction: column; gap: 12px; flex: 1; min-height: 0; }

  .format { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; flex: none; }
  .f-row { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
  .f-row.mode { align-items: center; gap: 10px 16px; padding-top: 12px; border-top: 1px solid var(--border); }
  .step { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 9px; background: var(--accent); color: var(--accent-fg); font-weight: 800; font-size: 14px; flex: none; align-self: flex-end; margin-bottom: 8px; }
  .field { display: flex; flex-direction: column; gap: 5px; }
  .field.grow { flex: 1; min-width: 200px; }
  .name-input { font-family: var(--font-display); font-size: 19px; font-weight: 700; min-height: 44px; }
  .format :global(.stepper output) { min-width: 46px; font-size: 19px; }
  .punkte { align-items: center; }
  .presets { display: flex; gap: 6px; flex-wrap: wrap; }
  .preset {
    display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; border-radius: 10px; cursor: pointer;
    background: var(--surface-2); border: 1px solid var(--border); color: var(--fg-muted); font-weight: 600; font-size: 14px;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .preset:hover { border-color: var(--border-strong); color: var(--fg); }
  .preset.on { border-color: var(--accent); background: var(--accent-soft); color: var(--fg); }
  .preset.on :global(svg) { color: var(--accent); }
  .preset-desc { margin: 0; font-size: 13px; flex: 1; min-width: 160px; line-height: 1.3; }
  .pool-names { display: flex; align-items: center; gap: 6px; }
  .pool-names .input { width: 120px; min-height: 36px; }
  .lock-note { display: inline-flex; gap: 6px; align-items: center; font-size: 12px; color: var(--fg-faint); }

  .switch { appearance: none; width: 46px; height: 27px; border-radius: 999px; background: var(--surface-3); border: 1px solid var(--border-strong); position: relative; cursor: pointer; transition: background 0.2s; flex: none; }
  .switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 21px; height: 21px; border-radius: 50%; background: var(--fg-muted); transition: transform 0.2s var(--ease), background 0.2s; }
  .switch:checked { background: var(--accent); border-color: transparent; }
  .switch:checked::after { transform: translateX(19px); background: var(--accent-fg); }

  .players { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; min-height: 260px; flex: 1; }
  .ph { display: flex; align-items: center; gap: 10px; }
  .ph .step { margin: 0; align-self: center; }
  .players-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
  .players-head { align-items: center; }
  .players-head h2 { font-size: 24px; display: flex; align-items: center; gap: 10px; }
  .count { font-size: 18px; padding: 2px 10px; border-radius: 999px; background: var(--surface-3); color: var(--fg-muted); }
  .hint { display: flex; gap: 7px; align-items: center; margin: 0; font-size: 13px; }
  .columns { display: grid; gap: 12px; flex: 1; min-height: 0; }
  .columns.two { grid-template-columns: 1fr 1fr; }
  @media (max-width: 640px) { .columns.two { grid-template-columns: 1fr; } }
  .col { display: flex; flex-direction: column; gap: 8px; padding: 10px; min-height: 0; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--border); }
  .col.pool-1 { border-top: 3px solid var(--team-a); }
  .col.pool-2 { border-top: 3px solid var(--team-b); }
  .col-head { display: flex; justify-content: space-between; align-items: center; padding: 0 2px; }
  .col-title { font-family: var(--font-display); font-weight: 700; font-size: 20px; }
  .add { display: flex; gap: 6px; }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; flex: 1; min-height: 0; }
  .player {
    display: flex; align-items: center; gap: 8px; min-height: 42px;
    padding: 3px 4px 3px 10px; border-radius: 10px; background: var(--surface);
    border: 1px solid transparent;
  }
  .player:hover { border-color: var(--border); }
  .player.paused .pname { color: var(--fg-faint); text-decoration: line-through; }
  .player.team-start { margin-top: 8px; }
  .team-no { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; background: var(--accent-soft); color: var(--accent); font-weight: 700; font-size: 13px; flex: none; }
  .pname { flex: 1; min-width: 0; text-align: left; background: none; border: 0; padding: 4px 0; cursor: text; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .input-inline { min-height: 34px; flex: 1; }
  .row-actions { display: flex; gap: 1px; opacity: 0.55; transition: opacity 0.15s; }
  .player:hover .row-actions, .player:focus-within .row-actions { opacity: 1; }
  .del:hover { color: var(--danger); }
  .empty { padding: 18px 10px; text-align: center; font-size: 14px; }

  .startbar {
    flex: none;
    display: flex; align-items: center; justify-content: space-between; gap: 18px;
    padding: 10px 14px 10px 18px;
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    backdrop-filter: blur(12px);
    box-shadow: var(--shadow-pop);
  }
  .summary { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .facts { display: flex; gap: 18px; flex-wrap: wrap; color: var(--fg-muted); }
  .facts strong { color: var(--fg); font-family: var(--font-display); font-size: 22px; margin-right: 3px; }
  .msg { display: flex; gap: 7px; align-items: center; margin: 0; font-size: 13.5px; font-weight: 500; }
  .err { color: var(--danger); }
  .warn { color: var(--warning); }
  .facts strong { font-size: 19px; }
  /* Desktop: alles auf einer Seite, nur die Spielerlisten scrollen */
  @media (min-width: 900px) and (min-height: 620px) {
    .setup { height: calc(100dvh - 132px); }
  }
  @media (max-width: 899px), (max-height: 619px) {
    .list { overflow: visible; }
    .startbar { position: sticky; bottom: 14px; z-index: 10; }
  }
  @media (max-width: 700px) { .startbar { flex-direction: column; align-items: stretch; } .lock-note { margin-left: 0; } }
</style>
