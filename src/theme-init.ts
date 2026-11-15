// Läuft vor dem ersten Zeichnen: gespeichertes Farbschema setzen (kein Aufblitzen).
import { KEYS } from './lib/storage';

try {
  const t = localStorage.getItem(KEYS.theme);
  const beamer = location.hash.startsWith('#/beamer');
  document.documentElement.dataset.theme = !beamer && t === '"light"' ? 'light' : 'dark';
} catch {
  /* Standard bleibt dunkel */
}
