// Sprachsynthese im Hintergrund-Thread (Piper über ONNX Runtime, espeak-ng als WebAssembly),
// damit die Oberfläche beim Erzeugen einer Ansage nicht ruckelt.
import * as ort from 'onnxruntime-web';

type Req = { id: number; type: 'init'; base: string; voice: string } | { id: number; type: 'synth'; text: string };
interface Cfg { audio: { sample_rate: number }; espeak: { voice: string }; inference: { noise_scale: number; length_scale: number; noise_w: number }; speaker_id_map?: Record<string, number> }
type Phonemize = (opts: Record<string, unknown>) => Promise<{ callMain(args: string[]): void }>;

let base = '';
let cfg: Cfg;
let session: ort.InferenceSession;
let phonemize: Phonemize;

const send = (msg: unknown, transfer: Transferable[] = []) => (self as unknown as { postMessage(m: unknown, t: Transferable[]): void }).postMessage(msg, transfer);

async function init(b: string, voice: string) {
  base = b;
  ort.env.wasm.numThreads = 1; // keine Cross-Origin-Isolation nötig
  ort.env.wasm.wasmPaths = `${base}voices/ort/`;
  phonemize = (await import(/* @vite-ignore */ `${base}voices/piper_phonemize.js`)).default as Phonemize;
  cfg = await (await fetch(`${base}voices/${voice}.onnx.json`)).json() as Cfg;
  const model = await (await fetch(`${base}voices/${voice}.onnx`)).arrayBuffer();
  session = await ort.InferenceSession.create(new Uint8Array(model));
}

function phonemes(text: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Phonemisierung hat zu lange gedauert')), 30_000);
    void phonemize({
      print: (line: string) => { clearTimeout(timer); resolve((JSON.parse(line) as { phoneme_ids: number[] }).phoneme_ids); },
      printErr: () => { /* Warnungen von espeak-ng ignorieren */ },
      locateFile: (f: string) => f.endsWith('.wasm') ? `${base}voices/piper_phonemize.wasm` : f.endsWith('.data') ? `${base}voices/piper_phonemize.data` : f,
    }).then(m => m.callMain(['-l', cfg.espeak.voice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data'])).catch(reject);
  });
}

async function synth(text: string) {
  const ids = await phonemes(text.trim());
  const feeds: Record<string, ort.Tensor> = {
    input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)])),
    scales: new ort.Tensor('float32', Float32Array.from([cfg.inference.noise_scale, cfg.inference.length_scale, cfg.inference.noise_w])),
  };
  if (cfg.speaker_id_map && Object.keys(cfg.speaker_id_map).length) feeds.sid = new ort.Tensor('int64', BigInt64Array.from([0n]));
  const out = (await session.run(feeds)).output!.data as Float32Array;
  return { samples: new Float32Array(out), rate: cfg.audio.sample_rate };
}

self.addEventListener('message', async (e: Event) => {
  const msg = (e as MessageEvent<Req>).data;
  try {
    if (msg.type === 'init') { await init(msg.base, msg.voice); send({ id: msg.id, ok: true }); return; }
    const r = await synth(msg.text);
    send({ id: msg.id, ok: true, samples: r.samples, rate: r.rate }, [r.samples.buffer]);
  } catch (err) {
    send({ id: msg.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});
