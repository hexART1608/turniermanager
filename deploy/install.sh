#!/bin/bash
# Turniermanager unter https://buchstabenklau.ddns.net/turnier/ einrichten (einmalig).
#   sudo bash deploy/install.sh
# Nutzt Zertifikat und Site von Buchstabenklau (include-Zeile für
# /etc/nginx/buchstabenklau-extra/*.locations ist dort schon vorhanden).
# Bei einem Fehler im nginx-Test wird die Änderung zurückgenommen.
set -euo pipefail
OWNER="marc"
WEBROOT="/var/www/turnier"
SITE="/etc/nginx/sites-available/buchstabenklau"
EXTRA_DIR="/etc/nginx/buchstabenklau-extra"
SNIPPET="$EXTRA_DIR/turnier.locations"
DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$(dirname "$DIR")"
die() { echo "FEHLER: $*" >&2; exit 1; }
[ "$(id -u)" = 0 ] || die "Bitte mit sudo ausführen."
[ -f "$SITE" ] || die "$SITE fehlt – läuft Buchstabenklau auf diesem Rechner?"
grep -q "buchstabenklau-extra/\*.locations" "$SITE" || die "In $SITE fehlt die include-Zeile für $EXTRA_DIR (siehe feuerhimmel/deploy/install.sh)."

echo "1. Webverzeichnis $WEBROOT (Besitzer $OWNER)"
install -d -o "$OWNER" -g www-data -m 755 "$WEBROOT"

echo "2. Erste Veröffentlichung (aus dist/, vorher als $OWNER: npm run build)"
[ -f "$PROJECT/dist/index.html" ] || die "$PROJECT/dist fehlt – zuerst als $OWNER: npm run build"
sudo -u "$OWNER" rsync -a "$PROJECT/dist/" "$WEBROOT/"
[ -f "$WEBROOT/index.html" ] || die "index.html fehlt in $WEBROOT"

echo "3. nginx"
BACKUP=""
[ -f "$SNIPPET" ] && { BACKUP="$(mktemp)"; cp -a "$SNIPPET" "$BACKUP"; }
install -o root -g root -m 0644 "$DIR/nginx-turnier.locations" "$SNIPPET"
if ! nginx -t; then
  if [ -n "$BACKUP" ]; then cp -a "$BACKUP" "$SNIPPET"; else rm -f "$SNIPPET"; fi
  die "nginx-Test fehlgeschlagen, Änderung zurückgenommen."
fi
systemctl reload nginx
echo "Fertig: https://buchstabenklau.ddns.net/turnier/"
echo "Spätere Updates ohne sudo: bash deploy/publish.sh"
