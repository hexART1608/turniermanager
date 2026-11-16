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
    <div>
      <p class="eyebrow">Vorbereitung</p>
      <h1>Turnier einrichten</h1>
    </div>
    <div class="hero-actions">
      {#if hasBackup}
        <button class="btn btn-ghost" onclick={restoreBackup}><Icon name="restart" /> Vorheriges Turnier</button>
      {/if}
      <button class="btn btn-ghost" onclick={importTournament}><Icon name="upload" /> Importieren</button>
    </div>
  </div>

  <div class="grid">
    <!-- ---------- Format ---------- -->
    <div class="card format">
      <div class="format-head">
        <p class="eyebrow">Schritt 1 von 2</p>
        <h2>Turnier festlegen</h2>
      </div>
      <div class="format-body">
      <div class="format-left">
      <label class="field">
        <span class="eyebrow">Turniername</span>
        <input class="input name-input" value={s.name} maxlength={LIMITS.nameMax} onchange={e => update('Turniername', { name: e.currentTarget.value })} />
      </label>

      <div class="field">
        <span class="eyebrow">Spielform</span>
        <div class="presets" role="radiogroup" aria-label="Spielform">
          {#each presets as p (p.id)}
            <button role="radio" aria-checked={preset === p.id} class="preset" class:on={preset === p.id} onclick={() => update('Spielform', p.patch)}>
              <span class="p-icon"><Icon name={p.icon} size={20} /></span>
              <span class="p-text"><strong>{p.title}</strong><small>{p.text}</small></span>
              <span class="p-dot"></span>
            </button>
          {/each}
        </div>
      </div>

      {#if pools}
        <div class="field" transition:fly={{ y: -6, duration: 150 }}>
          <span class="eyebrow">Namen der Töpfe</span>
          <div class="pool-names">
            <input class="input" aria-label="Name Topf 1" value={s.poolLabels[0]} maxlength={LIMITS.nameMax} onchange={e => update('Topf-Name', { poolLabels: [e.currentTarget.value, s.poolLabels[1]] })} />
            <input class="input" aria-label="Name Topf 2" value={s.poolLabels[1]} maxlength={LIMITS.nameMax} onchange={e => update('Topf-Name', { poolLabels: [s.poolLabels[0], e.currentTarget.value] })} />
          </div>
        </div>
      {/if}

      </div>
      <div class="format-right">
      <div class="rows">
        <div class="row">
          <div><strong>Felder</strong><small class="muted">Matches gleichzeitig</small></div>
          <Stepper label="Felder" value={s.courts} min={LIMITS.courtsMin} max={LIMITS.courtsMax} onchange={v => update('Felder', { courts: v })} />
        </div>
        <div class="row">
          <div><strong>Geplante Runden</strong><small class="muted">später noch änderbar</small></div>
          <Stepper label="Runden" value={s.plannedRounds} min={LIMITS.roundsMin} max={LIMITS.roundsMax} onchange={v => update('Rundenzahl', { plannedRounds: v })} />
        </div>
        <div class="row">
          <div><strong>Spielzeit</strong><small class="muted">pro Runde, später noch änderbar</small></div>
          <Stepper label="Spielzeit" value={timer.data.duration} min={30} max={30 * 60} step={30} format={v => formatClock(v * 1000)} onchange={v => timer.setDuration(v)} />
        </div>
        <label class="row toggle-row">
          <div><strong>Punkte erfassen</strong><small class="muted">sonst nur Sieg/Niederlage</small></div>
          <input type="checkbox" class="switch" checked={s.scoreTracking} onchange={e => update('Punkte erfassen', { scoreTracking: e.currentTarget.checked })} />
        </label>
      </div>
      <p class="lock-note"><Icon name="lock" size={15} /> Spielform, Felder und Punkte-Erfassung werden beim Start festgeschrieben.</p>
      </div>
      </div>
    </div>

    <!-- ---------- Spieler ---------- -->
    <div class="card players">
      <div class="players-head">
        <div>
          <p class="eyebrow">Schritt 2 von 2</p>
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
  .setup { display: flex; flex-direction: column; gap: 18px; }
  .hero { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; padding: 6px 2px 0; }
  .hero h1 { font-size: clamp(34px, 4vw, 48px); font-weight: 800; }
  .hero-actions { display: flex; gap: 6px; }
  .grid { display: flex; flex-direction: column; gap: 18px; }
  .format-head h2 { font-size: 30px; }
  .format-body { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr); gap: 28px; align-items: start; }
  .format-left, .format-right { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
  .format-right .rows { border-top: 0; }
  .format-right .row:first-child { padding-top: 0; }
  @media (max-width: 900px) { .format-body { grid-template-columns: 1fr; gap: 20px; } }

  .format { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
  .field { display: flex; flex-direction: column; gap: 9px; }
  .name-input { font-family: var(--font-display); font-size: 21px; font-weight: 700; min-height: 48px; }
  .presets { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px; }
  .preset {
    display: flex; align-items: center; gap: 12px; text-align: left;
    padding: 11px 13px; border-radius: 13px; cursor: pointer;
    background: var(--surface-2); border: 1px solid var(--border);
    transition: border-color 0.15s, background 0.15s, transform 0.12s;
  }
  .preset:hover { border-color: var(--border-strong); }
  .preset.on { border-color: var(--accent); background: linear-gradient(90deg, var(--accent-soft), transparent 80%), var(--surface-2); }
  .p-icon { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 10px; background: var(--surface-3); color: var(--fg-muted); flex: none; }
  .on .p-icon { background: var(--accent); color: var(--accent-fg); }
  .p-text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .p-text strong { font-size: 15px; }
  .p-text small { color: var(--fg-muted); font-size: 13px; }
  .p-dot { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--border-strong); flex: none; }
  .on .p-dot { border: 5px solid var(--accent); }
  .pool-names { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .rows { display: flex; flex-direction: column; border-top: 1px solid var(--border); }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
  .row > div:first-child { display: flex; flex-direction: column; }
  .toggle-row { cursor: pointer; }
  .lock-note { display: flex; gap: 8px; align-items: center; margin: 0; font-size: 13px; color: var(--fg-muted); }

  .switch { appearance: none; width: 46px; height: 27px; border-radius: 999px; background: var(--surface-3); border: 1px solid var(--border-strong); position: relative; cursor: pointer; transition: background 0.2s; flex: none; }
  .switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 21px; height: 21px; border-radius: 50%; background: var(--fg-muted); transition: transform 0.2s var(--ease), background 0.2s; }
  .switch:checked { background: var(--accent); border-color: transparent; }
  .switch:checked::after { transform: translateX(19px); background: var(--accent-fg); }

  .players { padding: 20px; display: flex; flex-direction: column; gap: 14px; min-height: 420px; }
  .players-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
  .players-head h2 { font-size: 30px; display: flex; align-items: center; gap: 10px; }
  .count { font-size: 18px; padding: 2px 10px; border-radius: 999px; background: var(--surface-3); color: var(--fg-muted); }
  .hint { display: flex; gap: 7px; align-items: center; margin: 0; font-size: 13px; }
  .columns { display: grid; gap: 14px; }
  .columns.two { grid-template-columns: 1fr 1fr; }
  @media (max-width: 640px) { .columns.two { grid-template-columns: 1fr; } }
  .col { display: flex; flex-direction: column; gap: 9px; padding: 12px; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--border); }
  .col.pool-1 { border-top: 3px solid var(--team-a); }
  .col.pool-2 { border-top: 3px solid var(--team-b); }
  .col-head { display: flex; justify-content: space-between; align-items: center; padding: 0 2px; }
  .col-title { font-family: var(--font-display); font-weight: 700; font-size: 20px; }
  .add { display: flex; gap: 6px; }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
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
    position: sticky; bottom: 14px; z-index: 10;
    display: flex; align-items: center; justify-content: space-between; gap: 18px;
    padding: 14px 16px 14px 20px;
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
  @media (max-width: 700px) { .startbar { flex-direction: column; align-items: stretch; } }
</style>
