<script lang="ts">
  import { fly } from 'svelte/transition';
  import * as A from '../engine/actions';
  import { sittingOut } from '../engine/ranking';
  import { teamSize } from '../engine/types';
  import { dialogs } from '../lib/dialog.svelte';
  import { store } from '../lib/store.svelte';
  import { timer } from '../lib/timer.svelte';
  import { toasts } from '../lib/toast.svelte';
  import Icon from './Icon.svelte';
  import MatchCard from './MatchCard.svelte';
  import ResultsTable from './ResultsTable.svelte';
  import { ui } from '../lib/ui.svelte';

  const t = $derived(store.t);
  const current = $derived(t.rounds[t.rounds.length - 1]);
  const draft = $derived(t.draft);
  const nextNo = $derived(t.rounds.length + 1);
  const planned = $derived(t.settings.plannedRounds);
  const openResults = $derived(current ? current.matches.filter(m => !m.winner).length : 0);
  const restingNow = $derived(current ? sittingOut(t, current) : []);
  const restingNext = $derived(draft ? sittingOut(t, draft) : []);
  const problems = $derived(A.draftProblems(t));
  const canAddMatch = $derived(!!draft && draft.matches.length < t.settings.courts && restingNext.length >= 2 * teamSize(t.settings));
  // Felder der laufenden Runde: 1–2 nebeneinander, 3–4 in zwei Spalten, mehr in 3–4 Spalten
  const nMatches = $derived(current?.matches.length ?? 1);
  const decided = $derived(nMatches - openResults);
  const cols = $derived(nMatches <= 2 ? Math.max(1, nMatches) : nMatches <= 4 ? 2 : nMatches <= 9 ? 3 : 4);
  const rows = $derived(Math.max(1, Math.ceil(nMatches / cols)));
  const planMode = $derived(t.plan !== null);
  const done = $derived(A.planDone(t));
  const lastRound = $derived(planMode && !done && t.plan!.length === 0);
  const reachedPlan = $derived(!planMode && t.rounds.length >= planned);
  // alles vor der aktuellen Runde, neueste zuerst; nur die letzten 3 hier, der Rest im Verlauf
  const earlier = $derived(t.rounds.slice(0, -1).reverse());
  const SHOWN = 2;

  async function callNext() {
    const notes: string[] = [];
    if (openResults) notes.push(`In Runde ${current!.no} ${openResults === 1 ? 'fehlt noch 1 Ergebnis' : `fehlen noch ${openResults} Ergebnisse`} (kann später im Verlauf nachgetragen werden).`);
    if (timer.data.running) notes.push('Der Timer läuft noch und wird zurückgesetzt.');
    if (notes.length) {
      const ok = await dialogs.confirm({ title: `Runde ${nextNo} starten?`, text: notes.join('\n\n'), confirm: 'Starten' });
      if (!ok) return;
    }
    if (store.run(`Runde ${nextNo} starten`, x => A.callRound(x))) {
      timer.reset();
      (document.activeElement as HTMLElement | null)?.blur();
      toasts.show('success', `Runde ${nextNo} ist auf den Feldern. Leertaste startet den Timer.`);
    }
  }
</script>

<div class="board">
  {#if current}
    <section class="block now">
      <div class="block-head">
        <div>
          <span class="eyebrow live-label"><span class="live"></span> Jetzt auf den Feldern</span>
          <h2>Runde {current.no}</h2>
        </div>
        <span class="status" role="status" aria-live="polite">
          {#if openResults}
            <span class="chip chip-warning">{decided} von {nMatches} {nMatches === 1 ? 'Ergebnis' : 'Ergebnissen'} erfasst</span>
          {:else}
            <span class="chip chip-success"><Icon name="check" size={13} /> alle {nMatches} {nMatches === 1 ? 'Ergebnis' : 'Ergebnisse'} erfasst</span>
          {/if}
        </span>
      </div>
      <div class="courts" style:--cols={cols} style:--rows={rows}>
        {#each current.matches as m, i (current.no * 100 + m.court)}
          <div in:fly={{ y: 20, duration: 300, delay: i * 60 }}>
            <MatchCard {t} match={m} idx={i} roundRef={{ kind: 'round', no: current.no }} mode="result" live />
          </div>
        {/each}
      </div>
      {#if restingNow.length}
        <p class="resting"><Icon name="pausePerson" size={15} /> <span class="muted">Pause:</span> {restingNow.map(p => p.name).join(' · ')}</p>
      {/if}
    </section>
  {/if}

  <div class="lower" class:solo={!current || !earlier.length}>
  {#if done}
  <section class="block next done">
    <div class="block-head"><div><span class="eyebrow">Spielplan</span><h2>Alle Paarungen sind gespielt</h2></div></div>
    <p class="alert alert-info"><Icon name="flag" size={17} /> {t.settings.poolLabels[0]} und {t.settings.poolLabels[1]} haben alle miteinander gespielt. Das Turnier endet, sobald die Ergebnisse der letzten Runde eingetragen sind.</p>
  </section>
  {:else}
  <section class="block next" class:first={!current}>
    <div class="block-head">
      <div>
        <span class="eyebrow">{current ? (lastRound ? 'Als Nächstes · letzte Runde' : 'Als Nächstes') : 'Bereit'}</span>
        <h2>Runde {nextNo}{#if draft?.edited} <span class="chip chip-accent">von Hand angepasst</span>{/if}</h2>
      </div>
      <div class="next-tools">
        <button class="btn btn-sm" title={planMode ? 'Alle noch nicht gestarteten Runden neu auslosen' : 'Nächste Runde neu auslosen'} onclick={() => store.run('Neu auslosen', x => A.reroll(x))}><Icon name="shuffle" size={15} /> Neu auslosen</button>
        {#if canAddMatch}
          <button class="btn btn-sm" onclick={() => store.run('Match hinzufügen', x => A.addDraftMatch(x))}><Icon name="plus" size={15} /> Match</button>
        {/if}
        <button class="btn btn-primary" class:ready={current && !openResults} disabled={problems.length > 0} onclick={callNext}>
          <Icon name="megaphone" size={18} /> Runde {nextNo} starten
        </button>
      </div>
    </div>

    {#if reachedPlan}
      <p class="alert alert-info"><Icon name="flag" size={17} /> Die geplanten {planned} Runden sind gespielt. Du kannst weitere Runden starten oder das Turnier beenden.</p>
    {/if}
    {#each problems as p}<p class="alert alert-warning"><Icon name="warning" size={17} /> {p}</p>{/each}

    {#if draft && draft.matches.length}
      <div class="courts">
        {#each draft.matches as m, i (m.court)}
          <div in:fly={{ y: 12, duration: 250, delay: i * 50 }}>
            <MatchCard {t} match={m} idx={i} roundRef={{ kind: 'draft' }} mode="draft" size="sm" />
          </div>
        {/each}
      </div>
      {#if restingNext.length}
        <p class="resting"><Icon name="pausePerson" size={15} /> <span class="muted">Pause:</span> {restingNext.map(p => p.name).join(' · ')}</p>
      {/if}
    {/if}

    <p class="faint hint-names">Namen antippen zum Tauschen oder Ersetzen.</p>
  </section>
  {/if}

  {#if earlier.length}
    <section class="card earlier">
      <div class="block-head">
        <h2>Bereits gespielt <span class="faint hint">Team antippen = Sieger ändern</span></h2>
        <button class="btn btn-sm" onclick={() => (ui.tab = 'history')}>
          {earlier.length > SHOWN ? `Alle ${earlier.length} Runden im Verlauf` : 'Im Verlauf bearbeiten'} <Icon name="chevronRight" size={14} />
        </button>
      </div>
      <ResultsTable {t} rounds={earlier.slice(0, SHOWN)} compact
        onscore={(no, i, a, b) => store.run('Ergebnis ändern', x => A.setScore(x, no, i, a, b))}
        onwinner={(no, i, side) => {
          const w = t.rounds.find(x => x.no === no)?.matches[i]?.winner ?? null;
          const next = w === side ? null : side;
          store.run(next ? 'Sieger eintragen' : 'Ergebnis löschen', x => A.setWinner(x, no, i, next));
        }} />
    </section>
  {/if}
  </div>
</div>

<style>
  .earlier { padding: 10px 14px; display: flex; flex-direction: column; gap: 6px; }
  .earlier h2 { font-size: 20px; }
  .hint { font-size: 12.5px; font-weight: 500; margin-left: 8px; }
  .board { display: flex; flex-direction: column; gap: 12px; }

  .now { min-width: 0; }
  .lower { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 14px; align-items: start; }
  .lower.solo { grid-template-columns: minmax(0, 1fr); }
  @media (max-width: 1100px) { .lower { grid-template-columns: minmax(0, 1fr); } }
  /* Felder nebeneinander. Breite je Karte: Feldbild (Seitenverhältnis 1364:634) + ca. 100px für Kopf und Hinweis;
     die Höhe ergibt sich aus dem Viewport abzüglich Kopf, Tabs, Titel und dem Bereich darunter (580px). */
  .now .courts {
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    --card: max(300px, calc(((100vh - 580px) / var(--rows) - 100px) * 2.15 + 24px));
    width: min(100%, calc(var(--cols) * var(--card) + (var(--cols) - 1) * 12px));
    margin-inline: auto;
  }
  @media (max-width: 700px) { .now .courts { grid-template-columns: minmax(0, 1fr); width: 100%; } }
  .status { display: inline-flex; align-items: center; }
  .btn.ready { box-shadow: 0 0 0 4px var(--accent-soft); }
  .next .courts { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
  .block { display: flex; flex-direction: column; gap: 8px; }
  .block-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
  .block-head h2 { font-size: 28px; font-weight: 800; display: flex; align-items: center; gap: 10px; }
  .live-label { display: inline-flex; align-items: center; gap: 8px; color: var(--accent); }
  .live { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: live 1.8s infinite; }
  @keyframes live { 0% { box-shadow: 0 0 0 0 var(--accent-glow); } 70% { box-shadow: 0 0 0 9px transparent; } }
  .courts { display: grid; gap: 12px; }
  .next .courts { gap: 8px; }
  .next .block-head h2 { font-size: 20px; }
  @media (max-width: 500px) { .courts { grid-template-columns: 1fr; } }
  .resting { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0; font-size: 14px; }
  .next {
    padding: 10px 12px; border-radius: calc(var(--radius) + 4px);
    border: 1px dashed var(--border-strong); background: color-mix(in srgb, var(--surface) 50%, transparent);
  }
  .next.first { border-style: solid; border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
  .next-tools { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .hint-names { margin: 0; font-size: 13px; }
</style>
