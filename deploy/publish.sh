#!/bin/bash
# Neue Version bauen und nach /var/www/turnier kopieren (ohne sudo, Verzeichnis gehört marc).
#   bash deploy/publish.sh
set -euo pipefail
cd "$(dirname "$0")/.."
WEBROOT="/var/www/turnier"
[ -w "$WEBROOT" ] || { echo "FEHLER: $WEBROOT fehlt oder ist nicht beschreibbar – zuerst: sudo bash deploy/install.sh" >&2; exit 1; }
npm test --silent
npm run build --silent
# erst neue Dateien, dann index.html und sw.js – so lädt nie eine Seite fehlende Assets
rsync -a --exclude index.html --exclude sw.js dist/ "$WEBROOT/"
rsync -a dist/index.html dist/sw.js "$WEBROOT/"
# alte Assets (älter als 30 Tage, nicht mehr verwendet) aufräumen
find "$WEBROOT/assets" -type f -mtime +30 -print0 | while IFS= read -r -d '' f; do
  grep -qF "$(basename "$f")" "$WEBROOT/sw.js" || rm -f "$f"
done
echo "Veröffentlicht: https://buchstabenklau.ddns.net/turnier/"
