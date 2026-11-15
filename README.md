# Turniermanager 2

Badminton-Turniere im Browser: Auslosung, Felder, Timer mit Signalen, Rangliste,
Beamer-Großanzeige und Siegerehrung. Neubau der alten Einzeldatei-App (liegt in `legacy/`).

Live: https://buchstabenklau.ddns.net/turnier/ (nach dem ersten Aufruf auch offline nutzbar)

## Ablauf am Turniertag

1. **Vorbereitung:** Spielform wählen (Geübt + Gast, Mixed, freie Partner, feste Doppel, Einzel),
   Felder, geplante Runden, Spielzeit, Punkte ja/nein. Spieler eintippen oder eine Namensliste
   einfügen (eine Zeile pro Name). Mit **Turnier starten** wird das Format festgeschrieben.
2. **Beamer** öffnen (Knopf oder Taste `B`), Fenster auf den Beamer ziehen, dort `F` für Vollbild.
   Tasten `1`–`4`: Übersicht, Felder, Timer, Rangliste.
3. **Runde aufrufen** → Spieler gehen auf die Felder → `Leertaste` startet/pausiert den Timer.
4. Gewinnerseite antippen (oder Punkte eintragen). Die nächste Runde ist schon ausgelost und auf dem
   Beamer als „Als Nächstes“ zu sehen; Namen antippen zum Tauschen/Ersetzen, „Neu auslosen“ würfelt neu.
5. **Turnier beenden** → Siegerehrung mit Treppchen (auch auf dem Beamer). „Weiterspielen“ geht zurück.

`Strg+Z` macht jede Änderung rückgängig. Nachzügler unter **Spieler** nachmelden, Verletzte pausieren.

## Regeln der Auslosung

- Eine Runde = ein Timer-Durchgang, höchstens so viele Matches wie Felder.
- Wer weniger Spiele hat, spielt zuerst (innerhalb des Topfes). Nachzügler bekommen einen Ausgleich
  und holen verpasste Spiele nicht am Stück nach.
- Unter Gleichrangigen wird die Aufteilung gewählt, die am wenigsten Wiederholungen hat
  (gleicher Partner zählt 3, gleicher Gegner 1, zweimal hintereinander spielen 1).
- Rangliste: Siege, dann weniger Spiele, mit Punkten dann Punktdifferenz. Gleichstand = gleicher Platz.

## Entwicklung

```bash
npm install
npm run dev        # http://localhost:5180/turnier/
npm test           # Engine-Tests (Vitest)
npm run check      # Typprüfung
npm run e2e        # Browser-Tests (Playwright mit Google Chrome)
SHOTS=1 npx playwright test shots   # Bildschirmfotos nach test-results/shots/
```

Aufbau: `src/engine/` reine Logik (Auslosung, Rangliste, Import/Export, Aktionen), `src/lib/`
Speicher, Timer, Töne, `src/ui/` Steuerung, `src/beamer/` Großanzeige. Der Stand liegt im
`localStorage` (Schlüssel `turniermanager.v1.*`), eigene Töne in IndexedDB. Exporte der alten App
lassen sich importieren.

## Server

Einmalig: `npm run build`, dann `sudo bash deploy/install.sh` (legt `/var/www/turnier` an und
bindet `deploy/nginx-turnier.locations` in die Buchstabenklau-Site ein).
Updates danach ohne sudo: `bash deploy/publish.sh`.
