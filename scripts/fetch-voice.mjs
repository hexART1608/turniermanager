// Sprachpaket für die Sprachansage bereitstellen: npm run voice:fetch
// Legt public/voices/ an (nicht im Git, ca. 92 MB): Piper-Engine (WebAssembly), ONNX-Laufzeit
// und die Stimme „Thorsten“ (de_DE-thorsten-medium, Datensatz CC0). Die App lädt die Dateien
// erst, wenn jemand in den Einstellungen „Sprachpaket laden“ wählt.
import { createHash } from 'node:crypto';
import { copyFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'voices');
const VOICE = 'de_DE-thorsten-medium';
const HF = 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main/de/de_DE/thorsten/medium';
mkdirSync(join(out, 'ort'), { recursive: true });

const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const files = [];
const add = name => files.push({ name, size: statSync(join(out, name)).size, sha256: sha(join(out, name)) });

// ONNX-Laufzeit (ohne Threads, braucht keine Cross-Origin-Isolation)
copyFileSync(join(root, 'node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm'), join(out, 'ort/ort-wasm-simd.wasm'));
add('ort/ort-wasm-simd.wasm');

// Phonemizer (espeak-ng als WebAssembly); die JS-Datei wird zum ES-Modul gemacht
const piper = join(root, 'node_modules/@diffusionstudio/piper-wasm/build');
copyFileSync(join(piper, 'piper_phonemize.wasm'), join(out, 'piper_phonemize.wasm'));
copyFileSync(join(piper, 'piper_phonemize.data'), join(out, 'piper_phonemize.data'));
writeFileSync(join(out, 'piper_phonemize.js'), readFileSync(join(piper, 'piper_phonemize.js'), 'utf8') + '\nexport default createPiperPhonemize;\n');
for (const f of ['piper_phonemize.wasm', 'piper_phonemize.data', 'piper_phonemize.js']) add(f);

// Stimme
for (const f of [`${VOICE}.onnx.json`, `${VOICE}.onnx`]) {
  const target = join(out, f);
  if (!existsSync(target)) {
    console.log(`Lade ${f} …`);
    const res = await fetch(`${HF}/${f}`);
    if (!res.ok || !res.body) throw new Error(`${f}: HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(target));
  }
  add(f);
}

writeFileSync(join(out, 'manifest.json'), JSON.stringify({
  voice: VOICE,
  name: 'Thorsten',
  license: 'Stimme: Thorsten-Voice-Datensatz (CC0); Engine: Piper/espeak-ng (MIT/GPL-3.0, WebAssembly)',
  files,
  total: files.reduce((n, f) => n + f.size, 0),
}, null, 2));
console.log(`Fertig: ${files.length} Dateien, ${(files.reduce((n, f) => n + f.size, 0) / 1e6).toFixed(0)} MB in public/voices/`);
