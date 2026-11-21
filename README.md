# Turniermanager 2

Badminton-Turniere im Browser: Auslosung, Felder, Timer mit Signalen, Rangliste,
Beamer-Großanzeige und Siegerehrung. Neubau der alten Einzeldatei-App.

Live: https://buchstabenklau.ddns.net/turnier/ (nach dem ersten Aufruf auch offline nutzbar)

**Ausführliche Anleitung mit allen Funktionen: [docs/ANLEITUNG.md](docs/ANLEITUNG.md)**

## Ablauf am Turniertag

1. **Vorbereitung:** Spielform wählen (Geübt + Gast, Mixed, freie Partner, feste Doppel, Einzel),
   Felder, geplante Runden, Spielzeit, Punkte ja/nein. Spieler eintippen oder eine Namensliste
   einfügen (eine Zeile pro Name). Mit **Turnier starten** wird das Format festgeschrieben.
2. **Beamer** öffnen (Knopf oder Taste `B`), Fenster auf den Beamer ziehen, dort `F` für Vollbild.
   Tasten `1`–`4`: Übersicht, Felder, Timer, Rangliste.
3. **Runde starten** → Spieler gehen auf die Felder → `Leertaste` startet/pausiert den Timer.
4. Gewinnerseite antippen (oder Punkte eintragen). Die nächste Runde ist schon ausgelost und auf dem
   Beamer als „Als Nächstes“ zu sehen; Namen antippen zum Tauschen/Ersetzen, „Neu auslosen“ würfelt neu.
5. **Turnier beenden** → Siegerehrung mit Treppchen (auch auf dem Beamer). „Weiterspielen“ geht zurück.

**Musik** (Knopf in der Kopfleiste oder Taste `M`): Ordner mit MP3s wählen oder einzelne Titel
hinzufügen, die Dateien bleiben auf dem Laptop. Die Musik läuft durch und wird bei jedem Signal
(Start, Halbzeit, Ende, Testton) automatisch leiser, danach wieder lauter. Das Fenster lässt sich
verschieben, auf einen Mini-Player verkleinern und schließen, die Musik spielt weiter.

### Spotify

Im Musikfenster ist zusätzlich ein vollständiger Spotify-Connect-Player vorhanden. Er wird nur
bei Internetverbindung aktiviert und kann im Browser selbst oder auf einem bereits aktiven
Spotify-Connect-Gerät abspielen. Dafür ist Spotify Premium erforderlich.

Einmalig im [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) eine App
anlegen und in deren Redirect-URI-Whitelist die im Musikfenster angezeigte Adresse (exakt,
inklusive abschließendem `/`) eintragen. Anschließend die **Client-ID** (kein Client-Secret) im
Musikfenster einfügen und sich anmelden. Für die lokale Vite-Entwicklung ist üblicherweise
`http://127.0.0.1:5173/` die Redirect-URI. Alternativ kann beim Build
`VITE_SPOTIFY_CLIENT_ID` gesetzt werden.

Neue Spotify-Apps laufen zunächst im Development Mode: Der App-Inhaber braucht Premium und
höchstens fünf explizit freigeschaltete Spotify-Konten dürfen die App verwenden. Die Konten
lassen sich im Dashboard unter **Users Management** hinzufügen.

Die Spotify-Wiedergabe kann aus Browser-Sicherheitsgründen nicht automatisch bei den
Turniersignalen abgesenkt werden; dafür bitte die lokale Musikfunktion verwenden.
Nach dem Neuladen braucht ein Ordner einmal „Freigeben“ (Browser-Sicherheit), einzelne Titel
sind sofort da. Ordner-Auswahl gibt es in Chrome/Edge; in anderen Browsern gilt ein Ordner nur
bis zum Schließen der Seite.

`Strg+Z` macht jede Änderung rückgängig. Nachzügler unter **Spieler** nachmelden, Verletzte pausieren.

### Sprachansage (optional)

Die Ansage der Runden („Runde 3. Feld 1: Anne und Finn gegen …“) nutzt kein Browser-TTS, sondern
ein eigenes Sprachpaket: [Piper](https://github.com/rhasspy/piper) mit der Stimme „Thorsten“
(Datensatz CC0) als ONNX-Modell, dazu espeak-ng als WebAssembly (GPL-3.0) für die Aussprache.
Die Dateien (ca. 93 MB) liegen nicht im Repository. Bereitstellen:

```bash
npm run voice:fetch   # lädt/kopiert alles nach public/voices/ (nicht im Git)
bash deploy/publish.sh
```

In den Einstellungen („Töne & Timer-Signale“) lädt jeder Browser das Paket einmal mit Internet und
speichert es; danach läuft die Ansage offline. Auf dem Server braucht die Content-Security-Policy
`'wasm-unsafe-eval'` und die MIME-Typen `application/wasm`/`application/json` (beides steht in
`deploy/nginx-turnier.locations`; nach einer Änderung `sudo bash deploy/install.sh`).

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

## Lizenz

[MIT](LICENSE)
